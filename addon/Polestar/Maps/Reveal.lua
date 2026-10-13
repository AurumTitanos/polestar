-- The world map without fog of war:
-- the overlays this character has not explored yet are laid over the map,
-- as they are or tinted with the theme's mapUnexplored colour (setting
-- maps.reveal: "off" | "on" | "tint").
--
-- Every overlay comes from UI.ZoneArt's table (UI/ZoneArtOverlays.lua, the
-- client's WorldMapOverlay rows), used only when it was built for the art the
-- client shows (ZoneArt.FullOverlays: art ID and tile size). The client lists
-- what is explored (C_MapExplorationInfo.GetExploredMapTextures) without
-- overlay IDs, so the two are matched on offset and size. An explored overlay
-- is the client's own to draw: shown, or, when it isShownByMouseOver, only
-- while the cursor is over its area; it is never painted here, so a hover-only
-- overlay stays hover-only.
--
-- One Blizzard_MapCanvas data provider per map frame (the world map, and the
-- battlefield map once Blizzard loads it), added with AddDataProvider; no
-- Blizzard function is replaced. Its textures sit on one frame on the canvas
-- at the exploration frame level, laid out in canvas units (the canvas is the
-- art layer's size, as MapExplorationDataProvider assumes). Nothing is made
-- while the setting is off: the provider is added the first time it is on.

local ADDON, ns = ...
local Maps = ns.Maps

local type, pairs, ipairs, pcall = type, pairs, ipairs, pcall

---------------------------------------------------------------------------
-- Overlay selection (pure)
---------------------------------------------------------------------------

local function rectKey(w, h, x, y)
	return x .. ":" .. y .. ":" .. w .. ":" .. h
end

-- art: a ZoneArt.FullOverlays table ({ tileW, tileH, { w, h, x, y, file, ... }, ... });
-- explored: the client's explored list ({ textureWidth, textureHeight, offsetX,
-- offsetY, isShownByMouseOver, ... }, ...) or nil. -> the overlays of art no
-- explored entry covers, in table order (out is reused when given).
function Maps.UnexploredOverlays(art, explored, out)
	out = out or {}
	for i = #out, 1, -1 do out[i] = nil end
	if type(art) ~= "table" then return out end
	local seen
	if type(explored) == "table" then
		for _, e in ipairs(explored) do
			if type(e) == "table" then
				seen = seen or {}
				seen[rectKey(e.textureWidth, e.textureHeight, e.offsetX, e.offsetY)] = true
			end
		end
	end
	for i = 3, #art do
		local o = art[i]
		if not (seen and seen[rectKey(o[1], o[2], o[3], o[4])]) then out[#out + 1] = o end
	end
	return out
end

---------------------------------------------------------------------------
-- The provider
---------------------------------------------------------------------------

local providers = {} -- map frame -> provider
local scratch = {}

local function mode()
	local m = ns.Get("maps.reveal")
	if m == "on" or m == "tint" then return m end
	return "off"
end

-- The art layer the canvas is sized to, or nil.
local function layerOf(mapID)
	local M = C_Map
	if not (mapID and M and M.GetMapArtLayers) then return nil end
	local ok, layers = pcall(M.GetMapArtLayers, mapID)
	local info = ok and type(layers) == "table" and layers[1] or nil
	if info and (info.tileWidth or 0) > 0 and (info.tileHeight or 0) > 0 then return info end
	return nil
end

local function exploredOf(mapID)
	local X = C_MapExplorationInfo
	if not (X and X.GetExploredMapTextures) then return nil end
	local ok, list = pcall(X.GetExploredMapTextures, mapID)
	return ok and type(list) == "table" and list or nil
end

local function host(p)
	local f = p.host
	if f then return f end
	local map = p:GetMap()
	local canvas = map:GetCanvas()
	f = CreateFrame("Frame", nil, canvas)
	f:SetPoint("TOPLEFT", canvas, "TOPLEFT", 0, 0)
	f:SetSize(1, 1)
	p.host, p.tex, p.n = f, {}, 0
	return f
end

-- ZoneArt.EachOverlayTile callback: one tile, canvas units = layer pixels.
local function placeTile(p, file, x, y, w, h, right, bottom)
	local n = p.n + 1
	p.n = n
	local t = p.tex[n]
	if not t then
		t = p.host:CreateTexture(nil, "ARTWORK", nil, 0)
		p.tex[n] = t
		local map = p:GetMap()
		if map.AddMaskableTexture then map:AddMaskableTexture(t) end
	end
	t:SetTexture(file, nil, nil, "TRILINEAR")
	t:SetTexCoord(0, right, 0, bottom)
	t:SetSize(w, h)
	t:ClearAllPoints()
	t:SetPoint("TOPLEFT", p.host, "TOPLEFT", x, -y)
	t:SetVertexColor(p.r, p.g, p.b, 1)
	t:Show()
end

local function clear(p)
	local tex = p.tex
	if not tex then return end
	for i = 1, #tex do tex[i]:Hide() end
	p.n = 0
end

local function paint(p)
	clear(p)
	local m = mode()
	local map = p:GetMap()
	if m == "off" or not map then return end
	local ZA = ns.UI and ns.UI.ZoneArt
	if not (ZA and ZA.FullOverlays and ZA.EachOverlayTile) then return end
	local mapID = map:GetMapID()
	local info = layerOf(mapID)
	local art = info and ZA.FullOverlays(mapID, info.tileWidth, info.tileHeight)
	if not art then return end
	local list = Maps.UnexploredOverlays(art, exploredOf(mapID), scratch)
	if #list == 0 then return end
	local f = host(p)
	local canvas = map:GetCanvas()
	f:SetSize(canvas:GetWidth(), canvas:GetHeight())
	local levels = map.GetPinFrameLevelsManager and map:GetPinFrameLevelsManager()
	if levels and levels.GetValidFrameLevel then f:SetFrameLevel(levels:GetValidFrameLevel("PIN_FRAME_LEVEL_MAP_EXPLORATION")) end
	if map.GetGlobalAlpha then f:SetAlpha(map:GetGlobalAlpha()) end
	local T = ns.Theme
	if m == "tint" and T and T.Color then
		p.r, p.g, p.b = T.Color("mapUnexplored")
	else
		p.r, p.g, p.b = 1, 1, 1
	end
	local tileW, tileH = art[1], art[2]
	for _, o in ipairs(list) do
		ZA.EachOverlayTile(tileW, tileH, o[1], o[2], o[3], o[4], o, 5, placeTile, p)
	end
	f:Show()
end

local function newProvider()
	local p = CreateFromMixins(MapCanvasDataProviderMixin)
	function p:RemoveAllData() clear(self) end
	function p:RefreshAllData() paint(self) end
	function p:OnMapChanged() paint(self) end
	function p:OnCanvasSizeChanged()
		local map = self:GetMap()
		if self.host and map then
			local canvas = map:GetCanvas()
			self.host:SetSize(canvas:GetWidth(), canvas:GetHeight())
		end
	end
	function p:OnGlobalAlphaChanged()
		local map = self:GetMap()
		if self.host and map and map.GetGlobalAlpha then self.host:SetAlpha(map:GetGlobalAlpha()) end
	end
	return p
end

local function addTo(map)
	if providers[map] then return true end
	if not (map and map.AddDataProvider and map.GetCanvas and map.GetMapID
		and MapCanvasDataProviderMixin and CreateFromMixins) then
		return false
	end
	local p = newProvider()
	providers[map] = p
	map:AddDataProvider(p)
	return true
end

-- Adds the provider to every map frame that exists (only once the setting is
-- on), then repaints the shown ones.
local function sync()
	if mode() ~= "off" then
		addTo(WorldMapFrame)
		if BattlefieldMapFrame then addTo(BattlefieldMapFrame) end
	end
	for map, p in pairs(providers) do
		if map:IsShown() then paint(p) end
	end
end
Maps.RefreshReveal = sync

ns.On("SETTING_CHANGED", function(path)
	if path == "maps.reveal" or path == "maps" or path == "" then sync() end
end)

ns.RegisterEvent("MAP_EXPLORATION_UPDATED", function()
	for map, p in pairs(providers) do
		if map:IsShown() then paint(p) end
	end
end)

ns.RegisterEvent("ADDON_LOADED", function(_, name)
	if (name == "Blizzard_WorldMap" or name == "Blizzard_BattlefieldMap") and ns.IsLoggedIn() then sync() end
end)

ns.OnLogin(function()
	sync()
	local T = ns.Theme
	if T and T.OnChanged then
		T.OnChanged(function()
			if mode() == "tint" then sync() end
		end)
	end
end)
