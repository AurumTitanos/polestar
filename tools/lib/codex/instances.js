'use strict';
// The Codex's dungeons and raids from release-safe facts: the Forever
// client's tables (Map, DungeonEncounter, LFGDungeons, MapDifficulty,
// ContentTuning, AreaTable), data/forever/npcs.json and items.json
// (pfQuest, QuestieDB, recordings), data/forever/instances.json (Recorder
// `enter` / `encounter` events) and the entrance points Polestar's own guides
// name. Replaces AtlasLoot and DungeonJournal in a release build
// (docs/ARCHITECTURE.md, "Codex (`codex build`)").
//
//   instanceFacts(tables, eraMapRows)  client CSV rows -> facts (below)
//   buildInstances(facts, ctx)          -> { instances: { key: Instance }, bossInstance: { npc: key },
//                                          npcInstance: { npc: key } (bosses and every NPC placed inside) }
//   curatedEntrances(guidesDir)         -> [ { label, map|null, zone|null, x, y } ] (goto lines with a label)
//
// facts = { maps: instanceMapsOf rows (journal.js), encounters: { mapId: [ { id, name, order } ] },
//   recMin: { mapId: level }, entry: { mapId: level }, era: Set(mapId)|null, lfgNames: [normalised names] }
// Instance = { key, name, kind, forever, areaId, map, entrance, levels: [entry, min, max], bosses: [ { name, npc, items } ] }
//
// Rules (facts only):
//   which maps   Map InstanceType 1 (dungeon) / 2 (raid) named by an
//                LFGDungeons entry (Forever's dungeon finder), or of the
//                original game (map id below 1000) with DungeonEncounter rows.
//                The Era client's Season of Discovery maps (2700+) are not
//                Forever's and stay out.
//   forever      the map is absent from the Classic Era client's Map table.
//   bosses       DungeonEncounter rows of difficulty 0/1 (else the lowest one
//                listed), by OrderIndex, one per name; "A and B" encounters
//                name two NPCs. Each name is matched to npcs.json: a recorded
//                encounter's NPCs first, then the same name among NPCs placed
//                in that instance (npcs.json `instances`), then the same name
//                (without open-world spawns, elite, nearest the instance's
//                level first), then one spawnless NPC whose name starts with
//                it or is within two letters of it. No match keeps the boss
//                without an NPC.
//   levels       entry: MapDifficulty's "at least level N" message; min:
//                ContentTuning MinLevelSquish of the map's LFGDungeons entries
//                (or MapDifficulty's); max: the highest boss level, at most 60.
//   entrance     a recorded entrance (Recorder `enter`), else the map's Corpse
//                point (where a ghost comes back) on the zone holding it,
//                else a guide's `goto x,y "<instance name> ..."` line.
//                AreaTrigger rows name no instance, and the trigger nearest
//                the Corpse point is as often a city or inn trigger, so they
//                are not used.
//   loot         a boss's items: its npcs.json drops at MIN_LOOT% or more
//                (pfQuest, QuestieDB, recordings), best chance first.

const fs = require('node:fs');
const path = require('node:path');
const { instanceMapsOf, zonePoint } = require('./journal');

const MIN_LOOT = 1; // % below which an item is a world drop, not the boss's loot
const BOSS_LOOT_CAP = 30;
// Maps of the original game; the Era client also carries Season of Discovery's
// (2700+), which Forever lists in no dungeon finder.
const ORIGINAL_MAPS = 1000;
const MAX_LEVEL = 60;
const SKIP_MAP = /^(?:<unused>|Test Dungeon|CashTest)|\bTest\b/i;

const num = (v) => {
	const n = Number(v);
	return Number.isFinite(n) ? n : 0;
};
const norm = (s) =>
	String(s || '')
		.normalize('NFKD')
		.replace(/[\u0300-\u036f]/g, '')
		.toLowerCase()
		.replace(/^the\s+/, '')
		.replace(/[^a-z0-9]/g, '');
const round1 = (v) => Math.round(v * 10) / 10;

// Levenshtein distance of a and b is at most `max`.
function editWithin(a, b, max) {
	if (Math.abs(a.length - b.length) > max) return false;
	let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
	for (let i = 1; i <= a.length; i++) {
		const cur = [i];
		let low = i;
		for (let j = 1; j <= b.length; j++) {
			cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
			low = Math.min(low, cur[j]);
		}
		if (low > max) return false;
		prev = cur;
	}
	return prev[b.length] <= max;
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

// ---------------------------------------------------------------------------
// Client tables -> facts
// ---------------------------------------------------------------------------

function instanceFacts(tables = {}, eraMapRows = null) {
	const maps = instanceMapsOf(tables.Map || [], tables.AreaTable || []);
	const byDiff = {};
	for (const r of tables.DungeonEncounter || []) {
		const map = num(r.MapID);
		if (!map || !r.Name_lang) continue;
		((byDiff[map] = byDiff[map] || {})[num(r.DifficultyID)] = byDiff[map][num(r.DifficultyID)] || []).push({ id: num(r.ID), name: r.Name_lang, order: num(r.OrderIndex) });
	}
	const encounters = {};
	for (const [map, diffs] of Object.entries(byDiff)) {
		const keys = Object.keys(diffs).map(Number);
		const normal = keys.filter((d) => d === 0 || d === 1);
		const use = normal.length ? normal : [Math.min(...keys)];
		const rows = use.flatMap((d) => diffs[d]).sort((a, b) => a.order - b.order || a.id - b.id);
		const seen = new Set();
		encounters[map] = rows.filter((r) => !seen.has(norm(r.name)) && seen.add(norm(r.name)));
	}
	const tuning = {};
	for (const r of tables.ContentTuning || []) tuning[num(r.ID)] = num(r.MinLevelSquish) || null;
	const entry = {};
	const recMin = {};
	const mapDiffs = (tables.MapDifficulty || []).slice().sort((a, b) => num(a.DifficultyID) - num(b.DifficultyID) || num(a.ID) - num(b.ID));
	for (const r of mapDiffs) {
		const map = num(r.MapID);
		const m = /at least level (\d+)/i.exec(r.Message_lang || '');
		if (m && !entry[map]) entry[map] = Number(m[1]);
		const t = tuning[num(r.ContentTuningID)];
		if (t && !recMin[map]) recMin[map] = t;
	}
	// LFGDungeons rows carry no map id: matched by name ("Dire Maul - East" in Dire Maul).
	const lfgMin = {};
	for (const r of tables.LFGDungeons || []) {
		if (num(r.TypeID) !== 0 && num(r.TypeID) !== 2) continue;
		const t = tuning[num(r.ContentTuningID)];
		if (!t || !r.Name_lang) continue;
		const n = norm(r.Name_lang);
		for (const m of maps) {
			const mn = norm(m.name);
			if (mn && (n === mn || (n.startsWith(mn) && mn.length >= 6) || (n.endsWith(mn) && mn.length >= 6))) lfgMin[m.id] = Math.min(lfgMin[m.id] || Infinity, t);
		}
	}
	for (const [map, t] of Object.entries(lfgMin)) recMin[map] = t;
	const era = eraMapRows ? new Set(eraMapRows.map((r) => num(r.ID))) : null;
	const lfgNames = new Set((tables.LFGDungeons || []).map((r) => norm(r.Name_lang)));
	return { maps, encounters, recMin, entry, era, lfgNames: [...lfgNames] };
}

// ---------------------------------------------------------------------------
// Guides: goto lines that name a place
// ---------------------------------------------------------------------------

function curatedEntrances(dir) {
	const out = [];
	if (!dir || !fs.existsSync(dir)) return out;
	const { parseGuide } = require('../dsl/parse');
	const { Diagnostics } = require('../dsl/diag');
	const { findGuideFiles } = require('../dsl/project');
	for (const rel of findGuideFiles(dir).sort()) {
		const ast = parseGuide(fs.readFileSync(path.join(dir, rel), 'utf8'), rel, new Diagnostics());
		for (const step of (ast && ast.steps) || []) {
			for (const g of step.goals || []) {
				if (g.verb !== 'goto' || !g.text || g.x == null) continue;
				const zone = g.zone || null;
				out.push({ label: g.text, map: g.coordMap ?? (zone && zone.map) ?? null, zone: zone && zone.name ? zone.name : null, x: g.x, y: g.y });
			}
		}
	}
	return out;
}

// ---------------------------------------------------------------------------
// Instances
// ---------------------------------------------------------------------------

// ctx = { npcs: npcs.json, items: items.json, zones: zones.json, frames: map-frames.json
//   forever frames, recorded: instances.json (Recorder), curated: curatedEntrances() }
function buildInstances(facts, ctx = {}) {
	const npcsIn = ctx.npcs || {};
	const itemsIn = ctx.items || {};
	const zonesIn = ctx.zones || {};
	const recorded = ctx.recorded || {};
	const lfg = new Set(facts.lfgNames || []);

	// Name -> npcs.json ids.
	const byName = {};
	for (const [id, n] of Object.entries(npcsIn)) {
		const k = norm(n.name);
		if (k) (byName[k] = byName[k] || []).push(Number(id));
	}
	const spawnless = (n) => !Object.values(n.spawns || {}).some((s) => s && (s.pts || []).length);
	const spawnlessNames = Object.keys(byName).filter((k) => byName[k].some((id) => spawnless(npcsIn[id])));
	const lootOf = {}; // npc -> [[item, chance]]
	for (const [id, it] of Object.entries(itemsIn)) {
		for (const [npc, chance] of Object.entries((it.drops && it.drops.npc) || {})) {
			const c = Number(chance);
			if (!(c >= MIN_LOOT)) continue;
			(lootOf[npc] = lootOf[npc] || []).push([Number(id), c]);
		}
	}

	const instances = {};
	const bossInstance = {};
	const npcInstance = {};
	for (const m of facts.maps || []) {
		if (!m.name || SKIP_MAP.test(m.name)) continue;
		const enc = (facts.encounters && facts.encounters[m.id]) || [];
		if (!lfg.has(norm(m.name)) && !(m.id < ORIGINAL_MAPS && enc.length)) continue;
		let key = slug(m.name);
		if (instances[key]) key = `${key}-${m.id}`;
		const rec = recorded[m.id] || {};
		const recEnc = rec.encounters || {};
		const level = facts.recMin && facts.recMin[m.id];
		const forever = facts.era ? !facts.era.has(m.id) : false;
		const pick = (name) => {
			const n = norm(name);
			const ids = byName[n] || [];
			const inside = ids.filter((id) => (npcsIn[id].instances || []).map(Number).includes(m.id));
			if (inside.length) return inside.sort((a, b) => a - b)[0];
			const elite = (id) => num(npcsIn[id].rank) >= 1;
			const d = (id) => (level && num(npcsIn[id].level) ? Math.abs(num(npcsIn[id].level) - level) : 0);
			// A Forever instance's own NPCs are Forever's (no Era pfQuest row).
			const era = (id) => (npcsIn[id].source || []).includes('pfquest');
			const score = (id) => (forever && era(id) ? 4 : 0) + (spawnless(npcsIn[id]) ? 0 : 2) + (elite(id) ? 0 : 1);
			if (ids.length) return ids.slice().sort((a, b) => score(a) - score(b) || d(a) - d(b) || a - b)[0];
			// The client's spelling differs (Geilhast for Gelihast) or is shorter
			// (Kirtonos for Kirtonos the Herald): one NPC without open-world spawns.
			if (n.length < 6) return null;
			const near = spawnlessNames.filter((k) => k.startsWith(n) || editWithin(k, n, 2));
			const hits = [...new Set(near.flatMap((k) => byName[k].filter((id) => spawnless(npcsIn[id]))))];
			return hits.length === 1 ? hits[0] : null;
		};
		const bosses = [];
		for (const e of enc) {
			const recNpcs = ((recEnc[e.id] && recEnc[e.id].npcs) || []).map(Number).filter((id) => npcsIn[id]);
			let npcs = recNpcs;
			if (!npcs.length) {
				const one = pick(e.name);
				if (one) npcs = [one];
				else {
					const parts = e.name.split(/\s+and\s+|\s*&\s*/).filter((p) => p.trim());
					if (parts.length > 1) npcs = parts.map(pick).filter(Boolean);
				}
			}
			npcs = [...new Set(npcs)];
			const loot = new Map();
			for (const id of npcs) for (const [item, c] of lootOf[id] || []) if (!(loot.get(item) >= c)) loot.set(item, c);
			const items = [...loot.entries()].sort((a, b) => b[1] - a[1] || a[0] - b[0]).slice(0, BOSS_LOOT_CAP).map(([id]) => id);
			bosses.push({ name: e.name, npc: npcs[0] ?? null, npcs, items, encounter: e.id });
			for (const id of npcs) bossInstance[id] = bossInstance[id] || key;
		}
		// Levels.
		const bossLevels = bosses.flatMap((b) => b.npcs.map((id) => num(npcsIn[id].levelMax) || num(npcsIn[id].level))).filter((l) => l > 0);
		const entry = (facts.entry && facts.entry[m.id]) || null;
		const min = level || null;
		let max = bossLevels.length ? Math.min(MAX_LEVEL, Math.max(...bossLevels)) : null;
		if (max !== null && min !== null && max < min) max = min;
		const levels = min || entry || max ? [entry, min ?? max, max ?? min] : null;
		// Entrance.
		let entrance = null;
		const recE = (rec.entrances || []).slice().sort((a, b) => num(b.n) - num(a.n))[0];
		if (recE && recE.map) entrance = { map: Number(recE.map), x: round1(recE.x), y: round1(recE.y), f: recE.f === 'e' ? 'e' : null };
		if (!entrance && m.corpse) {
			const prefer = Object.values(zonesIn).filter((z) => z.areaId && m.zones.includes(z.areaId)).map((z) => z.id);
			entrance = zonePoint(ctx.frames || {}, m.corpse.c, m.corpse.x, m.corpse.y, prefer);
		}
		if (!entrance) {
			const n = norm(m.name);
			const zoneId = (name) => {
				const z = Object.values(zonesIn).find((x) => norm(x.name) === norm(name));
				return z ? z.id : null;
			};
			const c = (ctx.curated || []).find((g) => n.length >= 5 && norm(g.label).includes(n) && (g.map || (g.zone && zoneId(g.zone))));
			if (c) entrance = { map: c.map || zoneId(c.zone), x: round1(c.x), y: round1(c.y), f: null };
		}
		instances[key] = {
			key,
			name: m.name,
			kind: m.raid ? 'raid' : 'dungeon',
			forever,
			areaId: m.area,
			map: m.id,
			entrance,
			levels,
			bosses: bosses.map(({ name, npc, items }) => ({ name, npc, items })),
		};
	}
	// Every NPC placed in an instance (bosses first).
	const keyOfMap = {};
	for (const inst of Object.values(instances)) keyOfMap[inst.map] = inst.key;
	Object.assign(npcInstance, bossInstance);
	for (const [id, n] of Object.entries(npcsIn)) {
		if (npcInstance[id]) continue;
		const k = (n.instances || []).map((x) => keyOfMap[x]).find(Boolean);
		if (k) npcInstance[id] = k;
	}
	return { instances, bossInstance, npcInstance };
}

module.exports = { instanceFacts, buildInstances, curatedEntrances, MIN_LOOT };
