'use strict';
// lint: every compile check, no writes; plus the solo policy for leveling
// guides against the simulator's cached worlds (data/sim, when built).

const fs = require('node:fs');
const path = require('node:path');
const { parseArgs, resolvePath, printDiagnostics, plural } = require('../lib/dsl/cli');
const { ROOT, compileProject } = require('../lib/dsl/project');
const { validateSoloPolicy } = require('../lib/dsl/validate');
const { worldFile, dataHash } = require('../lib/sim/world');

const usage = `usage: node tools/polestar.js lint [options]

Runs every compile check (syntax, data lookups, cross-guide validation) on
guides/**/*.guide without writing anything. Exit code 1 on errors. When the
simulator has cached a world (\`sim\`), also warns on leveling goals its solo
filter excludes.

options:
  --guides <dir>      guide sources (default guides/)
  --data <dir>        reference data (default data/forever/)
  --sim <dir>         simulator cache with world-<faction>.json (default
                      data/sim/, used only with the default --data)
  --include-drafts    also check guides/drafts/**
  --quiet             print errors only`;

// Faction -> Map(quest id -> world.excluded entry) from the cached worlds in
// simDir; a faction without one is not checked, nor one whose cache was
// built from other data or by an older world builder (its exclusions may
// be wrong, e.g. friendly talk credit flagged elite before builder 16):
// -> { excluded, stale: [faction] }.
function soloExclusions(simDir, dataDir) {
	const excluded = {};
	const stale = [];
	if (!simDir) return { excluded, stale };
	const hash = dataHash(dataDir, path.join(ROOT, 'data', 'sources'));
	for (const faction of ['Alliance', 'Horde']) {
		const file = worldFile(simDir, faction);
		if (!fs.existsSync(file)) continue;
		const w = JSON.parse(fs.readFileSync(file, 'utf8'));
		if (w.dataHash !== hash) {
			stale.push(faction);
			continue;
		}
		if (Array.isArray(w.excluded)) excluded[faction] = new Map(w.excluded.map((e) => [e.id, e]));
	}
	return { excluded, stale };
}

async function run(argv) {
	const { opts, error } = parseArgs(argv, { flags: ['--include-drafts', '--quiet'], options: ['--guides', '--data', '--sim'] });
	if (opts.help) {
		console.log(usage);
		return 0;
	}
	if (error) {
		console.error(`${error}\n\n${usage}`);
		return 2;
	}
	const dataDir = resolvePath(opts.data, 'data/forever', ROOT);
	const { guides, diag, files } = compileProject({
		guidesDir: resolvePath(opts.guides, 'guides', ROOT),
		dataDir,
		includeDrafts: !!opts.includeDrafts,
	});
	// The default cache was built from the default data; other data needs its own --sim.
	const simDir = opts.sim || !opts.data ? resolvePath(opts.sim, 'data/sim', ROOT) : null;
	const { excluded, stale } = soloExclusions(simDir, dataDir);
	validateSoloPolicy(guides, excluded, diag);
	printDiagnostics(diag, { quiet: !!opts.quiet });
	if (stale.length) console.error(`note: solo-filter checks skipped for ${stale.join(' and ')}: the simulator's cached world is from other data or an older builder (\`node tools/polestar.js sim world\` rebuilds it)`);
	const summary = `${plural(files.length, 'file')}, ${plural(guides.length, 'guide')}: ${plural(diag.errors.length, 'error')}, ${plural(diag.warnings.length, 'warning')}`;
	if (diag.hasErrors()) {
		console.error(`lint failed: ${summary}`);
		return 1;
	}
	console.log(`lint ok: ${summary}`);
	return 0;
}

module.exports = { name: 'lint', summary: 'Check .guide files without writing output', usage, run, soloExclusions };
