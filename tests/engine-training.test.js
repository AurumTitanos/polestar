'use strict';
// Class-training reminder (Engine "Smart logic"): with the shipped
// Core/ClassTrainers.lua, a character whose guide does not send them to
// their class trainer is reminded, with the nearest trainer of their class
// and faction. Real Core manifest, stub world.

const { test } = require('node:test');
const assert = require('node:assert/strict');
const { runAddon } = require('./helpers/lua');

const CORE = { name: 'Polestar', files: ['Core/Core.xml'] };

// An Undead Warrior at the Crossroads (Era frame of the Barrens).
const WORLD = `
local w = stub.world
w.addMap(1413, { name = "The Barrens", c = 1, left = 2622.917, right = -7510.417, top = 1612.5, bottom = -5139.583 })
w.race, w.raceName, w.faction, w.class = "Scourge", "Undead", "Horde", "WARRIOR"
w.level = 12
w.moveTo(1413, 51.9, 30.4)
`;

// The Barrens guide trains Orcs and Trolls in Orgrimmar; nothing for an Undead.
const GUIDES = `
Polestar.RegisterGuide({ id = "barrens", title = "The Barrens", faction = "Horde", minLevel = 10, maxLevel = 20, steps = {
	{ goals = { { t = "accept", quest = 870, title = "The Forgotten Pools", map = 1413, x = 52, y = 31 } } },
	{ only = { races = { "Orc", "Troll" } }, goals = { { t = "train", npc = 3353, npcName = "Grezz Ragefist", only = { classes = { "WARRIOR" } } } } },
	{ goals = { { t = "level", level = 20 } } },
} })
Polestar.RegisterGuide({ id = "trains", title = "Trains soon", faction = "Horde", minLevel = 10, maxLevel = 20, steps = {
	{ goals = { { t = "accept", quest = 870, title = "The Forgotten Pools", map = 1413, x = 52, y = 31 } } },
	{ goals = { { t = "train", class = true, candidates = { { npc = 3353, npcName = "Grezz Ragefist", map = 1454, x = 79.8, y = 31.4, f = "e", faction = "H", classes = { "WARRIOR" } } } } } },
	{ goals = { { t = "level", level = 20 } } },
} })
`;

function run({ saved, pre = '', script }) {
	return runAddon({
		stubs: ['stub_world.lua'],
		before: WORLD,
		addons: [CORE],
		saved,
		script: `${GUIDES}
DUE = {}
Polestar.On("TRAIN_DUE", function(level, t) DUE[#DUE + 1] = { level = level, npc = t.npc, map = t.map, faction = t.faction, warrior = (function() for _, c in ipairs(t.classes) do if c == "WARRIOR" then return true end end return false end)() } end)
Polestar.On("CLASS_TRAINED", function(level) DUE[#DUE + 1] = { trained = level } end)
${pre}
stub.login()
${script}`,
	}).emitted;
}

const TRAINED_AT_10 = { Polestar: 'PolestarCharDB = { schema = 1, classTrainLevel = 10 }' };

test('an Undead in the Barrens is reminded at 12, with the nearest Horde warrior trainer; training clears it', () => {
	const [out] = run({
		saved: TRAINED_AT_10,
		script: `
			Polestar.Engine.SetGuide("barrens"); stub.advance(0.5)
			local first = DUE[1]
			-- Once per level: more evaluations do not repeat it.
			stub.advance(0.5); Polestar.Engine.RequestUpdate(); stub.advance(0.5)
			local count = #DUE
			stub.world.trainer(first.npc); stub.advance(0.5)
			emit({ first = first, count = count, trained = DUE[#DUE], saved = PolestarCharDB.classTrainLevel })`,
	});
	assert.equal(out.first.level, 12);
	assert.equal(out.first.faction, 'H');
	assert.equal(out.first.warrior, true);
	// Kalimdor, near the Crossroads: Orgrimmar or Durotar, never Undercity.
	assert.ok([1411, 1454].includes(out.first.map), `trainer on map ${out.first.map}`);
	assert.equal(out.count, 1);
	assert.deepEqual(out.trained, { trained: 12 });
	assert.equal(out.saved, 12);
});

test('no reminder when the guide trains the class within its next steps, on odd levels, on first sight, or when off', () => {
	// The open guide sends warriors to their trainer two steps ahead.
	const soon = run({
		saved: { Polestar: 'PolestarCharDB = { schema = 1, classTrainLevel = 10, tabs = { "trains" }, activeTab = 1 }' },
		script: 'stub.advance(0.5); emit({ due = #DUE, guide = Polestar.Engine.GetGuide().id })',
	})[0];
	assert.deepEqual(soon, { due: 0, guide: 'trains' });

	const odd = run({ saved: TRAINED_AT_10, pre: 'stub.world.level = 11', script: 'stub.advance(0.5); emit({ due = #DUE })' })[0];
	assert.equal(odd.due, 0);

	// No stored level (new install, or lost saved variables): counts as trained now.
	const fresh = run({ script: 'stub.advance(0.5); emit({ due = #DUE, saved = PolestarCharDB.classTrainLevel })' })[0];
	assert.deepEqual(fresh, { due: 0, saved: 12 });

	const off = run({ saved: TRAINED_AT_10, pre: 'Polestar.Set("behavior.trainReminder", "off")', script: 'stub.advance(0.5); emit({ due = #DUE })' })[0];
	assert.equal(off.due, 0);
});
