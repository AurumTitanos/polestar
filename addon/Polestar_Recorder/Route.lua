-- Route telemetry: what the player was doing in Polestar's guide, so
-- `record report` can measure each step (time, XP, combat vs travel).
--
-- With Polestar loaded, every step change, guide change (tab switch, new
-- guide) and guide completion is recorded as a `step` snapshot; a session
-- start (login or /reload) records one too. Also recorded, with or without
-- Polestar: combat start/end, AFK on/off, and revives (deaths are recorded
-- by World.lua).
--
-- Polestar is optional: everything here reads it through the global, guarded
-- and pcall'd, and attaches whenever it shows up (it may load after us).

local ADDON, ns = ...

local type, pcall, GetTime = type, pcall, GetTime

local ROUTE_VERSION = 1
local DEDUP_WINDOW = 1 -- seconds: GUIDE_CHANGED then STEP_CHANGED for the same state

local function engine()
	local L = Polestar
	if type(L) ~= "table" or type(L.Engine) ~= "table" then return nil end
	return L.Engine
end

local function call(E, name)
	local fn = E and E[name]
	if type(fn) ~= "function" then return nil end
	local ok, v = pcall(fn)
	if ok then return v end
	return nil
end

-- The active tab's guide (a table) and step index.
local function active()
	local E = engine()
	local g = call(E, "GetGuide")
	if type(g) ~= "table" then return nil, nil end
	local i = call(E, "GetStepIndex")
	return g, type(i) == "number" and i or nil
end

local function inCombat()
	if UnitAffectingCombat then
		local v = UnitAffectingCombat("player")
		if ns.Usable(v) then return v and true or false end
	end
	return false
end

local last = { guide = nil, step = nil, at = -math.huge }

-- reason: "step" | "guide" | "complete" | "login". `g` is the guide table when
-- known (for titles).
local function snapshot(reason, guideId, step, g)
	local now = GetTime()
	if (reason == "step" or reason == "guide") and guideId == last.guide and step == last.step and now - last.at < DEDUP_WINDOW then
		return false
	end
	local ev = ns.Here({ v = ROUTE_VERSION, reason = reason, guide = guideId, step = step })
	if g then
		local s = step and type(g.steps) == "table" and g.steps[step]
		if type(s) == "table" and type(s.title) == "string" then ev.title = s.title end
		if reason ~= "step" and type(g.title) == "string" then ev.guideTitle = g.title end
	end
	ev.time = GetServerTime and GetServerTime() or nil
	ev.lvl = UnitLevel("player")
	ev.xp = UnitXP and UnitXP("player") or nil
	ev.xpMax = UnitXPMax and UnitXPMax("player") or nil
	local rested = GetXPExhaustion and GetXPExhaustion()
	if type(rested) == "number" and rested > 0 then ev.rested = rested end
	ev.money = GetMoney and GetMoney() or nil
	if inCombat() then ev.combat = true end
	if not ns.Record("step", ev) then return false end
	if reason ~= "complete" then last.guide, last.step, last.at = guideId, step, now end
	return true
end

local function guideIdOf(v)
	if type(v) == "table" then v = v.id end
	if type(v) == "string" then return v end
	return nil
end

local function onStepChanged(index)
	local g = active()
	snapshot("step", g and guideIdOf(g), type(index) == "number" and index or nil, g)
end

local function onGuideChanged(id)
	id = guideIdOf(id)
	local g, step = active()
	if not g or guideIdOf(g) ~= id then g, step = nil, nil end
	snapshot("guide", id, step, g)
end

local function onGuideCompleted(id)
	id = guideIdOf(id)
	if id then snapshot("complete", id, nil, nil) end
end

local attached = false
local function attach()
	if attached then return end
	local L = Polestar
	if type(L) ~= "table" or type(L.On) ~= "function" then return end
	attached = true
	L.On("STEP_CHANGED", onStepChanged)
	L.On("GUIDE_CHANGED", onGuideChanged)
	L.On("GUIDE_COMPLETED", onGuideCompleted)
end
ns.AttachPolestar = attach

ns.On("ADDON_LOADED", function(_, name)
	if name == ADDON or name == "Polestar" then attach() end
end)
ns.On("PLAYER_LOGIN", attach)

---------------------------------------------------------------------------
-- Combat, AFK, revive
---------------------------------------------------------------------------

local combat, afk, dead = false, false, false

ns.On("PLAYER_REGEN_DISABLED", function()
	combat = true
	ns.Record("combat", ns.Here({ on = true }))
end)

ns.On("PLAYER_REGEN_ENABLED", function()
	if not combat then return end
	combat = false
	ns.Record("combat", { on = false })
end)

ns.On("PLAYER_FLAGS_CHANGED", function(_, unit)
	if unit ~= "player" or not UnitIsAFK then return end
	local v = UnitIsAFK("player")
	if not ns.Usable(v) then return end
	v = v and true or false
	if v == afk then return end
	afk = v
	ns.Record("afk", { on = v })
end)

ns.On("PLAYER_DEAD", function() dead = true end)

-- PLAYER_ALIVE also fires on releasing the spirit (still a ghost); only a
-- living player counts as revived.
local function revived()
	if not dead then return end
	if UnitIsDeadOrGhost and UnitIsDeadOrGhost("player") then return end
	dead = false
	ns.Record("revive", ns.Here({}))
end
ns.On("PLAYER_ALIVE", revived)
ns.On("PLAYER_UNGHOST", revived)

---------------------------------------------------------------------------
-- Session start (login or /reload): where the guide stands now
---------------------------------------------------------------------------

ns.OnSession(function()
	attach()
	last.guide, last.step, last.at = nil, nil, -math.huge
	combat = inCombat()
	afk = false
	if UnitIsAFK then
		local v = UnitIsAFK("player")
		if ns.Usable(v) then afk = v and true or false end
	end
	dead = UnitIsDeadOrGhost and UnitIsDeadOrGhost("player") and true or false
	local g, step = active()
	if g then snapshot("login", guideIdOf(g), step, g) end
end)
