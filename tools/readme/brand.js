'use strict';
// The README's identity art, drawn in code like the addon's own textures
// (tools/media/ui.js) and from the same geometry: the Polestar emblem, the
// night-sky band with its stars and constellation, the Cinzel wordmark and
// the lines under it in Marcellus, as outlines. Writes docs/assets/:
//   banner-dark.svg   the band dissolving into a dark page (GitHub dark)
//   banner-light.svg  the band as a night tile with square edges (light pages;
//                     the band has no daylight form, docs/DESIGN.md)
//   emblem.svg        the emblem in Polestar gold, transparent
//   logo.svg          the addon icon: the gold emblem on a night tile
//   download.svg      the README's download button
//
//   node tools/polestar.js readme brand

const fs = require('node:fs');
const path = require('node:path');
const { Outliner } = require('./outline');
const { header } = require('../lib/generated');

const { ROOT } = require('../lib/paths');
const OUT = path.join(ROOT, 'docs', 'assets');

// docs/DESIGN.md tokens (Dusk).
const C = {
	accent: '#e6ba66', accentLight: '#ffeec2', bg: '#181d2d', sky: '#283254', sidebar: '#121624',
	text: '#f7f8fd', textDim: '#c3cadd', textMuted: '#9ba2b9', star: '#dbe6ff', navy: '#0a0d16',
};

const f2 = (v) => String(Math.round(v * 100) / 100);

// Deterministic noise (tools/media/ui.js), so regenerating never churns.
function prng(seed) {
	let a = seed >>> 0;
	return () => {
		a = (a + 0x6d2b79f5) >>> 0;
		let t = a;
		t = Math.imul(t ^ (t >>> 15), t | 1);
		t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
		return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
	};
}

// The emblem on a 128 grid, centred at (64, 64): a fine ring (radius 44,
// 2.6 wide) cut where the long rays pass (|x| < 7), and the four-point star
// (tips at 30 and 60, waist 7.5). Returns path data scaled by k about the
// origin of the 128 grid.
function emblemPath(k = 1, ox = 0, oy = 0) {
	const P = (x, y) => `${f2(ox + x * k)} ${f2(oy + y * k)}`;
	const c = 64, ro = 45.3, ri = 42.7, cut = 7;
	const yo = Math.sqrt(ro * ro - cut * cut), yi = Math.sqrt(ri * ri - cut * cut);
	const R = (r) => f2(r * k);
	let d = '';
	for (const s of [1, -1]) {
		const sweepOut = s === 1 ? 1 : 0;
		const sweepIn = s === 1 ? 0 : 1;
		d += `M${P(c + s * cut, c - yo)}A${R(ro)} ${R(ro)} 0 0 ${sweepOut} ${P(c + s * cut, c + yo)}`;
		d += `L${P(c + s * cut, c + yi)}A${R(ri)} ${R(ri)} 0 0 ${sweepIn} ${P(c + s * cut, c - yi)}Z`;
	}
	const w = 7.5, rx = 30, ry = 60;
	const star = [[c, c - ry], [c + w, c - w], [c + rx, c], [c + w, c + w], [c, c + ry], [c - w, c + w], [c - rx, c], [c - w, c - w]];
	d += `M${star.map(([x, y]) => P(x, y)).join('L')}Z`;
	return d;
}

function emblemSvg() {
	return `<svg xmlns="http://www.w3.org/2000/svg" width="128" height="128" viewBox="0 0 128 128" role="img" aria-label="Polestar emblem">
<title>Polestar</title>
<path fill="${C.accent}" d="${emblemPath()}"/>
</svg>
`;
}

// tools/media/ui.js logo(): a 60px night tile (corner 12) on a 64 grid, a
// faint gold glow, the gold emblem, a light inner star and a faint ring.
function logoSvg() {
	const k = 0.5;
	const inner = [[32, 23], [33.4, 30.6], [37, 32], [33.4, 33.4], [32, 41], [30.6, 33.4], [27, 32], [30.6, 30.6]];
	return `<svg xmlns="http://www.w3.org/2000/svg" width="256" height="256" viewBox="0 0 64 64" role="img" aria-label="Polestar logo">
<title>Polestar</title>
<defs>
<radialGradient id="glow" cx="32" cy="32" r="30" gradientUnits="userSpaceOnUse"><stop offset="0" stop-color="${C.accent}" stop-opacity="0.35"/><stop offset="1" stop-color="${C.accent}" stop-opacity="0"/></radialGradient>
</defs>
<rect x="2" y="2" width="60" height="60" rx="12" fill="${C.navy}"/>
<rect x="2" y="2" width="60" height="60" rx="12" fill="url(#glow)"/>
<path fill="${C.accent}" d="${emblemPath(k)}"/>
<path fill="${C.accentLight}" d="M${inner.map(([x, y]) => `${x} ${y}`).join('L')}Z"/>
<circle cx="32" cy="32" r="29.5" fill="none" stroke="#fff" stroke-opacity="0.07" stroke-width="1"/>
</svg>
`;
}

// The README's download button: the gold of the addon's primary buttons, the
// emblem's star, and "Download Polestar" in Marcellus, as outlines.
function downloadSvg() {
	const o = new Outliner('d');
	const H = 56, pad = 26, star = 22, gap = 12, size = 23;
	const label = 'Download Polestar';
	const tw = o.width(label, { font: 'marcellus', size });
	const W = Math.ceil(pad + star + gap + tw + pad);
	const text = o.text(label, { font: 'marcellus', size, x: pad + star + gap, y: H / 2 + size * 0.34, fill: C.navy, stroke: 0.35 });
	return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" role="img" aria-label="${label}">
<title>${label}</title>
<defs>
<linearGradient id="face" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#f0cb7f"/><stop offset="1" stop-color="${C.accent}"/></linearGradient>
${o.defs()}
</defs>
<rect x="0.5" y="0.5" width="${W - 1}" height="${H - 1}" rx="10" fill="url(#face)" stroke="#fff3d4" stroke-opacity="0.55"/>
<path fill="${C.navy}" d="${emblemPath(star / 128, pad, (H - star) / 2)}"/>
${text}
</svg>
`;
}

// The band's sky mask (tools/media/ui.js band()): opaque at the top, a
// quarter left halfway, gone at the foot. As gradient stops.
function skyStops(color) {
	const mid = 0.25;
	const stops = [];
	for (let i = 0; i <= 12; i++) {
		const t = i / 12;
		const e = t * t * (3 - 2 * t);
		const w = e < 0.5 ? 1 - (1 - mid) * (e * 2) : mid * (1 - (e - 0.5) * 2);
		stops.push(`<stop offset="${f2(t)}" stop-color="${color}" stop-opacity="${f2(w)}"/>`);
	}
	return stops.join('');
}

function banner(variant) {
	const W = 1280, H = 320;
	const o = new Outliner('b');
	const body = [];

	// The lockup: emblem, then the wordmark over "A community project",
	// stacked and centred on the emblem; the pitch line under it.
	const E = 104;
	const capH = 50, tracking = 0.15;
	const wordW = o.width('POLESTAR', { font: 'cinzel', size: (capH / 700) * 1000, tracking });
	const gap = 28;
	const lockW = E + gap + wordW;
	const lx = (W - lockW) / 2;
	const cy = 138;
	const wx = lx + E + gap;

	// Stars: scattered, thinning downward, kept off the lockup and the pitch.
	const stars = [];
	const rnd = prng(0x5ea5);
	const clear = (x, y) => (x > lx - 40 && x < lx + lockW + 40 && y > cy - 74 && y < cy + 70) || (x > W / 2 - 330 && x < W / 2 + 330 && y > 222 && y < 272);
	for (let n = 0; n < 330; n++) {
		const x = rnd() * W, y = Math.pow(rnd(), 1.5) * (H - 30);
		const b = rnd();
		if (clear(x, y)) continue;
		const r = (0.45 + b * b * 0.95) * 1.15;
		const a = (0.18 + b * 0.62) * (1 - y / (H + 20));
		stars.push(`<circle cx="${f2(x)}" cy="${f2(y)}" r="${f2(r)}" fill-opacity="${f2(a)}"/>`);
		if (b > 0.93) stars.push(`<circle cx="${f2(x)}" cy="${f2(y)}" r="9" fill="url(#halo)" opacity="${f2(a)}"/>`);
	}
	// The constellation of the band, in the right third, clear of the lockup.
	const pts = [[668, 30], [712, 18], [758, 38], [806, 28], [842, 52], [902, 44], [934, 70]].map(([x, y]) => [W - 340 + (x - 668) * 1.05, 34 + y * 1.25]);
	const constellation = [
		`<polyline points="${pts.map(([x, y]) => `${f2(x)},${f2(y)}`).join(' ')}" fill="none" stroke="#ccdbff" stroke-opacity="0.2" stroke-width="0.8"/>`,
		...pts.map(([x, y]) => `<circle cx="${f2(x)}" cy="${f2(y)}" r="7" fill="url(#halo)" opacity="0.7"/><circle cx="${f2(x)}" cy="${f2(y)}" r="1.4" fill-opacity="0.95"/>`),
	];

	body.push(`<rect width="${W}" height="${H}" fill="${C.bg}"/>`);
	body.push(`<rect width="${W}" height="${H}" fill="url(#sky)"/>`);
	body.push(`<rect width="${W}" height="${H}" fill="url(#lift)"/>`);
	body.push(`<g fill="${C.star}">${stars.join('')}${constellation.join('')}</g>`);
	// The emblem in its glow (About: 12% of the accent).
	body.push(`<circle cx="${f2(lx + E / 2)}" cy="${cy}" r="${E * 0.95}" fill="url(#glow)"/>`);
	body.push(`<path fill="${C.accent}" d="${emblemPath(E / 128, lx, cy - E / 2)}"/>`);
	body.push(o.text('POLESTAR', { font: 'cinzel', capHeight: capH, tracking, x: wx, y: cy + 6, fill: C.text, stroke: 0.9 }));
	body.push(o.text('A community project', { font: 'marcellus', size: 21, x: wx + 2, y: cy + 40, fill: C.textDim, stroke: 0.25 }));
	body.push(o.text('Leveling guides for World of Warcraft: Forever', { font: 'marcellus', size: 25, x: W / 2, y: 256, anchor: 'middle', fill: C.textDim, stroke: 0.25 }));

	const defs = [
		`<linearGradient id="sky" x1="0" y1="0" x2="0" y2="1">${skyStops(C.sky)}</linearGradient>`,
		`<radialGradient id="lift" cx="0.74" cy="0.04" r="0.62" gradientTransform="translate(0.74 0.04) scale(1 0.5) translate(-0.74 -0.04)"><stop offset="0" stop-color="#dbe6ff" stop-opacity="0.06"/><stop offset="1" stop-color="#dbe6ff" stop-opacity="0"/></radialGradient>`,
		`<radialGradient id="halo"><stop offset="0" stop-color="#dbe6ff" stop-opacity="0.35"/><stop offset="1" stop-color="#dbe6ff" stop-opacity="0"/></radialGradient>`,
		`<radialGradient id="glow"><stop offset="0" stop-color="${C.accent}" stop-opacity="0.16"/><stop offset="1" stop-color="${C.accent}" stop-opacity="0"/></radialGradient>`,
	];
	let content = body.join('\n');
	if (variant === 'dark') {
		// Dissolve the edges into the page instead of drawing a box on it.
		defs.push(
			`<linearGradient id="fadeX" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#fff" stop-opacity="0"/><stop offset="0.14" stop-color="#fff"/><stop offset="0.86" stop-color="#fff"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></linearGradient>`,
			`<linearGradient id="fadeY" x1="0" y1="0" x2="0" y2="1"><stop offset="0.84" stop-color="#fff"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></linearGradient>`,
			`<mask id="mx"><rect width="${W}" height="${H}" fill="url(#fadeX)"/></mask>`,
			`<mask id="my"><rect width="${W}" height="${H}" fill="url(#fadeY)"/></mask>`,
		);
		content = `<g mask="url(#mx)"><g mask="url(#my)">\n${content}\n</g></g>`;
	}
	return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" role="img" aria-label="Polestar: leveling guides for World of Warcraft: Forever">
<title>Polestar: leveling guides for World of Warcraft: Forever</title>
<defs>
${defs.join('\n')}
${o.defs()}
</defs>
${content}
</svg>
`;
}

function write() {
	fs.mkdirSync(OUT, { recursive: true });
	const files = {
		'banner-dark.svg': banner('dark'),
		'banner-light.svg': banner('light'),
		'emblem.svg': emblemSvg(),
		'logo.svg': logoSvg(),
		'download.svg': downloadSvg(),
	};
	for (const [name, text] of Object.entries(files)) {
		fs.writeFileSync(path.join(OUT, name), `${header('svg', 'readme brand', 'tools/readme/brand.js')}\n${text}`);
		console.log(`docs/assets/${name} (${(Buffer.byteLength(text) / 1024).toFixed(1)} KB)`);
	}
}

module.exports = { emblemPath, prng, C, write };
