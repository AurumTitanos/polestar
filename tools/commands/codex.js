'use strict';
// node tools/polestar.js codex build|parity [options]

const path = require('node:path');
const { parseArgs } = require('node:util');

const usage = `usage: node tools/polestar.js codex build [options]
       node tools/polestar.js codex parity [--ours <dir>] [--against <dir>]

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
  --out <dir>        JSON output (default data/forever/codex; with
                     --local-extras data/local/codex-extras)
  --pack <dir>       pack output (default addon/Polestar_Codex; with
                     --local-extras data/local/codex-extras/Polestar_Codex)
  --local-extras     also merge the installed AtlasLoot (GPL-2.0), RareScanner
                     (All Rights Reserved) and data/forever/dungeons.json
                     (DungeonJournal, no licence). For this machine only: the
                     pack's meta says local and \`pack\` refuses to ship it.

A release build compares itself with the last --local-extras build (when
data/local/codex-extras exists), entity by entity, writes
data/local/codex-parity.json and .md and records the match per kind in its
meta (\`parity\`). \`codex parity\` reruns that comparison on two built
folders (default ours data/forever/codex, against data/local/codex-extras).

  --ours <dir>       parity: the release build (default data/forever/codex)
  --against <dir>    parity: the internal build (default data/local/codex-extras)`;

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
	const { ROOT } = require('../lib/paths');
	// A --local-extras build never lands where `pack` and `install` look.
	if (values['local-extras']) {
		values.out = values.out || path.join(ROOT, 'data', 'local', 'codex-extras');
		values.pack = values.pack || path.join(ROOT, 'data', 'local', 'codex-extras', 'Polestar_Codex');
	}
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
	if (res.parity) printParity(res.parity.report, res.parity.files);
	return 0;
}

function printParity(report, files) {
	const rel = (p) => path.relative(process.cwd(), p) || p;
	for (const [name, c] of Object.entries(report.kinds)) {
		console.log(`${name.padEnd(22)} ${String(c.match).padStart(6)} / ${String(c.total).padEnd(6)} ${(c.share * 100).toFixed(1).padStart(5)}%${c.missingCount ? `  missing ${c.missingCount}` : ''}`);
	}
	console.log(`needs recording: ${report.needsRecording.length}`);
	if (files) console.log(`wrote ${files.map(rel).join(' and ')}`);
}

async function runParity(rest) {
	let values;
	try {
		({ values } = parseArgs({ args: rest, options: { ours: { type: 'string' }, against: { type: 'string' } }, strict: true }));
	} catch (err) {
		return fail(err.message);
	}
	const { ROOT } = require('../lib/paths');
	const { readCodex } = require('../lib/codex/parity');
	const { writeParity } = require('../lib/codex/build');
	const ours = path.resolve(values.ours || path.join(ROOT, 'data', 'forever', 'codex'));
	const against = path.resolve(values.against || path.join(ROOT, 'data', 'local', 'codex-extras'));
	const fs = require('node:fs');
	for (const d of [ours, against]) if (!fs.existsSync(path.join(d, 'meta.json'))) return fail(`no Codex build in ${d}`);
	const { report, files } = writeParity(readCodex(ours), readCodex(against), path.join(ROOT, 'data', 'local'));
	printParity(report, files);
	return 0;
}

async function run(argv) {
	const [sub, ...rest] = argv;
	if (sub === 'build') return runBuild(rest);
	if (sub === 'parity') return runParity(rest);
	return fail(sub ? `unknown subcommand "${sub}"` : 'missing subcommand');
}

module.exports = { name: 'codex', summary: "Build Lookup's Codex (data/forever/codex + the Polestar_Codex pack)", usage, run };
