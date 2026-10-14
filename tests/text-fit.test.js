'use strict';
// Text stays inside its window. Every scene of `node tools/polestar.js
// preview` that shows one of Polestar's windows (the guide window, the hub on
// each section, Options on every page and tab, the welcome, the route
// choice, the rare alert, the report window and the copy window) is laid out
// through the preview's frame dump, in the game font and in Inter, and every
// visible string is checked against its window's edges and the frames that
// clip it.
//
// In game the client's font sets text about 13% wider than the preview's
// Inter metrics predict, so every glyph is measured 15% wider than the
// preview draws it, by the Lua (GetStringWidth: what the UI sizes and fits
// by at runtime) and by the check alike. A string bound in width (two
// anchors or SetWidth) is cut or wrapped by the client, so only its box has
// to fit; a wrapping one may grow in height, and outside a scroll area that
// growth has to fit too.

const { test } = require('node:test');
const assert = require('node:assert/strict');
const { runAddon } = require('./helpers/lua');
const P = require('../tools/commands/preview');
const { resolve, wrap, measure } = require('../tools/preview/render');

const SLACK = 1.15;
const H = { LEFT: 0, CENTER: 0.5, RIGHT: 1, TOPLEFT: 0, TOP: 0.5, TOPRIGHT: 1, BOTTOMLEFT: 0, BOTTOM: 0.5, BOTTOMRIGHT: 1 };
const V = { TOP: 0, CENTER: 0.5, BOTTOM: 1, TOPLEFT: 0, LEFT: 0.5, TOPRIGHT: 0, RIGHT: 0.5, BOTTOMLEFT: 1, BOTTOMRIGHT: 1 };
const WINDOWS = new Set(['PolestarGuideFrame', 'PolestarOptions', 'PolestarPicker', 'PolestarWelcome', 'PolestarRouteChoice', 'PolestarMenu', 'PolestarRareToast', 'PolestarReport', 'PolestarCopy']);
const PASSES = [['game font', ''], ['Inter', 'Polestar.Set("ui.font", "inter")\n']];

// The preview's fonts, every advance SLACK times wider.
const fonts = (() => {
	const base = P.loadFonts();
	const wide = new Map();
	return new Proxy({}, {
		get(_, k) {
			if (!wide.has(k)) {
				const f = base[k];
				wide.set(k, Object.create(f, { advanceEm: { value: (c) => f.advanceEm(c) * SLACK } }));
			}
			return wide.get(k);
		},
	});
})();
const prelude = P.metricsLua(fonts);
const intersect = (a, r) => ({ x0: Math.max(a.x0, r.x), y0: Math.max(a.y0, r.y), x1: Math.min(a.x1, r.x + r.w), y1: Math.min(a.y1, r.y + r.h) });
const px = (v) => Math.round(v * 10) / 10;

// -> the strings of one dump that do not fit: "text" crosses <what> by N px.
function audit(dump, roots) {
	const objects = dump.objects;
	const { byId, rects, scaleOf } = resolve(objects, fonts);
	const parentOf = (o) => (o.parent != null ? byId.get(o.parent) : null);
	const rootOf = (o) => {
		for (let cur = o; cur; cur = parentOf(cur)) if (roots.includes(cur.name)) return cur;
		return null;
	};
	const shown = (o) => {
		for (let cur = o; cur; cur = parentOf(cur)) if (!cur.shown || (cur.alpha ?? 1) <= 0.001) return false;
		return true;
	};
	const out = [];
	for (const o of objects) {
		if (o.kind !== 'FontString' || !o.plain || !o.plain.trim() || !shown(o)) continue;
		const root = rootOf(o);
		if (!root) continue;
		const r = rects.get(o.id);
		const s = scaleOf(o);
		const rr = rects.get(root.id);
		// The window, cut down by every clipping frame above the string; the
		// same without the scroll areas, for height (a scroll area scrolls).
		let box = { x0: rr.x, y0: rr.y, x1: rr.x + rr.w, y1: rr.y + rr.h, by: root.name };
		let fixed = { ...box };
		let scrolls = false;
		for (let cur = parentOf(o); cur && cur !== root; cur = parentOf(cur)) {
			if (!cur.clips) continue;
			const cr = rects.get(cur.id);
			box = { ...intersect(box, cr), by: box.by };
			if (cur.kind === 'ScrollFrame') scrolls = true;
			else fixed = intersect(fixed, cr);
		}
		const text = o.plain.replace(/\s+/g, ' ').trim();
		const report = (what, by) => out.push(`"${text.length > 70 ? text.slice(0, 67) + '...' : text}" crosses ${what} by ${px(by)}px`);
		const pts = o.points;
		const bound = o.anchoredW || (o.w != null && o.w > 0);
		if (!bound) {
			// Unbound: as wide as its text, grown from its anchor.
			const lines = o.plain.split('\n');
			const wide = Math.max(...lines.map((l) => measure(fonts, o.font, l))) * s;
			const hx = pts.length ? H[pts[0].point] ?? 0 : 0;
			const x0 = r.x + r.w * hx - wide * hx, x1 = x0 + wide;
			if (box.x0 - x0 > 0.5) report(`the left edge (${box.x0 === rr.x ? 'window' : 'clip'})`, box.x0 - x0);
			if (x1 - box.x1 > 0.5) report(`the right edge (${box.x1 === rr.x + rr.w ? 'window' : 'clip'})`, x1 - box.x1);
			continue;
		}
		if (box.x0 - r.x > 0.5) report('the left edge (its box)', box.x0 - r.x);
		if (r.x + r.w - box.x1 > 0.5) report('the right edge (its box)', r.x + r.w - box.x1);
		// Wrapping, its height free: the lines it takes in the wider font.
		const hasTop = pts.some((p) => V[p.point] === 0), hasBottom = pts.some((p) => V[p.point] === 1);
		if (!o.wrap || scrolls || (hasTop && hasBottom) || o.h != null || r.w <= 0) continue;
		let lines = wrap(fonts, o.font, o.plain, r.w / s);
		const h = (lines.length * o.font[1] + (lines.length - 1) * (o.spacing || 0)) * s;
		const vy = hasTop ? 0 : hasBottom ? 1 : 0.5;
		const y0 = r.y + r.h * vy - h * vy, y1 = y0 + h;
		if (fixed.y0 - y0 > 0.5) report('the top edge', fixed.y0 - y0);
		if (y1 - fixed.y1 > 0.5) report('the bottom edge', y1 - fixed.y1);
	}
	return out;
}

function auditPanels(label, panels) {
	const found = [];
	try {
		panels.forEach((p, i) => {
			for (const [font, prefix] of PASSES) {
				const dump = P.dumpPanel({ ...p, script: prefix + p.script }, prelude);
				for (const line of audit(dump, p.roots)) found.push(`${label} #${i + 1} (${font}): ${line}`);
			}
		});
	} finally {
		P.cleanupPacks();
	}
	return found;
}

const windowed = P.SCENES.filter((s) => s.panels.every((p) => p.roots.every((r) => WINDOWS.has(r))));

test('the audit covers the hub, Options, the guide window and the welcome', () => {
	const roots = new Set(windowed.flatMap((s) => s.panels.flatMap((p) => p.roots)));
	for (const r of ['PolestarGuideFrame', 'PolestarOptions', 'PolestarPicker', 'PolestarWelcome']) assert.ok(roots.has(r), r);
	const scripts = windowed.flatMap((s) => s.panels.map((p) => p.script)).join('\n');
	for (const section of ['Polestar.Lookup.Show', 'Polestar.Dungeons.Open', 'Polestar.Rares.Show', 'Polestar.UI.ShowPicker', '"guidepacks"']) {
		assert.ok(scripts.includes(section), section);
	}
});

for (const scene of windowed) {
	test(`text fits: ${scene.file}`, () => {
		const found = auditPanels(scene.file, scene.panels);
		assert.deepEqual(found, [], `text outside its window:\n${found.join('\n')}`);
	});
}

// Options on every page and tab, with every module's pages and the Recorder.
test('text fits: every Options page and tab', () => {
	const recorder = P.SCENES.find((s) => s.file === 'options-more.svg').panels[0].before;
	const pages = runAddon({
		stubs: ['stub_ui.lua'],
		before: recorder,
		addons: [{ name: 'Polestar', files: P.MODULE_FILES }],
		script: 'uistub.install()\nstub.login()\nemit(Polestar.UI.Options.Pages())',
	}).emitted[0];
	assert.ok(pages.length >= 8, `${pages.length} pages`);
	const panels = [];
	for (const p of pages) {
		const tabs = Array.isArray(p.tabs) && p.tabs.length ? p.tabs : [null];
		for (const t of tabs) {
			const select = t ? `; Polestar.UI.Options.Select(${JSON.stringify(p.key)}, ${JSON.stringify(t)})` : '';
			panels.push({ files: P.MODULE_FILES, before: recorder, roots: ['PolestarOptions'], name: `${p.key}${t ? ' > ' + t : ''}`, script: `Polestar.UI.ShowOptions(${JSON.stringify(p.key)})${select}` });
		}
	}
	const found = [];
	for (const panel of panels) found.push(...auditPanels(`Options ${panel.name}`, [panel]).map((l) => l.replace(/ #1 /, ' ')));
	assert.deepEqual(found, [], `text outside its window:\n${found.join('\n')}`);
});
