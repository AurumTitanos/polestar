'use strict';
// `codex build`: every importer + data/forever + the Forever client's tables
// -> the Codex (data/forever/codex/*.json, shapes in docs/ARCHITECTURE.md,
// "Codex (`codex build`)", and tools/lib/codex/pack.js) and the load-on-demand pack addon/Polestar_Codex.
// Same inputs give byte-identical output.
//
//   loadInputs(opts)      -> inputs (runs importers, reads files, client tables)
//   mergeCodex(inputs)    -> codex  (pure; tests inject synthetic inputs)
//   buildCodex(opts)      -> writes JSON + pack, measures pack memory
//
// inputs = {
//   forever: { items, npcs, objects, quests, zones, factions, professions, trainers,
//              mapFrames, meta, dungeons|null },        (data/forever/*.json as written)
//   atlasloot|null, rarescanner|null, flbis|null,        (tools/lib/consume/* outputs)
//   client: clientFacts(tables)|null,
// }
//
// Precedence for one fact found in several inputs (docs/SUITE.md, "Data
// layer"): recordings > client tables > Forever-specific (QuestieDB Forever,
// ForeverLevelingBiS, RareScanner, DungeonJournal) > Era (pfQuest, AtlasLoot)
// > Wowhead. Sources of one item dedupe by type + npc/object/quest/spell/
// faction; each field comes from the highest-ranked input that has it and
// `from` keeps every input.

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { emitPack, packOrder, ADDON, SCHEMA } = require('./pack');
const { blockingPrereqs } = require('../data/prereqs');

const ROOT = path.resolve(__dirname, '..', '..', '..');
const BUILD = '1.60.1.70338';
const TABLES = ['Item', 'ItemSparse', 'ItemEffect', 'ItemXItemEffect', 'SpellEffect', 'SpellName', 'SkillLine', 'SkillLineAbility', 'Map', 'AreaTable'];
// The Forever client's ItemSparse lacks ~5k items Forever still has; their
// names, quality and levels fall back to the Classic Era client (lower rank).
const ERA_BUILD = '1.15.9.70003';
const ERA_TABLES = ['Item', 'ItemSparse', 'ItemEffect'];

const RANK = { recordings: 0, client: 1, questie: 2, flbis: 2, rarescanner: 2, dungeons: 2, journal: 2, forever: 2, pfquest: 3, atlasloot: 3, wowhead: 4 };
const KEY_FIELD = { vendor: 'npc', drop: 'npc', object: 'object', quest: 'quest', craft: 'spell', rep: 'faction', pvp: null, container: 'item', world: null };
const TYPE_ORDER = ['vendor', 'quest', 'craft', 'rep', 'pvp', 'drop', 'object', 'container', 'world'];
const SOURCE_FIELDS = {
	vendor: ['npc', 'cost', 'limited'],
	drop: ['npc', 'chance', 'instance'],
	object: ['object', 'chance'],
	quest: ['quest', 'choice'],
	craft: ['spell', 'skillLine', 'profession', 'skill'],
	rep: ['faction', 'standing', 'npc'],
	pvp: ['rank', 'npc'],
	container: ['item', 'chance'],
	world: ['minLevel', 'maxLevel'],
};

// Per item: the strongest drops/objects/vendors are kept; an item many
// creatures drop also gets one `world` source with their level range.
const CAP = { drop: 10, object: 6, vendor: 10, container: 6 };
const WORLD_DROP_NPCS = 12;
// Spawns: clusters per map, maps per entity.
const SPAWN = { radius: 3, perMap: 5, maps: 4 };
// Loot listed on a rare NPC or treasure (Codex.Loot): best-known chance first.
const LOOT_CAP = 40;

const CLASS_BITS = [
	[1, 'WARRIOR'], [2, 'PALADIN'], [4, 'HUNTER'], [8, 'ROGUE'], [16, 'PRIEST'],
	[64, 'SHAMAN'], [128, 'MAGE'], [256, 'WARLOCK'], [1024, 'DRUID'],
];
// Class mount spells the client tables give no class for (SkillLineAbility
// ClassMask 0 and no SpellClassOptions row on 1.60.1.70338).
const CLASS_MOUNT_FALLBACK = { 5784: 'WARLOCK', 23161: 'WARLOCK' };

const ALLIANCE_RACES = 1 | 4 | 8 | 64;
const HORDE_RACES = 2 | 16 | 32 | 128;

const SKILL_MOUNTS = 777;
const SKILL_COMPANIONS = 778;
const AURA_MOUNTED = 78;
const EFFECT_AURA = 6;
const TRIGGER_LEARN = 6;
const TRIGGER_USE = 0;

const JUNK = /^(?:Monster - |Deprecated |zz|\[PH\]|\[UNUSED\]|TEST |Test |OLD ?(?=[A-Z]))|\bDEPRECATED\b|Only GM can see|\(DND\)|\bDND\b|\[DNT\]/;

function int(v) {
	if (v === null || v === undefined || v === '') return null;
	const n = Number(v);
	return Number.isFinite(n) ? n : null;
}

function round1(v) {
	return Math.round(Number(v) * 10) / 10;
}

function slug(s) {
	return String(s)
		.normalize('NFKD')
		.replace(/[\u0300-\u036f]/g, '')
		.toLowerCase()
		.replace(/['’]/g, '')
		.replace(/[^a-z0-9]+/g, '-')
		.replace(/^-+|-+$/g, '');
}

function normName(s) {
	return slug(s).replace(/^the-/, '').replace(/-/g, '');
}

function byId(a, b) {
	return Number(a) - Number(b);
}

function sortKeysDeep(v) {
	if (Array.isArray(v)) return v.map(sortKeysDeep);
	if (v && typeof v === 'object') {
		const out = {};
		const keys = Object.keys(v).sort((a, b) => {
			const na = Number(a);
			const nb = Number(b);
			if (Number.isFinite(na) && Number.isFinite(nb) && String(na) === a && String(nb) === b) return na - nb;
			return a < b ? -1 : a > b ? 1 : 0;
		});
		for (const k of keys) out[k] = sortKeysDeep(v[k]);
		return out;
	}
	return v;
}

// ---------------------------------------------------------------------------
// Client tables -> facts
// ---------------------------------------------------------------------------

// tables: { Item, ItemSparse, ItemEffect, ItemXItemEffect, SpellEffect, SpellName,
//           SkillLine, SkillLineAbility } rows (wago.tools CSV) ->
// { build, items: { id: { name, quality, reqLevel, buyPrice, classId, subclassId, inventoryType,
//   minFaction, minStanding, pvpRank, learn, use } }, spellNames: { id: name },
//   mountAura: Set(spellId), skillLines: { id: name }, skillAbility: { spell: skillLine },
//   mountSkill: [spellId], companionSkill: [spellId], spellClass: { spell: CLASS } }
function clientFacts(tables, build = BUILD) {
	const items = {};
	for (const r of tables.ItemSparse || []) {
		const id = int(r.ID);
		if (!id) continue;
		const minFaction = int(r.MinFactionID);
		// RequiredPVPRank is the client's rank index: 5..18 = title ranks 1..14
		// (Private/Scout .. Grand Marshal/High Warlord); 1..4 are the dishonoured ranks.
		const rawRank = int(r.RequiredPVPRank);
		const pvpRank = rawRank >= 5 ? rawRank - 4 : null;
		items[id] = {
			name: r.Display_lang || null,
			quality: int(r.OverallQualityID),
			reqLevel: int(r.RequiredLevel) || null,
			buyPrice: int(r.BuyPrice) || null,
			minFaction: minFaction > 0 ? minFaction : null,
			minStanding: minFaction > 0 ? (int(r.MinReputation) || 0) + 1 : null,
			pvpRank,
			reqSkill: int(r.RequiredSkill) || null,
			reqSkillRank: int(r.RequiredSkill) ? int(r.RequiredSkillRank) || null : null,
		};
	}
	for (const r of tables.Item || []) {
		const it = items[int(r.ID)];
		if (!it) continue;
		it.classId = int(r.ClassID);
		it.subclassId = int(r.SubclassID);
		it.inventoryType = int(r.InventoryType);
	}
	const effects = {};
	for (const r of tables.ItemEffect || []) effects[r.ID] = r;
	const links = (tables.ItemXItemEffect || []).map((r) => ({ item: int(r.ItemID), effect: effects[r.ItemEffectID] }));
	// Older layouts carry ParentItemID on ItemEffect itself.
	for (const r of tables.ItemEffect || []) if (r.ParentItemID) links.push({ item: int(r.ParentItemID), effect: r });
	links.sort((a, b) => a.item - b.item || int(a.effect && a.effect.ID) - int(b.effect && b.effect.ID));
	for (const { item, effect } of links) {
		const it = items[item];
		if (!it || !effect) continue;
		const spell = int(effect.SpellID);
		if (!spell) continue;
		const trig = int(effect.TriggerType);
		if (trig === TRIGGER_LEARN && !it.learn) it.learn = spell;
		else if (trig === TRIGGER_USE && !it.use) it.use = spell;
	}
	const spellNames = {};
	for (const r of tables.SpellName || []) spellNames[int(r.ID)] = r.Name_lang;
	const mountAura = new Set();
	for (const r of tables.SpellEffect || []) {
		if (int(r.Effect) === EFFECT_AURA && int(r.EffectAura) === AURA_MOUNTED) mountAura.add(int(r.SpellID));
	}
	const skillLines = {};
	for (const r of tables.SkillLine || []) skillLines[int(r.ID)] = r.DisplayName_lang;
	const skillAbility = {};
	const mountSkill = [];
	const companionSkill = [];
	const spellClass = {};
	for (const r of tables.SkillLineAbility || []) {
		const spell = int(r.Spell);
		const line = int(r.SkillLine);
		if (!spell) continue;
		if (!(spell in skillAbility)) skillAbility[spell] = line;
		if (line === SKILL_MOUNTS) mountSkill.push(spell);
		if (line === SKILL_COMPANIONS) companionSkill.push(spell);
		const mask = int(r.ClassMask) || 0;
		const classes = CLASS_BITS.filter(([bit]) => mask & bit).map(([, c]) => c);
		if (classes.length === 1) spellClass[spell] = classes[0];
	}
	for (const [spell, cls] of Object.entries(CLASS_MOUNT_FALLBACK)) if (!spellClass[spell]) spellClass[spell] = cls;
	return { build, items, spellNames, mountAura, skillLines, skillAbility, mountSkill: [...new Set(mountSkill)].sort(byId), companionSkill: [...new Set(companionSkill)].sort(byId), spellClass };
}

// ---------------------------------------------------------------------------
// Spawns
// ---------------------------------------------------------------------------

// [[x, y], ...] -> [{ x, y, n }] greedy clusters (radius in map percent), biggest first.
function cluster(points, radius = SPAWN.radius) {
	const pts = points
		.filter((p) => Array.isArray(p) && Number.isFinite(Number(p[0])) && Number.isFinite(Number(p[1])))
		.map(([x, y]) => [Number(x), Number(y)])
		.sort((a, b) => a[0] - b[0] || a[1] - b[1]);
	const clusters = [];
	for (const [x, y] of pts) {
		let best = null;
		for (const c of clusters) {
			const dx = c.sx / c.n - x;
			const dy = c.sy / c.n - y;
			if (dx * dx + dy * dy <= radius * radius) {
				best = c;
				break;
			}
		}
		if (best) {
			best.sx += x;
			best.sy += y;
			best.n++;
		} else clusters.push({ sx: x, sy: y, n: 1 });
	}
	return clusters
		.map((c) => ({ x: round1(c.sx / c.n), y: round1(c.sy / c.n), n: c.n }))
		.sort((a, b) => b.n - a.n || a.x - b.x || a.y - b.y);
}

// { map: { f, pts } } (data/forever) -> [{ map, x, y, f }] capped; only maps in `zones`.
function spawnsOf(byMap, zones) {
	const maps = Object.entries(byMap || {})
		.filter(([map]) => !zones || zones[map])
		.map(([map, s]) => ({ map: Number(map), f: s && s.f === 'e' ? 'e' : null, clusters: cluster((s && s.pts) || []) }))
		.filter((m) => m.clusters.length)
		.sort((a, b) => b.clusters.reduce((n, c) => n + c.n, 0) - a.clusters.reduce((n, c) => n + c.n, 0) || a.map - b.map)
		.slice(0, SPAWN.maps);
	const out = [];
	for (const m of maps) for (const c of m.clusters.slice(0, SPAWN.perMap)) out.push({ map: m.map, x: c.x, y: c.y, f: m.f });
	return out;
}

// ---------------------------------------------------------------------------
// Merge
// ---------------------------------------------------------------------------

function fromLabels(list) {
	const out = new Set();
	for (const s of list || []) {
		if (/^questie/.test(s)) out.add('questie');
		else if (s === 'pfquest') out.add('pfquest');
		else if (/^record/.test(s)) out.add('recordings');
		else if (RANK[s] !== undefined) out.add(s);
	}
	if (!out.size) out.add('forever');
	return [...out];
}

function rankOf(from) {
	return Math.min(...from.map((f) => (RANK[f] === undefined ? 5 : RANK[f])));
}

function sortFrom(from) {
	return [...new Set(from)].sort((a, b) => (RANK[a] ?? 5) - (RANK[b] ?? 5) || (a < b ? -1 : 1));
}

function sideOf(side) {
	if (side === 'Alliance' || side === 'A' || side === 1) return 'A';
	if (side === 'Horde' || side === 'H' || side === 2) return 'H';
	return null;
}

function factionOfRaces(races) {
	const r = int(races);
	if (!r) return null;
	const a = (r & ALLIANCE_RACES) !== 0;
	const h = (r & HORDE_RACES) !== 0;
	if (a && !h) return 'A';
	if (h && !a) return 'H';
	return null;
}

// Candidate sources -> deduped, field-merged, capped, ordered list.
function finalizeSources(cands, npcLevel) {
	const groups = new Map();
	for (const c of cands) {
		const kf = KEY_FIELD[c.type];
		const key = `${c.type}|${kf ? c[kf] : ''}`;
		if (!groups.has(key)) groups.set(key, []);
		groups.get(key).push(c);
	}
	let out = [];
	for (const list of groups.values()) {
		list.sort((a, b) => rankOf(a.from) - rankOf(b.from));
		const merged = { type: list[0].type };
		for (const f of SOURCE_FIELDS[merged.type]) {
			for (const c of list) {
				if (c[f] !== null && c[f] !== undefined && c[f] !== false) {
					merged[f] = c[f];
					break;
				}
			}
		}
		merged.from = sortFrom(list.flatMap((c) => c.from));
		out.push(merged);
	}
	const drops = out.filter((s) => s.type === 'drop');
	if (drops.length > WORLD_DROP_NPCS && !out.some((s) => s.type === 'world')) {
		const levels = drops.map((s) => npcLevel(s.npc)).filter((l) => l);
		if (levels.length) {
			const from = sortFrom(drops.flatMap((s) => s.from));
			out.push({ type: 'world', minLevel: Math.min(...levels.map((l) => l[0])), maxLevel: Math.max(...levels.map((l) => l[1])), from });
		}
	}
	const keyOf = (s) => {
		const kf = KEY_FIELD[s.type];
		return kf ? Number(s[kf]) || 0 : 0;
	};
	out.sort(
		(a, b) =>
			TYPE_ORDER.indexOf(a.type) - TYPE_ORDER.indexOf(b.type) ||
			(b.chance ?? -1) - (a.chance ?? -1) ||
			(b.instance ? 1 : 0) - (a.instance ? 1 : 0) ||
			keyOf(a) - keyOf(b),
	);
	const seen = {};
	out = out.filter((s) => {
		seen[s.type] = (seen[s.type] || 0) + 1;
		return !CAP[s.type] || seen[s.type] <= CAP[s.type] || (s.type === 'drop' && s.instance);
	});
	return out;
}

function mergeCodex(inputs) {
	const fv = inputs.forever || {};
	const al = inputs.atlasloot || null;
	const rs = inputs.rarescanner || null;
	const flb = inputs.flbis || null;
	const cl = inputs.client || null;
	const zonesIn = fv.zones || {};
	const warnings = [];

	// ----- zones, factions
	const zones = {};
	for (const [id, z] of Object.entries(zonesIn)) zones[id] = { id: Number(id), name: z.name };
	const factions = {};
	for (const [id, f] of Object.entries(fv.factions || {})) factions[id] = { id: Number(id), name: f.name, side: f.side || null };
	for (const f of (al && al.factions) || []) {
		if (f.factionId && !factions[f.factionId] && f.name) factions[f.factionId] = { id: f.factionId, name: f.name, side: null };
	}

	// ----- npcs
	const npcs = {};
	const npcRoles = {};
	for (const [id, n] of Object.entries(fv.npcs || {})) {
		if (!n.name || JUNK.test(n.name)) continue;
		const rank = int(n.rank);
		npcs[id] = {
			id: Number(id),
			name: n.name,
			level: int(n.level),
			levelMax: int(n.levelMax),
			faction: ['A', 'H', 'AH'].includes(n.faction) ? n.faction : null,
			rare: rank === 2 || rank === 4 || (n.roles || []).includes('rare'),
			elite: rank === 1 || rank === 2 || rank === 3,
			boss: rank === 3,
			instance: null,
			roles: [],
			spawns: spawnsOf(n.spawns, zonesIn),
		};
		npcRoles[id] = new Set((n.roles || []).filter((r) => r !== 'rare'));
	}
	const addRole = (id, role) => {
		if (!npcs[id]) return;
		(npcRoles[id] = npcRoles[id] || new Set()).add(role);
	};
	const skillLineOf = {}; // profession name -> skillLine
	for (const [id, p] of Object.entries(fv.professions || {})) {
		skillLineOf[p.name] = Number(id);
		const trainers = new Set();
		for (const list of Object.values(p.trainers || {})) for (const t of list) trainers.add(t);
		for (const r of p.ranks || []) for (const list of Object.values(r.trainers || {})) for (const t of list) trainers.add(t);
		for (const t of trainers) {
			addRole(t, 'trainer');
			addRole(t, `trainer:${id}`);
		}
	}
	if (cl) for (const [id, name] of Object.entries(cl.skillLines)) if (name && !(name in skillLineOf)) skillLineOf[name] = Number(id);
	for (const [id, t] of Object.entries(fv.trainers || {})) {
		for (const c of t.classes || []) {
			addRole(id, 'trainer');
			addRole(id, `class:${c}`);
		}
	}

	// RareScanner rares (rows outside Forever's zones dropped).
	const rareLoot = {}; // npc -> Set(items)
	if (rs) {
		const rows = new Map();
		for (const r of rs.rares || []) {
			if (!r.npc || !zonesIn[r.map]) continue;
			if (!rows.has(r.npc)) rows.set(r.npc, []);
			rows.get(r.npc).push(r);
		}
		for (const [npc, list] of [...rows.entries()].sort((a, b) => a[0] - b[0])) {
			let rec = npcs[npc];
			const name = rec ? rec.name : list.find((r) => r.name)?.name;
			if (!name) continue;
			if (!rec) {
				rec = npcs[npc] = { id: npc, name, level: null, levelMax: null, faction: null, rare: true, elite: false, boss: false, instance: null, roles: [], spawns: [] };
				npcRoles[npc] = new Set();
			}
			rec.rare = true;
			if (!rec.spawns.length) {
				const byMap = {};
				for (const r of list) {
					const pts = (r.points && r.points.length ? r.points : r.x != null ? [[r.x, r.y]] : []).slice();
					(byMap[r.map] = byMap[r.map] || { f: null, pts: [] }).pts.push(...pts);
				}
				rec.spawns = spawnsOf(byMap, zonesIn);
			}
			const loot = (rareLoot[npc] = rareLoot[npc] || new Set());
			for (const r of list) for (const it of r.loot || []) loot.add(it);
		}
	}

	// ----- instances (AtlasLoot dungeons and raids, entrances from dungeons.json)
	const instances = {};
	const bossInstance = {}; // npc -> key
	const dungeonsByName = {};
	for (const d of (fv.dungeons && fv.dungeons.dungeons) || []) dungeonsByName[normName(d.name)] = d;
	const usedDungeons = new Set();
	const dungeonKey = {}; // dungeons.json key -> instance key
	const atlasKey = {}; // AtlasLoot instance key -> instance key
	// AtlasLoot names are sometimes key-derived ("Ragefire" for Ragefire Chasm):
	// exact normalised name first, then a unique prefix match either way.
	const dungeonList = Object.entries(dungeonsByName);
	const matchDungeon = (inst) => {
		for (const n of [normName(inst.name || ''), normName(inst.key || '')]) {
			if (n && dungeonsByName[n]) return dungeonsByName[n];
		}
		const n = normName(inst.name || inst.key || '');
		if (n.length < 6) return null;
		const hits = dungeonList.filter(([dn]) => dn.startsWith(n) || n.startsWith(dn));
		return hits.length === 1 ? hits[0][1] : null;
	};
	for (const inst of (al && al.instances) || []) {
		if (inst.kind !== 'dungeon' && inst.kind !== 'raid') continue;
		const d = matchDungeon(inst);
		// The DungeonJournal key when it covers the instance (what Dungeons and Journal use).
		const key = d ? slug(d.key) : slug(inst.name || inst.key);
		if (!key || instances[key]) continue;
		atlasKey[inst.key || inst.name] = key;
		if (d) {
			usedDungeons.add(d.key);
			dungeonKey[d.key] = key;
		}
		const entrance = d && d.entrance ? { map: d.entrance.map, x: round1(d.entrance.x), y: round1(d.entrance.y), f: d.entrance.f === 'e' ? 'e' : null } : null;
		const bosses = [];
		for (const b of inst.bosses || []) {
			const npc = Array.isArray(b.npc) ? b.npc[0] ?? null : (b.npc ?? null);
			bosses.push({ name: b.name, npc, items: [...new Set((b.items || []).map((i) => i.item).filter(Boolean))] });
			for (const n of Array.isArray(b.npc) ? b.npc : b.npc ? [b.npc] : []) bossInstance[n] = bossInstance[n] || key;
		}
		// DungeonJournal bosses AtlasLoot lacks (Forever's own encounters).
		for (const b of (d && d.bosses) || []) {
			if (!b.npc || bosses.some((x) => x.npc === b.npc)) continue;
			bosses.push({ name: b.name, npc: b.npc, items: (b.loot || []).map((l) => l.item).filter(Boolean) });
			bossInstance[b.npc] = bossInstance[b.npc] || key;
		}
		instances[key] = {
			key,
			name: (d && d.name) || inst.name,
			kind: inst.kind,
			forever: !!inst.forever,
			areaId: inst.areaId ?? null,
			map: null,
			entrance,
			levels: inst.levels || (d && d.levels ? [d.levels.min, d.levels.min, d.levels.max] : null),
			bosses,
		};
	}
	for (const d of (fv.dungeons && fv.dungeons.dungeons) || []) {
		if (usedDungeons.has(d.key)) continue;
		const key = slug(d.key || d.name);
		if (instances[key]) continue;
		dungeonKey[d.key] = key;
		instances[key] = {
			key,
			name: d.name,
			kind: 'dungeon',
			forever: true,
			areaId: null,
			map: null,
			entrance: d.entrance ? { map: d.entrance.map, x: round1(d.entrance.x), y: round1(d.entrance.y), f: d.entrance.f === 'e' ? 'e' : null } : null,
			levels: d.levels ? [d.levels.min, d.levels.min, d.levels.max] : null,
			bosses: (d.bosses || []).map((b) => ({ name: b.name, npc: b.npc ?? null, items: (b.loot || []).map((l) => l.item).filter(Boolean) })),
		};
		for (const b of d.bosses || []) if (b.npc) bossInstance[b.npc] = bossInstance[b.npc] || key;
	}
	for (const [npc, key] of Object.entries(bossInstance)) {
		if (!npcs[npc]) {
			const boss = instances[key].bosses.find((b) => b.npc === Number(npc));
			if (!boss || !boss.name) continue;
			npcs[npc] = { id: Number(npc), name: boss.name, level: null, levelMax: null, faction: null, rare: false, elite: true, boss: true, instance: key, roles: [], spawns: [] };
			npcRoles[npc] = new Set();
		}
		npcs[npc].boss = true;
		npcs[npc].elite = true;
		npcs[npc].instance = key;
	}
	for (const [id, set] of Object.entries(npcRoles)) if (npcs[id]) npcs[id].roles = [...set].sort();

	// ----- items
	const cands = {}; // item -> [source]
	const add = (item, src) => {
		item = Number(item);
		if (!item) return;
		(cands[item] = cands[item] || []).push(src);
	};
	const names = {};
	for (const [id, it] of Object.entries(fv.items || {})) {
		names[id] = it.name;
		const from = fromLabels(it.source);
		for (const [npc, chance] of Object.entries((it.drops && it.drops.npc) || {})) {
			if (npcs[npc]) add(id, { type: 'drop', npc: Number(npc), chance: Number(chance) || null, instance: bossInstance[npc] || null, from });
		}
		for (const [obj, chance] of Object.entries((it.drops && it.drops.object) || {})) add(id, { type: 'object', object: Number(obj), chance: Number(chance) || null, from });
		// Vendors nobody can find (no spawns, e.g. Forever's GM "World Mount Vendor") are left out.
		for (const npc of it.vendors || []) {
			if (npcs[npc] && npcs[npc].spawns.length) add(id, { type: 'vendor', npc: Number(npc), cost: (cl && cl.items[id] && cl.items[id].buyPrice) || null, from });
		}
		for (const c of it.containers || []) add(id, { type: 'container', item: Number(c), from });
	}
	// Professions: craft sources, recipe items.
	const recipeSpell = {}; // recipe item -> craft spell
	for (const [line, p] of Object.entries(fv.professions || {})) {
		for (const r of p.recipes || []) {
			if (r.item) add(r.item, { type: 'craft', spell: r.spell, skillLine: Number(line), profession: p.name, skill: r.learnedAt ?? null, from: ['forever'] });
			if (r.recipeItem) recipeSpell[r.recipeItem] = r.spell;
		}
	}
	if (al) {
		const rates = al.droprates || {};
		for (const inst of al.instances || []) {
			const key = inst.kind === 'dungeon' || inst.kind === 'raid' ? atlasKey[inst.key || inst.name] || null : null;
			for (const b of inst.bosses || []) {
				const npc = Array.isArray(b.npc) ? b.npc[0] : b.npc;
				for (const i of b.items || []) {
					if (!i.item) continue;
					if (npc) add(i.item, { type: 'drop', npc, chance: i.chance ?? (rates[npc] && rates[npc][i.item]) ?? null, instance: key, from: ['atlasloot'] });
					for (const obj of b.object || []) add(i.item, { type: 'object', object: obj, chance: i.chance ?? null, from: ['atlasloot'] });
				}
			}
		}
		for (const c of al.crafting || []) {
			if (!c.item || !c.spell) continue;
			const line = skillLineOf[c.profession] ?? null;
			if (line !== null) add(c.item, { type: 'craft', spell: c.spell, skillLine: line, profession: c.profession, skill: c.skill ?? null, from: ['atlasloot'] });
		}
		for (const f of al.factions || []) {
			if (!f.factionId) continue;
			for (const r of f.rewards || []) add(r.item, { type: 'rep', faction: f.factionId, standing: r.standing ?? null, from: ['atlasloot'] });
		}
		for (const p of al.pvp || []) add(p.item, { type: 'pvp', rank: p.rank ?? null, from: ['atlasloot'] });
	}
	for (const [npc, loot] of Object.entries(rareLoot)) {
		for (const it of loot) add(it, { type: 'drop', npc: Number(npc), from: ['rarescanner'] });
	}
	// Quest rewards (ForeverLevelingBiS quests, dungeons.json quests).
	const questRewards = {}; // quest -> { rewards: Set, choices: Set }
	const reward = (quest, item, choice) => {
		const q = (questRewards[quest] = questRewards[quest] || { rewards: new Set(), choices: new Set() });
		(choice ? q.choices : q.rewards).add(Number(item));
	};
	const flbQuests = (flb && flb.quests) || {};
	for (const [qid, q] of Object.entries(flbQuests)) {
		for (const it of (q.rewards && q.rewards.items) || []) {
			reward(qid, it, false);
			add(it, { type: 'quest', quest: Number(qid), from: ['flbis'] });
		}
		for (const it of (q.rewards && q.rewards.choices) || []) {
			reward(qid, it, true);
			add(it, { type: 'quest', quest: Number(qid), choice: true, from: ['flbis'] });
		}
	}
	const dungeonQuests = {};
	const dungeonItems = {}; // item -> { name, quality } (Forever dungeon loot the other tables may lack)
	const itemRef = (x) => {
		if (x && typeof x === 'object') {
			if (x.item && x.name && !dungeonItems[x.item]) dungeonItems[x.item] = { name: x.name, quality: x.quality ?? null };
			return x.item;
		}
		return x;
	};
	for (const d of (fv.dungeons && fv.dungeons.dungeons) || []) {
		const key = dungeonKey[d.key] || null;
		for (const b of d.bosses || []) {
			for (const l of b.loot || []) {
				const item = itemRef(l);
				if (item && b.npc) add(item, { type: 'drop', npc: b.npc, instance: key, from: ['dungeons'] });
			}
		}
		for (const q of d.quests || []) {
			dungeonQuests[q.id] = q;
			for (const x of (q.rewards && q.rewards.items) || []) {
				const it = itemRef(x);
				reward(q.id, it, false);
				add(it, { type: 'quest', quest: q.id, from: ['dungeons'] });
			}
			for (const x of (q.rewards && q.rewards.choices) || []) {
				const it = itemRef(x);
				reward(q.id, it, true);
				add(it, { type: 'quest', quest: q.id, choice: true, from: ['dungeons'] });
			}
		}
	}
	for (const [id, x] of Object.entries(dungeonItems)) if (!names[id]) names[id] = x.name;
	if (flb) {
		for (const [id, it] of Object.entries(flb.items || {})) {
			if (it.name && !names[id]) names[id] = it.name;
			for (const s of it.sources || []) {
				if (s.type === 'quest' && s.id) {
					const choice = !!(flbQuests[s.id] && flbQuests[s.id].rewards && (flbQuests[s.id].rewards.choices || []).includes(Number(id)));
					add(id, { type: 'quest', quest: s.id, choice: choice || null, from: ['flbis'] });
				} else if (s.type === 'drop' && s.npcId) {
					add(id, { type: 'drop', npc: s.npcId, chance: s.pct || null, instance: bossInstance[s.npcId] || null, from: ['flbis'] });
				} else if (s.type === 'crafted' && s.spellId) {
					const line = skillLineOf[s.profession] ?? null;
					if (line !== null) add(id, { type: 'craft', spell: s.spellId, skillLine: line, profession: s.profession, skill: s.skill ?? null, from: ['flbis'] });
				}
			}
		}
	}
	if (al) for (const c of al.collections || []) if (c.item && !names[c.item] && cl && cl.items[c.item]) names[c.item] = cl.items[c.item].name;

	// Collectible classification.
	const mountItems = new Set();
	const petItems = new Set();
	const tabardItems = new Set();
	for (const c of (al && al.collections) || []) {
		if (c.group === 'Mounts') mountItems.add(Number(c.item));
		else if (c.group === 'Companions') petItems.add(Number(c.item));
		else if (c.group === 'Tabards') tabardItems.add(Number(c.item));
	}
	for (const list of Object.values((rs && rs.mounts) || {})) for (const it of list) mountItems.add(Number(it));
	for (const list of Object.values((rs && rs.pets) || {})) for (const it of list) petItems.add(Number(it));
	if (cl) {
		for (const [id, it] of Object.entries(cl.items)) {
			const learn = it.learn;
			if ((it.classId === 15 && it.subclassId === 5) || (learn && cl.mountAura.has(learn))) {
				mountItems.add(Number(id));
				if (!names[id] && !it.era) names[id] = it.name;
			} else if (it.classId === 15 && it.subclassId === 2 && learn) {
				petItems.add(Number(id));
				if (!names[id] && !it.era) names[id] = it.name;
			}
		}
	}

	// Mounts and pets that are no longer obtainable. AtlasLoot Forever's
	// collection lists and Polestar's own curated guides (`collects`) name the
	// collectibles the game hands out; the Era databases (pfQuest, and Questie
	// where it inherits them) still list vendor stock that was retired or
	// replaced (the pre-1.4 epic mounts the exchange quests traded in). A mount
	// or pet whose every source is such an Era vendor row, and that neither
	// list names, is retired. Forever-only rows (Questie without pfQuest) are
	// trusted: AtlasLoot lags behind Forever's new collectibles.
	const listed = new Set([...((al && al.collections) || []).map((c) => Number(c.item)), ...(inputs.curated || []).map(Number)]);
	const statusOf = (id, kind, sources) => {
		if (!sources.length) return 'nosource';
		if (kind !== 'mount' && kind !== 'pet') return null;
		if (listed.has(id)) return null;
		const eraVendor = (s) => s.type === 'vendor' && (s.from || []).includes('pfquest');
		return sources.every(eraVendor) ? 'retired' : null;
	};

	const npcLevel = (id) => {
		const n = npcs[id];
		if (!n || !n.level) return null;
		return [n.level, n.levelMax || n.level];
	};
	const items = {};
	const allIds = new Set([...Object.keys(names), ...Object.keys(cands)].map(Number));
	for (const id of [...allIds].sort(byId)) {
		const c = cl && cl.items[id];
		const name = names[id] || (c && c.name);
		if (!name) continue;
		const list = (cands[id] || []).slice();
		if (c && c.minFaction) {
			const vendor = list.find((s) => s.type === 'vendor');
			list.push({ type: 'rep', faction: c.minFaction, standing: c.minStanding, npc: vendor ? vendor.npc : null, from: ['client'] });
		}
		if (c && c.pvpRank) {
			const vendor = list.find((s) => s.type === 'vendor');
			list.push({ type: 'pvp', rank: c.pvpRank, npc: vendor ? vendor.npc : null, from: ['client'] });
		}
		for (const s of list) {
			if (s.type === 'rep' && s.npc == null) {
				const vendor = list.find((v) => v.type === 'vendor');
				if (vendor) s.npc = vendor.npc;
			}
		}
		const sources = finalizeSources(list, npcLevel);
		if (!sources.length && JUNK.test(name)) continue;
		let kind = 'item';
		if (mountItems.has(id)) kind = 'mount';
		else if (petItems.has(id)) kind = 'pet';
		else if ((c && c.classId === 9) || recipeSpell[id]) kind = 'recipe';
		else if (tabardItems.has(id) || (c && c.inventoryType === 19)) kind = 'tabard';
		let spell = null;
		if (kind === 'mount' || kind === 'pet') spell = (c && (c.learn || c.use)) || null;
		else if (kind === 'recipe') spell = recipeSpell[id] || (c && c.learn) || null;
		// Purchase requirements: reputation (standing 1..8, Hated..Exalted, as
		// Compat.GetFactionStanding) and profession skill, from the client tables.
		// Some reputation vendors gate items in their gossip, not in ItemSparse
		// (13086 Winterspring Frostsaber): an item both sold and listed as a
		// reputation reward takes that reward's faction and standing.
		let repFaction = (c && c.minFaction) || null;
		let repStanding = repFaction ? c.minStanding : null;
		const rep = !repFaction && sources.some((s) => s.type === 'vendor') ? sources.find((s) => s.type === 'rep' && s.faction && s.standing) : null;
		if (rep) {
			repFaction = rep.faction;
			repStanding = rep.standing;
		}
		items[id] = {
			id,
			name,
			quality: c && c.quality != null ? c.quality : dungeonItems[id] ? dungeonItems[id].quality : null,
			kind,
			spell,
			reqLevel: c ? c.reqLevel : null,
			repFaction,
			repStanding,
			reqSkill: c ? c.reqSkill : null,
			reqSkillRank: c ? c.reqSkillRank : null,
			status: statusOf(id, kind, sources),
			sources,
		};
	}

	// ----- spells (mount / pet summons, class mounts)
	const spells = {};
	if (cl) {
		for (const id of Object.keys(items).map(Number).sort(byId)) {
			const it = items[id];
			if ((it.kind === 'mount' || it.kind === 'pet') && it.spell && !spells[it.spell]) {
				spells[it.spell] = { kind: it.kind, item: id, name: cl.spellNames[it.spell] || it.name, class: cl.spellClass[it.spell] || null };
			}
		}
		for (const spell of cl.mountSkill) {
			if (spells[spell] || !cl.mountAura.has(spell)) continue;
			spells[spell] = { kind: 'mount', item: null, name: cl.spellNames[spell] || `Spell ${spell}`, class: cl.spellClass[spell] || null };
		}
		for (const spell of cl.companionSkill) {
			if (spells[spell]) continue;
			spells[spell] = { kind: 'pet', item: null, name: cl.spellNames[spell] || `Spell ${spell}`, class: null };
		}
	}

	// ----- objects: treasures, item sources, quest starts/ends/objectives
	const wantObjects = new Set();
	for (const it of Object.values(items)) for (const s of it.sources) if (s.type === 'object') wantObjects.add(s.object);
	const questsIn = fv.quests || {};
	for (const q of Object.values(questsIn)) {
		for (const o of (q.start && q.start.object) || []) wantObjects.add(o);
		for (const o of (q.end && q.end.object) || []) wantObjects.add(o);
		for (const o of q.objectives || []) if (o.type === 'object' && o.id) wantObjects.add(o.id);
	}
	const objects = {};
	for (const [id, o] of Object.entries(fv.objects || {})) {
		const treasure = (o.roles || []).includes('chest');
		if (!treasure && !wantObjects.has(Number(id))) continue;
		if (!o.name || JUNK.test(o.name)) continue;
		objects[id] = { id: Number(id), name: o.name, treasure, spawns: spawnsOf(o.spawns, zonesIn) };
	}
	const treasureLoot = {}; // object -> Set(items) (RareScanner)
	for (const t of (rs && rs.treasures) || []) {
		if (!t.object || !zonesIn[t.map]) continue;
		let o = objects[t.object];
		if (!o) {
			const name = (fv.objects && fv.objects[t.object] && fv.objects[t.object].name) || t.name;
			if (!name) continue;
			o = objects[t.object] = { id: t.object, name, treasure: true, spawns: [] };
		}
		o.treasure = true;
		if (!o.spawns.length) o.spawns = spawnsOf({ [t.map]: { f: null, pts: t.points && t.points.length ? t.points : [[t.x, t.y]] } }, zonesIn);
		const loot = (treasureLoot[t.object] = treasureLoot[t.object] || new Set());
		for (const it of t.loot || []) loot.add(Number(it));
	}

	// ----- quests
	const quests = {};
	const questIds = new Set([...Object.keys(questsIn), ...Object.keys(questRewards)].map(Number));
	// Blocking prerequisites only (breadcrumbs, the quest itself and exclusives dropped).
	const prereqs = (q) => {
		const { all, any } = blockingPrereqs(q, (qid) => questsIn[qid] || null);
		return { pre: [...all], preAny: [...any] };
	};
	for (const id of [...questIds].sort(byId)) {
		const q = questsIn[id];
		const r = questRewards[id];
		const rewards = r ? [...r.rewards].sort(byId) : [];
		const choices = r ? [...r.choices].sort(byId) : [];
		if (q) {
			quests[id] = {
				id,
				title: q.title,
				level: int(q.level),
				minLevel: int(q.minLevel),
				faction: factionOfRaces(q.races),
				races: int(q.races),
				classes: int(q.classes),
				start: { npc: (q.start && q.start.npc) || [], object: (q.start && q.start.object) || [], item: (q.start && q.start.item) || [] },
				end: { npc: (q.end && q.end.npc) || [], object: (q.end && q.end.object) || [] },
				objectives: (q.objectives || []).filter((o) => ['kill', 'item', 'object', 'event'].includes(o.type)).map((o) => ({ type: o.type, id: o.id ?? null, count: o.count ?? null, text: o.text ?? null })),
				...prereqs(q),
				zone: int(q.zone),
				rewards,
				choices,
			};
			continue;
		}
		const f = flbQuests[id];
		const d = dungeonQuests[id];
		const title = (f && f.name) || (d && d.title);
		if (!title) continue;
		quests[id] = {
			id,
			title,
			level: int((f && f.level) ?? (d && d.level)),
			minLevel: int((f && (f.minLevel ?? f.reqLevel)) ?? (d && d.minLevel)),
			faction: f ? sideOf(f.side) : d ? sideOf(d.faction) : null,
			races: null,
			classes: null,
			start: { npc: f && f.start && f.start.id ? [f.start.id] : [], object: [], item: [] },
			end: { npc: [], object: [] },
			objectives: [],
			pre: [],
			preAny: [],
			zone: null,
			rewards,
			choices,
		};
	}

	// ----- loot of rares and treasures: RareScanner loot plus every drop/object
	// candidate naming them (before the per-item caps), items known to the Codex only.
	const lootOf = (rec, chances, listed) => {
		const ids = new Set([...(listed || []), ...chances.keys()].filter((id) => items[id]));
		rec.loot = [...ids]
			.sort((a, b) => (chances.get(b) ?? -1) - (chances.get(a) ?? -1) || (items[b].quality ?? -1) - (items[a].quality ?? -1) || a - b)
			.slice(0, LOOT_CAP);
	};
	const npcChances = {};
	const objectChances = {};
	for (const [item, list] of Object.entries(cands)) {
		for (const s of list) {
			const table = s.type === 'drop' ? npcChances : s.type === 'object' ? objectChances : null;
			if (!table) continue;
			const key = s.type === 'drop' ? s.npc : s.object;
			const m = (table[key] = table[key] || new Map());
			const best = m.get(Number(item));
			const chance = s.chance ?? null;
			if (best === undefined || (chance !== null && (best === null || chance > best))) m.set(Number(item), chance);
		}
	}
	for (const [id, n] of Object.entries(npcs)) {
		if (n.rare) lootOf(n, npcChances[id] || new Map(), rareLoot[id]);
		else n.loot = [];
	}
	for (const [id, o] of Object.entries(objects)) {
		if (o.treasure) lootOf(o, objectChances[id] || new Map(), treasureLoot[id]);
		else o.loot = [];
	}

	// ----- NPCs nobody can meet: no spawns, no role, and nothing refers to them
	const refNpcs = new Set();
	for (const it of Object.values(items)) for (const s of it.sources) if (s.npc) refNpcs.add(Number(s.npc));
	for (const q of Object.values(quests)) {
		for (const n of q.start.npc) refNpcs.add(Number(n));
		for (const n of q.end.npc) refNpcs.add(Number(n));
		for (const o of q.objectives) if (o.type === 'kill' && o.id) refNpcs.add(Number(o.id));
	}
	for (const i of Object.values(instances)) for (const b of i.bosses) if (b.npc) refNpcs.add(Number(b.npc));
	for (const [id, n] of Object.entries(npcs)) {
		if (!n.spawns.length && !n.roles.length && !n.rare && !n.boss && !refNpcs.has(Number(id))) delete npcs[id];
	}

	// ----- frames for every Era-frame map referenced
	const frames = {};
	const era = (fv.mapFrames && fv.mapFrames.era) || {};
	const want = (m, f) => {
		if (f === 'e' && era[m]) frames[m] = era[m];
	};
	for (const n of Object.values(npcs)) for (const s of n.spawns) want(s.map, s.f);
	for (const o of Object.values(objects)) for (const s of o.spawns) want(s.map, s.f);
	for (const i of Object.values(instances)) if (i.entrance) want(i.entrance.map, i.entrance.f);

	return { items, npcs, objects, quests, instances, zones, factions, spells, frames, warnings };
}

// counts / coverage for meta.json
function summarize(codex) {
	const counts = { item: 0, mount: 0, pet: 0, recipe: 0, tabard: 0, npc: 0, rare: 0, quest: 0, zone: 0, instance: 0, treasure: 0, object: 0 };
	let withSource = 0;
	const items = Object.values(codex.items);
	for (const it of items) {
		counts[it.kind]++;
		if (it.sources.length) withSource++;
	}
	for (const n of Object.values(codex.npcs)) counts[n.rare ? 'rare' : 'npc']++;
	for (const o of Object.values(codex.objects)) counts[o.treasure ? 'treasure' : 'object']++;
	counts.quest = Object.keys(codex.quests).length;
	counts.zone = Object.keys(codex.zones).length;
	counts.instance = Object.keys(codex.instances).length;
	return { counts, coverage: { items: items.length, withSource, share: items.length ? Math.round((withSource / items.length) * 1000) / 1000 : 0 } };
}

// ---------------------------------------------------------------------------
// Pack memory (lua5.1, the real Codex.lua)
// ---------------------------------------------------------------------------

function luaString(s) {
	return '"' + String(s).replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\n/g, '\\n') + '"';
}

// files: absolute pack files in TOC order -> { rawKB, decodedKB }
function measureMemory(files) {
	const { findLua } = require('../lua');
	const codexLua = path.join(ROOT, 'addon', 'Polestar', 'Lookup', 'Codex.lua');
	const program = `
local ns = {}
Polestar = ns
function ns.RegisterMapFrames() end
loadfile(${luaString(codexLua)})("Polestar", ns)
local C = ns.Codex
collectgarbage("collect"); collectgarbage("collect")
local base = collectgarbage("count")
local t0 = os.clock()
for _, f in ipairs({ ${files.map(luaString).join(', ')} }) do dofile(f) end
local loadMs = (os.clock() - t0) * 1000
collectgarbage("collect"); collectgarbage("collect")
local raw = collectgarbage("count") - base
local keep = {}
local get = { item = C.Item, mount = C.Item, pet = C.Item, recipe = C.Item, tabard = C.Item, npc = C.Npc, rare = C.Npc,
	object = C.Object, treasure = C.Object, quest = C.Quest, instance = C.Instance, zone = C.Zone, faction = C.Faction, spell = C.Spell }
for kind, fn in pairs(get) do
	C.Each(kind, function(id) keep[#keep + 1] = fn(id) end)
end
collectgarbage("collect"); collectgarbage("collect")
local decoded = collectgarbage("count") - base
io.write(string.format("%.1f %.1f %d %.1f\\n", raw, decoded, #keep, loadMs))
`;
	const file = path.join(os.tmpdir(), `polestar-codex-mem-${process.pid}.lua`);
	fs.writeFileSync(file, program);
	try {
		const r = spawnSync(findLua(), [file], { encoding: 'utf8', maxBuffer: 16 * 1024 * 1024 });
		if (r.status !== 0) throw new Error(`measuring pack memory failed:\n${r.stderr}`);
		const [rawKB, decodedKB, records, loadMs] = r.stdout.trim().split(/\s+/).map(Number);
		return { rawKB, decodedKB, records, loadMs };
	} finally {
		fs.rmSync(file, { force: true });
	}
}

// ---------------------------------------------------------------------------
// I/O
// ---------------------------------------------------------------------------

function readJson(file, optional = false) {
	if (!fs.existsSync(file)) {
		if (optional) return null;
		throw new Error(`missing ${path.relative(process.cwd(), file)} (run \`node tools/polestar.js data build\` first)`);
	}
	return JSON.parse(fs.readFileSync(file, 'utf8'));
}

function packageVersion() {
	try {
		return JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8')).version || '0.0.0';
	} catch {
		return '0.0.0';
	}
}

function writeAtomic(file, text) {
	fs.mkdirSync(path.dirname(file), { recursive: true });
	fs.writeFileSync(`${file}.tmp`, text);
	fs.renameSync(`${file}.tmp`, file);
}

// Replaces the pack folder as a whole: written beside it, then swapped in.
function writePackDir(dir, files) {
	const tmp = `${dir}.tmp-${process.pid}`;
	fs.rmSync(tmp, { recursive: true, force: true });
	fs.mkdirSync(tmp, { recursive: true });
	for (const [rel, text] of Object.entries(files)) fs.writeFileSync(path.join(tmp, rel), text);
	const old = `${dir}.old-${process.pid}`;
	if (fs.existsSync(dir)) fs.renameSync(dir, old);
	fs.renameSync(tmp, dir);
	fs.rmSync(old, { recursive: true, force: true });
}

async function loadInputs({ addons, offline = false, dataDir, sourcesDir, build = BUILD, fetchImpl, log = () => {} } = {}) {
	dataDir = dataDir || path.join(ROOT, 'data', 'forever');
	sourcesDir = sourcesDir || path.join(ROOT, 'data', 'sources');
	const j = (f, opt) => readJson(path.join(dataDir, f), opt);
	const forever = {
		items: j('items.json'),
		npcs: j('npcs.json'),
		objects: j('objects.json'),
		quests: j('quests.json'),
		zones: j('zones.json'),
		factions: j('factions.json'),
		professions: j('professions.json', true) || {},
		trainers: j('trainers.json', true) || {},
		mapFrames: j('map-frames.json', true) || {},
		meta: j('meta.json', true) || {},
		dungeons: j('dungeons.json', true),
	};
	const warnings = [];
	const { resolveAddonsDir } = require('../addons');
	const dir = resolveAddonsDir(addons);
	let atlasloot = null;
	let rarescanner = null;
	let flbis = null;
	if (!dir) warnings.push('no Forever AddOns folder found (pass --addons): AtlasLoot, RareScanner and ForeverLevelingBiS skipped');
	else {
		log(`reading addons in ${dir}`);
		const { readAtlasLoot } = require('../consume/atlasloot');
		const { readRareScanner } = require('../consume/rarescanner');
		const { readForeverLevelingBiS } = require('../consume/foreverlevelingbis');
		atlasloot = readAtlasLoot(dir);
		rarescanner = readRareScanner(dir);
		for (const w of [...((atlasloot.meta && atlasloot.meta.warnings) || []), ...((rarescanner.meta && rarescanner.meta.warnings) || [])]) warnings.push(w);
		try {
			flbis = readForeverLevelingBiS({ addons: dir });
		} catch (err) {
			warnings.push(err.message);
		}
	}
	const { loadTables } = require('../professions/tables');
	const loaded = await loadTables({ sourcesDir, build, offline, fetchImpl, log, tables: TABLES });
	warnings.push(...loaded.warnings);
	const client = clientFacts(loaded.tables, loaded.build);
	client.instanceMaps = require('./journal').instanceMapsOf(loaded.tables.Map || [], loaded.tables.AreaTable || []);
	try {
		const era = await loadTables({ sourcesDir, build: ERA_BUILD, offline, fetchImpl, log, tables: ERA_TABLES });
		const eraItems = clientFacts(era.tables, era.build).items;
		let filled = 0;
		for (const [id, it] of Object.entries(eraItems)) {
			if (client.items[id]) continue;
			client.items[id] = { ...it, era: true };
			filled++;
		}
		client.eraBuild = era.build;
		log(`${filled} items only in the Era client tables (${era.build})`);
	} catch (err) {
		warnings.push(`Era client tables ${ERA_BUILD}: ${err.message}`);
	}
	return { forever, atlasloot, rarescanner, flbis, client, curated: curatedCollects(), warnings };
}

// Item ids that Polestar's own guides obtain (`collects` headers under guides/).
function curatedCollects(dir = path.join(ROOT, 'guides')) {
	const out = new Set();
	const walk = (d) => {
		if (!fs.existsSync(d)) return;
		for (const e of fs.readdirSync(d, { withFileTypes: true })) {
			const p = path.join(d, e.name);
			if (e.isDirectory()) walk(p);
			else if (e.name.endsWith('.guide')) {
				const m = fs.readFileSync(p, 'utf8').match(/^collects\s+(.+)$/m);
				if (m) for (const id of m[1].split(/[\s,]+/)) if (/^\d+$/.test(id)) out.add(Number(id));
			}
		}
	};
	walk(dir);
	return [...out].sort(byId);
}

function sourcesMeta(inputs) {
	const out = [];
	const fm = inputs.forever.meta || {};
	for (const s of fm.sources || []) out.push({ name: s.name, version: s.revision || s.version || null, licence: s.license || s.licence || null });
	const imp = [
		[inputs.atlasloot, 'AtlasLootClassic', 'GPL-2.0'],
		[inputs.rarescanner, 'RareScanner', 'All Rights Reserved'],
		[inputs.flbis, 'ForeverLevelingBiS', 'MIT'],
	];
	for (const [x, name, licence] of imp) if (x) out.push({ name, version: (x.meta && x.meta.version) || null, licence: (x.meta && x.meta.licence) || licence });
	const d = inputs.forever.dungeons;
	if (d && d.source) out.push({ name: `dungeons.json (${d.source.name || 'DungeonJournal'})`, version: d.source.version || null, licence: 'All Rights Reserved' });
	if (inputs.client) out.push({ name: 'World of Warcraft: Forever client tables via wago.tools', version: inputs.client.build, licence: 'Blizzard Entertainment game data, facts only' });
	if (inputs.client && inputs.client.eraBuild) out.push({ name: 'World of Warcraft Classic Era client item tables via wago.tools (items missing from the Forever tables)', version: inputs.client.eraBuild, licence: 'Blizzard Entertainment game data, facts only' });
	return out;
}

// -> { codex, files, outDir, packDir, bytes, memory, warnings, ms }
async function buildCodex(opts = {}) {
	const t0 = Date.now();
	const log = opts.log || (() => {});
	const outDir = opts.outDir || path.join(ROOT, 'data', 'forever', 'codex');
	const packDir = opts.packDir || path.join(ROOT, 'addon', ADDON);
	const inputs = opts.inputs || (await loadInputs(opts));
	log('merging');
	const merged = mergeCodex(inputs);
	const { warnings: mergeWarnings, frames, ...codex } = merged;
	const { counts, coverage } = summarize(codex);
	const meta = {
		schema: SCHEMA,
		builtAt: opts.builtAt || (inputs.forever.meta && inputs.forever.meta.builtAt) || null,
		build: (inputs.client && inputs.client.build) || BUILD,
		sources: sourcesMeta(inputs),
		counts,
		coverage,
		pack: null,
	};
	const version = opts.version || packageVersion();
	// The pack's own size goes into meta.json, not into the pack (that would be circular).
	const extraFiles = [];
	// The Dungeons journal (tools/lib/codex/journal.js) rides in this pack.
	const { buildJournal, emitJournal } = require('./journal');
	const journal = buildJournal(inputs, codex);
	extraFiles.push(...emitJournal(journal));
	const files = emitPack({ ...codex, meta, frames }, { version, build: meta.build, extraFiles });
	const bytes = Object.values(files).reduce((n, t) => n + Buffer.byteLength(t), 0);
	writePackDir(packDir, files);
	let memory = null;
	if (opts.measure !== false) {
		log('measuring pack memory');
		memory = measureMemory(packOrder(files).map((f) => path.join(packDir, f)));
	}
	meta.pack = {
		files: Object.keys(files).length,
		bytes,
		memoryKB: memory ? memory.rawKB : null,
		memoryKBDecoded: memory ? memory.decodedKB : null,
		loadMs: memory ? memory.loadMs : null,
	};
	const out = { meta, items: codex.items, npcs: codex.npcs, objects: codex.objects, quests: codex.quests, instances: codex.instances, zones: codex.zones, factions: codex.factions, spells: codex.spells, frames };
	out.journal = journal;
	for (const [name, value] of Object.entries(out)) writeAtomic(path.join(outDir, `${name}.json`), `${JSON.stringify(sortKeysDeep(value), null, '\t')}\n`);
	return { codex: out, files, outDir, packDir, bytes, memory, warnings: [...(inputs.warnings || []), ...mergeWarnings], ms: Date.now() - t0 };
}

module.exports = { buildCodex, loadInputs, mergeCodex, clientFacts, cluster, slug, BUILD, TABLES };
