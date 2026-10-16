'use strict';
// Missable quests (addon/Polestar/Core/Closes.lua): what taking a quest closes
// for good, the chat line on the quest window, and Automation leaving such an
// accept to the player (behavior.warnClosing).

const { test } = require('node:test');
const assert = require('node:assert/strict');
const { runAddon } = require('./helpers/lua');
const { TEST_PACK, TEST_SOURCE } = require('./helpers/packs');

const CORE = { name: 'Polestar', files: ['Core/Core.xml'] };

// 164 is a breadcrumb to 95; 97 also closes it. The Night Elf accept and the
// second "Sven's Revenge" are closed by 95 too, but a Human never loses them:
// one is not his, the other is the same quest.
const GUIDE = `
${TEST_PACK}
${TEST_SOURCE}
Polestar.RegisterGuide({
	id = "test/closes", pack = "test", title = "Closes", minLevel = 1, maxLevel = 30,
	steps = {
		{ goals = {
			{ t = "accept", quest = 164, title = "Deliveries to Sven", closedBy = { 95, 97 }, preTitles = { [95] = "Sven's Revenge", [97] = "Other Way" } },
			{ t = "accept", quest = 5673, title = "Elune's Grace", closedBy = { 95 }, preTitles = { [95] = "Sven's Revenge" }, only = { races = { "NightElf" } } },
			{ t = "accept", quest = 96, title = "Sven's Revenge", closedBy = { 95 }, preTitles = { [95] = "Sven's Revenge" } },
		} },
		{ goals = { { t = "accept", quest = 95, title = "Sven's Revenge" } } },
	},
})
`;

function run({ before = '', addons = [CORE], script }) {
	return runAddon({
		stubs: ['stub_world.lua'],
		before: `w = stub.world; w.addMap(1429, { name = "Elwynn Forest", c = 0, left = 1500, right = -1500, top = 500, bottom = -1500 }); w.moveTo(1429, 48, 42)\n${before}`,
		addons,
		script: `${GUIDE}\nstub.login()\n${script}
local accepted = {}
for _, x in ipairs(w.calls) do if x[1] == "AcceptQuest" then accepted[#accepted + 1] = x[2] end end
local said = {}
for _, m in ipairs(stub.messages) do if m:find("for good", 1, true) then said[#said + 1] = m:gsub("^.-|r: ", "") end end
emit({ accepted = accepted, said = said })`,
	}).emitted;
}

const offer = 'w.questDetail(311, 95, { title = "Sven\'s Revenge" })';

test('off by default: the guide quest is accepted and nothing is said', () => {
	const [out] = run({ script: offer });
	assert.deepEqual(out, { accepted: [95], said: {} });
});

test('on: offering a quest that closes another for good names it and leaves the accept to the player', () => {
	const [out] = run({ script: `Polestar.Set("behavior.warnClosing", true)\n${offer}` });
	assert.deepEqual(out, { accepted: {}, said: ["Taking Sven's Revenge closes Deliveries to Sven for good."] });
});

test('nothing to lose once the closed quest is done, or already closed by another quest', () => {
	const done = run({ before: 'w.complete({ 164 })', script: `Polestar.Set("behavior.warnClosing", true)\n${offer}` })[0];
	const closed = run({ before: 'w.complete({ 97 })', script: `Polestar.Set("behavior.warnClosing", true)\n${offer}` })[0];
	assert.deepEqual([done, closed], [{ accepted: [95], said: {} }, { accepted: [95], said: {} }]);
});

test('the warning stands without quest automation, and a quest the game accepts itself gets none', () => {
	const [out] = run({
		script: `
			Polestar.Set("behavior.warnClosing", true)
			Polestar.Set("behavior.autoAccept", false)
			${offer}
			w.close()
			w.questDetail(311, 95, { title = "Sven's Revenge", auto = true })`,
	});
	assert.deepEqual(out, { accepted: {}, said: ["Taking Sven's Revenge closes Deliveries to Sven for good."] });
});

test('a Night Elf loses the Night Elf quest too', () => {
	const [out] = run({
		before: 'w.race, w.raceName = "NightElf", "Night Elf"',
		script: `Polestar.Set("behavior.warnClosing", true)\n${offer}`,
	});
	assert.deepEqual(out.said, ["Taking Sven's Revenge closes Deliveries to Sven, Elune's Grace for good."]);
});

test('the quest database adds the quests no guide takes, read the way its links point', () => {
	// 282 lists 287 in its excl and 287 lists nothing back (as in the shipped
	// data); 283 is Horde only. Layout: title, level, minLevel, races, classes,
	// faction, start, finish, startItem, pre, excl.
	const [out] = run({
		addons: ['Polestar'],
		script: `
			local Q = Polestar.QuestDB
			Q.AddData("quests", {
				[282] = { "Senir's Observations", 5, 1, nil, nil, 1, nil, nil, nil, nil, { 287 } },
				[283] = { "Horde Errand", 5, 1, nil, nil, 2, nil, nil, nil, nil, { 287 } },
				[287] = { "Frostmane Hold", 8, 5, nil, nil, 1 },
			})
			Q.AddData("meta", {})
			Polestar.Set("behavior.warnClosing", true)
			w.questDetail(1965, 287, { title = "Frostmane Hold" })
			w.close()
			${offer}`,
	});
	assert.deepEqual(out.said, [
		'Taking Frostmane Hold closes Senir\'s Observations for good.',
		"Taking Sven's Revenge closes Deliveries to Sven for good.",
	]);
});

test('a quest the game accepted itself is still acknowledged by automation', () => {
	const [out] = runAddon({
		stubs: ['stub_world.lua'],
		before: 'w = stub.world; w.addMap(1429, { name = "Elwynn Forest", c = 0, left = 1500, right = -1500, top = 500, bottom = -1500 }); w.moveTo(1429, 48, 42)',
		addons: [CORE],
		script: `${GUIDE}\nstub.login()
			Polestar.Set("behavior.warnClosing", true)
			w.questDetail(311, 95, { title = "Sven's Revenge", auto = true })
			local c = {}
			for _, x in ipairs(w.calls) do c[#c + 1] = x[1] end
			emit(c)`,
	}).emitted;
	assert.deepEqual(out, ['AcknowledgeAutoAcceptQuest']);
});
