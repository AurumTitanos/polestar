'use strict';
// tools/lib/data/races.js: the Forever client's ChrRaces / ChrClasses /
// CharBaseInfo rows -> races.json (playable races per side, bits, classes).

const { test } = require('node:test');
const assert = require('node:assert/strict');
const { buildRaces } = require('../tools/lib/data/races');

test('races.json: playable races per side with their mask bit and classes; Skyborne on both sides', () => {
	const ChrClasses = [
		{ ID: '1', Filename: 'WARRIOR' },
		{ ID: '2', Filename: 'PALADIN' },
		{ ID: '7', Filename: 'SHAMAN' },
		{ ID: '8', Filename: 'MAGE' },
	];
	const ChrRaces = [
		{ ID: '5', ClientFileString: 'Scourge', Alliance: '1', PlayableRaceBit: '4' },
		{ ID: '10', ClientFileString: 'BloodElf', Alliance: '1', PlayableRaceBit: '9' },
		{ ID: '95', ClientFileString: 'Skyborne', Alliance: '0', PlayableRaceBit: '32' },
		{ ID: '96', ClientFileString: 'Skyborne', Alliance: '1', PlayableRaceBit: '33' },
	];
	const CharBaseInfo = [
		{ RaceID: '5', ClassID: '2' },
		{ RaceID: '5', ClassID: '1' },
		{ RaceID: '95', ClassID: '8' },
		{ RaceID: '95', ClassID: '1' },
		{ RaceID: '96', ClassID: '7' },
		{ RaceID: '96', ClassID: '1' },
	];
	assert.deepEqual(buildRaces({ ChrRaces, ChrClasses, CharBaseInfo }), {
		Scourge: { Horde: { id: 5, bit: 16, classes: ['WARRIOR', 'PALADIN'] } },
		Skyborne: {
			Alliance: { id: 95, bit: 2 ** 32, classes: ['WARRIOR', 'MAGE'] },
			Horde: { id: 96, bit: 2 ** 33, classes: ['WARRIOR', 'SHAMAN'] },
		},
	});
});
