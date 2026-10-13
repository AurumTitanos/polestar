'use strict';
// Finding World of Warcraft: Forever clients under the home folder: Wine,
// Proton, Faugus, Lutris and Bottles prefixes. Used by install and by the
// readers of installed addons.

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

// -> [{ addons, client, kind, flavor }] for every Forever client found.
function detectAddonsDirs(home = os.homedir()) {
	const out = [];
	const seen = new Set();
	for (const prefix of prefixesUnder(home)) {
		for (const parts of WOW_DIRS) {
			const wow = path.join(prefix, 'drive_c', ...parts);
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
	}
	return out;
}

module.exports = { detectAddonsDirs, foreverKind, isDir };
