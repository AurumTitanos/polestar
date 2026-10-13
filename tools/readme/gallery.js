'use strict';
// The README's gallery: single panels cut from the UI renders in
// docs/preview/ (`node tools/polestar.js preview`, the real Lua UI drawn
// without the game), each a standalone SVG holding only the definitions it
// uses, so the page loads one window per image instead of a whole strip.
//
//   node tools/readme/gallery.js            write docs/assets/gallery/*.svg
//   node tools/readme/gallery.js --list     the panels of every preview

const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.join(__dirname, '..', '..');
const PREVIEW = path.join(ROOT, 'docs', 'preview');
const OUT = path.join(ROOT, 'docs', 'assets', 'gallery');

// [output name, preview scene, panel index (0-based)]
const PICKS = [
	['hub-guides', 'hub', 0],
	['hub-lookup', 'lookup', 1],
	['hub-dungeons', 'dungeons', 1],
	['hub-rares', 'rares', 0],
	['guide-hub', 'guide', 1],
	['guide-transparent', 'guide-transparent', 0],
	['quests-map', 'quests-map', 0],
	['quest-rewards', 'quest-rewards', 0],
	['rare-alert', 'rares-toast', 0],
	['options-appearance', 'options-appearance', 0],
];

const PANEL = /^<g transform="translate\(([\d.]+) ([\d.]+)\)">$/;
const GAP = 8; // tools/preview/render.js compose()

// -> { width, height, title, defs: Map(id -> line), shared: [lines without id], panels: [{ x, y, width, height, body }] }
function parse(file) {
	const text = fs.readFileSync(file, 'utf8');
	const lines = text.split('\n');
	const [, W, Hh] = /width="([\d.]+)" height="([\d.]+)"/.exec(lines[0]).map(Number);
	const title = (/<title>(.*)<\/title>/.exec(text) || [])[1] || '';
	const d0 = lines.indexOf('<defs>'), d1 = lines.indexOf('</defs>');
	const defs = new Map();
	for (const line of lines.slice(d0 + 1, d1)) {
		const m = /^<\w+ id="([^"]+)"/.exec(line);
		if (m) defs.set(m[1], line);
	}
	const starts = [];
	lines.forEach((l, i) => {
		if (i > d1 && PANEL.test(l)) starts.push(i);
	});
	const end = lines.lastIndexOf('</svg>');
	const panels = starts.map((s, k) => {
		const [, x, y] = PANEL.exec(lines[s]).map(Number);
		const stop = k + 1 < starts.length ? starts[k + 1] : end;
		// The group's own closing line sits just before the next group.
		const body = lines.slice(s + 1, stop - 1).join('\n');
		return { x, y, body };
	});
	panels.forEach((p, k) => {
		p.width = (k + 1 < panels.length ? panels[k + 1].x - GAP : W) - p.x;
		p.height = Hh - 2 * p.y;
	});
	return { width: W, height: Hh, title, defs, panels };
}

// Every definition the body uses, and the ones those use.
function usedDefs(body, defs) {
	const seen = new Set();
	const queue = [body];
	while (queue.length) {
		const s = queue.pop();
		for (const m of s.matchAll(/(?:href="#|url\(#)([^")]+)/g)) {
			if (seen.has(m[1]) || !defs.has(m[1])) continue;
			seen.add(m[1]);
			queue.push(defs.get(m[1]));
		}
	}
	return [...defs.keys()].filter((id) => seen.has(id)).map((id) => defs.get(id));
}

function panelSvg(doc, k) {
	const p = doc.panels[k];
	if (!p) throw new Error(`no panel ${k} (${doc.panels.length} panels)`);
	const w = Math.round(p.width), h = Math.round(p.height);
	const bg = doc.defs.get('bg');
	return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">
<defs>
${bg ? `${bg}\n` : ''}${usedDefs(p.body, doc.defs).join('\n')}
</defs>
<rect width="100%" height="100%" fill="${bg ? 'url(#bg)' : '#121418'}"/>
${p.body}
</svg>
`;
}

function main() {
	if (process.argv.includes('--list')) {
		for (const f of fs.readdirSync(PREVIEW).filter((n) => n.endsWith('.svg')).sort()) {
			const doc = parse(path.join(PREVIEW, f));
			console.log(`${f.padEnd(26)} ${doc.panels.map((p) => `${Math.round(p.width)}x${Math.round(p.height)}`).join('  ')}  ${doc.title.slice(0, 90)}`);
		}
		return;
	}
	fs.mkdirSync(OUT, { recursive: true });
	const cache = new Map();
	for (const [name, scene, k] of PICKS) {
		if (!cache.has(scene)) cache.set(scene, parse(path.join(PREVIEW, `${scene}.svg`)));
		const text = panelSvg(cache.get(scene), k);
		fs.writeFileSync(path.join(OUT, `${name}.svg`), text);
		console.log(`docs/assets/gallery/${name}.svg (${(Buffer.byteLength(text) / 1024).toFixed(0)} KB)`);
	}
}

if (require.main === module) main();

module.exports = { parse, panelSvg };
