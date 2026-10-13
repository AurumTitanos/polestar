'use strict';
// UI.ZoneArt (addon/Polestar/UI/ZoneArt.lua) against the real Core + Theme + UI
// manifests: the framing (the place lands in the clear stretch of the band,
// never past the painting's edges), only what the band shows is drawn, and
// the overlays (UI/ZoneArtOverlays.lua, or the client's explored ones when the
// table was not built for the map's art) laid over the base tiles the way the
// world map lays them.

const { test } = require('node:test');
const assert = require('node:assert/strict');
const { runAddon } = require('./helpers/lua');

const FILES = ['Core/Core.xml', 'Theme/Theme.xml', 'UI/UI.xml'];

// A 1002 x 668 painting of 4 x 3 tiles (file 100000 + row-major index) on map
// 7001, art 9001; a 300 x 200 overlay at (600, 100): a full tile and a
// 44-wide partial one; a 100 x 300 overlay at (50, 300): a full-height tile
// and a 44-high partial one under it; one far in the top-left corner.
const SETUP = `
C_Map = C_Map or {}
C_Map.GetMapArtLayers = function(id)
	if id == 7001 or id == 7002 then return { { layerWidth = 1002, layerHeight = 668, tileWidth = 256, tileHeight = 256 } } end
	return {}
end
C_Map.GetMapArtLayerTextures = function() local t = {}; for i = 1, 12 do t[i] = 100000 + i end; return t end
C_Map.GetMapArtID = function(id) return id == 7001 and 9001 or 9999 end
EXPLORED = {}
C_MapExplorationInfo = { GetExploredMapTextures = function(id) return EXPLORED end }
ZA = Polestar.UI.ZoneArt
ZA.RegisterOverlays("test", { [9001] = { 256, 256,
	{ 300, 200, 600, 100, 501, 502 },
	{ 100, 300, 50, 300, 503, 504 },
	{ 64, 64, 0, 0, 505 },
} })
art = ZA.Create(UIParent, 372, 172)
function shown(pool)
	local out = {}
	for _, t in ipairs(pool) do
		if t:IsShown() then
			local _, _, _, x, y = t:GetPoint(1)
			local layer, sub = t:GetDrawLayer()
			out[#out + 1] = { file = t:GetTexture(), x = x, y = y, w = t:GetWidth(), h = t:GetHeight(), tc = t.texCoord, sub = sub }
		end
	end
	table.sort(out, function(a, b) return a.file < b.file end)
	return out
end
function canvas()
	local _, _, _, x, y = art.Canvas:GetPoint(1)
	return { x = x, y = y, w = art.Canvas:GetWidth(), h = art.Canvas:GetHeight() }
end
`;

function run(script) {
	return runAddon({
		stubs: ['stub_ui.lua'],
		addons: [{ name: 'Polestar', files: FILES }],
		script: `uistub.install()\nstub.login()\n${SETUP}\n${script}`,
	}).emitted;
}

const near = (a, b, eps = 0.01) => Math.abs(a - b) < eps;

test('the place lands mid-band horizontally and in the clear stretch between the top shade and the fade', () => {
	const [out] = run(`
		local painted, reveal = ZA.Paint(art, 7001, 43.3, 68.5)
		emit({ painted = painted, reveal = reveal, c = canvas(), fy = art.lsFocusY, band = art.Band:IsShown() })`);
	assert.equal(out.painted, true);
	assert.equal(out.reveal, 'full');
	assert.equal(out.band, false);
	// Between the 40px top shade and the top of the fade (172 - floor(172 * 0.62) = 66).
	assert.equal(out.fy, 53);
	const { x, y, w, h } = out.c;
	const s = w / 1002;
	assert.ok(near(h / s, 668), 'the painting keeps its aspect');
	// Canvas offset y is "up": the place sits at (186, 53) of the band.
	assert.ok(near(x + 0.433 * w, 186), `x ${x}`);
	assert.ok(near(0.685 * h - y, 53), `place at ${0.685 * h - y}`);
	// Never past the painting's edges.
	assert.ok(x <= 0 && x >= 372 - w && y >= 0 && y <= h - 172, JSON.stringify(out.c));
});

test('a place near an edge zooms in up to ZA.REFRAME, then clamps to the edge; no focus means the middle', () => {
	const [out] = run(`
		local base = math.max(372 / 1002, 172 / 668) * ZA.ZOOM
		ZA.Paint(art, 7001, 50, 40)
		local mid = canvas()
		ZA.Paint(art, 7001, 50, 97)
		local low = canvas()
		ZA.Paint(art, 7001, 2, 50)
		local left = canvas()
		ZA.Paint(art, 7001)
		local none = canvas()
		emit({ base = base, reframe = ZA.REFRAME, mid = mid, low = low, left = left, none = none })`);
	const s = (c) => c.w / 1002;
	assert.ok(near(s(out.mid), out.base), 'no edge in the way: the base zoom');
	assert.ok(near(s(out.low), out.base * out.reframe), 'near the bottom: zoomed in to the cap');
	assert.ok(near(out.low.y, out.low.h - 172), 'then clamped to the bottom edge');
	assert.ok(near(s(out.left), out.base * out.reframe) && near(out.left.x, 0), 'near the left: capped zoom, clamped');
	assert.ok(near(out.none.x + 0.5 * out.none.w, 186) && near(0.5 * out.none.h - out.none.y, 53));
});

test('only the base tiles the band shows are drawn, each with its row-major file', () => {
	const [out] = run(`
		ZA.Paint(art, 7001, 90, 90)
		emit({ c = canvas(), tiles = shown(art.Tiles) })`);
	const { x, y, w } = out.c;
	const s = w / 1002;
	// Window in layer pixels.
	const x0 = -x / s, x1 = x0 + 372 / s, y0 = y / s, y1 = y0 + 172 / s;
	const expect = [];
	for (let r = 0; r < 3; r++) for (let c = 0; c < 4; c++) {
		if (c * 256 < x1 && c * 256 + 256 > x0 && r * 256 < y1 && r * 256 + 256 > y0) expect.push(100000 + r * 4 + c + 1);
	}
	assert.ok(expect.length < 12, 'the bottom-right corner shows part of the painting');
	assert.deepEqual(out.tiles.map((t) => t.file), expect);
	for (const t of out.tiles) {
		const i = t.file - 100001;
		assert.ok(near(t.x, (i % 4) * 256 * s) && near(t.y, -Math.floor(i / 4) * 256 * s), `tile ${t.file}`);
		assert.ok(near(t.w, 256 * s) && t.sub === 0);
	}
});

test('every overlay the band meets is laid over the base the way the world map lays it: tiles, partial tiles, texcoords', () => {
	const [out] = run(`
		art.lsZoom = 0.5 -- the whole painting in view
		ZA.Paint(art, 7001, 50, 50)
		emit({ c = canvas(), shapes = shown(art.Shapes), pool = #art.Shapes })`);
	const s = out.c.w / 1002;
	const byFile = Object.fromEntries(out.shapes.map((t) => [t.file, t]));
	assert.deepEqual(Object.keys(byFile).map(Number), [501, 502, 503, 504, 505]);
	// 300 wide over 256px tiles: a full tile, then 44 px cropped from a 64-wide file.
	assert.deepEqual(byFile[501].tc, [0, 1, 0, 200 / 256]);
	assert.ok(near(byFile[501].x, 600 * s) && near(byFile[501].y, -100 * s) && near(byFile[501].w, 256 * s) && near(byFile[501].h, 200 * s));
	assert.deepEqual(byFile[502].tc, [0, 44 / 64, 0, 200 / 256]);
	assert.ok(near(byFile[502].x, (600 + 256) * s) && near(byFile[502].w, 44 * s));
	// 300 high: row-major, the second file is the partial row under the first.
	assert.deepEqual(byFile[503].tc, [0, 100 / 128, 0, 1]);
	assert.deepEqual(byFile[504].tc, [0, 100 / 128, 0, 44 / 64]);
	assert.ok(near(byFile[504].y, -(300 + 256) * s) && near(byFile[504].h, 44 * s));
	assert.ok(out.shapes.every((t) => t.sub === 1), 'above the base tiles');
});

test('overlays outside the band get no texture, and textures are pooled across paints', () => {
	const [out] = run(`
		ZA.Paint(art, 7001, 90, 20) -- right, top: only the (600, 100) overlay is in view
		local a = shown(art.Shapes)
		local poolA = #art.Shapes
		ZA.Paint(art, 7001, 8, 90) -- left, bottom: only the (50, 300) one
		local b = shown(art.Shapes)
		ZA.Paint(art, 7001, 90, 20)
		emit({ a = a, b = b, poolA = poolA, poolAfter = #art.Shapes, again = #shown(art.Shapes) })`);
	assert.deepEqual(out.a.map((t) => t.file), [501, 502]);
	assert.deepEqual(out.b.map((t) => t.file), [503, 504]);
	assert.equal(out.poolA, 2);
	assert.equal(out.poolAfter, 2, 'no texture made twice');
	assert.equal(out.again, 2);
});

test('a map whose art the table was not built for shows only what the client lists as explored', () => {
	const [out] = run(`
		art.lsZoom = 0.5
		EXPLORED = {
			{ textureWidth = 128, textureHeight = 128, offsetX = 10, offsetY = 20, fileDataIDs = { 601 }, isShownByMouseOver = false, isDrawOnTopLayer = false },
			{ textureWidth = 128, textureHeight = 128, offsetX = 300, offsetY = 300, fileDataIDs = { 602 }, isShownByMouseOver = true, isDrawOnTopLayer = false },
			{ textureWidth = 64, textureHeight = 64, offsetX = 500, offsetY = 300, fileDataIDs = { 603 }, isShownByMouseOver = false, isDrawOnTopLayer = true },
		}
		local _, reveal = ZA.Paint(art, 7002, 50, 50)
		local r = { reveal = reveal, shapes = shown(art.Shapes) }
		C_MapExplorationInfo = nil
		local _, none = ZA.Paint(art, 7002, 50, 50)
		r.none, r.after = none or false, #shown(art.Shapes)
		emit(r)`);
	assert.equal(out.reveal, 'explored');
	assert.deepEqual(out.shapes.map((t) => [t.file, t.sub]), [[601, 1], [603, 2]], 'mouse-over-only skipped, draw-on-top above');
	assert.equal(out.none, false);
	assert.equal(out.after, 0);
});

test('no art for the map: the night band, nothing of the painting left showing', () => {
	const [out] = run(`
		ZA.Paint(art, 7001, 50, 50)
		local painted = ZA.Paint(art, 4242, 50, 50, 2)
		emit({ painted = painted, band = art.Band:IsShown(), tiles = #shown(art.Tiles), shapes = #shown(art.Shapes) })`);
	assert.deepEqual(out, { painted: false, band: true, tiles: 0, shapes: 0 });
});

test('the generated overlay table registers every Forever zone map art, Durotar among them', () => {
	const [out] = runAddon({
		stubs: ['stub_ui.lua'],
		addons: [{ name: 'Polestar', files: FILES }],
		script: `uistub.install()\nstub.login()
			local ZA = Polestar.UI.ZoneArt
			local arts, n = 0, 0
			for _, list in pairs(ZA.overlays) do arts = arts + 1; n = n + #list - 2 end
			local d = ZA.overlays[2169]
			emit({ build = ZA.overlaysBuild, arts = arts, overlays = n, durotar = d and { d[1], d[2], #d - 2 } or false })`,
	}).emitted;
	assert.match(out.build, /^1\.60\.1\.\d+$/);
	assert.ok(out.arts > 40 && out.overlays > 500, JSON.stringify(out));
	assert.deepEqual(out.durotar.slice(0, 2), [256, 256]);
	assert.ok(out.durotar[2] > 10);
});
