'use strict';
// Experience estimates for level gating. These are heuristics: the draft only
// needs to know roughly when a quest's minimum level is reached, and the
// author reviews every `level` step.
//
// XP to go from level L to L+1: the 1.12 table (Forever has not published a
// different one; recordings will show if it changed).
const LEVEL_XP = [
	0, 400, 900, 1400, 2100, 2800, 3600, 4500, 5400, 6500, 7600,
	8800, 10100, 11400, 12900, 14400, 16000, 17700, 19400, 21300, 23200,
	25200, 27300, 29400, 31700, 34000, 36400, 38900, 41400, 44300, 47400,
	50800, 54500, 58600, 62800, 67100, 71600, 76100, 80800, 85700, 90700,
	95800, 101000, 106300, 111800, 117500, 123200, 129100, 135100, 141200, 147500,
	153900, 160400, 167100, 173900, 180800, 187900, 195000, 202300, 209800,
];
const MAX_LEVEL = 60;

// Full reward of a typical quest by quest level, used when quests.json has no
// `xp`. Linear between anchors; roughly the median Classic reward per level.
//
//   quest level   1    5   10    15    20    25    30    35    40    45    50    55    60
//   xp          100  400  800  1200  1700  2200  2700  3250  3800  4400  5100  5800  6600
const QUEST_XP_ANCHORS = [
	[1, 100], [5, 400], [10, 800], [15, 1200], [20, 1700], [25, 2200], [30, 2700],
	[35, 3250], [40, 3800], [45, 4400], [50, 5100], [55, 5800], [60, 6600],
];

function baseQuestXp(qlvl) {
	const l = Math.max(1, Math.min(MAX_LEVEL, qlvl || 1));
	for (let i = 1; i < QUEST_XP_ANCHORS.length; i++) {
		const [l1, x1] = QUEST_XP_ANCHORS[i];
		const [l0, x0] = QUEST_XP_ANCHORS[i - 1];
		if (l <= l1) return Math.round(x0 + ((x1 - x0) * (l - l0)) / (l1 - l0));
	}
	return QUEST_XP_ANCHORS[QUEST_XP_ANCHORS.length - 1][1];
}

// Share of the full reward by how far the player is above the quest level
// (the Classic rule):
//
//   player - quest level   <=5    6    7    8    9   >=10
//   share                 100%  80%  60%  40%  20%   10%
function questXpShare(playerLevel, qlvl) {
	const d = playerLevel - qlvl;
	if (d <= 5) return 1;
	if (d >= 10) return 0.1;
	return [0.8, 0.6, 0.4, 0.2][d - 6];
}

// `xp` from data is the full reward; recorded rewards at a known level are
// close enough to treat the same way.
function questXp(quest, playerLevel) {
	const qlvl = quest.level || quest.minLevel || playerLevel;
	const full = typeof quest.xp === 'number' && quest.xp > 0 ? quest.xp : baseQuestXp(qlvl);
	return Math.round(full * questXpShare(playerLevel, qlvl));
}

// Mob kill XP (Classic formula): 5L + 45 against a same-level mob, +5% per
// level above (max +4), scaled down by the zero-difference value below, and
// nothing for grey mobs.
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

function greyLevel(l) {
	if (l <= 5) return 0;
	if (l <= 39) return l - Math.floor(l / 10) - 5;
	if (l <= 59) return l - Math.floor(l / 5) - 1;
	return l - 9;
}

function mobXp(playerLevel, mobLevel) {
	const base = playerLevel * 5 + 45;
	if (mobLevel >= playerLevel) return Math.round(base * (1 + 0.05 * Math.min(mobLevel - playerLevel, 4)));
	if (mobLevel <= greyLevel(playerLevel)) return 0;
	return Math.max(0, Math.round(base * (1 - (playerLevel - mobLevel) / zeroDiff(playerLevel))));
}

// Player progress: { level, xp } with xp into the current level.
function gain(state, amount) {
	state.xp += amount;
	let ups = 0;
	while (state.level < MAX_LEVEL && state.xp >= LEVEL_XP[state.level]) {
		state.xp -= LEVEL_XP[state.level];
		state.level++;
		ups++;
	}
	if (state.level >= MAX_LEVEL) state.xp = 0;
	return ups;
}

module.exports = { LEVEL_XP, MAX_LEVEL, baseQuestXp, questXpShare, questXp, mobXp, greyLevel, gain };
