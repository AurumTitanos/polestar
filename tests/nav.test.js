'use strict';
// Navigation (addon/Polestar/Nav): target model, arrow geometry and states,
// minimap projection, world map pins, TomTom/Blizzard bridges, live settings.
// Runs the real Core/Init.lua + Nav/Nav.xml against tests/lua/stub_nav.lua.

const { test } = require('node:test');
const assert = require('node:assert/strict');
const { runAddon } = require('./helpers/lua');

const NAV = { name: 'Polestar', files: ['Core/Init.lua', 'Nav/Nav.xml'] };
const PI = Math.PI;

// Shared Lua locals for every script.
const PRELUDE = `
local N = Polestar.Nav
local A = N.arrow
local Pins = Polestar.Pins
local function targetPin() return Pins.GetMinimapFrames("nav.target")[1] end
local nav = stub.nav
local function target(wx, wy, label)
	local m, x, y = nav.mapPoint(wx, wy)
	N.SetTarget(m, x, y, label or "T")
end
local function wp(wx, wy, label, extra)
	local m, x, y = nav.mapPoint(wx, wy)
	local t = { map = m, x = x, y = y, label = label, stepIndex = 1, goalIndex = 1, kind = "goto", r = 8 }
	for k, v in pairs(extra or {}) do t[k] = v end
	return t
end
local function pinPoint()
	local f = targetPin()
	if not f then return { shown = false } end
	local _, _, _, x, y = f:GetPoint(1)
	return { x = x, y = y, edge = f.edge:IsShown(), edgeRot = f.edge:GetRotation(), shown = f:IsShown() }
end
`;

function run(script, opts = {}) {
	return runAddon({
		stubs: ['stub_nav.lua'],
		addons: [NAV],
		before: opts.before,
		saved: opts.saved,
		login: true,
		script: PRELUDE + script,
	}).emitted;
}

// Smallest signed difference between two angles.
function angleDiff(a, b) {
	const d = (((a - b) % (2 * PI)) + 3 * PI) % (2 * PI) - PI;
	return Math.abs(d);
}

function near(actual, expected, eps = 1e-6, msg = '') {
	assert.ok(Math.abs(actual - expected) <= eps, `${msg} expected ${expected}, got ${actual}`);
}

// Sheet frame for a heading, as the 3D arrow must show it (frame i = i * 3.6 degrees CCW).
const FRAMES = 100;
const frameOf = (a) => ((Math.round((((a % (2 * PI)) + 2 * PI) % (2 * PI)) / ((2 * PI) / FRAMES)) % FRAMES) + FRAMES) % FRAMES;

test('arrow points at the target relative to facing in all four quadrants, in both styles', () => {
	const [out] = run(`
		local cases = {
			{ "N", 100, 0, 0 }, { "W", 0, 100, 0 }, { "S", -100, 0, 0 }, { "E", 0, -100, 0 },
			{ "NE", 100, -100, 0 }, { "NW", 100, 100, 0 }, { "SW", -100, 100, 0 }, { "SE", -100, -100, 0 },
			{ "N facing W", 100, 0, math.pi / 2 }, { "E facing W", 0, -100, math.pi / 2 },
			{ "N facing E", 100, 0, 3 * math.pi / 2 }, { "SW facing S", -100, 100, math.pi },
		}
		local out = {}
		for _, style in ipairs({ "3d", "flat" }) do
			Polestar.Set("nav.arrowStyle", style)
			for _, c in ipairs(cases) do
				nav.facing = c[4]
				target(c[2], c[3])
				stub.advance(1.5)
				local _, _, rel = N.Sample()
				out[#out + 1] = { style = style, name = c[1], angle = A.GetAngle(), frame = A.GetFrame() or false,
					rotation = A.body:GetRotation(), facet = A.facet:GetRotation(), rel = rel,
					sheet = A.sheet:IsShown(), body = A.body:IsShown() }
			end
		end
		emit(out)`);
	const expected = {
		N: 0, W: PI / 2, S: PI, E: -PI / 2,
		NE: -PI / 4, NW: PI / 4, SW: (3 * PI) / 4, SE: (-3 * PI) / 4,
		'N facing W': -PI / 2, 'E facing W': PI, 'N facing E': PI / 2, 'SW facing S': -PI / 4,
	};
	assert.equal(out.length, 2 * Object.keys(expected).length);
	for (const c of out) {
		const want = expected[c.name];
		assert.ok(angleDiff(c.rel, want) < 1e-9, `${c.name}: bearing ${c.rel}`);
		assert.ok(angleDiff(c.angle, want) < 1e-3, `${c.name}: arrow heading ${c.angle}`);
		if (c.style === '3d') {
			const pos = ((((c.angle % (2 * PI)) + 2 * PI) % (2 * PI)) / (2 * PI)) * FRAMES;
			const tie = Math.abs((pos % 1) - 0.5) < 1e-3; // 45 degrees sits exactly between two frames
			const neighbours = [Math.floor(pos) % FRAMES, Math.ceil(pos) % FRAMES];
			const ok = c.frame === frameOf(c.angle) || (tie && neighbours.includes(c.frame));
			assert.ok(ok, `${c.name}: sheet frame ${c.frame} for heading ${c.angle}`);
			assert.deepEqual([c.sheet, c.body], [true, false]);
		} else {
			assert.ok(angleDiff(c.rotation, want) < 1e-3, `${c.name}: flat rotation ${c.rotation}`);
			assert.equal(c.facet, c.rotation, `${c.name}: facet layer turns with the body`);
			assert.equal(c.frame, false);
			assert.deepEqual([c.sheet, c.body], [false, true]);
		}
	}
});

test('sheet frames: rounding, wraparound and texture coordinates match the generated sheet', () => {
	const [out] = run(`
		local d = math.pi / 180
		local angles = { 0, 1.7 * d, 1.9 * d, 90 * d, 180 * d, -90 * d, 357 * d, 359 * d, 2 * math.pi, -0.5 * d, -2 * d, 7 * math.pi }
		local frames, coords = {}, {}
		for i, a in ipairs(angles) do frames[i] = N.ArrowFrame(a) end
		for _, f in ipairs({ 0, 25, 99 }) do coords[#coords + 1] = { N.ArrowFrameCoords(f) } end
		emit({ frames = frames, coords = coords })`);
	assert.deepEqual(out.frames, [0, 0, 1, 25, 50, 75, 99, 0, 0, 0, 99, 50]);
	const { arrow3dLayout: L } = require('../tools/media/nav');
	const cellCoords = (f) => {
		const col = f % L.cols;
		const row = Math.floor(f / L.cols);
		return [(col * L.cell) / L.size, ((col + 1) * L.cell) / L.size, (row * L.cell) / L.size, ((row + 1) * L.cell) / L.size];
	};
	assert.equal(L.frames, FRAMES);
	out.coords.forEach((c, i) => {
		const want = cellCoords([0, 25, 99][i]);
		c.forEach((v, k) => near(v, want[k], 1e-9, `frame ${[0, 25, 99][i]} coord ${k}`));
	});
});

test('turning is damped: the arrow eases toward the new bearing the short way round', () => {
	const [out] = run(`
		target(100, 0)
		stub.advance(1)
		local before = A.GetAngle()
		local frames = { A.GetFrame() }
		nav.facing = math.pi / 2           -- turn to face west: target now to the right
		local early, later
		for i = 1, 44 do
			stub.advance(0.05)
			if i == 2 then early = A.GetAngle() elseif i == 4 then later = A.GetAngle() end
			if A.GetFrame() ~= frames[#frames] then frames[#frames + 1] = A.GetFrame() end
		end
		emit({ before = before, early = early, later = later, settled = A.GetAngle(), frames = frames })`);
	near(out.before, 0, 1e-6, 'before');
	assert.ok(out.early < 0 && out.early > -PI / 2, `early ${out.early} is partway, clockwise`);
	assert.ok(out.later < out.early && out.later > -PI / 2, `later ${out.later} keeps closing in`);
	near(out.settled, -PI / 2, 1e-3, 'settled');
	// The 3D frames wrap 0 -> 99 -> ... -> 75: clockwise, never through the back half.
	assert.equal(out.frames[0], 0);
	assert.equal(out.frames[out.frames.length - 1], 75);
	assert.ok(out.frames.length > 4, `passes through intermediate frames: ${out.frames}`);
	for (const f of out.frames.slice(1)) assert.ok(f >= 75 && f <= 99, `frame ${f} stays on the short side`);
	for (let i = 2; i < out.frames.length; i++) assert.ok(out.frames[i] < out.frames[i - 1], `frames decrease: ${out.frames}`);
});

test('switching nav.arrowStyle live keeps heading, colour and the arrived state', () => {
	const [out] = run(`
		local r = {}
		local function snap()
			return { style = A.GetStyle(), sheet = A.sheet:IsShown(), spec = A.sheetSpec:IsShown(), body = A.body:IsShown(),
				facet = A.facet:IsShown(), frame = A.GetFrame() or false, rotation = A.body:GetRotation(),
				tint = { A.sheet:GetVertexColor() }, bodyTint = { A.body:GetVertexColor() }, mode = A.GetMode() }
		end
		target(0, 100)                      -- west: heading +90 degrees
		stub.advance(1)
		r.solid = snap()
		Polestar.Set("nav.arrowStyle", "flat")
		r.flat = snap()
		Polestar.Set("nav.arrowStyle", "3d")
		r.back = snap()
		nav.place(0, 96)                    -- arrive
		stub.advance(0.2)
		r.arrived3d = snap()
		Polestar.Set("nav.arrowStyle", "flat")
		r.arrivedFlat = snap()
		r.default = Polestar.GetDefault("nav.arrowStyle")
		emit(r)`);
	assert.equal(out.default, '3d');
	assert.deepEqual([out.solid.style, out.solid.sheet, out.solid.spec, out.solid.body, out.solid.frame], ['3d', true, true, false, 25]);
	assert.deepEqual([out.flat.style, out.flat.sheet, out.flat.spec, out.flat.body, out.flat.facet, out.flat.frame], ['flat', false, false, true, true, false]);
	assert.ok(angleDiff(out.flat.rotation, PI / 2) < 1e-3, 'flat dart takes over the heading');
	assert.deepEqual(out.flat.bodyTint, out.solid.tint, 'colour carries over');
	assert.deepEqual([out.back.sheet, out.back.body, out.back.frame], [true, false, 25]);
	for (const s of [out.arrived3d, out.arrivedFlat]) {
		assert.equal(s.mode, 'arrived');
		assert.deepEqual([s.sheet, s.spec, s.body, s.facet], [false, false, false, false]);
	}
});

test('distance is in yards, and the colour shifts from accent to success as you close in', () => {
	const [out] = run(`
		target(300, 400)                   -- 500 yd
		stub.advance(0.2)
		local far = { A.body:GetVertexColor() }
		local farText = A.distText:GetText()
		nav.place(282, 376)                -- (18, 24) short: 30 yd
		stub.advance(0.2)
		emit({ farText = farText, far = far, near = { A.body:GetVertexColor() }, nearText = A.distText:GetText(), dist = N.GetDistance() })`);
	assert.equal(out.farText, '500 yd');
	assert.equal(out.nearText, '30 yd');
	near(out.dist, 30, 1e-9);
	// Fallback palette (no Theme loaded): accent 0.902,0.729,0.4 (Dusk gold); success 0.42,0.85,0.6.
	near(out.far[0], 0.902, 1e-6);
	near(out.far[2], 0.4, 1e-6);
	assert.ok(out.near[0] < out.far[0], `red channel moved toward success (${out.near[0]})`);
	assert.ok(out.near[2] > out.far[2], `blue channel moved toward success (${out.near[2]})`);
});

test('Era-frame targets convert through the registered Era bounds', () => {
	const [out] = run(`
		-- Era frame of map 9000 is offset from the live one: era (50, 50) is world (30, -40).
		Polestar.RegisterMapFrames({ era = { [9000] = { c = 0, top = 1030, bottom = -970, left = 960, right = -1040 } } })
		N.SetTarget(9000, 50, 50, "Era point", "e")
		local era = N.GetDistance()
		local _, _, rel = N.Sample()
		N.SetTarget(9000, 50, 50, "Live point")
		emit({ era = era, rel = rel, live = N.GetDistance(), liveCoords = { N.LiveCoords({ map = 9000, x = 50, y = 50, f = "e" }) } })`);
	near(out.era, 50, 1e-9, 'era distance');
	near(out.rel, Math.atan2(-40, 30), 1e-9, 'era bearing');
	near(out.live, 0, 1e-9, 'live distance');
	assert.deepEqual(out.liveCoords, [9000, 52, 48.5]);
});

test('reaching the target switches to the arrived state, with hysteresis and one chime', () => {
	const [out] = run(`
		local seen = {}
		target(20, 0)
		stub.advance(0.2)
		seen[#seen + 1] = { A.GetMode(), A.distText:GetText(), #stub.sounds }
		nav.place(15, 0)                   -- 5 yd: inside the 8 yd radius
		stub.advance(0.2)
		seen[#seen + 1] = { A.GetMode(), A.distText:GetText(), #stub.sounds, A.ring:IsShown(), A.body:IsShown() }
		nav.place(10, 0)                   -- 10 yd: still arrived (hysteresis)
		stub.advance(0.2)
		seen[#seen + 1] = { A.GetMode(), #stub.sounds }
		nav.place(0, 0)                    -- 20 yd: travelling again
		stub.advance(0.2)
		seen[#seen + 1] = { A.GetMode(), A.distText:GetText(), A.ring:IsShown() }
		Polestar.Set("nav.arrivalSound", false)
		nav.place(18, 0)
		stub.advance(0.2)
		seen[#seen + 1] = { A.GetMode(), #stub.sounds }
		emit(seen)`);
	assert.deepEqual(out, [
		['travel', '20 yd', 0],
		['arrived', 'Arrived', 1, true, false],
		['arrived', 1],
		['travel', '20 yd', false],
		['arrived', 1],
	]);
});

// The player's arrow colours, with Theme loaded: the arrow wears its own
// colour far away and the near colour on arrival (both styles, the ring),
// the target's pin follows the arrow live, and a colour too dark to read as
// the arrow's text is lifted for the text alone.
test('chosen arrow colours: far and near, both styles and the arrival ring; the target pin follows; dark picks stay legible', () => {
	const { emitted } = runAddon({
		stubs: ['stub_nav.lua'],
		addons: [{ name: 'Polestar', files: ['Core/Init.lua', 'Theme/Theme.xml', 'Nav/Nav.xml'] }],
		login: true,
		script: `${PRELUDE}
		local T = Polestar.Theme
		local function rgb(t) local r, g, b = t:GetVertexColor() return { r, g, b } end
		Polestar.Set("nav.arrowColor", { 0.2, 0.45, 1 })
		Polestar.Set("nav.arrowNearColor", { 1, 0.4, 0.8 })
		target(300, 400)
		stub.advance(0.2)
		local out = { far3d = rgb(A.sheet), pinFar = rgb(targetPin().edge) }
		Polestar.Set("nav.arrowStyle", "flat")
		out.farFlat = rgb(A.body)
		nav.place(299, 399)
		stub.advance(0.2)
		out.mode, out.ring = A.GetMode(), rgb(A.ring)
		local r, g, b = A.distText:GetTextColor()
		out.arrivedText, out.nearText = { r, g, b }, { T.Color("arrowNearText") }
		out.arrivedContrast = T.Contrast(out.arrivedText, T.LightestGround())
		Polestar.Set("nav.arrowColor", { 0.9, 0.3, 0.1 })
		stub.advance(0.1)
		out.pinLive = rgb(targetPin().edge)
		-- A navy pick: the arrow keeps it, the text that wears it is lifted.
		Polestar.Set("nav.arrowNearColor", { 0.05, 0.05, 0.2 })
		local dark = { T.Color("arrowNear") }
		local text = { T.Color("arrowNearText") }
		out.darkKept = { dark[1], dark[2], dark[3] }
		out.darkContrast = T.Contrast(text, T.LightestGround())
		Polestar.Set("nav.arrowNearColor", { 0.95, 0.95, 0.85 })
		local light = { T.Color("arrowNearText") }
		out.lightText = { light[1], light[2], light[3] }
		Polestar.Set("nav.arrowColor", nil)
		Polestar.Set("nav.arrowNearColor", nil)
		out.resetFar, out.resetNear, out.accent, out.success = { T.Color("arrow") }, { T.Color("arrowNear") }, { T.Accent() }, { T.Color("success") }
		emit(out)`,
	});
	const [out] = emitted;
	const r3 = (c) => c.slice(0, 3).map((v) => Math.round(v * 1000) / 1000);
	assert.deepEqual(r3(out.far3d), [0.2, 0.45, 1], 'the 3D arrow wears its own colour far away');
	assert.deepEqual(r3(out.farFlat), [0.2, 0.45, 1], 'so does the flat arrow');
	assert.deepEqual(r3(out.pinFar), [0.2, 0.45, 1], 'the target pin follows the arrow');
	assert.equal(out.mode, 'arrived');
	assert.deepEqual(r3(out.ring), [1, 0.4, 0.8], 'the arrival ring wears the near colour');
	assert.deepEqual(r3(out.arrivedText), r3(out.nearText), '"Arrived" wears the near colour\'s legible form');
	assert.ok(out.arrivedContrast >= 4.5 - 1e-6, `"Arrived" reads at ${out.arrivedContrast.toFixed(2)}:1`);
	assert.deepEqual(r3(out.pinLive), [0.9, 0.3, 0.1], 'the pin repaints live');
	assert.deepEqual(r3(out.darkKept), [0.05, 0.05, 0.2], 'the arrow keeps a dark pick');
	assert.ok(out.darkContrast >= 4.5, `its text is lifted to ${out.darkContrast.toFixed(2)}:1`);
	assert.deepEqual(r3(out.lightText), [0.95, 0.95, 0.85], 'a light pick is left alone');
	assert.deepEqual(r3(out.resetFar), r3(out.accent), 'reset: the accent again');
	assert.deepEqual(r3(out.resetNear), r3(out.success), 'reset: success again');
});

test('an area target is arrived anywhere inside it, shows the distance to its edge outside, and draws its area under the target pin', () => {
	const [out] = run(`
		WorldMapFrame.Child:SetSize(1000, 1000)
		local seen = {}
		local function snap()
			seen[#seen + 1] = { A.GetMode(), A.distText:GetText(), A.labelText:GetText(), math.floor(N.GetDistance() + 0.5) }
		end
		nav.setWaypoint(wp(200, 0, "Kill Bristlebacks", { kind = "kill", area = 60 }))
		stub.advance(0.2); snap()                     -- 200 yd from the centre: 140 to the edge
		nav.place(150, 0); stub.advance(0.2); snap()  -- 50 from the centre: inside
		nav.place(260, 0); stub.advance(0.2); snap()  -- 60 on the far side: on the edge
		nav.place(125, 0); stub.advance(0.2); snap()  -- 75: 15 past the edge
		nav.showWorldMap(9000)
		local areas = nav.pins("PolestarPinsAreaTemplate")
		local r = { seen = seen, areas = #areas }
		r.size = math.floor(areas[1].width + 0.5)
		r.at = { areas[1].normalizedX, areas[1].normalizedY }
		for _, pin in ipairs(nav.pins()) do
			if pin.data.layer.name == "nav.target" then r.pin = { pin.normalizedX, pin.normalizedY } end
		end
		nav.setWaypoint(wp(100, 0, "A point"))
		r.pointAreas = #nav.pins("PolestarPinsAreaTemplate")
		emit(r)`);
	assert.deepEqual(out.seen, [
		['travel', '140 yd', 'Kill Bristlebacks', 140],
		['arrived', 'Arrived', 'Kill Bristlebacks', 0],
		['arrived', 'Arrived', 'Kill Bristlebacks', 0],
		['travel', '15 yd', 'Kill Bristlebacks', 15],
	]);
	assert.equal(out.areas, 1);
	assert.equal(out.size, 60, 'diameter: 2 x 60 yd = 6 % of a 1000 px canvas');
	assert.deepEqual(out.at, out.pin, 'the disc sits under the target pin');
	assert.equal(out.pointAreas, 0, 'a point target draws no disc');
});

// An area objective's waypoint with three spots at world (200, 0), (0, 300) and
// (-200, 0), the first one current; the stub Engine's CycleSpot records calls
// and moves the waypoint as the real one does.
const SEARCH = `
local spotsAt = { { 200, 0 }, { 0, 300 }, { -200, 0 } }
local spots = {}
for i, p in ipairs(spotsAt) do
	local _, x, y = nav.mapPoint(p[1], p[2])
	spots[i] = { x = x, y = y, r = 60, n = 2 }
end
local cycled = {}
local function searchWp(i)
	return wp(spotsAt[i][1], spotsAt[i][2], "Collect Raptor Head", { kind = "collect", area = 60, search = true, spots = spots, spot = i })
end
function nav.Engine.CycleSpot(step, goal, index)
	cycled[#cycled + 1] = { step, goal, index or 0 }
	local i = index or (nav.engine.waypoint.spot % #spots + 1)
	nav.setWaypoint(searchWp(i))
	return i
end
`;

test('an area objective never says arrived: inside a spot the arrow says to search here and how to move on', () => {
	const [out] = run(`${SEARCH}
		local seen = {}
		local function snap()
			seen[#seen + 1] = { A.GetMode(), A.distText:GetText(), A.labelText:GetText(), A.etaText:IsShown() and A.etaText:GetText() or false, A.ring:IsShown() }
		end
		nav.setWaypoint(searchWp(1))
		stub.advance(0.2); snap()                      -- 200 yd out: travelling
		nav.place(170, 0); stub.advance(0.2); snap()   -- inside the spot
		emit(seen)`);
	assert.deepEqual(out, [
		['travel', '140 yd', 'Collect Raptor Head', false, false],
		['search', 'Search here', 'Collect Raptor Head', 'Click the arrow for the next spot', true],
	]);
});

test("clicking an area objective's arrow moves to the next spot; a drag only moves the arrow", () => {
	const [out] = run(`${SEARCH}
		nav.setWaypoint(searchWp(1))
		stub.advance(0.2)
		local f = A.frame
		local function click()
			stub.RunScript(f, "OnMouseDown", "LeftButton")
			stub.RunScript(f, "OnMouseUp", "LeftButton")
		end
		local r = {}
		click()
		r.afterClick = { #cycled, N.GetTarget().spot }
		stub.RunScript(f, "OnMouseDown", "LeftButton")
		stub.RunScript(f, "OnDragStart")
		stub.RunScript(f, "OnDragStop")
		stub.RunScript(f, "OnMouseUp", "LeftButton")
		r.afterDrag = { #cycled, N.GetTarget().spot }
		target(50, 50)                                  -- a plain point: clicks do nothing
		click()
		r.plain = #cycled
		emit(r)`);
	assert.deepEqual(out, { afterClick: [1, 2], afterDrag: [1, 2], plain: 1 });
});

test('the world map marks every other spot of an area objective; clicking one searches there next', () => {
	const [out] = run(`${SEARCH}
		nav.setWaypoint(searchWp(1))
		nav.showWorldMap(9000)
		local r = { marks = {} }
		local marks = {}
		for _, pin in ipairs(nav.pins()) do
			if pin.data.layer.name == "nav.spots" then
				marks[#marks + 1] = pin
				r.marks[#r.marks + 1] = { pin.normalizedX, pin.normalizedY, nav.tooltipOf(pin)[2] }
			end
		end
		marks[2]:OnMouseClickAction("LeftButton")
		r.cycled = cycled[1]
		r.spot = N.GetTarget().spot
		local after = 0
		for _, pin in ipairs(nav.pins()) do if pin.data.layer.name == "nav.spots" then after = after + 1 end end
		r.after = after
		Polestar.Set("nav.worldPins", false)
		r.off = #nav.pins()
		emit(r)`);
	assert.deepEqual(out.marks, [
		[0.35, 0.5, 'Spot 2 of 3'],
		[0.5, 0.6, 'Spot 3 of 3'],
	]);
	assert.deepEqual(out.cycled, [1, 1, 3]);
	assert.equal(out.spot, 3);
	assert.equal(out.after, 2, 'marks rebuilt around the new spot');
	assert.equal(out.off, 0);
});

test('hidden on a taxi, in an instance and without a target; zone name on another continent', () => {
	const [out] = run(`
		local seen = {}
		local function snap(tag) seen[#seen + 1] = { tag, A.frame:IsShown(), A.GetMode() or "hidden", A.distText:GetText() } end
		target(100, 0)
		stub.advance(0.1); snap("start")
		nav.taxi = true
		stub.advance(0.1); snap("taxi")
		nav.taxi = false
		stub.advance(1.1); snap("landed")
		nav.instance = true
		Polestar.Nav.Refresh(); snap("instance")
		nav.instance = false
		stub.advance(1.1); snap("left instance")
		nav.place(0, 0, 1)                 -- other continent
		stub.advance(0.1); snap("far")
		seen[#seen + 1] = { "far dial", A.dial:IsShown(), A.etaText:IsShown() }
		nav.place(0, 0, 0)
		stub.advance(0.1); snap("back")
		N.ClearTarget()
		snap("cleared")
		emit(seen)`);
	assert.deepEqual(out, [
		['start', true, 'travel', '100 yd'],
		['taxi', false, 'hidden', '100 yd'],
		['landed', true, 'travel', '100 yd'],
		['instance', false, 'hidden', '100 yd'],
		['left instance', true, 'travel', '100 yd'],
		['far', true, 'far', 'Testshire'],
		['far dial', false, true],
		['back', true, 'travel', '100 yd'],
		['cleared', false, 'hidden', '100 yd'],
	]);
});

test('ReleaseTarget drops only the override and guides to the engine waypoint again', () => {
	const [out] = run(`
		local seen = {}
		local function snap() local t = N.GetTarget(); seen[#seen + 1] = t and t.label or "nil" end
		nav.setWaypoint(wp(100, 0, "Engine A"))
		N.ReleaseTarget(); snap()                     -- no override: nothing changes
		local m, x, y = nav.mapPoint(0, 100)
		N.SetTarget(m, x, y, "Corpse"); snap()
		N.ReleaseTarget(); snap()
		emit({ seen = seen, override = N.IsOverride() })`);
	assert.deepEqual(out.seen, ['Engine A', 'Corpse', 'Engine A']);
	assert.equal(out.override, false);
});

test('SetTarget overrides the engine waypoint until the step changes', () => {
	const [out] = run(`
		local announced = {}
		Polestar.On("WAYPOINT_CHANGED", function(w) announced[#announced + 1] = w and w.label or "nil" end)
		local seen = {}
		local function snap() local t = N.GetTarget(); seen[#seen + 1] = t and t.label or "nil" end
		nav.setWaypoint(wp(100, 0, "Engine A")); snap()
		local m, x, y = nav.mapPoint(0, 100)
		N.SetTarget(m, x, y, "Mine"); snap()
		nav.setWaypoint(wp(50, 0, "Engine A2")); snap()     -- same step, engine moved on
		nav.changeStep(2, wp(0, -50, "Engine B", { stepIndex = 2 })); snap()
		N.ClearTarget(); snap()                             -- dismiss the engine waypoint
		nav.setWaypoint(wp(0, -50, "Engine B", { stepIndex = 2 })); snap()   -- same point: stays dismissed
		nav.setWaypoint(wp(0, -80, "Engine C", { stepIndex = 2, goalIndex = 2 })); snap()
		emit({ seen = seen, announced = announced, override = N.IsOverride() })`);
	assert.deepEqual(out.seen, ['Engine A', 'Mine', 'Mine', 'Engine B', 'nil', 'nil', 'Engine C']);
	// Engine announcements, plus Nav's own when it sets/clears an override.
	assert.deepEqual(out.announced, ['Engine A', 'Mine', 'Engine A2', 'Engine B', 'nil', 'Engine B', 'Engine C']);
	assert.equal(out.override, false);
});

test('minimap projection honours view radius, rotation and clamps to the rim', () => {
	const [out] = run(`
		local r = {}
		nav.viewRadius = 200               -- 140 px minimap: 0.35 px per yard
		SetCVar("rotateMinimap", "0")
		target(100, 0); stub.advance(0.1); r.north = pinPoint()
		target(0, 100); stub.advance(0.1); r.west = pinPoint()
		nav.facing = math.pi / 2           -- facing west; must not matter on a fixed minimap
		target(-60, -80); stub.advance(0.1); r.southeast = pinPoint()
		SetCVar("rotateMinimap", "1")
		target(0, 100); stub.advance(0.1); r.rotWest = pinPoint()
		target(100, 0); stub.advance(0.1); r.rotNorth = pinPoint()
		SetCVar("rotateMinimap", "0")
		nav.facing = 0
		target(0, -900); stub.advance(0.1); r.farEast = pinPoint()
		GetMinimapShape = function() return "SQUARE" end
		target(900, -900); stub.advance(0.1); r.squareCorner = pinPoint()
		GetMinimapShape = nil
		nav.viewRadius = nil               -- no C_Minimap radius: zoom tables
		stub.minimapZoom = 5
		target(50, 0); stub.advance(0.1); r.zoom5 = pinPoint()
		nav.indoors = true
		stub.minimapZoom = 0
		stub.advance(0.25); r.indoor0 = pinPoint()
		emit(r)`);
	const s = 0.35;
	near(out.north.x, 0); near(out.north.y, 100 * s);
	near(out.west.x, -100 * s); near(out.west.y, 0);
	near(out.southeast.x, 80 * s); near(out.southeast.y, -60 * s);
	assert.equal(out.north.edge, false);
	// Rotating minimap facing west: west is up, north is to the right.
	near(out.rotWest.x, 0); near(out.rotWest.y, 100 * s);
	near(out.rotNorth.x, 100 * s); near(out.rotNorth.y, 0);
	// Out of range: pinned to the rim, pointer turned outward (east = -90 degrees).
	const limit = 70 - 14 * 1.4 * 0.35;
	near(out.farEast.x, limit); near(out.farEast.y, 0);
	assert.equal(out.farEast.edge, true);
	near(out.farEast.edgeRot, -PI / 2);
	near(out.squareCorner.x, limit); near(out.squareCorner.y, limit);
	// Zoom level 5 outdoors spans 133.3 yd; indoors zoom 0 spans 300 yd.
	near(out.zoom5.y, 50 * (70 / (400 / 6)), 1e-6);
	near(out.indoor0.y, 50 * (70 / 150), 1e-6);
	assert.equal(out.zoom5.edge, false);
});

test('TomTom mirrors the target: one waypoint, replaced on change, removed when cleared or disabled', () => {
	const [out] = run(`
		nav.withTomTom()
		Polestar.RegisterMapFrames({ era = { [9000] = { c = 0, top = 1030, bottom = -970, left = 960, right = -1040 } } })
		target(100, 0, "First")
		target(0, 100, "Second")
		N.SetTarget(9000, 50, 50, "Era", "e")
		N.ClearTarget()
		target(-100, 0, "Third")
		Polestar.Set("nav.useTomTomArrow", true)
		local arrowWithTomTom = A.frame:IsShown()
		Polestar.Set("nav.tomtom", false)
		emit({ calls = TomTom.calls, arrowWithTomTom = arrowWithTomTom, arrowAfter = A.frame:IsShown() })`);
	const calls = out.calls.map((c) => (c.op === 'add' ? `add#${c.id} ${c.title} ${c.x},${c.y} crazy=${c.crazy}` : `remove#${c.id}`));
	assert.deepEqual(calls, [
		'add#1 First 0.5,0.45 crazy=false',
		'remove#1',
		'add#2 Second 0.45,0.5 crazy=false',
		'remove#2',
		'add#3 Era 0.52,0.485 crazy=false',
		'remove#3',
		'add#4 Third 0.5,0.55 crazy=false',
		'remove#4',
		'add#5 Third 0.5,0.55 crazy=true',
		'remove#5',
	]);
	// Polestar draws its own pins, so TomTom's are off.
	assert.equal(out.calls[0].minimap, false);
	assert.equal(out.calls[0].world, false);
	assert.equal(out.arrowWithTomTom, false, 'TomTom arrow replaces ours');
	assert.equal(out.arrowAfter, true, 'ours returns when the bridge is off');
});

test('settings apply live: scale, alpha, visibility, pins, position and Blizzard waypoint; the arrow is always movable', () => {
	const [out] = run(`
		local r = {}
		target(100, 0)
		stub.advance(0.1)
		Polestar.Set("nav.arrowScale", 1.5)
		Polestar.Set("nav.arrowAlpha", 0.6)
		-- A lock saved by an older build is ignored: the arrow takes the mouse and drags.
		PolestarDB.settings.nav.arrowLocked = true
		Polestar.Set("nav.arrowScale", 1.5)
		r.scale, r.alpha, r.mouse = A.frame:GetScale(), A.frame:GetAlpha(), A.frame:IsMouseEnabled()
		stub.RunScript(A.frame, "OnDragStart")
		r.drags = A.frame:IsMovable() and A.frame.moving == true
		A.frame:StopMovingOrSizing()
		Polestar.Set("nav.arrow", false)
		r.hidden = not A.frame:IsShown()
		Polestar.Set("nav.arrow", true)
		r.back = A.frame:IsShown()
		Polestar.Set("nav.minimapPins", false)
		r.pinOff = targetPin() == nil
		Polestar.Set("nav.minimapPins", true)
		r.pinOn = targetPin() ~= nil and targetPin():IsShown()

		-- Dragging saves the position; it is re-applied from settings.
		A.frame:ClearAllPoints()
		A.frame:SetPoint("CENTER", UIParent, "CENTER", 120, -40)
		stub.RunScript(A.frame, "OnDragStop")
		r.saved = PolestarDB.settings.nav.arrowPos
		A.frame:ClearAllPoints()
		Polestar.Set("nav.arrowScale", 1)
		local p, _, rp, x, y = A.frame:GetPoint(1)
		r.reapplied = { p, rp, x, y }
		N.ResetArrowPosition()
		p, _, rp, x, y = A.frame:GetPoint(1)
		r.reset = { p, rp, x, y }

		Polestar.Set("nav.blizzardWaypoint", true)
		target(0, 100, "Blizz")
		Polestar.Set("nav.blizzardWaypoint", false)
		r.userWaypoints = nav.userWaypoints
		emit(r)`);
	assert.equal(out.scale, 1.5);
	assert.equal(out.alpha, 0.6);
	assert.equal(out.mouse, true, 'the arrow always takes the mouse');
	assert.equal(out.drags, true, 'a drag moves it, whatever an old lock says');
	assert.equal(out.hidden, true);
	assert.equal(out.back, true);
	assert.equal(out.pinOff, true);
	assert.equal(out.pinOn, true);
	assert.deepEqual(out.saved, { point: 'CENTER', relPoint: 'CENTER', x: 120, y: -40 });
	assert.deepEqual(out.reapplied, ['CENTER', 'CENTER', 120, -40]);
	assert.deepEqual(out.reset, ['TOP', 'TOP', 0, -140]);
	assert.deepEqual(out.userWaypoints, [
		['set', 9000, 0.5, 0.45],
		['track', true],
		['set', 9000, 0.45, 0.5],
		['track', true],
		['clear'],
	]);
});

test('ETA appears while closing in at running speed', () => {
	const [out] = run(`
		target(300, 0)
		stub.advance(0.2)
		local before = A.etaText:IsShown()
		for _ = 1, 40 do                   -- 7 yd/s for 2 s
			nav.place(nav.player.wx + 0.35, 0)
			stub.advance(0.05)
		end
		local shown, text = A.etaText:IsShown(), A.etaText:GetText()
		local _, size = A.etaText:GetFont()
		local color = { A.etaText:GetTextColor() }
		Polestar.Set("nav.arrowEta", false)
		emit({ before = before, shown = shown, text = text, off = not A.etaText:IsShown(), size = size, color = color,
			mover = { N.Wash("mover") } })`);
	assert.equal(out.before, false);
	assert.equal(out.shown, true);
	assert.equal(out.off, true, 'nav.arrowEta off hides it immediately');
	assert.equal(out.size, 12, 'the ETA line is 12px');
	// Fallback palette (no Theme loaded): text 0.969,0.973,0.992 (Dusk), here at 80%.
	assert.deepEqual(out.color, [0.969, 0.973, 0.992, 0.8], 'the ETA reads in text at 80%');
	assert.deepEqual(out.mover, [1, 1, 1, 0.06], 'the movable hint is the ink "mover" wash');
	// 286 yd left at ~7 yd/s: about 41 s.
	const [m, s] = out.text.split(':').map(Number);
	const secs = m * 60 + s;
	assert.ok(secs >= 36 && secs <= 46, `ETA ${out.text}`);
});

test('world map pins: target and open goals on the viewed map, with tooltip and click-to-target', () => {
	const [out] = run(`
		local m, x, y = nav.mapPoint(100, 0)
		nav.engine.views[1] = { index = 1, goals = {
			{ index = 1, status = "active", text = "Target goal", map = m, x = x, y = y },
			{ index = 2, status = "pending", text = "Other goal", map = 9000, x = 60, y = 60 },
			{ index = 3, status = "done", text = "Done goal", map = 9000, x = 70, y = 70 },
			{ index = 4, status = "active", text = "Elsewhere", map = 9001, x = 50, y = 50 },
		} }
		nav.setWaypoint(wp(100, 0, "Target goal"))
		nav.showWorldMap(9000)
		local pins = nav.pins()
		local r = { count = #pins, pins = {} }
		for _, pin in ipairs(pins) do
			r.pins[#r.pins + 1] = { layer = pin.data.layer.name, label = nav.tooltipOf(pin)[1], x = pin.normalizedX, y = pin.normalizedY,
				size = math.floor(pin.width * 10 + 0.5) / 10, shown = pin:IsShown() }
		end
		r.tooltip = nav.tooltipOf(pins[1])
		pins[2]:OnMouseClickAction("LeftButton")
		r.retarget = N.GetTarget().label
		r.after = #nav.pins()
		Polestar.Set("nav.worldPins", false)
		r.off = #nav.pins()
		nav.showWorldMap(9001)
		Polestar.Set("nav.worldPins", true)
		r.otherMap = #nav.pins()
		emit(r)`);
	assert.equal(out.count, 2);
	assert.deepEqual(out.pins[0], { layer: 'nav.target', label: 'Target goal', x: 0.5, y: 0.45, size: 22.4, shown: true });
	assert.deepEqual(out.pins[1], { layer: 'nav.goals', label: 'Other goal', x: 0.6, y: 0.6, size: 16, shown: true });
	assert.deepEqual(out.tooltip, ['Target goal', '100 yd']);
	assert.equal(out.retarget, 'Other goal');
	assert.equal(out.after, 2, 'pins rebuilt around the new target');
	assert.equal(out.off, 0);
	assert.equal(out.otherMap, 1, 'only the goal on the viewed map');
});

test('a step change waits for the Engine waypoint: no stale re-apply, no second chime, no TomTom churn', () => {
	const [out] = run(`
		nav.withTomTom()
		local announced = {}
		Polestar.On("WAYPOINT_CHANGED", function(w) announced[#announced + 1] = w and w.label or "nil" end)
		-- The real Engine order: STEP_CHANGED while the old waypoint is still stored,
		-- then the new waypoint and WAYPOINT_CHANGED.
		local function engineStep(i, w)
			nav.engine.step = i
			Polestar.Fire("STEP_CHANGED", i)
			nav.engine.waypoint = w
			Polestar.Fire("WAYPOINT_CHANGED", w)
		end
		nav.setWaypoint(wp(20, 0, "Goto A"))
		nav.place(15, 0)                                 -- arrive at A
		stub.advance(0.2)
		local chimes = #stub.sounds
		local calls = #TomTom.calls
		engineStep(2, wp(300, 0, "Next B", { stepIndex = 2 }))
		stub.advance(0.2)
		local r = { chimesAfter = #stub.sounds - chimes, tomtom = {}, target = N.GetTarget().label }
		for i = calls + 1, #TomTom.calls do
			local c = TomTom.calls[i]
			r.tomtom[#r.tomtom + 1] = c.op .. (c.title and (" " .. c.title) or "")
		end
		-- With an override held, the step change drops it once the new waypoint is known.
		local m, x, y = nav.mapPoint(0, 300)
		N.SetTarget(m, x, y, "Mine")
		engineStep(3, wp(-300, 0, "Next C", { stepIndex = 3 }))
		stub.advance(0.1)
		r.afterOverride = N.GetTarget().label
		-- Same waypoint, no WAYPOINT_CHANGED: the override still goes, after the dispatch.
		N.SetTarget(m, x, y, "Mine again")
		nav.engine.step = 4
		Polestar.Fire("STEP_CHANGED", 4)
		r.duringDispatch = N.GetTarget().label
		stub.advance(0.1)
		r.settled = N.GetTarget().label
		r.announced = announced
		emit(r)`);
	assert.equal(out.chimesAfter, 0, 'arriving once chimes once');
	assert.deepEqual(out.tomtom, ['remove', 'add Next B'], 'one swap straight to the new point');
	assert.equal(out.target, 'Next B');
	assert.equal(out.afterOverride, 'Next C');
	assert.equal(out.duringDispatch, 'Mine again');
	assert.equal(out.settled, 'Next C');
	assert.deepEqual(out.announced, ['Goto A', 'Next B', 'Mine', 'Next C', 'Mine again', 'Next C']);
});

test('the ETA closing speed ignores out-of-band refreshes', () => {
	const [out] = run(`
		target(600, 0)
		stub.advance(0.2)
		local etas = {}
		for i = 1, 100 do                                -- 7 yd/s for 5 s, refreshing every 0.5 s
			nav.place(nav.player.wx + 0.35, 0)
			stub.advance(0.05)
			if i % 10 == 5 then A:Refresh() end
			if i > 60 and i % 10 == 0 then etas[#etas + 1] = A.etaText:GetText() end
		end
		emit({ etas = etas, dist = N.GetDistance() })`);
	const secs = out.etas.map((t) => {
		const [m, s] = t.split(':').map(Number);
		return m * 60 + s;
	});
	const expected = out.dist / 7;
	for (const s of secs) assert.ok(Math.abs(s - expected) <= 4, `ETA ${s} s vs ${expected.toFixed(0)} s (${out.etas})`);
});
