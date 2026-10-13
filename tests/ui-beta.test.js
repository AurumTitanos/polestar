'use strict';
// The first-run beta notice (addon/Polestar/UI/BetaNotice.lua) against the
// real Core + Theme + UI manifests and the fake Engine of tests/lua/stub_ui.lua:
// once per account, never in combat, never over the route choice.

const { test } = require('node:test');
const assert = require('node:assert/strict');
const { runAddon } = require('./helpers/lua');

const FILES = ['Core/Core.xml', 'Theme/Theme.xml', 'UI/UI.xml'];

// uistub.install marks the notice seen for every other UI test; a fresh
// account here starts without the flag unless `saved` restores one.
function run(script, opts = {}) {
	const fresh = opts.saved ? '' : 'Polestar.DB().betaNoticeSeen = nil';
	return runAddon({
		stubs: ['stub_ui.lua'],
		addons: [{ name: 'Polestar', files: FILES }],
		saved: opts.saved,
		script: `uistub.install()\n${fresh}\n${opts.before || ''}\nstub.login()\nfunction shown() return PolestarBetaNotice ~= nil and PolestarBetaNotice:IsShown() end\n${script}`,
	}).emitted;
}

test('a fresh account sees the notice once, shortly after login; closing it marks the account', () => {
	const [out] = run(`
		local atLogin = shown()
		stub.advance(3)
		local after = shown()
		PolestarBetaNotice.OK:Click()
		emit({ atLogin = atLogin, after = after, closed = not shown(), seen = PolestarDB.betaNoticeSeen })`);
	assert.deepEqual(out, { atLogin: false, after: true, closed: true, seen: true });

	const [again] = run('stub.advance(10)\nemit({ shown = shown() })', {
		saved: { Polestar: 'PolestarDB = { schema = 1, settings = {}, betaNoticeSeen = true }' },
	});
	assert.equal(again.shown, false, 'a later login on the same account never shows it again');
});

test('in combat it waits for the fight to end', () => {
	const [out] = run(`
		stub.advance(3)
		local during = shown()
		stub.inCombat = false
		stub.fire("PLAYER_REGEN_ENABLED")
		emit({ during = during, after = shown(), seen = PolestarDB.betaNoticeSeen or false })`, { before: 'stub.inCombat = true' });
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
		Polestar.Fire("ROUTE_CHOICE", "x")
		local overNotice = { notice = shown(), choice = RC.IsShown(), seen = PolestarDB.betaNoticeSeen or false }
		RC.Hide()
		emit({ underChoice = underChoice, afterChoice = afterChoice, overNotice = overNotice, back = shown() })`);
	assert.equal(out.underChoice, false);
	assert.equal(out.afterChoice, true);
	assert.deepEqual(out.overNotice, { notice: false, choice: true, seen: false }, 'stepping aside is not closing');
	assert.equal(out.back, true);
});
