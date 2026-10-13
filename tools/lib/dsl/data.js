'use strict';
// Reference data (data/forever/*.json, schema in docs/ARCHITECTURE.md) with
// the lookups the resolver needs. Missing files load as empty tables so a
// guide made only of explicit names still compiles; the caller is told which
// files were missing. The optional files (professions, factions) are also
// treated as missing when they cannot be parsed, so a half-built data folder
// never stops compilation.

const fs = require('node:fs');
const path = require('node:path');

const FILES = ['quests', 'npcs', 'objects', 'items', 'zones', 'map-frames', 'meta'];
const OPTIONAL = ['professions', 'factions', 'trainers', 'dungeons', 'races'];

// Quests only dungeons.json knows (new Forever dungeon quests DungeonJournal
// records and quests.json lacks), as minimal quest records: title, levels and
// XP; givers and enders stay empty, so guides give their coordinates.
function dungeonQuests(dungeons, known) {
	const out = {};
	for (const d of (dungeons && dungeons.dungeons) || []) {
		for (const q of [...(d.quests || []), ...Object.values(d.chainQuests || {})]) {
			if (!q || !(q.id > 0) || known[q.id] || out[q.id] || !q.title) continue;
			out[q.id] = {
				id: q.id, title: q.title, level: q.level || null, minLevel: q.minLevel || null, races: null, classes: null,
				start: { npc: [], object: [], item: [] }, end: { npc: [], object: [] }, pre: [], excl: [], next: null,
				objectives: [], zone: null, xp: q.xp || null, source: ['dungeonjournal'],
			};
		}
	}
	return out;
}

// Classic skill lines (game facts), so `skill <Profession> <N>` resolves even
// without professions.json. Riding (762) is Forever's one riding skill: the
// client's SkillLineAbility puts every racial riding spell under it
// (Apprentice Riding = 75, Journeyman Riding = 150).
const BUILTIN_PROFESSIONS = [
	{ id: 171, name: 'Alchemy' },
	{ id: 164, name: 'Blacksmithing' },
	{ id: 333, name: 'Enchanting' },
	{ id: 202, name: 'Engineering' },
	{ id: 182, name: 'Herbalism' },
	{ id: 165, name: 'Leatherworking' },
	{ id: 186, name: 'Mining' },
	{ id: 393, name: 'Skinning' },
	{ id: 197, name: 'Tailoring' },
	{ id: 185, name: 'Cooking' },
	{ id: 356, name: 'Fishing' },
	{ id: 129, name: 'First Aid' },
	{ id: 762, name: 'Riding' },
];

function zoneTypeRank(type) {
	// Prefer real zones (UIMapType 3), then dungeons/micro maps, then the rest.
	if (type === 3) return 0;
	if (type === 4 || type === 5 || type === 6) return 1;
	return 2;
}

function loadData(dir) {
	const raw = {};
	const missing = [];
	for (const name of [...FILES, ...OPTIONAL]) {
		const file = path.join(dir, `${name}.json`);
		if (!fs.existsSync(file)) {
			missing.push(`${name}.json`);
			raw[name] = {};
			continue;
		}
		try {
			raw[name] = JSON.parse(fs.readFileSync(file, 'utf8'));
		} catch (e) {
			if (!OPTIONAL.includes(name)) throw new Error(`${file}: ${e.message}`);
			missing.push(`${name}.json`);
			raw[name] = {};
		}
	}
	return new Data(raw, { dir, missing });
}

function lowerKey(s) {
	return String(s).trim().toLowerCase();
}

class Data {
	constructor(raw, info = {}) {
		const extra = dungeonQuests(raw.dungeons, raw.quests || {});
		this.quests = Object.keys(extra).length ? { ...raw.quests, ...extra } : raw.quests || {};
		this.npcs = raw.npcs || {};
		this.objects = raw.objects || {};
		this.items = raw.items || {};
		this.zones = raw.zones || {};
		this.mapFrames = raw['map-frames'] || {};
		this.meta = raw.meta || {};
		this.dir = info.dir || null;
		this.missing = info.missing || [];
		this.missingCore = this.missing.filter((f) => FILES.includes(f.replace(/\.json$/, '')));
		this.hasProfessions = !this.missing.includes('professions.json');
		this.hasFactions = !this.missing.includes('factions.json');
		this.indexProfessions(raw.professions || {});
		this.indexFactions(raw.factions || {});
		this.hasTrainers = !this.missing.includes('trainers.json');
		this.trainersRaw = raw.trainers || {};
		this.races = raw.races || {};
		this.zoneByName = new Map();
		for (const z of Object.values(this.zones)) {
			if (!z || !z.name) continue;
			const key = String(z.name).toLowerCase();
			const list = this.zoneByName.get(key) || [];
			list.push(z);
			this.zoneByName.set(key, list);
		}
		for (const list of this.zoneByName.values()) {
			list.sort((a, b) => zoneTypeRank(a.type) - zoneTypeRank(b.type) || (a.system || 0) - (b.system || 0) || a.id - b.id);
		}
		this.hasXp = Object.values(this.quests).some((q) => q && typeof q.xp === 'number' && q.xp > 0);
	}

	quest(id) {
		return this.quests[id] || null;
	}

	npc(id) {
		return this.npcs[id] || null;
	}

	object(id) {
		return this.objects[id] || null;
	}

	item(id) {
		return this.items[id] || null;
	}

	zone(id) {
		return this.zones[id] || null;
	}

	// Classes a race file can be on one side (races.json, the Forever client's
	// CharBaseInfo); [] for an unknown race or side, or without races.json.
	raceClasses(raceFile, side) {
		const r = this.races[raceFile];
		return (r && r[side] && r[side].classes) || [];
	}

	indexProfessions(raw) {
		this.professions = new Map(); // skillLine -> profession
		this.professionByName = new Map();
		this.recipeBySpell = new Map(); // spell -> { recipe, profession }
		const ids = Object.keys(raw)
			.map(Number)
			.filter((id) => Number.isInteger(id) && raw[id] && typeof raw[id] === 'object')
			.sort((a, b) => a - b);
		for (const id of ids) {
			const p = { ...raw[id], id };
			this.professions.set(id, p);
			if (p.name) this.professionByName.set(lowerKey(p.name), p);
			for (const r of Array.isArray(p.recipes) ? p.recipes : []) {
				const spell = r && Number(r.spell);
				if (Number.isInteger(spell) && spell > 0 && !this.recipeBySpell.has(spell)) this.recipeBySpell.set(spell, { recipe: r, profession: p });
			}
		}
		for (const b of BUILTIN_PROFESSIONS) {
			if (!this.professionByName.has(lowerKey(b.name))) this.professionByName.set(lowerKey(b.name), b);
		}
	}

	// Profession by name (professions.json, else the Classic built-ins) or null.
	professionNamed(name) {
		return this.professionByName.get(lowerKey(name)) || null;
	}

	profession(skillLine) {
		return this.professions.get(Number(skillLine)) || BUILTIN_PROFESSIONS.find((b) => b.id === Number(skillLine)) || null;
	}

	// -> { recipe, profession } | null
	recipe(spell) {
		return this.recipeBySpell.get(Number(spell)) || null;
	}

	indexFactions(raw) {
		this.factions = new Map();
		this.factionByName = new Map();
		const ids = Object.keys(raw)
			.map(Number)
			.filter((id) => Number.isInteger(id) && raw[id] && typeof raw[id] === 'object')
			.sort((a, b) => a - b);
		for (const id of ids) {
			const f = { ...raw[id], id };
			this.factions.set(id, f);
			if (!f.name) continue;
			const key = lowerKey(f.name);
			if (!this.factionByName.has(key)) this.factionByName.set(key, []);
			this.factionByName.get(key).push(f);
		}
	}

	// Class trainers as [{ id, classes }], sorted by id: trainers.json when
	// present (`node tools/polestar.js trainers build`), else the curated list
	// resolved against npcs.json.
	classTrainers() {
		if (this._classTrainers) return this._classTrainers;
		let list;
		if (this.hasTrainers) {
			list = Object.values(this.trainersRaw)
				.filter((t) => t && Number(t.id) > 0 && Array.isArray(t.classes) && t.classes.length)
				.map((t) => ({ id: Number(t.id), classes: t.classes.map(String) }));
		} else {
			const { curatedTrainers } = require('./trainers');
			list = [...curatedTrainers(this).entries.values()].map((e) => ({ id: e.id, classes: [...e.classes] }));
		}
		this._classTrainers = list.sort((a, b) => a.id - b.id);
		return this._classTrainers;
	}

	// Npc ids with a role ("vendor", "innkeeper", ...), sorted.
	npcsWithRole(role) {
		if (!this._roles) this._roles = new Map();
		if (!this._roles.has(role)) {
			const ids = Object.values(this.npcs)
				.filter((n) => n && Array.isArray(n.roles) && n.roles.includes(role))
				.map((n) => Number(n.id))
				.sort((a, b) => a - b);
			this._roles.set(role, ids);
		}
		return this._roles.get(role);
	}

	faction(id) {
		return this.factions.get(Number(id)) || null;
	}

	// -> { faction, ambiguous: [factions] | null } | null (lowest id wins)
	factionNamed(name) {
		const list = this.factionByName.get(lowerKey(name));
		if (!list || !list.length) return null;
		return { faction: list[0], ambiguous: list.length > 1 ? list : null };
	}

	// -> { zone, ambiguous: [zones] } | null
	zoneNamed(name) {
		const list = this.zoneByName.get(String(name).toLowerCase());
		if (!list || !list.length) return null;
		const best = list[0];
		const tied = list.filter((z) => zoneTypeRank(z.type) === zoneTypeRank(best.type) && (z.system || 0) === (best.system || 0));
		return { zone: best, ambiguous: tied.length > 1 ? tied : null };
	}

	eraFrame(map) {
		const era = this.mapFrames.era || {};
		return era[map] || null;
	}

	// Map size in yards for distance math: Era bounds when known.
	mapSize(map) {
		const fr = this.eraFrame(map);
		if (!fr) return null;
		const w = Math.abs(fr.right - fr.left);
		const h = Math.abs(fr.bottom - fr.top);
		return w > 0 && h > 0 ? { w, h } : null;
	}

	// Entity spawns as [{ map, f, pts }] sorted by map id.
	spawns(kind, id) {
		const e = kind === 'npc' ? this.npc(id) : kind === 'object' ? this.object(id) : null;
		if (!e || !e.spawns) return [];
		return Object.keys(e.spawns)
			.map((m) => ({ map: Number(m), f: e.spawns[m].f, pts: (e.spawns[m].pts || []).filter((p) => Array.isArray(p) && p.length >= 2) }))
			.filter((s) => s.pts.length)
			.sort((a, b) => a.map - b.map);
	}
}

module.exports = { loadData, Data };
