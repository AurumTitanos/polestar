-- Polestar.Lookup guides: open the curated guide that collects an item, or
-- build one on the spot from a ranked source, in the same guide table shape
-- the Engine runs for compiled guides (docs/ARCHITECTURE.md, "Guide data").
--
--   Lookup.CuratedGuide(kind, id) -> guideId | nil
--       a registered guide whose `collects` holds the item (kind "spell": the
--       spell's item, else a guide with the spell's name among its
--       `keywords`, as the class mount guides have); one that fits the
--       character first
--   Lookup.BuildGuide(kind, id, ranked) -> def | nil, reason
--       ranked: a row of Lookup.Sources(kind, id), its index, or nil (best)
--   Lookup.Guide(kind, id, index) -> guideId | nil, reason
--       curated when one collects it (index nil), else built from source
--       `index` (default: the best available guideable one), registered
--       unsaved (pack "lookup", category "Lookup", id "lookup/<kind>/<id>")
--       and opened in a tab
--   Lookup.Show(query, kind, id)   -- fires SHOW_LOOKUP(query, kind, id) for the UI
--   Lookup.RegisterPlanner(kind, build)
--       another module's guide kind: build(id) -> def | nil, reason, where def
--       holds title and steps (the rest as above); Lookup.BuildGuide and
--       Lookup.Guide then build `kind` with it, whatever lookup.enabled says
--       (the module gates itself), and its saved tabs come back after /reload.
--       Dungeons' "pickup" kind is one (Dungeons/Pickup.lua).
--   Lookup.QuestChain(questId, player) -> { quest, ... }, truncated
--       the quest after its open prerequisites, in the order they are done
--   Lookup.QuestStep(quest, from) -> step   -- accept, objectives, turn-in
--
-- Generated guides are not saved. A tab holding one survives /reload: at
-- ADDON_LOADED (before the Engine reopens saved tabs at login) every saved
-- "lookup/..." tab id is rebuilt from the Codex and registered again.
--
-- Alt-click on an item link, bag item or loot item (Hooks.ItemClick) opens
-- its guide, or the Lookup window when no source can be guided.

local ADDON, ns = ...

local Lookup = ns.Lookup
local L = ns.L

local type, pairs, ipairs, tostring, tonumber = type, pairs, ipairs, tostring, tonumber
local lower, find, format = string.lower, string.find, string.format

local planners = {} -- kind -> build(id): guide kinds other modules build

local ITEM_KINDS = Lookup.ITEM_KINDS
local PREFIX = "lookup/"
local MAX_CHAIN, MAX_DEPTH = 12, 8

local function Codex() return ns.Codex end

local function enabled() return ns.Get("lookup.enabled") and true or false end

function Lookup.GuideId(kind, id)
	return PREFIX .. tostring(kind) .. "/" .. tostring(id)
end

function Lookup.RegisterPlanner(kind, build)
	if type(kind) == "string" and kind:match("^%a+$") and type(build) == "function" then planners[kind] = build end
end

-- "lookup/<kind>/<id>" -> kind, id (number when numeric) | nil
function Lookup.ParseGuideId(guideId)
	if type(guideId) ~= "string" then return nil end
	local kind, id = guideId:match("^lookup/([%a]+)/(.+)$")
	if not kind then return nil end
	return kind, tonumber(id) or id
end

function Lookup.Show(query, kind, id)
	if not enabled() then
		ns.Print(L["Lookup is turned off (Options > Discovery > Lookup)."])
		return
	end
	ns.Fire("SHOW_LOOKUP", query, kind, id)
end

---------------------------------------------------------------------------
-- Curated guides
---------------------------------------------------------------------------

local function holds(list, value)
	if type(list) ~= "table" then return false end
	for i = 1, #list do
		if list[i] == value then return true end
	end
	return false
end

local function keywordMatch(list, name)
	if type(list) ~= "table" or type(name) ~= "string" or name == "" then return false end
	local want = lower(name)
	for i = 1, #list do
		local k = list[i]
		if type(k) == "string" and find(lower(k), want, 1, true) then return true end
	end
	return false
end

function Lookup.CuratedGuide(kind, id)
	local itemId, spellName
	if ITEM_KINDS[kind] then
		itemId = tonumber(id)
	elseif kind == "spell" then
		local C = Codex()
		local spell = C and C.Spell(id)
		if not spell then return nil end
		itemId, spellName = spell.item, spell.name
	else
		return nil
	end
	local player = ns.Compat.GetPlayerInfo()
	local fallback
	for _, h in ipairs(ns.Guides.List()) do
		if type(h.id) == "string" and h.id:sub(1, #PREFIX) ~= PREFIX
			and ((itemId and holds(h.collects, itemId)) or (spellName and keywordMatch(h.keywords, spellName))) then
			if ns.Guides.GuideMatches(h, player) then return h.id end
			fallback = fallback or h.id
		end
	end
	return fallback
end

---------------------------------------------------------------------------
-- Building
---------------------------------------------------------------------------

local function at(goal, p)
	if p and p.map and p.x and p.y then
		goal.map, goal.x, goal.y, goal.f = p.map, p.x, p.y, p.f
	end
	return goal
end

local function located(p)
	return p ~= nil and p.map ~= nil and p.x ~= nil and p.y ~= nil
end

local function itemName(id)
	local C = Codex()
	return (C.Name("item", id)) or (L["Item"] .. " " .. id)
end

local function npcName(id)
	local C = Codex()
	return (C.Name("npc", id)) or (L["NPC"] .. " " .. id)
end

local function percent(n)
	return format("%.3g%%", n)
end

-- Where to collect a quest item: the nearest spawn of its best drop or object source.
local function itemSpot(itemId, from)
	local C = Codex()
	local item = C.Item(itemId)
	if not item then return nil end
	local best, bestChance
	for _, src in ipairs(item.sources or {}) do
		local spawns
		if src.type == "drop" and src.npc then
			local npc = C.Npc(src.npc)
			spawns = npc and npc.spawns
		elseif src.type == "object" and src.object then
			local obj = C.Object(src.object)
			spawns = obj and obj.spawns
		end
		if spawns and #spawns > 0 then
			local chance = src.chance or 0
			if not best or chance > bestChance then
				best, bestChance = Lookup.Nearest(spawns, from), chance
			end
		end
	end
	return best
end

-- Quests to do in order to get questId, prerequisites first: every one of
-- `pre`, and of `preAny` (unless one is done) the first this character can
-- take. Done prerequisites are left out; the chain is bounded.
local function questChain(questId, player)
	local C = Codex()
	local order, seen, truncated = {}, {}, false
	local function visit(qid, depth)
		if seen[qid] then return end
		if depth > MAX_DEPTH or #order >= MAX_CHAIN then truncated = true; return end
		seen[qid] = true
		local q = C.Quest(qid)
		if not q then return end
		if depth > 0 and ns.Compat.IsQuestCompleted(qid) then return end
		for _, pid in ipairs(q.pre or {}) do visit(pid, depth + 1) end
		local any = q.preAny or {}
		if #any > 0 then
			local done = false
			for _, pid in ipairs(any) do
				if ns.Compat.IsQuestCompleted(pid) then done = true; break end
			end
			if not done then
				for _, pid in ipairs(any) do
					local pq = C.Quest(pid)
					if pq and not Lookup.QuestBlock(pq, player) then
						visit(pid, depth + 1)
						break
					end
				end
			end
		end
		order[#order + 1] = q
	end
	visit(questId, 0)
	return order, truncated
end

local function endGoal(t, q, e)
	local g = { t = t, quest = q.id, title = q.title }
	if e.npc then
		g.npc, g.npcName = e.npc, e.name
	else
		g.object, g.objName = e.object, e.name
	end
	return at(g, e.spawn)
end

-- One step per quest: accept, objectives, turn-in. -> step | nil, reason
local function questStep(q, from, isTarget)
	local C = Codex()
	local giver = Lookup.QuestEnd(q.start, from)
	local startItem = q.start and q.start.item and q.start.item[1]
	local finish = Lookup.QuestEnd(q["end"], giver and giver.spawn or from)
	if not finish or not (giver or startItem) then
		if isTarget then return nil, "nolocation" end
		return { title = q.title, goals = { { t = "note", text = L["First do the quest"] .. " " .. q.title } } }
	end
	local goals = {}
	local accept
	if giver then
		accept = endGoal("accept", q, giver)
	else
		accept = { t = "accept", quest = q.id, title = q.title, item = startItem, itemName = itemName(startItem) }
	end
	accept.minLevel = q.minLevel
	goals[1] = accept
	local here = giver and giver.spawn or from
	local event = nil
	for oi, o in ipairs(q.objectives or {}) do
		local count = o.count or 1
		if o.type == "kill" and o.id then
			local npc = C.Npc(o.id)
			local s = npc and Lookup.Nearest(npc.spawns, here)
			goals[#goals + 1] = at({ t = "kill", target = (npc and npc.name) or o.text or npcName(o.id), npc = o.id,
				quest = q.id, oi = oi, count = count, title = q.title }, s)
		elseif o.type == "item" and o.id then
			goals[#goals + 1] = at({ t = "collect", item = o.id, itemName = (C.Name("item", o.id)) or o.text or itemName(o.id),
				quest = q.id, oi = oi, count = count, title = q.title }, itemSpot(o.id, here))
		elseif o.type == "object" and o.id then
			local obj = C.Object(o.id)
			local s = obj and Lookup.Nearest(obj.spawns, here)
			goals[#goals + 1] = at({ t = "interact", object = o.id, objName = (obj and obj.name) or o.text or (L["Object"] .. " " .. o.id),
				quest = q.id, oi = oi, count = count, title = q.title }, s)
		else
			event = event or o
		end
	end
	if event then
		goals[#goals + 1] = { t = "complete", quest = q.id, title = q.title, text = event.text }
	end
	goals[#goals + 1] = endGoal("turnin", q, finish)
	return { title = q.title, goals = goals }
end

-- Steps for a quest and its unfinished prerequisites. -> steps | nil, reason
local function questSteps(questId, player, from)
	local C = Codex()
	if not C.Quest(questId) then return nil, "unknown" end
	local chain, truncated = questChain(questId, player)
	local steps = {}
	for i, q in ipairs(chain) do
		local step, err = questStep(q, from, q.id == questId)
		if not step then return nil, err end
		steps[#steps + 1] = step
	end
	if truncated and steps[1] then
		steps[1].note = L["Earlier quests of this chain are not listed."]
	end
	return steps
end
Lookup.QuestChain = questChain
Lookup.QuestStep = function(q, from) return questStep(q, from, false) end

local RANK_CAPS = { 75, 150, 225, 300 }

local function rankFor(skill)
	for i = 1, #RANK_CAPS do
		if (skill or 1) <= RANK_CAPS[i] then return i end
	end
	return #RANK_CAPS
end

local builders = {}

-- What the vendor asks before selling (Sources' purchase gates) comes first:
-- the standing, then the skill rank.
local function purchaseSteps(item)
	local steps = {}
	if type(item) ~= "table" then return steps end
	if item.repFaction and item.repStanding then
		local f = Codex().Faction(item.repFaction)
		local name = f and f.name or (L["Faction"] .. " " .. item.repFaction)
		steps[#steps + 1] = { title = name, goals = {
			{ t = "rep", faction = item.repFaction, factionName = name, standing = item.repStanding },
		} }
	end
	if item.reqSkill and item.reqSkillRank then
		local name = Lookup.ProfessionName(item.reqSkill) or L["Profession"]
		steps[#steps + 1] = { title = L[name], goals = {
			{ t = "skill", skill = name, skillLine = item.reqSkill, level = item.reqSkillRank },
		} }
	end
	return steps
end

builders.vendor = function(ctx, row)
	local npc = Codex().Npc(row.src.npc)
	if not (npc and located(row)) then return nil, "nolocation" end
	local steps = purchaseSteps(ctx.entity)
	steps[#steps + 1] = { title = npc.name, goals = {
		at({ t = "goto" }, row),
		at({ t = "buy", item = ctx.id, itemName = ctx.name, count = 1, npc = npc.id, npcName = npc.name }, row),
	} }
	return steps
end

builders.drop = function(ctx, row)
	local C = Codex()
	local npc = C.Npc(row.src.npc)
	if not npc then return nil, "unknown" end
	local steps = {}
	local inst = row.instance and C.Instance(row.instance)
	local kill = { t = "kill", target = npc.name, npc = npc.id, optional = true }
	local collect = { t = "collect", item = ctx.id, itemName = ctx.name, count = 1 }
	local step = { title = npc.name, goals = {} }
	if row.chance then step.note = L["Drop chance"] .. " " .. percent(row.chance) end
	if inst then
		if located(row) then
			steps[#steps + 1] = { title = inst.name, goals = { at({ t = "goto", text = L["Enter"] .. " " .. inst.name }, row) } }
		end
		step.goals[1], step.goals[2] = kill, collect
	else
		if not located(row) then return nil, "nolocation" end
		step.goals[1] = at({ t = "goto" }, row)
		step.goals[2] = at(kill, row)
		step.goals[3] = at(collect, row)
	end
	steps[#steps + 1] = step
	return steps
end

builders.object = function(ctx, row)
	local obj = Codex().Object(row.src.object)
	if not (obj and located(row)) then return nil, "nolocation" end
	local step = { title = obj.name, goals = {
		at({ t = "goto" }, row),
		at({ t = "interact", object = obj.id, objName = obj.name, optional = true }, row),
		at({ t = "collect", item = ctx.id, itemName = ctx.name, count = 1 }, row),
	} }
	if row.chance then step.note = L["Drop chance"] .. " " .. percent(row.chance) end
	return { step }
end

builders.quest = function(ctx, row)
	local steps, err = questSteps(row.src.quest, ctx.player, ctx.from)
	if not steps then return nil, err end
	local last = steps[#steps]
	last.goals[#last.goals + 1] = { t = "collect", item = ctx.id, itemName = ctx.name, count = 1 }
	if row.src.choice then
		last.note = L["Choose this reward:"] .. " " .. ctx.name
	end
	return steps
end

builders.craft = function(ctx, row)
	local src = row.src
	local line, spell = src.skillLine, src.spell
	local name = Lookup.ProfessionName(line) or L["Profession"]
	local C = Codex()
	local trainer = row.trainer and C.Npc(row.trainer)
	local goals = {}
	local rank, maxRank = ns.Compat.GetSkillRank(line)
	local need = src.skill or 1
	local r = rankFor(need)
	if not maxRank or maxRank < RANK_CAPS[r] then
		local g = { t = "train", skillLine = line, skill = name, rank = r }
		if trainer then
			g.npc, g.npcName = trainer.id, trainer.name
			at(g, row)
		end
		goals[#goals + 1] = g
	end
	if not rank or rank < need then
		goals[#goals + 1] = { t = "skill", skill = name, skillLine = line, level = need }
	end
	if not ns.Compat.IsSpellKnown(spell) then
		local g = { t = "learn", spell = spell, spellName = ctx.name, skillLine = line }
		if trainer then
			g.npc, g.npcName = trainer.id, trainer.name
			at(g, row)
		end
		goals[#goals + 1] = g
	end
	goals[#goals + 1] = { t = "craft", spell = spell, spellName = ctx.name, item = ctx.id, itemName = ctx.name, count = 1, skillLine = line }
	return { { title = L[name], goals = goals } }
end

builders.rep = function(ctx, row)
	local C = Codex()
	local src = row.src
	local f = C.Faction(src.faction)
	if not f then return nil, "unknown" end
	local steps = {
		{ title = f.name, goals = { { t = "rep", faction = f.id, factionName = f.name, standing = src.standing } } },
	}
	local npc = src.npc and C.Npc(src.npc)
	if npc and located(row) then
		steps[2] = { title = npc.name, goals = {
			at({ t = "goto" }, row),
			at({ t = "buy", item = ctx.id, itemName = ctx.name, count = 1, npc = npc.id, npcName = npc.name }, row),
		} }
	else
		steps[1].goals[2] = { t = "collect", item = ctx.id, itemName = ctx.name, count = 1 }
	end
	return steps
end

builders.pvp = function(ctx, row)
	local steps, err = builders.vendor(ctx, { src = { npc = row.src.npc }, map = row.map, x = row.x, y = row.y, f = row.f })
	if not steps then return nil, err end
	if row.src.rank then steps[#steps].note = L["PvP rank"] .. " " .. row.src.rank end
	return steps
end

-- Rows of the non-item kinds.
builders.spawn = function(ctx, row)
	if not located(row) then return nil, "nolocation" end
	local goals = { at({ t = "goto", text = ctx.name }, row) }
	local e = ctx.entity
	if ctx.kind == "rare" or (e and e.rare) then
		goals[2] = at({ t = "kill", target = e.name, npc = e.id, optional = true }, row)
	elseif ctx.kind == "object" or ctx.kind == "treasure" then
		goals[2] = at({ t = "interact", object = e.id, objName = e.name, optional = true }, row)
	end
	return { { title = ctx.name, goals = goals } }
end

builders.start = function(ctx)
	return questSteps(ctx.id, ctx.player, ctx.from)
end
builders["end"] = builders.start

builders.entrance = function(ctx, row)
	if not located(row) then return nil, "nolocation" end
	return { { title = ctx.name, goals = { at({ t = "goto", text = L["Enter"] .. " " .. ctx.name }, row) } } }
end

local function entityName(kind, entity)
	if not entity then return nil end
	if kind == "quest" then return entity.title end
	return entity.name
end

-- Where a guide opens on the map: the first goal that has a place.
local function placeGuide(def)
	for _, s in ipairs(def.steps) do
		for _, g in ipairs(s.goals) do
			if g.map then
				def.zone, def.zoneName = g.map, Lookup.ZoneName(g.map)
				return def
			end
		end
	end
	return def
end

-- A planner kind's guide, in the shape the rest of Lookup's guides take.
local function plannedGuide(kind, id)
	local def, err = planners[kind](id)
	if not def then return nil, err end
	if type(def.steps) ~= "table" or #def.steps == 0 then return nil, "noguide" end
	def.id = Lookup.GuideId(kind, id)
	def.pack, def.tier = "lookup", "free"
	def.category = def.category or "Lookup"
	def.author, def.version = "Polestar", 1
	def.lookup = { kind = kind, id = id }
	return placeGuide(def)
end

function Lookup.BuildGuide(kind, id, ranked)
	if planners[kind] then
		if id == nil then return nil, "unknown" end
		return plannedGuide(kind, id)
	end
	local C = Codex()
	if not (C and kind and id ~= nil) then return nil, "unknown" end
	local list, entity = Lookup.Sources(kind, id)
	if not entity then return nil, "unknown" end
	local row = ranked
	if type(row) ~= "table" then row = Lookup.BestSource(list, tonumber(row)) end
	if not row then return nil, #list == 0 and "nosource" or "noguide" end
	local build = builders[row.type]
	if not build or not row.guideable then return nil, "noguide" end
	local name = entityName(kind, entity) or tostring(id)
	local ctx = {
		kind = kind, id = ITEM_KINDS[kind] and tonumber(id) or id, name = name, entity = entity,
		player = Lookup.PlayerInfo(), from = Lookup.PlayerPoint(),
	}
	local steps, err = build(ctx, row)
	if not steps then return nil, err end
	if #steps == 0 then return nil, "noguide" end
	return placeGuide({
		id = Lookup.GuideId(kind, id),
		pack = "lookup",
		title = name,
		category = "Lookup",
		author = "Polestar", version = 1,
		steps = steps,
		lookup = { kind = kind, id = id, source = row.type },
	})
end

---------------------------------------------------------------------------
-- Registering and opening
---------------------------------------------------------------------------

local packRegistered = false
local function ensurePack()
	if packRegistered then return end
	packRegistered = true
	ns.RegisterPack({ id = "lookup", title = L["Lookup"] })
end

local function register(def)
	ensurePack()
	return ns.RegisterGuide(def)
end

-- Opens guideId in a tab. A generated guide already open is reloaded in its
-- own tab (the tab holds the guide table it was opened with).
local function openTab(guideId, rebuilt)
	local E = ns.Engine
	if not (E and ns.IsLoggedIn()) then return nil, "login" end
	local tabs = E.GetTabs()
	for i, t in ipairs(tabs) do
		if t.guideId == guideId then
			if not rebuilt then
				E.SelectTab(i)
				return guideId
			end
			E.CloseTab(i)
			local index = E.OpenTab(guideId, true)
			if index and index ~= i then E.MoveTab(index, i) end
			return index and guideId or nil, index == nil and "tabs" or nil
		end
	end
	if E.OpenTab(guideId, true) then return guideId end
	-- Every tab is in use: replace the active tab's guide.
	if E.SetGuide(guideId) then return guideId end
	return nil, "tabs"
end

function Lookup.Guide(kind, id, index)
	local planned = planners[kind] ~= nil
	if not (planned or enabled()) then return nil, "disabled" end
	local C = Codex()
	if not C then return nil, "missing" end
	local loaded, reason = C.Load()
	if not loaded then return nil, reason end
	if index == nil and not planned then
		local curated = Lookup.CuratedGuide(kind, id)
		if curated then return openTab(curated, false) end
	end
	if kind == "spell" then
		local spell = C.Spell(id)
		if not (spell and spell.item) then return nil, "noguide" end
		kind, id = (C.Item(spell.item) or {}).kind or "item", spell.item
	end
	local def, err = Lookup.BuildGuide(kind, id, index)
	if not def then return nil, err end
	local ok, regErr = register(def)
	if not ok then return nil, regErr end
	return openTab(def.id, true)
end

-- Saved tabs of generated guides come back after /reload: rebuild them
-- before the Engine reopens the saved tabs at login.
ns.OnInit(function()
	local s = ns.CharState()
	local ids = {}
	if type(s.tabs) == "table" then
		for _, gid in pairs(s.tabs) do ids[#ids + 1] = gid end
	end
	ids[#ids + 1] = s.guide
	local C = Codex()
	for _, gid in ipairs(ids) do
		local kind, id = Lookup.ParseGuideId(gid)
		if kind and (planners[kind] or enabled()) and C and not ns.Guides.Get(gid) and C.Load() then
			local def = Lookup.BuildGuide(kind, id)
			if def and def.id == gid then register(def) end
		end
	end
end)

---------------------------------------------------------------------------
-- Alt-click
---------------------------------------------------------------------------

local function altOnly()
	if not (IsAltKeyDown and IsAltKeyDown()) then return false end
	if IsShiftKeyDown and IsShiftKeyDown() then return false end
	if IsControlKeyDown and IsControlKeyDown() then return false end
	if GetMouseButtonClicked then
		local button = GetMouseButtonClicked()
		if button and button ~= "" and button ~= "LeftButton" then return false end
	end
	return true
end

function Lookup.OnItemClick(link, itemID)
	if not (enabled() and ns.Get("lookup.altClick") and altOnly()) then return end
	local C = Codex()
	if C and not C.IsLoaded() then C.Load() end
	local item = C and C.IsLoaded() and C.Item(itemID)
	local kind = item and item.kind or "item"
	local guideId = Lookup.Guide(kind, itemID)
	if not guideId then Lookup.Show(nil, kind, itemID) end
end

ns.Hooks.ItemClick("lookup", Lookup.OnItemClick)
