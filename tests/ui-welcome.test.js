'use strict';
// The first-run welcome (addon/Polestar/UI/Welcome.lua) against the real
// Core + Theme + UI manifests and the fake Engine of tests/lua/stub_ui.lua:
// once per account (PolestarDB.welcomeSeen = 1), never in combat, never over
// the route choice; four pages (three once the routes are no longer alpha)
// whose setup choices write their settings; reopened from About and by
// /polestar welcome.

const { test } = require('node:test');
const assert = require('node:assert/strict');
const { runAddon } = require('./helpers/lua');

const FILES = ['Core/Core.xml', 'Theme/Theme.xml', 'UI/UI.xml'];

// uistub.install marks the welcome seen for every other UI test; here the
// account keeps whatever its saved variables say (nothing on a fresh one).
function run(script, opts = {}) {
	return runAddon({
		stubs: ['stub_ui.lua'],
		addons: [{ name: 'Polestar', files: FILES }],
		saved: opts.saved,
		script: `local savedSeen = PolestarDB and PolestarDB.welcomeSeen
uistub.install()
Polestar.DB().welcomeSeen = savedSeen
${opts.before || ''}
stub.login()
local Wel = Polestar.UI.Welcome
function shown() return PolestarWelcome ~= nil and PolestarWelcome:IsShown() end
function title() return PolestarWelcome.Title:GetText() end
function menuPick(text) for _, r in ipairs(PolestarMenu.rows) do if r:IsShown() and r.Text:GetText() == text then r:Click() return true end end return false end
${script}`,
	}).emitted;
}

test('a fresh account sees the welcome once, shortly after login; closing it marks the account', () => {
	const [out] = run(`
		local atLogin = shown()
		stub.advance(3)
		local after = shown()
		local first = title()
		PolestarWelcome.Skip:Click()
		emit({ atLogin = atLogin, after = after, first = first, closed = not shown(), seen = PolestarDB.welcomeSeen })`);
	assert.deepEqual(out, { atLogin: false, after: true, first: 'Welcome to Polestar', closed: true, seen: 1 });

	const [again] = run('stub.advance(10)\nemit({ shown = shown() })', {
		saved: { Polestar: 'PolestarDB = { schema = 1, settings = {}, welcomeSeen = 1 }' },
	});
	assert.equal(again.shown, false, 'a later login on the same account never shows it again');
});

test('an account that saw the old beta notice still gets the welcome once, and the old flag goes', () => {
	const [out] = run('stub.advance(3)\nemit({ shown = shown(), old = PolestarDB.betaNoticeSeen or false })', {
		saved: { Polestar: 'PolestarDB = { schema = 1, settings = {}, betaNoticeSeen = true }' },
	});
	assert.deepEqual(out, { shown: true, old: false });
});

test('the ✕ and Escape close it and mark it seen too', () => {
	const [out] = run(`
		stub.advance(3)
		PolestarWelcome.Close:Click()
		local x = { closed = not shown(), seen = PolestarDB.welcomeSeen }
		PolestarDB.welcomeSeen = nil
		Wel.Show()
		local special = false
		for _, n in ipairs(UISpecialFrames) do if n == "PolestarWelcome" then special = true end end
		PolestarWelcome:Hide()
		emit({ x = x, special = special, seen = PolestarDB.welcomeSeen })`);
	assert.deepEqual(out, { x: { closed: true, seen: 1 }, special: true, seen: 1 });
});

test('in combat it waits for the fight to end', () => {
	const [out] = run(`
		stub.advance(3)
		local during = shown()
		stub.inCombat = false
		stub.fire("PLAYER_REGEN_ENABLED")
		emit({ during = during, after = shown(), seen = PolestarDB.welcomeSeen or false })`, { before: 'stub.inCombat = true' });
	assert.deepEqual(out, { during: false, after: true, seen: false });
});

test('it never opens over the route choice: it waits for that window to close, and steps aside if one opens', () => {
	const [out] = run(`
		local E = Polestar.Engine
		E.GetRouteChoice = function(id)
			return { from = id, options = { { id = "a", title = "A", recommended = true }, { id = "b", title = "B" } } }
		end
		E.PendingRouteChoice = function() return "x" end
		local RC = Polestar.UI.RouteChoice
		Polestar.Fire("ROUTE_CHOICE", "x")
		stub.advance(3)
		local underChoice = shown()
		RC.Hide()
		local afterChoice = shown()
		PolestarWelcome.Next:Click()
		Polestar.Fire("ROUTE_CHOICE", "x")
		local overWelcome = { welcome = shown(), choice = RC.IsShown(), seen = PolestarDB.welcomeSeen or false }
		RC.Hide()
		emit({ underChoice = underChoice, afterChoice = afterChoice, overWelcome = overWelcome, back = shown(), page = title() })`);
	assert.equal(out.underChoice, false);
	assert.equal(out.afterChoice, true);
	assert.deepEqual(out.overWelcome, { welcome: false, choice: true, seen: false }, 'stepping aside is not closing');
	assert.equal(out.back, true);
	assert.equal(out.page, 'Our routes are still alpha', 'it comes back on the page it left');
});

test('four pages with Next and Back; Next on the last page closes it', () => {
	const [out] = run(`
		Wel.Show()
		local titles, steps = {}, {}
		for i = 1, 4 do
			titles[i] = title()
			steps[i] = PolestarWelcome.Subtitle:GetText()
			if i < 4 then PolestarWelcome.Next:Click() end
		end
		local lastNext = PolestarWelcome.Next.Label:GetText()
		PolestarWelcome.Back:Click()
		local back = title()
		local alpha = uistub.findText(PolestarWelcome, "planned and timed in a simulator") ~= nil
		PolestarWelcome.Back:Click()
		local alphaText = uistub.findText(PolestarWelcome, "Nobody has followed them through the live game yet") ~= nil
		PolestarWelcome.Back:Click()
		PolestarWelcome.Back:Click()
		local firstBack = { title = title(), backShown = PolestarWelcome.Back:IsShown() }
		for i = 1, 3 do PolestarWelcome.Next:Click() end
		PolestarWelcome.Next:Click()
		emit({ titles = titles, steps = steps, lastNext = lastNext, back = back, alpha = alpha, alphaText = alphaText,
			firstBack = firstBack, closed = not shown(), seen = PolestarDB.welcomeSeen })`);
	assert.deepEqual(out.titles, ['Welcome to Polestar', 'Our routes are still alpha', 'Set up', 'Guide packs']);
	assert.deepEqual(out.steps, ['1 of 4', '2 of 4', '3 of 4', '4 of 4']);
	assert.equal(out.lastNext, 'Done');
	assert.equal(out.back, 'Set up');
	assert.equal(out.alpha, false, 'the alpha text is only on its own page');
	assert.equal(out.alphaText, true);
	assert.deepEqual(out.firstBack, { title: 'Welcome to Polestar', backShown: false });
	assert.equal(out.closed, true);
	assert.equal(out.seen, 1);
});

test('the alpha page follows ns.routesAlpha: three pages once the routes are proven', () => {
	const [out] = run(`
		Polestar.routesAlpha = false
		Wel.Show()
		local titles = {}
		for i = 1, 3 do titles[i] = title(); PolestarWelcome.Next:Click() end
		emit({ titles = titles, closed = not shown() })`);
	assert.deepEqual(out.titles, ['Welcome to Polestar', 'Set up', 'Guide packs']);
	assert.equal(out.closed, true);
});

test('the setup page writes its settings: quest automation both ways, the login guide and the scheme', () => {
	const [out] = run(`
		Wel.Show("setup")
		local get = Polestar.Get
		local F = PolestarWelcome
		local start = { title = title(), on = F.AutoQuest.checked }
		F.AutoQuest:Click()
		local off = { get("behavior.autoAccept"), get("behavior.autoTurnin"), F.AutoQuest.checked }
		F.AutoQuest:Click()
		local on = { get("behavior.autoAccept"), get("behavior.autoTurnin"), F.AutoQuest.checked }
		Polestar.Set("behavior.autoTurnin", false)
		local partly = F.AutoQuest.checked
		F.AutoGuide:Click()
		local guide = get("behavior.autoSelectGuide")
		F.Scheme.Button:Click()
		local picked = menuPick("Graphite")
		emit({ start = start, off = off, on = on, partly = partly, guide = guide, picked = picked, scheme = get("ui.scheme"),
			shown = F.Scheme.Button.Label:GetText() })`);
	assert.deepEqual(out.start, { title: 'Set up', on: true });
	assert.deepEqual(out.off, [false, false, false], 'one switch turns both accepting and turning in off');
	assert.deepEqual(out.on, [true, true, true]);
	assert.equal(out.partly, false, 'on only while both are on');
	assert.equal(out.guide, false);
	assert.equal(out.picked, true);
	assert.equal(out.scheme, 'graphite');
	assert.equal(out.shown, 'Graphite');
});

test('the guide packs page: Start opens the suggested guide, Browse guides opens the picker', () => {
	const [out] = run(`
		Wel.Show("packs")
		local F = PolestarWelcome
		local label = F.Start.Label:GetText()
		local want = "Start " .. uistub.guides[uistub.suggest].title
		F.Start:Click()
		local opened
		for _, c in ipairs(uistub.calls) do if c[1] == "OpenTab" or c[1] == "SetGuide" then opened = c[2] end end
		local closed = not shown()
		Wel.Show("packs")
		F.Browse:Click()
		emit({ label = label, want = want, opened = opened, suggest = uistub.suggest, closed = closed,
			picker = PolestarPicker ~= nil and PolestarPicker:IsShown(), browseClosed = not shown(), seen = PolestarDB.welcomeSeen })`);
	assert.equal(out.label, out.want);
	assert.equal(out.opened, out.suggest);
	assert.equal(out.closed, true);
	assert.equal(out.picker, true);
	assert.equal(out.browseClosed, true);
	assert.equal(out.seen, 1);

	const [none] = run(`
		uistub.suggest = nil
		Wel.Show("packs")
		local label = PolestarWelcome.Start.Label:GetText()
		PolestarWelcome.Start:Click()
		emit({ label = label, picker = PolestarPicker ~= nil and PolestarPicker:IsShown() })`);
	assert.deepEqual(none, { label: 'Choose a guide', picker: true });
});

test('the guide packs page names its parts and links the pack docs where the TOC gives a website', () => {
	const [out] = run(`
		stub.addonMeta.Polestar = { ["X-Website"] = "https://example.org/polestar" }
		Wel.Show("packs")
		local F = PolestarWelcome
		emit({ url = Polestar.DocsURL(), box = F.Docs:IsShown() and F.Docs:GetText(),
			author = uistub.findText(F, "made and supported by its author") ~= nil,
			install = uistub.findText(F, "restart the game") ~= nil })`);
	assert.deepEqual(out, {
		url: 'https://example.org/polestar/blob/HEAD/docs/PACKS.md',
		box: 'https://example.org/polestar/blob/HEAD/docs/PACKS.md',
		author: true,
		install: true,
	});

	const [bare] = run(`
		local none = Polestar.DocsURL()
		stub.addonMeta.Polestar = { ["X-Website"] = "" }
		local empty = Polestar.DocsURL()
		Wel.Show("packs")
		emit({ none = none or false, empty = empty or false, box = PolestarWelcome.Docs:IsShown(),
			text = uistub.findText(PolestarWelcome, "docs/PACKS.md in Polestar's source") ~= nil })`);
	assert.deepEqual(bare, { none: false, empty: false, box: false, text: true });
});

test('About and /polestar welcome reopen it on its first page', () => {
	const [out] = run(`
		stub.advance(3)
		PolestarWelcome.Next:Click()
		PolestarWelcome.Skip:Click()
		Polestar.UI.ShowOptions("about")
		Polestar.UI.Options.view.Welcome:Click()
		local about = { shown = shown(), title = title() }
		PolestarWelcome:Hide()
		SlashCmdList.POLESTAR("welcome")
		emit({ about = about, command = shown(), title = title() })`);
	assert.deepEqual(out, { about: { shown: true, title: 'Welcome to Polestar' }, command: true, title: 'Welcome to Polestar' });
});
