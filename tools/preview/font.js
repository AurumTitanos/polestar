'use strict';
// A minimal TrueType reader for the preview: advance widths for measuring
// text the way the client lays it out, and glyph outlines so the SVGs draw
// the real Inter shapes as paths (identical in every viewer, no font install
// needed). Reads cmap (formats 4 and 12), hmtx, loca and glyf (simple and
// composite glyphs). No hinting, no kerning: the client does not kern either.

const fs = require('node:fs');

class Font {
	constructor(file) {
		this.file = file;
		const buf = fs.readFileSync(file);
		this.buf = buf;
		const numTables = buf.readUInt16BE(4);
		this.tables = {};
		for (let i = 0; i < numTables; i++) {
			const o = 12 + i * 16;
			this.tables[buf.toString('latin1', o, o + 4)] = { offset: buf.readUInt32BE(o + 8), length: buf.readUInt32BE(o + 12) };
		}
		const head = this.t('head');
		this.upm = buf.readUInt16BE(head + 18);
		this.longLoca = buf.readInt16BE(head + 50) === 1;
		const hhea = this.t('hhea');
		this.ascender = buf.readInt16BE(hhea + 4);
		this.descender = buf.readInt16BE(hhea + 6);
		this.numHMetrics = buf.readUInt16BE(hhea + 34);
		this.numGlyphs = buf.readUInt16BE(this.t('maxp') + 4);
		this.cmap = this.readCmap();
		this.paths = new Map();
	}

	t(tag) {
		const e = this.tables[tag];
		if (!e) throw new Error(`${this.file}: no ${tag} table`);
		return e.offset;
	}

	readCmap() {
		const buf = this.buf;
		const base = this.t('cmap');
		const n = buf.readUInt16BE(base + 2);
		let best = null;
		for (let i = 0; i < n; i++) {
			const pid = buf.readUInt16BE(base + 4 + i * 8);
			const eid = buf.readUInt16BE(base + 6 + i * 8);
			const off = base + buf.readUInt32BE(base + 8 + i * 8);
			const format = buf.readUInt16BE(off);
			if (pid === 3 && eid === 10 && format === 12) best = { off, format };
			else if (!best && pid === 3 && eid === 1 && format === 4) best = { off, format };
		}
		if (!best) throw new Error(`${this.file}: no Unicode cmap`);
		const map = new Map();
		const off = best.off;
		if (best.format === 12) {
			const groups = buf.readUInt32BE(off + 12);
			for (let g = 0; g < groups; g++) {
				const o = off + 16 + g * 12;
				const start = buf.readUInt32BE(o), end = buf.readUInt32BE(o + 4), gid = buf.readUInt32BE(o + 8);
				for (let c = start; c <= end && c < 0x30000; c++) map.set(c, gid + (c - start));
			}
		} else {
			const segX2 = buf.readUInt16BE(off + 6);
			const ends = off + 14, starts = ends + segX2 + 2, deltas = starts + segX2, ranges = deltas + segX2;
			for (let s = 0; s < segX2 / 2; s++) {
				const end = buf.readUInt16BE(ends + s * 2), start = buf.readUInt16BE(starts + s * 2);
				const delta = buf.readInt16BE(deltas + s * 2), rangeOff = buf.readUInt16BE(ranges + s * 2);
				for (let c = start; c <= end && c !== 0xffff; c++) {
					let gid;
					if (rangeOff === 0) gid = (c + delta) & 0xffff;
					else {
						const p = ranges + s * 2 + rangeOff + (c - start) * 2;
						gid = buf.readUInt16BE(p);
						if (gid) gid = (gid + delta) & 0xffff;
					}
					map.set(c, gid);
				}
			}
		}
		return map;
	}

	glyphId(cp) {
		return this.cmap.get(cp) || 0;
	}

	advance(gid) {
		const hmtx = this.t('hmtx');
		const i = Math.min(gid, this.numHMetrics - 1);
		return this.buf.readUInt16BE(hmtx + i * 4);
	}

	// Advance of a code point, in em.
	advanceEm(cp) {
		return this.advance(this.glyphId(cp)) / this.upm;
	}

	glyphRange(gid) {
		const loca = this.t('loca');
		const buf = this.buf;
		if (this.longLoca) return [buf.readUInt32BE(loca + gid * 4), buf.readUInt32BE(loca + gid * 4 + 4)];
		return [buf.readUInt16BE(loca + gid * 2) * 2, buf.readUInt16BE(loca + gid * 2 + 2) * 2];
	}

	// Contours of a glyph: [[{x, y, on}], ...] in font units (y up).
	contours(gid, depth = 0) {
		const [a, b] = this.glyphRange(gid);
		if (b <= a || depth > 8) return [];
		const buf = this.buf;
		const o = this.t('glyf') + a;
		const n = buf.readInt16BE(o);
		if (n >= 0) {
			const ends = [];
			for (let i = 0; i < n; i++) ends.push(buf.readUInt16BE(o + 10 + i * 2));
			const count = n ? ends[n - 1] + 1 : 0;
			let p = o + 10 + n * 2;
			p += 2 + buf.readUInt16BE(p);
			const flags = [];
			while (flags.length < count) {
				const f = buf[p++];
				flags.push(f);
				if (f & 8) {
					let r = buf[p++];
					while (r-- > 0) flags.push(f);
				}
			}
			const xs = [], ys = [];
			let v = 0;
			for (const f of flags) {
				if (f & 2) { const d = buf[p++]; v += f & 16 ? d : -d; }
				else if (!(f & 16)) { v += buf.readInt16BE(p); p += 2; }
				xs.push(v);
			}
			v = 0;
			for (const f of flags) {
				if (f & 4) { const d = buf[p++]; v += f & 32 ? d : -d; }
				else if (!(f & 32)) { v += buf.readInt16BE(p); p += 2; }
				ys.push(v);
			}
			const out = [];
			let start = 0;
			for (const end of ends) {
				const c = [];
				for (let i = start; i <= end; i++) c.push({ x: xs[i], y: ys[i], on: (flags[i] & 1) === 1 });
				out.push(c);
				start = end + 1;
			}
			return out;
		}
		// Composite
		const out = [];
		let p = o + 10;
		for (;;) {
			const flags = buf.readUInt16BE(p);
			const glyph = buf.readUInt16BE(p + 2);
			p += 4;
			let dx, dy;
			if (flags & 1) { dx = buf.readInt16BE(p); dy = buf.readInt16BE(p + 2); p += 4; }
			else { dx = buf.readInt8(p); dy = buf.readInt8(p + 1); p += 2; }
			if (!(flags & 2)) { dx = 0; dy = 0; }
			let m = [1, 0, 0, 1];
			const f2 = (q) => buf.readInt16BE(q) / 16384;
			if (flags & 8) { const s = f2(p); m = [s, 0, 0, s]; p += 2; }
			else if (flags & 0x40) { m = [f2(p), 0, 0, f2(p + 2)]; p += 4; }
			else if (flags & 0x80) { m = [f2(p), f2(p + 2), f2(p + 4), f2(p + 6)]; p += 8; }
			for (const c of this.contours(glyph, depth + 1)) {
				out.push(c.map((pt) => ({ x: pt.x * m[0] + pt.y * m[2] + dx, y: pt.x * m[1] + pt.y * m[3] + dy, on: pt.on })));
			}
			if (!(flags & 0x20)) break;
		}
		return out;
	}

	// SVG path data of a glyph in font units, y flipped (y down), origin at
	// the baseline.
	path(gid) {
		if (this.paths.has(gid)) return this.paths.get(gid);
		const r = (v) => Math.round(v * 10) / 10;
		let d = '';
		for (const c of this.contours(gid)) {
			if (!c.length) continue;
			const pts = c.map((q) => ({ x: q.x, y: -q.y, on: q.on }));
			let startIdx = pts.findIndex((q) => q.on);
			let start;
			if (startIdx < 0) {
				start = { x: (pts[0].x + pts[1 % pts.length].x) / 2, y: (pts[0].y + pts[1 % pts.length].y) / 2, on: true };
				startIdx = 0;
			} else start = pts[startIdx];
			d += `M${r(start.x)} ${r(start.y)}`;
			let ctrl = null;
			const n = pts.length;
			const first = start === pts[startIdx] ? startIdx + 1 : startIdx;
			for (let k = 0; k < n; k++) {
				const q = pts[(first + k) % n];
				if (q === start) continue;
				if (q.on) {
					if (ctrl) { d += `Q${r(ctrl.x)} ${r(ctrl.y)} ${r(q.x)} ${r(q.y)}`; ctrl = null; }
					else d += `L${r(q.x)} ${r(q.y)}`;
				} else {
					if (ctrl) {
						const mx = (ctrl.x + q.x) / 2, my = (ctrl.y + q.y) / 2;
						d += `Q${r(ctrl.x)} ${r(ctrl.y)} ${r(mx)} ${r(my)}`;
					}
					ctrl = q;
				}
			}
			if (ctrl) d += `Q${r(ctrl.x)} ${r(ctrl.y)} ${r(start.x)} ${r(start.y)}`;
			d += 'Z';
		}
		this.paths.set(gid, d);
		return d;
	}
}

module.exports = { Font };
