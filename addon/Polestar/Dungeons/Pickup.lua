-- Polestar.Dungeons, picking up a dungeon's quests: which of a page's quests
-- this character can take before the run, what comes before each one, and a
-- guide that collects them on a travel route and ends at the entrance. The
-- guide is a Lookup planner kind ("pickup", Lookup/Guide.lua): registered as
-- "lookup/pickup/<key>", opened in a new tab, rebuilt after /reload.
--
--   Dungeons.PickupPlan(key) -> plan | nil, reason
--       plan = { dungeon, take = { { quest, rec, giver, pre = { rec, ... } } }, carried = { quest, ... },
--         done = n, later = n }
--       take: quests that apply (faction, race, class), not done, not in the log,
--       open now or by the dungeon's lowest level, picked up outside from a
--       giver (not from an item, not inside), not a follow-up of another quest
--       of this page; pre: the open prerequisites, in the order they are done
--       (all of `pre`, one of `preAny`: Lookup.QuestChain).
--       carried: the page's quests already in the log. giver: a point
--       { kind, id, name, map, x, y, f }.
--   Dungeons.PickupGuide(key) -> def | nil, reason   -- "nothing" when there is nothing to take
--   Dungeons.PickUp(key) -> guideId | nil, reason    -- builds, registers and opens it in a new tab
--   Dungeons.GiverTarget(key, questId) -> point, label, firstTitle, turnIn | nil
--       where to go for the quest: the giver of its first open prerequisite
--       (its turn-in, turnIn true, when that one is in the log), firstTitle
--       its title; else the quest's own giver
--
-- Route: the cheapest path from where the player stands, through the
-- prerequisite quests (each after the one before it in its chain; after one,
-- the player stands at its turn-in) and the givers (one stop per giver with
-- every quest whose prerequisites are behind; a giver comes up again for a
-- quest still waiting), to the entrance (Dungeons.PlanStops: exact up to 12
-- stops, else nearest-next improved by moving stops). The carried quests are
-- listed as notes at the entrance. Travel: ns.TravelCost. The order is kept
-- per character, so a guide rebuilt without a position (after /reload) keeps
-- its route.
--
--   Dungeons.PlanStops(stops, from, finish, travel) -> order, cost
--       stops = { { inP, outP, deps = { index, ... } }, ... }

local ADDON, ns = ...
local L = ns.L
local Dungeons = ns.Dungeons

local type, ipairs, pairs, format = type, ipairs, pairs, string.format
local max = math.max

local KIND = "pickup"
local FAR = 1e9

local function LK() return ns.Lookup end

local function done(id) return ns.Compat.IsQuestCompleted(id) and true or false end
local function inLog(id) return ns.Compat.IsOnQuest(id) and true or false end

local function located(p)
	return type(p) == "table" and p.map ~= nil and p.x ~= nil and p.y ~= nil
end

-- Lookup.QuestEnd's { npc|object, name, spawn } -> a point.
local function endPoint(e)
	if not (e and e.spawn) then return nil end
	local s = e.spawn
	return { kind = e.npc and "npc" or "object", id = e.npc or e.object, name = e.name, map = s.map, x = s.x, y = s.y, f = s.f }
end

-- A page quest's giver outside the dungeon -> point | nil (from an item,
-- inside, or nowhere known). The page's own place first (DungeonJournal),
-- else the Codex giver nearest `from`.
local function giverOf(pq, rec, from)
	local s = pq.start
	if pq.startItem or pq.inside or (s and (s.kind == "item" or s.inside)) then return nil end
	if s and (s.kind == "npc" or s.kind == "object") and s.id and located(s) then
		return { kind = s.kind, id = s.id, name = s.name, map = s.map, x = s.x, y = s.y, f = s.f }
	end
	if rec then
		local st = rec.start
		if st and st.item and st.item[1] then return nil end
		return endPoint(LK().QuestEnd(st, from))
	end
	return nil
end

local function hasClass(list, class)
	if type(list) ~= "table" or #list == 0 or not class then return true end
	for _, c in ipairs(list) do
		if c == class then return true end
	end
	return false
end

local NOT_YOURS = { faction = true, race = true, class = true }

-- Why a page quest is not for this character (faction, race, class) | nil.
local function notYours(pq, rec, p)
	if rec then
		local why = LK().QuestBlock(rec, p)
		if NOT_YOURS[why] then return why end
	elseif pq.faction and p.code and pq.faction ~= p.code then
		return "faction"
	end
	if not hasClass(pq.classes, p.class) then return "class" end
	return nil
end

function Dungeons.PickupPlan(key)
	local d = Dungeons.Get(key)
	if not d then return nil, "unknown" end
	local Lk, C = LK(), ns.Codex
	if not (Lk and Lk.QuestChain and C) then return nil, "missing" end
	local p = Lk.PlayerInfo()
	local from = Lk.PlayerPoint()
	local reach = max(p.level or 1, d.minLevel or 1)
	local quests = Dungeons.Quests(key)
	local onPage = {}
	for _, q in ipairs(quests) do onPage[q.id] = true end
	local plan = { dungeon = d, take = {}, carried = {}, done = 0, later = 0 }
	for _, pq in ipairs(quests) do
		local rec = C.Quest(pq.id)
		if not notYours(pq, rec, p) then
			if done(pq.id) then
				plan.done = plan.done + 1
			elseif inLog(pq.id) then
				plan.carried[#plan.carried + 1] = pq
			elseif ((rec and rec.minLevel) or pq.minLevel or 1) > reach then
				plan.later = plan.later + 1
			else
				local giver = giverOf(pq, rec, from)
				local pre, ok = {}, giver ~= nil
				if ok and rec then
					local chain, truncated = Lk.QuestChain(pq.id, p)
					for i = 1, #chain - 1 do
						local r = chain[i]
						-- A follow-up of another quest here is taken after the run;
						-- a prerequisite this character can never take blocks it.
						if onPage[r.id] or NOT_YOURS[Lk.QuestBlock(r, p)] then ok = false end
						pre[#pre + 1] = r
					end
					pre.truncated = truncated
				end
				if ok then plan.take[#plan.take + 1] = { quest = pq, rec = rec, giver = giver, pre = pre } end
			end
		end
	end
	return plan
end

---------------------------------------------------------------------------
-- The route
---------------------------------------------------------------------------

local function savedOrder(key)
	local s = ns.CharState()
	local all = type(s.dungeonPickup) == "table" and s.dungeonPickup or nil
	return all and type(all[key]) == "table" and all[key] or nil
end

local function saveOrder(key, order)
	local s = ns.CharState()
	if type(s.dungeonPickup) ~= "table" then s.dungeonPickup = {} end
	s.dungeonPickup[key] = order
end

local function acceptGoal(pq, rec, g)
	local goal = { t = "accept", quest = pq.id, title = pq.title or (rec and rec.title),
		map = g.map, x = g.x, y = g.y, f = g.f, minLevel = (rec and rec.minLevel) or pq.minLevel }
	if g.kind == "object" then
		goal.object, goal.objName = g.id, g.name
	else
		goal.npc, goal.npcName = g.id, g.name
	end
	return goal
end

---------------------------------------------------------------------------
-- Stop order: the cheapest path from where the player stands through every
-- stop to the entrance, a path with a fixed end (a greedy nearest-next walk
-- that only appends the entrance would leave a city and come back to it).
---------------------------------------------------------------------------

local EXACT = 12 -- stops searched exactly; more: nearest-next, then improved

-- stops = { { inP, outP, deps = { stopIndex, ... } }, ... }: inP where the
-- stop starts, outP where the player stands after it, deps the stops that
-- must come before it. from: the player's point; finish: the entrance (nil:
-- the path ends at its last stop). travel(a, b) -> seconds | nil (nil and
-- unknown points cost FAR). -> order (stop indices), cost. Ties keep the
-- authored order.
function Dungeons.PlanStops(stops, from, finish, travel)
	local n = #stops
	local memoT = {}
	local function T(a, b)
		if a == nil or b == nil then return FAR end
		if a == b then return 0 end
		local row = memoT[a]
		if not row then
			row = {}
			memoT[a] = row
		end
		local t = row[b]
		if t == nil then
			t = travel(a, b) or FAR
			row[b] = t
		end
		return t
	end
	local function outOf(i) return i == 0 and from or stops[i].outP end
	local function tail(i) return finish and T(outOf(i), finish) or 0 end
	-- Bits as powers of two (Lua 5.1 has no bit operators).
	local pow = {}
	for i = 1, n do pow[i] = 2 ^ (i - 1) end
	local function has(mask, i) return math.floor(mask / pow[i]) % 2 == 1 end
	local function ready(mask, i)
		if has(mask, i) then return false end
		for _, d in ipairs(stops[i].deps) do
			if not has(mask, d) then return false end
		end
		return true
	end
	local order = {}
	if n == 0 then return order, tail(0) end
	if n <= EXACT then
		-- Best cost to finish from (mask of stops done, last stop), memoised.
		local full, memo, nextOf = 2 ^ n - 1, {}, {}
		local function best(mask, last)
			if mask == full then return tail(last) end
			local id = mask * (n + 1) + last
			local c = memo[id]
			if c then return c end
			local here = outOf(last)
			local bc, bi = math.huge, nil
			for i = 1, n do
				if ready(mask, i) then
					local v = T(here, stops[i].inP) + best(mask + pow[i], i)
					if v < bc then bc, bi = v, i end
				end
			end
			memo[id], nextOf[id] = bc, bi
			return bc
		end
		local total = best(0, 0)
		local mask, last = 0, 0
		while mask ~= full do
			local i = nextOf[mask * (n + 1) + last]
			if not i then break end -- a dependency cycle: the rest cannot be placed
			order[#order + 1] = i
			mask, last = mask + pow[i], i
		end
		if #order == n then return order, total end
		order = {}
	end
	-- Many stops: nearest-next first...
	local mask, last = 0, 0
	for _ = 1, n do
		local bc, bi = math.huge, nil
		for i = 1, n do
			if ready(mask, i) then
				local v = T(outOf(last), stops[i].inP)
				if v < bc then bc, bi = v, i end
			end
		end
		if not bi then break end
		order[#order + 1] = bi
		mask, last = mask + pow[bi], bi
	end
	-- ...then moved one stop at a time while that shortens the path and keeps
	-- every stop after its dependencies.
	local function cost(o)
		local c, prev = 0, 0
		for _, i in ipairs(o) do
			c = c + T(outOf(prev), stops[i].inP)
			prev = i
		end
		return c + tail(prev)
	end
	local function valid(o)
		local pos = {}
		for p, i in ipairs(o) do pos[i] = p end
		for p, i in ipairs(o) do
			for _, d in ipairs(stops[i].deps) do
				if not pos[d] or pos[d] > p then return false end
			end
		end
		return true
	end
	local c = cost(order)
	local improved, rounds = true, 0
	while improved and rounds < 50 do
		improved, rounds = false, rounds + 1
		for a = 1, #order do
			for b = 1, #order do
				if a ~= b then
					local o = {}
					for k, v in ipairs(order) do o[k] = v end
					local moved = table.remove(o, a)
					table.insert(o, b, moved)
					if valid(o) then
						local oc = cost(o)
						if oc < c then order, c, improved = o, oc, true end
					end
				end
			end
		end
	end
	return order, c
end

-- plan -> stops: each open prerequisite quest once (after the one before it
-- in its chain; it starts at its giver nearest the player and leaves the
-- player at its turn-in) and each giver once per set of prerequisites its
-- quests wait on (a giver comes up again for a quest still waiting).
local function stopsOf(plan, from)
	local Lk = LK()
	local stops, byKey = {}, {}
	local function add(s)
		stops[#stops + 1] = s
		byKey[s.key] = #stops
		return s
	end
	for _, t in ipairs(plan.take) do
		local prev
		local deps = {}
		for _, r in ipairs(t.pre) do
			local k = "q" .. r.id
			if not byKey[k] then
				local start = endPoint(Lk.QuestEnd(r.start, from))
				local finish = endPoint(Lk.QuestEnd(r["end"], start or from))
				add({ key = k, rec = r, inP = start, outP = finish or start, deps = {}, truncated = t.pre.truncated })
			end
			local s = stops[byKey[k]]
			if prev and prev ~= byKey[k] then
				local dup = false
				for _, d in ipairs(s.deps) do dup = dup or d == prev end
				if not dup then s.deps[#s.deps + 1] = prev end
			end
			prev = byKey[k]
			deps[#deps + 1] = k
		end
		table.sort(deps)
		local g = t.giver
		local gk = "g" .. g.kind .. g.id
		local k = #deps > 0 and (gk .. "<" .. table.concat(deps, ",")) or gk
		local s = stops[byKey[k] or 0]
		if not s then
			local idx = {}
			for i, dk in ipairs(deps) do idx[i] = byKey[dk] end
			s = add({ key = k, giverKey = gk, giver = g, inP = g, outP = g, deps = idx, accepts = {} })
		end
		s.accepts[#s.accepts + 1] = t
	end
	return stops
end

-- plan -> steps (the givers and prerequisites in route order). With the
-- player's position the cheapest path to the entrance (PlanStops); without
-- one (a rebuild after /reload) the order kept for the character.
local function route(key, plan)
	local Lk = LK()
	local from = Lk.PlayerPoint()
	local stops = stopsOf(plan, from)
	local order
	if from then
		local e = plan.dungeon.entrance
		local finish = located(e) and { map = e.map, x = e.x, y = e.y, f = e.f == "e" and "e" or nil } or nil
		order = Dungeons.PlanStops(stops, from, finish, Lk.Travel)
		local keys = {}
		for i, s in ipairs(order) do keys[i] = stops[s].key end
		saveOrder(key, keys)
	else
		-- The saved order, then the authored one, each stop after its dependencies.
		local rank = {}
		for i, k in ipairs(savedOrder(key) or {}) do rank[k] = i end
		local placed = {}
		order = {}
		for _ = 1, #stops do
			local bi, br
			for i, s in ipairs(stops) do
				local ok = not placed[i]
				for _, d in ipairs(s.deps) do ok = ok and placed[d] end
				local r = rank[s.key] or (1000 + i)
				if ok and (not br or r < br) then bi, br = i, r end
			end
			if not bi then break end
			placed[bi] = true
			order[#order + 1] = bi
		end
	end
	local steps, pos, lastGiver = {}, from, nil
	for _, i in ipairs(order) do
		local s = stops[i]
		if s.giver then
			-- Stops at the same giver in a row are one step.
			local step = lastGiver == s.giverKey and steps[#steps] or nil
			if not step then
				step = { title = s.giver.name or L["Quest giver"], goals = {} }
				steps[#steps + 1] = step
			end
			for _, t in ipairs(s.accepts) do step.goals[#step.goals + 1] = acceptGoal(t.quest, t.rec, s.giver) end
			lastGiver = s.giverKey
		else
			local step = Lk.QuestStep(s.rec, s.inP or pos)
			if s.truncated and #s.deps == 0 then
				step.note = L["Earlier quests of this chain are not listed."]
			end
			steps[#steps + 1] = step
			lastGiver = nil
		end
		pos = s.outP or pos
	end
	return steps
end

function Dungeons.PickupGuide(key)
	local plan, err = Dungeons.PickupPlan(key)
	if not plan then return nil, err end
	if #plan.take == 0 then return nil, "nothing" end
	local d = plan.dungeon
	local steps = route(key, plan)
	if #steps == 0 then return nil, "nothing" end
	local last = { title = d.name, goals = {} }
	for _, pq in ipairs(plan.carried) do
		last.goals[#last.goals + 1] = { t = "note", text = format(L["In your log already: %s"], pq.title or "") }
	end
	local e = d.entrance
	if located(e) then
		last.goals[#last.goals + 1] = { t = "goto", text = L["Enter"] .. " " .. d.name, map = e.map, x = e.x, y = e.y, f = e.f == "e" and "e" or nil }
	end
	if #last.goals > 0 then steps[#steps + 1] = last end
	return { title = format(L["%s: pick up the quests"], d.name), steps = steps, dungeon = key }
end

function Dungeons.PickUp(key)
	if not Dungeons.IsEnabled() then return nil, "off" end
	local Lk = LK()
	if not (Lk and Lk.Guide) then return nil, "missing" end
	return Lk.Guide(KIND, key)
end

-- The pickup kind builds only while Dungeons is on.
if ns.Lookup and ns.Lookup.RegisterPlanner then
	ns.Lookup.RegisterPlanner(KIND, function(key)
		if not Dungeons.IsEnabled() then return nil, "off" end
		local ok, reason = Dungeons.Load()
		if not ok then return nil, reason end
		return Dungeons.PickupGuide(key)
	end)
end

---------------------------------------------------------------------------
-- One quest's giver
---------------------------------------------------------------------------

-- A quest of the chain -> where to go for it, turnIn: its turn-in when it is
-- in the log, else its giver (the page's record first).
local function chainPoint(key, id, rec, from)
	local Lk = LK()
	local cq = Dungeons.Quest(key, id)
	if inLog(id) then
		local e = rec and endPoint(Lk.QuestEnd(rec["end"], from))
		if e then return e, true end
		if cq and located(cq.finish) then return cq.finish, true end
		return nil
	end
	if cq and located(cq.start) and not cq.start.inside then return cq.start, false end
	return rec and endPoint(Lk.QuestEnd(rec.start, from)) or nil, false
end

function Dungeons.GiverTarget(key, questId)
	local pq = Dungeons.Quest(key, questId)
	if not pq then return nil end
	if not (done(questId) or inLog(questId)) then
		local Lk, C = LK(), ns.Codex
		local rec = Lk and Lk.QuestChain and C and C.Quest(questId)
		if rec then
			local first = Lk.QuestChain(questId, Lk.PlayerInfo())[1]
			if first and first.id ~= questId then
				local pt, turnIn = chainPoint(key, first.id, first, Lk.PlayerPoint())
				if pt then return pt, pt.name, first.title, turnIn end
			end
		else
			for _, cid in ipairs(pq.chain or {}) do
				if not done(cid) then
					local cq = Dungeons.Quest(key, cid)
					local pt, turnIn = chainPoint(key, cid, nil, nil)
					if pt then return pt, pt.name, cq and cq.title, turnIn end
					break
				end
			end
		end
	end
	if located(pq.start) then return pq.start, pq.start.name end
	return nil
end
