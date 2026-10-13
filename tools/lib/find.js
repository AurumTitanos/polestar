'use strict';
// find: quests, NPCs, objects and items in the reference data, and our
// guides, by id or name. Each result carries a guide line ready to
// paste (it parses with tools/lib/dsl/parse.js), with what it is in a comment:
//
//   accept 36  # Westfall Stew, level 10: Verna Furlbrow, Westfall 59.9,19.4
//   next forever/alliance/02-westfall  # Westfall (12-17), Alliance

const fs = require('node:fs');
const path = require('node:path');
const { parseGuide } = require('./dsl/parse');
const { Diagnostics } = require('./dsl/diag');
const { findGuideFiles } = require('./dsl/project');
const { objectiveLabel } = require('./dsl/data');
const { RACES, applicable, characterKeys, maskExcludes, raceSides, raceLabel, classLabel, whoLabel } = require('./dsl/conditions');

const KINDS = ['quest', 'npc', 'object', 'item', 'guide'];
const FACTIONS = ['Alliance', 'Horde'];

// [{ id, title, faction, races, classes, levels, zone, next }] from the
// headers of the guides in dir: races and classes as race and class files
// (null when the guide names none), next the guide ids its `next` offers.
function loadGuideHeaders(dir) {
	const out = [];
	for (const rel of findGuideFiles(dir)) {
		const ast = parseGuide(fs.readFileSync(path.join(dir, rel), 'utf8'), rel, new Diagnostics());
		if (!ast || !ast.id) continue;
		const h = ast.header || {};
		out.push({
			id: ast.id,
			title: h.title || ast.id,
			faction: h.faction || null,
			races: h.races || null,
			classes: h.classes || null,
			levels: h.levels || null,
			zone: h.zone ? h.zone.name || null : null,
			next: h.next || [],
		});
	}
	return out;
}

function coord(v) {
	return String(Number(v.toFixed(1)));
}

function zoneName(data, map) {
	const z = map != null ? data.zone(map) : null;
	return z && z.name ? String(z.name) : null;
}

// Where an NPC or object stands: its first spawn on `preferMap`, else on its
// lowest map id -> { zone, map, x, y } | null.
function place(data, kind, id, preferMap) {
	const spawns = data.spawns(kind, id);
	const s = spawns.find((x) => x.map === preferMap) || spawns[0];
	if (!s) return null;
	const [x, y] = s.pts[0];
	return { zone: zoneName(data, s.map), map: s.map, x, y };
}

// The first NPC, object or item that starts (`start`) or ends (`end`) quest q.
function party(data, q, which) {
	const ends = (q && q[which]) || {};
	for (const kind of ['npc', 'object', 'item']) {
		for (const id of ends[kind] || []) {
			const e = kind === 'npc' ? data.npc(id) : kind === 'object' ? data.object(id) : data.item(id);
			const at = kind === 'item' ? null : place(data, kind, id, q.zone);
			const out = { kind, id, name: e && e.name ? String(e.name) : `${kind} ${id}` };
			if (at) Object.assign(out, { zone: at.zone, x: at.x, y: at.y });
			return out;
		}
	}
	return null;
}

// "Westfall 59.9,19.4" ('' without coordinates).
function spot(p) {
	if (p.x == null) return '';
	return `${p.zone ? `${p.zone} ` : ''}${coord(p.x)},${coord(p.y)}`;
}

// "Verna Furlbrow, Westfall 59.9,19.4"
function where(p) {
	const at = spot(p);
	return `${p.kind === 'item' ? 'item ' : ''}${p.name}${at ? `, ${at}` : ''}`;
}

// Can a character of `faction` take quest q: no race mask, or one naming a
// race of that side (bits past 2^31 too, so the arithmetic test).
function questFor(q, faction) {
	const mask = q.races;
	if (mask == null || mask === 0) return true;
	return Object.values(RACES).some((r) => r.sides[faction] !== undefined && Math.floor(mask / r.sides[faction]) % 2 === 1);
}

const TAG = { Alliance: 'A', Horde: 'H' };

function questResult(data, q) {
	const starts = party(data, q, 'start');
	const ends = party(data, q, 'end');
	const r = { kind: 'quest', id: q.id, name: String(q.title) };
	if (q.level > 0) r.level = q.level;
	// x/y from the starter come with the starter's zone; else the quest's own.
	if (starts && starts.x != null) Object.assign(r, { zone: starts.zone, x: starts.x, y: starts.y });
	else {
		const zone = zoneName(data, q.zone);
		if (zone) r.zone = zone;
	}
	if (r.zone == null) delete r.zone;
	if (starts) r.starts = starts;
	if (ends) r.ends = ends;
	r.objectives = data.questObjectives(q.id);
	r.line = `accept ${q.id}  # ${r.name}${r.level ? `, level ${r.level}` : ''}${starts ? `: ${where(starts)}` : ''}`;
	r.turnin = `turnin ${q.id}  # ${r.name}${ends ? `: ${where(ends)}` : ''}`;
	// "# 7.1 = kill Kobold Vermin x10": the `quest 7.1` of an objective goal.
	r.notes = r.objectives.map((o) => `# ${objectiveLabel(q.id, o)}`);
	return r;
}

// Hostile NPCs (no friendly faction) are killed; the others talked to.
function npcResult(data, n) {
	const r = { kind: 'npc', id: n.id, name: String(n.name) };
	if (n.level > 0) r.level = n.level;
	const at = place(data, 'npc', n.id);
	if (at) Object.assign(r, { zone: at.zone, x: at.x, y: at.y });
	const verb = n.faction ? 'talk' : 'kill';
	r.line = `${verb} ${n.id}  # ${r.name}${r.level ? `, level ${r.level}` : ''}${at ? `, ${spot(at)}` : ''}`;
	return r;
}

function objectResult(data, o) {
	const r = { kind: 'object', id: o.id, name: String(o.name) };
	const at = place(data, 'object', o.id);
	if (at) Object.assign(r, { zone: at.zone, x: at.x, y: at.y });
	r.line = `interact ${o.id}  # ${where({ ...r, kind: 'object' })}`;
	return r;
}

function itemResult(i) {
	const r = { kind: 'item', id: i.id, name: String(i.name) };
	r.line = `collect ${i.id}  # ${r.name}`;
	return r;
}

// Who a guide is for, after its level range: "Alliance", "Dwarf/Gnome only".
function guideFor(g) {
	return g.races || g.classes ? `${whoLabel(g)} only` : whoLabel(g);
}

function guideResult(g) {
	const r = { kind: 'guide', id: g.id, name: String(g.title) };
	if (g.levels) {
		r.level = g.levels.min;
		r.levels = { min: g.levels.min, max: g.levels.max };
	}
	if (g.zone) r.zone = g.zone;
	r.faction = g.faction || null;
	r.races = g.races ? g.races.map(raceLabel) : null;
	r.classes = g.classes ? g.classes.map(classLabel) : null;
	r.next = g.next || [];
	const levels = g.levels ? ` (${g.levels.min}-${g.levels.max})` : '';
	r.line = `next ${g.id}  # ${r.name}${levels}, ${guideFor(g)}`;
	// Where the guide hands over: one guide, or a route choice.
	if (r.next.length) r.notes = [`# its next: ${r.next.join(' or ')}${r.next.length > 1 ? ' (route choice)' : ''}`];
	return r;
}

// -> results, best first: exact names, then names starting with the text,
// then the rest; by kind (quest, npc, object, item, guide), then id. A guide
// also matches by id and zone. `race` (a race file) and `cls` (a class file)
// keep what such a character can use: quests by race and class mask, NPCs by
// the race's sides, guides by their faction, race and class conditions.
function find(data, guides, { text, kind = null, faction = null, race = null, cls = null, limit = 20 } = {}) {
	const q = String(text || '').trim();
	if (!q) return [];
	const numeric = /^\d+$/.test(q);
	const needle = q.toLowerCase();
	const rank = (name) => {
		const n = String(name || '').toLowerCase();
		if (n === needle) return 0;
		if (n.startsWith(needle)) return 1;
		return n.includes(needle) ? 2 : -1;
	};
	const hits = [];
	// `also` (a guide's id and zone) matches as a plain substring.
	const consider = (k, id, name, make, also = []) => {
		if (kind && kind !== k) return;
		let r = numeric ? (String(id) === q ? 0 : -1) : rank(name);
		if (r < 0 && also.some((a) => a && String(a).toLowerCase().includes(needle))) r = 2;
		if (r >= 0) hits.push({ r, k: KINDS.indexOf(k), id, make });
	};
	const tag = faction ? TAG[faction] : null;
	const who = [faction && { factions: [faction] }, race && { races: [race] }, cls && { classes: [cls] }];
	const character = race || cls ? applicable(who) : null;
	const raceTags = race ? raceSides(race).map((s) => TAG[s]) : null;
	for (const x of Object.values(data.quests)) {
		if (!x || !x.title || (faction && !questFor(x, faction)) || (character && maskExcludes(character, x))) continue;
		consider('quest', x.id, x.title, () => questResult(data, x));
	}
	for (const x of Object.values(data.npcs)) {
		if (!x || !x.name || (tag && x.faction && !String(x.faction).includes(tag))) continue;
		if (raceTags && x.faction && !raceTags.some((t) => String(x.faction).includes(t))) continue;
		consider('npc', x.id, x.name, () => npcResult(data, x));
	}
	for (const x of Object.values(data.objects)) if (x && x.name) consider('object', x.id, x.name, () => objectResult(data, x));
	for (const x of Object.values(data.items)) if (x && x.name) consider('item', x.id, x.name, () => itemResult(x));
	if (!numeric) {
		const classesOf = (r, s) => data.raceClasses(r, s);
		for (const g of guides || []) {
			if (faction && g.faction && g.faction !== faction) continue;
			if (character && !characterKeys([{ factions: g.faction ? [g.faction] : null, races: g.races, classes: g.classes }, ...who], classesOf).size) continue;
			consider('guide', g.id, g.title, () => guideResult(g), [g.id, g.zone]);
		}
	}
	hits.sort((a, b) => a.r - b.r || a.k - b.k || (typeof a.id === 'number' && typeof b.id === 'number' ? a.id - b.id : String(a.id) < String(b.id) ? -1 : String(a.id) > String(b.id) ? 1 : 0));
	return hits.slice(0, limit).map((h) => h.make());
}

module.exports = { find, loadGuideHeaders, KINDS, FACTIONS };
