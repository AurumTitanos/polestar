'use strict';
// A patch release's preparation on a hotfix/ checkout (docs/RELEASING.md,
// "Patch releases", steps 1 to 3): the scope check, the data addons put back
// from the release it patches, the version, lint and compile with that
// checkout's own tools, and the compiled guides compared with the release.

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { readZip } = require('../zip');

// The data addons a patch takes from the release instead of rebuilding.
const DATA_ADDONS = ['Polestar_Codex', 'Polestar_QuestDB'];
const CORRECTIONS = 'tools/lib/data/corrections.json';
const GUIDES_LUA = 'addon/Polestar_Guides/Guides.lua';

// Compiled guides by source: Guides.lua's `-- Source: <file>` blocks.
function guideBlocks(text) {
	const blocks = new Map();
	let name = null;
	for (const line of text.split('\n')) {
		const m = /^-- Source: (.+?)\s*$/.exec(line);
		if (m) {
			name = m[1];
			blocks.set(name, '');
		} else if (name !== null) blocks.set(name, blocks.get(name) + line + '\n');
	}
	return blocks;
}

// The compiled guides that differ between two Guides.lua texts, sorted:
// { source, change: 'changed' | 'added' | 'removed' }.
function changedGuides(before, after) {
	const a = guideBlocks(before);
	const b = guideBlocks(after);
	const out = [];
	for (const [src, text] of b) {
		if (!a.has(src)) out.push({ source: src, change: 'added' });
		else if (a.get(src) !== text) out.push({ source: src, change: 'changed' });
	}
	for (const src of a.keys()) if (!b.has(src)) out.push({ source: src, change: 'removed' });
	return out.sort((x, y) => (x.source < y.source ? -1 : x.source > y.source ? 1 : 0));
}

// The compiled guides whose sources under guides/ did not change: a change
// there comes from the data the guides were compiled with.
function drifted(guides, changedSources) {
	const set = new Set(changedSources);
	return guides.filter((g) => !set.has(`guides/${g.source}`));
}

// The data addons' entries of a release zip, as { name, data } under addon/.
function dataEntries(zipFile) {
	const entries = readZip(zipFile);
	const out = [];
	for (const e of entries) {
		if (e.dir) continue;
		const top = e.name.split('/')[0];
		if (!DATA_ADDONS.includes(top)) continue;
		if (e.name.split('/').some((p) => p === '..' || p === '') || path.isAbsolute(e.name)) throw new Error(`${zipFile}: unsafe entry ${e.name}`);
		out.push(e);
	}
	const missing = DATA_ADDONS.filter((a) => !out.some((e) => e.name.startsWith(`${a}/`)));
	if (missing.length) throw new Error(`${zipFile} holds no ${missing.join(' or ')}`);
	return out;
}

function restoreDataAddons(root, zipFile) {
	const entries = dataEntries(zipFile);
	for (const a of DATA_ADDONS) fs.rmSync(path.join(root, 'addon', a), { recursive: true, force: true });
	for (const e of entries) {
		const f = path.join(root, 'addon', e.name);
		fs.mkdirSync(path.dirname(f), { recursive: true });
		fs.writeFileSync(f, e.data);
	}
	return entries.length;
}

// The release zip of tag, downloaded with gh into a temp folder.
function downloadZip(root, tag) {
	const v = tag.replace(/^v/, '');
	const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'polestar-release-'));
	const r = spawnSync('gh', ['release', 'download', tag, '-p', `Polestar-${v}.zip`, '-D', dir], { cwd: root, encoding: 'utf8' });
	if (r.error) throw new Error(`gh: ${r.error.message} (give the zip with --zip)`);
	if (r.status !== 0) throw new Error(`gh release download ${tag}: ${(r.stderr || '').trim()}`);
	return { file: path.join(dir, `Polestar-${v}.zip`), dir };
}

// `node <root>/tools/polestar.js <args>` in root, its output shown.
function rootTool(root, args, { capture = false } = {}) {
	const r = spawnSync(process.execPath, [path.join(root, 'tools', 'polestar.js'), ...args], {
		cwd: root,
		encoding: 'utf8',
		stdio: capture ? 'pipe' : 'inherit',
	});
	if (r.error) throw new Error(`node tools/polestar.js ${args[0]}: ${r.error.message}`);
	return r;
}

// Whether root's `command --help` lists option (e.g. '--data').
function takesOption(root, command, option) {
	const r = rootTool(root, [command, '--help'], { capture: true });
	return r.status === 0 && new RegExp(`${option}\\b`).test(r.stdout);
}

// A command's output without its warning lines (and their hints).
function withoutWarnings(text) {
	return text
		.split('\n')
		.filter((l) => !/\bwarning\b/i.test(l) && !/^\s+(hint|=)/.test(l))
		.join('\n');
}

module.exports = { DATA_ADDONS, CORRECTIONS, GUIDES_LUA, guideBlocks, changedGuides, drifted, dataEntries, restoreDataAddons, downloadZip, rootTool, takesOption, withoutWarnings };
