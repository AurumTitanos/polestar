'use strict';
// node tools/polestar.js questdb build

const path = require('node:path');
const { parseArgs } = require('node:util');
const { buildQuestDB, writeQuestDB, DEFAULTS } = require('../lib/questdb/build');
const { ROOT } = require('../lib/paths');

const usage = `usage: node tools/polestar.js questdb build [options]

Builds the load-on-demand quest database addon (addon/Polestar_QuestDB) from
data/forever: quests (levels, race/class masks, faction, givers, enders,
prerequisites, objectives), NPCs and objects (spawn clusters per map, covering
every known spawn; Era frames) and items (drop sources, objects, vendors).
Prints the Lua size and an estimate of the in-game memory it costs once
loaded.

  --data <dir>            data/forever (quests, npcs, objects, items, map-frames)
  --out <dir>             output addon folder (default: addon/Polestar_QuestDB)
  --radius <yd>           spawn cluster radius (default ${DEFAULTS.clusterRadius})
  --droppers <n>          NPC drop sources kept per item (default ${DEFAULTS.maxDroppers})
  --json                  print the stats as JSON`;

const mb = (n) => `${(n / 1048576).toFixed(2)} MB`;

async function build(rest) {
	const { values } = parseArgs({
		args: rest,
		options: {
			data: { type: 'string' },
			out: { type: 'string' },
			radius: { type: 'string' },
			droppers: { type: 'string' },
			json: { type: 'boolean' },
		},
	});
	const options = {};
	const num = (v, flag) => {
		const n = Number(v);
		if (!Number.isFinite(n) || n <= 0) throw new Error(`${flag} expects a positive number`);
		return n;
	};
	if (values.radius) options.clusterRadius = num(values.radius, '--radius');
	if (values.droppers) options.maxDroppers = num(values.droppers, '--droppers');
	const result = buildQuestDB({ dataDir: values.data ? path.resolve(values.data) : undefined, options });
	const outDir = path.resolve(values.out || path.join(ROOT, 'addon', 'Polestar_QuestDB'));
	writeQuestDB(result, outDir);
	const s = result.stats;
	if (values.json) {
		console.log(JSON.stringify({ ...s, warnings: result.warnings.length }, null, 2));
	} else {
		console.log(`questdb: ${s.quests} quests, ${s.npcs} NPCs, ${s.objects} objects, ${s.items} items, ${s.maps} map frames`);
		console.log(`questdb: ${s.spawnPoints} spawn points -> ${s.clusters} clusters`);
		console.log(`questdb: Lua ${mb(s.luaBytes)} (${s.luaBytes} bytes), estimated in-game memory ~${mb(s.memoryBytes)}`);
		for (const w of result.warnings.slice(0, 20)) console.log(`warning: ${w}`);
		if (result.warnings.length > 20) console.log(`warning: ... ${result.warnings.length - 20} more`);
		console.log(`wrote ${path.relative(process.cwd(), outDir) || '.'}`);
	}
	return 0;
}

module.exports = {
	name: 'questdb',
	summary: 'Build the load-on-demand quest database addon (markers, tooltips)',
	usage,
	async run(argv) {
		const [sub, ...rest] = argv;
		try {
			if (sub === 'build') return await build(rest);
		} catch (err) {
			console.error(err.message);
			return 1;
		}
		console.log(usage);
		return sub === undefined || sub === 'help' ? 0 : 1;
	},
};
