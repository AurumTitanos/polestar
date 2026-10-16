'use strict';
// What a patch release may carry: the paths a hotfix/ branch may change from
// the release it patches. Everything else (the addon, the tools, the data
// addons) belongs on `next` and in a feature release (docs/RELEASING.md,
// "Patch releases").

const { spawnSync } = require('node:child_process');

const PATCH_ALLOWED = Object.freeze([
	'guides/**',
	'addon/Polestar_Guides/**',
	'tests/guides-*.test.js',
	'tools/lib/data/corrections.json',
	'CHANGELOG.md',
	'changes/**',
]);

// A glob as a regular expression: `**` crosses folders, `*` does not.
function globRegExp(glob) {
	let re = '';
	for (let i = 0; i < glob.length; i++) {
		const c = glob[i];
		if (c === '*' && glob[i + 1] === '*') {
			re += '.*';
			i++;
		} else if (c === '*') re += '[^/]*';
		else re += c.replace(/[.+?^${}()|[\]\\]/g, '\\$&');
	}
	return new RegExp(`^${re}$`);
}

const MATCHERS = PATCH_ALLOWED.map(globRegExp);

function allowed(file) {
	return MATCHERS.some((re) => re.test(file));
}

// The paths a patch may not carry, in input order, each once.
function disallowed(paths) {
	return [...new Set(paths.filter((p) => !allowed(p)))];
}

// Paths from a list: one per line, blank lines skipped. A `git diff
// --name-status` line (`M\tpath`, `R100\told\tnew`) gives each path it names.
function parsePaths(text) {
	const out = [];
	for (const raw of text.split(/\r?\n/)) {
		const line = raw.trim();
		if (!line) continue;
		const fields = line.split('\t');
		if (fields.length > 1 && /^[A-Z][0-9]*$/.test(fields[0])) out.push(...fields.slice(1));
		else out.push(line);
	}
	return out;
}

function git(root, args) {
	const r = spawnSync('git', ['-C', root, ...args], { encoding: 'utf8', maxBuffer: 256 * 1024 * 1024 });
	if (r.error) throw new Error(`git: ${r.error.message}`);
	if (r.status !== 0) throw new Error(`git ${args.join(' ')}: ${(r.stderr || '').trim()}`);
	return r.stdout;
}

// The newest plain vX.Y.Z tag reachable from HEAD in root, in version order;
// prerelease tags (v0.3.0-rc.1) are never a patch's base.
function latestTag(root) {
	const tags = git(root, ['tag', '--merged', 'HEAD', '--list', 'v*'])
		.split('\n')
		.map((t) => t.trim())
		.filter((t) => /^v\d+\.\d+\.\d+$/.test(t))
		.map((t) => ({ t, n: t.slice(1).split('.').map(Number) }))
		.sort((a, b) => a.n[0] - b.n[0] || a.n[1] - b.n[1] || a.n[2] - b.n[2]);
	if (!tags.length) throw new Error(`no vX.Y.Z tag reachable from HEAD in ${root}`);
	return tags[tags.length - 1].t;
}

// The paths HEAD changed since base; a rename gives both its paths.
function changedSince(root, base) {
	return parsePaths(git(root, ['diff', '--name-only', '--no-renames', `${base}...HEAD`]));
}

module.exports = { PATCH_ALLOWED, allowed, disallowed, parsePaths, git, latestTag, changedSince };
