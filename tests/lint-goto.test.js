'use strict';
// A `goto` right before a goal that already leads to the same place
// (tools/lib/dsl/validate.js, checkRedundantGotos): warned with a fix hint;
// approach waypoints, lone gotos and paths are kept.

const { test } = require('node:test');
const assert = require('node:assert/strict');
const { compile, guideText, lineOf } = require('./helpers/dsl');

const gotoWarnings = (src) => compile(src).diag.warnings.filter((d) => /already leads/.test(d.message));

test('a goto next to the kill goal it leads to is warned, naming both and how to fix it', () => {
	const src = guideText(['step Kobolds', '  goto 47.6,31.5 "Kobold camp"', '  kill 6 x10']);
	const ws = gotoWarnings(src);
	assert.equal(ws.length, 1);
	assert.equal(ws[0].line, lineOf(src, '  goto 47.6,31.5 "Kobold camp"'));
	assert.match(ws[0].message, new RegExp(`^\`goto 47.6,31.5\` "Kobold camp" sends the player where \`kill Kobold Vermin\` \\(line ${lineOf(src, '  kill 6 x10')}\\) already leads, \\d+ yards away$`));
	assert.equal(ws[0].hint, 'remove the goto: the arrow leads to `kill Kobold Vermin` directly');
});

test('an approach goto far from the objective and a lone goto are not warned', () => {
	const far = guideText(['step Kobolds', '  goto 47.6,70.0 "South road"', '  kill 6 x10']);
	assert.deepEqual(gotoWarnings(far), []);
	const lone = guideText(['step The road', '  goto 47.6,31.5 "Kobold camp"', '', 'step Kobolds', '  kill 6 x10']);
	assert.deepEqual(gotoWarnings(lone), []);
});

test('a path of gotos keeps all but the last; travel steps and optional next goals keep theirs', () => {
	const path = guideText(['step Kobolds', '  goto 47.0,33.0 "Hill"', '  goto 47.6,31.5 "Kobold camp"', '  kill 6 x10']);
	assert.deepEqual(
		gotoWarnings(path).map((d) => d.line),
		[lineOf(path, '  goto 47.6,31.5 "Kobold camp"')],
	);
	const optional = guideText(['step Kobolds', '  goto 47.6,31.5 "Kobold camp"', '  kill 6 x10 optional']);
	assert.deepEqual(gotoWarnings(optional), []);
	const travel = guideText(['step Kobolds', '  goto 47.6,31.5 "Kobold camp"', '  kill 6 x10', '  hearth "Goldshire"']);
	assert.deepEqual(gotoWarnings(travel), []);
});
