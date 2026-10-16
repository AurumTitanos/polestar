'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { buildIndex, renderLua } = require('../tools/build-live-terrain');

function fixture(t) {
	const root = fs.mkdtempSync(path.join(os.tmpdir(), 'polestar-live-index-'));
	t.after(() => fs.rmSync(root, { recursive: true, force: true }));
	const build = '1.60.1.70425', product = 'wow_classic_beta';
	const index = { schema: 1, build, product, continents: { 0: {
		levels: [[[30, 31]]], bounds: { minCol: 30, maxCol: 30, minRow: 31, maxRow: 31 }, sea: [8, 16, 24],
	} } };
	const indexPath = path.join(root, 'index.json');
	const sourcesDir = path.join(root, 'sources');
	const csvDir = path.join(sourcesDir, 'wago', build);
	const cascDir = path.join(sourcesDir, 'casc', product, build);
	fs.mkdirSync(csvDir, { recursive: true }); fs.mkdirSync(cascDir, { recursive: true });
	fs.writeFileSync(path.join(csvDir, 'Map.csv'), 'ID,MapName_lang,WdtFileDataID\n0,Sample continent,10001\n');
	const wdt = Buffer.alloc(8 + 64 * 64 * 32);
	wdt.write('DIAM'); wdt.writeUInt32LE(wdt.length - 8, 4);
	wdt.writeUInt32LE(20001, 8 + (31 * 64 + 30) * 32 + 28);
	fs.writeFileSync(path.join(cascDir, '10001.blp'), wdt);
	const save = () => fs.writeFileSync(indexPath, JSON.stringify(index));
	save();
	return { index, save, options: { indexPath, sourcesDir } };
}

test('terrain generation verifies offline Planner coordinates and exports IDs without artwork', (t) => {
	const f = fixture(t);
	const data = buildIndex(f.options), lua = renderLua(data);
	assert.deepEqual(data.continents[0].tiles, [{ col: 30, row: 31, fdid: 20001 }]);
	assert.match(lua, /build = "1\.60\.1\.70425"/);
	assert.match(lua, /\{ 30, 31, 20001 \}/);
	assert.doesNotMatch(lua, /data:image|https?:|\.blp/);
	assert.equal(renderLua(buildIndex(f.options)), lua, 'the same cache generates byte-identical Lua');
});

test('terrain generation rejects stale tile coordinates and bounds instead of a misaligned map', (t) => {
	const f = fixture(t);
	f.index.continents[0].levels[0][0][0] = 29; f.save();
	assert.throws(() => buildIndex(f.options), /WDT tiles differ/);
	f.index.continents[0].levels[0][0][0] = 30;
	f.index.continents[0].bounds.minRow = 30; f.save();
	assert.throws(() => buildIndex(f.options), /minRow differs/);
});

test('terrain generation rejects unsupported schemas, unsafe products and invalid color bytes', (t) => {
	const f = fixture(t);
	f.index.schema = 2; f.save(); assert.throws(() => buildIndex(f.options), /Unsupported Planner art schema/);
	f.index.schema = 1; f.index.product = '../other'; f.save();
	assert.throws(() => buildIndex(f.options), /Invalid Planner product/);
	f.index.product = 'wow_classic_beta'; f.index.continents[0].sea[1] = 256; f.save();
	assert.throws(() => buildIndex(f.options), /Sea RGB byte/);
});
