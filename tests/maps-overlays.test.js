'use strict';
// Zone art overlays (tools/lib/maps/overlays.js -> addon/Polestar/UI/ZoneArtOverlays.lua):
// the table built from synthetic DB2 rows (keyed by art, tiles row-major,
// partial tiles, bad rows dropped), the generated Lua, and the addon reading it.

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { buildOverlays, emitLua, loadTables, TABLES } = require('../tools/lib/maps/overlays');
const { runAddon } = require('./helpers/lua');
const { tmpdir } = require('./helpers/tmp');

// CSV rows are strings, as wago.tools exports them.
const str = (rows) => rows.map((r) => Object.fromEntries(Object.entries(r).map(([k, v]) => [k, String(v)])));
const overlay = (ID, UiMapArtID, TextureWidth, TextureHeight, OffsetX, OffsetY) => ({ ID, UiMapArtID, TextureWidth, TextureHeight, OffsetX, OffsetY, Flags: 0 });
const tile = (ID, WorldMapOverlayID, RowIndex, ColIndex, FileDataID, LayerIndex = 0) => ({ ID, WorldMapOverlayID, RowIndex, ColIndex, FileDataID, LayerIndex });

const TABLES_FIXTURE = {
	// Map 10 shows art 100; map 11 (another phase of it) art 101; art 102 is shown by no map.
	UiMapXMapArt: str([
		{ ID: 1, PhaseID: 0, UiMapArtID: 100, UiMapID: 10 },
		{ ID: 2, PhaseID: 0, UiMapArtID: 101, UiMapID: 11 },
		{ ID: 3, PhaseID: 7, UiMapArtID: 101, UiMapID: 12 },
	]),
	UiMapArt: str([
		{ ID: 100, UiMapArtStyleID: 1 },
		{ ID: 101, UiMapArtStyleID: 4 },
		{ ID: 102, UiMapArtStyleID: 1 },
	]),
	UiMapArtStyleLayer: str([
		{ ID: 1, LayerIndex: 0, LayerWidth: 1002, LayerHeight: 668, TileWidth: 256, TileHeight: 256, UiMapArtStyleID: 1 },
		{ ID: 6, LayerIndex: 0, LayerWidth: 512, LayerHeight: 512, TileWidth: 512, TileHeight: 512, UiMapArtStyleID: 4 },
	]),
	WorldMapOverlay: str([
		overlay(20, 100, 600, 300, 10, 20), // 3 x 2 tiles, the last column 88 wide, the last row 44 high
		overlay(21, 100, 128, 128, 400, 400), // one tile
		overlay(22, 100, 256, 256, 0, 0), // tiles missing: dropped with a warning
		overlay(23, 100, 0, 0, 0, 0), // empty: dropped quietly
		overlay(30, 101, 600, 300, 5, 6), // 512px tiles: 2 x 1
		overlay(40, 102, 128, 128, 0, 0), // art no map shows: dropped
	]),
	WorldMapOverlayTile: str([
		// Out of order on purpose; one tile of another layer to ignore.
		tile(1, 20, 1, 2, 1006), tile(2, 20, 0, 0, 1001), tile(3, 20, 1, 0, 1004),
		tile(4, 20, 0, 2, 1003), tile(5, 20, 1, 1, 1005), tile(6, 20, 0, 1, 1002),
		tile(7, 20, 0, 0, 9999, 1),
		tile(8, 21, 0, 0, 2001),
		tile(9, 30, 0, 1, 3002), tile(10, 30, 0, 0, 3001),
		tile(11, 40, 0, 0, 4001),
	]),
	UiMap: [{ ID: '10', Name_lang: 'Greenvale' }, { ID: '11', Name_lang: 'Isle' }, { ID: '12', Name_lang: 'Isle (phased)' }],
};

test('overlays are keyed by the art they belong to, tiles row-major, partial tiles kept, broken rows dropped', () => {
	const out = buildOverlays(TABLES_FIXTURE);
	assert.deepEqual(Object.keys(out.arts), ['100', '101']);
	const a = out.arts[100];
	assert.deepEqual([a.maps, a.names, a.tileWidth, a.tileHeight], [[10], ['Greenvale'], 256, 256]);
	assert.deepEqual(a.overlays, [
		{ id: 20, width: 600, height: 300, x: 10, y: 20, files: [1001, 1002, 1003, 1004, 1005, 1006] },
		{ id: 21, width: 128, height: 128, x: 400, y: 400, files: [2001] },
	]);
	// The art's own tile size splits it (512 here), and every map showing it is named.
	assert.deepEqual(out.arts[101], { maps: [11, 12], names: ['Isle', 'Isle (phased)'], tileWidth: 512, tileHeight: 512,
		overlays: [{ id: 30, width: 600, height: 300, x: 5, y: 6, files: [3001, 3002] }] });
	assert.equal(out.count, 3);
	assert.equal(out.tiles, 9);
	assert.deepEqual(out.warnings, ['WorldMapOverlay 22 (art 100): 0 tiles for a 1x1 grid; skipped']);
});

test('the generated Lua registers the table with ZoneArt, byte-identical for the same input', () => {
	const result = buildOverlays(TABLES_FIXTURE);
	const lua = emitLua(result, '9.9.9.1');
	assert.equal(lua, emitLua(buildOverlays(TABLES_FIXTURE), '9.9.9.1'));
	assert.match(lua, /ZA\.RegisterOverlays\("9\.9\.9\.1", \{/);
	assert.match(lua, /\[100\] = \{ 256, 256, -- Greenvale \(10\)\n\t\t\{ 600, 300, 10, 20, 1001, 1002, 1003, 1004, 1005, 1006 \},/);
	const dir = tmpdir('polestar-overlays-');
	const file = path.join(dir, 'ZoneArtOverlays.lua');
	fs.writeFileSync(file, lua);
	const [out] = runAddon({
		stubs: ['stub_ui.lua'],
		addons: [{ name: 'Polestar', files: ['Core/Core.xml', 'Theme/Theme.xml', 'UI/UI.xml'] }],
		script: `uistub.install()
			local ZA = Polestar.UI.ZoneArt
			assert(loadfile(${JSON.stringify(file)}))("Polestar", { UI = Polestar.UI })
			emit({ ZA.overlaysBuild, ZA.overlays[100], ZA.overlays[101][2] })`,
	}).emitted;
	assert.equal(out[0], '9.9.9.1');
	assert.deepEqual(out[1], [256, 256, [600, 300, 10, 20, 1001, 1002, 1003, 1004, 1005, 1006], [128, 128, 400, 400, 2001]]);
	assert.equal(out[2], 512);
});

test('tables come from the source cache, fetched once when missing; --offline never fetches', async () => {
	const dir = tmpdir('polestar-wago-');
	const fetched = [];
	const fetchImpl = async (url) => {
		fetched.push(url);
		return { ok: true, text: async () => 'ID,Name_lang\n1,X\n' };
	};
	await assert.rejects(loadTables({ sourcesDir: dir, build: '1.2.3.4', offline: true }), /--offline: missing cached/);
	const t = await loadTables({ sourcesDir: dir, build: '1.2.3.4', fetchImpl });
	assert.equal(fetched.length, TABLES.length);
	assert.match(fetched[0], /^https:\/\/wago\.tools\/db2\/UiMapXMapArt\/csv\?build=1\.2\.3\.4$/);
	assert.deepEqual(t.UiMap, [{ ID: '1', Name_lang: 'X' }]);
	await loadTables({ sourcesDir: dir, build: '1.2.3.4', fetchImpl, offline: true });
	assert.equal(fetched.length, TABLES.length, 'cached: nothing fetched again');
});
