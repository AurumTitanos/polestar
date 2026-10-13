'use strict';
// compile: a guide pack's .guide files (with its pack.json) -> its addon
// folder: ours (guides/) -> addon/Polestar_Guides, another pack -> <pack>/dist/<folder>.

const path = require('node:path');
const { resolvePath, printDiagnostics, plural } = require('../lib/dsl/cli');
const { ROOT, writePackDir } = require('../lib/dsl/project');
const { packCommand, buildPack } = require('../lib/pack/build');

const usage = `usage: node tools/polestar.js compile [<dir>] [options]

Compiles a guide pack's .guide files (docs/GUIDE_FORMAT.md) into its addon
folder, as its pack.json describes it: the generated TOC, Pack.lua,
MapFrames.lua, Guides.lua and LICENSE-DATA.txt, plus the pack's LICENSE file
as LICENSE.txt when it has one. The pack is the one in <dir> (or
--pack), else the nearest folder holding a pack.json (this one or a parent),
else our guides/. Another pack is checked with our guides as context and
written to <pack>/dist/<folder>/; ours to addon/Polestar_Guides/. Nothing is
written when there are errors.

options:
  <dir>, --pack <dir>   the pack folder (holding pack.json)
  --guides <dir>        our pack's guide sources in another folder (default guides/)
  --data <dir>          reference data (default data/forever/)
  --context <dir>       our guides, read as context for another pack (default guides/)
  --context-data <dir>  reference data for the context (default data/forever/)
  --out <dir>           pack folder (default addon/<folder>/ for ours,
                        <pack>/dist/<folder>/ for another pack)
  --include-drafts      also compile the pack's drafts/**
  --format <f>          diagnostics as text (default), json (one document on
                        stdout, no summary) or github (workflow annotations)
  --quiet               print errors only`;

async function run(argv) {
	const cmd = packCommand(argv, { name: 'compile', usage, flags: ['--include-drafts', '--quiet'], options: ['--pack', '--guides', '--data', '--context', '--context-data', '--out', '--format'] });
	if (cmd.exit !== undefined) return cmd.exit;
	const { opts, pack, out } = cmd;
	const summary = out.format !== 'json';
	const { manifest } = pack;
	const outDir = opts.out ? path.resolve(opts.out) : pack.official ? path.join(ROOT, 'addon', manifest.folder) : path.join(pack.dir, 'dist', manifest.folder);
	const { guides, diag, sources, files } = buildPack(pack, { dataDir: resolvePath(opts.data, 'data/forever', ROOT), includeDrafts: !!opts.includeDrafts });
	// Write before reporting: a failed write is one more error, so the JSON
	// document's `ok` matches the exit code.
	if (!diag.hasErrors()) {
		try {
			writePackDir(outDir, files);
		} catch (e) {
			diag.error(outDir, 0, e.message);
		}
	}
	printDiagnostics(diag, out);
	if (diag.hasErrors()) {
		if (summary) console.error(`compile failed: ${plural(diag.errors.length, 'error')}, ${plural(diag.warnings.length, 'warning')}`);
		return 1;
	}
	const steps = guides.reduce((n, g) => n + g.steps.length, 0);
	if (summary) {
		console.log(
			`compiled ${plural(guides.length, 'guide')} (${plural(steps, 'step')}) from ${plural(sources.length, 'file')} into ${outDir}; ${plural(diag.warnings.length, 'warning')}`,
		);
	}
	return 0;
}

module.exports = { name: 'compile', summary: 'Compile a guide pack into its addon folder', usage, run };
