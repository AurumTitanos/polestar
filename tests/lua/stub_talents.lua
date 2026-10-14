-- The Forever talent client for Talents tests (after wow_stub.lua and stub_world.lua): one
-- character, a C_Traits tree copied from Builds.lua's snapshot (or edited),
-- and the talent frame's buttons.
--
--   local TS = stub.talents
--   TS.class, TS.level, TS.cap, TS.config        -- the player (PALADIN, 30, 30, 7)
--   TS.useSnapshot(data)                         -- the live tree = Builds.lua's nodes
--   TS.nodes[id] = { max = 3, name = "..." }     -- edit the live tree
--   TS.learn(build, n)                           -- learned ranks: the plan's first n picks
--   TS.ranks[id], TS.staged[id]                  -- learned / shown in the frame (staged falls back to learned)
--   TS.openFrame()                               -- PlayerSpellsFrame.TalentsFrame, a button per live node
--   TS.button(id)                                -- that node's button
--   TS.inspecting, TS.frameConfig                -- what the frame shows (nil: the active config)
--   EventRegistry:TriggerEvent(name)             -- run the callbacks registered for it

local TS = { class = "PALADIN", className = "Paladin", level = 30, cap = 30, config = 7, nodes = {}, ranks = {}, staged = {}, buttons = {} }
stub.talents = TS

function UnitClass(unit) if unit == "player" then return TS.className, TS.class, 2 end end
function UnitLevel(unit) if unit == "player" then return TS.level end return 0 end
function GetMaxLevelForPlayerExpansion() return TS.cap end

function TS.useSnapshot(data)
	TS.nodes = {}
	for id, n in pairs(data.nodes) do TS.nodes[id] = { max = n.max, name = n.name } end
end

function TS.learn(build, n)
	TS.ranks, TS.staged = {}, {}
	for i = 1, n do
		local p = build.picks[i]
		TS.ranks[p.node] = p.rank
	end
end

C_ClassTalents = { GetActiveConfigID = function() return TS.config end }
C_Traits = {}
function C_Traits.GetTreeNodes()
	local ids = {}
	for id in pairs(TS.nodes) do ids[#ids + 1] = id end
	table.sort(ids)
	return ids
end
function C_Traits.GetNodeInfo(config, id)
	local n = TS.nodes[id]
	if not n or config ~= TS.config then return { ID = 0 } end
	local r = TS.ranks[id] or 0
	return { ID = id, activeRank = r, currentRank = TS.staged[id] or r, maxRanks = n.max, entryIDs = { id } }
end
function C_Traits.GetEntryInfo(_, entry) return { definitionID = entry } end
function C_Traits.GetDefinitionInfo(def) return TS.nodes[def] and { overrideName = TS.nodes[def].name } end

local callbacks = {}
EventRegistry = {}
function EventRegistry:RegisterCallback(name, fn, owner)
	callbacks[name] = callbacks[name] or {}
	table.insert(callbacks[name], { fn = fn, owner = owner })
end
function EventRegistry:TriggerEvent(name, ...)
	for _, c in ipairs(callbacks[name] or {}) do c.fn(c.owner, ...) end
end

function GameTooltip.GetOwner(self) return self.owner end

function TS.openFrame()
	PlayerSpellsFrame = PlayerSpellsFrame or CreateFrame("Frame", "PlayerSpellsFrame", UIParent)
	local f = rawget(PlayerSpellsFrame, "TalentsFrame")
	if not f then
		f = CreateFrame("Frame", nil, PlayerSpellsFrame)
		PlayerSpellsFrame.TalentsFrame = f
		function f.IsInspecting() return TS.inspecting == true end
		function f.GetConfigID() return TS.frameConfig or TS.config end
		function f.EnumerateAllTalentButtons()
			local list = {}
			for id in pairs(TS.nodes) do list[#list + 1] = TS.button(id) end
			table.sort(list, function(a, b) return a.psStubID < b.psStubID end)
			local i = 0
			return function()
				i = i + 1
				return list[i]
			end
		end
	end
	f:Show()
	return f
end

function TS.button(id)
	local b = TS.buttons[id]
	if b then return b end
	b = CreateFrame("Button", nil, PlayerSpellsFrame.TalentsFrame)
	b.psStubID = id
	function b.GetNodeID() return id end
	TS.buttons[id] = b
	return b
end
