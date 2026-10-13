'use strict';
// Route choice (Engine "Route choice"): a guide whose `next` names several
// guides lets the player choose where to level; the Engine asks, remembers,
// recommends the nearest, and skips quest goals the character never had.
// Real Core manifest, stub world.

const { test } = require('node:test');
const assert = require('node:assert/strict');
const { runAddon } = require('./helpers/lua');

const CORE = { name: 'Polestar', files: ['Core/Core.xml'] };

// Kalimdor (c = 1): Durotar east of the Barrens; Eastern Kingdoms (c = 0):
// Tirisfal north of Silverpine. Frames are simplified squares.
const WORLD = `
local w = stub.world
w.addMap(1411, { name = "Durotar", c = 1, left = -3000, right = -6000, top = 1000, bottom = -2000 })
w.addMap(1413, { name = "The Barrens", c = 1, left = 0, right = -3000, top = 1000, bottom = -2000 })
w.addMap(1420, { name = "Tirisfal Glades", c = 0, left = 3000, right = 0, top = 3000, bottom = 0 })
w.addMap(1421, { name = "Silverpine Forest", c = 0, left = 3000, right = 0, top = 0, bottom = -3000 })
w.race, w.raceName, w.faction, w.class = "Orc", "Orc", "Horde", "WARRIOR"
`;

const GUIDES = `
Polestar.RegisterGuide({ id = "durotar", title = "Durotar", faction = "Horde", races = { "Orc", "Troll" }, minLevel = 1, maxLevel = 10,
	next = "barrens", nextChoices = { "barrens", "silverpine", "mulgore-only" }, steps = {
	{ goals = { { t = "accept", quest = 1, title = "Your Place In The World", map = 1411, x = 42, y = 68 } } },
	{ goals = { { t = "turnin", quest = 1, title = "Your Place In The World", map = 1411, x = 52, y = 43 } } },
} })
Polestar.RegisterGuide({ id = "tirisfal", title = "Tirisfal Glades", faction = "Horde", races = { "Undead" }, minLevel = 1, maxLevel = 10,
	next = "silverpine", nextChoices = { "silverpine", "barrens" }, steps = {
	{ goals = { { t = "accept", quest = 2, title = "Rude Awakening", map = 1420, x = 30, y = 71 } } },
	{ goals = { { t = "turnin", quest = 2, title = "Rude Awakening", map = 1420, x = 61, y = 52 } } },
} })
Polestar.RegisterGuide({ id = "barrens", title = "The Barrens", faction = "Horde", minLevel = 10, maxLevel = 20, zone = 1413,
	zoneName = "The Barrens", next = "stonetalon", pitch = "Dense quests around a central hub.",
	pros = { "Most quests in one zone", "Crossroads flight path" }, cons = { "Busy at launch" }, steps = {
	{ goals = {
		{ t = "goto", map = 1413, x = 52, y = 30 },
		{ t = "turnin", quest = 50, title = "Tauren Leftover", map = 1413, x = 52, y = 30 },
	} },
	{ goals = { { t = "accept", quest = 60, title = "Kolkar Leaders", map = 1413, x = 52, y = 31 } } },
	{ goals = { { t = "level", level = 20 } } },
} })
Polestar.RegisterGuide({ id = "silverpine", title = "Silverpine Forest", faction = "Horde", minLevel = 10, maxLevel = 18, zone = 1421,
	zoneName = "Silverpine Forest", next = "stonetalon", pitch = "A quiet zone next to Undercity.", steps = {
	{ goals = { { t = "goto", map = 1421, x = 43, y = 41 } } },
	{ goals = { { t = "level", level = 18 } } },
} })
Polestar.RegisterGuide({ id = "mulgore-only", title = "Tauren side road", faction = "Horde", races = { "Tauren" }, minLevel = 10, maxLevel = 20, steps = {
	{ goals = { { t = "level", level = 20 } } },
} })
Polestar.RegisterGuide({ id = "stonetalon", title = "Stonetalon Mountains", faction = "Horde", minLevel = 18, maxLevel = 22, steps = {
	{ goals = { { t = "level", level = 22 } } },
} })
`;

const HELPERS = `
E = Polestar.Engine
w = stub.world
function flush() stub.advance(0.25) end
LOG = {}
for _, m in ipairs({ "ROUTE_CHOICE", "ROUTE_CHOSEN", "GUIDE_CHANGED" }) do
	Polestar.On(m, function(a, b) LOG[#LOG + 1] = m .. " " .. tostring(a) .. (b and (" " .. tostring(b)) or "") end)
end
function takeLog() local l = LOG; LOG = {}; return l end
function finishStarter(q)
	w.accept(q, {}); flush()
	w.finish(q); w.turnIn(q); flush()
end
function optionIds(c)
	local out = {}
	for i, o in ipairs(c.options) do out[i] = o.id .. (o.recommended and "*" or "") end
	return out
end
`;

function run({ before = '', saved, script }) {
	return runAddon({
		stubs: ['stub_world.lua'],
		before: WORLD + before,
		addons: [CORE],
		saved,
		script: `${GUIDES}\n${HELPERS}\nstub.login()\n${script}`,
	}).emitted;
}

test('finishing a guide with a route choice asks, keeps the finished guide, and loads the chosen route', () => {
	const [out] = run({
		before: 'w.moveTo(1411, 52, 43)',
		script: `
			E.SetGuide("durotar"); flush(); takeLog()
			finishStarter(1)
			local r = { asked = takeLog(), guide = E.GetGuide().id, pending = E.PendingRouteChoice() }
			local c = E.GetRouteChoice("durotar")
			r.options, r.joinsAt, r.recommended = optionIds(c), c.joinsAt, c.recommended
			r.barrens = { c.options[1].pitch, c.options[1].pros[2], c.options[1].cons[1], c.options[1].quests, c.options[1].minLevel, c.options[1].maxLevel }
			r.nearer = c.options[1].seconds < c.options[2].seconds
			r.chose = E.ChooseRoute("durotar", "silverpine"); flush()
			r.after = { guide = E.GetGuide().id, log = takeLog(), saved = PolestarCharDB.routes.durotar, pending = E.PendingRouteChoice() }
			r.bad = E.ChooseRoute("durotar", "stonetalon")
			emit(r)`,
	});
	// Asked once, after GUIDE_COMPLETED; the finished guide stays loaded.
	assert.deepEqual(out.asked, ['ROUTE_CHOICE durotar']);
	assert.equal(out.guide, 'durotar');
	assert.equal(out.pending, 'durotar');
	// The Tauren-only option does not fit an Orc; the Barrens is nearest from Durotar.
	assert.deepEqual(out.options, ['barrens*', 'silverpine']);
	assert.equal(out.recommended, 'barrens');
	assert.equal(out.nearer, true);
	assert.equal(out.joinsAt, 'Stonetalon Mountains');
	// The Barrens' pitch, pros and cons; one accept is all an Orc gets there.
	assert.deepEqual(out.barrens, ['Dense quests around a central hub.', 'Crossroads flight path', 'Busy at launch', 1, 10, 20]);
	assert.equal(out.chose, true);
	assert.deepEqual(out.after, { guide: 'silverpine', log: ['GUIDE_CHANGED silverpine', 'ROUTE_CHOSEN durotar silverpine'], saved: 'silverpine' });
	// Only offered guides can be chosen.
	assert.equal(out.bad, false);
});

test('a remembered choice, or behavior.routeChoice = "recommended", continues without asking', () => {
	const remembered = run({
		before: 'w.moveTo(1411, 52, 43)',
		saved: { Polestar: 'PolestarCharDB = { schema = 1, routes = { durotar = "silverpine" } }' },
		script: `
			E.SetGuide("durotar"); flush(); takeLog()
			finishStarter(1)
			emit({ guide = E.GetGuide().id, log = takeLog() })`,
	})[0];
	assert.deepEqual(remembered, { guide: 'silverpine', log: ['GUIDE_CHANGED silverpine'] });

	// An Undead in Tirisfal: Silverpine is next door, the Barrens a boat away.
	const recommended = run({
		before: 'w.race, w.raceName = "Scourge", "Undead"; w.moveTo(1420, 61, 52)',
		script: `
			Polestar.Set("behavior.routeChoice", "recommended")
			E.SetGuide("tirisfal"); flush(); takeLog()
			finishStarter(2)
			emit({ guide = E.GetGuide().id, log = takeLog() })`,
	})[0];
	assert.deepEqual(recommended, { guide: 'silverpine', log: ['GUIDE_CHANGED silverpine'] });
});

test('turn-ins and objectives of quests the character never had no longer block', () => {
	const [out] = run({
		before: 'w.level = 10; w.moveTo(1413, 52, 30)',
		script: `
			E.SetGuide("barrens"); stub.advance(1)
			local r = { first = E.GetStepView(1).goals[2].status, step = E.GetStepIndex() }
			-- With the quest in the log the turn-in applies again.
			w.accept(50, {}); flush()
			r.withQuest = E.GetStepView(1).goals[2].status
			emit(r)`,
	});
	// The goto is reached on arrival; the leftover turn-in is not applicable,
	// so the guide moves on to step 2.
	assert.equal(out.first, 'na');
	assert.equal(out.step, 2);
	assert.notEqual(out.withQuest, 'na');
});

test('a fresh start at the bottom of a bracket offers the choice; later levels and /polestar path', () => {
	const fresh = run({
		before: 'w.level = 11; w.moveTo(1411, 52, 43)',
		script: `emit({ guide = E.GetGuide().id, log = takeLog() })`,
	})[0];
	// Suggest loads the nearest route; the choice that offered it is asked.
	assert.equal(fresh.guide, 'barrens');
	assert.ok(fresh.log.includes('ROUTE_CHOICE durotar'), fresh.log.join(' | '));

	const later = run({
		before: 'w.level = 15; w.moveTo(1413, 52, 30)',
		script: `
			local r = { guide = E.GetGuide().id, log = takeLog() }
			r.offer = E.OfferRouteChoice()
			r.log2 = takeLog()
			emit(r)`,
	})[0];
	assert.equal(later.guide, 'barrens');
	assert.ok(!later.log.some((l) => l.startsWith('ROUTE_CHOICE')), later.log.join(' | '));
	// The command offers the choice that led here, to change route.
	assert.equal(later.offer, 'durotar');
	assert.deepEqual(later.log2, ['ROUTE_CHOICE durotar']);
});
