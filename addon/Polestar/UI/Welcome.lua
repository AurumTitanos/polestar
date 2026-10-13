-- The welcome: a small Polestar window, centred, that greets a character
-- Polestar has not seen before, with Back, Next and Skip:
--   1. Hello, <name>: the guide Polestar suggests for this character (its
--      level, race, class and zone), then the guide window, the arrow and
--      /polestar guides;
--   2. Our routes are still in beta: shown while ns.routesBeta is true;
--   3. Set up: quest automation (behavior.autoAccept and autoTurnin as one
--      switch), the guide at login (behavior.autoSelectGuide), the colour
--      scheme (ui.scheme);
--   4. Guide packs: what they are, how to install one, where they appear,
--      who supports them and the pack docs (ns.DocsURL); Start the suggested
--      guide (Choose a guide without one) or Browse guides.
--
-- Per character: PolestarCharDB.welcomeSeen, the welcome's version (SEEN).
-- A new character (ns.IsNewCharacter: no saved PolestarCharDB when Polestar
-- loaded) gets 0, so the welcome is due; a character with saved data and no
-- flag gets SEEN without seeing it, so nobody who already plays gets it
-- unasked. At login it opens while the character's flag is below SEEN, and
-- opening it sets the flag, so a /reload or a logout with it still up does
-- not bring it back; a due welcome that never opened (a logout in combat or
-- under the route choice) stays due for the next login.
--
-- Per account: PolestarDB.welcomeSeen, the account has had its welcome. Its
-- settings are account-wide, so Set up is in a welcome shown at login only
-- while the account's flag is below SEEN; a later character skips it. The
-- page set is fixed when a showing starts. Any close (Skip, Done, Start,
-- Browse guides, the header ✕, Escape) sets both flags. The beta notice's old
-- flag (betaNoticeSeen) is dropped.
--
-- It opens a moment after login, never in combat (it waits for the fight to
-- end), and never over the route choice: while that window is up the welcome
-- waits for it to close, and if a route choice opens over the welcome it
-- steps aside until it is done, then comes back on the page it left. About's
-- "Show the welcome again" and /polestar welcome (SHOW_WELCOME) open it with
-- every page.
--
-- Built on first use; colours are Theme tokens only.

local ADDON, ns = ...
local UI, Theme, W, Anim = ns.UI, ns.Theme, ns.Widgets, ns.Anim
local L = ns.L

local WEL = {}
UI.Welcome = WEL

local SEEN = 1 -- the welcome's version; a later welcome raises it
local WIDTH = 520
local PAD = 24
local CW = WIDTH - PAD * 2
local HEAD_H = 88
local FOOT_H = 56
local GAP = 16
local DELAY = 2 -- seconds after login, so the world and the other windows settle first

local F -- the window
local current = "welcome" -- the page shown (its key)
local pending -- nil | "login" (due at login) | "asked" (opened on request, or coming back), waiting for combat or the route choice
local stepping -- hidden to make way for the route choice, not closed
local full = true -- this showing has every page (false: Set up left out); fixed when it starts
local hookedRC

local function inCombat()
	return InCombatLockdown and InCombatLockdown() or false
end

-- This character has had its welcome.
local function seen()
	return (tonumber(ns.CharState().welcomeSeen) or 0) >= SEEN
end

-- This account has had its welcome.
local function accountSeen()
	return (tonumber(ns.DB().welcomeSeen) or 0) >= SEEN
end

local function routeChoiceUp()
	local RC = UI.RouteChoice
	return RC and RC.IsShown and RC.IsShown() or false
end

local function cmd(text)
	return "|c" .. Theme.Hex("text") .. text .. "|r"
end

-- A wrapped body paragraph block on the page's left edge.
local function bodyText(page, role, color)
	local fs = W.Text(page, role or "body", color or "textDim")
	fs:SetWidth(CW)
	fs:SetWordWrap(true)
	fs:SetSpacing(4)
	fs:SetJustifyH("LEFT")
	fs:SetJustifyV("TOP")
	return fs
end

local function place(region, y)
	region:ClearAllPoints()
	region:SetPoint("TOPLEFT", region:GetParent(), "TOPLEFT", 0, -y)
end

local function close()
	if F then F:Hide() end
end

---------------------------------------------------------------------------
-- Pages: build(page) once; layout(page) -> the page's height, on every show.
---------------------------------------------------------------------------

local PAGES = {}

-- The player as Polestar reads them; a field is nil when the client cannot say.
local function playerInfo()
	local C = ns.Compat
	local ok, info = pcall(C.GetPlayerInfo)
	return ok and type(info) == "table" and info or {}
end

local function known(s)
	return type(s) == "string" and s ~= "" and s or nil
end

-- "Polestar suggests <guide> for your level 1 Human Warrior in Elwynn
-- Forest.", leaving out what is unknown.
local function hello()
	local G = ns.Guides
	local id = G and G.Suggest and G.Suggest()
	local g = id and G.Get and G.Get(id)
	if not (g and known(g.title)) then
		return L["Polestar has no guide to suggest for where you are."]
	end
	local info = playerInfo()
	local race, class = known(UI.RaceName(info.race)), known(UI.ClassName(info.class))
	local level = tonumber(info.level)
	local who
	if race or class then
		who = race and class and (race .. " " .. class) or race or class
		if level then who = (L["level %d %s"]):format(level, who) end
	elseif level then
		who = (L["level %d character"]):format(level)
	end
	local zone = known((ns.Compat.GetZoneText()))
	-- A guide named for the zone already says where.
	if zone and g.title:lower():find(zone:lower(), 1, true) then zone = nil end
	local guide = cmd(g.title)
	if who and zone then return (L["Polestar suggests %s for your %s in %s."]):format(guide, who, zone) end
	if who then return (L["Polestar suggests %s for your %s."]):format(guide, who) end
	if zone then return (L["Polestar suggests %s for you in %s."]):format(guide, zone) end
	return (L["Polestar suggests %s for you."]):format(guide)
end

PAGES[#PAGES + 1] = {
	key = "welcome",
	title = function()
		local name = known(playerInfo().name)
		return name and (L["Hello, %s"]):format(name) or L["Welcome to Polestar"]
	end,
	build = function(p) p.Text = bodyText(p) end,
	layout = function(p)
		p.Text:SetText(table.concat({
			hello(),
			(L["%s shows the step you are on: who to talk to, what to kill or collect, and where to go. Goals tick themselves off as you do them."]):format(cmd(L["The guide window"])),
			(L["%s points the way, and the map marks each place."]):format(cmd(L["The arrow"])),
			(L["%s lets you pick another guide, open one in a new tab, or search them all."]):format(cmd("/polestar guides")),
		}, "\n\n"))
		place(p.Text, 0)
		return p.Text:GetStringHeight()
	end,
}

PAGES[#PAGES + 1] = {
	key = "beta",
	shown = function() return ns.routesBeta and true or false end,
	title = function() return L["Our routes are still in beta"] end,
	build = function(p) p.Text = bodyText(p) end,
	layout = function(p)
		p.Text:SetText(L["Polestar's leveling routes were planned and timed in a simulator and played to the end, for every class, in a test copy of the addon. Nobody has followed them through the live game yet, so expect the odd wrong step. Skip it (/polestar skip) and report it where you got Polestar."])
		place(p.Text, 0)
		return p.Text:GetStringHeight()
	end,
}

-- Quest automation is one switch for two settings: on while both are.
local function autoQuestGet()
	return ns.Get("behavior.autoAccept") and ns.Get("behavior.autoTurnin")
end

local function autoQuestSet(v)
	ns.Set("behavior.autoAccept", v)
	ns.Set("behavior.autoTurnin", v)
end

PAGES[#PAGES + 1] = {
	key = "setup",
	shown = function() return full end,
	title = function() return L["Set up"] end,
	build = function(p)
		p.Text = bodyText(p)
		F.AutoQuest = W.Toggle(p, L["Accept and turn in guide quests for me"], "behavior.autoAccept",
			L["Only quests in the next steps of your open guides. Never picks between rewards. Hold Shift to skip."], nil,
			{ get = autoQuestGet, set = autoQuestSet })
		F.AutoGuide = W.Toggle(p, L["Load a guide for me when I log in"], "behavior.autoSelectGuide",
			L["Opens the suggested guide when no tab is open."])
		F.Scheme = W.Dropdown(p, L["Colour scheme"], "ui.scheme", function() return Theme.SchemeChoices() end,
			L["How deep the night runs. Dusk is the default, Night the darkest, Graphite a neutral grey; EllesmereUI takes its panel colour and accent."])
		p.Rows = { F.AutoQuest, F.AutoGuide, F.Scheme }
	end,
	layout = function(p)
		p.Text:SetText((L["Three choices to start with. Everything else is in %s."]):format(cmd("/polestar options")))
		place(p.Text, 0)
		local y = p.Text:GetStringHeight() + 8
		for _, row in ipairs(p.Rows) do
			place(row, y)
			row:SetWidth(CW)
			row:Refresh()
			y = y + W.ROW_H
		end
		return y
	end,
}

local function startSuggested()
	local G, E = ns.Guides, ns.Engine
	local id = G and G.Suggest and G.Suggest()
	close()
	if id and E and E.OpenTab then
		E.OpenTab(id)
	elseif id and E and E.SetGuide then
		E.SetGuide(id)
	else
		UI.ShowPicker()
		return
	end
	ns.Fire("SHOW_FRAME")
end

PAGES[#PAGES + 1] = {
	key = "packs",
	title = function() return L["Guide packs"] end,
	build = function(p)
		p.Text = bodyText(p)
		p.DocsLabel = bodyText(p, "note")
		F.Docs = W.CopyBox(p)
		F.Docs:SetWidth(CW)
		F.Start = W.Button(p, "", startSuggested, { primary = true })
		F.Browse = W.Button(p, L["Browse guides"], function()
			close()
			UI.ShowPicker()
		end)
	end,
	layout = function(p)
		p.Text:SetText(table.concat({
			L["Guide packs are addons made by other players that add their own guides to Polestar."],
			(L["Install one like any other addon, then restart the game. Its guides appear in %s under Guide packs, and Options lists every pack you have."]):format(cmd("/polestar guides")),
			L["Each pack is made and supported by its author."],
		}, "\n\n"))
		place(p.Text, 0)
		local y = p.Text:GetStringHeight() + GAP
		local url = ns.DocsURL()
		p.DocsLabel:SetText(url and L["Write your own guide pack:"] or L["Write your own guide pack: see docs/PACKS.md in Polestar's source."])
		place(p.DocsLabel, y)
		y = y + p.DocsLabel:GetStringHeight() + 8
		F.Docs:SetShown(url ~= nil)
		if url then
			W.SetCopyText(F.Docs, url)
			place(F.Docs, y)
			y = y + F.Docs:GetHeight() + 8
		end
		y = y + GAP - 8
		-- Start the suggested guide; the button's width keeps both on the line.
		local G = ns.Guides
		local id = G and G.Suggest and G.Suggest()
		local g = id and G.Get and G.Get(id)
		if F.Start.lsFixedWidth then
			F.Start.lsFixedWidth = nil
			F.Start.Label:SetWidth(0) -- unbounded again
		end
		W.SetButtonText(F.Start, g and (L["Start %s"]):format(g.title) or L["Choose a guide"])
		local room = CW - F.Browse:GetWidth() - 8
		if F.Start:GetWidth() > room then
			F.Start.lsFixedWidth = room
			F.Start:SetWidth(room)
			F.Start.Label:SetWidth(room - 32)
			F.Start.Label:SetWordWrap(false)
		end
		place(F.Start, y)
		F.Browse:ClearAllPoints()
		F.Browse:SetPoint("LEFT", F.Start, "RIGHT", 8, 0)
		return y + F.Start:GetHeight()
	end,
}

-- The pages shown now, in order.
local function pageList()
	local out = {}
	for _, pg in ipairs(PAGES) do
		if not pg.shown or pg.shown() then out[#out + 1] = pg end
	end
	return out
end

---------------------------------------------------------------------------
-- The window
---------------------------------------------------------------------------

local render -- forward

local function go(delta)
	local list = pageList()
	local at = 1
	for i, pg in ipairs(list) do if pg.key == current then at = i end end
	local to = at + delta
	if to > #list then return close() end
	if to < 1 then to = 1 end
	current = list[to].key
	render()
	Anim.To(F.Body, "alpha", 0, 1, Anim.FAST, "out")
end

local function build()
	F = CreateFrame("Frame", "PolestarWelcome", UIParent)
	F:SetFrameStrata("DIALOG")
	F:SetToplevel(true)
	F:SetClampedToScreen(true)
	F:EnableMouse(true)
	F:SetMovable(true)
	F:SetWidth(WIDTH)
	F:SetPoint("CENTER", UIParent, "CENTER", 0, 0)
	F:Hide()
	Theme.Skin(F, "window")

	-- Header: the night sky, the emblem, the page's title and place.
	local head = CreateFrame("Frame", nil, F)
	head:SetPoint("TOPLEFT", F, "TOPLEFT", 1, -1)
	head:SetPoint("TOPRIGHT", F, "TOPRIGHT", -1, -1)
	head:SetHeight(HEAD_H)
	head:EnableMouse(true)
	head:RegisterForDrag("LeftButton")
	head:SetScript("OnDragStart", function() F:StartMoving() end)
	head:SetScript("OnDragStop", function() F:StopMovingOrSizing() end)
	F.Band = Theme.Band(head, "BACKGROUND", -5)
	F.Band:SetAllPoints(head)
	F.Band:SetTexCoord(Theme.BandCoords(WIDTH - 2, HEAD_H))
	F.Emblem = W.Tex(head, "ARTWORK", "emblem", "accent")
	F.Emblem:SetSize(34, 34)
	F.Emblem:SetPoint("TOPLEFT", head, "TOPLEFT", PAD, -30)
	F.Close = W.IconButton(head, "close", 28, L["Close"], close, 14)
	F.Close:SetPoint("TOPRIGHT", head, "TOPRIGHT", -12, -12)
	-- Longer titles truncate against the close button.
	F.Title = W.Text(head, "hero", "text")
	F.Title:SetPoint("TOPLEFT", F.Emblem, "TOPRIGHT", 14, 4)
	F.Title:SetPoint("RIGHT", F.Close, "LEFT", -8, 0)
	F.Title:SetJustifyH("LEFT")
	F.Title:SetWordWrap(false)
	F.Subtitle = W.Text(head, "note", "textDim")
	F.Subtitle:SetPoint("TOPLEFT", F.Title, "BOTTOMLEFT", 0, -8)

	-- Body: one page at a time, on the window's 24 edge.
	F.Body = CreateFrame("Frame", nil, F)
	F.Body:SetPoint("TOPLEFT", F, "TOPLEFT", PAD, -(HEAD_H + 20))
	F.Body:SetWidth(CW)
	F.pages = {}
	for _, pg in ipairs(PAGES) do
		local p = CreateFrame("Frame", nil, F.Body)
		p:SetPoint("TOPLEFT", F.Body, "TOPLEFT", 0, 0)
		p:SetWidth(CW)
		p:Hide()
		pg.build(p)
		F.pages[pg.key] = p
	end

	-- Footer: Skip on the left; Back and Next (Done on the last page) on the right.
	local foot = CreateFrame("Frame", nil, F)
	foot:SetPoint("BOTTOMLEFT", F, "BOTTOMLEFT", 1, 1)
	foot:SetPoint("BOTTOMRIGHT", F, "BOTTOMRIGHT", -1, 1)
	foot:SetHeight(FOOT_H)
	W.Fill(foot, "footer")
	local rule = W.Divider(foot)
	rule:SetPoint("TOPLEFT", foot, "TOPLEFT", 0, 0)
	rule:SetPoint("TOPRIGHT", foot, "TOPRIGHT", 0, 0)
	F.Skip = W.Button(foot, L["Skip"], close, { ghost = true })
	F.Skip:SetPoint("LEFT", foot, "LEFT", PAD, 0)
	F.Next = W.Button(foot, L["Next"], function() go(1) end, { primary = true })
	F.Next:SetPoint("RIGHT", foot, "RIGHT", -PAD, 0)
	F.Back = W.Button(foot, L["Back"], function() go(-1) end)
	F.Back:SetPoint("RIGHT", F.Next, "LEFT", -8, 0)

	F:SetScript("OnShow", function(self) Anim.To(self, "alpha", 0, 1, Anim.BASE, "out") end)
	-- Any close marks it seen, for the character and the account; stepping
	-- aside for the route choice does not.
	F:SetScript("OnHide", function()
		if stepping then return end
		ns.CharState().welcomeSeen = SEEN
		ns.DB().welcomeSeen = SEEN
		pending = nil
	end)
	if UISpecialFrames then tinsert(UISpecialFrames, "PolestarWelcome") end
	WEL.frame = F
end

function render()
	local list = pageList()
	local at
	for i, pg in ipairs(list) do if pg.key == current then at = i end end
	if not at then
		at = 1
		current = list[1].key
	end
	local pg = list[at]
	F.Title:SetText(pg.title())
	F.Subtitle:SetText((L["%d of %d"]):format(at, #list))
	for key, p in pairs(F.pages) do p:SetShown(key == current) end
	local h = pg.layout(F.pages[current])
	F.pages[current]:SetHeight(h)
	F.Body:SetHeight(h)
	F.Back:SetShown(at > 1)
	-- One primary per view: on the last page the guide buttons hold it.
	local last = at == #list
	W.SetButtonText(F.Next, last and L["Done"] or L["Next"])
	if F.Next.lsPrimary ~= not last then
		F.Next.lsPrimary = not last
		Theme.Repaint(F.Next)
		W.RepaintButton(F.Next)
	end
	F:SetHeight(HEAD_H + 20 + h + 24 + FOOT_H + 2)
end

local try -- forward; defined below

-- Wait for the route choice to close, then try again.
local function afterRouteChoice()
	local RC = UI.RouteChoice
	if not hookedRC and RC and RC.frame then
		hookedRC = true
		RC.frame:HookScript("OnHide", function() try() end)
	end
end

-- Open now on the current page, or as soon as combat and the route choice
-- allow. A showing at login starts on the first page, with Set up while the
-- account has not had its welcome.
local function open(why)
	if inCombat() then
		pending = pending == "asked" and "asked" or why
		return
	end
	if routeChoiceUp() then
		pending = pending == "asked" and "asked" or why
		afterRouteChoice()
		return
	end
	pending = nil
	if why == "login" then
		ns.CharState().welcomeSeen = SEEN -- shown: a reload or logout from here does not repeat it
		full = not accountSeen()
		current = PAGES[1].key
	end
	if not F then build() end
	render()
	F:Show()
	F:Raise()
end

-- Open the welcome at `page` (a page key: "welcome", "beta", "setup",
-- "packs"; or its number among the pages shown), the first by default, with
-- every page. Opens even when already seen (About, /polestar welcome, the
-- preview).
function WEL.Show(page)
	full = true
	local list = pageList()
	current = list[1].key
	if type(page) == "number" and list[page] then
		current = list[page].key
	elseif type(page) == "string" then
		for _, pg in ipairs(list) do if pg.key == page then current = page end end
	end
	open("asked")
end

function WEL.Hide()
	pending = nil
	if F then F:Hide() end
end

function WEL.IsShown()
	return F ~= nil and F:IsShown()
end

function try()
	if pending == "asked" or (pending and not seen()) then open(pending) end
end

-- A route choice opened over the welcome: step aside, come back after it
-- with the same pages.
local function yieldToRouteChoice()
	if not (F and F:IsShown() and routeChoiceUp()) then return end
	stepping = true
	F:Hide()
	stepping = nil
	pending = "asked"
	afterRouteChoice()
end

-- The character's flag, set as the addon loads: due (0) for a new character,
-- seen for one Polestar already knew, so only new characters get it unasked.
ns.OnInit(function()
	local s = ns.CharState()
	if s.welcomeSeen == nil then s.welcomeSeen = ns.IsNewCharacter() and 0 or SEEN end
end)

ns.OnLogin(function()
	local db = ns.DB()
	db.betaNoticeSeen = nil -- the beta notice's flag; the welcome has its own
	if seen() then return end
	pending = "login"
	if C_Timer and C_Timer.After then C_Timer.After(DELAY, try) else try() end
end)

-- RouteChoice.lua registers first, so its window is already up (or still
-- waiting out combat) when these run.
ns.RegisterEvent("PLAYER_REGEN_ENABLED", function()
	yieldToRouteChoice()
	try()
end)
ns.On("ROUTE_CHOICE", yieldToRouteChoice)
ns.On("SHOW_WELCOME", function(page) WEL.Show(page) end)

-- The quest switch stands for two settings; the widgets refresh it for the
-- one it is bound to (behavior.autoAccept), this for the other.
ns.On("SETTING_CHANGED", function(path)
	if path == "behavior.autoTurnin" and F and F.AutoQuest then F.AutoQuest:Refresh() end
end)
