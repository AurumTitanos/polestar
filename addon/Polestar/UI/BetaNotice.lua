-- The first-run beta notice: a small Polestar window, once per account, that
-- says plainly what this release is (a beta, made in about a day as a
-- community effort, not yet tested as long as established guides) and what
-- to do when a step looks wrong. One primary button ("Got it"), the header ✕
-- and Escape all close it, and closing it is what marks it seen
-- (PolestarDB.betaNoticeSeen, account-wide). About's "Why Polestar" says the
-- same in its beta paragraph, so it can be read again.
--
-- It opens a moment after login, never in combat (it waits for the fight to
-- end), and never over the route choice: while that window is up the notice
-- waits for it to close, and if a route choice opens over the notice the
-- notice steps aside until it is done. Nothing shows while ns.stage is nil.
--
-- Built on first use; colours are Theme tokens only.

local ADDON, ns = ...
local UI, Theme, W, Anim = ns.UI, ns.Theme, ns.Widgets, ns.Anim
local L = ns.L

local BN = {}
UI.BetaNotice = BN

local WIDTH = 440
local PAD = 24
local HEAD_H = 88
local FOOT_H = 56
local DELAY = 2 -- seconds after login, so the world and the other windows settle first

local F -- the window
local pending -- due, waiting for combat or the route choice to end
local stepping -- hidden to make way for the route choice, not closed
local hookedRC

function BN.Title() return L["Polestar is in beta"] end

function BN.Body()
	return L["Polestar was made in about 24 hours as a community effort. It hasn't had the long, careful testing that established guides have had, so expect the odd wrong step, waypoint or quest detail."]
		.. "\n\n" .. L["When something looks off, skip the step, pick another guide with /polestar guides, or report what you saw where you found Polestar so it can be fixed."]
end

local function inCombat()
	return InCombatLockdown and InCombatLockdown() or false
end

local function seen()
	return ns.DB().betaNoticeSeen == true
end

local function routeChoiceUp()
	local RC = UI.RouteChoice
	return RC and RC.IsShown and RC.IsShown() or false
end

local function build()
	F = CreateFrame("Frame", "PolestarBetaNotice", UIParent)
	F:SetFrameStrata("DIALOG")
	F:SetToplevel(true)
	F:SetClampedToScreen(true)
	F:EnableMouse(true)
	F:SetMovable(true)
	F:SetWidth(WIDTH)
	F:SetPoint("CENTER", UIParent, "CENTER", 0, 60)
	F:Hide()
	Theme.Skin(F, "window")

	-- Header: the night sky, the emblem, what this is.
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
	F.Title = W.Text(head, "hero", "text")
	F.Title:SetPoint("TOPLEFT", F.Emblem, "TOPRIGHT", 14, 4)
	F.Title:SetText(BN.Title())
	F.Subtitle = W.Text(head, "note", "textDim")
	F.Subtitle:SetPoint("TOPLEFT", F.Title, "BOTTOMLEFT", 0, -8)
	F.Subtitle:SetText(L["A community project"])
	F.Close = W.IconButton(head, "close", 28, L["Close"], function() F:Hide() end, 14)
	F.Close:SetPoint("TOPRIGHT", head, "TOPRIGHT", -12, -12)

	-- Body: the two paragraphs of BN.Body, on the window's 24 edge.
	F.Text = W.Text(F, "body", "textDim")
	F.Text:SetWidth(WIDTH - PAD * 2)
	F.Text:SetWordWrap(true)
	F.Text:SetSpacing(4)
	F.Text:SetJustifyH("LEFT")
	F.Text:SetJustifyV("TOP")
	F.Text:SetPoint("TOPLEFT", F, "TOPLEFT", PAD, -(HEAD_H + 20))
	F.Text:SetText(BN.Body())

	-- Footer: the one action.
	local foot = CreateFrame("Frame", nil, F)
	foot:SetPoint("BOTTOMLEFT", F, "BOTTOMLEFT", 1, 1)
	foot:SetPoint("BOTTOMRIGHT", F, "BOTTOMRIGHT", -1, 1)
	foot:SetHeight(FOOT_H)
	W.Fill(foot, "footer")
	local rule = W.Divider(foot)
	rule:SetPoint("TOPLEFT", foot, "TOPLEFT", 0, 0)
	rule:SetPoint("TOPRIGHT", foot, "TOPRIGHT", 0, 0)
	F.OK = W.Button(foot, L["Got it"], function() F:Hide() end, { primary = true })
	F.OK:SetPoint("RIGHT", foot, "RIGHT", -PAD, 0)

	F:SetScript("OnShow", function(self) Anim.To(self, "alpha", 0, 1, Anim.BASE, "out") end)
	-- Any close (the button, ✕, Escape) marks it seen; stepping aside for the
	-- route choice does not.
	F:SetScript("OnHide", function()
		if stepping then return end
		ns.DB().betaNoticeSeen = true
		pending = nil
	end)
	if UISpecialFrames then tinsert(UISpecialFrames, "PolestarBetaNotice") end
	BN.frame = F
end

local function layout()
	F:SetHeight(HEAD_H + 20 + F.Text:GetStringHeight() + 24 + FOOT_H + 2)
end

local try -- forward; defined below

-- Wait for the route choice to close, then try again.
local function afterRouteChoice()
	pending = true
	local RC = UI.RouteChoice
	if not hookedRC and RC and RC.frame then
		hookedRC = true
		RC.frame:HookScript("OnHide", function() try() end)
	end
end

-- Open the notice now (or as soon as combat and the route choice allow).
-- Opens even when already seen (the preview calls it directly).
function BN.Show()
	if inCombat() then
		pending = true
		return
	end
	if routeChoiceUp() then
		afterRouteChoice()
		return
	end
	pending = nil
	if not F then build() end
	layout()
	F:Show()
	F:Raise()
end

function BN.Hide()
	pending = nil
	if F then F:Hide() end
end

function BN.IsShown()
	return F ~= nil and F:IsShown()
end

function try()
	if pending and ns.stage and not seen() then BN.Show() end
end

-- A route choice opened over the notice: step aside, come back after it.
local function yieldToRouteChoice()
	if not (F and F:IsShown() and routeChoiceUp()) then return end
	stepping = true
	F:Hide()
	stepping = nil
	afterRouteChoice()
end

ns.OnLogin(function()
	if not ns.stage or seen() then return end
	pending = true
	if C_Timer and C_Timer.After then C_Timer.After(DELAY, try) else try() end
end)

-- RouteChoice.lua registers first, so its window is already up (or still
-- waiting out combat) when these run.
ns.RegisterEvent("PLAYER_REGEN_ENABLED", function()
	yieldToRouteChoice()
	try()
end)
ns.On("ROUTE_CHOICE", yieldToRouteChoice)
