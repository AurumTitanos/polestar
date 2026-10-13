'use strict';
// sim export: grind stops name a camp of quest mobs of the character's level
// (the simulator itself grinds wherever it stands).

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const { loadCamps, grindSpotter } = require('../tools/lib/sim/export');
const syn = require('./fixtures/sim/synthetic');
const { tmpdir } = require('./helpers/tmp');

test('camps are clusters of quest mobs only: a guard standing in a group is never a grind spot', (t) => {
	const dir = tmpdir('polestar-export-');
	const data = syn.makeData();
	// Town guards: a group of normal NPCs without a faction, no quest needs them.
	data.npcs[20] = { id: 20, name: 'Town Bruiser', level: 7, faction: null, spawns: { [syn.FIELD]: { f: 'e', pts: [[60, 60], [60.5, 60], [61, 60], [60, 60.5], [60.5, 60.5], [61, 60.5], [60, 61]] } } };
	for (const [k, v] of Object.entries(data)) fs.writeFileSync(path.join(dir, `${k}.json`), JSON.stringify(v));
	const camps = loadCamps({ dataDir: dir });
	const names = new Set(camps.map((c) => c.name));
	assert.ok(names.has('Field Boar') && names.has('Burrow Rat'), [...names].join(', '));
	assert.equal(names.has('Town Bruiser'), false);
	const boar = camps.find((c) => c.name === 'Field Boar');
	assert.equal(boar.level, 7);
	assert.equal(boar.map, syn.FIELD);
});

test('a grind goes to the nearest camp of mobs one level below to two above the character, on its landmass', () => {
	// One landmass (region 10) and an island (region 11); points are [c, region, wx, wy, map].
	const world = { points: [[1, 10, 0, 0, 1], [1, 11, 0, 0, 2]], zones: { 1: 'Mainland', 2: 'Isle' } };
	const camp = (name, level, size, wx, region = 10, map = 1) => ({ name, level, size, region, wx, wy: 0, map, x: 50, y: 50 });
	const camps = [
		camp('Too Low', 7, 15, 50),
		camp('Too High', 13, 15, 50),
		camp('Far Big', 11, 40, 3000),
		camp('Near Small', 11, 8, 300),
		camp('Isle Crab', 10, 15, 10, 11, 2),
	];
	const spot = grindSpotter(world, camps, {});
	assert.equal(spot(0, 10.4).mob, 'Near Small');
	assert.equal(spot(0, 10.4).zone, 'Mainland');
	assert.equal(spot(1, 10.4).mob, 'Isle Crab');
	assert.equal(spot(1, 20), null);
});
