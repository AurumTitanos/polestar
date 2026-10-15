'use strict';
// A Class guide the character cannot start yet (Engine.StartGate): its
// opening waits on a level (a `level` goal, or accepts none of which the
// character can take yet) or on a prerequisite quest. The guide window shows a
// notice instead of the steps, the arrow points nowhere, a visit to the giver
// neither moves the guide on nor finishes it, and the guide picks up by
// itself when the gate opens; the guide menu's row says when. Leveling guides
// are left as they were. The whole addon, the stub world, synthetic guides.

const { test } = require('node:test');
const assert = require('node:assert/strict');
const { runAddon } = require('./helpers/lua');
const { TEST_PACK, TEST_SOURCE } = require('./helpers/packs');

const WORLD = `
local w = stub.world
w.addMap(1411, { name = "Durotar", c = 1, left = 1000, right = -1000, top = 1000, bottom = -3000 })
w.addMap(1454, { name = "Orgrimmar", c = 1, left = 2000, right = 1000, top = 1000, bottom = 0 })
w.moveTo(1411, 50, 40)
w.race, w.faction, w.class, w.className, w.level = "Orc", "Horde", "SHAMAN", "Shaman", 5
`;

// Call of Water: its accept needs 20. Cat Form: a `level` goal opens it.
// Valor: its accept needs another quest first. Errand: one accept can be
// taken now. Barrens: a leveling guide shaped like Call of Water.
const GUIDES = `
local function reg(id, title, category, steps)
	assert(Polestar.RegisterGuide({ id = id, pack = "test", title = title, category = category, minLevel = 20, maxLevel = 23, steps = steps }))
end
reg("test/water", "Call of Water", "Class", {
	{ title = "Searn Firewarder", goals = { { t = "accept", quest = 1528, title = "Call of Water", npc = 5892, npcName = "Searn Firewarder", minLevel = 20, map = 1454, x = 38, y = 36 } } },
	{ title = "Islen Waterseer", goals = {
		{ t = "turnin", quest = 1528, title = "Call of Water", npc = 5901, npcName = "Islen Waterseer", map = 1411, x = 60, y = 40 },
		{ t = "accept", quest = 1530, title = "Call of Water", npc = 5901, npcName = "Islen Waterseer", minLevel = 20, pre = { 1528 }, map = 1411, x = 60, y = 40 },
	} },
})
reg("test/cat", "Cat Form", "Class", {
	{ title = "Turak", goals = {
		{ t = "level", level = 22 },
		{ t = "accept", quest = 98340, title = "The Great Cat Spirit", npc = 3033, npcName = "Turak Runetotem", minLevel = 20 },
	} },
})
reg("test/valor", "Valor", "Class", {
	{ title = "Rall", goals = { { t = "accept", quest = 1794, title = "The Tome of Valor", npc = 6179, npcName = "Duthorian Rall", pre = { 1793 }, preTitles = { [1793] = "The Tome of Divinity" }, map = 1411, x = 52, y = 41 } } },
})
reg("test/errand", "Errand", "Class", {
	{ title = "Two givers", goals = {
		{ t = "accept", quest = 801, title = "Later", npc = 3000, npcName = "Gazrog", minLevel = 20, map = 1411, x = 51, y = 41 },
		{ t = "accept", quest = 802, title = "Now", npc = 3001, npcName = "Thork", map = 1411, x = 52, y = 41 },
	} },
})
reg("test/barrens", "Barrens", "Leveling", {
	{ title = "Searn Firewarder", goals = { { t = "accept", quest = 1528, title = "Call of Water", npc = 5892, npcName = "Searn Firewarder", minLevel = 20, map = 1454, x = 38, y = 36 } } },
	{ goals = { { t = "level", level = 30 } } },
})
`;

function run(script) {
	return runAddon({
		stubs: ['stub_world.lua'],
		before: WORLD,
		addons: ['Polestar'],
		script: `${TEST_PACK}
${TEST_SOURCE}
${GUIDES}
			E, w = Polestar.Engine, stub.world
			local p = Polestar.UI.GuideFrame.parts
			function shown()
				local wp = E.GetWaypoint()
				return { step = E.GetStepIndex() or false, notice = p.empty:IsShown() and p.empty.Title:GetText() or false,
					text = p.empty:IsShown() and p.empty.Text:GetText() or false, card = p.card:IsShown(),
					wp = wp and wp.goalIndex or false, state = E.GetGuideState(E.GetGuide().id) }
			end
			stub.login()
			stub.fire("QUEST_LOG_UPDATE")
			Polestar.Set("behavior.autoAccept", false)
			${script}`,
	}).emitted;
}

test('a Class guide whose first quest needs a higher level says when, points nowhere, survives a visit to the giver and opens at that level', () => {
	const [out] = run(`
		E.SetGuide("test/water"); stub.advance(0.6)
		local r = { open = shown() }
		w.gossip(5892, { available = {} }); w.close(); stub.advance(0.6)
		r.visited = shown()
		w.setLevel(20); stub.advance(0.6)
		r.levelled = shown()
		emit(r)`);
	const waiting = {
		step: 1,
		notice: 'Available from level 20',
		text: 'Searn Firewarder, Orgrimmar starts it.\nCome back at level 20: the guide picks up by itself then.',
		card: false,
		wp: false,
		state: 'started',
	};
	assert.deepEqual(out.open, waiting);
	assert.deepEqual(out.visited, waiting, 'the visit neither moves the guide on nor finishes it');
	assert.deepEqual(out.levelled, { step: 1, notice: false, text: false, card: true, wp: 1, state: 'started' });
});

test('a `level` goal opening the guide gives the level; Next still looks at the steps', () => {
	const [out] = run(`
		E.SetGuide("test/water"); stub.advance(0.6)
		E.Next(); stub.advance(0.1)
		local r = { ahead = shown() }
		E.SetGuide("test/cat"); stub.advance(0.6)
		r.open = shown()
		w.setLevel(20); stub.advance(0.6)
		r.twenty = shown().notice
		emit(r)`);
	assert.equal(out.open.notice, 'Available from level 22');
	assert.equal(out.open.text, 'Turak Runetotem starts it.\nCome back at level 22: the guide picks up by itself then.');
	assert.equal(out.twenty, 'Available from level 22');
	assert.deepEqual([out.ahead.step, out.ahead.notice, out.ahead.card], [2, false, true]);
});

test('a missing prerequisite names the quest, and its turn-in opens the guide', () => {
	const [out] = run(`
		E.SetGuide("test/valor"); stub.advance(0.6)
		local r = { open = shown() }
		w.complete({ 1793 }); w.turnIn(1793); stub.advance(0.6)
		r.done = shown()
		emit(r)`);
	assert.equal(out.open.notice, 'Not available yet');
	assert.equal(out.open.text, 'Duthorian Rall, Durotar starts it.\nFinish The Tome of Divinity first: the guide picks up by itself then.');
	assert.equal(out.open.wp, false);
	assert.equal(out.done.notice, false);
	assert.equal(out.done.card, true);
});

test('no notice when an opening quest can be taken now, once the guide is under way, or in a leveling guide', () => {
	const [out] = run(`
		local r = {}
		E.SetGuide("test/errand"); stub.advance(0.6)
		r.errand = shown().notice
		r.gate = E.StartGate("test/errand") or false
		E.SetGuide("test/barrens"); stub.advance(0.6)
		r.leveling = shown().notice
		r.levelingGate = E.StartGate("test/barrens") or false
		w.onQuest(1794, {})
		r.started = E.StartGate("test/valor") or false
		emit(r)`);
	assert.deepEqual(out, { errand: false, gate: false, leveling: false, levelingGate: false, started: false });
});

test('the guide menu\'s row says when a Class guide opens, and stops once it does', () => {
	const [out] = run(`
		local UI, P = Polestar.UI, Polestar.UI.Picker
		local function row(title)
			for _, f in ipairs(stub.frames) do
				if f.psGuide and rawget(f, "Range") and f:IsShown() and f.psGuide.title == title then return f.Note:GetText() end
			end
			return false
		end
		UI.ShowPicker(); P.SetCategory("Class")
		local r = { water = row("Call of Water"), valor = row("Valor"), errand = row("Errand") }
		w.setLevel(20); stub.advance(0.6); P.SetCategory("Class")
		r.after = row("Call of Water")
		emit(r)`);
	// A pack's guide carries its pack's title ("Test") outside the pack's own list.
	assert.deepEqual(out, { water: 'From level 20  \u00b7  Test', valor: 'Not available yet  \u00b7  Test', errand: 'Test', after: 'Test' });
});
