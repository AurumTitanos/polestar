'use strict';
// The planner's workspace: the guide packs it edits, their .guide sources,
// compiled guides, timelines, edits with undo/redo, the full lint and the
// file watch (docs/ARCHITECTURE.md, "Route planner").
// The .guide files stay the only source of truth: every edit is written at
// once, and an external change (an editor, git) is read back and pushed.
// Each pack's via.json (the arrow waypoints, docs/PACK_FORMAT.md) is kept
// the same way: attached to the compiled guides, edited (via_set) and
// regenerated (via_generate) through the same undo history, watched.
//
// Events: 'changed' { files, guides, external, timeline, routed (the routing
// id of a timeline whose walks are all routed now) }, 'diagnostics' { pack },
// 'routing' { id, pending, done } (walks being routed, each second), 'via'
// { job, id, ok, error, written, kept, skipped } (a via_generate job is
// done), 'focus', 'seek', 'play' (the page's view_* commands).

const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { EventEmitter } = require('node:events');
const { Worker } = require('node:worker_threads');
const { Diagnostics } = require('../lib/dsl/diag');
const { parseGuide } = require('../lib/dsl/parse');
const { resolveGuide } = require('../lib/dsl/resolve');
const { loadData } = require('../lib/dsl/data');
const { findGuideFiles, writePackDir, OFFICIAL_DIR } = require('../lib/dsl/project');
const { VIA_FILE, viaDocError, attachVia } = require('../lib/dsl/via');
const { guideLegs } = require('../lib/dsl/legs');
const { readManifest } = require('../lib/pack/manifest');
const { buildPack, folderIn } = require('../lib/pack/build');
const { Geo } = require('../lib/planner/geo');
const { ROOT, DATA, SOURCES } = require('../lib/paths');

const sha1 = (text) => crypto.createHash('sha1').update(text).digest('hex');
const toPosix = (p) => p.split(path.sep).join('/');

// A file as the planner names it: relative to the repository when inside it, else absolute.
function shownFile(abs) {
	const rel = path.relative(ROOT, abs);
	return rel.startsWith('..') || path.isAbsolute(rel) ? toPosix(abs) : toPosix(rel);
}

function samePath(a, b) {
	const real = (p) => {
		try {
			return fs.realpathSync(p);
		} catch {
			return path.resolve(p);
		}
	};
	return real(a) === real(b);
}

// An error a command reports as { ok: false, error, code }.
class PlannerError extends Error {
	constructor(message, code = 'error') {
		super(message);
		this.code = code;
	}
}

// Lines added and removed from a to b (an LCS over the lines between the
// common head and tail; a count difference when that would be too large).
function lineDiff(a, b) {
	const x = a.split('\n');
	const y = b.split('\n');
	let s = 0;
	while (s < x.length && s < y.length && x[s] === y[s]) s++;
	let ex = x.length;
	let ey = y.length;
	while (ex > s && ey > s && x[ex - 1] === y[ey - 1]) {
		ex--;
		ey--;
	}
	const n = ex - s;
	const m = ey - s;
	if (!n || !m) return { added: m, removed: n };
	if (n * m > 4e7) {
		const count = new Map();
		for (let i = s; i < ex; i++) count.set(x[i], (count.get(x[i]) || 0) + 1);
		let common = 0;
		for (let j = s; j < ey; j++) {
			const c = count.get(y[j]) || 0;
			if (c) {
				common++;
				count.set(y[j], c - 1);
			}
		}
		return { added: m - common, removed: n - common };
	}
	let prev = new Uint32Array(m + 1);
	let cur = new Uint32Array(m + 1);
	for (let i = 1; i <= n; i++) {
		const xi = x[s + i - 1];
		for (let j = 1; j <= m; j++) cur[j] = xi === y[s + j - 1] ? prev[j - 1] + 1 : Math.max(prev[j], cur[j - 1]);
		[prev, cur] = [cur, prev];
	}
	return { added: m - prev[m], removed: n - prev[m] };
}

// Guides by id for routeOf/buildTimeline, compiled when first asked for.
class LazyGuides extends Map {
	constructor(ws) {
		super();
		this.ws = ws;
	}

	get(id) {
		const src = this.ws.byId.get(id);
		return src ? this.ws.compiled(src).guide || undefined : undefined;
	}

	has(id) {
		return this.ws.byId.has(id);
	}
}

const COMPILED_KEYS = ['map', 'x', 'y', 'f', 'r', 'spots', 'spread', 'candidates'];
const TIMELINE_CACHE = 16;

// The lint worker: loads the reference data once, then lints a pack per message.
const LINT_WORKER = `
const { parentPort, workerData } = require('node:worker_threads');
const { buildPack } = require(workerData.build);
const { loadData } = require(workerData.data);
const data = loadData(workerData.dataDir);
parentPort.on('message', ({ seq, target }) => {
	try {
		const built = buildPack(target, { dataDir: workerData.dataDir, cache: { data, contextData: data, diags: [] }, files: false });
		parentPort.postMessage({ seq, diagnostics: built.diag.sorted() });
	} catch (err) {
		parentPort.postMessage({ seq, error: String((err && err.stack) || err) });
	}
});
`;

// The waypoint generator's worker (via_generate): one Nav, routes in-process.
const VIA_WORKER = `
const { parentPort, workerData } = require('node:worker_threads');
const via = require(workerData.via);
const { openNav } = require(workerData.nav);
const { Geo } = require(workerData.geo);
const nav = openNav({ dir: workerData.dir });
const geo = new Geo(workerData.frames, workerData.zones);
const sets = via.loadHandMade({ dataDir: workerData.dataDir, ...(workerData.crossingsFile ? { crossingsFile: workerData.crossingsFile } : {}), frames: geo.era });
parentPort.on('message', async ({ job, guide, keys }) => {
	try {
		const result = await via.generateLegs({ guide, keys, nav, pool: null, geo, frames: workerData.frames, sets, log: () => {} });
		parentPort.postMessage({ job, result });
	} catch (err) {
		parentPort.postMessage({ job, error: String((err && err.stack) || err) });
	}
});
`;

function shapeDiag(d) {
	const o = { file: d.file ? shownFile(path.resolve(d.file)) : null, line: d.line || 0, severity: d.severity, message: d.message };
	if (d.hint) o.hint = d.hint;
	return o;
}

class Workspace extends EventEmitter {
	// opts: { dataDir, packs: [dir] (other packs, after ours), official (ours,
	// guides/, first; default true), officialDir, simDir, artDir, navDir (the
	// navigation grid, data/local/nav: walks are routed on it; default none),
	// navWorkers (route workers, navpool.js; default its own),
	// crossingsFile (the hand-made paths; default data/local/crossings.json
	// beside dataDir), viaGenerator (async ({ guide, keys }) -> generateLegs' result, used
	// instead of the grid worker: tests), watch, lintDelay, log }
	constructor(opts = {}) {
		super();
		const { dataDir = DATA, packs = [], official = true, officialDir = OFFICIAL_DIR, simDir = path.join(ROOT, 'data', 'sim'), artDir = null, navDir = null, watch = true, lintDelay = 600, log = () => {} } = opts;
		this.viaGenerator = opts.viaGenerator || null;
		this.dataDir = dataDir;
		this.simDir = simDir;
		this.artDir = artDir;
		this.navDir = navDir ? path.resolve(navDir) : null;
		this.navWorkers = opts.navWorkers || null;
		this.nav = null;
		this.aidsCache = null;
		this.log = log;
		this.lintDelay = lintDelay;
		this.data = loadData(dataDir);
		this.travel = this.data.travel;
		this.sourcesDir = opts.sourcesDir || SOURCES;
		this.flights = undefined; // Map path id -> [[wx, wy], ...] (flightPaths), null when unavailable
		this.geo = new Geo(this.data.mapFrames, this.data.zones);
		this.packs = [];
		const dirs = [...(official ? [officialDir] : []), ...packs];
		for (const dir of dirs) this.addPack(path.resolve(dir));
		if (!this.packs.length) throw new Error('no guide pack to plan');
		this.sources = new Map(); // abs -> { abs, file, pack, text, hash, id, header }
		this.byId = new Map();
		this.initial = new Map(); // abs -> the text when the planner started (null: no file then)
		for (const p of this.packs) for (const rel of findGuideFiles(p.dir)) this.load(p, path.join(p.dir, rel), true);
		this.reindex();
		this.vias = new Map(); // abs -> { abs, file, pack, text, hash, doc, error }: each pack's via.json (text null: none)
		for (const p of this.packs) this.loadVia(p, true);
		this.handMadeSets = null;
		this.crossingsFile = opts.crossingsFile || null;
		this.viaWorker = null;
		this.viaJobs = new Map(); // job id -> { resolve, reject }
		this.viaSeq = 0;
		this.compileCache = new Map(); // abs -> { hash, guide, diag, ast }
		this.viewCache = new Map(); // abs -> { key, view }
		this.timelines = new Map(); // key -> timeline (insertion order = age)
		this.paramsCache = new Map();
		this.undoStack = [];
		this.redoStack = [];
		this.lintResults = new Map(); // pack id -> { diagnostics, at }
		this.lintVersion = 0;
		this.lintSeq = 0;
		this.lintPending = new Map();
		this.worker = null;
		this.closed = false;
		this.dirtyPacks = new Set();
		this.lintTimer = null;
		this.viewState = null;
		this.watchers = [];
		this.watchTimer = null;
		this.watchPending = new Set();
		if (watch) this.startWatch();
	}

	addPack(dir) {
		if (this.packs.some((p) => samePath(p.dir, dir))) return;
		const official = samePath(dir, OFFICIAL_DIR);
		const { manifest, diags } = readManifest(dir, { official });
		if (!manifest) throw new Error(`${shownFile(dir)}: ${diags.filter((d) => d.severity === 'error').map((d) => d.message).join('; ')}`);
		if (this.packs.some((p) => p.id === manifest.id)) throw new Error(`two packs with the id "${manifest.id}"`);
		this.packs.push({ id: manifest.id, title: manifest.title, dir, official, manifest, diags });
	}

	pack(id) {
		const p = id === undefined || id === null ? this.packs[0] : this.packs.find((x) => x.id === id);
		if (!p) throw new PlannerError(`no pack "${id}" (packs: ${this.packs.map((x) => x.id).join(', ')})`, 'not_found');
		return p;
	}

	// Read one source (its text and header); `start` records it as the starting text.
	load(pack, abs, start = false) {
		const text = fs.readFileSync(abs, 'utf8');
		const src = { abs, file: shownFile(abs), pack, text, hash: sha1(text), id: null, header: {} };
		this.readHeader(src);
		this.sources.set(abs, src);
		if (start) this.initial.set(abs, text);
		else if (!this.initial.has(abs)) this.initial.set(abs, null);
		return src;
	}

	readHeader(src) {
		const ast = parseGuide(src.text, src.file, new Diagnostics());
		src.id = ast && ast.id ? ast.id : null;
		src.header = (ast && ast.header) || {};
	}

	reindex() {
		this.byId = new Map();
		for (const src of this.sources.values()) if (src.id && !this.byId.has(src.id)) this.byId.set(src.id, src);
	}

	source(id) {
		const src = this.byId.get(id);
		if (!src) throw new PlannerError(`no guide "${id}"`, 'not_found');
		return src;
	}

	sourceByFile(file) {
		const abs = path.resolve(ROOT, file);
		const src = this.sources.get(abs) || [...this.sources.values()].find((s) => s.file === file);
		if (src) return src;
		if (this.initial.has(abs)) return { abs, file: shownFile(abs), pack: this.packOf(abs), text: null, hash: null, id: null };
		throw new PlannerError(`no guide file "${file}"`, 'not_found');
	}

	packOf(abs) {
		return this.packs.find((p) => abs.startsWith(p.dir + path.sep)) || null;
	}

	// -> { hash, guide (null when the source has no guide id), diag, ast, via
	// (the via.json hash its goals' via/viaFrom are from) }, cached by text;
	// the pack's arrow waypoints are attached again when via.json changed.
	compiled(src) {
		const hit = this.compileCache.get(src.abs);
		const via = this.viaOf(src.pack);
		if (hit && hit.hash === src.hash) {
			if (hit.via !== via.hash) this.attach(hit, via);
			return hit;
		}
		const diag = new Diagnostics();
		const ast = parseGuide(src.text, src.file, diag);
		let guide = null;
		if (ast && ast.id) {
			ast.source = path.relative(src.pack.dir, src.abs);
			guide = resolveGuide(ast, this.data, diag, { pack: src.pack.id, author: src.pack.manifest.author });
		}
		const out = { hash: src.hash, guide, diag, ast, via: undefined };
		this.attach(out, via);
		this.compileCache.set(src.abs, out);
		return out;
	}

	attach(compiled, via) {
		if (compiled.guide) attachVia([compiled.guide], via.doc, this.data.mapFrames);
		compiled.via = via.hash;
	}

	// --- arrow waypoints (via.json) ---

	// Read a pack's via.json; `start` records it as the starting text.
	loadVia(pack, start = false) {
		const abs = path.join(pack.dir, VIA_FILE);
		const rec = this.vias.get(abs) || { abs, file: shownFile(abs), pack, text: null, hash: null, doc: null, error: null };
		let text = null;
		try {
			text = fs.readFileSync(abs, 'utf8');
		} catch {
			text = null;
		}
		this.setViaText(rec, text);
		this.vias.set(abs, rec);
		if (start) this.initial.set(abs, text);
		return rec;
	}

	setViaText(rec, text) {
		rec.text = text;
		rec.hash = text === null ? null : sha1(text);
		rec.doc = null;
		rec.error = null;
		if (text === null) return;
		try {
			const doc = JSON.parse(text);
			rec.error = viaDocError(doc);
			if (!rec.error) rec.doc = doc;
		} catch (e) {
			rec.error = `is not valid JSON (${e.message})`;
		}
	}

	viaOf(pack) {
		return this.vias.get(path.join(pack.dir, VIA_FILE)) || this.loadVia(pack);
	}

	// Write (text null: delete) a via.json; ours, so the watcher ignores it by hash.
	writeVia(rec, text) {
		if (text === null) fs.rmSync(rec.abs, { force: true });
		else fs.writeFileSync(rec.abs, text);
		this.setViaText(rec, text);
	}

	// The disk text wins over the cached one (an external change not yet seen).
	syncVia(rec) {
		let text = null;
		try {
			text = fs.readFileSync(rec.abs, 'utf8');
		} catch {
			text = null;
		}
		if (text === rec.text) return false;
		const before = rec.doc;
		this.setViaText(rec, text);
		this.viaChanged(rec, before, true);
		return true;
	}

	// 'changed' for a via.json: the guides whose entries differ.
	viaChanged(rec, beforeDoc, external = false) {
		const a = (beforeDoc && beforeDoc.guides) || {};
		const b = (rec.doc && rec.doc.guides) || {};
		const guides = [...new Set([...Object.keys(a), ...Object.keys(b)])].filter((id) => JSON.stringify(a[id] || null) !== JSON.stringify(b[id] || null) && this.byId.has(id));
		this.markDirty(rec.pack);
		this.emit('changed', { files: [rec.file], guides, external });
		return guides;
	}

	// Why a leg is hand-made (spec "a hand-made path always wins"): a guide
	// goto at either end or a crossing/chain of the hand-made paths
	// (tools/lib/nav/via.js handMadeOf over loadHandMade: travel.json's
	// recorded crossings and data/local/crossings.json, read once), or its
	// via.json entry says `hand` -> { kind, id, name } | null.
	handMade(leg, entry = null) {
		const { loadHandMade, handMadeOf } = require('../lib/nav/via');
		if (!this.handMadeSets) this.handMadeSets = loadHandMade({ dataDir: this.dataDir, ...(this.crossingsFile ? { crossingsFile: this.crossingsFile } : {}), frames: this.geo.era });
		const hm = handMadeOf(leg, { geo: this.geo, sets: this.handMadeSets });
		if (hm) return hm;
		return entry && entry.hand ? { kind: 'crossings', id: null, name: null } : null;
	}

	// A map point as a GuideView shows it, with its world point.
	pointView(map, x, y, f) {
		const w = this.geo.toWorld(map, x, y, f === 'e' ? 'e' : 'l');
		return { map, x, y, f: f === 'e' ? 'e' : 'l', c: w ? w.c : null, wx: w ? Math.round(w.wx * 10) / 10 : null, wy: w ? Math.round(w.wy * 10) / 10 : null };
	}

	// The legs of a compiled guide (legs.js) as GuideView goals carry them,
	// by goal: { key, yards, from, via (null: no entry; [] checked, none
	// needed; else points { map, x, y, f, r, label, inner, c, wx, wy }),
	// manual, handMade (null | { kind: 'goto'|'chain'|'crossing', id, name }) }.
	legViews(src, c) {
		const out = new Map();
		if (!c.guide) return out;
		const via = this.viaOf(src.pack);
		const entries = (via.doc && Object.hasOwn(via.doc.guides, src.id) && via.doc.guides[src.id]) || {};
		for (const leg of guideLegs(c.guide, { frames: this.data.mapFrames })) {
			const e = Object.hasOwn(entries, leg.key) ? entries[leg.key] : null;
			out.set(c.guide.steps[leg.si].goals[leg.gi], {
				key: leg.key,
				yards: Math.round(leg.yards),
				from: this.pointView(leg.from.map, leg.from.x, leg.from.y, leg.from.f),
				via: e ? e.via.map(([map, x, y, f, r, label, inner]) => ({ ...this.pointView(map, x, y, f), r, label, inner: inner === 1 })) : null,
				manual: !!(e && e.manual),
				handMade: this.handMade(leg, e),
			});
		}
		return out;
	}

	// The leg `key` of a guide, refused when the guide changed since `hash`.
	legOf(id, hash, key) {
		const src = this.source(id);
		this.syncFromDisk(src);
		if (hash !== src.hash) throw new PlannerError(`${src.file} changed since hash ${hash} (now ${src.hash}): reload the guide and edit again`, 'stale');
		const c = this.compiled(src);
		const leg = c.guide ? guideLegs(c.guide, { frames: this.data.mapFrames }).find((l) => l.key === key) : null;
		if (!leg) throw new PlannerError(`${src.file} has no leg "${key}" (via_get lists its legs)`, 'bad_args');
		return { src, c, leg };
	}

	// A via point given as { c, wx, wy } or { map, x, y } (the leg's frame), with
	// r (yd, default 12), label, inner, as a via.json point: on the goal's map
	// when it lies inside it, else on the smallest zone/city map holding it.
	viaPoint(leg, p, i) {
		const f = leg.to.f === 'e' ? 'e' : 'l';
		let w;
		if (p.c !== undefined && p.wx !== undefined && p.wy !== undefined) w = { c: p.c, wx: p.wx, wy: p.wy };
		else if (p.map !== undefined && p.x !== undefined && p.y !== undefined) w = this.geo.toWorld(p.map, p.x, p.y, f);
		if (!w) throw new PlannerError(`via[${i}]: give { c, wx, wy } or { map, x, y } on a map with a frame`, 'bad_args');
		const goalFrame = this.geo.frame(leg.to.map, f);
		if (!goalFrame || goalFrame.c !== w.c) throw new PlannerError(`via[${i}] is not on the leg's continent`, 'bad_args');
		let map = leg.to.map;
		let q = this.geo.toMap(map, w.c, w.wx, w.wy, f);
		if (!(q && q.x >= 0 && q.x <= 100 && q.y >= 0 && q.y <= 100)) {
			const z = this.geo.containing(w.c, w.wx, w.wy, f)[0];
			if (!z) throw new PlannerError(`via[${i}]: no zone map holds ${w.c}:${Math.round(w.wx)},${Math.round(w.wy)}`, 'bad_args');
			map = z.map;
			q = z;
		}
		const r2 = (v) => Math.round(v * 100) / 100;
		const r = p.r !== undefined ? p.r : 12;
		if (!(r > 0)) throw new PlannerError(`via[${i}].r must be above 0`, 'bad_args');
		const label = typeof p.label === 'string' && p.label.trim() ? p.label.trim() : null;
		return [map, r2(q.x), r2(q.y), f, r2(r), label, p.inner ? 1 : 0];
	}

	// Write entries into a pack's via.json as one undoable edit: changes
	// { [guide id]: { [leg key]: entry | null (dropped) } }. -> true when it changed.
	writeViaEntries(pack, changes, label) {
		const { formatVia } = require('../lib/nav/via');
		const rec = this.viaOf(pack);
		this.syncVia(rec);
		if (rec.error) throw new PlannerError(`${rec.file} ${rec.error}: fix or remove it first`, 'conflict');
		const doc = rec.doc ? JSON.parse(JSON.stringify(rec.doc)) : { schema: 1, source: 'planner', grid: null, guides: {} };
		for (const [id, entries] of Object.entries(changes)) {
			const g = doc.guides[id] || (doc.guides[id] = {});
			for (const [key, entry] of Object.entries(entries)) {
				if (entry === null) delete g[key];
				else g[key] = entry;
			}
			if (!Object.keys(g).length) delete doc.guides[id];
		}
		const text = formatVia(doc);
		if (text === rec.text) return false;
		const before = rec.text;
		const beforeDoc = rec.doc;
		this.writeVia(rec, text);
		this.undoStack.push({ abs: rec.abs, file: rec.file, before, after: text, label });
		this.redoStack = [];
		this.viaChanged(rec, beforeDoc);
		return true;
	}

	// via_get: the guide's legs with their entries (GuideView goals[].leg, flat).
	viaGet(id) {
		const view = this.view(id);
		const rec = this.viaOf(this.source(id).pack);
		const legs = [];
		for (const st of view.steps) for (const g of st.goals) if (g.leg) legs.push({ step: st.index, line: g.line, label: g.label, to: g.compiled && { map: g.compiled.map, x: g.compiled.x, y: g.compiled.y, f: g.compiled.f === 'e' ? 'e' : 'l' }, ...g.leg });
		return { id, hash: view.hash, file: rec.file, exists: rec.text !== null, error: rec.error, legs };
	}

	// via_set: one leg's points, marked manual. Refused on a hand-made leg.
	setVia({ id, hash, key, via, label = null }) {
		const { src, leg } = this.legOf(id, hash, key);
		const doc = this.viaOf(src.pack).doc;
		const hm = this.handMade(leg, doc && doc.guides[id] && Object.hasOwn(doc.guides[id], key) ? doc.guides[id][key] : null);
		if (hm) throw new PlannerError(`leg ${key} follows a hand-made path (${hm.kind}${hm.name ? ` ${hm.name}` : ''}): the arrow takes it, no waypoints there`, 'hand_made');
		const pts = via.map((p, i) => this.viaPoint(leg, p, i));
		this.writeViaEntries(src.pack, { [id]: { [key]: { via: pts, manual: true } } }, label || 'Edit arrow waypoints');
		return { guide: this.view(id), select: null };
	}

	// via_generate: route the guide's legs (or `keys`) on the grid in a worker
	// (tools/lib/nav/via.js generateLegs) and write what it finds as one
	// undoable edit; manual entries are kept unless `force`, hand-made legs
	// get none. Answers at once { job, legs }; 'via' { job, id, ok, error,
	// written, kept, skipped } when done.
	viaGenerate({ id, keys = null, force = false }) {
		const src = this.source(id);
		if (!this.viaGenerator && !this.navInfo().available) throw new PlannerError('no navigation grid: run node tools/polestar.js nav build', 'not_found');
		const c = this.compiled(src);
		if (!c.guide) throw new PlannerError(`${src.file} does not compile to a guide`, 'bad_args');
		const all = guideLegs(c.guide, { frames: this.data.mapFrames });
		if (keys) for (const k of keys) if (!all.some((l) => l.key === k)) throw new PlannerError(`${src.file} has no leg "${k}" (via_get lists its legs)`, 'bad_args');
		const wanted = all.filter((l) => !keys || keys.includes(l.key));
		const job = ++this.viaSeq;
		const { _ast, ...slim } = c.guide;
		const guide = { ...slim, steps: c.guide.steps.map((s) => ({ ...s, goals: s.goals.map((g) => ({ ...g })) })) };
		const hash = src.hash;
		const run = this.viaGenerator
			? Promise.resolve().then(() => this.viaGenerator({ guide, keys: wanted.map((l) => l.key) }))
			: new Promise((resolve, reject) => {
				this.viaJobs.set(job, { resolve, reject });
				this.viaGenWorker().postMessage({ job, guide, keys: wanted.map((l) => l.key) });
			});
		run.then((r) => {
			if (this.closed) return;
			if (src.hash !== hash) throw new Error(`${src.file} changed while its waypoints were generated: regenerate`);
			const rec = this.viaOf(src.pack);
			this.syncVia(rec);
			const old = (rec.doc && rec.doc.guides[id]) || {};
			const entries = {};
			const kept = [];
			for (const leg of wanted) {
				if (old[leg.key] && old[leg.key].manual && !force) kept.push(leg.key);
				else if (r.entries[leg.key]) {
					const { manual, ...entry } = r.entries[leg.key];
					entries[leg.key] = entry;
				} else if (old[leg.key]) entries[leg.key] = null; // hand-made or unroutable now: no entry
			}
			const written = Object.keys(entries).filter((k) => JSON.stringify(old[k] || null) !== JSON.stringify(entries[k])).length;
			if (written) this.writeViaEntries(src.pack, { [id]: entries }, wanted.length === 1 ? 'Regenerate waypoints' : `Regenerate waypoints (${wanted.length} legs)`);
			this.emit('via', { job, id, ok: true, error: null, written, kept, skipped: r.skipped || {} });
		}).catch((err) => {
			if (!this.closed) this.emit('via', { job, id, ok: false, error: String((err && err.message) || err), written: 0, kept: [], skipped: {} });
		});
		return { job, legs: wanted.length };
	}

	// The generator's worker: one Nav (pool-less routes) and the hand-made sets.
	viaGenWorker() {
		if (this.viaWorker) return this.viaWorker;
		const w = new Worker(VIA_WORKER, { eval: true, workerData: { via: require.resolve('../lib/nav/via'), nav: require.resolve('../lib/nav/path'), geo: require.resolve('../lib/planner/geo'), dir: this.navDir, dataDir: this.dataDir, crossingsFile: this.crossingsFile, frames: this.data.mapFrames, zones: this.data.zones } });
		w.unref();
		w.on('message', (m) => {
			const p = this.viaJobs.get(m.job);
			if (!p) return;
			this.viaJobs.delete(m.job);
			if (m.error) p.reject(new Error(m.error));
			else p.resolve(m.result);
		});
		const fail = (err) => {
			if (this.viaWorker === w) this.viaWorker = null;
			for (const p of this.viaJobs.values()) p.reject(err);
			this.viaJobs.clear();
		};
		w.on('error', fail);
		w.on('exit', (code) => fail(new Error(`the waypoint worker stopped (exit ${code})`)));
		this.viaWorker = w;
		return w;
	}

	// The guides' headers for guides_list.
	list(packId) {
		const pack = packId === undefined || packId === null ? null : this.pack(packId);
		const out = [];
		for (const src of this.sources.values()) {
			if (!src.id || (pack && src.pack !== pack)) continue;
			const h = src.header;
			out.push({
				id: src.id,
				pack: src.pack.id,
				file: src.file,
				title: h.title || src.id,
				faction: h.faction || null,
				races: h.races || null,
				classes: h.classes || null,
				levels: h.levels ? { min: h.levels.min, max: h.levels.max } : null,
				zone: h.zone ? (h.zone.name !== undefined ? h.zone.name : this.geo.zoneName(h.zone.map)) : null,
				category: h.category || 'Leveling',
				folder: h.folder || null,
				next: h.next && h.next.length ? h.next[0] : null,
				nextChoices: h.next && h.next.length > 1 ? h.next.slice() : null,
			});
		}
		return out.sort((a, b) => (a.pack === b.pack ? (a.file < b.file ? -1 : a.file > b.file ? 1 : 0) : this.packs.findIndex((p) => p.id === a.pack) - this.packs.findIndex((p) => p.id === b.pack)));
	}

	// The diagnostics of one file: its own compile's, then the last full lint's (deduplicated).
	diagnosticsOf(src, compiled) {
		const out = [];
		const seen = new Set();
		const add = (d) => {
			const key = `${d.severity}|${d.line}|${d.message}`;
			if (seen.has(key)) return;
			seen.add(key);
			const o = { severity: d.severity, line: d.line || 0, message: d.message };
			if (d.hint) o.hint = d.hint;
			out.push(o);
		};
		for (const d of compiled.diag.sorted()) add(d);
		const lint = this.lintResults.get(src.pack.id);
		if (lint) for (const d of lint.diagnostics) if (d.file === src.file) add(d);
		return out.sort((a, b) => a.line - b.line || (a.severity === b.severity ? 0 : a.severity === 'error' ? -1 : 1));
	}

	// GuideView: the source model with each goal's compiled place, world
	// point and label, and the file's diagnostics.
	view(id) {
		const src = this.source(id);
		const key = `${src.hash}|${this.lintVersion}|${this.viaOf(src.pack).hash}`;
		const hit = this.viewCache.get(src.abs);
		if (hit && hit.key === key) return hit.view;
		const { model } = require('../lib/planner/source');
		const { goalLabel } = require('../lib/planner/timeline');
		const c = this.compiled(src);
		const m = model(src.text, src.file);
		const byLine = new Map();
		if (c.guide) for (const st of c.guide.steps) for (const g of st.goals) byLine.set(g._line, g);
		const legs = this.legViews(src, c);
		const header = {};
		for (const [k, v] of Object.entries(m.header || {})) header[k] = v;
		const view = {
			id: src.id,
			pack: src.pack.id,
			file: src.file,
			hash: src.hash,
			coords: m.coords,
			header,
			steps: m.steps.map((st) => ({
				index: st.index,
				line: st.line,
				end: st.end,
				title: st.title === undefined ? null : st.title,
				tip: st.tip === undefined ? null : st.tip,
				only: st.only === undefined ? null : st.only,
				zone: st.zone || null,
				directives: st.directives || [],
				goals: st.goals.map((g) => {
					const cg = byLine.get(g.line) || null;
					let compiled = null;
					let world = null;
					if (cg) {
						compiled = {};
						for (const k of COMPILED_KEYS) if (cg[k] !== undefined) compiled[k] = cg[k];
						if (cg.x !== undefined && cg.map !== undefined) {
							const w = this.geo.toWorld(cg.map, cg.x, cg.y, cg.f === 'e' ? 'e' : 'l');
							if (w) world = w;
						}
					}
					return {
						line: g.line,
						verb: g.verb,
						raw: g.raw,
						fields: g.fields,
						label: cg ? goalLabel(cg, this.geo) : g.raw.trim(),
						explicit: !!(g.fields && g.fields.explicitCoords),
						compiled,
						world,
						leg: (cg && legs.get(cg)) || null,
					};
				}),
			})),
			diagnostics: this.diagnosticsOf(src, c),
		};
		this.viewCache.set(src.abs, { key, view });
		return view;
	}

	params(cls) {
		const key = String(cls || '').toUpperCase();
		if (!this.paramsCache.has(key)) {
			const { loadParams } = require('../lib/planner/timeline');
			this.paramsCache.set(key, loadParams({ simDir: this.simDir, cls: key }));
		}
		return this.paramsCache.get(key);
	}

	route({ start, character, choices = {} }) {
		const { routeOf } = require('../lib/planner/timeline');
		this.source(start);
		return routeOf({ guides: new LazyGuides(this), start, character, choices: choices || {} });
	}

	// The points each taxi leg of travel.json flies through (buildTimeline
	// flightPaths): the Era client's TaxiPathNode of the build travel.json was
	// made from (data/sources/wago/<build>/TaxiPathNode.csv, cached by
	// `travel build`), read once; a path with a teleport or a continent change
	// is left out (drawn straight). null when the table is not cached.
	flightPaths() {
		if (this.flights !== undefined) return this.flights;
		this.flights = null;
		const build = this.travel && this.travel.build;
		const file = build ? path.join(this.sourcesDir, 'wago', String(build), 'TaxiPathNode.csv') : null;
		if (!file || !fs.existsSync(file)) return null;
		try {
			const { parseCsv } = require('../lib/data/csv');
			const { pathPoints } = require('../lib/travel/taxi');
			const { isJump } = require('../lib/travel/geo');
			const wanted = new Set(((this.travel.taxi && this.travel.taxi.legs) || []).map((l) => Number(l.path)));
			const all = pathPoints(parseCsv(fs.readFileSync(file, 'utf8')).filter((r) => wanted.has(Number(r.PathID))));
			const out = new Map();
			for (const [id, pts] of all) {
				if (pts.length < 2 || pts.some((q, i) => i > 0 && isJump(pts[i - 1], q))) continue;
				out.set(id, pts.map((q) => [Math.round(q.wx * 10) / 10, Math.round(q.wy * 10) / 10]));
			}
			this.flights = out;
		} catch (err) {
			this.log(`flight paths from ${file}: ${err.message || err}`);
		}
		return this.flights;
	}

	// The terrain routes (tools/planner/navpool.js), opened when first asked
	// for; null without a nav directory.
	navRoutes() {
		if (!this.navDir || this.closed) return null;
		if (!this.nav) {
			const { NavRoutes } = require('./navpool');
			this.nav = new NavRoutes({ dir: this.navDir, workers: this.navWorkers, log: this.log });
		}
		return this.nav;
	}

	// { available, build, continents, aids (an aids.json is there) }
	navInfo() {
		const nav = this.navRoutes();
		const info = nav ? nav.info() : { available: false, build: null, continents: [] };
		return { ...info, aids: !!(this.navDir && fs.existsSync(path.join(this.navDir, 'aids.json'))) };
	}

	// The arrow aids (nav aids: crossings schema 1, Era map percent) as world
	// points: { source, build, crossings: [{ id, a, b, ab, ba, oneWay }],
	// open: [{ a, b, aName, bName, c, oneWay }], chains: [{ id, name, open, c,
	// nodes: [{ c, wx, wy, r, caption, back }] }] } (ends { map, x, y, c, wx,
	// wy, r }); null without the file. Points without a map frame are left out.
	navAids() {
		if (!this.navDir) return null;
		const file = path.join(this.navDir, 'aids.json');
		let stat;
		try {
			stat = fs.statSync(file);
		} catch {
			return null;
		}
		if (this.aidsCache && this.aidsCache.mtime === stat.mtimeMs) return this.aidsCache.value;
		const doc = JSON.parse(fs.readFileSync(file, 'utf8'));
		const pt = (p) => {
			const w = p && Number.isFinite(p.x) && Number.isFinite(p.y) ? this.geo.toWorld(p.map, p.x, p.y, 'e') : null;
			return w ? { map: p.map, x: p.x, y: p.y, c: w.c, wx: Math.round(w.wx * 10) / 10, wy: Math.round(w.wy * 10) / 10, r: p.radius || null } : null;
		};
		const value = { source: doc.source || null, build: doc.build || null, crossings: [], open: [], chains: [] };
		for (const e of doc.crossings || []) {
			const a = pt(e.a);
			const b = pt(e.b);
			if (a && b) value.crossings.push({ id: e.id || null, a, b, ab: e.ab || null, ba: e.ba || null, oneWay: e.oneWay === true });
		}
		for (const e of doc.open || []) {
			const f = this.geo.frame(e.a, 'e');
			value.open.push({ a: e.a, b: e.b, aName: this.geo.zoneName(e.a), bName: this.geo.zoneName(e.b), c: f ? f.c : null, oneWay: e.oneWay === true });
		}
		for (const ch of doc.chains || []) {
			const nodes = (ch.nodes || []).map((n) => {
				const w = pt(n);
				return w ? { c: w.c, wx: w.wx, wy: w.wy, r: w.r, caption: n.caption || null, back: n.back || null } : null;
			}).filter(Boolean);
			if (nodes.length >= 2) value.chains.push({ id: ch.id || null, name: ch.name || null, open: ch.open || 'mouth', c: nodes[0].c, nodes });
		}
		this.aidsCache = { mtime: stat.mtimeMs, value };
		return value;
	}

	// The Timeline of the route from `start`, cached by the chain's texts, the
	// arguments and the nav build. Walk legs are routed on the grid
	// (navpool.js): a build with legs not in the route cache yet plays them
	// as straight lines (marked, `routing: { pending, done }` counting them
	// live) and has the pool compute them; when they are all answered the
	// entry is dropped and 'changed' { timeline: true, routed: id } tells the
	// page to ask again (that build finds them all).
	// optional: play optional goals too (false: buildTimeline skips them).
	timeline({ start, character, choices = {}, startLevel = null, optional = false }) {
		const { buildTimeline } = require('../lib/planner/timeline');
		const ids = this.route({ start, character, choices });
		const nav = this.navRoutes();
		const info = nav ? nav.info() : null;
		const build = info && info.available ? info.build : null;
		const key = JSON.stringify([ids.map((id) => (this.byId.get(id) || {}).hash || null), [...this.vias.values()].map((v) => v.hash), character, choices || {}, startLevel, !!optional, build]);
		if (this.timelines.has(key)) {
			const t = this.timelines.get(key);
			this.timelines.delete(key);
			this.timelines.set(key, t);
			return t;
		}
		const provider = build ? nav.provider() : null;
		const t0 = Date.now();
		const t = buildTimeline({
			guides: new LazyGuides(this), data: this.data, geo: this.geo, params: this.params(character.cls), travel: this.travel,
			start, character, choices: choices || {}, startLevel: startLevel === undefined ? null : startLevel, optional: !!optional,
			routes: provider ? provider.routes : null, nav: build ? { build } : null, flightPaths: this.flightPaths(),
		});
		const ms = Date.now() - t0;
		if (provider && provider.misses.size) {
			const job = nav.compute(provider.misses);
			t.routing = job.progress;
			this.log(`timeline ${start}: ${ms} ms; routing ${job.progress.pending} legs`);
			const tick = setInterval(() => this.emit('routing', { ...job.progress }), 1000);
			tick.unref();
			job.promise.then(() => {
				clearInterval(tick);
				if (this.timelines.get(key) === t) this.timelines.delete(key);
				if (!this.closed) {
					this.emit('routing', { ...job.progress });
					this.emit('changed', { files: [], guides: [], external: false, timeline: true, routed: job.progress.id });
				}
			});
		} else if (build) this.log(`timeline ${start}: ${ms} ms; routed ${t.totals.routed} of ${t.totals.legs} legs`);
		this.timelines.set(key, t);
		while (this.timelines.size > TIMELINE_CACHE) this.timelines.delete(this.timelines.keys().next().value);
		return t;
	}

	// Write a source's new text (ours: the watcher ignores it by hash).
	write(src, text) {
		fs.writeFileSync(src.abs, text);
		src.text = text;
		src.hash = sha1(text);
		this.readHeader(src);
		this.reindex();
	}

	changed(srcs, external = false) {
		const files = [...new Set(srcs.map((s) => s.file))];
		const guides = [...new Set(srcs.map((s) => s.id).filter(Boolean))];
		for (const s of srcs) if (s.pack) this.markDirty(s.pack);
		this.emit('changed', { files, guides, external });
	}

	// Apply source edit operations to a guide; refused when `hash` is not the file's.
	// Each op's `line` and `step` name goals and steps of the text at `hash`:
	// they are followed through the earlier ops of the batch.
	edit({ id, hash, ops, label = null }) {
		const { apply, EditError } = require('../lib/planner/source');
		const src = this.source(id);
		this.syncFromDisk(src);
		if (hash !== src.hash) throw new PlannerError(`${src.file} changed since hash ${hash} (now ${src.hash}): reload the guide and edit again`, 'stale');
		const before = src.text;
		let text = before;
		let select = null;
		// Goal lines the ops name (as at `hash`) and where each is now (null: deleted).
		const named = [...new Set(ops.map((op) => op && op.line).filter((ln) => Number.isInteger(ln)))];
		let track = named.slice();
		// Step index at `hash` -> now (null: deleted); null while no step op changed them.
		let steps = null;
		ops.forEach((op0, k) => {
			const op = op0 && typeof op0 === 'object' ? { ...op0 } : op0;
			const what = `op ${k + 1} (${op && op.op})`;
			if (op && Number.isInteger(op.line)) {
				op.line = track[named.indexOf(op.line)];
				if (op.line === null) throw new PlannerError(`${what}: the goal on line ${op0.line} was deleted by an earlier op of the batch`, 'bad_args');
			}
			if (op && steps && op.step !== undefined && op.op !== 'insertStep') {
				if (!Number.isInteger(op.step) || op.step < 0 || op.step >= steps.length) throw new PlannerError(`${what}: no step ${op0.step} (the guide had ${steps.length})`, 'bad_args');
				op.step = steps[op0.step];
				if (op.step === null) throw new PlannerError(`${what}: step ${op0.step} was deleted by an earlier op of the batch`, 'bad_args');
			}
			let r;
			try {
				r = apply(text, op, src.file, track);
			} catch (err) {
				if (err instanceof EditError) throw new PlannerError(ops.length > 1 ? `${what}: ${err.message}` : err.message, 'edit');
				throw err;
			}
			text = r.text;
			track = r.track;
			if (r.steps) steps = steps ? steps.map((s) => (s === null ? null : r.steps[s])) : r.steps.slice();
			if (r.select) select = r.select;
		});
		if (text !== before) {
			this.write(src, text);
			this.undoStack.push({ abs: src.abs, file: src.file, before, after: text, label: label || describeOps(ops) });
			this.redoStack = [];
			this.changed([src]);
		}
		return { guide: this.view(src.id), select };
	}

	// The disk text wins over the cached one (an external change not yet seen by the watcher).
	syncFromDisk(src) {
		let text;
		try {
			text = fs.readFileSync(src.abs, 'utf8');
		} catch {
			throw new PlannerError(`${src.file} no longer exists`, 'not_found');
		}
		if (sha1(text) === src.hash) return false;
		src.text = text;
		src.hash = sha1(text);
		this.readHeader(src);
		this.reindex();
		this.changed([src], true);
		return true;
	}

	// opts.drop: a conflicting top entry is dropped instead of refused.
	undo({ drop = false } = {}) {
		return this.step(this.undoStack, this.redoStack, 'before', 'after', 'undo', drop);
	}

	redo({ drop = false } = {}) {
		return this.step(this.redoStack, this.undoStack, 'after', 'before', 'redo', drop);
	}

	// An entry's text null = no file (a deleted guide written back by revert).
	step(from, to, want, expect, what, drop = false) {
		const e = from[from.length - 1];
		if (!e) throw new PlannerError(`nothing to ${what}`, 'empty');
		let disk = null;
		try {
			disk = fs.readFileSync(e.abs, 'utf8');
		} catch {
			disk = null;
		}
		if (disk !== e[expect]) {
			if (!drop) throw new PlannerError(`cannot ${what} "${e.label}": ${e.file} changed since (it no longer holds the text the edit left); edit_${what} with drop: true drops it from the history`, 'conflict');
			from.pop();
			return { file: e.file, label: e.label, dropped: true, guide: null };
		}
		const via = this.vias.get(e.abs);
		if (via) {
			const beforeDoc = via.doc;
			this.writeVia(via, e[want]);
			from.pop();
			to.push(e);
			const guides = this.viaChanged(via, beforeDoc);
			return { file: e.file, label: e.label, dropped: false, guide: guides.length === 1 ? this.view(guides[0]) : null };
		}
		if (e[want] === null) {
			fs.rmSync(e.abs);
			from.pop();
			to.push(e);
			const gone = this.sources.get(e.abs) || { abs: e.abs, file: e.file, pack: this.packOf(e.abs), id: null };
			this.sources.delete(e.abs);
			this.reindex();
			this.changed([{ ...gone, text: null }]);
			return { file: e.file, label: e.label, dropped: false, guide: null };
		}
		if (disk === null) {
			fs.mkdirSync(path.dirname(e.abs), { recursive: true });
			fs.writeFileSync(e.abs, e[want]);
		}
		const src = this.sources.get(e.abs) || this.load(this.packOf(e.abs), e.abs);
		this.write(src, e[want]);
		from.pop();
		to.push(e);
		this.changed([src]);
		return { file: src.file, label: e.label, dropped: false, guide: src.id ? this.view(src.id) : null };
	}

	changes() {
		const out = [];
		for (const [abs, start] of this.initial) {
			const via = this.vias.get(abs);
			const src = via ? null : this.sources.get(abs);
			const now = via ? via.text : src ? src.text : null;
			if (now === start) continue;
			const d = lineDiff(start === null ? '' : start, now === null ? '' : now);
			out.push({ file: via ? via.file : src ? src.file : shownFile(abs), guide: src ? src.id : null, added: d.added, removed: d.removed });
		}
		return out.sort((a, b) => (a.file < b.file ? -1 : a.file > b.file ? 1 : 0));
	}

	// Put a file back to its starting text (an undoable edit); a guide deleted
	// since is written back (undo deletes it again).
	revert(file) {
		const via = [...this.vias.values()].find((v) => v.file === file || samePath(v.abs, path.resolve(ROOT, file)));
		if (via) return this.revertVia(via);
		const found = this.sourceByFile(file);
		const start = this.initial.get(found.abs);
		if (start === undefined) throw new PlannerError(`no guide file "${file}"`, 'not_found');
		if (start === null) throw new PlannerError(`${found.file} did not exist when the planner started; delete it yourself`, 'conflict');
		const label = `Revert ${found.file}`;
		if (!fs.existsSync(found.abs)) {
			fs.mkdirSync(path.dirname(found.abs), { recursive: true });
			fs.writeFileSync(found.abs, start);
			const src = this.load(found.pack, found.abs);
			this.reindex();
			this.undoStack.push({ abs: src.abs, file: src.file, before: null, after: start, label });
			this.redoStack = [];
			this.changed([src]);
			return { file: src.file, guide: src.id ? this.view(src.id) : null };
		}
		const src = this.sources.get(found.abs) || this.load(found.pack, found.abs);
		this.syncFromDisk(src);
		if (src.text === start) return { file: src.file, guide: src.id ? this.view(src.id) : null };
		const before = src.text;
		this.write(src, start);
		this.undoStack.push({ abs: src.abs, file: src.file, before, after: start, label });
		this.redoStack = [];
		this.changed([src]);
		return { file: src.file, guide: src.id ? this.view(src.id) : null };
	}

	revertVia(rec) {
		const start = this.initial.get(rec.abs);
		if (start === null) throw new PlannerError(`${rec.file} did not exist when the planner started; delete it yourself`, 'conflict');
		this.syncVia(rec);
		if (rec.text !== start) {
			const before = rec.text;
			const beforeDoc = rec.doc;
			this.writeVia(rec, start);
			this.undoStack.push({ abs: rec.abs, file: rec.file, before, after: start, label: `Revert ${rec.file}` });
			this.redoStack = [];
			this.viaChanged(rec, beforeDoc);
		}
		return { file: rec.file, guide: null };
	}

	// buildPack's pack: another pack reads ours as context.
	buildTarget(p) {
		const ours = this.packs.find((x) => x.official);
		return {
			dir: p.dir, manifest: p.manifest, official: p.official, diags: p.diags,
			contextDir: p.official ? null : ours ? ours.dir : null,
			contextDataDir: p.official ? null : this.dataDir,
		};
	}

	build(p, files) {
		return buildPack(this.buildTarget(p), { dataDir: this.dataDir, cache: { data: this.data, contextData: this.data, diags: [] }, files });
	}

	// The full lint of a pack in the lint worker (a full compile blocks for
	// seconds): -> [{ file, line, severity, message, hint }], files named like GuideView.
	lint(packId) {
		const p = this.pack(packId);
		const worker = this.lintWorker();
		const seq = ++this.lintSeq;
		return new Promise((resolve, reject) => {
			this.lintPending.set(seq, { resolve, reject });
			worker.postMessage({ seq, target: this.buildTarget(p) });
		}).then((list) => {
			const diagnostics = list.map(shapeDiag);
			this.lintResults.set(p.id, { diagnostics, at: Date.now() });
			this.lintVersion++;
			return diagnostics;
		});
	}

	lintWorker() {
		if (this.worker) return this.worker;
		const w = new Worker(LINT_WORKER, { eval: true, workerData: { build: require.resolve('../lib/pack/build'), data: require.resolve('../lib/dsl/data'), dataDir: this.dataDir } });
		w.unref();
		w.on('message', (m) => {
			const p = this.lintPending.get(m.seq);
			if (!p) return;
			this.lintPending.delete(m.seq);
			if (m.error) p.reject(new Error(m.error));
			else p.resolve(m.diagnostics);
		});
		const fail = (err) => {
			if (this.worker === w) this.worker = null;
			for (const p of this.lintPending.values()) p.reject(err);
			this.lintPending.clear();
		};
		w.on('error', fail);
		w.on('exit', (code) => fail(new Error(`the lint worker stopped (exit ${code})`)));
		this.worker = w;
		return w;
	}

	// pack_compile: the addon folder, like `compile` (ours -> addon/<folder>, another -> <pack>/dist/<folder>).
	compilePack(packId) {
		const p = this.pack(packId);
		const outDir = p.official ? folderIn(path.join(ROOT, 'addon'), p.manifest.folder) : folderIn(path.join(p.dir, 'dist'), p.manifest.folder);
		const built = this.build(p, true);
		if (!built.diag.hasErrors()) {
			try {
				writePackDir(outDir, built.files);
			} catch (e) {
				built.diag.error(shownFile(outDir), 0, e.message);
			}
		}
		const ok = !built.diag.hasErrors();
		const diagnostics = built.diag.sorted().map(shapeDiag);
		return { ok, errors: built.diag.errors.length, warnings: built.diag.warnings.length, outDir: ok ? shownFile(outDir) : null, guides: ok ? built.guides.length : 0, diagnostics };
	}

	// The full lint of a pack after edits, debounced; another pack reads ours, so it follows.
	markDirty(pack) {
		this.dirtyPacks.add(pack.id);
		if (pack.official) for (const p of this.packs) this.dirtyPacks.add(p.id);
		this.scheduleLint();
	}

	scheduleLint() {
		clearTimeout(this.lintTimer);
		this.lintTimer = setTimeout(async () => {
			this.lintTimer = null;
			const ids = [...this.dirtyPacks];
			this.dirtyPacks.clear();
			for (const id of ids) {
				if (!this.packs.some((p) => p.id === id)) continue;
				try {
					await this.lint(id);
					this.emit('diagnostics', { pack: id });
				} catch (err) {
					if (!this.closed) this.log(`lint of ${id} failed: ${err.message || err}`);
				}
			}
		}, this.lintDelay);
		this.lintTimer.unref();
	}

	// Lint every pack soon (the planner's start).
	lintAll() {
		for (const p of this.packs) this.dirtyPacks.add(p.id);
		this.scheduleLint();
	}

	startWatch() {
		for (const p of this.packs) {
			try {
				const w = fs.watch(p.dir, { recursive: true }, (type, name) => {
					if (!name) return;
					const rel = toPosix(String(name));
					if (rel === VIA_FILE) {
						this.watchPending.add(path.join(p.dir, rel));
						clearTimeout(this.watchTimer);
						this.watchTimer = setTimeout(() => this.flushWatch(), 120);
						return;
					}
					if (!rel.endsWith('.guide') || rel.startsWith('dist/') || rel.startsWith('drafts/') || rel.split('/').some((part) => part.startsWith('.'))) return;
					this.watchPending.add(path.join(p.dir, rel));
					clearTimeout(this.watchTimer);
					this.watchTimer = setTimeout(() => this.flushWatch(), 120);
				});
				w.on('error', (err) => this.log(`watching ${p.dir} failed: ${err.message}`));
				this.watchers.push(w);
			} catch (err) {
				this.log(`cannot watch ${p.dir}: ${err.message}`);
			}
		}
	}

	// External changes: re-read each named file; ours (same hash) are ignored.
	flushWatch() {
		this.watchTimer = null;
		const touched = [];
		for (const abs of this.watchPending) {
			const via = this.vias.get(abs);
			if (via) {
				this.syncVia(via);
				continue;
			}
			const pack = this.packOf(abs);
			if (!pack) continue;
			const src = this.sources.get(abs);
			let text = null;
			try {
				text = fs.readFileSync(abs, 'utf8');
			} catch {
				text = null;
			}
			if (text === null) {
				if (src) {
					this.sources.delete(abs);
					touched.push({ ...src, text: null });
				}
				continue;
			}
			if (src && sha1(text) === src.hash) continue;
			if (src) {
				src.text = text;
				src.hash = sha1(text);
				this.readHeader(src);
				touched.push(src);
			} else touched.push(this.load(pack, abs));
		}
		this.watchPending.clear();
		if (!touched.length) return;
		this.reindex();
		this.changed(touched, true);
	}

	setView(state) {
		this.viewState = { ...state, at: Date.now() };
		return this.viewState;
	}

	close() {
		this.closed = true;
		if (this.worker) this.worker.terminate();
		this.worker = null;
		if (this.nav) this.nav.close();
		this.nav = null;
		if (this.viaWorker) this.viaWorker.terminate();
		this.viaWorker = null;
		clearTimeout(this.lintTimer);
		clearTimeout(this.watchTimer);
		for (const w of this.watchers) w.close();
		this.watchers = [];
	}
}

const OP_LABELS = {
	setCoords: 'Move waypoint', setRadius: 'Set radius', setGoal: 'Edit goal', insertGoal: 'Add goal', deleteGoal: 'Delete goal', moveGoal: 'Move goal',
	setStep: 'Edit step', insertStep: 'Add step', deleteStep: 'Delete step', moveStep: 'Move step', setHeader: 'Edit header',
};

function describeOps(ops) {
	const names = [...new Set(ops.map((o) => OP_LABELS[o.op] || o.op))];
	return names.join(', ') || 'Edit';
}

module.exports = { Workspace, PlannerError, lineDiff, shownFile, sha1 };
