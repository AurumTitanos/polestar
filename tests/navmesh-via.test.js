'use strict';
// The arrow's waypoints from the navigation grid (tools/lib/nav/via.js) on
// synthetic tiles built by the real grid build: a straight walk, a ridge, a
// cave, a lift, a maze; hand-made paths (guide gotos, crossings chains) win;
// manual entries are kept; the file is stable. One map (9001) covers the tile:
// x% = local x / ADT, y% = local y / ADT (Era frame).

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { Scene, ADT, QUAD } = require('./helpers/navscene');
const { tmpdir } = require('./helpers/tmp');
const { buildGrid } = require('../tools/lib/nav/grid/build');
const { openNav } = require('../tools/lib/nav/path');
const { Geo } = require('../tools/lib/planner/geo');
const { viaDocError } = require('../tools/lib/dsl/via');
const { generate, generateLegs, handMadeOf, MAX_POINTS, R_LIFT } = require('../tools/lib/nav/via');

const MAP = 9001;
const mapFrames = { era: { [MAP]: { c: 0, left: 0, right: -ADT, top: 0, bottom: -ADT } }, forever: {} };
const zones = { [MAP]: { id: MAP, name: 'Test Vale', type: 3 } };
const geo = new Geo(mapFrames, zones);

async function navOf(s, extra = {}) {
	const dir = tmpdir('polestar-via-');
	await buildGrid({
		outDir: dir, workers: 0,
		continents: [{ c: 0, name: 'test', tiles: [{ col: s.col, row: s.row }] }],
		geometryJob: () => ({ geom: s.geom() }),
		...extra,
	});
	return openNav({ dir });
}

const pc = (v) => Math.round((v / ADT) * 10000) / 100; // local yards -> map percent (two decimals)
// A goal at local (x, y) yards.
const goal = (x, y, t = 'talk') => ({ t, map: MAP, x: pc(x), y: pc(y), f: 'e' });
const guideOf = (...goals) => ({ id: 'test/guide', faction: 'Alliance', steps: goals.map((g) => ({ goals: [g] })) });
const world = ([map, x, y, f]) => geo.toWorld(map, x, y, f);

async function legsOf(nav, guide, sets = []) {
	return generateLegs({ guide, nav, geo, frames: mapFrames, sets });
}

// The only entry of a one-leg guide.
async function only(nav, from, to, sets) {
	const r = await legsOf(nav, guideOf(from, to), sets);
	const keys = Object.keys(r.entries);
	assert.ok(keys.length <= 1);
	return { entry: r.entries[keys[0]], r };
}

test('a straight walk on open ground needs no points', async () => {
	const nav = await navOf(new Scene());
	const { entry } = await only(nav, goal(100, 100), goal(400, 300));
	assert.deepEqual(entry, { via: [] });
});

test('a ridge: the points are its corners, each in sight of the next', async () => {
	const s = new Scene();
	s.box(250, 0, -1, 256, 440, 12);
	const nav = await navOf(s);
	const from = goal(150, 200);
	const to = goal(380, 200);
	const { entry } = await only(nav, from, to);
	assert.ok(entry.via.length >= 1 && entry.via.length <= 3, JSON.stringify(entry.via));
	for (const p of entry.via) {
		assert.equal(p[5], null, 'no label on open ground');
		assert.equal(p[6], 0);
		assert.equal(p[4], 12);
		assert.ok(p[2] * ADT / 100 > 430, `around the ridge's end (y ${p[2] * ADT / 100})`);
	}
	const chain = [world([MAP, from.x, from.y, 'e']), ...entry.via.map(world), world([MAP, to.x, to.y, 'e'])];
	for (let i = 1; i < chain.length; i++) assert.ok(nav.los(chain[i - 1], chain[i]), `point ${i - 1} sees point ${i}`);
});

test('a cave: "Enter the cave" at the mouth, the points past it inner', async () => {
	const inHill = (x, y) => x >= 200 && x <= 400 && y >= 150 && y <= 400;
	const s = new Scene({
		height: (x, y) => (inHill(x, y) ? 40 : 0),
		hole: (x, y) => x > 200 - QUAD && x < 200 + QUAD && y > 256 && y < 276,
	});
	// A corridor in from the west face, a bend, a chamber.
	s.floor(180, 260, 300, 272, 0.5, 2).floor(288, 260, 300, 340, 0.5, 2).floor(288, 330, 380, 380, 0.5, 2);
	const nav = await navOf(s);
	const { entry } = await only(nav, goal(60, 120), goal(370, 370));
	const enter = entry.via.findIndex((p) => p[5] === 'Enter the cave');
	assert.ok(enter >= 0, JSON.stringify(entry.via));
	assert.equal(entry.via[enter][6], 0, 'the mouth is joined from outside');
	assert.equal(entry.via[enter][4], 8);
	const inside = entry.via.slice(enter + 1);
	assert.ok(inside.length >= 1, 'points inside');
	for (const p of inside) assert.equal(p[6], 1, `inner ${JSON.stringify(p)}`);
});

test('a lift: "Take the lift up" at its foot, radius 6', async () => {
	// A sheer mesa (terrain, top 60) with an elevator at its east edge under a shaft roof at 75.
	const s = new Scene({ height: (x, y) => (x >= 50 && x <= 250 && y >= 50 && y <= 450 ? 60 : 0) });
	s.floor(248, 244, 260, 256, 75, 1);
	const spawn = s.world(253, 250);
	const nav = await navOf(s, { liftPoints: [{ ...spawn, name: 'Mesa Elevator', id: 1, rise: 60.4 }] });
	const { entry } = await only(nav, goal(400, 300), goal(120, 250));
	const lift = entry.via.find((p) => p[5] === 'Take the lift up');
	assert.ok(lift, JSON.stringify(entry.via));
	assert.equal(lift[4], R_LIFT);
	assert.ok(Math.hypot(lift[1] * ADT / 100 - 253, lift[2] * ADT / 100 - 250) < 12, 'at the lift');
	const after = entry.via.slice(entry.via.indexOf(lift) + 1);
	for (const p of after) assert.equal(p[6], 1, 'on the mesa: inner');
});

test(`a maze: at most ${MAX_POINTS} points, the leg reported`, async () => {
	const s = new Scene();
	for (let w = 0; w < 9; w++) {
		const x = 40 + w * 50;
		if (w % 2 === 0) s.box(x, 0, -1, x + 4, 440, 12);
		else s.box(x, 60, -1, x + 4, ADT, 12);
	}
	const nav = await navOf(s);
	const { entry, r } = await only(nav, goal(15, 250), goal(515, 250));
	assert.equal(entry.via.length, MAX_POINTS);
	assert.equal(r.over.length, 1);
});

test('hand-made: legs from or to a guide goto get no entry', async () => {
	const s = new Scene();
	s.box(250, 0, -1, 256, 440, 12);
	const nav = await navOf(s);
	const guide = guideOf(goal(150, 200), goal(380, 200, 'goto'), goal(380, 60), goal(150, 60));
	const r = await legsOf(nav, guide);
	const keys = Object.keys(r.skipped);
	assert.equal(Object.keys(r.entries).length, 1, 'only the leg between two non-goto goals');
	assert.deepEqual(keys.map((k) => r.skipped[k]), ['hand-made', 'hand-made']);
	for (const k of keys) assert.equal(r.handMade[k].kind, 'goto');
});

test('hand-made: a leg past a crossings chain node or to a chain\'s target is the chain\'s', async () => {
	const s = new Scene();
	s.box(250, 0, -1, 256, 440, 12);
	const nav = await navOf(s);
	const node = (x, y, r) => ({ ...s.world(x, y), r, map: MAP });
	const chain = { id: 'ridge-path', name: 'Ridge Path', open: 'mouth', c: 0, nodes: [node(253, 452, 15), node(300, 480, 15), node(380, 470, 15)] };
	const sets = [{ crossings: [], open: [], chains: [chain] }];
	// The route goes round the ridge's end, through the chain's mouth.
	const { entry, r } = await only(nav, goal(150, 200), goal(380, 200), sets);
	assert.deepEqual(entry, { via: [], hand: true });
	assert.deepEqual(Object.values(r.handMade), [{ kind: 'chain', id: 'ridge-path', name: 'Ridge Path' }]);
	// A target inside the chain (within 2 x radius of a node past the mouth).
	const leg = { from: goal(60, 60), to: goal(385, 460) };
	assert.deepEqual(handMadeOf(leg, { geo, sets }), { kind: 'chain', id: 'ridge-path', name: 'Ridge Path' });
	// A crossing end on the straight walk.
	const xs = [{ crossings: [{ id: 'gate', a: node(100, 130, 10), b: node(100, 600, 10) }], open: [], chains: [] }];
	assert.deepEqual(handMadeOf({ from: goal(60, 60), to: goal(160, 200) }, { geo, sets: xs }), { kind: 'crossing', id: 'gate', name: 'gate' });
	assert.equal(handMadeOf({ from: goal(300, 60), to: goal(400, 60) }, { geo, sets: xs }), null);
});

// A pack folder and a data folder for generate().
function packOf(via) {
	const root = tmpdir('polestar-via-pack-');
	const dataDir = path.join(root, 'data');
	const packDir = path.join(root, 'pack');
	fs.mkdirSync(dataDir);
	fs.mkdirSync(packDir);
	fs.writeFileSync(path.join(dataDir, 'map-frames.json'), JSON.stringify(mapFrames));
	fs.writeFileSync(path.join(dataDir, 'zones.json'), JSON.stringify(zones));
	if (via) fs.writeFileSync(path.join(packDir, 'via.json'), JSON.stringify(via));
	return { dataDir, packDir, crossingsFile: path.join(root, 'none.json') };
}

test('generate: manual entries kept unless --force, dead keys dropped, stable and valid output, threads agree', async () => {
	const s = new Scene();
	s.box(250, 0, -1, 256, 440, 12);
	const nav = await navOf(s);
	const guide = guideOf(goal(150, 200), goal(380, 200), goal(380, 60));
	const { guideLegs } = require('../tools/lib/dsl/legs');
	const [ridge, open] = guideLegs(guide, { frames: mapFrames });
	const manual = { via: [[MAP, 50, 50, 'e', 10, 'Hand drawn', 0]], manual: true };
	const via = { schema: 1, source: 'old', grid: null, guides: { [guide.id]: { [ridge.key]: manual, 'gone:1,1>gone:2,2': { via: [] } }, 'test/gone': { 'a>b': { via: [] } } } };
	const env = packOf(via);
	const run = (o = {}) => generate({ ...env, guides: [guide], nav, workers: 0, ...o });
	const a = await run();
	assert.deepEqual(a.doc.guides[guide.id][ridge.key], manual, 'manual kept');
	assert.deepEqual(a.doc.guides[guide.id][open.key], { via: [] });
	assert.deepEqual(Object.keys(a.doc.guides), [guide.id], 'guides no longer in the pack dropped');
	assert.deepEqual(Object.keys(a.doc.guides[guide.id]).sort(), [ridge.key, open.key].sort(), 'dead keys dropped');
	assert.equal(viaDocError(JSON.parse(a.text)), null);
	assert.equal(a.stats.total.manual, 1);
	const b = await run();
	assert.equal(b.text, a.text, 'two runs give the same file');
	assert.match(a.text, /^\{\n\t"schema": 1,\n\t"source": "nav via: navigation grid of the Forever client /);
	assert.ok(a.text.endsWith('}\n'));
	const forced = await run({ force: true });
	assert.ok(!forced.doc.guides[guide.id][ridge.key].manual, '--force regenerates');
	assert.ok(forced.doc.guides[guide.id][ridge.key].via.length >= 1);
	const threaded = await run({ force: true, workers: 2 });
	assert.equal(threaded.text, forced.text, 'the worker pool gives what one thread gives');
});
