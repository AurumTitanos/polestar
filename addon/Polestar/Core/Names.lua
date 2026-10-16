-- Polestar.Names: quest, NPC, object and item names in the client's
-- language. Contract: docs/ARCHITECTURE.md, "Names".
--
-- The guides and data packs name things in English. On a client in another
-- language the guide window, the target button, objective matching, the quest
-- database's names and Lookup ask here first and keep their English when the
-- answer is nil.
--
--   Names.Quest(id) / Names.Npc(id) / Names.Object(id) / Names.Item(id) -> name | nil
--     The client's own name first (a quest's title, C_QuestLog; an item's,
--     C_Item; the client has none for NPCs and objects), then the names pack
--     of its language, Polestar_Names_<locale> (built by `node
--     tools/polestar.js i18n names`, loaded on demand on the first ask), else
--     nil. Always nil on an English client (enUS, enGB), which loads nothing.
--     A quest or item the client has not cached is asked for, once a session;
--     when the asked names arrive (QUEST_DATA_LOAD_RESULT,
--     ITEM_DATA_LOAD_RESULT) one STEP_UPDATED redraws the guide window.
--   Names.Cached(kind, id) -> name | nil   -- the same, never asking the
--     server; an item's name from the pack only (Lookup indexes thousands)
--   Names.Localised() -> bool   -- not an English client
--   Names.Ready() -> bool       -- the pack is in, or will not load this session
--   Names.PackName() -> "Polestar_Names_<locale>" | nil (English)
--   Names.Add(locale, kind, { [id] = name })   -- the pack's files; kind: quest npc object item

local ADDON, ns = ...

local Names = {}
ns.Names = Names

local type, pairs = type, pairs

local ENGLISH = { enUS = true, enGB = true }
local locale = (GetLocale and GetLocale()) or "enUS"
local localised = not ENGLISH[locale]
local PACK = localised and ("Polestar_Names_" .. locale) or nil

local tables = { quest = {}, npc = {}, object = {}, item = {} }
local ready = not localised -- the pack is in, or will not load this session
-- Ids asked of the server: 1 while waiting, 2 once answered. Never asked twice.
local asked = { quest = {}, item = {} }
local redrawing = false
local deferred = false -- a load was refused in combat

function Names.Localised() return localised end
function Names.Ready() return ready end
function Names.PackName() return PACK end

function Names.Add(loc, kind, t)
	local into = tables[kind]
	if loc ~= locale or not into or type(t) ~= "table" then return end
	for id, name in pairs(t) do
		if type(id) == "number" and type(name) == "string" and name ~= "" then into[id] = name end
	end
end

-- One redraw for a burst of arrivals: the guide window refills its rows
-- (GuideFrame's STEP_UPDATED) with the names now cached.
local function redraw()
	redrawing = false
	local E = ns.Engine
	local step = E and E.GetStepIndex and E.GetStepIndex()
	if step then ns.Fire("STEP_UPDATED", step) end
end

local function scheduleRedraw()
	if redrawing then return end
	redrawing = true
	C_Timer.After(0.2, redraw)
end

-- Data.Pack refuses in combat: the load is tried again when combat ends
-- (PLAYER_REGEN_ENABLED) or at the next ask, and once it lands NAMES_LOADED
-- fires (the tracker reads its names again) and the guide window redraws:
-- what showed meanwhile was English. Any other answer (loaded, missing,
-- disabled...) is final for the session.
local function load()
	local Data = ns.Data
	if not (Data and Data.Pack) then
		ready = true
		return
	end
	local ok, reason = Data.Pack(PACK)
	if not ok and reason == "combat" then
		deferred = true
		return
	end
	ready = true
	if ok and deferred then
		deferred = false
		ns.Fire("NAMES_LOADED")
		scheduleRedraw()
	end
end

local function fromPack(kind, id)
	if not ready then load() end
	return tables[kind][id]
end

local function ask(kind, id)
	if asked[kind][id] then return end
	asked[kind][id] = 1
	local C = ns.Compat
	if kind == "quest" then C.RequestQuest(id) else C.RequestItem(id) end
end

local function valid(id)
	return localised and type(id) == "number"
end

function Names.Quest(id)
	if not valid(id) then return nil end
	local t = ns.Compat.GetQuestTitle(id)
	if t then return t end
	ask("quest", id)
	return fromPack("quest", id)
end

function Names.Item(id)
	if not valid(id) then return nil end
	local n = ns.Compat.GetItemName(id)
	if n then return n end
	ask("item", id)
	return fromPack("item", id)
end

function Names.Npc(id)
	if not valid(id) then return nil end
	return fromPack("npc", id)
end

function Names.Object(id)
	if not valid(id) then return nil end
	return fromPack("object", id)
end

function Names.Cached(kind, id)
	if not valid(id) or not tables[kind] then return nil end
	if kind == "quest" then
		local t = ns.Compat.GetQuestTitle(id)
		if t then return t end
	end
	return fromPack(kind, id)
end

local function arrived(kind, id, success)
	if asked[kind][id] ~= 1 then return end
	asked[kind][id] = 2
	if success == false then return end
	scheduleRedraw()
end

if localised then
	ns.RegisterEvent("QUEST_DATA_LOAD_RESULT", function(_, id, success) arrived("quest", id, success) end)
	ns.RegisterEvent("ITEM_DATA_LOAD_RESULT", function(_, id, success) arrived("item", id, success) end)
	ns.RegisterEvent("PLAYER_REGEN_ENABLED", function() if deferred and not ready then load() end end)
end
