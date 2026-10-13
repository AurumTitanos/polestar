'use strict';
// SavedVariables (PolestarRecorderDB) -> data/recordings/<session>.json.
//
//   const { findSavedVariables, importFile } = require('./recording/import');
//   for (const sv of findSavedVariables({})) importFile(sv, { outDir });
//
// Every import archives the raw file (data/recordings/raw/) and merges into
// the per-session JSON files; nothing is ever deleted. That is what protects
// recordings from Forever's cold-start bug, where the client restores nil and
// the next logout overwrites the file with only the new session.

const crypto = require('node:crypto');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { luaToJson } = require('../lua');
const { detectAddonsDirs, nativeWowDir } = require('../addons');

const ROOT = path.join(__dirname, '..', '..', '..');
const DEFAULT_OUT = path.join(ROOT, 'data', 'recordings');
const SV_FILE = 'Polestar_Recorder.lua';

// Fixed install paths for each client folder Forever has used, newest first:
// "_forever_" after launch, "_classic_beta_" during the beta. They cover
// installs whose client folder has no .flavor.info for `install` to detect.
const FLAVORS = [
	['forever', '_forever_'],
	['beta', '_classic_beta_'],
	[null, '_classic_'],
	[null, '_classic_ptr_'],
];

// WTF folders to search, best first: $POLESTAR_WTF; then every launch client
// (detected by `install` in any Wine/Proton/Faugus/Lutris/Bottles prefix, then
// the fixed paths), then every beta client, so a leftover beta WTF never
// shadows the live one; then older fixed paths.
// `native` ({ platform, root }, tools/lib/addons.js nativeWowDir): which native
// install to check; tests inject it so they never reach a real one.
function defaultWtfDirs(home = os.homedir(), native = {}) {
	const dirs = [];
	const add = (d) => {
		if (!dirs.includes(d)) dirs.push(d);
	};
	if (process.env.POLESTAR_WTF) add(process.env.POLESTAR_WTF);
	const detected = detectAddonsDirs(home, native);
	const installs = [
		path.join(home, 'Games', 'drive_c', 'Program Files (x86)', 'World of Warcraft'),
		path.join(home, '.wine', 'drive_c', 'Program Files (x86)', 'World of Warcraft'),
	];
	const nativeDir = nativeWowDir(native);
	if (nativeDir) installs.push(nativeDir);
	for (const [kind, folder] of FLAVORS) {
		for (const c of detected) if (kind && c.kind === kind) add(path.join(c.client, 'WTF'));
		for (const base of installs) add(path.join(base, folder, 'WTF'));
	}
	return dirs;
}

// All WTF/Account/*/SavedVariables/Polestar_Recorder.lua files. `sv` paths
// win outright; otherwise `wtf` (one dir) or the default install locations.
function findSavedVariables({ sv = [], wtf = null, home, native = {} } = {}) {
	if (sv.length) return sv.map((p) => path.resolve(p));
	const dirs = wtf ? [wtf] : defaultWtfDirs(home, native);
	const found = [];
	for (const dir of dirs) {
		const accounts = path.join(dir, 'Account');
		if (!fs.existsSync(accounts)) continue;
		for (const entry of fs.readdirSync(accounts, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
			if (!entry.isDirectory()) continue;
			const file = path.join(accounts, entry.name, 'SavedVariables', SV_FILE);
			if (fs.existsSync(file)) found.push(file);
		}
		if (found.length) break;
	}
	return found;
}

// Account folder name of a SavedVariables path, or "local" for a loose file.
function accountOf(svPath) {
	const parts = path.resolve(svPath).split(path.sep);
	const i = parts.lastIndexOf('SavedVariables');
	if (i >= 2 && parts[i - 2] === 'Account') return parts[i - 1];
	return 'local';
}

function safeName(s) {
	return String(s).replace(/[^\p{L}\p{N}_.-]+/gu, '_').replace(/^\.+/, '_');
}

function stamp(date) {
	return date.toISOString().replace(/[-:]/g, '').replace(/\.\d+Z$/, 'Z');
}

function sha1(buf) {
	return crypto.createHash('sha1').update(buf).digest('hex');
}

// Copies the raw file to raw/<timestamp>-<account>.lua unless the newest
// archive of that account is byte-identical. Returns the archive path.
function archiveRaw(svPath, outDir, now = new Date()) {
	const rawDir = path.join(outDir, 'raw');
	fs.mkdirSync(rawDir, { recursive: true });
	const account = safeName(accountOf(svPath));
	const content = fs.readFileSync(svPath);
	const suffix = `-${account}.lua`;
	const previous = fs
		.readdirSync(rawDir)
		.filter((f) => f.endsWith(suffix))
		.sort();
	const last = previous[previous.length - 1];
	if (last && sha1(fs.readFileSync(path.join(rawDir, last))) === sha1(content)) {
		return { path: path.join(rawDir, last), created: false };
	}
	let file = path.join(rawDir, `${stamp(now)}${suffix}`);
	for (let n = 2; fs.existsSync(file); n++) file = path.join(rawDir, `${stamp(now)}-${n}${suffix}`);
	fs.writeFileSync(file, content);
	return { path: file, created: true };
}

function readDb(svPath) {
	return luaToJson({ files: [svPath], expr: 'return PolestarRecorderDB' });
}

// Lua tables come back as arrays (1..n), {} (empty) or objects with numeric
// string keys (sparse); all of those mean "list" here.
function toList(v) {
	if (Array.isArray(v)) return v;
	if (v && typeof v === 'object') {
		return Object.keys(v)
			.filter((k) => /^\d+$/.test(k))
			.sort((a, b) => a - b)
			.map((k) => v[k]);
	}
	return [];
}

// The inverse for tables keyed by id: a Lua table whose ids happen to be
// exactly 1..n arrives as an array.
function toObject(v) {
	if (Array.isArray(v)) return Object.fromEntries(v.map((x, i) => [String(i + 1), x]));
	return v && typeof v === 'object' ? v : {};
}

const LIST_FIELDS = new Set(['available', 'active']);

function normalizeEvent(ev) {
	const out = { t: typeof ev.t === 'number' ? ev.t : 0, e: ev.e };
	for (const key of Object.keys(ev).sort()) {
		if (key === 't' || key === 'e') continue;
		const v = ev[key];
		if (v === null || v === undefined) continue;
		out[key] = LIST_FIELDS.has(key) ? toList(v) : v;
	}
	return out;
}

const MAP_FIELDS = ['name', 'type', 'parent', 'c', 'left', 'right', 'top', 'bottom'];

function normalizeMap(m) {
	const out = {};
	for (const k of MAP_FIELDS) if (m[k] !== undefined && m[k] !== null) out[k] = m[k];
	return out;
}

function sortedMaps(maps) {
	const out = {};
	for (const id of Object.keys(maps).sort((a, b) => a - b)) out[id] = maps[id];
	return out;
}

// One session of PolestarRecorderDB -> the schema of docs/ARCHITECTURE.md
// "Recordings". `dbMaps` (from /lsrec maps) fill in maps the session touched
// and their parents.
function normalizeSession(key, raw, dbMaps = {}) {
	const events = toList(raw.events)
		.filter((ev) => ev && typeof ev === 'object' && typeof ev.e === 'string')
		.map(normalizeEvent);
	const maps = {};
	const own = toObject(raw.maps);
	for (const [id, m] of Object.entries(own)) if (m && typeof m === 'object') maps[id] = normalizeMap(m);
	const wanted = new Set(Object.keys(maps));
	for (const ev of events) if (ev.map !== undefined) wanted.add(String(ev.map));
	for (const id of [...wanted]) {
		let cur = id;
		for (let depth = 0; cur !== undefined && depth < 16; depth++) {
			const m = maps[cur] || (dbMaps[cur] && normalizeMap(dbMaps[cur]));
			if (!m) break;
			maps[cur] = maps[cur] ? { ...m, ...maps[cur] } : m;
			cur = m.parent !== undefined ? String(m.parent) : undefined;
		}
	}
	const char = raw.char && typeof raw.char === 'object' ? raw.char : {};
	const out = {
		schema: 1,
		build: raw.build ?? null,
		session: typeof raw.session === 'string' ? raw.session : key,
		char: {
			name: char.name ?? null,
			realm: char.realm ?? null,
			race: char.race ?? null,
			class: char.class ?? null,
			faction: char.faction ?? null,
		},
		started: raw.started ?? null,
		ended: raw.ended ?? null,
		events,
		maps: sortedMaps(maps),
	};
	const dropped = {};
	if (raw.dropped && typeof raw.dropped === 'object') {
		for (const [k, n] of Object.entries(raw.dropped)) if (typeof n === 'number' && n > 0) dropped[k] = n;
	}
	if (Object.keys(dropped).length) out.dropped = dropped;
	Object.assign(out, normalizeDumps(raw));
	return out;
}

// Session-scoped dumps (/lsrec factions|skills|legacy): Lua tables keyed by
// id become objects, lists become arrays (an empty Lua table is ambiguous).
function idMap(v, fn = (x) => x) {
	const out = {};
	for (const [k, x] of Object.entries(toObject(v))) if (x && typeof x === 'object') out[k] = fn(x);
	return out;
}

function withLists(obj, keys) {
	const out = { ...obj };
	for (const k of keys) out[k] = toList(out[k]);
	return out;
}

function normalizeTree(t) {
	return {
		...withLists(t, ['groups', 'nodes']),
		nodes: toList(t.nodes).map((n) => ({ ...withLists(n, ['groups', 'edges', 'entries']) })),
		...(t.currency !== undefined ? { currency: toList(t.currency) } : {}),
	};
}

function normalizeLegacy(l) {
	return {
		...l,
		categories: idMap(l.categories, (c) => withLists(c, ['achievements'])),
		achievements: idMap(l.achievements, (a) => withLists(a, ['criteria'])),
		majorFactions: idMap(l.majorFactions, (f) => ({
			...f,
			levels: toList(f.levels).map((lv) => withLists(lv, ['rewards'])),
		})),
		trees: toList(l.trees).map(normalizeTree),
	};
}

const DUMPS = { factions: (v) => idMap(v), skills: (v) => idMap(v), legacy: normalizeLegacy };

function normalizeDumps(raw) {
	const out = {};
	for (const [kind, fn] of Object.entries(DUMPS)) {
		if (raw[kind] && typeof raw[kind] === 'object') out[kind] = fn(raw[kind]);
	}
	const dumped = {};
	for (const kind of Object.keys(out)) {
		const at = raw.dumped && raw.dumped[kind];
		if (typeof at === 'number') dumped[kind] = at;
	}
	if (Object.keys(dumped).length) out.dumped = dumped;
	return out;
}

function sessionPath(outDir, session) {
	return path.join(outDir, `${safeName(session)}.json`);
}

// Same session already on disk: keep the longer event list, union the maps.
function mergeSessions(existing, incoming) {
	const keepExisting = existing.events.length > incoming.events.length;
	const base = keepExisting ? existing : incoming;
	const other = keepExisting ? incoming : existing;
	const merged = { ...base, maps: sortedMaps({ ...(other.maps || {}), ...(base.maps || {}) }) };
	if (typeof other.started === 'number' && (typeof base.started !== 'number' || other.started < base.started)) merged.started = other.started;
	if (typeof other.ended === 'number' && (typeof base.ended !== 'number' || other.ended > base.ended)) merged.ended = other.ended;
	// Dumps: the most recent of either side wins.
	for (const kind of Object.keys(DUMPS)) {
		const mine = base.dumped?.[kind] ?? (base[kind] ? 0 : -1);
		const theirs = other.dumped?.[kind] ?? (other[kind] ? 0 : -1);
		if (theirs > mine) {
			merged[kind] = other[kind];
			merged.dumped = { ...(merged.dumped || {}), [kind]: other.dumped?.[kind] };
		}
	}
	return merged;
}

// Writes (or merges) one normalized session. Returns "new" | "updated" | "unchanged".
function writeSession(outDir, session) {
	fs.mkdirSync(outDir, { recursive: true });
	const file = sessionPath(outDir, session.session);
	let next = session;
	let status = 'new';
	if (fs.existsSync(file)) {
		const existing = JSON.parse(fs.readFileSync(file, 'utf8'));
		next = mergeSessions(existing, session);
		status = 'updated';
	}
	const text = `${JSON.stringify(next, null, '\t')}\n`;
	if (status === 'updated' && fs.readFileSync(file, 'utf8') === text) return { file, status: 'unchanged', session: next };
	fs.writeFileSync(file, text);
	return { file, status, session: next };
}

// Archive, convert and write one SavedVariables file.
function importFile(svPath, { outDir = DEFAULT_OUT, now = new Date() } = {}) {
	const archive = archiveRaw(svPath, outDir, now);
	const db = readDb(svPath);
	const results = [];
	if (db && typeof db === 'object') {
		const sessions = db.sessions && typeof db.sessions === 'object' && !Array.isArray(db.sessions) ? db.sessions : {};
		const dbMaps = toObject(db.maps);
		for (const key of Object.keys(sessions).sort()) {
			const raw = sessions[key];
			if (!raw || typeof raw !== 'object') continue;
			results.push(writeSession(outDir, normalizeSession(key, raw, dbMaps)));
		}
	}
	return { sv: svPath, account: accountOf(svPath), archive, sessions: results, keys: results.map((r) => r.session.session) };
}

module.exports = {
	DEFAULT_OUT,
	SV_FILE,
	defaultWtfDirs,
	findSavedVariables,
	accountOf,
	archiveRaw,
	readDb,
	normalizeSession,
	mergeSessions,
	writeSession,
	sessionPath,
	importFile,
	safeName,
};
