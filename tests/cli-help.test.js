'use strict';
// Asking any command for help prints its usage, exits 0 and does no work:
// nothing under addon/, docs/, guides/ or data/ is written.

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { main, load } = require('../tools/polestar');
const { quiet } = require('./helpers/cli');

const ROOT = path.join(__dirname, '..');

// Every file's mtime under the folders a command could write, without
// following links (data/ may link to local data).
function snapshot() {
	const seen = new Map();
	const walk = (dir) => {
		for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
			const p = path.join(dir, e.name);
			if (e.isDirectory()) walk(p);
			else seen.set(p, fs.lstatSync(p).mtimeMs);
		}
	};
	for (const top of ['addon', 'docs', 'guides', 'data']) {
		const dir = path.join(ROOT, top);
		if (fs.existsSync(dir)) walk(dir);
	}
	return seen;
}

test('every command answers help, --help and -h with its usage, exit 0, and writes nothing', async () => {
	const cmds = load();
	assert.ok(cmds.size > 20, `found ${cmds.size} commands`);
	const before = snapshot();
	for (const [name, cmd] of cmds) {
		const usage = cmd.usage || cmd.summary || cmd.name;
		for (const argv of [['help', name], [name, '--help'], [name, '-h'], [name, 'build', '--help'], [name, 'x', '--out', 'y', '-h']]) {
			const { result, out } = await quiet(() => main(argv));
			assert.equal(result, 0, `${argv.join(' ')}: ${out}`);
			assert.equal(out.trim(), String(usage).trim(), argv.join(' '));
		}
	}
	assert.deepEqual(snapshot(), before);
});
