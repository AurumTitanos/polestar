'use strict';
// Quest automation (addon/Polestar/Core/Automation.lua) driven through the
// stub world's quest, greeting and gossip frames.

const { test } = require('node:test');
const assert = require('node:assert/strict');
const { runAddon } = require('./helpers/lua');
const { TEST_PACK, TEST_SOURCE } = require('./helpers/packs');

const CORE = { name: 'Polestar', files: ['Core/Core.xml'] };

const GUIDE = `
${TEST_PACK}
${TEST_SOURCE}
Polestar.RegisterGuide({
	id = "test/auto", pack = "test", title = "Automation", minLevel = 1, maxLevel = 10,
	steps = {
		{ goals = { { t = "accept", quest = 783, title = "A Threat Within" } } },
		{ goals = {
			{ t = "turnin", quest = 783, title = "A Threat Within" },
			{ t = "accept", quest = 7, title = "Kobold Camp Cleanup" },
		} },
		{ goals = { { t = "accept", quest = 33, title = "Wolves Across the Border" } } },
		{ goals = { { t = "level", level = 3 } } },
		{ goals = { { t = "accept", quest = 18, title = "Brotherhood of Thieves" } } },
	},
})
`;

// `script` runs after login with `w` = stub.world and `flush()`.
function run({ before = '', saved, script }) {
	return runAddon({
		stubs: ['stub_world.lua'],
		before: `w = stub.world; w.addMap(1429, { name = "Elwynn Forest", c = 0, left = 1500, right = -1500, top = 500, bottom = -1500 }); w.moveTo(1429, 48, 42)\n${before}`,
		addons: [CORE],
		saved,
		script: `${GUIDE}\nfunction flush() stub.advance(0.25) end\nstub.login()\n${script}`,
	}).emitted;
}

const calls = 'local c = {}; for i, x in ipairs(w.calls) do c[i] = table.concat({ tostring(x[1]), tostring(x[2]), tostring(x[3]) }, " ") end';

test('accepts a quest the current step wants, and nothing else', () => {
	const [out] = run({
		script: `
			w.questDetail(823, 999); w.close()
			w.questDetail(823, 783)
			flush()
			${calls}
			emit({ calls = c, onQuest = w.log[783] ~= nil, other = w.log[999] == nil, step = Polestar.Engine.GetStepIndex() })
		`,
	});
	assert.deepEqual(out, { calls: ['AcceptQuest 783 nil'], onQuest: true, other: true, step: 2 });
});

test('accepts within the current and next two steps only', () => {
	const [out] = run({
		script: `
			w.questDetail(1, 33)      -- step 3: current + 2
			w.questDetail(2, 18)      -- step 5: beyond the window
			w.close()
			${calls}
			emit(c)
		`,
	});
	assert.deepEqual(out, ['AcceptQuest 33 nil']);
});

test('reading ahead with Next still accepts the quests of the step the player is on', () => {
	const [out] = run({
		script: `
			Polestar.Engine.Next(); Polestar.Engine.Next()
			local viewed, live = Polestar.Engine.GetStepIndex(), Polestar.Engine.GetLiveStep()
			w.questDetail(823, 783)   -- step 1: the live step, behind the view
			flush()
			${calls}
			emit({ calls = c, viewed = viewed, live = live })
		`,
	});
	assert.deepEqual(out, { calls: ['AcceptQuest 783 nil'], viewed: 3, live: 1 });
});

test('holding Shift, or turning the settings off, suppresses automation', () => {
	const [out] = run({
		before: 'w.complete({ 783 })',
		script: `
			stub.keys.shift = true
			w.questDetail(197, 7); w.close()
			stub.keys.shift = false
			Polestar.Set("behavior.autoAccept", false)
			w.questDetail(197, 7); w.close()
			Polestar.Set("behavior.autoAccept", true)
			w.onQuest(783, {}) ; w.completed[783] = nil
			Polestar.Set("behavior.autoTurnin", false)
			w.questProgress(197, 783); w.close()
			${calls}
			emit(c)
		`,
	});
	assert.deepEqual(out, {}); // no calls (Lua encodes an empty list as {})
});

test('gossip turns in the finished guide quest first, then accepts the follow-up', () => {
	const [out] = run({
		before: 'w.onQuest(783, {})',
		script: `
			local opts = {
				active = { { questID = 783, isComplete = true }, { questID = 999, isComplete = true } },
				available = { { questID = 7, objectives = { 10 } } },
			}
			w.gossip(197, opts)
			flush()
			w.gossip(197, { available = opts.available })
			flush()
			${calls}
			emit({ calls = c, done = w.completed[783], on7 = w.log[7] ~= nil, step = Polestar.Engine.GetStepIndex() })
		`,
	});
	assert.deepEqual(out, {
		calls: [
			'C_GossipInfo.SelectActiveQuest 783 nil',
			'CompleteQuest 783 nil',
			'GetQuestReward 783 0',
			'C_GossipInfo.SelectAvailableQuest 7 nil',
			'AcceptQuest 7 nil',
		],
		done: true,
		on7: true,
		step: 3,
	});
});

test('never picks among several rewards; takes the only reward when there is one', () => {
	const [several] = run({
		before: 'w.onQuest(783, {}); w.choices[783] = 3',
		script: `
			stub.messages = {}
			w.questProgress(197, 783)
			${calls}
			emit({ calls = c, onQuest = w.log[783] ~= nil, frame = w.frame and w.frame.kind, said = stub.messages[1] })
		`,
	});
	assert.deepEqual(several, {
		calls: ['CompleteQuest 783 nil'],
		onQuest: true,
		frame: 'complete',
		said: '|cff4fd1c5Polestar|r: Choose a reward to finish the turn-in.',
	});

	const [one] = run({
		before: 'w.onQuest(783, {}); w.choices[783] = 1',
		script: `
			w.questProgress(197, 783)
			${calls}
			emit(c)
		`,
	});
	assert.deepEqual(one, ['CompleteQuest 783 nil', 'GetQuestReward 783 1']);
});

test('leaves unfinished, costly, PvP and non-guide quests alone', () => {
	const [out] = run({
		before: 'w.onQuest(783, { 2 })',
		script: `
			w.gossip(197, { active = { { questID = 783, isComplete = false } } }); w.close()
			w.questProgress(197, 783); w.close()           -- objectives not done
			w.finish(783)
			w.questComplete(197, 783, { money = 500 }); w.close()
			w.onQuest(999, {})
			w.questProgress(197, 999); w.close()           -- not a turnin goal
			w.questDetail(197, 7, { pvp = true }); w.close()
			${calls}
			emit({ calls = c, onQuest = w.log[783] ~= nil })
		`,
	});
	assert.deepEqual(out, { calls: {}, onQuest: true });
});

test('auto-accept quests are acknowledged instead of accepted', () => {
	const [out] = run({
		script: `
			w.questDetail(823, 783, { auto = true })
			${calls}
			emit({ calls = c, onQuest = w.log[783] ~= nil })
		`,
	});
	assert.deepEqual(out, { calls: ['AcknowledgeAutoAcceptQuest 783 nil'], onQuest: true });
});

test('the greeting panel selects guide quests by their index', () => {
	const [out] = run({
		before: 'w.complete({ 783 })',
		script: `
			w.greeting(197, { active = { { questID = 999, isComplete = true } }, available = { { questID = 998 }, { questID = 7, objectives = { 10 } } } })
			${calls}
			emit({ calls = c, on7 = w.log[7] ~= nil })
		`,
	});
	assert.deepEqual(out, { calls: ['SelectAvailableQuest 7 2', 'AcceptQuest 7 nil'], on7: true });
});
