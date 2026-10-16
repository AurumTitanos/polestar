'use strict';
// The client's AreaTable as `data build` caches it from wago.tools:
// <sources>/wago/<newest Forever build>/AreaTable.csv. Its IDs are what
// C_Map.GetAreaInfo takes in the game, and AreaName_lang is the English
// (enUS) name GetZoneText, GetSubZoneText and GetBindLocation return there on
// an English client. `travel build` gives each inn its area with it
// (tools/lib/travel/inns.js), `compile` the place goals
// (tools/lib/dsl/places.js, docs/GUIDE_FORMAT.md "Places by ID").

const fs = require('node:fs');
const path = require('node:path');
const { parseCsv } = require('./csv');
const { compareVersions, PRODUCTS } = require('./wago');

// A build names a cache folder: digits and dots only.
const BUILD_RE = /^\d+(\.\d+)+$/;
const COLUMNS = ['ID', 'AreaName_lang', 'ContinentID', 'ParentAreaID'];
// The open world: Eastern Kingdoms (0) and Kalimdor (1). Forever keeps
// copies of some towns on other continents (Goldshire, Darkshire).
const OPEN_WORLD = new Set([0, 1]);
// ParentAreaID chains are short (subzone -> zone); this bounds a bad one.
const MAX_HOPS = 8;

// The newest cached Forever build holding AreaTable.csv, or null.
function areaBuild(sourcesDir) {
	const root = path.join(sourcesDir, 'wago');
	if (!fs.existsSync(root)) return null;
	const builds = fs
		.readdirSync(root)
		.filter((b) => BUILD_RE.test(b) && PRODUCTS.forever.family.test(b) && fs.existsSync(path.join(root, b, 'AreaTable.csv')))
		.sort(compareVersions);
	return builds.length ? builds[builds.length - 1] : null;
}

// -> { build, byId: Map(id -> area), byName: Map(lowercased name -> [area]) }
// or null without a cached AreaTable; area = { id, name, c (ContinentID),
// parent (ParentAreaID, 0 for a zone) }.
function loadAreas(sourcesDir) {
	const build = sourcesDir ? areaBuild(sourcesDir) : null;
	if (!build) return null;
	const file = path.join(sourcesDir, 'wago', build, 'AreaTable.csv');
	const rows = parseCsv(fs.readFileSync(file, 'utf8'));
	const missing = rows.length ? COLUMNS.filter((c) => !(c in rows[0])) : COLUMNS;
	if (missing.length) throw new Error(`${file}: AreaTable lacks column(s) ${missing.join(', ')}`);
	const byId = new Map();
	const byName = new Map();
	for (const r of rows) {
		const area = { id: Number(r.ID), name: String(r.AreaName_lang || ''), c: Number(r.ContinentID), parent: Number(r.ParentAreaID) || 0 };
		if (!Number.isInteger(area.id) || !area.name) continue;
		byId.set(area.id, area);
		const key = area.name.toLowerCase();
		if (!byName.has(key)) byName.set(key, []);
		byName.get(key).push(area);
	}
	return { build, byId, byName };
}

// Whether area `id` is the area `zone` or lies in it (its ParentAreaID chain).
function within(areas, id, zone) {
	let a = areas.byId.get(id);
	for (let hops = 0; a && hops < MAX_HOPS; hops++) {
		if (a.id === zone) return true;
		a = a.parent ? areas.byId.get(a.parent) : null;
	}
	return false;
}

// The one area a place name stands for, or null. Of the areas of that name
// (any case): those in the area `zone` (a zone's AreaTable ID) when it is
// given and any is; then, while several remain, those of the open world;
// null unless exactly one is left.
function areaNamed(areas, name, zone) {
	if (!areas || typeof name !== 'string') return null;
	let list = areas.byName.get(name.trim().toLowerCase()) || [];
	if (zone) {
		const inZone = list.filter((a) => within(areas, a.id, zone));
		if (inZone.length) list = inZone;
	}
	if (list.length > 1) list = list.filter((a) => OPEN_WORLD.has(a.c));
	return list.length === 1 ? list[0] : null;
}

module.exports = { loadAreas, areaNamed };
