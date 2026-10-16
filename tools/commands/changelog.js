'use strict';
// changelog: the changelog fragments in changes/ (tools/lib/release/changelog.js).
// `add` writes one, `check` validates them, `show` prints what the next
// release gathers, and `build` writes it into CHANGELOG.md and deletes them.

const fs = require('node:fs');
const path = require('node:path');
const { parseArgs, resolvePath, plural } = require('../lib/cli');
const { ROOT } = require('../lib/paths');
const cl = require('../lib/release/changelog');

const usage = `usage: node tools/polestar.js changelog <add|check|show|build> [options]

Each change's changelog entry is its own file, changes/<slug>.md: front
matter naming its section, then the entry as CHANGELOG.md writes it, a
markdown list item wrapped at 78 columns (changes/README.md).

  add <players|authors|contributors>
                   write a fragment for that section ("For players", "For
                   guide authors", "For contributors"). The entry is
                   --text or stdin; plain text becomes one list item,
                   wrapped. The file is named --name, else the entry's first
                   words; an existing file is never overwritten.
  check            every fragment has a known section and an entry starting
                   "- ", and CHANGELOG.md has no ## Unreleased section;
                   names each fault, exit 1
  show             print the entries the next release gathers, as a
                   ## Unreleased section; writes nothing
  build <version>  add ## <version> (<date>) to CHANGELOG.md above the newest
                   release, with each section that has entries, in order, and
                   the entries by file name; then delete the fragments.
                   Refuses when CHANGELOG.md has that version already, when
                   there are no fragments or when one is faulty

options:
  --root <dir>     the checkout to work on (default the repository)
  --name <slug>    add: the fragment's file name, without .md
  --text <entry>   add: the entry (default stdin)
  --date <date>    build: the release date, YYYY-MM-DD (default today, UTC)`;

const SEMVER = /^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/;
const DATE = /^\d{4}-\d{2}-\d{2}$/;

function usageError(message) {
	console.error(`${message}\n\n${usage}`);
	return 2;
}

// Each faulty fragment's line, and CHANGELOG.md's when it has ## Unreleased.
function faults(root, fragments) {
	const out = fragments.filter((f) => f.error).map((f) => `${f.name}: ${f.error}`);
	const file = path.join(root, 'CHANGELOG.md');
	if (fs.existsSync(file) && cl.hasUnreleased(fs.readFileSync(file, 'utf8'))) {
		out.push(`CHANGELOG.md: has a ## Unreleased section; its entries go in ${cl.DIR}/ as fragments`);
	}
	return out;
}

function runAdd(root, opts, args) {
	if (args.length !== 1) return usageError('add takes one section');
	const section = args[0];
	if (!cl.SECTION_KEYS.includes(section)) return usageError(`unknown section "${section}" (use ${cl.SECTION_KEYS.join(', ')})`);
	let text = opts.text;
	if (text === undefined) {
		if (process.stdin.isTTY) return usageError('add needs the entry: --text, or on stdin');
		text = fs.readFileSync(0, 'utf8');
	}
	if (!text.trim()) return usageError('the entry is empty');
	const body = cl.toEntry(text);
	const content = cl.formatFragment(section, body);
	const parsed = cl.parseFragment(content);
	if (parsed.error) {
		console.error(`the entry: ${parsed.error}`);
		return 1;
	}
	const base = cl.slugify(opts.name ?? body);
	if (!base) return usageError(opts.name !== undefined ? `--name "${opts.name}" has no letters or digits` : 'the entry has no letters or digits to name it by');
	const dir = path.join(root, cl.DIR);
	fs.mkdirSync(dir, { recursive: true });
	let slug = base;
	if (opts.name !== undefined) {
		if (fs.existsSync(path.join(dir, `${slug}.md`))) {
			console.error(`${cl.DIR}/${slug}.md exists already`);
			return 1;
		}
	} else {
		for (let n = 2; fs.existsSync(path.join(dir, `${slug}.md`)); n++) slug = `${base}-${n}`;
	}
	fs.writeFileSync(path.join(dir, `${slug}.md`), content, { flag: 'wx' });
	console.log(`${cl.DIR}/${slug}.md`);
	return 0;
}

function runCheck(root) {
	const fragments = cl.readFragments(root);
	const bad = faults(root, fragments);
	for (const line of bad) console.error(line);
	if (bad.length) return 1;
	console.log(`${plural(fragments.length, 'fragment')}, all valid`);
	return 0;
}

function runShow(root) {
	const fragments = cl.readFragments(root);
	const bad = fragments.filter((f) => f.error);
	for (const f of bad) console.error(`${f.name}: ${f.error}`);
	const good = fragments.filter((f) => !f.error);
	if (good.length) process.stdout.write(`## Unreleased\n\n${cl.assemble(good)}`);
	else console.error(`no fragments in ${cl.DIR}/`);
	return bad.length ? 1 : 0;
}

function runBuild(root, opts, args) {
	if (args.length !== 1) return usageError('build takes one version');
	const version = args[0];
	if (!SEMVER.test(version)) return usageError(`"${version}" is not a version (x.y.z or x.y.z-pre)`);
	const date = opts.date ?? new Date().toISOString().slice(0, 10);
	if (!DATE.test(date) || Number.isNaN(Date.parse(`${date}T00:00:00Z`))) return usageError(`"${date}" is not a date (YYYY-MM-DD)`);
	const file = path.join(root, 'CHANGELOG.md');
	if (!fs.existsSync(file)) {
		console.error(`${file}: not found`);
		return 1;
	}
	const changelog = fs.readFileSync(file, 'utf8');
	const fragments = cl.readFragments(root);
	const bad = faults(root, fragments);
	if (bad.length) {
		for (const line of bad) console.error(line);
		return 1;
	}
	if (cl.hasVersion(changelog, version)) {
		console.error(`CHANGELOG.md has a ## ${version} section already`);
		return 1;
	}
	if (!fragments.length) {
		console.error(`no fragments in ${cl.DIR}/: nothing to release`);
		return 1;
	}
	fs.writeFileSync(file, cl.insertRelease(changelog, version, date, fragments));
	for (const f of fragments) fs.rmSync(f.file);
	const n = fragments.length;
	console.log(`CHANGELOG.md: ## ${version} (${date}), ${n} ${n === 1 ? 'entry' : 'entries'}; fragments deleted`);
	return 0;
}

async function run(argv) {
	const { opts, positional, error } = parseArgs(argv, { flags: [], options: ['--root', '--name', '--text', '--date'] });
	if (opts.help) {
		console.log(usage);
		return 0;
	}
	const [sub, ...rest] = positional;
	if (error) return usageError(error);
	if (!sub) return usageError('changelog needs a subcommand');
	const root = resolvePath(opts.root, '.', ROOT);
	const only = { add: ['name', 'text'], build: ['date'] };
	for (const key of ['name', 'text', 'date']) {
		if (opts[key] !== undefined && !(only[sub] || []).includes(key)) return usageError(`--${key} is not an option of ${sub}`);
	}
	if (sub === 'add') return runAdd(root, opts, rest);
	if (sub === 'check' || sub === 'show') {
		if (rest.length) return usageError(`${sub} takes no arguments`);
		return sub === 'check' ? runCheck(root) : runShow(root);
	}
	if (sub === 'build') return runBuild(root, opts, rest);
	return usageError(`unknown changelog subcommand "${sub}"`);
}

module.exports = { name: 'changelog', summary: 'Changelog fragments in changes/: add, check, show, and build into CHANGELOG.md', usage, run };
