'use strict';
// node tools/polestar.js codex build|parity|wowhead [options]

const path = require('node:path');
const { parseArgs } = require('node:util');

const usage = `usage: node tools/polestar.js codex build [options]
       node tools/polestar.js codex parity [--ours <dir>] [--against <dir>]
       node tools/polestar.js codex wowhead [--delay <ms>] [--limit <n>]

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

\`codex wowhead\` fetches from Wowhead's Forever database the pages of what
data/local/codex-parity.json lists as missing or different, and of our
instances' bosses (NPC and object pages, item tooltips), one request at a
time, and caches their facts under data/sources/wowhead/codex/ (a release
\`codex build\` reads that cache; tools/lib/codex/wowhead.js).

  --ours <dir>       parity: the release build (default data/forever/codex)
  --against <dir>    parity: the internal build (default data/local/codex-extras)
  --delay <ms>       wowhead: pause between requests (default 1500)
  --limit <n>        wowhead: fetch at most n pages this run`;

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
	const { SOURCES } = require('../lib/paths');
	const { loadWowhead } = require('../lib/codex/wowhead');
	const { parseCsv } = require('../lib/data/csv');
	const { BUILD } = require('../lib/codex/build');
	const mapCsv = path.join(SOURCES, 'wago', BUILD, 'Map.csv');
	const norm = (x) => String(x || '').toLowerCase().replace(/^the\s+/, '').replace(/[^a-z0-9]/g, '');
	const clientInstances = new Set(fs.existsSync(mapCsv) ? parseCsv(fs.readFileSync(mapCsv, 'utf8')).filter((r) => r.InstanceType === '1' || r.InstanceType === '2').map((r) => norm(r.MapName_lang)) : []);
	const oursCodex = { ...readCodex(ours), evidence: null };
	const { report, files } = writeParity(oursCodex, readCodex(against), path.join(ROOT, 'data', 'local'), { wowhead: loadWowhead(SOURCES), clientInstances });
	printParity(report, files);
	return 0;
}

async function runWowhead(rest) {
	let values;
	try {
		({ values } = parseArgs({ args: rest, options: { delay: { type: 'string' }, limit: { type: 'string' } }, strict: true }));
	} catch (err) {
		return fail(err.message);
	}
	const fs = require('node:fs');
	const { ROOT, SOURCES } = require('../lib/paths');
	const { fetchEntities, wowheadWants } = require('../lib/codex/wowhead');
	const read = (f) => (fs.existsSync(f) ? JSON.parse(fs.readFileSync(f, 'utf8')) : null);
	const report = read(path.join(ROOT, 'data', 'local', 'codex-parity.json'));
	if (!report) return fail('no data/local/codex-parity.json: run `codex build --local-extras`, then `codex build`');
	const want = wowheadWants(report, read(path.join(ROOT, 'data', 'forever', 'codex', 'instances.json')) || {});
	let left = values.limit ? Number(values.limit) : Infinity;
	for (const t of Object.keys(want)) {
		want[t] = want[t].slice(0, Math.max(0, left));
		left -= want[t].length;
	}
	const res = await fetchEntities({ sourcesDir: SOURCES, want, delayMs: values.delay ? Number(values.delay) : undefined, log: (m) => console.error(m) });
	console.log(`wowhead: ${res.fetched} fetched, ${res.cached} cached, ${res.missing} not on Wowhead, ${res.failed.length} failed`);
	for (const f of res.failed.slice(0, 20)) console.error(`  ${f.type}=${f.id}: ${f.error}`);
	return res.failed.length ? 1 : 0;
}

async function run(argv) {
	const [sub, ...rest] = argv;
	if (sub === 'build') return runBuild(rest);
	if (sub === 'parity') return runParity(rest);
	if (sub === 'wowhead') return runWowhead(rest);
	return fail(sub ? `unknown subcommand "${sub}"` : 'missing subcommand');
}

module.exports = { name: 'codex', summary: "Build Lookup's Codex (data/forever/codex + the Polestar_Codex pack)", usage, run };
