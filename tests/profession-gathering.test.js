'use strict';
// The generator behind guides/forever/professions/{mining,herbalism,skinning,
// fishing,cooking,first-aid}.guide (tools/lib/professions/gathering): the
// skill-up tables, the craft-count model and the route clustering on synthetic
// data, then (with data/forever built) that the generated guides match the
// files on disk and compile without errors. Playing them is
// tests/guides.test.js's job.

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const T = require('../tools/lib/professions/gathering/tables');
const R = require('../tools/lib/professions/gathering/route');
const { expectedCrafts } = require('../tools/lib/professions/gathering/secondary');
const { makeProjector } = require('../tools/lib/route/geo');

const ROOT = path.resolve(__dirname, '..');
const DATA = path.join(ROOT, 'data', 'forever');
const hasData = fs.existsSync(path.join(DATA, 'professions.json')) && fs.existsSync(path.join(DATA, 'objects.json'));

test('node colors follow the Classic +25/+50/+100 steps', () => {
	assert.equal(T.color(64, 65), null);
	assert.equal(T.color(65, 65), 'orange');
	assert.equal(T.color(89, 65), 'orange');
	assert.equal(T.color(90, 65), 'yellow');
	assert.equal(T.color(115, 65), 'green');
	assert.equal(T.color(165, 65), 'grey');
	// Copper over 1-65 is orange then yellow then green: strictly between 0 and 1.
	const w = T.bandWeight(1, 1, 65);
	assert.ok(w > T.COLOR_WEIGHT.green && w < 1);
	assert.equal(T.bandWeight(300, 275, 300), 0);
});

test('node tables cover every rank of ore and herb up to 300', () => {
	assert.equal(T.MINING_NODES['Copper Vein'], 1);
	assert.equal(T.MINING_NODES['Rich Thorium Vein'], 275);
	assert.equal(T.HERB_NODES.Peacebloom, 1);
	assert.equal(T.HERB_NODES['Black Lotus'], 300);
	for (const table of [T.MINING_NODES, T.HERB_NODES]) for (const v of Object.values(table)) assert.ok(v >= 1 && v <= 300);
});

test('skinning requirement by beast level', () => {
	assert.equal(T.skinningReq(5), 1);
	assert.equal(T.skinningReq(16), 60);
	assert.equal(T.skinningReq(20), 100);
	assert.equal(T.skinningReq(40), 200);
	assert.equal(T.skinningReq(60), 300);
});

test('expected crafts: one per point below yellow, more as the recipe greys', () => {
	const r = { name: 'Test', yellow: 50, grey: 100 };
	assert.equal(expectedCrafts(r, 1, 50), 49);
	// At 75 the chance is (100 - 75) / 50 = 0.5: two crafts for that point.
	assert.equal(expectedCrafts(r, 75, 76), 2);
	assert.ok(expectedCrafts(r, 50, 90) > 40);
	assert.throws(() => expectedCrafts(r, 99, 101), /grey/);
});

test('loop: clusters ordered as a tour starting near the entry point', () => {
	const project = makeProjector({ era: { 1: { c: 0, left: 0, right: -1000, top: 0, bottom: -1000 } } });
	const pts = [];
	const at = (x, y, n) => {
		for (let i = 0; i < n; i++) pts.push({ name: 'Copper Vein', w: 1, pt: project.point(1, x + i * 0.5, y, 'e') });
	};
	at(10, 10, 4);
	at(80, 10, 3);
	at(80, 80, 5);
	at(10, 80, 2);
	const loop = R.loop(pts, project, { radius: 40, cover: 1, entry: project.point(1, 12, 78, 'e') });
	assert.equal(loop.length, 4);
	assert.ok(loop[0].pt.x < 20 && loop[0].pt.y > 70, 'starts at the cluster nearest the entry');
	const score = R.scorePoints(pts);
	assert.ok(score.gain === 14 && score.score > 0);
});

test('live-frame spawns come out in the Era frame, so loops on redrawn maps match `coords era`', () => {
	// A map Forever redrew: its live frame is offset from the Era frame and
	// covers 800 yards instead of 1000.
	const frames = {
		era: { 1: { c: 0, left: 0, right: -1000, top: 0, bottom: -1000 } },
		forever: { 1: { c: 0, left: 100, right: -700, top: 200, bottom: -600 } },
	};
	const project = makeProjector(frames);
	// Live 50,50 is world (-200, -300): Era 30,20.
	const p = project.point(1, 50, 50, 'l');
	assert.deepEqual([p.x, p.y, p.f, p.wx, p.wy], [30, 20, 'e', -200, -300]);
	// Nodes recorded in both frames cluster together, and the waypoint is Era.
	const pts = [
		{ name: 'Copper Vein', w: 1, pt: project.point(1, 50, 50, 'l') },
		{ name: 'Copper Vein', w: 1, pt: project.point(1, 50.5, 50, 'l') },
		{ name: 'Copper Vein', w: 1, pt: project.point(1, 30, 21, 'e') },
	];
	const [c] = R.weightedClusters(pts, 30, project);
	assert.equal(c.w, 3);
	assert.equal(c.pt.f, 'e');
	assert.deepEqual([c.pt.x, c.pt.y], [30.1, 20.3]);
	// A map with live bounds only stays live.
	const only = makeProjector({ era: {}, forever: frames.forever }).point(1, 50, 50, 'l');
	assert.deepEqual([only.x, only.y, only.f, only.wx, only.wy], [50, 50, 'l', -200, -300]);
});

test('generated profession guides are up to date and compile', { skip: hasData ? false : 'data/forever not built' }, () => {
	const { buildAll } = require('../tools/lib/professions/gathering/build');
	const { context, OUT_DIR } = require('../tools/lib/professions/gathering/common');
	const { compileSources } = require('../tools/lib/dsl/project');
	const { format } = require('../tools/lib/dsl/diag');
	const ctx = context(DATA);
	const files = buildAll(ctx);
	assert.deepEqual(Object.keys(files).sort(), ['cooking.guide', 'first-aid.guide', 'fishing.guide', 'herbalism.guide', 'mining.guide', 'skinning.guide']);
	const stale = Object.entries(files)
		.filter(([name, text]) => !fs.existsSync(path.join(OUT_DIR, name)) || fs.readFileSync(path.join(OUT_DIR, name), 'utf8') !== text)
		.map(([name]) => name);
	assert.deepEqual(stale, [], 'run node tools/lib/professions/gathering/build.js --write');
	const sources = Object.entries(files).map(([name, text]) => ({ file: `guides/forever/professions/${name}`, source: `forever/professions/${name}`, text }));
	const { diag } = compileSources(sources, ctx.data);
	assert.deepEqual(diag.errors.map(format), []);
});
