'use strict';
// Raw pfQuest database (pfquest.js loadPfQuest) -> the reference-data schema
// of docs/ARCHITECTURE.md (Toolchain -> Reference data). Coordinates are
// re-keyed from AreaTable zone ids to UiMapIDs in the Era frame ("e").
//
// pfQuest field meanings (from its toolbox/extractor.lua): quest lvl/min =
// QuestLevel/MinLevel, race/class = RequiredRaces/RequiredClasses masks,
// skill = RequiredSkill, event = game event id, close = all quests of the
// ExclusiveGroup, pre = prerequisite quests (any one suffices), start/end U/O/I
// = npc/object/item ids, obj U/I/O/A = required creatures / items / objects /
// area triggers. Unit lvl is "n" or "a-b", rnk the creature rank, fac A/H/AH.
// Item U/O = drop chance (percent) per npc/object, R = chance via a reference
// loot template (refloot), V = vendors (value = stock limit).

const { parseCount } = require('./objectives');
const { eraSpawns, round2 } = require('./spawns');

const { ALL_RACES, ALL_CLASSES } = require('../game/races');

const NPC_ROLES = {
	auctioneer: 'auctioneer', banker: 'banker', battlemaster: 'battlemaster', flight: 'flightmaster',
	innkeeper: 'innkeeper', rares: 'rare', repair: 'repair', spirithealer: 'spirithealer',
	stablemaster: 'stablemaster', vendor: 'vendor',
};
const OBJECT_ROLES = { chests: 'chest', fish: 'fishing', herbs: 'herb', mailbox: 'mailbox', meetingstone: 'meetingstone', mines: 'mine' };

const TYPE_ORDER = { kill: 0, item: 1, object: 2, event: 3 };

function ids(v) {
	if (!Array.isArray(v)) return [];
	const out = [];
	for (const x of v) {
		const n = Number(x);
		if (Number.isInteger(n) && n > 0 && !out.includes(n)) out.push(n);
	}
	return out;
}

function mask(v, all) {
	const n = Number(v);
	if (!Number.isInteger(n) || n <= 0 || (n & all) === all) return null;
	return n;
}

function intOrNull(v) {
	const n = Number(v);
	return Number.isFinite(n) && n !== 0 ? n : null;
}

function parseLevel(v) {
	if (v === undefined || v === null) return { level: null, levelMax: null };
	const m = /^\s*(\d+)(?:\s*-\s*(\d+))?\s*$/.exec(String(v));
	if (!m) return { level: null, levelMax: null };
	const lo = Number(m[1]);
	const hi = m[2] ? Number(m[2]) : lo;
	return { level: lo, levelMax: hi !== lo ? hi : null };
}

function faction(v) {
	return v === 'A' || v === 'H' || v === 'AH' ? v : null;
}

function rolesFrom(meta, table, id, positive) {
	const roles = [];
	for (const cat of Object.keys(table).sort()) {
		const m = meta.get(cat);
		if (m && m.has(positive ? id : -id)) roles.push(table[cat]);
	}
	return roles;
}

// Map with the most raw points; ties -> lower UiMapID.
function mainMap(coords, resolveArea) {
	const counts = new Map();
	for (const c of Array.isArray(coords) ? coords : []) {
		if (!Array.isArray(c)) continue;
		const m = resolveArea(c[2]);
		if (m) counts.set(m, (counts.get(m) || 0) + 1);
	}
	let best = null;
	let bestN = 0;
	for (const [m, n] of counts) {
		if (n > bestN || (n === bestN && m < best)) {
			best = m;
			bestN = n;
		}
	}
	return best;
}

function normalizeSpawnTable(source, names, meta, roleTable, resolveArea, spawnOptions, stats, isNpc) {
	const out = {};
	const main = new Map();
	for (const id of [...source.keys()].sort((a, b) => a - b)) {
		const r = source.get(id) || {};
		const name = names.get(id);
		const { spawns, unmapped } = eraSpawns(Array.isArray(r.coords) ? r.coords : [], resolveArea, spawnOptions);
		stats.unmappedPoints += unmapped;
		const rec = { id, name: typeof name === 'string' ? name : null };
		if (isNpc) {
			const { level, levelMax } = parseLevel(r.lvl);
			rec.level = level;
			if (levelMax !== null) rec.levelMax = levelMax;
			const rank = intOrNull(r.rnk);
			if (rank !== null) rec.rank = rank;
			rec.faction = faction(r.fac);
		}
		const roles = rolesFrom(meta, roleTable, id, isNpc);
		if (roles.length) rec.roles = roles;
		rec.spawns = spawns;
		out[id] = rec;
		const mm = mainMap(r.coords, resolveArea);
		if (mm) main.set(id, mm);
	}
	return { table: out, main };
}

function buildObjectives(q, loc, names, ctx) {
	const text = loc && typeof loc.O === 'string' ? loc.O : null;
	const obj = q.obj || {};
	const entries = [];
	for (const id of ids(obj.U)) entries.push({ type: 'kill', id, name: names.units.get(id) });
	for (const id of ids(obj.I)) entries.push({ type: 'item', id, name: names.items.get(id) });
	for (const id of ids(obj.O)) entries.push({ type: 'object', id, name: names.objects.get(id) });
	for (const id of ids(obj.A)) entries.push({ type: 'event', id, name: null });
	const allNames = entries.map((e) => e.name).filter(Boolean);
	const list = entries.map(({ type, id, name }) => {
		const { count, pos } = type === 'event' ? { count: null, pos: -1 } : parseCount(text, name, { type, others: allNames });
		return { type, id, count, text: typeof name === 'string' ? name : null, pos };
	});
	// Text order approximates the client's objective order; unmentioned ones follow by type, id.
	list.sort((a, b) => {
		const pa = a.pos < 0 ? Infinity : a.pos;
		const pb = b.pos < 0 ? Infinity : b.pos;
		if (pa !== pb) return pa - pb;
		return TYPE_ORDER[a.type] - TYPE_ORDER[b.type] || a.id - b.id;
	});
	return list.map((o) => {
		const out = { type: o.type, id: o.id, count: o.count, text: o.text };
		if (o.type === 'event') {
			const at = ctx.areatrigger.get(o.id);
			const c = at && Array.isArray(at.coords) ? at.coords.find((p) => Array.isArray(p) && ctx.resolveArea(p[2])) : null;
			if (c) Object.assign(out, { map: ctx.resolveArea(c[2]), f: 'e', x: round2(c[0]), y: round2(c[1]) });
		}
		return out;
	});
}

function normalizeQuests(raw, names, ctx) {
	const quests = {};
	const successors = new Map();
	let skipped = 0;
	for (const id of [...raw.quests.keys()].sort((a, b) => a - b)) {
		const q = raw.quests.get(id) || {};
		const loc = raw.loc.quests.get(id);
		const title = loc && typeof loc.T === 'string' ? loc.T : null;
		if (!title) {
			skipped++;
			continue;
		}
		const start = q.start || {};
		const end = q.end || {};
		const pre = ids(q.pre);
		for (const p of pre) {
			if (!successors.has(p)) successors.set(p, []);
			successors.get(p).push(id);
		}
		const startNpc = ids(start.U);
		const startObj = ids(start.O);
		const endNpc = ids(end.U);
		const endObj = ids(end.O);
		const zone =
			ctx.npcMain.get(startNpc[0]) || ctx.objectMain.get(startObj[0]) || ctx.npcMain.get(endNpc[0]) || ctx.objectMain.get(endObj[0]) || null;
		quests[id] = {
			id,
			title,
			level: intOrNull(q.lvl),
			minLevel: intOrNull(q.min),
			races: mask(q.race, ALL_RACES),
			classes: mask(q.class, ALL_CLASSES),
			start: { npc: startNpc, object: startObj, item: ids(start.I) },
			end: { npc: endNpc, object: endObj },
			pre,
			excl: ids(q.close).filter((x) => x !== id),
			next: null,
			objectives: buildObjectives(q, loc, names, ctx),
			objectiveText: loc && typeof loc.O === 'string' && loc.O !== '' ? loc.O : null,
			zone,
			xp: null,
			skill: intOrNull(q.skill),
			event: intOrNull(q.event),
			source: ['pfquest'],
		};
	}
	// Follow-up = the single quest that lists this one as a prerequisite.
	for (const [p, list] of successors) {
		if (quests[p] && list.length === 1 && quests[list[0]]) quests[p].next = list[0];
	}
	return { quests, skipped };
}

function normalizeItems(raw) {
	const items = {};
	for (const id of [...raw.items.keys()].sort((a, b) => a - b)) {
		const name = raw.loc.items.get(id);
		if (typeof name !== 'string') continue;
		const r = raw.items.get(id);
		const npc = new Map();
		const object = new Map();
		const put = (m, k, chance) => {
			const c = Number(chance);
			if (!Number.isInteger(k) || k <= 0 || !Number.isFinite(c) || c <= 0) return;
			if (!m.has(k) || m.get(k) < c) m.set(k, c);
		};
		for (const [u, c] of r.U) put(npc, u, c);
		for (const [o, c] of r.O) put(object, o, c);
		for (const [ref, c] of r.R) {
			const rl = raw.refloot.get(ref);
			if (!rl) continue;
			for (const u of rl.U.keys()) put(npc, u, c);
			for (const o of rl.O.keys()) put(object, o, c);
		}
		const sorted = (m) => {
			const o = {};
			for (const k of [...m.keys()].sort((a, b) => a - b)) o[k] = m.get(k);
			return o;
		};
		items[id] = {
			id,
			name,
			drops: { npc: sorted(npc), object: sorted(object) },
			vendors: [...r.V.keys()].filter((k) => Number.isInteger(k) && k > 0).sort((a, b) => a - b),
		};
	}
	return items;
}

// -> { quests, npcs, objects, items, stats }
function normalizePfQuest(raw, { resolveArea, spawnOptions } = {}) {
	const stats = { unmappedPoints: 0, skippedQuests: 0 };
	const npcs = normalizeSpawnTable(raw.units, raw.loc.units, raw.meta, NPC_ROLES, resolveArea, spawnOptions, stats, true);
	const objects = normalizeSpawnTable(raw.objects, raw.loc.objects, raw.meta, OBJECT_ROLES, resolveArea, spawnOptions, stats, false);
	const names = { units: raw.loc.units, items: raw.loc.items, objects: raw.loc.objects };
	const { quests, skipped } = normalizeQuests(raw, names, {
		npcMain: npcs.main,
		objectMain: objects.main,
		areatrigger: raw.areatrigger,
		resolveArea,
	});
	stats.skippedQuests = skipped;
	return { quests, npcs: npcs.table, objects: objects.table, items: normalizeItems(raw), stats };
}

module.exports = { normalizePfQuest, parseLevel, mask };
