'use strict';
// node tools/polestar.js codex build|parity|wowhead|attune [options]

const path = require('node:path');
const { parseArgs } = require('node:util');

const usage = `usage: node tools/polestar.js codex build [options]
       node tools/polestar.js codex parity [--ours <dir>] [--against <dir>]
       node tools/polestar.js codex wowhead [--delay <ms>] [--limit <n>] [--max-age <days>] [--dry-run]
       node tools/polestar.js codex attune [--addons <dir>] [--ours <dir>]

Builds Lookup's Codex: every item, mount, pet, recipe, NPC, rare, quest,
zone, dungeon and treasure, with where each item comes from, and the
Dungeons journal. Release-safe inputs only: the data/forever/*.json tables
(pfQuest, QuestieDB facts, recordings, corrections), the Forever client's
tables (the newest 1.60+ build wago.tools lists, cached under
data/sources/wago/; meta.json records it), the installed ForeverLevelingBiS
(MIT) and Polestar's own guides. Writes data/forever/codex/*.json and the
load-on-demand pack addon/Polestar_Codex with its LICENSE-DATA.txt; \`pack\`
ships that folder in the release zip.

  --addons <dir>     the Forever client's Interface/AddOns (default: detected)
  --build <version>  wago.tools Forever build (default: newest listed)
  --offline          use cached client tables only (the newest cached build
                     holding every table the Codex reads)
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

\`codex wowhead\` reads Wowhead's Forever list pages first (NPCs, objects,
items by id range, up to 1,000 rows a request: level, classification, boss,
location and how Forever changed each), then the pages of what
data/local/codex-parity.json lists as missing or different, and of our
instances' bosses (NPC and object pages, item tooltips), one request at a
time. A page is fetched again only when its list row changed, an older
parser read it, or it is older than --max-age and an open parity gap (not
settled: no reason, not "not in Forever") or Forever's own (new or updated:
one Forever left as in Classic keeps its page). Both are cached under
data/sources/wowhead/codex/ (a release \`codex build\` reads that cache;
tools/lib/codex/wowhead.js).

\`codex attune\` compares the built Dungeons journal (--ours, default
data/forever/codex) with the installed Attune addon (no licence: read on
this machine only, never in a build): each dungeon's quests per side and
every journal quest's rewards, written to data/local/dungeon-quests-audit.md
(and .json).

  --ours <dir>       parity: the release build (default data/forever/codex)
  --against <dir>    parity: the internal build (default data/local/codex-extras)
  --delay <ms>       wowhead: pause between requests (default 1500)
  --limit <n>        wowhead: fetch at most n pages this run (lists first)
  --max-age <days>   wowhead: refetch lists and pages older than this (default 7)
  --dry-run          wowhead: count the requests a run would make, fetch nothing`;

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
			options: { addons: { type: 'string' }, build: { type: 'string' }, offline: { type: 'boolean' }, out: { type: 'string' }, pack: { type: 'string' }, 'local-extras': { type: 'boolean' } },
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
		build: values.build,
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

// The client tables directory of the build a Codex folder was built from
// (its meta.json), else of the newest cached Forever build.
async function clientDir(codexDir) {
	const fs = require('node:fs');
	const { SOURCES } = require('../lib/paths');
	const meta = path.join(codexDir, 'meta.json');
	let build = fs.existsSync(meta) ? JSON.parse(fs.readFileSync(meta, 'utf8')).build : null;
	if (!build) build = await require('../lib/codex/build').pickForeverBuild({ offline: true }).then((p) => p.build, () => null);
	return build ? path.join(SOURCES, 'wago', build) : null;
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
	const wago = await clientDir(ours);
	const csv = (table) => {
		const f = wago && path.join(wago, `${table}.csv`);
		return f && fs.existsSync(f) ? parseCsv(fs.readFileSync(f, 'utf8')) : null;
	};
	const mapRows = csv('Map');
	const areaRows = csv('AreaTable');
	const norm = (x) => String(x || '').toLowerCase().replace(/^the\s+/, '').replace(/[^a-z0-9]/g, '');
	const clientInstances = new Set((mapRows || []).filter((r) => r.InstanceType === '1' || r.InstanceType === '2').map((r) => norm(r.MapName_lang)));
	// The AreaTable areas on instance maps (Wowhead's `location` inside one).
	const instanceAreas = mapRows && areaRows ? new Set(require('../lib/codex/journal').instanceMapsOf(mapRows, areaRows).flatMap((m) => m.inner)) : null;
	const oursCodex = { ...readCodex(ours), evidence: null };
	const { report, files } = writeParity(oursCodex, readCodex(against), path.join(ROOT, 'data', 'local'), { wowhead: loadWowhead(SOURCES), clientInstances, instanceAreas });
	printParity(report, files);
	return 0;
}

async function runWowhead(rest) {
	let values;
	try {
		({ values } = parseArgs({ args: rest, options: { delay: { type: 'string' }, limit: { type: 'string' }, 'max-age': { type: 'string' }, 'dry-run': { type: 'boolean' } }, strict: true }));
	} catch (err) {
		return fail(err.message);
	}
	const fs = require('node:fs');
	const { ROOT, SOURCES } = require('../lib/paths');
	const { fetchEntities, fetchLists, politeClient, wowheadWants, openGaps, MAX_AGE_DAYS } = require('../lib/codex/wowhead');
	const read = (f) => (fs.existsSync(f) ? JSON.parse(fs.readFileSync(f, 'utf8')) : null);
	const report = read(path.join(ROOT, 'data', 'local', 'codex-parity.json'));
	if (!report) return fail('no data/local/codex-parity.json: run `codex build --local-extras`, then `codex build`');
	// The client's create-item spells (SpellEffect), for the items ours has no source for.
	const { clientFacts } = require('../lib/codex/build');
	const { parseCsv } = require('../lib/data/csv');
	const wago = await clientDir(path.join(ROOT, 'data', 'forever', 'codex'));
	const effects = wago && path.join(wago, 'SpellEffect.csv');
	const { creates } = clientFacts({ SpellEffect: effects && fs.existsSync(effects) ? parseCsv(fs.readFileSync(effects, 'utf8')) : [] });
	const ours = { items: read(path.join(ROOT, 'data', 'forever', 'codex', 'items.json')) || {}, creates };
	const want = wowheadWants(report, read(path.join(ROOT, 'data', 'forever', 'codex', 'instances.json')) || {}, read(path.join(ROOT, 'data', 'forever', 'objects.json')) || {}, ours);
	// The parity report's open gaps (no instance bosses, name matches or
	// settled rows): a stale page of one is fetched again.
	const gaps = wowheadWants(openGaps(report));
	const maxAgeDays = values['max-age'] ? Number(values['max-age']) : MAX_AGE_DAYS;
	if (!(maxAgeDays >= 0)) return fail(`--max-age: not a number of days: ${values['max-age']}`);
	const dryRun = !!values['dry-run'];
	const log = (m) => console.error(m);
	const client = politeClient({ delayMs: values.delay ? Number(values.delay) : undefined, log });
	const lists = await fetchLists({ sourcesDir: SOURCES, client, maxAgeDays, dryRun, log });
	for (const f of lists.failed.slice(0, 20)) console.error(`  list ${f.url}: ${f.error}`);
	const res = await fetchEntities({ sourcesDir: SOURCES, want, lists: lists.rows, gaps, client, maxAgeDays, dryRun, limit: values.limit ? Number(values.limit) : Infinity, log });
	const listed = Object.entries(lists.rows).map(([t, rows]) => `${t} ${rows ? Object.keys(rows).length : 'incomplete'}`).join(', ');
	const why = Object.entries(res.reasons).map(([k, n]) => `${n} ${k}`).join(', ');
	if (dryRun) {
		console.log(`wowhead (dry run): ${lists.planned} list ranges and ${res.queued} pages to fetch (${why}), ${res.cached} pages kept; list rows: ${listed}`);
		return 0;
	}
	console.log(`wowhead: ${lists.requests} list requests (rows: ${listed}); ${res.requests} page requests: ${res.fetched} fetched, ${res.missing} not on Wowhead, ${res.failed.length} failed (${why}); ${res.cached} kept`);
	for (const f of res.failed.slice(0, 20)) console.error(`  ${f.type}=${f.id}: ${f.error}`);
	return res.failed.length || lists.failed.length ? 1 : 0;
}

async function runAttune(rest) {
	let values;
	try {
		({ values } = parseArgs({ args: rest, options: { addons: { type: 'string' }, ours: { type: 'string' } }, strict: true }));
	} catch (err) {
		return fail(err.message);
	}
	const fs = require('node:fs');
	const { ROOT } = require('../lib/paths');
	const { readAttune } = require('../lib/consume/attune');
	const { resolveAddonsDir } = require('../lib/addons');
	const { auditDungeonQuests } = require('../lib/codex/questaudit');
	const ours = path.resolve(values.ours || path.join(ROOT, 'data', 'forever', 'codex'));
	const read = (f) => JSON.parse(fs.readFileSync(f, 'utf8'));
	if (!fs.existsSync(path.join(ours, 'journal.json'))) return fail(`no Codex build in ${ours}`);
	const attune = readAttune(values.addons ? path.resolve(values.addons) : resolveAddonsDir());
	if (!attune.attunes.length) return fail(`Attune not read: ${attune.meta.warnings.join('; ')}`);
	const journal = read(path.join(ours, 'journal.json'));
	const quests = read(path.join(ours, 'quests.json'));
	const forever = read(path.join(ROOT, 'data', 'forever', 'quests.json'));
	const meta = fs.existsSync(path.join(ours, 'meta.json')) ? read(path.join(ours, 'meta.json')) : {};
	const out = path.join(ROOT, 'data', 'local');
	fs.mkdirSync(out, { recursive: true });
	const audit = auditDungeonQuests({ journal, attune, quests, forever, build: meta.build || null });
	fs.writeFileSync(path.join(out, 'dungeon-quests-audit.md'), audit.markdown);
	fs.writeFileSync(path.join(out, 'dungeon-quests-audit.json'), `${JSON.stringify({ rows: audit.rows, rewards: audit.rewards }, null, '\t')}\n`);
	const files = ['data/local/dungeon-quests-audit.md', 'data/local/dungeon-quests-audit.json'];
	const attuneOnly = audit.rows.reduce((n, r) => n + r.attuneOnly.length, 0);
	console.log(`Attune ${attune.meta.version}: ${audit.rows.length} dungeon groups, ${attuneOnly} quests only Attune lists; rewards ${audit.rewards.match} / ${audit.rewards.checked} match`);
	console.log(`wrote ${files.join(', ')}`);
	return 0;
}

async function run(argv) {
	const [sub, ...rest] = argv;
	if (sub === 'build') return runBuild(rest);
	if (sub === 'parity') return runParity(rest);
	if (sub === 'wowhead') return runWowhead(rest);
	if (sub === 'attune') return runAttune(rest);
	return fail(sub ? `unknown subcommand "${sub}"` : 'missing subcommand');
}

module.exports = { name: 'codex', summary: "Build Lookup's Codex (data/forever/codex + the Polestar_Codex pack)", usage, run };
