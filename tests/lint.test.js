'use strict';
// lint: the solo policy reads the simulator's cached worlds only when they
// were built from the same data by the current world builder.

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const lint = require('../tools/commands/lint');
const { soloExclusions } = lint;
const { dataHash } = require('../tools/lib/sim/world');
const { ROOT } = require('../tools/lib/paths');
const { quiet } = require('./helpers/cli');
const { tmpdir } = require('./helpers/tmp');
const { DATA_DIR } = require('./helpers/dsl');

test('a cached world from other data or an older builder is ignored (reported stale), a current one is used', (t) => {
	const dir = tmpdir('polestar-lint-');
	const dataDir = path.join(dir, 'data');
	const simDir = path.join(dir, 'sim');
	fs.mkdirSync(dataDir);
	fs.mkdirSync(simDir);
	fs.writeFileSync(path.join(dataDir, 'meta.json'), JSON.stringify({ builtAt: 'test' }));
	const excluded = [{ id: 3441, title: 'Divine Retribution', reason: 'elite kill objective npc 8888', category: 'elite' }];
	const current = dataHash(dataDir, path.join(ROOT, 'data', 'sources'));
	fs.writeFileSync(path.join(simDir, 'world-horde.json'), JSON.stringify({ dataHash: current, excluded }));
	fs.writeFileSync(path.join(simDir, 'world-alliance.json'), JSON.stringify({ dataHash: 'builder 15', excluded }));
	const r = soloExclusions(simDir, dataDir);
	assert.deepEqual(r.stale, ['Alliance']);
	assert.equal(r.excluded.Alliance, undefined);
	assert.equal(r.excluded.Horde.get(3441).category, 'elite');
});

test('the note about a stale cached world is for our guides only, not another pack', async (t) => {
	const dir = tmpdir('polestar-lint-');
	fs.writeFileSync(path.join(dir, 'world-alliance.json'), JSON.stringify({ dataHash: 'builder 15', excluded: [] }));
	const guides = path.join(dir, 'guides');
	fs.mkdirSync(guides);
	fs.writeFileSync(path.join(guides, 'a.guide'), 'guide forever/test/a\ntitle A\nlevels 1-2\n\nstep S\n  level 2\n');
	const ours = await quiet(() => lint.run(['--guides', guides, '--data', DATA_DIR, '--sim', dir]));
	assert.match(ours.out, /note: solo-filter checks skipped for Alliance/);
	const pack = await quiet(() => lint.run(['--pack', path.join(__dirname, 'fixtures', 'packs', 'plays'), '--data', DATA_DIR, '--context-data', DATA_DIR, '--sim', dir]));
	assert.doesNotMatch(pack.out, /solo-filter|sim world/);
});
