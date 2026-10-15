'use strict';
// Arrow waypoints from the navigation grid (a pack's via.json, written by
// `nav via`) attached to compiled guides: each leg (legs.js) with an entry
// gives its goal `via` (the points the arrow leads through) and `viaFrom`
// (the leg's start). docs/PACK_FORMAT.md, "via.json".
//
// VIA_FILE: the file name in a pack folder.
// viaDocError(doc) -> null, or what is wrong with a parsed via.json.
// readViaFile(packDir) -> null (no file) or { file, doc, error }: the parsed
//   document, or why it cannot be used (`error`, with doc null).
// attachVia(guides, viaDoc, frames) -> [{ guide, missing }]: sets (and first
//   clears) goal.via/goal.viaFrom from viaDoc on the compiled guides, in
//   place; frames: map-frames.json. Lists the guides with legs that have no
//   entry, with their count; a leg into or out of a guide `goto` (a
//   hand-placed arrow fix) never counts.
// viaMissingMessage(n): the lint/compile warning for n legs without entries.

const fs = require('node:fs');
const path = require('node:path');
const { guideLegs } = require('./legs');

const VIA_FILE = 'via.json';
const VIA_SCHEMA = 1;

const isNum = (v) => typeof v === 'number' && Number.isFinite(v);

// A point: [map, x, y, frame ("e" | "l"), r (yd), label | null, inner (0 | 1)];
// a missing `inner` is 0.
function pointError(p) {
	if (!Array.isArray(p) || (p.length !== 6 && p.length !== 7)) return 'is not [map, x, y, frame, r, label, inner]';
	const [map, x, y, f, r, label, inner = 0] = p;
	if (!Number.isInteger(map) || map <= 0) return `has map ${JSON.stringify(map)}, not a uiMapID`;
	if (!isNum(x) || !isNum(y) || x < 0 || x > 100 || y < 0 || y > 100) return 'has coordinates outside 0-100';
	if (f !== 'e' && f !== 'l') return `has frame ${JSON.stringify(f)}, not "e" or "l"`;
	if (!isNum(r) || r <= 0) return `has radius ${JSON.stringify(r)}, not a positive number`;
	if (label !== null && (typeof label !== 'string' || label === '')) return 'has a label that is neither text nor null';
	if (inner !== 0 && inner !== 1) return `has inner ${JSON.stringify(inner)}, not 0 or 1`;
	return null;
}

function viaDocError(doc) {
	if (!doc || typeof doc !== 'object' || Array.isArray(doc)) return 'is not a JSON object';
	if (doc.schema !== VIA_SCHEMA) return `has schema ${JSON.stringify(doc.schema)}, expected ${VIA_SCHEMA}`;
	if (!doc.guides || typeof doc.guides !== 'object' || Array.isArray(doc.guides)) return 'has no `guides` object';
	for (const [id, entries] of Object.entries(doc.guides)) {
		if (!entries || typeof entries !== 'object' || Array.isArray(entries)) return `guide ${id}: its legs are not an object`;
		for (const [key, entry] of Object.entries(entries)) {
			if (!entry || typeof entry !== 'object' || !Array.isArray(entry.via)) return `guide ${id}, leg ${key}: no \`via\` list`;
			if (entry.manual !== undefined && typeof entry.manual !== 'boolean') return `guide ${id}, leg ${key}: \`manual\` is not true or false`;
			if (entry.hand !== undefined && typeof entry.hand !== 'boolean') return `guide ${id}, leg ${key}: \`hand\` is not true or false`;
			if (entry.hand && entry.manual) return `guide ${id}, leg ${key}: \`hand\` and \`manual\` together`;
			if (entry.hand && entry.via.length) return `guide ${id}, leg ${key}: a \`hand\` leg (a hand-made path serves it) has points`;
			for (let i = 0; i < entry.via.length; i++) {
				const why = pointError(entry.via[i]);
				if (why) return `guide ${id}, leg ${key}: point ${i + 1} ${why}`;
			}
		}
	}
	return null;
}

function readViaFile(packDir) {
	const file = path.join(packDir, VIA_FILE);
	let text;
	try {
		text = fs.readFileSync(file, 'utf8');
	} catch (e) {
		if (e.code === 'ENOENT') return null;
		return { file, doc: null, error: `cannot be read (${e.message})` };
	}
	let doc;
	try {
		doc = JSON.parse(text);
	} catch (e) {
		return { file, doc: null, error: `is not valid JSON (${e.message})` };
	}
	const error = viaDocError(doc);
	return error ? { file, doc: null, error } : { file, doc, error: null };
}

// A via.json point as the compiled goal carries it: f only for Era, label and
// inner only when set.
function viaPoint([map, x, y, f, r, label, inner]) {
	const p = { map, x, y };
	if (f === 'e') p.f = 'e';
	p.r = r;
	if (label !== null) p.label = label;
	if (inner === 1) p.inner = true;
	return p;
}

function endPoint(e) {
	const p = { map: e.map, x: e.x, y: e.y };
	if (e.f === 'e') p.f = 'e';
	return p;
}

function attachVia(guides, viaDoc, frames) {
	const missing = [];
	const all = (viaDoc && viaDoc.guides) || {};
	for (const guide of guides) {
		for (const step of guide.steps || []) {
			for (const goal of step.goals || []) {
				delete goal.via;
				delete goal.viaFrom;
			}
		}
		const entries = Object.prototype.hasOwnProperty.call(all, guide.id) ? all[guide.id] : {};
		let n = 0;
		for (const leg of guideLegs(guide, { frames })) {
			const entry = Object.prototype.hasOwnProperty.call(entries, leg.key) ? entries[leg.key] : null;
			if (!entry) {
				// A leg into or out of a guide `goto` is a hand-placed arrow fix:
				// `nav via` writes nothing for it, so it is never missing.
				if (!leg.from.isGoto && !leg.to.isGoto) n++;
				continue;
			}
			if (!entry.via.length) continue;
			const goal = guide.steps[leg.si].goals[leg.gi];
			goal.via = entry.via.map(viaPoint);
			goal.viaFrom = endPoint(leg.from);
		}
		if (n) missing.push({ guide, missing: n });
	}
	return missing;
}

function viaMissingMessage(n) {
	return `${n} ${n === 1 ? 'leg has' : 'legs have'} no waypoints from the navigation grid (run \`node tools/polestar.js nav via\`)`;
}

module.exports = { VIA_FILE, VIA_SCHEMA, viaDocError, readViaFile, attachVia, viaMissingMessage };
