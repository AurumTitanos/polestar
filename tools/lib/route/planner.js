'use strict';
// Route simulation: walks a virtual character through the candidate quests and
// records what it does as events (one event = one guide step).
//
// Hub logic: wherever the character stands, it turns in what is ready and
// accepts everything available within HUB_R yards, NPC by NPC (follow-ups from
// the same NPC flow in the same step). Then it works through the open
// objectives of its quest log in a nearest-neighbour + 2-opt tour that ends at
// the NPC most of those quests return to; objectives within MERGE_R of each
// other are done in one stop. A ready turn-in or an available quest giver
// within PASS_R of the next leg is visited on the way. With nothing left to
// kill it goes to the nearest pending turn-in or quest giver. If only quests
// above its estimated level remain, it grinds (a `level` step) at the nearest
// objective area with suitable mobs.

const { dist, segDist } = require('./geo');
const { planTour } = require('./tour');
const xp = require('./xp');

const HUB_R = 40;
const PASS_R = 60;
const MERGE_R = 60;
const TRAIN_R = 150;
const LOG_MAX = 20;
const MAX_ITER = 20000;

const byId = (a, b) => a.id - b.id;
const entKey = (e) => `${e.kind}:${e.id}`;

function planRoute(model, opts) {
	const quests = [...model.quests.values()].sort(byId);
	const S = { level: opts.levelMin, xp: 0 };
	const accepted = new Set();
	const ready = new Set();
	const done = new Set(model.doneBefore);
	const open = new Map(); // quest id -> Set of open objective indices
	const classCount = new Map();
	let universal = 0;
	const events = [];
	const countsXp = (q) => !q.only;

	// Training: classes to train and the last level each trained at.
	const trainClasses = opts.class ? [opts.class] : [...model.trainers.keys()].sort();
	const trained = new Map(trainClasses.map((c) => [c, opts.levelMin]));
	const evenLevel = () => S.level - (S.level % 2);

	function logFull(q) {
		const counts = (q && q.only ? q.only : [...classCount.keys()]).map((c) => classCount.get(c) || 0);
		return universal + Math.max(0, ...counts) >= LOG_MAX;
	}
	const preOk = (q) => !q.pre.length || q.pre.some((p) => done.has(p));
	const available = (q) => !accepted.has(q.id) && !done.has(q.id) && preOk(q) && S.level >= q.minLevel && !logFull(q);

	function gainXp(amount) {
		if (amount > 0) xp.gain(S, amount);
	}

	function accept(q) {
		accepted.add(q.id);
		if (q.only) for (const c of q.only) classCount.set(c, (classCount.get(c) || 0) + 1);
		else universal++;
		const set = new Set(q.objectives.map((o) => o.oi));
		open.set(q.id, set);
		if (!set.size) ready.add(q.id);
	}

	function turnin(q) {
		accepted.delete(q.id);
		ready.delete(q.id);
		open.delete(q.id);
		done.add(q.id);
		if (q.only) for (const c of q.only) classCount.set(c, classCount.get(c) - 1);
		else universal--;
		if (countsXp(q)) gainXp(xp.questXp({ level: q.level, xp: q.xp }, S.level));
	}

	function completeObjective(q, o) {
		const set = open.get(q.id);
		set.delete(o.oi);
		if (countsXp(q) && o.kills) gainXp(o.kills * xp.mobXp(S.level, o.mobLevel || q.level));
		if (!set.size) ready.add(q.id);
	}

	// Places where something can be turned in or accepted right now.
	function actionable() {
		const out = new Map();
		const add = (ent, cl) => {
			const key = `${entKey(ent)}@${cl.pt.map},${cl.pt.x},${cl.pt.y}`;
			if (!out.has(key)) out.set(key, { ent, pt: cl.pt });
		};
		for (const q of quests) {
			if (ready.has(q.id)) for (const e of q.enders) for (const cl of e.clusters) add(e, cl);
			else if (q.starters.length && available(q)) for (const e of q.starters) for (const cl of e.clusters) add(e, cl);
		}
		return [...out.values()];
	}

	const nearestFirst = (from) => (a, b) => dist(from, a.pt) - dist(from, b.pt) || (entKey(a.ent) < entKey(b.ent) ? -1 : entKey(a.ent) > entKey(b.ent) ? 1 : 0);

	// Everything at one NPC/object until nothing more can be done there.
	function atEntity(spot) {
		const goals = [];
		const key = entKey(spot.ent);
		for (;;) {
			let acted = false;
			for (const q of quests) {
				if (ready.has(q.id) && q.enders.some((e) => entKey(e) === key)) {
					turnin(q);
					goals.push({ verb: 'turnin', q, ent: spot.ent });
					acted = true;
				}
			}
			for (const q of quests) {
				if (available(q) && q.starters.some((e) => entKey(e) === key)) {
					accept(q);
					goals.push({ verb: 'accept', q, ent: spot.ent });
					acted = true;
				}
			}
			if (!acted) break;
		}
		if (goals.length) atPlace('npc', spot.ent, spot.pt, goals);
		return goals.length > 0;
	}

	// One step per trainer NPC near the hub, for each class due at an even level.
	function train(center) {
		const visits = new Map();
		for (const c of trainClasses) {
			if (evenLevel() <= trained.get(c)) continue;
			const near = (model.trainers.get(c) || [])
				.flatMap((e) => e.clusters.map((cl) => ({ ent: e, pt: cl.pt })))
				.filter((s) => dist(center, s.pt) <= TRAIN_R)
				.sort(nearestFirst(center))[0];
			if (!near) continue;
			trained.set(c, evenLevel());
			const k = entKey(near.ent);
			if (!visits.has(k)) visits.set(k, { type: 'train', ent: near.ent, pt: near.pt, level: S.level, goals: [] });
			visits.get(k).goals.push({ verb: 'train', ent: near.ent, only: opts.class ? null : [c] });
		}
		for (const v of [...visits.values()].sort(nearestFirst(center))) atPlace('train', v.ent, v.pt, v.goals);
	}

	// Consecutive visits to the same NPC become one step.
	function atPlace(type, ent, pt, goals) {
		const last = events[events.length - 1];
		if (last && (last.type === 'npc' || last.type === 'train') && entKey(last.ent) === entKey(ent)) last.goals.push(...goals);
		else events.push({ type, ent, pt, goals });
	}

	function hub(center) {
		let pos = center;
		let acted = false;
		for (;;) {
			const spots = actionable().filter((s) => dist(center, s.pt) <= HUB_R).sort(nearestFirst(pos));
			if (!spots.length || !atEntity(spots[0])) break;
			pos = spots[0].pt;
			acted = true;
		}
		if (acted) train(center);
		return pos;
	}

	// Open objectives and quest-start item pickups.
	function workNodes() {
		const nodes = [];
		for (const q of quests) {
			if (accepted.has(q.id) && !ready.has(q.id)) {
				for (const o of q.objectives) if (open.get(q.id).has(o.oi)) nodes.push({ q, o, pt: o.pt });
			} else if (q.pickup && available(q)) {
				nodes.push({ q, pickup: q.pickup, pt: q.pickup.pt });
			}
		}
		return nodes;
	}

	// Where the open quests mostly go back to: end of the objective tour.
	function tourEnd(pos) {
		const tally = new Map();
		for (const q of quests) {
			if (!accepted.has(q.id) || ready.has(q.id)) continue;
			for (const e of q.enders) {
				const cl = e.clusters.slice().sort((a, b) => dist(pos, a.pt) - dist(pos, b.pt))[0];
				const k = entKey(e);
				const t = tally.get(k) || { n: 0, pt: cl.pt, k };
				t.n++;
				tally.set(k, t);
			}
		}
		const best = [...tally.values()].sort((a, b) => b.n - a.n || dist(pos, a.pt) - dist(pos, b.pt) || (a.k < b.k ? -1 : 1))[0];
		return best ? best.pt : null;
	}

	function visit(pt) {
		const goals = [];
		for (;;) {
			let acted = false;
			for (const q of quests) {
				if (accepted.has(q.id) && !ready.has(q.id)) {
					for (const o of q.objectives) {
						if (!open.get(q.id).has(o.oi) || dist(o.pt, pt) > MERGE_R) continue;
						completeObjective(q, o);
						goals.push({ verb: o.verb, q, o });
						acted = true;
					}
				} else if (q.pickup && available(q) && dist(q.pickup.pt, pt) <= MERGE_R) {
					accept(q);
					goals.push({ verb: 'accept', q, pickup: q.pickup });
					acted = true;
				}
			}
			if (!acted) break;
		}
		events.push({ type: 'obj', pt, goals });
	}

	function grindSpot(pos, level) {
		const spots = [];
		for (const q of quests) {
			for (const o of q.objectives) {
				if (o.ent && o.ent.kind === 'npc' && (o.verb === 'kill' || o.verb === 'collect')) spots.push({ o, pt: o.pt });
			}
		}
		const fits = spots.filter((s) => s.o.mobLevel == null || (s.o.mobLevel >= level - 4 && s.o.mobLevel <= level + 1));
		const list = (fits.length ? fits : spots).sort((a, b) => dist(pos, a.pt) - dist(pos, b.pt) || a.o.ent.id - b.o.ent.id);
		return list[0] || null;
	}

	// ---- start position
	let pos = opts.startPoint || null;
	if (opts.startQuest != null) {
		const q = model.quests.get(opts.startQuest);
		if (!q) throw new Error(`--start-quest ${opts.startQuest} is not a candidate quest of this route`);
		pos = q.starters.length ? q.starters[0].clusters[0].pt : q.pickup.pt;
	}
	if (!pos) {
		const spots = actionable();
		if (!spots.length) {
			const pick = quests.find((q) => q.pickup && available(q));
			if (!pick) throw new Error('no quest is available at the start of this route');
			pos = pick.pickup.pt;
		} else {
			const score = (s) => spots.filter((o) => dist(o.pt, s.pt) <= HUB_R).length;
			pos = spots.slice().sort((a, b) => score(b) - score(a) || nearestFirst(spots[0].pt)(a, b))[0].pt;
		}
	}

	// ---- main loop
	let iter = 0;
	for (;;) {
		if (++iter > MAX_ITER) throw new Error('route planner did not converge');
		pos = hub(pos);
		const work = workNodes();
		if (work.length) {
			const tour = planTour(pos, work, tourEnd(pos));
			const next = tour[0];
			const near = actionable()
				.filter((s) => dist(s.pt, pos) > 0 && segDist(s.pt, pos, next.pt) <= PASS_R && dist(pos, s.pt) < dist(pos, next.pt))
				.sort(nearestFirst(pos))[0];
			if (near) {
				pos = near.pt;
				continue;
			}
			pos = next.pt;
			visit(pos);
			continue;
		}
		const targets = actionable().sort(nearestFirst(pos));
		if (targets.length) {
			pos = targets[0].pt;
			continue;
		}
		const blocked = quests.filter((q) => !accepted.has(q.id) && !done.has(q.id) && preOk(q) && S.level < q.minLevel);
		if (blocked.length) {
			const level = Math.min(...blocked.map((q) => q.minLevel));
			const spot = grindSpot(pos, level);
			events.push({ type: 'level', level, pt: spot ? spot.pt : null, ent: spot ? spot.o.ent : null, goals: [] });
			if (spot) pos = spot.pt;
			S.level = level;
			S.xp = 0;
			continue;
		}
		break;
	}

	// ---- optional breadcrumbs out of the area, nearest first
	const crumbs = model.breadcrumbs.filter((q) => preOk(q) && S.level >= q.minLevel && !done.has(q.id));
	const byEnt = new Map();
	for (const q of crumbs) {
		const e = q.starters[0];
		if (!byEnt.has(entKey(e))) byEnt.set(entKey(e), { ent: e, pt: e.clusters[0].pt, qs: [] });
		byEnt.get(entKey(e)).qs.push(q);
	}
	let spots = [...byEnt.values()];
	while (spots.length) {
		spots.sort(nearestFirst(pos));
		const s = spots.shift();
		atPlace('npc', s.ent, s.pt, s.qs.map((q) => ({ verb: 'accept', q, ent: s.ent, optional: true })));
		pos = s.pt;
	}

	const routed = quests.filter((q) => done.has(q.id)).map((q) => q.id);
	const unrouted = quests.filter((q) => !done.has(q.id)).map((q) => q.id);
	return { events, routed, unrouted, final: { level: S.level, xp: S.xp, need: xp.LEVEL_XP[S.level] || 0 } };
}

module.exports = { planRoute };
