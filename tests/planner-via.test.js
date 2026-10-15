'use strict';
// The planner's arrow waypoints (tools/planner/workspace.js, commands.js):
// a pack's via.json read at start, shown per leg (via_get, GuideView
// goals[].leg), edited (via_set: marked manual) and regenerated (via_generate)
// through the undo history, listed and reverted with the guide files, and
// followed by the playback.

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { tmpdir } = require('./helpers/tmp');
const { DATA_DIR } = require('./helpers/dsl');
const { Workspace } = require('../tools/planner/workspace');
const commands = require('../tools/planner/commands');
const { formatVia } = require('../tools/lib/nav/via');

const GUIDE = [
	'guide t/via',
	'title Via',
	'faction Alliance',
	'levels 1-10',
	'zone Elwynn Forest',
	'',
	'step Hill',
	'  explore 30,30 "Hill"',
	'step Farm',
	'  explore 60,60 "Farm"',
	'step Mouth',
	'  goto 70,60 "Cave mouth"',
	'  explore 80,60 "Cave"',
	'',
].join('\n');
const FARM = '1429e:30,30>1429e:60,60';
const MOUTH = '1429e:60,60>1429e:70,60';
const CAVE = '1429e:70,60>1429e:80,60';

const START = formatVia({
	schema: 1, source: 'test', grid: null,
	guides: { 't/via': { [FARM]: { via: [[1429, 45, 40, 'e', 12, 'Follow the path', 0]] } } },
});

function setup(opts = {}) {
	const dir = path.join(tmpdir('polestar-planner-via-'), 'pack');
	fs.mkdirSync(path.join(dir, 'guides'), { recursive: true });
	fs.writeFileSync(path.join(dir, 'pack.json'), JSON.stringify({ id: 'viatest', title: 'Via test', author: 'Ann', version: '0.1.0', license: 'CC0-1.0' }, null, '\t'));
	fs.writeFileSync(path.join(dir, 'guides', 'via.guide'), GUIDE);
	fs.writeFileSync(path.join(dir, 'via.json'), START);
	const ws = new Workspace({ dataDir: DATA_DIR, official: false, packs: [dir], watch: false, lintDelay: 600000, ...opts });
	// -> { ok, result } or { ok: false, error, code }, as POST /api/cmd answers.
	const run = async (name, args = {}) => {
		try {
			return { ok: true, result: await commands.run(ws, name, args) };
		} catch (err) {
			return { ok: false, error: err.message, code: err.code };
		}
	};
	return { ws, dir, run, file: path.join(dir, 'via.json') };
}

async function call(run, name, args) {
	const r = await run(name, args);
	assert.equal(r.ok, true, `${name}: ${r.error}`);
	return r.result;
}

test('via_get lists the legs with their entries; hand-made goto legs are marked', async () => {
	const { ws, run } = setup();
	try {
		const v = await call(run, 'via_get', { id: 't/via' });
		assert.equal(v.exists, true);
		assert.deepEqual(v.legs.map((l) => l.key), [FARM, MOUTH, CAVE]);
		const farm = v.legs[0];
		assert.equal(farm.via.length, 1);
		assert.equal(farm.via[0].label, 'Follow the path');
		assert.equal(farm.manual, false);
		assert.equal(farm.handMade, null);
		assert.ok(Number.isFinite(farm.via[0].wx) && farm.from.map === 1429);
		assert.equal(v.legs[1].via, null);
		assert.equal(v.legs[1].handMade.kind, 'goto');
		assert.equal(v.legs[2].handMade.kind, 'goto');
		// The compiled goal carries them: the playback walks through the point.
		const g = await call(run, 'guide_get', { id: 't/via' });
		assert.equal(g.steps[1].goals[0].leg.key, FARM);
	} finally {
		ws.close();
	}
});

test('a leg a hand-made chain of the crossings file serves is marked and refuses edits', async () => {
	const crossingsFile = path.join(tmpdir('polestar-planner-via-x-'), 'crossings.json');
	fs.writeFileSync(crossingsFile, JSON.stringify({ schema: 1, frame: 'e', crossings: [], open: [], chains: [{ id: 'farm-path', name: 'Farm Path', open: 'mouth', nodes: [{ map: 1429, x: 44, y: 44, radius: 20, caption: 'Take the path' }, { map: 1429, x: 46, y: 46, radius: 15, caption: 'On to the farm' }] }] }));
	const { ws, run } = setup({ crossingsFile });
	try {
		const v = await call(run, 'via_get', { id: 't/via' });
		assert.deepEqual(v.legs[0].handMade, { kind: 'chain', id: 'farm-path', name: 'Farm Path' });
		const r = await run('via_set', { id: 't/via', hash: v.hash, key: FARM, via: [] });
		assert.equal(r.code, 'hand_made');
	} finally {
		ws.close();
	}
});

test('via_set writes via.json as one undoable edit, marked manual; revert puts it back', async () => {
	const { ws, run, file } = setup();
	try {
		const { hash } = await call(run, 'via_get', { id: 't/via' });
		const r = await call(run, 'via_set', { id: 't/via', hash, key: FARM, via: [{ map: 1429, x: 45, y: 40 }, { map: 1429, x: 52, y: 50, r: 8, label: 'Enter the cave', inner: true }] });
		const leg = r.guide.steps[1].goals[0].leg;
		assert.equal(leg.manual, true);
		assert.deepEqual(leg.via.map((p) => [p.x, p.y, p.r, p.label, p.inner]), [[45, 40, 12, null, false], [52, 50, 8, 'Enter the cave', true]]);
		const doc = JSON.parse(fs.readFileSync(file, 'utf8'));
		assert.deepEqual(doc.guides['t/via'][FARM], { via: [[1429, 45, 40, 'e', 12, null, 0], [1429, 52, 50, 'e', 8, 'Enter the cave', 1]], manual: true });
		assert.equal(doc.source, 'test');
		// A world point is written on the goal's map.
		const w = leg.via[0];
		await call(run, 'via_set', { id: 't/via', hash, key: FARM, via: [{ c: w.c, wx: w.wx, wy: w.wy, label: 'Moved' }] });
		const moved = JSON.parse(fs.readFileSync(file, 'utf8')).guides['t/via'][FARM].via[0];
		assert.equal(moved[0], 1429);
		assert.ok(Math.abs(moved[1] - 45) < 0.05 && Math.abs(moved[2] - 40) < 0.05, `moved to ${moved}`);
		assert.deepEqual((await call(run, 'changes_list')).map((c) => c.file.endsWith('via.json')), [true]);
		// Undo twice: the file's text at start; redo, then revert.
		assert.equal((await call(run, 'edit_undo')).label, 'Edit arrow waypoints');
		await call(run, 'edit_undo');
		assert.equal(fs.readFileSync(file, 'utf8'), START);
		assert.deepEqual(await call(run, 'changes_list'), []);
		await call(run, 'edit_redo');
		assert.notEqual(fs.readFileSync(file, 'utf8'), START);
		const changed = await call(run, 'changes_list');
		await call(run, 'changes_revert', { file: changed[0].file });
		assert.equal(fs.readFileSync(file, 'utf8'), START);
		assert.deepEqual(await call(run, 'changes_list'), []);
	} finally {
		ws.close();
	}
});

test('via_set refuses a stale guide hash, an unknown leg and a hand-made leg', async () => {
	const { ws, run } = setup();
	try {
		const { hash } = await call(run, 'via_get', { id: 't/via' });
		const stale = await run('via_set', { id: 't/via', hash: 'x', key: FARM, via: [] });
		assert.equal(stale.code, 'stale');
		const none = await run('via_set', { id: 't/via', hash, key: 'nope', via: [] });
		assert.equal(none.code, 'bad_args');
		const hand = await run('via_set', { id: 't/via', hash, key: MOUTH, via: [{ map: 1429, x: 65, y: 60 }] });
		assert.equal(hand.code, 'hand_made');
	} finally {
		ws.close();
	}
});

test('via_generate writes the generator\'s entries as one edit, keeps manual ones unless forced', async () => {
	const asked = [];
	const viaGenerator = async ({ guide, keys }) => {
		asked.push({ id: guide.id, keys });
		return { entries: { [FARM]: { via: [[1429, 47, 44, 'e', 12, null, 0]] } }, skipped: { [MOUTH]: 'hand-made', [CAVE]: 'hand-made' }, over: [] };
	};
	const { ws, run, file } = setup({ viaGenerator });
	const done = () => new Promise((resolve) => ws.once('via', resolve));
	try {
		const { hash } = await call(run, 'via_get', { id: 't/via' });
		await call(run, 'via_set', { id: 't/via', hash, key: FARM, via: [{ map: 1429, x: 45, y: 40 }] });
		// The manual entry is kept.
		let ev = done();
		assert.deepEqual(await call(run, 'via_generate', { id: 't/via' }), { job: 1, legs: 3 });
		let d = await ev;
		assert.equal(d.ok, true);
		assert.deepEqual(d.kept, [FARM]);
		assert.equal(d.written, 0);
		assert.deepEqual(asked[0], { id: 't/via', keys: [FARM, MOUTH, CAVE] });
		assert.equal(JSON.parse(fs.readFileSync(file, 'utf8')).guides['t/via'][FARM].manual, true);
		// Forced for that leg: replaced, not manual; one undo brings the edit back.
		ev = done();
		await call(run, 'via_generate', { id: 't/via', keys: [FARM], force: true });
		d = await ev;
		assert.equal(d.written, 1);
		assert.deepEqual(asked[1].keys, [FARM]);
		assert.deepEqual(JSON.parse(fs.readFileSync(file, 'utf8')).guides['t/via'][FARM], { via: [[1429, 47, 44, 'e', 12, null, 0]] });
		assert.equal((await call(run, 'edit_undo')).label, 'Regenerate waypoints');
		assert.equal(JSON.parse(fs.readFileSync(file, 'utf8')).guides['t/via'][FARM].manual, true);
		const bad = await run('via_generate', { id: 't/via', keys: ['nope'] });
		assert.equal(bad.code, 'bad_args');
	} finally {
		ws.close();
	}
});

test('the timeline follows the leg\'s waypoints and is rebuilt when via.json changes', async () => {
	const { ws, run } = setup();
	try {
		const character = { race: 'Human', cls: 'WARRIOR', faction: 'Alliance' };
		const farmOf = (tl) => tl.steps[1].goals[0];
		const before = await call(run, 'timeline_get', { start: 't/via', character, view: 'full' });
		assert.equal(farmOf(before).via, 1);
		const { hash } = await call(run, 'via_get', { id: 't/via' });
		await call(run, 'via_set', { id: 't/via', hash, key: FARM, via: [] });
		const after = await call(run, 'timeline_get', { start: 't/via', character, view: 'full' });
		assert.equal(farmOf(after).via, undefined);
		assert.ok(farmOf(after).split.travel < farmOf(before).split.travel);
	} finally {
		ws.close();
	}
});
