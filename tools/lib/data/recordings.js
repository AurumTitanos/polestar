'use strict';
// Recorder overlay (data/recordings/*.json, schema in docs/ARCHITECTURE.md).
// Recordings are live Forever observations, so they win over Era data:
// - positions at quest accept/turn-in and at gossip/trainer/vendor/flight
//   master interactions become live-frame ("l") spawns that replace the Era
//   spawns of that npc/object on that map;
// - accept titles and quest levels correct the quest;
// - xp is the quest's full reward (see resolveXp): quest-log rewardXpBase
//   wins; otherwise the largest quest-log rewardXp or turn-in xpReward seen
//   by a character not out-levelling the quest (Classic reduces XP when the
//   player is more than 5 levels above it). xpSamples counts the
//   observations behind it and source gains "recorder:xp-<kind>";
// - recorded givers/enders are added to start/end when missing;
// - objective progress ("Kobold Vermin slain: 3/10") fills counts and the
//   client's objective order;
// - quests and npcs seen only in recordings are added (source ["recorder"]);
// - recorded maps missing from zones.json are added.
// - factions from the session's `factions` dump and `rep` events: live names
//   win, factions seen only in Forever are added, every one seen gets source
//   "recorder"; recorded parents/sides only fill gaps (resolveFactions).

const fs = require('node:fs');
const path = require('node:path');
const { reduceSpawns, spawnRecord } = require('./spawns');
const { parseProgressText } = require('./objectives');

const INTERACTIONS = { gossip: null, trainer: 'trainer', vendor: 'vendor', fp: 'flightmaster' };
const OBJECTIVE_TYPES = { monster: 'kill', item: 'item', object: 'object' };

function readRecordings(dir) {
	if (!dir || !fs.existsSync(dir)) return [];
	const out = [];
	for (const file of fs.readdirSync(dir).filter((f) => f.endsWith('.json')).sort()) {
		const p = path.join(dir, file);
		let rec;
		try {
			rec = JSON.parse(fs.readFileSync(p, 'utf8'));
		} catch (err) {
			throw new Error(`recording ${file}: ${err.message}`);
		}
		if (!rec || rec.schema !== 1 || !Array.isArray(rec.events)) throw new Error(`recording ${file}: expected { schema: 1, events: [...] }`);
		out.push({ file, rec });
	}
	return out;
}

function posInt(v) {
	const n = Number(v);
	return Number.isInteger(n) && n > 0 ? n : null;
}

function coord(ev) {
	const map = posInt(ev.map);
	const x = Number(ev.x);
	const y = Number(ev.y);
	if (!map || !Number.isFinite(x) || !Number.isFinite(y) || x < 0 || x > 100 || y < 0 || y > 100) return null;
	return { map, x, y };
}

function same(a, b) {
	return typeof a === 'string' && typeof b === 'string' && a.trim().toLowerCase() === b.trim().toLowerCase();
}

function newQuest(id) {
	return {
		id, title: null, level: null, minLevel: null, races: null, classes: null,
		start: { npc: [], object: [], item: [] }, end: { npc: [], object: [] },
		pre: [], excl: [], next: null, objectives: [], objectiveText: null, zone: null, xp: null,
		skill: null, event: null, source: ['recorder'],
	};
}

function front(list, id) {
	if (!list.includes(id)) list.unshift(id);
}

function applyRecordings(db, recordings, { spawnOptions } = {}) {
	const { quests, npcs, objects, items, zones, factions } = db;
	const stats = { recordings: recordings.length, events: 0, recorderOnlyQuests: 0, touchedQuests: 0, liveSpawnMaps: 0, recorderOnlyFactions: 0 };
	const live = { npc: new Map(), object: new Map() };
	const touched = new Set();
	const recordedObjectives = new Map(); // quest -> Map(oi -> { name, type, max, id })
	const touchedEntities = new Map(); // "kind:id" -> [kind, id]
	const xpSeen = new Map(); // quest -> [{ kind, xp, lvl }]
	function xpObservation(qid, kind, value, lvl) {
		const xp = posInt(value);
		if (!xp) return;
		if (!xpSeen.has(qid)) xpSeen.set(qid, []);
		xpSeen.get(qid).push({ kind, xp, lvl: posInt(lvl) });
	}
	function itemEntry(id, name) {
		if (!items) return;
		if (!items[id]) items[id] = { id, name: null, drops: { npc: {}, object: {} }, vendors: [] };
		if (typeof name === 'string' && name !== '') items[id].name = name;
	}

	function quest(id) {
		if (!quests[id]) {
			quests[id] = newQuest(id);
			stats.recorderOnlyQuests++;
		}
		touched.add(id);
		return quests[id];
	}
	function entity(kind, id, name) {
		const table = kind === 'npc' ? npcs : objects;
		if (!table[id]) {
			table[id] = kind === 'npc' ? { id, name: null, level: null, faction: null, spawns: {} } : { id, name: null, spawns: {} };
		}
		if (typeof name === 'string' && name !== '') table[id].name = name;
		touchedEntities.set(`${kind}:${id}`, [kind, id]);
		return table[id];
	}
	function livePoint(kind, id, name, ev) {
		const e = entity(kind, id, name);
		const c = coord(ev);
		if (!c) return e;
		const byMap = live[kind];
		if (!byMap.has(id)) byMap.set(id, new Map());
		const m = byMap.get(id);
		if (!m.has(c.map)) m.set(c.map, []);
		m.get(c.map).push([c.x, c.y]);
		return e;
	}
	function addRole(e, role) {
		if (!role) return;
		const roles = new Set(e.roles || []);
		roles.add(role);
		e.roles = [...roles].sort();
	}
	function objectiveSlot(q, oi) {
		if (!recordedObjectives.has(q)) recordedObjectives.set(q, new Map());
		const m = recordedObjectives.get(q);
		if (!m.has(oi)) m.set(oi, {});
		return m.get(oi);
	}
	// Factions as the live client reports them. Recorded names win; parent and
	// side are only filled where the Era table has nothing.
	const factionParent = new Map(); // id -> recorded parent id
	const factionSide = new Map(); // id -> recorded side
	function faction(id, name) {
		if (!factions) return null;
		if (!factions[id]) {
			factions[id] = { id, name: null, side: null, parent: null, source: [] };
			stats.recorderOnlyFactions++;
		}
		const f = factions[id];
		if (typeof name === 'string' && name.trim() !== '') f.name = name.trim();
		if (!f.source.includes('recorder')) f.source.push('recorder');
		return f;
	}
	function factionDump(dump) {
		const entries = Array.isArray(dump) ? dump.map((d) => [d && d.id, d]) : Object.entries(dump || {});
		for (const [key, d] of entries) {
			const id = posInt(key) || posInt(d && (d.id ?? d.factionID));
			if (!id || !d || typeof d !== 'object') continue;
			if (!faction(id, d.name)) return;
			const parent = posInt(d.parent ?? d.parentID ?? d.parentFactionID);
			if (parent && parent !== id) factionParent.set(id, parent);
			if (d.side === 'Alliance' || d.side === 'Horde') factionSide.set(id, d.side);
		}
	}

	for (const { rec } of recordings) {
		for (const [mapId, m] of Object.entries(rec.maps || {})) {
			const id = posInt(mapId);
			if (id && !zones[id] && m && typeof m.name === 'string') {
				zones[id] = { id, name: m.name, areaId: null, parent: posInt(m.parent), type: Number.isFinite(Number(m.type)) ? Number(m.type) : null };
			}
		}
		factionDump(rec.factions);
		for (const ev of rec.events) {
			if (!ev || typeof ev.e !== 'string') continue;
			stats.events++;
			const qid = posInt(ev.q);
			const npc = posInt(ev.npc);
			if (ev.e === 'accept' && qid) {
				const q = quest(qid);
				if (typeof ev.title === 'string' && ev.title !== '') q.title = ev.title;
				const qlvl = posInt(ev.qlvl);
				if (qlvl) q.level = qlvl;
				xpObservation(qid, 'base', ev.rewardXpBase, ev.lvl);
				xpObservation(qid, 'log', ev.rewardXp, ev.lvl);
				if (npc) {
					front(q.start.npc, npc);
					livePoint('npc', npc, ev.npcName, ev);
				}
				const obj = posInt(ev.object);
				if (obj) {
					front(q.start.object, obj);
					livePoint('object', obj, ev.objName, ev);
				}
				// Item-started quests: the position says nothing about the item.
				const item = posInt(ev.item);
				if (item) front(q.start.item, item);
				const c = coord(ev);
				if (!q.zone && c) q.zone = c.map;
			} else if (ev.e === 'turnin' && qid) {
				const q = quest(qid);
				xpObservation(qid, 'turnin', ev.xpReward, ev.lvl);
				if (npc) {
					front(q.end.npc, npc);
					livePoint('npc', npc, ev.npcName, ev);
				}
				const obj = posInt(ev.object);
				if (obj) {
					front(q.end.object, obj);
					livePoint('object', obj, ev.objName, ev);
				}
			} else if (ev.e === 'reward' && qid) {
				quest(qid);
				xpObservation(qid, 'base', ev.rewardXpBase, ev.lvl);
				xpObservation(qid, 'log', ev.rewardXp, ev.lvl);
			} else if (ev.e === 'progress' && qid) {
				quest(qid);
				const oi = posInt(ev.oi);
				const p = parseProgressText(ev.text);
				if (!oi || !p) continue;
				const slot = objectiveSlot(qid, oi);
				slot.name = p.name;
				slot.max = Math.max(slot.max || 0, p.max);
				slot.type = OBJECTIVE_TYPES[ev.type] || slot.type || (p.slain ? 'kill' : null);
			} else if (ev.e === 'kill' || ev.e === 'loot') {
				const id = ev.e === 'kill' ? npc : posInt(ev.item);
				if (!id) continue;
				if (ev.e === 'kill') entity('npc', id, ev.npcName);
				else itemEntry(id, ev.itemName);
				const oi = posInt(ev.oi);
				if (qid && oi) {
					const slot = objectiveSlot(qid, oi);
					slot.id = id;
					slot.type = slot.type || (ev.e === 'kill' ? 'kill' : 'item');
				}
			} else if (ev.e in INTERACTIONS && npc) {
				addRole(livePoint('npc', npc, ev.npcName, ev), INTERACTIONS[ev.e]);
			} else if (ev.e === 'rep') {
				const id = posInt(ev.faction);
				if (id) faction(id, ev.factionName);
			}
		}
	}

	// Kill/loot events can link objectives of a quest that neither the data nor
	// any recorded accept/turnin/reward/progress knows (accepted in a lost
	// session); without a quest to attach them to they are dropped.
	for (const [qid, slots] of recordedObjectives) {
		if (quests[qid]) mergeObjectives(quests[qid], slots);
	}

	for (const kind of ['npc', 'object']) {
		const table = kind === 'npc' ? npcs : objects;
		for (const [id, byMap] of live[kind]) {
			const e = table[id];
			for (const [map, pts] of byMap) {
				const reduced = reduceSpawns(pts, spawnOptions);
				if (!reduced.pts.length) continue;
				e.spawns[map] = spawnRecord('l', reduced);
				stats.liveSpawnMaps++;
			}
		}
	}
	for (const [kind, id] of touchedEntities.values()) {
		const table = kind === 'npc' ? npcs : objects;
		table[id] = canonical(table[id], kind === 'npc' ? NPC_KEYS : OBJECT_KEYS);
	}

	for (const id of [...touched].sort((a, b) => a - b)) {
		const q = quests[id];
		if (!q.source.includes('recorder')) q.source.push('recorder');
		if (xpSeen.has(id)) resolveXp(q, xpSeen.get(id));
		quests[id] = canonical(q, QUEST_KEYS);
	}
	stats.touchedQuests = touched.size;
	if (factions) resolveFactions(factions, factionParent, factionSide);
	return stats;
}

// Same field order as normalize.js builds, whatever the overlay added.
const NPC_KEYS = ['id', 'name', 'level', 'levelMax', 'rank', 'faction', 'roles', 'spawns'];
const OBJECT_KEYS = ['id', 'name', 'roles', 'spawns'];
const QUEST_KEYS = [
	'id', 'title', 'level', 'minLevel', 'races', 'classes', 'start', 'end', 'pre', 'excl', 'next',
	'objectives', 'objectiveText', 'zone', 'xp', 'xpSamples', 'skill', 'event', 'source',
];
const FACTION_KEYS = ['id', 'name', 'side', 'parent', 'source'];

// Recorded header links fill missing parents (only to factions in the file,
// never creating a cycle); then recorder-touched factions without a side take
// the recorded side or inherit their parent's.
function resolveFactions(factions, parents, sides) {
	const ancestorOf = (id, target) => {
		const seen = new Set();
		for (let cur = id; cur && !seen.has(cur); cur = factions[cur] ? factions[cur].parent : null) {
			if (cur === target) return true;
			seen.add(cur);
		}
		return false;
	};
	for (const id of [...parents.keys()].sort((a, b) => a - b)) {
		const f = factions[id];
		const p = parents.get(id);
		if (f.parent === null && factions[p] && !ancestorOf(p, id)) f.parent = p;
	}
	const sideOf = (id) => {
		const seen = new Set();
		for (let cur = id; cur && factions[cur] && !seen.has(cur); cur = factions[cur].parent) {
			seen.add(cur);
			if (factions[cur].side) return factions[cur].side;
			if (sides.has(cur)) return sides.get(cur);
		}
		return null;
	};
	for (const key of Object.keys(factions)) {
		const f = factions[key];
		if (!f.source.includes('recorder')) continue;
		if (!f.side) f.side = sideOf(f.id);
		factions[key] = canonical(f, FACTION_KEYS);
	}
}

// Classic gives full quest XP up to 5 levels above the quest, less beyond.
const FULL_XP_LEVELS = 5;

// rewardXpBase (the unreduced reward) wins outright. Otherwise rewardXp and
// turn-in xpReward count only when the character was provably not
// out-levelling the quest: player level known and <= quest level + 5 (any
// player level when the quest level is unknown). A reduced observation never
// replaces a full one; without a qualifying observation xp is left as is.
function resolveXp(q, list) {
	let pick = list.filter((o) => o.kind === 'base');
	if (!pick.length) {
		pick = list.filter((o) => o.kind !== 'base' && (q.level === null || (o.lvl !== null && o.lvl <= q.level + FULL_XP_LEVELS)));
	}
	if (!pick.length) return;
	let best = pick[0];
	for (const o of pick) if (o.xp > best.xp) best = o;
	q.xp = best.xp;
	q.xpSamples = pick.length;
	const tag = `recorder:xp-${best.kind}`;
	if (!q.source.includes(tag)) q.source.push(tag);
}

// Listed keys first in that order, any others after in their existing order.
function canonical(e, keys) {
	const out = {};
	for (const k of keys) if (k in e) out[k] = e[k];
	for (const k of Object.keys(e)) if (!(k in out)) out[k] = e[k];
	return out;
}

// Match recorded objectives (by name, else by id) to existing ones; recorded
// counts win and recorded indices reorder. Unmatched recorded objectives are
// appended (their type/id only when the recording proves it).
function mergeObjectives(q, slots) {
	const oiOf = new Map();
	for (const oi of [...slots.keys()].sort((a, b) => a - b)) {
		const s = slots.get(oi);
		let idx = q.objectives.findIndex((o, i) => !oiOf.has(i) && s.name && (same(o.text, s.name) || same(`${o.text}s`, s.name)));
		if (idx < 0 && s.id) idx = q.objectives.findIndex((o, i) => !oiOf.has(i) && o.id === s.id && (!s.type || o.type === s.type));
		if (idx < 0) {
			q.objectives.push({ type: s.type || 'event', id: s.id || null, count: s.max || null, text: s.name || null });
			idx = q.objectives.length - 1;
		} else if (s.max) {
			q.objectives[idx].count = s.max;
		}
		oiOf.set(idx, oi);
	}
	// Recorded objectives take slot oi - 1; the rest keep their order in the gaps.
	const result = new Array(q.objectives.length).fill(null);
	const rest = [];
	q.objectives.forEach((o, i) => {
		const oi = oiOf.get(i);
		if (oi !== undefined && oi - 1 < result.length && result[oi - 1] === null) result[oi - 1] = o;
		else rest.push(o);
	});
	for (let i = 0; i < result.length; i++) if (result[i] === null) result[i] = rest.shift();
	q.objectives = result;
}

module.exports = { readRecordings, applyRecordings };
