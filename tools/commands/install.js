'use strict';
// install: copy (or symlink) the Polestar addon folders into the Forever
// client's Interface/AddOns. Only the Polestar folders being installed are
// touched; each is replaced by a rename so the game never sees a half copy.

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { parseArgs } = require('../lib/dsl/cli');
const { ROOT, releaseAddons } = require('../lib/dsl/project');
const { detectAddonsDirs, foreverKind, isDir } = require('../lib/addons');

// Data addons built locally from inputs that may not be redistributed
// (docs/SUITE.md, "In-game packs"): installed when built, never packaged.
const LOCAL_DATA_ADDONS = ['Polestar_Codex', 'Polestar_Travel'];

const usage = `usage: node tools/polestar.js install [options]

Installs addon/Polestar and addon/Polestar_Guides, plus the data addons
Polestar_QuestDB, Polestar_ItemDB and Polestar_Codex when they have been built
(and with --recorder, addon/Polestar_Recorder) into World of Warcraft: Forever's
AddOns folder.

Destination, first match wins:
  --dest <dir>             the Interface/AddOns folder to install into
  $WOW_FOREVER_ADDONS      same, from the environment
  auto-detect              Wine/Proton/Faugus/Lutris/Bottles prefixes under your home
                           folder; a "_forever_" or "_classic_beta_" client folder whose
                           .flavor.info names Forever (wow_forever*) or the classic beta

options:
  --link        symlink the folders instead of copying (edit, then /reload)
  --recorder    also install Polestar_Recorder
  --dry-run     print what would happen, change nothing
  --addons <dir>  source folder holding the addons (default addon/)`;

// -> { dir, how } or { error }
function chooseDest(opts, env = process.env, home = os.homedir()) {
	if (opts.dest) return isDir(opts.dest) ? { dir: path.resolve(opts.dest), how: '--dest' } : { error: `--dest ${opts.dest} is not a folder` };
	if (env.WOW_FOREVER_ADDONS) {
		const d = env.WOW_FOREVER_ADDONS;
		return isDir(d) ? { dir: path.resolve(d), how: '$WOW_FOREVER_ADDONS' } : { error: `$WOW_FOREVER_ADDONS (${d}) is not a folder` };
	}
	const found = detectAddonsDirs(home);
	if (!found.length) {
		return { error: 'no World of Warcraft: Forever client found under your home folder; pass --dest <.../Interface/AddOns> or set $WOW_FOREVER_ADDONS' };
	}
	const live = found.filter((f) => f.kind === 'forever');
	const pick = live.length ? live : found;
	if (pick.length > 1) {
		return { error: `several Forever clients found; choose one with --dest:\n${pick.map((f) => `  ${f.addons}`).join('\n')}` };
	}
	return { dir: pick[0].addons, how: `auto-detected, flavor ${pick[0].flavor}`, create: true };
}

function removePath(p) {
	const st = fs.lstatSync(p);
	if (st.isSymbolicLink() || !st.isDirectory()) fs.unlinkSync(p);
	else fs.rmSync(p, { recursive: true, force: true });
}

function exists(p) {
	try {
		fs.lstatSync(p);
		return true;
	} catch {
		return false;
	}
}

function real(p) {
	try {
		return fs.realpathSync(p);
	} catch {
		return null;
	}
}

function within(child, parent) {
	const rel = path.relative(parent, child);
	return rel === '' || (!rel.startsWith('..') && !path.isAbsolute(rel));
}

// Why replacing <dest>/<name> with <src> would be destructive, or null. The
// old target is deleted after the swap, so a real folder there must not be (or
// contain) the source, the destination must not lie inside the source, and an
// existing real folder must be that addon (it has <name>.toc). An old symlink
// (from --link) is only unlinked, so replacing it is always safe.
function unsafeTarget(src, destDir, name) {
	const s = real(src);
	const d = real(destDir) || path.resolve(destDir);
	const target = path.join(destDir, name);
	if (s && within(d, s)) return `${destDir} is inside the source ${src}`;
	if (!exists(target)) return null;
	const st = fs.lstatSync(target);
	if (st.isSymbolicLink()) return null;
	const t = real(target);
	if (s && t && within(s, t)) return `${target} is (or contains) the source ${src}`;
	if (!st.isDirectory()) return `${target} exists and is not a folder`;
	if (!fs.existsSync(path.join(target, `${name}.toc`))) return `${target} exists but has no ${name}.toc; not an installed ${name}`;
	return null;
}

function installOne(src, dest, name, link) {
	const target = path.join(dest, name);
	const tmp = path.join(dest, `${name}.polestar-new-${process.pid}`);
	const old = path.join(dest, `${name}.polestar-old-${process.pid}`);
	if (exists(tmp)) removePath(tmp);
	if (link) fs.symlinkSync(src, tmp, 'dir');
	else fs.cpSync(src, tmp, { recursive: true, filter: (s) => !path.basename(s).startsWith('.') || s === src });
	const had = exists(target);
	if (had) fs.renameSync(target, old);
	try {
		fs.renameSync(tmp, target);
	} catch (e) {
		if (had) fs.renameSync(old, target);
		removePath(tmp);
		throw e;
	}
	if (had) removePath(old);
}

function hasCompiledGuides(dir) {
	try {
		return /Guides\\/.test(fs.readFileSync(path.join(dir, 'Pack.xml'), 'utf8'));
	} catch {
		return false;
	}
}

async function run(argv, env = process.env) {
	const { opts, error } = parseArgs(argv, { flags: ['--link', '--recorder', '--dry-run'], options: ['--dest', '--addons'] });
	if (opts.help) {
		console.log(usage);
		return 0;
	}
	if (error) {
		console.error(`${error}\n\n${usage}`);
		return 2;
	}
	const source = opts.addons ? path.resolve(opts.addons) : path.join(ROOT, 'addon');
	const release = releaseAddons(source);
	const local = LOCAL_DATA_ADDONS.filter((n) => fs.existsSync(path.join(source, n, `${n}.toc`)));
	const skipped = [...release.skipped, ...LOCAL_DATA_ADDONS.filter((n) => !local.includes(n))];
	for (const n of skipped) console.log(`note: ${n} not built (no ${n}/${n}.toc); skipping it`);
	const names = [...release.names, ...local, ...(opts.recorder ? ['Polestar_Recorder'] : [])];
	for (const name of names) {
		if (!fs.existsSync(path.join(source, name, `${name}.toc`))) {
			console.error(`missing ${path.join(source, name, `${name}.toc`)}`);
			return 1;
		}
	}
	if (!hasCompiledGuides(path.join(source, 'Polestar_Guides'))) {
		console.warn('warning: Polestar_Guides has no compiled guides; run `node tools/polestar.js compile` first');
	}
	const dest = chooseDest(opts, env, env.HOME || os.homedir());
	if (dest.error) {
		console.error(dest.error);
		return 1;
	}
	const unsafe = names.map((n) => unsafeTarget(path.join(source, n), dest.dir, n)).filter(Boolean);
	if (unsafe.length) {
		for (const msg of unsafe) console.error(`refusing to install: ${msg}`);
		return 1;
	}
	const verb = opts.link ? 'link' : 'copy';
	console.log(`${opts.dryRun ? 'would install' : 'installing'} into ${dest.dir} (${dest.how})`);
	if (dest.create && !isDir(dest.dir)) {
		console.log(`  ${opts.dryRun ? 'would create' : 'creating'} ${dest.dir}`);
		if (!opts.dryRun) fs.mkdirSync(dest.dir, { recursive: true });
	}
	for (const name of names) {
		const src = path.join(source, name);
		const target = path.join(dest.dir, name);
		const action = `${exists(target) ? 'replace' : 'add'} ${name} (${verb} from ${src})`;
		if (opts.dryRun) {
			console.log(`  would ${action}`);
			continue;
		}
		installOne(src, dest.dir, name, !!opts.link);
		console.log(`  ${action.replace(/^replace/, 'replaced').replace(/^add/, 'added')}`);
	}
	return 0;
}

module.exports = { name: 'install', summary: 'Install the addons into the Forever client', usage, run, detectAddonsDirs, chooseDest, foreverKind };
