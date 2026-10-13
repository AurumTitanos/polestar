'use strict';
// Cross-guide validation (docs/GUIDE_FORMAT.md, "Validation"): duplicate ids,
// `next` targets, quests turned in / worked on without an earlier accept in
// the guide or any guide chaining into it, accepts the guide's characters can
// never take, missing prerequisites, accepts above the plausible level,
// accepts closed by an exclusive quest taken earlier, accepts never turned in
// on a route, `complete` on quests without objectives, and required elite
// work in Leveling guides.
//
// validateGuides(guides, data, diag) — guides are resolver output (resolve.js).
// validateSoloPolicy(guides, excluded, diag) — lint only: leveling goals on
// quests the simulator's solo filter excludes (tools/lib/sim/solo.js).

const { applicable, maskExcludes, raceSides, RACE_BY_FILE } = require('./conditions');
const { blockingPrereqs } = require('../data/prereqs');
const SOLO = require('../sim/solo');

// Classic XP needed to go from level L to L+1 (index L). Game facts.
const XP_TO_NEXT = [
	0, 400, 900, 1400, 2100, 2800, 3600, 4500, 5400, 6500, 7600, 8800, 10100, 11400, 12900, 14400, 16000, 17700, 19400, 21300, 23200, 25200, 27300,
	29400, 31700, 34000, 36400, 38900, 41400, 44300, 47400, 50800, 54500, 58600, 62800, 67100, 71600, 76100, 80800, 85700, 90700, 95800, 101000,
	106300, 111800, 117500, 123200, 129100, 135100, 141200, 147500, 153900, 160400, 167100, 173900, 180800, 187900, 195000, 202300, 209800,
];
const MAX_LEVEL = XP_TO_NEXT.length; // 60
const CUM = [0, 0];
for (let l = 2; l <= MAX_LEVEL; l++) CUM[l] = CUM[l - 1] + XP_TO_NEXT[l - 1];

// Quest XP is only part of what a questing route earns; mob kills on the way
// add roughly as much again. Generous on purpose: this only drives a warning.
const ROUTE_XP_FACTOR = 2;

function xpAt(level) {
	return CUM[Math.max(1, Math.min(MAX_LEVEL, level))];
}

function levelAt(xp) {
	let l = 1;
	while (l < MAX_LEVEL && CUM[l + 1] <= xp) l++;
	return l;
}

const OBJECTIVE_VERBS = new Set(['kill', 'collect', 'interact', 'use']);

function guideLayer(g) {
	return { factions: g.faction ? [g.faction] : null, races: g.races || null, classes: g.classes || null };
}

// Elite work: Leveling guides route solo characters, so it may appear only as
// an `optional` extra. An elite is an npcs.json rank 1-3 (elite, rare elite,
// boss) hostile to a side the goal applies to; a friendly one is a talk credit
// (Questie encodes "listen to X" as a kill).
const ELITE_RANKS = new Set([1, 2, 3]);
const FRIENDLY_TO = { Alliance: ['A', 'AH'], Horde: ['H', 'AH'] };
// Goals already reported as elite errors, so the lint solo policy skips them.
const eliteReported = new WeakSet();

function isElite(rank, faction, sides) {
	return ELITE_RANKS.has(Number(rank)) && sides.some((s) => !FRIENDLY_TO[s].includes(faction));
}

function eliteTip(target) {
	return `in a Leveling guide make the goal \`optional\` with the tip "${target} is elite: grouping up is advised."`;
}

// The message for a `kill` of an elite, or a `collect` of an item whose every
// located dropper in data is an elite (the compiler's `from` names one source
// of the same data; one normal dropper keeps the item soloable). Null when
// the goal is not elite work.
function eliteGoal(goal, sides, data) {
	if (goal.t === 'kill' && goal.npc !== undefined) {
		const n = data.npc(goal.npc);
		return n && isElite(n.rank, n.faction, sides) ? `\`kill\` npc ${goal.npc} (${n.name}) is elite; ${eliteTip(n.name)}` : null;
	}
	if (goal.t !== 'collect' || goal.candidates) return null;
	const item = `\`collect\` item ${goal.item}${goal.itemName ? ` (${goal.itemName})` : ''}`;
	const it = data.item(goal.item);
	const sources = [];
	for (const kind of ['npc', 'object']) {
		for (const [id, chance] of Object.entries((it && it.drops && it.drops[kind]) || {})) sources.push({ kind, id: Number(id), chance: Number(chance) || 0 });
	}
	const located = sources.filter((s) => data.spawns(s.kind, s.id).length);
	const list = (located.length ? located : sources).sort((a, b) => b.chance - a.chance);
	if (!list.length) return null;
	const recs = list.map((s) => (s.kind === 'npc' ? data.npc(s.id) : null));
	if (!recs.every((r) => r && isElite(r.rank, r.faction, sides))) return null;
	return `${item} drops only from elites (${[...new Set(recs.map((r) => r.name))].join(', ')}); ${eliteTip(recs[0].name)}`;
}

// The characters a goal applies to, as "side|race|class" keys, narrowed by the
// quest's own race and class masks (so a class quest without `only` still
// applies to that class alone). Two goals can meet on one character only when
// their sets share a key.
function characters(layers, quest) {
	const set = applicable(layers);
	const out = new Set();
	for (const side of set.factions) {
		for (const race of set.races) {
			if (!raceSides(race).includes(side)) continue;
			for (const cls of set.classes) {
				const one = { races: [race], classes: [cls], factions: [side], unknownRace: !RACE_BY_FILE[race] };
				if (!quest || !maskExcludes(one, quest)) out.add(`${side}|${race}|${cls}`);
			}
		}
	}
	return out;
}

function meets(a, b) {
	for (const k of a) if (b.has(k)) return true;
	return false;
}

function minus(a, b) {
	const out = new Set();
	for (const k of a) if (!b.has(k)) out.add(k);
	return out;
}

function questName(data, id, title) {
	const q = data.quest(id);
	const t = (q && q.title) || title;
	return t ? `${id} (${t})` : String(id);
}

function validateGuides(guides, data, diag) {
	const byId = new Map();
	for (const g of guides) {
		const ast = g._ast;
		if (byId.has(g.id)) {
			const first = byId.get(g.id)._ast;
			diag.error(ast.file, ast.line, `duplicate guide id "${g.id}" (also in ${first.file}:${first.line})`);
			continue;
		}
		byId.set(g.id, g);
	}
	// Predecessors through `next` and every route choice (`nextChoices`).
	const preds = new Map();
	for (const g of byId.values()) {
		for (const to of g.nextChoices || (g.next ? [g.next] : [])) {
			if (!byId.has(to)) {
				diag.error(g._ast.file, g._ast.lines.next, `\`next\` points to unknown guide "${to}"`);
				continue;
			}
			const other = byId.get(to);
			if (g.faction && other.faction && other.faction !== g.faction) {
				diag.error(g._ast.file, g._ast.lines.next, `\`next\` offers ${other.faction} guide "${to}" after a ${g.faction} guide`);
			}
			if (!preds.has(to)) preds.set(to, []);
			preds.get(to).push(g);
		}
		if (g.nextChoices) {
			for (const to of g.nextChoices) {
				const other = byId.get(to);
				if (other && !other.pitch) diag.warn(other._ast.file, other._ast.line, `"${to}" is a route choice after "${g.id}" but has no \`pitch\`; the choice window shows its pitch, pros and cons`);
			}
		}
	}

	const ancestors = (g) => {
		const out = [];
		const seen = new Set([g.id]);
		const stack = [...(preds.get(g.id) || [])];
		while (stack.length) {
			const p = stack.pop();
			if (seen.has(p.id)) {
				if (p.id === g.id && !out.includes(p)) out.push(p);
				continue;
			}
			seen.add(p.id);
			out.push(p);
			stack.push(...(preds.get(p.id) || []));
		}
		return out;
	};

	const goalsOf = (g) => g.steps.flatMap((s) => s.goals.map((goal) => ({ step: s, goal })));

	// Route XP: entry = max(guide minLevel, best exit of any predecessor).
	const exitMemo = new Map();
	const entryXp = (g, visiting) => {
		let xp = xpAt(g.minLevel || 1);
		for (const p of preds.get(g.id) || []) {
			if (visiting.has(p.id)) continue;
			xp = Math.max(xp, exitXp(p, visiting));
		}
		return xp;
	};
	const walkXp = (g, start, onAccept) => {
		let xp = start;
		for (const { step, goal } of goalsOf(g)) {
			if (goal.t === 'accept' && onAccept) onAccept(step, goal, xp);
			else if (goal.t === 'turnin') {
				const q = data.quest(goal.quest);
				// Data XP, else the XP the turn-in line states (`xp <N>`).
				const qxp = q && q.xp > 0 ? q.xp : goal.rewards && goal.rewards.xp > 0 ? goal.rewards.xp : 0;
				if (qxp > 0) xp += qxp * ROUTE_XP_FACTOR;
			} else if (goal.t === 'level') xp = Math.max(xp, xpAt(goal.level));
		}
		return xp;
	};
	const exitXp = (g, visiting = new Set()) => {
		if (exitMemo.has(g.id)) return exitMemo.get(g.id);
		visiting.add(g.id);
		const out = walkXp(g, entryXp(g, visiting));
		visiting.delete(g.id);
		exitMemo.set(g.id, out);
		return out;
	};

	// Accept and turn-in goals with the characters they apply to, per guide.
	const questGoalMemo = new Map();
	const questGoals = (g) => {
		if (!questGoalMemo.has(g.id)) {
			const gl = guideLayer(g);
			const list = [];
			for (const { step, goal } of goalsOf(g)) {
				if (goal.quest === undefined || (goal.t !== 'accept' && goal.t !== 'turnin')) continue;
				list.push({ goal, chars: characters([gl, step._only, goal._only], data.quest(goal.quest)) });
			}
			questGoalMemo.set(g.id, list);
		}
		return questGoalMemo.get(g.id);
	};
	const successors = (g) => (g.nextChoices || (g.next ? [g.next] : [])).map((id) => byId.get(id)).filter(Boolean);
	// Characters for whom every route from the start of guide h turns quest q
	// in (null: every character, for a loop back into a guide being walked).
	const coveredMemo = new Map();
	const covered = (h, q, visiting = new Set()) => {
		const key = `${h.id}|${q}`;
		if (coveredMemo.has(key)) return coveredMemo.get(key);
		if (visiting.has(h.id)) return null;
		visiting.add(h.id);
		const next = successors(h);
		let after = next.length ? null : new Set();
		for (const s of next) {
			const c = covered(s, q, visiting);
			if (c) after = after ? new Set([...after].filter((k) => c.has(k))) : c;
		}
		visiting.delete(h.id);
		let out = null;
		if (after) {
			out = new Set(after);
			for (const t of questGoals(h)) if (t.goal.t === 'turnin' && t.goal.quest === q) for (const k of t.chars) out.add(k);
		}
		coveredMemo.set(key, out);
		return out;
	};

	for (const g of byId.values()) {
		const file = g._ast.file;
		const accepted = new Set();
		const turnedIn = new Set();
		const learned = new Set();
		// Quests accepted or turned in earlier on the path -> their character sets.
		const taken = new Map();
		const take = (t) => {
			if (!taken.has(t.goal.quest)) taken.set(t.goal.quest, []);
			taken.get(t.goal.quest).push(t.chars);
		};
		for (const a of ancestors(g)) {
			for (const { goal } of goalsOf(a)) {
				if (goal.t === 'accept') accepted.add(goal.quest);
				if (goal.t === 'turnin') turnedIn.add(goal.quest);
				if (goal.t === 'learn') learned.add(goal.spell);
			}
			for (const t of questGoals(a)) take(t);
		}
		const own = new Map(questGoals(g).map((t) => [t.goal, t]));
		const gl = guideLayer(g);
		const leveling = g.category === 'Leveling';
		for (const { step, goal } of goalsOf(g)) {
			const ln = goal._line;
			const q = goal.quest !== undefined ? data.quest(goal.quest) : null;
			if (leveling && !goal.optional) {
				const elite = eliteGoal(goal, applicable([gl, step._only, goal._only]).factions, data);
				if (elite) {
					diag.error(file, ln, elite);
					eliteReported.add(goal);
				}
			}
			if (goal.t === 'accept') {
				const set = applicable([gl, step._only, goal._only]);
				if (q) {
					const why = maskExcludes(set, q);
					if (why) {
						diag.error(file, ln, `quest ${goal.quest} (${goal.title}) is not available to any ${why === 'race' ? 'race' : 'class'} this ${goal._only ? 'goal' : 'step'} applies to`);
					}
					// Only blocking prerequisites count (tools/lib/data/prereqs.js): every
					// one of `all`, one of `any`; breadcrumbs never block.
					const { all, any } = blockingPrereqs(q, (id) => data.quest(id));
					// A prerequisite these characters cannot take is someone else's variant.
					const takeable = (p) => {
						const pq = data.quest(p);
						return !(pq && maskExcludes(set, pq));
					};
					const name = (p) => {
						const pq = data.quest(p);
						return pq && pq.title ? `${p} (${pq.title})` : String(p);
					};
					for (const p of all.filter((p) => !turnedIn.has(p) && takeable(p))) {
						diag.warn(file, ln, `quest ${goal.quest} needs ${name(p)} turned in first, but the chain never turns it in`);
					}
					if (any.length && !any.some((p) => turnedIn.has(p))) {
						const open = any.filter(takeable).map(name);
						if (open.length === 1) {
							diag.warn(file, ln, `quest ${goal.quest} needs ${open[0]} turned in first, but the chain never turns it in`);
						} else if (open.length > 1) {
							diag.warn(file, ln, `quest ${goal.quest} needs one of ${open.join(', ')} turned in first, but the chain turns in none of them`);
						}
					}
					// Exclusive quests (`excl`, Questie exclusiveTo): the game does not
					// offer this one while one of them is in the log or done.
					const mine = own.get(goal);
					for (const e of q.excl || []) {
						if ((taken.get(e) || []).some((chars) => meets(chars, mine.chars))) {
							diag.warn(file, ln, `quest ${questName(data, goal.quest, goal.title)} is not offered once ${questName(data, e)} is in the log or done, and the chain takes that quest earlier`);
						}
					}
				}
				accepted.add(goal.quest);
				take(own.get(goal));
			} else if (goal.t === 'turnin' || goal.t === 'complete' || (OBJECTIVE_VERBS.has(goal.t) && goal.quest !== undefined)) {
				if (!accepted.has(goal.quest)) {
					diag.error(file, ln, `\`${goal.t}\` for quest ${goal.quest} that is never accepted earlier in this guide or a guide chaining into it`);
				}
				if (goal.t === 'turnin') {
					turnedIn.add(goal.quest);
					take(own.get(goal));
				}
				if (goal.t === 'complete' && q && Array.isArray(q.objectives) && q.objectives.length === 0) {
					diag.warn(file, ln, `\`complete\` for quest ${questName(data, goal.quest, goal.title)}, which has no objectives: the action is the turn-in; use \`turnin\``);
				}
			} else if (goal.t === 'learn') {
				learned.add(goal.spell);
			} else if (goal.t === 'craft' && !learned.has(goal.spell)) {
				const found = data.recipe(goal.spell);
				const r = found && found.recipe;
				// Recipes a trainer hands out free with the profession are known without a `learn`.
				const starter = r && r.source === 'trainer' && Number(r.learnedAt) <= 1 && r.cost !== undefined && Number(r.cost) === 0;
				if (!starter) {
					diag.warn(file, ln, `\`craft\` ${goal.spell} (${goal.spellName || 'unknown recipe'}) before any \`learn ${goal.spell}\` earlier in this guide or a guide chaining into it`);
				}
			}
		}

		// Accepts (not `optional`) the route never turns in: later in this guide,
		// else on every route after it, checked per route choice.
		const qg = questGoals(g);
		qg.forEach((a, i) => {
			if (a.goal.t !== 'accept' || a.goal.optional || !a.chars.size) return;
			let open = a.chars;
			for (const t of qg.slice(i + 1)) if (t.goal.t === 'turnin' && t.goal.quest === a.goal.quest) open = minus(open, t.chars);
			if (!open.size) return;
			const name = questName(data, a.goal.quest, a.goal.title);
			const some = (left) => (left.size < a.chars.size ? ' for some of the characters it applies to' : '');
			const routes = successors(g).map((s) => {
				const c = covered(s, a.goal.quest);
				return { s, left: c ? minus(open, c) : new Set() };
			});
			const failing = routes.filter((r) => r.left.size);
			if (!routes.length || failing.length === routes.length) {
				const left = new Set(routes.length ? failing.flatMap((r) => [...r.left]) : open);
				diag.warn(file, a.goal._line, `quest ${name} is accepted but never turned in later in this guide or a guide after it${some(left)}`);
				return;
			}
			for (const r of failing) diag.warn(file, a.goal._line, `quest ${name} is accepted but never turned in on the route through "${r.s.id}"${some(r.left)}`);
		});

		if (data.hasXp) {
			walkXp(g, entryXp(g, new Set([g.id])), (step, goal, xp) => {
				if (!(goal.minLevel > 0)) return;
				const reach = levelAt(xp);
				if (goal.minLevel > reach) {
					diag.warn(file, goal._line, `quest ${goal.quest} needs level ${goal.minLevel}, but the route plausibly reaches only level ${reach} here`);
				}
			});
		}
	}
}

// Leveling guides route solo characters: a goal that needs a quest the
// simulator's solo filter excludes in a solo category (or as a profession
// quest) should be `optional`; an elite one must be (an error, unless the
// goal was already reported as elite work). `excluded` maps a faction to the
// world's exclusions by quest id ({ title, reason, category }, world.excluded
// in data/sim/world-<faction>.json); a missing faction is not checked.
const SOLO_GOALS = new Set(['accept', 'turnin', 'complete', ...OBJECTIVE_VERBS]);

function soloExclusion(e) {
	if (e.category) return SOLO.CATEGORIES.includes(e.category) ? e.category : null;
	return e.reason === 'profession' ? 'profession' : null;
}

function validateSoloPolicy(guides, excluded, diag) {
	for (const g of guides) {
		if (g.category !== 'Leveling') continue;
		const gl = guideLayer(g);
		for (const step of g.steps) {
			for (const goal of step.goals) {
				if (goal.optional || goal.quest === undefined || !SOLO_GOALS.has(goal.t) || eliteReported.has(goal)) continue;
				for (const side of applicable([gl, step._only, goal._only]).factions) {
					const e = excluded[side] && excluded[side].get(goal.quest);
					const why = e && soloExclusion(e);
					if (!why) continue;
					const title = e.title || goal.title;
					if (why === 'elite') {
						diag.error(g._ast.file, goal._line, `quest ${goal.quest} (${title}) is elite (solo filter: ${e.reason}); ${eliteTip(title)}`);
					} else {
						diag.warn(g._ast.file, goal._line, `quest ${goal.quest} (${title}) is excluded from solo leveling (${why}: ${e.reason}); make the goal \`optional\``);
					}
					break;
				}
			}
		}
	}
}

module.exports = { validateGuides, validateSoloPolicy, xpAt, levelAt };
