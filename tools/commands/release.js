'use strict';
// release: the maintainer's release tooling (docs/RELEASING.md). `scope`
// checks that a hotfix/ branch carries only what a patch may, `patch`
// prepares a patch release on a hotfix/ checkout, `notes` writes a version's
// release notes from CHANGELOG.md. They run from a `next` checkout and work
// on another with --root, since a hotfix/ branch is cut from a release that
// may not have them.

const fs = require('node:fs');
const path = require('node:path');
const { parseArgs } = require('../lib/cli');
const { ROOT } = require('../lib/paths');
const scope = require('../lib/release/scope');
const patch = require('../lib/release/patch');
const notes = require('../lib/release/notes');

const usage = `usage: node tools/polestar.js release <scope|patch|notes> [args]

release scope [--base <ref>] [--root <dir>] [--files <path|->]
  Prints each changed path a patch release may not carry, one a line, and
  exits 1 if there is one. A patch may change only:
    ${scope.PATCH_ALLOWED.join('\n    ')}
  The paths are read from --files (one a line, - for stdin; \`git diff
  --name-status\` lines work too), else from \`git diff --name-only
  <base>...HEAD\` in --root, renames giving both paths. --base defaults to
  the newest v* tag reachable from HEAD.

release patch <x.y.z> --root <dir> [--from <tag>] [--zip <file>] [--data <dir>] [--data-built]
  Prepares a patch release on the hotfix/ checkout at --root with that
  checkout's own tools: stops on paths the patch may not carry, or on a
  changed tools/lib/data/corrections.json (run \`data build\` there first,
  then --data-built); puts back Polestar_Codex and Polestar_QuestDB from the
  release zip of --from (default the newest v* tag in --root; downloaded
  with gh unless --zip names it); sets the version; lints and compiles; and
  lists the compiled guides that differ from --from, warning about those
  whose sources did not change.
    --data <dir>    reference data for lint and compile (default this
                    checkout's data/forever/, or --root's with --data-built)

release notes <x.y.z> [--root <dir>] [--out <dir>]
  Writes the version's CHANGELOG.md section as dist/notes-<v>.md (GitHub),
  dist/notes-curseforge-<v>.md and dist/notes-discord-<v>.txt. Each has a
  placeholder for the intro, marked ${notes.PLACEHOLDER}, to replace before
  publishing.
    --root <dir>    folder holding CHANGELOG.md (default the repository)
    --out <dir>     where to write (default <root>/dist/)`;

const SEMVER = /^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/;

function fail(message) {
	console.error(`${message}\n\n${usage}`);
	return 2;
}

function runScope(argv) {
	const { opts, positional, error } = parseArgs(argv, { flags: [], options: ['--base', '--root', '--files'] });
	if (error || positional.length) return fail(error || `unexpected argument ${positional[0]}`);
	const root = opts.root ? path.resolve(opts.root) : ROOT;
	let paths;
	try {
		if (opts.files) paths = scope.parsePaths(fs.readFileSync(opts.files === '-' ? 0 : opts.files, 'utf8'));
		else paths = scope.changedSince(root, opts.base || scope.latestTag(root));
	} catch (e) {
		console.error(e.message);
		return 2;
	}
	const bad = scope.disallowed(paths);
	for (const p of bad) console.log(p);
	return bad.length ? 1 : 0;
}

function runPatch(argv) {
	const { opts, positional, error } = parseArgs(argv, { flags: ['--data-built'], options: ['--root', '--from', '--zip', '--data'] });
	if (error || positional.length !== 1) return fail(error || 'one version');
	const version = positional[0];
	if (!SEMVER.test(version)) return fail(`"${version}" is not a version (x.y.z)`);
	if (!opts.root) return fail('--root names the hotfix/ checkout');
	const root = path.resolve(opts.root);
	if (!fs.existsSync(path.join(root, 'tools', 'polestar.js'))) {
		console.error(`${root} is not a Polestar checkout (no tools/polestar.js)`);
		return 1;
	}
	let tmp = null;
	try {
		const from = opts.from || scope.latestTag(root);
		const fromVersion = from.replace(/^v/, '');
		console.log(`patch ${version} on ${root}, from ${from}`);

		const changed = scope.changedSince(root, from);
		const bad = scope.disallowed(changed);
		if (bad.length) {
			console.error(`\n${bad.length} path(s) a patch may not carry; move them to next first:`);
			for (const p of bad) console.error(`  ${p}`);
			return 1;
		}
		console.log(`scope: ${changed.length} changed path(s), all a patch may carry`);

		if (changed.includes(patch.CORRECTIONS) && !opts.dataBuilt) {
			console.error(`\n${patch.CORRECTIONS} changed since ${from}: run \`node tools/polestar.js data build\` in ${root} first (and \`questdb build\` when a correction moves a giver or a spawn), then rerun with --data-built.`);
			return 1;
		}

		const data = opts.data ? path.resolve(opts.data) : path.join(opts.dataBuilt ? root : ROOT, 'data', 'forever');
		if (!fs.existsSync(data)) {
			console.error(`no reference data at ${data} (give --data)`);
			return 1;
		}
		for (const cmd of ['lint', 'compile']) {
			if (!patch.takesOption(root, cmd, '--data')) {
				console.error(`${root}'s \`${cmd}\` takes no --data; run steps 2 and 3 of docs/RELEASING.md "Patch releases" by hand`);
				return 1;
			}
		}

		let zip = opts.zip ? path.resolve(opts.zip) : null;
		if (!zip) {
			tmp = patch.downloadZip(root, from);
			zip = tmp.file;
		}
		const n = patch.restoreDataAddons(root, zip);
		console.log(`data addons: ${patch.DATA_ADDONS.join(' and ')} put back from ${path.basename(zip)} (${n} files)`);

		const lintArgs = ['lint', '--data', data];
		if (patch.takesOption(root, 'lint', '--quiet')) lintArgs.push('--quiet');
		const compileQuiet = patch.takesOption(root, 'compile', '--quiet');
		const compileArgs = ['compile', '--data', data, ...(compileQuiet ? ['--quiet'] : [])];
		for (const args of [['version', version], lintArgs, compileArgs]) {
			console.log(`\n$ node tools/polestar.js ${args.join(' ')}`);
			// A compile without --quiet is captured: its warnings bury the
			// summary, so only the rest is shown unless it fails.
			const capture = args[0] === 'compile' && !compileQuiet;
			const r = patch.rootTool(root, args, { capture });
			if (capture) {
				const all = `${r.stdout || ''}${r.stderr || ''}`;
				const shown = r.status === 0 ? patch.withoutWarnings(all) : all;
				if (shown.trim()) console.log(shown.trimEnd());
			}
			if (r.status !== 0) {
				console.error(`\n\`${args[0]}\` failed in ${root} (exit ${r.status})`);
				return 1;
			}
		}

		const before = scope.git(root, ['show', `${from}:${patch.GUIDES_LUA}`]);
		const after = fs.readFileSync(path.join(root, patch.GUIDES_LUA), 'utf8');
		const guides = patch.changedGuides(before, after);
		const sources = scope.parsePaths(scope.git(root, ['diff', '--name-only', '--no-renames', from, '--', 'guides']));
		const drift = patch.drifted(guides, sources);
		const driftSet = new Set(drift);
		console.log(`\ncompiled guides changed since ${from}: ${guides.length}`);
		for (const g of guides) console.log(`  ${g.change.padEnd(7)} ${g.source}${driftSet.has(g) ? '   <- source unchanged' : ''}`);
		if (drift.length) {
			console.error(`\nstop: ${drift.length} compiled guide(s) changed without their source: the reference data at ${data} differs from ${fromVersion}'s. Run \`node tools/polestar.js data build\` in ${root}, then this again with --data-built.`);
			return 1;
		}

		console.log(`\nprepared ${version}. Next, in ${root} (docs/RELEASING.md, steps 3 to 6):`);
		console.log('  node --test "tests/**/*.test.js"');
		console.log('  rm -rf dist && node tools/polestar.js pack && (cd dist && sha256sum -c SHA256SUMS)');
		console.log(`  the zip smoke test with dist/Polestar-${version}.zip, then the in-game gate: play the steps the fixes changed`);
		return 0;
	} catch (e) {
		console.error(e.message);
		return 1;
	} finally {
		if (tmp) fs.rmSync(tmp.dir, { recursive: true, force: true });
	}
}

function runNotes(argv) {
	const { opts, positional, error } = parseArgs(argv, { flags: [], options: ['--root', '--out'] });
	if (error || positional.length !== 1) return fail(error || 'one version');
	const version = positional[0];
	if (!SEMVER.test(version)) return fail(`"${version}" is not a version (x.y.z)`);
	const root = opts.root ? path.resolve(opts.root) : ROOT;
	const file = path.join(root, 'CHANGELOG.md');
	if (!fs.existsSync(file)) {
		console.error(`no ${file}`);
		return 1;
	}
	const rel = notes.releaseSection(fs.readFileSync(file, 'utf8'), version);
	if (!rel) {
		console.error(`CHANGELOG.md has no "## ${version} (<date>)" section`);
		return 1;
	}
	const out = opts.out ? path.resolve(opts.out) : path.join(root, 'dist');
	fs.mkdirSync(out, { recursive: true });
	const files = [
		[`notes-${version}.md`, notes.github(rel)],
		[`notes-curseforge-${version}.md`, notes.curseforge(rel)],
		[`notes-discord-${version}.txt`, notes.discord(rel)],
	];
	for (const [name, text] of files) {
		fs.writeFileSync(path.join(out, name), text);
		console.log(path.join(out, name));
	}
	console.log(`\nEach file holds a placeholder for the intro, marked ${notes.PLACEHOLDER}: replace it before publishing.`);
	return 0;
}

const SUBCOMMANDS = { scope: runScope, patch: runPatch, notes: runNotes };

async function run(argv) {
	if (!argv.length || argv[0] === '--help' || argv[0] === '-h') {
		console.log(usage);
		return argv.length ? 0 : 2;
	}
	const sub = SUBCOMMANDS[argv[0]];
	if (!sub) return fail(`unknown subcommand ${argv[0]}`);
	if (argv.includes('--help') || argv.includes('-h')) {
		console.log(usage);
		return 0;
	}
	return sub(argv.slice(1));
}

module.exports = { name: 'release', summary: 'Release tooling: patch scope check, patch preparation, release notes', usage, run };
