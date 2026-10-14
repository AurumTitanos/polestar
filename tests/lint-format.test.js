'use strict';
// Lint and compile output formats: text with fix hints, one JSON
// document, GitHub workflow annotations; an unknown --format is a usage error.

const { test } = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { DATA_DIR } = require('./helpers/dsl');
const { polestar } = require('./helpers/cli');
const { formatDiagnostics } = require('../tools/lib/dsl/diag');

const PACKS = path.join(__dirname, 'fixtures', 'packs');
const FORMAT = path.join(PACKS, 'format');
const CONTEXT = path.join(PACKS, 'context');

function cmd(name, ...args) {
	return polestar([name, '--pack', FORMAT, '--data', DATA_DIR, '--context', CONTEXT, '--context-data', DATA_DIR, ...args]);
}

const HINT = 'find the id with `polestar find <name>`, or give its name in quotes';

test('--format json prints one document with the counts, the diagnostics and the hint', () => {
	for (const name of ['lint', 'compile']) {
		const r = cmd(name, '--format', 'json');
		assert.equal(r.status, 1, r.stderr);
		const doc = JSON.parse(r.stdout);
		assert.equal(doc.ok, false);
		assert.equal(doc.errors, 1);
		assert.equal(doc.warnings, 1);
		const [error, warning] = doc.diagnostics;
		assert.deepEqual(Object.keys(error).sort(), ['file', 'hint', 'line', 'message', 'severity']);
		assert.match(error.file, /format\/guides\/a\.guide$/);
		assert.equal(error.line, 10);
		assert.equal(error.severity, 'error');
		assert.match(error.message, /^quest 999999 is not in data/);
		assert.equal(error.hint, HINT);
		assert.equal(warning.severity, 'warning');
		assert.equal(warning.hint, 'turn it in later in this guide or in a guide after it, or make the accept `optional` when the player may leave it');
		const bare = JSON.parse(formatDiagnostics([{ file: 'x', line: 1, severity: 'warning', message: 'm' }], 'json')).diagnostics[0];
		assert.equal('hint' in bare, false, 'no hint, no key');
		assert.doesNotMatch(r.stdout + r.stderr, /lint failed|compile failed/, 'no summary');
	}
});

test('--format github prints workflow annotations with the hint', () => {
	const r = cmd('lint', '--format', 'github');
	assert.equal(r.status, 1);
	const lines = r.stdout.trim().split('\n');
	assert.equal(lines.length, 2);
	assert.match(lines[0], /^::error file=[^,]*format\/guides\/a\.guide,line=10::quest 999999 is not in data.* \(hint: find the id with `polestar find <name>`, or give its name in quotes\)$/);
	assert.match(lines[1], /^::warning file=[^,]*a\.guide,line=10::quest 999999 is accepted but never turned in/);
});

test('github annotations encode %, CR and LF', () => {
	const out = formatDiagnostics([{ file: 'a,b:c.guide', line: 3, severity: 'error', message: '100% done\r\nnext line', hint: 'one\ntwo' }], 'github');
	assert.equal(out, '::error file=a%2Cb%3Ac.guide,line=3::100%25 done%0D%0Anext line (hint: one%0Atwo)');
	assert.equal(formatDiagnostics([{ file: 'x', line: 0, severity: 'warning', message: 'm' }], 'github'), '::warning file=x::m');
});

test('text prints the hint on its own line', () => {
	const r = cmd('lint');
	assert.equal(r.status, 1);
	assert.match(r.stderr, /a\.guide:10: error: quest 999999 is not in data; give its title: `accept 999999 "Title"`\n {2}hint: find the id with `polestar find <name>`, or give its name in quotes\n/);
	assert.match(r.stderr, /lint failed: 1 file, 1 guide: 1 error, 1 warning/);
});

test('an unknown --format exits 2', () => {
	for (const name of ['lint', 'compile']) {
		const r = cmd(name, '--format', 'xml');
		assert.equal(r.status, 2);
		assert.match(r.stderr, /unknown --format xml/);
	}
});

test('the required fix hints', () => {
	const { compile, guideText } = require('./helpers/dsl');
	const { validateManifest } = require('../tools/lib/pack/manifest');
	const hintOf = (diags, re) => diags.find((d) => re.test(d.message)).hint;
	const r = compile(guideText(['guide forever/h', 'title H', 'faction Alliance', 'levels 1-6', 'zone Elwynn Forest', 'next forever/nope', '', 'step S', '  talk 999999', '  goto 50,50 "a | b"']));
	assert.equal(hintOf(r.diag.list, /npc 999999 is not in data/), HINT);
	assert.equal(hintOf(r.diag.list, /unknown guide/), 'list guide ids with `polestar find --kind guide <text>`');
	assert.match(hintOf(r.diag.list, /prints literally/), /^drop the `\|`/);
	const manifest = (id) => validateManifest({ id, title: 'T', author: 'A', version: '1', license: 'MIT' }, 'pack.json');
	assert.match(hintOf(manifest('polestar'), /reserved/), /pick an id like `<author>-<name>`/);
	assert.match(hintOf(manifest('Bad Id'), /malformed/), /pick an id like `<author>-<name>`/);
});

test('a guide id outside the pack hints at the prefix', () => {
	const { compileSources } = require('../tools/lib/dsl/project');
	const { fixtureData } = require('./helpers/dsl');
	const { diag } = compileSources([{ file: 'x.guide', text: 'guide forever/x\ntitle X\nlevels 1-2\nzone Elwynn Forest\n\nstep S\n  level 2\n' }], fixtureData(), undefined, { pack: 'joe' });
	assert.equal(diag.errors[0].hint, 'start the id with `joe/`');
});

test('--format json --quiet leaves the warnings out of the list but still counts them', () => {
	const r = cmd('lint', '--format', 'json', '--quiet');
	const doc = JSON.parse(r.stdout);
	assert.equal(doc.errors, 1);
	assert.equal(doc.warnings, 1);
	assert.deepEqual(doc.diagnostics.map((d) => d.severity), ['error']);
});

test('compile --format json: a failed write is an error in the document, so ok matches the exit code', () => {
	const fs = require('node:fs');
	const { tmpdir } = require('./helpers/tmp');
	const out = tmpdir();
	fs.writeFileSync(path.join(out, 'mine.txt'), 'not a pack\n');
	const args = ['compile', '--pack', path.join(PACKS, 'joe'), '--data', DATA_DIR, '--context', CONTEXT, '--context-data', DATA_DIR, '--out', out, '--format', 'json'];
	const r = polestar(args);
	assert.equal(r.status, 1, r.stderr);
	const doc = JSON.parse(r.stdout);
	assert.equal(doc.ok, false);
	assert.equal(doc.errors, 1);
	const [d] = doc.diagnostics.filter((x) => x.severity === 'error');
	assert.equal(d.file, out);
	assert.match(d.message, /refusing to write into/);
	assert.deepEqual(fs.readdirSync(out), ['mine.txt']);
});

test('pack.json hints show an example value for the key', () => {
	const { validateManifest } = require('../tools/lib/pack/manifest');
	const hint = (obj, re) => validateManifest(obj, 'pack.json').find((d) => re.test(d.message)).hint;
	assert.equal(hint({ title: 'T', author: 'A', version: '1', license: 'MIT' }, /missing `id`/), 'add "id": "joe-routes" (with your own value) to pack.json');
	assert.equal(hint({ id: 'joe', author: 'A', version: '1', license: 'MIT' }, /missing `title`/), 'add "title": "Joe\'s Routes" (with your own value) to pack.json');
	assert.equal(hint({ id: 'joe', title: 'T', author: 7, version: '1', license: 'MIT' }, /`author` must be a string/), 'write the value in quotes, like "author": "Joe"');
	assert.equal(hint({ id: 'joe', title: 'T', author: 'A', version: 1, license: 'MIT' }, /`version` must be a string/), 'write the value in quotes, like "version": "1.0.0"');
	assert.equal(hint({ id: 'joe', title: 'T', author: 'A', version: '1' }, /missing `license`/), 'add "license": "CC-BY-4.0" (with your own value) to pack.json');
});

test('an unknown item or object gets the same find-the-id hint as an unknown quest', () => {
	const fs = require('node:fs');
	const { tmpdir } = require('./helpers/tmp');
	const dir = tmpdir();
	fs.cpSync(FORMAT, dir, { recursive: true });
	fs.writeFileSync(path.join(dir, 'guides', 'a.guide'), ['guide fmt/a', 'title Format', 'faction Alliance', 'levels 1-6', 'zone Elwynn Forest', '', 'step Somewhere', '  collect 99999999', '  interact 99999999', '  use 99999998', ''].join('\n'));
	const r = polestar(['lint', dir, '--data', DATA_DIR, '--context', CONTEXT, '--context-data', DATA_DIR, '--format', 'json']);
	assert.equal(r.status, 1, r.stderr);
	const errors = JSON.parse(r.stdout).diagnostics.filter((d) => d.severity === 'error');
	assert.deepEqual(errors.map((d) => [d.line, d.message.replace(/;.*/, ''), d.hint]), [
		[8, 'item 99999999 is not in data', HINT],
		[9, 'object 99999999 is not in data', HINT],
		[10, 'item 99999998 is not in data', HINT],
	]);
});
