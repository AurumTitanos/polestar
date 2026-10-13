'use strict';
// Experience rules of the simulator (docs/SIMULATION.md §2).
//
// - XP to level: the Classic table (same values as tools/lib/dsl/validate.js).
// - Quest XP: the client's QuestXP table (DB2, one row per quest level, one
//   column per difficulty tier), cached under data/sources/wago/<build>/ like
//   the other wago.tools tables, reduced by how far the player is above the
//   quest: 100% up to quest level + 5, then 80/60/40/20/10%.
// - Kill XP: 45 + 5 × player level against an equal-level mob, +5% per level
//   the mob is above (at most +4 levels counted), scaled down by the
//   zero-difference value below, nothing for grey mobs; elites ×2.

const fs = require('node:fs');
const path = require('node:path');
const { parseCsv } = require('../data/csv');
const { tableUrl } = require('../data/wago');
const { LEVEL_XP, MAX_LEVEL } = require('../route/xp');

const QUESTXP_BUILD = '1.15.9.70003';

function questXpFile(sourcesDir, build = QUESTXP_BUILD) {
	return path.join(sourcesDir, 'wago', build, 'QuestXP.csv');
}

// rows[level] = [tier0..tier9]
function parseQuestXp(text) {
	const rows = [];
	for (const r of parseCsv(text)) {
		const lvl = Number(r.ID);
		if (!Number.isInteger(lvl) || lvl < 1) continue;
		const tiers = [];
		for (let i = 0; i < 10; i++) tiers.push(Number(r[`Difficulty_${i}`]) || 0);
		rows[lvl] = tiers;
	}
	if (!rows[1] || !rows[60]) throw new Error('QuestXP table lacks levels 1-60');
	return rows;
}

// Cached file, else fetched once from wago.tools and cached (immutable per build).
async function loadQuestXp({ sourcesDir, build = QUESTXP_BUILD, offline = false, fetchImpl = globalThis.fetch, log = () => {} }) {
	const file = questXpFile(sourcesDir, build);
	if (!fs.existsSync(file)) {
		if (offline) throw new Error(`--offline: missing cached ${file}`);
		const url = tableUrl('QuestXP', build);
		log(`fetching ${url}`);
		const res = await fetchImpl(url, { headers: { 'user-agent': 'polestar-data-build' } });
		if (!res.ok) throw new Error(`GET ${url}: HTTP ${res.status}`);
		const text = await res.text();
		parseQuestXp(text);
		fs.mkdirSync(path.dirname(file), { recursive: true });
		fs.writeFileSync(`${file}.tmp`, text);
		fs.renameSync(`${file}.tmp`, file);
	}
	return parseQuestXp(fs.readFileSync(file, 'utf8'));
}

// Share of a quest's reward by player level − quest level.
function questXpShare(playerLevel, questLevel) {
	const d = playerLevel - questLevel;
	if (d <= 5) return 1;
	if (d >= 10) return 0.1;
	return [0.8, 0.6, 0.4, 0.2][d - 6];
}

// A reward at a player level (the client's own rounding is ignored: < 5 XP).
function questXpAt(full, playerLevel, questLevel) {
	return full * questXpShare(playerLevel, questLevel);
}

function zeroDiff(l) {
	if (l <= 7) return 5;
	if (l <= 9) return 6;
	if (l <= 11) return 7;
	if (l <= 15) return 8;
	if (l <= 19) return 9;
	if (l <= 29) return 11;
	if (l <= 39) return 12;
	if (l <= 44) return 13;
	if (l <= 49) return 14;
	if (l <= 54) return 15;
	if (l <= 59) return 16;
	return 17;
}

// Highest mob level that is grey (gives nothing) to a player of level l.
function greyLevel(l) {
	if (l <= 5) return 0;
	if (l <= 39) return l - Math.floor(l / 10) - 5;
	if (l <= 59) return l - Math.floor(l / 5) - 1;
	return l - 9;
}

function mobXp(playerLevel, mobLevel, elite = false) {
	const base = playerLevel * 5 + 45;
	let v;
	if (mobLevel >= playerLevel) v = base * (1 + 0.05 * Math.min(mobLevel - playerLevel, 4));
	else if (mobLevel <= greyLevel(playerLevel)) v = 0;
	else v = Math.max(0, base * (1 - (playerLevel - mobLevel) / zeroDiff(playerLevel)));
	return Math.round(v) * (elite ? 2 : 1);
}

// Cumulative XP at the start of `level`.
const CUM_XP = [0, 0];
for (let l = 2; l <= MAX_LEVEL; l++) CUM_XP[l] = CUM_XP[l - 1] + LEVEL_XP[l - 1];

module.exports = {
	LEVEL_XP, MAX_LEVEL, CUM_XP, QUESTXP_BUILD,
	questXpFile, parseQuestXp, loadQuestXp, questXpShare, questXpAt, zeroDiff, greyLevel, mobXp,
};
