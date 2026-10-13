'use strict';
// The welcome (addon/Polestar/UI/Welcome.lua) against the real Core + Theme +
// UI manifests and the fake Engine of tests/lua/stub_ui.lua: once per new
// character (PolestarCharDB.welcomeSeen = 1), with Set up only while the
// account has not had one (PolestarDB.welcomeSeen = 1); never in combat,
// never over the route choice; a first page that greets the character; four
// pages (three once the routes are no longer alpha) whose setup choices write
// their settings; opened from About and by /polestar welcome.

const { test } = require('node:test');
const assert = require('node:assert/strict');
const { runAddon } = require('./helpers/lua');

const FILES = ['Core/Core.xml', 'Theme/Theme.xml', 'UI/UI.xml'];

// Saved variables: an account that has had its welcome, a character Polestar
// knew before the welcome had a flag, one that has seen it, one still due.
const ACCOUNT_SEEN = 'PolestarDB = { schema = 1, settings = {}, welcomeSeen = 1 }';
const ACCOUNT_NEW = 'PolestarDB = { schema = 1, settings = {} }';
const CHAR_KNOWN = 'PolestarCharDB = { schema = 1 }';
const CHAR_SEEN = 'PolestarCharDB = { schema = 1, welcomeSeen = 1 }';
const CHAR_DUE = 'PolestarCharDB = { schema = 1, welcomeSeen = 0 }';

// uistub.install marks the welcome seen for every other UI test; here the
// account and the character keep what their saved variables (and the addon
// loading) made of them.
function run(script, opts = {}) {
	return runAddon({
		stubs: ['stub_ui.lua'],
		addons: [{ name: 'Polestar', files: FILES }],
		saved: opts.saved && { Polestar: opts.saved },
		script: `local savedSeen = PolestarDB and PolestarDB.welcomeSeen
local savedChar = PolestarCharDB and PolestarCharDB.welcomeSeen
uistub.install()
Polestar.DB().welcomeSeen = savedSeen
Polestar.CharState().welcomeSeen = savedChar
${opts.before || ''}
stub.login()
local Wel = Polestar.UI.Welcome
function shown() return PolestarWelcome ~= nil and PolestarWelcome:IsShown() end
function title() return PolestarWelcome.Title:GetText() end
function titles()
	local out = {}
	repeat
		out[#out + 1] = title()
		PolestarWelcome.Next:Click()
	until not shown() or #out > 6
	return out
end
function plain(s) return (s:gsub("|c%x%x%x%x%x%x%x%x", ""):gsub("|r", "")) end
function menuPick(text) for _, r in ipairs(PolestarMenu.rows) do if r:IsShown() and r.Text:GetText() == text then r:Click() return true end end return false end
${script}`,
	}).emitted;
}

test('a new character sees the welcome once, shortly after login; opening it marks the character, closing it the account', () => {
	const [out] = run(`
		local atLogin = shown()
		stub.advance(3)
		local after = shown()
		local first = title()
		local step = PolestarWelcome.Subtitle:GetText()
		local open = { char = PolestarCharDB.welcomeSeen, account = PolestarDB.welcomeSeen or false }
		PolestarWelcome.Skip:Click()
		emit({ atLogin = atLogin, after = after, first = first, step = step, open = open, closed = not shown(),
			char = PolestarCharDB.welcomeSeen, account = PolestarDB.welcomeSeen })`);
	assert.deepEqual(out, { atLogin: false, after: true, first: 'Hello, Testchar', step: '1 of 4',
		open: { char: 1, account: false }, closed: true, char: 1, account: 1 },
	'a reload or logout with it still up does not show it again');
});

test('a character with saved data and no flag never gets it unasked, even on an account that never saw it', () => {
	const [out] = run('stub.advance(10)\nemit({ shown = shown(), char = PolestarCharDB.welcomeSeen, account = PolestarDB.welcomeSeen or false })', {
		saved: `${ACCOUNT_NEW}\n${CHAR_KNOWN}`,
	});
	assert.deepEqual(out, { shown: false, char: 1, account: false });
});

test('a later login of a character that has seen it does not show it', () => {
	const [out] = run('stub.advance(10)\nemit({ shown = shown() })', { saved: `${ACCOUNT_SEEN}\n${CHAR_SEEN}` });
	assert.equal(out.shown, false);
});

test('a new character on an account that has had its welcome gets it without Set up; /polestar welcome shows every page', () => {
	const [out] = run(`
		stub.advance(3)
		local login = titles()
		SlashCmdList.POLESTAR("welcome")
		local asked = titles()
		emit({ login = login, asked = asked, char = PolestarCharDB.welcomeSeen })`, { saved: ACCOUNT_SEEN });
	assert.deepEqual(out.login, ['Hello, Testchar', 'Our routes are still alpha', 'Guide packs']);
	assert.deepEqual(out.asked, ['Hello, Testchar', 'Our routes are still alpha', 'Set up', 'Guide packs']);
	assert.equal(out.char, 1);
});

test('a due welcome that never opened shows at the next login', () => {
	const [out] = run('stub.advance(3)\nemit({ shown = shown() })', { saved: `${ACCOUNT_SEEN}\n${CHAR_DUE}` });
	assert.equal(out.shown, true);
});

test('an account that saw the old beta notice still gets the welcome on a new character, and the old flag goes', () => {
	const [out] = run('stub.advance(3)\nemit({ shown = shown(), old = PolestarDB.betaNoticeSeen or false })', {
		saved: 'PolestarDB = { schema = 1, settings = {}, betaNoticeSeen = true }',
	});
	assert.deepEqual(out, { shown: true, old: false });
});

test('the first page greets the character by name and names the guide Polestar suggests', () => {
	const [out] = run(`
		local g = uistub.guides[uistub.suggest]
		local function page() return plain(PolestarWelcome.pages.welcome.Text:GetText()) end
		local function again() PolestarWelcome:Hide(); Wel.Show(); return page() end
		Wel.Show()
		local named = title()
		local text = page()
		local zoneTitle = g.title
		g.title = "First Steps"
		local other = again()
		uistub.player = { name = "Testchar", level = 7 }
		local levelOnly = again()
		uistub.player = {}
		Polestar.Compat.GetZoneText = function() return nil end
		local nothing = again()
		uistub.suggest = nil
		local none = again()
		emit({ named = named, title = title(), text = text, zoneTitle = zoneTitle, other = other,
			levelOnly = levelOnly, nothing = nothing, none = none })`);
	assert.equal(out.named, 'Hello, Testchar');
	assert.equal(out.title, 'Welcome to Polestar', 'without a name');
	assert.equal(out.zoneTitle, 'Elwynn Forest');
	assert.ok(out.text.startsWith('Polestar suggests Elwynn Forest for your level 4 Human Warrior.'), 'a guide named for the zone: ' + out.text);
	assert.ok(out.other.startsWith('Polestar suggests First Steps for your level 4 Human Warrior in Elwynn Forest.'), out.other);
	assert.ok(out.levelOnly.startsWith('Polestar suggests First Steps for your level 7 character in Elwynn Forest.'), out.levelOnly);
	assert.ok(out.nothing.startsWith('Polestar suggests First Steps for you.'), out.nothing);
	for (const part of ['The guide window', 'The arrow', '/polestar guides']) assert.ok(out.text.includes(part), part);
	assert.ok(out.none.startsWith('Polestar has no guide to suggest for where you are.\n\n'), out.none);
	assert.ok(out.none.includes('/polestar guides'), 'the third paragraph still names /polestar guides');
});

test('the ✕ and Escape close it and mark it seen too', () => {
	const [out] = run(`
		stub.advance(3)
		PolestarWelcome.Close:Click()
		local x = { closed = not shown(), seen = PolestarCharDB.welcomeSeen }
		PolestarCharDB.welcomeSeen = 0
		Wel.Show()
		local special = false
		for _, n in ipairs(UISpecialFrames) do if n == "PolestarWelcome" then special = true end end
		PolestarWelcome:Hide()
		emit({ x = x, special = special, seen = PolestarCharDB.welcomeSeen })`);
	assert.deepEqual(out, { x: { closed: true, seen: 1 }, special: true, seen: 1 });
});

test('in combat it waits for the fight to end', () => {
	const [out] = run(`
		stub.advance(3)
		local during = { shown = shown(), char = PolestarCharDB.welcomeSeen }
		stub.inCombat = false
		stub.fire("PLAYER_REGEN_ENABLED")
		emit({ during = during, after = shown(), seen = PolestarDB.welcomeSeen or false })`, { before: 'stub.inCombat = true' });
	assert.deepEqual(out, { during: { shown: false, char: 0 }, after: true, seen: false });
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
		local overWelcome = { welcome = shown(), choice = RC.IsShown(), char = PolestarCharDB.welcomeSeen }
		RC.Hide()
		emit({ underChoice = underChoice, afterChoice = afterChoice, overWelcome = overWelcome, back = shown(), page = title(),
			step = PolestarWelcome.Subtitle:GetText() })`, { saved: ACCOUNT_SEEN });
	assert.equal(out.underChoice, false);
	assert.equal(out.afterChoice, true);
	assert.deepEqual(out.overWelcome, { welcome: false, choice: true, char: 1 }, 'stepped aside, already marked shown');
	assert.equal(out.back, true);
	assert.equal(out.page, 'Our routes are still alpha', 'it comes back on the page it left');
	assert.equal(out.step, '2 of 3', 'with the pages it started with');
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
	assert.deepEqual(out.titles, ['Hello, Testchar', 'Our routes are still alpha', 'Set up', 'Guide packs']);
	assert.deepEqual(out.steps, ['1 of 4', '2 of 4', '3 of 4', '4 of 4']);
	assert.equal(out.lastNext, 'Done');
	assert.equal(out.back, 'Set up');
	assert.equal(out.alpha, false, 'the alpha text is only on its own page');
	assert.equal(out.alphaText, true);
	assert.deepEqual(out.firstBack, { title: 'Hello, Testchar', backShown: false });
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
	assert.deepEqual(out.titles, ['Hello, Testchar', 'Set up', 'Guide packs']);
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
	assert.deepEqual(out, { about: { shown: true, title: 'Hello, Testchar' }, command: true, title: 'Hello, Testchar' });
});
