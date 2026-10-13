-- The reward pick under a turn-in goal in the guide window: which of the
-- quest's reward choices to take, from Polestar.Gear.
--
--   ^ Thornroot Club  +12%        an upgrade: the chevron and gain in success
--   Take Thornroot Club           no choice is an upgrade: the best of them, muted
--
-- The item name is in its quality colour. Hover shows the item's tooltip
-- (with Gear's comparison lines); a modified click links it (the client's
-- HandleModifiedItemClick: chat link, dressing room).
--
-- GuideFrame calls the two hooks for every goal row (agreed with the UI owner):
--   UI.GearPick.Paint(row, goal)                -- after the row's subline is set
--   UI.GearPick.Measure(row, width, h, above)   -- -> h, above (unchanged when hidden)
-- Shown for open turn-in goals whose quest has gear choices this character
-- can use (Gear.QuestPick); hidden otherwise or with gear advice off.

local ADDON, ns = ...
local UI, Theme, W = ns.UI, ns.Theme, ns.Widgets
local L = ns.L
local type, floor, max = type, math.floor, math.max

local GP = {}
UI.GearPick = GP

local LINE_H = 16
local GAP = 3
local CHEVRON = 10

local function pickFor(goal)
	local Gear = ns.Gear
	if not (Gear and Gear.QuestPick and Gear.IsEnabled() and ns.Get("gear.rewards")) then return nil end
	if goal.t ~= "turnin" or not goal.quest then return nil end
	if goal.status == "done" or goal.status == "skipped" then return nil end
	return Gear.QuestPick(goal.quest)
end
GP.PickFor = pickFor

local function qualityHex(quality)
	local r, g, b
	if C_Item and C_Item.GetItemQualityColor and quality then
		local ok, cr, cg, cb = pcall(C_Item.GetItemQualityColor, quality)
		if ok and type(cr) == "number" then r, g, b = cr, cg, cb end
	end
	if not r then return Theme.Hex("item") end
	return ("ff%02x%02x%02x"):format(floor(r * 255 + 0.5), floor(g * 255 + 0.5), floor(b * 255 + 0.5))
end

local function itemName(id)
	local DB = ns.ItemDB
	local name = DB and DB.ItemName and DB.ItemName(id)
	if not name and C_Item and C_Item.GetItemNameByID then
		local ok, n = pcall(C_Item.GetItemNameByID, id)
		if ok and type(n) == "string" then name = n end
	end
	return name or (L["Item"] .. " " .. id)
end

local function itemQuality(id)
	local DB = ns.ItemDB
	local rec = DB and DB.Get and DB.Get(id)
	return rec and rec.quality or nil
end

local function onEnter(self)
	local e = self.lsEntry
	if not (e and GameTooltip) then return end
	GameTooltip:SetOwner(self, "ANCHOR_RIGHT")
	GameTooltip:SetHyperlink("item:" .. e.id)
	GameTooltip:Show()
	if UI.GuideFrame and UI.GuideFrame.HoverIn then UI.GuideFrame.HoverIn() end
end

local function onLeave(self)
	if GameTooltip and GameTooltip:IsOwned(self) then GameTooltip:Hide() end
end

local function onClick(self)
	local e = self.lsEntry
	if not e then return end
	local link
	if C_Item and C_Item.GetItemInfo then
		local ok, _, l = pcall(C_Item.GetItemInfo, e.id)
		if ok then link = l end
	end
	if link and HandleModifiedItemClick then HandleModifiedItemClick(link) end
end

local function frameOf(row)
	local f = row.lsGearPick
	if f then return f end
	f = CreateFrame("Button", nil, row)
	f:SetHeight(LINE_H)
	f.Chevron = f:CreateTexture(nil, "ARTWORK")
	f.Chevron:SetTexture(Theme.Media("chevron-up"))
	f.Chevron:SetSize(CHEVRON, CHEVRON)
	f.Chevron:SetPoint("LEFT", f, "LEFT", 0, 0)
	W.Color(f.Chevron, "success")
	f.Text = W.Text(f, "small", "textDim")
	f.Gain = W.Text(f, "small", "success")
	f:SetScript("OnEnter", onEnter)
	f:SetScript("OnLeave", onLeave)
	f:SetScript("OnClick", onClick)
	f:Hide()
	row.lsGearPick = f
	return f
end

function GP.Paint(row, goal)
	local pick = pickFor(goal)
	if not pick then
		if row.lsGearPick then
			row.lsGearPick.lsEntry = nil
			row.lsGearPick:Hide()
		end
		return
	end
	local f = frameOf(row)
	local e = pick.entry
	f.lsEntry = e
	local name = "|c" .. qualityHex(itemQuality(e.id)) .. itemName(e.id) .. "|r"
	f.Text:ClearAllPoints()
	if pick.upgrade then
		f.Chevron:Show()
		f.Text:SetPoint("LEFT", f.Chevron, "RIGHT", 4, 0)
		f.Text:SetText(name)
		f.Gain:SetText(e.pct and (ns.Gear.GainText(e.pct)) or L["new"])
		f.Gain:Show()
	else
		f.Chevron:Hide()
		f.Text:SetPoint("LEFT", f, "LEFT", 0, 0)
		f.Text:SetText(L["Take"] .. " " .. name)
		f.Gain:Hide()
	end
	f:Show()
end

function GP.Measure(row, width, h, above)
	local f = row.lsGearPick
	if not (f and f:IsShown() and f.lsEntry) then return h, above end
	f:ClearAllPoints()
	f:SetPoint("TOPLEFT", above, "BOTTOMLEFT", 0, -GAP)
	f:SetWidth(width)
	local x = f.Chevron:IsShown() and (CHEVRON + 4) or 0
	local gainW = f.Gain:IsShown() and (f.Gain:GetStringWidth() + 8) or 0
	f.Text:SetWidth(max(20, width - x - gainW))
	local textW = math.min(f.Text:GetStringWidth(), width - x - gainW)
	f.Gain:ClearAllPoints()
	f.Gain:SetPoint("LEFT", f, "LEFT", x + textW + 8, 0)
	return h + GAP + LINE_H, f
end
