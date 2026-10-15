'use strict';
// Walking paths learned from recorded play (data/recordings/*.json).
//
// The recorder drops a `pos` breadcrumb every ~25 yd of movement (not on
// taxis). Consecutive breadcrumbs of one session are a stretch someone
// actually walked: points snap to a CELL-yard grid (a node is the mean of its
// points), consecutive distinct cells become an edge, and a step across two
// maps marks both nodes as gateways (zone-border crossings) and is kept as a
// zone step (crossings.js turns them into recorded crossings). Steps that are
// too long or too fast for walking (a flight, a hearth, a death run) break
// the chain. Chains of plain degree-2 nodes collapse into single edges, so
// the addon carries corners and junctions, not every breadcrumb.

const { round } = require('./geo');

const CELL = 30; // yards
const MAX_STEP = 150; // yards between breadcrumbs still counted as walking
const MAX_SPEED = 25; // yd/s; faster is a flight, boat or teleport
const BREAKS = new Set(['taxi', 'death', 'bind']);

function liveFramesOf(recordings) {
	const out = new Map();
	for (const { rec } of recordings) {
		for (const [id, m] of Object.entries(rec.maps || {})) {
			const ok = m && ['c', 'left', 'right', 'top', 'bottom'].every((k) => Number.isFinite(Number(m[k])));
			if (ok && !out.has(Number(id))) {
				out.set(Number(id), { c: Number(m.c), left: Number(m.left), right: Number(m.right), top: Number(m.top), bottom: Number(m.bottom) });
			}
		}
	}
	return out;
}

function toWorld(map, x, y, rec, frames) {
	const m = rec.maps && rec.maps[String(map)];
	let b = null;
	if (m && ['c', 'left', 'right', 'top', 'bottom'].every((k) => Number.isFinite(Number(m[k])))) b = m;
	else b = frames.frame(map);
	if (!b) return null;
	return {
		c: Number(b.c),
		wx: Number(b.top) + (Number(b.bottom) - Number(b.top)) * (y / 100),
		wy: Number(b.left) + (Number(b.right) - Number(b.left)) * (x / 100),
	};
}

// Each session's breadcrumbs, cut into walks: a walk is a run of points
// someone actually walked, broken at a flight, a death or a bind, at a point
// on a map without bounds, and at a step that is too long or too fast for
// walking. -> { walks: [{ session, points: [{ c, wx, wy, map, t }] }], unplaced }
function recordedWalks({ recordings, frames }) {
	const walks = [];
	let unplaced = 0;
	for (const { file, rec } of recordings) {
		const session = String(rec.session || file.replace(/\.json$/, ''));
		let walk = null;
		const cut = () => {
			if (walk && walk.points.length) walks.push(walk);
			walk = null;
		};
		for (const ev of rec.events || []) {
			if (BREAKS.has(ev.e)) {
				cut();
				continue;
			}
			if (ev.e !== 'pos') continue;
			const map = Number(ev.map);
			const x = Number(ev.x);
			const y = Number(ev.y);
			if (!Number.isInteger(map) || !Number.isFinite(x) || !Number.isFinite(y)) continue;
			const w = toWorld(map, x, y, rec, frames);
			if (!w) {
				unplaced++;
				cut();
				continue;
			}
			const p = { ...w, map, t: Number(ev.t) || 0 };
			const prev = walk && walk.points[walk.points.length - 1];
			if (prev) {
				const d = Math.hypot(p.wx - prev.wx, p.wy - prev.wy);
				const dt = p.t - prev.t;
				if (prev.c !== p.c || d > MAX_STEP || (dt > 0 && d / dt > MAX_SPEED)) cut();
			}
			if (!walk) walk = { session, points: [] };
			walk.points.push(p);
		}
		cut();
	}
	return { walks, unplaced };
}

function buildPaths({ recordings, frames }) {
	const warnings = [];
	const cells = new Map(); // key -> { c, gx, gy, sx, sy, n, maps: Map, gateway: Set }
	const edges = new Map(); // "k1|k2" -> { a, b, n, sessions: Set }
	const zoneSteps = []; // { c, from: { map, wx, wy }, to: { map, wx, wy }, session }: one step across a zone border

	const cellOf = (p) => {
		const gx = Math.floor(p.wx / CELL);
		const gy = Math.floor(p.wy / CELL);
		const key = `${p.c}:${gx}:${gy}`;
		let cell = cells.get(key);
		if (!cell) {
			cell = { key, c: p.c, gx, gy, sx: 0, sy: 0, n: 0, maps: new Map(), gateway: new Set() };
			cells.set(key, cell);
		}
		cell.sx += p.wx;
		cell.sy += p.wy;
		cell.n += 1;
		cell.maps.set(p.map, (cell.maps.get(p.map) || 0) + 1);
		return cell;
	};

	const { walks, unplaced } = recordedWalks({ recordings, frames });
	for (const { session, points } of walks) {
		let prev = null;
		for (const p of points) {
			const b = cellOf(p);
			const a = prev && prev.cell;
			if (a && a !== b) {
				if (prev.map !== p.map) {
					a.gateway.add(prev.map).add(p.map);
					b.gateway.add(prev.map).add(p.map);
					zoneSteps.push({ c: p.c, from: { map: prev.map, wx: prev.wx, wy: prev.wy }, to: { map: p.map, wx: p.wx, wy: p.wy }, session });
				}
				const [k1, k2] = a.key < b.key ? [a.key, b.key] : [b.key, a.key];
				const ek = `${k1}|${k2}`;
				let e = edges.get(ek);
				if (!e) {
					e = { a: k1, b: k2, n: 0, sessions: new Set() };
					edges.set(ek, e);
				}
				e.n += 1;
				e.sessions.add(session);
			}
			prev = { ...p, cell: b };
		}
	}
	if (unplaced) warnings.push(`learned paths: ${unplaced} breadcrumb(s) on maps without bounds skipped`);

	// Adjacency over cells that have edges.
	const adj = new Map();
	for (const e of edges.values()) {
		if (!adj.has(e.a)) adj.set(e.a, new Map());
		if (!adj.has(e.b)) adj.set(e.b, new Map());
		adj.get(e.a).set(e.b, e);
		adj.get(e.b).set(e.a, e);
	}
	const pos = (key) => {
		const c = cells.get(key);
		return { wx: c.sx / c.n, wy: c.sy / c.n };
	};
	const len = (a, b) => {
		const p = pos(a);
		const q = pos(b);
		return Math.hypot(p.wx - q.wx, p.wy - q.wy);
	};

	// Collapse plain degree-2 nodes: walk each chain between kept nodes.
	const keep = new Set();
	for (const [key, nb] of adj) if (nb.size !== 2 || cells.get(key).gateway.size) keep.add(key);
	const out = new Map(); // "k1|k2" -> { a, b, yards, n, sessions }
	const visited = new Set();
	const keys = [...adj.keys()].sort();
	const addEdge = (a, b, yards, n, sessions) => {
		if (a === b) return;
		const [k1, k2] = a < b ? [a, b] : [b, a];
		const ek = `${k1}|${k2}`;
		const e = out.get(ek);
		if (!e || e.yards > yards) out.set(ek, { a: k1, b: k2, yards, n, sessions });
	};
	for (const start of keys) {
		if (!keep.has(start)) continue;
		for (const next of [...adj.get(start).keys()].sort()) {
			const first = adj.get(start).get(next);
			const ek = `${first.a}|${first.b}`;
			if (visited.has(ek)) continue;
			visited.add(ek);
			let yards = len(start, next);
			let n = first.n;
			const sessions = new Set(first.sessions);
			let prev = start;
			let cur = next;
			while (!keep.has(cur)) {
				const [nxt] = [...adj.get(cur).keys()].filter((k) => k !== prev);
				if (nxt === undefined) break;
				const e = adj.get(cur).get(nxt);
				visited.add(`${e.a}|${e.b}`);
				yards += len(cur, nxt);
				n = Math.min(n, e.n);
				for (const s of e.sessions) sessions.add(s);
				prev = cur;
				cur = nxt;
				if (cur === start) break;
			}
			addEdge(start, cur, yards, n, sessions);
		}
	}
	// Edges no chain walk reached (closed loops of plain nodes) stay as they are.
	for (const ek of [...edges.keys()].sort()) {
		if (visited.has(ek)) continue;
		const e = edges.get(ek);
		addEdge(e.a, e.b, len(e.a, e.b), e.n, new Set(e.sessions));
	}

	const used = new Set();
	for (const e of out.values()) used.add(e.a).add(e.b);
	const ordered = [...used].sort((a, b) => {
		const ca = cells.get(a);
		const cb = cells.get(b);
		return ca.c - cb.c || ca.gx - cb.gx || ca.gy - cb.gy;
	});
	const index = new Map(ordered.map((k, i) => [k, i + 1]));
	const nodes = ordered.map((k) => {
		const cell = cells.get(k);
		const p = pos(k);
		const maps = [...cell.maps.entries()].sort((a, b) => b[1] - a[1] || a[0] - b[0]);
		const node = { id: index.get(k), c: cell.c, wx: round(p.wx, 1), wy: round(p.wy, 1), map: maps[0][0] };
		if (cell.gateway.size) node.gateway = [...cell.gateway].sort((a, b) => a - b);
		return node;
	});
	const edgeList = [...out.values()]
		.map((e) => ({ a: index.get(e.a), b: index.get(e.b), yards: Math.round(e.yards), n: e.n, sessions: [...e.sessions].sort() }))
		.sort((x, y) => x.a - y.a || x.b - y.b);
	const sessions = [...new Set(edgeList.flatMap((e) => e.sessions))].sort();
	return { nodes, edges: edgeList, sessions, zoneSteps, warnings };
}

module.exports = { buildPaths, recordedWalks, liveFramesOf, CELL, MAX_STEP, MAX_SPEED };
