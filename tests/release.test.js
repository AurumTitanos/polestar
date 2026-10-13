'use strict';
// Releases: the version command, and the shipped addons loading together the
// way the client loads them. Pointed at an unpacked release zip
// (POLESTAR_ADDON_DIR=<AddOns folder>), the load test is the release smoke test
// (docs/RELEASING.md).

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { runAddon, ADDONS } = require('./helpers/lua');
const { quiet, fakeAddons } = require('./helpers/cli');
const { tmpdir } = require('./helpers/tmp');
const version = require('../tools/commands/version');
const { releaseAddons, packageVersion, ROOT } = require('../tools/lib/dsl/project');

function fakeRoot(pkgVersion = '0.1.0') {
	const root = tmpdir();
	fs.writeFileSync(path.join(root, 'package.json'), `{\n  "name": "polestar",\n  "version": "${pkgVersion}",\n  "private": true\n}\n`);
	fakeAddons(path.join(root, 'addon'), ['Polestar', 'Polestar_Guides', 'Polestar_Recorder'], pkgVersion);
	fs.mkdirSync(path.join(root, 'guides'));
	fs.writeFileSync(path.join(root, 'guides', 'pack.json'), `{\n\t"id": "guides",\n\t"title": "Polestar Guides",\n\t"version": "${pkgVersion}",\n\t"folder": "Polestar_Guides"\n}\n`);
	return root;
}

const toc = (root, n) => fs.readFileSync(path.join(root, 'addon', n, `${n}.toc`), 'utf8');
const manifest = (root) => fs.readFileSync(path.join(root, 'guides', 'pack.json'), 'utf8');

test('version sets package.json, guides/pack.json and every addon TOC, leaving the rest of each file as it was', async () => {
	const root = fakeRoot();
	const before = { pkg: fs.readFileSync(path.join(root, 'package.json'), 'utf8'), man: manifest(root), toc: toc(root, 'Polestar') };
	const { result, out } = await quiet(() => version.run(['0.2.0-beta.1', '--root', root]));
	assert.equal(result, 0, out);
	assert.match(out, /version 0\.2\.0-beta\.1: package\.json, guides\/pack\.json and 3 addon TOCs/);
	assert.equal(fs.readFileSync(path.join(root, 'package.json'), 'utf8'), before.pkg.replace('"0.1.0"', '"0.2.0-beta.1"'));
	assert.equal(manifest(root), before.man.replace('"0.1.0"', '"0.2.0-beta.1"'));
	assert.equal(toc(root, 'Polestar'), before.toc.replace('## Version: 0.1.0', '## Version: 0.2.0-beta.1'));
	for (const n of ['Polestar_Guides', 'Polestar_Recorder']) assert.match(toc(root, n), /^## Version: 0\.2\.0-beta\.1$/m);
	const shown = await quiet(() => version.run(['--root', root]));
	assert.equal(shown.result, 0, shown.out);
	assert.match(shown.out, /^0\.2\.0-beta\.1$/m);
});

test('version without an argument names a TOC that disagrees; a bad version or a TOC without the line changes nothing', async () => {
	const root = fakeRoot();
	const recorder = path.join(root, 'addon', 'Polestar_Recorder', 'Polestar_Recorder.toc');
	fs.writeFileSync(recorder, toc(root, 'Polestar_Recorder').replace('0.1.0', '0.0.9'));
	const shown = await quiet(() => version.run(['--root', root]));
	assert.equal(shown.result, 1);
	assert.match(shown.out, /Polestar_Recorder\.toc: version 0\.0\.9/);
	assert.equal((await quiet(() => version.run(['1.0', '--root', root]))).result, 2);
	fs.writeFileSync(recorder, '## Interface: 16001\n\nMain.lua\n');
	const refused = await quiet(() => version.run(['1.0.0', '--root', root]));
	assert.equal(refused.result, 1);
	assert.match(refused.out, /Polestar_Recorder\.toc: no ## Version line/);
	assert.match(fs.readFileSync(path.join(root, 'package.json'), 'utf8'), /"version": "0\.1\.0"/);
	assert.match(toc(root, 'Polestar'), /^## Version: 0\.1\.0$/m);
});

test('version names a guides/pack.json that disagrees, and refuses one without a version, changing nothing', async () => {
	const root = fakeRoot();
	const file = path.join(root, 'guides', 'pack.json');
	fs.writeFileSync(file, manifest(root).replace('"0.1.0"', '"0.0.9"'));
	const shown = await quiet(() => version.run(['--root', root]));
	assert.equal(shown.result, 1);
	assert.match(shown.out, /guides[\\/]pack\.json: version 0\.0\.9/);
	fs.writeFileSync(file, '{\n\t"id": "guides"\n}\n');
	const refused = await quiet(() => version.run(['1.0.0', '--root', root]));
	assert.equal(refused.result, 1);
	assert.match(refused.out, /guides[\\/]pack\.json: no "version" field/);
	assert.match(fs.readFileSync(path.join(root, 'package.json'), 'utf8'), /"version": "0\.1\.0"/);
	assert.match(toc(root, 'Polestar'), /^## Version: 0\.1\.0$/m);
});

test('every addon TOC carries the package.json version', () => {
	const wrong = fs
		.readdirSync(ADDONS, { withFileTypes: true })
		.filter((d) => d.isDirectory() && fs.existsSync(path.join(ADDONS, d.name, `${d.name}.toc`)))
		.map((d) => [d.name, /^## Version:\s*(\S+)/m.exec(fs.readFileSync(path.join(ADDONS, d.name, `${d.name}.toc`), 'utf8'))?.[1]])
		.filter(([, v]) => v !== packageVersion());
	assert.deepEqual(wrong, []);
});

test("our guides' pack.json carries the package.json version (compile writes it into Polestar_Guides.toc)", () => {
	assert.equal(JSON.parse(fs.readFileSync(path.join(ROOT, 'guides', 'pack.json'), 'utf8')).version, packageVersion());
});

test('the release addons load together, log in, and find their guides and data', () => {
	const product = releaseAddons(ADDONS);
	const recorder = fs.existsSync(path.join(ADDONS, 'Polestar_Recorder', 'Polestar_Recorder.toc'));
	const [got] = runAddon({
		stubs: ['stub_world.lua'],
		addons: [...product.names, ...(recorder ? ['Polestar_Recorder'] : [])],
		login: true,
		script: `
			stub.advance(0.5)
			local g = Polestar.Engine.GetGuide()
			emit({
				guides = #Polestar.Guides.List(),
				open = g and g.id or false,
				questDB = Polestar.QuestDB.IsLoaded(),
				itemDB = Polestar.ItemDB.IsLoaded(),
				recorder = type(PolestarRecorderDB) == "table",
			})`,
	}).emitted;
	assert.ok(got.guides > 0, 'the guide pack registered its guides');
	assert.ok(got.open, 'a guide opened at login');
	assert.equal(got.questDB, product.names.includes('Polestar_QuestDB'));
	assert.equal(got.itemDB, product.names.includes('Polestar_ItemDB'));
	assert.equal(got.recorder, recorder);
});
