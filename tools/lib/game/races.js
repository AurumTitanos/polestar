'use strict';
// Races and classes, once for every tool: their names, the client's file
// names and their bits in the Blizzard masks quests.json and the client's
// tables carry (docs/ARCHITECTURE.md).

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
const ALL_CLASSES = Object.values(CLASSES).reduce((m, c) => m | c.bit, 0);

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

// Skyborne's bit on each side, past 32 bits: only arithmetic (hasBit) reads it.
const SKYBORNE_BIT = RACES.skyborne.sides;
// The Era races of each side (bits 0-7), safe for 32-bit bitwise operators.
const FACTION_RACES = { Alliance: 0, Horde: 0 };
for (const r of Object.values(RACE_BY_FILE)) {
	for (const [side, bit] of Object.entries(r.sides)) if (bit < 2 ** 32) FACTION_RACES[side] |= bit;
}
const ALL_RACES = FACTION_RACES.Alliance | FACTION_RACES.Horde;

// Is a single power-of-two bit set in a mask? Arithmetic, so bits past 2^31 work.
function hasBit(mask, bit) {
	return bit > 0 && Math.floor(mask / bit) % 2 === 1;
}

// Names as guides and reports write them: race files except Scourge (written
// Undead), classes in title case.
function raceLabel(file) {
	return file === 'Scourge' ? 'Undead' : file;
}

function classLabel(file) {
	return file.charAt(0) + file.slice(1).toLowerCase();
}

module.exports = {
	CLASSES, CLASS_FILES, CLASS_BY_FILE, ALL_CLASSES,
	RACES, RACE_BY_FILE, RACE_FILES, SIDES,
	SKYBORNE_BIT, FACTION_RACES, ALL_RACES,
	hasBit, raceLabel, classLabel,
};
