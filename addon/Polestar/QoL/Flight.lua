-- Flight masters: open the flight map straight from the gossip (Shift
-- suppresses; never when the NPC offers quests to pick up or hand in), and
-- on the open map mark the node the travel route flies to next (else the
-- current step's `fly` location). The flight is only ever taken by the
-- player's own click: nothing here calls TakeTaxiNode.
--
-- Recognising the taxi option without its localized text: the taxi gossip
-- icon (fileID 132057, Interface\GossipFrame\TaxiGossipIcon), or a flight
-- master's NPC ID (Data.lua) with a single option. Taxi maps: TaxiFrame's
-- TaxiButton<i> (Enum.UIMapSystem.Taxi) or FlightMapFrame's flight point
-- pins (Shared TaxiFrame.lua, Blizzard_FlightMap).

local ADDON, ns = ...
local L = ns.L
local QoL = ns.QoL

local type, lower, format = type, string.lower, string.format

local Flight = {}
QoL.Flight = Flight

local TAXI_ICON = 132057
Flight.TAXI_ICON = TAXI_ICON

---------------------------------------------------------------------------
-- Gossip
---------------------------------------------------------------------------

local function hasQuestBusiness(G)
	if (G.GetNumAvailableQuests and G.GetNumAvailableQuests() or 0) > 0 then return true end
	if G.GetActiveQuests then
		local active = G.GetActiveQuests() or {}
		for i = 1, #active do
			if active[i].isComplete then return true end
		end
	end
	return false
end

-- The taxi option of the open gossip, or nil.
function Flight.TaxiOption(options)
	for i = 1, #options do
		local o = options[i]
		if o.icon == TAXI_ICON or o.overrideIconID == TAXI_ICON then return o end
	end
	local npc = ns.Compat and ns.Compat.GetNpcID and ns.Compat.GetNpcID("npc")
	if npc and QoL.data.flightMasters[npc] and #options == 1 then return options[1] end
	return nil
end

-- Returns true when it opened the flight map (the gossip is then gone).
function Flight.OnGossip()
	if not QoL.On("flightAutoOpen") or QoL.Shift() then return false end
	local G = C_GossipInfo
	if not (G and G.GetOptions) then return false end
	if hasQuestBusiness(G) then return false end
	local opt = Flight.TaxiOption(G.GetOptions() or {})
	if not opt then return false end
	if opt.gossipOptionID and G.SelectOption then
		G.SelectOption(opt.gossipOptionID)
	elseif G.SelectOptionByIndex then
		G.SelectOptionByIndex(opt.orderIndex)
	else
		return false
	end
	return true
end

---------------------------------------------------------------------------
-- Destination
---------------------------------------------------------------------------

local function short(name)
	return lower(name:match("^([^,]+),") or name)
end

-- Where the guide wants to fly: route's next fly leg, else the step's fly goal.
function Flight.Destination()
	local Nav = ns.Nav
	if Nav and Nav.GetRoute then
		local legs, ci = Nav.GetRoute()
		if type(legs) == "table" then
			for i = ci or 1, #legs do
				local leg = legs[i]
				if leg.kind == "fly" and leg.to and leg.to.name then return leg.to.name end
			end
		end
	end
	local view, raw = QoL.CurrentStep()
	if view then
		local goals = view.goals or {}
		for g = 1, #goals do
			local gv = goals[g]
			local rg = raw and raw[g]
			if gv.t == "fly" and QoL.Open(gv) then
				local loc = (rg and rg.location) or gv.subject
				if type(loc) == "string" and loc ~= "" then return loc end
			end
		end
	end
	return nil
end

-- Taxi node index whose name matches `dest` (full name, or the part before the comma).
function Flight.FindNode(dest)
	if not (dest and NumTaxiNodes and TaxiNodeName) then return nil end
	local want, wantShort = lower(dest), short(dest)
	local fallback
	for i = 1, NumTaxiNodes() do
		local name = TaxiNodeName(i)
		if type(name) == "string" then
			if lower(name) == want then return i end
			if not fallback and short(name) == wantShort then fallback = i end
		end
	end
	return fallback
end

---------------------------------------------------------------------------
-- The mark on the flight map
---------------------------------------------------------------------------

local mark

local function markFrame()
	if mark then return mark end
	local T = ns.Theme
	mark = CreateFrame("Frame", nil, UIParent)
	mark:SetSize(40, 40)
	mark:Hide()
	local glow = mark:CreateTexture(nil, "BACKGROUND")
	glow:SetAllPoints(mark)
	glow:SetTexture(T and T.Media and T.Media("glow") or nil)
	glow:SetBlendMode("ADD")
	local ring = mark:CreateTexture(nil, "OVERLAY")
	ring:SetSize(26, 26)
	ring:SetPoint("CENTER", mark, "CENTER", 0, 0)
	ring:SetTexture(T and T.Media and T.Media("qol-ring") or nil)
	local label = mark:CreateFontString(nil, "OVERLAY")
	if T and T.Font then T.Font(label, "small") end
	label:SetPoint("BOTTOM", mark, "TOP", 0, -4)
	mark.Label = label
	local function paint()
		if not (T and T.Accent) then return end
		local r, g, b = T.Accent()
		glow:SetVertexColor(r, g, b, 0.7)
		ring:SetVertexColor(r, g, b, 1)
		label:SetTextColor(r, g, b, 1)
	end
	paint()
	if T and T.OnChanged then T.OnChanged(paint) end
	return mark
end

local function nodeFrame(index)
	if TaxiFrame and TaxiFrame.IsShown and TaxiFrame:IsShown() then
		local b = _G["TaxiButton" .. index]
		if b and b:IsShown() then return b end
	end
	local fm = FlightMapFrame
	if fm and fm.IsShown and fm:IsShown() and fm.EnumeratePinsByTemplate then
		for pin in fm:EnumeratePinsByTemplate("FlightMap_FlightPointPinTemplate") do
			if pin.taxiNodeData and pin.taxiNodeData.slotIndex == index then return pin end
		end
	end
	return nil
end

Flight.destination, Flight.node = nil, nil

function Flight.Highlight()
	Flight.destination, Flight.node = nil, nil
	if mark then mark:Hide() end
	if not QoL.On("flightHighlight") then return end
	local dest = Flight.Destination()
	local index = Flight.FindNode(dest)
	if not index then return end
	Flight.destination, Flight.node = dest, index
	local anchor = nodeFrame(index)
	if anchor then
		local m = markFrame()
		m:SetParent(anchor)
		m:ClearAllPoints()
		m:SetPoint("CENTER", anchor, "CENTER", 0, 0)
		m:SetFrameLevel((anchor:GetFrameLevel() or 1) + 5)
		m.Label:SetText(L["Route"])
		m:Show()
	else
		ns.Print(format(L["Route: fly to %s."], TaxiNodeName(index) or dest))
	end
end

ns.RegisterEvent("TAXIMAP_OPENED", function()
	-- The map lays out its nodes in the same event; mark them after it.
	if C_Timer and C_Timer.After then C_Timer.After(0, Flight.Highlight) else Flight.Highlight() end
end)
ns.RegisterEvent("TAXIMAP_CLOSED", function()
	Flight.destination, Flight.node = nil, nil
	if mark then mark:Hide() end
end)
