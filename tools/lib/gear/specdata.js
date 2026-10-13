'use strict';
// addon/Polestar/Gear/SpecData.lua: the generated half of Gear's spec data.
//
//   Gear.WEIGHT_BANDS[CLASS][spec] = { { upTo, weights, source, label, note }, ... }
//       Stat weights per level band. Polestar's authored leveling weights
//       (Gear/Weights.lua, solo questing: survival and regeneration count)
//       blended with wowsims' simulated weights where a sim exists for the
//       band (MIT). See BANDS for the levels and the blend.
//   Gear.RACIALS[raceID] = { weaponCrit = { pct, subclasses }, statMult }
//       from ForeverLevelingBiS's Racials.lua (MIT; Forever's own trait text).
//
// Only MIT material and Polestar's own numbers go in here.

const { luaToJson } = require('../lua');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..', '..', '..');
const WEIGHTS_LUA = path.join(ROOT, 'addon', 'Polestar', 'Gear', 'Weights.lua');

// Level bands and the sim level each one blends with. `alpha` is the share
// of Polestar's leveling weights: half while levelling (solo play needs the
// stamina and spirit raid sims value at nothing), a quarter at 60 (dungeon
// and raid gear, where the sim knows best).
const BANDS = [
	{ upTo: 24, sim: null, alpha: 1 },
	{ upTo: 39, sim: 25, alpha: 0.5 },
	{ upTo: 49, sim: 40, alpha: 0.5 },
	{ upTo: 59, sim: 50, alpha: 0.5 },
	{ upTo: 60, sim: 60, alpha: 0.25 },
];

const STAT_KEYS = new Set([
	'str', 'agi', 'sta', 'int', 'spi', 'armor', 'health', 'mana',
	'ap', 'rap', 'sp', 'spArcane', 'spFire', 'spFrost', 'spHoly', 'spNature', 'spShadow', 'heal',
	'crit', 'hit', 'spellCrit', 'spellHit', 'mp5', 'hp5', 'defense', 'dodge', 'parry', 'block', 'blockValue',
	'dps', 'rdps',
]);

const PHASE_LABEL = { 'sod-p1': 'SoD phase 1', 'sod-p2': 'SoD phase 2', 'sod-p3': 'SoD phase 3', 'sod-latest': 'SoD level 60', era: 'Classic Era' };

// The authored tables, read by running Weights.lua itself (one source of truth).
function authoredWeights() {
	return luaToJson({
		prelude: 'local ns = { Gear = {} }; __ns = ns',
		files: [],
		expr: `local chunk = assert(loadfile(${JSON.stringify(WEIGHTS_LUA)}))
chunk("Polestar", __ns)
return { weights = __ns.Gear.WEIGHTS, classes = __ns.Gear.CLASSES }`,
	});
}

// The sim entry for a band: the entry at that level; at 60 the Era entry
// (retuned for Era first, then the SoD carry-over), else SoD's latest.
function simFor(entries, level) {
	const at = (entries || []).filter((e) => e.level === level);
	if (!at.length) return null;
	if (level === 60) {
		return at.find((e) => e.phase === 'era' && e.origin === 'era') || at.find((e) => e.phase === 'era') || at[0];
	}
	return at[0];
}

function round(n) {
	return Math.round(n * 1000) / 1000;
}

// alpha * authored + (1 - alpha) * sim, the sim scaled so its main stat
// matches the authored table's value for that stat.
function blend(authored, sim, alpha) {
	const main = sim.normalizedTo;
	const scale = authored[main] > 0 ? authored[main] / (sim.weights[main] || 1) : null;
	if (!scale) return null;
	const out = {};
	const keys = new Set([...Object.keys(authored), ...Object.keys(sim.weights)]);
	for (const k of [...keys].sort()) {
		if (!STAT_KEYS.has(k)) continue;
		const v = alpha * (authored[k] || 0) + (1 - alpha) * (sim.weights[k] || 0) * scale;
		if (v > 0) out[k] = round(v);
	}
	return out;
}

function sameWeights(a, b) {
	return JSON.stringify(a) === JSON.stringify(b);
}

// -> { bands: { CLASS: { spec: [band] } }, counts }
function weightBands(wowsims, authored = authoredWeights()) {
	const out = {};
	const counts = { specs: 0, simBands: 0, authoredOnly: 0, bySim: {} };
	for (const [cls, specs] of Object.entries(authored.weights)) {
		for (const [spec, base] of Object.entries(specs)) {
			const entries = wowsims && wowsims.weights[cls] && wowsims.weights[cls][spec];
			const list = [];
			for (const band of BANDS) {
				const sim = band.sim ? simFor(entries, band.sim) : null;
				const w = sim ? blend(base, sim, band.alpha) : null;
				let rec;
				if (w) {
					const phase = PHASE_LABEL[sim.phase] || sim.phase;
					rec = {
						upTo: band.upTo,
						weights: w,
						source: `wowsims:${sim.repo}@${sim.commit.slice(0, 9)}:${sim.file}`,
						label: `Polestar leveling ${Math.round(band.alpha * 100)}% + wowsims ${phase} ${Math.round((1 - band.alpha) * 100)}%`,
						note: sim.runeInfluenced
							? 'Simulated with Season of Discovery runes; Forever has none, so the sim share is directional.'
							: 'Simulated for Classic Era; Forever may have retuned the class.',
					};
					counts.simBands++;
					counts.bySim[`${cls}.${spec}`] = (counts.bySim[`${cls}.${spec}`] || []).concat(`${band.upTo}:${sim.phase}`);
				} else {
					const sorted = Object.keys(base).sort();
					const w2 = {};
					for (const k of sorted) w2[k] = base[k];
					rec = { upTo: band.upTo, weights: w2, source: 'polestar', label: 'Polestar leveling', note: 'Authored from Classic stat formulas; no sim for this band.' };
					counts.authoredOnly++;
				}
				const prev = list[list.length - 1];
				if (prev && prev.source === rec.source && sameWeights(prev.weights, rec.weights)) prev.upTo = rec.upTo;
				else list.push(rec);
			}
			(out[cls] = out[cls] || {})[spec] = list;
			counts.specs++;
		}
	}
	return { bands: out, counts };
}

// FLB Racials.lua (by race ID) -> Gear.RACIALS.
function racials(flb) {
	const out = {};
	for (const [id, r] of Object.entries(flb.racials || {})) {
		const rec = {};
		if (r.weaponCrit) {
			rec.weaponCrit = { pct: r.weaponCrit.pct, subclasses: Object.keys(r.weaponCrit.subclasses || {}).map(Number).sort((a, b) => a - b), name: r.weaponCrit.name };
		}
		if (r.statMult) rec.statMult = r.statMult;
		out[id] = rec;
	}
	return out;
}

function lua(v, indent = '') {
	if (v === null || v === undefined) return 'nil';
	if (typeof v === 'number') return String(v);
	if (typeof v === 'boolean') return String(v);
	if (typeof v === 'string') return JSON.stringify(v).replace(/\\u00b7/g, '\\194\\183');
	if (Array.isArray(v)) return `{ ${v.map((x) => lua(x, indent)).join(', ')} }`;
	const keys = Object.keys(v);
	const parts = keys.map((k) => `${/^[A-Za-z_][A-Za-z0-9_]*$/.test(k) ? k : `[${/^\d+$/.test(k) ? k : JSON.stringify(k)}]`} = ${lua(v[k], indent)}`);
	return `{ ${parts.join(', ')} }`;
}

// -> SpecData.lua text
function emitSpecData({ bands, racials: rac, wowsimsMeta, flbMeta }) {
	const L = [
		'-- Generated by `node tools/polestar.js gear build`. Do not edit.',
		'-- Stat weight bands: Polestar\'s leveling weights (Weights.lua) blended with wowsims',
		`-- simulations (MIT, https://github.com/wowsims; ${wowsimsMeta ? 'see each band\'s source' : 'not available'}).`,
		`-- Racial gear traits: ForeverLevelingBiS ${flbMeta ? flbMeta.version : '?'} by Thunder (MIT), Racials.lua.`,
		'-- See THIRD_PARTY.md.',
		'',
		'local ADDON, ns = ...',
		'local Gear = ns.Gear',
		'',
		'Gear.WEIGHT_BANDS = {',
	];
	for (const cls of Object.keys(bands).sort()) {
		L.push(`\t${cls} = {`);
		for (const spec of Object.keys(bands[cls]).sort()) {
			L.push(`\t\t${spec} = {`);
			for (const b of bands[cls][spec]) {
				L.push(`\t\t\t{ upTo = ${b.upTo}, source = ${lua(b.source)}, label = ${lua(b.label)}, note = ${lua(b.note)},`);
				L.push(`\t\t\t\tweights = ${lua(b.weights)} },`);
			}
			L.push('\t\t},');
		}
		L.push('\t},');
	}
	L.push('}', '');
	L.push('-- Racial gear traits by race ID: weaponCrit (percent crit with these weapon subclasses), statMult.');
	L.push('Gear.RACIALS = {');
	for (const id of Object.keys(rac).sort((a, b) => a - b)) {
		const r = rac[id];
		const parts = [];
		if (r.weaponCrit) {
			const subs = r.weaponCrit.subclasses.map((s) => `[${s}] = true`).join(', ');
			parts.push(`weaponCrit = { pct = ${r.weaponCrit.pct}, subclasses = { ${subs} }, name = ${lua(r.weaponCrit.name)} }`);
		}
		if (r.statMult) parts.push(`statMult = ${lua(r.statMult)}`);
		L.push(`\t[${id}] = { ${parts.join(', ')} },`);
	}
	L.push('}', '');
	return L.join('\n');
}

module.exports = { weightBands, racials, emitSpecData, authoredWeights, blend, simFor, BANDS };
