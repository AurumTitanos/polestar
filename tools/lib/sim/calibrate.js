'use strict';
// Calibration (docs/SIMULATION.md §4). Two sources, each fitting what it
// can actually inform; only fitted parameter values are kept (params.json).
//
// 1. Quest rewards:
//    - questEstScale: quests.json `xp` (recorded/Questie rewards) against the
//      QuestXP-table estimate the model uses for quests without one;
//    - questXpScale: Forever-observed rewards (ForeverDungeonJournal's
//      FOREVER_QUEST_XP_FALLBACK) against the data reward (recorded or
//      estimated): did Forever retune quest XP?
//    Robust: median of log ratios; sd = 1.4826·MAD/√n, floored at 0.02.
// 2. Recordings (data/recordings): seconds between kills at each level ->
//    killSec1/killSec60 (weighted least squares). Without recordings the
//    time parameters keep their priors.
// Every other parameter, extraKill included, keeps its prior (params.js).

const fs = require('node:fs');
const path = require('node:path');
const sim = require('./index');
const { loadParamsFile, saveParamsFile, effective, PRIORS } = require('./params');
const { table } = require('./report');
const { findInstalledAddon } = require('../addons');
const { FOLDER: FDJ_FOLDER } = require('../data/dungeonjournal');

// `[id] = xp` pairs inside FDJ.FOREVER_QUEST_XP_FALLBACK = { ... }.
function parseForeverXp(text) {
	const m = /FOREVER_QUEST_XP_FALLBACK\s*=\s*\{([\s\S]*?)\n\}/.exec(text);
	const out = new Map();
	if (!m) return out;
	const re = /\[(\d+)\]\s*=\s*(\d+)/g;
	let r;
	while ((r = re.exec(m[1]))) out.set(Number(r[1]), Number(r[2]));
	return out;
}

// The installed ForeverDungeonJournal folder (null when not found).
function fdjDir(explicit) {
	if (explicit) return path.resolve(explicit);
	return findInstalledAddon(FDJ_FOLDER);
}

function loadForeverXp(dir) {
	if (!dir) return { file: null, xp: new Map() };
	const file = path.join(dir, 'Data', 'QuestRewards.lua');
	if (!fs.existsSync(file)) return { file, xp: new Map() };
	return { file, xp: parseForeverXp(fs.readFileSync(file, 'utf8')) };
}

function median(a) {
	const s = a.slice().sort((x, y) => x - y);
	const n = s.length;
	return n ? (n % 2 ? s[(n - 1) / 2] : (s[n / 2 - 1] + s[n / 2]) / 2) : NaN;
}

// Robust location/scale of log ratios -> { n, mean (ratio), sd (ratio units) }.
function ratioFit(ratios) {
	const logs = ratios.filter((r) => r > 0 && Number.isFinite(r)).map(Math.log);
	if (logs.length < 3) return null;
	const med = median(logs);
	const mad = median(logs.map((x) => Math.abs(x - med)));
	const spread = 1.4826 * mad;
	return { n: logs.length, mean: Math.exp(med), sd: Math.max(0.02, (Math.exp(med) * spread) / Math.sqrt(logs.length)), spread };
}

function tableEstimate(rows, q) {
	const row = rows[Math.max(1, Math.min(rows.length - 1, q.level))] || rows[60];
	return row[q.tier] || 0;
}

// Quest reward fits from the worlds (both factions' quests, deduplicated).
function questXpFits(worlds, foreverXp) {
	const seen = new Map();
	for (const w of worlds) for (const q of w.quests) if (!seen.has(q.id)) seen.set(q.id, q);
	const rows = worlds[0].questXp;
	const est = [];
	for (const q of seen.values()) if (q.xp > 0) est.push(q.xp / tableEstimate(rows, q));
	const estFit = ratioFit(est);
	const estScale = estFit ? estFit.mean : 1;
	const fv = [];
	const fvRows = [];
	for (const [id, xp] of foreverXp) {
		const q = seen.get(id);
		if (!q) continue;
		const base = q.xp > 0 ? q.xp : tableEstimate(rows, q) * estScale;
		if (base > 0) {
			fv.push(xp / base);
			fvRows.push({ id, title: q.title, level: q.level, forever: xp, data: Math.round(base), recorded: q.xp > 0 });
		}
	}
	return { est: estFit, forever: ratioFit(fv), foreverRows: fvRows, foreverTotal: foreverXp.size };
}

// Recordings: kill cadence per level.
function recordingFits(recDir) {
	if (!fs.existsSync(recDir)) return { sessions: 0 };
	const files = fs.readdirSync(recDir).filter((f) => f.endsWith('.json'));
	const byLevel = new Map();
	let sessions = 0;
	for (const f of files) {
		let doc;
		try {
			doc = JSON.parse(fs.readFileSync(path.join(recDir, f), 'utf8'));
		} catch {
			continue;
		}
		if (!doc || !Array.isArray(doc.events)) continue;
		sessions++;
		let lvl = null;
		let lastKill = null;
		for (const e of doc.events) {
			if (e.lvl) lvl = e.lvl;
			if (e.e === 'level') lvl = e.lvl;
			if (e.e === 'kill' && lvl) {
				if (lastKill != null && e.t - lastKill > 2 && e.t - lastKill <= 180) {
					if (!byLevel.has(lvl)) byLevel.set(lvl, []);
					byLevel.get(lvl).push(e.t - lastKill);
				}
				lastKill = e.t;
			}
		}
	}
	const pts = [...byLevel].filter(([, g]) => g.length >= 10).map(([l, g]) => [l, median(g), g.length]);
	if (pts.length < 2) return { sessions, levels: pts.length };
	// Weighted least squares sec = a + b (L - 1).
	let sw = 0;
	let sx = 0;
	let sy = 0;
	let sxx = 0;
	let sxy = 0;
	for (const [l, s, n] of pts) {
		const x = l - 1;
		sw += n;
		sx += n * x;
		sy += n * s;
		sxx += n * x * x;
		sxy += n * x * s;
	}
	const b = (sw * sxy - sx * sy) / (sw * sxx - sx * sx);
	const a = (sy - b * sx) / sw;
	return { sessions, levels: pts.length, killSec1: a, killSec60: a + 59 * b, points: pts };
}

async function calibrate(o) {
	const doc = loadParamsFile(o.simDir);
	doc.calibrated = {};
	const worlds = {};
	for (const f of ['Horde', 'Alliance']) worlds[f] = (await sim.loadWorld({ ...o, faction: f })).world;
	const fit = { at: new Date().toISOString(), sources: {} };

	// 1. Quest rewards.
	const fx = loadForeverXp(o.fdjDir);
	const qx = questXpFits(Object.values(worlds), fx.xp);
	fit.sources.questXp = { questsJsonXp: qx.est ? qx.est.n : 0, forever: { file: fx.file, values: qx.foreverTotal, matched: qx.foreverRows.length } };
	if (qx.est) doc.calibrated.questEstScale = { mean: qx.est.mean, sd: Math.max(qx.est.sd, 0.03) };
	if (qx.forever) doc.calibrated.questXpScale = { mean: qx.forever.mean, sd: Math.max(qx.forever.sd, 0.03) };
	fit.questXp = { est: qx.est, forever: qx.forever };

	// 2. Recordings.
	const rec = recordingFits(path.join(path.dirname(o.simDir), 'recordings'));
	fit.sources.recordings = { sessions: rec.sessions, levels: rec.levels || 0 };
	if (rec.killSec1 != null && rec.killSec60 != null && rec.killSec1 > 0 && rec.killSec60 > 0) {
		doc.calibrated.killSec1 = { mean: rec.killSec1, sd: PRIORS.killSec1[1] / 2 };
		doc.calibrated.killSec60 = { mean: rec.killSec60, sd: PRIORS.killSec60[1] / 2 };
	}

	doc.fit = fit;
	saveParamsFile(o.simDir, doc);
	return { doc, fit, qx };
}

async function command(args, o) {
	const opts = { ...sim.DEFAULTS, ...o, fdjDir: fdjDir(args.fdj) };
	const { doc, fit, qx } = await calibrate(opts);
	const eff = effective(doc, null);
	console.log('Calibrated parameters (prior -> calibrated):');
	console.log(table(['parameter', 'prior mean', 'prior sd', 'calibrated mean', 'calibrated sd', 'source'], Object.entries(doc.calibrated).map(([k, c]) => [
		k, PRIORS[k][0], PRIORS[k][1], c.mean.toFixed(3), c.sd.toFixed(3),
		k === 'questEstScale' ? `quests.json xp (${qx.est.n} quests)` : k === 'questXpScale' ? `Forever observed (${qx.forever.n} quests)` : 'recordings',
	])));
	console.log(`\nquests.json rewards vs QuestXP table: ${qx.est ? `n ${qx.est.n}, median ratio ${qx.est.mean.toFixed(3)}, spread ×${Math.exp(qx.est.spread).toFixed(2)}` : 'no recorded XP'}`);
	console.log(`Forever observed vs data rewards: ${qx.forever ? `n ${qx.forever.n} of ${qx.foreverTotal}, median ratio ${qx.forever.mean.toFixed(3)}, spread ×${Math.exp(qx.forever.spread).toFixed(2)}` : 'none matched'}`);
	console.log(`recordings: ${fit.sources.recordings.sessions} sessions${fit.sources.recordings.sessions ? '' : ' (time parameters keep their priors)'}`);
	console.log(`effective means: ${Object.entries(eff).map(([k, v]) => `${k} ${+v.mean.toFixed(3)}`).join(', ')}`);
	console.log(`wrote ${path.relative(process.cwd(), path.join(opts.simDir, 'params.json'))}`);
	return 0;
}

module.exports = { calibrate, command, parseForeverXp, ratioFit, recordingFits, questXpFits };
