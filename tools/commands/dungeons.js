'use strict';
// node tools/polestar.js dungeons build

const fs = require('node:fs');
const path = require('node:path');
const { parseArgs } = require('node:util');
const { findDungeonJournal, readToc, loadDungeonJournal, buildDungeons } = require('../lib/data/dungeonjournal');
const { loadData } = require('../lib/dsl/data');

const ROOT = path.join(__dirname, '..', '..');

const usage = `usage: node tools/polestar.js dungeons build [options]

Reads the installed DungeonJournal addon (ForeverDungeonJournal) and writes
data/forever/dungeons.json: dungeons with levels, entrance and bosses, quests
with chains, XP, money, rewards, shareability and where they start and end
(docs/ARCHITECTURE.md). The Dungeons section of the hub reads it through the
Codex (\`codex build\`). DungeonJournal publishes no licence: the output is
gitignored and stays local.

  --source <dir>   the ForeverDungeonJournal folder (default: WOW_FOREVER_ADDONS,
                   else the Forever clients \`install\` detects)
  --data <dir>     reference data (default data/forever)
  --json           print the report as JSON`;

function pct(n, d) {
	return d ? `${Math.round((n / d) * 100)}%` : '-';
}

async function build(rest) {
	const { values } = parseArgs({
		args: rest,
		options: { source: { type: 'string' }, data: { type: 'string' }, json: { type: 'boolean' } },
	});
	const dir = findDungeonJournal({ source: values.source });
	if (!dir) {
		console.error(`dungeons: ForeverDungeonJournal not found${values.source ? ` at ${values.source}` : ''}; pass --source <dir>`);
		return 1;
	}
	const dataDir = path.resolve(values.data || path.join(ROOT, 'data', 'forever'));
	const toc = readToc(dir);
	const raw = loadDungeonJournal(dir);
	const { dataset, report } = buildDungeons(raw, loadData(dataDir), { toc });
	fs.mkdirSync(dataDir, { recursive: true });
	fs.writeFileSync(path.join(dataDir, 'dungeons.json'), `${JSON.stringify(dataset, null, '\t')}\n`);

	const total = Object.values(report.coverage).reduce((a, b) => a + b, 0);
	if (values.json) {
		console.log(JSON.stringify({ dungeons: dataset.dungeons.length, coverage: report.coverage, unresolved: report.unresolved }, null, 2));
		return 0;
	}
	const rel = (p) => path.relative(process.cwd(), p) || '.';
	console.log(`dungeons: ${dataset.dungeons.length} dungeons from ${toc.title || 'DungeonJournal'} ${toc.version || ''} (${rel(dir)})`);
	console.log(`dungeons: quest positions ${Object.entries(report.coverage).map(([k, n]) => `${k} ${n} (${pct(n, total)})`).join(', ')}`);
	for (const u of report.unresolved) console.log(`warning: ${u.dungeon}: quest ${u.quest} has no ${u.which} position`);
	console.log(`wrote ${rel(path.join(dataDir, 'dungeons.json'))}`);
	return 0;
}

async function run(argv) {
	const [sub, ...rest] = argv;
	if (sub === 'build') return build(rest);
	console.log(usage);
	return sub ? 1 : 0;
}

module.exports = { name: 'dungeons', summary: 'Import DungeonJournal: dungeon data (data/forever/dungeons.json)', usage, run };
