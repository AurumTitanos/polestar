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
-- the messages to send, in order; only the first carries the snapshot mark.
function Party.Encode(entries, snapshot)
	local out, parts, size = {}, {}, 0
	local function header() return VERSION .. ((snapshot and #out == 0) and "S|" or "|") end
	for _, e in ipairs(entries) do
		local p = piece(e)
		local extra = (#parts > 0 and 1 or 0) + #p
		if #parts > 0 and #header() + size + extra > Party.MAX_BYTES then
			out[#out + 1] = header() .. concat(parts, ";")
			parts, size, extra = {}, 0, #p
		end
		parts[#parts + 1] = p
		size = size + extra
	end
	if #parts > 0 or #out == 0 then out[#out + 1] = header() .. concat(parts, ";") end
	return out
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
