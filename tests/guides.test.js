'use strict';
// Plays every authored guide (guides/**, drafts excluded) to the end in the real
// engine: compiled with the real reference data, loaded with the full addon,
// once per class the guide branches on plus one class it never names. At each
// step the simulated player completes the first open goal the way a player
// would (accept, kill, loot, walk there, talk, train, bind, level up...). A
// step that cannot be completed, or an accept/turn-in without a location, fails
// the guide.
//
// Needs data/forever (node tools/polestar.js data build); skips without it.
// POLESTAR_GUIDES=<substring> limits the run to matching guide files.

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { ROOT } = require('./helpers/lua');
const { buildSimPack, playGuide } = require('./helpers/guide-sim');
const { findGuideFiles } = require('../tools/lib/dsl/project');
const { format } = require('../tools/lib/dsl/diag');

const GUIDES = path.join(ROOT, 'guides');
const DATA = path.join(ROOT, 'data', 'forever');
const CLASSES = ['WARRIOR', 'PALADIN', 'HUNTER', 'ROGUE', 'PRIEST', 'SHAMAN', 'MAGE', 'WARLOCK', 'DRUID'];

const all = fs.existsSync(GUIDES) ? findGuideFiles(GUIDES) : [];
const wanted = all.filter((f) => !process.env.POLESTAR_GUIDES || f.includes(process.env.POLESTAR_GUIDES));

// Every guide connected to a wanted guide through `next` (before or after it,
// any route option) compiles with it: turn-ins of quests picked up earlier in
// the chain validate, and `next` resolves. Only the wanted guides are played.
function withChain(targets) {
	const idOf = new Map();
	const fileOf = new Map(); // id -> file
	const nextOf = new Map(); // file -> next ids (every route option)
	const intoId = new Map(); // next id -> files whose `next` names it
	for (const rel of all) {
		const text = fs.readFileSync(path.join(GUIDES, rel), 'utf8');
		const id = (text.match(/^guide\s+(\S+)/m) || [])[1];
		const next = ((text.match(/^next\s+(.+)$/m) || [])[1] || '').split(/[\s,]+/).filter(Boolean);
		idOf.set(rel, id);
		fileOf.set(id, rel);
		nextOf.set(rel, next);
		for (const n of next) intoId.set(n, [...(intoId.get(n) || []), rel]);
	}
	const set = new Set(targets);
	const queue = [...targets];
	while (queue.length) {
		const rel = queue.pop();
		const linked = [...(intoId.get(idOf.get(rel)) || [])];
		for (const n of nextOf.get(rel) || []) if (fileOf.has(n)) linked.push(fileOf.get(n));
		for (const other of linked) {
			if (!set.has(other)) {
				set.add(other);
				queue.push(other);
			}
		}
	}
	return [...set].sort();
}
const files = withChain(wanted);
const play = new Set(wanted);
const skip = !fs.existsSync(path.join(DATA, 'quests.json'))
	? 'reference data not built (node tools/polestar.js data build)'
	: wanted.length === 0
		? 'no guides under guides/'
		: false;

// The classes `race` can be on `faction` in Forever (data/forever/races.json,
// from the client's CharBaseInfo); every class when that file is missing.
const RACE_CLASSES = fs.existsSync(path.join(DATA, 'races.json')) ? JSON.parse(fs.readFileSync(path.join(DATA, 'races.json'), 'utf8')) : null;
function playableClasses(race, faction) {
	const sides = RACE_CLASSES && RACE_CLASSES[race];
	const side = sides && (sides[faction] || Object.values(sides)[0]);
	return side ? side.classes : CLASSES;
}

// Classes named by any `only` in the guide that the race can be, plus one
// playable class the guide never names. A guide limited by its `class` header
// is played only as those classes.
function classesFor(guide, race, faction) {
	let can = playableClasses(race, faction);
	if (guide.classes && guide.classes.length) {
		const allowed = guide.classes.map((c) => String(c).toUpperCase());
		can = can.filter((c) => allowed.includes(c));
	}
	const named = new Set();
	const visit = (only) => {
		for (const c of (only && only.classes) || []) named.add(String(c).toUpperCase());
	};
	for (const s of guide.steps) {
		visit(s.only);
		for (const g of s.goals) visit(g.only);
	}
	const plain = can.find((c) => !named.has(c));
	return [...[...named].filter((c) => can.includes(c)), ...(plain ? [plain] : [])];
}

const ALLIANCE = ['Human', 'Dwarf', 'Gnome', 'NightElf'];
const HORDE = ['Orc', 'Troll', 'Tauren', 'Scourge'];
const sideOf = (race) => (HORDE.includes(race) ? 'Horde' : ALLIANCE.includes(race) ? 'Alliance' : null);

// Races the guide can be played as: those it names (header or any `only`)
// and those arriving from a previous guide (any route option: an Undead may
// pick the Barrens, a Human Darkshore), limited to its own faction and race
// list, plus a default race for each faction it allows that no named race
// covers. Faction follows the race.
function personasFor(guide, arriving = []) {
	const named = new Set(guide.races || []);
	const visit = (only) => {
		for (const r of (only && only.races) || []) named.add(r);
	};
	for (const s of guide.steps) {
		visit(s.only);
		for (const g of s.goals) visit(g.only);
	}
	for (const r of arriving) named.add(r);
	let races = [...named].map((r) => (r === 'Undead' ? 'Scourge' : r));
	races = [...new Set(races)].filter((r) => !guide.faction || !sideOf(r) || sideOf(r) === guide.faction);
	if (guide.races && guide.races.length) races = races.filter((r) => guide.races.map((x) => (x === 'Undead' ? 'Scourge' : x)).includes(r));
	for (const side of guide.faction ? [guide.faction] : ['Alliance', 'Horde']) {
		if (!races.some((r) => (sideOf(r) || side) === side)) races.push(side === 'Horde' ? 'Orc' : 'Human');
	}
	// A guide open to both factions (professions, reputation...) is also played
	// from the other home continent of each side, so "nearest" picks are tested
	// from Tirisfal and Teldrassil as well as Durotar and Elwynn.
	if (!guide.faction && !(guide.races && guide.races.length)) {
		for (const r of ['Scourge', 'NightElf']) if (!races.includes(r)) races.push(r);
	}
	return races.map((race) => ({ race, faction: sideOf(race) || guide.faction || 'Alliance' }));
}

test('every authored guide can be played to the end by every class it branches on', { skip }, () => {
	const pack = buildSimPack(files);
	try {
		const { guides, diag } = pack;
		assert.deepEqual(diag.errors.map(format), [], 'guides must compile without errors');

		// Races that reach each guide from a previous one, through any route option.
		const arriving = new Map();
		for (const g of guides) {
			for (const to of g.nextChoices || (g.next ? [g.next] : [])) arriving.set(to, [...(arriving.get(to) || []), ...(g.races || [])]);
		}
		const failures = [];
		for (const g of guides) {
			if (!play.has(g._ast && g._ast.source)) continue;
			for (const { race, faction } of personasFor(g, arriving.get(g.id))) for (const cls of classesFor(g, race, faction)) {
				const [out] = playGuide(pack, g, { race, faction, cls });
				const who = `${g.id} as ${faction} ${race === 'Scourge' ? 'Undead' : race} ${cls}`;
				if (!out.done) failures.push(`${who}: stuck at ${JSON.stringify(out.stuck)}`);
				for (const m of Object.values(out.missing || {})) failures.push(`${who}: no location for ${m}`);
				for (const m of Object.values(out.wrongPick || {})) failures.push(`${who}: ${m}`);
			}
		}
		assert.deepEqual([...new Set(failures)], []);
	} finally {
		pack.dispose();
	}
});
