'use strict';
// The route choice window (addon/Polestar/UI/RouteChoice.lua) against the
// real Core + Theme + UI manifests and the fake Engine of tests/lua/stub_ui.lua,
// given the choice data Engine.GetRouteChoice returns.

const { test } = require('node:test');
const assert = require('node:assert/strict');
const { runAddon } = require('./helpers/lua');

const FILES = ['Core/Core.xml', 'Theme/Theme.xml', 'UI/UI.xml'];

const CHOICE = `
local E = Polestar.Engine
CHOSEN = nil
E.GetRouteChoice = function(id)
	if id ~= "tirisfal" then return nil end
	return { from = "tirisfal", fromTitle = "Tirisfal Glades", recommended = "silverpine", joinsAt = "Stonetalon Mountains", options = {
		{ id = "silverpine", title = "Silverpine Forest", zoneName = "Silverpine Forest", minLevel = 10, maxLevel = 18, recommended = true,
			seconds = 140, quests = 44, pitch = "Undercity's backyard.", pros = { "Compact", "Quiet" }, cons = { "Fewer quests" } },
		{ id = "barrens", title = "The Barrens", zoneName = "The Barrens", minLevel = 10, maxLevel = 20, seconds = 610, quests = 57,
			pitch = "The Horde's crossroads, where every road out of Orgrimmar and Thunder Bluff meets.",
			pros = { "Most quests", "Flight paths", "Dungeon nearby", "Group finder" }, cons = { "Busy", "Long runs", "Kill-stealing" } },
	} }
end
E.ChooseRoute = function(from, to) CHOSEN = from .. ">" .. to; return true end
E.PendingRouteChoice = function() return "tirisfal" end
RC = Polestar.UI.RouteChoice
function cardFor(id)
	for _, f in ipairs(stub.frames) do if f.psId == id and f:IsShown() then return f end end
end
`;

function run(script) {
	return runAddon({
		stubs: ['stub_ui.lua'],
		addons: [{ name: 'Polestar', files: FILES }],
		script: `uistub.install()\nstub.login()\n${CHOICE}\n${script}`,
	}).emitted;
}

test('ROUTE_CHOICE opens one card per zone: a stat row on one line across cards, capped pros and cons; the recommended one leads', () => {
	const [out] = run(`
		Polestar.Fire("ROUTE_CHOICE", "tirisfal")
		local F = PolestarRouteChoice
		local s, b = cardFor("silverpine"), cardFor("barrens")
		local function y(region) local _, _, _, _, py = region:GetPoint(1) return py end
		local function shown(list) local n = 0 for _, l in ipairs(list) do if l.Text:IsShown() then n = n + 1 end end return n end
		stub.RunScript(b, "OnEnter")
		local tip = GameTooltip.lines
		emit({
			shown = F:IsShown(), subtitle = F.Subtitle:GetText(),
			names = { s.Name:GetText(), b.Name:GetText() },
			stats = s.Stats:GetText(), textHex = Polestar.Theme.Hex("text"),
			statsY = { y(s.Stats), y(b.Stats) }, ruleY = { y(s.Rule), y(b.Rule) }, consY = { y(s.Cons[1].Text), y(b.Cons[1].Text) },
			tag = s.Tag:IsShown() and s.Tag.Text:GetText(), otherTag = b.Tag:IsShown(),
			pros = { s.Pros[1].Text:GetText(), s.Pros[2].Text:GetText() }, cons = b.Cons[2].Text:GetText(),
			bShown = { pros = shown(b.Pros), cons = shown(b.Cons) },
			tip = tip, closeTip = F.Close.psTip,
			primary = s.Go.psPrimary or false, otherPrimary = b.Go.psPrimary or false,
			button = s.Go.Label:GetText(), sameHeight = s:GetHeight() == b:GetHeight(),
		})`);
	assert.equal(out.shown, true);
	assert.equal(out.subtitle, 'You finished Tirisfal Glades. Both routes meet again in Stonetalon Mountains.');
	assert.deepEqual(out.names, ['Silverpine Forest', 'The Barrens']);
	assert.equal(out.stats, `|c${out.textHex}10–18|r  ·  ~2 min away  ·  44 quests`, 'levels in text, then travel and quests');
	assert.equal(out.statsY[0], out.statsY[1], 'the stat rows line up');
	assert.equal(out.ruleY[0], out.ruleY[1], 'pitches of different lengths still meet one rule');
	assert.equal(out.consY[0], out.consY[1], 'cons start on the same line');
	assert.equal(out.tag, 'Recommended');
	assert.equal(out.otherTag, false);
	assert.deepEqual(out.pros, ['Compact', 'Quiet']);
	assert.equal(out.cons, 'Long runs');
	assert.deepEqual(out.bShown, { pros: 3, cons: 2 }, 'at most 3 pros and 2 cons on the card, one line each');
	assert.ok(out.tip.some((l) => /Group finder/.test(l)) && out.tip.some((l) => /Kill-stealing/.test(l)), 'the full lists are in the tooltip');
	assert.equal(out.closeTip, 'Close');
	assert.equal(out.primary, true);
	assert.equal(out.otherPrimary, false);
	assert.equal(out.button, 'Level in Silverpine Forest');
	assert.equal(out.sameHeight, true);
});

test('choosing a card calls Engine.ChooseRoute and closes; Decide later only closes', () => {
	const [out] = run(`
		Polestar.Fire("ROUTE_CHOICE", "tirisfal")
		stub.RunScript(cardFor("barrens").Go, "OnClick", "LeftButton")
		local r = { chosen = CHOSEN, shown = PolestarRouteChoice:IsShown() }
		CHOSEN = nil
		Polestar.Fire("ROUTE_CHOICE", "tirisfal")
		stub.RunScript(PolestarRouteChoice.Later, "OnClick", "LeftButton")
		r.later = { chosen = CHOSEN, shown = PolestarRouteChoice:IsShown() }
		emit(r)`);
	assert.deepEqual(out, { chosen: 'tirisfal>barrens', shown: false, later: { shown: false } });
});

test('in combat the window waits for the fight to end; the checkbox sets behavior.routeChoice', () => {
	const [out] = run(`
		stub.inCombat = true
		Polestar.Fire("ROUTE_CHOICE", "tirisfal")
		local r = { during = PolestarRouteChoice ~= nil and PolestarRouteChoice:IsShown() or false }
		stub.inCombat = false
		stub.fire("PLAYER_REGEN_ENABLED")
		r.after = PolestarRouteChoice:IsShown()
		local box = PolestarRouteChoice.Always
		box:SetChecked(true)
		stub.RunScript(box, "OnClick", "LeftButton")
		r.setting = Polestar.Get("behavior.routeChoice")
		r.unknown = RC.Show("elsewhere")
		emit(r)`);
	assert.deepEqual(out, { during: false, after: true, setting: 'recommended', unknown: false });
});

test('each card shows its zone painting from the client, framed on the route start; unknown maps get the night band', () => {
	const [out] = run(`
		-- The client's map art: Silverpine (1421) is a 4 x 3 grid of 256px tiles over a 1002 x 668 painting.
		C_Map = C_Map or {}
		C_Map.GetMapArtLayers = function(id)
			if id == 1421 then return { { layerWidth = 1002, layerHeight = 668, tileWidth = 256, tileHeight = 256, minScale = 1, maxScale = 1, additionalZoomSteps = 0 } } end
			return {}
		end
		C_Map.GetMapArtLayerTextures = function(id, layer)
			local t = {}
			for i = 1, 12 do t[i] = 100000 + i end
			return t
		end
		local real = Polestar.Engine.GetRouteChoice
		Polestar.Engine.GetRouteChoice = function(id)
			local c = real(id)
			if c then
				c.options[1].zone, c.options[1].focusX, c.options[1].focusY = 1421, 45, 42
				c.options[2].zone = 9999
			end
			return c
		end
		Polestar.Fire("ROUTE_CHOICE", "tirisfal")
		local s, b = cardFor("silverpine"), cardFor("barrens")
		local a = s.Art
		local tiles = {}
		for _, t in ipairs(a.Tiles) do
			if t:IsShown() then
				local _, _, _, tx, ty = t:GetPoint(1)
				tiles[#tiles + 1] = { t:GetTexture(), tx, ty }
			end
		end
		local _, _, _, cx, cy = a.Canvas:GetPoint(1)
		local bShown = 0
		for _, t in ipairs(b.Art.Tiles) do if t:IsShown() then bShown = bShown + 1 end end
		emit({ tiles = tiles, focusY = a.psFocusY,
			tileW = a.Tiles[1]:GetWidth(), canvas = { a.Canvas:GetWidth(), a.Canvas:GetHeight() }, offset = { cx, cy },
			artW = a:GetWidth(), band = a.Band:IsShown(), painted = s.psArt,
			other = { painted = b.psArt, band = b.Art.Band:IsShown(), tiles = bShown },
			name = s.Name:GetText(), nameOnArt = s.Name:GetParent() == a.Over })`);
	assert.equal(out.painted, true);
	assert.equal(out.band, false);
	const [cw, ch] = out.canvas;
	const s = cw / 1002;
	// Only the tiles the card shows, each the row-major file for its place.
	assert.ok(out.tiles.length > 0 && out.tiles.length < 12, `${out.tiles.length} tiles`);
	for (const [file, tx, ty] of out.tiles) {
		const i = file - 100001;
		assert.ok(Math.abs(tx - (i % 4) * 256 * s) < 0.01 && Math.abs(ty + Math.floor(i / 4) * 256 * s) < 0.01, `tile ${file}`);
	}
	// Zoomed past "fits the card"; the start (45%, 42%) mid-card and in the clear stretch, never past the painting's edges.
	assert.ok(cw > 2 * 270 && Math.abs(cw / ch - 1002 / 668) < 0.01, `canvas ${cw} x ${ch}`);
	assert.ok(Math.abs(out.tileW - (256 * cw) / 1002) < 0.01);
	const [x, y] = out.offset;
	assert.ok(x <= 0 && x >= 270 - cw, `x ${x}`);
	assert.ok(y >= 0 && y <= ch - 116, `y ${y}`);
	assert.ok(Math.abs(-x + 135 - 0.45 * cw) < 0.5, 'the start is centred horizontally');
	assert.ok(Math.abs(0.42 * ch - y - out.focusY) < 0.5, 'and sits between the top shade and the fade');
	// A map the client has no art for: the night band, no tiles.
	assert.deepEqual(out.other, { painted: false, band: true, tiles: 0 });
	assert.equal(out.name, 'Silverpine Forest');
	assert.equal(out.nameOnArt, true);
});
