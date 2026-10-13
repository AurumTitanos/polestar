'use strict';
// Finding World of Warcraft: Forever clients: Wine, Proton, Faugus, Lutris and
// Bottles prefixes under the home folder, and native installs on Windows
// (C:\Program Files (x86)\World of Warcraft) and macOS (/Applications/World of
// Warcraft). Used by install and by the readers of installed addons.

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const WOW_DIRS = [
	['Program Files (x86)', 'World of Warcraft'],
	['Program Files', 'World of Warcraft'],
	['Games', 'World of Warcraft'],
	['World of Warcraft'],
];

// Where Wine prefixes live, relative to the home folder.
const PREFIX_ROOTS = [
	['.wine'],
	['Games'],
	['Faugus'],
	['.local', 'share', 'wineprefixes'],
	['.local', 'share', 'lutris', 'prefixes'],
	['.local', 'share', 'bottles', 'bottles'],
	['.var', 'app', 'com.usebottles.bottles', 'data', 'bottles', 'bottles'],
	['.local', 'share', 'Steam', 'steamapps', 'compatdata'],
	['.steam', 'steam', 'steamapps', 'compatdata'],
	['.var', 'app', 'com.valvesoftware.Steam', '.local', 'share', 'Steam', 'steamapps', 'compatdata'],
];

function isDir(p) {
	try {
		return fs.statSync(p).isDirectory();
	} catch {
		return false;
	}
}

function readFlavor(dir) {
	try {
		const lines = fs
			.readFileSync(path.join(dir, '.flavor.info'), 'utf8')
			.split(/\r?\n/)
			.map((l) => l.trim())
			.filter(Boolean);
		return lines.length ? lines[lines.length - 1] : null;
	} catch {
		return null;
	}
}

// A client folder is Forever when its .flavor.info says so: "_forever_"
// folders carry a wow_forever* flavor; during beta Forever is "_classic_beta_"
// with flavor wow_classic_beta.
function foreverKind(name, flavor) {
	if (!flavor) return null;
	if (/forever/i.test(flavor)) return 'forever';
	if (name === '_classic_beta_' && flavor === 'wow_classic_beta') return 'beta';
	return null;
}

function prefixesUnder(home) {
	const found = [];
	const consider = (p) => {
		if (isDir(path.join(p, 'drive_c'))) found.push(p);
	};
	for (const parts of PREFIX_ROOTS) {
		const root = path.join(home, ...parts);
		if (!isDir(root)) continue;
		consider(root);
		consider(path.join(root, 'pfx'));
		let children = [];
		try {
			children = fs.readdirSync(root, { withFileTypes: true });
		} catch {
			continue;
		}
		for (const c of children.sort((a, b) => (a.name < b.name ? -1 : 1))) {
			if (!c.isDirectory() && !c.isSymbolicLink()) continue;
			const p = path.join(root, c.name);
			consider(p);
			consider(path.join(p, 'pfx'));
		}
	}
	return found;
}

// Native installs: [platform] -> the World of Warcraft folder's parts under the filesystem root.
const NATIVE_DIRS = {
	win32: ['Program Files (x86)', 'World of Warcraft'],
	darwin: ['Applications', 'World of Warcraft'],
};

// The native World of Warcraft folder for `native` ({ platform, root }; the
// root is the filesystem root, C:\ on Windows and / elsewhere), or null on a
// platform without one (Linux runs the client in a Wine prefix). Tests pass
// { platform: 'linux' } or a temp root so they never reach a real install.
function nativeWowDir({ platform = process.platform, root = platform === 'win32' ? 'C:\\' : '/' } = {}) {
	return NATIVE_DIRS[platform] ? path.join(root, ...NATIVE_DIRS[platform]) : null;
}

// -> [{ addons, client, kind, flavor }] for every Forever client found:
// Wine prefixes under `home`, then the native install (see nativeWowDir).
function detectAddonsDirs(home = os.homedir(), native = {}) {
	const out = [];
	const seen = new Set();
	const wowDirs = [];
	for (const prefix of prefixesUnder(home)) for (const parts of WOW_DIRS) wowDirs.push(path.join(prefix, 'drive_c', ...parts));
	const nativeDir = nativeWowDir(native);
	if (nativeDir) wowDirs.push(nativeDir);
	for (const wow of wowDirs) {
		if (!isDir(wow)) continue;
		for (const name of fs.readdirSync(wow).sort()) {
			if (!/^_.+_$/.test(name)) continue;
			const client = path.join(wow, name);
			const kind = foreverKind(name, readFlavor(client));
			if (!kind) continue;
			let real;
			try {
				real = fs.realpathSync(client);
			} catch {
				continue;
			}
			if (seen.has(real)) continue;
			seen.add(real);
			out.push({ addons: path.join(client, 'Interface', 'AddOns'), client, kind, flavor: readFlavor(client) });
		}
	}
	return out;
}

// The client install and dev use when nothing names one, from `found`
// (detectAddonsDirs, injected by tests): live (`forever`) clients first,
// others only when there is no live one. -> { pick } (one client), { several }
// (the candidates left; the user chooses) or { none: true }.
function pickAddonsDir(found) {
	if (!found.length) return { none: true };
	const live = found.filter((f) => f.kind === 'forever');
	const left = live.length ? live : found;
	return left.length > 1 ? { several: left } : { pick: left[0] };
}

module.exports = { detectAddonsDirs, pickAddonsDir, nativeWowDir, foreverKind, isDir };
