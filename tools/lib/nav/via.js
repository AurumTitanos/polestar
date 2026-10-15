'use strict';
// The arrow's waypoints from the navigation grid (docs/ARCHITECTURE.md,
// "Navigation grid"; docs/PACK_FORMAT.md, "via.json"): for every leg of a
// pack's guides (tools/lib/dsl/legs.js), the points the in-game arrow leads
// through before pointing at the goal, written to <pack>/via.json by
// `node tools/polestar.js nav via`.
//
//   const { generate, generateLegs, handMadeOf, loadHandMade, formatVia } = require('tools/lib/nav/via');
//   generate({ packDir, guides?, nav, workers, force, onlyGuide, dataDir, crossingsFile, log })
//     -> Promise<{ doc, text, stats }>  (writes nothing; text: formatVia(doc))
//   generateLegs({ guide, keys?, nav, pool?, geo, frames, sets, log })
//     -> Promise<{ entries: { key: { via } | { via: [], hand: true } }, skipped: { key: 'hand-made' | 'unroutable: <reason>' },
//                 handMade: { key: { kind, id, name } }, over: [key] }>
//     one guide's legs (or those of `keys`), nothing written: the planner's
//     "Regenerate waypoints". frames: map-frames.json; pool: a NavRoutes
//     (tools/planner/navpool.js), else routes are computed in this thread.
//   loadHandMade({ dataDir, crossingsFile, frames }) -> [validated crossings set]
//   handMadeOf(leg, { geo, sets, pts }) -> null | { kind: 'goto' | 'chain' | 'crossing', id, name }
//   formatVia(doc) -> the file's text (stable)
//   measureArrow({ items, nav, frames, log }) -> the arrow's blocked yards and
//     walked length without and with via (the report)
//
// Per leg (decided in docs/superpowers/specs/2026-10-15-arrow-waypoints-design.md):
// the route on foot (profileFor({})) between the leg's ends, quantised to 1
// yd as the planner's route cache keys them (its cache, routes-<build>.jsonl,
// is shared). No route: no entry. A straight walkable line (nav.los) no
// longer than DETOUR x the straight distance: `via: []`. Else the route is
// string-pulled: it is cut into runs at falls, lifts and changes between
// outdoor, indoor and swim; in each run, from the current point, the
// farthest later route point with nav.los true (giving up LOOKAHEAD points
// after the last one seen) is the next point; every cut is a point. Points
// within END_DROP yd of either end are dropped, and so is an unlabelled point
// within the previous point's radius when that one sees the point after it
// and no fall or lift starts there (decided here); at most MAX_POINTS
// kept (the first). Labels from the route classes around a point: into indoor under
// terrain "Enter the cave", into another indoor "Go inside", out of them
// "Leave the cave" / "Go outside", a lift "Take the lift up" / "down", a
// climb (climb links and CLIMB_RISE yd up to the next point) "Follow the
// path up", into swimming "Swim across", over BRIDGE_RUN yd or more of
// bridge (aids.js bridgeAt) "Cross the bridge", else null. Radius R_OUT yd outdoors, R_IN indoors,
// R_LIFT at a lift. `inner` from a cave/building/climb/lift entry to its
// exit (a lift up: until a lift down). Maps: the goal's when the point lies
// in its frame, else the smallest zone/city map holding it.
//
// A hand-made path always wins (the owner's rule): legs from or to a guide
// `goto` get no entry; legs whose straight walk or route passes a hand-made
// chain node or crossing end within its radius, or whose start or target a
// chain serves (inside it, as Nav/Travel.lua insideChain: within
// max(2 x radius, 30) yd of a node past the mouth), get `{ via: [], hand:
// true }`, re-evaluated every run. Hand-made: the committed recorded
// crossings (data/forever/travel.json) and the local crossings file
// (data/local/crossings.json), the files `travel build` reads. Entries
// marked `manual` (the planner) are kept unless --force; keys no current leg
// has are dropped.

const fs = require('node:fs');
const path = require('node:path');
const { CLS, FLAG, TILE_CELLS, cellOf } = require('./grid/format');
const { profileFor } = require('./move');
const { bridgeAt } = require('./aids');
const { guideLegs } = require('../dsl/legs');
const { VIA_SCHEMA, readViaFile } = require('../dsl/via');
const { DATA } = require('../paths');

const MAX_POINTS = 12;
const END_DROP = 15; // yd
const DETOUR = 1.05;
const LOOKAHEAD = 4; // route points tried past the last one in sight
const R_OUT = 12;
const R_IN = 8;
const R_LIFT = 6;
const CLIMB_RISE = 8; // yd up to the next point with climb links on the way
const BRIDGE_RUN = 10; // yd of bridge in a row for "Cross the bridge"
const BRIDGE_STEP = 2;
const CAPTURE = 2;
const CAPTURE_MIN = 30;

const r1 = (v) => Math.round(v * 10) / 10;
const r2 = (v) => Math.round(v * 100) / 100;
const q = (v) => Math.round(v);
const d2 = (a, b) => Math.hypot(a.wx - b.wx, a.wy - b.wy);

// --- hand-made paths ---------------------------------------------------------------

// The hand-made crossing sets: the committed recorded crossings and the local file.
function loadHandMade({ dataDir = DATA, crossingsFile = path.join(dataDir, '..', 'local', 'crossings.json'), frames }) {
	const { readCrossingsFile } = require('../travel/crossings');
	const sets = [];
	try {
		const travel = JSON.parse(fs.readFileSync(path.join(dataDir, 'travel.json'), 'utf8'));
		const recorded = (travel.crossings && travel.crossings.recorded) || [];
		if (recorded.length) sets.push({ crossings: recorded, open: [], chains: [] });
	} catch (err) {
		if (err.code !== 'ENOENT') throw err;
	}
	const local = readCrossingsFile(crossingsFile, frames);
	if (local) sets.push(local);
	return sets;
}

// Distance (2D) from p to the segment a-b.
function segDist(p, a, b) {
	const dx = b.wx - a.wx;
	const dy = b.wy - a.wy;
	const L = dx * dx + dy * dy;
	const t = L ? Math.max(0, Math.min(1, ((p.wx - a.wx) * dx + (p.wy - a.wy) * dy) / L)) : 0;
	return Math.hypot(a.wx + t * dx - p.wx, a.wy + t * dy - p.wy);
}

// Within r of the polyline (flat [wx, wy, z, ...]) or of the segment a-b.
function passes(p, r, a, b, pts) {
	if (p.c !== a.c) return false;
	if (segDist(p, a, b) <= r) return true;
	if (!pts) return false;
	for (let i = 0; i + 5 < pts.length; i += 3) {
		if (segDist(p, { wx: pts[i], wy: pts[i + 1] }, { wx: pts[i + 3], wy: pts[i + 4] }) <= r) return true;
	}
	return false;
}

// Inside a chain past its mouth (Nav/Travel.lua insideChain).
function inChain(ch, p) {
	const last = ch.open === 'both' ? ch.nodes.length - 1 : ch.nodes.length;
	for (let k = 1; k < last; k++) {
		const nd = ch.nodes[k];
		if (nd.c === p.c && d2(nd, p) <= Math.max(nd.r * CAPTURE, CAPTURE_MIN)) return true;
	}
	return false;
}

const worldOf = (geo, e) => geo.toWorld(e.map, e.x, e.y, e.f);

// leg: a guideLegs leg; pts: its route's points (optional).
function handMadeOf(leg, { geo, sets = [], pts = null }) {
	if (leg.from.isGoto || leg.to.isGoto) return { kind: 'goto', id: null, name: 'a guide goto' };
	const a = worldOf(geo, leg.from);
	const b = worldOf(geo, leg.to);
	if (!a || !b) return null;
	for (const set of sets) {
		for (const ch of set.chains || []) {
			if (inChain(ch, a) || inChain(ch, b) || ch.nodes.some((nd) => passes(nd, nd.r, a, b, pts))) return { kind: 'chain', id: ch.id, name: ch.name || ch.id };
		}
		for (const x of set.crossings || []) {
			if (passes(x.a, x.a.r, a, b, pts) || passes(x.b, x.b.r, a, b, pts)) return { kind: 'crossing', id: x.id, name: x.id };
		}
	}
	return null;
}

// --- routes ---------------------------------------------------------------------

const quantised = (p) => ({ c: p.c, wx: q(p.wx), wy: q(p.wy) });

// A route as the planner's pool keeps it (navpool.js WORKER).
function compact(r) {
	if (!r.ok) return { ok: false, reason: r.reason || 'no path' };
	return { ok: true, pts: Array.from(r.pts, r1), cls: Array.from(r.cls), yards: r1(r.yards) };
}

// Routes for many legs: the pool's (cached, in its workers) or this thread's.
class Router {
	constructor({ nav, pool = null, profile = profileFor({}) }) {
		this.nav = nav;
		this.pool = pool;
		this.profile = profile;
		this.local = new Map();
		this.provider = null;
	}

	async prefetch(pairs) {
		if (!this.pool) return;
		const { routes, misses } = this.pool.provider();
		for (const [a, b] of pairs) routes(quantised(a), quantised(b), this.profile);
		if (misses.size) await this.pool.compute(misses).promise;
		this.provider = this.pool.provider().routes;
	}

	get(a, b) {
		const A = quantised(a);
		const B = quantised(b);
		if (this.pool) {
			const r = (this.provider || this.pool.provider().routes)(A, B, this.profile);
			return r || { ok: false, reason: 'not computed' };
		}
		const k = `${A.c}:${A.wx}:${A.wy}>${B.wx}:${B.wy}`;
		if (!this.local.has(k)) this.local.set(k, compact(this.nav.route(A, B, this.profile)));
		return this.local.get(k);
	}
}

// --- string pulling and labels ------------------------------------------------------

const envOf = (cls) => (cls === CLS.INDOOR ? 'in' : cls === CLS.SWIM ? 'swim' : 'out');
const isHop = (cls) => cls === CLS.FALL || cls === CLS.LIFT;

function pointsOf(route, c) {
	const P = [];
	for (let i = 0; i + 2 < route.pts.length; i += 3) P.push({ c, wx: route.pts[i], wy: route.pts[i + 1], z: route.pts[i + 2] });
	return P;
}

// Route point indices the arrow leads through (the route's end excluded).
function pull(nav, P, cls, lookahead = LOOKAHEAD) {
	const n = P.length;
	const runs = [];
	let s = 0;
	for (let i = 0; i < n - 1; i++) {
		if (isHop(cls[i])) {
			if (i > s) runs.push([s, i]);
			runs.push(null); // the hop: its start is a cut
			s = i + 1;
		} else if (i > s && envOf(cls[i]) !== envOf(cls[i - 1])) {
			runs.push([s, i]);
			s = i;
		}
	}
	if (s < n - 1) runs.push([s, n - 1]);
	const out = [];
	const cut = (i) => {
		if (i > 0 && i < n - 1 && out[out.length - 1] !== i) out.push(i);
	};
	for (const run of runs) {
		if (!run) continue;
		const [a, e] = run;
		let cur = a;
		while (cur < e) {
			let best = cur + 1;
			let fails = 0;
			for (let j = cur + 2; j <= e; j++) {
				if (nav.los(P[cur], P[j])) {
					best = j;
					fails = 0;
				} else if (++fails >= lookahead) break;
			}
			cut(best);
			cur = best;
		}
		cut(e);
	}
	// A hop's start (a ledge, a lift's foot) is a cut even after a one-point run.
	for (let i = 0; i < n - 1; i++) if (isHop(cls[i]) && i > 0 && !out.includes(i)) out.push(i);
	return out.sort((x, y) => x - y);
}

function columnAt(nav, c, wx, wy) {
	const p = cellOf(wx, wy);
	const t = nav.tile(c, p.col, p.row);
	return t ? { t, k: p.j * TILE_CELLS + p.i } : null;
}

// Under terrain at an indoor point (a cave), as aids.js tells caves from buildings.
function underground(nav, p) {
	const at = columnAt(nav, p.c, p.wx, p.wy);
	if (!at) return false;
	const { t, k } = at;
	let floor = -1;
	for (let e = t.first[k]; e < t.first[k + 1]; e++) if (!(t.flags[e] & FLAG.BLOCKED) && (floor < 0 || Math.abs(t.z[e] - p.z) < Math.abs(t.z[floor] - p.z))) floor = e;
	if (floor < 0) return false;
	for (let e = floor + 1; e < t.first[k + 1]; e++) if (t.flags[e] & FLAG.TERRAIN) return true;
	return false;
}

// A cave when most indoor route points from index i on (to the run's end) lie under terrain.
function caveFrom(nav, P, cls, i) {
	let inside = 0;
	let under = 0;
	for (let j = i + 1; j < P.length && envOf(cls[j - 1]) === 'in'; j++) {
		const a = P[j - 1];
		const b = P[j];
		const L = d2(a, b);
		for (let s = 0; s < L; s += 5) {
			const t = s / L;
			inside++;
			if (underground(nav, { c: a.c, wx: a.wx + (b.wx - a.wx) * t, wy: a.wy + (b.wy - a.wy) * t, z: a.z + (b.z - a.z) * t })) under++;
		}
	}
	return inside > 0 && under * 2 >= inside;
}

// The indoor run before index i: a cave?
function caveBefore(nav, P, cls, i) {
	let j = i;
	while (j > 0 && envOf(cls[j - 1]) === 'in' && !isHop(cls[j - 1])) j--;
	return caveFrom(nav, P, cls, j);
}

// A bridge on the route between indices i0 and i1: BRIDGE_RUN yd or more of
// outdoor walk in a row over a model surface with water or air under it
// (aids.js bridgeAt), sampled every BRIDGE_STEP yd.
function bridgeBetween(nav, P, cls, i0, i1) {
	let run = 0;
	for (let j = i0; j < i1; j++) {
		if (cls[j] !== CLS.WALK && cls[j] !== CLS.STEEP) {
			run = 0;
			continue;
		}
		const a = P[j];
		const b = P[j + 1];
		const L = d2(a, b);
		for (let s = 0; s < L; s += BRIDGE_STEP) {
			const t = s / L;
			if (bridgeAt(nav, a.c, { wx: a.wx + (b.wx - a.wx) * t, wy: a.wy + (b.wy - a.wy) * t, z: a.z + (b.z - a.z) * t })) {
				run += BRIDGE_STEP;
				if (run >= BRIDGE_RUN) return true;
			} else run = 0;
		}
	}
	return false;
}

const hasClass = (cls, i0, i1, c) => {
	for (let j = i0; j < i1; j++) if (cls[j] === c) return true;
	return false;
};

// Labelled world points of a route: [{ wx, wy, z, idx, r, label, inner }].
function labelled(nav, P, cls, idxs) {
	const out = [];
	let inside = null; // 'cave' | 'building' | 'climb' | 'lift'
	for (let k = 0; k < idxs.length; k++) {
		const i = idxs[k];
		const next = k + 1 < idxs.length ? idxs[k + 1] : P.length - 1;
		const before = cls[i - 1];
		const after = cls[i];
		let label = null;
		let r = R_OUT;
		let inner = inside ? 1 : 0;
		if (after === CLS.LIFT) {
			const up = P[i + 1].z > P[i].z;
			label = up ? 'Take the lift up' : 'Take the lift down';
			r = R_LIFT;
			if (up && !inside) inside = 'lift';
			else if (!up && inside === 'lift') inside = null;
		} else if (envOf(after) === 'in' && envOf(before) !== 'in') {
			const cave = caveFrom(nav, P, cls, i);
			label = cave ? 'Enter the cave' : 'Go inside';
			r = R_IN;
			if (!inside) inside = cave ? 'cave' : 'building';
		} else if (envOf(before) === 'in' && envOf(after) !== 'in' && !isHop(before)) {
			const cave = inside === 'cave' || (inside !== 'building' && caveBefore(nav, P, cls, i));
			label = cave ? 'Leave the cave' : 'Go outside';
			r = R_IN;
			if (inside === 'cave' || inside === 'building') {
				inner = 1;
				inside = null;
			}
		} else if (envOf(after) === 'swim' && envOf(before) !== 'swim') {
			label = 'Swim across';
		} else {
			if (envOf(after) === 'in' || envOf(before) === 'in') r = R_IN;
			const climbing = hasClass(cls, i, next, CLS.CLIMB) && P[next].z - P[i].z >= CLIMB_RISE;
			if (climbing) {
				if (inside !== 'climb') label = 'Follow the path up';
				if (!inside) inside = 'climb';
			} else if (inside === 'climb') {
				inside = null; // the top: this point is the climb's last
			} else if (envOf(after) === 'out' && bridgeBetween(nav, P, cls, i, next)) label = 'Cross the bridge';
		}
		out.push({ ...P[i], idx: i, r, label, inner });
	}
	return out;
}

// The point on a map: the goal's frame when it holds the point, else the smallest zone/city map.
function placeOn(geo, to, p) {
	const m = geo.toMap(to.map, p.c, p.wx, p.wy, to.f);
	if (m && m.x >= 0 && m.x <= 100 && m.y >= 0 && m.y <= 100) return { map: to.map, x: m.x, y: m.y };
	const z = geo.containing(p.c, p.wx, p.wy, to.f)[0];
	return z || null;
}

// One leg's via points from its route -> { via, over, unplaced }.
function viaOfRoute({ nav, geo, to, a, b, route }) {
	const c = a.c;
	const P = pointsOf(route, c);
	if (P.length < 2) return { via: [], over: false, unplaced: 0 };
	const start = P[0];
	const end = P[P.length - 1];
	const straight = d2(a, b);
	if (route.yards <= DETOUR * Math.max(straight, d2(start, end)) && nav.los(start, end)) return { via: [], over: false, unplaced: 0 };
	const kept = labelled(nav, P, route.cls, pull(nav, P, route.cls)).filter((p) => d2(p, a) >= END_DROP && d2(p, b) >= END_DROP && d2(p, start) >= END_DROP && d2(p, end) >= END_DROP);
	// A point within the previous one's radius goes when the previous one sees
	// the point after it: reaching that one reaches this one.
	const pts = [];
	kept.forEach((p, k) => {
		const prev = pts[pts.length - 1];
		const next = kept[k + 1] || end;
		if (prev && !p.label && !isHop(route.cls[p.idx]) && d2(p, prev) < prev.r && nav.los(prev, next)) return;
		pts.push(p);
	});
	const over = pts.length > MAX_POINTS;
	const via = [];
	let unplaced = 0;
	for (const p of pts.slice(0, MAX_POINTS)) {
		const m = placeOn(geo, to, p);
		if (!m) {
			unplaced++;
			continue;
		}
		via.push([m.map, r2(m.x), r2(m.y), to.f === 'e' ? 'e' : 'l', p.r, p.label, p.inner]);
	}
	return { via, over, unplaced };
}

// --- legs ----------------------------------------------------------------------------

// items: [{ guide, leg }] -> per item { entry | null, skip, handMade, over, route, a, b }.
async function runLegs(items, { nav, pool = null, geo, sets, log = () => {} }) {
	const router = new Router({ nav, pool });
	const work = [];
	for (const it of items) {
		const hm = handMadeOf(it.leg, { geo, sets });
		if (hm) {
			work.push({ ...it, handMade: hm });
			continue;
		}
		const a = worldOf(geo, it.leg.from);
		const b = worldOf(geo, it.leg.to);
		work.push({ ...it, a, b });
	}
	const pairs = work.filter((w) => w.a && w.b).map((w) => [w.a, w.b]);
	if (pool) log(`routing ${pairs.length} legs`);
	await router.prefetch(pairs);
	let done = 0;
	for (const w of work) {
		if (w.handMade) {
			w.skip = 'hand-made';
			w.entry = w.handMade.kind === 'goto' ? null : { via: [], hand: true };
			continue;
		}
		if (!w.a || !w.b) {
			w.skip = 'unroutable: no map frame';
			continue;
		}
		const route = w.route = router.get(w.a, w.b);
		if (!route.ok) {
			w.skip = `unroutable: ${route.reason}`;
			continue;
		}
		const hm = handMadeOf(w.leg, { geo, sets, pts: route.pts });
		if (hm) {
			w.handMade = hm;
			w.skip = 'hand-made';
			w.entry = { via: [], hand: true };
			continue;
		}
		const v = viaOfRoute({ nav, geo, to: w.leg.to, a: w.a, b: w.b, route });
		w.entry = { via: v.via };
		w.over = v.over;
		w.unplaced = v.unplaced;
		if (++done % 500 === 0) log(`${done} legs pulled`);
	}
	return work;
}

async function generateLegs({ guide, keys = null, nav, pool = null, geo, frames, sets = [], log = () => {} }) {
	const want = keys && new Set(keys);
	const legs = guideLegs(guide, { frames }).filter((l) => !want || want.has(l.key));
	const work = await runLegs(legs.map((leg) => ({ guide, leg })), { nav, pool, geo, sets, log });
	const out = { entries: {}, skipped: {}, handMade: {}, over: [] };
	for (const w of work) {
		if (w.entry) out.entries[w.leg.key] = w.entry;
		if (w.skip) out.skipped[w.leg.key] = w.skip;
		if (w.handMade) out.handMade[w.leg.key] = w.handMade;
		if (w.over) out.over.push(w.leg.key);
	}
	return out;
}

// --- the file -----------------------------------------------------------------------

function entryText(e) {
	const o = { via: e.via };
	if (e.manual) o.manual = true;
	if (e.hand) o.hand = true;
	return JSON.stringify(o);
}

function formatVia(doc) {
	const lines = ['{', `\t"schema": ${JSON.stringify(doc.schema)},`, `\t"source": ${JSON.stringify(doc.source === undefined ? null : doc.source)},`];
	lines.push(`\t"grid": ${JSON.stringify(doc.grid === undefined ? null : doc.grid)},`);
	const ids = Object.keys(doc.guides || {}).sort();
	if (!ids.length) lines.push('\t"guides": {}');
	else {
		lines.push('\t"guides": {');
		ids.forEach((id, gi) => {
			const entries = doc.guides[id];
			const keys = Object.keys(entries).sort();
			lines.push(`\t\t${JSON.stringify(id)}: {`);
			keys.forEach((k, ki) => lines.push(`\t\t\t${JSON.stringify(k)}: ${entryText(entries[k])}${ki < keys.length - 1 ? ',' : ''}`));
			lines.push(`\t\t}${gi < ids.length - 1 ? ',' : ''}`);
		});
		lines.push('\t}');
	}
	lines.push('}');
	return `${lines.join('\n')}\n`;
}

function tally() {
	return { legs: 0, checked: 0, withPoints: 0, unroutable: 0, over: 0, handMade: 0, manual: 0 };
}

// packDir's guides -> { doc, text, stats }. guides: compiled (compileProject), else compiled here.
async function generate({
	packDir, guides = null, nav, workers = 0, force = false, onlyGuide = null, dataDir = DATA,
	crossingsFile = path.join(dataDir, '..', 'local', 'crossings.json'), contextDir = null, pool = null, log = () => {},
}) {
	if (!nav || !nav.available) throw new Error('no navigation grid (node tools/polestar.js nav build)');
	const t0 = Date.now();
	const { Geo } = require('../planner/geo');
	const { Frames } = require('../travel/geo');
	const mapFrames = JSON.parse(fs.readFileSync(path.join(dataDir, 'map-frames.json'), 'utf8'));
	const zones = JSON.parse(fs.readFileSync(path.join(dataDir, 'zones.json'), 'utf8'));
	const geo = new Geo(mapFrames, zones);
	const frames = new Frames(mapFrames.era, zones);
	if (!guides) {
		const { compileProject } = require('../dsl/project');
		guides = compileProject({ packDir, dataDir, contextDir }).guides;
	}
	guides = [...guides].sort((x, y) => (x.id < y.id ? -1 : x.id > y.id ? 1 : 0));
	if (onlyGuide && !guides.some((g) => g.id === onlyGuide)) throw new Error(`no guide "${onlyGuide}" in ${packDir}`);
	const existing = readViaFile(packDir);
	if (existing && existing.error) throw new Error(`${existing.file} ${existing.error}`);
	const old = (existing && existing.doc.guides) || {};
	const sets = loadHandMade({ dataDir, crossingsFile, frames });
	const doc = { schema: VIA_SCHEMA, source: `nav via: navigation grid of the Forever client ${nav.index.build}, built ${String(nav.index.builtAt).replace(/\.\d+Z$/, 'Z')}`, grid: { client: nav.index.build, build: null }, guides: {} };
	const stats = { guides: {}, total: tally(), unroutable: [], over: [], handMade: [], unplaced: 0, seconds: 0, legs: [] };
	const items = [];
	const legsOf = new Map();
	for (const g of guides) {
		const legs = guideLegs(g, { frames: mapFrames });
		legsOf.set(g.id, legs);
		const prev = old[g.id] || {};
		const out = {};
		for (const leg of legs) {
			const e = prev[leg.key];
			if (onlyGuide && g.id !== onlyGuide) {
				if (e) out[leg.key] = e; // other guides: their entries kept (dead keys dropped)
				continue;
			}
			if (e && e.manual && !force) {
				out[leg.key] = e;
				continue;
			}
			items.push({ guide: g, leg });
		}
		doc.guides[g.id] = out;
	}
	let ownPool = null;
	if (!pool && workers > 0) {
		const { NavRoutes } = require('../../planner/navpool');
		pool = ownPool = new NavRoutes({ dir: nav.dir, workers, log });
	}
	try {
		if (pool) doc.grid.build = pool.info().build;
		else doc.grid.build = require('../../planner/navpool').navBuild(nav.dir);
		const work = await runLegs(items, { nav, pool, geo, sets, log });
		for (const w of work) {
			const id = w.guide.id;
			if (w.entry) doc.guides[id][w.leg.key] = w.entry;
			const where = { guide: id, key: w.leg.key };
			if (w.handMade) stats.handMade.push({ ...where, ...w.handMade });
			else if (!w.entry) stats.unroutable.push({ ...where, reason: w.skip });
			if (w.over) stats.over.push(where);
			stats.unplaced += w.unplaced || 0;
			stats.legs.push(w);
		}
	} finally {
		if (ownPool) ownPool.close();
	}
	// Counts per guide over the guide's current legs.
	for (const g of guides) {
		const t = (stats.guides[g.id] = tally());
		const entries = doc.guides[g.id];
		for (const leg of legsOf.get(g.id)) {
			t.legs++;
			const e = entries[leg.key];
			if (e) t.checked++;
			if (e && e.via.length) t.withPoints++;
			if (e && e.manual) t.manual++;
		}
		for (const k of ['unroutable', 'over', 'handMade']) t[k] = stats[k].filter((x) => x.guide === g.id).length;
		for (const k of Object.keys(t)) stats.total[k] += t[k];
		if (!Object.keys(entries).length) delete doc.guides[g.id];
	}
	stats.seconds = (Date.now() - t0) / 1000;
	return { doc, text: formatVia(doc), stats };
}

// --- measurement --------------------------------------------------------------------

// The arrow on every leg, without and with via: the walk legs of the addon's
// planner (Nav/Travel.lua PlanRoute, tools/lib/nav/arrow.js) when it follows
// target.via, else the via polyline itself. items: generate's stats.legs.
// -> { legs, planner, before, after } with per side { walkYards, blockedYards,
//    blockedLegs, routeYards } (blocked: a walk whose straight line nav.los rejects).
function measureArrow({ items, nav, geo, log = () => {}, planner = null }) {
	const { planRoutes, walkLegs } = require('./arrow');
	const { FACTIONS } = require('../travel/route');
	if (planner === null) {
		const travelLua = fs.readFileSync(path.join(__dirname, '..', '..', '..', 'addon', 'Polestar', 'Nav', 'Travel.lua'), 'utf8');
		planner = /target\.viaFrom/.test(travelLua) && /target\.via\b/.test(travelLua);
	}
	const legs = items.filter((w) => w.a && w.b && w.route && w.route.ok);
	const losCache = new Map();
	const los = (a, b, key) => {
		if (!losCache.has(key)) losCache.set(key, nav.los(a, b));
		return losCache.get(key);
	};
	const side = () => ({ walkYards: 0, blockedYards: 0, blockedLegs: 0, routeYards: 0, planned: 0 });
	const before = side();
	const after = side();
	const viaWorld = (w) => ((w.entry && w.entry.via) || []).map(([map, x, y, f, r, label, inner]) => {
		const p = geo.toWorld(map, x, y, f);
		return { c: p.c, wx: p.wx, wy: p.wy, r, label, inner: inner === 1, map, x, y, f };
	});
	const job = (w, via) => {
		const t = w.leg.to;
		const target = { c: w.b.c, wx: w.b.wx, wy: w.b.wy, label: 'target', map: t.map, x: t.x, y: t.y, f: t.f };
		if (via && via.length) {
			target.via = via;
			target.viaFrom = { c: w.a.c, wx: w.a.wx, wy: w.a.wy };
		}
		return { c: w.a.c, wx: w.a.wx, wy: w.a.wy, map: w.leg.from.map, target, faction: FACTIONS[w.guide.faction === 'Horde' ? 'horde' : 'alliance'], known: {} };
	};
	const add = (s, w, walks) => {
		s.planned++;
		s.routeYards += w.route.yards;
		let blocked = false;
		for (const l of walks) {
			s.walkYards += l.yards;
			if (!l.ok) {
				s.blockedYards += l.yards;
				blocked = true;
			}
		}
		if (blocked) s.blockedLegs++;
	};
	const polyline = (w, via) => {
		const pts = [w.a, ...via, w.b];
		const out = [];
		for (let i = 1; i < pts.length; i++) {
			const a = pts[i - 1];
			const b = pts[i];
			const key = `${a.c}:${Math.round(a.wx)}:${Math.round(a.wy)}:${Math.round(b.wx)}:${Math.round(b.wy)}`;
			out.push({ yards: d2(a, b), ok: los(a, b, key) });
		}
		return out;
	};
	log(`measuring ${legs.length} legs (${planner ? 'the addon planner' : 'via polylines'})`);
	const plansBefore = planRoutes(legs.map((w) => job(w, null)), { log });
	const vias = legs.map(viaWorld);
	const changed = legs.map((w, i) => vias[i].length > 0);
	const plansAfter = planner ? planRoutes(legs.flatMap((w, i) => (changed[i] ? [job(w, vias[i])] : [])), { log }) : null;
	let k = 0;
	legs.forEach((w, i) => {
		const pb = walkLegs(plansBefore[i], los);
		add(before, w, pb);
		if (!changed[i]) add(after, w, pb);
		else if (planner) add(after, w, walkLegs(plansAfter[k++], los));
		else add(after, w, polyline(w, vias[i]));
	});
	return { legs: legs.length, withVia: changed.filter(Boolean).length, planner, before, after };
}

const pct = (n, d) => (d ? Math.round((1000 * n) / d) / 10 : 0);

function renderReport({ stats, measure, build, packDir }) {
	const L = [];
	const t = stats.total;
	L.push('# Arrow waypoints (`nav via`)', '');
	L.push(`Grid: ${build}. Pack: ${packDir}. ${stats.seconds.toFixed(0)} s wall time.`, '');
	L.push(`${t.legs} legs: ${t.checked} checked (${t.withPoints} with points, ${t.checked - t.withPoints} none needed or hand-made), ${t.handMade} hand-made (no generated points), ${t.unroutable} unroutable, ${t.over} needed more than ${MAX_POINTS} points, ${t.manual} manual kept.`, '');
	if (measure) {
		const row = (name, s) => `| ${name} | ${s.planned} | ${Math.round(s.blockedYards)} | ${pct(s.blockedYards, s.walkYards)}% | ${s.blockedLegs} | ${Math.round(s.walkYards)} | ${Math.round(s.routeYards)} | ${(s.walkYards / (s.routeYards || 1)).toFixed(3)} |`;
		L.push('## The arrow, without and with via', '');
		L.push(`Every routable leg (${measure.legs}, ${measure.withVia} with points) walked as the arrow leads: ${measure.planner ? 'the addon planner (Nav/Travel.lua PlanRoute) with and without target.via' : 'the straight line without via, the via polyline with it'}. Blocked: walk stretches whose straight line the grid rejects (nav.los). Ratio: the arrow's walked yards over the grid route's.`, '');
		L.push('| | legs | blocked yd | blocked share | legs with blocked yd | arrow yd | grid route yd | ratio |', '|---|---|---|---|---|---|---|---|');
		L.push(row('without via', measure.before), row('with via', measure.after), '');
	}
	L.push('## Per guide', '', '| guide | legs | checked | with points | hand-made | unroutable | over 12 | manual |', '|---|---|---|---|---|---|---|---|');
	for (const [id, g] of Object.entries(stats.guides)) L.push(`| ${id} | ${g.legs} | ${g.checked} | ${g.withPoints} | ${g.handMade} | ${g.unroutable} | ${g.over} | ${g.manual} |`);
	L.push('');
	const list = (title, rows) => {
		if (!rows.length) return;
		L.push(`## ${title}`, '');
		for (const r of rows) L.push(`- ${r}`);
		L.push('');
	};
	const byKind = {};
	for (const h of stats.handMade) byKind[h.kind] = (byKind[h.kind] || 0) + 1;
	list('Hand-made legs by kind', Object.entries(byKind).sort().map(([k, n]) => `${k}: ${n}`));
	list('Hand-made chains and crossings on legs', [...new Set(stats.handMade.filter((h) => h.kind !== 'goto').map((h) => `${h.kind} ${h.id}`))].sort());
	list(`Legs needing more than ${MAX_POINTS} points`, stats.over.map((o) => `${o.guide} ${o.key}`));
	list('Unroutable legs', stats.unroutable.map((u) => `${u.guide} ${u.key}: ${u.reason}`));
	return `${L.join('\n')}\n`;
}

module.exports = {
	generate, generateLegs, handMadeOf, loadHandMade, formatVia, measureArrow, renderReport, viaOfRoute, pull,
	MAX_POINTS, END_DROP, DETOUR, R_OUT, R_IN, R_LIFT,
};
