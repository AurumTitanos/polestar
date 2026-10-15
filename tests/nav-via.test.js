'use strict';
// Arrow waypoints from the navigation grid ("via points", a compiled goal's
// `via` and `viaFrom`): the Engine's waypoint carries them, Nav keeps them for
// its own target only, and the travel planner (addon/Polestar/Nav/Travel.lua)
// leads every walk into the target through them, joining near where the walk
// comes from. A hand-made crossings chain into the target wins. Runs the real
// Core/Init.lua + Nav/Nav.xml against tests/lua/stub_nav.lua (map 9000
// "Testshire", one map percent = 20 yd), and the real Core for the Engine.

const { test } = require('node:test');
const assert = require('node:assert/strict');
const { runAddon } = require('./helpers/lua');
const { TEST_PACK, TEST_SOURCE } = require('./helpers/packs');

const NAV = { name: 'Polestar', files: ['Core/Init.lua', 'Nav/Nav.xml'] };

// The leg starts at (0, 600) and goes round a ridge: V1 (300, 300) "Follow
// the path", V2 (300, 0) without a label, V3 (300, -300) "Enter the cave"
// (inner: past the cave's mouth), then the target "Kobolds" at (0, -600).
const PRELUDE = `
local N = Polestar.Nav
local A = N.arrow
local nav = stub.nav
local function pt(wx, wy, extra)
	local m, x, y = nav.mapPoint(wx, wy)
	local t = { map = m, x = x, y = y }
	for k, v in pairs(extra or {}) do t[k] = v end
	return t
end
local VIA = {
	pt(300, 300, { r = 12, label = "Follow the path" }),
	pt(300, 0, { r = 12 }),
	pt(300, -300, { r = 8, label = "Enter the cave", inner = true }),
}
local function goal(via, at, label)
	local t = pt(at and at[1] or 0, at and at[2] or -600, { label = label or "Kobolds", stepIndex = 1, goalIndex = 1, kind = "goto", r = 8 })
	t.via, t.viaFrom = via, via and pt(0, 600) or nil
	return t
end
local function route()
	local legs, ci = N.GetRoute()
	local out = {}
	for i = ci or 1, legs and #legs or 0 do
		local l = legs[i]
		out[#out + 1] = string.format("%s|%s|%d,%d", l.kind, l.label, math.floor(l.to.wx + 0.5), math.floor(l.to.wy + 0.5))
	end
	return out
end
local function known(...)
	local flags = Polestar.CharState().flags
	flags.taxi = {}
	for _, id in ipairs({ ... }) do flags.taxi[id] = true end
end
`;

function run(script) {
	return runAddon({
		stubs: ['stub_nav.lua'],
		addons: [NAV],
		login: true,
		script: `${PRELUDE}
nav.faction = "Alliance"
nav.useTravelWorld()
${script}`,
	}).emitted;
}

const ALL = ['walk|Follow the path|300,300', 'walk|Kobolds|300,0', 'walk|Enter the cave|300,-300', 'walk|Kobolds|0,-600'];

test('a player at the leg\'s start follows every via point, with its radius and caption (else the target\'s)', () => {
	const [out] = run(`
		nav.place(0, 600)
		nav.setWaypoint(goal(VIA))
		local legs = N.GetRoute()
		local r = { route = route(), legs = {} }
		for i, l in ipairs(legs) do r.legs[i] = { l.radius or false, l.waypoint or false, l.via or false } end
		r.total = legs[1].seconds + legs[1].rest
		emit(r)`);
	assert.deepEqual(out.route, ALL);
	assert.deepEqual(out.legs, [[12, true, 1], [12, true, 2], [8, true, 3], [false, false, false]]);
	// The walk to V1 is straight (x1.25), the chain at its own length, at 7 yd/s.
	const toV1 = Math.hypot(300, 300) * 1.25;
	const chain = 300 + 300 + Math.hypot(300, 300);
	assert.ok(Math.abs(out.total - (toV1 + chain) / 7) < 2, `real seconds follow the via chain (${out.total} s)`);
});

test('the entry: near the chain at the nearest segment\'s end, far away at the nearest point that is not inner, or straight when the target is nearer', () => {
	const [out] = run(`
		local r = {}
		nav.setWaypoint(goal(VIA))
		nav.place(350, -150)                             -- 50 yd beside V2 -> V3
		N.travel.Replan()
		r.near = route()
		nav.place(900, -350)                             -- 600 yd away; V3 is nearer but inner
		N.travel.Replan()
		r.far = route()
		nav.place(-400, -800)                            -- 450 yd from the target, farther from V1 and V2
		N.travel.Replan()
		r.straight = route()
		emit(r)`);
	assert.deepEqual(out.near, ['walk|Enter the cave|300,-300', 'walk|Kobolds|0,-600'], 'joins at V3');
	assert.deepEqual(out.far, ['walk|Kobolds|300,0', 'walk|Enter the cave|300,-300', 'walk|Kobolds|0,-600'], 'joins at V2, never inside the cave');
	assert.deepEqual(out.straight, ['walk|Kobolds|0,-600']);
});

test('the arrow shows the caption, advances inside a via point\'s radius, and re-planning never goes back to a passed point', () => {
	const [out] = run(`
		local r, advanced = {}, 0
		Polestar.On("ROUTE_ADVANCED", function() advanced = advanced + 1 end)
		nav.place(0, 600)
		nav.setWaypoint(goal(VIA))
		stub.advance(0.2)
		r.start = { A.GetMode(), A.labelText:GetText() }
		nav.place(305, 295)                              -- 7 yd from V1: inside its 12 yd radius
		stub.advance(0.2)
		r.atV1 = { advanced, A.labelText:GetText() }
		stub.advance(1.2)                                -- the ticker plans again from here
		r.fromV1 = route()
		nav.place(300, 10)                               -- 10 yd before V2, still on the V1 -> V2 segment
		stub.advance(0.2)
		r.atV2 = { advanced, A.labelText:GetText() }
		stub.advance(1.2)
		r.fromV2 = route()
		nav.place(320, 60)                               -- wandered back 60 yd up the V1 -> V2 segment
		stub.fire("ZONE_CHANGED")                        -- plans again
		r.back = route()
		nav.place(300, -295)
		stub.advance(0.2)
		r.atV3 = A.labelText:GetText()
		emit(r)`);
	assert.deepEqual(out.start, ['travel', 'Follow the path']);
	assert.deepEqual(out.atV1, [1, 'Kobolds'], 'V2 has no label: the target\'s');
	assert.deepEqual(out.fromV1, ALL.slice(1));
	assert.deepEqual(out.atV2, [2, 'Enter the cave']);
	assert.deepEqual(out.fromV2, ALL.slice(2));
	assert.deepEqual(out.back, ALL.slice(2), 'V2 is passed: a plan from its segment goes on to V3, never back');
	assert.equal(out.atV3, 'Kobolds', 'the last leg shows the target');
});

test('no via leaves the route as it was; a target set by hand has none; an empty list changes nothing', () => {
	const [out] = run(`
		local r = {}
		nav.place(0, 600)
		nav.setWaypoint(goal(nil))
		r.none = route()
		nav.setWaypoint(goal(VIA))
		local g = goal(VIA)
		N.SetTarget(g.map, g.x, g.y, "By hand")
		r.hand = route()
		r.handVia = N.GetTarget().via == nil
		N.ReleaseTarget()
		r.released = #route()
		local p = { c = 0, wx = 0, wy = 600, faction = 1, known = {}, speed = 7,
			target = { c = 0, wx = 0, wy = -600, label = "Kobolds" } }
		local plain = N.PlanRoute(p)
		p.target.via = {}
		local empty = N.PlanRoute(p)
		r.same = #plain == 1 and #empty == 1 and plain[1].seconds == empty[1].seconds and plain[1].label == empty[1].label
			and plain[1].radius == nil and empty[1].radius == nil
		emit(r)`);
	assert.deepEqual(out.none, ['walk|Kobolds|0,-600']);
	assert.deepEqual(out.hand, ['walk|By hand|0,-600']);
	assert.equal(out.handVia, true);
	assert.equal(out.released, 4, 'the engine\'s waypoint leads through its via points again');
	assert.equal(out.same, true);
});

test('via points in the Era frame land where the Era map puts them', () => {
	const [out] = run(`
		-- Map 9000's Era frame sits 100 yd north of the live one.
		nav.era[9000] = { c = 0, top = 900, bottom = -1100, left = 1000, right = -1000 }
		local function era(wx, wy, extra)
			local t = { map = 9000, x = (1000 - wy) / 20, y = (900 - wx) / 20, f = "e" }
			for k, v in pairs(extra or {}) do t[k] = v end
			return t
		end
		nav.place(0, 600)
		local g = goal({ era(300, 300, { r = 12, label = "Up the hill" }) })
		g.viaFrom = era(0, 600)
		nav.setWaypoint(g)
		emit(route())`);
	assert.deepEqual(out, ['walk|Up the hill|300,300', 'walk|Kobolds|0,-600']);
});

test('a walk from a landing flight master goes through the via points too', () => {
	const [out] = run(`
		known(1, 2)
		nav.place(0, 790)                                -- at West Hold
		local g = goal({ pt(300, -800, { r = 12, label = "Over the bridge" }) }, { 600, -700 }, "Camp")
		g.viaFrom = pt(0, -800)
		nav.setWaypoint(g)
		emit(route())`);
	assert.deepEqual(out, ['fly|Fly to East Hold|0,-800', 'walk|Over the bridge|300,-800', 'walk|Camp|600,-700']);
});

test('a hand-made path wins: a crossings chain into the target is taken and the via points are not', () => {
	const [out] = run(`
		N.RegisterCrossings({ complete = true,
			zones = { [9003] = { name = "East Vale", c = 0, top = 1000, bottom = -1000, left = 1000, right = -1000 } },
			chains = { { id = "den", name = "The Den", open = "mouth", nodes = {
				{ map = 9003, c = 0, wx = 0, wy = -300, r = 15, caption = "Enter the cave" },
				{ map = 9003, c = 0, wx = -100, wy = -300, r = 15, caption = "Follow the path" },
				{ map = 9003, c = 0, wx = -100, wy = -400, r = 15, caption = "Enter the Den" },
			} } } })
		nav.place(-100, -500)
		local r = {}
		nav.setWaypoint(goal(nil, { -110, -410 }, "Den boss"))
		r.chain = route()
		-- Generated points beside the cave's path, which a walk from its second node would join.
		local g = goal({ pt(-150, -300, { r = 12, label = "Generated" }), pt(-160, -380, { r = 8, label = "Generated" }) }, { -110, -410 }, "Den boss")
		g.viaFrom = pt(-400, -300)
		nav.setWaypoint(g)
		r.withVia = route()
		emit(r)`);
	assert.deepEqual(out.chain, ['walk|Enter the cave|0,-300', 'walk|Follow the path|-100,-300', 'walk|Den boss|-110,-410']);
	assert.deepEqual(out.withVia, out.chain);
});

// The Engine side: a located goal's waypoint carries the compiled via points
// when it is the goal's own point or a spawn spot within 60 yd of it.
test('the Engine\'s waypoint carries via and viaFrom for the goal\'s own point and near spots only', () => {
	const GUIDE = `
		Polestar.RegisterGuide({ id = "test/via", pack = "test", title = "Via", minLevel = 1, maxLevel = 60, steps = {
			{ title = "Hills", goals = {
				{ t = "kill", target = "Kobold Vermin", count = 10, quest = 7, oi = 1, map = 1429, x = 20, y = 50,
					spots = { { x = 20, y = 50, r = 30, n = 3 }, { x = 21.5, y = 50, r = 30, n = 2 }, { x = 25, y = 50, r = 30, n = 1 } },
					via = { { map = 1429, x = 30, y = 50, r = 12, label = "Follow the path" } },
					viaFrom = { map = 1429, x = 40, y = 50 } },
				{ t = "goto", map = 1429, x = 70, y = 50, text = "Camp" },
			} },
			{ goals = { { t = "level", level = 60 } } },
		} })
	`;
	const [out] = runAddon({
		stubs: ['stub_world.lua'],
		before: `local w = stub.world
w.addMap(1429, { name = "Elwynn Forest", c = 0, left = 1500, right = -1500, top = 500, bottom = -1500 })
w.titles[7] = "Kobold Camp Cleanup"; w.onQuest(7, { 10 }); w.moveTo(1429, 20, 50)`,
		addons: [{ name: 'Polestar', files: ['Core/Core.xml'] }],
		saved: { Polestar: 'PolestarCharDB = { schema = 1, guide = "test/via" }' },
		script: `${TEST_PACK}
${TEST_SOURCE}
${GUIDE}
stub.login()
local E = Polestar.Engine
local function via()
	local wp = E.GetWaypoint()
	return { wp.x, wp.via and wp.via[1].label or false, wp.viaFrom and wp.viaFrom.x or false }
end
local r = { own = via() }
E.CycleSpot(1, 1, 2); stub.advance(0.25)
r.near = via()                                       -- 1.5% = 45 yd away
E.CycleSpot(1, 1, 3); stub.advance(0.25)
r.far = via()                                        -- 150 yd away
stub.world.finish(7); stub.advance(0.6)
r.other = via()                                      -- the Camp's goto has none
emit(r)`,
	}).emitted;
	assert.deepEqual(out.own, [20, 'Follow the path', 40]);
	assert.deepEqual(out.near, [21.5, 'Follow the path', 40]);
	assert.deepEqual(out.far, [25, false, false]);
	assert.deepEqual(out.other, [70, false, false]);
});
