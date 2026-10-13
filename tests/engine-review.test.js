'use strict';
// Engine and registry fixes from the code review: no rewind when saved state
// is lost, positional state discarded when a guide's shape changes, the
// waypoint preferring blocking goals and re-announcing on guide switch,
// live-frame coordinate text, guide-level validation, and achievements
// earned by this character only.

const { test } = require('node:test');
const assert = require('node:assert/strict');
const { runAddon } = require('./helpers/lua');

const CORE = { name: 'Polestar', files: ['Core/Core.xml'] };

const WORLD = `
local w = stub.world
w.addMap(1429, { name = "Elwynn Forest", c = 0, left = 1500, right = -1500, top = 500, bottom = -1500 })
w.moveTo(1429, 20, 80)
w.class, w.className, w.level = "WARRIOR", "Warrior", 8
`;

const GUIDE = `
Polestar.RegisterGuide({ id = "ns", title = "Northshire", faction = "Alliance", minLevel = 1, maxLevel = 10, steps = {
	{ goals = { { t = "accept", quest = 783, title = "A Threat Within" } } },
	{ goals = { { t = "talk", npc = 197, npcName = "Marshal McBride" } } },
	{ only = { classes = { "WARRIOR" } }, goals = { { t = "train", npc = 911, npcName = "Llane Beshere" } } },
	{ goals = { { t = "hearth", location = "Northshire Abbey" } } },
	{ goals = { { t = "turnin", quest = 783, title = "A Threat Within" } } },
	{ goals = { { t = "accept", quest = 7, title = "Kobold Camp Cleanup" } } },
	{ goals = { { t = "talk", npc = 6, npcName = "Someone" } } },
} })
`;

function run({ before = '', guides = GUIDE, saved, script }) {
	return runAddon({
		stubs: ['stub_world.lua'],
		before: WORLD + before,
		addons: [CORE],
		saved,
		script: `${guides}
			E = Polestar.Engine
			function flush() stub.advance(0.25) end
			stub.login()
			${script}`,
	}).emitted;
}

test('lost SavedVariables or /polestar reset never rewind to soft steps before live quest progress', () => {
	const [lost] = run({
		before: 'stub.world.complete({ 783 }); stub.world.onQuest(7, {})',
		saved: { Polestar: 'PolestarDB = nil; PolestarCharDB = nil' },
		script: 'E.SetGuide("ns"); emit({ at = E.GetStepIndex(), latched = PolestarCharDB.manual.ns })',
	});
	assert.deepEqual(lost, { at: 7, latched: { '2:1': true, '3:1': true, '4:1': true } });

	const [reset] = run({
		before: 'stub.world.complete({ 783 }); stub.world.onQuest(7, {})',
		script: 'E.SetGuide("ns"); SlashCmdList.POLESTAR("reset"); flush(); emit(E.GetStepIndex())',
	});
	assert.equal(reset, 7);

	// Without later quest progress the soft steps stay open.
	const [early] = run({
		before: 'stub.world.onQuest(783, {})',
		saved: { Polestar: 'PolestarCharDB = nil' },
		script: 'E.SetGuide("ns"); emit(E.GetStepIndex())',
	});
	assert.equal(early, 2);
});

test('a guide loaded at login is placed from the quest log even with stored check-offs, once the log is readable', () => {
	const saved = { Polestar: 'PolestarCharDB = { schema = 1, tabs = { "ns" }, activeTab = 1, manual = { ns = { ["2:1"] = true } } }' };
	const [atLogin] = run({
		before: 'stub.world.complete({ 783 }); stub.world.onQuest(7, {})',
		saved,
		script: 'emit({ at = E.GetStepIndex(), latched = PolestarCharDB.manual.ns })',
	});
	assert.deepEqual(atLogin, { at: 7, latched: { '2:1': true, '3:1': true, '4:1': true } });

	// The client fills the quest log after PLAYER_LOGIN: placing waits for it.
	const [late] = run({
		saved,
		script: `
			local first = E.GetStepIndex()
			stub.world.complete({ 783 }); stub.world.onQuest(7, {})
			stub.fire("QUEST_LOG_UPDATE"); flush()
			emit({ first = first, placed = E.GetStepIndex() })
		`,
	});
	assert.deepEqual(late, { first: 1, placed: 7 });
});

test('after placement, soft steps hold during play: a quest taken out of order never jumps them', () => {
	const [out] = run({
		before: 'stub.world.onQuest(783, {})',
		saved: { Polestar: 'PolestarCharDB = nil' },
		script: `
			E.SetGuide("ns")
			stub.fire("QUEST_LOG_UPDATE"); flush()
			local placed = E.GetStepIndex()
			stub.world.turnIn(783); stub.world.accept(7, {}); flush()
			emit({ placed = placed, after = E.GetStepIndex(), latched = PolestarCharDB.manual.ns or false })
		`,
	});
	assert.deepEqual(out, { placed: 2, after: 2, latched: false });
});

test('class and race steps are no evidence for placement: their chains run on their own schedule', () => {
	const [out] = run({
		guides: `
			Polestar.RegisterGuide({ id = "cls", title = "Class", minLevel = 1, maxLevel = 10, steps = {
				{ goals = { { t = "train", npc = 911, npcName = "Llane Beshere" } } },
				{ only = { classes = { "WARRIOR" } }, goals = { { t = "accept", quest = 50, title = "Class Chain" } } },
				{ goals = { { t = "accept", quest = 51, title = "Next" } } },
			} })
		`,
		before: 'stub.world.complete({ 50 })',
		saved: { Polestar: 'PolestarCharDB = nil' },
		script: 'E.SetGuide("cls"); emit(E.GetStepIndex())',
	});
	assert.equal(out, 1);
});

test('check-offs and skips are discarded when the guide changes shape, kept otherwise', () => {
	const saved = (shape) => `PolestarCharDB = { schema = 1, tabs = { "ns" }, activeTab = 1, shapes = { ns = ${shape} },
		manual = { ns = { ["2:1"] = true } }, skipped = { ns = { [3] = true } } }`;
	const script = 'emit({ shape = PolestarCharDB.shapes.ns, manual = PolestarCharDB.manual.ns or false, skipped = PolestarCharDB.skipped.ns or false, at = E.GetStepIndex() })';
	const before = 'stub.world.onQuest(783, {})';
	const [first] = run({ before, saved: { Polestar: saved('nil') }, script });
	assert.deepEqual(first.manual, { '2:1': true }); // no fingerprint yet: kept
	assert.equal(first.at, 4);
	const [same] = run({ before, saved: { Polestar: saved(JSON.stringify(first.shape)) }, script });
	assert.deepEqual([same.manual, same.skipped, same.at], [{ '2:1': true }, { 3: true }, 4]);
	const [changed] = run({ before, saved: { Polestar: saved('"7-12345"') }, script });
	assert.deepEqual([changed.manual, changed.skipped, changed.at], [false, false, 2]);
});

test('the waypoint prefers blocking goals over optional ones and notes', () => {
	const [out] = run({
		guides: `
			Polestar.RegisterGuide({ id = "wp", title = "WP", minLevel = 1, maxLevel = 60, steps = { { goals = {
				{ t = "note", text = "Look", map = 1429, x = 10, y = 10 },
				{ t = "collect", item = 1, itemName = "Cave loot", optional = true, map = 1429, x = 20, y = 20 },
				{ t = "goto", map = 1429, x = 30, y = 30, text = "Camp" },
				{ t = "level", level = 60 },
			} } } })
		`,
		script: `
			E.SetGuide("wp")
			local first = E.GetWaypoint().goalIndex
			stub.world.moveTo(1429, 30, 30); stub.advance(1)
			emit({ first, E.GetWaypoint() and E.GetWaypoint().goalIndex or false })
		`,
	});
	assert.deepEqual(out, [3, 2]);
});

test('switching to a guide whose first waypoint sits at the same spot still announces it', () => {
	const [out] = run({
		guides: `
			Polestar.RegisterGuide({ id = "first", title = "First", minLevel = 1, maxLevel = 60, steps = {
				{ goals = { { t = "goto", map = 1429, x = 48, y = 42, text = "Deputy Willem" } } } } })
			Polestar.RegisterGuide({ id = "second", title = "Second", minLevel = 1, maxLevel = 60, steps = {
				{ goals = { { t = "goto", map = 1429, x = 48, y = 42, text = "Willem at the gate", r = 4 } } } } })
		`,
		script: `
			E.SetGuide("first")
			local seen = {}
			Polestar.On("WAYPOINT_CHANGED", function(wp) seen[#seen + 1] = wp and (wp.label .. "/" .. wp.r) or "nil" end)
			E.SetGuide("second")
			emit(seen)
		`,
	});
	assert.deepEqual(out, ['Go to Willem at the gate/4']);
});

test('unlabeled Era-frame coordinates are shown in the live frame', () => {
	const [out] = run({
		guides: `
			Polestar.RegisterMapFrames({ era = { [1429] = { c = 0, left = 1600, right = -1400, top = 600, bottom = -1400 } } })
			Polestar.RegisterGuide({ id = "era", title = "Era", minLevel = 1, maxLevel = 60, steps = {
				{ goals = { { t = "goto", map = 1429, x = 50, y = 50, f = "e" } } } } })
		`,
		script: 'E.SetGuide("era"); emit({ E.GetStepView(1).goals[1].text, E.GetWaypoint().label })',
	});
	assert.deepEqual(out, ['Go to 46.7, 45.0', 'Go to 46.7, 45.0']);
});

test('guide-level races, classes and faction must be strings, so Suggest can never throw', () => {
	const [out] = run({
		guides: '',
		script: `
			local function try(extra)
				local def = { id = "x", title = "X", steps = { { goals = { { t = "level", level = 2 } } } } }
				for k, v in pairs(extra) do def[k] = v end
				local ok, err = Polestar.RegisterGuide(def)
				return ok and "ok" or err
			end
			emit({ try({ races = { 1 } }), try({ classes = { true } }), try({ faction = true }), try({ races = { "Human" }, faction = "Alliance" }),
				Polestar.Guides.Suggest() or false })
		`,
	});
	assert.deepEqual(out, ['bad races', 'bad classes', 'bad faction', 'ok', 'x']);
});

test('an achievement earned only by another character on the account is not done', () => {
	const [out] = run({
		guides: `
			Polestar.RegisterGuide({ id = "lg", title = "Legacy", category = "Legacy", minLevel = 1, maxLevel = 60, steps = {
				{ goals = { { t = "achieve", achievement = 9001, achievementName = "Legacy: Northshire" } } },
				{ goals = { { t = "level", level = 60 } } },
			} })
		`,
		before: 'stub.world.addAchievement(9001, "Legacy: Northshire", { { "A", 1 } }); stub.world.achievements[9001].account = true',
		script: `
			E.SetGuide("lg")
			local before = { E.GetStepIndex(), Polestar.Compat.GetAchievement(9001).completed }
			stub.world.criteria(9001, 1, 1); flush()
			emit({ before = before, after = E.GetStepIndex() })
		`,
	});
	assert.deepEqual(out, { before: [1, false], after: 2 });
});
