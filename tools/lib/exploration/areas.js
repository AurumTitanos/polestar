'use strict';
// Discoverable map areas per zone, from the Forever client's map tables
// (wago.tools CSV, cached under <sources>/wago/<build>/ like every other
// client table this repo reads; build BUILD, the Forever client 1.60.1).
//
// Columns used (inspected on wow_classic_beta 1.60.1.70338, 2026-10; the
// same as Classic Era 1.15.9's):
//   WorldMapOverlay  ID, UiMapArtID, TextureWidth, TextureHeight, OffsetX, OffsetY,
//                    HitRectTop, HitRectBottom, HitRectLeft, HitRectRight,
//                    AreaID_0..3 (the AreaTable areas this map piece stands for)
//   UiMapXMapArt     UiMapArtID -> UiMapID (PhaseID 0)
//   UiMap            ID, Name_lang, Type (1 world, 2 continent, 3 zone), ParentUiMapID
//   AreaTable        ID, AreaName_lang, ExplorationLevel
//
// One overlay is one piece of the zone map that discovery reveals. Offsets and
// hit rects are pixels on the 1002x668 zone map canvas, the client's own
// (live) map frame, so the hit rect's centre in percent is a live-frame map
// coordinate: the spot the client tests for "explored here" and where the
// area's name sits. Forever moved some maps (Mulgore, Eastern Plaguelands,
// Redridge Mountains: their live frame is no longer the Era one) and added
// zones (Mount Hyjal, Riverglades, Shen'dralas, Zephras Isle); Forever's
// tables are the truth in game. Some Forever overlays are hit rects with no
// texture (0 x 0): still discoverable areas. Validated against known places
// (tests/exploration.test.js): Goldshire 41.2,64.7 in Elwynn, Razor Hill
// 54.6,42.7 in Durotar, and every area named like a flight master's town lies
// within a few hundred yards of it.
//
// An overlay with several AreaIDs (Kharanos / Steelgrill's Depot) is revealed
// by discovering any one of them, so it is one goal.
//
// Zones on no continent are left out (battlegrounds, instances), except the
// `islands` named by the caller: zone maps that are a world of their own
// (Zephras Isle, parented to Azeroth); each is its own "continent".

const { loadTables } = require('../professions/tables');
const { BUILD } = require('../maps/overlays');

const TABLES = ['WorldMapOverlay', 'UiMapXMapArt', 'UiMap', 'AreaTable'];
const CANVAS_W = 1002;
const CANVAS_H = 668;
const UIMAP_CONTINENT = 2;
const UIMAP_ZONE = 3;

function num(v) {
	const n = Number(v);
	return Number.isFinite(n) ? n : 0;
}

function round1(v) {
	return Math.round(v * 10) / 10;
}

// Centre of the overlay's hit rect in map percent; the texture's centre when
// the hit rect is empty, inverted or not inside the texture (Forever moved
// Eastern Plaguelands' textures with its new frame but kept 11 old hit
// rects), flagged `fromTexture`. Forever pads many overlay textures to powers
// of two, so that centre leans towards the texture's lower right; plan.js
// prefers a known place of the area's name.
const HIT_SLACK = 4; // pixels a hit rect may stick out of its texture
function overlayCentre(o) {
	const x0 = num(o.HitRectLeft);
	const x1 = num(o.HitRectRight);
	const y0 = num(o.HitRectTop);
	const y1 = num(o.HitRectBottom);
	const tx0 = num(o.OffsetX);
	const tx1 = tx0 + num(o.TextureWidth);
	const ty0 = num(o.OffsetY);
	const ty1 = ty0 + num(o.TextureHeight);
	const textured = tx1 > tx0 && ty1 > ty0;
	const inside = !textured || (x0 >= tx0 - HIT_SLACK && x1 <= tx1 + HIT_SLACK && y0 >= ty0 - HIT_SLACK && y1 <= ty1 + HIT_SLACK);
	if (x1 > x0 && y1 > y0 && inside) return { x: round1(((x0 + x1) / 2 / CANVAS_W) * 100), y: round1(((y0 + y1) / 2 / CANVAS_H) * 100) };
	return { x: round1(((tx0 + tx1) / 2 / CANVAS_W) * 100), y: round1(((ty0 + ty1) / 2 / CANVAS_H) * 100), fromTexture: true };
}

// -> { [uiMapID]: [{ overlay, x, y, areas: [{ id, name, level }] }] } for the
// zone maps of the continents and the islands (uiMapIDs; battlegrounds and
// cities without overlays drop out), each list in overlay ID order.
function extractAreas({ WorldMapOverlay, UiMapXMapArt, UiMap, AreaTable }, { islands = [] } = {}) {
	const maps = new Map(UiMap.map((m) => [num(m.ID), m]));
	const island = new Set(islands.map(num));
	const continentZone = (id) => {
		const m = maps.get(id);
		if (!m || num(m.Type) !== UIMAP_ZONE) return false;
		if (island.has(id)) return true;
		const p = maps.get(num(m.ParentUiMapID));
		return !!p && num(p.Type) === UIMAP_CONTINENT;
	};
	const mapsOfArt = new Map();
	for (const r of UiMapXMapArt) {
		if (num(r.PhaseID) !== 0) continue;
		const art = num(r.UiMapArtID);
		if (!mapsOfArt.has(art)) mapsOfArt.set(art, []);
		mapsOfArt.get(art).push(num(r.UiMapID));
	}
	const areas = new Map(AreaTable.map((a) => [num(a.ID), a]));
	const out = {};
	for (const o of WorldMapOverlay.slice().sort((a, b) => num(a.ID) - num(b.ID))) {
		const list = [0, 1, 2, 3]
			.map((i) => num(o[`AreaID_${i}`]))
			.filter((id) => id && areas.has(id))
			.map((id) => {
				const a = areas.get(id);
				return { id, name: String(a.AreaName_lang).trim(), level: num(a.ExplorationLevel) };
			});
		if (!list.length) continue;
		for (const map of mapsOfArt.get(num(o.UiMapArtID)) || []) {
			if (!continentZone(map)) continue;
			(out[map] = out[map] || []).push({ overlay: num(o.ID), ...overlayCentre(o), areas: list });
		}
	}
	return out;
}

// The zone maps' continent (UiMap parent; an island is its own)
// -> { [uiMapID]: continentUiMapID }.
function continentOf({ UiMap }, { islands = [] } = {}) {
	const island = new Set(islands.map(num));
	const out = {};
	for (const m of UiMap) if (num(m.Type) === UIMAP_ZONE) out[num(m.ID)] = island.has(num(m.ID)) ? num(m.ID) : num(m.ParentUiMapID);
	return out;
}

// -> { build, areas, continents, urls, warnings }
async function loadAreas({ sourcesDir, build = BUILD, offline = false, fetchImpl, log, islands = [] } = {}) {
	const res = await loadTables({ sourcesDir, build, offline, fetchImpl, log, tables: TABLES });
	return {
		build: res.build,
		areas: extractAreas(res.tables, { islands }),
		continents: continentOf(res.tables, { islands }),
		urls: res.urls,
		warnings: res.warnings,
	};
}

module.exports = { extractAreas, overlayCentre, continentOf, loadAreas, TABLES, CANVAS_W, CANVAS_H };
