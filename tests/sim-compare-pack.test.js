'use strict';
// `sim compare` inside a guide pack: the pack's leveling chain is
// scored beside ours on the synthetic world (tests/fixtures/sim/synthetic.js);
// a chain starting above level 1 plays our default chain first, up to the
// guide that reaches its first level; the result goes to its own pack-named file.

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const syn = require('./fixtures/sim/synthetic');
const { tmpdir, quiet } = require('./fixtures/dsl/helpers');
const { compareCommand } = require('../tools/lib/sim/compare');
const { loadPolestarRoutes } = require('../tools/lib/sim/baselines/polestar');
const { readManifest } = require('../tools/lib/pack/manifest');

const write = (dir, rel, text) => {
	fs.mkdirSync(path.dirname(path.join(dir, rel)), { recursive: true });
	fs.writeFileSync(path.join(dir, rel), `${text.join('\n')}\n`);
};

// Our guides: the Orc starting zone in Testvale (levels 1-5). The pack:
// Farfield from level 5, handing over to nothing.
function fixture() {
	const root = tmpdir();
	const dirs = syn.writeDataDir(root);
	const ours = path.join(root, 'guides');
	write(ours, 'forever/horde/orc/01-start.guide', [
		'guide forever/horde/orc/01-start', 'title Start', 'faction Horde', 'race Orc', 'levels 1-5', 'zone Testvale', '',
		'step Rats', '  accept 501', '  kill 10 x8 quest 501.1', '  turnin 501', '  accept 503',
	]);
	const pack = path.join(root, 'joe-pack');
	write(pack, 'pack.json', [JSON.stringify({ id: 'joe', title: "Joe's Routes", author: 'Joe', version: '1.0.0', license: 'CC0-1.0' })]);
	write(pack, 'guides/field.guide', [
		'guide joe/field', 'title Joe Farfield', 'faction Horde', 'race Orc', 'levels 5-10', 'zone Farfield', '',
		'step Warden', '  turnin 503', '  accept 504', '  kill 12 x10 quest 504.1', '  turnin 504', '  accept 505', '  kill 13 x10 quest 505.1', '  turnin 505',
	]);
	return { ...dirs, ours, pack, benchDir: path.join(root, 'bench') };
}

test('the pack chain starting at level 5 plays our starting zone first', () => {
	const f = fixture();
	const { manifest } = readManifest(f.pack);
	const r = loadPolestarRoutes({ guidesDir: f.ours, dataDir: f.dataDir, race: 'Orc', pack: { dir: f.pack, manifest } });
	assert.deepEqual(r.prefix, ['forever/horde/orc/01-start']);
	assert.deepEqual(r.default.guides.map((g) => [g.id, g.file]), [
		['forever/horde/orc/01-start', 'forever/horde/orc/01-start.guide'],
		['joe/field', 'guides/field.guide'],
	]);
	assert.equal(r.default.label, 'joe 1-10 default');
	assert.deepEqual(r.graph.nodes.map((n) => n.id), ['joe/field']);
	// Ours alone is unchanged.
	const ours = loadPolestarRoutes({ guidesDir: f.ours, dataDir: f.dataDir, race: 'Orc' });
	assert.deepEqual(ours.default.guides.map((g) => g.id), ['forever/horde/orc/01-start']);
	assert.deepEqual(ours.prefix, []);
});

test('a pack chain starting inside our second guide\'s levels plays our first two guides before it', () => {
	const f = fixture();
	// Our chain grows a second guide (levels 5-8, Farfield); the first hands over to it.
	const start = path.join(f.ours, 'forever/horde/orc/01-start.guide');
	fs.writeFileSync(start, fs.readFileSync(start, 'utf8').replace('zone Testvale', 'zone Testvale\nnext forever/horde/orc/02-field'));
	write(f.ours, 'forever/horde/orc/02-field.guide', [
		'guide forever/horde/orc/02-field', 'title Field', 'faction Horde', 'race Orc', 'levels 5-8', 'zone Farfield', '',
		'step Warden', '  turnin 503', '  accept 504', '  kill 12 x10 quest 504.1', '  turnin 504',
	]);
	// The pack starts at level 7: above our first guide (1-5), inside our second.
	write(f.pack, 'guides/field.guide', [
		'guide joe/field', 'title Joe Deep Field', 'faction Horde', 'race Orc', 'levels 7-10', 'zone Farfield', '',
		'step Deep', '  accept 505', '  kill 13 x10 quest 505.1', '  turnin 505',
	]);
	const { manifest } = readManifest(f.pack);
	const r = loadPolestarRoutes({ guidesDir: f.ours, dataDir: f.dataDir, race: 'Orc', pack: { dir: f.pack, manifest } });
	assert.deepEqual(r.prefix, ['forever/horde/orc/01-start', 'forever/horde/orc/02-field']);
	assert.deepEqual(r.default.guides.map((g) => g.id), ['forever/horde/orc/01-start', 'forever/horde/orc/02-field', 'joe/field']);
	assert.equal(r.default.label, 'joe 1-10 default');
	// A pack starting at our first guide's last level still plays only that one.
	write(f.pack, 'guides/field.guide', [
		'guide joe/field', 'title Joe Deep Field', 'faction Horde', 'race Orc', 'levels 5-10', 'zone Farfield', '',
		'step Deep', '  accept 505', '  kill 13 x10 quest 505.1', '  turnin 505',
	]);
	assert.deepEqual(loadPolestarRoutes({ guidesDir: f.ours, dataDir: f.dataDir, race: 'Orc', pack: { dir: f.pack, manifest } }).prefix, ['forever/horde/orc/01-start']);
});

test('a pack chain whose guides name no race is scored for every race of the faction', async () => {
	const f = fixture();
	write(f.pack, 'guides/field.guide', [
		'guide joe/field', 'title Joe Farfield', 'faction Horde', 'levels 5-10', 'zone Farfield', '',
		'step Warden', '  turnin 503', '  accept 504', '  kill 12 x10 quest 504.1', '  turnin 504', '  accept 505', '  kill 13 x10 quest 505.1', '  turnin 505',
	]);
	const { manifest } = readManifest(f.pack);
	const r = loadPolestarRoutes({ guidesDir: f.ours, dataDir: f.dataDir, race: 'Orc', pack: { dir: f.pack, manifest } });
	assert.ok(r, 'the faction-wide chain is found');
	assert.deepEqual(r.default.guides.map((g) => g.id), ['forever/horde/orc/01-start', 'joe/field']);
	const o = { dataDir: f.dataDir, simDir: f.simDir, sourcesDir: f.sourcesDir, benchDir: f.benchDir, offline: true, extraStarts: syn.START, log: () => {} };
	const { result, out } = await quiet(() => compareCommand({ faction: 'Horde', race: 'Orc', guides: f.ours, pack: f.pack }, o));
	assert.equal(result, 0, out);
	const doc = JSON.parse(fs.readFileSync(path.join(f.benchDir, 'compare-horde-orc-joe.json'), 'utf8'));
	assert.deepEqual(doc.rows.find((x) => x.id === 'pack').guides, ['forever/horde/orc/01-start', 'joe/field']);
	assert.doesNotMatch(out, /no leveling guide of the pack starts/);
});

test('sim compare with a pack scores its chain beside ours and writes compare-<faction>-<race>-<pack>.json', async () => {
	const f = fixture();
	const o = { dataDir: f.dataDir, simDir: f.simDir, sourcesDir: f.sourcesDir, benchDir: f.benchDir, offline: true, extraStarts: syn.START, log: () => {} };
	const { result, out } = await quiet(() => compareCommand({ faction: 'Horde', race: 'Orc', guides: f.ours, pack: f.pack }, o));
	assert.equal(result, 0, out);
	assert.deepEqual(fs.readdirSync(f.benchDir).sort(), ['compare-horde-orc-joe.json', 'compare-horde-orc-joe.md']);
	const doc = JSON.parse(fs.readFileSync(path.join(f.benchDir, 'compare-horde-orc-joe.json'), 'utf8'));
	assert.equal(doc.pack, 'joe');
	const ours = doc.rows.find((x) => x.id === 'polestar');
	const pack = doc.rows.find((x) => x.id === 'pack');
	assert.ok(ours, 'our row is there');
	assert.ok(pack, 'the pack row is there');
	assert.equal(pack.label, 'joe default');
	assert.deepEqual(pack.guides, ['forever/horde/orc/01-start', 'joe/field'], 'the pack chain begins with our starting zone');
	assert.ok(pack.quests > ours.quests, 'the pack chain adds its own quests');
	assert.match(out, /joe default/);
	assert.match(out, /wrote .*compare-horde-orc-joe\.json/);
	// Without the pack, ours is written to its usual file.
	const plain = await quiet(() => compareCommand({ faction: 'Horde', race: 'Orc', guides: f.ours }, o));
	assert.equal(plain.result, 0, plain.out);
	assert.ok(fs.existsSync(path.join(f.benchDir, 'compare-horde-orc.json')));
	assert.equal(JSON.parse(fs.readFileSync(path.join(f.benchDir, 'compare-horde-orc.json'), 'utf8')).rows.some((x) => x.source === 'pack'), false);
});

test('sim compare refuses a --guides folder that does not exist (it would score nothing of ours)', async () => {
	const f = fixture();
	const o = { dataDir: f.dataDir, simDir: f.simDir, sourcesDir: f.sourcesDir, benchDir: f.benchDir, offline: true, extraStarts: syn.START, log: () => {} };
	const { result, out } = await quiet(() => compareCommand({ faction: 'Horde', race: 'Orc', guides: path.join(f.ours, 'typo'), pack: f.pack }, o));
	assert.equal(result, 2, out);
	assert.match(out, /sim compare: --guides .*typo is not a folder/);
	assert.equal(fs.existsSync(f.benchDir), false);
});
