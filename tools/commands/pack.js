'use strict';
// pack: release archives: dist/Polestar-<version>.zip (Polestar, Polestar_Guides
// and the built data addons) and dist/Polestar_Recorder-<version>.zip, each
// with the GPL in its first folder (and the player's README.txt in Polestar/),
// plus dist/SHA256SUMS for both.

const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const { parseArgs, resolvePath, printDiagnostics, plural } = require('../lib/dsl/cli');
const project = require('../lib/dsl/project');
const { writeZip, directoryEntries } = require('../lib/zip');

const usage = `usage: node tools/polestar.js pack [options]

Compiles the guides, then writes dist/Polestar-<version>.zip (Polestar,
Polestar_Guides, and Polestar_QuestDB / Polestar_ItemDB when built),
dist/Polestar_Recorder-<version>.zip and dist/SHA256SUMS. Polestar/ in the
zip also carries LICENSE and README.txt (install steps), Polestar_Recorder/
the LICENSE.

options:
  --guides <dir>   guide sources (default guides/)
  --data <dir>     reference data (default data/forever/)
  --addons <dir>   addon source folder (default addon/)
  --dist <dir>     output folder (default dist/)`;

function compile(dirs) {
	const result = project.compileProject({ guidesDir: dirs.guides, dataDir: dirs.data });
	printDiagnostics(result.diag, { quiet: true });
	if (result.diag.hasErrors()) {
		console.error(`pack failed: ${plural(result.diag.errors.length, 'error')} in guides (run lint for details)`);
		return null;
	}
	return result;
}

function tocVersion(dir, name) {
	try {
		const m = /^## Version:\s*(\S+)/m.exec(fs.readFileSync(path.join(dir, `${name}.toc`), 'utf8'));
		return m ? m[1] : null;
	} catch {
		return null;
	}
}

// Install steps for players, Polestar/README.txt in the zip. CRLF so Notepad
// shows it as written.
function readme(version, names) {
	return [
		`Polestar ${version}`,
		'Leveling guides for World of Warcraft: Forever.',
		'',
		'Install',
		'1. Copy these folders from the zip into',
		'   World of Warcraft/_forever_/Interface/AddOns/',
		'   (_classic_beta_ instead of _forever_ on the beta client):',
		...names.map((n) => `     ${n}`),
		'   To update, delete the old Polestar folders there first.',
		'2. Quit the game completely and start it again. A /reload does not',
		'   load new addon folders.',
		'',
		'Polestar_Recorder (a separate zip) is optional: it records your sessions',
		'to improve the routes and stays off until you turn it on.',
		'',
		'Source, issues and documentation: https://github.com/fitzforge/polestar',
		'Polestar is free software under the GNU General Public License, version 3',
		'only (LICENSE). The data folders carry their own notices (LICENSE-DATA.txt).',
		'',
	].join('\r\n');
}

// Zip entries for the addon folders, with `extras` ({ folder: [{ name, data }] })
// placed right after their folder's own entry.
function archiveEntries(addonsDir, names, extras) {
	const entries = [];
	for (const n of names) {
		const [dir, ...rest] = directoryEntries([path.join(addonsDir, n)]);
		const added = (extras[n] || []).map((e) => ({ name: `${n}/${e.name}`, data: e.data }));
		const taken = new Set(added.map((e) => e.name));
		entries.push(dir, ...added, ...rest.filter((e) => !taken.has(e.name)));
	}
	return entries;
}

function sha256(file) {
	return crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
}

function pack(dirs, version) {
	const product = project.releaseAddons(dirs.addons);
	for (const n of product.skipped) console.log(`note: ${n} not built (no ${n}/${n}.toc); leaving it out of the zip`);
	const license = { name: 'LICENSE', data: fs.readFileSync(path.join(project.ROOT, 'LICENSE')) };
	const archives = [
		{ file: `Polestar-${version}.zip`, names: product.names, extras: { Polestar: [license, { name: 'README.txt', data: readme(version, product.names) }] } },
		{ file: `Polestar_Recorder-${version}.zip`, names: ['Polestar_Recorder'], extras: { Polestar_Recorder: [license] } },
	];
	for (const { names } of archives) {
		for (const n of names) {
			if (!fs.existsSync(path.join(dirs.addons, n, `${n}.toc`))) {
				console.error(`missing ${path.join(dirs.addons, n, `${n}.toc`)}`);
				return 1;
			}
			const v = tocVersion(path.join(dirs.addons, n), n);
			if (v !== version) console.warn(`warning: ${n}.toc says version ${v}, package.json says ${version}`);
		}
	}
	const result = compile(dirs);
	if (!result) return 1;
	const guidesDir = path.join(dirs.addons, 'Polestar_Guides');
	project.writePackDir(guidesDir, project.buildPackFiles({ guides: result.guides, meta: project.packMeta(version), data: result.data }));
	const sums = [];
	for (const { file, names, extras } of archives) {
		const out = path.join(dirs.dist, file);
		writeZip(out, archiveEntries(dirs.addons, names, extras));
		sums.push(`${sha256(out)}  ${file}\n`);
		console.log(`wrote ${path.relative(process.cwd(), out)}`);
	}
	const sumsFile = path.join(dirs.dist, 'SHA256SUMS');
	fs.writeFileSync(sumsFile, sums.join(''));
	console.log(`wrote ${path.relative(process.cwd(), sumsFile)}`);
	console.log(`guide pack: ${plural(result.guides.length, 'guide')}`);
	return 0;
}

async function run(argv) {
	const { opts, error } = parseArgs(argv, { flags: [], options: ['--guides', '--data', '--addons', '--dist'] });
	if (opts.help) {
		console.log(usage);
		return 0;
	}
	if (error) {
		console.error(`${error}\n\n${usage}`);
		return 2;
	}
	const dirs = {
		guides: resolvePath(opts.guides, 'guides', project.ROOT),
		data: resolvePath(opts.data, 'data/forever', project.ROOT),
		addons: resolvePath(opts.addons, 'addon', project.ROOT),
		dist: resolvePath(opts.dist, 'dist', project.ROOT),
	};
	return pack(dirs, project.packageVersion());
}

module.exports = { name: 'pack', summary: 'Build the release zips', usage, run };
