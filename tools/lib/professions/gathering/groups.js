'use strict';
// Who goes where early on. Gathering guides branch by starting area for the
// first bands, by continent for the middle ones, and by faction after that.

const RACE_GROUPS = {
	Alliance: [
		{ key: 'human', races: ['Human'], start: [1429], next: [1436], c: 0 },
		{ key: 'dwarf-gnome', races: ['Dwarf', 'Gnome'], start: [1426], next: [1432], c: 0 },
		{ key: 'nightelf', races: ['NightElf'], start: [1438], next: [1439], c: 1 },
	],
	Horde: [
		{ key: 'orc-troll', races: ['Orc', 'Troll'], start: [1411], next: [1413], c: 1 },
		{ key: 'tauren', races: ['Tauren'], start: [1412], next: [1413], c: 1 },
		{ key: 'undead', races: ['Undead'], start: [1420], next: [1421], c: 0 },
	],
};

const REGIONS = {
	Alliance: [
		{ key: 'alliance-ek', races: ['Human', 'Dwarf', 'Gnome'], c: 0 },
		{ key: 'alliance-kalimdor', races: ['NightElf'], c: 1 },
	],
	Horde: [
		{ key: 'horde-kalimdor', races: ['Orc', 'Troll', 'Tauren'], c: 1 },
		{ key: 'horde-ek', races: ['Undead'], c: 0 },
	],
};

const SIDE = { Alliance: 'A', Horde: 'H' };

// Highest zone minimum level worth sending a character with skill `s` to
// (skill outpaces level: 65 -> 20, 125 -> 30, 200 -> 43, 260 -> 53).
function maxZoneLevel(s) {
	return Math.floor(s / 6) + 10;
}

module.exports = { RACE_GROUPS, REGIONS, SIDE, maxZoneLevel };
