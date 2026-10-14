'use strict';
// ForeverLevelingBiS (MIT, by Thunder) -> addon/Polestar_ItemDB/Forever.lua:
// Forever's own item stats over the Classic Era client tables, and where each
// leveling item comes from (quests, dungeon drops, crafting) for Gear's
// "next upgrades" and the quest reward pick.
//
// Precedence (docs/SUITE.md): Forever-specific sources beat Era tables. The
// addon scrapes Forever's item pages, so for every item it lists its numbers
// win for the stats it records (primary stats, armor, attack and spell power,
// defense, weapon damage); the Era table keeps the equip bonuses the scrape
// does not carry (crit, hit, mp5, dodge, parry, block). A quest reward's
// "requires level" in the scrape is the quest's, so the Era table's own
// requirement wins when the item exists there.

const { encode, decode, STAT_KEYS } = require('../itemdb/stats');
const { header } = require('../generated');

// Stats the scrape records (Polestar keys); the rest stay as the Era table has them.
const SCRAPED = new Set(['str', 'agi', 'sta', 'int', 'spi', 'armor', 'health', 'mana', 'ap', 'rap', 'sp', 'heal',
	'spArcane', 'spFire', 'spFrost', 'spHoly', 'spNature', 'spShadow', 'defense', 'dps', 'rdps']);

// Equippable inventory types (as Polestar_ItemDB keeps).
const EQUIPPABLE = new Set([1, 2, 3, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 20, 21, 22, 23, 25, 26, 28]);

const PROFESSIONS = ['Alchemy', 'Blacksmithing', 'Enchanting', 'Engineering', 'Leatherworking', 'Tailoring', 'Jewelcrafting', 'Mining', 'Herbalism', 'Skinning', 'Cooking', 'First Aid', 'Fishing'];

function luaStr(s) {
	return `"${String(s).replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\n/g, '\\n').replace(/\r/g, '')}"`;
}

// Era Items.lua text -> Map(id -> record)
function readEraItems(text) {
	const out = new Map();
	for (const m of text.matchAll(/\[(\d+)\]="([^"]*)"/g)) out.set(Number(m[1]), decode(Number(m[1]), m[2]));
	return out;
}

// One scraped item -> ItemDB record (merged over the Era record when there is one).
function recordOf(it, era) {
	const stats = {};
	if (era) for (const [k, v] of Object.entries(era.stats)) if (!SCRAPED.has(k)) stats[k] = v;
	for (const [k, v] of Object.entries(it.polestar || {})) {
		if (k === 'dps' || k === 'rdps') continue; // weapon damage below
		if (STAT_KEYS.includes(k) && v) stats[k] = Math.round(v);
	}
	const rec = {
		id: it.id,
		inv: it.slot,
		ilvl: it.itemLevel || (era && era.ilvl) || 0,
		req: era ? era.req : it.reqLevel || 0,
		quality: it.quality ?? (era && era.quality) ?? 1,
		cls: it.class,
		sub: it.subclass < 0 ? 0 : it.subclass,
		allow: it.classMask && (it.classMask & 0x5df) !== 0x5df ? it.classMask : era ? era.allow : 0,
		unique: era ? era.unique : false,
		stats,
	};
	const w = it.weapon;
	if (w && w.max > 0 && w.speed > 0) Object.assign(rec, { dmin: Math.round(w.min), dmax: Math.round(w.max), speed: Math.round(w.speed * 1000) });
	else if (era && era.speed) Object.assign(rec, { dmin: era.dmin, dmax: era.dmax, speed: era.speed });
	return rec;
}

function sameRecord(a, b) {
	return encode(a) === encode(b);
}

// Source tokens (one string per item, space separated):
//   q<questId>                          quest reward (details in `quests`)
//   d<npcId>x<pct x 10>z<zoneId>        drop (npcId 0 = trash; names in `npcs`, `zones`)
//   c<spellId>p<profession #>s<skill>   crafted (profession # = PROFESSIONS index, 1-based)
function sourceTokens(it, npcs, zones, warn) {
	const out = [];
	for (const s of it.sources || []) {
		if (s.type === 'quest' && s.id) out.push(`q${s.id}`);
		else if (s.type === 'drop') {
			const npc = s.npcId || 0;
			if (npc) npcs.set(npc, s.npc);
			if (s.zoneId && s.zone) zones.set(s.zoneId, s.zone);
			out.push(`d${npc}x${Math.round((s.pct || 0) * 10)}z${s.zoneId || 0}`);
		} else if (s.type === 'crafted' && s.spellId) {
			const p = PROFESSIONS.indexOf(s.profession) + 1;
			if (!p) warn(`item ${it.id}: unknown profession ${s.profession}`);
			out.push(`c${s.spellId}p${p}s${s.skill || 0}`);
		} else warn(`item ${it.id}: source type ${s.type} not kept`);
	}
	return [...new Set(out)];
}

// -> { lua, counts, warnings }
// flb: readForeverLevelingBiS() result; eraText: addon/Polestar_ItemDB/Items.lua.
function buildForeverPack(flb, eraText) {
	const era = readEraItems(eraText);
	const warnings = [];
	const warn = (m) => warnings.push(m);
	const overlay = [];
	const names = [];
	const src = [];
	const npcs = new Map();
	const zones = new Map(Object.entries(flb.zones || {}).map(([k, v]) => [Number(k), v]));
	const counts = { items: 0, newItems: 0, retuned: 0, unchanged: 0, sources: { quest: 0, drop: 0, crafted: 0 }, quests: 0, skippedSlot: 0 };
	const usedQuests = new Set();
	const ids = Object.keys(flb.items).map(Number).sort((a, b) => a - b);
	for (const id of ids) {
		const it = flb.items[id];
		if (!EQUIPPABLE.has(it.slot)) {
			counts.skippedSlot++;
			continue;
		}
		counts.items++;
		const e = era.get(id);
		const rec = recordOf(it, e);
		if (!e) {
			counts.newItems++;
			overlay.push(rec);
		} else if (!sameRecord(rec, e)) {
			counts.retuned++;
			overlay.push(rec);
		} else counts.unchanged++;
		names.push([id, it.name]);
		const toks = sourceTokens(it, npcs, zones, warn);
		for (const t of toks) {
			if (t[0] === 'q') {
				counts.sources.quest++;
				usedQuests.add(Number(t.slice(1)));
			} else if (t[0] === 'd') counts.sources.drop++;
			else counts.sources.crafted++;
		}
		if (toks.length) src.push([id, toks.join(' ')]);
	}

	// Quests: every quest that rewards (or offers as a choice) a kept item.
	const kept = new Set(names.map(([id]) => id));
	const quests = [];
	for (const qid of Object.keys(flb.quests).map(Number).sort((a, b) => a - b)) {
		const q = flb.quests[qid];
		const r = q.rewards || {};
		const choices = (r.choices || []).filter((i) => kept.has(i));
		const items = (r.items || []).filter((i) => kept.has(i));
		if (!choices.length && !items.length && !usedQuests.has(qid)) continue;
		counts.quests++;
		const zone = (q.start && q.start.zoneId) || 0;
		const head = [q.level || 0, q.reqLevel || 0, q.side || 3, zone, q.reqRace || 0, q.reqClass || 0, q.type === 'Dungeon' ? 1 : 0].join(' ');
		quests.push([qid, `${head}|${choices.join(',')}|${items.join(',')}|${q.name || ''}`]);
	}

	const m = flb.meta;
	const lines = [
		header('lua', 'gear build', `ForeverLevelingBiS ${m.version} by Thunder (data ${m.generated || '?'}), MIT licence`),
		'-- See THIRD_PARTY.md. Facts only: Forever item stats over the Era table, and',
		'-- where each leveling item comes from.',
		'--   items   "<inv> <ilvl> <req> <quality> <class> <subclass> [tokens]" (Items.lua format)',
		'--   src     q<quest> | d<npc>x<pct*10>z<zone> | c<spell>p<profession>s<skill>',
		'--   quests  "<level> <req> <side> <zone> <reqRace> <reqClass> <dungeon>|<choices>|<items>|<name>"',
		'',
		'local DB = Polestar and Polestar.ItemDB',
		'if not (DB and DB.Register and DB.RegisterLeveling) then return end',
		'',
		'DB.Register(nil, {',
		...overlay.map((r) => `[${r.id}]=${luaStr(encode(r))},`),
		'})',
		'',
		`DB.RegisterLeveling({ source = "ForeverLevelingBiS", version = ${luaStr(m.version)}, generated = ${luaStr(m.generated || '')}, licence = "MIT", items = ${names.length}, quests = ${quests.length} }, {`,
		`professions = { ${PROFESSIONS.map(luaStr).join(', ')} },`,
		'names = {',
		...names.map(([id, n]) => `[${id}]=${luaStr(n)},`),
		'},',
		'src = {',
		...src.map(([id, s]) => `[${id}]=${luaStr(s)},`),
		'},',
		'quests = {',
		...quests.map(([id, s]) => `[${id}]=${luaStr(s)},`),
		'},',
		'npcs = {',
		...[...npcs].sort((a, b) => a[0] - b[0]).map(([id, n]) => `[${id}]=${luaStr(n)},`),
		'},',
		'zones = {',
		...[...zones].sort((a, b) => a[0] - b[0]).map(([id, n]) => `[${id}]=${luaStr(n)},`),
		'},',
		'})',
		'',
	];
	return { lua: lines.join('\n'), counts, warnings };
}

module.exports = { buildForeverPack, PROFESSIONS };
