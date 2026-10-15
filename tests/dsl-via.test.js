'use strict';
// Arrow waypoints from the navigation grid: guide legs (tools/lib/dsl/legs.js)
// and a pack's via.json compiled into goal `via`/`viaFrom`
// (tools/lib/dsl/via.js, project.js, emit.js).

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { compile, guideText, plain, fixtureData } = require('./helpers/dsl');
const { tmpdir } = require('./helpers/tmp');
const { guideLegs, legKey, LEG_MIN_YARDS } = require('../tools/lib/dsl/legs');
const { attachVia } = require('../tools/lib/dsl/via');
const { emitGuides } = require('../tools/lib/dsl/emit');
const { compileProject, buildPackFiles } = require('../tools/lib/dsl/project');
const { readManifest } = require('../tools/lib/pack/manifest');

const frames = () => fixtureData().mapFrames;
const legsOf = (lines) => {
	const { guides, errors } = compile(guideText(lines));
	assert.deepEqual(errors, []);
	return guideLegs(guides[0], { frames: frames() });
};
const keys = (legs) => legs.map((l) => l.key);

test('legKey: map, frame letter for Era, two decimals without trailing zeros', () => {
	assert.equal(legKey({ map: 1426, x: 29.814, y: 71.2, f: 'l' }, { map: 1426, x: 22.6, y: 71.43, f: 'e' }), '1426:29.81,71.2>1426e:22.6,71.43');
	assert.equal(legKey({ map: 1429, x: 50, y: 40.1, f: 'e' }, { map: 1429, x: 60.0, y: 40, f: undefined }), '1429e:50,40.1>1429:60,40');
	assert.equal(LEG_MIN_YARDS, 40);
});

test('legs join located goals in guide order, with ends, kinds and yards', () => {
	const legs = legsOf(['step A', '  goto 30,30', '  note "Read the sign"', 'step B', '  goto 40,30 live', '  goto 40,50']);
	assert.deepEqual(keys(legs), ['1429e:30,30>1429:40,30', '1429:40,30>1429e:40,50']);
	assert.deepEqual(plain(legs[0]), {
		si: 1,
		gi: 0,
		from: { map: 1429, x: 30, y: 30, f: 'e', isGoto: true },
		to: { map: 1429, x: 40, y: 30, f: 'l', isGoto: true },
		key: '1429e:30,30>1429:40,30',
		yards: legs[0].yards,
	});
	// Elwynn's fixture frame is 3477 yd wide: 10% is ~348 yd.
	assert.ok(Math.abs(legs[0].yards - 347.7) < 0.5, String(legs[0].yards));
	assert.deepEqual([legs[1].si, legs[1].gi], [1, 1]);
});

test('legs shorter than LEG_MIN_YARDS or across continents are dropped; the next leg starts there', () => {
	// 1% of Elwynn is ~35 yd; Durotar (1411) lies on another continent.
	const legs = legsOf(['step S', '  goto 30,30', '  goto 31,30', '  goto 50,50 map 1411', '  goto 40,30']);
	assert.deepEqual(keys(legs), []);
	const more = legsOf(['step S', '  goto 30,30', '  goto 31,30', '  goto 33,30']);
	assert.deepEqual(keys(more), ['1429e:31,30>1429e:33,30']);
});

test('a leg starts at the last goal with the same or weaker conditions', () => {
	const legs = legsOf([
		'step S',
		'  goto 10,10',
		'  goto 20,10 only Warrior',
		'  goto 30,10 only Mage',
		'  goto 40,10 only Warrior',
		'step T',
		'  only Warrior',
		'  goto 50,10',
		'  goto 60,10',
	]);
	assert.deepEqual(keys(legs), [
		'1429e:10,10>1429e:20,10', // from a goal for everyone
		'1429e:10,10>1429e:30,10', // the Warrior goal is not weaker than a Mage one
		'1429e:20,10>1429e:40,10', // the same condition
		'1429e:40,10>1429e:50,10', // step `only Warrior` equals goal `only Warrior`
		'1429e:50,10>1429e:60,10',
	]);
	// A goal for one class never starts the leg into a goal for everyone.
	assert.deepEqual(keys(legsOf(['step S', '  goto 10,10', '  goto 20,10 only Warrior', '  goto 30,10'])), ['1429e:10,10>1429e:20,10', '1429e:10,10>1429e:30,10']);
});

test('smart targets (candidates) are not located: no leg ends or starts there', () => {
	const { guides, errors } = compile(guideText(['step S', '  goto 10,10', '  train Mining', '  goto 30,10']));
	assert.deepEqual(errors, []);
	assert.ok(guides[0].steps[0].goals[1].candidates.length, 'the trainer is picked at runtime');
	assert.deepEqual(keys(guideLegs(guides[0], { frames: frames() })), ['1429e:10,10>1429e:30,10']);
	// Even with a point of its own, a goal with candidates is no leg end.
	const guide = {
		steps: [{ goals: [{ t: 'goto', map: 1429, x: 10, y: 10, f: 'e' }, { t: 'train', map: 1429, x: 20, y: 10, f: 'e', candidates: [{ npc: 1, map: 1429, x: 20, y: 10 }] }, { t: 'goto', map: 1429, x: 30, y: 10, f: 'e' }] }],
	};
	assert.deepEqual(keys(guideLegs(guide, { frames: frames() })), ['1429e:10,10>1429e:30,10']);
});

// Explored places, not gotos: a leg into or out of a `goto` never counts as missing.
const GUIDE = ['step S', '  explore 10,10 "Hill"', '  explore 20,10 "Gate"', 'step T', '  explore 30,10 "Field"', '  explore 30,30 "Farm"'];
const DOC = {
	schema: 1,
	source: 'test',
	grid: { client: 'x', build: 'y' },
	guides: {
		't/main': {
			'1429e:10,10>1429e:20,10': { via: [[1429, 12.5, 11, 'e', 12, 'Follow the path', 0], [1429, 15, 12.25, 'l', 8, null, 1]] },
			'1429e:20,10>1429e:30,10': { via: [] },
		},
	},
};

test('via entries attach to their goal with the leg start; via [] attaches nothing', () => {
	const { guides, warnings, errors } = compile(guideText(GUIDE), undefined, { via: DOC });
	assert.deepEqual(errors, []);
	const g = guides[0];
	assert.deepEqual(plain(g.steps[0].goals[1].via), [
		{ map: 1429, x: 12.5, y: 11, f: 'e', r: 12, label: 'Follow the path' },
		{ map: 1429, x: 15, y: 12.25, r: 8, inner: true },
	]);
	assert.deepEqual(plain(g.steps[0].goals[1].viaFrom), { map: 1429, x: 10, y: 10, f: 'e' });
	assert.equal(g.steps[1].goals[0].via, undefined);
	assert.equal(g.steps[1].goals[0].viaFrom, undefined);
	// One leg (30,10 > 30,30) has no entry: one warning on the guide line.
	assert.deepEqual(warnings, ['test.guide:1: 1 leg has no waypoints from the navigation grid (run `node tools/polestar.js nav via`)']);
});

test('via and viaFrom are emitted after spread in a fixed key order, deterministically', () => {
	const emitted = () => {
		const { guides } = compile(guideText(GUIDE), undefined, { via: DOC });
		return emitGuides(guides.map((guide) => ({ guide, source: 'test.guide' })));
	};
	const lua = emitted();
	assert.ok(
		lua.includes(
			'{ t = "explore", text = "Gate", map = 1429, x = 20, y = 10, f = "e", via = { { map = 1429, x = 12.5, y = 11, f = "e", r = 12, label = "Follow the path" }, { map = 1429, x = 15, y = 12.25, r = 8, inner = true } }, viaFrom = { map = 1429, x = 10, y = 10, f = "e" } },'
		),
		lua
	);
	assert.equal(lua.match(/via = /g).length, 1);
	assert.equal(emitted(), lua);
	// Without via.json the output has no trace of it.
	const { guides } = compile(guideText(GUIDE));
	assert.ok(!emitGuides(guides.map((guide) => ({ guide, source: 'test.guide' }))).includes('via'));
});

test('attachVia replaces what an earlier attach set and lists guides with missing legs', () => {
	const { guides } = compile(guideText(GUIDE), undefined, { via: DOC });
	const missing = attachVia(guides, { schema: 1, guides: {} }, frames());
	assert.equal(guides[0].steps[0].goals[1].via, undefined);
	assert.deepEqual(
		missing.map((m) => [m.guide.id, m.missing]),
		[['t/main', 3]]
	);
});

test('missing entries warn once per guide; a guide with every leg covered does not', () => {
	const other = guideText(['guide t/other', 'title Other', 'faction Alliance', 'levels 1-10', 'zone Elwynn Forest', '', 'step S', '  explore 10,10 "A"', '  explore 20,10 "B"', '  explore 30,10 "C"']);
	const covered = guideText(['guide t/covered', 'title Covered', 'faction Alliance', 'levels 1-10', 'zone Elwynn Forest', '', 'step S', '  explore 10,10 "A"', '  explore 20,10 "B"']);
	const doc = { schema: 1, guides: { 't/covered': { '1429e:10,10>1429e:20,10': { via: [], manual: true } } } };
	const { warnings } = compile({ 'other.guide': other, 'covered.guide': covered }, undefined, { via: doc });
	assert.deepEqual(warnings, ['other.guide:1: 2 legs have no waypoints from the navigation grid (run `node tools/polestar.js nav via`)']);
});

test('legs into or out of a guide goto (hand-placed arrow fixes) are never missing', () => {
	const src = guideText(['step S', '  explore 10,10 "A"', '  goto 20,10 "Cave mouth"', '  explore 30,10 "Cave"', '  explore 40,10 "Camp"']);
	const { guides, warnings } = compile(src, undefined, { via: { schema: 1, guides: {} } });
	assert.deepEqual(
		guideLegs(guides[0], { frames: frames() }).map((l) => [l.from.isGoto, l.to.isGoto]),
		[[false, true], [true, false], [false, false]]
	);
	assert.deepEqual(warnings, ['test.guide:1: 1 leg has no waypoints from the navigation grid (run `node tools/polestar.js nav via`)']);
});

test('hand entries (a hand-made path serves the leg) attach nothing and count as present', () => {
	const doc = { schema: 1, guides: { 't/main': { '1429e:10,10>1429e:20,10': { via: [], hand: true }, '1429e:20,10>1429e:30,10': { via: [[1429, 25, 10, 'e', 12, null]] }, '1429e:30,10>1429e:30,30': { via: [], manual: true } } } };
	const { guides, errors, warnings } = compile(guideText(GUIDE), undefined, { via: doc });
	assert.deepEqual([errors, warnings], [[], []]);
	assert.equal(guides[0].steps[0].goals[1].via, undefined);
	// A point without `inner` reads as 0.
	assert.deepEqual(plain(guides[0].steps[1].goals[0].via), [{ map: 1429, x: 25, y: 10, f: 'e', r: 12 }]);
	const bad = (entry) => compile(guideText(GUIDE), undefined, { via: { schema: 1, guides: { 't/main': { k: entry } } } }).errors;
	assert.deepEqual(bad({ via: [], hand: true, manual: true }), ['via.json:0: via.json guide t/main, leg k: `hand` and `manual` together']);
	assert.deepEqual(bad({ via: [[1429, 25, 10, 'e', 12, null, 0]], hand: true }), ['via.json:0: via.json guide t/main, leg k: a `hand` leg (a hand-made path serves it) has points']);
});

test('a malformed via document is one error naming the file, and nothing is attached', () => {
	const bad = { schema: 1, guides: { 't/main': { '1429e:10,10>1429e:20,10': { via: [[1429, 12, 11, 'x', 12, null, 0]] } } } };
	const { guides, errors, warnings } = compile(guideText(GUIDE), undefined, { via: bad, viaFile: 'pack/via.json' });
	assert.deepEqual(errors, ['pack/via.json:0: via.json guide t/main, leg 1429e:10,10>1429e:20,10: point 1 has frame "x", not "e" or "l"']);
	assert.deepEqual(warnings, []);
	assert.equal(guides[0].steps[0].goals[1].via, undefined);
	assert.match(compile(guideText(GUIDE), undefined, { via: { schema: 2, guides: {} } }).errors[0], /^via\.json:0: via\.json has schema 2, expected 1$/);
});

function packDir(via) {
	const dir = tmpdir();
	fs.writeFileSync(path.join(dir, 'pack.json'), JSON.stringify({ id: 'mini', title: 'Mini Pack', author: 'Ann', version: '0.3.0', license: 'CC0-1.0' }));
	const text = guideText(['guide mini/a', 'title Mini A', 'faction Alliance', 'levels 1-10', 'zone Elwynn Forest', '', ...GUIDE]);
	fs.writeFileSync(path.join(dir, 'a.guide'), text);
	if (via !== undefined) fs.writeFileSync(path.join(dir, 'via.json'), via);
	return { dir, text };
}

function project(dir) {
	const { manifest } = readManifest(dir);
	const r = compileProject({ packDir: dir, manifest, data: fixtureData() });
	return { ...r, files: r.diag.hasErrors() ? null : buildPackFiles({ guides: r.guides, manifest, data: r.data }) };
}

test('compileProject reads <pack>/via.json; without it the output carries no via and no warning', () => {
	const doc = { ...DOC, guides: { 'mini/a': DOC.guides['t/main'] } };
	const withVia = project(packDir(`${JSON.stringify(doc, null, '\t')}\n`).dir);
	assert.equal(withVia.diag.hasErrors(), false);
	assert.ok(withVia.files['Guides.lua'].includes('viaFrom = { map = 1429, x = 10, y = 10, f = "e" }'));
	assert.equal(withVia.diag.warnings.filter((d) => /navigation grid/.test(d.message)).length, 1);
	const without = project(packDir().dir);
	assert.ok(!without.files['Guides.lua'].includes('via'));
	assert.equal(without.diag.warnings.filter((d) => /navigation grid/.test(d.message)).length, 0);
});

test('a via.json that is not JSON is one error naming the file', () => {
	const { dir } = packDir('{ "schema": 1,');
	const r = project(dir);
	const errs = r.diag.errors;
	assert.equal(errs.length, 1);
	assert.equal(path.resolve(errs[0].file), path.join(dir, 'via.json'));
	assert.match(errs[0].message, /^via\.json is not valid JSON/);
});

