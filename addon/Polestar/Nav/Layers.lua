-- Nav's own pins, drawn through Polestar.Pins:
--   nav.target  the point being guided to (world map + minimap, clamped to the rim); an
--               area target (a spawn area) also shows its area as a soft disc on the world map
--   nav.route   where the travel route changes mode: flight masters, docks, the inn (world map)
--   nav.goals   the current step's other open goals; click one to point the arrow there (world map)
--   nav.spots   the target's other spawn places, small marks (other places it spawns fainter);
--               click one to search there next (world map)
-- and the trail (Pins.SetTrail): dots from the player along the travel route's lines (each
-- leg's start where the mode changes, and its end), broken at a Hearthstone (a jump, not a
-- path) and across continents; without a route, straight to the target (both surfaces).
-- nav.worldPins / nav.minimapPins switch Nav's layers on each surface; nav.trailDots the trail.

local ADDON, ns = ...
local Nav = ns.Nav
local Pins = ns.Pins
local L = ns.L

local format = string.format

local Layers = {}
Nav.layers = Layers

local TARGET, ROUTE, GOALS, SPOTS = "nav.target", "nav.route", "nav.goals", "nav.spots"

local function color(name)
	local r, g, b = Nav.RGB(name)
	return { r, g, b, 1 }
end

local function targetTooltip(tip)
	local target = Nav.GetTarget()
	if not target then return end
	tip:SetText(target.label or "")
	local dist = Nav.GetDistance()
	if dist then tip:AddLine(ns.FormatDistance(dist), 1, 1, 1) end
end

local function updateTarget(world, minimap)
	local target = Nav.GetTarget()
	if not target then
		Pins.ClearLayer(TARGET)
		return
	end
	-- The target wears the arrow's colour (Theme "arrow": the accent unless
	-- the player picked their own), so map and arrow agree.
	Pins.SetLayer(TARGET, {
		{ map = target.map, x = target.x, y = target.y, f = target.f, color = color("arrow"), glow = true,
			area = target.area, tooltip = targetTooltip, priority = 100 },
	}, { world = world, minimap = minimap, edge = true, scale = 1.4 })
end

-- Every other spot of the target's spawn places, so the player sees where
-- else it may be and can pick where to look next; the other places it spawns
-- (`alt`, never picked by the arrow on its own) are marked fainter.
local function updateSpots(world)
	local target = Nav.GetTarget()
	local spots = world and target and target.spots
	if not spots then
		Pins.ClearLayer(SPOTS)
		return
	end
	local pins, n, label = {}, #spots, target.label
	local r, g, b = Nav.RGB("arrow")
	for i, s in ipairs(spots) do
		if i ~= target.spot then
			local alt = s.alt
			pins[#pins + 1] = {
				map = target.map, x = s.x, y = s.y, f = target.f, color = { r, g, b, alt and 0.5 or 0.75 },
				size = alt and 7 or 9, priority = alt and 15 or 20,
				tooltip = function(tip)
					tip:SetText(label or "")
					tip:AddLine(format(L["Spot %d of %d"], i, n), 0.7, 0.7, 0.7)
					if alt then tip:AddLine(L["It also spawns here"], 0.7, 0.7, 0.7) end
					tip:AddLine(L["Click to search here next"], 0.7, 0.7, 0.7)
				end,
				onClick = function(button)
					if button == "LeftButton" then Nav.NextSpot(i) end
				end,
			}
		end
	end
	Pins.SetLayer(SPOTS, pins, { world = true, minimap = false })
end

local function updateRoute(world)
	local legs, ci
	if Nav.GetRoute then legs, ci = Nav.GetRoute() end
	if not (world and legs and #legs > 1) then
		Pins.ClearLayer(ROUTE)
		return
	end
	local pins = {}
	for i = ci, #legs - 1 do
		local to, nextLeg = legs[i].to, legs[i + 1]
		local step = format(L["Travel route, step %s"], i .. "/" .. #legs)
		pins[#pins + 1] = {
			c = to.c, wx = to.wx, wy = to.wy, color = color("arrow"), priority = 50,
			label = nextLeg.label, step = i,
			tooltip = function(tip)
				tip:SetText(nextLeg.label or "")
				tip:AddLine(step, 0.7, 0.7, 0.7)
			end,
		}
	end
	Pins.SetLayer(ROUTE, pins, { world = true, minimap = false, scale = 0.9 })
end

local function updateGoals(world)
	local Engine = ns.Engine
	local index = world and Engine and Engine.GetStepIndex and Engine.GetStepIndex()
	local view = index and Engine.GetStepView and Engine.GetStepView(index)
	if not (view and view.goals) then
		Pins.ClearLayer(GOALS)
		return
	end
	local target = Nav.GetTarget()
	local pins = {}
	for _, goal in ipairs(view.goals) do
		if goal.map and goal.x and goal.y and (goal.status == "active" or goal.status == "pending")
			and not (target and target.map == goal.map and target.x == goal.x and target.y == goal.y) then
			local text = goal.text
			pins[#pins + 1] = {
				map = goal.map, x = goal.x, y = goal.y, f = goal.f, color = color("place"), priority = 10,
				label = text,
				tooltip = function(tip)
					tip:SetText(text or "")
					tip:AddLine(L["Click to point the arrow here"], 0.7, 0.7, 0.7)
				end,
				onClick = function(button)
					if button == "LeftButton" then Nav.SetTarget(goal.map, goal.x, goal.y, text, goal.f) end
				end,
			}
		end
	end
	if #pins == 0 then
		Pins.ClearLayer(GOALS)
	else
		Pins.SetLayer(GOALS, pins, { world = true, minimap = false })
	end
end

-- The trail's runs: the player, then from the current leg on each leg's start
-- (unless it walks there) and end; a Hearthstone starts a new run at the inn.
local function updateTrail(world, minimap)
	local target = Nav.GetTarget()
	if not (target and ns.Get("nav.trailDots") and (world or minimap)) then
		Pins.ClearTrail()
		return
	end
	local run = { live = true }
	local runs = { run }
	local legs, ci
	if Nav.GetRoute then legs, ci = Nav.GetRoute() end
	if legs and ci and legs[ci] then
		for i = ci, #legs do
			local leg = legs[i]
			if leg.kind == "hearth" then
				run = { leg.to }
				runs[#runs + 1] = run
			else
				if leg.kind ~= "walk" then run[#run + 1] = leg.from end
				run[#run + 1] = leg.to
			end
		end
	else
		local c, wx, wy = Nav.GetTargetWorld()
		if not c then
			Pins.ClearTrail()
			return
		end
		run[1] = { c = c, wx = wx, wy = wy }
	end
	Pins.SetTrail(runs, { world = world, minimap = minimap, color = color("arrow") })
end

local function surfaces()
	return ns.Get("nav.worldPins") and true or false, ns.Get("nav.minimapPins") and true or false
end

function Layers.Update()
	local world, minimap = surfaces()
	updateTarget(world, minimap)
	updateRoute(world)
	updateGoals(world)
	updateSpots(world)
	updateTrail(world, minimap)
end

-- The route moved on to its next leg: its stops and trail start there.
local function onAdvanced()
	local world, minimap = surfaces()
	updateRoute(world)
	updateTrail(world, minimap)
end

Layers.OnTarget = Layers.Update
Layers.OnSettings = Layers.Update
Layers.OnTheme = Layers.Update

ns.On("STEP_UPDATED", Layers.Update)
ns.On("ROUTE_CHANGED", Layers.Update)
ns.On("ROUTE_ADVANCED", onAdvanced)

Nav.RegisterModule(Layers)
