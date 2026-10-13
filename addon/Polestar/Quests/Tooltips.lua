-- Quest lines on unit, item and object tooltips, and quest icons on the
-- nameplates of objective mobs. Both read the per-entity indexes Tracker.lua
-- keeps for quests in the log, so a hover costs one table lookup.
--
-- Tooltips go through Polestar.Hooks (Core/Hooks.lua, the one owner of the
-- client's tooltip post-calls): UnitLines, ItemLines and ObjectLines, owner
-- "quests". The suite's quest line (agreed with Lookup): Hooks.AddLine(tt,
-- "<Quest>:", "<what> 3/8", quest colour, textDim or success once done), so
-- it reads "<Quest>: Kill Kobold Vermin 3/10" on the mob, "<Quest>: Large
-- Candle 3/8" on a mob or object that drops it, "<Quest>: 3/8" on the item.
--
-- Secret values: Forever can hand out unit GUIDs (and tooltip text) as secret
-- values in combat. Hooks skips them; nameplates check with issecretvalue (via
-- Compat.GetNpcID). A secret value means "no quest lines", never an error.

local ADDON, ns = ...

local Q = ns.QuestDB
local L = ns.L
local type, pairs = type, pairs

local function tooltipsOn()
	return Q.IsRunning() and ns.Get("qol.questTooltips")
end

---------------------------------------------------------------------------
-- Tooltip lines
---------------------------------------------------------------------------

local function addLine(tt, left, right, lc, rc)
	ns.Hooks.AddLine(tt, left, right, lc.r, lc.g, lc.b, rc.r, rc.g, rc.b)
end

local function addObjectiveLines(tt, list, selfKind, selfID, selfName)
	if not list then return 0 end
	local qc, dim, ok = Q.Color("quest"), Q.Color("textDim"), Q.Color("success")
	local added = 0
	for i = 1, #list do
		local o = list[i]
		local e = o.entry
		local what = Q.ProgressText(o)
		local isSelf = o.kind == selfKind and (o.id == selfID or (selfName ~= nil and o.name == selfName))
		if isSelf and o.kind == 1 and o.name then
			what = L["Kill"] .. " " .. o.name .. " " .. what
		elseif not isSelf and o.name then
			what = o.name .. " " .. what
		end
		addLine(tt, (e.title or ("Quest " .. o.q)) .. ":", what, qc, (o.done or e.ready) and ok or dim)
		added = added + 1
	end
	return added
end

-- Items that start a quest: built from the database on first use.
local startItems
local function questsStartedBy(itemID)
	if not startItems then
		startItems = {}
		local F = Q.F
		for q, r in pairs(Q._data.quests) do
			for _, it in Q.Each(r[F.START_ITEM]) do
				local list = startItems[it]
				if not list then
					list = {}
					startItems[it] = list
				end
				list[#list + 1] = q
			end
		end
		for _, list in pairs(startItems) do table.sort(list) end
	end
	return startItems[itemID]
end

local function addStartLines(tt, itemID)
	local list = questsStartedBy(itemID)
	if not list then return 0 end
	local qc, tc = Q.Color("quest"), Q.Color("text")
	local added = 0
	for i = 1, #list do
		local q = list[i]
		if not ns.Compat.IsQuestCompleted(q) and not ns.Compat.IsOnQuest(q) then
			addLine(tt, L["Starts a quest"] .. ":", Q.GetQuestTitle(q) or tostring(q), qc, tc)
			added = added + 1
		end
	end
	return added
end

-- Public so other tooltip paths (and tests) can ask for the same lines.
function Q.AddUnitLines(tt, npcID)
	if not (npcID and tooltipsOn()) then return 0 end
	return addObjectiveLines(tt, Q.ObjectivesForNpc(npcID), 1, npcID)
end

function Q.AddItemLines(tt, itemID)
	if not (itemID and tooltipsOn()) then return 0 end
	return addObjectiveLines(tt, Q.ObjectivesForItem(itemID), 2, itemID) + addStartLines(tt, itemID)
end

function Q.AddObjectLines(tt, objectID, name)
	if not tooltipsOn() then return 0 end
	local list = objectID and Q.ObjectivesForObject(objectID)
	if not list and name then list = Q.ObjectivesForObjectName(name) end
	return addObjectiveLines(tt, list, 3, objectID, name)
end

local OWNER = "quests"

local function onUnit(tt, unit)
	if tooltipsOn() then Q.AddUnitLines(tt, ns.Compat.GetNpcID(unit)) end
end

local function onItem(tt, _, itemID)
	if tooltipsOn() then Q.AddItemLines(tt, itemID) end
end

local function onObject(tt, objectID, name)
	if tooltipsOn() then Q.AddObjectLines(tt, objectID, name) end
end

-- Registered only while the module runs, so an idle Quests costs no hook.
local hooked = false
local function refreshHooks()
	local H = ns.Hooks
	if not H then return end
	local want = tooltipsOn() and true or false
	if want == hooked then return end
	hooked = want
	H.UnitLines(OWNER, want and onUnit or nil)
	H.ItemLines(OWNER, want and onItem or nil)
	if H.ObjectLines then H.ObjectLines(OWNER, want and onObject or nil) end
end

---------------------------------------------------------------------------
-- Nameplate icons
---------------------------------------------------------------------------

local plateUnits = {} -- unit token -> npc id read when the plate appeared (or false)
local icons = {} -- unit token -> icon frame
local pool = {}
local platesRegistered = false

local function platesOn()
	return Q.IsRunning() and ns.Get("qol.nameplateIcons")
end

local function needsKill(npcID)
	local list = npcID and Q.ObjectivesForNpc(npcID)
	if not list then return false end
	for i = 1, #list do
		local o = list[i]
		if not o.done and not o.entry.ready then return true, o end
	end
	return false
end

local function plateFor(unit)
	if not (C_NamePlate and C_NamePlate.GetNamePlateForUnit) then return nil end
	local ok, plate = pcall(C_NamePlate.GetNamePlateForUnit, unit)
	if ok and type(plate) == "table" then return plate end
	return nil
end

local function acquire(plate)
	local f = pool[#pool]
	if f then
		pool[#pool] = nil
	else
		f = CreateFrame("Frame")
		f:SetSize(16, 16)
		f.tex = f:CreateTexture(nil, "OVERLAY")
		f.tex:SetAllPoints(f)
	end
	local ok = pcall(function()
		f:SetParent(plate)
		f:ClearAllPoints()
		f:SetPoint("BOTTOM", plate, "TOP", 0, -2)
	end)
	if not ok then
		f:Hide()
		pool[#pool + 1] = f
		return nil
	end
	return f
end

local function release(unit)
	local f = icons[unit]
	if not f then return end
	icons[unit] = nil
	f:Hide()
	f:ClearAllPoints()
	f:SetParent(nil)
	pool[#pool + 1] = f
end

local function updatePlate(unit)
	local npc = plateUnits[unit]
	local need, o = false, nil
	if npc and platesOn() then need, o = needsKill(npc) end
	if not need then
		release(unit)
		return
	end
	local f = icons[unit]
	if not f then
		local plate = plateFor(unit)
		if not plate then return end
		f = acquire(plate)
		if not f then return end
		icons[unit] = f
	end
	local style = o.kind == 1 and "icon-kill" or "icon-collect"
	local c = Q.Color(o.kind == 1 and "danger" or "item")
	f.tex:SetTexture(ns.Theme and ns.Theme.Media and ns.Theme.Media(style) or style)
	f.tex:SetVertexColor(c.r, c.g, c.b, c.a)
	f:Show()
end

local function onPlateAdded(_, unit)
	if type(unit) ~= "string" then return end
	plateUnits[unit] = ns.Compat.GetNpcID(unit) or false
	updatePlate(unit)
end

local function onPlateRemoved(_, unit)
	if type(unit) ~= "string" then return end
	plateUnits[unit] = nil
	release(unit)
end

local function refreshPlates()
	local on = platesOn()
	if on and not platesRegistered then
		platesRegistered = ns.RegisterEvent("NAME_PLATE_UNIT_ADDED", onPlateAdded)
		ns.RegisterEvent("NAME_PLATE_UNIT_REMOVED", onPlateRemoved)
	elseif not on and platesRegistered then
		ns.UnregisterEvent("NAME_PLATE_UNIT_ADDED", onPlateAdded)
		ns.UnregisterEvent("NAME_PLATE_UNIT_REMOVED", onPlateRemoved)
		platesRegistered = false
		for unit in pairs(plateUnits) do plateUnits[unit] = nil end
	end
	for unit in pairs(icons) do
		if not plateUnits[unit] then release(unit) end
	end
	for unit in pairs(plateUnits) do updatePlate(unit) end
end

-- Units currently showing a quest icon (tests, debugging).
function Q.NameplateIcons()
	local out = {}
	for unit, f in pairs(icons) do
		if f:IsShown() then out[#out + 1] = unit end
	end
	table.sort(out)
	return out
end

local function refreshAll()
	refreshHooks()
	refreshPlates()
end

ns.On("QUESTDB_UPDATED", refreshAll)
ns.On("QUESTDB_STARTED", refreshAll)
ns.On("SETTING_CHANGED", function(path)
	if path == "qol.nameplateIcons" or path == "qol.questTooltips" or path == "qol.questDB" or path == "qol" or path == "" then refreshAll() end
end)
