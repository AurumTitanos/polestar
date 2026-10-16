'use strict';
// Polestar.Theme (colour schemes, custom colours, legibility, the
// EllesmereUI path), Polestar.Anim, and the textures the UI shows.

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { runAddon, ADDONS } = require('./helpers/lua');

const FILES = ['Core/Core.xml', 'Theme/Theme.xml', 'UI/UI.xml'];

function run(script, { before = '' } = {}) {
	return runAddon({
		stubs: ['stub_ui.lua'],
		before,
		addons: [{ name: 'Polestar', files: FILES }],
		script: `uistub.install()\nstub.login()\nlocal T, W = Polestar.Theme, Polestar.Widgets\n${script}`,
	}).emitted;
}

const round = (list) => list.map((v) => Math.round(v * 1000) / 1000);

// WCAG 2 contrast, computed here independently of Theme.Contrast.
const lin = (c) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
const lum = ([r, g, b]) => 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
const contrast = (a, b) => {
	const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p);
	return (x + 0.05) / (y + 0.05);
};
const GROUNDS = ['bg', 'panel', 'panelAlt', 'sidebar', 'footer', 'sky'];
const SUBJECTS = ['quest', 'npc', 'item', 'place', 'object', 'level', 'skill', 'spell', 'faction', 'area', 'achievement', 'dungeon', 'rare', 'success', 'warning', 'danger'];

// Every ground must carry primary text at 7:1 and the secondary and muted
// text at 4.5:1; the subject and status colours need 4.5:1 on every ground
// but the header sky (only titles sit on the band).
function assertLegible(name, pal) {
	for (const g of GROUNDS) {
		assert.ok(contrast(pal.text, pal[g]) >= 7, `${name}: text on ${g} is ${contrast(pal.text, pal[g]).toFixed(2)}:1`);
		for (const role of ['textDim', 'textMuted', ...(g === 'sky' ? [] : SUBJECTS)]) {
			const c = contrast(pal[role], pal[g]);
			assert.ok(c >= 4.5, `${name}: ${role} on ${g} is ${c.toFixed(2)}:1`);
		}
	}
}

test('every colour scheme keeps the text ladder legible on every ground (7:1 primary, 4.5:1 the rest)', () => {
	const [out] = run(`
		local out = {}
		for _, key in ipairs(T.SCHEME_ORDER) do
			Polestar.Set("ui.scheme", key)
			out[key] = T.Palette()
		end
		emit(out)`);
	assert.deepEqual(Object.keys(out).sort(), ['dusk', 'graphite', 'night']);
	for (const [key, pal] of Object.entries(out)) assertLegible(key, pal);
});

// Colours from outside the palette go through Theme.Legible: the client's
// item qualities (Poor..Artifact) and quest difficulty colours. A dimmed name
// keeps that colour (its chip says why), so each must read at 4.5:1 on the
// lightest place a name sits, a selected row on the panel.
test('item quality and quest difficulty colours, lifted, read at 4.5:1 on a selected row in every scheme', () => {
	const [out] = run(`
		local OUTSIDE = {
			{ 0.62, 0.62, 0.62 }, { 1, 1, 1 }, { 0.12, 1, 0 }, { 0, 0.44, 0.87 }, { 0.64, 0.21, 0.93 }, { 1, 0.5, 0 }, { 0.9, 0.8, 0.5 },
			{ 1, 0.1, 0.1 }, { 1, 0.5, 0.25 }, { 1, 0.82, 0 }, { 0.25, 0.75, 0.25 }, { 0.5, 0.5, 0.5 },
		}
		local out = {}
		for _, key in ipairs(T.SCHEME_ORDER) do
			Polestar.Set("ui.scheme", key)
			local o = { ground = T.LightestGround(), panel = T.Palette().panel, lifted = {}, epic = { Polestar.UI.Lookup.QualityColor(4) } }
			for i, c in ipairs(OUTSIDE) do o.lifted[i] = { T.Legible(c[1], c[2], c[3]) } end
			out[key] = o
		end
		emit(out)`);
	for (const [key, o] of Object.entries(out)) {
		assert.ok(lum(o.ground) > lum(o.panel), `${key}: a selected row is lighter than the panel`);
		o.lifted.forEach((c, i) => {
			const r = contrast(c, o.ground);
			assert.ok(r >= 4.5, `${key}: outside colour ${i + 1} reads ${r.toFixed(2)}:1 on a selected row`);
		});
		const epic = contrast(o.epic, o.ground);
		assert.ok(epic >= 4.5, `${key}: an epic name (the retired Reins of the Frostsaber) reads ${epic.toFixed(2)}:1`);
	}
});

test('Dusk is the default and visibly lighter than Night; Night keeps the original palette exactly', () => {
	const [out] = run(`
		local dusk = T.Palette()
		Polestar.Set("ui.scheme", "night")
		emit({ key = dusk.scheme, dusk = dusk, night = T.Palette() })`);
	assert.equal(out.key, 'dusk');
	for (const g of ['bg', 'panel', 'panelAlt', 'sidebar', 'footer', 'sky']) {
		assert.ok(lum(out.dusk[g]) > lum(out.night[g]) * 2, `Dusk ${g} is clearly lighter`);
		assert.ok(out.dusk[g][2] > out.dusk[g][0], `Dusk ${g} stays navy, not grey`);
	}
	assert.deepEqual(round(out.night.bg), [0.039, 0.051, 0.086, 0.97]);
	assert.deepEqual(round(out.night.panel), [0.051, 0.066, 0.11, 0.98]);
	assert.deepEqual(round(out.night.panelAlt), [0.075, 0.094, 0.149, 1]);
	assert.deepEqual(round(out.night.sidebar), [0.027, 0.035, 0.063, 1]);
	assert.deepEqual(round(out.night.footer), [0.031, 0.04, 0.071, 1]);
	assert.deepEqual(round(out.night.text), [0.96, 0.97, 0.99, 1]);
	assert.deepEqual(round(out.night.textDim), [0.69, 0.72, 0.8, 1]);
	assert.deepEqual(round(out.night.textMuted), [0.5, 0.54, 0.63, 1]);
});

test('custom ground colour and brightness repaint live and can never make text illegible', () => {
	const [out] = run(`
		local tex = W.Tex(UIParent, "ARTWORK", "white", "bg")
		local sky = T.Band(UIParent)
		local before = { tex:GetVertexColor() }
		local skyBefore = { sky:GetVertexColor() }
		Polestar.Set("ui.bgColor", { 0.2, 0.05, 0.1 })
		local custom = { tex:GetVertexColor() }
		local skyCustom = { sky:GetVertexColor() }
		Polestar.Set("ui.brightness", 0.5)
		local lifted = T.Palette()
		Polestar.Set("ui.bgColor", { 1, 1, 1 })
		Polestar.Set("ui.brightness", 1)
		local white = T.Palette()
		Polestar.Set("ui.bgColor", nil)
		Polestar.Set("ui.brightness", -1)
		local low = T.Palette()
		Polestar.Set("ui.brightness", nil)
		emit({ before = before, custom = custom, skyBefore = skyBefore, skyCustom = skyCustom, lifted = lifted, white = white, low = low,
			back = { tex:GetVertexColor() }, legible = T.Legibility(white) })`);
	assert.notDeepEqual(out.custom, out.before);
	assert.ok(out.custom[0] > out.custom[2], 'the ground takes the custom hue');
	assert.notDeepEqual(out.skyCustom, out.skyBefore, 'the band follows the ground');
	assert.ok(lum(out.lifted.bg) > lum(out.custom), 'brightness lifts the ground');
	assertLegible('custom + lifted', out.lifted);
	assertLegible('white ground at full brightness', out.white);
	assertLegible('darkest', out.low);
	assert.ok(out.legible >= 1);
	assert.deepEqual(out.back.slice(0, 3), out.before.slice(0, 3), 'right-click reset (nil) returns to the scheme');
});

test('house style: the game\'s font by default and Inter on request, Polestar gold, a user accent that repaints what follows it', () => {
	const [out] = run(`
		local fs = UIParent:CreateFontString()
		T.Font(fs, "title")
		local before = { fs:GetFont() }
		local tex = W.Tex(UIParent, "ARTWORK", "white", "accent")
		local fired = 0
		T.OnChanged(function() fired = fired + 1 end)
		local d = { T.Accent() }
		Polestar.Set("ui.accent", { 1, 0.5, 0 })
		local tr, tg, tb = tex:GetVertexColor()
		Polestar.Set("ui.font", "inter")
		local inter = { fs:GetFont() }
		Polestar.Set("ui.bgOpacity", 0.5)
		local bgAlpha = select(4, PolestarGuideFrame.psSkin.bg:GetVertexColor())
		T.SetOutline(fs, true)
		local outlined = select(3, fs:GetFont())
		emit({ before = before, inter = inter, default = d, tex = { tr, tg, tb }, fired = fired, eui = T.IsEllesmere(),
			border = PolestarGuideFrame.psBorder ~= nil, shadow = PolestarGuideFrame.psShadow:IsShown(), bgAlpha = bgAlpha,
			outlined = outlined, media = T.Media("check"), verb = T.VerbIcon("kill"),
			band = { T.BandCoords(720, 112) }, schemes = T.SchemeChoices() })`);
	assert.deepEqual(out.before, ['Fonts\\FRIZQT__.TTF', 15, ''], 'the game\'s own font by default');
	assert.deepEqual(out.inter, ['Interface\\AddOns\\Polestar\\Media\\Fonts\\Inter-SemiBold.ttf', 15, ''], 'ui.font = inter re-fonts live');
	assert.deepEqual(round(out.default), [0.9, 0.73, 0.4], 'Polestar gold');
	assert.deepEqual(out.tex, [1, 0.5, 0]);
	assert.ok(out.fired >= 1);
	assert.equal(out.eui, false);
	assert.equal(out.border, true);
	assert.equal(out.shadow, true);
	assert.equal(out.bgAlpha, 0.5);
	assert.equal(out.outlined, 'OUTLINE');
	assert.equal(out.media, 'Interface\\AddOns\\Polestar\\Media\\UI\\check');
	assert.equal(out.verb, 'Interface\\AddOns\\Polestar\\Media\\UI\\icon-kill');
	assert.deepEqual(round(out.band), [0, 0.703, 0, 0.875], 'the band is cropped to the header, never stretched');
	assert.deepEqual(out.schemes.map((c) => c.value), ['dusk', 'night', 'graphite'], 'EllesmereUI is offered only when installed');
});

test('settings from before schemes: a stored gold accent was the old default; any other stays the user\'s own', () => {
	const ui = (accent) => `PolestarDB = { schema = 1, settings = { ui = { accent = ${accent} } } }`;
	const [gold] = run(`emit({ accent = Polestar.Get("ui.accent"), live = { T.Accent() } })`, { before: ui('{ 0.9, 0.73, 0.4 }') });
	assert.equal(gold.accent, false);
	assert.deepEqual(round(gold.live), [0.9, 0.73, 0.4]);
	const [own] = run(`emit({ accent = Polestar.Get("ui.accent"), live = { T.Accent() } })`, { before: ui('{ 0.2, 0.6, 1 }') });
	assert.deepEqual(own.accent, [0.2, 0.6, 1]);
	assert.deepEqual(round(own.live), [0.2, 0.6, 1]);
});

test('EllesmereUI: an optional scheme and follow toggles, never a lock', () => {
	const [out] = run(`
		local fs = UIParent:CreateFontString()
		T.Font(fs, "body")
		local GF = Polestar.UI.GuideFrame
		uistub.setGuide(uistub.elwynn, 3)
		local function fill() local r, g, b = GF.parts.line.Fill:GetVertexColor() return { r, g, b } end
		local before = fill()
		local fired = 0
		T.OnChanged(function() fired = fired + 1 end)
		stub.setAccent(0.6, 0.48, 1)
		local after = fill()
		local followFont = { fs:GetFont() }
		local schemes = T.SchemeChoices()
		Polestar.Set("ui.scheme", "ellesmere")
		local euiGround = { T.Color("bg") }
		local euiPal = T.Palette()
		Polestar.UI.ShowOptions("appearance")
		local look = Polestar.UI.Options.Controls("appearance")
		local swatch = look["ui.accent"]
		local note = swatch.Note:GetText()
		swatch:Click("LeftButton")
		local opened = ColorPickerFrame.info ~= nil
		ColorPickerFrame.GetColorRGB = function() return 0.1, 0.8, 0.3 end
		ColorPickerFrame.info.swatchFunc()
		local picked = { accent = { T.Accent() }, match = Polestar.Get("ui.matchAccent"), fill = fill() }
		ColorPickerFrame.info.cancelFunc()
		local cancelled = { accent = Polestar.Get("ui.accent"), match = Polestar.Get("ui.matchAccent") }
		Polestar.Set("ui.accent", { 1, 0, 0 })
		local own = Polestar.Get("ui.matchAccent")
		look["ui.matchAccent"]:Click()
		local rematched = { accent = Polestar.Get("ui.accent"), live = { T.Accent() } }
		local font = look["ui.font"]
		local fontLabel = font.Button.Label:GetText()
		font.Button:Click()
		local items = {}
		for _, r in ipairs(PolestarMenu.rows) do if r:IsShown() then items[#items + 1] = r.Text:GetText() end end
		for _, r in ipairs(PolestarMenu.rows) do if r:IsShown() and r.Text:GetText() == "Inter" then r:Click() end end
		local inter = { match = Polestar.Get("ui.matchFont"), font = { fs:GetFont() }, label = font.Button.Label:GetText() }
		look["ui.matchFont"]:Click()
		emit({ registered = stub.skinRegistered, eui = T.IsEllesmere(), skinned = #stub.skinned,
			shellArt = PolestarGuideFrame.euiSkin or false, houseBg = PolestarGuideFrame.psSkin.bg:IsShown(),
			band = GF.parts.band:IsShown(), followFont = followFont, before = before, after = after, fired = fired,
			schemes = schemes, euiGround = euiGround, euiPal = euiPal, note = note, opened = opened, enabled = swatch:IsEnabled(),
			picked = picked, cancelled = cancelled, own = own, rematched = rematched, fontLabel = fontLabel, items = items, inter = inter,
			refollow = { fs:GetFont() } })`, { before: 'stub.withEllesmere()' });
	assert.equal(out.registered, 'Polestar');
	assert.equal(out.eui, true);
	assert.equal(out.skinned, 0, 'no EllesmereUI primitive replaces Polestar art');
	assert.equal(out.shellArt, false);
	assert.equal(out.houseBg, true);
	assert.equal(out.band, true);
	assert.deepEqual(out.followFont, ['Fonts\\FRIZQT__.TTF', 13, ''], 'the game\'s font by default, even with EllesmereUI');
	assert.deepEqual(round(out.before), [0.05, 0.82, 0.62], 'follows its accent by default');
	assert.deepEqual(round(out.after), [0.6, 0.48, 1], 'S.OnLooksChanged repaints accent-coloured elements');
	assert.ok(out.fired >= 1);
	assert.deepEqual(out.schemes.map((c) => c.value), ['dusk', 'night', 'graphite', 'ellesmere']);
	assert.ok(Math.abs(out.euiGround[0] - out.euiGround[2]) < 0.03, 'the EllesmereUI scheme takes its neutral panel colour');
	assert.equal(out.euiGround[3], 0.95, 'and its opacity');
	assertLegible('ellesmere', out.euiPal);
	assert.equal(out.note, 'EllesmereUI', 'the swatch says where the accent comes from');
	assert.equal(out.enabled, true, 'the accent is always editable');
	assert.equal(out.opened, true);
	assert.deepEqual(round(out.picked.accent), [0.1, 0.8, 0.3]);
	assert.equal(out.picked.match, false, 'picking your own accent turns following off');
	assert.deepEqual(round(out.picked.fill), [0.1, 0.8, 0.3]);
	assert.deepEqual(out.cancelled, { accent: false, match: true }, 'cancel restores both');
	assert.equal(out.own, false);
	assert.equal(out.rematched.accent, false, 'following again drops your own accent');
	assert.deepEqual(round(out.rematched.live), [0.6, 0.48, 1]);
	assert.equal(out.fontLabel, 'Game font');
	assert.deepEqual(out.items, ['Game font', 'Inter', 'EllesmereUI']);
	assert.equal(out.inter.match, false, 'choosing another font turns following off');
	assert.deepEqual(out.inter.font, ['Interface\\AddOns\\Polestar\\Media\\Fonts\\Inter-Medium.ttf', 13, '']);
	assert.equal(out.inter.label, 'Inter');
	assert.deepEqual(out.refollow, ['Interface\\AddOns\\EllesmereUI\\media\\fonts\\Expressway.ttf', 13, '']);
});

// The class colour as the accent: it follows the player's class, lifted until
// it reads as text (shaman blue is too dark on the night grounds as it is),
// and it is one source among three: your own colour, your class's,
// EllesmereUI's; choosing one turns the others off.
test('class colour accent: follows the class, lifted to read, and takes turns with your own accent and EllesmereUI\'s', () => {
	const [out] = run(`
		UnitClass = function() return "Shaman", "SHAMAN", 7 end
		local raw = RAID_CLASS_COLORS.SHAMAN
		Polestar.Set("ui.classAccent", true)
		local shaman = { T.Accent() }
		local pal = T.Palette()
		local panel = pal.panel
		local follows = { class = T.FollowsClassAccent(), eui = T.FollowsEllesmereAccent(), match = Polestar.Get("ui.matchAccent") }
		Polestar.Set("ui.accent", { 1, 0.5, 0 })
		local own = { class = Polestar.Get("ui.classAccent"), accent = { T.Accent() } }
		Polestar.Set("ui.classAccent", true)
		local back = { accent = Polestar.Get("ui.accent"), live = { T.Accent() } }
		emit({ raw = { raw.r, raw.g, raw.b }, shaman = shaman, panel = { panel[1], panel[2], panel[3] }, follows = follows, own = own, back = back })`,
		{ before: 'stub.withEllesmere()' });
	assert.ok(contrast(out.raw, out.panel) < 4.5, 'raw shaman blue does not read on the panel');
	assert.ok(contrast(out.shaman, out.panel) >= 4.5, `lifted to ${contrast(out.shaman, out.panel).toFixed(2)}:1`);
	assert.ok(out.shaman[2] > out.shaman[0], 'still blue');
	assert.deepEqual(out.follows, { class: true, eui: false, match: false }, 'turning it on stops following EllesmereUI');
	assert.deepEqual(out.own, { class: false, accent: [1, 0.5, 0] }, 'your own accent turns it off');
	assert.equal(out.back.accent, false, 'turning it on again drops your own accent');
	assert.deepEqual(round(out.back.live), round(out.shaman));
});

test('Anim: OnUpdate exists only while a tween runs; retargeting reuses the record', () => {
	const [out] = run(`
		local A = Polestar.Anim
		local f = CreateFrame("Frame")
		A.To(f, "alpha", 0, 1, 0.2, "out")
		local running = A.Active()
		stub.advance(0.1)
		local mid = f:GetAlpha()
		local rec = f.psTweens.alpha
		A.To(f, "alpha", f:GetAlpha(), 0.5, 0.2)
		local reused = f.psTweens.alpha == rec and A.Active() == 1
		local done = false
		A.To(f, "width", 10, 100, 0.2, "out", function() done = true end)
		stub.advance(0.5)
		Polestar.Set("ui.reduceMotion", true)
		A.To(f, "width", 0, 50, 0.2)
		local snapped = f:GetWidth()
		emit({ running = running, mid = mid, reused = reused, done = done, final = f:GetAlpha(), width = snapped, active = A.Active() })`);
	assert.equal(out.running, 1);
	assert.ok(out.mid > 0.5 && out.mid < 1, `ease-out is past halfway at half time (${out.mid})`);
	assert.equal(out.reused, true);
	assert.equal(out.done, true);
	assert.equal(out.final, 0.5);
	assert.equal(out.width, 50, 'reduced motion: movement lands at once');
	assert.equal(out.active, 0);
});

// Every texture the UI sets must exist on disk, or the client draws a green box.
test('every texture the UI shows, and every goal verb icon, exists as a valid TGA', () => {
	const verbs = ['accept', 'turnin', 'complete', 'kill', 'collect', 'goto', 'talk', 'interact', 'use', 'sethome', 'hearth', 'getfp', 'fly', 'train', 'buy', 'vendor', 'level', 'note', 'skill', 'learn', 'craft', 'rep', 'explore', 'achieve'];
	const [paths] = run(`
		local GF, UI = Polestar.UI.GuideFrame, Polestar.UI
		local seen = {}
		local function collect()
			for _, f in ipairs(stub.frames) do
				for _, r in ipairs(f.regions) do
					if type(r.texture) == "string" then seen[r.texture] = true end
				end
			end
		end
		collect()
		uistub.openTabs({ { uistub.elwynn, 3 }, { uistub.tailoring, 2 }, { uistub.stormwindRep, 2 } }, 1); collect()
		uistub.setStep(4); collect()
		uistub.setStep(8); collect()
		Polestar.Fire("GUIDE_OUTLEVELED", uistub.elwynn, "forever/alliance/02-westfall"); collect()
		GF.menuButton:Click(); collect()
		Polestar.Set("ui.compact", true); collect()
		Polestar.Set("ui.style", "transparent"); collect()
		uistub.complete(); collect()
		Polestar.Engine.SetGuide(nil); collect()
		UI.ShowPicker(); collect()
		for _, p in ipairs(UI.Options.Pages()) do
			UI.ShowOptions(p.key); collect()
			for _, t in ipairs(p.tabs) do UI.Options.Select(p.key, t); collect() end
		end
		for _, v in ipairs({ ${verbs.map((v) => `"${v}"`).join(', ')} }) do seen[T.VerbIcon(v)] = true end
		local out = {}
		for p in pairs(seen) do out[#out + 1] = p end
		table.sort(out)
		emit(out)`);
	const prefix = 'Interface\\AddOns\\Polestar\\Media\\UI\\';
	const ours = paths.filter((p) => p.startsWith(prefix)).map((p) => p.slice(prefix.length));
	assert.deepEqual(paths.filter((p) => !p.startsWith(prefix)), [], 'the UI only uses its own textures');
	for (const v of verbs) assert.ok(ours.includes(`icon-${v}`));
	for (const n of ['emblem', 'wordmark', 'band', 'watermark']) assert.ok(ours.includes(n), `${n} is used`);
	const missing = [];
	for (const n of ours) {
		const file = path.join(ADDONS, 'Polestar', 'Media', 'UI', `${n}.tga`);
		if (!fs.existsSync(file)) {
			missing.push(n);
			continue;
		}
		const b = fs.readFileSync(file);
		const w = b.readUInt16LE(12), h = b.readUInt16LE(14);
		assert.equal(b[2], 2, `${n}: uncompressed true-colour`);
		assert.ok((w & (w - 1)) === 0 && (h & (h - 1)) === 0, `${n} is ${w}x${h}`);
		let opaque = 0;
		for (let i = 18 + 3; i < b.length; i += 4) if (b[i] > 0) opaque++;
		assert.ok(opaque > 0, `${n} is empty`);
	}
	assert.deepEqual(missing, []);
	assert.ok(ours.length > 40, `the UI uses ${ours.length} textures`);
});

// Dark ink on the accent fill smears under a drop shadow; light text on the
// night ground keeps its shadow. Both must survive a scheme change (every
// string's font is repainted) and a button switching between the two looks.
test('a primary button label has no drop shadow, a secondary one keeps it, across scheme changes and toggles', () => {
	const [out] = run(`
		local parent = UIParent
		local primary = W.Button(parent, "Open in new tab", nil, { primary = true, icon = "plus" })
		local secondary = W.Button(parent, "Load guide")
		local function alpha(b) local _, _, _, a = b.Label:GetShadowColor() return a end
		local out = { primary = alpha(primary), secondary = alpha(secondary) }
		Polestar.Set("ui.scheme", "night")
		out.primaryAfterScheme, out.secondaryAfterScheme = alpha(primary), alpha(secondary)
		primary.psPrimary, secondary.psPrimary = false, true
		W.RepaintButton(primary); W.RepaintButton(secondary)
		out.demoted, out.promoted = alpha(primary), alpha(secondary)
		emit(out)`);
	assert.equal(out.primary, 0);
	assert.equal(out.primaryAfterScheme, 0);
	assert.equal(out.promoted, 0);
	for (const k of ['secondary', 'secondaryAfterScheme', 'demoted']) assert.ok(out[k] > 0.5, `${k}: ${out[k]}`);
});

test('W.Link: an address in the accent with no box; under the cursor the text colour, an accent underline and "Click to copy"; a click runs its action', () => {
	const [out] = run(`
		local parent = UIParent
		local clicked = 0
		local link = W.Link(parent, "discord.gg/example", function() clicked = clicked + 1 end, { role = "note" })
		local function rgb(r, g, b) return { r, g, b } end
		local out = { text = link.Label:GetText(), width = link:GetWidth() > 0, height = link:GetHeight(),
			atRest = rgb(link.Label:GetTextColor()), accent = rgb(T.Color("accent")), line = link.Line:IsShown(),
			skinned = link.psSkin ~= nil }
		stub.RunScript(link, "OnEnter")
		out.hover = { color = rgb(link.Label:GetTextColor()), textColor = rgb(T.Color("text")), line = link.Line:IsShown(),
			lineColor = rgb(link.Line:GetVertexColor()), tip = GameTooltip.owner == link and GameTooltip:IsShown() }
		stub.RunScript(link, "OnLeave")
		out.left = { color = rgb(link.Label:GetTextColor()), line = link.Line:IsShown() }
		link:Click()
		out.clicked = clicked
		W.SetLinkText(link, "a much longer address than before")
		out.grew = link:GetWidth() > 0 and link.Label:GetText()
		emit(out)`);
	assert.equal(out.text, 'discord.gg/example');
	assert.equal(out.width, true);
	assert.equal(out.height, 20);
	assert.deepEqual(out.atRest, out.accent, 'the accent at rest');
	assert.equal(out.line, false);
	assert.equal(out.skinned, false, 'no box');
	assert.deepEqual(out.hover.color, out.hover.textColor, 'the text colour under the cursor');
	assert.equal(out.hover.line, true);
	assert.deepEqual(out.hover.lineColor, out.accent, 'an accent underline');
	assert.equal(out.hover.tip, true);
	assert.deepEqual(out.left, { color: out.accent, line: false });
	assert.equal(out.clicked, 1);
	assert.equal(out.grew, 'a much longer address than before');
});
