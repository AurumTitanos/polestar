'use strict';
// /polestar where (addon/Polestar/Core/Commands.lua): the player's map and
// position as two guide lines, `zone map <uiMapID>` and `goto <x>,<y> live`
// (the compiler's two decimals; the client's coordinates are the live
// frame), printed with the `@x,y live` form for other goals, and shown in a
// box to copy (UI/Copy.lua).

const { test } = require('node:test');
const assert = require('node:assert/strict');
const { runAddon } = require('./helpers/lua');
const { parseGuide } = require('../tools/lib/dsl/parse');
const { Diagnostics } = require('../tools/lib/dsl/diag');

function where(setup, after = '') {
	return runAddon({
		stubs: ['stub_world.lua'],
		addons: ['Polestar'],
		script: `
			stub.login()
			${setup}
			local before = #stub.messages
			SlashCmdList.POLESTAR("where")
			local printed = {}
			for i = before + 1, #stub.messages do printed[#printed + 1] = stub.messages[i] end
			local box = PolestarCopy and PolestarCopy:IsShown() and PolestarCopy.Box:GetText() or false
			local out = { printed = printed, box = box, focused = box and stub.focus == PolestarCopy.Box or false }
			${after}
			emit(out)`,
	}).emitted[0];
}

test('/polestar where prints the map and a goto line at the position, with a hint for other goals, and opens them in a box to copy', () => {
	const out = where('stub.world.moveTo(1429, 45.12, 62.34)');
	assert.equal(out.printed.length, 3, out.printed.join('\n'));
	assert.ok(out.printed[0].endsWith('zone map 1429'), out.printed.join('\n'));
	assert.ok(out.printed[1].endsWith('goto 45.12,62.34 live'), out.printed.join('\n'));
	assert.ok(out.printed[2].endsWith('For another goal, add @45.12,62.34 live'), out.printed.join('\n'));
	assert.equal(out.box, 'zone map 1429\ngoto 45.12,62.34 live', 'the box holds exactly the two lines to paste');
	assert.equal(out.focused, true, 'the box takes focus, its text selected for copying');
});

test('the copied lines paste into a guide step: the zone, then a goto at the position in the live frame', () => {
	const box = where('stub.world.moveTo(1429, 45.12, 62.34)').box;
	const step = box.split('\n').map((l) => `  ${l}`);
	const text = ['guide test/where', 'title Where', 'faction Alliance', 'levels 1-2', 'zone Elwynn Forest', '',
		'step Here', ...step, ''].join('\n');
	const diag = new Diagnostics();
	const guide = parseGuide(text, 'where.guide', diag);
	assert.deepEqual(diag.sorted().map((d) => `${d.severity}: ${d.message}`), []);
	const goal = guide.steps[0].goals[0];
	assert.deepEqual({ verb: goal.verb, map: goal.zone.map, x: goal.x, y: goal.y, frame: goal.frame },
		{ verb: 'goto', map: 1429, x: 45.12, y: 62.34, frame: 'live' });
});

test('/polestar where keeps two decimals and says so when the client gives no position', () => {
	assert.equal(where('stub.world.moveTo(1429, 7.006, 60)').box, 'zone map 1429\ngoto 7.01,60.00 live');
	const none = where('stub.world.moveTo(nil, nil, nil)');
	assert.equal(none.box, false);
	assert.equal(none.printed.length, 1);
	assert.match(none.printed[0], /No position/);
});

test('the copy box is read-only: typing puts the text back; Escape closes the window', () => {
	const out = where('stub.world.moveTo(1429, 45.12, 62.34)', `
		local b = PolestarCopy.Box
		b:SetText("zone map 1429\\ngoto 45.12,62.34 livex")
		stub.RunScript(b, "OnTextChanged", true)
		out.typed = b:GetText()
		stub.RunScript(b, "OnEscapePressed")
		out.closed = not PolestarCopy:IsShown()`);
	assert.equal(out.typed, 'zone map 1429\ngoto 45.12,62.34 live');
	assert.equal(out.closed, true);
});
