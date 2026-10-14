'use strict';
// Performance budgets for the Recorder (addon/Polestar_Recorder) while it
// records, against the world of tests/lua/stub_recorder.lua: the budgets
// perf.test.js holds Polestar to, so the Recorder can stay on while a player
// plays. Addon time is CPU time inside its event handlers, OnUpdate scripts
// and C_Timer callbacks (tests/lua/profile.lua).
//
//   - a frame while the player walks (the breadcrumb ticker included): under 1 ms;
//   - a burst of the events questing sends most, 50 of each in one frame,
//     plus the scans it schedules: under 4 ms.
//
// Unlike perf.test.js it needs no reference data, so it runs everywhere.

const { test } = require('node:test');
const assert = require('node:assert/strict');
const { runAddon } = require('./helpers/lua');

const BUDGET = { burst: 4, tick: 1 };

test('recording stays within the walking-frame and event-burst budgets', () => {
	const [r] = runAddon({
		stubs: ['stub_recorder.lua', 'profile.lua'],
		addons: ['Polestar_Recorder'],
		login: true,
		before: 'stub.profile.start()',
		script: `
local P = stub.profile
SlashCmdList.POLESTARREC("on")
stub.advance(3) -- the delayed work after login
local out = {}

-- One step of os.clock: whole milliseconds on some systems (Windows), so a
-- reading can be one step high. Never more than 1 ms of slack.
local c0 = os.clock()
local c1 = os.clock()
while c1 == c0 do c1 = os.clock() end
out.resolution = math.min((c1 - c0) * 1000, 1)

-- Addon time of a second of frames when nothing happens (one ticker run).
local function idleFrames()
	local t = P.total()
	stub.advance(1)
	return P.total() - t
end
local idle = math.huge
for _ = 1, 5 do idle = math.min(idle, idleFrames()) end
out.idle = idle

-- The events are fired from the top level, so P.total counts the Recorder's
-- handlers and not the loop that fires them.
local mob = stub.creature(6, "Kobold Vermin")
stub.setUnit("mouseover", mob, "Kobold Vermin")
stub.setUnit("target", mob, "Kobold Vermin")
out.burst = 0
for _ = 1, 3 do
	collectgarbage("collect")
	local t = P.total()
	for _ = 1, 50 do
		stub.fire("QUEST_LOG_UPDATE")
		stub.fire("UNIT_QUEST_LOG_CHANGED", "player")
		stub.fire("UPDATE_MOUSEOVER_UNIT")
		stub.fire("PLAYER_TARGET_CHANGED")
		stub.fire("UNIT_SPELLCAST_SUCCEEDED", "player", "Cast-3-0-0-0-6603-0", 6603)
	end
	stub.advance(1)
	out.burst = math.max(out.burst, P.total() - t - idle)
end

-- Walking: one frame at a time for 10 s, far enough that breadcrumbs are
-- written (the work being measured).
local S = PolestarRecorderDB.sessions[PolestarRecorderDB.current]
local function crumbs()
	local n = 0
	for _, e in ipairs(S.events) do if e.e == "pos" then n = n + 1 end end
	return n
end
local before = crumbs()
out.tick = 0
stub.world.moving = true
collectgarbage("collect")
for i = 1, 200 do
	stub.moveTo(20 + i * 0.2, 30 + i * 0.1)
	local t = P.total()
	stub.advance(0.05)
	out.tick = math.max(out.tick, P.total() - t)
end
stub.world.moving = false
out.crumbs = crumbs() - before
emit(out)`,
	}).emitted;
	const report = `budgets (ms) ${JSON.stringify(BUDGET)}; measured ${JSON.stringify({
		burst: +r.burst.toFixed(3), tick: +r.tick.toFixed(3), idle: +r.idle.toFixed(3), crumbs: r.crumbs,
		resolution: +r.resolution.toFixed(3),
	})}`;
	assert.ok(r.crumbs > 0, `walking wrote no breadcrumbs, so nothing was measured; ${report}`);
	assert.ok(r.burst < BUDGET.burst + r.resolution, report);
	assert.ok(r.tick < BUDGET.tick + r.resolution, report);
	console.log(report);
});
