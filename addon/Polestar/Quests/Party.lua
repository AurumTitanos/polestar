-- Party sync: your quest progress, shared with the people in your party who
-- run Polestar, and theirs shown under the guide's quest goals ("Ana 5/8").
-- Quest IDs and counts only, never text, so players on other guides, classes
-- or client languages agree on what they share.
--
-- Rules: hidden addon messages to the party only (never chat, never a raid),
-- sent when a count changes (QUEST_LOG_UPDATE, 2 s debounce) and as a full
-- snapshot a few seconds after someone joins; never on a timer. Settings
-- party.share (send) and party.show (receive and show), both on by default;
-- with both off nothing is registered. Every client API is checked first.
--
-- Message: "1|33:5/8,0/1;60:-", version first; "1S|" marks a snapshot that
-- replaces what is known of the sender. "33:-" is a quest that left the log;
-- "33:" one without objectives. Split by whole quests under 255 bytes.

local ADDON, ns = ...

local tonumber, tostring, ipairs, pairs, type = tonumber, tostring, ipairs, pairs, type
local concat = table.concat

local Party = {}
ns.Party = Party

Party.PREFIX = "Polestar"
Party.MAX_BYTES = 255
local VERSION = "1"
local MAX_QUESTS, MAX_OBJECTIVES, MAX_COUNT = 25, 10, 999

---------------------------------------------------------------------------
-- The message format
---------------------------------------------------------------------------

local function piece(e)
	if e.counts == false then return e.q .. ":-" end
	local parts = {}
	for i, c in ipairs(e.counts) do parts[i] = c[1] .. "/" .. c[2] end
	return e.q .. ":" .. concat(parts, ",")
end

-- entries: { { q = id, counts = { { cur, max }, ... } or false }, ... } ->
-- the messages to send, in order (only the first carries the snapshot mark),
-- and for each message the index of the last entry it carries.
function Party.Encode(entries, snapshot)
	local out, ends, parts, size = {}, {}, {}, 0
	local function header() return VERSION .. ((snapshot and #out == 0) and "S|" or "|") end
	for i, e in ipairs(entries) do
		local p = piece(e)
		local extra = (#parts > 0 and 1 or 0) + #p
		if #parts > 0 and #header() + size + extra > Party.MAX_BYTES then
			out[#out + 1] = header() .. concat(parts, ";")
			ends[#out] = i - 1
			parts, size, extra = {}, 0, #p
		end
		parts[#parts + 1] = p
		size = size + extra
	end
	if #parts > 0 or #out == 0 then
		out[#out + 1] = header() .. concat(parts, ";")
		ends[#out] = #entries
	end
	return out, ends
end

local function count(s)
	local n = tonumber(s)
	return n and n <= MAX_COUNT and n or nil
end

-- Returns snapshot, entries; nil for anything malformed or of another version.
function Party.Decode(text)
	if type(text) ~= "string" then return nil end
	local mark, body = text:match("^" .. VERSION .. "(S?)|(.*)$")
	if not mark then return nil end
	local entries = {}
	if body ~= "" then
		for p in (body .. ";"):gmatch("([^;]*);") do
			local q, rest = p:match("^(%d+):(.*)$")
			q = q and tonumber(q)
			if not q or q <= 0 or #entries >= MAX_QUESTS then return nil end
			local counts
			if rest == "-" then
				counts = false
			else
				counts = {}
				if rest ~= "" then
					for c in (rest .. ","):gmatch("([^,]*),") do
						local cur, max = c:match("^(%d+)/(%d+)$")
						cur, max = count(cur), count(max)
						if not (cur and max) or #counts >= MAX_OBJECTIVES then return nil end
						counts[#counts + 1] = { cur, max }
					end
				end
			end
			entries[#entries + 1] = { q = q, counts = counts }
		end
	end
	return mark == "S", entries
end

---------------------------------------------------------------------------
-- Your quest log
---------------------------------------------------------------------------

-- quest id -> its counts as sent ("5/8,0/1"; "" without objectives).
function Party.ReadLog()
	local out = {}
	local Q = C_QuestLog
	if not (Q and Q.GetNumQuestLogEntries and Q.GetInfo) then return out end
	local n = Q.GetNumQuestLogEntries() or 0
	for i = 1, n do
		local info = Q.GetInfo(i)
		local q = info and not info.isHeader and info.questID
		if q and q > 0 and not out[q] then
			local objs = ns.Compat.GetQuestObjectives(q) or {}
			local parts = {}
			for j = 1, math.min(#objs, MAX_OBJECTIVES) do
				local o = objs[j]
				parts[j] = math.min(o.numFulfilled, MAX_COUNT) .. "/" .. math.min(o.numRequired, MAX_COUNT)
			end
			out[q] = concat(parts, ",")
		end
	end
	return out
end

---------------------------------------------------------------------------
-- Sending
---------------------------------------------------------------------------

ns.RegisterDefaults("party", { share = true, show = true })

local DEBOUNCE = 2 -- seconds after a quest log change
local JOIN_MIN, JOIN_SPREAD = 3, 3 -- snapshot 3-6 s after the roster gains someone

local lastSent = {} -- quest id -> counts string the party last got from us
local flushPending, snapPending = false, false
local roster = {} -- "Name" or "Name-Realm" -> short name, the party but you

local function grouped()
	return IsInGroup and IsInGroup() and not (IsInRaid and IsInRaid()) or false
end

local function sharing() return ns.Get("party.share") and grouped() end

local function countsOf(s)
	if s == nil then return false end
	local out = {}
	for cur, max in s:gmatch("(%d+)/(%d+)") do out[#out + 1] = { tonumber(cur), tonumber(max) } end
	return out
end

-- Sends `msgs` in order and stops at the first the client refuses (a
-- throttle, or a lockdown in an instance): returns how many went out.
local function send(msgs)
	local fn = C_ChatInfo and C_ChatInfo.SendAddonMessage
	if not fn then return 0 end
	local results = Enum and Enum.SendAddonMessageResult
	local ok = results and results.Success or 0
	for i, m in ipairs(msgs) do
		local r = fn(Party.PREFIX, m, "PARTY")
		if r == false or (type(r) == "number" and r ~= ok) then return i - 1 end
	end
	return #msgs
end

-- Sends quests `ids` (sorted) as they are in `now`; what went out becomes
-- lastSent, the rest stays pending for the next change.
local function sendQuests(ids, now, snapshot)
	local entries = {}
	for i, q in ipairs(ids) do entries[i] = { q = q, counts = countsOf(now[q]) } end
	local msgs, ends = Party.Encode(entries, snapshot)
	local n = send(msgs)
	if n == 0 then return false end
	if snapshot then lastSent = {} end
	for i = 1, ends[n] do
		local q = ids[i]
		lastSent[q] = now[q]
	end
	return true
end

local function flush()
	flushPending = false
	if not sharing() then return end
	local now, ids = Party.ReadLog(), {}
	for q, s in pairs(now) do
		if lastSent[q] ~= s then ids[#ids + 1] = q end
	end
	for q in pairs(lastSent) do
		if now[q] == nil then ids[#ids + 1] = q end
	end
	if #ids == 0 then return end
	table.sort(ids)
	sendQuests(ids, now, false)
end

local function snapshot()
	snapPending = false
	if not sharing() then return end
	local now, ids = Party.ReadLog(), {}
	for q in pairs(now) do ids[#ids + 1] = q end
	table.sort(ids)
	sendQuests(ids, now, true)
end

local function scheduleSnapshot()
	if snapPending or not C_Timer then return end
	snapPending = true
	C_Timer.After(JOIN_MIN + math.random() * JOIN_SPREAD, snapshot)
end

local function onLog()
	if flushPending or not sharing() or not C_Timer then return end
	flushPending = true
	C_Timer.After(DEBOUNCE, flush)
end

local function memberKey(unit)
	local name, realm = UnitName(unit)
	if not name then return nil end
	if realm and realm ~= "" then return name .. "-" .. realm, name end
	return name, name
end

local function onRoster()
	if not grouped() then
		roster, lastSent = {}, {}
		return
	end
	local now, gained = {}, false
	local n = GetNumSubgroupMembers and GetNumSubgroupMembers() or 0
	for i = 1, n do
		local key, short = memberKey("party" .. i)
		if key then
			now[key] = short
			if not roster[key] then gained = true end
		end
	end
	roster = now
	if gained and ns.Get("party.share") then scheduleSnapshot() end
end

local function onLeft()
	roster, lastSent = {}, {}
end

local function onAddonMessage() end

---------------------------------------------------------------------------
-- Settings
---------------------------------------------------------------------------

local prefixed = false

local function want(event, on, fn)
	if on then ns.RegisterEvent(event, fn) else ns.UnregisterEvent(event, fn) end
end

-- Registers what the settings need and nothing else; at login and whenever
-- a party setting changes.
function Party.Apply()
	local share, show = ns.Get("party.share") and true or false, ns.Get("party.show") and true or false
	local any = share or show
	want("GROUP_ROSTER_UPDATE", any, onRoster)
	want("GROUP_LEFT", any, onLeft)
	want("QUEST_LOG_UPDATE", share, onLog)
	want("CHAT_MSG_ADDON", show, onAddonMessage)
	if not any then
		onLeft()
		return
	end
	if not prefixed and C_ChatInfo and C_ChatInfo.RegisterAddonMessagePrefix then
		prefixed = true
		C_ChatInfo.RegisterAddonMessagePrefix(Party.PREFIX)
	end
	onRoster()
end

ns.OnLogin(Party.Apply)
ns.On("SETTING_CHANGED", function(path)
	if type(path) == "string" and (path == "" or path == "party" or path:sub(1, 6) == "party.") and ns.IsLoggedIn() then
		Party.Apply()
	end
end)
