'use strict';
// node tools/polestar.js maps build | overlays

const fs = require('node:fs');
const path = require('node:path');
const { parseArgs } = require('node:util');
const { buildZoneLevels } = require('../lib/maps/zonelevels');
const { ROOT, DATA, SOURCES } = require('../lib/paths');
const overlays = require('../lib/maps/overlays');

const usage = `usage: node tools/polestar.js maps <build|overlays> [options]

build: zone level ranges for the world map (hostile creature levels per zone,
spawn-weighted P10..P90; heuristic in tools/lib/maps/zonelevels.js) ->
addon/Polestar/Maps/ZoneLevels.lua.

  --data <dir>    data/forever (npcs.json, zones.json)
  --lua <file>    output (default: addon/Polestar/Maps/ZoneLevels.lua)

overlays: every world map overlay of every zone map (the explored-area
paintings), from the client's DB2 tables via wago.tools, so the zone art shows
a map without fog of war -> addon/Polestar/UI/ZoneArtOverlays.lua.

  --build <ver>     client build (default: ${overlays.BUILD}, the Forever client)
  --sources <dir>   source cache folder (default: data/sources)
  --offline         use cached tables only
  --lua <file>      output (default: addon/Polestar/UI/ZoneArtOverlays.lua)`;

function build(rest) {
	const { values } = parseArgs({
		args: rest,
		options: { data: { type: 'string' }, lua: { type: 'string' } },
	});
	const dataDir = path.resolve(values.data || DATA);
	const out = path.resolve(values.lua || path.join(ROOT, 'addon', 'Polestar', 'Maps', 'ZoneLevels.lua'));
	const { levels, lua } = buildZoneLevels({ dataDir });
	fs.writeFileSync(out, lua);
	console.log(`maps: ${Object.keys(levels).length} zone level ranges`);
	console.log(`wrote ${path.relative(process.cwd(), out)}`);
	return 0;
}

async function buildOverlays(rest) {
	const { values } = parseArgs({
		args: rest,
		options: { build: { type: 'string' }, sources: { type: 'string' }, offline: { type: 'boolean' }, lua: { type: 'string' } },
	});
	const build = values.build || overlays.BUILD;
	const sourcesDir = path.resolve(values.sources || SOURCES);
	const out = path.resolve(values.lua || path.join(ROOT, 'addon', 'Polestar', 'UI', 'ZoneArtOverlays.lua'));
	const tables = await overlays.loadTables({ sourcesDir, build, offline: values.offline, log: (m) => console.log(m) });
	const result = overlays.buildOverlays(tables);
	for (const w of result.warnings) console.warn(`warning: ${w}`);
	const lua = overlays.emitLua(result, build);
	fs.writeFileSync(out, lua);
	console.log(`maps: ${result.count} overlays (${result.tiles} tiles) on ${Object.keys(result.arts).length} map arts, build ${build}`);
	console.log(`wrote ${path.relative(process.cwd(), out)} (${Buffer.byteLength(lua)} bytes)`);
	return 0;
}

module.exports = {
	name: 'maps',
	summary: 'Build world map data (zone level ranges, zone art overlays)',
	usage,
	async run(argv) {
		const [sub, ...rest] = argv;
		try {
			if (sub === 'build') return build(rest);
			if (sub === 'overlays') return await buildOverlays(rest);
		} catch (err) {
			console.error(err.message);
			return 1;
		}
		console.error(sub ? `unknown subcommand "${sub}"\n\n${usage}` : usage);
		return 2;
	},
};
