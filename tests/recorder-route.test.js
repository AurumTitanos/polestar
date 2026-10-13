'use strict';
// Route telemetry in the recorder (addon/Polestar_Recorder/Route.lua): `step`
// snapshots from Polestar's message bus, combat/AFK/revive events, and
// running with Polestar absent, late or broken.

const { test } = require('node:test');
const assert = require('node:assert/strict');
const { runAddon } = require('./helpers/lua');

const REC = 'Polestar_Recorder';

// A stand-in for Polestar's bus and Engine (docs/ARCHITECTURE.md "Message bus",
// "Tabs"): __fire(msg, ...) delivers a message; __lode.guide/step is the
// active tab.
const FAKE_POLESTAR = `
__lode = {
	handlers = {},
	guides = {
		g1 = { id = "forever/alliance/human/01-elwynn", title = "Elwynn Forest", steps = { { title = "Deputy Willem" }, { title = "Kobold Camp" }, { title = "Wolves" } } },
		g2 = { id = "professions/mining", title = "Mining 1-75", steps = { { title = "Learn Mining" } } },
	},
}
__lode.guide, __lode.step = __lode.guides.g1, 2
function __installPolestar()
	Polestar = {
		On = function(msg, fn)
			__lode.handlers[msg] = __lode.handlers[msg] or {}
			table.insert(__lode.handlers[msg], fn)
			return {}
		end,
		Engine = {
			GetGuide = function() return __lode.guide end,
			GetStepIndex = function() return __lode.step end,
		},
	}
end
function __fire(msg, ...)
	for _, fn in ipairs(__lode.handlers[msg] or {}) do fn(...) end
end
`;

const PRELUDE = `
local function S() return PolestarRecorderDB.sessions[PolestarRecorderDB.current] end
local function events(kind)
	local out = {}
	for _, e in ipairs(S().events) do
		if e.e == kind then
			local c = {}
			for k, v in pairs(e) do if k ~= "t" then c[k] = v end end
			out[#out + 1] = c
		end
	end
	return out
end
`;

function run(script, opts = {}) {
	return runAddon({
		stubs: ['stub_recorder.lua'],
		addons: [REC],
		login: true,
		...opts,
		before: FAKE_POLESTAR + (opts.before || ''),
		script: PRELUDE + script,
	}).emitted;
}

test('step snapshots: at login, on every step change, on a tab switch (once), and at guide completion', () => {
	const [out] = run(
		`
		stub.world.xp, stub.world.money, stub.world.rested = 120, 4200, 800
		stub.advance(5)
		__lode.step = 3
		__fire("STEP_CHANGED", 3)
		stub.advance(5)
		-- switching tabs fires GUIDE_CHANGED then STEP_CHANGED for the same state
		__lode.guide, __lode.step = __lode.guides.g2, 1
		__fire("GUIDE_CHANGED", "professions/mining")
		__fire("STEP_CHANGED", 1)
		stub.advance(5)
		stub.world.combat = true
		__lode.guide, __lode.step = __lode.guides.g1, 3
		__fire("GUIDE_CHANGED", "forever/alliance/human/01-elwynn")
		stub.world.combat = false
		stub.advance(5)
		__lode.step = nil
		__fire("STEP_CHANGED", nil)
		__fire("GUIDE_COMPLETED", "forever/alliance/human/01-elwynn")
		emit(events("step"))`,
		{ before: `__installPolestar(); stub.world.level, stub.world.xp = 3, 100; stub.moveTo(48.2, 41.9)` },
	);

	const base = { v: 1, lvl: 3, xpMax: 400, map: 1429, x: 48.2, y: 41.9 };
	assert.equal(out.length, 6);
	for (const e of out) assert.equal(typeof e.time, 'number');
	const strip = (e) => {
		const c = { ...e };
		delete c.time;
		return c;
	};
	assert.deepEqual(out.map(strip), [
		{ ...base, e: 'step', reason: 'login', guide: 'forever/alliance/human/01-elwynn', step: 2, title: 'Kobold Camp', guideTitle: 'Elwynn Forest', xp: 100, money: 0 },
		{ ...base, e: 'step', reason: 'step', guide: 'forever/alliance/human/01-elwynn', step: 3, title: 'Wolves', xp: 120, money: 4200, rested: 800 },
		{ ...base, e: 'step', reason: 'guide', guide: 'professions/mining', step: 1, title: 'Learn Mining', guideTitle: 'Mining 1-75', xp: 120, money: 4200, rested: 800 },
		{ ...base, e: 'step', reason: 'guide', guide: 'forever/alliance/human/01-elwynn', step: 3, title: 'Wolves', guideTitle: 'Elwynn Forest', xp: 120, money: 4200, rested: 800, combat: true },
		{ ...base, e: 'step', reason: 'step', guide: 'forever/alliance/human/01-elwynn', xp: 120, money: 4200, rested: 800 },
		{ ...base, e: 'step', reason: 'complete', guide: 'forever/alliance/human/01-elwynn', xp: 120, money: 4200, rested: 800 },
	]);
});

test('a /reload snapshots the current step again into the same session', () => {
	const [first] = run(`emit(stub.serialize(PolestarRecorderDB))`, { before: '__installPolestar()' });
	const [out] = run(
		`
		stub.fire("PLAYER_LOGIN")
		stub.fire("PLAYER_ENTERING_WORLD", false, true)
		local reasons = {}
		for _, e in ipairs(events("step")) do reasons[#reasons + 1] = e.reason .. ":" .. e.step end
		local n = 0
		for _ in pairs(PolestarRecorderDB.sessions) do n = n + 1 end
		emit({ reasons = reasons, sessions = n })`,
		{ login: false, before: `__installPolestar(); stub.epoch = stub.epoch + 60`, saved: { [REC]: `PolestarRecorderDB = ${first}` } },
	);
	assert.deepEqual(out, { reasons: ['login:2', 'login:2'], sessions: 1 });
});

test('combat, AFK and revive events', () => {
	const [out] = run(`
		stub.moveTo(40, 40)
		stub.fire("PLAYER_REGEN_DISABLED")
		stub.advance(10)
		stub.fire("PLAYER_REGEN_ENABLED")
		stub.fire("PLAYER_REGEN_ENABLED") -- no second "off"
		stub.world.afk = true
		stub.fire("PLAYER_FLAGS_CHANGED", "player")
		stub.fire("PLAYER_FLAGS_CHANGED", "player") -- unchanged: nothing
		stub.world.afk = false
		stub.fire("PLAYER_FLAGS_CHANGED", "player")
		stub.fire("PLAYER_FLAGS_CHANGED", "party1")
		-- die, release (PLAYER_ALIVE while a ghost: not a revive), run back
		stub.world.dead = true
		stub.fire("PLAYER_DEAD")
		stub.fire("PLAYER_ALIVE")
		stub.moveTo(41, 41)
		stub.world.dead = false
		stub.fire("PLAYER_UNGHOST")
		stub.fire("PLAYER_ALIVE") -- already alive: no second revive
		emit({ combat = events("combat"), afk = events("afk"), death = #events("death"), revive = events("revive") })`);
	assert.deepEqual(out.combat, [
		{ e: 'combat', on: true, map: 1429, x: 40, y: 40 },
		{ e: 'combat', on: false },
	]);
	assert.deepEqual(out.afk, [{ e: 'afk', on: true }, { e: 'afk', on: false }]);
	assert.equal(out.death, 1);
	assert.deepEqual(out.revive, [{ e: 'revive', map: 1429, x: 41, y: 41 }]);
});

test('without Polestar nothing is snapshotted and nothing errors; a late or broken Polestar is handled', () => {
	const [absent] = run(`
		stub.fire("PLAYER_REGEN_DISABLED")
		emit({ steps = #events("step"), combat = #events("combat") })`);
	assert.deepEqual(absent, { steps: 0, combat: 1 });

	// Polestar loads after the recorder: attached on its ADDON_LOADED.
	const [late] = run(`
		__installPolestar()
		stub.addonLoaded("Polestar")
		__lode.step = 3
		__fire("STEP_CHANGED", 3)
		local s = {}
		for _, e in ipairs(events("step")) do s[#s + 1] = e.reason .. ":" .. e.step end
		emit(s)`);
	assert.deepEqual(late, ['step:3']);

	// An Engine that errors or returns junk: snapshots carry what is known.
	const [broken] = run(
		`
		Polestar.Engine.GetGuide = function() error("boom") end
		__fire("STEP_CHANGED", 2)
		__fire("GUIDE_CHANGED", { id = "x/y" })
		__fire("GUIDE_COMPLETED", nil)
		local s = {}
		for _, e in ipairs(events("step")) do s[#s + 1] = { e.reason, e.guide or false, e.step or false } end
		emit(s)`,
		{ before: '__installPolestar()' },
	);
	assert.deepEqual(broken, [
		['login', 'forever/alliance/human/01-elwynn', 2],
		['step', false, 2],
		['guide', 'x/y', false],
	]);
});
