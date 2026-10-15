-- Quest automation: accept and turn in the quests the guide wants right now.
-- Contract: docs/ARCHITECTURE.md, "Engine" (Automation).
--
-- Rules: settings behavior.autoAccept / behavior.autoTurnin; holding Shift
-- suppresses both; only `accept`/`turnin` goals in the current step or the
-- next two applicable steps qualify; a reward with several choices is always
-- left to the player, as are quests that cost money or flag for PvP, and
-- (behavior.warnClosing) quests that close another one for good.
--
-- Quest frame functions are the Forever (Mainline-family) ones used by
-- Blizzard_UIPanels_Game/Mainline/QuestFrame.lua: GetQuestID, AcceptQuest,
-- AcknowledgeAutoAcceptQuest, QuestGetAutoAccept, QuestFlagsPVP,
-- IsQuestCompletable, CompleteQuest, GetNumQuestChoices, GetQuestMoneyToGet,
-- GetQuestReward, GetNumActiveQuests, GetActiveTitle, GetActiveQuestID,
-- SelectActiveQuest, GetNumAvailableQuests, GetAvailableQuestInfo,
-- SelectAvailableQuest; gossip uses C_GossipInfo (select by questID, as
-- GossipFrameShared.lua does).

local ADDON, ns = ...

local L = ns.L

local Automation = {}
ns.Automation = Automation

local function suppressed()
	return ns.Compat.IsShiftKeyDown()
end

local function canAccept()
	return ns.Get("behavior.autoAccept") and not suppressed()
end

local function canTurnIn()
	return ns.Get("behavior.autoTurnin") and not suppressed()
end

local function wantsAccept(q)
	return q and q ~= 0 and ns.Engine.WantsQuest("accept", q)
end

local function wantsTurnIn(q)
	return q and q ~= 0 and ns.Engine.WantsQuest("turnin", q)
end

local function questID()
	return GetQuestID and GetQuestID() or nil
end

---------------------------------------------------------------------------
-- Quest frame
---------------------------------------------------------------------------

local function onDetail()
	if not canAccept() then return end
	local q = questID()
	if not wantsAccept(q) then return end
	if ns.Closes.HoldsOffer() then return end -- closes another quest for good: the player chooses
	if QuestFlagsPVP and QuestFlagsPVP() then return end -- needs the PvP confirmation
	if QuestGetAutoAccept and QuestGetAutoAccept() then
		if AcknowledgeAutoAcceptQuest then AcknowledgeAutoAcceptQuest() end
	elseif AcceptQuest then
		AcceptQuest()
	end
end

local function onProgress()
	if not canTurnIn() then return end
	local q = questID()
	if not wantsTurnIn(q) then return end
	if IsQuestCompletable and IsQuestCompletable() and CompleteQuest then CompleteQuest() end
end

local function onComplete()
	if not canTurnIn() then return end
	local q = questID()
	if not wantsTurnIn(q) then return end
	local choices = GetNumQuestChoices and GetNumQuestChoices() or 0
	if choices > 1 then
		ns.Print(L["Choose a reward to finish the turn-in."])
		return
	end
	local money = GetQuestMoneyToGet and GetQuestMoneyToGet() or 0
	if money and money > 0 then return end -- costs gold: leave the confirmation to the player
	if GetQuestReward then GetQuestReward(choices == 1 and 1 or 0) end
end

-- Greeting panel (several quests from one NPC/object): turn-ins first, since
-- they often unlock the follow-up to accept.
local function onGreeting()
	local turnin, accept = canTurnIn(), canAccept()
	if not (turnin or accept) then return end
	local numActive = GetNumActiveQuests and GetNumActiveQuests() or 0
	if turnin and GetActiveTitle and GetActiveQuestID and SelectActiveQuest then
		for i = 1, numActive do
			local _, isComplete = GetActiveTitle(i)
			if isComplete and wantsTurnIn(GetActiveQuestID(i)) then
				SelectActiveQuest(i)
				return
			end
		end
	end
	local numAvailable = GetNumAvailableQuests and GetNumAvailableQuests() or 0
	if accept and GetAvailableQuestInfo and SelectAvailableQuest then
		for i = 1, numAvailable do
			local q = select(5, GetAvailableQuestInfo(i))
			if wantsAccept(q) then
				SelectAvailableQuest(i)
				return
			end
		end
	end
end

---------------------------------------------------------------------------
-- Gossip
---------------------------------------------------------------------------

local function onGossip()
	local G = C_GossipInfo
	if not G then return end
	if canTurnIn() and G.GetActiveQuests and G.SelectActiveQuest then
		local active = G.GetActiveQuests() or {}
		for i = 1, #active do
			local info = active[i]
			if info.isComplete and wantsTurnIn(info.questID) then
				G.SelectActiveQuest(info.questID)
				return
			end
		end
	end
	if canAccept() and G.GetAvailableQuests and G.SelectAvailableQuest then
		local available = G.GetAvailableQuests() or {}
		for i = 1, #available do
			local info = available[i]
			if wantsAccept(info.questID) then
				G.SelectAvailableQuest(info.questID)
				return
			end
		end
	end
end

-- Exposed for tests and for a future "do it now" button.
Automation.OnQuestDetail = onDetail
Automation.OnQuestProgress = onProgress
Automation.OnQuestComplete = onComplete
Automation.OnQuestGreeting = onGreeting
Automation.OnGossipShow = onGossip

-- The Engine handles the same events (talk tracking); it does not depend on
-- the order. Automation needs the Engine's current step, which is fresh as
-- of the last evaluation.
ns.RegisterEvent("QUEST_DETAIL", function() onDetail() end)
ns.RegisterEvent("QUEST_PROGRESS", function() onProgress() end)
ns.RegisterEvent("QUEST_COMPLETE", function() onComplete() end)
ns.RegisterEvent("QUEST_GREETING", function() onGreeting() end)
ns.RegisterEvent("GOSSIP_SHOW", function() onGossip() end)
