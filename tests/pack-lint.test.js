'use strict';
// Lint and compile on another pack: the pack rules, our guides
// read as context (tests/fixtures/packs/context stands in for them), house
// rules as warnings, the nearest pack.json, and dist/<folder>/ output.

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { tmpdir, DATA_DIR } = require('./fixtures/dsl/helpers');
const { findPackDir, resolvePack } = require('../tools/lib/pack/locate');
const { OFFICIAL_DIR } = require('../tools/lib/dsl/project');

const PACKS = path.join(__dirname, 'fixtures', 'packs');
const JOE = path.join(PACKS, 'joe');
const CONTEXT = path.join(PACKS, 'context');
const CLI = path.join(__dirname, '..', 'tools', 'polestar.js');

function run(args, cwd = path.join(__dirname, '..')) {
	return spawnSync(process.execPath, [CLI, ...args], { cwd, encoding: 'utf8' });
}

// lint/compile on a pack with the fixture data and the context fixture.
function packCmd(cmd, dir, ...extra) {
	return run([cmd, '--pack', dir, '--data', DATA_DIR, '--context', CONTEXT, '--context-data', DATA_DIR, ...extra]);
}

// A temp copy of the joe pack, with extra guides { 'name.guide': text }.
function joeCopy(extra = {}) {
	const dir = tmpdir();
	fs.cpSync(JOE, dir, { recursive: true });
	for (const [name, text] of Object.entries(extra)) fs.writeFileSync(path.join(dir, 'guides', name), text);
	return dir;
}

const guide = (id, ...body) => ['guide ' + id, 'title Extra', 'faction Alliance', 'levels 6-8', 'zone Elwynn Forest', ...body, ''].join('\n');

test('findPackDir walks up to the nearest pack.json; resolvePack falls back to our guides', () => {
	assert.equal(findPackDir(path.join(JOE, 'guides')), JOE);
	const lone = tmpdir();
	assert.equal(findPackDir(lone), null);
	const ours = resolvePack({ cwd: lone });
	assert.equal(ours.dir, OFFICIAL_DIR);
	assert.equal(ours.official, true);
	assert.equal(ours.manifest.id, 'guides');
	const joe = resolvePack({ pack: JOE });
	assert.equal(joe.official, false);
	assert.equal(joe.manifest.id, 'joe');
	const none = resolvePack({ pack: lone });
	assert.equal(none.manifest, null);
	assert.match(none.diags[0].message, /no pack.json/);
});

test('the joe pack lints clean with our guides as context', () => {
	const r = packCmd('lint', JOE);
	assert.equal(r.status, 0, r.stderr);
	assert.match(r.stdout, /lint ok: 2 files, 2 guides: 0 errors, 1 warning/);
});

test('a pack owns only ids under "<id>/": forever/x and joe-routes/x are errors', () => {
	const dir = joeCopy({ 'x.guide': guide('forever/x', '', 'step S', '  level 7'), 'y.guide': guide('joe-routes/x', '', 'step S', '  level 7') });
	const r = packCmd('lint', dir);
	assert.equal(r.status, 1);
	assert.match(r.stderr, /x\.guide:1: error: guide id "forever\/x" is outside pack "joe": its guide ids start with "joe\/"/);
	assert.match(r.stderr, /y\.guide:1: error: guide id "joe-routes\/x" is outside pack "joe": its guide ids start with "joe\/"/);
});

test('`next` may hand over to our guides; an unknown target is an error', () => {
	const ok = packCmd('lint', joeCopy());
	assert.doesNotMatch(ok.stderr, /unknown guide/);
	const r = packCmd('lint', joeCopy({ 'c.guide': guide('joe/c', 'next forever/nope', '', 'step S', '  level 7') }));
	assert.equal(r.status, 1);
	assert.match(r.stderr, /c\.guide:6: error: `next` points to unknown guide "forever\/nope"/);
});

test('turn-ins: one accepted earlier in the pack chain is fine; one no chain accepts is the existing error', () => {
	const ok = packCmd('lint', JOE);
	assert.doesNotMatch(ok.stderr, /never accepted/);
	const r = packCmd('lint', joeCopy({ 'd.guide': guide('joe/d', '', 'step S', '  turnin 179') }));
	assert.equal(r.status, 1);
	assert.match(r.stderr, /d\.guide:8: error: `turnin` for quest 179 that is never accepted earlier in this guide or a guide chaining into it/);
});

test('required elite work is a warning in a pack and an error in ours', () => {
	const pack = packCmd('lint', JOE);
	assert.equal(pack.status, 0, pack.stderr);
	assert.match(pack.stderr, /joe\/guides\/b\.guide:12: warning: `kill` npc 95003 \(Elite Kobold\) is elite/);
	const ours = run(['lint', '--guides', path.join(CONTEXT, 'guides'), '--data', DATA_DIR]);
	assert.equal(ours.status, 1);
	assert.match(ours.stderr, /02-next\.guide:12: error: `kill` npc 95003 \(Elite Kobold\) is elite/);
});

test('a "|" in a pack title prints literally: a warning', () => {
	const dir = joeCopy({ 'e.guide': ['guide joe/e', 'title Joe |cffff0000Red', 'faction Alliance', 'levels 6-8', 'zone Elwynn Forest', '', 'step S', '  level 7', ''].join('\n') });
	const r = packCmd('lint', dir);
	assert.equal(r.status, 0, r.stderr);
	assert.match(r.stderr, /e\.guide:2: warning: `title` contains "\|", which prints literally in game/);
});

test('a "|" is reported at the line the author wrote it, naming the keyword', () => {
	const text = ['guide joe/e', 'title Extra', 'faction Alliance', 'levels 6-8', 'zone Elwynn Forest', 'con Slow', 'pro Fast | fun', '', 'step S', '  talk 197 "Marshal |cffMcBride"', '  accept 783 "A |cffThreat"', '  turnin 783 choose 6480 "Bag|x" common', ''].join('\n');
	const r = packCmd('lint', joeCopy({ 'e.guide': text }));
	assert.equal(r.status, 0, r.stderr);
	const pipes = r.stderr.split('\n').filter((l) => l.includes('contains "|"')).map((l) => l.replace(/^.*e\.guide:/, 'e.guide:'));
	assert.deepEqual(pipes, [
		'e.guide:7: warning: `pro` contains "|", which prints literally in game',
		'e.guide:10: warning: the NPC name contains "|", which prints literally in game',
		'e.guide:11: warning: the quest title contains "|", which prints literally in game',
		'e.guide:12: warning: the item name contains "|", which prints literally in game',
	]);
});

test('a "|" in the pack author warns once, in pack.json, not on every guide', () => {
	const dir = joeCopy();
	const manifest = JSON.parse(fs.readFileSync(path.join(dir, 'pack.json'), 'utf8'));
	fs.writeFileSync(path.join(dir, 'pack.json'), JSON.stringify({ ...manifest, author: 'Jo|e' }, null, '\t'));
	const r = packCmd('lint', dir);
	assert.equal(r.status, 0, r.stderr);
	const pipes = r.stderr.split('\n').filter((l) => l.includes('contains "|"'));
	assert.equal(pipes.length, 1, r.stderr);
	assert.match(pipes[0], /pack\.json:\d+: warning: `author` contains/);
});

test('a --context or --context-data folder that does not exist is a usage error', () => {
	const missing = path.join(tmpdir(), 'missing');
	for (const name of ['lint', 'compile']) {
		const a = run([name, '--pack', JOE, '--data', DATA_DIR, '--context', missing, '--context-data', DATA_DIR]);
		assert.equal(a.status, 2, a.stderr);
		assert.match(a.stderr, /--context .*missing is not a folder/);
		const b = run([name, '--pack', JOE, '--data', DATA_DIR, '--context', CONTEXT, '--context-data', missing]);
		assert.equal(b.status, 2, b.stderr);
		assert.match(b.stderr, /--context-data .*missing is not a folder/);
	}
});

test('missing default reference data is the usual warning, not a crash (a checkout without built data)', () => {
	const { buildPack } = require('../tools/lib/pack/build');
	const { commandPack } = require('../tools/lib/pack/locate');
	const missing = path.join(tmpdir(), 'no-data');
	// What commandPack gives with no --context-data, on a checkout whose data/forever is not built.
	const pack = { ...commandPack({ pack: JOE, context: CONTEXT }), contextDataDir: missing };
	// The pack's --data and the default context data both missing: one folder, one warning.
	const both = buildPack(pack, { dataDir: missing, files: false });
	const warnings = both.diag.warnings.filter((d) => /reference data not found/.test(d.message));
	assert.deepEqual(warnings.map((d) => d.file), [missing]);
	// The pack's data present, the default context data missing: lint goes ahead with a warning.
	const ctx = buildPack(pack, { dataDir: DATA_DIR, files: false });
	assert.deepEqual(ctx.diag.warnings.filter((d) => /reference data not found/.test(d.message)).map((d) => d.file), [missing]);
	assert.deepEqual(ctx.guides.map((g) => g.id).sort(), ['joe/a', 'joe/b']);
});

test("our guides' own diagnostics are not reported for another pack", () => {
	const ours = run(['lint', '--guides', path.join(CONTEXT, 'guides'), '--data', DATA_DIR]);
	assert.match(ours.stderr, /02-next\.guide:11: warning: quest 7 .* is accepted but never turned in/);
	const r = packCmd('lint', JOE);
	assert.doesNotMatch(r.stderr, /02-next|01-start|never turned in/);
});

test('without --pack, lint and compile use the nearest pack.json; compile writes dist/<folder>/', () => {
	const dir = joeCopy();
	const cwd = path.join(dir, 'guides');
	const args = ['--data', DATA_DIR, '--context', CONTEXT, '--context-data', DATA_DIR];
	const lint = run(['lint', ...args], cwd);
	assert.equal(lint.status, 0, lint.stderr);
	assert.match(lint.stdout, /lint ok: 2 files, 2 guides/);
	const compile = run(['compile', ...args], cwd);
	assert.equal(compile.status, 0, compile.stderr);
	const out = path.join(dir, 'dist', 'PolestarPack_Joe');
	assert.deepEqual(fs.readdirSync(out).sort(), ['Guides.lua', 'LICENSE-DATA.txt', 'PolestarPack_Joe.toc', 'MapFrames.lua', 'Pack.lua'].sort());
	assert.match(fs.readFileSync(path.join(out, 'PolestarPack_Joe.toc'), 'utf8'), /^## X-Polestar-Pack: joe$/m);
	const lua = fs.readFileSync(path.join(out, 'Guides.lua'), 'utf8');
	assert.match(lua, /id = "joe\/a"/);
	assert.doesNotMatch(lua, /id = "forever\//, 'nothing of the context is emitted');
	// A second compile finds dist/ is not a pack source and replaces its own output.
	assert.equal(run(['compile', ...args], cwd).status, 0);
	// --out still wins.
	const other = path.join(tmpdir(), 'out');
	assert.equal(run(['compile', ...args, '--out', other], cwd).status, 0);
	assert.ok(fs.existsSync(path.join(other, 'PolestarPack_Joe.toc')));
});

test('an invalid pack.json fails lint with its diagnostic', () => {
	const dir = joeCopy();
	const manifest = JSON.parse(fs.readFileSync(path.join(dir, 'pack.json'), 'utf8'));
	delete manifest.license;
	fs.writeFileSync(path.join(dir, 'pack.json'), `${JSON.stringify(manifest, null, '\t')}\n`);
	const r = packCmd('lint', dir);
	assert.equal(r.status, 1);
	assert.match(r.stderr, /pack\.json:1: error: missing `license`/);
	assert.equal(packCmd('compile', dir).status, 1);
	assert.equal(fs.existsSync(path.join(dir, 'dist')), false);
});

test('lint, compile and pack take the pack folder as their one argument; two folders exit 2', () => {
	const dir = joeCopy();
	const ctx = ['--data', DATA_DIR, '--context', CONTEXT, '--context-data', DATA_DIR];
	const elsewhere = tmpdir();
	const lint = run(['lint', dir, ...ctx], elsewhere);
	assert.equal(lint.status, 0, lint.stderr);
	assert.match(lint.stdout, /lint ok: 2 files, 2 guides/);
	// Our own build and release folders are left alone.
	const ours = path.join(__dirname, '..', 'addon', 'Polestar_Guides', 'Guides.lua');
	const oursBefore = fs.existsSync(ours) ? fs.statSync(ours).mtimeMs : null;
	const repoDist = path.join(__dirname, '..', 'dist');
	const distBefore = fs.existsSync(repoDist) ? fs.readdirSync(repoDist).sort() : null;
	const compile = run(['compile', dir, ...ctx], elsewhere);
	assert.equal(compile.status, 0, compile.stderr);
	const pack = run(['pack', dir, ...ctx], elsewhere);
	assert.equal(pack.status, 0, pack.stderr);
	assert.deepEqual(fs.readdirSync(path.join(dir, 'dist')).sort(), ['PolestarPack_Joe', 'PolestarPack_Joe-1.2.0.zip']);
	assert.equal(fs.existsSync(ours) ? fs.statSync(ours).mtimeMs : null, oursBefore);
	assert.deepEqual(fs.existsSync(repoDist) ? fs.readdirSync(repoDist).sort() : null, distBefore);
	assert.deepEqual(fs.readdirSync(elsewhere), []);
	for (const name of ['lint', 'compile', 'pack']) {
		const two = run([name, dir, joeCopy(), ...ctx], elsewhere);
		assert.equal(two.status, 2, `${name}: ${two.stderr}`);
		assert.match(two.stderr, /one pack folder only, got 2/);
		const both = run([name, dir, '--pack', dir, ...ctx], elsewhere);
		assert.equal(both.status, 2, `${name}: ${both.stderr}`);
		assert.match(both.stderr, /the pack folder is named twice/);
		const none = run([name, elsewhere, ...ctx], elsewhere);
		assert.equal(none.status, 2, `${name}: ${none.stderr}`);
		assert.match(none.stderr, /no pack\.json in /);
	}
});

test('a pack.json saved with a byte order mark reads as usual', () => {
	const dir = joeCopy();
	const file = path.join(dir, 'pack.json');
	fs.writeFileSync(file, `\uFEFF${fs.readFileSync(file, 'utf8')}`);
	const r = packCmd('lint', dir);
	assert.equal(r.status, 0, r.stderr);
	assert.match(r.stdout, /lint ok: 2 files, 2 guides/);
});

test("a pack's map frame that differs from ours is a warning naming the map", () => {
	const data = tmpdir();
	fs.cpSync(DATA_DIR, data, { recursive: true });
	const frames = JSON.parse(fs.readFileSync(path.join(data, 'map-frames.json'), 'utf8'));
	frames.era['1429'] = { ...frames.era['1429'], left: frames.era['1429'].left + 10 };
	fs.writeFileSync(path.join(data, 'map-frames.json'), JSON.stringify(frames));
	const r = run(['lint', '--pack', JOE, '--data', data, '--context', CONTEXT, '--context-data', DATA_DIR]);
	assert.equal(r.status, 0, r.stderr);
	const hits = r.stderr.split('\n').filter((l) => /map 1429: this pack's Era frame differs/.test(l));
	assert.equal(hits.length, 1, r.stderr);
	assert.doesNotMatch(packCmd('lint', JOE).stderr, /Era frame differs/);
});
