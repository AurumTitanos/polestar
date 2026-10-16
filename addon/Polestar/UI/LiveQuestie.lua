-- Optional, read-only Questie spawn layer for the native Planner.
-- Questie has already applied its Forever database, phase and objective filters
-- when it registers these pins. Mirror their data; never reuse/move their
-- frames or call their tooltip (which recolours and mutates Questie's pins).
local ADDON, ns = ...
local L = ns.L
local QuestieLayer = {}
ns.LiveQuestie = QuestieLayer

local min, max = math.min, math.max
local SCAN_INTERVAL, SCAN_LIMIT, POINT_LIMIT, MARKER_LIMIT = 0.5, 12000, 3000, 600
local FALLBACK = "Interface\\AddOns\\" .. ADDON .. "\\Media\\Nav\\pin"
local coordinates = setmetatable({}, { __mode = "k" })

local function readable(v)
	return not (ns.Compat and ns.Compat.IsSecret and ns.Compat.IsSecret(v))
end
local function numeric(v)
	return readable(v) and type(v) == "number" and v == v and v > -math.huge and v < math.huge
end
local function text(v) return readable(v) and type(v) == "string" and v ~= "" and v or nil end
local function tableOf(v) return readable(v) and type(v) == "table" and v or nil end
local function call(fn, ...)
	if type(fn) ~= "function" then return nil end
	local ok, a, b, c, d = pcall(fn, ...)
	if ok then return a, b, c, d end
end
local function same(a, b)
	if not a or #a ~= #b then return false end
	for i = 1, #a do if a[i] ~= b[i] then return false end end
	return true
end

local function world(frame)
	local map, x, y = frame.UiMapID, frame.x, frame.y
	if not (numeric(map) and numeric(x) and numeric(y)) or x < 0 or x > 100 or y < 0 or y > 100 then return nil end
	local convert = ns.Compat and ns.Compat.MapToWorld
	local old = coordinates[frame]
	if old and old.map == map and old.x == x and old.y == y and old.convert == convert then return old end
	local c, wx, wy = call(convert, map, x, y)
	if not (numeric(c) and numeric(wx) and numeric(wy)) then return nil end
	local p = { map = map, x = x, y = y, c = c, wx = wx, wy = wy, convert = convert }
	coordinates[frame] = p
	return p
end

local function visibleObjective(frame)
	local d = tableOf(frame.data)
	if not d or d.Type == "available" or d.Type == "complete" or d.Type == "manual" then return nil end
	local o, q = tableOf(d.ObjectiveData), tableOf(d.QuestData)
	if not o or o.HideIcons or (q and q.HideIcons) then return nil end
	if o.Completed == true and not o.IsPartyObjective then return nil end
	-- IsShown/IsVisible is deliberately irrelevant: the Blizzard map may be
	-- closed, or its minimap may be showing a different zone. `hidden` is
	-- Questie's logical FakeHide flag and retains its tracking/profile filters.
	if frame.hidden then return nil end
	return d, o, q
end

local function appearance(frame, d)
	local t = frame.texture
	local icon = t and call(t.GetTexture, t)
	if not ((text(icon)) or numeric(icon)) then
		local used = Questie and tableOf(Questie.usedIcons)
		icon = used and used[d.Icon]
	end
	if not (text(icon) or numeric(icon)) then icon = FALLBACK end
	local r, g, b
	if t then r, g, b = call(t.GetVertexColor, t) end
	if not (numeric(r) and numeric(g) and numeric(b)) then r, g, b = 1, 1, 1 end
	local db = Questie and tableOf(Questie.db)
	local profile = db and tableOf(db.profile)
	local color = tableOf(d.IconColor)
	-- Match the minimap's objective-color preference even when only the
	-- hidden world-map copy is registered. Its distance fade is irrelevant here.
	if profile and profile.questMinimapObjectiveColors ~= nil then
		if profile.questMinimapObjectiveColors and color
			and numeric(color[1]) and numeric(color[2]) and numeric(color[3]) then
			r, g, b = color[1], color[2], color[3]
		else r, g, b = 1, 1, 1 end
	end
	local uv
	if t and type(t.GetTexCoord) == "function" then
		local result = { pcall(t.GetTexCoord, t) }
		if result[1] and (#result == 5 or #result == 9) then
			uv = {}
			for i = 2, #result do if not numeric(result[i]) then uv = nil; break end; uv[#uv + 1] = result[i] end
		end
	end
	-- Questie draws objective colors on a separate halo, not on the bag art.
	-- BaseOnHide clears that halo when the source map closes; use its minimap
	-- preference and ObjectiveData.Color so our map doesn't lose those colors.
	local glowTexture = frame.glowTexture
	local glowShown = glowTexture and call(glowTexture.IsShown, glowTexture)
	if profile and profile.alwaysGlowMinimap ~= nil then glowShown = profile.alwaysGlowMinimap end
	local glow
	if glowShown then
		local objective = tableOf(d.ObjectiveData)
		local rgb = objective and tableOf(objective.Color)
		local gr, gg, gb
		if rgb then gr, gg, gb = rgb[1], rgb[2], rgb[3] end
		local glowIcon = glowTexture and call(glowTexture.GetTexture, glowTexture)
		local icons = Questie and tableOf(Questie.icons)
		if not (text(glowIcon) or numeric(glowIcon)) then glowIcon = icons and icons.glow end
		if (text(glowIcon) or numeric(glowIcon)) and numeric(gr) and numeric(gg) and numeric(gb) then
			glow = { icon = glowIcon, r = gr, g = gg, b = gb }
		end
	end
	return { icon = icon, r = r, g = g, b = b, uv = uv, glow = glow }
end

local function objectiveEntry(modules, d, o, q)
	local cache = tableOf(modules.QuestLogCache)
	local cached = cache and call(cache.TryGetQuest, d.Id)
	cached = tableOf(cached)
	local native = cached and not o.IsPartyObjective and not o.IsSourceItem and not o.IsRequiredSourceItem
		and tableOf(cached.objectives) and tableOf(cached.objectives[d.ObjectiveIndex])
	local progress = native and text(native.text) or text(o.NativeText)
	if not progress then
		progress = text(o.Description) or L["Quest objective"]
		if numeric(o.Collected) and numeric(o.Needed) then
			progress = progress .. string.format("  %d/%d", o.Collected, o.Needed)
		end
	end
	return { name = text(d.Name) or L["Quest spawn"], quest = cached and text(cached.title)
		or q and (text(q.name) or text(q.Name)) or (numeric(d.Id) and string.format(L["Quest %d"], d.Id) or L["Quest objective"]),
		progress = progress, party = o.IsPartyObjective and true or false,
		key = tostring(d.Id) .. ":" .. tostring(d.ObjectiveIndex) .. ":" .. (text(d.Name) or "") }
end

local function collect(f)
	local loader = tableOf(QuestieLoader)
	local modules = loader and tableOf(loader._modules)
	local qm = modules and tableOf(modules.QuestieMap)
	local registry = qm and tableOf(qm.questIdFrames)
	if not registry then
		f.scene, f.status, f.available, f.truncated = {}, loader and L["Questie pins not ready"] or L["Questie not loaded"], false, false
		return
	end
	local points, byPosition, entriesByData, scans = {}, {}, {}, 0
	local truncated = false
	for _, names in pairs(registry) do
		if type(names) == "table" then
			for name, value in pairs(names) do
				scans = scans + 1
				if scans > SCAN_LIMIT then truncated = true; break end
				local frame = type(name) == "string" and _G[name] or type(value) == "string" and _G[value]
				if frame then
					local d, o, q = visibleObjective(frame)
					local p = d and world(frame)
					if p then
						local key = string.format("%d:%.6f:%.6f", p.map, p.x, p.y)
						local point = byPosition[key]
						if not point and #points < POINT_LIMIT then
							point = { c = p.c, wx = p.wx, wy = p.wy, map = p.map, x = p.x, y = p.y,
								entries = {}, entryKeys = {}, key = key }
							byPosition[key], points[#points + 1] = point, point
						elseif not point then truncated = true end
						if point then
							-- Prefer the minimap styling, without its distance-dependent alpha.
							local mini = frame.miniMapIcon and true or false
							local appearanceKey = tostring(d.Id) .. ":" .. tostring(d.ObjectiveIndex) .. ":" .. (text(d.Name) or "")
							if not point.appearance or (not point.mini and mini)
								or (point.mini == mini and appearanceKey < point.appearanceKey) then
								point.appearance, point.mini, point.appearanceKey = appearance(frame, d), mini, appearanceKey
							end
							local entry = entriesByData[d]
							if not entry then entry = objectiveEntry(modules, d, o, q); entriesByData[d] = entry end
							if not point.entryKeys[entry.key] then
								point.entryKeys[entry.key] = true; point.entries[#point.entries + 1] = entry
							end
						end
					end
				end
			end
		end
		if scans > SCAN_LIMIT then break end
	end

	table.sort(points, function(a, b) return a.key < b.key end)
	for _, p in ipairs(points) do
		table.sort(p.entries, function(a, b) return a.key < b.key end)
		p.name, p.lines = p.entries[1].name, {}
		local multipleNames = false
		for _, e in ipairs(p.entries) do if e.name ~= p.name then multipleNames = true; break end end
		if multipleNames then p.name = L["Questie spawns"] end
		for _, e in ipairs(p.entries) do
			if multipleNames then p.lines[#p.lines + 1] = e.name end
			p.lines[#p.lines + 1] = e.quest .. (e.party and " " .. L["(party objective)"] or "")
			p.lines[#p.lines + 1] = e.progress
		end
		p.lines[#p.lines + 1] = string.format(L["Questie spawn location: %.1f, %.1f"], p.x, p.y)
		p.lines[#p.lines + 1] = L["Known spawn location; not a live mob detector"]
		p.entryKeys = nil
	end
	f.scene, f.available, f.truncated = points, true, truncated
	f.status = #points == 0 and L["No active Questie spawn pins"] or L["Questie objective spawns"]
	f.scanCount = (f.scanCount or 0) + 1
end

local function markerAt(f, parent, i)
	local marker = f.Markers[i]
	if marker then return marker end
	marker = CreateFrame("Button", nil, parent)
	marker:SetSize(18, 18)
	marker.Glow = marker:CreateTexture(nil, "BACKGROUND")
	marker.Glow:SetPoint("CENTER", marker, "CENTER")
	marker.Glow:SetSize(18 * 1.13, 18 * 1.13)
	marker.Glow:Hide()
	marker.Icon = marker:CreateTexture(nil, "ARTWORK")
	marker.Icon:SetAllPoints(marker)
	marker:SetScript("OnEnter", function(self)
		local p = self.spawn
		if p and ns.Widgets and ns.Widgets.Tooltip then ns.Widgets.Tooltip(self, "ANCHOR_RIGHT", p.name, p.lines) end
	end)
	marker:SetScript("OnLeave", function(self) if ns.Widgets and ns.Widgets.HideTip then ns.Widgets.HideTip(self) end end)
	f.Markers[i] = marker
	return marker
end

local function hide(f)
	for _, marker in ipairs(f.Markers) do marker:Hide(); marker.spawn = nil end
	f.markerCount, f.paintSignature = 0, nil
end

local function paint(f, map)
	local b, v = map.bounds, map.View
	local padding = 18 * 1.13 / 2
	local left, right = max(padding, v.offsetX + padding), min(v.width - padding, v.offsetX + v.drawWidth - padding)
	local top, bottom = max(padding, v.offsetY + padding), min(v.height - padding, v.offsetY + v.drawHeight - padding)
	f.markerCount, f.displayTruncated = 0, false
	for _, p in ipairs(f.scene) do
		if p.c == b.c then
			local x = v.offsetX + (p.wy - b.left) * b.kx * v.drawWidth
			local y = v.offsetY + (p.wx - b.top) * b.ky * v.drawHeight
			if x >= left and x <= right and y >= top and y <= bottom then
				if f.markerCount >= MARKER_LIMIT then f.displayTruncated = true; break end
				f.markerCount = f.markerCount + 1
				local marker, a = markerAt(f, f, f.markerCount), p.appearance
				marker.spawn = p
				marker:ClearAllPoints(); marker:SetPoint("CENTER", f, "TOPLEFT", x, -y)
				marker.Icon:SetTexture(a.icon); marker.Icon:SetVertexColor(a.r, a.g, a.b, 1)
				if a.uv then marker.Icon:SetTexCoord(unpack(a.uv)) else marker.Icon:SetTexCoord(0, 1, 0, 1) end
				if a.glow then
					marker.Glow:SetTexture(a.glow.icon)
					marker.Glow:SetVertexColor(a.glow.r, a.glow.g, a.glow.b, 1)
					marker.Glow:Show()
				else marker.Glow:Hide() end
				marker:Show()
			end
		end
	end
	for i = f.markerCount + 1, #f.Markers do f.Markers[i]:Hide(); f.Markers[i].spawn = nil end
	f.paints = (f.paints or 0) + 1
end

function QuestieLayer.Create(parent)
	local f = CreateFrame("Frame", nil, parent)
	f:SetAllPoints(parent)
	f.Markers, f.scene, f.enabled, f.status = {}, {}, true, L["Questie pins not checked"]
	function f:SetEnabled(enabled)
		self.enabled, self.lastScan = enabled and true or false, nil
		self:SetShown(self.enabled)
		if not self.enabled then hide(self) end
	end
	function f:GetEnabled() return self.enabled end
	function f:GetStatus() return self.status, self.available, self.truncated or self.displayTruncated end
	function f:Refresh(map)
		if not self.enabled or not self:IsVisible() then return end
		if not (map and map.art and map.View and map.bounds) then hide(self); return end
		local now = call(GetTime) or 0
		local changed = not self.lastScan or now < self.lastScan or now - self.lastScan >= SCAN_INTERVAL
		if changed then
			self.lastScan = now
			local ok = pcall(collect, self)
			if not ok then self.scene, self.available, self.status = {}, false, L["Questie pin format unavailable"] end
		end
		local v, b = map.View, map.bounds
		local sig = { v.width, v.height, v.offsetX, v.offsetY, v.drawWidth, v.drawHeight,
			b.c, b.left, b.top, b.kx, b.ky }
		if changed or not same(self.paintSignature, sig) then paint(self, map); self.paintSignature = sig end
	end
	return f
end
