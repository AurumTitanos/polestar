'use strict';
// Character conditions: class/race/faction names, the client's file names,
// and the Blizzard bitmasks used by quests.json (docs/ARCHITECTURE.md).

const CLASSES = {
	warrior: { file: 'WARRIOR', bit: 1 },
	paladin: { file: 'PALADIN', bit: 2 },
	hunter: { file: 'HUNTER', bit: 4 },
	rogue: { file: 'ROGUE', bit: 8 },
	priest: { file: 'PRIEST', bit: 16 },
	shaman: { file: 'SHAMAN', bit: 64 },
	mage: { file: 'MAGE', bit: 128 },
	warlock: { file: 'WARLOCK', bit: 256 },
	druid: { file: 'DRUID', bit: 1024 },
};
const CLASS_FILES = Object.values(CLASSES).map((c) => c.file);
const CLASS_BY_FILE = Object.fromEntries(Object.values(CLASSES).map((c) => [c.file, c]));

// Race names -> the client's race file (UnitRace's second return, ChrRaces
// ClientFileString) and, per side the race can be played on, its bit in quest
// race masks (2^PlayableRaceBit). Skyborne is one race file on both sides
// (ChrRaces 95 Alliance, 96 Horde) with bits past 32-bit bitwise operators.
// Facts from the Forever client (1.60.1.70338); data/forever/races.json holds
// the same, with each race's classes (tests/dsl.test.js keeps them in step).
const RACES = {
	human: { file: 'Human', sides: { Alliance: 1 } },
	orc: { file: 'Orc', sides: { Horde: 2 } },
	dwarf: { file: 'Dwarf', sides: { Alliance: 4 } },
	nightelf: { file: 'NightElf', sides: { Alliance: 8 } },
	undead: { file: 'Scourge', sides: { Horde: 16 } },
	scourge: { file: 'Scourge', sides: { Horde: 16 } },
	tauren: { file: 'Tauren', sides: { Horde: 32 } },
	gnome: { file: 'Gnome', sides: { Alliance: 64 } },
	troll: { file: 'Troll', sides: { Horde: 128 } },
	skyborne: { file: 'Skyborne', sides: { Alliance: 2 ** 32, Horde: 2 ** 33 } },
};
const RACE_BY_FILE = {};
for (const r of Object.values(RACES)) RACE_BY_FILE[r.file] = r;
const RACE_FILES = Object.keys(RACE_BY_FILE);
const SIDES = ['Alliance', 'Horde'];

// The factions a race file can be played on (both for an unknown race).
function raceSides(file) {
	const r = RACE_BY_FILE[file];
	return r ? Object.keys(r.sides) : SIDES.slice();
}

// Is a single power-of-two bit set in a mask? Arithmetic, so bits past 2^31 work.
function maskHas(mask, bit) {
	return Math.floor(mask / bit) % 2 === 1;
}

const FACTIONS = { alliance: 'Alliance', horde: 'Horde' };

const NAME_RE = /^!?[A-Za-z][A-Za-z0-9_]*$/;

// Parse a comma list into { classes, races, factions } (arrays or null), with
// class negations expanded to positive lists. `allow` limits which groups the
// list may use ('class' | 'race' | 'any'). Returns { value, errors, warnings }.
function parseConditions(list, allow = 'any') {
	const errors = [];
	const warnings = [];
	const pos = new Set();
	const neg = [];
	const races = [];
	const factions = [];
	const items = list.split(',').map((s) => s.trim());
	for (const raw of items) {
		if (!raw) {
			errors.push('empty condition in list');
			continue;
		}
		if (!NAME_RE.test(raw)) {
			errors.push(`malformed condition "${raw}"`);
			continue;
		}
		const negated = raw.startsWith('!');
		const name = (negated ? raw.slice(1) : raw).toLowerCase();
		if (CLASSES[name]) {
			if (allow === 'race') {
				errors.push(`"${raw}" is a class; use \`class\``);
				continue;
			}
			if (negated) neg.push(CLASSES[name].file);
			else pos.add(CLASSES[name].file);
			continue;
		}
		if (negated) {
			errors.push(`only classes can be negated ("${raw}")`);
			continue;
		}
		if (FACTIONS[name]) {
			if (allow !== 'any') {
				errors.push(`"${raw}" is a faction; use \`faction\``);
				continue;
			}
			if (!factions.includes(FACTIONS[name])) factions.push(FACTIONS[name]);
			continue;
		}
		if (allow === 'class') {
			errors.push(`unknown class "${raw}"`);
			continue;
		}
		if (RACES[name]) {
			if (!races.includes(RACES[name].file)) races.push(RACES[name].file);
			continue;
		}
		warnings.push(`unknown race "${raw}" passed through as a race file name (new Forever race?)`);
		if (!races.includes(raw)) races.push(raw);
	}
	let classes = null;
	if (pos.size || neg.length) {
		// Classes OR together: a negation contributes every class but itself.
		const set = new Set(pos);
		for (const n of neg) for (const f of CLASS_FILES) if (f !== n) set.add(f);
		classes = CLASS_FILES.filter((f) => set.has(f));
	}
	return {
		value: { classes, races: races.length ? races : null, factions: factions.length ? factions : null },
		errors,
		warnings,
	};
}

// Intersection of optional lists (null = unrestricted). Case-sensitive on
// canonical names produced by parseConditions.
function intersect(a, b) {
	if (!a) return b ? b.slice() : null;
	if (!b) return a.slice();
	return a.filter((x) => b.includes(x));
}

// Every character the given constraint layers can describe, as
// { races: [...], classes: [...], unknownRace: bool }. Layers are objects
// with optional faction/factions, races, classes.
function applicable(layers) {
	let factions = null;
	let races = null;
	let classes = null;
	for (const l of layers) {
		if (!l) continue;
		if (l.factions) factions = intersect(factions, l.factions);
		if (l.races) races = intersect(races, l.races);
		if (l.classes) classes = intersect(classes, l.classes);
	}
	if (!races) races = RACE_FILES.slice();
	if (factions) races = races.filter((r) => raceSides(r).some((s) => factions.includes(s)));
	if (!classes) classes = CLASS_FILES.slice();
	return { races, classes, factions: factions || SIDES.slice(), unknownRace: races.some((r) => !RACE_BY_FILE[r]) };
}

// Does a quest admit at least one applicable character? A race counts on every
// side the set allows it on (Skyborne: its Alliance and Horde bits). A mask only
// QuestieDB's Forever store can carry the Skyborne bits; one from pfQuest alone
// is an Era mask and never excludes Skyborne (docs/ARCHITECTURE.md).
// -> null when fine, else 'race' or 'class'.
function maskExcludes(set, quest) {
	const raceMask = quest.races;
	const classMask = quest.classes;
	if (raceMask != null && raceMask !== 0 && !set.unknownRace) {
		const forever = Array.isArray(quest.source) && quest.source.some((s) => String(s).startsWith('questie'));
		const admits = (r) =>
			Object.entries(RACE_BY_FILE[r].sides).some(([side, bit]) => set.factions.includes(side) && (maskHas(raceMask, bit) || (bit >= 2 ** 32 && !forever)));
		if (set.races.length && !set.races.some(admits)) return 'race';
	}
	if (classMask != null && classMask !== 0) {
		if (set.classes.length && !set.classes.some((c) => maskHas(classMask, CLASS_BY_FILE[c].bit))) return 'class';
	}
	return null;
}

// The characters every layer allows (applicable), as "race|class" keys, each
// race only with the classes `classesOf(race, side)` lists (class files; an
// empty list, or no `classesOf`, allows every class). Two layers fit a common
// character when their key sets share one.
function characterKeys(layers, classesOf = null) {
	const set = applicable(layers);
	const out = new Set();
	for (const race of set.races) {
		for (const side of raceSides(race)) {
			if (!set.factions.includes(side)) continue;
			const can = classesOf ? classesOf(race, side) : null;
			for (const cls of set.classes) if (!can || !can.length || can.includes(cls)) out.add(`${race}|${cls}`);
		}
	}
	return out;
}

// Names as guides write them: race files except Scourge (written Undead),
// classes in title case.
function raceLabel(file) {
	return file === 'Scourge' ? 'Undead' : file;
}

function classLabel(file) {
	return file.charAt(0) + file.slice(1).toLowerCase();
}

// Who a layer ({ faction, races, classes }) is for: "Dwarf/Gnome", "Human
// Paladin", "Alliance Paladin", "Alliance" or "both factions".
function whoLabel({ faction = null, races = null, classes = null }) {
	const r = races && races.length ? races.map(raceLabel).join('/') : faction;
	const c = classes && classes.length ? classes.map(classLabel).join('/') : null;
	return [r, c].filter(Boolean).join(' ') || 'both factions';
}

module.exports = {
	CLASSES,
	CLASS_FILES,
	RACES,
	RACE_FILES,
	RACE_BY_FILE,
	FACTIONS,
	parseConditions,
	intersect,
	applicable,
	raceSides,
	maskExcludes,
	characterKeys,
	raceLabel,
	classLabel,
	whoLabel,
};
