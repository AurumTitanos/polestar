'use strict';
// Item stats from Blizzard's Classic Era client tables (wago.tools CSV).
//
// Columns used (inspected on wow_classic_era 1.15.9.70003, 2026-10):
//   ItemSparse   ID, Display_lang, ItemLevel, RequiredLevel, InventoryType,
//                OverallQualityID, AllowableClass (-1 any), MaxCount (1 unique),
//                StatModifier_bonusStat_0..9 (ItemModType, -1 none),
//                StatModifier_bonusAmount_0..9, ItemDelay (ms),
//                MinDamage_0..4 / MaxDamage_0..4 (one entry per damage school),
//                Resistances_0 (armor; 1..6 are holy..arcane resistances)
//   Item         ID, ClassID (2 weapon, 4 armor), SubclassID
//   ItemEffect   ParentItemID, TriggerType (1 = on equip), SpellID
//   SpellEffect  SpellID, Effect (6 = apply aura), EffectAura, EffectBasePoints,
//                EffectDieSides, EffectMiscValue_0
//
// Armor and weapon damage are stored per item in ItemSparse already. The
// formula tables (ItemArmorTotal x ArmorLocation x ItemArmorQuality,
// ItemArmorShield, ItemDamageOneHand/TwoHand/Ranged/Wand/Thrown) give the same
// numbers (checked on shields of every quality), so they are not needed.
//
// Classic "equip" bonuses (attack power, spell damage, crit, hit, mp5, ...)
// are not item stats but spells with an aura; EQUIP_AURAS maps the auras a
// leveling score cares about. Aura amounts are EffectBasePoints +
// EffectDieSides (DieSides is 1 for these fixed bonuses).
//
// Left out: Season of Discovery items (ID >= 190000, they ship in the same Era
// client), NPC-only "Monster - " weapons, deprecated/test items, and slots that
// carry no stats worth scoring (shirt, tabard, bags, ammo, quivers).

// InventoryType values worth scoring (Enum.InventoryType).
const EQUIPPABLE = new Set([1, 2, 3, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 20, 21, 22, 23, 25, 26, 28]);

// ItemModType -> canonical stat key.
const ITEM_MODS = { 0: 'mana', 1: 'health', 3: 'agi', 4: 'str', 5: 'int', 6: 'spi', 7: 'sta', 38: 'ap' };

// Spell school mask bits (EffectMiscValue_0 of aura 13).
const SCHOOLS = { 2: 'spHoly', 4: 'spFire', 8: 'spNature', 16: 'spFrost', 32: 'spShadow', 64: 'spArcane' };
const ALL_MAGIC = 126;

const SOD_ITEM_MIN = 190000;
const SKIP_NAME = /^Monster - |\bdeprecated\b|^(QA)?test\b|\[PH\]|\bunused\b|\bDEBUG\b/i;

// The stat keys the runtime understands, in emission order.
const STAT_KEYS = [
	'str', 'agi', 'sta', 'int', 'spi', 'armor', 'health', 'mana',
	'ap', 'rap', 'sp', 'spArcane', 'spFire', 'spFrost', 'spHoly', 'spNature', 'spShadow', 'heal',
	'crit', 'hit', 'spellCrit', 'spellHit', 'mp5', 'hp5', 'defense', 'dodge', 'parry', 'block', 'blockValue',
];

// Stored tokens are letters followed by the number, so keys that end in a
// digit get a letters-only alias.
const TOKEN = { mp5: 'mpr', hp5: 'hpr' };
const UNTOKEN = { mpr: 'mp5', hpr: 'hp5' };

function int(v) {
	const n = Number(v);
	return Number.isFinite(n) ? Math.trunc(n) : 0;
}

function add(stats, key, n) {
	if (!n) return;
	stats[key] = (stats[key] || 0) + n;
}

// One equip spell's aura effects -> stats (added into `stats`).
// effects: SpellEffect rows of that spell.
function equipStats(effects, stats) {
	const auras = new Map();
	for (const e of effects) {
		if (int(e.Effect) !== 6 || int(e.DifficultyID) !== 0) continue;
		const aura = int(e.EffectAura);
		const amount = int(e.EffectBasePoints) + int(e.EffectDieSides);
		const misc = int(e.EffectMiscValue_0);
		auras.set(aura, { amount, misc });
		switch (aura) {
			case 13: // MOD_DAMAGE_DONE, misc = school mask
				if ((misc & ALL_MAGIC) === ALL_MAGIC) add(stats, 'sp', amount);
				else if (SCHOOLS[misc]) add(stats, SCHOOLS[misc], amount);
				break;
			case 135: add(stats, 'heal', amount); break; // MOD_HEALING_DONE
			case 85: if (misc === 0) add(stats, 'mp5', amount); break; // MOD_POWER_REGEN (mana)
			case 161: add(stats, 'hp5', amount); break; // MOD_HEALTH_REGEN_IN_COMBAT
			case 52: add(stats, 'crit', amount); break; // MOD_CRIT_PERCENT
			case 54: add(stats, 'hit', amount); break; // MOD_HIT_CHANCE
			case 55: add(stats, 'spellHit', amount); break; // MOD_SPELL_HIT_CHANCE
			case 57: // MOD_SPELL_CRIT_CHANCE
			case 552: // spell crit (school mask, all magic)
				if (aura === 57 || (misc & ALL_MAGIC) === ALL_MAGIC) add(stats, 'spellCrit', amount);
				break;
			case 47: add(stats, 'parry', amount); break;
			case 49: add(stats, 'dodge', amount); break;
			case 51: add(stats, 'block', amount); break;
			case 564: add(stats, 'blockValue', amount); break;
			case 30: if (misc === 95) add(stats, 'defense', amount); break; // MOD_SKILL: Defense
			case 22: if (misc === 1) add(stats, 'armor', amount); break; // MOD_RESISTANCE: physical = bonus armor
			default: break;
		}
	}
	// +Attack Power bonuses are a melee (99) and a ranged (124) aura of the same
	// size: that is plain "ap". Ranged-only bonuses are "rap".
	const melee = auras.get(99);
	const ranged = auras.get(124);
	if (melee) add(stats, 'ap', melee.amount);
	if (ranged && !(melee && melee.amount === ranged.amount)) add(stats, 'rap', ranged.amount);
	return stats;
}

// Index the tables once. -> { itemClass: Map(id -> {cls, sub}), equipSpells: Map(item -> [spell]), effects: Map(spell -> rows) }
function indexTables(tables) {
	const itemClass = new Map();
	for (const r of tables.Item || []) itemClass.set(int(r.ID), { cls: int(r.ClassID), sub: int(r.SubclassID) });
	const equipSpells = new Map();
	for (const r of tables.ItemEffect || []) {
		if (int(r.TriggerType) !== 1) continue;
		const item = int(r.ParentItemID);
		const spell = int(r.SpellID);
		if (!item || !spell) continue;
		if (!equipSpells.has(item)) equipSpells.set(item, []);
		equipSpells.get(item).push(spell);
	}
	const wanted = new Set();
	for (const spells of equipSpells.values()) for (const s of spells) wanted.add(s);
	const effects = new Map();
	for (const r of tables.SpellEffect || []) {
		const s = int(r.SpellID);
		if (!wanted.has(s)) continue;
		if (!effects.has(s)) effects.set(s, []);
		effects.get(s).push(r);
	}
	for (const rows of effects.values()) rows.sort((a, b) => int(a.EffectIndex) - int(b.EffectIndex));
	return { itemClass, equipSpells, effects };
}

// One ItemSparse row -> record | { skip: reason }.
function extractItem(row, index) {
	const id = int(row.ID);
	const inv = int(row.InventoryType);
	if (!EQUIPPABLE.has(inv)) return { skip: 'slot' };
	if (id >= SOD_ITEM_MIN) return { skip: 'season' };
	if (SKIP_NAME.test(row.Display_lang || '')) return { skip: 'name' };
	const cls = index.itemClass.get(id);
	if (!cls) return { skip: 'no-item-row' };
	const stats = {};
	for (let i = 0; i < 10; i++) {
		const key = ITEM_MODS[int(row[`StatModifier_bonusStat_${i}`])];
		if (key) add(stats, key, int(row[`StatModifier_bonusAmount_${i}`]));
	}
	add(stats, 'armor', int(row.Resistances_0));
	for (const spell of index.equipSpells.get(id) || []) equipStats(index.effects.get(spell) || [], stats);
	let dmin = 0;
	let dmax = 0;
	for (let i = 0; i < 5; i++) {
		dmin += int(row[`MinDamage_${i}`]);
		dmax += int(row[`MaxDamage_${i}`]);
	}
	const speed = int(row.ItemDelay);
	const allow = int(row.AllowableClass);
	const rec = {
		id,
		inv,
		ilvl: int(row.ItemLevel),
		req: int(row.RequiredLevel),
		quality: int(row.OverallQualityID),
		cls: cls.cls,
		sub: cls.sub,
		allow: allow > 0 && (allow & 0x5df) !== 0x5df ? allow : 0, // 0x5df = all nine classes
		unique: int(row.MaxCount) === 1,
		stats,
	};
	if (dmax > 0 && speed > 0) Object.assign(rec, { dmin, dmax, speed });
	return rec;
}

// Weapon damage per second, 1 decimal like the tooltip.
function dps(rec) {
	if (!rec.speed) return 0;
	return Math.round(((rec.dmin + rec.dmax) / 2 / (rec.speed / 1000)) * 10) / 10;
}

// Record -> the compact string the addon stores:
//   "<inv> <ilvl> <req> <quality> <class> <subclass>[ token ...]"
// tokens: <stat><n> for each stat (STAT_KEYS order), then dmin<n> dmax<n>
// speed<ms> for weapons, cls<mask> for class-restricted items, uniq1.
function encode(rec) {
	const parts = [rec.inv, rec.ilvl, rec.req, rec.quality, rec.cls, rec.sub].map(String);
	for (const k of STAT_KEYS) if (rec.stats[k]) parts.push(`${TOKEN[k] || k}${rec.stats[k]}`);
	if (rec.speed) parts.push(`dmin${rec.dmin}`, `dmax${rec.dmax}`, `speed${rec.speed}`);
	if (rec.allow) parts.push(`cls${rec.allow}`);
	if (rec.unique) parts.push('uniq1');
	return parts.join(' ');
}

// The inverse, used by tests (the addon parses the same format in Lua).
function decode(id, s) {
	const parts = s.split(' ');
	const [inv, ilvl, req, quality, cls, sub] = parts.slice(0, 6).map(Number);
	const rec = { id, inv, ilvl, req, quality, cls, sub, allow: 0, unique: false, stats: {} };
	for (const tok of parts.slice(6)) {
		const m = /^([A-Za-z]+)(-?\d+)$/.exec(tok);
		if (!m) throw new Error(`item ${id}: bad token "${tok}"`);
		const n = Number(m[2]);
		if (m[1] === 'dmin' || m[1] === 'dmax' || m[1] === 'speed') rec[m[1]] = n;
		else if (m[1] === 'cls') rec.allow = n;
		else if (m[1] === 'uniq') rec.unique = n === 1;
		else rec.stats[UNTOKEN[m[1]] || m[1]] = n;
	}
	return rec;
}

// tables: { ItemSparse, Item, ItemEffect, SpellEffect } rows ->
// { items: [record], skipped: { reason: n } } sorted by id.
function extractItems(tables) {
	const index = indexTables(tables);
	const items = [];
	const skipped = {};
	for (const row of tables.ItemSparse || []) {
		const r = extractItem(row, index);
		if (r.skip) {
			skipped[r.skip] = (skipped[r.skip] || 0) + 1;
			continue;
		}
		items.push(r);
	}
	items.sort((a, b) => a.id - b.id);
	return { items, skipped };
}

module.exports = { extractItems, indexTables, encode, decode, dps, STAT_KEYS, EQUIPPABLE };
