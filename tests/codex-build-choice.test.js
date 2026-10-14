'use strict';
// Which Forever client build `codex build` reads (pickForeverBuild, through
// tools/lib/data/wago.js pickBuild as `data build` --forever-build): the newest
// 1.60+ build wago.tools lists, --build over it, and offline (or wago.tools
// down) the newest cached build holding every table the Codex reads.

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { pickForeverBuild, TABLES } = require('../tools/lib/codex/build');
const { pickBuild, BUILDS_URL } = require('../tools/lib/data/wago');
const { tmpdir } = require('./helpers/tmp');

const listing = { wow_classic_beta: [{ version: '5.5.1.62000' }, { version: '1.60.1.70338' }, { version: '1.60.1.70374' }, { version: '1.60.0.69000' }], wow_classic_era: [{ version: '1.15.9.70003' }] };

function builds(calls, { down = false } = {}) {
	return async (url) => {
		calls.push(url);
		if (down) throw new Error('getaddrinfo ENOTFOUND wago.tools');
		return { ok: true, status: 200, text: async () => JSON.stringify(listing) };
	};
}

// A cache: 1.60.1.70338 with every Codex table, 1.60.1.70374 with the map
// tables only (what `data build` fetches), an Era build with everything.
function cache() {
	const sourcesDir = tmpdir('polestar-codex-build-');
	const put = (build, tables) => {
		const dir = path.join(sourcesDir, 'wago', build);
		fs.mkdirSync(dir, { recursive: true });
		for (const t of tables) fs.writeFileSync(path.join(dir, `${t}.csv`), 'ID\n1\n');
	};
	put('1.60.1.70338', TABLES);
	put('1.60.1.70374', ['UiMap', 'UiMapAssignment', 'AreaTable', 'Map']);
	put('1.15.9.99999', TABLES);
	return sourcesDir;
}

test('codex build reads the newest Forever build wago.tools lists (1.60+, not 5.5)', async () => {
	const calls = [];
	assert.deepEqual(await pickForeverBuild({ sourcesDir: cache(), fetchImpl: builds(calls) }), { build: '1.60.1.70374', warnings: [] });
	assert.deepEqual(calls, [BUILDS_URL]);
});

test('--build overrides the listing and fetches nothing', async () => {
	const calls = [];
	assert.deepEqual(await pickForeverBuild({ sourcesDir: cache(), build: '1.60.0.69000', fetchImpl: builds(calls) }), { build: '1.60.0.69000', warnings: [] });
	assert.deepEqual(calls, []);
});

test('offline, or with wago.tools down, the newest cached Forever build holding every Codex table', async () => {
	const sourcesDir = cache();
	const calls = [];
	assert.deepEqual(await pickForeverBuild({ sourcesDir, offline: true, fetchImpl: builds(calls) }), { build: '1.60.1.70338', warnings: [] });
	assert.deepEqual(calls, []);
	const down = await pickForeverBuild({ sourcesDir, fetchImpl: builds(calls, { down: true }) });
	assert.equal(down.build, '1.60.1.70338');
	assert.match(down.warnings[0], /ENOTFOUND wago\.tools; using cached wow_classic_beta build 1\.60\.1\.70338/);
	// data build's map tables alone are in the newer one.
	assert.equal((await pickBuild({ sourcesDir, offline: true, product: 'forever' })).build, '1.60.1.70374');
	await assert.rejects(pickForeverBuild({ sourcesDir: tmpdir('polestar-codex-build-'), offline: true }), /--offline: no cached wago\.tools build/);
});
