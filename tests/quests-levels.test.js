'use strict';
// Quests/QuestLevels.lua: "[12] " before quest titles in the quest log, the
// objective tracker, gossip and greeting quest lists and quest detail titles,
// against fakes of the camelot UI (tests/lua/stub_questlog.lua). Added once,
// never on top of a level the client drew, never when the level is unknown,
// never when it would wrap an already laid-out title; qol.questLevels off
// puts back exactly the text Polestar changed.

const { test } = require('node:test');
const assert = require('node:assert/strict');
const { runAddon } = require('./helpers/lua');

function run(script, { setup = '' } = {}) {
	return runAddon({
		stubs: ['stub_world.lua', 'stub_quests.lua', 'stub_questlog.lua'],
		before: `
local ql = stub.questlog
ql.quests[7] = { title = "Kobold Camp Cleanup", level = 12 }
ql.quests[18] = { title = "Gathering Wood", level = 24, elite = true }
ql.quests[33] = { title = "Mystery Errand" } -- level unknown to the client
ql.quests[40] = { title = "Abcdefghijklmnopqrstuvwxyzabc", level = 30 } -- fills the tracker line
ql.quests[61] = { title = "Old Lore" } -- only the quest database knows its level
ql.log = { 7, 18, 33 }
${setup}`,
		addons: ['Polestar'],
		script: `
local ql, sq = stub.questlog, stub.quests
local function texts(buttons)
	local out = {}
	for i, b in ipairs(buttons) do out[i] = b:GetText() end
	return out
end
local function logTexts() return { ql.logText(7), ql.logText(18), ql.logText(33) } end
${script}`,
	}).emitted;
}

test('the quest log gets the level once; a second refresh does not double it', () => {
	const [first, second] = run(`
ql.updateLog()
emit(logTexts())
ql.updateLog()
ql.updateLog()
emit(logTexts())`);
	const want = ['[12] Kobold Camp Cleanup', '[24+] Gathering Wood', 'Mystery Errand'];
	assert.deepEqual(first, want);
	assert.deepEqual(second, want);
});

test('the tracker header gets the level inside the colour code, in combat too', () => {
	const [quest, campaign, again, unknown] = run(`
stub.inCombat = true
ql.updateTracker(7)
emit(ql.trackerText(7))
ql.updateTracker(18, true)
emit(ql.trackerText(18, true))
ql.updateTracker(7)
ql.updateTracker(7)
emit(ql.trackerText(7))
ql.updateTracker(33)
emit(ql.trackerText(33))`);
	assert.equal(quest, '|cffffd100[12] Kobold Camp Cleanup|r');
	assert.equal(campaign, '|cffffd100[24+] Gathering Wood|r');
	assert.equal(again, '|cffffd100[12] Kobold Camp Cleanup|r');
	assert.equal(unknown, '|cffffd100Mystery Errand|r');
});

test('a prefix that would wrap a laid-out title onto another line is not added', () => {
	const [text, lines] = run(`
ql.updateTracker(40)
local block = QuestObjectiveTracker:GetExistingBlock(40)
emit(ql.trackerText(40))
emit(block.HeaderText:GetNumLines())`);
	assert.equal(text, '|cffffd100Abcdefghijklmnopqrstuvwxyzabc|r');
	assert.equal(lines, 1);
});

test('camelot: a level the client already drew in the log and tracker is left as drawn', () => {
	const [log, tracker] = run(
		`
ql.updateLog()
emit(logTexts())
ql.updateTracker(18)
emit(ql.trackerText(18))`,
		{ setup: 'ql.native = true' },
	);
	assert.deepEqual(log, ['[12] Kobold Camp Cleanup', '[24+] Gathering Wood', '[0] Mystery Errand']);
	assert.equal(tracker, '|cffffd100[24+] Gathering Wood (Elite)|r');
});

test('gossip quest buttons use the gossip level and resize to the new text', () => {
	const [list, heights, again] = run(`
local buttons = ql.gossip({ { 7, level = 12 }, { 33, level = 5 }, { 61, level = 0 }, { 18, active = true, level = 24 } })
emit(texts(buttons))
local h = {}
for i, b in ipairs(buttons) do h[i] = b:GetHeight() == math.max(b:GetTextHeight() + 2, 16) end
emit(h)
buttons[1]:Setup({ questID = 7, title = "Kobold Camp Cleanup", questLevel = 12 })
emit(buttons[1]:GetText())`);
	assert.deepEqual(list, [
		'|cff000000[12] Kobold Camp Cleanup|r',
		'|cff000000[5] Mystery Errand|r',
		'|cff000000Old Lore|r',
		'|cff000000[24+] Gathering Wood|r',
	]);
	assert.deepEqual(heights, [true, true, true, true]);
	assert.equal(again, '|cff000000[12] Kobold Camp Cleanup|r');
});

test('greeting titles get the level on show and on a direct refresh, from the quest database when the client has none', () => {
	const [shown, direct, heights] = run(`
local Q = Polestar.QuestDB
Q._data.meta = {}
Q._data.quests[61] = { [Q.F.LEVEL] = 7 }
emit(texts(ql.greeting({ 18 }, { 7, 61, 33 })))
emit(texts(ql.greetingDirect()))
local h = {}
for i, b in ipairs(ql.greetingDirect()) do h[i] = b:GetHeight() == math.max(b:GetTextHeight() + 2, 16) end
emit(h)`);
	const want = [
		'|cff000000[24+] Gathering Wood|r',
		'|cff000000[12] Kobold Camp Cleanup|r',
		'|cff000000[7] Old Lore|r',
		'|cff000000Mystery Errand|r',
	];
	assert.deepEqual(shown, want);
	assert.deepEqual(direct, want);
	assert.deepEqual(heights, [true, true, true, true]);
});

test('quest detail titles get the level; templates without a title are ignored', () => {
	const [fromLog, fromNpc, rewards, unknown] = run(`
emit(ql.detail(7, true))
emit(ql.detail(18, false))
QuestInfo_Display(QUEST_TEMPLATE_MAP_REWARDS, QuestInfoFrame)
emit(QuestInfoTitleHeader:GetText())
emit(ql.detail(33, false))`);
	assert.equal(fromLog, '[12] Kobold Camp Cleanup');
	assert.equal(fromNpc, '[24+] Gathering Wood');
	assert.equal(rewards, '[24+] Gathering Wood');
	assert.equal(unknown, 'Mystery Errand');
});

test('turning qol.questLevels off restores every title; on (or a qol reset) adds them back', () => {
	const [off, redrawnOff, on, reset] = run(`
local function all()
	return { logTexts(), ql.trackerText(7), texts(gossip), texts(greet), QuestInfoTitleHeader:GetText() }
end
ql.updateLog()
ql.updateTracker(7)
gossip = ql.gossip({ { 7, level = 12 } })
greet = ql.greeting({}, { 18 })
ql.detail(7, true)
Polestar.Set("qol.questLevels", false)
emit(all())
ql.updateLog()
ql.updateTracker(7)
emit({ logTexts(), ql.trackerText(7) })
Polestar.Set("qol.questLevels", true)
emit(all())
Polestar.Set("qol.questLevels", false)
Polestar.ResetSettings("qol")
emit(all())`);
	const plain = [
		['Kobold Camp Cleanup', 'Gathering Wood', 'Mystery Errand'],
		'|cffffd100Kobold Camp Cleanup|r',
		['|cff000000Kobold Camp Cleanup|r'],
		['|cff000000Gathering Wood|r'],
		'Kobold Camp Cleanup',
	];
	const levels = [
		['[12] Kobold Camp Cleanup', '[24+] Gathering Wood', 'Mystery Errand'],
		'|cffffd100[12] Kobold Camp Cleanup|r',
		['|cff000000[12] Kobold Camp Cleanup|r'],
		['|cff000000[24+] Gathering Wood|r'],
		'[12] Kobold Camp Cleanup',
	];
	assert.deepEqual(off, plain);
	assert.deepEqual(redrawnOff, plain.slice(0, 2));
	assert.deepEqual(on, levels);
	assert.deepEqual(reset, levels);
});

test('turning it off leaves a level the client drew itself', () => {
	const [log] = run(
		`
ql.updateLog()
Polestar.Set("qol.questLevels", false)
emit(logTexts())`,
		{ setup: 'ql.native = true' },
	);
	assert.deepEqual(log, ['[12] Kobold Camp Cleanup', '[24+] Gathering Wood', '[0] Mystery Errand']);
});

test('secret levels and quest IDs leave the title alone', () => {
	const [list] = run(`
sq.secret(99)
sq.secret(4242)
ql.quests[4242] = { title = "Hidden", level = 3 }
emit(texts(ql.gossip({ { 33, level = 99 }, { 4242, level = 3 } })))`);
	assert.deepEqual(list, ['|cff000000Mystery Errand|r', '|cff000000Hidden|r']);
});

test('a tracker that loads after Polestar is hooked on its ADDON_LOADED', () => {
	const [before, after] = run(
		`
emit(QuestObjectiveTracker == nil)
ql.installTracker()
stub.addonLoaded("Blizzard_ObjectiveTracker")
ql.updateTracker(7)
emit(ql.trackerText(7))`,
		{ setup: 'ql.removeTracker()' },
	);
	assert.equal(before, true);
	assert.equal(after, '|cffffd100[12] Kobold Camp Cleanup|r');
});
