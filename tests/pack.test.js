'use strict';
// pack (the release zips) and tools/lib/zip.js.

const { test } = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { GUIDES_DIR, DATA_DIR, tmpdir, quiet, fakeAddons } = require('./fixtures/dsl/helpers');
const pack = require('../tools/commands/pack');
const { buildZip, writeZip, readZip, directoryEntries, crc32 } = require('../tools/lib/zip');
const { packageVersion, ROOT } = require('../tools/lib/dsl/project');

const VERSION = packageVersion();

function python(...args) {
	return spawnSync('python3', ['-m', 'zipfile', ...args], { encoding: 'utf8' });
}

const hasPython = spawnSync('python3', ['--version']).status === 0;

test('pack zips Polestar + Polestar_Guides and the recorder separately, reproducibly', { skip: !hasPython && 'python3 not installed' }, async () => {
	const addons = fakeAddons(tmpdir());
	const zips = [];
	for (const n of [1, 2]) {
		const dist = tmpdir();
		const { result, out } = await quiet(() => pack.run(['--guides', GUIDES_DIR, '--data', DATA_DIR, '--addons', addons, '--dist', dist]));
		assert.equal(result, 0, out);
		assert.deepEqual(fs.readdirSync(dist).sort(), [`Polestar-${VERSION}.zip`, `Polestar_Recorder-${VERSION}.zip`, 'SHA256SUMS']);
		zips.push(dist);
	}
	for (const f of [`Polestar-${VERSION}.zip`, `Polestar_Recorder-${VERSION}.zip`, 'SHA256SUMS']) {
		assert.ok(fs.readFileSync(path.join(zips[0], f)).equals(fs.readFileSync(path.join(zips[1], f))), `${f} differs between runs`);
	}
	const list = python('-l', path.join(zips[0], `Polestar-${VERSION}.zip`));
	assert.equal(list.status, 0, list.stderr);
	const names = list.stdout
		.split('\n')
		.slice(1)
		.map((l) => l.split(/\s+\d{4}-\d\d-\d\d /)[0].trim())
		.filter(Boolean);
	assert.deepEqual(names, [
		'Polestar/',
		'Polestar/LICENSE',
		'Polestar/README.txt',
		'Polestar/Main.lua',
		'Polestar/Polestar.toc',
		'Polestar_Guides/',
		'Polestar_Guides/Guides/',
		'Polestar_Guides/Guides/forever/',
		'Polestar_Guides/Guides/forever/alliance/',
		'Polestar_Guides/Guides/forever/alliance/human/',
		'Polestar_Guides/Guides/forever/alliance/human/01-northshire.lua',
		'Polestar_Guides/Guides/forever/alliance/human/02-elwynn.lua',
		'Polestar_Guides/LICENSE-DATA.txt',
		'Polestar_Guides/MapFrames.lua',
		'Polestar_Guides/Pack.lua',
		'Polestar_Guides/Pack.xml',
		'Polestar_Guides/Polestar_Guides.toc',
	]);
	assert.equal(python('-t', path.join(zips[0], `Polestar-${VERSION}.zip`)).status, 0);
	const rec = python('-l', path.join(zips[0], `Polestar_Recorder-${VERSION}.zip`));
	assert.match(rec.stdout, /Polestar_Recorder\/Polestar_Recorder\.toc/);
	assert.match(rec.stdout, /Polestar_Recorder\/LICENSE /);
	assert.doesNotMatch(rec.stdout + list.stdout, /\.hidden/);
});

test('the Polestar folder in the zip carries the GPL and install steps naming every folder shipped', async () => {
	const addons = fakeAddons(tmpdir(), ['Polestar', 'Polestar_Guides', 'Polestar_Recorder', 'Polestar_QuestDB', 'Polestar_ItemDB']);
	const dist = tmpdir();
	const { result, out } = await quiet(() => pack.run(['--guides', GUIDES_DIR, '--data', DATA_DIR, '--addons', addons, '--dist', dist]));
	assert.equal(result, 0, out);
	const files = Object.fromEntries(readZip(path.join(dist, `Polestar-${VERSION}.zip`)).map((e) => [e.name, e.data]));
	assert.ok(files['Polestar/LICENSE'].equals(fs.readFileSync(path.join(ROOT, 'LICENSE'))));
	const readme = files['Polestar/README.txt'].toString('utf8');
	assert.match(readme, new RegExp(`^Polestar ${VERSION.replace(/\./g, '\\.')}\r\n`));
	assert.match(readme, /_forever_\/Interface\/AddOns\//);
	assert.match(readme, /\/reload does not/);
	for (const n of ['Polestar', 'Polestar_Guides', 'Polestar_QuestDB', 'Polestar_ItemDB']) assert.match(readme, new RegExp(`^ +${n}\r$`, 'm'));
	assert.doesNotMatch(readme, /^ +Polestar_Recorder\r$/m);
	assert.doesNotMatch(readme.replace(/\r\n/g, ''), /\n/, 'CRLF line endings throughout');
});

test('pack writes SHA256SUMS for the zips it wrote, in the format sha256sum -c reads', async () => {
	const dist = tmpdir();
	const { result, out } = await quiet(() => pack.run(['--guides', GUIDES_DIR, '--data', DATA_DIR, '--addons', fakeAddons(tmpdir()), '--dist', dist]));
	assert.equal(result, 0, out);
	const sum = (f) => crypto.createHash('sha256').update(fs.readFileSync(path.join(dist, f))).digest('hex');
	assert.equal(
		fs.readFileSync(path.join(dist, 'SHA256SUMS'), 'utf8'),
		[`Polestar-${VERSION}.zip`, `Polestar_Recorder-${VERSION}.zip`].map((f) => `${sum(f)}  ${f}\n`).join(''),
	);
});

test('the release zip includes the built data addons and leaves out ones not built', async () => {
	const addons = fakeAddons(tmpdir(), ['Polestar', 'Polestar_Guides', 'Polestar_Recorder', 'Polestar_QuestDB']);
	const dist = tmpdir();
	const { result, out } = await quiet(() => pack.run(['--guides', GUIDES_DIR, '--data', DATA_DIR, '--addons', addons, '--dist', dist]));
	assert.equal(result, 0, out);
	assert.match(out, /note: Polestar_ItemDB not built/);
	const tops = [...new Set(readZip(path.join(dist, `Polestar-${VERSION}.zip`)).map((e) => e.name.split('/')[0]))];
	assert.deepEqual(tops, ['Polestar', 'Polestar_Guides', 'Polestar_QuestDB']);
	fakeAddons(addons, ['Polestar_ItemDB']);
	assert.equal((await quiet(() => pack.run(['--guides', GUIDES_DIR, '--data', DATA_DIR, '--addons', addons, '--dist', dist]))).result, 0);
	const all = [...new Set(readZip(path.join(dist, `Polestar-${VERSION}.zip`)).map((e) => e.name.split('/')[0]))];
	assert.deepEqual(all, ['Polestar', 'Polestar_Guides', 'Polestar_QuestDB', 'Polestar_ItemDB']);
});

test('zip: UTF-8 names, empty and binary files, stored and deflated entries round-trip and pass python checks', { skip: !hasPython && 'python3 not installed' }, () => {
	const bin = Buffer.alloc(4096);
	for (let i = 0; i < bin.length; i++) bin[i] = (i * 2654435761) >>> 24;
	const entries = [
		{ name: 'Dir/' },
		{ name: 'Dir/empty.txt', data: '' },
		{ name: 'Dir/Ünïcödé ✓.lua', data: 'print("hi")\n'.repeat(50) },
		{ name: 'Dir/random.bin', data: bin },
		{ name: 'Dir/one.txt', data: 'x' },
	];
	const file = path.join(tmpdir(), 'test.zip');
	writeZip(file, entries);
	assert.ok(buildZip(entries).equals(fs.readFileSync(file)), 'deterministic');
	const back = readZip(file);
	assert.deepEqual(
		back.map((e) => [e.name, e.dir, e.data.toString('base64')]),
		entries.map((e) => [e.name, e.name.endsWith('/'), Buffer.from(e.data || '').toString('base64')]),
	);
	const list = python('-l', file);
	assert.equal(list.status, 0, list.stderr);
	assert.match(list.stdout, /Dir\/Ünïcödé ✓\.lua/);
	assert.equal(python('-t', file).status, 0);
	// Python can extract what we wrote, byte for byte.
	const out = tmpdir();
	assert.equal(python('-e', file, out).status, 0);
	assert.ok(fs.readFileSync(path.join(out, 'Dir', 'random.bin')).equals(bin));
	assert.equal(crc32(Buffer.from('123456789')), 0xcbf43926);
});

test('zip: directoryEntries stores trees under their basename, sorted, without hidden files', () => {
	const root = fakeAddons(tmpdir(), ['Polestar']);
	assert.deepEqual(
		directoryEntries([path.join(root, 'Polestar')]).map((e) => e.name),
		['Polestar/', 'Polestar/Main.lua', 'Polestar/Polestar.toc'],
	);
});

test('zip: an entry that inflates past its declared size, or an archive past the cap, is refused', () => {
	const bomb = Buffer.from(buildZip([{ name: 'Polestar_Guides/Guides/a.lua', data: Buffer.alloc(4 * 1024 * 1024, 45) }]));
	const cd = bomb.indexOf(Buffer.from([0x50, 0x4b, 0x01, 0x02]));
	bomb.writeUInt32LE(16, cd + 24);
	assert.throws(() => readZip(bomb), /corrupt entry/);
	assert.throws(() => readZip(buildZip([{ name: 'a', data: Buffer.alloc(4096) }]), { maxTotal: 1024 }), /exceed the 1024-byte limit/);
});
