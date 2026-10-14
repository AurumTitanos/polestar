'use strict';
// `maps overlays`: every world map overlay (the explored-area paintings the
// world map lays over a zone's base art) of every zone map, from the client's
// DB2 tables -> addon/Polestar/UI/ZoneArtOverlays.lua, so the zone art can
// show a map whole, without fog of war. The client itself only lists the
// overlays this character has explored (C_MapExplorationInfo.
// GetExploredMapTextures); no API returns them all.
//
// Tables (wago.tools CSV, cached under <sources>/wago/<build>/):
//   UiMapXMapArt         uiMapID -> UiMapArtID (every phase)
//   UiMapArt             UiMapArtID -> UiMapArtStyleID
//   UiMapArtStyleLayer   the style's layer 0 tile size (overlay tile split)
//   WorldMapOverlay      per art: texture size, offset on the layer
//   WorldMapOverlayTile  per overlay: tile FileDataIDs at RowIndex/ColIndex
//   UiMap                names, for comments only
//
// Keyed by UiMapArtID: the addon draws a table only when C_Map.GetMapArtID
// returns the art it was built for, so a client whose maps differ falls back
// to the explored-only API. Same inputs give byte-identical output.

const fs = require('node:fs');
const path = require('node:path');
const { parseCsv } = require('../data/csv');
const { tableUrl } = require('../data/wago');
const { header } = require('../generated');

const ROOT = path.join(__dirname, '..', '..', '..');
// The Forever client (1.60.1, product wow_classic_beta on wago.tools).
const BUILD = '1.60.1.70338';
const TABLES = ['UiMapXMapArt', 'UiMapArt', 'UiMapArtStyleLayer', 'WorldMapOverlay', 'WorldMapOverlayTile', 'UiMap'];

async function fetchText(fetchImpl, url) {
	let last;
	for (let attempt = 1; attempt <= 3; attempt++) {
		try {
			const res = await fetchImpl(url, { headers: { 'user-agent': 'polestar-data-build' }, signal: AbortSignal.timeout(600000) });
			if (!res.ok) throw new Error(`GET ${url}: HTTP ${res.status}`);
			return await res.text();
		} catch (err) {
			last = err;
		}
	}
	throw last;
}

// -> { [table]: rows } from <sourcesDir>/wago/<build>/, fetching what is missing.
async function loadTables({ sourcesDir, build = BUILD, offline = false, fetchImpl = globalThis.fetch, log = () => {} }) {
	const dir = path.join(sourcesDir, 'wago', build);
	const tables = {};
	for (const t of TABLES) {
		const file = path.join(dir, `${t}.csv`);
		if (!fs.existsSync(file)) {
			if (offline) throw new Error(`--offline: missing cached ${path.relative(process.cwd(), file)}`);
			const url = tableUrl(t, build);
			log(`fetching ${url}`);
			const text = await fetchText(fetchImpl, url);
			const rows = parseCsv(text);
			if (!rows.length || !('ID' in rows[0])) throw new Error(`${url}: not a DB2 CSV export`);
			fs.mkdirSync(dir, { recursive: true });
			fs.writeFileSync(`${file}.tmp`, text);
			fs.renameSync(`${file}.tmp`, file);
		}
		tables[t] = parseCsv(fs.readFileSync(file, 'utf8'));
	}
	return tables;
}

const num = Number;

// tables: { UiMapXMapArt, UiMapArt, UiMapArtStyleLayer, WorldMapOverlay,
// WorldMapOverlayTile[, UiMap] } rows (CSV strings or numbers).
// -> { arts: { [artID]: { maps: [uiMapID], names: [name], tileWidth, tileHeight,
//      overlays: [{ id, width, height, x, y, files: [fileDataID row-major] }] } },
//      count, tiles, warnings }
function buildOverlays(tables) {
	const warnings = [];
	const mapsOf = new Map();
	for (const r of tables.UiMapXMapArt) {
		const art = num(r.UiMapArtID);
		if (!mapsOf.has(art)) mapsOf.set(art, new Set());
		mapsOf.get(art).add(num(r.UiMapID));
	}
	const styleOf = new Map(tables.UiMapArt.map((r) => [num(r.ID), num(r.UiMapArtStyleID)]));
	const layerOf = new Map();
	for (const r of tables.UiMapArtStyleLayer) if (num(r.LayerIndex) === 0) layerOf.set(num(r.UiMapArtStyleID), r);
	const nameOf = new Map((tables.UiMap || []).map((r) => [num(r.ID), r.Name_lang]));
	const tilesOf = new Map();
	for (const t of tables.WorldMapOverlayTile) {
		if (num(t.LayerIndex) !== 0) continue;
		const id = num(t.WorldMapOverlayID);
		if (!tilesOf.has(id)) tilesOf.set(id, []);
		tilesOf.get(id).push(t);
	}
	const arts = {};
	let count = 0;
	let tileCount = 0;
	const rows = [...tables.WorldMapOverlay].sort((a, b) => num(a.UiMapArtID) - num(b.UiMapArtID) || num(a.ID) - num(b.ID));
	for (const o of rows) {
		const artID = num(o.UiMapArtID);
		if (!mapsOf.has(artID)) continue; // art no map shows
		const layer = layerOf.get(styleOf.get(artID));
		if (!layer) {
			warnings.push(`UiMapArt ${artID}: no style layer 0; overlay ${o.ID} skipped`);
			continue;
		}
		const tw = num(layer.TileWidth), th = num(layer.TileHeight);
		const width = num(o.TextureWidth), height = num(o.TextureHeight);
		const cols = Math.ceil(width / tw), rowsN = Math.ceil(height / th);
		const grid = new Map();
		for (const t of tilesOf.get(num(o.ID)) || []) grid.set(`${num(t.RowIndex)},${num(t.ColIndex)}`, num(t.FileDataID));
		const files = [];
		for (let r = 0; r < rowsN; r++) for (let c = 0; c < cols; c++) files.push(grid.get(`${r},${c}`));
		if (!(width > 0 && height > 0)) continue; // an empty row: nothing to draw
		if (grid.size !== cols * rowsN || files.some((f) => !f)) {
			warnings.push(`WorldMapOverlay ${o.ID} (art ${artID}): ${grid.size} tiles for a ${cols}x${rowsN} grid; skipped`);
			continue;
		}
		if (!arts[artID]) {
			const maps = [...mapsOf.get(artID)].sort((a, b) => a - b);
			arts[artID] = { maps, names: maps.map((m) => nameOf.get(m) || null), tileWidth: tw, tileHeight: th, overlays: [] };
		}
		arts[artID].overlays.push({ id: num(o.ID), width, height, x: num(o.OffsetX), y: num(o.OffsetY), files });
		count++;
		tileCount += files.length;
	}
	return { arts, count, tiles: tileCount, warnings };
}

function emitLua(result, build = BUILD) {
	const lines = [];
	lines.push(header('lua', 'maps overlays', "the client's map tables"));
	lines.push(`-- Every world map overlay of every zone map, from the client's own tables`);
	lines.push(`-- (UiMapXMapArt, UiMapArt, UiMapArtStyleLayer, WorldMapOverlay,`);
	lines.push(`-- WorldMapOverlayTile; build ${build} via wago.tools), so UI.ZoneArt can`);
	lines.push('-- show a zone without fog of war (tools/lib/maps/overlays.js). File IDs only:');
	lines.push("-- the textures are the player's own client files.");
	lines.push('');
	lines.push('local ADDON, ns = ...');
	lines.push('local ZA = ns.UI and ns.UI.ZoneArt');
	lines.push('if not (ZA and ZA.RegisterOverlays) then return end');
	lines.push('');
	lines.push(`ZA.RegisterOverlays(${JSON.stringify(build)}, {`);
	lines.push('\t-- [uiMapArtID] = { tileWidth, tileHeight, { textureWidth, textureHeight, offsetX, offsetY, fileDataID, ... (row-major) }, ... }');
	for (const id of Object.keys(result.arts).map(Number).sort((a, b) => a - b)) {
		const a = result.arts[id];
		const label = a.maps.map((m, i) => (a.names[i] ? `${a.names[i]} (${m})` : String(m))).join(', ');
		lines.push(`\t[${id}] = { ${a.tileWidth}, ${a.tileHeight}, -- ${label.replace(/\n/g, ' ')}`);
		for (const o of a.overlays) lines.push(`\t\t{ ${[o.width, o.height, o.x, o.y, ...o.files].join(', ')} },`);
		lines.push('\t},');
	}
	lines.push('})');
	lines.push('');
	return lines.join('\n');
}

module.exports = { buildOverlays, emitLua, loadTables, BUILD, TABLES, ROOT };
