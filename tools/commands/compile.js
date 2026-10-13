'use strict';
// compile: guides/**/*.guide -> addon/Polestar_Guides.

const { parseArgs, resolvePath, printDiagnostics, plural } = require('../lib/dsl/cli');
const { ROOT, packageVersion, compileProject, buildPackFiles, writePackDir, packMeta } = require('../lib/dsl/project');

const usage = `usage: node tools/polestar.js compile [options]

Compiles guides/**/*.guide (docs/GUIDE_FORMAT.md) into the guide pack:
Guides/*.lua, Pack.lua, MapFrames.lua, Pack.xml and LICENSE-DATA.txt.
Nothing is written when there are errors.

options:
  --guides <dir>      guide sources (default guides/)
  --data <dir>        reference data (default data/forever/)
  --out <dir>         pack folder (default addon/Polestar_Guides/)
  --include-drafts    also compile guides/drafts/**
  --quiet             print errors only`;

async function run(argv) {
	const { opts, error } = parseArgs(argv, { flags: ['--include-drafts', '--quiet'], options: ['--guides', '--data', '--out'] });
	if (opts.help) {
		console.log(usage);
		return 0;
	}
	if (error) {
		console.error(`${error}\n\n${usage}`);
		return 2;
	}
	const guidesDir = resolvePath(opts.guides, 'guides', ROOT);
	const dataDir = resolvePath(opts.data, 'data/forever', ROOT);
	const outDir = resolvePath(opts.out, 'addon/Polestar_Guides', ROOT);
	const { guides, diag, data, files } = compileProject({ guidesDir, dataDir, includeDrafts: !!opts.includeDrafts });
	printDiagnostics(diag, { quiet: !!opts.quiet });
	if (diag.hasErrors()) {
		console.error(`compile failed: ${plural(diag.errors.length, 'error')}, ${plural(diag.warnings.length, 'warning')}`);
		return 1;
	}
	try {
		writePackDir(outDir, buildPackFiles({ guides, meta: packMeta(packageVersion()), data }));
	} catch (e) {
		console.error(`compile failed: ${e.message}`);
		return 1;
	}
	const steps = guides.reduce((n, g) => n + g.steps.length, 0);
	console.log(
		`compiled ${plural(guides.length, 'guide')} (${plural(steps, 'step')}) from ${plural(files.length, 'file')} into ${outDir}; ${plural(diag.warnings.length, 'warning')}`,
	);
	return 0;
}

module.exports = { name: 'compile', summary: 'Compile .guide files into the Polestar_Guides addon', usage, run };
