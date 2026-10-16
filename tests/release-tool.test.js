'use strict';
// release scope, notes and patch: what a patch may carry, the notes written
// from CHANGELOG.md, and the stops of a patch's preparation.

const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { tmpdir } = require('./helpers/tmp');
const { polestar } = require('./helpers/cli');
const { disallowed } = require('../tools/lib/release/scope');
const { joinLines, releaseSection, DISCORD_LIMIT, discordPosts } = require('../tools/lib/release/notes');
const { writeZip } = require('../tools/lib/zip');

function git(dir, ...args) {
	const r = spawnSync('git', ['-C', dir, ...args], { encoding: 'utf8' });
	assert.strictEqual(r.status, 0, r.stderr);
	return r.stdout;
}

function write(dir, file, text) {
	fs.mkdirSync(path.dirname(path.join(dir, file)), { recursive: true });
	fs.writeFileSync(path.join(dir, file), text);
}

// A repository tagged v1.0.0 with a guide, an addon file and corrections.
function repo() {
	const dir = tmpdir();
	git(dir, 'init', '-q', '-b', 'main');
	git(dir, 'config', 'user.email', 't@example.com');
	git(dir, 'config', 'user.name', 'T');
	git(dir, 'config', 'commit.gpgsign', 'false');
	git(dir, 'config', 'tag.gpgsign', 'false');
	write(dir, 'guides/a.guide', 'guide a\n');
	write(dir, 'addon/Polestar/Main.lua', '-- main\n');
	write(dir, 'tools/lib/data/corrections.json', '{}\n');
	write(dir, 'tools/polestar.js', 'process.exit(0);\n');
	git(dir, 'add', '-A');
	git(dir, 'commit', '-qm', 'one');
	git(dir, 'tag', 'v1.0.0');
	return dir;
}

function commit(dir) {
	git(dir, 'add', '-A');
	git(dir, 'commit', '-qm', 'change');
}

test('scope: allowed and disallowed paths', () => {
	const ok = ['guides/forever/a.guide', 'addon/Polestar_Guides/Guides.lua', 'tests/guides-reported.test.js', 'tools/lib/data/corrections.json', 'CHANGELOG.md', 'changes/fix.md'];
	assert.deepStrictEqual(disallowed(ok), []);
	const bad = ['addon/Polestar/Main.lua', 'tests/guides/a.test.js', 'tests/lint.test.js', 'tools/lib/data/other.json', 'addon/Polestar_GuidesX/a.lua', 'README.md'];
	assert.deepStrictEqual(disallowed([...ok, ...bad, bad[0]]), bad);
});

test('scope --files: one path a line, from a file or stdin, renames giving both paths', () => {
	const dir = tmpdir();
	const list = 'guides/a.guide\n\nR100\taddon/Polestar/x.lua\tguides/x.guide\nM\tCHANGELOG.md\n';
	fs.writeFileSync(path.join(dir, 'list.txt'), list);
	const fromFile = polestar(['release', 'scope', '--files', path.join(dir, 'list.txt')]);
	assert.strictEqual(fromFile.status, 1);
	assert.deepStrictEqual(fromFile.stdout.trim().split('\n'), ['addon/Polestar/x.lua']);
	const fromStdin = polestar(['release', 'scope', '--files', '-'], { input: list });
	assert.strictEqual(fromStdin.status, 1);
	assert.deepStrictEqual(fromStdin.stdout.trim().split('\n'), ['addon/Polestar/x.lua']);
	const clean = polestar(['release', 'scope', '--files', '-'], { input: 'guides/a.guide\nCHANGELOG.md\n' });
	assert.strictEqual(clean.status, 0);
	assert.strictEqual(clean.stdout, '');
});

test('scope: git mode against the newest tag or --base, a rename out of the addon counted', () => {
	const dir = repo();
	write(dir, 'guides/a.guide', 'guide a fixed\n');
	commit(dir);
	assert.strictEqual(polestar(['release', 'scope', '--root', dir]).status, 0);
	git(dir, 'mv', 'addon/Polestar/Main.lua', 'guides/Main.lua');
	commit(dir);
	const r = polestar(['release', 'scope', '--root', dir]);
	assert.strictEqual(r.status, 1);
	assert.deepStrictEqual(r.stdout.trim().split('\n'), ['addon/Polestar/Main.lua']);
	git(dir, 'tag', 'v1.0.1');
	assert.strictEqual(polestar(['release', 'scope', '--root', dir]).status, 0);
	assert.strictEqual(polestar(['release', 'scope', '--root', dir, '--base', 'v1.0.0']).status, 1);
	assert.strictEqual(polestar(['release', 'scope', '--root', dir, '--base', 'nope']).status, 2);
	assert.strictEqual(polestar(['release', 'scope', 'extra']).status, 2);
});

const CHANGELOG = `# Changelog

## Unreleased

### For players

- Unreleased entry.

## 1.0.1 (2026-10-16)

### For players

- A fix that wraps
  onto a second line (thanks Ann and Bo).
- A list with
  - a sub-item that
    wraps

A paragraph
over two lines.

### For guide authors

- An authors' entry
  (thanks Cy).

### For contributors

- A contributors' entry.

## 1.0.0 (2026-10-01)

### For players

- Old entry.
`;

test('scope: the default base is the newest plain vX.Y.Z tag, in version order', () => {
	const dir = repo();
	write(dir, 'addon/Polestar/Main.lua', '-- two\n');
	commit(dir);
	git(dir, 'tag', 'v1.0.10');
	write(dir, 'addon/Polestar/Main.lua', '-- three\n');
	commit(dir);
	git(dir, 'tag', 'v1.0.9');
	write(dir, 'guides/a.guide', 'guide a fixed\n');
	commit(dir);
	git(dir, 'tag', 'v1.0.11-rc.1');
	// From v1.0.10 the addon changed; from v1.0.9 (text order) or the rc it did not.
	const r = polestar(['release', 'scope', '--root', dir]);
	assert.strictEqual(r.status, 1);
	assert.deepStrictEqual(r.stdout.trim().split('\n'), ['addon/Polestar/Main.lua']);
});

test('notes: joinLines puts each item and paragraph on one line', () => {
	assert.strictEqual(joinLines('- a\n  b\n  - c\n    d\n\n\npara\ngraph\n'), '- a b\n  - c d\n\npara graph');
	assert.strictEqual(joinLines('```\nx\n  y\n```'), '```\nx\n  y\n```');
});

test('notes: writes the requested version only, lines joined', () => {
	const dir = tmpdir();
	fs.writeFileSync(path.join(dir, 'CHANGELOG.md'), CHANGELOG);
	const out = path.join(dir, 'out');
	const r = polestar(['release', 'notes', '1.0.1', '--root', dir, '--out', out]);
	assert.strictEqual(r.status, 0, r.stderr);
	const gh = fs.readFileSync(path.join(out, 'notes-1.0.1.md'), 'utf8');
	assert.ok(gh.includes('- A fix that wraps onto a second line (thanks Ann and Bo).\n'));
	assert.ok(gh.includes('  - a sub-item that wraps\n'));
	assert.ok(gh.includes('A paragraph over two lines.'));
	assert.ok(gh.includes("- An authors' entry (thanks Cy)."));
	for (const absent of ['Unreleased entry', 'Old entry', "contributors' entry"]) assert.ok(!gh.includes(absent), absent);
	assert.ok(gh.includes('Ann, Bo, Cy'));
	const cf = fs.readFileSync(path.join(out, 'notes-curseforge-1.0.1.md'), 'utf8');
	assert.ok(cf.includes('- A fix that wraps onto a second line'));
	assert.ok(!cf.includes("authors' entry"));
	const discord = fs.readFileSync(path.join(out, 'notes-discord-1.0.1.txt'), 'utf8');
	assert.ok(discord.includes('- A fix that wraps onto a second line'));
	// Deterministic: a second run writes the same files.
	const again = path.join(dir, 'again');
	polestar(['release', 'notes', '1.0.1', '--root', dir, '--out', again]);
	for (const f of fs.readdirSync(out)) assert.strictEqual(fs.readFileSync(path.join(again, f), 'utf8'), fs.readFileSync(path.join(out, f), 'utf8'));
	assert.strictEqual(polestar(['release', 'notes', '9.9.9', '--root', dir, '--out', out]).status, 1);
});

test('notes: Discord posts stay under the limit', () => {
	const long = Array.from({ length: 60 }, (_, i) => `- Entry ${i} ${'word '.repeat(60)}`).join('\n') + `\n- One huge entry. ${'Sentence here. '.repeat(300)}`;
	const rel = releaseSection(`## 2.0.0 (2026-01-02)\n\n### For players\n\n${long}\n`, '2.0.0');
	const posts = discordPosts(rel);
	assert.ok(posts.length > 3);
	for (const p of posts) assert.ok([...p].length <= DISCORD_LIMIT, String([...p].length));
});

test('patch: stops on paths a patch may not carry', () => {
	const dir = repo();
	write(dir, 'addon/Polestar/Main.lua', '-- changed\n');
	commit(dir);
	const r = polestar(['release', 'patch', '1.0.1', '--root', dir, '--zip', path.join(dir, 'none.zip')]);
	assert.strictEqual(r.status, 1);
	assert.ok(r.stderr.includes('addon/Polestar/Main.lua'));
	assert.strictEqual(fs.readFileSync(path.join(dir, 'addon/Polestar/Main.lua'), 'utf8'), '-- changed\n');
});

test('patch: stops when corrections.json changed, before touching the checkout', () => {
	const dir = repo();
	write(dir, 'tools/lib/data/corrections.json', '{"fix":1}\n');
	commit(dir);
	const zip = path.join(tmpdir(), 'Polestar-1.0.0.zip');
	writeZip(zip, [
		{ name: 'Polestar_Codex/Codex.lua', data: Buffer.from('-- codex\n') },
		{ name: 'Polestar_QuestDB/QuestDB.lua', data: Buffer.from('-- questdb\n') },
	]);
	const r = polestar(['release', 'patch', '1.0.1', '--root', dir, '--zip', zip]);
	assert.strictEqual(r.status, 1);
	assert.ok(r.stderr.includes('data build'));
	assert.ok(!fs.existsSync(path.join(dir, 'addon/Polestar_Codex')));
	assert.strictEqual(polestar(['release', 'patch', '1.0.1']).status, 2);
	assert.strictEqual(polestar(['release', 'patch', 'x', '--root', dir]).status, 2);
});
