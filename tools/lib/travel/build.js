'use strict';
// `travel build`: the flight network, transports, inns, learned walking
// paths and zone crossings -> data/forever/travel.json (full detail, with
// sources and warnings) and addon/Polestar/Nav/TravelData.lua (what the
// in-game planner needs). Crossings from the optional local crossings file
// (data/local/crossings.json) go into the local data addon Polestar_Travel
// instead, never into TravelData.lua. Same inputs give byte-identical outputs.

const fs = require('node:fs');
const path = require('node:path');
const { Frames } = require('./geo');
const { header } = require('../generated');
const { loadTravelTables } = require('./sources');
const { buildTaxi } = require('./taxi');
const { buildTransports } = require('./transports');
const { buildInns } = require('./inns');
const { buildPaths, liveFramesOf } = require('./paths');
const { readCrossingsFile, recordedCrossings, crossingsLua, emitTravelAddon, crossingCounts, TRAVEL_ADDON } = require('./crossings');
const { readRecordings } = require('../data/recordings');

const ROOT = path.join(__dirname, '..', '..', '..');
const PATH_CHUNK = 1000; // records per Lua function (keeps each under Lua 5.1's constant limits)

function readJson(file) {
	if (!fs.existsSync(file)) throw new Error(`missing ${file} (run: node tools/polestar.js data build)`);
	return JSON.parse(fs.readFileSync(file, 'utf8'));
}

// --- Lua emission -----------------------------------------------------------

function luaStr(s) {
	return `"${String(s).replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\n/g, '\\n')}"`;
}

function luaNum(n) {
	if (!Number.isFinite(n)) throw new Error(`non-finite number in travel data: ${n}`);
	return String(Object.is(n, -0) ? 0 : n);
}

function luaVal(v) {
	if (typeof v === 'number') return luaNum(v);
	if (typeof v === 'string') return luaStr(v);
	if (typeof v === 'boolean') return v ? 'true' : 'false';
	if (v === null || v === undefined) return 'nil';
	if (Array.isArray(v)) return `{${v.map(luaVal).join(',')}}`;
	const keys = Object.keys(v).sort();
	return `{${keys.map((k) => `${/^[A-Za-z_]\w*$/.test(k) ? k : `[${luaStr(k)}]`}=${luaVal(v[k])}`).join(',')}}`;
}

function emitLua(t) {
	const lines = [];
	lines.push(header('lua', 'travel build', 'the client tables, data/forever and data/recordings'));
	lines.push(`-- Blizzard Classic Era client tables (wago.tools build ${t.build}): TaxiNodes, TaxiPath,`);
	lines.push('-- TaxiPathNode, AreaTrigger; WoW Forever client TaxiPathNode (wago.tools build');
	lines.push(`-- ${t.foreverBuild || 'none'}) for the ships Forever added; docks and inns placed from data/forever (pfQuest, MIT);`);
	lines.push(`-- learned walking paths from ${t.paths.sessions.length} recorded session(s).`);
	lines.push('');
	lines.push('local ADDON, ns = ...');
	lines.push('local N = ns.Nav');
	lines.push('if not (N and N.RegisterTravelData) then return end');
	lines.push('');
	lines.push('N.RegisterTravelData({');
	lines.push(`\tbuild = ${luaStr(t.build)},`);
	lines.push('\t-- id, continent, wx, wy, uiMapID, x, y (Era frame), faction mask (1 Alliance, 2 Horde), name');
	lines.push('\ttaxi = {');
	for (const n of t.taxi.nodes) lines.push(`\t\t${luaVal([n.id, n.c, n.wx, n.wy, n.map, n.x, n.y, n.faction, n.name])},`);
	lines.push('\t},');
	lines.push('\t-- one-way flights: from, to, yards flown');
	lines.push('\tflights = {');
	for (const l of t.taxi.legs) lines.push(`\t\t${l.from},${l.to},${l.yards},`);
	lines.push('\t},');
	lines.push('\t-- ends: name, continent, wx, wy, uiMapID, x, y, frame ("e" Era, "l" live); seconds riding a->b, b->a and waiting at a, b');
	lines.push('\ttransports = {');
	for (const tr of t.transports) {
		const end = (e) => [e.name, e.c, e.wx, e.wy, e.map, e.x, e.y, e.f];
		lines.push(`\t\t${luaVal({ id: tr.id, kind: tr.kind, faction: tr.faction, a: end(tr.a), b: end(tr.b), ab: tr.ab, ba: tr.ba, waitA: tr.waitA, waitB: tr.waitB })},`);
	}
	lines.push('\t},');
	lines.push('\t-- bind location names (as GetBindLocation reports them), innkeeper NPC, position');
	lines.push('\tinns = {');
	for (const i of t.inns) lines.push(`\t\t${luaVal({ names: i.names, npc: i.npc, c: i.c, wx: i.wx, wy: i.wy, map: i.map, x: i.x, y: i.y, f: i.f })},`);
	lines.push('\t},');
	lines.push('})');
	if (t.crossings.recorded.length) {
		lines.push(`-- zone crossings learned from recorded play (used where a continent has full crossing data)`);
		lines.push(...crossingsLua({ crossings: t.crossings.recorded, open: [], chains: [] }, t.frames, { complete: false }));
	}
	const pn = t.paths.nodes;
	for (let i = 0; i < pn.length; i += PATH_CHUNK) {
		const part = pn.slice(i, i + PATH_CHUNK);
		lines.push('-- learned path nodes: continent, wx, wy, gateway (1 = zone-border crossing), uiMap');
		lines.push('N.AddTravelPaths((function() return { nodes = {');
		for (const n of part) lines.push(`\t${n.c},${n.wx},${n.wy},${n.gateway ? 1 : 0},${n.map},`);
		lines.push('} } end)())');
	}
	const pe = t.paths.edges;
	for (let i = 0; i < pe.length; i += PATH_CHUNK) {
		const part = pe.slice(i, i + PATH_CHUNK);
		lines.push('-- learned path edges: node, node, yards');
		lines.push('N.AddTravelPaths((function() return { edges = {');
		for (const e of part) lines.push(`\t${e.a},${e.b},${e.yards},`);
		lines.push('} } end)())');
	}
	return `${lines.join('\n')}\n`;
}

// --- build ------------------------------------------------------------------

// crossingsFile: the optional local crossings file (default data/local/crossings.json
// next to dataDir); absent -> no Polestar_Travel output.
async function buildTravel({
	dataDir = path.join(ROOT, 'data', 'forever'),
	recordingsDir = path.join(ROOT, 'data', 'recordings'),
	sourcesDir = path.join(ROOT, 'data', 'sources'),
	crossingsFile = path.join(dataDir, '..', 'local', 'crossings.json'),
	build,
	foreverBuild,
	offline = false,
	fetchImpl,
	log = () => {},
} = {}) {
	const mapFrames = readJson(path.join(dataDir, 'map-frames.json'));
	const frames = new Frames(mapFrames.era, readJson(path.join(dataDir, 'zones.json')));
	const npcs = readJson(path.join(dataDir, 'npcs.json'));
	const objects = readJson(path.join(dataDir, 'objects.json'));
	const recordings = readRecordings(recordingsDir);
	// Live ("l") map frames: what recordings measured, else the Forever client's
	// (map-frames.json `forever`).
	const liveFrames = liveFramesOf(recordings);
	for (const [id, b] of Object.entries(mapFrames.forever || {})) if (!liveFrames.has(Number(id))) liveFrames.set(Number(id), b);
	const src = await loadTravelTables({ sourcesDir, build, offline, fetchImpl, log });
	let forever = null;
	let foreverError = null;
	try {
		forever = await loadTravelTables({ sourcesDir, build: foreverBuild, offline, fetchImpl, log, product: 'forever' });
	} catch (err) {
		foreverError = err.message;
	}

	const taxi = buildTaxi({ tables: src.tables, frames, npcs, liveFrames });
	const tr = buildTransports({
		tables: src.tables,
		foreverTables: forever && forever.tables,
		foreverBuild: forever && forever.build,
		foreverError,
		frames,
		npcs,
		objects,
		liveFrames,
	});
	const inns = buildInns({ frames, npcs, liveFrames });
	const paths = buildPaths({ recordings, frames });
	const recorded = recordedCrossings(paths.zoneSteps, frames);
	const local = readCrossingsFile(crossingsFile, frames);
	const warnings = [...src.warnings, ...(forever ? forever.warnings : []), ...taxi.warnings, ...tr.warnings, ...inns.warnings, ...paths.warnings];

	const sources = [{ name: 'Blizzard Classic Era client tables (wago.tools)', build: src.build, tables: Object.keys(src.urls), urls: src.urls }];
	if (forever) sources.push({ name: 'WoW Forever client tables (wago.tools)', build: forever.build, tables: Object.keys(forever.urls), urls: forever.urls, use: 'ship loops Forever added' });
	sources.push(
		{ name: 'data/forever npcs.json / objects.json (pfQuest, MIT)', use: 'flight masters, dock NPCs/objects, innkeepers' },
		{ name: 'data/forever map-frames.json', use: 'Era map frames; Forever (live) frames for maps Forever added or redrew' },
		{ name: 'data/recordings', use: 'learned walking paths and recorded zone crossings', sessions: paths.sessions },
	);
	const result = {
		schema: 1,
		build: src.build,
		foreverBuild: forever ? forever.build : null,
		sources,
		counts: {
			taxiNodes: taxi.nodes.length,
			flights: taxi.legs.length,
			transports: tr.transports.length,
			inns: inns.inns.length,
			pathNodes: paths.nodes.length,
			pathEdges: paths.edges.length,
			recordedCrossings: recorded.length,
		},
		taxi: { nodes: taxi.nodes, legs: taxi.legs },
		transports: tr.transports,
		inns: inns.inns,
		paths: { nodes: paths.nodes, edges: paths.edges, sessions: paths.sessions },
		crossings: { recorded },
		warnings,
	};
	const lua = emitLua({ ...result, frames });
	const localCounts = local && crossingCounts(local);
	return { travel: result, lua, warnings, travelAddon: local ? emitTravelAddon(local, frames) : null, localCounts };
}

// travelAddonDir: where Polestar_Travel goes (written only when the build read a local crossings file).
function writeTravel({ travel, lua, travelAddon }, { jsonOut, luaOut, travelAddonDir }) {
	fs.mkdirSync(path.dirname(jsonOut), { recursive: true });
	fs.writeFileSync(jsonOut, `${JSON.stringify(travel, null, '\t')}\n`);
	fs.mkdirSync(path.dirname(luaOut), { recursive: true });
	fs.writeFileSync(luaOut, lua);
	if (travelAddon && travelAddonDir) {
		fs.mkdirSync(travelAddonDir, { recursive: true });
		for (const [name, text] of Object.entries(travelAddon)) fs.writeFileSync(path.join(travelAddonDir, name), text);
	}
}

module.exports = { buildTravel, writeTravel, emitLua, ROOT, TRAVEL_ADDON };
