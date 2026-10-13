'use strict';
// Performance budgets: the whole addon, every module on, against the stubbed
// world (tests/lua/stub_world.lua) with the local data packs loadable on demand
// when built (Polestar_QuestDB, Polestar_Codex, Polestar_ItemDB). Addon time is
// CPU time inside game event handlers, message listeners, OnUpdate scripts and
// C_Timer callbacks (tests/lua/profile.lua), so harness work does not count.
//
//   - a burst of 50 QUEST_LOG_UPDATE and 50 BAG_UPDATE in one frame, plus the
//     refreshes it schedules: under 4 ms;
//   - a frame while the player walks (OnUpdate scripts and tickers): under 1 ms;
//   - SetGuide, and every step change while a leveling guide plays, with what
//     they schedule: under 8 ms;
//   - a gathering guide plays to the end in under 15 s of wall time.
//
// Budgets are steady-state: the data packs are loaded first (each is a single
// on-demand parse of its data, reported as `packMs`, not a per-step cost), and
// a full garbage collection runs before each measurement so a collector cycle
// owed to earlier work is not charged to it.
//
// Needs data/forever (node tools/polestar.js data build); skips without it.
// To find what broke a budget: node tests/helpers/profile.js <guide> --packs [--sample=1000]

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { ROOT } = require('./helpers/lua');
const { buildSimPack, playGuide, luaValue, SIMULATE } = require('../tools/lib/playtest');
const { localPacks } = require('./helpers/profile');

const DATA = path.join(ROOT, 'data', 'forever');
const LEVELING = 'forever/horde/02-the-barrens.guide';
const GATHERING = 'forever/professions/mining.guide';
const skip = !fs.existsSync(path.join(DATA, 'quests.json'))
	? 'reference data not built (node tools/polestar.js data build)'
	: !fs.existsSync(path.join(ROOT, 'guides', LEVELING)) || !fs.existsSync(path.join(ROOT, 'guides', GATHERING))
		? 'budget guides missing'
		: false;

const BUDGET = { burst: 4, tick: 1, setGuide: 8, stepChange: 8, gatherSeconds: 15 };

// Settings that are off by default, switched on so every module runs.
const ALL_ON = {
	'qol.nameplateIcons': true, 'qol.guideDim': true, 'maps.minimapCoords': true, 'maps.travelMinimap': true,
	'rares.minimapRares': true, 'rares.minimapTreasures': true, 'rares.combatAlerts': true,
};

let pack;
function simPack() {
	if (!pack) pack = buildSimPack([LEVELING, GATHERING]);
	return pack;
}
process.on('exit', () => pack && pack.dispose());

test('event bursts, walking frames and step changes stay within budget with every module on', { skip }, () => {
	const p = simPack();
	const leveling = p.guides.find((g) => g._ast && g._ast.source === LEVELING);
	const gathering = p.guides.find((g) => g._ast && g._ast.source === GATHERING);
	const packs = localPacks();
	const [r] = playGuide(p, leveling, {
		race: 'Orc', faction: 'Horde', cls: 'WARRIOR',
		stubs: [...packs.stubs, 'profile.lua'],
		before: `${packs.before}\nstub.profile.start()`,
		script: `
local P, E, w = stub.profile, Polestar.Engine, stub.world
for k, v in pairs(${luaValue(ALL_ON)}) do Polestar.Set(k, v) end
-- Every pack present, loaded once (what a session pays the first time a
-- feature needs one), then the delayed work after login.
local out = { packs = {}, packMs = {} }
for _, name in ipairs(${luaValue(packs.present)}) do
	out.packMs[name] = P.measure(function() Polestar.Data.Pack(name) end)
end
for name in pairs(stub.packLoads) do out.packs[#out.packs + 1] = name end
table.sort(out.packs)
stub.advance(6) -- delayed work (Rares' minimap layers wait 5 s)

-- Addon time of fn plus the frames that follow it (deferred refreshes), less
-- what those frames cost when nothing happens.
local function idleFrames(seconds)
	local t = P.total()
	stub.advance(seconds)
	return P.total() - t
end
local idle = math.huge
for _ = 1, 5 do idle = math.min(idle, idleFrames(0.5)) end
out.idle = idle
local function withFrames(fn)
	collectgarbage("collect")
	local t = P.total()
	local direct = P.measure(fn)
	stub.advance(0.5)
	return direct + P.total() - t - idle
end

out.setGuide = math.max(
	withFrames(function() E.SetGuide(${luaValue(gathering.id)}) end),
	withFrames(function() E.SetGuide(${luaValue(leveling.id)}) end))

out.burst = 0
for _ = 1, 3 do
	out.burst = math.max(out.burst, withFrames(function()
		for i = 1, 50 do
			stub.fire("QUEST_LOG_UPDATE")
			stub.fire("BAG_UPDATE", i % 5)
		end
		stub.fire("BAG_UPDATE_DELAYED")
	end))
end

-- Walking: one frame at a time, a few yards per second, for 10 s.
out.tick = 0
local map, x, y = w.map, w.x, w.y
collectgarbage("collect")
for i = 1, 200 do
	w.moveTo(map, x + i * 0.01, y + i * 0.005)
	local t = P.total()
	stub.advance(0.05)
	out.tick = math.max(out.tick, P.total() - t)
end
w.moveTo(map, x, y)
stub.advance(0.6)

-- Every step change while the guide plays: what the action and the frames
-- after it cost (the simulator's own reads are not addon time). The
-- collector is held for the playthrough.
out.stepChange, out.changes = 0, 0
local advance = stub.advance
local lastStep, lastTotal = E.GetStepIndex(), P.total()
stub.advance = function(s)
	advance(s)
	local now, step = P.total(), E.GetStepIndex()
	if step ~= lastStep then
		out.changes = out.changes + 1
		out.stepChange = math.max(out.stepChange, now - lastTotal)
	end
	lastStep, lastTotal = step, now
end
collectgarbage("collect")
collectgarbage("stop")
local __emit = emit
emit = function(v) out.result = v end
${SIMULATE}
emit = __emit
collectgarbage("restart")
stub.advance = advance
emit(out)`,
	});
	const report = `budgets (ms) ${JSON.stringify(BUDGET)}; measured ${JSON.stringify({
		burst: +r.burst.toFixed(3), tick: +r.tick.toFixed(3), setGuide: +r.setGuide.toFixed(3),
		stepChange: +r.stepChange.toFixed(3), changes: r.changes, idle: +r.idle.toFixed(3), packs: r.packs,
		packMs: Object.fromEntries(Object.entries(r.packMs || {}).map(([k, v]) => [k, +v.toFixed(1)])),
	})}`;
	assert.ok(r.result && r.result.done, `the leveling guide did not finish: ${JSON.stringify(r.result && r.result.stuck)}`);
	assert.ok(r.changes > 10, `too few step changes measured (${r.changes})`);
	assert.ok(r.burst < BUDGET.burst, report);
	assert.ok(r.tick < BUDGET.tick, report);
	assert.ok(r.setGuide < BUDGET.setGuide, report);
	assert.ok(r.stepChange < BUDGET.stepChange, report);
	console.log(report);
});

test(`a gathering guide plays to the end in under ${BUDGET.gatherSeconds} s`, { skip }, () => {
	const p = simPack();
	const gathering = p.guides.find((g) => g._ast && g._ast.source === GATHERING);
	const packs = localPacks();
	const t0 = Date.now();
	const [out] = playGuide(p, gathering, { race: 'Orc', faction: 'Horde', cls: 'WARRIOR', stubs: packs.stubs, before: packs.before });
	const seconds = (Date.now() - t0) / 1000;
	assert.ok(out.done, `stuck at ${JSON.stringify(out.stuck)}`);
	assert.ok(seconds < BUDGET.gatherSeconds, `${gathering.id} took ${seconds.toFixed(1)} s`);
});
