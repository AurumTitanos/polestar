'use strict';
// node tools/polestar.js codex build [options]

const path = require('node:path');
const { parseArgs } = require('node:util');

const usage = `usage: node tools/polestar.js codex build [options]

Builds Lookup's Codex: every item, mount, pet, recipe, NPC, rare, quest,
zone, dungeon and treasure, with where each item comes from, and the
Dungeons journal. Release-safe inputs only: the data/forever/*.json tables
(pfQuest, QuestieDB facts, recordings, corrections), the Forever client's
tables (wago.tools build 1.60.1.70338, cached under data/sources/wago/),
the installed ForeverLevelingBiS (MIT) and Polestar's own guides. Writes
data/forever/codex/*.json and the load-on-demand pack addon/Polestar_Codex
with its LICENSE-DATA.txt; \`pack\` ships that folder in the release zip.

  --addons <dir>     the Forever client's Interface/AddOns (default: detected)
  --offline          use cached client tables only
  --out <dir>        JSON output (default data/forever/codex)
  --pack <dir>       pack output (default addon/Polestar_Codex)
  --local-extras     also merge the installed AtlasLoot (GPL-2.0), RareScanner
                     (All Rights Reserved) and data/forever/dungeons.json
                     (DungeonJournal, no licence). For this machine only: the
                     pack's meta says local and \`pack\` refuses to ship it.`;

function fail(msg) {
	console.error(`${msg}\n\n${usage}`);
	return 2;
}

function kb(n) {
	return `${(n / 1024).toFixed(0)} KiB`;
}

async function runBuild(rest) {
	let values;
	try {
		({ values } = parseArgs({
			args: rest,
			options: { addons: { type: 'string' }, offline: { type: 'boolean' }, out: { type: 'string' }, pack: { type: 'string' }, 'local-extras': { type: 'boolean' } },
			strict: true,
		}));
	} catch (err) {
		return fail(err.message);
	}
	const { buildCodex } = require('../lib/codex/build');
	const abs = (p) => (p ? path.resolve(p) : undefined);
	const res = await buildCodex({
		addons: abs(values.addons),
		offline: values.offline,
		outDir: abs(values.out),
		packDir: abs(values.pack),
		localExtras: !!values['local-extras'],
		log: (m) => console.error(m),
	});
	for (const w of res.warnings) console.error(`warning: ${w}`);
	const { meta } = res.codex;
	const rel = (p) => path.relative(process.cwd(), p) || p;
	console.log(`wrote ${rel(res.outDir)} and ${rel(res.packDir)} (client build ${meta.build}) in ${(res.ms / 1000).toFixed(1)} s`);
	console.log(`counts: ${Object.entries(meta.counts).map(([k, n]) => `${n} ${k}`).join(', ')}`);
	const c = meta.coverage;
	console.log(`coverage: ${c.withSource} of ${c.items} items have a source (${(c.share * 100).toFixed(1)}%)`);
	const mem = meta.pack.memoryKB === null ? 'not measured' : `${meta.pack.memoryKB.toFixed(0)} KiB loaded in ${meta.pack.loadMs.toFixed(0)} ms (lua5.1), ${meta.pack.memoryKBDecoded.toFixed(0)} KiB with every record decoded`;
	console.log(`pack: ${meta.pack.files} files, ${kb(meta.pack.bytes)}; memory ${mem}`);
	if (meta.localExtras) console.log('local build (--local-extras): not for release; `pack` refuses it');
	console.log(`sources: ${meta.sources.map((s) => `${s.name}${s.version ? ` ${s.version}` : ''}`).join('; ')}`);
	return 0;
}

async function run(argv) {
	const [sub, ...rest] = argv;
	if (sub === 'build') return runBuild(rest);
	return fail(sub ? `unknown subcommand "${sub}"` : 'missing subcommand');
}

module.exports = { name: 'codex', summary: "Build Lookup's Codex (data/forever/codex + the Polestar_Codex pack)", usage, run };
