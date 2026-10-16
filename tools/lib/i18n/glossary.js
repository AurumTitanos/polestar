'use strict';
// The translators' glossary: about forty game and Polestar terms, each with
// one chosen word per locale in glossary/<locale>.json, so a word reads the
// same on every page. A value comes from the client's own strings first (the
// GlobalStrings tag is kept in `client`), then from the reviewed translators'
// choices. `i18n check` warns (never fails) when a translation of a key that
// holds a term has none of its locale's forms.
//
//   { "accept": { "term": "Annehmen", "match": ["annehm", "angenommen", "nimm"], "client": "ACCEPT" } }
//
// `match` (default [term]) are the forms that count, compared without case
// or accents, anywhere in the translation (so "Ruhestein" counts in
// "Ruhesteins").

const fs = require('node:fs');
const path = require('node:path');

const GLOSSARY_DIR = path.join(__dirname, 'glossary');

// Term id -> its English forms, matched as whole words without case.
const TERMS = {
	guide: ['guide', 'guides'],
	step: ['step', 'steps'],
	goal: ['goal', 'goals'],
	objective: ['objective', 'objectives'],
	accept: ['accept', 'accepts', 'accepted'],
	'turn in': ['turn in', 'turn-in', 'turn-ins', 'turned in', 'hand in', 'handed in'],
	complete: ['complete', 'completes', 'completed'],
	skip: ['skip', 'skips', 'skipped'],
	quest: ['quest', 'quests'],
	'quest log': ['quest log'],
	'quest giver': ['quest giver', 'quest givers'],
	NPC: ['NPC', 'NPCs'],
	hearthstone: ['hearthstone'],
	'flight master': ['flight master', 'flight masters'],
	'flight path': ['flight path', 'flight paths'],
	innkeeper: ['innkeeper', 'innkeepers'],
	inn: ['inn', 'inns'],
	'class trainer': ['class trainer', 'class trainers'],
	trainer: ['trainer', 'trainers'],
	vendor: ['vendor', 'vendors', 'merchant', 'merchants'],
	arrow: ['arrow'],
	waypoint: ['waypoint', 'waypoints'],
	route: ['route', 'routes'],
	dungeon: ['dungeon', 'dungeons'],
	raid: ['raid', 'raids'],
	rare: ['rare', 'rares'],
	treasure: ['treasure', 'treasures'],
	elite: ['elite'],
	group: ['group', 'groups'],
	reputation: ['reputation', 'reputations'],
	profession: ['profession', 'professions'],
	talent: ['talent', 'talents'],
	reward: ['reward', 'rewards'],
	item: ['item', 'items'],
	mount: ['mount', 'mounts'],
	zone: ['zone', 'zones'],
	minimap: ['minimap'],
	'world map': ['world map'],
	level: ['level', 'levels'],
	boat: ['boat', 'boats'],
};

const fold = (s) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
const escape = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const ENGLISH = Object.fromEntries(Object.entries(TERMS).map(([id, forms]) => [id, new RegExp(`(?<![A-Za-z_])(?:${forms.map(escape).join('|')})(?![A-Za-z_])`, 'i')]));

// -> { [term id]: { term, match: [folded form], client } } or null when the
// locale has no glossary. Throws on a term id TERMS lacks or an entry without
// a term.
function readGlossary(locale, dir = GLOSSARY_DIR) {
	const file = path.join(dir, `${locale}.json`);
	if (!fs.existsSync(file)) return null;
	const raw = JSON.parse(fs.readFileSync(file, 'utf8'));
	const out = {};
	for (const [id, e] of Object.entries(raw)) {
		if (!TERMS[id]) throw new Error(`${file}: "${id}" is not a glossary term (tools/lib/i18n/glossary.js TERMS)`);
		if (!e || typeof e.term !== 'string' || !e.term) throw new Error(`${file}: "${id}" needs a "term"`);
		const match = Array.isArray(e.match) && e.match.length ? e.match : [e.term];
		out[id] = { term: e.term, match: match.map(fold), client: e.client || null };
	}
	return out;
}

// translated: { key: value }. -> [{ key, value, id, term }]: each translation
// whose English holds a term (outside a slash command such as "/pole mount")
// and which has none of that term's forms.
function glossaryWarnings(glossary, translated) {
	if (!glossary) return [];
	const out = [];
	for (const [key, value] of Object.entries(translated)) {
		const english = key.replace(/\/\w+ \w+/g, '');
		const v = fold(value);
		for (const [id, g] of Object.entries(glossary)) {
			if (!ENGLISH[id].test(english)) continue;
			if (!g.match.some((m) => v.includes(m))) out.push({ key, value, id, term: g.term });
		}
	}
	return out;
}

module.exports = { TERMS, GLOSSARY_DIR, readGlossary, glossaryWarnings };
