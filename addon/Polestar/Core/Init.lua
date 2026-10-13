-- Polestar core: the namespace every other file hangs off, and the plumbing
-- they share: lifecycle, message bus, game events, settings, slash commands.
-- Contract: docs/ARCHITECTURE.md, "Core".
--
-- SavedVariables can come back nil after a cold client restart on Forever
-- beta builds, so nothing here keeps a reference to PolestarDB or
-- PolestarCharDB: every access goes through DB()/CharState(), which recreate
-- them on demand.

local ADDON, ns = ...
Polestar = ns

ns.name = ADDON
ns.version = (C_AddOns and C_AddOns.GetAddOnMetadata and C_AddOns.GetAddOnMetadata(ADDON, "Version")) or "dev"
-- The release stage, the one place it is set: shown as a chip beside the
-- version (the shell sidebar, About). nil once Polestar is released.
ns.stage = "Beta"
-- The leveling routes are planned and played in the simulator but not yet
-- followed through the live game: the first-run welcome (UI/Welcome.lua)
-- says so on its own page while this is true. The owner turns it off once
-- they have been.
ns.routesAlpha = true

-- The pack docs online: the TOC's X-Website (the public repository, added at
-- publication) plus the path of docs/PACKS.md. nil without that field.
function ns.DocsURL()
	local site = C_AddOns and C_AddOns.GetAddOnMetadata and C_AddOns.GetAddOnMetadata(ADDON, "X-Website")
	site = type(site) == "string" and site:gsub("/+$", "") or ""
	if site == "" then return nil end
	return site .. "/blob/HEAD/docs/PACKS.md"
end

local pcall, type, pairs, select, tostring = pcall, type, pairs, select, tostring

-- enUS only for now; a missing key renders as itself.
local L = setmetatable({}, { __index = function(_, key) return key end })
ns.L = L

-- Text that prints literally in a FontString: every `|` (the client's escape
-- character) doubled. Packs' strings go through this once, at registration.
function ns.EscapeText(s)
	if type(s) ~= "string" then s = tostring(s) end
	if not s:find("|", 1, true) then return s end
	return (s:gsub("|", "||"))
end

-- Run a callback; report its error without stopping the caller's loop.
local function call(fn, ...)
	local ok, err = pcall(fn, ...)
	if not ok then geterrorhandler()(err) end
end
ns.SafeCall = call

local function compact(list)
	local j = 0
	for i = 1, #list do
		local h = list[i]
		if h.live then
			j = j + 1
			list[j] = h
		end
	end
	for i = #list, j + 1, -1 do list[i] = nil end
end

---------------------------------------------------------------------------
-- Message bus. Handlers removed mid-dispatch are only marked, then
-- compacted once the outermost dispatch returns, so iteration never skips.
---------------------------------------------------------------------------

local listeners = {} -- msg -> { { msg, fn, live }, ... }
local busDepth, busDirty = 0, false

function ns.On(msg, fn)
	local list = listeners[msg]
	if not list then
		list = {}
		listeners[msg] = list
	end
	local h = { msg = msg, fn = fn, live = true }
	list[#list + 1] = h
	return h
end

function ns.Off(h)
	if type(h) ~= "table" or not h.live then return end
	h.live = false
	if busDepth > 0 then
		busDirty = true
	else
		compact(listeners[h.msg])
	end
end

function ns.Fire(msg, ...)
	local list = listeners[msg]
	if not list then return end
	busDepth = busDepth + 1
	for i = 1, #list do
		local h = list[i]
		if h.live then call(h.fn, ...) end
	end
	busDepth = busDepth - 1
	if busDepth == 0 and busDirty then
		busDirty = false
		for _, l in pairs(listeners) do compact(l) end
	end
end

---------------------------------------------------------------------------
-- Game events, all through one hidden frame.
---------------------------------------------------------------------------

local eventFrame = CreateFrame("Frame")
local gameHandlers = {} -- event -> { { fn, live }, ... }
local eventDepth, eventsDirty = 0, false

local function settle(event)
	local list = gameHandlers[event]
	if not list then return end
	compact(list)
	if #list == 0 then
		gameHandlers[event] = nil
		eventFrame:UnregisterEvent(event)
	end
end

-- Returns false for an event this client does not know (modern clients throw
-- on RegisterEvent for unknown names; Forever is not Era or Retail).
function ns.RegisterEvent(event, fn)
	local list = gameHandlers[event]
	if not list then
		if not pcall(eventFrame.RegisterEvent, eventFrame, event) then
			if ns.Debug then ns.Debug("unknown event", event) end
			return false
		end
		list = {}
		gameHandlers[event] = list
	end
	for i = 1, #list do
		if list[i].fn == fn and list[i].live then return true end
	end
	list[#list + 1] = { fn = fn, live = true }
	return true
end

function ns.UnregisterEvent(event, fn)
	local list = gameHandlers[event]
	if not list then return end
	for i = 1, #list do
		if list[i].fn == fn then list[i].live = false end
	end
	if eventDepth > 0 then
		eventsDirty = true
	else
		settle(event)
	end
end

eventFrame:SetScript("OnEvent", function(_, event, ...)
	local list = gameHandlers[event]
	if not list then return end
	eventDepth = eventDepth + 1
	for i = 1, #list do
		local h = list[i]
		if h.live then call(h.fn, event, ...) end
	end
	eventDepth = eventDepth - 1
	if eventDepth == 0 and eventsDirty then
		eventsDirty = false
		local events = {}
		for ev in pairs(gameHandlers) do events[#events + 1] = ev end
		for i = 1, #events do settle(events[i]) end
	end
end)

---------------------------------------------------------------------------
-- Settings. Values equal to their default are not stored, so a changed
-- default reaches every user and the SavedVariables file stays small.
---------------------------------------------------------------------------

local defaults = {}
local pathKeys = {} -- "ui.scale" -> { "ui", "scale" }

local function keysOf(path)
	local keys = pathKeys[path]
	if not keys then
		keys = {}
		for key in path:gmatch("[^.]+") do keys[#keys + 1] = key end
		pathKeys[path] = keys
	end
	return keys
end

local function lookup(root, keys)
	local node = root
	for i = 1, #keys do
		if type(node) ~= "table" then return nil end
		node = node[keys[i]]
	end
	return node
end

local function DB()
	local db = PolestarDB
	if type(db) ~= "table" then
		db = { schema = 1 }
		PolestarDB = db
	end
	if type(db.settings) ~= "table" then db.settings = {} end
	return db
end
ns.DB = DB

function ns.RegisterDefaults(section, tbl)
	local d = defaults[section]
	if not d then
		d = {}
		defaults[section] = d
	end
	for k, v in pairs(tbl) do d[k] = v end
end

-- Values are shared, not copied: treat returned tables as read-only and Set a
-- new table to change one.
function ns.Get(path)
	local keys = keysOf(path)
	local v = lookup(DB().settings, keys)
	if v == nil then v = lookup(defaults, keys) end
	return v
end

function ns.GetDefault(path)
	return lookup(defaults, keysOf(path))
end

function ns.Set(path, value)
	local keys = keysOf(path)
	local node = DB().settings
	for i = 1, #keys - 1 do
		local k = keys[i]
		if type(node[k]) ~= "table" then node[k] = {} end
		node = node[k]
	end
	if value == lookup(defaults, keys) then value = nil end
	node[keys[#keys]] = value
	ns.Fire("SETTING_CHANGED", path, ns.Get(path))
end

-- Forget stored values for one section (or all), back to defaults.
function ns.ResetSettings(section)
	local settings = DB().settings
	if section then
		settings[section] = nil
	else
		for k in pairs(settings) do settings[k] = nil end
	end
	ns.Fire("SETTING_CHANGED", section or "", nil)
end

function ns.CharState()
	local s = PolestarCharDB
	if type(s) ~= "table" then
		s = {}
		PolestarCharDB = s
	end
	if s.schema == nil then s.schema = 1 end
	if type(s.manual) ~= "table" then s.manual = {} end
	if type(s.skipped) ~= "table" then s.skipped = {} end
	if type(s.flags) ~= "table" then s.flags = {} end
	return s
end

---------------------------------------------------------------------------
-- Lifecycle
---------------------------------------------------------------------------

local initQueue, loginQueue = {}, {}
local initialized, loggedIn = false, false

function ns.OnInit(fn)
	if initialized then call(fn) else initQueue[#initQueue + 1] = fn end
end

function ns.OnLogin(fn)
	if loggedIn then call(fn) else loginQueue[#loginQueue + 1] = fn end
end

function ns.IsLoggedIn() return loggedIn end

local function onAddonLoaded(_, name)
	if name ~= ADDON then return end
	ns.UnregisterEvent("ADDON_LOADED", onAddonLoaded)
	DB()
	ns.CharState()
	initialized = true
	local queue = initQueue
	initQueue = nil
	for i = 1, #queue do call(queue[i]) end
end

local function onLogin()
	ns.UnregisterEvent("PLAYER_LOGIN", onLogin)
	loggedIn = true
	local queue = loginQueue
	loginQueue = nil
	for i = 1, #queue do call(queue[i]) end
end

ns.RegisterEvent("ADDON_LOADED", onAddonLoaded)
ns.RegisterEvent("PLAYER_LOGIN", onLogin)

---------------------------------------------------------------------------
-- Chat output
---------------------------------------------------------------------------

local PREFIX = "|cff4fd1c5Polestar|r: "

function ns.Print(...)
	local n = select("#", ...)
	local parts = {}
	for i = 1, n do parts[i] = tostring((select(i, ...))) end
	DEFAULT_CHAT_FRAME:AddMessage(PREFIX .. table.concat(parts, " "))
end

ns.debug = false
function ns.Debug(...)
	if ns.debug then ns.Print("|cff8a8f98[debug]|r", ...) end
end

---------------------------------------------------------------------------
-- Slash commands: /polestar and /pole
---------------------------------------------------------------------------

local commands, commandOrder = {}, {}

function ns.RegisterCommand(name, fn, help)
	name = name:lower()
	if not commands[name] then commandOrder[#commandOrder + 1] = name end
	commands[name] = { fn = fn, help = help }
end

local function showHelp()
	ns.Print(L["Commands"])
	for i = 1, #commandOrder do
		local name = commandOrder[i]
		DEFAULT_CHAT_FRAME:AddMessage(("  /polestar %s  |cff8a8f98%s|r"):format(name, commands[name].help or ""))
	end
end

SLASH_POLESTAR1 = "/polestar"
SLASH_POLESTAR2 = "/pole"
SlashCmdList.POLESTAR = function(msg)
	local name, rest = (msg or ""):match("^%s*(%S*)%s*(.-)%s*$")
	if name == "" then
		ns.Fire("TOGGLE_FRAME")
		return
	end
	name = name:lower()
	if name == "help" then
		showHelp()
		return
	end
	local c = commands[name]
	if not c then
		ns.Print((L["Unknown command '%s'."]):format(name))
		showHelp()
		return
	end
	call(c.fn, rest)
end

ns.RegisterCommand("show", function() ns.Fire("SHOW_FRAME") end, L["Show the guide window"])
ns.RegisterCommand("hide", function() ns.Fire("HIDE_FRAME") end, L["Hide the guide window"])
ns.RegisterCommand("guides", function() ns.Fire("SHOW_PICKER") end, L["Choose a guide"])
ns.RegisterCommand("options", function(rest) ns.Fire("SHOW_OPTIONS", rest ~= "" and rest or nil) end, L["Open settings"])
ns.RegisterCommand("debug", function()
	ns.debug = not ns.debug
	ns.Print(L["Debug output"], ns.debug and L["on"] or L["off"])
end, L["Toggle debug output"])
