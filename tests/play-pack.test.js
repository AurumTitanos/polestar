'use strict';
// The playground with another guide pack: the pack is built into a
// temp folder and loaded after our guides, so its guides are registered.
// Needs data/forever and Lua (the playground does); skips without them.

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { ROOT } = require('./helpers/lua');
const { DATA_DIR, quiet, tmpdir } = require('./fixtures/dsl/helpers');
const { resolvePack } = require('../tools/lib/pack/locate');

const skip = !fs.existsSync(path.join(ROOT, 'data', 'forever', 'races.json')) ? 'reference data not built' : false;
const PACKS = path.join(__dirname, 'fixtures', 'packs');

// This process's playground program files in the temp folder (Session names them polestar-play-<pid>-<n>.lua).
const programFiles = () => fs.readdirSync(os.tmpdir()).filter((f) => f.startsWith(`polestar-play-${process.pid}-`) && f.endsWith('.lua'));

test('play loads a pack after ours: its guides are registered beside ours', { skip, timeout: 120000 }, async () => {
	const { buildPlayPack } = require('../tools/commands/play');
	const { startServer } = require('../tools/play/server');
	const pack = { ...resolvePack({ pack: path.join(PACKS, 'mini') }), contextDir: path.join(PACKS, 'context'), contextDataDir: DATA_DIR };
	const { result } = await quiet(() => buildPlayPack(pack, { dataDir: DATA_DIR }));
	assert.ok(result.dir, 'the pack builds');
	assert.equal(path.basename(result.dir), 'PolestarPack_MiniPack');
	let play = null;
	try {
		play = await startServer({ port: 0, dataDir: tmpdir(), artDir: null, packs: [result.dir] });
		assert.notEqual(play.port, 8077);
		const ask = async () => {
			const r = await play.session.call('local G = Polestar.Guides; local a, b = G.Get("mini/a"), G.Get("mini/b"); return { a = a and a.title, b = b and b.title, next = a and a.next, ours = #G.List() }');
			assert.ok(r.ok, r.error);
			return r.value;
		};
		let v = await ask();
		assert.equal(v.a, 'Mini A');
		assert.equal(v.b, 'Mini B');
		assert.equal(v.next, 'mini/b');
		assert.ok(v.ours > 2, 'our guides are still there');
		// A reload (what `dev` does after a rebuild) loads the folder again.
		const guides = path.join(result.dir, 'Guides.lua');
		fs.writeFileSync(guides, fs.readFileSync(guides, 'utf8').replace('"Mini A"', '"Mini A2"'));
		await play.reload();
		v = await ask();
		assert.equal(v.a, 'Mini A2');
		assert.equal(programFiles().length, 1, 'a reload replaces the Lua program file');
	} finally {
		if (play) await play.close({ save: false });
	}
	assert.deepEqual(programFiles(), [], 'closing removes it');
});

test('play takes one pack folder: two, a folder and --pack, or one without pack.json are a usage error', async () => {
	const play = require('../tools/commands/play');
	const mini = path.join(PACKS, 'mini');
	const two = await quiet(() => play.run([mini, path.join(PACKS, 'joe')]));
	assert.equal(two.result, 2);
	assert.match(two.out, /one pack folder only, got 2/);
	const both = await quiet(() => play.run([mini, '--pack', mini]));
	assert.equal(both.result, 2);
	assert.match(both.out, /the pack folder is named twice/);
	const none = await quiet(() => play.run([tmpdir()]));
	assert.equal(none.result, 2);
	assert.match(none.out, /no pack\.json in /);
});

test('play refuses a pack with lint errors', async () => {
	const { buildPlayPack } = require('../tools/commands/play');
	const pack = resolvePack({ pack: path.join(PACKS, 'format') });
	const { result, out } = await quiet(() => buildPlayPack({ ...pack, contextDir: path.join(PACKS, 'context'), contextDataDir: DATA_DIR }, { dataDir: DATA_DIR }));
	assert.equal(result.dir, undefined);
	assert.equal(result.built.ok, false);
	assert.match(out, /error/);
});
