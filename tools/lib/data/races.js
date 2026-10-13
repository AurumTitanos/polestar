'use strict';
// Forever DB2 ChrRaces, ChrClasses and CharBaseInfo rows (csv.js) -> races.json
//   { "<raceFile>": { "<Alliance|Horde>": { id, bit, classes: ["WARRIOR", ...] } } }
//
// raceFile is ChrRaces.ClientFileString, the token UnitRace("player") returns
// second ("Scourge", "Skyborne"). A race playable on both sides (Skyborne:
// ChrRaces 95 High Order / Alliance, 96 Windshaper / Horde) has one entry per
// side. bit = 2^PlayableRaceBit, the race's bit in quest race masks (Skyborne:
// 2^32 Alliance, 2^33 Horde, past 32-bit bitwise operators). classes are the
// race's class files from CharBaseInfo (the character-creation combinations),
// in ChrClasses ID order. Only races with a CharBaseInfo row are kept, so the
// retail races the client table also lists drop out.
//
// Side: ChrRaces.Alliance (0 Alliance, 1 Horde; 2 is neutral and never playable).

const SIDES = { 0: 'Alliance', 1: 'Horde' };

function int(v) {
	const n = Number(v);
	return Number.isFinite(n) ? Math.trunc(n) : null;
}

function buildRaces({ ChrRaces, ChrClasses, CharBaseInfo }) {
	const classFile = new Map();
	for (const c of ChrClasses) if (int(c.ID) !== null && c.Filename) classFile.set(int(c.ID), c.Filename);
	const classOrder = [...classFile.keys()].sort((a, b) => a - b);
	const classesOf = new Map();
	for (const b of CharBaseInfo) {
		const race = int(b.RaceID);
		const cls = int(b.ClassID);
		if (race === null || !classFile.has(cls)) continue;
		if (!classesOf.has(race)) classesOf.set(race, new Set());
		classesOf.get(race).add(cls);
	}
	const out = {};
	const rows = ChrRaces.filter((r) => classesOf.has(int(r.ID))).sort((a, b) => int(a.ID) - int(b.ID));
	for (const r of rows) {
		const side = SIDES[int(r.Alliance)];
		const bitIndex = int(r.PlayableRaceBit);
		if (!side || bitIndex === null || bitIndex < 0 || !r.ClientFileString) continue;
		const file = r.ClientFileString;
		if (!out[file]) out[file] = {};
		out[file][side] = {
			id: int(r.ID),
			bit: 2 ** bitIndex,
			classes: classOrder.filter((c) => classesOf.get(int(r.ID)).has(c)).map((c) => classFile.get(c)),
		};
	}
	return out;
}

module.exports = { buildRaces };
