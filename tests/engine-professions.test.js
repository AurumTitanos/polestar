'use strict';
// Engine verbs beyond questing (skill, learn, craft, rep, explore, achieve):
// done rules, progress views, event-driven updates, and the manual fallback
// when the client lacks an API. Real Core manifest, stub world.

const { test } = require('node:test');
const assert = require('node:assert/strict');
const { runAddon } = require('./helpers/lua');

const CORE = { name: 'Polestar', files: ['Core/Core.xml'] };

const WORLD = `
local w = stub.world
w.addMap(1429, { name = "Elwynn Forest", c = 0, left = 1500, right = -1500, top = 500, bottom = -1500 })
w.moveTo(1429, 20, 80)
w.addArea(1429, 45, 35, 55, 45, 87)
w.addAchievement(9001, "Legacy: Northshire", { { "Kill wolves", 10 }, { "Find Goldshire", 1 } })
w.addAchievement(9002, "Legacy: Elwynn", { { "A", 1 }, { "B", 1 }, { "C", 1 } })
`;

const GUIDE = `
Polestar.RegisterGuide({
	id = "test/alchemy", title = "Alchemy 1-60", category = "Professions", minLevel = 5, maxLevel = 60,
	steps = {
		{ goals = { { t = "skill", skill = "Alchemy", skillLine = 171, level = 50 } } },
		{ goals = { { t = "learn", spell = 2333, spellName = "Elixir of Lesser Agility", skillLine = 171, npc = 1215, npcName = "Alchemist Mallory" } } },
		{ goals = { { t = "craft", spell = 2330, spellName = "Minor Healing Potion", item = 118, itemName = "Minor Healing Potion", count = 5,
			reagents = { { item = 2447, itemName = "Peacebloom", count = 1 } } } } },
		{ goals = { { t = "craft", spell = 2333, spellName = "Elixir of Lesser Agility", untilSkill = 60, skillLine = 171 } } },
		{ goals = { { t = "rep", faction = 72, factionName = "Stormwind", standing = 6 } } },
		{ goals = { { t = "explore", map = 1429, x = 50, y = 40, text = "Goldshire" } } },
		{ goals = { { t = "achieve", achievement = 9001, achievementName = "Legacy: Northshire", criteria = 2 } } },
		{ goals = { { t = "achieve", achievement = 9002, achievementName = "Legacy: Elwynn" } } },
		{ goals = { { t = "level", level = 99 } } },
	},
})
`;

function run({ before = '', script }) {
	return runAddon({
		stubs: ['stub_world.lua'],
		before: WORLD + before,
		addons: [CORE],
		script: `${GUIDE}
			stub.login()
			E = Polestar.Engine
			E.SetGuide("test/alchemy")
			function flush() stub.advance(0.25) end
			LOG = {}
			Polestar.On("STEP_CHANGED", function(i) LOG[#LOG + 1] = "C" .. tostring(i) end)
			Polestar.On("STEP_UPDATED", function(i) LOG[#LOG + 1] = "U" .. tostring(i) end)
			function goal(i) local v = E.GetStepView(i).goals[1]; return v end
			function brief(g) return { status = g.status, text = g.text, verb = g.verb, subject = g.subject, kind = g.subjectKind,
				detail = g.detail or false, progress = g.progress or false, manual = g.manual } end
			${script}`,
	}).emitted;
}

test('each verb completes from live client state, driven by its events, with progress views', () => {
	const [out] = run({
		script: `
			local w = stub.world
			local r = {}
			local function snap(label) r[label] = { at = E.GetStepIndex(), goal = brief(goal(E.GetStepIndex() or 9)) } end
			snap("start")
			w.learnSkill(171, "Alchemy", 1, 75); flush(); snap("learned")
			w.skillUp(171, 50); flush(); snap("skill")
			w.learnRecipe(2333); flush(); snap("learn")
			w.addItem(118, 3); flush(); snap("craft3")
			w.addItem(118, 2); flush(); snap("craft5")
			w.skillUp(171, 60); flush(); snap("until")
			w.setRep(72, "Stormwind", 5, 1500, 0, 6000); flush(); snap("friendly")
			w.setRep(72, "Stormwind", 6, 0, 0, 12000); flush(); snap("honored")
			w.explore(87); flush(); snap("explored")
			w.criteria(9001, 1, 4); flush(); snap("crit1")
			w.criteria(9001, 2, 1); flush(); snap("crit2")
			w.criteria(9002, 1, 1); flush(); snap("a1")
			w.criteria(9002, 2, 1); w.criteria(9002, 3, 1); flush(); snap("earned")
			r.rep = { standing = E.GetStepView(5).goals[1].standing, standingName = E.GetStepView(5).goals[1].standingName,
				faction = E.GetStepView(5).goals[1].faction }
			r.log = LOG
			emit(r)
		`,
	});
	const g = (label) => out[label].goal;
	assert.equal(out.start.at, 1);
	assert.deepEqual(g('start'), {
		status: 'active', text: 'Raise Alchemy to 50', verb: 'Raise', subject: 'Alchemy', kind: 'skill', detail: 'to 50',
		progress: { cur: 0, max: 50, label: 'Alchemy', kind: 'skill' }, manual: false,
	});
	assert.deepEqual(g('learned').progress, { cur: 1, max: 50, label: 'Alchemy', kind: 'skill' });
	assert.equal(out.skill.at, 2);
	assert.deepEqual(g('skill'), {
		status: 'active', text: 'Learn Elixir of Lesser Agility', verb: 'Learn', subject: 'Elixir of Lesser Agility', kind: 'spell',
		detail: 'from Alchemist Mallory', progress: false, manual: false,
	});
	assert.equal(out.learn.at, 3);
	assert.deepEqual(g('craft3'), {
		status: 'active', text: 'Craft Minor Healing Potion', verb: 'Craft', subject: 'Minor Healing Potion', kind: 'spell',
		detail: false, progress: { cur: 3, max: 5, kind: 'count' }, manual: false,
	});
	assert.equal(out.craft5.at, 4);
	assert.deepEqual(g('craft5'), {
		status: 'active', text: 'Craft Elixir of Lesser Agility', verb: 'Craft', subject: 'Elixir of Lesser Agility', kind: 'spell',
		detail: 'until Alchemy 60', progress: { cur: 50, max: 60, label: 'Alchemy', kind: 'skill' }, manual: false,
	});
	assert.equal(out.until.at, 5);
	assert.deepEqual(g('friendly'), {
		status: 'active', text: 'Reach Honored with Stormwind', verb: 'Reach Honored with', subject: 'Stormwind', kind: 'faction',
		detail: false, progress: { cur: 1500, max: 6000, label: 'Friendly', kind: 'rep' }, manual: false,
	});
	assert.deepEqual(out.rep, { standing: 6, standingName: 'Honored', faction: 72 });
	assert.equal(out.honored.at, 6);
	assert.deepEqual(g('honored'), {
		status: 'active', text: 'Explore Goldshire', verb: 'Explore', subject: 'Goldshire', kind: 'area', detail: 'Elwynn Forest',
		progress: false, manual: false,
	});
	assert.equal(out.explored.at, 7);
	assert.deepEqual(g('explored'), {
		status: 'active', text: 'Complete Legacy: Northshire', verb: 'Complete', subject: 'Legacy: Northshire', kind: 'achievement',
		detail: 'Find Goldshire', progress: { cur: 0, max: 1, kind: 'count' }, manual: false,
	});
	assert.equal(out.crit1.at, 7); // another criterion does not count
	assert.equal(out.crit2.at, 8);
	assert.deepEqual(g('crit2').progress, { cur: 0, max: 3, kind: 'count' });
	assert.deepEqual(g('a1').progress, { cur: 1, max: 3, kind: 'count' });
	assert.equal(out.earned.at, 9);
	assert.deepEqual(out.log, [
		'U1', 'C2', 'C3', 'U3', 'C4', 'C5', 'U5', 'C6', 'C7', 'C8', 'U8', 'C9',
	]);
});

test('a client without an API turns the goal into a manual check-off instead of erroring', () => {
	const [out] = run({
		before: `for _, f in ipairs({ "skill", "spell", "faction", "explore", "achievement" }) do stub.world.unsupport(f) end`,
		script: `
			local w = stub.world
			local manual = {}
			for i = 1, 8 do manual[i] = E.GetStepView(i).goals[1].manual end
			local blocked = {}
			for i = 1, 8 do blocked[i] = goal(i).status end
			w.addItem(118, 5) -- craft by count needs no profession API
			-- Visit each open step: check off manual goals, walk to the explore spot.
			local visits = {}
			while E.GetStepIndex() and E.GetStepIndex() < 9 do
				local at = E.GetStepIndex()
				local gv = goal(at)
				visits[#visits + 1] = at .. ":" .. gv.status .. ":" .. tostring(gv.manual)
				if gv.manual then E.ToggleGoal(at, 1) end
				if at == 6 then w.moveTo(1429, 50, 40); stub.advance(0.6) end
				flush()
				if E.GetStepIndex() == at then break end
			end
			emit({ manual = manual, blocked = blocked, visits = visits, final = E.GetStepIndex(), progress = goal(1).progress or false })
		`,
	});
	assert.deepEqual(out.manual, [true, true, false, true, true, false, true, true]);
	// Before anything happens: only step 1 is current; the rest wait.
	assert.deepEqual(out.blocked, ['active', 'pending', 'pending', 'pending', 'pending', 'pending', 'pending', 'pending']);
	// Craft-by-count (step 3) completes from bags; everything else needed a check-off or arrival.
	assert.deepEqual(out.visits, [
		'1:active:true', '2:active:true', '4:active:true', '5:active:true', '6:active:false', '7:active:true', '8:active:true',
	]);
	assert.equal(out.final, 9);
	assert.equal(out.progress, false);
});

test('explore completes on arrival (polled only while active) and stays done after leaving', () => {
	const [out] = run({
		before: `stub.world.unsupport("explore")`,
		script: `
			local w = stub.world
			E.Goto(6)
			local function tickers()
				local n = 0
				for _, t in ipairs(stub.timers) do if t.handle and not t.cancelled then n = n + 1 end end
				return n
			end
			local before = { at = E.GetStepIndex(), tickers = tickers(), wp = E.GetWaypoint().kind }
			w.moveTo(1429, 50.1, 40.1)
			stub.advance(0.6)
			local arrived = E.GetStepIndex()
			w.moveTo(1429, 20, 80)
			stub.advance(1)
			emit({ before = before, arrived = arrived, after = E.GetStepIndex(), s6 = E.GetStepView(6).status, tickers = tickers(),
				latched = PolestarCharDB.manual["test/alchemy"]["6:1"] })
		`,
	});
	assert.deepEqual(out, {
		before: { at: 6, tickers: 1, wp: 'explore' },
		arrived: 7,
		after: 7,
		s6: 'done',
		tickers: 0,
		latched: true,
	});
});

test('RegisterGuide accepts the new verbs and rejects malformed ones', () => {
	const [out] = runAddon({
		stubs: ['stub_world.lua'],
		addons: [CORE],
		script: `
			local function try(goal)
				local ok, err = Polestar.RegisterGuide({ id = "v", title = "V", steps = { { goals = { goal } } } })
				return ok and "ok" or err
			end
			emit({
				try({ t = "skill", skill = "Mining", level = 75 }),
				try({ t = "skill", skill = "Mining" }),
				try({ t = "learn", spell = 2580, spellName = "Find Minerals" }),
				try({ t = "craft", spell = 2657, spellName = "Smelt Copper", untilSkill = 65, skillLine = 186, reagents = { { item = 2770, itemName = "Copper Ore", count = 1 } } }),
				try({ t = "craft", spell = 2657, spellName = "Smelt Copper", reagents = { { itemName = "Copper Ore" } } }),
				try({ t = "rep", faction = 72, factionName = "Stormwind", standing = 9 }),
				try({ t = "rep", faction = 72, factionName = "Stormwind", standing = 8 }),
				try({ t = "explore", map = 1429, x = 42, y = 64, text = "Goldshire" }),
				try({ t = "explore", map = 1429, text = "Goldshire" }),
				try({ t = "achieve", achievement = 9001, achievementName = "Legacy", criteria = 2 }),
				try({ t = "achieve", achievement = 9001 }),
			})
		`,
	}).emitted;
	assert.deepEqual(out, [
		'ok',
		'step 1 goal 1: skill needs level',
		'ok',
		'ok',
		'step 1 goal 1: bad reagent 1',
		'step 1 goal 1: standing outside 1-8',
		'ok',
		'ok',
		'step 1 goal 1: explore needs x',
		'ok',
		'step 1 goal 1: achieve needs achievementName',
	]);
});

test('Suggest only picks leveling guides; other categories are left to the player', () => {
	const [out] = runAddon({
		stubs: ['stub_world.lua'],
		addons: [CORE],
		script: `
			local function g(id, cat) Polestar.RegisterGuide({ id = id, title = id, category = cat, minLevel = 1, maxLevel = 60,
				steps = { { goals = { { t = "level", level = 60 } } } } }) end
			g("prof", "Professions"); g("legacy", "Legacy")
			local none = Polestar.Guides.Suggest()
			g("lvl", nil)
			emit({ none = none or false, pick = Polestar.Guides.Suggest() })
		`,
	}).emitted;
	assert.deepEqual(out, { none: false, pick: 'lvl' });
});
