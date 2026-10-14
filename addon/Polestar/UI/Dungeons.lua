-- The Dungeons section of the hub: a quest journal per dungeon and raid, laid
-- out the way DungeonJournal lays its pages out (every quest with where it
-- starts and ends, its objective, chain and rewards; the bosses with the
-- quests tied to them; the entrance), in Polestar's world. No loot tables.
-- Data: Polestar.Dungeons (Dungeons/Dungeons.lua) over the Codex pack, loaded
-- on first show; one dungeon page decoded at a time.
--
-- Home: the dungeons as cards in level order (the zone painting centred on
-- the entrance, name, levels, where, quests for the faction filter, a
-- Forever chip), two per line. The sidebar holds the level bands (For your
-- level, All dungeons, 10-20 ... 50-60, Raids) with counts; the faction
-- filter sits at the right of the tab row. Only the cards in view get their
-- painting; the rest are painted as they scroll in.
--
-- A dungeon page: the zone painting fills the header band with the name,
-- the facts, a back chevron and the actions: "Hand in the quests" (shown
-- while any of the page's quests is in the log, primary once one is
-- finished: a guide built by Dungeons.HandIn), "Pick up the quests" (primary
-- while there are quests to pick up and none to hand in: a guide built by
-- Dungeons.PickUp), each in a new tab, "Guide me to the entrance" (primary
-- otherwise, with "Nothing to pick up" saying why) and "Show on map"; the
-- tab row holds Quests, Bosses and Map.
--   Quests: one block per quest, hairlines between: the name in its
--   difficulty colour (lifted to 4.5:1 on the ground), this character's
--   state (done, in the log, ready, too low), level and requirement,
--   faction, shareable, picked up inside; a label column with the
--   objective, where it starts and ends (each with a pin that sets the
--   arrow; the whole Starts line is a link to the giver, or to the first
--   prerequisite still to do), the chain before it (one line per quest,
--   each with its own pin)
--   and the rewards (item icons in quality borders, "Choose one", XP, money,
--   reputation). Item hover shows the game's tooltip (Gear adds its upgrade
--   line there); modified clicks link or try it on.
--   Bosses: kill order, name, level and the quests each one serves.
--   Map: the entrance on its zone's painting, with the quest givers there.
-- Rows, blocks, tiles and cards are pooled and reused across pages.
--
-- Registered with UI.RegisterSection; opened by SHOW_DUNGEON(key).

local ADDON, ns = ...
local UI, Theme, W = ns.UI, ns.Theme, ns.Widgets
local L = ns.L
local floor, max, min, type, ipairs, pairs, tostring, format, pcall = math.floor, math.max, math.min, type, ipairs, pairs, tostring, string.format, pcall
local lower, find, concat = string.lower, string.find, table.concat
local ZoneArt = UI.ZoneArt

local SH = W.SHELL
local PAD = SH.pad -- every text edge in the column
local GUT = PAD / 2 -- state glyphs in the gutter
local CARD_X = PAD - 12 -- card grounds; their text sits on the 32 edge
local CARD_GAP = 16
local CARD_ART = 72
local CARD_H = CARD_ART + 40
local LABEL_W = 88 -- a quest's label column
local VALUE_X = PAD + LABEL_W
local TILE_W, TILE_H, TILE_GAP = 200, 32, 8
local CHAIN_H = 26
local TIE_H = 24
local MAP_H = 360
local DOT = "  \194\183  "

local DS = {}
UI.DungeonsSection = DS

local BANDS = {
	{ key = "10", lo = 10, hi = 20 },
	{ key = "20", lo = 20, hi = 30 },
	{ key = "30", lo = 30, hi = 40 },
	{ key = "40", lo = 40, hi = 50 },
	{ key = "50", lo = 50, hi = 60 },
}
local FACTIONS = { "Alliance", "Horde", "All" }
local SIDE = { Alliance = "A", Horde = "H" }

local band -- the sidebar's key; nil until the first render picks one
local page -- the dungeon shown, nil on Home
local tab = "quests"
local filter = ""
local root, hub, home, pg, segs
local cards, heads, blocks, bossRows, ties, givers = {}, {}, {}, {}, {}, {}
local listCache
local shown = {} -- what the last render put up, for tests and the preview

local function D() return ns.Dungeons end

---------------------------------------------------------------------------
-- Helpers
---------------------------------------------------------------------------

local secret = ns.Compat.IsSecret

local function mainWidth()
	local w = hub and (hub:GetWidth() - (hub.psRail or 0) - SH.sidebar - 2) or 0
	if w <= 0 then w = 878 end
	return w
end

local function viewHeight()
	local h = hub and hub:GetHeight() or 0
	if h <= 0 then h = SH.height end
	return h - SH.top
end

local function uiState()
	local s = ns.CharState()
	if type(s.ui) ~= "table" then s.ui = {} end
	return s.ui
end

local function factionKey()
	local f = uiState().dungeonsFaction
	if f ~= "Alliance" and f ~= "Horde" and f ~= "All" then f = UI.PlayerFaction() or "All" end
	return f
end

local function playerLevel()
	local C = ns.Compat
	local info = C and C.GetPlayerInfo and C.GetPlayerInfo()
	return info and info.level or 1
end

local function thousands(n)
	local s = tostring(floor(n or 0))
	local out = s:reverse():gsub("(%d%d%d)", "%1,"):reverse()
	if out:sub(1, 1) == "," then out = out:sub(2) end
	return out
end

local function money(copper)
	local LK = UI.Lookup
	if LK and LK.Money then return LK.Money(copper) end
	return nil
end

-- r, g, b moved toward the text colour until it reads at 4.5:1 on the
-- lightest ground (Theme.Legible).
local lift = Theme.Legible

local function hexOf(r, g, b)
	return format("ff%02x%02x%02x", floor(r * 255 + 0.5), floor(g * 255 + 0.5), floor(b * 255 + 0.5))
end

-- The client's difficulty colour for a quest level, as the quest log draws
-- it (GetQuestDifficultyColor; its QuestDifficultyColors by level gap
-- otherwise), lifted.
local function difficulty(level, plevel)
	local r, g, b
	if type(level) == "number" then
		if GetQuestDifficultyColor then
			local ok, c = pcall(GetQuestDifficultyColor, level)
			if ok and type(c) == "table" and type(c.r) == "number" and not secret(c.r) then r, g, b = c.r, c.g, c.b end
		end
		local t = not r and QuestDifficultyColors
		if type(t) == "table" then
			local d = level - plevel
			local key
			if d >= 5 then key = "impossible"
			elseif d >= 3 then key = "verydifficult"
			elseif d >= -4 then key = "difficult"
			else
				local C = ns.Compat
				key = (C and C.IsQuestTrivial and C.IsQuestTrivial(level, plevel)) and "trivial" or "standard"
			end
			local c = t[key]
			if type(c) == "table" and type(c.r) == "number" then r, g, b = c.r, c.g, c.b end
		end
	end
	if not r then r, g, b = Theme.Color("quest") end
	return lift(r, g, b)
end

local function paintRGB(fs, r, g, b)
	W.Uncolor(fs)
	fs:SetTextColor(r, g, b, 1)
end

-- The client's colour for an item quality (unlifted, for borders), or nil.
local function qualityRaw(q)
	if type(q) ~= "number" then return nil end
	local C = C_Item
	if C and C.GetItemQualityColor then
		local ok, r, g, b = pcall(C.GetItemQualityColor, q)
		if ok and type(r) == "number" and not secret(r) then return r, g, b end
	end
	local t = ITEM_QUALITY_COLORS and ITEM_QUALITY_COLORS[q]
	if type(t) == "table" and type(t.r) == "number" then return t.r, t.g, t.b end
	return nil
end

local function itemIcon(id)
	local C = C_Item
	if type(id) ~= "number" or not (C and C.GetItemIconByID) then return nil end
	local ok, icon = pcall(C.GetItemIconByID, id)
	if ok and icon and not secret(icon) then return icon end
	return nil
end

local mapName = ns.Compat.MapName

local function bandOf(level)
	if type(level) ~= "number" then return nil end
	for i = #BANDS, 1, -1 do
		if level >= BANDS[i].lo then return BANDS[i].key end
	end
	return BANDS[1].key
end

local function bandLabel(key)
	for _, b in ipairs(BANDS) do
		if b.key == key then return UI.LevelRange(b.lo, b.hi) end
	end
	return key
end

local function forYou(d, plevel)
	if d.kind == "raid" or not d.minLevel then return false end
	return plevel >= d.minLevel - 2 and plevel <= (d.maxLevel or d.minLevel)
end

-- Quests on a page for the filter ("All": both factions).
local function questCount(d, f)
	local q = d.quests or {}
	if f == "All" then return max(q.A or 0, q.H or 0), q.A or 0, q.H or 0 end
	return q[SIDE[f]] or 0
end

-- For your level under the filter: a dungeon whose quests are all the other
-- faction's is theirs, not yours.
local function forYouAs(d, plevel, f)
	if not forYou(d, plevel) then return false end
	if f == "All" then return true end
	local q = d.quests or {}
	return (q[SIDE[f]] or 0) > 0 or ((q.A or 0) == 0 and (q.H or 0) == 0)
end

local function list()
	if not listCache then listCache = D().List() end
	return listCache
end

-- The cards a sidebar key shows, in level order.
local function entries(key, plevel, f)
	local out = {}
	local q = filter ~= "" and lower(filter) or nil
	for _, d in ipairs(list()) do
		local ok
		if q then
			ok = find(lower(d.name), q, 1, true) ~= nil
		elseif key == "level" then
			ok = forYouAs(d, plevel, f)
		elseif key == "raid" then
			ok = d.kind == "raid"
		elseif key == "all" then
			ok = d.kind ~= "raid"
		else
			ok = d.kind ~= "raid" and bandOf(d.minLevel) == key
		end
		if ok then out[#out + 1] = d end
	end
	return out
end

-- Quest state for this character: "done", "ready", "log", "low", "open".
local function questState(q, plevel)
	local C = ns.Compat
	if C and q.id then
		if C.IsQuestCompleted and C.IsQuestCompleted(q.id) then return "done" end
		if C.IsOnQuest and C.IsOnQuest(q.id) then
			if C.IsQuestReadyForTurnIn and C.IsQuestReadyForTurnIn(q.id) then return "ready" end
			return "log"
		end
	end
	if q.minLevel and plevel < q.minLevel then return "low" end
	return "open"
end

local STATE_GLYPH = {
	done = { "check", "success" }, ready = { "icon-turnin", "success" }, log = { "icon-turnin", "quest" },
	low = { "lock", "textMuted" }, open = { "icon-accept", "quest" },
}

local function stateChip(state, q)
	if state == "done" then return L["Done"], "success" end
	if state == "ready" then return L["Ready to turn in"], "success" end
	if state == "log" then return L["In your log"], "neutral" end
	if state == "low" then return format(L["From level %d"], q.minLevel), "neutral" end
	return nil
end

local POINT_COLOR = { npc = "npc", object = "object", item = "item" }

-- "Nalpak  ·  The Barrens", coloured; "inside the dungeon" when it is.
local function pointText(p)
	if type(p) ~= "table" then return "|c" .. Theme.Hex("textMuted") .. L["Not known"] .. "|r" end
	local name = p.name or L["Not known"]
	local text = "|c" .. Theme.Hex(POINT_COLOR[p.kind] or "npc") .. name .. "|r"
	local place
	if p.inside then
		place = "|c" .. Theme.Hex("dungeon") .. L["inside the dungeon"] .. "|r"
	else
		local z = mapName(p.map)
		if z then place = "|c" .. Theme.Hex("textDim") .. z .. "|r" end
	end
	if place then text = text .. "|c" .. Theme.Hex("textMuted") .. DOT .. "|r" .. place end
	return text
end

local function canGuide(p)
	return type(p) == "table" and p.map and p.x and p.y and ns.Nav and true or false
end

local function guideTo(self)
	local p = self.psPoint
	local Dg = D()
	if p and Dg and Dg.GuideToPoint then Dg.GuideToPoint(p, self.psLabel) end
end

-- The Starts line as one link over its pin and text: the arrow to the giver,
-- or to the first prerequisite still to do.
local function linkEnter(self)
	local p = self.psPin
	if p:IsEnabled() then W.Color(p.Icon, "text") end
	W.SimpleTip(self)
end

local function linkLeave(self)
	local p = self.psPin
	W.Color(p.Icon, "textDim", p:IsEnabled() and 1 or 0.35)
	W.HideTip(self)
end

---------------------------------------------------------------------------
-- Pools
---------------------------------------------------------------------------

local function textShadow(fs)
	W.Painter(fs, function(t)
		local r, g, b = Theme.Color("shade")
		t:SetShadowOffset(0, -1)
		t:SetShadowColor(r, g, b, 0.85)
	end)
	return fs
end

-- A quest block's own chips, chain rows and tiles, kept on the block.
local function chip(b, i)
	local c = b.Chips[i]
	if not c then
		c = W.Chip(b)
		b.Chips[i] = c
	end
	return c
end

local function pin(parent, tip)
	local b = W.IconButton(parent, "icon-goto", 22, tip or L["Set the arrow here"], guideTo, 12)
	return b
end

local function card(i)
	local c = cards[i]
	if c then return c end
	local cw = floor((mainWidth() - CARD_X * 2 - CARD_GAP) / 2)
	c = CreateFrame("Button", nil, home.Body)
	c:SetSize(cw, CARD_H)
	Theme.Skin(c, "button")
	W.Hover(c)
	c.Art = ZoneArt.Create(c, cw - 2, CARD_ART, "panel")
	c.Art:SetPoint("TOPLEFT", c, "TOPLEFT", 1, -1)
	c.Art.psZoom = 1.6
	c.Name = textShadow(W.Text(c.Art.Over, "title", "text"))
	c.Name:SetPoint("BOTTOMLEFT", c.Art, "BOTTOMLEFT", PAD - CARD_X - 1, 10)
	c.Name:SetWidth(cw - (PAD - CARD_X) * 2)
	c.Stats = W.Text(c, "small", "textDim")
	c.Stats:SetPoint("LEFT", c, "TOPLEFT", PAD - CARD_X, -(CARD_ART + 20))
	c.Forever = W.Chip(c)
	c.Yours = W.Chip(c)
	c:SetScript("OnClick", function(self) DS.Open(self.psKey) end)
	cards[i] = c
	return c
end

local function head(i)
	local h = heads[i]
	if h then return h end
	h = W.SectionHeader(home.Body)
	heads[i] = h
	return h
end

local function chainRow(b, i)
	local r = b.Chains[i]
	if r then return r end
	r = CreateFrame("Frame", nil, b)
	r:SetHeight(CHAIN_H)
	-- A done step is checked; the others get a quiet bullet (the title's
	-- difficulty colour already speaks).
	r.Glyph = W.Tex(r, "ARTWORK", "circle", "textMuted")
	r.Glyph:SetPoint("CENTER", r, "LEFT", 10, 0)
	r.Title = W.Text(r, "label", "text")
	r.Title:SetPoint("LEFT", r, "LEFT", 24, 0)
	r.Sub = W.Text(r, "small", "textMuted")
	r.Sub:SetPoint("LEFT", r.Title, "RIGHT", 10, 0)
	r.Pin = pin(r)
	r.Pin:SetPoint("LEFT", r.Sub, "RIGHT", 2, 0)
	b.Chains[i] = r
	return r
end

local function tileEnter(self)
	if not (self.psID and GameTooltip) then return end
	GameTooltip:SetOwner(self, "ANCHOR_RIGHT")
	GameTooltip:SetHyperlink("item:" .. self.psID)
	GameTooltip:Show()
end

local function tileLeave(self)
	W.HideTooltip(self)
end

-- Shift-click links it in chat, Ctrl-click tries it on (the client's own
-- modified-click handling).
local function tileClick(self)
	if not (self.psID and IsModifiedClick and IsModifiedClick() and HandleModifiedItemClick and C_Item and C_Item.GetItemInfo) then return end
	local ok, _, link = pcall(C_Item.GetItemInfo, self.psID)
	if ok and link and not secret(link) then HandleModifiedItemClick(link) end
end

local function tile(b, i)
	local t = b.Tiles[i]
	if t then return t end
	t = CreateFrame("Button", nil, b)
	t:SetSize(TILE_W, TILE_H)
	W.Hover(t)
	t.Well = CreateFrame("Frame", nil, t)
	t.Well:SetSize(TILE_H, TILE_H)
	t.Well:SetPoint("LEFT", t, "LEFT", 0, 0)
	t.Well.Ground = W.Fill(t.Well, "scrim", "BACKGROUND", 0)
	t.Icon = t.Well:CreateTexture(nil, "ARTWORK")
	t.Icon:SetPoint("TOPLEFT", t.Well, "TOPLEFT", 1, -1)
	t.Icon:SetPoint("BOTTOMRIGHT", t.Well, "BOTTOMRIGHT", -1, 1)
	t.Name = W.Text(t, "label", "item")
	t.Name:SetPoint("LEFT", t.Well, "RIGHT", 10, 0)
	t.Name:SetWidth(TILE_W - TILE_H - 14)
	t:SetScript("OnEnter", tileEnter)
	t:SetScript("OnLeave", tileLeave)
	t:SetScript("OnClick", tileClick)
	b.Tiles[i] = t
	return t
end

local function label(parent, text)
	local fs = W.Text(parent, "small", "textMuted")
	fs:SetText(text or "")
	fs:SetJustifyH("LEFT")
	return fs
end

local function block(i)
	local b = blocks[i]
	if b then return b end
	b = CreateFrame("Frame", nil, pg.Body)
	b.Chains, b.Tiles, b.Chips = {}, {}, {}
	b.Glyph = W.Tex(b, "ARTWORK", "icon-accept", "quest")
	b.Glyph:SetSize(14, 14)
	b.Glyph:SetPoint("CENTER", b, "TOPLEFT", GUT, -30)
	b.Title = W.Text(b, "title", "quest")
	b.Title:SetPoint("LEFT", b, "TOPLEFT", PAD, -30)
	b.Faction = W.Chip(b)
	b.State = W.Chip(b)
	b.Meta = W.Text(b, "small", "textMuted")
	b.Meta:SetPoint("TOPLEFT", b, "TOPLEFT", PAD, -46)
	b.ObjLabel = label(b, L["Objective"])
	b.Obj = W.Text(b, "note", "text")
	b.Obj:SetWordWrap(true)
	b.Obj:SetJustifyV("TOP")
	b.StartLabel = label(b, L["Starts"])
	b.StartPin = pin(b)
	b.Start = W.Text(b, "label", "text")
	b.StartLink = CreateFrame("Button", nil, b)
	b.StartLink:SetHeight(22)
	b.StartLink:SetFrameLevel(b.StartPin:GetFrameLevel() + 1)
	W.Hover(b.StartLink)
	b.StartLink.psPin = b.StartPin
	b.StartLink:SetScript("OnClick", guideTo)
	b.StartLink:SetScript("OnEnter", linkEnter)
	b.StartLink:SetScript("OnLeave", linkLeave)
	b.EndLabel = label(b, L["Ends"])
	b.EndPin = pin(b)
	b.End = W.Text(b, "label", "text")
	b.ChainLabel = label(b, L["Chain"])
	b.ChooseLabel = label(b, L["Choose one"])
	b.GetLabel = label(b, L["You get"])
	b.MoreLabel = label(b, L["Rewards"])
	b.Rule = W.Divider(b)
	b.Rule:SetPoint("BOTTOMLEFT", b, "BOTTOMLEFT", PAD, 0)
	b.Rule:SetPoint("BOTTOMRIGHT", b, "BOTTOMRIGHT", -PAD, 0)
	blocks[i] = b
	return b
end

local function bossRow(i)
	local r = bossRows[i]
	if r then return r end
	r = CreateFrame("Frame", nil, pg.Body)
	r.Num = W.Text(r, "number", "textMuted")
	r.Num:SetJustifyH("CENTER")
	r.Num:SetWidth(PAD)
	r.Num:SetPoint("CENTER", r, "TOPLEFT", GUT, -24)
	r.Name = W.Text(r, "title", "text")
	r.Name:SetPoint("LEFT", r, "TOPLEFT", PAD, -24)
	r.Level = W.Text(r, "small", "textMuted")
	r.Level:SetPoint("LEFT", r.Name, "RIGHT", 10, 0)
	r.Rule = W.Divider(r)
	r.Rule:SetPoint("BOTTOMLEFT", r, "BOTTOMLEFT", PAD, 0)
	r.Rule:SetPoint("BOTTOMRIGHT", r, "BOTTOMRIGHT", -PAD, 0)
	bossRows[i] = r
	return r
end

local function tie(i)
	local t = ties[i]
	if t then return t end
	t = CreateFrame("Button", nil, pg.Body)
	t:SetHeight(TIE_H)
	W.Hover(t)
	t.Glyph = W.Tex(t, "ARTWORK", "icon-kill", "textDim")
	t.Glyph:SetSize(12, 12)
	t.Glyph:SetPoint("LEFT", t, "LEFT", 4, 0)
	t.Text = W.Text(t, "label", "textDim")
	t.Text:SetPoint("LEFT", t, "LEFT", 24, 0)
	t:SetScript("OnClick", function(self) DS.ShowQuest(self.psQuest) end)
	t:SetScript("OnEnter", W.SimpleTip)
	t:SetScript("OnLeave", W.HideTip)
	t.psTip = L["Show the quest"]
	ties[i] = t
	return t
end

-- A place marker on a painting: a dark well under a ring and dot.
local function marker(parent, glyph, color, size)
	local m = CreateFrame("Frame", nil, parent)
	m:SetSize(size, size)
	m.Well = m:CreateTexture(nil, "ARTWORK")
	m.Well:SetTexture(Theme.Media("circle"))
	m.Well:SetAllPoints(m)
	W.Painter(m.Well, function(t)
		local r, g, b = Theme.Color("scrim")
		t:SetVertexColor(r, g, b, 0.78)
	end)
	m.Glyph = W.Tex(m, "OVERLAY", glyph, color)
	m.Glyph:SetSize(size - 6, size - 6)
	m.Glyph:SetPoint("CENTER", m, "CENTER", 0, 0)
	return m
end

local function entranceMarker(parent)
	local m = marker(parent, "qol-ring", "dungeon", 24)
	m.Dot = W.Tex(m, "OVERLAY", "circle", "dungeon")
	m.Dot:SetSize(7, 7)
	m.Dot:SetPoint("CENTER", m, "CENTER", 0, 0)
	return m
end

local function placeOn(m, art, x, y)
	local cw, ch = art.Canvas:GetWidth(), art.Canvas:GetHeight()
	m:ClearAllPoints()
	m:SetPoint("CENTER", art.Canvas, "TOPLEFT", (x or 50) / 100 * cw, -(y or 50) / 100 * ch)
end

local function giverEnter(self)
	W.Tooltip(self, "ANCHOR_TOP", self.psName, self.psLines)
end

local function giver(i)
	local g = givers[i]
	if g then return g end
	g = marker(pg.MapArt, "icon-accept", "quest", 20)
	g:SetFrameLevel(pg.MapArt.Over:GetFrameLevel() + 2)
	g:EnableMouse(true)
	g:SetScript("OnEnter", giverEnter)
	g:SetScript("OnLeave", W.HideTip)
	givers[i] = g
	return g
end

---------------------------------------------------------------------------
-- Build
---------------------------------------------------------------------------

-- The header painting's left side darkens toward the title.
local function scrim(parent)
	local t = parent:CreateTexture(nil, "BACKGROUND", nil, 1)
	t:SetTexture(Theme.Media("white"))
	W.Painter(t, function(tex)
		local r, g, b = Theme.Color("scrim")
		if tex.SetGradient and CreateColor then
			tex:SetVertexColor(1, 1, 1, 1)
			tex:SetGradient("HORIZONTAL", CreateColor(r, g, b, 0.72), CreateColor(r, g, b, 0))
		else
			tex:SetVertexColor(r, g, b, 0.4)
		end
	end)
	return t
end

local function restoreHeader()
	if not hub then return end
	hub.Title:SetAlpha(1)
	hub.Subtitle:SetAlpha(1)
	hub.Band:Show()
end

local function segPaint(f)
	for _, b in ipairs(segs) do
		local on = b.psKey == f
		b.Selected:SetShown(on)
		W.Color(b.Label, on and "text" or "textMuted")
	end
end

function DS.Build(parent, shell)
	if root then return root end
	hub = shell
	root = CreateFrame("Frame", nil, parent)
	root:SetAllPoints(parent)
	local MW = mainWidth()

	home = CreateFrame("Frame", nil, root)
	home:SetAllPoints(root)
	-- The emblem engraving, behind an empty state only (the shell's own sits
	-- under the guide list, hidden while a section shows).
	home.Watermark = home:CreateTexture(nil, "BACKGROUND", nil, -4)
	home.Watermark:SetTexture(Theme.Media("watermark"))
	home.Watermark:SetSize(300, 300)
	home.Watermark:SetPoint("CENTER", home, "CENTER", 0, 0)
	W.Painter(home.Watermark, function(t) t:SetVertexColor(Theme.Wash("watermark")) end)
	home.Watermark:Hide()
	home.Scroll = W.Scroll(home)
	home.Scroll:SetPoint("TOPLEFT", home, "TOPLEFT", 0, 0)
	home.Scroll:SetPoint("BOTTOMRIGHT", home, "BOTTOMRIGHT", -4, 4)
	home.Body = home.Scroll.Child
	home.Body:SetWidth(MW)
	home.Scroll:HookScript("OnVerticalScroll", function() DS.PaintVisible() end)
	home.Scroll:HookScript("OnMouseWheel", function() DS.PaintVisible() end)
	home.EmptyTitle = W.Text(home.Body, "display", "text")
	home.EmptyTitle:SetPoint("TOPLEFT", home.Body, "TOPLEFT", PAD, -28)
	home.EmptyNote = W.Text(home.Body, "note", "textDim")
	home.EmptyNote:SetWordWrap(true)
	home.EmptyNote:SetJustifyV("TOP")
	home.EmptyNote:SetWidth(min(520, MW - PAD * 2))
	home.EmptyNote:SetPoint("TOPLEFT", home.EmptyTitle, "BOTTOMLEFT", 0, -10)

	pg = CreateFrame("Frame", nil, root)
	pg:SetAllPoints(root)
	pg.Scroll = W.Scroll(pg)
	pg.Scroll:SetPoint("TOPLEFT", pg, "TOPLEFT", 0, 0)
	pg.Scroll:SetPoint("BOTTOMRIGHT", pg, "BOTTOMRIGHT", -4, 4)
	pg.Body = pg.Scroll.Child
	pg.Body:SetWidth(MW)
	pg.Scroll:HookScript("OnVerticalScroll", function() DS.PaintQuests() end)
	pg.Scroll:HookScript("OnMouseWheel", function() DS.PaintQuests() end)
	-- Measures objectives before any block is drawn.
	pg.Measure = W.Text(pg, "note", "text")
	pg.Measure:SetWordWrap(true)
	pg.Measure:Hide()

	-- The header painting, in the shell's header band under its close.
	local art = ZoneArt.Create(pg, MW, SH.header, "bg")
	art.psZoom = 1.5
	art:SetPoint("TOPLEFT", hub.Header, "TOPLEFT", 0, 0)
	pg.Art = art
	art.Rule:Hide() -- the tab row draws the line under the band
	art.Scrim = scrim(art.Over)
	art.Scrim:SetPoint("TOPLEFT", art, "TOPLEFT", 0, 0)
	art.Scrim:SetPoint("BOTTOMLEFT", art, "BOTTOMLEFT", 0, 0)
	art.Scrim:SetWidth(floor(MW * 0.62))
	art.Entrance = entranceMarker(art)
	art.Entrance:SetFrameLevel(art.Over:GetFrameLevel() + 1)
	local over = CreateFrame("Frame", nil, art)
	over:SetAllPoints(art)
	over:SetFrameLevel(art.Over:GetFrameLevel() + 2)
	pg.Over = over
	pg.Back = W.IconButton(over, "chevron-left", 24, L["All dungeons"], function() DS.Home() end, 12)
	pg.Back:SetPoint("CENTER", art, "TOPLEFT", GUT, -46)
	pg.Title = textShadow(W.Text(over, "hero", "text"))
	pg.Title:SetPoint("TOPLEFT", art, "TOPLEFT", PAD, -32)
	pg.Forever = W.Chip(over)
	pg.Forever:SetPoint("LEFT", pg.Title, "RIGHT", 12, 0)
	pg.Sub = textShadow(W.Text(over, "note", "textDim"))
	pg.Sub:SetPoint("TOPLEFT", pg.Title, "BOTTOMLEFT", 0, -8)
	-- The actions, right to left from the band's corner (pageHeader places
	-- them): the primary one is "Hand in the quests" while quests here are
	-- finished, else "Pick up the quests" while there are quests to pick up,
	-- else "Guide me to the entrance".
	pg.HandIn = W.Button(over, L["Hand in the quests"], function() DS.HandIn() end, { primary = true, height = 28, icon = "icon-turnin" })
	pg.HandInQuiet = W.Button(over, L["Hand in the quests"], function() DS.HandIn() end, { height = 28, icon = "icon-turnin" })
	pg.Pickup = W.Button(over, L["Pick up the quests"], function() DS.PickUp() end, { primary = true, height = 28, icon = "icon-accept" })
	pg.PickupQuiet = W.Button(over, L["Pick up the quests"], function() DS.PickUp() end, { height = 28, icon = "icon-accept" })
	pg.PickupNone = W.Button(over, L["Nothing to pick up"], function() DS.PickUp() end, { height = 28 })
	pg.Go = W.Button(over, L["Guide me to the entrance"], function() DS.GuideThere() end, { primary = true, height = 28, icon = "icon-goto" })
	pg.Go.psTip = L["Set the arrow to the entrance."]
	pg.GoQuiet = W.Button(over, L["Guide me to the entrance"], function() DS.GuideThere() end, { height = 28, icon = "icon-goto" })
	pg.GoQuiet.psTip = pg.Go.psTip
	pg.MapBtn = W.Button(over, L["Show on map"], function() DS.ShowOnMap() end, { height = 28 })

	pg.MapArt = ZoneArt.Create(pg.Body, MW - PAD * 2, MAP_H, "bg")
	pg.MapArt.psZoom = 1
	pg.MapArt:SetPoint("TOPLEFT", pg.Body, "TOPLEFT", PAD, -24)
	pg.MapArt.Entrance = entranceMarker(pg.MapArt)
	pg.MapArt.Entrance:SetFrameLevel(pg.MapArt.Over:GetFrameLevel() + 3)
	pg.MapNote = W.Text(pg.Body, "note", "textDim")
	pg.MapNote:SetWordWrap(true)
	pg.MapNote:SetJustifyV("TOP")
	pg.MapNote:SetWidth(MW - PAD * 2)
	pg.MapNote:SetPoint("TOPLEFT", pg.MapArt, "BOTTOMLEFT", 0, -14)
	pg.EmptyTitle = W.Text(pg.Body, "display", "text")
	pg.EmptyNote = W.Text(pg.Body, "note", "textDim")
	pg.EmptyNote:SetWordWrap(true)
	pg.EmptyNote:SetJustifyV("TOP")
	pg.EmptyNote:SetWidth(min(520, MW - PAD * 2))
	pg.EmptyNote:SetPoint("TOPLEFT", pg.EmptyTitle, "BOTTOMLEFT", 0, -10)

	-- The faction filter, at the right of the tab row (the guide menu's
	-- segments), this character's faction first.
	segs = {}
	local order = { "Alliance", "Horde", "All" }
	if UI.PlayerFaction() == "Horde" then order = { "Horde", "Alliance", "All" } end
	local x = -(SH.pad - 12)
	for i = #order, 1, -1 do
		local f = order[i]
		local b = CreateFrame("Button", nil, hub.TabRow)
		b:SetHeight(24)
		b.psKey = f
		W.Hover(b)
		b.Selected = W.Fill(b, "panelAlt", "BACKGROUND", 0)
		b.Label = W.Text(b, "small", "textMuted")
		b.Label:SetPoint("CENTER", b, "CENTER", 0, 0)
		b.Label:SetText(L[f])
		b:SetWidth(floor(b.Label:GetStringWidth() + 20 + 0.5))
		b:SetPoint("RIGHT", hub.TabRow, "RIGHT", x, 0)
		b:SetScript("OnClick", function(self) DS.SetFaction(self.psKey) end)
		b.psTip = L["Faction filter"]
		b:SetScript("OnEnter", W.SimpleTip)
		b:SetScript("OnLeave", W.HideTip)
		b:Hide()
		x = x - b:GetWidth() - 2
		segs[i] = b
	end

	root:SetScript("OnHide", function()
		restoreHeader()
		for _, b in ipairs(segs) do b:Hide() end
	end)
	return root
end

---------------------------------------------------------------------------
-- Home
---------------------------------------------------------------------------

local function hidePool(pool, from)
	for i = from or 1, #pool do pool[i]:Hide() end
end

-- Paint the cards in view (and one line past it); the rest wait.
function DS.PaintVisible()
	if not (home and home:IsShown()) then return end
	local top = home.Scroll:GetVerticalScroll() or 0
	local view = viewHeight()
	for i = 1, (home.psCount or 0) do
		local c = cards[i]
		local key = c.psKey
		if c.psPainted ~= key and c.psY < top + view + CARD_H and c.psY + CARD_H > top - CARD_H then
			local d = c.psEntry
			local e = d.entrance
			c.psArt = ZoneArt.Paint(c.Art, e and e.map or d.zone, e and e.x, e and e.y, i)
			c.psPainted = key
			shown.painted = (shown.painted or 0) + 1
		end
	end
end

local function navItems(plevel, f)
	local items = {}
	local counts, level, all, raids = {}, 0, 0, 0
	for _, d in ipairs(list()) do
		if d.kind == "raid" then
			raids = raids + 1
		else
			all = all + 1
			local k = bandOf(d.minLevel)
			if k then counts[k] = (counts[k] or 0) + 1 end
			if forYouAs(d, plevel, f) then level = level + 1 end
		end
	end
	items[1] = { key = "level", label = L["For your level"], icon = "qol-target", count = level }
	items[2] = { key = "all", label = L["All dungeons"], icon = "icon-dungeon", count = all }
	for _, b in ipairs(BANDS) do
		items[#items + 1] = { key = b.key, label = bandLabel(b.key), icon = "icon-level", count = counts[b.key] or 0 }
	end
	if raids > 0 then items[#items + 1] = { key = "raid", label = L["Raids"], icon = "icon-kill", count = raids } end
	return items, level
end

local function defaultBand(plevel)
	if band then return band end
	local _, level = navItems(plevel, factionKey())
	return level > 0 and "level" or "all"
end

local function paintCard(c, d, f, plevel, key)
	c.psKey, c.psEntry = d.key, d
	c.Name:SetText(d.name)
	local facts = {}
	local lv = UI.LevelRange(d.minLevel, d.maxLevel)
	if lv then facts[#facts + 1] = lv end
	if d.zoneName then facts[#facts + 1] = d.zoneName end
	local n, a, h = questCount(d, f)
	if f == "All" and a ~= h and a > 0 and h > 0 then
		facts[#facts + 1] = format(L["%d Alliance, %d Horde quests"], a, h)
	elseif f == "All" and a ~= h then
		local k = max(a, h)
		if k == 1 then
			facts[#facts + 1] = a > 0 and L["1 Alliance quest"] or L["1 Horde quest"]
		else
			facts[#facts + 1] = format(a > 0 and L["%d Alliance quests"] or L["%d Horde quests"], k)
		end
	elseif n == 0 then
		facts[#facts + 1] = f == "All" and L["No quests known"] or format(L["No %s quests"], L[f])
	else
		facts[#facts + 1] = n == 1 and L["1 quest"] or format(L["%d quests"], n)
	end
	c.Stats:SetText(concat(facts, DOT))
	local cw = c:GetWidth()
	local right = PAD - CARD_X
	-- Under For your level every card is; elsewhere the chip marks them.
	if key ~= "level" and forYou(d, plevel) then
		local w = W.SetChip(c.Yours, L["Your level"], "accent")
		c.Yours:ClearAllPoints()
		c.Yours:SetPoint("RIGHT", c, "TOPRIGHT", -right, -(CARD_ART + 20))
		right = right + w + 6
	else
		c.Yours:Hide()
	end
	if d.forever then
		local w = W.SetChip(c.Forever, L["Forever"])
		c.Forever:ClearAllPoints()
		c.Forever:SetPoint("RIGHT", c, "TOPRIGHT", -right, -(CARD_ART + 20))
		right = right + w + 6
	else
		c.Forever:Hide()
	end
	c.Stats:SetWidth(max(60, cw - (PAD - CARD_X) - right - 6))
	W.Color(c.Stats, n > 0 and "textDim" or "textMuted")
end

local function renderHome(plevel)
	home:Show()
	pg:Hide()
	restoreHeader()
	hub.psKeepTabRow = true
	W.ShellTabs(hub, nil)
	hub.psKeepTabRow = nil
	local f = factionKey()
	local key = defaultBand(plevel)
	local rows = entries(key, plevel, f)
	-- The header: where you are and what the grid holds.
	local title, sub
	if filter ~= "" then
		title = L["Search"]
		sub = #rows == 1 and format(L["1 result for \226\128\156%s\226\128\157"], filter) or format(L["%d results for \226\128\156%s\226\128\157"], #rows, filter)
	elseif key == "level" then
		title = L["For your level"]
		sub = format(#rows == 1 and L["Level %d  \194\183  1 dungeon to run now"] or L["Level %d  \194\183  %d dungeons to run now"], plevel, #rows)
	elseif key == "raid" then
		title = L["Raids"]
		sub = #rows == 1 and L["1 raid"] or format(L["%d raids"], #rows)
	elseif key == "all" then
		title = L["Dungeons"]
		sub = format(L["%d dungeons  \194\183  every quest, where it starts and what it gives"], #rows)
	else
		title = format(L["Levels %s"], bandLabel(key))
		sub = #rows == 1 and L["1 dungeon"] or format(L["%d dungeons"], #rows)
	end
	W.ShellTitle(hub, title, sub)
	home.Watermark:SetShown(#rows == 0)

	local MW = mainWidth()
	local cw = floor((MW - CARD_X * 2 - CARD_GAP) / 2)
	local y = 20
	local nh, col, lastBand = 0, 0, nil
	for i, d in ipairs(rows) do
		-- Under All, the level bands head their cards.
		if key == "all" and filter == "" then
			local b = bandOf(d.minLevel) or "other"
			if b ~= lastBand then
				if col == 1 then y = y + CARD_H + CARD_GAP end
				col = 0
				nh = nh + 1
				local h = head(nh)
				h:ClearAllPoints()
				h:SetPoint("TOPLEFT", home.Body, "TOPLEFT", PAD, -(y - 20))
				h:SetWidth(MW - PAD * 2)
				W.SetSection(h, b == "other" and L["Level not known"] or format(L["Levels %s"], bandLabel(b)))
				h:Show()
				y = y + 34
				lastBand = b
			end
		end
		local c = card(i)
		paintCard(c, d, f, plevel, filter ~= "" and "search" or key)
		c.psY = y
		c:ClearAllPoints()
		c:SetPoint("TOPLEFT", home.Body, "TOPLEFT", CARD_X + col * (cw + CARD_GAP), -y)
		c:Show()
		if col == 1 then
			y = y + CARD_H + CARD_GAP
			col = 0
		else
			col = 1
		end
	end
	if col == 1 then y = y + CARD_H + CARD_GAP end
	home.psCount = #rows
	hidePool(cards, #rows + 1)
	hidePool(heads, nh + 1)
	local empty = #rows == 0
	home.EmptyTitle:SetShown(empty)
	home.EmptyNote:SetShown(empty)
	if empty then
		home.EmptyTitle:SetText(filter ~= "" and L["No dungeon by that name"] or L["Nothing here yet"])
		home.EmptyNote:SetText(filter ~= "" and L["Try part of the name, such as \226\128\156caverns\226\128\157."] or L["No dungeon in this band is known yet."])
		y = 120
	end
	W.SetScrollContent(home.Scroll, y + 8)
	shown.view, shown.band, shown.cards, shown.heads, shown.painted = "home", key, #rows, nh, 0
	DS.PaintVisible()
end

---------------------------------------------------------------------------
-- A dungeon page
---------------------------------------------------------------------------

local function pageHeader(d)
	local art = pg.Art
	local e = d.entrance
	local painted = ZoneArt.Paint(art, e and e.map or d.zone, e and e.x, e and e.y, 1)
	if painted and e and e.map then
		placeOn(art.Entrance, art, e.x, e.y)
		art.Entrance:Show()
	else
		art.Entrance:Hide()
	end
	art:Show()
	hub.Band:Hide()
	hub.Title:SetAlpha(0)
	hub.Subtitle:SetAlpha(0)
	hub.Close:SetFrameLevel(pg.Over:GetFrameLevel() + 2)
	local facts = {}
	local lv = UI.LevelRange(d.minLevel, d.maxLevel)
	if lv then facts[#facts + 1] = format(L["Levels %s"], lv) end
	local z = d.zoneName or (e and mapName(e.map))
	if z then facts[#facts + 1] = z end
	if d.players then facts[#facts + 1] = format(L["%d players"], d.players) end
	if (d.bosses or 0) > 0 then facts[#facts + 1] = d.bosses == 1 and L["1 boss"] or format(L["%d bosses"], d.bosses) end
	local sub = concat(facts, DOT)
	W.ShellTitle(hub, d.name, sub)
	pg.Title:SetText(d.name)
	pg.Sub:SetText(sub)
	local MW = mainWidth()
	if d.forever then
		W.SetChip(pg.Forever, L["Forever"])
	else
		pg.Forever:Hide()
	end
	-- The actions, right to left: the primary first.
	local go = e ~= nil and ns.Nav ~= nil
	local Dg, LKm = D(), ns.Lookup
	local plan = LKm and LKm.Guide and Dg.PickupPlan and Dg.PickupPlan(d.key) or nil
	local hplan = LKm and LKm.Guide and Dg.HandinPlan and Dg.HandinPlan(d.key) or nil
	local take = plan and #plan.take or 0
	local hand = hplan and #hplan.hand or 0
	local logged = hplan and hand + #hplan.unfinished + #hplan.inside + #hplan.unplaced or 0
	local lead = hand > 0 and "handin" or take > 0 and "pickup" or "go"
	local side = SIDE[UI.PlayerFaction() or ""]
	local none = plan ~= nil and take == 0 and #Dg.Quests(d.key, side) > 0 and lead == "go"
	if take > 0 then
		local lines = { format(take == 1 and L["A guide to the 1 quest here you can take, with what comes before it, ending at the entrance."]
			or L["A guide to the %d quests here you can take, with what comes before them, ending at the entrance."], take) }
		local carried = #plan.carried
		if carried > 0 then lines[#lines + 1] = carried == 1 and L["1 more is in your log already."] or format(L["%d more are in your log already."], carried) end
		lines[#lines + 1] = L["It opens in a new tab."]
		for _, b in ipairs({ pg.Pickup, pg.PickupQuiet }) do b.psTip, b.psTipLines = L["Pick up the quests"], lines end
	elseif none then
		pg.PickupNone.psTip, pg.PickupNone.psTipLines = L["Nothing to pick up"], { DS.NothingText(plan) }
	end
	if logged > 0 then
		local lines
		if hand > 0 then
			lines = { format(hand == 1 and L["A guide to where the 1 finished quest here is turned in, and the follow-ups it opens there."]
				or L["A guide to where the %d finished quests here are turned in, and the follow-ups they open there."], hand) }
			if logged > hand then lines[#lines + 1] = Dg.HandinText(hplan) end
			lines[#lines + 1] = L["It opens in a new tab."]
		else
			lines = { Dg.HandinText(hplan) }
		end
		for _, b in ipairs({ pg.HandIn, pg.HandInQuiet }) do b.psTip, b.psTipLines = L["Hand in the quests"], lines end
	end
	pg.HandIn:SetShown(lead == "handin")
	pg.HandInQuiet:SetShown(lead ~= "handin" and logged > 0)
	pg.Pickup:SetShown(lead == "pickup")
	pg.PickupQuiet:SetShown(lead == "handin" and take > 0)
	pg.PickupNone:SetShown(none)
	pg.Go:SetShown(go and lead == "go")
	pg.GoQuiet:SetShown(go and lead ~= "go")
	pg.MapBtn:SetShown(e ~= nil and OpenWorldMap ~= nil)
	-- In priority order; three at most, so the facts keep their room (the
	-- Map tab shows the entrance too).
	local order = lead == "handin" and { pg.HandIn, pg.PickupQuiet, pg.GoQuiet, pg.MapBtn }
		or lead == "pickup" and { pg.Pickup, pg.HandInQuiet, pg.GoQuiet, pg.MapBtn }
		or { pg.Go, pg.HandInQuiet, pg.PickupNone, pg.MapBtn }
	local prev, used, n = nil, 0, 0
	for _, b in ipairs(order) do
		if b:IsShown() and n == 3 then b:Hide() end
		if b:IsShown() then
			n = n + 1
			b:ClearAllPoints()
			if prev then
				b:SetPoint("RIGHT", prev, "LEFT", -8, 0)
				used = used + 8
			else
				b:SetPoint("BOTTOMRIGHT", art, "BOTTOMRIGHT", -(PAD - 12), 14)
			end
			used = used + b:GetWidth()
			prev = b
		end
	end
	pg.Title:SetWidth(min(floor(pg.Title:GetStringWidth() + 1), MW - PAD * 2 - 140))
	pg.Sub:SetWidth(MW - PAD - 24 - used - (PAD - 12))
end

-- Why a page has nothing to pick up, in one sentence.
function DS.NothingText(plan)
	local text = L["Nothing to pick up before the run: the quests here for you are done, already in your log, or start inside the dungeon or later in their chain."]
	local later = plan and plan.later or 0
	if later > 0 then
		text = text .. " " .. (later == 1 and L["1 more opens at a later level."] or format(L["%d more open at a later level."], later))
	end
	return text
end

local function emptyPage(title, text, y)
	pg.EmptyTitle:ClearAllPoints()
	pg.EmptyTitle:SetPoint("TOPLEFT", pg.Body, "TOPLEFT", PAD, -y)
	pg.EmptyTitle:SetText(title)
	pg.EmptyTitle:Show()
	pg.EmptyNote:SetText(text)
	pg.EmptyNote:Show()
	return y + 24 + 10 + pg.EmptyNote:GetStringHeight() + 24
end

-- Where each part of a quest block goes, from the data alone (the objective
-- measured on one shared string), so every block is placed before any is
-- drawn and only the ones in view are.
local function rewardExtras(rw)
	local extras = {}
	if rw.xp and rw.xp > 0 then extras[#extras + 1] = format(L["%s XP"], thousands(rw.xp)) end
	local m = rw.money and money(rw.money)
	if m then extras[#extras + 1] = m end
	for _, r in ipairs(rw.rep or {}) do
		if r.value and r.value ~= 0 then
			extras[#extras + 1] = format(r.value > 0 and "+%d %s" or "%d %s", r.value, r.name or L["Reputation"])
		end
	end
	return extras
end

local function tilesPer()
	return max(1, floor((mainWidth() - VALUE_X - PAD + TILE_GAP) / (TILE_W + TILE_GAP)))
end

local function tilesHeight(n)
	if n == 0 then return 0 end
	local per = tilesPer()
	return floor((n + per - 1) / per) * (TILE_H + 6) - 6
end

local function plan(q)
	local VW = mainWidth() - VALUE_X - PAD
	local p = {}
	local y = 66
	if q.objective then
		p.obj = y
		local m = pg.Measure
		m:SetWidth(min(VW, 620))
		m:SetText(q.objective)
		y = y + max(16, m:GetStringHeight()) + 12
	end
	p.starts = y
	y = y + 22 + 12
	local nChain = #(q.chain or {})
	if nChain > 0 then
		p.chain = y
		y = y + nChain * CHAIN_H + 10
	end
	local rw = q.rewards or {}
	local nChoice, nGet = 0, 0
	for _, it in ipairs(rw.items or {}) do if it.choice then nChoice = nChoice + 1 else nGet = nGet + 1 end end
	if nChoice > 0 then
		p.choose = y
		y = y + tilesHeight(nChoice) + 10
	end
	if nGet > 0 then
		p.get = y
		y = y + tilesHeight(nGet) + 10
	end
	p.extras = rewardExtras(rw)
	if #p.extras > 0 then
		p.more = y
		y = y + W.CHIP_H + 4
	end
	p.h = y + 18
	return p
end

-- Item tiles across the value column at y in the block; -> how many.
local function placeTiles(b, n0, items, choice, y)
	local per = tilesPer()
	local n = 0
	for _, it in ipairs(items) do
		if (it.choice and true or false) == choice then
			local t = tile(b, n0 + n + 1)
			local col, line = n % per, floor(n / per)
			t:ClearAllPoints()
			t:SetPoint("TOPLEFT", b, "TOPLEFT", VALUE_X + col * (TILE_W + TILE_GAP), -(y + line * (TILE_H + 6)))
			t.psID = it.id
			local icon = itemIcon(it.id)
			if icon then
				t.Icon:SetTexture(icon)
				t.Icon:SetTexCoord(0.08, 0.92, 0.08, 0.92)
				W.Uncolor(t.Icon)
				t.Icon:SetVertexColor(1, 1, 1, 1)
			else
				t.Icon:SetTexture(Theme.Media("icon-collect"))
				t.Icon:SetTexCoord(0, 1, 0, 1)
				W.Color(t.Icon, "textMuted")
			end
			local qr, qg, qb = qualityRaw(it.quality)
			if qr then
				Theme.Border(t.Well, qr, qg, qb, 0.9)
				paintRGB(t.Name, lift(qr, qg, qb))
			else
				local ir, ig, ib = Theme.Wash("border")
				Theme.Border(t.Well, ir, ig, ib, 0.6)
				W.Color(t.Name, "item")
			end
			t.Name:SetText(it.name or (L["Item"] .. " " .. tostring(it.id)))
			t:Show()
			n = n + 1
		end
	end
	return n
end

local function labelAt(fs, y)
	if not y then
		fs:Hide()
		return
	end
	fs:ClearAllPoints()
	fs:SetPoint("TOPLEFT", fs:GetParent(), "TOPLEFT", PAD, -y)
	fs:Show()
end

-- One quest block at top in the body, laid out by its plan p.
local function paintQuest(b, q, p, top, plevel, key)
	local MW = mainWidth()
	local VW = MW - VALUE_X - PAD
	b:ClearAllPoints()
	b:SetPoint("TOPLEFT", pg.Body, "TOPLEFT", 0, -top)
	b:SetWidth(MW)
	b:SetHeight(p.h)
	b.psQuest = q.id
	local state = questState(q, plevel)
	local g = STATE_GLYPH[state]
	b.Glyph:SetTexture(Theme.Media(g[1]))
	W.Color(b.Glyph, g[2])
	b.Title:SetText(q.title or (L["Quest"] .. " " .. tostring(q.id)))
	-- Done: the muted text colour (held legible), its chip says so.
	if state == "done" then W.Color(b.Title, "textMuted") else paintRGB(b.Title, difficulty(q.level, plevel)) end
	-- Right of the title line: the state, then the faction mark.
	local right = PAD
	local text, kind = stateChip(state, q)
	if text then
		local w = W.SetChip(b.State, text, kind)
		b.State:ClearAllPoints()
		b.State:SetPoint("RIGHT", b, "TOPRIGHT", -right, -30)
		right = right + w + 6
	else
		b.State:Hide()
	end
	if q.faction then
		local w = W.SetChip(b.Faction, q.faction == "A" and L["Alliance"] or L["Horde"])
		b.Faction:ClearAllPoints()
		b.Faction:SetPoint("RIGHT", b, "TOPRIGHT", -right, -30)
		right = right + w + 6
	else
		b.Faction:Hide()
	end
	b.Title:SetWidth(max(80, min(floor(b.Title:GetStringWidth() + 1), MW - PAD - right - 12)))
	-- Level, requirement and flags.
	local meta = {}
	if q.level then meta[#meta + 1] = format(L["Level %d"], q.level) end
	if q.minLevel then meta[#meta + 1] = format(L["Requires level %d"], q.minLevel) end
	if q.classes and #q.classes > 0 then meta[#meta + 1] = format(L["%s only"], UI.ClassList(q.classes)) end
	if q.inside then meta[#meta + 1] = L["Picked up inside the dungeon"] end
	if q.shareable == true then meta[#meta + 1] = L["Shareable"] elseif q.shareable == false then meta[#meta + 1] = L["Not shareable"] end
	b.Meta:SetText(concat(meta, DOT))
	b.Meta:SetWidth(MW - PAD * 2)
	-- Objective.
	labelAt(b.ObjLabel, p.obj and p.obj + 1)
	if p.obj then
		b.Obj:ClearAllPoints()
		b.Obj:SetPoint("TOPLEFT", b, "TOPLEFT", VALUE_X, -p.obj)
		b.Obj:SetWidth(min(VW, 620))
		b.Obj:SetText(q.objective)
		b.Obj:Show()
	else
		b.Obj:Hide()
	end
	-- Starts and ends, side by side.
	local y = p.starts
	local half = floor((VW - 16) / 2)
	local s = q.start
	if q.startItem and not (s and s.kind == "item") then s = { kind = "item", name = q.startItem.name, map = s and s.map, x = s and s.x, y = s and s.y, f = s and s.f, inside = s and s.inside } end
	labelAt(b.StartLabel, y + 4)
	b.StartPin:ClearAllPoints()
	b.StartPin:SetPoint("TOPLEFT", b, "TOPLEFT", VALUE_X - 4, -y)
	-- The arrow goes to the first prerequisite still to do, else the giver.
	local Dg = D()
	local target, tlabel, first, turnIn
	if key and Dg.GiverTarget then target, tlabel, first, turnIn = Dg.GiverTarget(key, q.id) end
	if not first then target, tlabel = s, s and s.name end
	local go = canGuide(target)
	b.StartPin.psPoint, b.StartPin.psLabel = target, tlabel
	W.SetIconState(b.StartPin, false, go)
	local link = b.StartLink
	link.psPoint, link.psLabel = target, tlabel
	link:SetEnabled(go)
	if not go then
		link.psTip, link.psTipLines = L["Not known"], { L["Where this quest starts is not known yet."] }
	elseif first then
		link.psTip = format(L["Set the arrow to %s"], tlabel or L["the quest giver"])
		link.psTipLines = { format(turnIn and L["First turn in %s, which comes before this quest."] or L["First pick up %s, which comes before this quest."], first) }
	else
		link.psTip = format(L["Set the arrow to %s"], tlabel or L["the quest giver"])
		link.psTipLines = { L["Where this quest starts."] }
	end
	b.StartPin.psTip, b.StartPin.psTipLines = link.psTip, link.psTipLines
	b.Start:ClearAllPoints()
	b.Start:SetPoint("LEFT", b.StartPin, "RIGHT", 4, 0)
	b.Start:SetWidth(half - 24)
	local startText = pointText(s)
	if s and s.kind == "item" and key then
		-- An item that starts it: the boss it drops from, when one does.
		for _, boss in ipairs(D().Bosses(key)) do
			for _, t in ipairs(boss.quests or {}) do
				if t.id == q.id and t.how == "starts" then
					startText = "|c" .. Theme.Hex("item") .. (s.name or "") .. "|r|c" .. Theme.Hex("textMuted") .. DOT .. "|r|c" .. Theme.Hex("textDim") .. format(L["drops from %s"], boss.name) .. "|r"
				end
			end
		end
	end
	b.Start:SetText(startText)
	link:ClearAllPoints()
	link:SetPoint("LEFT", b.StartPin, "LEFT", 0, 0)
	link:SetWidth(26 + min(half - 24, floor(b.Start:GetStringWidth() + 1)))
	link:Show()
	local fin = q.finish
	b.EndLabel:ClearAllPoints()
	b.EndLabel:SetPoint("TOPLEFT", b, "TOPLEFT", VALUE_X + half + 16, -(y + 4))
	b.EndPin:ClearAllPoints()
	b.EndPin:SetPoint("TOPLEFT", b, "TOPLEFT", VALUE_X + half + 16 + 40, -y)
	b.EndPin.psPoint, b.EndPin.psLabel = fin, fin and fin.name
	W.SetIconState(b.EndPin, false, canGuide(fin))
	b.End:ClearAllPoints()
	b.End:SetPoint("LEFT", b.EndPin, "RIGHT", 4, 0)
	b.End:SetWidth(half - 40 - 24)
	b.End:SetText(pointText(fin))
	-- The chain before it, oldest first, each with its own pin.
	local nChain = 0
	labelAt(b.ChainLabel, p.chain and p.chain + 6)
	if p.chain then
		y = p.chain
		for _, id in ipairs(q.chain) do
			local cq = D().Quest(key, id) or { id = id }
			nChain = nChain + 1
			local r = chainRow(b, nChain)
			r:ClearAllPoints()
			r:SetPoint("TOPLEFT", b, "TOPLEFT", VALUE_X - 4, -y)
			r:SetWidth(VW + 4)
			local cs = questState(cq, plevel)
			if cs == "done" then
				r.Glyph:SetTexture(Theme.Media("check"))
				r.Glyph:SetSize(12, 12)
				W.Color(r.Glyph, "success")
			else
				r.Glyph:SetTexture(Theme.Media("circle"))
				r.Glyph:SetSize(5, 5)
				W.Color(r.Glyph, "textMuted")
			end
			r.Title:SetText(cq.title or (L["Quest"] .. " " .. tostring(id)))
			if cs == "done" then W.Color(r.Title, "textMuted") else paintRGB(r.Title, difficulty(cq.level, plevel)) end
			local sub = {}
			if cq.level then sub[#sub + 1] = format(L["Level %d"], cq.level) end
			local st = cq.start
			if st and st.name then
				local z = st.inside and L["inside the dungeon"] or mapName(st.map)
				sub[#sub + 1] = z and format(L["%s, %s"], st.name, z) or st.name
			end
			r.Sub:SetText(concat(sub, DOT))
			local room = VW + 4 - 24 - 30
			local tw = min(floor(r.Title:GetStringWidth() + 1), floor(room * 0.55))
			r.Title:SetWidth(tw)
			r.Sub:SetWidth(max(40, min(floor(r.Sub:GetStringWidth() + 1), room - tw - 10)))
			r.Pin.psPoint, r.Pin.psLabel = st, st and st.name
			W.SetIconState(r.Pin, false, canGuide(st))
			r:Show()
			y = y + CHAIN_H
		end
	end
	hidePool(b.Chains, nChain + 1)
	-- Rewards: the choice, the items you get, then XP, money and reputation.
	local items = (q.rewards or {}).items or {}
	local nTiles = 0
	labelAt(b.ChooseLabel, p.choose and p.choose + 10)
	if p.choose then nTiles = nTiles + placeTiles(b, nTiles, items, true, p.choose) end
	labelAt(b.GetLabel, p.get and p.get + 10)
	if p.get then nTiles = nTiles + placeTiles(b, nTiles, items, false, p.get) end
	hidePool(b.Tiles, nTiles + 1)
	labelAt(b.MoreLabel, p.more and not (p.choose or p.get) and p.more + 4 or nil)
	local x = VALUE_X
	for i, e in ipairs(p.extras) do
		local c = chip(b, i)
		local w = W.SetChip(c, e, "neutral")
		c:ClearAllPoints()
		c:SetPoint("TOPLEFT", b, "TOPLEFT", x, -p.more)
		x = x + w + 6
	end
	hidePool(b.Chips, #p.extras + 1)
	b:Show()
end

-- The current quests pass: the list, each block's plan and top, which
-- blocks are drawn.
local qpass = { quests = {}, plans = {}, tops = {}, painted = {}, key = nil, plevel = 1 }

-- Draw the blocks in view (and a screen past it); the rest wait.
function DS.PaintQuests()
	if not (pg and pg:IsShown() and tab == "quests" and qpass.key) then return end
	local top = pg.Scroll:GetVerticalScroll() or 0
	local view = viewHeight()
	local n = 0
	for i, q in ipairs(qpass.quests) do
		local y, p = qpass.tops[i], qpass.plans[i]
		if not qpass.painted[i] and y < top + view * 2 and y + p.h > top - view / 2 then
			paintQuest(block(i), q, p, y, qpass.plevel, qpass.key)
			qpass.painted[i] = true
		end
		if qpass.painted[i] then n = n + 1 end
	end
	shown.blocks = n
end

local function renderQuests(key, f, plevel)
	local side = SIDE[f]
	local qs = D().Quests(key, side)
	hidePool(blocks)
	qpass.quests, qpass.key, qpass.plevel = qs, key, plevel
	local plans, tops = {}, {}
	local y = 0
	for i, q in ipairs(qs) do
		local p = plan(q)
		plans[i], tops[i] = p, y
		y = y + p.h
	end
	qpass.plans, qpass.tops, qpass.painted = plans, tops, {}
	if #qs == 0 then
		local other = 0
		if side then other = #D().Quests(key, side == "A" and "H" or "A") end
		local text = L["No quests are known for this dungeon yet."]
		if other > 0 then
			local them = side == "A" and L["Horde"] or L["Alliance"]
			text = other == 1 and format(L["1 quest here is for the %s. Switch the filter to All to see it."], them)
				or format(L["%d quests here are for the %s. Switch the filter to All to see them."], other, them)
		end
		y = emptyPage(L["No quests for you here"], text, 28)
	end
	shown.quests = #qs
	return y + 16
end

local TIE = {
	kill = { "icon-kill", "Kill it for %s" },
	item = { "icon-collect", "Drops %s for %s" },
	starts = { "icon-accept", "Drops %s, which starts %s" },
	involved = { "icon-note", "Part of %s" },
}

local function renderBosses(key, f, plevel)
	local side = SIDE[f]
	local MW = mainWidth()
	local y, nt = 0, 0
	local bosses = D().Bosses(key)
	for i, boss in ipairs(bosses) do
		local r = bossRow(i)
		r:ClearAllPoints()
		r:SetPoint("TOPLEFT", pg.Body, "TOPLEFT", 0, -y)
		r:SetWidth(MW)
		r.Num:SetText(tostring(boss.order or i))
		r.Name:SetText(boss.name or L["Boss"])
		r.Level:SetText(boss.level and format(L["Level %d"], boss.level) or "")
		local h = 48
		local n = 0
		for _, t in ipairs(boss.quests or {}) do
			local q = D().Quest(key, t.id)
			if q and (not side or not q.faction or q.faction == side) then
				nt = nt + 1
				n = n + 1
				local row = tie(nt)
				local spec = TIE[t.how] or TIE.involved
				row.Glyph:SetTexture(Theme.Media(spec[1]))
				local qh = "|c" .. hexOf(difficulty(q.level, plevel)) .. (q.title or "") .. "|r"
				local ih = "|c" .. Theme.Hex("item") .. (t.itemName or L["an item"]) .. "|r"
				if t.how == "item" or t.how == "starts" then
					row.Text:SetText(format(L[spec[2]], ih, qh))
				else
					row.Text:SetText(format(L[spec[2]], qh))
				end
				row.psQuest = q.id
				row:ClearAllPoints()
				row:SetPoint("TOPLEFT", pg.Body, "TOPLEFT", PAD - 4, -(y + h - 6))
				row:SetWidth(MW - PAD * 2 + 4)
				row.Text:SetWidth(MW - PAD * 2 - 24)
				row:Show()
				h = h + TIE_H
			end
		end
		if n > 0 then h = h + 10 end
		r:SetHeight(h)
		r:Show()
		y = y + h
	end
	hidePool(bossRows, #bosses + 1)
	hidePool(ties, nt + 1)
	if #bosses == 0 then
		y = emptyPage(L["No bosses known yet"], L["The sources Polestar reads list no bosses for this dungeon."], 28)
	end
	shown.bosses, shown.ties = #bosses, nt
	return y + 16
end

local function renderMap(key, d, f)
	local art = pg.MapArt
	local e = d.entrance
	local side = SIDE[f]
	local painted = e and ZoneArt.Paint(art, e.map, e.x, e.y, 1)
	art:Show()
	pg.MapNote:Show()
	local n = 0
	if painted then
		placeOn(art.Entrance, art, e.x, e.y)
		art.Entrance:Show()
		-- The quest givers on the entrance's zone, one marker per giver.
		local byGiver, order = {}, {}
		for _, q in ipairs(D().Quests(key, side)) do
			local s = q.start
			if s and s.map == e.map and s.x and s.y and not s.inside then
				local id = (s.kind or "") .. tostring(s.id or s.name)
				local gq = byGiver[id]
				if not gq then
					gq = { point = s, lines = {} }
					byGiver[id] = gq
					order[#order + 1] = gq
				end
				gq.lines[#gq.lines + 1] = q.title
			end
		end
		for _, gq in ipairs(order) do
			n = n + 1
			local g = giver(n)
			placeOn(g, art, gq.point.x, gq.point.y)
			g.psName, g.psLines = gq.point.name, gq.lines
			g:Show()
		end
	else
		art.Entrance:Hide()
		if not e then ZoneArt.Paint(art, nil, nil, nil, 1) end
	end
	hidePool(givers, n + 1)
	if e then
		local z = mapName(e.map) or d.zoneName or ""
		local text = format(L["The entrance, on %s (%.1f, %.1f)."], z, e.x or 0, e.y or 0)
		if n > 0 then text = text .. " " .. (n == 1 and L["The quest giver nearby is marked; hover for their quests."] or format(L["The %d quest givers nearby are marked; hover for their quests."], n)) end
		pg.MapNote:SetText(text)
	else
		pg.MapNote:SetText(L["The entrance of this dungeon is not known yet."])
	end
	shown.map, shown.givers = e and "entrance" or "none", n
	return 24 + MAP_H + 14 + pg.MapNote:GetStringHeight() + 24
end

local TABS = { { key = "quests" }, { key = "bosses" }, { key = "map" } }

local function renderPage(key, plevel)
	local d = D().Get(key)
	if not d then
		page = nil
		return false
	end
	home:Hide()
	pg:Show()
	pageHeader(d)
	local f = factionKey()
	local side = SIDE[f]
	local nq = #D().Quests(key, side)
	local nb = #D().Bosses(key)
	local list_ = {
		{ key = "quests", label = nq > 0 and (L["Quests"] .. "  " .. nq) or L["Quests"] },
		{ key = "bosses", label = nb > 0 and (L["Bosses"] .. "  " .. nb) or L["Bosses"] },
		{ key = "map", label = L["Map"] },
	}
	W.ShellTabs(hub, list_, tab, function(k) DS.SetTab(k) end)
	-- Hide what the other tabs put up.
	pg.EmptyTitle:Hide()
	pg.EmptyNote:Hide()
	if tab ~= "quests" then
		hidePool(blocks)
		qpass.key = nil
	end
	if tab ~= "bosses" then hidePool(bossRows); hidePool(ties) end
	if tab ~= "map" then
		pg.MapArt:Hide()
		pg.MapNote:Hide()
		hidePool(givers)
	end
	local h
	if tab == "bosses" then
		h = renderBosses(key, f, plevel)
	elseif tab == "map" then
		h = renderMap(key, d, f)
	else
		h = renderQuests(key, f, plevel)
	end
	W.SetScrollContent(pg.Scroll, h)
	if tab == "quests" then DS.PaintQuests() end
	shown.view, shown.page, shown.tab = "page", key, tab
	return true
end

---------------------------------------------------------------------------
-- Render
---------------------------------------------------------------------------

local REASON = {
	nodata = "The Polestar_Codex addon is older than this Polestar: reinstall Polestar, then /reload.",
	missing = "The Polestar_Codex addon is not installed. Get Polestar from CurseForge or the GitHub Releases page (the Polestar zip under Assets, not \"Source code\"), install it and restart the game.",
	disabled = "The Polestar_Codex addon is turned off: enable it in the AddOns list, then /reload.",
}

local function renderEmpty(reason)
	home:Show()
	pg:Hide()
	restoreHeader()
	W.ShellTabs(hub, nil)
	hidePool(cards)
	hidePool(heads)
	home.psCount = 0
	W.ShellTitle(hub, L["Dungeons"], L["Every dungeon quest, where it starts and what it gives"])
	home.Watermark:Show()
	local text
	if reason == "off" then
		text = L["The Dungeons section is turned off. Turn it on under Options > Discovery > Dungeons."]
	else
		local LK = UI.Lookup
		text = REASON[reason] and L[REASON[reason]] or (LK and LK.ReasonText and LK.ReasonText(reason)) or tostring(reason)
	end
	home.EmptyTitle:SetText(reason == "off" and L["Dungeons are off"] or L["Dungeons need the Codex"])
	home.EmptyNote:SetText(text)
	home.EmptyTitle:Show()
	home.EmptyNote:Show()
	W.SetScrollContent(home.Scroll, 160)
	shown.view, shown.empty = "empty", reason
end

function DS.Render()
	if not root then return end
	for k in pairs(shown) do shown[k] = nil end
	local Dg = D()
	local loaded, reason
	if Dg then loaded, reason = Dg.Load() else loaded, reason = false, "missing" end
	for _, b in ipairs(segs) do b:SetShown(loaded and true or false) end
	if not loaded then
		renderEmpty(reason)
		return
	end
	segPaint(factionKey())
	local plevel = playerLevel()
	if page and renderPage(page, plevel) then return end
	home.EmptyTitle:Hide()
	home.EmptyNote:Hide()
	renderHome(plevel)
end

-- Re-render the whole hub while Dungeons is its section, so the sidebar
-- marks the band; else just this section.
local function refresh()
	local P = UI.Picker
	if P and P.Section and P.Section() == "Dungeons" and P.Render and hub and hub:IsShown() then
		P.Render()
	elseif root and root:IsVisible() then
		DS.Render()
	end
end

function DS.Nav()
	local Dg = D()
	if not (Dg and Dg.IsEnabled() and Dg.Load()) then return {}, nil end
	local plevel = playerLevel()
	local items = navItems(plevel, factionKey())
	return items, (filter == "" and defaultBand(plevel)) or nil
end

function DS.SetBand(key)
	band = key
	page = nil
	if home then W.ScrollTo(home.Scroll, 0) end
	refresh()
end

function DS.SetTab(key)
	for _, t in ipairs(TABS) do
		if t.key == key then
			tab = key
			if pg then W.ScrollTo(pg.Scroll, 0) end
			refresh()
			return
		end
	end
end

function DS.SetFaction(f)
	uiState().dungeonsFaction = f
	refresh()
end

function DS.Open(key)
	page = key
	tab = "quests"
	if pg then W.ScrollTo(pg.Scroll, 0) end
	refresh()
end

function DS.Home()
	page = nil
	refresh()
end

-- The Quests tab, scrolled to one quest.
function DS.ShowQuest(id)
	tab = "quests"
	refresh()
	for i, q in ipairs(qpass.quests) do
		if q.id == id then
			W.ScrollTo(pg.Scroll, max(0, qpass.tops[i] - 8))
			DS.PaintQuests()
			return
		end
	end
end

function DS.GuideThere()
	local Dg = D()
	if page and Dg then Dg.GuideTo(page) end
end

-- Open a dungeon's planned guide (open: Dungeons.PickUp or HandIn) in a new
-- tab; the hub steps aside, as Lookup's guides do. Nothing to plan says why
-- in chat (nothing(): the sentence).
local function openPlanned(open, key, nothing)
	local gid, reason = open(key)
	if gid then
		ns.Set("ui.shown", true)
		if hub then hub:Hide() end
		return gid
	end
	local text
	if reason == "nothing" then
		text = nothing()
	elseif reason == "tabs" then
		text = L["Six tabs is the limit. Close one to open another."]
	else
		text = format(L["No guide could be made for this (%s)."], tostring(reason))
	end
	ns.Print(text)
	refresh()
	return nil, reason
end

-- The page's pick-up guide; nothing to pick up says so instead.
function DS.PickUp()
	local Dg = D()
	if not (page and Dg and Dg.PickUp) then return nil end
	local key = page
	return openPlanned(Dg.PickUp, key, function() return DS.NothingText(Dg.PickupPlan(key)) end)
end

-- A dungeon's hand-in guide (the page's, or `key`'s from the finished
-- pick-up guide); nothing finished says what is still open instead.
function DS.HandIn(key)
	local Dg = D()
	key = key or page
	if not (key and Dg and Dg.HandIn) then return nil end
	return openPlanned(Dg.HandIn, key, function() return Dg.HandinText(Dg.HandinPlan(key)) end)
end

function DS.ShowOnMap()
	local Dg = D()
	if page and Dg then Dg.ShowOnMap(page) end
end

function DS.Search(text)
	filter = text or ""
	page = nil
	if home then W.ScrollTo(home.Scroll, 0) end
	refresh()
end

-- Enter opens the first card.
function DS.Enter()
	if page or not home then return end
	local c = cards[1]
	if c and c:IsShown() and c.psKey then DS.Open(c.psKey) end
end

-- SHOW_DUNGEON(key): the hub at the page (nil: Home).
function DS.Show(key)
	page = key
	tab = "quests"
	filter = ""
	local P = UI.Picker
	local win = PolestarPicker
	local was = win and win:IsShown()
	if win and win.Search then win.Search:SetText("") end
	if P and P.ShowSection then P.ShowSection("Dungeons") end
	if not was and UI.ShowPicker then UI.ShowPicker() end
	if pg then W.ScrollTo(pg.Scroll, 0) end
	if home then W.ScrollTo(home.Scroll, 0) end
end

function DS.Page() return page end
function DS.Tab() return tab end
function DS.Shown() return shown end
DS.cards, DS.blocks, DS.bossRows, DS.ties, DS.givers = cards, blocks, bossRows, ties, givers
function DS.Frames() return root, home, pg, segs end

ns.On("SHOW_DUNGEON", function(key) DS.Show(key) end)
ns.On("CODEX_LOADED", function()
	listCache = nil
	if root and root:IsVisible() then DS.Render() end
end)
Theme.OnChanged(function() if root and root:IsVisible() then DS.Render() end end)
local function questsChanged()
	if root and root:IsVisible() and page then DS.Render() end
end
for _, ev in ipairs({ "QUEST_ACCEPTED", "QUEST_REMOVED", "QUEST_TURNED_IN", "PLAYER_LEVEL_UP" }) do
	ns.RegisterEvent(ev, questsChanged)
end

if UI.RegisterSection then
	UI.RegisterSection({
		key = "Dungeons", label = L["Dungeons"], icon = "icon-dungeon", order = 30,
		build = DS.Build,
		render = DS.Render,
		nav = DS.Nav,
		onNav = DS.SetBand,
		search = DS.Search,
		enter = DS.Enter,
		searchPlaceholder = L["Search dungeons"],
	})
end
