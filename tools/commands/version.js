'use strict';
// version: the release version, kept in package.json and in the ## Version line
// of every addon TOC. With no argument it prints the version and any TOC that
// disagrees; with one it sets them all.

const fs = require('node:fs');
const path = require('node:path');
const { parseArgs, resolvePath } = require('../lib/dsl/cli');
const project = require('../lib/dsl/project');

const usage = `usage: node tools/polestar.js version [<x.y.z>] [options]

Without a version, prints package.json's version and any addon TOC whose
## Version differs (exit 1 if one does). With one, writes it to package.json
and to the ## Version line of every addon/<Name>/<Name>.toc present.
Data addons built later take the version from package.json.

options:
  --root <dir>     folder holding package.json (default the repository)
  --addons <dir>   addon folder (default <root>/addon/)`;

const SEMVER = /^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/;
const PACKAGE_VERSION = /^(\s*"version"\s*:\s*)"[^"]*"/m;
const TOC_VERSION = /^## Version:[^\S\r\n]*\S*/m;

function tocs(addonsDir) {
	if (!fs.existsSync(addonsDir)) return [];
	return fs
		.readdirSync(addonsDir, { withFileTypes: true })
		.filter((d) => d.isDirectory() && !d.name.startsWith('.'))
		.map((d) => path.join(addonsDir, d.name, `${d.name}.toc`))
		.filter((f) => fs.existsSync(f))
		.sort();
}

function tocVersion(text) {
	const m = /^## Version:[^\S\r\n]*(\S*)/m.exec(text);
	return m ? m[1] : null;
}

function show(pkgFile, addonsDir) {
	const version = JSON.parse(fs.readFileSync(pkgFile, 'utf8')).version;
	console.log(version);
	let mismatched = 0;
	for (const toc of tocs(addonsDir)) {
		const v = tocVersion(fs.readFileSync(toc, 'utf8'));
		if (v !== version) {
			console.error(`${path.relative(process.cwd(), toc)}: ${v === null ? 'no ## Version line' : `version ${v}`}`);
			mismatched++;
		}
	}
	return mismatched ? 1 : 0;
}

function set(pkgFile, addonsDir, version) {
	const pkg = fs.readFileSync(pkgFile, 'utf8');
	if (!PACKAGE_VERSION.test(pkg)) {
		console.error(`${pkgFile}: no "version" field`);
		return 1;
	}
	const files = tocs(addonsDir);
	const missing = files.filter((f) => !TOC_VERSION.test(fs.readFileSync(f, 'utf8')));
	if (missing.length) {
		for (const f of missing) console.error(`${path.relative(process.cwd(), f)}: no ## Version line`);
		return 1;
	}
	fs.writeFileSync(pkgFile, pkg.replace(PACKAGE_VERSION, `$1"${version}"`));
	for (const f of files) fs.writeFileSync(f, fs.readFileSync(f, 'utf8').replace(TOC_VERSION, `## Version: ${version}`));
	console.log(`version ${version}: package.json and ${files.length} addon TOC${files.length === 1 ? '' : 's'}`);
	return 0;
}

async function run(argv) {
	const { opts, positional, error } = parseArgs(argv, { flags: [], options: ['--root', '--addons'] });
	if (opts.help) {
		console.log(usage);
		return 0;
	}
	if (error || positional.length > 1) {
		console.error(`${error || 'one version at most'}\n\n${usage}`);
		return 2;
	}
	const root = resolvePath(opts.root, '.', project.ROOT);
	const addonsDir = resolvePath(opts.addons, 'addon', root);
	const pkgFile = path.join(root, 'package.json');
	if (!positional.length) return show(pkgFile, addonsDir);
	if (!SEMVER.test(positional[0])) {
		console.error(`"${positional[0]}" is not a version (x.y.z or x.y.z-pre)`);
		return 2;
	}
	return set(pkgFile, addonsDir, positional[0]);
}

module.exports = { name: 'version', summary: 'Show or set the release version (package.json and addon TOCs)', usage, run };
