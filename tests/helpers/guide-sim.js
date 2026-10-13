'use strict';
// The guide simulator shared by tests that play a guide to the end in the real
// engine (tests/guides.test.js for authored guides, tests/lookup-guides.test.js
// for guides Lookup builds on the spot, tests/perf.test.js for budgets).
//
//   const { SIMULATE, luaValue } = require('./helpers/guide-sim');
//   runAddon({ stubs: ['stub_world.lua'], addons: ['Polestar'],
//     script: `...load the guide...; Polestar.Engine.SetGuide(id); stub.advance(0.6); ${SIMULATE}` })
//
// SIMULATE plays the active guide against stub_world.lua: at each step the
// simulated player completes the first open goal the way a player would
// (accept, kill, loot, walk there, talk, train, bind, level up...), and emits
// { done, stuck, visited, steps, missing, wrongPick, level }: `missing` lists
// accept/turn-in goals without a location, `wrongPick` candidate goals that
// picked an NPC the character may not use.
//
//   const pack = buildSimPack(['forever/professions/mining.guide']);  // compiled + written to a temp dir
//   const [out] = playGuide(pack, guide, { race: 'Orc', faction: 'Horde', cls: 'WARRIOR' });
//   pack.dispose();
//
// buildSimPack compiles guide files (relative to guides/, or { file, text })
// with the reference data and writes the pack; playGuide runs one persona
// through it (`stubs`, `before` and `script` add to the run: `script` replaces
// SIMULATE when given, after SetGuide). luaValue(v) renders a JSON value as a
// Lua literal.

const fs = require('node:fs');
const { tmpdir } = require('./tmp');
const path = require('node:path');
const { runAddon, ROOT } = require('./lua');

const GUIDES = path.join(ROOT, 'guides');
const DATA = path.join(ROOT, 'data', 'forever');

function luaValue(v) {
	if (v === null || v === undefined) return 'nil';
	if (typeof v === 'number' || typeof v === 'boolean') return String(v);
	if (typeof v === 'string') return JSON.stringify(v);
	if (Array.isArray(v)) return `{ ${v.map(luaValue).join(', ')} }`;
	return `{ ${Object.entries(v).map(([k, x]) => `[${/^\d+$/.test(k) ? k : JSON.stringify(k)}] = ${luaValue(x)}`).join(', ')} }`;
}

// Where each race starts (Era frame): non-leveling guides begin there instead
// of at their first waypoint, the way a player opens them.
const HOME = {
	Human: [1429, 48.2, 42.0], Dwarf: [1426, 29.9, 71.2], Gnome: [1426, 29.9, 71.2], NightElf: [1438, 58.6, 44.4],
	Orc: [1411, 43.3, 68.5], Troll: [1411, 43.3, 68.5], Tauren: [1412, 44.2, 76.1], Scourge: [1420, 32.5, 63.2],
	Skyborne: [2521, 42.8, 23.4], // Zephras Isle has no Era frame: live coordinates
};

function buildSimPack(files, data) {
	const { compileSources, buildPackFiles, packMeta } = require('../../tools/lib/dsl/project');
	const { loadData } = require('../../tools/lib/dsl/data');
	data = data || loadData(DATA);
	const sources = files.map((f) => (typeof f === 'string'
		? { file: path.join('guides', f), source: f, text: fs.readFileSync(path.join(GUIDES, f), 'utf8') }
		: { file: f.file, source: f.file, text: f.text }));
	const { guides, diag } = compileSources(sources, data);
	const pack = buildPackFiles({ guides, meta: packMeta('0.0.0-sim'), data });
	const dir = tmpdir('polestar-sim-');
	for (const [rel, content] of Object.entries(pack)) {
		fs.mkdirSync(path.dirname(path.join(dir, rel)), { recursive: true });
		fs.writeFileSync(path.join(dir, rel), content);
	}
	const loads = [...pack['Pack.xml'].matchAll(/<Script file="([^"]+)"/g)]
		.map((m) => `dofile(${JSON.stringify(path.join(dir, m[1].replace(/\\/g, '/')))})`)
		.join('\n');
	// Era frames where a map has one (goals there are written in Era
	// coordinates); Forever-only maps such as Zephras Isle use their Forever frame.
	const frameTables = JSON.parse(fs.readFileSync(path.join(DATA, 'map-frames.json'), 'utf8'));
	const frames = { ...(frameTables.forever || {}), ...frameTables.era };
	const zones = JSON.parse(fs.readFileSync(path.join(DATA, 'zones.json'), 'utf8'));
	const maps = Object.entries(frames)
		.map(([id, f]) => `w.addMap(${id}, { name = ${JSON.stringify((zones[id] && zones[id].name) || '')}, c = ${f.c}, left = ${f.left}, right = ${f.right}, top = ${f.top}, bottom = ${f.bottom} })`)
		.join('\n');
	return { guides, diag, loads, maps, dir, dispose: () => fs.rmSync(dir, { recursive: true, force: true }) };
}

// Plays guide `g` from `pack` as one persona; returns runAddon's emitted values.
function playGuide(pack, g, { race, faction, cls, stubs = [], before = '', script = null }) {
	const raceName = race === 'Scourge' ? 'Undead' : race;
	const first = g.steps.flatMap((s) => s.goals).find((x) => x.map && x.x != null);
	const home = g.category && g.category !== 'Leveling' ? HOME[race] : null;
	const start = home ? { map: home[0], x: home[1], y: home[2] } : first;
	return runAddon({
		stubs: ['stub_world.lua', ...stubs],
		before: `
			local w = stub.world
			${pack.maps}
			w.race, w.raceName = ${JSON.stringify(race)}, ${JSON.stringify(raceName)}
			w.class, w.className = ${JSON.stringify(cls)}, ${JSON.stringify(cls)}
			w.faction = ${JSON.stringify(faction)}
			w.level = ${g.minLevel || 1}
			${start ? `w.moveTo(${start.map}, ${start.x}, ${start.y})` : ''}
			${before}`,
		addons: ['Polestar'],
		script: `
			${pack.loads}
			stub.login()
			stub.fire("QUEST_LOG_UPDATE") -- the client fills the quest log right after login
			Polestar.Set("behavior.autoNextGuide", false)
			Polestar.Engine.SetGuide(${luaValue(g.id)})
			stub.advance(0.6)
			${script == null ? SIMULATE : script}`,
	}).emitted;
}

const SIMULATE = `
local E, w = Polestar.Engine, stub.world
local G = E.GetGuide()
local objs = {}
for _, s in ipairs(G.steps) do
	for _, g in ipairs(s.goals) do
		if g.quest and g.oi then
			objs[g.quest] = objs[g.quest] or {}
			objs[g.quest][g.oi] = math.max(objs[g.quest][g.oi] or 1, g.count or 1)
		end
	end
end
local function objectivesFor(q)
	local list, o, n = {}, objs[q], 0
	if o then for i in pairs(o) do if i > n then n = i end end end
	for i = 1, n do list[i] = { required = o[i] or 1 } end
	return list
end
local function ensureSkill(r, line)
	if not w.skills[line] then w.learnSkill(line, r.skill or tostring(line), 1, 300) end
end
-- A goal with candidates must have picked one the character may use: the
-- player's faction (or both) and, when listed, race and class. NPC candidates
-- are matched by npc; farm spots (no npc) by the chosen position.
local wrongPick = {}
local function checkPick(i, g, r)
	if not r.candidates then return end
	local tag = w.faction == "Horde" and "H" or "A"
	local function bad(why) wrongPick[#wrongPick + 1] = ("step %d goal %d (%s): %s"):format(i, g.index, r.t, why) end
	if not (g.npc or g.map) then return bad("no usable candidate for " .. w.faction) end
	local function picked(c)
		if c.npc then return c.npc == g.npc end
		return c.map == g.map and c.x == g.x and c.y == g.y
	end
	for _, c in ipairs(r.candidates) do
		if picked(c) then
			if not (c.faction or "AH"):find(tag, 1, true) then
				bad(("picked %s (%s) for %s"):format(tostring(c.npcName), tostring(c.faction), w.faction))
			end
			return
		end
	end
	bad(("picked %s, which is not a candidate"):format(g.npc and ("npc " .. g.npc) or (tostring(g.map) .. " " .. tostring(g.x) .. "," .. tostring(g.y))))
end
local function act(i, g, r)
	local t, q = g.t, g.quest
	if t == "accept" then
		if not w.log[q] and not w.completed[q] then w.accept(q, objectivesFor(q), g.subject) end
	elseif t == "turnin" then
		if w.log[q] then w.finish(q) end
		w.turnIn(q)
	elseif t == "complete" then
		if w.log[q] then w.finish(q) end
	elseif q and g.oi and (t == "kill" or t == "collect" or t == "use" or t == "interact") then
		if w.log[q] then
			local o = w.log[q].objectives[g.oi]
			if o then w.progress(q, g.oi, o.numRequired) else w.finish(q) end
		end
	elseif q and (t == "kill" or t == "collect" or t == "use" or t == "interact") then
		if w.log[q] then w.finish(q) end
	elseif (t == "collect" or t == "buy") and g.item then
		w.addItem(g.item, (g.progress and g.progress.max) or 1)
	elseif t == "goto" then
		w.moveTo(g.map, g.x, g.y)
	elseif t == "talk" then
		w.gossip(g.npc); w.close()
	elseif t == "train" then
		if r.skillLine and r.rank then
			-- A profession rank: the trainer raises the skill's cap.
			local cap = r.rankMax or ({ 75, 150, 225, 300 })[r.rank]
			local s = w.skills[r.skillLine]
			if s then
				w.skillUp(r.skillLine, s.rank, math.max(cap, s.maxRank or 0))
			else
				w.learnSkill(r.skillLine, r.skill or tostring(r.skillLine), 1, cap)
			end
		end
		w.trainer(g.npc or 1); w.close()
	elseif t == "vendor" then
		w.merchant(g.npc or 1); w.close()
	elseif t == "sethome" then
		w.bind(g.subject or g.npcName or "Inn")
	elseif t == "hearth" or t == "fly" then
		w.setZone(g.subject, g.subject)
	elseif t == "level" then
		w.setLevel(math.max(w.level, tonumber((g.subject or ""):match("%d+")) or (w.level + 1)))
	elseif t == "skill" then
		local line = r.skillLine or r.skill
		ensureSkill(r, line)
		w.skillUp(line, r.level, math.max(r.level, w.skills[line].maxRank or 0))
	elseif t == "learn" then
		w.learnSpell(r.spell)
		w.learnRecipe(r.spell)
	elseif t == "craft" then
		if r.untilSkill then
			local line = r.skillLine or r.skill
			ensureSkill(r, line)
			w.skillUp(line, r.untilSkill, math.max(r.untilSkill, w.skills[line].maxRank or 0))
		elseif r.item then
			w.addItem(r.item, r.count or 1)
		end
	elseif t == "rep" then
		w.setRep(r.faction, r.factionName or tostring(r.faction), r.standing, 0, 0, 3000)
	elseif t == "explore" then
		local id = 900000 + i * 100 + g.index
		w.addArea(r.map, r.x - 1, r.y - 1, r.x + 1, r.y + 1, id)
		w.moveTo(r.map, r.x, r.y)
		w.explore(id)
	elseif t == "achieve" then
		local a = w.achievements[r.achievement]
		if not a then
			w.addAchievement(r.achievement, r.achievementName, { { "criterion", 1 } })
			a = w.achievements[r.achievement]
		end
		for ci, c in ipairs(a.criteria) do
			if not r.criteria or r.criteria == ci then w.criteria(r.achievement, ci, c.max) end
		end
	end
	stub.advance(0.6)
end
local visited, stuck, guard = {}, nil, 0
while guard < 4000 do
	guard = guard + 1
	local i = E.GetStepIndex()
	if not i or E.GetGuide() ~= G then break end
	visited[i] = true
	local view = E.GetStepView(i)
	local open
	for _, g in ipairs(view.goals) do
		if g.status ~= "done" and g.status ~= "na" and not g.optional and g.t ~= "note" then open = g; break end
	end
	if not open then
		stub.advance(0.6)
		if E.GetStepIndex() == i then stuck = { step = i, title = view.title, why = "no open goal but the step did not advance" }; break end
	else
		checkPick(i, open, G.steps[i].goals[open.index])
		act(i, open, G.steps[i].goals[open.index])
		local after = E.GetStepView(i)
		local same = E.GetStepIndex() == i and after.goals[open.index].status ~= "done"
		if same and open.manual then
			E.ToggleGoal(i, open.index)
			stub.advance(0.6)
			same = E.GetStepIndex() == i and E.GetStepView(i).goals[open.index].status ~= "done"
		end
		if same then
			stuck = { step = i, title = view.title, goal = open.index, t = open.t, text = open.text, status = after.goals[open.index].status }
			break
		end
	end
end
local missing = {}
for si, s in ipairs(G.steps) do
	for gi, g in ipairs(s.goals) do
		if (g.t == "accept" and not g.item or g.t == "turnin") and not (g.map and g.x and g.y) then
			missing[#missing + 1] = ("step %d goal %d: %s %s"):format(si, gi, g.t, tostring(g.title or g.quest))
		end
	end
end
local count = 0
for _ in pairs(visited) do count = count + 1 end
emit({ done = E.GetStepIndex() == nil or E.GetGuide() ~= G, stuck = stuck, visited = count, steps = #G.steps, missing = missing, wrongPick = wrongPick, level = w.level })
`;

module.exports = { SIMULATE, luaValue, buildSimPack, playGuide, HOME };
