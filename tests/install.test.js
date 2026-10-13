'use strict';
// install: destination choice (flag, env, Wine-prefix auto-detection by
// .flavor.info), dry runs, copies and symlinks that touch only Polestar folders.

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { tmpdir, quiet, fakeAddons } = require('./fixtures/dsl/helpers');
const install = require('../tools/commands/install');

function compiledAddons() {
	const root = fakeAddons(tmpdir());
	fs.writeFileSync(path.join(root, 'Polestar_Guides', 'Pack.xml'), '<Ui>\n\t<Script file="Guides\\a.lua"/>\n</Ui>\n');
	return root;
}

// An AddOns folder with someone else's addon and an old Polestar.
function liveAddOns() {
	const dir = tmpdir();
	fs.mkdirSync(path.join(dir, 'OtherAddon'));
	fs.writeFileSync(path.join(dir, 'OtherAddon', 'OtherAddon.toc'), 'other\n');
	fs.mkdirSync(path.join(dir, 'Polestar'));
	fs.writeFileSync(path.join(dir, 'Polestar', 'old-file.lua'), '-- from the previous version\n');
	fs.writeFileSync(path.join(dir, 'Polestar', 'Polestar.toc'), '## Version: 0.0.1\n');
	return dir;
}

function snapshot(dir) {
	const out = {};
	const walk = (d) => {
		for (const e of fs.readdirSync(d, { withFileTypes: true })) {
			const p = path.join(d, e.name);
			const rel = path.relative(dir, p);
			if (e.isSymbolicLink()) out[rel] = `-> ${fs.readlinkSync(p)}`;
			else if (e.isDirectory()) walk(p);
			else out[rel] = fs.readFileSync(p, 'utf8');
		}
	};
	walk(dir);
	return out;
}

function flavorClient(wowDir, name, flavor) {
	const dir = path.join(wowDir, name);
	fs.mkdirSync(path.join(dir, 'Interface', 'AddOns'), { recursive: true });
	if (flavor) fs.writeFileSync(path.join(dir, '.flavor.info'), `Product Flavor!STRING:0\n${flavor}\n`);
	return dir;
}

test('--dry-run reports the plan and changes nothing', async () => {
	const src = compiledAddons();
	const dest = liveAddOns();
	const before = snapshot(dest);
	const { result, out } = await quiet(() => install.run(['--dest', dest, '--addons', src, '--dry-run', '--recorder'], {}));
	assert.equal(result, 0, out);
	assert.match(out, /would replace Polestar \(copy from/);
	assert.match(out, /would add Polestar_Guides/);
	assert.match(out, /would add Polestar_Recorder/);
	assert.deepEqual(snapshot(dest), before);
});

test('the built data addons (Polestar_QuestDB, Polestar_ItemDB, Polestar_Codex) install by default; a missing one is skipped', async () => {
	const src = compiledAddons();
	fakeAddons(src, ['Polestar_QuestDB']);
	const dest = liveAddOns();
	const { result, out } = await quiet(() => install.run(['--dest', dest, '--addons', src], {}));
	assert.equal(result, 0, out);
	assert.match(out, /note: Polestar_ItemDB not built \(no Polestar_ItemDB\/Polestar_ItemDB\.toc\); skipping it/);
	assert.match(out, /note: Polestar_Codex not built \(no Polestar_Codex\/Polestar_Codex\.toc\); skipping it/);
	assert.deepEqual(fs.readdirSync(dest).sort(), ['OtherAddon', 'Polestar', 'Polestar_Guides', 'Polestar_QuestDB']);
	fakeAddons(src, ['Polestar_ItemDB', 'Polestar_Codex']);
	const dry = await quiet(() => install.run(['--dest', dest, '--addons', src, '--dry-run'], {}));
	assert.match(dry.out, /would replace Polestar_QuestDB[\s\S]*would add Polestar_ItemDB[\s\S]*would add Polestar_Codex/);
});

test('--dest copies only the Polestar folders, replacing old copies and leaving everything else alone', async () => {
	const src = compiledAddons();
	const dest = liveAddOns();
	const { result, out } = await quiet(() => install.run(['--dest', dest, '--addons', src], {}));
	assert.equal(result, 0, out);
	assert.deepEqual(fs.readdirSync(dest).sort(), ['OtherAddon', 'Polestar', 'Polestar_Guides']);
	const after = snapshot(dest);
	assert.equal(after['OtherAddon/OtherAddon.toc'], 'other\n');
	assert.equal(after['Polestar/old-file.lua'], undefined, 'old copy replaced, not merged');
	assert.equal(after['Polestar/Polestar.toc'], fs.readFileSync(path.join(src, 'Polestar', 'Polestar.toc'), 'utf8'));
	assert.equal(after['Polestar/.hidden'], undefined, 'hidden files are not installed');
	assert.ok(after['Polestar_Guides/Pack.xml']);
	assert.equal(fs.existsSync(path.join(dest, 'Polestar_Recorder')), false, 'recorder only on request');
});

test('--link symlinks the folders, and a later copy replaces the links without touching the sources', async () => {
	const src = compiledAddons();
	const dest = liveAddOns();
	assert.equal((await quiet(() => install.run(['--dest', dest, '--addons', src, '--link', '--recorder'], {}))).result, 0);
	for (const n of ['Polestar', 'Polestar_Guides', 'Polestar_Recorder']) {
		assert.ok(fs.lstatSync(path.join(dest, n)).isSymbolicLink(), n);
		assert.equal(fs.realpathSync(path.join(dest, n)), fs.realpathSync(path.join(src, n)));
	}
	assert.equal((await quiet(() => install.run(['--dest', dest, '--addons', src], {}))).result, 0);
	assert.ok(fs.lstatSync(path.join(dest, 'Polestar')).isDirectory());
	assert.ok(fs.existsSync(path.join(src, 'Polestar', 'Polestar.toc')), 'source survives replacing its link');
	assert.ok(fs.lstatSync(path.join(dest, 'Polestar_Recorder')).isSymbolicLink(), 'not reinstalled without --recorder');
});

test('$WOW_FOREVER_ADDONS is used when --dest is absent; --dest wins over it', async () => {
	const src = compiledAddons();
	const envDest = tmpdir();
	const flagDest = tmpdir();
	assert.equal((await quiet(() => install.run(['--addons', src], { WOW_FOREVER_ADDONS: envDest, HOME: tmpdir() }))).result, 0);
	assert.ok(fs.existsSync(path.join(envDest, 'Polestar', 'Polestar.toc')));
	assert.equal((await quiet(() => install.run(['--addons', src, '--dest', flagDest], { WOW_FOREVER_ADDONS: envDest }))).result, 0);
	assert.ok(fs.existsSync(path.join(flagDest, 'Polestar', 'Polestar.toc')));
	const missing = await quiet(() => install.run(['--addons', src, '--dest', path.join(flagDest, 'nope')], {}));
	assert.equal(missing.result, 1);
	assert.match(missing.out, /is not a folder/);
});

test('auto-detect finds the Forever client in Wine/Proton/Faugus prefixes by its .flavor.info', () => {
	const home = tmpdir();
	const wow = path.join(home, 'Games', 'drive_c', 'Program Files (x86)', 'World of Warcraft');
	const beta = flavorClient(wow, '_classic_beta_', 'wow_classic_beta');
	flavorClient(wow, '_classic_era_', 'wow_classic_era');
	flavorClient(wow, '_retail_', 'wow');
	flavorClient(wow, '_anniversary_', 'wow_anniversary');
	// A "_classic_beta_" without a flavor file is not trusted.
	flavorClient(path.join(home, '.wine', 'drive_c', 'Program Files (x86)', 'World of Warcraft'), '_classic_beta_', null);
	let found = install.detectAddonsDirs(home);
	assert.deepEqual(found.map((f) => [f.addons, f.kind]), [[path.join(beta, 'Interface', 'AddOns'), 'beta']]);
	assert.deepEqual(install.chooseDest({}, {}, home).dir, path.join(beta, 'Interface', 'AddOns'));

	// After launch: a _forever_ client in a Faugus prefix wins over the beta.
	const live = flavorClient(path.join(home, 'Faugus', 'battlenet', 'drive_c', 'Program Files (x86)', 'World of Warcraft'), '_forever_', 'wow_forever');
	found = install.detectAddonsDirs(home);
	assert.equal(found.length, 2);
	assert.deepEqual(install.chooseDest({}, {}, home).dir, path.join(live, 'Interface', 'AddOns'));

	// Proton prefixes keep drive_c under pfx/.
	const proton = flavorClient(path.join(home, '.local', 'share', 'Steam', 'steamapps', 'compatdata', '12345', 'pfx', 'drive_c', 'Program Files (x86)', 'World of Warcraft'), '_forever_', 'wow_forever');
	assert.ok(install.detectAddonsDirs(home).some((f) => f.client === proton));
	const two = install.chooseDest({}, {}, home);
	assert.match(two.error, /several Forever clients found/);
});

test('auto-detected installs create Interface/AddOns when the client has none yet', async () => {
	const home = tmpdir();
	const client = path.join(home, 'Games', 'drive_c', 'Program Files (x86)', 'World of Warcraft', '_classic_beta_');
	fs.mkdirSync(client, { recursive: true });
	fs.writeFileSync(path.join(client, '.flavor.info'), 'Product Flavor!STRING:0\nwow_classic_beta\n');
	const src = compiledAddons();
	const { result, out } = await quiet(() => install.run(['--addons', src], { HOME: home }));
	assert.equal(result, 0, out);
	assert.deepEqual(fs.readdirSync(path.join(client, 'Interface', 'AddOns')).sort(), ['Polestar', 'Polestar_Guides']);
	const none = await quiet(() => install.run(['--addons', src], { HOME: tmpdir() }));
	assert.equal(none.result, 1);
	assert.match(none.out, /no World of Warcraft: Forever client found/);
});

test('install refuses to replace its own source, install into the source, or replace a folder that is not that addon', async () => {
	const src = compiledAddons();
	const intoSource = await quiet(() => install.run(['--dest', src, '--addons', src], {}));
	assert.equal(intoSource.result, 1);
	assert.match(intoSource.out, /refusing to install: .*Polestar is \(or contains\) the source/);
	const nested = await quiet(() => install.run(['--dest', path.join(src, 'Polestar'), '--addons', src, '--link'], {}));
	assert.equal(nested.result, 1);
	assert.match(nested.out, /is inside the source/);
	// An AddOns folder symlinked to the source tree.
	const linked = path.join(tmpdir(), 'AddOns');
	fs.symlinkSync(src, linked, 'dir');
	assert.equal((await quiet(() => install.run(['--dest', linked, '--addons', src, '--link'], {}))).result, 1);
	// A same-named folder that is not that addon is left alone.
	const dest = tmpdir();
	fs.mkdirSync(path.join(dest, 'Polestar'));
	fs.writeFileSync(path.join(dest, 'Polestar', 'notes.txt'), 'mine\n');
	const foreign = await quiet(() => install.run(['--dest', dest, '--addons', src], {}));
	assert.equal(foreign.result, 1);
	assert.match(foreign.out, /has no Polestar\.toc; not an installed Polestar/);
	assert.equal(fs.readFileSync(path.join(dest, 'Polestar', 'notes.txt'), 'utf8'), 'mine\n');
	// Sources are untouched by all of the above.
	for (const n of ['Polestar', 'Polestar_Guides']) assert.ok(fs.existsSync(path.join(src, n, `${n}.toc`)), n);
});
