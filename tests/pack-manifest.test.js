'use strict';
// pack.json: reading and validating a guide pack's manifest.

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { tmpdir } = require('./helpers/tmp');
const { readManifest, validateManifest } = require('../tools/lib/pack/manifest');
const { ownsGuideId } = require('../tools/lib/pack/format');

const GOOD = { id: 'joe', title: "Joe's Routes", author: 'Joe', version: '1.2.0', license: 'CC-BY-4.0' };

function check(obj, opts) {
	return validateManifest(obj, 'pack.json', opts);
}

// Exactly one diag of `severity` whose message contains `text`; errors carry a hint.
function one(diags, severity, text) {
	assert.equal(diags.length, 1, JSON.stringify(diags));
	const [d] = diags;
	assert.equal(d.severity, severity);
	assert.ok(d.message.includes(text), `${d.message} should mention ${text}`);
	assert.equal(d.file, 'pack.json');
	assert.ok(Number.isInteger(d.line) && d.line >= 1);
	if (severity === 'error') assert.ok(typeof d.hint === 'string' && d.hint.length > 0, 'errors carry a hint');
	return d;
}

function writePack(content) {
	const dir = tmpdir('polestar-manifest-');
	fs.writeFileSync(path.join(dir, 'pack.json'), content);
	return dir;
}

test('a complete manifest has no diagnostics and a default folder from its title', () => {
	assert.deepEqual(check(GOOD), []);
	const { manifest, diags } = readManifest(writePack(JSON.stringify(GOOD, null, '\t')));
	assert.deepEqual(diags, []);
	assert.equal(manifest.folder, 'PolestarPack_JoesRoutes');
	assert.equal(manifest.id, 'joe');
	assert.equal(manifest.license, 'CC-BY-4.0');
});

test('a title without letters or digits takes the folder from the id', () => {
	const { manifest, diags } = readManifest(writePack(JSON.stringify({ ...GOOD, id: 'joe-routes', title: '!!!' })));
	assert.deepEqual(diags, []);
	assert.equal(manifest.folder, 'PolestarPack_JoeRoutes');
});

test('each required field missing is one error naming it', () => {
	for (const key of ['id', 'title', 'author', 'version', 'license']) {
		const obj = { ...GOOD };
		delete obj[key];
		one(check(obj), 'error', key);
	}
});

test('malformed and reserved pack ids are errors; ours may use guides', () => {
	for (const id of ['Joe', 'j', 'a'.repeat(33), '-x']) one(check({ ...GOOD, id }), 'error', 'id');
	for (const id of ['guides', 'forever', 'lookup', 'draft', 'polestar']) one(check({ ...GOOD, id }), 'error', 'reserved');
	assert.deepEqual(check({ ...GOOD, id: 'guides' }, { official: true }), []);
});

test('folder names must be plain and may not look like our addons', () => {
	for (const folder of ['../evil', 'a/b', 'Polestar', 'Polestar_Guides', 'Polestar_Anything']) one(check({ ...GOOD, folder }), 'error', 'folder');
	assert.deepEqual(check({ ...GOOD, id: 'guides', folder: 'Polestar_Guides' }, { official: true }), []);
	assert.deepEqual(check({ ...GOOD, folder: 'MyPack-1' }), []);
	const { manifest } = readManifest(writePack(JSON.stringify({ ...GOOD, folder: 'MyPack-1' })));
	assert.equal(manifest.folder, 'MyPack-1');
});

test('control characters are refused in every string field', () => {
	one(check({ ...GOOD, title: 'Joe\n## Dependencies: X' }), 'error', 'control characters');
	for (const key of ['title', 'author', 'license', 'website', 'source', 'notes']) {
		for (const ch of ['\u0007', '\u007f']) {
			const value = key === 'website' ? `https://example.org/${ch}` : `Joe${ch}`;
			one(check({ ...GOOD, [key]: value }), 'error', 'control characters');
		}
	}
});

test('versions are one plain token', () => {
	one(check({ ...GOOD, version: '1 2' }), 'error', 'version');
	assert.deepEqual(check({ ...GOOD, version: '2.0.0-beta+3' }), []);
});

test('websites are http(s) links of at most 200 characters', () => {
	one(check({ ...GOOD, website: 'javascript:alert(1)' }), 'error', 'website');
	one(check({ ...GOOD, website: `https://example.org/${'a'.repeat(200)}` }), 'error', 'website');
	assert.deepEqual(check({ ...GOOD, website: 'http://example.org' }), []);
	assert.deepEqual(check({ ...GOOD, website: 'https://example.org/joe' }), []);
});

test('field lengths are bounded', () => {
	for (const key of ['title', 'author', 'license']) {
		one(check({ ...GOOD, [key]: 'x'.repeat(65) }), 'error', key);
		assert.deepEqual(check({ ...GOOD, [key]: 'x'.repeat(64) }), []);
	}
	for (const key of ['source', 'notes']) {
		one(check({ ...GOOD, [key]: 'x'.repeat(201) }), 'error', key);
		assert.deepEqual(check({ ...GOOD, [key]: 'x'.repeat(200) }), []);
	}
});

test('an unknown key is a warning', () => {
	one(check({ ...GOOD, colour: 'red' }), 'warning', 'unknown key');
});

test('a | in the title warns that it prints literally', () => {
	one(check({ ...GOOD, title: 'Joe|cffff0000' }), 'warning', 'prints literally in game');
});

test('invalid JSON is one error naming the file', () => {
	const dir = writePack('{ "id": }');
	const { manifest, diags } = readManifest(dir);
	assert.equal(manifest, null);
	assert.equal(diags.length, 1);
	assert.equal(diags[0].severity, 'error');
	assert.ok(`${diags[0].file} ${diags[0].message}`.includes('pack.json'));
	assert.ok(diags[0].hint);
});

test('diagnostics point at the line of the key in pack.json', () => {
	const dir = writePack('{\n\t"id": "joe",\n\t"title": "Joe",\n\t"author": "Joe",\n\t"version": "1 2",\n\t"license": "MIT"\n}\n');
	const { diags } = readManifest(dir);
	assert.equal(diags.length, 1);
	assert.equal(diags[0].line, 5);
	assert.ok(diags[0].file.endsWith('pack.json'));
});

test('our pack owns forever/ and draft/; every other pack owns its id with the slash', () => {
	assert.equal(ownsGuideId('guides', 'forever/horde/02-the-barrens'), true);
	assert.equal(ownsGuideId('guides', 'draft/x'), true);
	assert.equal(ownsGuideId('guides', 'guides/x'), false);
	assert.equal(ownsGuideId('joe', 'joe/a'), true);
	assert.equal(ownsGuideId('joe', 'joes/a'), false);
	assert.equal(ownsGuideId('joe', 'joe'), false);
	assert.equal(ownsGuideId('joe', 'forever/a'), false);
});
