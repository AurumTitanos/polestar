'use strict';
// node tools/polestar.js travel build | route

const fs = require('node:fs');
const path = require('node:path');
const { parseArgs } = require('node:util');
const { buildTravel, writeTravel, TRAVEL_ADDON } = require('../lib/travel/build');
const { ROOT, DATA, SOURCES } = require('../lib/paths');
const { planRoute } = require('../lib/travel/route');

const usage = `usage: node tools/polestar.js travel build [options]
       node tools/polestar.js travel route --from <map,x,y> --to <map,x,y> [options]

build: the flight network (Blizzard Classic Era TaxiNodes/TaxiPath/TaxiPathNode
via wago.tools), boats/zeppelins/tram (plus the ships WoW Forever added, from
the Forever client's TaxiPathNode), inns, learned walking paths and zone
crossings learned from recordings -> data/forever/travel.json and
addon/Polestar/Nav/TravelData.lua. With the optional local crossings file
(data/local/crossings.json, validated) it also writes the local data addon
addon/Polestar_Travel (installed when built, never packaged).

  --offline            use cached wago.tools tables only
  --build <version>    Classic Era build (default: newest listed)
  --forever-build <v>  WoW Forever build (default: newest 1.60+ listed)
  --data <dir>         data/forever (map-frames, zones, npcs, objects)
  --recordings <dir>   data/recordings
  --sources <dir>      data/sources (wago cache)
  --crossings <file>   the local crossings file (default: <data>/../local/crossings.json)
  --travel-addon <dir> Polestar_Travel output (default: addon/Polestar_Travel)
  --json <file>        travel.json output (default: <data>/travel.json)
  --lua <file>         TravelData.lua output (default: addon/Polestar/Nav/TravelData.lua)

route: run the addon's own planner (Nav/Travel.lua + TravelData.lua, plus
Polestar_Travel when built) under Lua 5.1 between two Era-frame map points
and print the legs.

  --from <map,x,y>     start (uiMapID, map percent)
  --to <map,x,y>       target
  --faction <name>     Alliance | Horde (default Alliance)
  --known <ids|names>  flight master node ids or names; repeatable, or separated by ";" or ","
                       ("Sentinel Hill, Westfall" matches the full node name first)
  --speed <yd/s>       run speed (default 7)
  --hearth <location>  bind location, Hearthstone ready
  --data <dir>         data/forever (map-frames, zones, travel.json)
  --lua <file>         TravelData.lua (default: addon/Polestar/Nav/TravelData.lua)
  --crossings-lua <f>  Polestar_Travel's Crossings.lua (default: addon/Polestar_Travel/Crossings.lua when built; "none" to skip)
  --json               print the legs as JSON`;

async function build(rest) {
	const { values } = parseArgs({
		args: rest,
		options: {
			offline: { type: 'boolean' },
			build: { type: 'string' },
			'forever-build': { type: 'string' },
			data: { type: 'string' },
			recordings: { type: 'string' },
			sources: { type: 'string' },
			crossings: { type: 'string' },
			'travel-addon': { type: 'string' },
			json: { type: 'string' },
			lua: { type: 'string' },
		},
	});
	const dataDir = path.resolve(values.data || DATA);
	const result = await buildTravel({
		dataDir,
		recordingsDir: path.resolve(values.recordings || path.join(ROOT, 'data', 'recordings')),
		sourcesDir: path.resolve(values.sources || SOURCES),
		...(values.crossings ? { crossingsFile: path.resolve(values.crossings) } : {}),
		build: values.build,
		foreverBuild: values['forever-build'],
		offline: values.offline,
		log: (m) => console.log(m),
	});
	const jsonOut = path.resolve(values.json || path.join(dataDir, 'travel.json'));
	const luaOut = path.resolve(values.lua || path.join(ROOT, 'addon', 'Polestar', 'Nav', 'TravelData.lua'));
	const travelAddonDir = path.resolve(values['travel-addon'] || path.join(ROOT, 'addon', TRAVEL_ADDON));
	writeTravel(result, { jsonOut, luaOut, travelAddonDir });
	const c = result.travel.counts;
	console.log(`travel: build ${result.travel.build}: ${c.taxiNodes} flight masters, ${c.flights} flights, ${c.transports} transports, ${c.inns} inns, ${c.pathNodes} learned path nodes / ${c.pathEdges} edges, ${c.recordedCrossings} recorded crossings`);
	for (const w of result.warnings) console.log(`warning: ${w}`);
	console.log(`wrote ${path.relative(process.cwd(), jsonOut)}`);
	console.log(`wrote ${path.relative(process.cwd(), luaOut)}`);
	if (result.travelAddon) {
		const names = { 0: 'Eastern Kingdoms', 1: 'Kalimdor' };
		for (const [cont, n] of Object.entries(result.localCounts)) {
			console.log(`local crossings, ${names[cont] || `continent ${cont}`}: ${n.crossings} crossings, ${n.open} open-ground pairs, ${n.chains} approach chains (${n.chainNodes} nodes)`);
		}
		const bytes = Object.values(result.travelAddon).reduce((s, t) => s + Buffer.byteLength(t), 0);
		console.log(`wrote ${path.relative(process.cwd(), travelAddonDir)} (${Object.keys(result.travelAddon).length} files, ${bytes} bytes; local use only, never packaged)`);
	} else if (fs.existsSync(path.join(travelAddonDir, `${TRAVEL_ADDON}.toc`))) {
		console.log(`note: no local crossings file; ${path.relative(process.cwd(), travelAddonDir)} left as it was`);
	}
	return 0;
}

function parsePoint(s, flag) {
	const parts = String(s || '').split(/[,\s]+/).map(Number);
	if (parts.length !== 3 || parts.some((n) => !Number.isFinite(n))) throw new Error(`${flag} expects map,x,y`);
	return { map: parts[0], x: parts[1], y: parts[2] };
}

function route(rest) {
	const { values } = parseArgs({
		args: rest,
		options: {
			from: { type: 'string' },
			to: { type: 'string' },
			faction: { type: 'string' },
			known: { type: 'string', multiple: true },
			speed: { type: 'string' },
			hearth: { type: 'string' },
			data: { type: 'string' },
			lua: { type: 'string' },
			'crossings-lua': { type: 'string' },
			json: { type: 'boolean' },
		},
	});
	// Polestar_Travel joins by default when built, unless a TravelData.lua was named.
	let crossingsLua = values['crossings-lua'];
	if (crossingsLua === undefined && !values.lua) {
		const built = path.join(ROOT, 'addon', TRAVEL_ADDON, 'Crossings.lua');
		if (fs.existsSync(built)) crossingsLua = built;
	}
	const legs = planRoute({
		from: parsePoint(values.from, '--from'),
		to: parsePoint(values.to, '--to'),
		faction: values.faction || 'Alliance',
		known: (values.known || []).flatMap((v) => v.split(';')).map((s) => s.trim()).filter(Boolean),
		speed: values.speed ? Number(values.speed) : undefined,
		hearth: values.hearth,
		...(values.data ? { dataDir: path.resolve(values.data) } : {}),
		...(values.lua ? { travelLua: path.resolve(values.lua) } : {}),
		...(crossingsLua && crossingsLua !== 'none' ? { crossingsLua: path.resolve(crossingsLua) } : {}),
	});
	if (values.json) {
		console.log(JSON.stringify(legs, null, 2));
		return legs ? 0 : 1;
	}
	if (!legs) {
		console.log('no route');
		return 1;
	}
	let total = 0;
	legs.forEach((leg, i) => {
		total += leg.seconds;
		const where = (p) => (p.map && p.x != null ? `${p.name || ''} (${p.map} ${p.x},${p.y})`.trim() : `${p.map ? `${p.map} ` : ''}(${Math.round(p.wx)}, ${Math.round(p.wy)})`);
		console.log(`${i + 1}. [${leg.kind}] ${leg.label}  ${Math.floor(leg.seconds / 60)}:${String(leg.seconds % 60).padStart(2, '0')}  ${where(leg.from)} -> ${where(leg.to)}`);
	});
	console.log(`total ${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`);
	return 0;
}

module.exports = {
	name: 'travel',
	summary: 'Build the travel network (flights, boats, inns, learned paths) and test routes',
	usage,
	async run(argv) {
		const [sub, ...rest] = argv;
		try {
			if (sub === 'build') return await build(rest);
			if (sub === 'route') return route(rest);
		} catch (err) {
			console.error(err.message);
			return 1;
		}
		console.error(sub ? `unknown subcommand "${sub}"\n\n${usage}` : usage);
		return 2;
	},
};
