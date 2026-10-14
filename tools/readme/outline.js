'use strict';
// Text as outlines for the README's SVG assets. GitHub serves SVGs as images,
// which never load web fonts, so every word is drawn from the font's own
// glyph outlines: each glyph once under <defs>, then placed with <use>.
// Inter (addon/Polestar/Media/Fonts) for text, Cinzel (tools/media/fonts) for
// the POLESTAR wordmark, as in the addon, and Marcellus (tools/media/fonts), a
// free typeface close to the game's own, for the banner's lines under it.

const path = require('node:path');
const { Font } = require('../preview/font');

const { ROOT } = require('../lib/paths');
const FILES = {
	regular: path.join(ROOT, 'addon', 'Polestar', 'Media', 'Fonts', 'Inter-Regular.ttf'),
	medium: path.join(ROOT, 'addon', 'Polestar', 'Media', 'Fonts', 'Inter-Medium.ttf'),
	semibold: path.join(ROOT, 'addon', 'Polestar', 'Media', 'Fonts', 'Inter-SemiBold.ttf'),
	cinzel: path.join(ROOT, 'tools', 'media', 'fonts', 'Cinzel-Variable.ttf'),
	marcellus: path.join(ROOT, 'tools', 'media', 'fonts', 'Marcellus-Regular.ttf'),
};
const KEYS = { regular: 'r', medium: 'm', semibold: 's', cinzel: 'c', marcellus: 'g' };
const loaded = new Map();

function font(name) {
	if (!FILES[name]) throw new Error(`unknown font ${name}`);
	if (!loaded.has(name)) loaded.set(name, new Font(FILES[name]));
	return loaded.get(name);
}

const n1 = (v) => String(Math.round(v * 10) / 10);
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;');

// One document's glyph set. text() returns markup and records the glyphs it
// placed; defs() returns their outlines, each once.
class Outliner {
	constructor(prefix = 't') {
		this.prefix = prefix;
		this.used = new Map();
	}

	// Width of a string in px at `size`, tracking in em.
	width(str, { font: name = 'medium', size = 13, tracking = 0 } = {}) {
		const f = font(name);
		let w = 0;
		const chars = [...str];
		for (const ch of chars) w += f.advance(f.glyphId(ch.codePointAt(0)));
		return (w / f.upm + tracking * Math.max(0, chars.length - 1)) * size;
	}

	// size: em size in px (for Cinzel, pass capHeight instead to size by caps).
	// stroke: px of extra weight drawn round the outline (engraved cuts).
	text(str, { font: name = 'medium', size = 13, capHeight, x = 0, y = 0, anchor = 'start', fill = '#f7f8fd', opacity, tracking = 0, stroke = 0 } = {}) {
		const f = font(name);
		const em = capHeight ? (capHeight / 700) * f.upm : size;
		const s = em / f.upm;
		const width = this.width(str, { font: name, size: em, tracking });
		const x0 = anchor === 'middle' ? x - width / 2 : anchor === 'end' ? x - width : x;
		const track = tracking * f.upm;
		const uses = [];
		let pen = 0;
		for (const ch of str) {
			const gid = f.glyphId(ch.codePointAt(0));
			const id = `${this.prefix}${KEYS[name]}${gid}`;
			if (ch.trim()) {
				if (!this.used.has(id)) this.used.set(id, f.path(gid).replace(/-?\d+\.\d+/g, (v) => String(Math.round(Number(v)))));
				uses.push(pen ? `<use href="#${id}" x="${Math.round(pen)}"/>` : `<use href="#${id}"/>`);
			}
			pen += f.advance(gid) + track;
		}
		const op = opacity != null && opacity < 1 ? ` fill-opacity="${opacity}"` : '';
		const st = stroke ? ` stroke="${fill}" stroke-width="${Math.round(stroke / s)}" stroke-linejoin="round"` : '';
		return `<g aria-label="${esc(str)}" fill="${fill}"${op}${st} transform="translate(${n1(x0)} ${n1(y)}) scale(${(Math.round(s * 1e5) / 1e5)})">${uses.join('')}</g>`;
	}

	defs() {
		return [...this.used].map(([id, d]) => `<path id="${id}" d="${d}"/>`).join('\n');
	}
}

module.exports = { Outliner, font, esc };
