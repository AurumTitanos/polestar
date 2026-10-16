'use strict';
// changelog: fragments in changes/ are written by add, validated by check,
// previewed by show, and gathered into CHANGELOG.md by build, which deletes
// them. Each test works on a checkout of its own (--root).

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { tmpdir } = require('./helpers/tmp');
const { polestar } = require('./helpers/cli');

const HEAD = '# Changelog\n\n';
const OLD = '## 0.2.4 (2026-10-16)\n\n### For players\n\n- An old entry.\n';

function checkout(changelog = HEAD + OLD, fragments = {}) {
	const root = tmpdir('polestar-changelog-');
	fs.writeFileSync(path.join(root, 'CHANGELOG.md'), changelog);
	fs.mkdirSync(path.join(root, 'changes'));
	fs.writeFileSync(path.join(root, 'changes', 'README.md'), '# Changelog fragments\n');
	for (const [name, text] of Object.entries(fragments)) fs.writeFileSync(path.join(root, 'changes', name), text);
	return root;
}

const fragment = (section, body) => `---\nsection: ${section}\n---\n${body}\n`;
const run = (root, ...args) => polestar(['changelog', ...args, '--root', root]);
const read = (root, f) => fs.readFileSync(path.join(root, f), 'utf8');
const fragmentsLeft = (root) => fs.readdirSync(path.join(root, 'changes')).filter((f) => f !== 'README.md').sort();

test('build puts the sections in order, the entries by file name, above the newest release, and deletes the fragments', () => {
	const root = checkout(HEAD + OLD, {
		'b-tool.md': fragment('contributors', '- A tool entry.'),
		'z-player.md': fragment('players', '- Second player entry, wrapped\n  over two lines.'),
		'a-player.md': fragment('players', '- First player entry.'),
		'm-author.md': fragment('authors', '- An author entry.\n- And another item.'),
	});
	const r = run(root, 'build', '0.2.5', '--date', '2026-10-20');
	assert.equal(r.status, 0, r.stderr);
	assert.equal(
		read(root, 'CHANGELOG.md'),
		HEAD +
			'## 0.2.5 (2026-10-20)\n\n' +
			'### For players\n\n- First player entry.\n- Second player entry, wrapped\n  over two lines.\n\n' +
			'### For guide authors\n\n- An author entry.\n- And another item.\n\n' +
			'### For contributors\n\n- A tool entry.\n\n' +
			OLD,
	);
	assert.deepEqual(fragmentsLeft(root), []);
	assert.ok(fs.existsSync(path.join(root, 'changes', 'README.md')));
});

test('build leaves out sections without entries', () => {
	const root = checkout(HEAD + OLD, { 'x.md': fragment('contributors', '- Only this.') });
	assert.equal(run(root, 'build', '0.2.5', '--date', '2026-10-20').status, 0);
	assert.equal(read(root, 'CHANGELOG.md'), `${HEAD}## 0.2.5 (2026-10-20)\n\n### For contributors\n\n- Only this.\n\n${OLD}`);
});

test('build output is the same bytes for the same fragments, whatever order they were written in', () => {
	const frags = { 'c.md': fragment('players', '- C.'), 'a.md': fragment('players', '- A.'), 'b.md': fragment('authors', '- B.') };
	const one = checkout(HEAD + OLD, frags);
	const two = checkout(HEAD + OLD, Object.fromEntries(Object.entries(frags).reverse()));
	run(one, 'build', '1.0.0', '--date', '2026-01-02');
	run(two, 'build', '1.0.0', '--date', '2026-01-02');
	assert.equal(read(one, 'CHANGELOG.md'), read(two, 'CHANGELOG.md'));
});

test('build refuses a version already released, an empty changes/, a faulty fragment or a ## Unreleased, and writes nothing', () => {
	const cases = [
		checkout(HEAD + OLD, { 'a.md': fragment('players', '- A.') }),
		checkout(HEAD + OLD),
		checkout(HEAD + OLD, { 'a.md': fragment('players', '- A.'), 'b.md': fragment('everyone', '- B.') }),
		checkout(`${HEAD}## Unreleased\n\n### For players\n\n- U.\n\n${OLD}`, { 'a.md': fragment('players', '- A.') }),
	];
	const versions = ['0.2.4', '0.2.5', '0.2.5', '0.2.5'];
	cases.forEach((root, i) => {
		const before = read(root, 'CHANGELOG.md');
		const left = fragmentsLeft(root);
		const r = run(root, 'build', versions[i], '--date', '2026-10-20');
		assert.equal(r.status, 1, `case ${i}: ${r.stdout}`);
		assert.equal(read(root, 'CHANGELOG.md'), before, `case ${i}`);
		assert.deepEqual(fragmentsLeft(root), left, `case ${i}`);
	});
});

test('build rejects a bad version or date as a usage error', () => {
	const root = checkout(HEAD + OLD, { 'a.md': fragment('players', '- A.') });
	assert.equal(run(root, 'build', 'v0.2.5').status, 2);
	assert.equal(run(root, 'build', '0.2.5', '--date', '20-10-2026').status, 2);
	assert.equal(run(root, 'build').status, 2);
	assert.deepEqual(fragmentsLeft(root), ['a.md']);
});

test('build into a changelog without releases appends the section', () => {
	const root = checkout(HEAD, { 'a.md': fragment('players', '- A.') });
	assert.equal(run(root, 'build', '0.1.0', '--date', '2026-01-01').status, 0);
	assert.equal(read(root, 'CHANGELOG.md'), `${HEAD}## 0.1.0 (2026-01-01)\n\n### For players\n\n- A.\n`);
});

test('check passes valid fragments and names every faulty one, and a ## Unreleased section', () => {
	const good = checkout(HEAD + OLD, { 'a.md': fragment('players', '- A.'), 'b.md': fragment('authors', '- B.') });
	assert.equal(run(good, 'check').status, 0);

	const bad = {
		'no-front.md': '- No front matter.\n',
		'open.md': '---\nsection: players\n- Never closed.\n',
		'section.md': fragment('everyone', '- Unknown section.'),
		'nosection.md': '---\n---\n- No section.\n',
		'key.md': '---\nsection: players\nauthor: me\n---\n- Unknown key.\n',
		'empty.md': fragment('players', ''),
		'notlist.md': fragment('players', 'Not a list item.'),
		'notes.txt': 'not markdown\n',
	};
	const root = checkout(`${HEAD}## Unreleased\n\n${OLD}`, { 'fine.md': fragment('players', '- Fine.'), ...bad });
	const r = run(root, 'check');
	assert.equal(r.status, 1);
	const named = r.stderr
		.trim()
		.split('\n')
		.map((l) => l.split(':')[0]);
	assert.deepEqual(named, [...Object.keys(bad).sort().map((f) => `changes/${f}`), 'CHANGELOG.md']);
});

test('check passes a checkout without changes/', () => {
	const root = tmpdir('polestar-changelog-');
	fs.writeFileSync(path.join(root, 'CHANGELOG.md'), HEAD + OLD);
	assert.equal(run(root, 'check').status, 0);
});

test('show prints the assembled entries and writes nothing', () => {
	const root = checkout(HEAD + OLD, { 'b.md': fragment('contributors', '- B.'), 'a.md': fragment('players', '- A.\n  wrapped.') });
	const r = run(root, 'show');
	assert.equal(r.status, 0, r.stderr);
	assert.equal(r.stdout, '## Unreleased\n\n### For players\n\n- A.\n  wrapped.\n\n### For contributors\n\n- B.\n');
	assert.equal(read(root, 'CHANGELOG.md'), HEAD + OLD);
	assert.deepEqual(fragmentsLeft(root), ['a.md', 'b.md']);
});

test('add writes a fragment named from --name or the first words, from --text or stdin, never overwriting', () => {
	const root = checkout();
	const body = '- Walks between zones go through the real tunnels,\n  passes and bridges.';
	let r = polestar(['changelog', 'add', 'players', '--root', root], { input: `${body}\n` });
	assert.equal(r.status, 0, r.stderr);
	const first = 'walks-between-zones-go-through-the.md';
	assert.deepEqual(fragmentsLeft(root), [first]);
	assert.equal(read(root, `changes/${first}`), fragment('players', body));

	r = polestar(['changelog', 'add', 'players', '--root', root], { input: `${body}\n` });
	assert.equal(r.status, 0, r.stderr);
	assert.deepEqual(fragmentsLeft(root), [first, 'walks-between-zones-go-through-the-2.md'].sort());

	assert.equal(run(root, 'add', 'authors', '--name', 'my-fix', '--text', '- A fix.').status, 0);
	assert.equal(read(root, 'changes/my-fix.md'), fragment('authors', '- A fix.'));
	assert.equal(run(root, 'add', 'authors', '--name', 'my-fix', '--text', '- Another.').status, 1);
	assert.equal(read(root, 'changes/my-fix.md'), fragment('authors', '- A fix.'));
	assert.equal(run(root, 'check').status, 0);
});

test('add makes plain text one list item wrapped at 78 columns', () => {
	const root = checkout();
	const words = Array.from({ length: 40 }, (_, i) => `word${i}`).join(' ');
	assert.equal(run(root, 'add', 'contributors', '--name', 'plain', '--text', words).status, 0);
	const lines = read(root, 'changes/plain.md').split('\n').slice(3, -1);
	assert.ok(lines[0].startsWith('- word0 '));
	for (const l of lines.slice(1)) assert.match(l, /^ {2}\S/);
	for (const l of lines) assert.ok(l.length <= 78, l);
	assert.equal(lines.join(' ').replace(/^- /, '').split(/\s+/).join(' '), words);
});

test('add rejects an unknown section or an empty entry and writes nothing', () => {
	const root = checkout();
	assert.equal(run(root, 'add', 'everyone', '--text', '- A.').status, 2);
	assert.equal(polestar(['changelog', 'add', 'players', '--root', root], { input: '  \n' }).status, 2);
	assert.deepEqual(fragmentsLeft(root), []);
});
