'use strict';
// talents build|check: addon/Polestar/Talents/Builds.lua from the talent
// plans in talents/forever/ and the Forever client's trait tables (see
// tools/lib/talents/build.js).

const fs = require('node:fs');
const path = require('node:path');
const { parseArgs, resolvePath } = require('../lib/cli');
const { ROOT, SOURCES } = require('../lib/paths');
const { loadTables } = require('../lib/professions/tables');
const { header, reportSync } = require('../lib/generated');
const { TABLES, PREREQ_RULE, buildTalents } = require('../lib/talents/build');

// The Forever client build the trees were read from. Raise it, rebuild, and
// review the diff when the client's talents change.
const BUILD = '1.60.1.70374';

const usage = `usage: node tools/polestar.js talents build|check [options]

Resolves the talent plans in talents/forever/*.json (one pick per level, by
talent name) against the Forever client's trait tables (wago.tools, build
${BUILD}, cached under data/sources/wago/), replays every pick under the
client's rules (one point a level from 10, tier gates, arrows; arrows need
their source at ${PREREQ_RULE === 'full' ? 'full rank' : 'one rank'}), and writes addon/Polestar/Talents/Builds.lua.
check rebuilds in memory and fails if the file differs or a plan breaks a rule.

options:
  --plans <dir>    plan sources (default talents/forever/)
  --out <dir>      output folder (default addon/Polestar/Talents/)
  --sources <dir>  download cache (default data/sources/)
  --build <ver>    client build (default ${BUILD})
  --offline        use cached tables only`;

async function run(argv) {
	const { opts, positional, error } = parseArgs(argv, { flags: ['--offline'], options: ['--plans', '--out', '--sources', '--build'] });
	if (opts.help) {
		console.log(usage);
		return 0;
	}
	const mode = positional[0];
	if (error || positional.length !== 1 || !['build', 'check'].includes(mode)) {
		console.error(`${error || 'expected `talents build` or `talents check`'}\n\n${usage}`);
		return 2;
	}
	const plansDir = resolvePath(opts.plans, 'talents/forever', ROOT);
	const outDir = resolvePath(opts.out, 'addon/Polestar/Talents', ROOT);
	const files = fs.readdirSync(plansDir).filter((f) => f.endsWith('.json')).sort();
	if (files.length !== 1) {
		console.error(`expected one plan file in ${plansDir} (Builds.lua holds one class for now), found ${files.length}`);
		return 1;
	}
	const source = JSON.parse(fs.readFileSync(path.join(plansDir, files[0]), 'utf8'));
	const build = opts.build || BUILD;
	const { tables, warnings } = await loadTables({ sourcesDir: opts.sources ? path.resolve(opts.sources) : SOURCES, build, offline: !!opts.offline, tables: TABLES, log: (m) => console.log(m) });
	for (const w of warnings) console.warn(`warning: ${w}`);
	const result = buildTalents(source, tables, {
		header: header('lua', 'talents build', `talents/forever/${files[0]} and the Forever ${build} trait tables (wago.tools)`),
	});
	for (const e of result.errors) console.error(`error: ${e}`);
	if (result.errors.length) return 1;
	const picks = result.builds.reduce((s, b) => s + b.picks.length, 0);
	console.log(`${source.class}: tree ${result.facts.treeID}, ${Object.keys(result.facts.nodes).length} talents, ${result.builds.length} plans, ${picks} picks replayed`);
	return reportSync({ 'Builds.lua': result.lua }, outDir, { check: mode === 'check', command: 'talents build' });
}

module.exports = { name: 'talents', summary: 'Build or check Talents/Builds.lua (talent plans)', usage, run };
