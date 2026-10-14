-- Quest rewards worth wearing: what a turn-in gives (the reward picked, by
-- hand, by auto-pick or by quest automation, and the items every turn-in
-- gives) is put on once it reaches the bags, when Polestar.Gear calls it an
-- upgrade (qol.rewardEquip, default off; Shift at the turn-in skips). Never in
-- combat: wearing waits for combat to end. Only a new copy of what that
-- turn-in gave counts (the bag count must rise within WAIT seconds), and it
-- goes in the slot Gear.CompareToEquipped names (the weaker ring or trinket).
-- Quest rewards bind when picked up, so wearing one asks nothing; an item
-- that would bind when worn brings up the client's own confirmation, which is
-- left to you.
--
-- Client: GetQuestReward (post-hooked), GetQuestItemLink, GetNumQuestRewards
-- (Mainline QuestInfo.lua); C_Item.EquipItemByName (ItemDocumentation);
-- BAG_UPDATE_DELAYED (ContainerDocumentation).

local ADDON, ns = ...
local L = ns.L
local QoL = ns.QoL
local Client = QoL.Client

local format, floor = string.format, math.floor

local Equip = {}
QoL.Equip = Equip

local WAIT = 10 -- seconds a reward may take to reach the bags

local expected = {} -- { link, id, before, at }: given by a turn-in, not arrived yet
local landed = {}   -- { link }: arrived, waiting to be worn

local function itemID(link) return link and tonumber(link:match("item:(%d+)")) end

local function gear()
	local G = ns.Gear
	if not (G and G.IsUpgrade) then return nil end
	if G.IsEnabled and not G.IsEnabled() then return nil end
	return G
end

-- Right after GetQuestReward, while the reward panel still holds this
-- quest's items (whoever turned it in, and however soon after QUEST_COMPLETE):
-- the reward taken and the ones every turn-in gives, each with how many the
-- bags held before, so only a new copy counts as arrived.
local function onReward(choice)
	if not QoL.On("rewardEquip") or QoL.Shift() then return end
	local now = GetTime()
	local function add(kind, i)
		local link = GetQuestItemLink(kind, i)
		local id = itemID(link)
		if not id then return end
		for _, e in ipairs(expected) do
			if e.id == id then return end
		end
		expected[#expected + 1] = { link = link, id = id, before = Client.ItemCount(id), at = now }
	end
	if choice and choice > 0 then add("choice", choice) end
	for i = 1, (GetNumQuestRewards and GetNumQuestRewards() or 0) do add("reward", i) end
end

local function wear()
	local G = gear()
	if G and C_Item and C_Item.EquipItemByName then
		for _, link in ipairs(landed) do
			local up, _, pct = G.IsUpgrade(link)
			if up then
				local r = G.CompareToEquipped and G.CompareToEquipped(link)
				C_Item.EquipItemByName(link, r and r.slot)
				ns.Print(pct and format(L["Wearing %s (%d%% better)."], link, floor(pct)) or format(L["Wearing %s."], link))
			end
		end
	end
	wipe(landed)
end

local function onBags()
	if #expected == 0 then return end
	local now, keep = GetTime(), {}
	for _, e in ipairs(expected) do
		if now - e.at <= WAIT then
			if Client.ItemCount(e.id) > e.before then
				landed[#landed + 1] = e.link
			else
				keep[#keep + 1] = e
			end
		end
	end
	expected = keep
	if #landed > 0 then QoL.Secure("rewardEquip", wear) end
end

if hooksecurefunc and GetQuestReward then hooksecurefunc("GetQuestReward", onReward) end
ns.RegisterEvent("BAG_UPDATE_DELAYED", onBags)
