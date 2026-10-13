'use strict';
// Zone crossings: where walking may leave one zone for another.
//
// Three kinds of entry, all in map percent of the Era client maps:
//   crossings  a pair of points, one in each zone, at a tunnel, pass, bridge,
//              gate or lift, each with an arrival radius in yards; an optional
//              caption per direction ("ab": walking a -> b, "ba": b -> a) and
//              `oneWay` (a -> b only)
//   open       zone pairs whose shared border is walkable anywhere
//   chains     approach chains: ordered nodes with radius and caption (a cave
//              or a climb); nodes after the mouth are reachable only through
//              their own chain links ("open": "mouth"), or the last node is a
//              second mouth ("both")
//
// Sources: an optional local crossings file (data/local/crossings.json,
// gitignored; built into the local data addon Polestar_Travel, never
// committed or packaged) and zone changes in recorded play (learned paths,
// written into TravelData.lua). Every entry is validated here; errors name
// the entry.

const fs = require('node:fs');
const { round } = require('./geo');
const { packageVersion } = require('../dsl/project');

const LIMITS = {
	radiusMin: 3, // yards
	radiusMax: 100,
	pairYards: 1000, // between the two ends of a crossing
	hopYards: 600, // between consecutive chain nodes
	caption: 160, // characters
	offMap: [-50, 150], // map percent allowed with `offMap: true`
};

const KEYS = {
	top: ['schema', 'frame', 'source', 'crossings', 'open', 'chains'],
	crossing: ['id', 'a', 'b', 'ab', 'ba', 'oneWay'],
	end: ['map', 'x', 'y', 'radius', 'offMap'],
	open: ['a', 'b', 'oneWay'],
	chain: ['id', 'name', 'open', 'nodes'],
	node: ['map', 'x', 'y', 'radius', 'caption', 'back', 'offMap'],
};

const isObj = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);

function unknownKeys(obj, allowed, where, errors) {
	for (const k of Object.keys(obj)) if (!allowed.includes(k)) errors.push(`${where}: unknown key "${k}"`);
}

function checkCaption(v, where, errors) {
	if (v === undefined) return undefined;
	if (typeof v !== 'string' || !v.trim()) {
		errors.push(`${where}: caption must be a non-empty string`);
		return undefined;
	}
	if (v.length > LIMITS.caption) errors.push(`${where}: caption longer than ${LIMITS.caption} characters`);
	// eslint-disable-next-line no-control-regex
	if (/[\u0000-\u001f]|\|[cCrRTtnH]/.test(v)) errors.push(`${where}: caption has control characters or | escape codes`);
	return v;
}

// One point: { map, x, y, radius, offMap } -> { map, x, y, r, c, wx, wy } or null.
function checkPoint(p, where, keys, frames, errors) {
	if (!isObj(p)) {
		errors.push(`${where}: expected an object`);
		return null;
	}
	unknownKeys(p, keys, where, errors);
	let ok = true;
	if (!Number.isInteger(p.map) || !frames.frame(p.map)) {
		errors.push(`${where}: map ${JSON.stringify(p.map)} is not a known uiMap id with a map frame`);
		ok = false;
	}
	for (const k of ['x', 'y']) {
		const v = p[k];
		if (typeof v !== 'number' || !Number.isFinite(v)) {
			errors.push(`${where}: ${k} must be a number`);
			ok = false;
			continue;
		}
		const [lo, hi] = p.offMap === true ? LIMITS.offMap : [0, 100];
		if (v < lo || v > hi) {
			errors.push(`${where}: ${k} ${v} outside ${lo}-${hi}${p.offMap === true ? '' : ' (set "offMap": true for a point past the map edge)'}`);
			ok = false;
		}
	}
	if (p.offMap !== undefined && typeof p.offMap !== 'boolean') errors.push(`${where}: offMap must be true or false`);
	if (typeof p.radius !== 'number' || !Number.isFinite(p.radius)) {
		errors.push(`${where}: radius (yards) is required`);
		ok = false;
	} else if (p.radius < LIMITS.radiusMin || p.radius > LIMITS.radiusMax) {
		errors.push(`${where}: radius ${p.radius} outside ${LIMITS.radiusMin}-${LIMITS.radiusMax} yd`);
		ok = false;
	}
	if (!ok) return null;
	const w = frames.toWorld(p.map, p.x, p.y);
	return { map: p.map, x: p.x, y: p.y, r: p.radius, c: w.c, wx: round(w.wx, 1), wy: round(w.wy, 1) };
}

const yards = (a, b) => (a.c === b.c ? Math.hypot(a.wx - b.wx, a.wy - b.wy) : Infinity);

// doc: the parsed crossings file -> { errors, crossings, open, chains } (normalised, with world positions).
function validateCrossings(doc, frames) {
	const errors = [];
	const out = { errors, crossings: [], open: [], chains: [] };
	if (!isObj(doc)) {
		errors.push('crossings file: expected a JSON object');
		return out;
	}
	unknownKeys(doc, KEYS.top, 'crossings file', errors);
	if (doc.schema !== 1) errors.push(`crossings file: schema ${JSON.stringify(doc.schema)} (expected 1)`);
	if (doc.frame !== undefined && doc.frame !== 'e') errors.push(`crossings file: frame ${JSON.stringify(doc.frame)} (only "e", the Era client maps)`);
	const ids = new Map();
	const claim = (id, where) => {
		if (typeof id !== 'string' || !/^[a-z0-9][a-z0-9-]*$/.test(id)) {
			errors.push(`${where}: id ${JSON.stringify(id)} must be lower-case letters, digits and dashes`);
			return;
		}
		if (ids.has(id)) errors.push(`${where}: duplicate id "${id}" (also ${ids.get(id)})`);
		else ids.set(id, where);
	};
	const list = (k) => {
		if (doc[k] === undefined) return [];
		if (!Array.isArray(doc[k])) {
			errors.push(`crossings file: ${k} must be an array`);
			return [];
		}
		return doc[k];
	};

	list('crossings').forEach((e, i) => {
		const where = `crossings[${i}]${isObj(e) && typeof e.id === 'string' ? ` (${e.id})` : ''}`;
		if (!isObj(e)) {
			errors.push(`${where}: expected an object`);
			return;
		}
		unknownKeys(e, KEYS.crossing, where, errors);
		claim(e.id, where);
		const a = checkPoint(e.a, `${where}.a`, KEYS.end, frames, errors);
		const b = checkPoint(e.b, `${where}.b`, KEYS.end, frames, errors);
		const ab = checkCaption(e.ab, `${where}.ab`, errors);
		const ba = checkCaption(e.ba, `${where}.ba`, errors);
		if (e.oneWay !== undefined && typeof e.oneWay !== 'boolean') errors.push(`${where}: oneWay must be true or false`);
		if (!a || !b) return;
		if (a.c !== b.c) {
			errors.push(`${where}: the ends are on different continents (${a.c}, ${b.c})`);
			return;
		}
		if (a.map === b.map) {
			errors.push(`${where}: both ends are in zone ${a.map}; a crossing joins two zones`);
			return;
		}
		const d = yards(a, b);
		if (d > LIMITS.pairYards) {
			errors.push(`${where}: the ends are ${Math.round(d)} yd apart (more than ${LIMITS.pairYards})`);
			return;
		}
		out.crossings.push({ id: e.id, a, b, ab, ba, oneWay: e.oneWay === true });
	});

	const pairs = new Set();
	list('open').forEach((e, i) => {
		const where = `open[${i}]`;
		if (!isObj(e)) {
			errors.push(`${where}: expected an object`);
			return;
		}
		unknownKeys(e, KEYS.open, where, errors);
		const fa = Number.isInteger(e.a) && frames.frame(e.a);
		const fb = Number.isInteger(e.b) && frames.frame(e.b);
		if (!fa) errors.push(`${where}: a ${JSON.stringify(e.a)} is not a known uiMap id with a map frame`);
		if (!fb) errors.push(`${where}: b ${JSON.stringify(e.b)} is not a known uiMap id with a map frame`);
		if (e.oneWay !== undefined && typeof e.oneWay !== 'boolean') errors.push(`${where}: oneWay must be true or false`);
		if (!fa || !fb) return;
		if (e.a === e.b) return void errors.push(`${where}: a zone is not a pair with itself`);
		if (fa.c !== fb.c) return void errors.push(`${where}: ${e.a} and ${e.b} are on different continents`);
		const key = `${Math.min(e.a, e.b)}-${Math.max(e.a, e.b)}`;
		if (pairs.has(key)) return void errors.push(`${where}: duplicate open pair ${e.a} / ${e.b}`);
		pairs.add(key);
		out.open.push({ a: e.a, b: e.b, c: fa.c, oneWay: e.oneWay === true });
	});

	list('chains').forEach((e, i) => {
		const where = `chains[${i}]${isObj(e) && typeof e.id === 'string' ? ` (${e.id})` : ''}`;
		if (!isObj(e)) {
			errors.push(`${where}: expected an object`);
			return;
		}
		unknownKeys(e, KEYS.chain, where, errors);
		claim(e.id, where);
		if (e.name !== undefined && (typeof e.name !== 'string' || !e.name.trim())) errors.push(`${where}: name must be a non-empty string`);
		const open = e.open === undefined ? 'mouth' : e.open;
		if (open !== 'mouth' && open !== 'both') errors.push(`${where}: open must be "mouth" or "both"`);
		if (!Array.isArray(e.nodes) || e.nodes.length < 2) {
			errors.push(`${where}: a chain needs at least 2 nodes`);
			return;
		}
		const nodes = e.nodes.map((n, k) => {
			const p = checkPoint(n, `${where}.nodes[${k}]`, KEYS.node, frames, errors);
			const caption = checkCaption(n && n.caption, `${where}.nodes[${k}].caption`, errors);
			const back = checkCaption(n && n.back, `${where}.nodes[${k}].back`, errors);
			return p && { ...p, caption, back };
		});
		if (nodes.some((n) => !n)) return;
		for (let k = 1; k < nodes.length; k++) {
			const d = yards(nodes[k - 1], nodes[k]);
			if (!Number.isFinite(d)) return void errors.push(`${where}: nodes ${k - 1} and ${k} are on different continents`);
			if (d > LIMITS.hopYards) return void errors.push(`${where}: nodes ${k - 1} -> ${k} are ${Math.round(d)} yd apart (more than ${LIMITS.hopYards})`);
		}
		out.chains.push({ id: e.id, name: e.name || e.id, open, c: nodes[0].c, nodes });
	});
	return out;
}

// The optional local file: null when absent; throws with every error listed.
function readCrossingsFile(file, frames) {
	if (!file || !fs.existsSync(file)) return null;
	let doc;
	try {
		doc = JSON.parse(fs.readFileSync(file, 'utf8'));
	} catch (err) {
		throw new Error(`${file}: ${err.message}`);
	}
	const v = validateCrossings(doc, frames);
	if (v.errors.length) throw new Error(`${file}: ${v.errors.length} error(s)\n  ${v.errors.join('\n  ')}`);
	return v;
}

// Zone changes in recorded play -> crossings (our own data). steps: { c,
// from: { map, wx, wy }, to: { map, wx, wy }, session } where one breadcrumb
// is in `from.map` and the next in `to.map`. Steps of one zone pair within
// GRID yards of each other merge; each end is the mean of its points.
const RECORDED_GRID = 100;
const RECORDED_RADIUS = 20;

function recordedCrossings(steps, frames) {
	const groups = new Map();
	for (const s of steps) {
		const [lo, hi] = s.from.map < s.to.map ? [s.from, s.to] : [s.to, s.from];
		const mx = (lo.wx + hi.wx) / 2;
		const my = (lo.wy + hi.wy) / 2;
		const key = `${s.c}:${lo.map}:${hi.map}:${Math.floor(mx / RECORDED_GRID)}:${Math.floor(my / RECORDED_GRID)}`;
		let g = groups.get(key);
		if (!g) {
			g = { c: s.c, lo: lo.map, hi: hi.map, a: { x: 0, y: 0 }, b: { x: 0, y: 0 }, n: 0, sessions: new Set() };
			groups.set(key, g);
		}
		g.a.x += lo.wx;
		g.a.y += lo.wy;
		g.b.x += hi.wx;
		g.b.y += hi.wy;
		g.n += 1;
		g.sessions.add(s.session);
	}
	const keys = [...groups.keys()].sort();
	const seen = new Map();
	return keys.map((key) => {
		const g = groups.get(key);
		const base = `recorded-${g.lo}-${g.hi}`;
		const k = (seen.get(base) || 0) + 1;
		seen.set(base, k);
		const end = (map, sx, sy) => {
			const wx = round(sx / g.n, 1);
			const wy = round(sy / g.n, 1);
			const p = frames.toMap(map, g.c, wx, wy);
			return { map, x: p ? round(p.x, 2) : null, y: p ? round(p.y, 2) : null, r: RECORDED_RADIUS, c: g.c, wx, wy };
		};
		return {
			id: `${base}-${k}`,
			a: end(g.lo, g.a.x, g.a.y),
			b: end(g.hi, g.b.x, g.b.y),
			oneWay: false,
			steps: g.n,
			sessions: [...g.sessions].sort(),
		};
	});
}

// --- Lua -----------------------------------------------------------------------

function luaStr(s) {
	return `"${String(s).replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\n/g, '\\n')}"`;
}

const num = (n) => String(Object.is(n, -0) ? 0 : n);

function endLua(p) {
	return `{ map = ${p.map}, c = ${p.c}, wx = ${num(p.wx)}, wy = ${num(p.wy)}, r = ${num(p.r)} }`;
}

// Zone info the planner needs for every zone a set mentions: name and Era
// frame (to place a point whose map is not a zone), plus `wild`: the other
// zone maps of a covered continent (no crossing data; walked as before).
function zoneTable(set, frames, { complete }) {
	const maps = new Set();
	for (const e of set.crossings) maps.add(e.a.map).add(e.b.map);
	for (const e of set.open) maps.add(e.a).add(e.b);
	for (const ch of set.chains) for (const n of ch.nodes) maps.add(n.map);
	const zones = [...maps].sort((a, b) => a - b).map((map) => {
		const f = frames.frame(map);
		return { map, name: frames.name(map) || String(map), c: f.c, top: f.top, bottom: f.bottom, left: f.left, right: f.right };
	});
	const wild = [];
	if (complete) {
		const covered = new Set(zones.map((z) => z.c));
		for (const [id, f] of frames.frames) {
			const z = frames.zones[String(id)];
			if (z && z.type === 3 && covered.has(f.c) && !maps.has(id)) wild.push(id);
		}
		wild.sort((a, b) => a - b);
	}
	return { zones, wild };
}

// The N.RegisterCrossings({...}) call for a set (lines, no trailing newline).
function crossingsLua(set, frames, { complete }) {
	const { zones, wild } = zoneTable(set, frames, { complete });
	const L = [];
	L.push('N.RegisterCrossings({');
	if (complete) L.push('\t-- the continents this set covers walk between zones only through it');
	L.push(`\tcomplete = ${complete ? 'true' : 'false'},`);
	L.push('\t-- uiMap = { name, continent, Era frame }');
	L.push('\tzones = {');
	for (const z of zones) L.push(`\t\t[${z.map}] = { name = ${luaStr(z.name)}, c = ${z.c}, top = ${num(z.top)}, bottom = ${num(z.bottom)}, left = ${num(z.left)}, right = ${num(z.right)} },`);
	L.push('\t},');
	if (wild.length) {
		L.push('\t-- other zones on these continents (no crossing data: walked as before)');
		L.push(`\twild = { ${wild.join(', ')} },`);
	}
	L.push('\t-- id, ends a and b (uiMap, continent, world yards, arrival radius), captions a->b and b->a, oneWay');
	L.push('\tcrossings = {');
	for (const e of set.crossings) {
		const parts = [`id = ${luaStr(e.id)}`, `a = ${endLua(e.a)}`, `b = ${endLua(e.b)}`];
		if (e.ab) parts.push(`ab = ${luaStr(e.ab)}`);
		if (e.ba) parts.push(`ba = ${luaStr(e.ba)}`);
		if (e.oneWay) parts.push('oneWay = true');
		L.push(`\t\t{ ${parts.join(', ')} },`);
	}
	L.push('\t},');
	if (set.open.length) {
		L.push('\t-- zone a, zone b, one way (1: a -> b only)');
		L.push('\topen = {');
		for (const e of set.open) L.push(`\t\t${e.a}, ${e.b}, ${e.oneWay ? 1 : 0},`);
		L.push('\t},');
	}
	if (set.chains.length) {
		L.push('\t-- nodes: uiMap, continent, world yards, radius, caption walking in, caption walking out');
		L.push('\tchains = {');
		for (const ch of set.chains) {
			L.push(`\t\t{ id = ${luaStr(ch.id)}, name = ${luaStr(ch.name)}, open = ${luaStr(ch.open)}, nodes = {`);
			for (const n of ch.nodes) {
				const parts = [`map = ${n.map}`, `c = ${n.c}`, `wx = ${num(n.wx)}`, `wy = ${num(n.wy)}`, `r = ${num(n.r)}`];
				if (n.caption) parts.push(`caption = ${luaStr(n.caption)}`);
				if (n.back) parts.push(`back = ${luaStr(n.back)}`);
				L.push(`\t\t\t{ ${parts.join(', ')} },`);
			}
			L.push('\t\t} },');
		}
		L.push('\t},');
	}
	L.push('})');
	return L;
}

const TRAVEL_ADDON = 'Polestar_Travel';

// The local data addon: { 'Polestar_Travel.toc': text, 'Crossings.lua': text }.
function emitTravelAddon(set, frames) {
	const toc = [
		'## Interface: 16001',
		'## Title: Polestar Travel (local)',
		'## Notes: Zone crossings for Polestar\'s travel planner, built from an optional local crossings file. Local use only.',
		'## Author: Polestar',
		`## Version: ${packageVersion()}`,
		'## Category: Quests',
		'## Dependencies: Polestar',
		'',
		'Crossings.lua',
		'',
	].join('\n');
	const counts = `${set.crossings.length} crossing(s), ${set.open.length} open-ground pair(s), ${set.chains.length} approach chain(s)`;
	const lua = [
		'-- Generated by `node tools/polestar.js travel build` from the optional local',
		`-- crossings file (data/local/crossings.json): ${counts}.`,
		'-- Local use only: never committed or packaged. Do not edit.',
		'',
		'local N = Polestar and Polestar.Nav',
		'if not (N and N.RegisterCrossings) then return end',
		'',
		...crossingsLua(set, frames, { complete: true }),
		'',
	].join('\n');
	return { [`${TRAVEL_ADDON}.toc`]: toc, 'Crossings.lua': lua };
}

// Per continent counts, for reports.
function crossingCounts(set) {
	const out = {};
	const bump = (c, k) => {
		out[c] = out[c] || { crossings: 0, open: 0, chains: 0, chainNodes: 0 };
		out[c][k] += 1;
	};
	for (const e of set.crossings) bump(e.a.c, 'crossings');
	for (const e of set.open) bump(e.c, 'open');
	for (const ch of set.chains) {
		bump(ch.c, 'chains');
		out[ch.c].chainNodes += ch.nodes.length;
	}
	return out;
}

module.exports = {
	LIMITS,
	TRAVEL_ADDON,
	validateCrossings,
	readCrossingsFile,
	recordedCrossings,
	crossingsLua,
	emitTravelAddon,
	crossingCounts,
};
