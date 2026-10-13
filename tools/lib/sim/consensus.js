'use strict';
// `sim consensus --faction F`: one 12-60 route shared by the faction's
// starts (docs/SIMULATION.md "Consensus route").
//
//   1. Each start's best route (`sim run` result) splits at its level-12
//      point: the prefix (own start up to the first package entered at level
//      12 or more) stays the race's own.
//   2. Cross-evaluation: each start's own 12-60 sequence run as the shared
//      route by every start; the best row sum is a bound the consensus must
//      beat. Seeds: those sequences and the median order (the packages more
//      than half of the starts' suffixes contain, ordered by their median
//      arrival level; ties: median relative position).
//   3. Improve: simulated annealing on the shared suffix (swap, move,
//      reverse, drop, add a package from any start's suffix or a return to
//      one already in it), minimizing the summed time to 60 of every start
//      running prefix + suffix (entries(): a package closed to the race is
//      skipped; one its prefix ran is that same visit the first time and a
//      return after): 2 rounds of 32 jobs on worker threads (round 1 from
//      the seeds, round 2 from the best), 1.2M suffix evaluations by
//      default. Seeded, deterministic for any number of workers. Entries
//      that do nothing for any start drop.
//   4. Report each start's consensus time vs its own best (hours lost), the
//      realised visit order per start, and the branches: level stretches
//      where the race's own route gains more than 1 h on the consensus, with
//      the zones each route visits there.
// Writes data/sim/consensus-<faction>.json and .md, and exports each start's
// consensus route (export.js) under data/sim/export/consensus-<faction>-<race>/.

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { Worker, isMainThread, parentPort, workerData } = require('node:worker_threads');
const sim = require('./index');
const { exportRoute, loadPlaces, loadCamps, slug } = require('./export');
const { Rng } = require('./rng');
const { MAX_VISITS } = require('./evaluate');
const { fmtH, table, mdTable } = require('./report');

const SPLIT_LEVEL = 12;
const BRANCH_GAIN = 3600; // seconds: a stretch where the own route gains more is a route choice

function median(a) {
	const s = a.slice().sort((x, y) => x - y);
	const n = s.length;
	return n % 2 ? s[(n - 1) / 2] : (s[n / 2 - 1] + s[n / 2]) / 2;
}

// Prefix / suffix (package keys) of a best route at its level-12 point (the
// prefix always holds every home package: the route rules need them first).
function split(ev, run, keys) {
	const route = sim.routeFromKeys(run, keys);
	const r = ev.evaluate(route, { detail: true });
	const per = r.perPackage;
	let i = per.findIndex((x) => x.levelIn >= SPLIT_LEVEL);
	if (i < 0) i = per.length;
	per.forEach((x, k) => {
		if (run.pkgHome[x.pkg] && k >= i) i = k + 1;
	});
	return { prefix: per.slice(0, i).map((x) => x.key), suffix: per.slice(i).map((x) => x.key), arrive: new Map(per.slice(i).map((x, k) => [x.key, { level: x.levelIn, pos: k / Math.max(1, per.length - i) }])), result: r };
}

// A race's full route: its prefix, then the suffix minus packages it does not
// have. A suffix package its prefix already ran is that same visit the first
// time it comes up (skipped); later ones are returns, up to MAX_VISITS runs
// in all (home packages once). -> [[package index, suffix index or -1]]
function entries(c, suffix) {
	const runs = new Map();
	const out = [];
	for (const k of c.prefix) {
		runs.set(k, (runs.get(k) || 0) + 1);
		out.push([c.idx.get(k), -1]);
	}
	const same = new Map(runs);
	suffix.forEach((k, i) => {
		const p = c.idx.get(k);
		if (p == null) return;
		if (same.get(k) > 0) {
			same.set(k, same.get(k) - 1);
			return;
		}
		const n = runs.get(k) || 0;
		if (n >= MAX_VISITS || (n > 0 && c.run.pkgHome[p])) return;
		runs.set(k, n + 1);
		out.push([p, i]);
	});
	return out;
}

function fullRoute(c, suffix) {
	return entries(c, suffix).map((e) => e[0]);
}

function totalCost(chars, suffix) {
	let s = 0;
	for (const c of chars) s += c.ev.cost(fullRoute(c, suffix));
	return s;
}

function anneal(chars, start, pool, { evals, seed }) {
	const rng = new Rng(seed);
	let cur = start.slice();
	let curCost = totalCost(chars, cur);
	let best = cur.slice();
	let bestCost = curCost;
	const t0 = 3000 * chars.length;
	const t1 = 10 * chars.length;
	for (let it = 0; it < evals; it++) {
		const T = t0 * (t1 / t0) ** (it / evals);
		const next = cur.slice();
		const n = next.length;
		const m = rng.int(6);
		if (m === 0 && n >= 2) {
			const i = rng.int(n);
			const j = rng.int(n);
			[next[i], next[j]] = [next[j], next[i]];
		} else if ((m === 1 || m === 2) && n >= 2) {
			const i = rng.int(n);
			const span = m === 1 ? 5 : n;
			const j = Math.max(0, Math.min(n - 1, i + rng.int(2 * span + 1) - span));
			const [x] = next.splice(i, 1);
			next.splice(j, 0, x);
		} else if (m === 3 && n >= 2) {
			const i = rng.int(n - 1);
			const j = Math.min(n - 1, i + 1 + rng.int(4));
			for (let a = i, b = j; a < b; a++, b--) [next[a], next[b]] = [next[b], next[a]];
		} else if (m === 4 && n >= 2) {
			next.splice(rng.int(n), 1);
		} else {
			// add: a package not in the suffix, or (one move in four) a return
			const runs = new Map();
			for (const k of next) runs.set(k, (runs.get(k) || 0) + 1);
			const cap = rng.int(4) === 0 ? MAX_VISITS : 1;
			const cand = pool.filter((k) => (runs.get(k) || 0) < cap);
			if (!cand.length) continue;
			next.splice(rng.int(n + 1), 0, cand[rng.int(cand.length)]);
		}
		const c = totalCost(chars, next);
		const d = c - curCost;
		if (d < 0 || rng.next() < Math.exp(-d / T)) {
			cur = next;
			curCost = c;
			if (c < bestCost - 1e-9) {
				bestCost = c;
				best = cur.slice();
			}
		}
	}
	return { suffix: best, total: bestCost };
}

// Level stretches (from 12) where the own route's lead on the consensus
// grows by more than BRANCH_GAIN: [{ from, to, gain }], best first, disjoint.
function branches(own, cons, minGain = BRANCH_GAIN) {
	const gap = [];
	for (let l = SPLIT_LEVEL; l <= 60; l++) gap[l] = (cons[l] || 0) - (own[l] || 0);
	const out = [];
	const used = new Set();
	for (let round = 0; round < 3; round++) {
		let best = null;
		for (let a = SPLIT_LEVEL; a < 60; a++) {
			if (used.has(a)) continue;
			for (let b = a + 1; b <= 60; b++) {
				if (used.has(b)) break;
				const g = gap[b] - gap[a];
				if (!best || g > best.gain) best = { from: a, to: b, gain: g };
			}
		}
		if (!best || best.gain <= minGain) break;
		// Trim to the core of the stretch (ends that add under 10% of the gain).
		const full = best.gain;
		while (best.from + 1 < best.to && gap[best.to] - gap[best.from + 1] >= 0.9 * full) best.from++;
		while (best.to - 1 > best.from && gap[best.to - 1] - gap[best.from] >= 0.9 * full) best.to--;
		best.gain = gap[best.to] - gap[best.from];
		out.push(best);
		for (let l = best.from; l <= best.to; l++) used.add(l);
	}
	return out;
}

// Zones visited between two levels, each once, in first-visit order.
function zonesIn(visits, from, to) {
	const out = [];
	for (const v of visits) {
		if (v.levelOut < from || v.levelIn > to || v.zone.startsWith('(')) continue;
		if (!out.includes(v.zone)) out.push(v.zone);
	}
	return out;
}

// Characters for consensus work: { race, run, ev, idx, prefix } per start.
function makeChars(world, races, params, family) {
	return races.map((r) => {
		const m = sim.makeRun(world, { race: r.race, cls: null, params, family });
		return { ...r, ...m, idx: new Map(m.run.packages.map((p, i) => [p.key, i])) };
	});
}

// Annealing jobs on worker threads: `rounds` rounds of JOBS jobs (fixed
// count, so the result does not depend on the number of workers); round 1
// starts job i from seed route i mod #seeds, later rounds from the best so
// far. Each job: `evals` suffix evaluations (one per start each).
const JOBS = 32;
async function parallelAnneal({ worldFile, races, params, family, pool, seeds, evalsTotal, rounds = 2, seed = 11, workers }) {
	const per = Math.max(1, Math.ceil(evalsTotal / (rounds * JOBS)));
	const W = Math.max(1, Math.min(JOBS, workers));
	const threads = Array.from({ length: W }, () => new Worker(__filename, { workerData: { consensusWorker: true, worldFile, races, params, family, pool } }));
	const runJobs = (jobs) => new Promise((resolve, reject) => {
		const out = new Array(jobs.length);
		let next = 0;
		let done = 0;
		const feed = (w) => {
			if (next >= jobs.length) return;
			const i = next++;
			w.once('message', (msg) => {
				if (msg.error) return reject(new Error(msg.error));
				out[i] = msg;
				if (++done === jobs.length) resolve(out);
				else feed(w);
			});
			w.postMessage(jobs[i]);
		};
		for (const w of threads) {
			w.once('error', reject);
			feed(w);
		}
	});
	try {
		let best = null;
		const ordered = seeds.slice().sort((a, b) => a.total - b.total);
		for (let round = 0; round < rounds; round++) {
			const jobs = [];
			for (let i = 0; i < JOBS; i++) jobs.push({ start: round === 0 ? ordered[i % ordered.length].keys : best.suffix, evals: per, seed: seed * 1000003 + round * 1009 + i });
			const res = await runJobs(jobs);
			for (const r of res) if (!best || r.total < best.total - 1e-9) best = r;
		}
		return { ...best, evals: per * rounds * JOBS };
	} finally {
		await Promise.all(threads.map((w) => w.terminate()));
	}
}

if (!isMainThread && workerData && workerData.consensusWorker) {
	const wd = workerData;
	const world = JSON.parse(fs.readFileSync(wd.worldFile, 'utf8'));
	const chars = makeChars(world, wd.races, wd.params, wd.family);
	parentPort.on('message', (job) => {
		try {
			parentPort.postMessage(anneal(chars, job.start, wd.pool, { evals: job.evals, seed: job.seed }));
		} catch (err) {
			parentPort.postMessage({ error: err && err.stack ? err.stack : String(err) });
		}
	});
}

async function consensus(o) {
	const faction = sim.normFaction(o.faction);
	const family = o.family || 'solo';
	const { world, worldFile } = await sim.loadWorld({ ...o, faction });
	const { mean } = sim.paramsFor(o.simDir, null);
	const chars = [];
	for (const race of sim.START_RACES[faction]) {
		const file = sim.resultFile(o.simDir, faction, race, null, family);
		if (!fs.existsSync(file)) throw new Error(`${file} not found: run \`sim run --faction ${faction}\` first`);
		const res = JSON.parse(fs.readFileSync(file, 'utf8'));
		sim.assertFresh(res, world, path.basename(file));
		const [c] = makeChars(world, [{ race }], mean, family);
		chars.push({ ...c, res, ...split(c.ev, c.run, res.best.route) });
	}
	// Cross-evaluation: each start's own 12-60 sequence as the shared route
	// for every start (from its own level-12 state). Its best row sum is the
	// bound the consensus must beat.
	const matrix = chars.map((src) => chars.map((c) => c.ev.cost(fullRoute(c, src.suffix))));
	// Seeds: the median order (packages in more than half of the suffixes, by
	// median arrival level) and each start's own suffix (returns included).
	const count = new Map();
	for (const c of chars) for (const k of new Set(c.suffix)) count.set(k, (count.get(k) || 0) + 1);
	const pool = [...count.keys()].sort();
	const seedKeys = pool.filter((k) => count.get(k) > chars.length / 2);
	const order = (k) => {
		const a = chars.filter((c) => c.arrive.has(k)).map((c) => c.arrive.get(k));
		return [median(a.map((x) => x.level)), median(a.map((x) => x.pos))];
	};
	const ord = new Map(seedKeys.map((k) => [k, order(k)]));
	seedKeys.sort((a, b) => ord.get(a)[0] - ord.get(b)[0] || ord.get(a)[1] - ord.get(b)[1] || (a < b ? -1 : 1));
	const seeds = [{ from: 'median order', keys: seedKeys, total: totalCost(chars, seedKeys) }, ...chars.map((c, i) => ({ from: `${c.race}'s own 12-60`, keys: c.suffix, total: matrix[i].reduce((a, b) => a + b, 0) }))];
	const bound = seeds.slice(1).reduce((a, b) => (b.total < a.total ? b : a));
	const t0 = Date.now();
	const evalsTotal = o.evals || 1.2e6;
	const sa = await parallelAnneal({
		worldFile, races: chars.map((c) => ({ race: c.race, prefix: c.prefix })), params: mean, family, pool, seeds,
		evalsTotal, seed: o.seed || 11, workers: o.workers || os.availableParallelism(),
	});
	const wall = (Date.now() - t0) / 1000;
	// Drop suffix entries that do nothing for any start (no effect on any
	// time); a useless return goes even when the first visit stays.
	const did = new Set();
	for (const c of chars) {
		const ent = entries(c, sa.suffix);
		c.ev.evaluate(ent.map((e) => e[0]), { detail: true }).perPackage.forEach((x, j) => {
			if (ent[j][1] >= 0 && (x.leave > x.arrive || x.quests > 0)) did.add(ent[j][1]);
		});
	}
	const suffix = sa.suffix.filter((k, i) => did.has(i));

	const rows = [];
	for (const c of chars) {
		const route = fullRoute(c, suffix);
		const d = sim.describe(c.ev, route);
		const ownD = sim.describe(c.ev, sim.routeFromKeys(c.run, c.res.best.route));
		const br = branches(ownD.levelTimes, d.levelTimes).map((b) => ({
			levels: `${b.from}-${b.to}`, from: b.from, to: b.to, hoursGained: Math.round((b.gain / 3600) * 10) / 10,
			ownZones: zonesIn(ownD.visits, b.from, b.to), consensusZones: zonesIn(d.visits, b.from, b.to),
		}));
		c.consensusRoute = route;
		c.consensus = d;
		rows.push({
			race: c.race,
			ownHours: ownD.seconds / 3600,
			consensusHours: d.seconds / 3600,
			hoursLost: (d.seconds - ownD.seconds) / 3600,
			splitAt: c.prefix.length,
			prefix: c.prefix,
			ownTimeTo: ownD.timeTo,
			consensusTimeTo: d.timeTo,
			skipped: (() => {
				const kept = new Set(entries(c, suffix).map((e) => e[1]));
				return suffix.filter((k, i) => !kept.has(i));
			})(),
			branches: br,
			consensusVisits: d.visits.map((v) => ({ zone: v.zone, levelIn: v.levelIn, levelOut: v.levelOut, hours: (v.leave - v.arrive) / 3600, quests: v.quests, packages: v.packages })),
		});
	}
	const out = {
		schema: 1, faction, family, worldHash: world.dataHash,
		note: 'Era + known Forever quests (Forever 30-60 content not in the data yet; the beta caps at 30).',
		splitLevel: SPLIT_LEVEL, branchGainHours: BRANCH_GAIN / 3600,
		crossMatrix: { rows: 'shared 12-60 route = this start\'s own', cols: chars.map((c) => c.race), hours: chars.map((c, i) => ({ route: c.race, hours: matrix[i].map((s) => s / 3600), sum: matrix[i].reduce((a, b) => a + b, 0) / 3600 })) },
		bound: { from: bound.from, totalHours: bound.total / 3600 },
		seeds: seeds.map((s) => ({ from: s.from, packages: s.keys.length, totalHours: s.total / 3600 })),
		annealed: { evals: sa.evals, jobs: JOBS, rounds: 2, wallSeconds: wall, totalHours: sa.total / 3600, beatsBound: sa.total < bound.total - 1e-6 },
		suffix,
		races: rows,
	};
	const file = path.join(o.simDir, `consensus-${faction.toLowerCase()}.json`);
	fs.writeFileSync(file, `${JSON.stringify(out, null, 1)}\n`);
	fs.writeFileSync(file.replace(/\.json$/, '.md'), markdown(out));
	out.file = file;
	// Exports of each start's consensus route.
	const places = await loadPlaces(o);
	const camps = loadCamps(o);
	out.exports = [];
	for (const c of chars) {
		const dir = path.join(o.simDir, 'export', `consensus-${faction.toLowerCase()}-${slug(c.race)}`);
		fs.rmSync(dir, { recursive: true, force: true });
		const meta = { faction, race: c.race, family, label: `${faction} ${c.race}, consensus 12-60 route, ${(c.consensus.seconds / 3600).toFixed(1)} h under the model`, seconds: c.consensus.seconds };
		const r = exportRoute({ world, ev: c.ev, run: c.run, route: c.consensusRoute, meta, out: dir, base: `sim/consensus/${faction.toLowerCase()}/${slug(c.race)}`, places, camps });
		out.exports.push({ race: c.race, dir, guides: r.guides.length });
	}
	return out;
}

function markdown(out) {
	const L = [10, 20, 30, 40, 50, 60];
	const h1 = (s) => s.toFixed(1);
	const lines = [
		`# Consensus route, ${out.faction} (${out.family})`,
		'',
		`World ${out.worldHash} (data/sim/world-${out.faction.toLowerCase()}.json dataHash; \`sim compare\` numbers are comparable only on this world).`,
		'',
		`${out.note} Each start keeps its own route to level ${out.splitLevel}; from there all starts run one shared package sequence (${out.suffix.length} packages), annealed for the summed time to 60 (${out.annealed.evals.toLocaleString('en-US')} evaluations, ${out.annealed.jobs} jobs x ${out.annealed.rounds} rounds).`,
		'',
		mdTable(['start', 'own best', 'consensus', 'lost', ...L.map((l) => `to ${l} own / cons.`)], out.races.map((r) => [
			r.race, `${h1(r.ownHours)} h`, `${h1(r.consensusHours)} h`, `${r.hoursLost.toFixed(2)} h`,
			...L.map((l) => `${fmtH(r.ownTimeTo[l])} / ${fmtH(r.consensusTimeTo[l])}`),
		])),
		'',
		'## Cross-evaluation (each start\'s own 12-60 sequence as the shared route; hours to 60)',
		'',
		mdTable(['shared route', ...out.crossMatrix.cols, 'sum'], out.crossMatrix.hours.map((r) => [`${r.route}'s own`, ...r.hours.map(h1), h1(r.sum)])),
		'',
		`Bound (best row): ${out.bound.from}, ${h1(out.bound.totalHours)} h summed. Consensus: ${h1(out.annealed.totalHours)} h summed (${out.annealed.beatsBound ? 'beats' : 'does not beat'} the bound).`,
		'',
		'## Route choices (own route gains more than 1 h over a stretch)',
		'',
	];
	let any = false;
	for (const r of out.races) {
		for (const b of r.branches) {
			any = true;
			lines.push(`- **${r.race}, levels ${b.levels}** (+${b.hoursGained} h own): own ${b.ownZones.join(' > ')}; consensus ${b.consensusZones.join(' > ')}`);
		}
	}
	if (!any) lines.push('- none: every start is within 1 h of its own route over every stretch.');
	lines.push('', '## Visit order per start (as run: zone, levels in-out, quests, hours)', '');
	for (const r of out.races) {
		lines.push(`### ${r.race}`, '', mdTable(['#', 'zone', 'levels', 'quests', 'hours'], r.consensusVisits.map((v, i) => [i + 1, v.zone, `${h1(v.levelIn)}-${h1(v.levelOut)}`, v.quests, v.hours.toFixed(2)])), '');
	}
	lines.push(
		'## Shared package sequence (from level 12)',
		'',
		'Run in this order (no deferral); a package a start already ran before level 12 or has no quests in is skipped for it. Packages are zone x 5-level quest band.',
		'',
		...out.suffix.map((k, i) => `${i + 1}. ${k}`),
		'',
	);
	return lines.join('\n');
}

async function command(args, o) {
	const r = await consensus({ ...sim.DEFAULTS, ...o, faction: args.faction, family: args.dungeons ? 'dungeons' : 'solo', seed: args.seed ? Number(args.seed) : undefined, evals: args.evals ? Number(args.evals) : undefined, workers: args.workers ? Number(args.workers) : undefined });
	console.log(`\n== consensus ${r.faction} (${r.family}): ${r.suffix.length} shared packages from level ${r.splitLevel}; bound (${r.bound.from}) ${r.bound.totalHours.toFixed(1)} h summed, consensus ${r.annealed.totalHours.toFixed(1)} h (${r.annealed.evals.toLocaleString('en-US')} evaluations, ${r.annealed.wallSeconds.toFixed(0)} s) ==`);
	console.log(table(['shared route', ...r.crossMatrix.cols, 'sum'], r.crossMatrix.hours.map((x) => [`${x.route}'s own`, ...x.hours.map((h) => h.toFixed(1)), x.sum.toFixed(1)])));
	console.log(table(['start', 'own best', 'consensus', 'lost', 'to 20', 'to 30', 'to 40', 'to 50'], r.races.map((x) => [
		x.race, fmtH(x.ownHours * 3600), fmtH(x.consensusHours * 3600), `${x.hoursLost.toFixed(2)}h`,
		...[20, 30, 40, 50].map((l) => `${fmtH(x.ownTimeTo[l])}/${fmtH(x.consensusTimeTo[l])}`),
	])));
	for (const x of r.races) for (const b of x.branches) console.log(`  route choice: ${x.race} ${b.levels} (+${b.hoursGained} h own): own ${b.ownZones.join(' > ')} | consensus ${b.consensusZones.join(' > ')}`);
	console.log(`wrote ${path.relative(process.cwd(), r.file)} (+ .md)`);
	for (const e of r.exports) console.log(`  export ${path.relative(process.cwd(), e.dir)}: ${e.guides} guides + visits.json`);
	return 0;
}

module.exports = { consensus, command, branches, split, entries, fullRoute };
