'use strict';
// `itemdb build` (tools/lib/itemdb): stat extraction from client-table rows,
// the compact entry format and its Lua parser (addon/Polestar/Gear/ItemDB.lua),
// an offline end-to-end build, and the generated Polestar_ItemDB addon.

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { extractItems, encode, decode, dps } = require('../tools/lib/itemdb/stats');
const { buildItemDb, emitLua } = require('../tools/lib/itemdb/build');
const { SIZE_BUDGET } = require('../tools/commands/itemdb');
const { runAddon, ROOT } = require('./helpers/lua');
const { tmpdir } = require('./helpers/tmp');

// One ItemSparse row with every column the extractor reads.
function sparse(over) {
	const row = {
		ID: '0', Display_lang: 'Item', ItemLevel: '10', RequiredLevel: '5', InventoryType: '1', OverallQualityID: '2',
		AllowableClass: '-1', MaxCount: '0', ItemDelay: '0', Resistances_0: '0',
	};
	for (let i = 0; i < 10; i++) {
		row[`StatModifier_bonusStat_${i}`] = '-1';
		row[`StatModifier_bonusAmount_${i}`] = '0';
	}
	for (let i = 0; i < 5; i++) {
		row[`MinDamage_${i}`] = '0';
		row[`MaxDamage_${i}`] = '0';
	}
	const stats = over.stats || [];
	stats.forEach(([stat, amount], i) => {
		row[`StatModifier_bonusStat_${i}`] = String(stat);
		row[`StatModifier_bonusAmount_${i}`] = String(amount);
	});
	(over.damage || []).forEach(([lo, hi], i) => {
		row[`MinDamage_${i}`] = String(lo);
		row[`MaxDamage_${i}`] = String(hi);
	});
	for (const [k, v] of Object.entries(over)) if (k !== 'stats' && k !== 'damage') row[k] = String(v);
	return row;
}

function aura(spell, auraId, basePoints, misc = 0, index = 0) {
	return { SpellID: String(spell), DifficultyID: '0', EffectIndex: String(index), Effect: '6', EffectAura: String(auraId),
		EffectBasePoints: String(basePoints), EffectDieSides: '1', EffectMiscValue_0: String(misc) };
}

const TABLES = {
	ItemSparse: [
		// Shadowfang-like: physical + shadow damage, main hand
		sparse({ ID: 1482, Display_lang: 'Shadowfang', ItemLevel: 24, RequiredLevel: 19, InventoryType: 21, OverallQualityID: 3,
			ItemDelay: 2700, damage: [[29, 55], [4, 8]] }),
		// Tunic: Agility (3) and Stamina (7), armor, +AP equip (melee and ranged aura of one size)
		sparse({ ID: 2041, Display_lang: 'Tunic', ItemLevel: 24, RequiredLevel: 0, InventoryType: 5, Resistances_0: 92,
			stats: [[7, 5], [3, 11]] }),
		// Priest-only legs: healing + mp5 equip spells, unique
		sparse({ ID: 16922, Display_lang: 'Leggings', InventoryType: 7, AllowableClass: 16, MaxCount: 1, Resistances_0: 101,
			stats: [[5, 21], [6, 21], [7, 16]] }),
		// Caster ring: all-school spell damage, fire-only damage, spell crit, spell hit
		sparse({ ID: 3001, Display_lang: 'Ring', InventoryType: 11 }),
		// Tank shield: defense skill, block value, block %, bonus armor; ranged-only AP; crit; hit; hp5
		sparse({ ID: 3002, Display_lang: 'Shield', InventoryType: 14, Resistances_0: 500 }),
		// left out
		sparse({ ID: 3003, Display_lang: 'Monster - Sword', InventoryType: 13, ItemDelay: 2000, damage: [[1, 2]] }),
		sparse({ ID: 3004, Display_lang: 'Deprecated Old Belt', InventoryType: 6 }),
		sparse({ ID: 210000, Display_lang: 'Season Choker', InventoryType: 2 }),
		sparse({ ID: 3005, Display_lang: 'Shirt', InventoryType: 4 }),
		sparse({ ID: 3006, Display_lang: 'No Item Row', InventoryType: 1 }),
		sparse({ ID: 3007, Display_lang: 'Every Class', InventoryType: 1, AllowableClass: 1503 }),
	],
	Item: [1482, 2041, 16922, 3001, 3002, 3003, 3004, 210000, 3005, 3007].map((id) => ({
		ID: String(id), ClassID: id === 1482 || id === 3003 ? '2' : '4', SubclassID: id === 1482 ? '7' : id === 3002 ? '6' : '1',
	})),
	ItemEffect: [
		{ ParentItemID: '2041', TriggerType: '1', SpellID: '100' },
		{ ParentItemID: '16922', TriggerType: '1', SpellID: '101' },
		{ ParentItemID: '16922', TriggerType: '1', SpellID: '102' },
		{ ParentItemID: '16922', TriggerType: '0', SpellID: '999' }, // on use: ignored
		{ ParentItemID: '3001', TriggerType: '1', SpellID: '103' },
		{ ParentItemID: '3001', TriggerType: '1', SpellID: '104' },
		{ ParentItemID: '3001', TriggerType: '1', SpellID: '105' },
		{ ParentItemID: '3001', TriggerType: '1', SpellID: '106' },
		{ ParentItemID: '3002', TriggerType: '1', SpellID: '107' },
		{ ParentItemID: '3002', TriggerType: '1', SpellID: '108' },
		{ ParentItemID: '3002', TriggerType: '1', SpellID: '109' },
		{ ParentItemID: '3002', TriggerType: '1', SpellID: '110' },
		{ ParentItemID: '3002', TriggerType: '1', SpellID: '111' },
		{ ParentItemID: '3002', TriggerType: '1', SpellID: '112' },
		{ ParentItemID: '3002', TriggerType: '1', SpellID: '113' },
		{ ParentItemID: '3002', TriggerType: '1', SpellID: '114' },
	],
	SpellEffect: [
		aura(100, 99, 17), aura(100, 124, 17, 0, 1), // +18 attack power
		aura(101, 135, 45, 126), // +46 healing
		aura(102, 85, 6, 0), // 7 mp5
		aura(999, 99, 500),
		aura(103, 13, 11, 126), // +12 spell damage
		aura(104, 13, 9, 4), // +10 fire damage
		aura(105, 57, 0), // +1% spell crit
		aura(106, 55, 1), // +2% spell hit
		aura(107, 30, 6, 95), // +7 defense
		aura(108, 564, 14), // +15 block value
		aura(109, 51, 1), // +2% block
		aura(110, 22, 49, 1), // +50 armor
		aura(111, 124, 9), // +10 ranged attack power only
		aura(112, 52, 0), // +1% crit
		aura(113, 54, 0), // +1% hit
		aura(114, 161, 2), // 3 hp5
	],
};

test('stat extraction: item stats, armor, summed weapon damage, equip auras, class mask, unique', () => {
	const { items, skipped } = extractItems(TABLES);
	const byId = Object.fromEntries(items.map((r) => [r.id, r]));
	assert.deepEqual(items.map((r) => r.id), [1482, 2041, 3001, 3002, 3007, 16922]);
	assert.deepEqual(skipped, { name: 2, season: 1, slot: 1, 'no-item-row': 1 });

	const sword = byId[1482];
	assert.deepEqual([sword.inv, sword.ilvl, sword.req, sword.quality, sword.cls, sword.sub], [21, 24, 19, 3, 2, 7]);
	assert.deepEqual([sword.dmin, sword.dmax, sword.speed], [33, 63, 2700]);
	assert.equal(dps(sword), 17.8);
	assert.deepEqual(sword.stats, {});

	assert.deepEqual(byId[2041].stats, { sta: 5, agi: 11, armor: 92, ap: 18 });
	assert.deepEqual(byId[16922].stats, { int: 21, spi: 21, sta: 16, armor: 101, heal: 46, mp5: 7 });
	assert.equal(byId[16922].allow, 16);
	assert.equal(byId[16922].unique, true);
	assert.equal(byId[3007].allow, 0, 'all nine classes = unrestricted');
	assert.deepEqual(byId[3001].stats, { sp: 12, spFire: 10, spellCrit: 1, spellHit: 2 });
	assert.deepEqual(byId[3002].stats, { armor: 550, defense: 7, blockValue: 15, block: 2, rap: 10, crit: 1, hit: 1, hp5: 3 });
});

test('entry format: letters-then-digits tokens round-trip, mp5/hp5 aliased', () => {
	const { items } = extractItems(TABLES);
	for (const rec of items) {
		const s = encode(rec);
		for (const tok of s.split(' ').slice(6)) assert.match(tok, /^[A-Za-z]+-?\d+$/);
		const back = decode(rec.id, s);
		assert.deepEqual(back.stats, rec.stats);
		assert.equal(back.allow, rec.allow);
		assert.equal(back.unique, rec.unique);
	}
	assert.equal(encode(items.find((r) => r.id === 16922)), '7 10 5 2 4 1 sta16 int21 spi21 armor101 heal46 mpr7 cls16 uniq1');
	assert.equal(encode(items.find((r) => r.id === 1482)), '21 24 19 3 2 7 dmin33 dmax63 speed2700');
});

test('the addon parser reads what the toolchain writes (Gear/ItemDB.lua vs encode)', () => {
	const { items } = extractItems(TABLES);
	const file = path.join(os.tmpdir(), `polestar-itemdb-${process.pid}-${Date.now()}.lua`);
	fs.writeFileSync(file, emitLua(items, '1.15.test'));
	try {
		const [got, meta] = runAddon({
			addons: [{ name: 'Polestar', files: ['Core/Init.lua', 'Gear/ItemDB.lua'] }],
			script: `dofile(${JSON.stringify(file)})
				local out = {}
				for _, id in ipairs({ ${items.map((r) => r.id).join(', ')} }) do out[tostring(id)] = Polestar.ItemDB.Get(id) end
				emit(out); emit(Polestar.ItemDB.Meta())`,
		}).emitted;
		assert.deepEqual(meta, { schema: 1, build: '1.15.test', count: items.length });
		for (const rec of items) {
			const lua = got[String(rec.id)];
			const want = { ...rec.stats };
			if (rec.speed) want.dps = dps(rec);
			assert.deepEqual(lua.stats, want, `item ${rec.id}`);
			assert.deepEqual([lua.inv, lua.ilvl, lua.req, lua.quality, lua.class, lua.subclass, lua.allow, lua.unique],
				[rec.inv, rec.ilvl, rec.req, rec.quality, rec.cls, rec.sub, rec.allow, rec.unique]);
		}
	} finally {
		fs.rmSync(file, { force: true });
	}
});

function toCsv(rows) {
	const header = Object.keys(rows[0]);
	const esc = (v) => (/[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v);
	return [header.join(','), ...rows.map((r) => header.map((h) => esc(String(r[h] ?? ''))).join(','))].join('\n') + '\n';
}

test('itemdb build: offline from cached CSVs to a TOC and Items.lua, byte-identical on rerun', async () => {
	const dir = tmpdir('polestar-itemdb-');
	const cache = path.join(dir, 'sources', 'wago', '1.15.9.1');
	fs.mkdirSync(cache, { recursive: true });
	for (const [name, rows] of Object.entries(TABLES)) {
		const withId = rows.map((r, i) => ({ ID: r.ID ?? String(i + 1), ...r }));
		fs.writeFileSync(path.join(cache, `${name}.csv`), toCsv(withId));
	}
	const out = path.join(dir, 'Polestar_ItemDB');
	const res = await buildItemDb({ sourcesDir: path.join(dir, 'sources'), offline: true, outDir: out });
	assert.equal(res.build, '1.15.9.1');
	assert.equal(res.count, 6);
	const first = fs.readFileSync(path.join(out, 'Items.lua'), 'utf8');
	await buildItemDb({ sourcesDir: path.join(dir, 'sources'), offline: true, outDir: out });
	assert.equal(fs.readFileSync(path.join(out, 'Items.lua'), 'utf8'), first);
	assert.match(first, /\[1482\]="21 24 19 3 2 7 dmin33 dmax63 speed2700",/);
	const toc = fs.readFileSync(path.join(out, 'Polestar_ItemDB.toc'), 'utf8');
	assert.match(toc, /^## Interface: 16001$/m);
	assert.match(toc, /^## LoadOnDemand: 1$/m);
	assert.match(toc, /^## Dependencies: Polestar$/m);
	assert.match(toc, /^Items\.lua$/m);
});

const GENERATED = path.join(ROOT, 'addon', 'Polestar_ItemDB', 'Items.lua');

test('the generated Polestar_ItemDB addon loads on demand, stays within budget and knows Shadowfang', { skip: !fs.existsSync(GENERATED) && 'run itemdb build first' }, () => {
	assert.ok(fs.statSync(GENERATED).size <= SIZE_BUDGET, `Items.lua over ${SIZE_BUDGET} bytes`);
	const [loaded, sword, count] = runAddon({
		addons: [{ name: 'Polestar', files: ['Core/Init.lua', 'Gear/ItemDB.lua'] }],
		script: `local before = Polestar.ItemDB.IsLoaded()
			dofile(${JSON.stringify(GENERATED)})
			emit({ before, Polestar.ItemDB.IsLoaded() })
			emit(Polestar.ItemDB.Get(1482))
			emit(Polestar.ItemDB.Meta().count)`,
	}).emitted;
	assert.deepEqual(loaded, [false, true]);
	assert.deepEqual([sword.inv, sword.req, sword.class, sword.subclass, sword.stats.dps], [21, 19, 2, 7, 17.8]);
	assert.ok(count > 5000);
});

test('the data addon is loaded on first lookup, once, and never in combat', () => {
	const [out] = runAddon({
		addons: [{ name: 'Polestar', files: ['Core/Init.lua', 'Gear/ItemDB.lua'] }],
		script: `local calls = 0
			C_AddOns.LoadAddOn = function(name)
				calls = calls + 1
				if name == "Polestar_ItemDB" then Polestar.ItemDB.Register({ count = 1 }, { [5] = "1 5 1 1 4 1 sta1" }) end
				return true
			end
			stub.inCombat = true
			local inCombat = Polestar.ItemDB.Get(5) == nil
			stub.inCombat = false
			local after = Polestar.ItemDB.Get(5).stats.sta
			Polestar.ItemDB.Get(6)
			emit({ inCombat, after, calls })`,
	}).emitted;
	assert.deepEqual(out, [true, 1, 1]);
});
