'use strict';
// Lookup's importers of other addons' data (tools/lib/consume/atlasloot.js,
// rarescanner.js): synthetic fixtures mimicking each addon's layout
// (tests/fixtures/codex/addons, made-up ids), then a sanity pass over the
// real installed addons when they are present.

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { readAtlasLoot } = require('../tools/lib/consume/atlasloot');
const { readRareScanner, coord, point } = require('../tools/lib/consume/rarescanner');
const { resolveAddonsDir } = require('../tools/lib/addons');
const { tmpdir } = require('./helpers/tmp');

const FIX = path.join(__dirname, 'fixtures', 'codex', 'addons');

let al;
const atlas = () => (al ||= readAtlasLoot(FIX));
const instance = (key) => atlas().instances.find((i) => i.key === key);
const boss = (key, name) => instance(key).bosses.find((b) => b.name === name);
const item = (b, id) => b.items.find((i) => i.item === id);
const allItems = () => atlas().instances.flatMap((i) => i.bosses.flatMap((b) => b.items.map((x) => x.item)));

// A tmp AddOns folder holding copies of the named fixture folders.
function partial(names, drop = []) {
	const dir = tmpdir('polestar-consume-test-');
	for (const n of names) fs.cpSync(path.join(FIX, n), path.join(dir, n), { recursive: true });
	for (const f of drop) fs.rmSync(path.join(dir, f));
	return dir;
}

test('AtlasLoot: meta names the source, version, licence and the files read', () => {
	const { meta } = atlas();
	assert.equal(meta.source, 'AtlasLootClassic');
	assert.equal(meta.version, 'Fixture 1.0');
	assert.equal(meta.licence, 'GPL-2.0');
	assert.deepEqual(meta.modules, ['DungeonsAndRaids', 'Collections', 'Crafting', 'Factions', 'PvP']);
	assert.deepEqual(meta.warnings, []);
	assert.ok(meta.files.includes('AtlasLootClassic_DungeonsAndRaids/data.lua'));
	assert.ok(meta.files.includes('AtlasLootClassic_DungeonsAndRaids/droprate.lua'));
	assert.ok(meta.files.includes('AtlasLootClassic/Data/Profession.lua'));
	assert.ok(!meta.files.some((f) => f.endsWith('.xml')), 'TOC xml entries are not Lua');
});

test('AtlasLoot: instances keep the Forever TOC content as Classic, with forever.lua filling gaps only', () => {
	const r = atlas();
	assert.deepEqual(
		r.instances.map((i) => i.key),
		['FixtureKeep', 'FixtureCore', 'FixtureHollow', 'FixtureSpire'],
	);
	const keep = instance('FixtureKeep');
	assert.equal(keep.name, 'Fixture Keep', 'client area name falls back to the key');
	assert.equal(keep.kind, 'dungeon');
	assert.equal(keep.forever, false);
	assert.equal(keep.areaId, 9001);
	assert.deepEqual(keep.levels, [20, 24, 30], 'Classic values of GetForVersion');
	const core = instance('FixtureCore');
	assert.equal(core.kind, 'raid');
	assert.equal(core.phase, 3);
	assert.equal(core.levels, null);
	const hollow = instance('FixtureHollow');
	assert.equal(hollow.forever, true);
	assert.equal(hollow.name, 'Fixture Hollow', 'texture markup stripped');
	assert.deepEqual(hollow.bosses.map((b) => b.name), ['Fixture Hollow Boss'], 'data.lua wins over forever.lua; notice rows dropped');
	const spire = instance('FixtureSpire');
	assert.equal(spire.forever, true);
	assert.deepEqual(spire.levels, [40, 44, 48]);
	const ids = allItems();
	assert.ok(!ids.includes(900097), 'stale forever.lua copy ignored');
	assert.ok(!ids.includes(900098) && !ids.includes(900099), 'later-expansion rows skipped');
});

test('AtlasLoot: bosses carry npc/object ids; header, icon, set and source-ignored rows are skipped', () => {
	const keep = instance('FixtureKeep');
	assert.deepEqual(keep.bosses.map((b) => b.name), ['Warden Fixture', 'Fixture Twins', 'Fixture Cache']);
	assert.deepEqual(boss('FixtureKeep', 'Warden Fixture').npc, [900101]);
	assert.deepEqual(boss('FixtureKeep', 'Fixture Twins').npc, [900102, 900103]);
	assert.deepEqual(boss('FixtureKeep', 'Fixture Cache').object, [900201]);
	const ids = allItems();
	assert.ok(!ids.includes(0), 'placeholder item 0 skipped');
	assert.ok(!ids.includes(900901), 'IgnoreAsSource keys table skipped');
	assert.ok(!ids.includes(501) && !ids.includes(502), 'set ids are not items');
	assert.ok(ids.every((n) => Number.isInteger(n) && n > 0));
});

test('AtlasLoot: faction-only rows are tagged A/H from both factions\' tables', () => {
	const warden = boss('FixtureKeep', 'Warden Fixture');
	assert.equal(item(warden, 900004).faction, 'H');
	assert.equal(item(warden, 900005).faction, 'A');
	assert.equal(item(warden, 900001).faction, undefined);
	const cache = boss('FixtureKeep', 'Fixture Cache');
	assert.equal(item(cache, 900008).faction, undefined, 'inherited through GetItemsFromDiff -> both');
	assert.equal(item(cache, 900009).faction, 'A', 'Horde replaced that position');
	assert.equal(item(cache, 900010).faction, 'A', 'an empty Horde row blocks inheritance');
	assert.equal(item(cache, 900011).faction, 'H');
	const col = (id) => atlas().collections.find((c) => c.item === id);
	assert.equal(col(930001).faction, 'A');
	assert.equal(col(930003).faction, 'H');
	assert.equal(col(930004).faction, 'H');
	assert.equal(col(930009).faction, null, 'in both lists');
	assert.equal(col(930098), undefined);
	assert.equal(col(930099), undefined);
});

test('AtlasLoot: drop rates are read and joined onto boss items; quest and price extras kept', () => {
	const r = atlas();
	assert.deepEqual(r.droprates['900101'], { 900001: 12.5, 900002: 3.25 }, 'Classic is past the phase override');
	const warden = boss('FixtureKeep', 'Warden Fixture');
	assert.equal(item(warden, 900001).chance, 12.5);
	assert.equal(item(warden, 900002).quest, 990001);
	assert.equal(item(warden, 900003).price, 2500);
	assert.equal(item(warden, 900003).chance, undefined);
	const twins = boss('FixtureKeep', 'Fixture Twins');
	assert.equal(item(twins, 900006).chance, 40, 'any of the boss npcs');
	assert.equal(item(twins, 900007).chance, undefined);
});

test('AtlasLoot: collections group by content, skip set tables', () => {
	const r = atlas();
	assert.deepEqual([...new Set(r.collections.map((c) => c.group))], ['Mounts', 'Companions']);
	const drops = r.collections.filter((c) => c.section === 'Drops');
	assert.deepEqual(drops, [{ group: 'Mounts', groupName: 'Mounts', section: 'Drops', item: 930005, faction: null }]);
	assert.ok(!r.collections.some((c) => c.item === 601), 'TierSets are set ids');
	assert.equal(r.collections.find((c) => c.item === 930007).section, null, 'client-only faction name dropped');
});

test('AtlasLoot: sets list ItemSet ids from Collections and PvP set tables, sided', () => {
	assert.deepEqual(atlas().sets, [
		{ group: 'TierSets', groupName: 'Tier Sets', section: 'Tier 1 Sets', set: 601, faction: null },
		{ group: 'TierSets', groupName: 'Tier Sets', section: 'Tier 1 Sets', set: 602, faction: null },
		{ group: 'ClassSets', groupName: 'Class Sets', section: 'Epic', set: 701, faction: 'A' },
		{ group: 'ClassSets', groupName: 'Class Sets', section: 'Epic', set: 703, faction: null },
		{ group: 'ClassSets', groupName: 'Class Sets', section: 'Epic', set: 702, faction: 'H' },
	]);
	assert.ok(!atlas().pvp.some((x) => x.item >= 701 && x.item <= 703), 'set ids are not pvp items');
});

test('AtlasLoot: crafting maps craft spells to created items and skill', () => {
	const r = atlas();
	assert.deepEqual(r.crafting, [
		{ profession: 'Alchemy', item: 920001, spell: 910001, skill: 150, group: 'Potions' },
		{ profession: 'Alchemy', item: null, spell: 910002, skill: 275, group: 'Potions' },
		{ profession: 'Alchemy', item: null, spell: 910003, skill: null, group: 'Potions' },
		{ profession: 'Herbalism', item: 920201, spell: null, skill: null, group: 'Apprentice' },
		{ profession: 'Herbalism', item: 920202, spell: null, skill: null, group: 'Apprentice' },
	]);
});

test('AtlasLoot: faction rewards with standings from header rows, section names and PvP headers', () => {
	const r = atlas();
	const f = (id) => r.factions.find((x) => x.factionId === id);
	assert.equal(f(9501).name, 'Fixture Wardens');
	assert.deepEqual(f(9501).rewards, [
		{ item: 950001, standing: 8 },
		{ item: 950002, standing: 8 },
		{ item: 950003, standing: 8 },
		{ item: 950004, standing: 6 },
	]);
	assert.deepEqual(f(9502).rewards, [
		{ item: 950005, standing: 5, faction: 'A' },
		{ item: 950006, standing: 5, faction: 'H' },
	]);
	assert.equal(f(9601).name, null);
	assert.deepEqual(f(9601).rewards.map((x) => x.item), [960001, 960003]);
	assert.deepEqual(f(9602).rewards.map((x) => x.item), [960002, 960003]);
});

test('AtlasLoot: PvP rows carry side and rank; icon tables skipped', () => {
	const r = atlas();
	const p = (id) => r.pvp.find((x) => x.item === id);
	assert.deepEqual(p(940001), { group: 'PvPMounts', groupName: 'Mounts', section: 'Mounts', item: 940001, faction: 'A', rank: 6, honor: null });
	assert.equal(p(940002).groupName, 'Mounts');
	assert.equal(p(940002).rank, null);
	assert.equal(p(960003).faction, null);
	assert.equal(p(960001).faction, 'A');
	assert.ok(!r.pvp.some((x) => x.item === 136782), 'rank icons are not items');
});

test('AtlasLoot: missing modules and core files are tolerated with warnings', () => {
	const dir = partial(['AtlasLootClassic_DungeonsAndRaids', 'AtlasLootClassic_Crafting']);
	try {
		const r = readAtlasLoot(dir);
		assert.deepEqual(r.meta.modules, ['DungeonsAndRaids', 'Crafting']);
		assert.equal(r.meta.version, 'Fixture 1.0', 'from a module TOC when the core is absent');
		for (const m of ['Collections', 'Factions', 'PvP']) {
			assert.ok(r.meta.warnings.includes(`AtlasLootClassic_${m} not installed`), m);
		}
		assert.ok(r.meta.warnings.some((w) => w.includes('Data/Profession.lua missing')));
		assert.deepEqual(r.collections, []);
		assert.deepEqual(r.pvp, []);
		assert.deepEqual(r.sets, []);
		assert.deepEqual(r.factions, []);
		assert.equal(r.instances.length, 4);
		assert.ok(r.crafting.every((c) => c.profession !== 'Alchemy' || c.item === null), 'no created items without Profession.lua');
	} finally {
		fs.rmSync(dir, { recursive: true, force: true });
	}
	const empty = readAtlasLoot(path.join(FIX, 'no-such-folder'));
	assert.deepEqual([empty.instances, empty.collections, empty.crafting], [[], [], []]);
	assert.equal(empty.meta.warnings.length, 1);
});

test('RareScanner: rares per map with coordinates normalised to 0-100', () => {
	const r = readRareScanner(FIX);
	assert.equal(r.meta.source, 'RareScanner');
	assert.equal(r.meta.version, '0.0.1.fixture');
	assert.equal(r.meta.licence, 'All Rights Reserved');
	assert.equal(r.meta.files.length, 6);
	assert.deepEqual(r.meta.warnings, []);
	assert.deepEqual(r.rares, [
		{ npc: 970001, name: null, map: 1401, x: 41.25, y: 60.5, points: [[41, 60], [41.25, 60.5]], loot: [980001, 980002] },
		{ npc: 970002, name: null, map: 1402, x: 10, y: 20, points: [[10, 20]], loot: [] },
		{ npc: 970002, name: null, map: 1403, x: 50, y: 25, points: [], loot: [] },
		{ npc: 970003, name: null, map: null, x: null, y: null, points: [], loot: [] },
		{ npc: 970004, name: null, map: 1404, x: 70, y: 75, points: [[70, 75]], loot: [] },
		{ npc: 970005, name: null, map: null, x: null, y: null, points: [], loot: [980003] },
	]);
	assert.deepEqual(r.treasures, [{ object: 975001, name: null, map: 1405, x: 55.5, y: 33.3, points: [], loot: [985001] }]);
	assert.deepEqual(r.mounts, { 1: [990001], 2: [990002, 990003], 901: [990004] });
	assert.deepEqual(r.pets, { 9001: [995001] });
});

test('RareScanner: coordinate encodings', () => {
	assert.equal(coord(4125), 41.25);
	assert.equal(coord(0.5), 50);
	assert.equal(coord('0.5'), 50);
	assert.equal(coord('41.25'), 41.25);
	assert.equal(coord(-1), null);
	assert.equal(coord(20000), null);
	assert.deepEqual(point('4100-4940'), [41, 49.4]);
	assert.deepEqual(point('70007500'), [70, 75]);
	assert.equal(point('nope'), null);
});

test('RareScanner: missing tables and a missing addon are tolerated', () => {
	const dir = partial(['RareScanner'], ['RareScanner/Tables/Pets.lua', 'RareScanner/Tables/ContainerInfoTables.lua']);
	try {
		const r = readRareScanner(dir);
		assert.deepEqual(r.pets, {});
		assert.equal(r.rares.length, 6);
		assert.deepEqual(r.treasures.map((t) => [t.object, t.map]), [[975001, null]], 'loot-only container kept');
		assert.equal(r.meta.warnings.length, 2);
	} finally {
		fs.rmSync(dir, { recursive: true, force: true });
	}
	const none = readRareScanner(path.join(FIX, 'no-such-folder'));
	assert.deepEqual([none.rares, none.treasures, none.mounts], [[], [], {}]);
	assert.equal(none.meta.warnings.length, 1);
});

const REAL = resolveAddonsDir();
const hasReal = !!REAL && fs.existsSync(path.join(REAL, 'AtlasLootClassic_DungeonsAndRaids')) && fs.existsSync(path.join(REAL, 'RareScanner'));

test('real installed addons import with sane counts', { skip: !hasReal && 'Forever AddOns (AtlasLoot, RareScanner) not installed' }, () => {
	const r = readAtlasLoot(REAL);
	assert.ok(r.instances.length >= 30, `instances ${r.instances.length}`);
	assert.ok(r.instances.some((i) => i.forever), 'Forever content marked');
	assert.ok(Object.keys(r.droprates).length >= 100, 'drop-rate npcs');
	const strat = r.instances.find((i) => i.key === 'Stratholme');
	assert.ok(strat && strat.bosses.some((b) => b.items.some((x) => x.item === 13335)), "Deathcharger's Reins drop in Stratholme");
	const mounts = r.collections.filter((c) => c.group === 'Mounts');
	assert.ok(mounts.length >= 30, `mounts ${mounts.length}`);
	assert.ok(mounts.some((c) => c.item === 8631 && c.faction === 'A'), 'a Frostsaber mount, Alliance');
	assert.ok(r.crafting.length >= 500 && r.crafting.some((c) => c.item && c.spell));
	assert.ok(r.factions.length >= 5 && r.pvp.length >= 100);
	assert.ok(r.sets.length >= 20 && r.sets.some((s) => s.group === 'TierSets'), `sets ${r.sets.length}`);
	const rs = readRareScanner(REAL);
	assert.ok(rs.rares.length >= 100, `rares ${rs.rares.length}`);
	assert.ok(Object.keys(rs.mounts).length >= 30);
	assert.ok(rs.rares.every((x) => x.x == null || (x.x >= 0 && x.x <= 100 && x.y >= 0 && x.y <= 100)));
});
