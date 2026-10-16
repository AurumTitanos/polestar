-- The live dashboard's own map. It paints the same client-owned minimap
-- terrain textures as the Planner (not the illustrated C_Map zone art) and reads
-- Polestar's current navigation geometry; it never changes the world map,
-- minimap, selected guide step, navigation target, or player input.
-- Only visible frames sample live position (5 Hz). No external bridge.
local ADDON, ns = ...
local L = ns.L
local LM = {}
ns.LiveMap = LM
ns.RegisterDefaults("liveMap", { objectives = true, areaStyle = "regions", questie = true })

local min, max, abs = math.min, math.max, math.abs
local TICK, LIMIT = 0.2, 1600
-- One continent at a time. The supported client has 988 Kalimdor tiles and
-- 736 Eastern Kingdoms tiles; this covers either whole continent without
-- silently cutting off at the old 256 illustrated-art tile limit.
local TILE_LIMIT = 1024
local DOT = "Interface\\AddOns\\" .. ADDON .. "\\Media\\Nav\\pin-fill"
local COLORS = {
	walk = { 0.90, 0.73, 0.40 }, direct = { 1, 0.7, 0.25 },
	flight = { 0.4, 0.9, 0.55 }, boat = { 0.6, 0.7, 1 },
	zeppelin = { 0.6, 0.7, 1 }, tram = { 0.8, 0.65, 1 }, lift = { 0.8, 0.65, 1 },
}

local function numeric(v)
	local C = ns.Compat
	if C and C.IsSecret and C.IsSecret(v) then return false end
	return type(v) == "number" and v == v and v > -math.huge and v < math.huge
end

local function call(fn, ...)
	if type(fn) ~= "function" then return nil end
	local ok, a, b, c = pcall(fn, ...)
	if ok then return a, b, c end
end

local function clamp(v, lo, hi) return max(lo, min(hi, v)) end

-- Frame only the walk ahead on this map. Walks can be split at ramps or
-- choke points; keep those adjoining legs, but stop at a transport, a gap,
-- another continent, or the zone boundary. Completed vertices are omitted.
function LM.RemainingWalkBounds(geometry, fromIndex, b, x, y)
	if not (geometry and type(geometry.legs) == "table" and b and numeric(x) and numeric(y)) then return nil end
	local start
	for i, leg in ipairs(geometry.legs) do if leg.current then start = i; break end end
	if not start then return nil end
	local out = { x0 = x, x1 = x, y0 = y, y1 = y }
	local lastX, lastY, count = x, y, 0
	for i = start, #geometry.legs do
		local leg = geometry.legs[i]
		local pts = leg.pts
		if leg.kind ~= "walk" or type(pts) ~= "table" or #pts < 2 then break end
		for j = i == start and max(2, fromIndex or 2) or 1, #pts do
			local p = pts[j]
			if not (type(p) == "table" and p[1] == b.c and numeric(p[2]) and numeric(p[3])) then return count > 0 and out or nil end
			local nx, ny = (p[3] - b.left) * b.kx * 100, (p[2] - b.top) * b.ky * 100
			-- A later walk must actually join the preceding walk. Never fit a
			-- faraway disconnected path merely because both legs say 'walk'.
			if i > start and j == 1 and ((nx - lastX) / b.kx / 100)^2 + ((ny - lastY) / b.ky / 100)^2 > 60^2 then
				return count > 0 and out or nil
			end
			local t = 1
			if nx < 0 then t = min(t, -lastX / (nx - lastX)) elseif nx > 100 then t = min(t, (100 - lastX) / (nx - lastX)) end
			if ny < 0 then t = min(t, -lastY / (ny - lastY)) elseif ny > 100 then t = min(t, (100 - lastY) / (ny - lastY)) end
			nx, ny = lastX + (nx - lastX) * t, lastY + (ny - lastY) * t
			out.x0, out.x1, out.y0, out.y1 = min(out.x0, nx), max(out.x1, nx), min(out.y0, ny), max(out.y1, ny)
			lastX, lastY, count = nx, ny, count + 1
			if t < 1 then return out end
		end
	end
	return count > 0 and out or nil
end

function LM.AutoZoomLevel(w, h, lw, lh, x, y, bounds)
	if not (bounds and numeric(w) and numeric(h) and numeric(lw) and numeric(lh)) or min(w, h, lw, lh) <= 0 then return nil end
	-- Keep the player centered, leave room for pins, and retain 240 yards of
	-- nearby context at arrival. This limit affects automatic framing only.
	local rx = max(120, max(abs(bounds.x0 - x), abs(bounds.x1 - x)) * lw / 100 + 20)
	local ry = max(120, max(abs(bounds.y0 - y), abs(bounds.y1 - y)) * lh / 100 + 20)
	local scale = min(max(1, w - 48) / (2 * rx), max(1, h - 48) / (2 * ry))
	return max(1, scale / min(w / lw, h / lh))
end

function LM.EaseAutoZoom(current, target, elapsed)
	if not (numeric(current) and numeric(target) and numeric(elapsed)) then return current end
	-- Zoom out promptly for a new destination; ease in more slowly while
	-- approaching it. Elapsed time, not refresh count, controls the motion.
	local amount = 1 - math.exp(-clamp(elapsed, 0, 1) / (target < current and 0.35 or 1.1))
	return current + (target - current) * amount
end

-- Pure helpers shared with tests. Coordinates in the view are pixels down
-- and right from its top left. A zoom of one fits the entire map.
function LM.ComputeView(w, h, lw, lh, zoom, fx, fy)
	if not (numeric(w) and numeric(h) and numeric(lw) and numeric(lh)) or min(w, h, lw, lh) <= 0 then return nil end
	zoom, fx, fy = numeric(zoom) and zoom or 1, numeric(fx) and fx or 50, numeric(fy) and fy or 50
	local s = min(w / lw, h / lh) * max(1, zoom)
	local dw, dh = lw * s, lh * s
	if not (numeric(s) and numeric(dw) and numeric(dh)) then return nil end
	local ox = w / 2 - clamp(fx or 50, 0, 100) / 100 * dw
	local oy = h / 2 - clamp(fy or 50, 0, 100) / 100 * dh
	ox = dw <= w and (w - dw) / 2 or clamp(ox, w - dw, 0)
	oy = dh <= h and (h - dh) / 2 or clamp(oy, h - dh, 0)
	return { width = w, height = h, drawWidth = dw, drawHeight = dh, offsetX = ox, offsetY = oy, scale = s }
end

function LM.Project(v, x, y)
	if not (v and numeric(x) and numeric(y)) then return nil end
	return v.offsetX + x / 100 * v.drawWidth, v.offsetY + y / 100 * v.drawHeight
end

local function mapInfo(id)
	return id and C_Map and call(C_Map.GetMapInfo, id) or nil
end

local function readPlayer()
	local C = ns.Compat
	local m, x, y = call(C and C.GetPlayerMapPosition)
	if numeric(m) and numeric(x) and numeric(y) and x >= 0 and x <= 100 and y >= 0 and y <= 100 then return m, x, y end
end

local function positionOn(mapID, pm, px, py)
	if not pm then return nil end
	if pm == mapID then return px, py end
	local C = ns.Compat
	local c, wx, wy = call(C and C.MapToWorld, pm, px, py)
	if not (numeric(c) and numeric(wx) and numeric(wy)) then return nil end
	local x, y = call(C and C.WorldToMap, c, wx, wy, mapID)
	if numeric(x) and numeric(y) then return x, y end
end

local function worldBounds(mapID)
	local C = ns.Compat
	local c, top, left = call(C and C.MapToWorld, mapID, 0, 0)
	local c2, bottom, right = call(C and C.MapToWorld, mapID, 100, 100)
	if not (numeric(c) and numeric(c2) and numeric(top) and numeric(left) and numeric(bottom) and numeric(right)) then return nil end
	if c ~= c2 or top <= bottom or left <= right then return nil end
	return { c = c, left = left, right = right, top = top, bottom = bottom, kx = 1 / (right - left), ky = 1 / (bottom - top) }
end

local function loadArt(f)
	f.artDirty, f.art = false, nil
	for _, tile in ipairs(f.Tiles) do
		if tile.terrainMissing then tile.terrainFile = nil end
	end
	f.bounds = worldBounds(f.mapID)
	local b, terrain = f.bounds, ns.LiveTerrain
	-- The two continents have independent world coordinate systems. Stop
	-- at the continent rather than opening an empty illustrated world map.
	f.parentMap = false
	local info = mapInfo(f.mapID)
	local parent = info and info.parentMapID
	local pb = numeric(parent) and parent > 0 and parent ~= f.mapID and worldBounds(parent)
	if pb and terrain and terrain.continents[pb.c] then f.parentMap = parent end
	local continent = b and terrain and terrain.continents[b.c]
	if not (continent and type(continent.tiles) == "table" and #continent.tiles > 0 and numeric(terrain.adt) and terrain.adt > 0) then return end
	f.art = { layerWidth = b.left - b.right, layerHeight = b.top - b.bottom,
		adt = terrain.adt, tiles = continent.tiles }
	local sea = continent.sea or { 8, 16, 16 }
	if f.Sea then f.Sea:SetColorTexture(sea[1] / 255, sea[2] / 255, sea[3] / 255, 1) end
end

local function placeTile(f, file, x, y, w, h, right, bottom)
	local v = f.View
	local ax, ay = v.offsetX + x * v.scale, v.offsetY + y * v.scale
	local bw, bh = w * v.scale, h * v.scale
	-- Crop explicitly instead of relying on a canvas clip for the final
	-- partial tile: it can contain padding beyond the map's own dimensions.
	local x0, y0 = max(0, v.offsetX, ax), max(0, v.offsetY, ay)
	local x1, y1 = min(v.width, v.offsetX + v.drawWidth, ax + bw), min(v.height, v.offsetY + v.drawHeight, ay + bh)
	if x1 <= x0 or y1 <= y0 then return end
	if f.tileCount >= TILE_LIMIT then f.clippedTiles = f.clippedTiles + 1; return end
	f.tileCount = f.tileCount + 1
	local t = f.Tiles[f.tileCount]
	if not t then t = f.Canvas:CreateTexture(nil, "BACKGROUND"); f.Tiles[f.tileCount] = t end
	-- Panning should not reload unchanged texture assets on every paint.
	if t.terrainFile ~= file then
		t.terrainFile = file
		t.terrainMissing = t:SetTexture(file, "CLAMP", "CLAMP", "TRILINEAR") == false
	end
	if t.terrainMissing then f.missingTiles = f.missingTiles + 1; t:Hide(); return end
	t:SetTexCoord((x0 - ax) / bw * right, (x1 - ax) / bw * right, (y0 - ay) / bh * bottom, (y1 - ay) / bh * bottom)
	t:ClearAllPoints()
	t:SetPoint("TOPLEFT", f.Canvas, "TOPLEFT", x0, -y0)
	t:SetSize(x1 - x0, y1 - y0)
	t:Show()
end

local function paintArt(f)
	f.tileCount, f.missingTiles, f.clippedTiles = 0, 0, 0
	local a, v = f.art, f.View
	if a and v then
		-- Planner plane coordinates are (-worldY, -worldX), in yards. A
		-- level-zero ADT starts at ((col-32)*ADT, (row-32)*ADT). Both the
		-- terrain and the route overlay use these exact world coordinates.
		for _, tile in ipairs(a.tiles) do
			placeTile(f, tile[3], (tile[1] - 32) * a.adt + f.bounds.left,
				(tile[2] - 32) * a.adt + f.bounds.top, a.adt, a.adt, 1, 1)
		end
	end
	for i = f.tileCount + 1, #f.Tiles do f.Tiles[i]:Hide() end
	f.Empty:SetShown(not a or (f.missingTiles > 0 and f.missingTiles == f.tileCount))
	f.Empty:SetText(f.mapID and L["Planner terrain unavailable for this area"] or L["Waiting for your map location"])
end

local function rebuildPaths(f, geometry)
	f.geometry, f.paths, f.liveIndex = geometry, {}, nil
	local S = ns.RouteStrokes
	if not (S and geometry and type(geometry.legs) == "table") then return end
	local seenCurrent = false
	for _, leg in ipairs(geometry.legs) do
		local pts = type(leg.pts) == "table" and leg.pts
		if pts and #pts >= 2 and COLORS[leg.kind] then
			local later = seenCurrent and not leg.current
			local path = S.Path(leg.kind, pts, later)
			-- The geometry API does not certify every straight segment as a
			-- traversable terrain path. Mark two-point walks conservatively.
			if leg.kind == "walk" and #pts == 2 then path.kind, path.direct = "direct", true end
			f.paths[#f.paths + 1] = path
		end
		if leg.current then seenCurrent = true end
	end
end

local function paintStrokes(f)
	local b = f.strokes
	for i = 1, b.n do
		local line, rim = f.Lines[i], f.Rims[i]
		if not line then
			rim = f.RouteLayer:CreateLine(nil, "ARTWORK", nil, -1)
			line = f.RouteLayer:CreateLine(nil, "ARTWORK")
			f.Lines[i], f.Rims[i] = line, rim
		end
		if b.dot[i] then line:SetTexture(DOT); rim:SetTexture(DOT) else line:SetColorTexture(1, 1, 1, 1); rim:SetColorTexture(1, 1, 1, 1) end
		line:SetTexCoord(0, 1, 0, 1); rim:SetTexCoord(0, 1, 0, 1)
		rim:SetVertexColor(0.015, 0.025, 0.045, 0.8 * b.alpha[i])
		rim:SetThickness(b.under[i])
		rim:SetStartPoint("TOPLEFT", f.RouteLayer, b.x1[i] - b.ux[i], b.y1[i] - b.uy[i])
		rim:SetEndPoint("TOPLEFT", f.RouteLayer, b.x2[i] + b.ux[i], b.y2[i] + b.uy[i])
		local c = b.color[i]
		line:SetVertexColor(c[1], c[2], c[3], b.alpha[i])
		line:SetThickness(b.width[i])
		line:SetStartPoint("TOPLEFT", f.RouteLayer, b.x1[i], b.y1[i])
		line:SetEndPoint("TOPLEFT", f.RouteLayer, b.x2[i], b.y2[i])
		line:Show(); rim:Show()
	end
	for i = b.n + 1, #f.Lines do f.Lines[i]:Hide(); f.Rims[i]:Hide() end
end

local function sampleRoute(f, pm, px, py)
	local S, N, C = ns.RouteStrokes, ns.Nav, ns.Compat
	local geometry = call(N and N.GetRouteGeometry)
	if geometry ~= f.geometry then rebuildPaths(f, geometry) end
	f.liveStart = false
	local first = f.paths[1]
	if S and pm and first and (first.kind == "walk" or first.kind == "direct") and not first.later then
		local pc, wx, wy = call(C and C.MapToWorld, pm, px, py)
		if numeric(pc) and numeric(wx) and numeric(wy) then
			local idx = S.Live(first, pc, wx, wy, f.liveIndex, 60)
			if idx then f.liveIndex, f.liveStart, f.liveC, f.liveX, f.liveY = idx, true, pc, wx, wy end
		end
	end
end

local function paintRoutes(f)
	local S = ns.RouteStrokes
	if not (S and f.strokes) then return end
	f.strokes.n = 0
	local b, v = f.bounds, f.View
	if b and v and f.art then
		local rv = f.routeView
		rv.c = b.c
		rv.left, rv.top = b.left - v.offsetX / v.drawWidth / b.kx, b.top - v.offsetY / v.drawHeight / b.ky
		rv.kx, rv.ky = b.kx * v.drawWidth / v.width, b.ky * v.drawHeight / v.height
		rv.width, rv.height, rv.scale = v.width, v.height, f:GetEffectiveScale() or 1
		rv.from, rv.fromIndex = nil, nil
		if f.liveStart then
			rv.from, rv.fromIndex, rv.fromC, rv.fromX, rv.fromY = true, f.liveIndex, f.liveC, f.liveX, f.liveY
		end
		S.Map(f.strokes, f.paths, rv)
	end
	paintStrokes(f)
end

local function placeMarker(f, marker, x, y)
	local sx, sy = LM.Project(f.View, x, y)
	local visible = f.art and sx and x >= 0 and x <= 100 and y >= 0 and y <= 100
		and sx >= 0 and sy >= 0 and sx <= f.View.width and sy <= f.View.height
	marker:SetShown(visible and true or false)
	if visible then marker:ClearAllPoints(); marker:SetPoint("CENTER", f.MarkerLayer, "TOPLEFT", sx, -sy) end
	return visible
end

local function setMap(f, id)
	if not numeric(id) or id <= 0 or f.mapID == id then return false end
	f.mapID, f.focusX, f.focusY, f.zoom = id, 50, 50, 1
	f.autoZoomTarget, f.autoZoomTime, f.autoZoomReset = nil, nil, true
	loadArt(f)
	f.dirty = true
	return true
end

local function regionHover(f)
	if not f.regionHover or f.dragging or not f.Regions or not f.Regions:GetEnabled() then
		if f.regionTip then ns.Widgets.HideTooltip(f.Viewport); f.regionTip = nil end
		return
	end
	local focus = call(GetMouseFoci)
	local ownsFocus = not (type(focus) == "table" and #focus > 0)
	if type(focus) == "table" then for _, object in ipairs(focus) do if object == f.Viewport then ownsFocus = true end end end
	local owner = GameTooltip and call(GameTooltip.GetOwner, GameTooltip)
	if not ownsFocus or (owner and owner ~= f.Viewport and GameTooltip:IsShown()) then
		if f.regionTip then ns.Widgets.HideTooltip(f.Viewport); f.regionTip = nil end
		return
	end
	local cx, cy = call(GetCursorPosition)
	local scale = f:GetEffectiveScale() or 1
	local left, top = f.Viewport:GetLeft(), f.Viewport:GetTop()
	if not (numeric(cx) and numeric(cy) and numeric(left) and numeric(top)) then return end
	local hits = f.Regions:HitTest(cx / scale - left, top - cy / scale)
	local lines = {}
	for _, p in ipairs(hits or {}) do
		local progress = p.progress
		local count = progress and numeric(progress.cur) and numeric(progress.max) and string.format(" (%d/%d)", progress.cur, progress.max) or ""
		lines[#lines + 1] = (p.label or L["Objective"]) .. count
	end
	local key = table.concat(lines, "\n")
	if key == "" then
		if f.regionTip then ns.Widgets.HideTooltip(f.Viewport); f.regionTip = nil end
	elseif f.regionTip ~= key then
		f.regionTip = key
		ns.Widgets.Tooltip(f.Viewport, "ANCHOR_CURSOR", L["Polestar objective region"], lines)
	end
end

local function refresh(f, force, cached)
	if not f:IsVisible() then f.dirty = true; return end
	local pm, px, py
	if cached then pm, px, py = f.playerMap, f.playerX, f.playerY
	else
		pm, px, py = readPlayer()
		f.playerMap, f.playerX, f.playerY = pm, px, py
		f.facing = call(ns.Compat and ns.Compat.GetPlayerFacing)
	end
	if f.follow and pm then setMap(f, pm) end
	if (f.artDirty or (force and (f.missingTiles or 0) > 0)) and f.mapID then loadArt(f) end
	local x, y = positionOn(f.mapID, pm, px, py)
	if f.follow and x then f.focusX, f.focusY = x, y end
	local w, h = f.Viewport:GetWidth(), f.Viewport:GetHeight()
	if not (w and h and w > 1 and h > 1) then return end
	local a = f.art
	sampleRoute(f, pm, px, py)
	local now = call(GetTime)
	if f:GetAutoZoom() and f.follow and a and x and not f.dragging then
		local bounds = LM.RemainingWalkBounds(f.geometry, f.liveIndex, f.bounds, x, y)
		local desired = LM.AutoZoomLevel(w, h, a.layerWidth, a.layerHeight, x, y, bounds)
		if desired then
			-- A small dead band prevents terrain breathing as position samples
			-- wobble or the route is recomputed a few yards to either side.
			if not f.autoZoomTarget or abs(desired / f.autoZoomTarget - 1) > 0.06 then f.autoZoomTarget = desired end
			if f.autoZoomReset then f.zoom, f.autoZoomReset = f.autoZoomTarget, false
			elseif numeric(now) and numeric(f.autoZoomTime) then f.zoom = LM.EaseAutoZoom(f.zoom, f.autoZoomTarget, now - f.autoZoomTime) end
		else f.autoZoomTarget = nil end
	end
	f.autoZoomTime = now
	local v = LM.ComputeView(w, h, a and a.layerWidth or 1002, a and a.layerHeight or 668, f.zoom, f.focusX, f.focusY)
	if not v then
		-- Reject a corrupted/overflowing saved camera without imposing a
		-- practical close-in zoom cap on either map window.
		f.zoom = 1
		v = LM.ComputeView(w, h, a and a.layerWidth or 1002, a and a.layerHeight or 668, 1, f.focusX, f.focusY)
	end
	if not v then return end
	local old = f.View
	local moved = not old or old.width ~= v.width or old.height ~= v.height or old.drawWidth ~= v.drawWidth
		or abs(old.offsetX - v.offsetX) > 0.05 or abs(old.offsetY - v.offsetY) > 0.05
	f.View = v
	if force or f.dirty or moved then paintArt(f) end
	local info = mapInfo(f.mapID)
	f.Zone:SetText((info and info.name or L["Live map"]) .. (f.compact and "" or " - " .. L["Planner terrain"]))
	if f.shownFollow ~= f.follow then
		ns.Widgets.SetButtonText(f.FollowButton, f.follow and (f.compact and L["Follow on"] or L["Following"]) or L["Follow"])
		f.shownFollow = f.follow
	end
	f.ParentButton:SetEnabled(numeric(f.parentMap))
	f.ZoomInButton:SetEnabled(numeric(f.zoom * 1.4))
	f.ZoomOutButton:SetEnabled(f.zoom > 1 or numeric(f.parentMap))
	placeMarker(f, f.PlayerMarker, x, y)
	local facing = f.facing
	if numeric(facing) and f.PlayerMarker.Arrow.SetRotation then f.PlayerMarker.Arrow:SetRotation(facing) end
	local N = ns.Nav
	local target = call(N and N.GetTarget)
	local tm, tx, ty = call(N and N.LiveCoords, target)
	local gx, gy
	if numeric(tm) and numeric(tx) and numeric(ty) then gx, gy = positionOn(f.mapID, tm, tx, ty) end
	placeMarker(f, f.GoalMarker, gx, gy)
	f.GoalMarker.targetLabel = target and target.label or L["Navigation target"]
	local E = ns.Engine
	local objectiveStep = f.inspectionIndex or call(E and E.GetStepIndex)
	f:SyncLayers()
	if f.Objectives then
		f.Objectives:Refresh(f, objectiveStep)
		for _, marker in ipairs(f.Objectives.Markers) do
			if marker:IsVisible() and marker.objective and marker.objective.active then f.GoalMarker:Hide(); break end
		end
	end
	if f.Regions then f.Regions:Refresh(f, f.Objectives and f.Objectives.scene) end
	if f.Questie then f.Questie:Refresh(f) end
	regionHover(f)
	-- The objective layer handles both the live step and read-only browsing.
	-- Keep the older grouped inspection data for camera framing only.
	paintRoutes(f)
	local status
	if not pm then status = L["Player location unavailable here"]
	elseif not x or x < 0 or x > 100 or y < 0 or y > 100 then status = L["Player is on another map - click Player"]
	else status = string.format(L["You: %.1f, %.1f"], x, y) end
	if target then
		local first = f.paths[1]
		local kind = first and first.kind
		local label = first and first.direct and L["Direct segment (unverified)"] or kind == "walk" and L["Routed walk (gold)"]
			or kind == "flight" and L["Flight (green)"] or kind == "boat" and L["Boat route"] or kind == "zeppelin" and L["Zeppelin route"]
			or kind == "tram" and L["Tram route"] or kind == "lift" and L["Lift route"] or L["No route geometry"]
		status = status .. "  |  " .. label
	else status = status .. "  |  " .. L["No navigation target"] end
	if (f.missingTiles or 0) > 0 then status = status .. "  |  " .. string.format(L["Terrain textures unavailable (%d)"], f.missingTiles) end
	if (f.clippedTiles or 0) > 0 then status = status .. "  |  " .. L["Terrain limit reached - zoom in"] end
	f.Status:SetText(status)
	local hint = f:GetAreaStyle() == "regions" and L["Gold: current objective; amber: other objectives - hover regions or pins"] or L["Drag to pan - wheel to zoom - hover pins for details"]
	if f:GetQuestie() and f.Questie and f.Questie.GetStatus then
		local qstatus, available, truncated = f.Questie:GetStatus()
		if not available then hint = qstatus or L["Questie unavailable"]
		elseif truncated then hint = L["Questie spawn display limit reached - zoom in"] end
	end
	if f.Objectives and f.Objectives.scene.truncated then hint = L["Objective display limit reached for this step"] end
	f.Hint:SetText(hint)
	f.dirty = false
end

function LM.Create(parent, options)
	local W = ns.Widgets
	local f = CreateFrame("Frame", nil, parent)
	f.compact = options and options.compact == true
	f:SetSize(520, 500)
	f.View = false
	f.follow, f.zoom, f.focusX, f.focusY = true, 1, 50, 50
	f.autoZoom = f.compact and options and options.autoZoom == true
	f.autoZoomReset = true
	f.Tiles, f.Lines, f.Rims, f.paths, f.InspectionMarkers = {}, {}, {}, {}, {}
	f.strokes = ns.RouteStrokes and ns.RouteStrokes.New(LIMIT)
	f.routeView = { colors = COLORS, marks = {}, markCount = 0 }
	local bg = f:CreateTexture(nil, "BACKGROUND")
	bg:SetAllPoints(f); bg:SetColorTexture(0.035, 0.055, 0.075, 1)
	f.Zone = W.Text(f, "label", "text")
	f.Zone:SetPoint("TOPLEFT", f, "TOPLEFT", 8, -8)
	f.Zone:SetPoint("TOPRIGHT", f, "TOPRIGHT", f.compact and -76 or -116, -8)
	f.Zone:SetJustifyH("LEFT")
	f.Zone:SetWordWrap(false)
	f.FollowButton = W.Button(f, L["Following"], function() f:SetFollow(not f:GetFollow()) end, { width = f.compact and 66 or 88, height = 24 })
	f.FollowButton:SetPoint("TOPLEFT", f, "TOPLEFT", 8, f.compact and -27 or -31)
	f.PlayerButton = W.Button(f, L["Player"], function() f:ShowPlayer() end, { width = f.compact and 52 or 66, height = 24 })
	f.PlayerButton:SetPoint("LEFT", f.FollowButton, "RIGHT", 4, 0)
	f.ParentButton = W.Button(f, L["Up"], function() f:ZoomOutZone() end, { width = f.compact and 32 or 40, height = 24 })
	f.ParentButton:SetPoint("LEFT", f.PlayerButton, "RIGHT", 4, 0)
	f.ZoomOutButton = W.Button(f, "-", function() f:ZoomOut() end, { width = f.compact and 24 or 30, height = 24 })
	f.ZoomOutButton:SetPoint("LEFT", f.ParentButton, "RIGHT", 4, 0)
	f.ZoomInButton = W.Button(f, "+", function() f:ZoomIn() end, { width = f.compact and 24 or 30, height = 24 })
	f.ZoomInButton:SetPoint("LEFT", f.ZoomOutButton, "RIGHT", 4, 0)
	f.LayersButton = W.Button(f, L["Layers"], function() f:ShowLayers() end, { width = f.compact and 64 or 104, height = 24 })
	f.LayersButton:SetPoint("TOPRIGHT", f, "TOPRIGHT", -8, -3)
	f.Viewport = CreateFrame("Button", nil, f)
	f.Viewport:SetPoint("TOPLEFT", f, "TOPLEFT", 0, f.compact and -56 or -61)
	f.Viewport:SetPoint("BOTTOMRIGHT", f, "BOTTOMRIGHT", 0, f.compact and 0 or 42)
	if f.Viewport.SetClipsChildren then f.Viewport:SetClipsChildren(true) end
	f.Canvas = CreateFrame("Frame", nil, f.Viewport); f.Canvas:SetAllPoints(f.Viewport)
	f.Sea = f.Canvas:CreateTexture(nil, "BACKGROUND", nil, -1)
	f.Sea:SetAllPoints(f.Canvas); f.Sea:SetColorTexture(8 / 255, 16 / 255, 16 / 255, 1)
	f.RouteLayer = CreateFrame("Frame", nil, f.Viewport); f.RouteLayer:SetAllPoints(f.Viewport)
	f.RouteLayer:SetFrameLevel(f.Canvas:GetFrameLevel() + 2)
	f.MarkerLayer = CreateFrame("Frame", nil, f.Viewport); f.MarkerLayer:SetAllPoints(f.Viewport)
	f.MarkerLayer:SetFrameLevel(f.RouteLayer:GetFrameLevel() + 1)
	f.PlayerMarker = CreateFrame("Frame", nil, f.MarkerLayer); f.PlayerMarker:SetSize(26, 26)
	f.PlayerMarker:SetFrameLevel(f.MarkerLayer:GetFrameLevel() + 3)
	f.PlayerMarker.Arrow = f.PlayerMarker:CreateTexture(nil, "OVERLAY")
	f.PlayerMarker.Arrow:SetAllPoints(f.PlayerMarker)
	f.PlayerMarker.Arrow:SetTexture("Interface\\AddOns\\" .. ADDON .. "\\Media\\Nav\\arrow")
	f.PlayerMarker.Arrow:SetVertexColor(1, 0.85, 0.5)
	f.GoalMarker = CreateFrame("Button", nil, f.MarkerLayer); f.GoalMarker:SetSize(20, 20)
	f.GoalMarker:SetScript("OnEnter", function(self) W.Tooltip(self, "ANCHOR_RIGHT", L["Arrow destination"], { self.targetLabel }) end)
	f.GoalMarker:SetScript("OnLeave", W.HideTip)
	local goal = f.GoalMarker:CreateTexture(nil, "OVERLAY")
	goal:SetAllPoints(f.GoalMarker); goal:SetTexture(DOT); goal:SetVertexColor(1, 0.78, 0.2)
	if ns.LiveObjectives then
		f.Objectives = ns.LiveObjectives.Create(f.Viewport)
		f.Objectives:SetFrameLevel(f.Canvas:GetFrameLevel() + 1)
		f.Objectives:SetEnabled(ns.Get("liveMap.objectives") ~= false)
	end
	if ns.LiveRegions then
		f.Regions = ns.LiveRegions.Create(f.Viewport)
		f.Regions:SetFrameLevel(f.Canvas:GetFrameLevel() + 1)
	end
	if ns.LiveQuestie then
		f.Questie = ns.LiveQuestie.Create(f.Viewport)
		f.Questie:SetFrameLevel(f.MarkerLayer:GetFrameLevel() - 1)
	end
	f.Empty = W.Text(f.MarkerLayer, "label", "textDim")
	f.Empty:SetPoint("CENTER", f.Viewport, "CENTER", 0, 0)
	f.Status = W.Text(f, "small", "textDim")
	f.Status:SetPoint("BOTTOMLEFT", f, "BOTTOMLEFT", 8, 23)
	f.Status:SetPoint("BOTTOMRIGHT", f, "BOTTOMRIGHT", -8, 23)
	f.Status:SetJustifyH("LEFT")
	f.Status:SetWordWrap(false)
	f.Hint = W.Text(f, "small", "textMuted")
	f.Hint:SetPoint("BOTTOMLEFT", f, "BOTTOMLEFT", 8, 7)
	f.Hint:SetText(L["Drag to pan - wheel to zoom - right-click for parent map"])
	f.Hint:SetPoint("BOTTOMRIGHT", f, "BOTTOMRIGHT", -8, 7)
	f.Hint:SetJustifyH("LEFT")
	f.Hint:SetWordWrap(false)
	if f.compact then
		f.Status:Hide(); f.Hint:Hide()
		-- Keep routing/fallback details available without a second HUD footer.
		local info = CreateFrame("Frame", nil, f)
		f.Info = info -- Compact hosts can relocate the controls and supply their own tooltip.
		info:SetPoint("TOPLEFT", f, "TOPLEFT", 8, -3)
		info:SetPoint("TOPRIGHT", f, "TOPRIGHT", -76, -3)
		info:SetHeight(22); info:EnableMouse(true)
		info:SetScript("OnEnter", function(self) W.Tooltip(self, "ANCHOR_RIGHT", f.Zone:GetText(), { f.Status:GetText(), f.Hint:GetText() }) end)
		info:SetScript("OnLeave", W.HideTip)
	end

	function f:Refresh(force) refresh(self, force) end
	function f:GetObjectives() return ns.Get("liveMap.objectives") ~= false end
	function f:GetAreaStyle()
		local value = ns.Get("liveMap.areaStyle")
		return (value == "circles" or value == "off") and value or "regions"
	end
	function f:GetQuestie() return ns.Get("liveMap.questie") ~= false end
	function f:SetObjectives(enabled) ns.Set("liveMap.objectives", enabled and true or false); self:Refresh(true) end
	function f:SetAreaStyle(style)
		if style ~= "regions" and style ~= "circles" and style ~= "off" then return end
		ns.Set("liveMap.areaStyle", style); self:Refresh(true)
	end
	function f:SetQuestie(enabled) ns.Set("liveMap.questie", enabled and true or false); self:Refresh(true) end
	function f:SyncLayers()
		local markers, style, questie = self:GetObjectives(), self:GetAreaStyle(), self:GetQuestie()
		if self.Objectives then
			local needed = markers or style ~= "off"
			if self.Objectives:GetEnabled() ~= needed then self.Objectives:SetEnabled(needed) end
			self.Objectives:SetLayers(markers, style == "circles")
		end
		if self.Regions and self.Regions:GetEnabled() ~= (style == "regions") then self.Regions:SetEnabled(style == "regions") end
		if self.Questie and self.Questie:GetEnabled() ~= questie then self.Questie:SetEnabled(questie) end
	end
	function f:ShowLayers()
		if W.MenuShown(self.LayersButton) then W.HideMenu(); return end
		local style = self:GetAreaStyle()
		W.ShowMenu(self.LayersButton, {
			{ text=L["Polestar regions"], checked=style=="regions", tip=L["The same grouped objective borders as Polestar's world map and minimap."], onClick=function() self:SetAreaStyle(style=="regions" and "off" or "regions") end },
			{ text=L["Purple circles"], checked=style=="circles", tip=L["Show separate spawn clusters instead of grouped borders."], onClick=function() self:SetAreaStyle(style=="circles" and "off" or "circles") end },
			{ separator=true },
			{ text=L["Guide objective markers"], checked=self:GetObjectives(), onClick=function() self:SetObjectives(not self:GetObjectives()) end },
			{ text=L["Questie spawn icons"], checked=self:GetQuestie(), tip=L["Mirror Questie's active objective spawn pins. Questie must be enabled."], onClick=function() self:SetQuestie(not self:GetQuestie()) end },
		}, {minWidth=220})
	end
	function f:GetFollow() return self.follow end
	function f:GetAutoZoom() return self.autoZoom == true end
	function f:SetAutoZoom(on)
		if not self.compact then return end
		self.autoZoom = on and true or false
		self.autoZoomTarget, self.autoZoomTime = nil, nil
		-- Enabling is deliberate: immediately show the whole remaining walk.
		self.autoZoomReset = self.autoZoom
		if options and options.onAutoZoomChanged then options.onAutoZoomChanged(self.autoZoom) end
		self:Refresh(true)
	end
	function f:GetMapID() return self.mapID end
	function f:SetFollow(on)
		self.follow = on and true or false
		if self.follow then self.inspection, self.inspectionIndex = nil, nil end
		self:Refresh(true)
	end
	function f:ShowPlayer()
		self.follow, self.inspection, self.inspectionIndex = true, nil, nil
		local m = readPlayer(); if m then setMap(self, m) end; self:Refresh(true)
	end
	function f:ClearInspection() self.inspection, self.inspectionIndex = nil, nil; self:Refresh(true) end
	-- Inspect authored goal locations without moving the guide engine or its
	-- live navigation target. No speculative straight-line future routes.
	function f:ShowStep(view, index)
		local points, seen = {}, {}
		for _, goal in ipairs(view and view.goals or {}) do
			if not goal.folded and goal.status ~= "na" and #points < 64 then
				local m, x, y = call(ns.Nav and ns.Nav.LiveCoords, goal)
				if numeric(m) and numeric(x) and numeric(y) and x >= 0 and x <= 100 and y >= 0 and y <= 100 then
					local key = m .. ":" .. math.floor(x * 10) .. ":" .. math.floor(y * 10)
					local text = ns.UI and ns.UI.PlainGoalText and ns.UI.PlainGoalText(goal) or goal.text or goal.subject or L["Objective"]
					if seen[key] then seen[key].label = seen[key].label .. "\n" .. text
					else
						local p = { map = m, x = x, y = y, label = text }
						points[#points + 1], seen[key] = p, p
					end
				end
			end
		end
		self.inspection, self.inspectionIndex = points, index
		if points[1] then
			self.follow = false
			setMap(self, points[1].map)
			local x0, x1, y0, y1 = points[1].x, points[1].x, points[1].y, points[1].y
			for _, p in ipairs(points) do
				local x, y = positionOn(self.mapID, p.map, p.x, p.y)
				if x and x >= 0 and x <= 100 and y >= 0 and y <= 100 then x0, x1, y0, y1 = min(x0, x), max(x1, x), min(y0, y), max(y1, y) end
			end
			self.focusX, self.focusY = (x0 + x1) / 2, (y0 + y1) / 2
			self.zoom = min(4, 75 / max(1, x1 - x0, y1 - y0))
		end
		self:Refresh(true)
	end
	function f:SetMapID(id) if numeric(id) and id > 0 then self.follow = false; setMap(self, id); self:Refresh(true) end end
	function f:ZoomIn()
		if self:GetAutoZoom() then self:SetAutoZoom(false) end
		local nextZoom = self.zoom * 1.4
		if numeric(nextZoom) then self.zoom = nextZoom end
		self:Refresh(true)
	end
	function f:ZoomOut()
		if self:GetAutoZoom() then self:SetAutoZoom(false) end
		if self.zoom <= 1 then self:ZoomOutZone()
		else self.zoom = max(1, self.zoom / 1.4); self:Refresh(true) end
	end
	function f:ZoomOutZone()
		if numeric(self.parentMap) then self:SetMapID(self.parentMap) end
	end
	function f:GetViewState() return { zoom = self.zoom, follow = self.follow, mapID = self.mapID, focusX = self.focusX, focusY = self.focusY } end
	function f:ApplyViewState(s)
		if type(s) ~= "table" then return end
		if numeric(s.mapID) and s.mapID > 0 then setMap(self, s.mapID) end
		self.follow = s.follow ~= false
		if numeric(s.zoom) then self.zoom = max(1, s.zoom) end
		if numeric(s.focusX) then self.focusX = clamp(s.focusX, 0, 100) end
		if numeric(s.focusY) then self.focusY = clamp(s.focusY, 0, 100) end
		self:Refresh(true)
	end
	local function cursor()
		local x, y = GetCursorPosition()
		local s = f:GetEffectiveScale() or 1
		return x / s, y / s
	end
	f.Viewport:EnableMouse(true); f.Viewport:EnableMouseWheel(true)
	f.Viewport:RegisterForDrag("LeftButton")
	f.Viewport:RegisterForClicks("LeftButtonUp", "RightButtonUp")
	f.Viewport:SetScript("OnEnter", function() f.regionHover = true; regionHover(f) end)
	f.Viewport:SetScript("OnLeave", function() f.regionHover = false; if f.regionTip then W.HideTooltip(f.Viewport); f.regionTip = nil end end)
	f.Viewport:SetScript("OnMouseWheel", function(_, d) if d > 0 then f:ZoomIn() else f:ZoomOut() end end)
	f.Viewport:SetScript("OnClick", function(_, button) if button == "RightButton" then f:ZoomOutZone() end end)
	f.Viewport:SetScript("OnDoubleClick", function(_, button)
		if button ~= "LeftButton" or not f.View or not C_Map or not C_Map.GetMapInfoAtPosition then return end
		local x, y = cursor()
		local left, top = f.Viewport:GetLeft(), f.Viewport:GetTop()
		if not (left and top) then return end
		local nx, ny = (x - left - f.View.offsetX) / f.View.drawWidth, (top - y - f.View.offsetY) / f.View.drawHeight
		if nx < 0 or nx > 1 or ny < 0 or ny > 1 then return end
		local info = call(C_Map.GetMapInfoAtPosition, f.mapID, nx, ny)
		if info and info.mapID and info.mapID ~= f.mapID then f:SetMapID(info.mapID) end
	end)
	f.Viewport:SetScript("OnDragStart", function()
		if not f.View then return end
		f.follow, f.dragging = false, true
		f.dragX, f.dragY = cursor()
	end)
	f.Viewport:SetScript("OnDragStop", function() f.dragging = false end)
	local function update(self, elapsed)
		self.elapsed = (self.elapsed or 0) + elapsed
		local dragged = false
		if self.dragging and self.View then
			local x, y = cursor()
			if x ~= self.dragX or y ~= self.dragY then
				self.focusX = clamp(self.focusX - (x - self.dragX) / self.View.drawWidth * 100, 0, 100)
				self.focusY = clamp(self.focusY + (y - self.dragY) / self.View.drawHeight * 100, 0, 100)
				self.dragX, self.dragY, dragged = x, y, true
			end
		end
		if self.elapsed >= TICK then
			self.elapsed = 0
			self:Refresh(false)
		elseif dragged then
			-- Smooth mouse movement does not increase the live-player polling
			-- frequency: repaint from the last sample between the 5 Hz ticks.
			refresh(self, false, true)
		end
	end
	f:SetScript("OnShow", function(self) self.elapsed = 0; self:SetScript("OnUpdate", update); self:Refresh(true) end)
	f:SetScript("OnHide", function(self)
		self.dragging, self.regionHover = false, false
		if self.regionTip then W.HideTooltip(self.Viewport); self.regionTip = nil end
		if W.MenuShown(self.LayersButton) then W.HideMenu() end
		self:SetScript("OnUpdate", nil)
	end)
	f:SetScript("OnSizeChanged", function(self) self.dirty = true end)
	-- Events only mark this viewer dirty while hidden; no polling or route
	-- work survives its OnHide. Art may reveal new areas while it is open.
	-- Client generations expose different map events; an unavailable event
	-- must never abort creation of the dashboard. Position still polls while
	-- visible if none of these optional refresh hints exists.
	for _, event in ipairs({ "MAP_EXPLORATION_UPDATED", "ZONE_CHANGED_NEW_AREA", "ZONE_CHANGED", "ZONE_CHANGED_INDOORS", "PLAYER_ENTERING_WORLD" }) do
		pcall(f.RegisterEvent, f, event)
	end
	f:SetScript("OnEvent", function(self) self.artDirty, self.dirty = true, true end)
	f:SetScript("OnUpdate", update)
	f:Refresh(true)
	return f
end
