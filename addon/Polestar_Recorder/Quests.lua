-- Quest recording: accept (with the giver remembered from QUEST_DETAIL),
-- turn-in (with the NPC from the completion frame), objective progress (diffs
-- of C_QuestLog.GetQuestObjectives, positioned at each increment), complete,
-- abandon, the quest ids gossip/greeting windows offer, and each quest's XP
-- reward as soon as the client knows it (on the accept, or a later `reward`).

local ADDON, ns = ...

local type, pairs, GetTime, tonumber = type, pairs, GetTime, tonumber

local CONTEXT_TTL = 600 -- seconds a QUEST_DETAIL / QUEST_COMPLETE context stays valid
local SCAN_DELAY = 0.1 -- coalesces bursts of quest log events into one scan

-- questID -> { cur = { [oi] = numFulfilled }, ready = bool|nil, fresh = bool, reward = triesLeft|nil }
local tracked = {}
local turnedIn = {} -- questID -> GetTime() of QUEST_TURNED_IN
local detail, completion -- NPC/position contexts of the open quest frame
local scanQueued = false
local progressHooks = {}

local REWARD_TRIES = 10 -- quest log updates to wait for an uncached XP reward

-- totalXp, baseXp of a quest in the log, or nil while unknown. The global is
-- what Forever's own UI calls (Blizzard_FrameXMLUtil QuestUtils.lua) but it
-- is not in the API documentation, so it may vanish.
local function rewardXP(q)
	if type(GetQuestLogRewardXP) ~= "function" then return nil end
	local ok, total, base = pcall(GetQuestLogRewardXP, q)
	if not ok or type(total) ~= "number" or total <= 0 then return nil end
	return total, type(base) == "number" and base or nil
end

-- Quests whose reward this session has recorded; lives on the session so a
-- reload does not record them again.
local function rewardsSeen()
	local s = ns.Session()
	if not s then return nil end
	if type(s.rewards) ~= "table" then s.rewards = {} end
	return s.rewards
end

-- Records a `reward` event when the XP is known now; returns true when done
-- (recorded, already recorded, or the client cannot tell).
local function recordReward(q)
	local seen = rewardsSeen()
	if not seen or seen[q] then return true end
	if type(GetQuestLogRewardXP) ~= "function" then return true end
	local total, base = rewardXP(q)
	if not total then return false end
	if ns.Record("reward", { q = q, rewardXp = total, rewardXpBase = base, lvl = UnitLevel("player") }) then seen[q] = true end
	return true
end

-- fn(q, oi, objective, delta, ev) after every recorded progress increment.
function ns.OnProgress(fn) progressHooks[#progressHooks + 1] = fn end

local function questID()
	local q = GetQuestID and GetQuestID()
	if type(q) == "number" and q > 0 then return q end
	return nil
end

function ns.QuestTitle(q)
	local title = C_QuestLog.GetTitleForQuestID and C_QuestLog.GetTitleForQuestID(q)
	if title and title ~= "" then return title end
	local idx = C_QuestLog.GetLogIndexForQuestID and C_QuestLog.GetLogIndexForQuestID(q)
	local info = idx and C_QuestLog.GetInfo(idx)
	if info and info.title and info.title ~= "" then return info.title end
	return nil
end

function ns.QuestLevel(q)
	local idx = C_QuestLog.GetLogIndexForQuestID and C_QuestLog.GetLogIndexForQuestID(q)
	local info = idx and C_QuestLog.GetInfo(idx)
	return info and info.level or nil
end

local function isReady(q)
	if C_QuestLog.ReadyForTurnIn and C_QuestLog.ReadyForTurnIn(q) then return true end
	return C_QuestLog.IsComplete and C_QuestLog.IsComplete(q) and true or false
end

-- Snapshot a quest's objectives without recording anything.
local function track(q, fresh)
	local st = tracked[q]
	if not st then
		st = { cur = {} }
		tracked[q] = st
	end
	local objs = C_QuestLog.GetQuestObjectives(q)
	if objs and #objs > 0 then
		for oi = 1, #objs do st.cur[oi] = objs[oi].numFulfilled or 0 end
		st.fresh = false
	else
		st.fresh = fresh and true or false
	end
	st.ready = isReady(q)
	return st
end

-- Every quest already in the log (at session start).
local function trackLog()
	if not C_QuestLog.GetNumQuestLogEntries then return end
	local n = C_QuestLog.GetNumQuestLogEntries()
	for i = 1, n or 0 do
		local info = C_QuestLog.GetInfo(i)
		if info and not info.isHeader and info.questID and info.questID > 0 and not tracked[info.questID] then
			track(info.questID, false)
			if not recordReward(info.questID) then tracked[info.questID].reward = REWARD_TRIES end
		end
	end
end

local function scan()
	scanQueued = false
	for q, st in pairs(tracked) do
		if C_QuestLog.IsOnQuest(q) then
			local objs = C_QuestLog.GetQuestObjectives(q)
			if objs then
				local cur = st.cur
				for oi = 1, #objs do
					local o = objs[oi]
					local now = o.numFulfilled or 0
					local prev = cur[oi]
					if prev == nil and st.fresh then prev = 0 end
					if prev ~= nil and now > prev then
						local ev = ns.Here({ q = q, oi = oi, text = o.text, cur = now, max = o.numRequired, type = o.type })
						if ns.Record("progress", ev) then
							for i = 1, #progressHooks do progressHooks[i](q, oi, o, now - prev, ev) end
						end
					end
					cur[oi] = now
				end
				if #objs > 0 then st.fresh = false end
			end
			local ready = isReady(q)
			if st.ready == false and ready then ns.Record("complete", { q = q }) end
			st.ready = ready
			if st.reward then
				if recordReward(q) then
					st.reward = nil
				else
					st.reward = st.reward - 1
					if st.reward <= 0 then st.reward = nil end
				end
			end
		end
	end
end

local function queueScan()
	if scanQueued then return end
	scanQueued = true
	C_Timer.After(SCAN_DELAY, scan)
end
ns.ScanQuests = scan

-- q, oi of the first unfinished objective of `kind` ("monster", "item")
-- whose text mentions `name`.
function ns.FindObjective(name, kind)
	if not name or name == "" then return nil end
	for q in pairs(tracked) do
		local objs = C_QuestLog.GetQuestObjectives(q)
		if objs then
			for oi = 1, #objs do
				local o = objs[oi]
				if not o.finished and (not kind or o.type == kind) and o.text and o.text:find(name, 1, true) then
					return q, oi
				end
			end
		end
	end
	return nil
end

-- The NPC (or object, or item) and position of the open quest frame.
local function context(q)
	local npc, name, object = ns.UnitEntity("npc")
	local ctx = ns.Here({ q = q, npc = npc, npcName = name, object = object, at = GetTime() })
	if object then ctx.objName, ctx.npcName = name, nil end
	return ctx
end

local function take(ctx, q)
	if not ctx then return nil end
	if ctx.q and ctx.q ~= q then return nil end
	if GetTime() - ctx.at > CONTEXT_TTL then return nil end
	return ctx
end

local function copyContext(ev, ctx)
	ev.npc, ev.npcName, ev.object, ev.objName = ctx.npc, ctx.npcName, ctx.object, ctx.objName
	ev.map, ev.x, ev.y = ctx.map, ctx.x, ctx.y
	ev.items, ev.choices, ev.rewardMoney = ctx.items, ctx.choices, ctx.rewardMoney
end

-- Item ids of the open quest frame's rewards ("reward") or choices ("choice").
local function frameItems(kind, n)
	if not (ns.Usable(n) and type(n) == "number") then return nil end
	local out = {}
	for i = 1, n do
		local id = select(6, GetQuestItemInfo(kind, i))
		if not (ns.Usable(id) and type(id) == "number" and id > 0) then
			local link = GetQuestItemLink and GetQuestItemLink(kind, i)
			id = ns.Usable(link) and type(link) == "string" and tonumber(link:match("item:(%d+)")) or nil
		end
		if id then out[#out + 1] = id end
	end
	return #out > 0 and out or nil
end

-- The rewards the quest frame shows (QUEST_DETAIL, QUEST_COMPLETE).
local function frameRewards(ctx)
	if type(GetQuestItemInfo) ~= "function" then return end
	if GetNumQuestRewards then ctx.items = frameItems("reward", GetNumQuestRewards()) end
	if GetNumQuestChoices then ctx.choices = frameItems("choice", GetNumQuestChoices()) end
	local money = GetRewardMoney and GetRewardMoney()
	if ns.Usable(money) and type(money) == "number" and money > 0 then ctx.rewardMoney = money end
end

-- An item-started quest fires QUEST_DETAIL twice: once with the item id when
-- the item is used, again (without it) when its quest popup is clicked. The
-- second keeps the item of the first when it is for the same quest.
ns.On("QUEST_DETAIL", function(_, questStartItemID)
	local prev = detail
	detail = context(questID())
	if type(questStartItemID) == "number" and questStartItemID > 0 then
		detail.item = questStartItemID
	elseif prev and prev.item and prev.q == detail.q and detail.at - prev.at <= CONTEXT_TTL then
		detail.item = prev.item
		if not (detail.npc or detail.object) then
			-- the popup has no giver unit; the item use's position is the start point
			detail.map, detail.x, detail.y = prev.map, prev.x, prev.y
		end
	end
	detail.title = GetTitleText and GetTitleText() or nil
	frameRewards(detail)
end)

ns.On("QUEST_ACCEPTED", function(_, q)
	if type(q) ~= "number" then return end
	local ctx = take(detail, q)
	local ev = {
		q = q,
		title = ns.QuestTitle(q) or (ctx and ctx.title ~= "" and ctx.title) or nil,
		qlvl = ns.QuestLevel(q),
		lvl = UnitLevel("player"),
		xp = UnitXP and UnitXP("player") or nil,
	}
	if ctx then
		copyContext(ev, ctx)
		ev.item = ctx.item
		detail = nil
	else
		ns.Here(ev)
	end
	ev.rewardXp, ev.rewardXpBase = rewardXP(q)
	local recorded = ns.Record("accept", ev)
	turnedIn[q] = nil
	local st = track(q, true)
	local seen = rewardsSeen()
	if recorded and ev.rewardXp and seen then
		seen[q] = true
	elseif seen and not seen[q] and type(GetQuestLogRewardXP) == "function" then
		st.reward = REWARD_TRIES
	end
end)

local function onCompletionFrame(event)
	completion = context(questID())
	-- the reward frame; QUEST_PROGRESS shows only what the quest asks for
	if event == "QUEST_COMPLETE" then frameRewards(completion) end
end
ns.On("QUEST_PROGRESS", onCompletionFrame)
ns.On("QUEST_COMPLETE", onCompletionFrame)

ns.On("QUEST_TURNED_IN", function(_, q, xpReward, moneyReward)
	if type(q) ~= "number" then return end
	turnedIn[q] = GetTime()
	local ctx = take(completion, q)
	local ev = { q = q, xpReward = xpReward, money = moneyReward, lvl = UnitLevel("player") }
	if ctx then
		copyContext(ev, ctx)
		completion = nil
	else
		ns.Here(ev)
	end
	ns.Record("turnin", ev)
	tracked[q] = nil
end)

-- QUEST_REMOVED fires for turn-ins too; a removal that no turn-in explains
-- (within a second, either order) is an abandon.
ns.On("QUEST_REMOVED", function(_, q)
	if type(q) ~= "number" then return end
	tracked[q] = nil
	C_Timer.After(1, function()
		if turnedIn[q] then return end
		if C_QuestLog.IsQuestFlaggedCompleted and C_QuestLog.IsQuestFlaggedCompleted(q) then return end
		ns.Record("abandon", { q = q })
	end)
end)

ns.On("QUEST_LOG_UPDATE", queueScan)
ns.On("UNIT_QUEST_LOG_CHANGED", function(_, unit)
	if unit == "player" then queueScan() end
end)
ns.On("QUEST_WATCH_UPDATE", function(_, q)
	if type(q) == "number" and not tracked[q] and C_QuestLog.IsOnQuest(q) then track(q, false) end
	queueScan()
end)

---------------------------------------------------------------------------
-- Quest ids an NPC offers (gossip window or quest greeting)
---------------------------------------------------------------------------

local function idsOf(list)
	local out = {}
	if type(list) == "table" then
		for i = 1, #list do
			local id = list[i] and list[i].questID
			if id and id > 0 then out[#out + 1] = id end
		end
	end
	return out
end

local function recordGossip(available, active)
	if #available == 0 and #active == 0 then return end
	local npc, name = ns.UnitEntity("npc")
	ns.Record("gossip", ns.Here({ npc = npc, npcName = name, available = available, active = active }))
end

ns.On("GOSSIP_SHOW", function()
	if not C_GossipInfo then return end
	local available = idsOf(C_GossipInfo.GetAvailableQuests and C_GossipInfo.GetAvailableQuests())
	local active = idsOf(C_GossipInfo.GetActiveQuests and C_GossipInfo.GetActiveQuests())
	recordGossip(available, active)
end)

ns.On("QUEST_GREETING", function()
	local available, active = {}, {}
	if GetNumAvailableQuests and GetAvailableQuestInfo then
		for i = 1, GetNumAvailableQuests() do
			local id = select(5, GetAvailableQuestInfo(i))
			if type(id) == "number" and id > 0 then available[#available + 1] = id end
		end
	end
	if GetNumActiveQuests and GetActiveQuestID then
		for i = 1, GetNumActiveQuests() do
			local id = GetActiveQuestID(i)
			if type(id) == "number" and id > 0 then active[#active + 1] = id end
		end
	end
	recordGossip(available, active)
end)

---------------------------------------------------------------------------
-- Session start: baseline every quest already in the log
---------------------------------------------------------------------------

ns.OnSession(function()
	tracked = {}
	detail, completion = nil, nil
	trackLog()
end)

-- The log is only fully populated after login; pick up anything missed.
ns.On("PLAYER_ENTERING_WORLD", function()
	C_Timer.After(2, trackLog)
end)
