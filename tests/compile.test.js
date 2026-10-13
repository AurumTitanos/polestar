'use strict';
// Emitted Lua (tools/lib/dsl/emit.js) and the compile/lint commands: the pack
// loads under Lua 5.1 next to Core/Init.lua and round-trips to the compiled
// structure; output is byte-identical across runs; errors block writes.

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { runAddon, xmlFiles, ROOT } = require('./helpers/lua');
const { compile, guideText, tmpdir, plain, fixtureData, GUIDES_DIR, DATA_DIR } = require('./fixtures/dsl/helpers');
const { compileProject, buildPackFiles, writePackDir, packMeta } = require('../tools/lib/dsl/project');

const CLI = path.join(ROOT, 'tools', 'polestar.js');

function cli(...args) {
	return spawnSync(process.execPath, [CLI, ...args], { encoding: 'utf8', cwd: ROOT });
}

function luaString(s) {
	return JSON.stringify(s);
}

// Load a pack folder the way the client does (Pack.xml order) with Core/Init.lua
// and stand-ins for the registration functions; return what got registered.
function loadPack(dir) {
	const files = xmlFiles(path.join(dir, 'Pack.xml'));
	const [out] = runAddon({
		addons: [{ name: 'Polestar', files: ['Core/Init.lua'] }],
		script: `
			local packs, guides, frames = {}, {}, {}
			Polestar.RegisterPack = function(m) packs[#packs + 1] = m end
			Polestar.RegisterGuide = function(g) guides[#guides + 1] = g; return true end
			Polestar.RegisterMapFrames = function(f) frames[#frames + 1] = f end
			local ns = {}
			for _, f in ipairs({ ${files.map(luaString).join(', ')} }) do
				local chunk = assert(loadfile(f))
				chunk("Polestar_Guides", ns)
			end
			emit({ packs = packs, guides = guides, frames = frames, globals = { ADDON = rawget(_G, "ADDON") == nil, ns = rawget(_G, "ns") == nil } })`,
	}).emitted;
	return { ...out, files };
}

function readTree(dir) {
	const out = {};
	const walk = (d) => {
		for (const e of fs.readdirSync(d, { withFileTypes: true })) {
			const p = path.join(d, e.name);
			if (e.isDirectory()) walk(p);
			else out[path.relative(dir, p).split(path.sep).join('/')] = fs.readFileSync(p);
		}
	};
	walk(dir);
	return out;
}

test('the compiled pack loads under Lua 5.1 with Core/Init.lua and round-trips to the compiled structure', () => {
	const { guides, diag, data } = compileProject({ guidesDir: GUIDES_DIR, dataDir: DATA_DIR });
	assert.equal(diag.hasErrors(), false);
	const dir = tmpdir();
	writePackDir(dir, buildPackFiles({ guides, meta: packMeta('9.9.9'), data }));
	const loaded = loadPack(dir);
	assert.deepEqual(loaded.packs, [{ id: 'guides', title: 'Polestar Guides', version: '9.9.9' }]);
	assert.deepEqual(loaded.guides, plain(guides));
	assert.deepEqual(loaded.guides.map((g) => g.id), ['forever/alliance/human/01-northshire', 'forever/alliance/human/02-elwynn']);
	// Era bounds only for maps the guides reference (all fixture goals are in Elwynn Forest).
	assert.deepEqual(loaded.frames, [{ era: { 1429: { c: 1415, left: 1535.4166, right: -1941.6666, top: 1300, bottom: -1060.4166 } } }]);
	// Files leak no globals beyond Polestar's registration calls.
	assert.deepEqual(loaded.globals, { ADDON: true, ns: true });
	// The manifest lists every Lua file in the folder, Pack.lua first.
	const lua = Object.keys(readTree(dir)).filter((f) => f.endsWith('.lua')).sort();
	assert.deepEqual(loaded.files.map((f) => path.relative(dir, f).split(path.sep).join('/')).sort(), lua);
	assert.equal(path.basename(loaded.files[0]), 'Pack.lua');
	assert.match(fs.readFileSync(path.join(dir, 'LICENSE-DATA.txt'), 'utf8'), /pfQuest[\s\S]*MIT License[\s\S]*Copyright \(c\) 2017-2021 Eric Mauser \(Shagu\)/);
});

test('strings with quotes, backslashes, control characters and UTF-8 survive the trip through Lua', () => {
	const tricky = 'Say "hi" \\ to Ünïcödé ✓\tTab';
	const src = guideText([
		'guide t/strings',
		`title ${tricky}`,
		'levels 1-2',
		'zone Elwynn Forest',
		'',
		`step ${tricky}`,
		'  tip First line.',
		'  tip ]] [[ --[[ not a comment',
		`  accept 424243 "${tricky.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}" -- note with "quotes" and \\ backslash`,
		'  note "x\ty" r 7.25 @12.345,0.005',
	]);
	const r = compile(src);
	assert.deepEqual(r.errors, []);
	const dir = tmpdir();
	writePackDir(dir, buildPackFiles({ guides: r.guides, meta: packMeta('1'), data: fixtureData() }));
	const loaded = loadPack(dir);
	assert.deepEqual(loaded.guides, plain(r.guides));
	const g = loaded.guides[0];
	assert.equal(g.title, tricky);
	assert.equal(g.steps[0].title, tricky);
	assert.equal(g.steps[0].note, 'First line.\n]] [[ --[[ not a comment');
	assert.equal(g.steps[0].goals[0].title, tricky);
	assert.equal(g.steps[0].goals[0].note, 'note with "quotes" and \\ backslash');
	// Coordinates are stored with two decimals.
	assert.deepEqual([g.steps[0].goals[1].x, g.steps[0].goals[1].y, g.steps[0].goals[1].r], [12.35, 0.01, 7.25]);
});

test('folder, keywords and collects compile into the guide table and load in the addon', () => {
	const src = guideText(['guide t/folder', 'title Horse', 'category Collectibles', 'folder Mounts · Level 40', 'keywords Pinto Bridle, Chestnut Mare', 'collects 2414, 5655', 'levels 40-40', 'zone Elwynn Forest', '', 'step S', '  level 40']);
	const r = compile(src);
	assert.deepEqual(r.errors, []);
	assert.equal(r.guides[0].folder, 'Mounts · Level 40');
	assert.deepEqual(r.guides[0].keywords, ['Pinto Bridle', 'Chestnut Mare']);
	assert.deepEqual(r.guides[0].collects, [2414, 5655]);
	const dir = tmpdir();
	writePackDir(dir, buildPackFiles({ guides: r.guides, meta: packMeta('1'), data: fixtureData() }));
	assert.deepEqual(loadPack(dir).guides, plain(r.guides));
});

test('compile output is byte-identical across runs and skips drafts', () => {
	const a = tmpdir();
	const b = tmpdir();
	for (const out of [a, b]) {
		const r = cli('compile', '--guides', GUIDES_DIR, '--data', DATA_DIR, '--out', out);
		assert.equal(r.status, 0, r.stderr + r.stdout);
	}
	const ta = readTree(a);
	const tb = readTree(b);
	assert.deepEqual(Object.keys(ta).sort(), [
		'Guides/forever/alliance/human/01-northshire.lua',
		'Guides/forever/alliance/human/02-elwynn.lua',
		'LICENSE-DATA.txt',
		'MapFrames.lua',
		'Pack.lua',
		'Pack.xml',
	]);
	for (const f of Object.keys(ta)) assert.ok(ta[f].equals(tb[f]), `${f} differs between runs`);
});

test('compile with errors exits non-zero and writes nothing; --include-drafts pulls drafts in', () => {
	const out = path.join(tmpdir(), 'pack');
	const r = cli('compile', '--guides', GUIDES_DIR, '--data', DATA_DIR, '--out', out, '--include-drafts');
	assert.equal(r.status, 1);
	assert.match(r.stderr, /drafts\/wip\.guide:7: error: quest 999999 is not in data/);
	assert.equal(fs.existsSync(out), false);
});

test('recompiling removes guides that no longer exist and keeps files compile does not own', () => {
	const out = tmpdir();
	fs.mkdirSync(path.join(out, 'Guides', 'old'), { recursive: true });
	fs.writeFileSync(path.join(out, 'Guides', 'old', 'gone.lua'), '-- stale\n');
	fs.writeFileSync(path.join(out, 'Pack.xml'), '<Ui>\n\t<!-- Generated by `node tools/polestar.js compile`. Do not edit. -->\n</Ui>\n');
	fs.writeFileSync(path.join(out, 'Polestar_Guides.toc'), '## Title: kept\n');
	const r = cli('compile', '--guides', GUIDES_DIR, '--data', DATA_DIR, '--out', out);
	assert.equal(r.status, 0, r.stderr);
	assert.equal(fs.existsSync(path.join(out, 'Guides', 'old')), false);
	assert.equal(fs.readFileSync(path.join(out, 'Polestar_Guides.toc'), 'utf8'), '## Title: kept\n');
});

test('lint runs the same checks without writing, with matching exit codes', () => {
	const ok = cli('lint', '--guides', GUIDES_DIR, '--data', DATA_DIR);
	assert.equal(ok.status, 0, ok.stderr);
	assert.match(ok.stdout, /lint ok: 2 files, 2 guides: 0 errors, 0 warnings/);
	const bad = cli('lint', '--guides', GUIDES_DIR, '--data', DATA_DIR, '--include-drafts');
	assert.equal(bad.status, 1);
	assert.match(bad.stderr, /wip\.guide:7: error: `turnin` for quest 999999 that is never accepted/);
	const usage = cli('lint', '--bogus');
	assert.equal(usage.status, 2);
});

test('a missing data directory is a warning; guides with explicit names still compile', () => {
	const guides = tmpdir();
	fs.writeFileSync(path.join(guides, 'a.guide'), guideText(['guide t/a', 'title A', 'levels 1-2', 'zone map 1429', '', 'step S', '  accept 424243 "New Quest" @50,50', '  turnin 424243 "New Quest"']));
	const out = tmpdir();
	const r = cli('compile', '--guides', guides, '--data', path.join(guides, 'nope'), '--out', out);
	assert.equal(r.status, 0, r.stderr);
	assert.match(r.stderr, /warning: reference data not found/);
	assert.ok(fs.existsSync(path.join(out, 'Guides', 't', 'a.lua')));
	assert.match(fs.readFileSync(path.join(out, 'LICENSE-DATA.txt'), 'utf8'), /No reference data sources were recorded/);
});

test('compile never clears a Guides folder that is not a generated pack (case-insensitive --out at the repo)', () => {
	const out = tmpdir();
	fs.mkdirSync(path.join(out, 'Guides', 'forever'), { recursive: true });
	fs.writeFileSync(path.join(out, 'Guides', 'forever', 'precious.guide'), 'guide t/x\n');
	const r = cli('compile', '--guides', GUIDES_DIR, '--data', DATA_DIR, '--out', out);
	assert.equal(r.status, 1);
	assert.match(r.stderr, /refusing to replace .*Guides: .* is not a generated guide pack/);
	assert.equal(fs.readFileSync(path.join(out, 'Guides', 'forever', 'precious.guide'), 'utf8'), 'guide t/x\n');
	assert.equal(fs.existsSync(path.join(out, 'Pack.xml')), false);
});
