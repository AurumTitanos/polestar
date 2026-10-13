'use strict';
// Era DB2 Faction rows (csv.js) -> factions.json
//   { "<factionID>": { id, name, side: "Alliance"|"Horde"|null, parent, source: [] } }
//
// Kept: every faction with a reputation bar (ReputationIndex >= 0) plus the
// headers above it (ParentFactionID chain). Player/creature-template factions
// (ReputationIndex -1, e.g. "PLAYER, Human") are not reputations and are left
// out. Names are trimmed (the Era table pads profession sub-factions with a
// leading space).
//
// side, first rule that applies:
// 1. the faction is, or sits under, the Alliance (469) / Alliance Forces (891)
//    or Horde (67) / Horde Forces (892) header;
// 2. the reputation is locked to Hated (ReputationBase -42000) for exactly one
//    side's classic races (Wintersaber Trainers: Horde locked -> Alliance);
// otherwise null (neutral or not provable from the data).

const ALLIANCE_RACES = 1 | 4 | 8 | 64; // Human, Dwarf, NightElf, Gnome
const HORDE_RACES = 2 | 16 | 32 | 128; // Orc, Undead, Tauren, Troll
const CLASSIC_RACES = ALLIANCE_RACES | HORDE_RACES;
const LOCKED = -42000;
const SIDE_HEADERS = { 469: 'Alliance', 891: 'Alliance', 67: 'Horde', 892: 'Horde' };

function int(v) {
	const n = Number(v);
	return Number.isFinite(n) ? Math.trunc(n) : 0;
}

function sideFromRaceLocks(row) {
	let locked = 0;
	let open = 0;
	for (let i = 0; i < 4; i++) {
		const mask = int(row[`ReputationRaceMasks${i}_0`]) & CLASSIC_RACES;
		if (!mask) continue;
		if (int(row[`ReputationBase_${i}`]) <= LOCKED) locked |= mask;
		else open |= mask;
	}
	locked &= ~open;
	if (locked === HORDE_RACES && (open & ALLIANCE_RACES) === ALLIANCE_RACES) return 'Alliance';
	if (locked === ALLIANCE_RACES && (open & HORDE_RACES) === HORDE_RACES) return 'Horde';
	return null;
}

function buildFactions(rows) {
	const byId = new Map();
	for (const r of rows) {
		const id = int(r.ID);
		if (id > 0) byId.set(id, r);
	}
	const keep = new Set();
	for (const [id, r] of byId) {
		if (int(r.ReputationIndex) < 0) continue;
		let cur = id;
		const seen = new Set();
		while (cur > 0 && byId.has(cur) && !seen.has(cur)) {
			seen.add(cur);
			keep.add(cur);
			cur = int(byId.get(cur).ParentFactionID);
		}
	}
	const sideOf = new Map();
	function side(id, seen = new Set()) {
		if (sideOf.has(id)) return sideOf.get(id);
		if (seen.has(id)) return null;
		seen.add(id);
		let s = SIDE_HEADERS[id] || null;
		const parent = int(byId.get(id).ParentFactionID);
		if (!s && parent > 0 && byId.has(parent)) s = side(parent, seen);
		if (!s) s = sideFromRaceLocks(byId.get(id));
		sideOf.set(id, s);
		return s;
	}
	const out = {};
	for (const id of [...keep].sort((a, b) => a - b)) {
		const r = byId.get(id);
		const parent = int(r.ParentFactionID);
		out[id] = {
			id,
			name: String(r.Name_lang || '').trim(),
			side: side(id),
			parent: parent > 0 && keep.has(parent) ? parent : null,
			source: ['blizzard'],
		};
	}
	return out;
}

module.exports = { buildFactions, ALLIANCE_RACES, HORDE_RACES };
