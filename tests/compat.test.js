'use strict';
// Compat (addon/Polestar/Core/Compat.lua): map frames and world coordinates,
// quest objective normalization, NPC IDs, player info, against the stub world.

const { test } = require('node:test');
const assert = require('node:assert/strict');
const { runAddon } = require('./helpers/lua');

const CORE = { name: 'Polestar', files: ['Core/Core.xml'] };

function run(script, before = '') {
	return runAddon({
		stubs: ['stub_world.lua'],
		before: `w = stub.world
w.addMap(1429, { name = "Elwynn Forest", c = 0, left = 1500, right = -1500, top = 500, bottom = -1500 })
w.addMap(1411, { name = "Durotar", c = 1, left = 0, right = -3000, top = 0, bottom = -3000 })
${before}`,
		addons: [CORE],
		script: `C = Polestar.Compat\n${script}`,
	}).emitted;
}

const round = (list) => list.map((v) => (typeof v === 'number' ? Math.round(v * 1000) / 1000 : v));

test('MapToWorld uses registered Era bounds for frame "e" and the live client otherwise', () => {
	const [out] = run(`
		Polestar.RegisterMapFrames({ era = { [1429] = { c = 0, left = 1600, right = -1400, top = 600, bottom = -1400 } } })
		emit({ { C.MapToWorld(1429, 50, 50, "e") }, { C.MapToWorld(1429, 50, 50) }, { C.MapToWorld(9998, 50, 50, "e") },
			{ C.MapToWorld(9999, 50, 50) } })
	`);
	assert.deepEqual(round(out[0]), [0, -400, 100]);
	assert.deepEqual(round(out[1]), [0, -500, 0]);
	assert.deepEqual(out[2], {}); // no Era bounds registered for that map: nothing returned (Lua encodes an empty list as {})
	assert.deepEqual(out[3], {});
});

test('an Era point converts back to the live map percent with WorldToMap, with or without GetMapPosFromWorldPos', () => {
	const script = `
		Polestar.RegisterMapFrames({ era = { [1429] = { c = 0, left = 1600, right = -1400, top = 600, bottom = -1400 } } })
		local c, wx, wy = C.MapToWorld(1429, 50, 50, "e")
		emit({ { C.WorldToMap(c, wx, wy, 1429) }, { C.WorldToMap(1, wx, wy, 1429) } })
	`;
	const [withApi] = run(script);
	const [fallback] = run(script, 'C_Map.GetMapPosFromWorldPos = nil');
	for (const out of [withApi, fallback]) {
		assert.deepEqual(round(out[0]), [46.667, 45]);
		assert.deepEqual(out[1], {});
	}
});

test('player positions: map percent, world position, nil in instances', () => {
	const [out] = run(`
		w.moveTo(1429, 25, 75)
		local a = { C.GetPlayerMapPosition() }
		local b = { C.GetPlayerWorldPosition() }
		w.inInstance = true
		emit({ a, b, { C.GetPlayerMapPosition() }, { C.GetPlayerWorldPosition() }, C.IsInInstance(), C.GetPlayerFacing() == nil })
	`);
	assert.deepEqual(round(out[0]), [1429, 25, 75]);
	assert.deepEqual(round(out[1]), [0, -1000, 750]);
	assert.deepEqual(out[2], {});
	assert.deepEqual(out[3], {});
	assert.equal(out[4], true);
	assert.equal(out[5], true);
});

test('quest objectives normalize to text/type/finished/numFulfilled/numRequired', () => {
	const [out] = run(`
		C_QuestLog.GetQuestObjectives = function(q)
			if q == 1 then
				return {
					{ text = "Kobold Vermin slain: 3/10", type = "monster", finished = false, numFulfilled = 3, numRequired = 10, objectiveType = 0 },
					{ text = "Explore the mine", type = "event", finished = true, numFulfilled = 0, numRequired = 0 },
				}
			end
			return {}
		end
		C_QuestLog.IsOnQuest = function(q) return q == 1 end
		C_QuestLog.ReadyForTurnIn = function() return nil end
		C_QuestLog.IsComplete = function() return false end
		emit({ objs = C.GetQuestObjectives(1), none = C.GetQuestObjectives(2) == nil, ready = C.IsQuestReadyForTurnIn(1) })
	`);
	assert.deepEqual(out, {
		objs: [
			{ text: 'Kobold Vermin slain: 3/10', type: 'monster', finished: false, numFulfilled: 3, numRequired: 10 },
			{ text: 'Explore the mine', type: 'event', finished: true, numFulfilled: 1, numRequired: 1 },
		],
		none: true,
		ready: false,
	});
});

test('GetNpcID parses creature and object GUIDs and ignores players', () => {
	const [out] = run(`
		w.units.npc = "Creature-0-4372-0-17-197-00001A2B3C"
		w.units.target = "GameObject-0-4372-0-17-1617-00001A2B3C"
		w.units.focus = "Player-1-0000ABCD"
		emit({ C.GetNpcID("npc"), C.GetNpcID("target"), C.GetNpcID("focus") or false, C.GetNpcID("mouseover") or false })
	`);
	assert.deepEqual(out, [197, 1617, false, false]);
});

test('player info, zone text, bind location, taxi and items come from the client', () => {
	const [out] = run(`
		w.race, w.class, w.faction, w.level = "Scourge", "WARLOCK", "Horde", 7
		w.zone, w.subzone = "Tirisfal Glades", ""
		w.bindLocation = ""
		w.items[159] = 4
		w.taxiNodes = { { name = "Undercity, Tirisfal", type = "REACHABLE" }, { name = "The Sepulcher, Silverpine Forest", type = "CURRENT" } }
		local info = C.GetPlayerInfo()
		emit({ race = info.race, class = info.class, faction = info.faction, level = info.level, name = info.name,
			zone = { C.GetZoneText() }, bind = C.GetBindLocation() == nil, items = C.GetItemCount(159), none = C.GetItemCount(1),
			node = C.GetCurrentTaxiNode(), taxi = C.IsOnTaxi() })
	`);
	assert.deepEqual(out, {
		race: 'Scourge',
		class: 'WARLOCK',
		faction: 'Horde',
		level: 7,
		name: 'Testchar',
		zone: ['Tirisfal Glades'],
		bind: true,
		items: 4,
		none: 0,
		node: 'The Sepulcher, Silverpine Forest',
		taxi: false,
	});
});

test('skill ranks by line or name, from C_SkillInfo or the profession list; unlearned is nil', () => {
	const [out] = run(`
		w.learnSkill(171, "Alchemy", 42, 75)
		w.learnSkill(129, "First Aid", 10, 75)
		local a = { { C.GetSkillRank(171) }, { C.GetSkillRank("alchemy") }, { C.GetSkillRank("First Aid") }, { C.GetSkillRank(186) },
			{ C.GetSkillRank("Mining") } }
		-- A client with only the older profession API.
		C_SkillInfo = nil
		GetProfessions = function() return 3, nil, 1 end
		GetProfessionInfo = function(i)
			if i == 3 then return "Herbalism", 0, 30, 75, 2, 0, 182 end
			if i == 1 then return "First Aid", 0, 10, 75, 1, 0, 129 end
		end
		emit({ a = a, herb = { C.GetSkillRank("Herbalism") }, herbID = { C.GetSkillRank(182) }, aid = { C.GetSkillRank(129) },
			supported = C.Supports("skill") })
	`);
	assert.deepEqual(out.a, [[42, 75], [42, 75], [10, 75], {}, {}]);
	assert.deepEqual(out.herb, [30, 75]);
	assert.deepEqual(out.herbID, [30, 75]);
	assert.deepEqual(out.aid, [10, 75]);
	assert.equal(out.supported, true);
});

test('spells count as known from the spellbook or as learned recipes', () => {
	const [out] = run(`
		w.learnSpell(2580)
		w.recipes[2330] = true
		w.recipes[2333] = false
		emit({ C.IsSpellKnown(2580), C.IsSpellKnown(2330), C.IsSpellKnown(2333), C.IsSpellKnown(1) })
	`);
	assert.deepEqual(out, [true, true, false, false]);
});

test('item and spell links come from the cache; an uncached item or spell is requested', () => {
	const [out] = run(`
		local cached, asked = { [20536] = true }, {}
		C_Item = {
			IsItemDataCachedByID = function(id) return cached[id] == true end,
			RequestLoadItemDataByID = function(id) asked[#asked + 1] = "item " .. id end,
			GetItemInfo = function(id) if cached[id] then return "Soul Harvester", "|Hitem:" .. id .. "|h[Soul Harvester]|h" end end,
		}
		C_Spell = {
			IsSpellDataCached = function(id) return id == 23161 end,
			RequestLoadSpellData = function(id) asked[#asked + 1] = "spell " .. id end,
			GetSpellLink = function(id) return "|Hspell:" .. id .. "|h[Summon Felhunter]|h" end,
		}
		emit({ C.ItemLink(20536), C.ItemLink(20534) == nil, C.RequestItem(20536), C.RequestItem(20534),
			C.SpellLink(691), C.RequestSpell(23161), C.RequestSpell(691), asked })
	`);
	assert.deepEqual(out, ['|Hitem:20536|h[Soul Harvester]|h', true, true, false, '|Hspell:691|h[Summon Felhunter]|h', true, false, ['item 20534', 'spell 691']]);
});

test('faction standing, area exploration and achievements read the client', () => {
	const [out] = run(`
		w.setRep(72, "Stormwind", 6, 4500, 3000, 9000)
		w.addArea(1429, 40, 60, 50, 70, 87)
		w.explore(87)
		w.addAchievement(9001, "Legacy: Northshire", { { "Kill wolves", 10 }, { "Explore", 0 } })
		w.criteria(9001, 1, 4)
		w.achievements[9001].criteria[2].completed = true -- event criterion: 0/0, completed
		emit({ rep = { C.GetFactionStanding(72) }, unknown = { C.GetFactionStanding(1) },
			inside = C.IsAreaExploredAt(1429, 42, 64), outside = C.IsAreaExploredAt(1429, 20, 20),
			ach = C.GetAchievement(9001), none = C.GetAchievement(1) == nil })
	`);
	assert.deepEqual(out.rep, [6, 4500, 3000, 9000, 'Stormwind']);
	assert.deepEqual(out.unknown, {});
	assert.equal(out.inside, true);
	assert.equal(out.outside, false);
	assert.deepEqual(out.ach, {
		completed: false,
		name: 'Legacy: Northshire',
		criteria: [
			{ text: 'Kill wolves', completed: false, cur: 4, max: 10 },
			{ text: 'Explore', completed: true, cur: 1, max: 1 },
		],
	});
	assert.equal(out.none, true);
});

test('without the client APIs the new functions return nil and Supports says so', () => {
	const [out] = run(`
		for _, f in ipairs({ "skill", "spell", "faction", "explore", "achievement" }) do w.unsupport(f) end
		emit({ skill = C.GetSkillRank("Alchemy") == nil, spell = C.IsSpellKnown(2580), rep = C.GetFactionStanding(72) == nil,
			area = C.IsAreaExploredAt(1429, 50, 50) == nil, ach = C.GetAchievement(9001) == nil,
			supports = { C.Supports("skill"), C.Supports("spell"), C.Supports("faction"), C.Supports("explore"), C.Supports("achievement") } })
	`);
	assert.deepEqual(out, {
		skill: true, spell: false, rep: true, area: true, ach: true, supports: [false, false, false, false, false],
	});
});

test('secret unit values read as unknown instead of throwing', () => {
	const [out] = run(`
		-- Secret values throw when compared or parsed, as in the client.
		local SECRET = setmetatable({}, { __eq = function() error("secret compared") end,
			__index = function() error("secret indexed") end, __tostring = function() return "secret" end })
		function issecretvalue(v) return rawequal(v, SECRET) or (type(v) == "string" and v:find("^Secret") ~= nil) end
		w.units.npc = "Secret-Creature-0-4372-0-17-197-0001"
		w.units.target = "Creature-0-4372-0-17-197-00001A2B3C"
		w.faction = SECRET
		local info = C.GetPlayerInfo()
		emit({ npc = C.GetNpcID("npc") or false, target = C.GetNpcID("target"), faction = info.faction, race = info.race })
	`);
	assert.deepEqual(out, { npc: false, target: 197, faction: 'Neutral', race: 'Human' });
});
