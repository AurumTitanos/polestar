-- Item, equipment, bag, talent, tooltip and quest-reward client APIs for the
-- Gear tests. Load after wow_stub.lua and stub_world.lua (which owns
-- UnitClass/UnitLevel and the spellbook).
--
--   local g = stub.gear
--   g.defineItem("item:1482", { equipLoc = "INVTYPE_WEAPONMAINHAND", classID = 2, subclassID = 7, minLevel = 19,
--                stats = { ITEM_MOD_STRENGTH_SHORT = 5 } })  -- stats = what C_Item.GetItemStats returns (nil: uncached)
--   g.equip(16, "item:1482")          -- fires PLAYER_EQUIPMENT_CHANGED
--   g.bag(0, 1, "item:2041")          -- fires BAG_UPDATE_DELAYED
--   g.setSpecs({ { "Arms", 31 }, { "Fury", 5 }, { "Protection", 0 } })   -- talent tabs; fires PLAYER_TALENT_UPDATE
--   g.secret["item:999"] = true       -- issecretvalue() is true for that value
--   g.showTooltip(GameTooltip, link)  -- what TooltipDataHandler does: clear, post-calls; returns tooltip.lines
--   g.rewards({ "item:1", "item:2" }, { fromLog = false })  -- reward panel with these choices, runs QuestInfo_Display
--   GameTooltip:SetQuestItem("choice", i)  -- hovering a reward choice; returns tooltip.lines

local g = {
	items = {},
	equipped = {},
	bags = {},
	specs = {},
	secret = {},
	postCalls = {},
	choices = {},
	numSpecs = nil,
}
stub.gear = g

local function fire(ev, ...) stub.fire(ev, ...) end

function g.defineItem(link, def) g.items[link] = def end

function g.equip(slot, link)
	g.equipped[slot] = link
	fire("PLAYER_EQUIPMENT_CHANGED", slot, link == nil)
end

function g.bag(b, slot, link)
	g.bags[b] = g.bags[b] or {}
	g.bags[b][slot] = link
	fire("BAG_UPDATE_DELAYED")
end

function g.setSpecs(list)
	g.specs = list
	fire("PLAYER_TALENT_UPDATE")
end

function issecretvalue(v) return v ~= nil and g.secret[v] == true end

function GetInventoryItemLink(unit, slot)
	if unit ~= "player" then return nil end
	return g.equipped[slot]
end

C_Item = C_Item or {}
function C_Item.GetItemStats(link)
	local def = g.items[link]
	if not (def and def.stats) then return nil end
	local copy = {}
	for k, v in pairs(def.stats) do copy[k] = v end
	return copy
end
function C_Item.GetItemInfo(link)
	local def = g.items[link]
	if not (def and def.cached ~= false) then return nil end
	return def.name or "Item", link, def.quality or 2, def.itemLevel or 10, def.minLevel or 0, "", "", 1,
		def.equipLoc or "", 0, 0, def.classID or 4, def.subclassID or 0
end
function C_Item.GetItemInfoInstant(link)
	local def = g.items[link]
	if not def then return nil end
	return tonumber(link:match("item:(%d+)")) or 0, "", "", def.equipLoc or "", 0, def.classID or 4, def.subclassID or 0
end

C_Container = C_Container or {}
function C_Container.GetContainerNumSlots(b) return b >= 0 and b <= 4 and 16 or 0 end
function C_Container.GetContainerItemLink(b, slot) return g.bags[b] and g.bags[b][slot] or nil end

C_SpecializationInfo = C_SpecializationInfo or {}
function C_SpecializationInfo.GetNumSpecializationsForClassID() return g.numSpecs or #g.specs end
function C_SpecializationInfo.GetSpecializationInfo(i)
	local s = g.specs[i]
	if not s then return 0, nil, nil, nil, nil, nil, 0 end
	return 100 + i, s[1], "", 0, "DAMAGER", 1, s[2] or 0
end
function C_SpecializationInfo.IsSpecSelectionEnabled() return g.specSelection == true end
function C_SpecializationInfo.GetSpecialization() return g.primary or 0 end

-- Tooltips the way Blizzard_SharedXMLGame/Tooltip/TooltipDataHandler.lua runs them.
Enum.TooltipDataType = Enum.TooltipDataType or {}
Enum.TooltipDataType.Item = 0
TooltipDataProcessor = { AllTypes = "ALL" }
function TooltipDataProcessor.AddTooltipPostCall(kind, fn)
	g.postCalls[#g.postCalls + 1] = { kind = kind, fn = fn }
end
TooltipUtil = {}
function TooltipUtil.GetDisplayedItem(tooltip)
	if tooltip.item then return "Item", tooltip.item, 1 end
end

ItemRefTooltip = CreateFrame("GameTooltip", "ItemRefTooltip", UIParent)
ShoppingTooltip1 = CreateFrame("GameTooltip", "ShoppingTooltip1", UIParent)
for _, tip in ipairs({ ItemRefTooltip, ShoppingTooltip1 }) do
	tip.lines = {}
	tip.AddLine = GameTooltip.AddLine
	tip.AddDoubleLine = GameTooltip.AddDoubleLine
	tip.ClearLines = GameTooltip.ClearLines
end
-- Double lines also keep their colours for the tests.
local function addDouble(self, l, r, lr, lg, lb, rr, rg, rb)
	table.insert(self.lines, tostring(l) .. " | " .. tostring(r))
	self.colors = self.colors or {}
	self.colors[#self.lines] = { rr, rg, rb }
end
GameTooltip.AddDoubleLine = addDouble
ItemRefTooltip.AddDoubleLine = addDouble
ShoppingTooltip1.AddDoubleLine = addDouble

function g.showTooltip(tooltip, link)
	tooltip.item = link
	tooltip.lines = {}
	tooltip.colors = {}
	for _, c in ipairs(g.postCalls) do
		if c.kind == Enum.TooltipDataType.Item or c.kind == TooltipDataProcessor.AllTypes then c.fn(tooltip, { type = 0 }) end
	end
	return tooltip.lines
end

-- GameTooltip:SetQuestItem / SetQuestLogItem the way TooltipDataHandler runs
-- them (C_TooltipInfo.GetQuestItem / GetQuestLogItem: an Item tooltip with the
-- choice's id and hyperlink, then the post-calls). An uncached choice has its
-- id but no hyperlink yet.
local function questItemTooltip(tooltip, kind, i)
	local c = kind == "choice" and g.choices[i]
	if not c then return end
	tooltip.item = GetQuestItemLink(kind, i)
	tooltip.lines = {}
	tooltip.colors = {}
	local data = { type = 0, id = tonumber(c:match("item:(%d+)")), hyperlink = tooltip.item }
	for _, pc in ipairs(g.postCalls) do
		if pc.kind == Enum.TooltipDataType.Item or pc.kind == TooltipDataProcessor.AllTypes then pc.fn(tooltip, data) end
	end
	return tooltip.lines
end
function GameTooltip:SetQuestItem(kind, i) return questItemTooltip(self, kind, i) end
function GameTooltip:SetQuestLogItem(kind, i) return questItemTooltip(self, kind, i) end

-- Quest reward panel (Mainline QuestInfo).
QuestInfoFrame = CreateFrame("Frame", "QuestInfoFrame", UIParent)
QuestInfoFrame.rewardsFrame = CreateFrame("Frame", "QuestInfoRewardsFrame", QuestInfoFrame)
QuestInfoFrame.rewardsFrame.RewardButtons = {}
QuestInfoFrame.rewardsFrame:Hide()

function QuestInfo_Display() end

function GetNumQuestChoices() return #g.choices end
function GetQuestItemLink(kind, i)
	if kind ~= "choice" then return nil end
	local c = g.choices[i]
	if c and not g.uncachedLinks then return c end
	return nil
end
function GetQuestItemInfo(kind, i)
	local c = kind == "choice" and g.choices[i]
	if not c then return nil end
	return "Item", 0, 1, 2, true, tonumber(c:match("item:(%d+)"))
end
GetNumQuestLogChoices = GetNumQuestChoices
function GetQuestLogItemLink(kind, i) return GetQuestItemLink(kind, i) end

function g.rewards(list, opts)
	opts = opts or {}
	g.choices = list
	g.uncachedLinks = opts.uncached
	QuestInfoFrame.questLog = opts.fromLog or nil
	local rf = QuestInfoFrame.rewardsFrame
	for i, link in ipairs(list) do
		local b = rf.RewardButtons[i]
		if not b then
			b = CreateFrame("Button", nil, rf)
			rf.RewardButtons[i] = b
		end
		b.type, b.objectType = "choice", "item"
		b:SetID(i)
		b:Show()
	end
	for i = #list + 1, #rf.RewardButtons do rf.RewardButtons[i]:Hide() end
	rf:Show()
	QuestInfoFrame:Show()
	QuestInfo_Display()
	fire("QUEST_COMPLETE")
	stub.runTimers()
end
