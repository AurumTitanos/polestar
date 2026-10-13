'use strict';
// node tools/polestar.js itemdb build [options]

const path = require('node:path');
const { parseArgs } = require('node:util');

// The data addon is loaded on demand into every player's client: keep it small.
const SIZE_BUDGET = 1024 * 1024;

const usage = `usage: node tools/polestar.js itemdb build [options]

Writes the load-on-demand data addon addon/Polestar_ItemDB (Items.lua + TOC):
stats of every equippable Classic Era item (item level, required level,
inventory type, armor, weapon damage and speed, primary stats and the equip
bonuses Polestar.Gear scores), from Blizzard client tables (wago.tools CSV:
ItemSparse, Item, ItemEffect, SpellEffect). Size budget: ${SIZE_BUDGET / 1024} KiB.

  --offline            use cached tables only
  --build <version>    wago.tools Classic Era build (default: newest listed)
  --sources <dir>      source cache (default data/sources)
  --out <dir>          default addon/Polestar_ItemDB`;

function fail(msg) {
	console.error(`${msg}\n\n${usage}`);
	return 2;
}

async function runBuild(rest) {
	let values;
	try {
		({ values } = parseArgs({
			args: rest,
			options: { offline: { type: 'boolean' }, build: { type: 'string' }, sources: { type: 'string' }, out: { type: 'string' } },
			strict: true,
		}));
	} catch (err) {
		return fail(err.message);
	}
	const { buildItemDb } = require('../lib/itemdb/build');
	const abs = (p) => (p ? path.resolve(p) : undefined);
	const res = await buildItemDb({
		offline: values.offline,
		build: values.build,
		sourcesDir: abs(values.sources),
		outDir: abs(values.out),
		log: (m) => console.error(m),
	});
	for (const w of res.warnings) console.error(`warning: ${w}`);
	const skipped = Object.entries(res.skipped)
		.sort(([a], [b]) => a.localeCompare(b))
		.map(([k, n]) => `${n} ${k}`)
		.join(', ');
	const kib = (res.bytes / 1024).toFixed(0);
	console.log(`wrote ${path.relative(process.cwd(), res.outDir) || res.outDir} from Classic Era build ${res.build}: ${res.count} items, ${kib} KiB (budget ${SIZE_BUDGET / 1024} KiB)`);
	console.log(`left out: ${skipped}`);
	if (res.bytes > SIZE_BUDGET) {
		console.error(`error: Items.lua is ${kib} KiB, over the ${SIZE_BUDGET / 1024} KiB budget`);
		return 1;
	}
	return 0;
}

async function run(argv) {
	const [sub, ...rest] = argv;
	if (sub === 'build') return runBuild(rest);
	return fail(sub ? `unknown subcommand "${sub}"` : 'missing subcommand');
}

module.exports = { name: 'itemdb', summary: 'Build the Polestar_ItemDB data addon (item stats) from client tables', usage, run, SIZE_BUDGET };
