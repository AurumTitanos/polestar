-- Guide registry: packs, guides and Era map frames registered by guide
-- packs at load time, plus the picker queries (List, Suggestions, Suggest).
-- Contract: docs/ARCHITECTURE.md, "Guide data" and "Engine".

local ADDON, ns = ...

local type, pairs, ipairs, tostring, tonumber = type, pairs, ipairs, tostring, tonumber

local Guides = {}
ns.Guides = Guides

local guides = {} -- id -> guide
local order = {} -- ids in first-registration order
local headers = {} -- id -> header (guide without steps, plus stepCount)
local packs = {}
Guides.packs = packs

ns.MapFrames = ns.MapFrames or { era = {} }

---------------------------------------------------------------------------
-- Conditions (`only` on steps and goals, races/classes on guides)
---------------------------------------------------------------------------

-- Race names compare with UnitRace's second return, the client's race file
-- (ChrRaces.ClientFileString in Forever 1.60.1): "Scourge" for the Forsaken
-- (guides may also write "Undead") and "Skyborne" on both sides; a guide's
-- `faction` (or an `only` faction) picks the side, not the race.
local RACE_ALIAS = { scourge = "undead" }
local function normRace(r)
	if not r then return "" end
	r = r:lower()
	return RACE_ALIAS[r] or r
end
Guides.NormRace = normRace

local function identity(v) return v and v:lower() or "" end

-- A list matches when no "!x" entry equals the value and, if the list has any
-- positive entry, one of them does. nil/empty lists match everything. norm
-- (optional) canonicalizes names before comparing.
local function listMatches(list, value, norm)
	if type(list) ~= "table" or #list == 0 then return true end
	norm = norm or identity
	value = norm(value)
	local positives, hit = false, false
	for i = 1, #list do
		local e = list[i]
		local neg = e:sub(1, 1) == "!"
		if neg then e = e:sub(2) end
		e = norm(e)
		if neg then
			if e == value then return false end
		else
			positives = true
			if e == value then hit = true end
		end
	end
	return hit or not positives
end
Guides.ListMatches = listMatches

-- only = { classes = {...}, races = {...}, factions = {...} }; player =
-- Compat.GetPlayerInfo(). AND across keys, OR within.
function Guides.Matches(only, player)
	if type(only) ~= "table" then return true end
	return listMatches(only.classes, player.class)
		and listMatches(only.races, player.race, normRace)
		and listMatches(only.factions, player.faction)
end

local function guideMatches(g, player)
	if g.faction and player.faction and g.faction:lower() ~= player.faction:lower() then return false end
	return listMatches(g.races, player.race, normRace) and listMatches(g.classes, player.class)
end
Guides.GuideMatches = guideMatches

-- Candidate NPCs (`candidates` on a goal): faction "A" | "H" | "AH" (nil:
-- anyone), optional races/classes lists.
local FACTION_CODE = { Alliance = "A", Horde = "H" }
function Guides.CandidateMatches(c, player)
	if c.faction and c.faction ~= "AH" then
		local code = FACTION_CODE[player.faction]
		if not code or not c.faction:find(code, 1, true) then return false end
	end
	return listMatches(c.races, player.race, normRace) and listMatches(c.classes, player.class)
end

---------------------------------------------------------------------------
-- Travel cost between two points { map, x, y, f }: Nav.EstimateTravel in
-- seconds when Nav provides it, else running time over the world distance on
-- one continent, with a large penalty across continents. nil when either
-- point cannot be placed.
---------------------------------------------------------------------------

local RUN_SPEED = 7 -- yards per second
local CROSS_CONTINENT = 3600 -- seconds
ns.TRAVEL_CROSS_CONTINENT = CROSS_CONTINENT

function ns.TravelCost(from, to)
	local nav = ns.Nav
	if nav and nav.EstimateTravel then
		local ok, s = pcall(nav.EstimateTravel, from, to)
		if ok and type(s) == "number" then return s end
	end
	local C = ns.Compat
	local c1, x1, y1 = C.MapToWorld(from.map, from.x, from.y, from.f)
	local c2, x2, y2 = C.MapToWorld(to.map, to.x, to.y, to.f)
	if not (c1 and c2) then return nil end
	if c1 ~= c2 then return CROSS_CONTINENT end
	local dx, dy = x2 - x1, y2 - y1
	return (dx * dx + dy * dy) ^ 0.5 / RUN_SPEED
end

-- The player's live position as a travel point, or nil (instance, loading).
function ns.PlayerPoint()
	local map, x, y = ns.Compat.GetPlayerMapPosition()
	if not map then return nil end
	return { map = map, x = x, y = y }
end

---------------------------------------------------------------------------
-- Validation
---------------------------------------------------------------------------

local function isNum(v) return type(v) == "number" end
local function isStr(v) return type(v) == "string" and v ~= "" end

-- verb -> { field = checker }
local REQUIRED = {
	accept = { quest = isNum, title = isStr },
	turnin = { quest = isNum, title = isStr },
	complete = { quest = isNum, title = isStr },
	kill = { target = isStr },
	collect = { item = isNum, itemName = isStr },
	["goto"] = { map = isNum, x = isNum, y = isNum },
	talk = { npc = isNum, npcName = isStr },
	interact = { object = isNum, objName = isStr },
	use = { item = isNum, itemName = isStr },
	sethome = {}, -- `location`, or `candidates` for `sethome nearest`
	hearth = { location = isStr },
	getfp = { location = isStr },
	fly = { location = isStr },
	train = {},
	buy = { item = isNum, itemName = isStr },
	vendor = {},
	level = { level = isNum },
	note = { text = isStr },
	skill = { skill = isStr, level = isNum },
	learn = { spell = isNum, spellName = isStr },
	craft = { spell = isNum, spellName = isStr },
	rep = { faction = isNum, factionName = isStr, standing = isNum },
	explore = { map = isNum, x = isNum, y = isNum },
	achieve = { achievement = isNum, achievementName = isStr },
}
Guides.VERBS = REQUIRED

-- Required fields per verb in a fixed (alphabetical) order, so the error for
-- a goal missing several fields is always the same.
local REQUIRED_ORDER = {}
for verb, rules in pairs(REQUIRED) do
	local fields = {}
	for field in pairs(rules) do fields[#fields + 1] = field end
	table.sort(fields)
	REQUIRED_ORDER[verb] = fields
end

local function checkOnly(only)
	if only == nil then return true end
	if type(only) ~= "table" then return false end
	for _, key in ipairs({ "classes", "races", "factions" }) do
		local list = only[key]
		if list ~= nil then
			if type(list) ~= "table" then return false end
			for i = 1, #list do
				if type(list[i]) ~= "string" then return false end
			end
		end
	end
	return true
end

local function checkGoal(goal)
	if type(goal) ~= "table" then return "not a table" end
	local rules = REQUIRED[goal.t]
	if not rules then return "unknown verb " .. tostring(goal.t) end
	local fields = REQUIRED_ORDER[goal.t]
	for i = 1, #fields do
		local field = fields[i]
		if not rules[field](goal[field]) then return goal.t .. " needs " .. field end
	end
	if goal.x ~= nil or goal.y ~= nil then
		if not (isNum(goal.map) and isNum(goal.x) and isNum(goal.y)) then return "coordinates need map, x and y" end
		if goal.x < 0 or goal.x > 100 or goal.y < 0 or goal.y > 100 then return "coordinates outside 0-100" end
	end
	if goal.f ~= nil and goal.f ~= "e" then return "unknown frame " .. tostring(goal.f) end
	if goal.r ~= nil and not (isNum(goal.r) and goal.r > 0) then return "bad radius" end
	if goal.oi ~= nil and not (isNum(goal.oi) and goal.oi >= 1) then return "bad objective index" end
	if goal.count ~= nil and not isNum(goal.count) then return "bad count" end
	if goal.text ~= nil and type(goal.text) ~= "string" then return "bad text" end
	if goal.t == "rep" and (goal.standing < 1 or goal.standing > 8) then return "standing outside 1-8" end
	for _, key in ipairs({ "skillLine", "untilSkill", "criteria", "level" }) do
		if goal[key] ~= nil and not isNum(goal[key]) then return "bad " .. key end
	end
	if goal.reagents ~= nil then
		if type(goal.reagents) ~= "table" then return "bad reagents" end
		for i = 1, #goal.reagents do
			local r = goal.reagents[i]
			if type(r) ~= "table" or not isNum(r.item) then return "bad reagent " .. i end
		end
	end
	if goal.t == "sethome" and not isStr(goal.location) and type(goal.candidates) ~= "table" then
		return "sethome needs location"
	end
	if goal.candidates ~= nil then
		if type(goal.candidates) ~= "table" or #goal.candidates == 0 then return "bad candidates" end
		for i = 1, #goal.candidates do
			local c = goal.candidates[i]
			if type(c) ~= "table" or not (isNum(c.map) and isNum(c.x) and isNum(c.y)) then return "bad candidate " .. i end
			if c.faction ~= nil and c.faction ~= "A" and c.faction ~= "H" and c.faction ~= "AH" then
				return "bad candidate faction " .. i
			end
		end
	end
	-- Spawn areas: centres in the goal's own map and frame, so they need its map.
	if goal.spots ~= nil then
		if type(goal.spots) ~= "table" or #goal.spots == 0 or not isNum(goal.map) then return "bad spots" end
		for i = 1, #goal.spots do
			local s = goal.spots[i]
			if type(s) ~= "table" or not (isNum(s.x) and isNum(s.y) and isNum(s.r) and s.r >= 0) then return "bad spot " .. i end
		end
	end
	if goal.spread ~= nil and not (goal.spread == true and goal.spots ~= nil) then return "bad spread" end
	-- A collect's dominant source: its name, kind, rank and faction.
	if goal.from ~= nil and not isStr(goal.from) then return "bad from" end
	if goal.fromKind ~= nil and goal.fromKind ~= "npc" and goal.fromKind ~= "object" then return "bad fromKind" end
	if goal.fromRank ~= nil and not isNum(goal.fromRank) then return "bad fromRank" end
	if goal.fromFaction ~= nil and goal.fromFaction ~= "A" and goal.fromFaction ~= "H" and goal.fromFaction ~= "AH" then
		return "bad fromFaction"
	end
	for _, key in ipairs({ "rank", "qlvl" }) do
		if goal[key] ~= nil and not isNum(goal[key]) and not isStr(goal[key]) then return "bad " .. key end
	end
	if goal.pre ~= nil and type(goal.pre) ~= "table" then return "bad pre" end
	if goal.preAll ~= nil and type(goal.preAll) ~= "table" then return "bad preAll" end
	if goal.closedBy ~= nil and type(goal.closedBy) ~= "table" then return "bad closedBy" end
	if goal.rewards ~= nil then
		local r = goal.rewards
		if type(r) ~= "table" then return "bad rewards" end
		if (r.xp ~= nil and not isNum(r.xp)) or (r.money ~= nil and not isNum(r.money)) then return "bad rewards" end
		for _, key in ipairs({ "items", "choices" }) do
			local list = r[key]
			if list ~= nil then
				if type(list) ~= "table" then return "bad rewards" end
				for i = 1, #list do
					local it = list[i]
					if type(it) ~= "table" or not isNum(it.item) then return "bad reward " .. i end
				end
			end
		end
	end
	if not checkOnly(goal.only) then return "bad only" end
	return nil
end

local function validate(def)
	if type(def) ~= "table" then return "guide is not a table" end
	if not isStr(def.id) then return "missing id" end
	if not isStr(def.title) then return "missing title" end
	if type(def.steps) ~= "table" or #def.steps == 0 then return "no steps" end
	if def.minLevel ~= nil and not isNum(def.minLevel) then return "bad minLevel" end
	if def.maxLevel ~= nil and not isNum(def.maxLevel) then return "bad maxLevel" end
	if def.next ~= nil and not isStr(def.next) then return "bad next" end
	if def.faction ~= nil and not isStr(def.faction) then return "bad faction" end
	if def.category ~= nil and not isStr(def.category) then return "bad category" end
	if def.pitch ~= nil and not isStr(def.pitch) then return "bad pitch" end
	if def.folder ~= nil and not isStr(def.folder) then return "bad folder" end
	if def.collects ~= nil then
		if type(def.collects) ~= "table" then return "bad collects" end
		for i = 1, #def.collects do
			if not isNum(def.collects[i]) then return "bad collects" end
		end
	end
	for _, key in ipairs({ "races", "classes", "nextChoices", "pros", "cons", "keywords" }) do
		local list = def[key]
		if list ~= nil then
			if type(list) ~= "table" then return "bad " .. key end
			for i = 1, #list do
				if not isStr(list[i]) then return "bad " .. key end
			end
		end
	end
	for s, step in ipairs(def.steps) do
		if type(step) ~= "table" then return ("step %d is not a table"):format(s) end
		if type(step.goals) ~= "table" or #step.goals == 0 then return ("step %d has no goals"):format(s) end
		if not checkOnly(step.only) then return ("step %d: bad only"):format(s) end
		for g, goal in ipairs(step.goals) do
			local err = checkGoal(goal)
			if err then return ("step %d goal %d: %s"):format(s, g, err) end
		end
	end
	return nil
end
Guides.Validate = validate

---------------------------------------------------------------------------
-- Registration (called by guide packs at load time)
---------------------------------------------------------------------------

function ns.RegisterPack(meta)
	if type(meta) ~= "table" or not isStr(meta.id) then
		ns.Debug("RegisterPack: rejected a pack without an id")
		return false, "missing id"
	end
	packs[meta.id] = meta
	return true
end

function ns.RegisterGuide(def)
	local err = validate(def)
	if err then
		local id = type(def) == "table" and tostring(def.id) or "?"
		ns.Debug(("guide %s rejected: %s"):format(id, err))
		return false, err
	end
	if guides[def.id] then
		ns.Debug(("guide %s registered twice; the last one wins"):format(def.id))
	else
		order[#order + 1] = def.id
	end
	guides[def.id] = def
	local h = {}
	for k, v in pairs(def) do
		if k ~= "steps" then h[k] = v end
	end
	h.stepCount = #def.steps
	headers[def.id] = h
	return true
end

-- { era = { [uiMapID] = { c, left, right, top, bottom } } }; merges.
function ns.RegisterMapFrames(frames)
	if type(frames) ~= "table" then return end
	local era = frames.era
	if type(era) ~= "table" then return end
	for map, b in pairs(era) do
		if type(b) == "table" and isNum(b.c) and isNum(b.left) and isNum(b.right) and isNum(b.top) and isNum(b.bottom) then
			ns.MapFrames.era[tonumber(map) or map] = b
		else
			ns.Debug("RegisterMapFrames: bad bounds for map", tostring(map))
		end
	end
end

---------------------------------------------------------------------------
-- Queries
---------------------------------------------------------------------------

function Guides.Get(id)
	return id and guides[id] or nil
end

function Guides.List()
	local out = {}
	for i = 1, #order do out[i] = headers[order[i]] end
	return out
end

-- Where a guide starts: its first goal with coordinates (cached).
local startOf = setmetatable({}, { __mode = "k" })
local function guideStart(g)
	local p = startOf[g]
	if p == nil then
		p = false
		for _, step in ipairs(g.steps) do
			for _, goal in ipairs(step.goals) do
				if goal.map and goal.x and goal.y then
					p = { map = goal.map, x = goal.x, y = goal.y, f = goal.f }
					break
				end
			end
			if p then break end
		end
		startOf[g] = p
	end
	return p or nil
end
Guides.Start = guideStart

-- Guides whose route choice (`nextChoices`) offers `id`, in registration order.
function Guides.OfferedBy(id)
	local out = {}
	for i = 1, #order do
		local g = guides[order[i]]
		if g.nextChoices then
			for _, c in ipairs(g.nextChoices) do
				if c == id then
					out[#out + 1] = g
					break
				end
			end
		end
	end
	return out
end

-- Travel times this close count as a tie (the race's own chain wins).
local TRAVEL_TIE = 120 -- seconds

-- Leveling guides for the player, best first (category "Leveling" or none;
-- other categories are only ever picked by the player). Faction/race/class
-- must match. Every guide whose level range contains the player's level, in
-- this order: the player's current zone first, then the nearest by travel
-- (in 2-minute bands), then race- or class-specific (the race's own chain),
-- then the narrowest range, the lowest minLevel and registration order. If
-- none contains the level: the nearest upcoming guide, else the highest one
-- below, alone. -> { id, ... }
function Guides.Suggestions()
	local player = ns.Compat.GetPlayerInfo()
	local level = player.level or 1
	local here = ns.PlayerPoint()
	local zone = ns.Compat.GetZoneText()
	local fitting, best, bestKey = {}, nil, nil
	local function less(a, b)
		for i = 1, #a do
			if a[i] ~= b[i] then return a[i] < b[i] end
		end
		return false
	end
	for i = 1, #order do
		local g = guides[order[i]]
		if (g.category == nil or g.category == "Leveling") and guideMatches(g, player) then
			local lo, hi = g.minLevel or 1, g.maxLevel or g.minLevel or 1
			if hi < lo then hi = lo end
			if level >= lo and level <= hi then
				local specific = ((g.races and #g.races > 0) or (g.classes and #g.classes > 0)) and 0 or 1
				local inZone = ((here and g.zone == here.map) or (zone and g.zoneName == zone)) and 0 or 1
				local band = math.huge
				local start = here and guideStart(g)
				if start then
					local cost = ns.TravelCost(here, start)
					if cost then band = math.floor(cost / TRAVEL_TIE) end
				end
				fitting[#fitting + 1] = { id = g.id, key = { inZone, band, specific, hi - lo, lo, i } }
			elseif #fitting == 0 then
				local key = lo > level and { 1, lo - level, hi - lo, i } or { 2, level - hi, hi - lo, i }
				if not bestKey or less(key, bestKey) then best, bestKey = g.id, key end
			end
		end
	end
	if #fitting == 0 then return { best } end
	table.sort(fitting, function(a, b) return less(a.key, b.key) end)
	local out = {}
	for i = 1, #fitting do out[i] = fitting[i].id end
	return out
end

-- The best leveling guide for the player: the first of Suggestions().
function Guides.Suggest()
	return Guides.Suggestions()[1]
end

ns.OnLogin(function()
	ns.Fire("GUIDES_REGISTERED")
end)
