'use strict';
// Polestar.Pins (addon/Polestar/Nav/Pins.lua): the shared map/minimap pin
// service. Real Core/Init.lua + Nav/Nav.xml against tests/lua/stub_nav.lua
// (map 9000: 20 yd per map percent, origin at its centre; map 9001 on continent 1).

const { test } = require('node:test');
const assert = require('node:assert/strict');
const { runAddon } = require('./helpers/lua');

const NAV = { name: 'Polestar', files: ['Core/Init.lua', 'Nav/Nav.xml'] };

const PRELUDE = `
local Pins = Polestar.Pins
local nav = stub.nav
local function at(wx, wy, extra)
	local m, x, y = nav.mapPoint(wx, wy)
	local p = { map = m, x = x, y = y }
	for k, v in pairs(extra or {}) do p[k] = v end
	return p
end
local function frames(layer) return #Pins.GetMinimapFrames(layer) end
-- Count SetPoint calls on minimap pin frames.
local setPoints = 0
local origSetPoint = stub.Methods.SetPoint
stub.Methods.SetPoint = function(self, ...)
	if self.parent == Minimap then setPoints = setPoints + 1 end
	return origSetPoint(self, ...)
end
local function minimapFrameCount()
	local n = 0
	for _, f in ipairs(stub.frames) do if f.parent == Minimap then n = n + 1 end end
	return n
end
`;

function run(script) {
	return runAddon({ stubs: ['stub_nav.lua'], addons: [NAV], login: true, script: PRELUDE + script }).emitted;
}

test('a 500-pin layer costs nothing per frame while the player stands still', () => {
	const [out] = run(`
		local pins = {}
		local seed = 7
		local function rnd() seed = (seed * 1103515245 + 12345) % 2147483648; return seed / 2147483648 end
		for i = 1, 500 do pins[i] = at(rnd() * 1600 - 800, rnd() * 1600 - 800, { tooltip = "pin " .. i }) end
		Pins.SetLayer("quests", pins, { world = true, minimap = true })
		local r = {}
		r.drawn = frames("quests")
		stub.advance(1)                                  -- settle
		setPoints = 0
		local updates = 0
		for _, f in ipairs(stub.frames) do
			if f.parent == Minimap and f.scripts.OnUpdate then updates = updates + 1 end
		end
		stub.advance(3)                                  -- stand still for 3 s
		r.stillSetPoints = setPoints
		r.driverShown = Pins.driver:IsShown()
		r.pinOnUpdates = updates
		nav.place(40, 30)                                -- move
		stub.advance(0.3)
		r.movingSetPoints = setPoints
		r.drawnAfterMove = frames("quests")
		r.created = minimapFrameCount()
		for _ = 1, 3 do                                  -- walk back and forth: frames are reused
			nav.place(0, 0); stub.advance(0.3)
			nav.place(40, 30); stub.advance(0.3)
		end
		r.createdAfter = minimapFrameCount()
		stub.advance(1)
		r.driverIdle = not Pins.driver:IsShown()
		local inside = 0
		for _, p in ipairs(pins) do
			local _, wx, wy = nav.Compat.MapToWorld(p.map, p.x, p.y)
			if (wx - 40) ^ 2 + (wy - 30) ^ 2 <= (466 + 2 / 3) ^ 2 / 4 then inside = inside + 1 end
		end
		r.inside = inside
		emit(r)`);
	assert.equal(out.stillSetPoints, 0, 'no repositioning while stationary');
	assert.equal(out.driverShown, false, 'the update driver is asleep');
	assert.equal(out.pinOnUpdates, 0, 'pin frames have no OnUpdate scripts');
	assert.ok(out.movingSetPoints > 0, 'moving repositions pins');
	assert.ok(out.drawn > 0 && out.drawn < 500, `distance-filtered (${out.drawn} of 500 drawn)`);
	assert.equal(out.drawnAfterMove, out.inside, 'exactly the pins within the minimap view radius');
	assert.equal(out.createdAfter, out.created, 'pooled: no new frames on repeat visits');
	assert.equal(out.driverIdle, true);
});

test('layer changes in one frame share one minimap redraw, which visits only the pins near the player', () => {
	const [out] = run(`
		local seed = 11
		local function rnd() seed = (seed * 1103515245 + 12345) % 2147483648; return seed / 2147483648 end
		local here, there = {}, {}
		for i = 1, 2000 do here[i] = at(rnd() * 2000 - 1000, rnd() * 2000 - 1000) end
		for i = 1, 2000 do there[i] = { map = 9001, x = rnd() * 100, y = rnd() * 100 } end
		nav.place(0, 0)                                  -- a grid corner: four squares around the player
		stub.advance(1)
		local r = {}
		local draws = Pins.stats.draws
		Pins.SetLayer("a", here, { world = true, minimap = true })
		Pins.SetLayer("b", there, { world = true, minimap = true })
		Pins.SetLayer("a", here, { world = true, minimap = true })
		r.sameFrame = Pins.stats.draws - draws
		stub.advance(0.05)
		r.nextFrame = Pins.stats.draws - draws
		local visited = Pins.stats.visited
		nav.place(1, 1)
		stub.advance(0.3)
		r.visited = Pins.stats.visited - visited
		r.draws = Pins.stats.draws - draws - r.nextFrame
		r.drawn = frames("a")
		r.far = frames("b")
		local inside = 0
		for _, p in ipairs(here) do
			local _, wx, wy = nav.Compat.MapToWorld(p.map, p.x, p.y)
			if (wx - 1) ^ 2 + (wy - 1) ^ 2 <= (466 + 2 / 3) ^ 2 / 4 then inside = inside + 1 end
		end
		r.inside = inside
		emit(r)`);
	assert.equal(out.sameFrame, 0, 'nothing is drawn while the frame is still changing layers');
	assert.equal(out.nextFrame, 1, 'one redraw for three layer changes');
	assert.equal(out.far, 0, 'pins on another continent are not drawn');
	assert.equal(out.drawn, out.inside, 'exactly the pins within the minimap view radius');
	assert.ok(out.draws >= 1 && out.visited / out.draws < 1000, `a redraw examined ${out.visited / out.draws} of 4000 pins`);
});

test('layer visibility hides and restores a layer on both surfaces, even before it exists', () => {
	const [out] = run(`
		local r = {}
		Pins.SetLayerVisible("maps.inns", false)
		Pins.SetLayer("maps.inns", { at(50, 0, { tooltip = "Inn" }), at(-50, 0) })
		Pins.SetLayer("quests", { at(0, 50) })
		nav.showWorldMap(9000)
		r.hidden = { frames("maps.inns"), frames("quests"), #nav.pins() }
		Pins.SetLayerVisible("maps.inns", true)
		r.shown = { frames("maps.inns"), frames("quests"), #nav.pins() }
		r.visible = Pins.IsLayerVisible("maps.inns")
		Pins.ClearLayer("maps.inns")
		r.cleared = { frames("maps.inns"), #nav.pins(), Pins.IsLayerVisible("maps.inns") }
		emit(r)`);
	assert.deepEqual(out.hidden, [0, 1, 1]);
	assert.deepEqual(out.shown, [2, 1, 3]);
	assert.equal(out.visible, true);
	assert.deepEqual(out.cleared, [0, 1, false]);
});

test('edge clamping is per layer: an edge layer pins far targets to the rim, others drop them', () => {
	const [out] = run(`
		nav.viewRadius = 200                             -- 140 px minimap: 0.35 px per yard
		Pins.SetLayer("near", { at(0, -900) }, { edge = false })
		Pins.SetLayer("far", { at(0, -900) }, { edge = true })
		Pins.SetLayer("inside", { at(100, 0) }, { edge = true })
		local f = Pins.GetMinimapFrames("far")[1]
		local _, _, _, x, y = f:GetPoint(1)
		local g = Pins.GetMinimapFrames("inside")[1]
		local _, _, _, ix, iy = g:GetPoint(1)
		emit({ near = #Pins.GetMinimapFrames("near"), x = x, y = y, edge = f.edge:IsShown(), fill = f.fill:IsShown(),
			rot = f.edge:GetRotation(), ix = ix, iy = iy, insideEdge = g.edge:IsShown() })`);
	assert.equal(out.near, 0);
	const limit = 70 - 14 * 0.35;
	assert.ok(Math.abs(out.x - limit) < 1e-6 && Math.abs(out.y) < 1e-6, `clamped to the rim: ${out.x},${out.y}`);
	assert.deepEqual([out.edge, out.fill], [true, false]);
	assert.ok(Math.abs(out.rot + Math.PI / 2) < 1e-6, 'pointer turned east');
	assert.ok(Math.abs(out.ix) < 1e-6 && Math.abs(out.iy - 35) < 1e-6, 'in-range edge pins sit where they are');
	assert.equal(out.insideEdge, false);
});

test('the world map redraws for the map being viewed, converting world, Era-frame and other-map pins', () => {
	const [out] = run(`
		Polestar.RegisterMapFrames({ era = { [9000] = { c = 0, top = 1030, bottom = -970, left = 960, right = -1040 } } })
		local clicked
		Pins.SetLayer("maps.taxi", {
			{ map = 9000, x = 25, y = 75, tooltip = function(tip) tip:SetText("Flight master"); tip:AddLine("known", 1, 1, 1) end,
				onClick = function(button) clicked = button end },
			{ map = 9000, x = 50, y = 50, f = "e" },            -- Era frame: world (30, -40)
			{ c = 0, wx = 0, wy = 0 },                          -- world position
			{ map = 9001, x = 50, y = 50 },                     -- continent 1
		})
		local function snapshot()
			local out = {}
			for _, pin in ipairs(nav.pins()) do out[#out + 1] = { pin.normalizedX, pin.normalizedY } end
			table.sort(out, function(a, b) return a[1] < b[1] end)
			return out
		end
		local r = {}
		nav.showWorldMap(9000)
		r.home = snapshot()
		local pins = nav.pins()
		for _, pin in ipairs(pins) do
			if pin.normalizedX == 0.25 then
				r.tooltip = nav.tooltipOf(pin)
				pin:OnMouseClickAction("LeftButton")
			end
		end
		r.clicked = clicked
		nav.showWorldMap(9001)
		r.other = snapshot()
		WorldMapFrame:Hide()
		Pins.SetLayer("maps.taxi", { { map = 9001, x = 10, y = 10 } })
		nav.showWorldMap(9001)
		r.reopened = snapshot()
		emit(r)`);
	assert.deepEqual(out.home, [[0.25, 0.75], [0.5, 0.5], [0.52, 0.485]]);
	assert.deepEqual(out.tooltip, ['Flight master', 'known']);
	assert.equal(out.clicked, 'LeftButton');
	assert.deepEqual(out.other, [[0.5, 0.5]]);
	assert.deepEqual(out.reopened, [[0.1, 0.1]]);
});

test('a pin\'s area draws a disc of its radius in yards under the world map pins', () => {
	const [out] = run(`
		WorldMapFrame.Child:SetSize(1000, 1000)
		Pins.SetLayer("quests.objectives", {
			{ map = 9000, x = 40, y = 40, area = 60, color = { 1, 0.5, 0.5, 1 } },  -- 60 yd = 3 % of map 9000
			{ map = 9000, x = 60, y = 60 },
		})
		nav.showWorldMap(9000)
		local r = { pins = #nav.pins() }
		local areas = nav.pins("PolestarPinsAreaTemplate")
		r.areas = #areas
		local a = areas[1]
		r.size = { a.width, a.height }
		r.at = { a.normalizedX, a.normalizedY }
		r.level = a.pinFrameLevelType
		r.mouse = a:IsMouseEnabled() and true or false
		local _, _, _, alpha = a.tex:GetVertexColor()
		r.alpha = alpha
		Pins.SetLayer("quests.objectives", { { map = 9000, x = 40, y = 40 } })
		r.cleared = #nav.pins("PolestarPinsAreaTemplate")
		emit(r)`);
	assert.equal(out.pins, 2);
	assert.equal(out.areas, 1);
	assert.deepEqual(out.size.map((v) => Math.round(v)), [60, 60], 'diameter: 2 x 3 % of a 1000 px canvas');
	assert.deepEqual(out.at, [0.4, 0.4]);
	assert.equal(out.level, 'PIN_FRAME_LEVEL_QUEST_BLOB');
	assert.equal(out.mouse, false);
	assert.ok(out.alpha > 0 && out.alpha < 0.5, 'a faint disc');
	assert.equal(out.cleared, 0);
});

test('a layer with minimapAreas draws its areas on the minimap too, cut at the rim; areaOnly pins draw no pin', () => {
	const [out] = run(`
		nav.viewRadius = 200                                             -- 70 px for 200 yd: 0.35 px a yard
		local function areas(layer)
			local r = {}
			for _, t in ipairs(Pins.GetMinimapAreas(layer)) do
				local _, _, _, x, y = t:GetPoint(1)
				r[#r + 1] = { math.floor(x + 0.5), math.floor(y + 0.5), math.floor(t.width + 0.5), t.mask ~= nil }
			end
			table.sort(r, function(a, b) return a[1] > b[1] end)
			return r
		end
		Pins.SetLayer("spawns", {
			at(100, 0, { area = 60, areaOnly = true, color = { 1, 0.5, 0.5, 1 } }),   -- in view
			at(0, 240, { area = 60, areaOnly = true }),                               -- centre past the rim, disc reaching in
			at(0, 300, { area = 60, areaOnly = true }),                               -- out of reach
		}, { minimapAreas = true })
		Pins.SetLayer("quests.objectives", { at(-50, 0, { area = 60 }) })        -- no minimapAreas: the pin only
		stub.advance(0.3)
		local r = { areas = areas("spawns"), pins = frames("spawns"), quests = { frames("quests.objectives"), #Pins.GetMinimapAreas("quests.objectives") } }
		local t = Pins.GetMinimapAreas("spawns")[1]
		local _, _, _, alpha = t:GetVertexColor()
		r.alpha = alpha
		local mask = t.mask
		r.mask = { mask.texture, math.floor(mask.width + 0.5) }
		nav.place(100, 0); stub.advance(0.3)
		r.moved = areas("spawns")
		GetMinimapShape = function() return "SQUARE" end
		nav.place(0, 0); stub.advance(0.3)
		r.square = #areas("spawns")
		r.squareMask = { mask.texture, math.floor(mask.width + 0.5) }
		GetMinimapShape = nil
		nav.showWorldMap(9000)
		r.world = { #nav.pins("PolestarPinsAreaTemplate"), #nav.pins() }
		Pins.ClearLayer("spawns")
		stub.advance(0.3)
		r.cleared = #Pins.GetMinimapAreas("spawns")
		emit(r)`);
	assert.deepEqual(out.areas, [[0, 35, 42, true], [-84, 0, 42, true]], 'discs 2 x 60 yd wide where the player sees them, one reaching in past the rim');
	assert.equal(out.pins, 0, 'areaOnly: no pin frame');
	assert.deepEqual(out.quests, [1, 0], 'a layer without minimapAreas keeps its areas on the world map');
	assert.ok(out.alpha > 0 && out.alpha < 0.5, 'a faint disc');
	assert.deepEqual(out.mask, ['Interface\\AddOns\\Polestar\\Media\\Nav\\pin-fill', 213], "masked to the round minimap: pin-fill's disc over its width");
	assert.deepEqual(out.moved[0], [0, 0, 42, true], 'the disc follows the player');
	assert.equal(out.square, 3, "a square minimap's corners reach further");
	assert.deepEqual(out.squareMask, ['Interface\\Buttons\\WHITE8X8', 140]);
	assert.deepEqual(out.world, [4, 1], 'every area on the world map; only the plain pin as a pin');
	assert.equal(out.cleared, 0);
});

// The corners of each piece a hull is cut from (upper left, upper right,
// lower right, lower left; local units around the rectangle's centre, y up),
// from the rectangle's size and the pieces' vertex offsets; their areas and
// whether every corner lies inside the outline.
const PIECES = `
local function area(pts)
	local a = 0
	for i = 1, #pts, 2 do
		local j = i + 2 > #pts and 1 or i + 2
		a = a + pts[i] * pts[j + 1] - pts[j] * pts[i + 1]
	end
	return math.abs(a) / 2
end
local function inside(outline, x, y)
	local sign = 0
	for i = 1, #outline, 2 do
		local j = i + 2 > #outline and 1 or i + 2
		local c = (outline[j] - outline[i]) * (y - outline[i + 1]) - (outline[j + 1] - outline[i + 1]) * (x - outline[i])
		if math.abs(c) > 1e-6 then
			local s = c > 0 and 1 or -1
			if sign ~= 0 and s ~= sign then return false end
			sign = s
		end
	end
	return true
end
local function pieces(texs, used, w, h, outline)
	local hw, hh = w / 2, h / 2
	local r = { fill = 0, rim = 0, inside = true, alphas = {}, masked = true, shown = true }
	for k = 1, used do
		local t, o = texs[k], texs[k].vertexOffset
		local q = { -hw + o[1], hh + o[2], hw + o[5], hh + o[6], hw + o[7], -hh + o[8], -hw + o[3], -hh + o[4] }
		local _, _, _, a = t:GetVertexColor()
		local key = math.floor(a * 100 + 0.5)
		r.alphas[key] = (r.alphas[key] or 0) + 1
		if a < 0.5 then r.fill = r.fill + area(q) else r.rim = r.rim + area(q) end
		for i = 1, 8, 2 do
			if not inside(outline, q[i], q[i + 1]) then
				local near = false
				for j = 1, #outline, 2 do near = near or (math.abs(outline[j] - q[i]) < 1e-6 and math.abs(outline[j + 1] - q[i + 1]) < 1e-6) end
				if not near then r.inside = false end
			end
		end
		if t.mask == nil then r.masked = false end
		if not t:IsShown() then r.shown = false end
	end
	r.outline = area(outline)
	return r
end
`;

test('a hull is a region cut from pieces that tile it exactly, with a rim kept thin on screen; on the minimap walking only moves it', () => {
	const [out] = run(`${PIECES}
		WorldMapFrame.Child:SetSize(1000, 1000)                          -- map 9000: 0.5 canvas units a yard
		local canvasScale = 1
		function WorldMapFrame.GetCanvasScale() return canvasScale end
		nav.viewRadius = 200                                             -- 0.35 px a yard
		local offsets = 0
		local orig = stub.Methods.SetVertexOffset
		stub.Methods.SetVertexOffset = function(...) offsets = offsets + 1; return orig(...) end
		-- A diamond 200 yd north to south and 300 yd east to west around the origin.
		Pins.SetLayer("spawns", {
			{ c = 0, wx = 0, wy = 0, hull = { 100, 0, 0, 150, -100, 0, 0, -150 }, areaOnly = true, color = { 1, 0.5, 0.5, 0.8 } },
		}, { minimapAreas = true })
		nav.showWorldMap(9000)
		local r = {}
		local hulls = nav.pins("PolestarPinsHullTemplate")
		local pin = hulls[1]
		r.world = { #hulls, #nav.pins(), pin.pinFrameLevelType, pin:IsMouseEnabled() and true or false,
			pin.normalizedX, pin.normalizedY, pin.width, pin.height, pin.used }
		r.worldPieces = pieces(pin.texs, pin.used, pin.width, pin.height, pin.outline)
		canvasScale = 2                                                  -- zoomed in: the rim halves in canvas units
		pin:OnCanvasScaleChanged()
		r.zoomed = pieces(pin.texs, pin.used, pin.width, pin.height, pin.outline)
		stub.advance(0.3)
		local mm = Pins.GetMinimapHulls("spawns")
		local rec = mm[1]
		r.minimap = { #mm, rec.used, rec.texs[1].width, rec.texs[1].height, rec.x, rec.y }
		r.minimapPieces = pieces(rec.texs, rec.used, rec.texs[1].width, rec.texs[1].height, rec.outline)
		offsets = 0
		nav.place(50, 0); stub.advance(0.3)                              -- walk 50 yd north
		r.walked = { offsets, rec.x, rec.y, #Pins.GetMinimapHulls("spawns") }
		nav.viewRadius = 100; stub.advance(0.3)                          -- zoom in: laid out again
		r.zoomedMinimap = { offsets > 0, rec.texs[1].width, rec.texs[1].height }
		r.stats = Pins.AreaStats()
		Pins.ClearLayer("spawns")
		stub.advance(0.3)
		r.cleared = { #nav.pins("PolestarPinsHullTemplate"), #Pins.GetMinimapHulls("spawns"), rec.texs[1]:IsShown() }
		emit(r)`);
	const [count, plain, level, mouse, x, y, w, h, used] = out.world;
	assert.deepEqual([count, plain, level, mouse], [1, 0, 'PIN_FRAME_LEVEL_QUEST_BLOB', false], 'one region under every pin, no pin, no mouse');
	assert.deepEqual([x, y], [0.5, 0.5], 'centred on its centre');
	assert.deepEqual([Math.round(w), Math.round(h)], [150, 100], '300 x 200 yd at 0.5 canvas units a yard');
	assert.equal(used, 5, 'a 4-gon: one fill quad and a rim quad per side');
	const near = (a, b, eps, msg) => assert.ok(Math.abs(a - b) <= eps, `${msg}: ${a} vs ${b}`);
	const wp = out.worldPieces;
	near(wp.outline, 7500, 1e-6, 'the outline is the diamond');
	near(wp.fill + wp.rim, wp.outline, 1e-6, 'fill and rim tile the outline: no gap, no overlap');
	assert.equal(wp.inside, true, 'every piece lies inside the outline');
	assert.deepEqual(wp.alphas, { 16: 1, 56: 4 }, 'fill 0.2, rim 0.7, times the colour alpha 0.8');
	const perimeter = 4 * Math.hypot(75, 50);
	near(wp.rim / perimeter, 1.5, 0.05, 'the rim is 1.5 units wide');
	near(out.zoomed.rim / perimeter, 0.75, 0.03, 'zoomed in twice: 0.75 canvas units, still 1.5 on screen');
	near(out.zoomed.fill + out.zoomed.rim, out.zoomed.outline, 1e-6, 'still tiled exactly');
	assert.deepEqual(out.minimap.map((v) => Math.round(v * 100) / 100), [1, 5, 105, 70, 0, 0], '300 x 200 yd at 0.35 px a yard, around the player');
	const mp = out.minimapPieces;
	near(mp.fill + mp.rim, mp.outline, 1e-6, 'the minimap pieces tile the outline too');
	assert.equal(mp.inside, true);
	assert.equal(mp.masked, true, 'every piece is cut at the rim');
	assert.equal(mp.shown, true);
	assert.deepEqual(out.walked.map((v) => Math.round(v * 100) / 100), [0, 0, -17.5, 1], 'walking moves the anchor only: no vertex offset set');
	assert.deepEqual(out.zoomedMinimap.map((v) => (typeof v === 'number' ? Math.round(v) : v)), [true, 210, 140]);
	assert.deepEqual(out.stats, { world: { hulls: 1, pieces: 5, discs: 0 }, minimap: { hulls: 1, pieces: 5, discs: 0 } });
	assert.deepEqual(out.cleared, [0, 0, false]);
});

test('icon pins may sit on a dark disc, carry a ring, and take their own minimap size', () => {
	const [out] = run(`
		nav.viewRadius = 200
		Pins.SetLayer("quests.objectives", {
			at(20, 20, { icon = "Interface\\\\Icons\\\\kill", size = 20, minimapSize = 12, backdrop = true, ring = { 1, 0.8, 0.3, 1 } }),
			at(-20, -20, { icon = "Interface\\\\Icons\\\\kill", size = 20 }),
		})
		stub.advance(0.3)
		local r = {}
		for _, f in ipairs(Pins.GetMinimapFrames("quests.objectives")) do
			r[#r + 1] = { w = f.width, back = f.back:IsShown(), mark = f.mark:IsShown(), backW = f.back.width }
		end
		table.sort(r, function(a, b) return a.w < b.w end)
		nav.showWorldMap(9000)
		local world = {}
		for _, pin in ipairs(nav.pins()) do world[#world + 1] = { w = pin.width, back = pin.back:IsShown(), mark = pin.mark:IsShown() } end
		table.sort(world, function(a, b) return (a.back and 1 or 0) < (b.back and 1 or 0) end)
		emit({ minimap = r, world = world })`);
	assert.deepEqual(out.minimap.map((f) => [f.w, f.back, f.mark]), [[12, true, true], [20, false, false]], 'minimapSize on the minimap; parts only where asked');
	assert.ok(Math.abs(out.minimap[0].backW - 14.4) < 1e-9, 'the disc is a little wider than the glyph');
	assert.deepEqual(out.world.map((f) => [f.w, f.back, f.mark]), [[20, false, false], [20, true, true]], 'size on the world map');
});

test('minimap pins follow a rotating minimap, priority stacks, tooltips and clicks work', () => {
	const [out] = run(`
		nav.viewRadius = 200
		SetCVar("rotateMinimap", "1")
		nav.facing = math.pi / 2                          -- facing west
		local clicked
		Pins.SetLayer("quests", {
			at(0, 100, { priority = 1, tooltip = "West", onClick = function(b) clicked = b end }),
			at(100, 0, { priority = 9 }),
		})
		local list = Pins.GetMinimapFrames("quests")
		local r = { pins = {} }
		for _, f in ipairs(list) do
			local _, _, _, x, y = f:GetPoint(1)
			r.pins[#r.pins + 1] = { x = math.floor(x + 0.5), y = math.floor(y + 0.5), level = f:GetFrameLevel(), mouse = f:IsMouseEnabled() }
		end
		table.sort(r.pins, function(a, b) return a.y > b.y end)
		local west = list[1].pin.tooltip and list[1] or list[2]
		r.tip = nav.tooltipOf(west)
		stub.RunScript(west, "OnMouseUp", "RightButton")
		r.clicked = clicked
		nav.facing = 0                                   -- turn north: pins follow
		stub.advance(0.25)
		local _, _, _, wx, wy = west:GetPoint(1)
		r.afterTurn = { math.floor(wx + 0.5), math.floor(wy + 0.5) }
		emit(r)`);
	// Facing west on a rotating minimap: west is up, north is right.
	const [w, n] = out.pins;
	assert.deepEqual([w.x, w.y], [0, 35]);
	assert.deepEqual([n.x, n.y], [35, 0]);
	assert.ok(n.level > w.level, 'higher priority draws above');
	assert.deepEqual([w.mouse, n.mouse], [true, false], 'only interactive pins take the mouse');
	assert.deepEqual(out.tip, ['West']);
	assert.equal(out.clicked, 'RightButton');
	assert.deepEqual(out.afterTurn, [-35, 0]);
});

test('world map pins never call the combat-restricted SetPassThroughButtons in combat', () => {
	const [out] = run(`
		local r = {}
		stub.inCombat = true
		Pins.SetLayer("quests", { at(0, 0), at(100, 0) })
		nav.showWorldMap(9000)                           -- opening the map in combat
		Pins.SetLayer("quests", { at(0, 0), at(100, 0), at(-100, 0) })
		r.blockedInCombat = #stub.blocked
		local pending = 0
		for _, pin in ipairs(nav.pins()) do if not pin.passThrough then pending = pending + 1 end end
		r.pendingInCombat = pending
		stub.inCombat = false
		stub.fire("PLAYER_REGEN_ENABLED")
		local set = 0
		for _, pin in ipairs(nav.pins()) do
			if pin.passThrough and pin.passThrough[1] == "RightButton" then set = set + 1 end
		end
		r.setAfter = set
		Pins.SetLayer("quests", { at(0, 0) })            -- reacquiring out of combat: still set, no repeat calls needed
		r.reacquired = nav.pins()[1].passThrough and nav.pins()[1].passThrough[1]
		emit(r)`);
	assert.equal(out.blockedInCombat, 0, 'no restricted call while in combat');
	assert.equal(out.pendingInCombat, 3);
	assert.equal(out.setAfter, 3, 'right-click passthrough applied once combat ends');
	assert.equal(out.reacquired, 'RightButton');
});
