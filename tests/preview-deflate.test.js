'use strict';
// The preview's own zlib encoder (tools/preview/deflate.js), which keeps the
// committed renders byte-identical on any Node: whatever it is given, zlib
// inflates it back to the same bytes, and the same input gives the same
// output.

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const zlib = require('node:zlib');
const { deflate } = require('../tools/preview/deflate');

// Bytes from a fixed linear congruential sequence: incompressible but repeatable.
function noise(n, seed = 7) {
	const b = Buffer.alloc(n);
	let x = seed;
	for (let i = 0; i < n; i++) {
		x = (x * 1103515245 + 12345) >>> 0;
		b[i] = x >>> 24;
	}
	return b;
}

const CASES = {
	empty: Buffer.alloc(0),
	'one byte': Buffer.from([42]),
	'two bytes': Buffer.from([1, 2]),
	'a long run': Buffer.alloc(100000, 0),
	'a repeated phrase': Buffer.from('Kobold Camp Cleanup, '.repeat(3000)),
	noise: noise(70000),
	'runs and noise': Buffer.concat([Buffer.alloc(5000, 9), noise(3000), Buffer.alloc(40000, 9), noise(3000, 11)]),
	'a texture': fs.readFileSync(path.join(__dirname, '..', 'addon', 'Polestar', 'Media', 'UI', 'logo.tga')),
};

for (const [name, data] of Object.entries(CASES)) {
	test(`deflate: ${name} inflates back to the same bytes`, () => {
		const out = deflate(data);
		assert.deepEqual(zlib.inflateSync(out), data);
		assert.deepEqual(deflate(data), out, 'the same input gives the same bytes');
	});
}

test('deflate: compresses what repeats', () => {
	assert.ok(deflate(CASES['a long run']).length < 400);
	assert.ok(deflate(CASES['a repeated phrase']).length < 600);
});
