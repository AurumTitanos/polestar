'use strict';
// The one build path for every command that lints or builds a guide pack
// (compile, lint, play, dev, install, pack): which pack (a folder argument
// or `--pack`, else the nearest pack.json, else our guides), compiled with
// our guides as context when it is another pack, and where its folder may go.

const fs = require('node:fs');
const path = require('node:path');
const { Diagnostics } = require('../dsl/diag');
const { parseArgs, printDiagnostics, formatError, plural } = require('../dsl/cli');
const { ROOT, compileProject, buildPackFiles } = require('../dsl/project');
const { commandPack, packArgument } = require('./locate');
const { FOLDER_RE, LICENSE_PLACEHOLDER } = require('./format');

// The options every pack-building command takes (parseArgs `options`).
const PACK_OPTIONS = ['--pack', '--data', '--context', '--context-data'];

const PACK_USAGE = `  <dir>, --pack <dir>   the pack folder, holding pack.json (default: the nearest pack.json)
  --data <dir>          reference data (default data/forever/)
  --context <dir>       our guides, read as context (default guides/)
  --context-data <dir>  reference data for the context (default data/forever/)`;

// The other pack a command works on: the folder argument (`positional`) or
// `--pack`, else the nearest pack.json. -> null when that is our own guides
// (the command's usual mode), else commandPack's result ({ dir, manifest,
// diags, contextDir, contextDataDir }), or { error } for a usage error (two
// pack folders, one without pack.json, a --context folder that does not
// exist): callers print it with their usage and exit 2.
function otherPack(opts, positional = [], cwd = process.cwd()) {
	const arg = packArgument(opts, positional, cwd);
	if (arg.error) return { error: arg.error };
	const pack = commandPack({ pack: arg.pack, context: opts.context, contextData: opts.contextData }, cwd);
	return pack.official ? null : pack;
}

// compile and lint: parse argv (`spec`: parseArgs flags/options, --format
// checked) and find the pack (packArgument, commandPack). -> { exit } when
// the command is done (help 0, usage error 2, invalid pack.json 1: its
// diagnostics printed), else { opts, pack, out } with out = printDiagnostics' options.
function packCommand(argv, { name, usage, flags, options }) {
	const { opts, positional, error } = parseArgs(argv, { flags, options });
	if (opts.help) {
		console.log(usage);
		return { exit: 0 };
	}
	const arg = error ? {} : packArgument(opts, positional);
	const usageError = error || arg.error || formatError(opts.format);
	const pack = usageError ? null : commandPack({ ...opts, pack: arg.pack });
	if (!pack || pack.error) {
		console.error(`${usageError || pack.error}\n\n${usage}`);
		return { exit: 2 };
	}
	const out = { quiet: !!opts.quiet, format: opts.format || 'text' };
	if (!pack.manifest) {
		printDiagnostics(pack.diags, out);
		if (out.format !== 'json') console.error(`${name} failed: ${plural(pack.diags.filter((d) => d.severity === 'error').length, 'error')} in pack.json`);
		return { exit: 1 };
	}
	return { opts, pack, out };
}

// The pack's LICENSE file (its text, or null without one), with a warning in
// diag while it still holds the placeholder line `new` writes.
function readLicense(pack, diag) {
	const file = path.join(pack.dir, 'LICENSE');
	let text;
	try {
		text = fs.readFileSync(file, 'utf8');
	} catch {
		return null;
	}
	const at = text.split(/\r?\n/).findIndex((l) => l.includes(LICENSE_PLACEHOLDER));
	if (at >= 0) {
		const shown = path.relative(process.cwd(), file);
		diag.warn(
			shown.startsWith('..') ? file : shown.split(path.sep).join('/'),
			at + 1,
			'LICENSE still holds the placeholder line `polestar new` writes, not the licence text',
			`replace the line with the full text of the ${pack.manifest.license} licence: the built addon ships LICENSE as LICENSE.txt`,
		);
	}
	return text;
}

// Lint and build a pack (commandPack's result) in memory. `cache` ({ data,
// contextData, diags }) skips reloading the reference data on a rebuild;
// `diags` are the warnings loading it gave (project.js loadProjectData),
// reported with every build. `files: false` only lints. The pack folder's
// LICENSE, when it has one, goes into the addon folder as LICENSE.txt.
// -> { ok, diag, manifest, guides, sources, data, files }: files (folder name
// -> content) only when there are no errors.
function buildPack(pack, { dataDir = path.join(ROOT, 'data', 'forever'), cache = null, includeDrafts = false, files = true } = {}) {
	if (!pack.manifest) {
		const diag = new Diagnostics();
		diag.list.push(...pack.diags);
		return { ok: false, diag, manifest: null, guides: [], sources: [], data: null, files: null };
	}
	const r = compileProject({
		packDir: pack.dir,
		manifest: pack.manifest,
		dataDir,
		includeDrafts,
		data: cache && cache.data,
		contextDir: pack.contextDir,
		contextData: cache && cache.contextData,
		contextDataDir: pack.contextDataDir,
	});
	r.diag.list.push(...pack.diags, ...((cache && cache.diags) || []));
	const license = readLicense(pack, r.diag);
	const ok = !r.diag.hasErrors();
	return {
		ok,
		diag: r.diag,
		manifest: pack.manifest,
		guides: r.guides,
		sources: r.sources,
		data: r.data,
		files: ok && files ? buildPackFiles({ guides: r.guides, manifest: pack.manifest, data: r.data, license }) : null,
	};
}

// <parent>/<folder>, refusing a folder that is not a plain name: a manifest's
// `folder` never reaches a path that leaves `parent` (manifest.js validates
// it; this is the last guard before anything is written).
function folderIn(parent, folder) {
	if (typeof folder !== 'string' || !FOLDER_RE.test(folder)) throw new Error(`refusing the pack folder ${JSON.stringify(folder)}: not a plain folder name`);
	return path.join(parent, folder);
}

module.exports = { PACK_OPTIONS, PACK_USAGE, otherPack, packCommand, buildPack, folderIn };
