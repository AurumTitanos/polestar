'use strict';
// Guides are scored on what they require (docs/SIMULATION.md §5, issue #30):
// `sim compare` leaves a guide's optional goals out unless --with-optional.
// The quest log size the world builder splits packages at (§2).

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const { loadPolestarRoutes, requiredEvents } = require('../tools/lib/sim/baselines/polestar');
const { sources } = require('../tools/lib/sim/compare');
const { MAX_OPEN } = require('../tools/lib/sim/world');

const FIX = path.join(__dirname, 'fixtures', 'sim', 'polestar');

// The sample guides with an optional turn-in (90010) and an optional quest
// (90020, accept optional) in North.
function guides() {
	const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'polestar-optional-'));
	fs.cpSync(path.join(FIX, 'guides'), dir, { recursive: true });
	const north = path.join(dir, 'forever', 'horde', '02-north.guide');
	fs.writeFileSync(north, fs.readFileSync(north, 'utf8').replace('  turnin 90010 "North Task"\n', '  turnin 90010 "North Task" optional\n  accept 90020 optional\n  turnin 90020\n'));
	return dir;
}

const quests = (events) => events.filter((e) => e.q != null && e.t !== 'guide').map((e) => `${e.t} ${e.q}`);

test('requiredEvents: an optional quest goes whole, another optional goal by itself', () => {
	const ev = [
		{ t: 'accept', q: 1 },
		{ t: 'complete', q: 1, obj: 1, optional: true },
		{ t: 'turnin', q: 1 },
		{ t: 'accept', q: 2, optional: true },
		{ t: 'complete', q: 2, obj: 1 },
		{ t: 'turnin', q: 2 },
		{ t: 'level', level: 5, xp: null },
	];
	assert.deepEqual(requiredEvents(ev), [ev[0], ev[2], ev[6]]);
});

test('sim compare scores the guides without their optional goals; --with-optional keeps them', () => {
	const dir = guides();
	const simDir = fs.mkdtempSync(path.join(os.tmpdir(), 'polestar-optional-sim-'));
	try {
		const all = loadPolestarRoutes({ guidesDir: dir, dataDir: path.join(FIX, 'data'), faction: 'Horde', race: 'Orc' }).default.events;
		assert.ok(quests(all).includes('turnin 90010') && quests(all).includes('accept 90020'));
		const o = { guidesDir: dir, dataDir: path.join(FIX, 'data'), simDir };
		const polestar = (opts) => sources({ ...o, ...opts }, 'Horde', 'Orc', { world: null }, { world: null }).list.find((s) => s.id === 'polestar').events;
		const req = quests(polestar({}));
		assert.ok(req.includes('accept 90010'));
		assert.ok(!req.includes('turnin 90010'));
		assert.ok(!req.some((x) => x.endsWith(' 90020')));
		assert.deepEqual(quests(polestar({ withOptional: true })), quests(all));
	} finally {
		fs.rmSync(dir, { recursive: true, force: true });
		fs.rmSync(simDir, { recursive: true, force: true });
	}
});

test('quest log: 20 as the published results were searched, within the client\'s 40', () => {
	// Forever's client: MAXIMUM_NUM_QUESTS_LOG_CAN_ACCEPT = 40. The published
	// results were searched at 20; 40 comes with the next world (0.2.5).
	assert.equal(MAX_OPEN, 20);
	assert.ok(MAX_OPEN <= 40);
});
