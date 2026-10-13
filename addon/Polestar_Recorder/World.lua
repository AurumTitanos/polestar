-- World recording: movement breadcrumbs, zone changes, level-ups, deaths,
-- quest-relevant kills and loot, flight masters and flights, hearth binds,
-- trainers and vendors.
--
-- Kills: Forever's combat log is restricted for addons (COMBAT_LOG_EVENT_*
-- are callback events; C_CombatLog has no GetCurrentEventInfo), so deaths
-- come from UNIT_DIED / PARTY_KILL, which carry only GUIDs. Names come from
-- a small cache of units the player has seen (target, mouseover, nameplates).
-- A death is recorded only when it is quest-relevant: the player killed or
-- targeted a unit whose name an unfinished kill objective mentions (or the
-- client flags it as related to an active quest), or a kill objective
-- advanced within a few seconds of the death. Everything else is ignored.

local ADDON, ns = ...

local type, GetTime, tonumber, ipairs = type, GetTime, tonumber, ipairs

---------------------------------------------------------------------------
-- Breadcrumbs: a 1 s ticker that records a point only while moving, when
-- the player is far enough from the last recorded point.
---------------------------------------------------------------------------

local POS_TICK = 1 -- seconds between movement checks
local POS_MIN_YARDS = 25 -- record after moving this far ...
local POS_MIN_GAP = 2 -- ... but not more often than this (seconds)
local POS_SLOW_YARDS = 4 -- or after moving this far ...
local POS_SLOW_GAP = 20 -- ... once this long has passed since the last point

local function isMoving()
	if IsPlayerMoving then return IsPlayerMoving() and true or false end
	if GetUnitSpeed then return (GetUnitSpeed("player") or 0) > 0 end
	return false
end

local function breadcrumb()
	if UnitOnTaxi and UnitOnTaxi("player") then return end
	local map, x, y = ns.Position()
	if not x then return end
	local last = ns.last
	if last.map == map and last.x then
		local d = ns.Yards(map, x - last.x, y - last.y)
		local dt = GetTime() - last.at
		if not ((d >= POS_MIN_YARDS and dt >= POS_MIN_GAP) or (d >= POS_SLOW_YARDS and dt >= POS_SLOW_GAP)) then return end
	end
	ns.Record("pos", { map = map, x = x, y = y })
end

local function tick()
	if isMoving() then breadcrumb() end
end

local ticker
ns.OnSession(function()
	if not ticker then ticker = C_Timer.NewTicker(POS_TICK, tick) end
end)

-- The point where the player stops is worth keeping when it is far enough.
ns.On("PLAYER_STOPPED_MOVING", breadcrumb)

---------------------------------------------------------------------------
-- Zone, level, death
---------------------------------------------------------------------------

local lastZoneMap, lastZone

local function checkZone()
	if not ns.Session() then return end
	local map = C_Map and C_Map.GetBestMapForUnit and C_Map.GetBestMapForUnit("player")
	local zone = (GetRealZoneText and GetRealZoneText()) or (GetZoneText and GetZoneText()) or nil
	if map == lastZoneMap and zone == lastZone then return end
	lastZoneMap, lastZone = map, zone
	if not ns.Usable(map) then map = nil end
	ns.Record("zone", { map = map, zone = zone, subzone = GetSubZoneText and GetSubZoneText() or nil })
end

ns.OnSession(function()
	lastZoneMap, lastZone = nil, nil
	checkZone()
end)
ns.On("ZONE_CHANGED_NEW_AREA", checkZone)
ns.On("ZONE_CHANGED", checkZone)
ns.On("ZONE_CHANGED_INDOORS", checkZone)
ns.On("PLAYER_ENTERING_WORLD", checkZone)

ns.On("PLAYER_LEVEL_UP", function(_, level)
	ns.Record("level", ns.Here({ lvl = level }))
end)

ns.On("PLAYER_DEAD", function()
	ns.Record("death", ns.Here({}))
end)

---------------------------------------------------------------------------
-- Units the player has seen: GUID -> { npc, name, related, targeted }.
-- A fixed ring; evicted entries are reused.
---------------------------------------------------------------------------

local CACHE_SIZE = 128
local seen, ring, ringPos = {}, {}, 0

local function remember(unit, targeted)
	local guid = UnitGUID(unit)
	local kind, npc = ns.ParseGUID(guid)
	if kind ~= "Creature" and kind ~= "Vehicle" then return end
	local e = seen[guid]
	if not e then
		ringPos = ringPos % CACHE_SIZE + 1
		local old = ring[ringPos]
		if old then
			e = seen[old]
			seen[old] = nil
		end
		e = e or {}
		ring[ringPos] = guid
		seen[guid] = e
		local name = UnitName(unit)
		e.npc, e.name, e.related, e.targeted = npc, ns.Usable(name) and name or nil, false, false
	end
	if not e.related and C_QuestLog.UnitIsRelatedToActiveQuest and C_QuestLog.UnitIsRelatedToActiveQuest(unit) then
		e.related = true
	end
	if targeted then e.targeted = true end
end

ns.On("PLAYER_TARGET_CHANGED", function() remember("target", true) end)
ns.On("UPDATE_MOUSEOVER_UNIT", function() remember("mouseover", false) end)
ns.On("NAME_PLATE_UNIT_ADDED", function(_, unit) remember(unit, false) end)

---------------------------------------------------------------------------
-- Kills
---------------------------------------------------------------------------

local LINK_WINDOW = 3 -- seconds between a death and the objective it advanced
local PENDING_MAX = 8
local DEAD_SIZE = 64

local dead, deadRing, deadPos = {}, {}, 0 -- recently handled GUIDs
local pending = {} -- deaths waiting for an objective to advance
local recent = { at = -math.huge, q = nil, oi = nil, text = nil, left = 0 } -- unclaimed monster progress

local function markDead(guid)
	deadPos = deadPos % DEAD_SIZE + 1
	local old = deadRing[deadPos]
	if old then dead[old] = nil end
	deadRing[deadPos] = guid
	dead[guid] = true
end

local function nameFromObjective(text)
	return text and text:match("^(.-) slain") or nil
end

local function recordKill(npc, name, map, x, y, q, oi, text)
	ns.Record("kill", {
		npc = npc,
		npcName = name or nameFromObjective(text),
		map = map, x = x, y = y,
		q = q, oi = oi,
	})
end

local function nameMatches(name, text)
	return not name or not text or text:find(name, 1, true) ~= nil
end

local function expirePending(now)
	local j = 0
	for i = 1, #pending do
		local p = pending[i]
		if now - p.at <= LINK_WINDOW then
			j = j + 1
			pending[j] = p
		end
	end
	for i = #pending, j + 1, -1 do pending[i] = nil end
end

local claims = {} -- kills recorded before their objective advanced: { q, oi, at }

-- A kill recorded on its own evidence uses up one increment of its
-- objective, so that increment cannot be credited to another death.
local function claim(q, oi, now)
	if not q then return end
	if recent.left > 0 and recent.q == q and recent.oi == oi and now - recent.at <= LINK_WINDOW then
		recent.left = recent.left - 1
		return
	end
	if #claims >= PENDING_MAX then table.remove(claims, 1) end
	claims[#claims + 1] = { q = q, oi = oi, at = now }
end

-- Increments of (q, oi) already accounted for by claimed kills.
local function takeClaims(q, oi, delta, now)
	for i = #claims, 1, -1 do
		local c = claims[i]
		if now - c.at > LINK_WINDOW then
			table.remove(claims, i)
		elseif delta > 0 and c.q == q and c.oi == oi then
			table.remove(claims, i)
			delta = delta - 1
		end
	end
	return delta
end

local function onDeath(guid, byPlayer)
	if not ns.Usable(guid) or dead[guid] then return end
	local kind, npc = ns.ParseGUID(guid)
	if kind ~= "Creature" and kind ~= "Vehicle" then return end
	markDead(guid)
	local e = seen[guid]
	local name = e and e.name
	local map, x, y = ns.Position()
	local now = GetTime()

	if byPlayer or (e and e.targeted) then
		local q, oi = ns.FindObjective(name, "monster")
		if q or (e and e.related) then
			recordKill(npc, name, map, x, y, q, oi)
			claim(q, oi, now)
			return
		end
	end
	-- The objective may have advanced just before the death was reported.
	if recent.left > 0 and now - recent.at <= LINK_WINDOW and nameMatches(name, recent.text) then
		recent.left = recent.left - 1
		recordKill(npc, name, map, x, y, recent.q, recent.oi, recent.text)
		return
	end
	expirePending(now)
	if #pending >= PENDING_MAX then table.remove(pending, 1) end
	pending[#pending + 1] = { npc = npc, name = name, map = map, x = x, y = y, at = now }
end

ns.On("UNIT_DIED", function(_, guid) onDeath(guid, false) end)
ns.On("PARTY_KILL", function(_, attacker, target)
	if not ns.Usable(attacker) then return end
	local me = UnitGUID("player")
	local pet = UnitGUID("pet")
	onDeath(target, attacker == me or (pet ~= nil and attacker == pet))
end)

ns.OnProgress(function(q, oi, o, delta)
	if o.type ~= "monster" then return end
	local now = GetTime()
	delta = takeClaims(q, oi, delta, now)
	expirePending(now)
	for i = #pending, 1, -1 do
		if delta <= 0 then break end
		local p = pending[i]
		if nameMatches(p.name, o.text) then
			table.remove(pending, i)
			recordKill(p.npc, p.name, p.map, p.x, p.y, q, oi, o.text)
			delta = delta - 1
		end
	end
	recent.at, recent.q, recent.oi, recent.text, recent.left = now, q, oi, o.text, delta
end)

---------------------------------------------------------------------------
-- Loot: quest items (or items an objective names), recorded when the slot
-- is actually looted.
---------------------------------------------------------------------------

local lootSlots = {}

ns.On("LOOT_OPENED", function()
	wipe(lootSlots)
	if not (GetNumLootItems and GetLootSlotInfo) then return end
	for slot = 1, GetNumLootItems() do
		local _, name, quantity, currencyID, _, _, isQuestItem, questID = GetLootSlotInfo(slot)
		if name and not currencyID then
			local q, oi = ns.FindObjective(name, "item")
			if isQuestItem or q then
				local link = GetLootSlotLink and GetLootSlotLink(slot)
				local item = link and tonumber(link:match("item:(%d+)"))
				if type(questID) == "number" and questID > 0 and questID ~= q then q, oi = questID, nil end
				lootSlots[slot] = { item = item, itemName = name, count = quantity, q = q, oi = oi }
			end
		end
	end
end)

ns.On("LOOT_SLOT_CLEARED", function(_, slot)
	local ev = lootSlots[slot]
	if not ev then return end
	lootSlots[slot] = nil
	ns.Record("loot", ns.Here(ev))
end)

ns.On("LOOT_CLOSED", function() wipe(lootSlots) end)

---------------------------------------------------------------------------
-- Flight masters and flights
---------------------------------------------------------------------------

local FP_CURRENT = (Enum and Enum.FlightPathState and Enum.FlightPathState.Current) or 0

local function taxiNodes()
	local map = C_Map and C_Map.GetBestMapForUnit and C_Map.GetBestMapForUnit("player")
	if map and C_TaxiMap and C_TaxiMap.GetAllTaxiNodes then return C_TaxiMap.GetAllTaxiNodes(map) end
	return nil
end

local function currentTaxiNode()
	local nodes = taxiNodes()
	if nodes then
		for _, n in ipairs(nodes) do
			if n.state == FP_CURRENT then return n.name end
		end
	end
	if NumTaxiNodes and TaxiNodeGetType and TaxiNodeName then
		for i = 1, NumTaxiNodes() do
			if TaxiNodeGetType(i) == "CURRENT" then return TaxiNodeName(i) end
		end
	end
	return nil
end

local function taxiNodeName(slot)
	if TaxiNodeName then
		local name = TaxiNodeName(slot)
		if name and name ~= "" then return name end
	end
	local nodes = taxiNodes()
	if nodes then
		for _, n in ipairs(nodes) do
			if n.slotIndex == slot then return n.name end
		end
	end
	return nil
end

local taxiFrom

local function charKey()
	return tostring(UnitName("player")) .. "-" .. tostring(GetRealmName and GetRealmName() or "")
end

ns.On("TAXIMAP_OPENED", function()
	local here = currentTaxiNode()
	taxiFrom = here
	if not here or not ns.IsEnabled() then return end
	local fp = ns.DB().fp
	local key = charKey()
	local known = fp[key]
	if type(known) ~= "table" then
		known = {}
		fp[key] = known
	end
	if known[here] then return end
	local npc, name = ns.UnitEntity("npc")
	if ns.Record("fp", ns.Here({ location = here, npc = npc, npcName = name })) then known[here] = true end
end)

-- TakeTaxiNode only requests the flight (the server may refuse it: not
-- enough money, in combat). The flight is recorded once the player is
-- actually on the taxi.
local TAXI_CONFIRM = { 0.5, 1.5, 3, 6 } -- seconds after the request to check UnitOnTaxi
local pendingTaxi -- { from, to, at }

local function confirmTaxi()
	local p = pendingTaxi
	if not p then return end
	if UnitOnTaxi and UnitOnTaxi("player") then
		pendingTaxi = nil
		ns.Record("taxi", { from = p.from, to = p.to })
	elseif GetTime() - p.at >= TAXI_CONFIRM[#TAXI_CONFIRM] - 1e-6 then
		pendingTaxi = nil
	end
end

local function onTakeTaxi(slot)
	pendingTaxi = { from = taxiFrom or currentTaxiNode(), to = taxiNodeName(slot), at = GetTime() }
	for _, delay in ipairs(TAXI_CONFIRM) do C_Timer.After(delay, confirmTaxi) end
end
if type(TakeTaxiNode) == "function" then hooksecurefunc("TakeTaxiNode", onTakeTaxi) end
ns.On("PLAYER_CONTROL_LOST", confirmTaxi)

---------------------------------------------------------------------------
-- Hearth, trainers, vendors
---------------------------------------------------------------------------

ns.On("HEARTHSTONE_BOUND", function()
	ns.Record("bind", ns.Here({ location = GetBindLocation and GetBindLocation() or nil }))
end)

ns.On("TRAINER_SHOW", function()
	local npc, name = ns.UnitEntity("npc")
	ns.Record("trainer", ns.Here({ npc = npc, npcName = name }))
end)

ns.On("MERCHANT_SHOW", function()
	local npc, name = ns.UnitEntity("npc")
	ns.Record("vendor", ns.Here({ npc = npc, npcName = name }))
end)
