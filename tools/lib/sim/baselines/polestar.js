'use strict';
// Polestar baseline extractor (docs/SIMULATION.md §5): compiles the project's
// guides and turns a race's leveling routes (the default `next` chain and
// every route choice) into normalized event sequences for the simulator.

const fs = require('node:fs');
const path = require('node:path');
const { compileProject } = require('../../dsl/project');
const { CLASSES, RACES } = require('../../dsl/conditions');

const MAX_ENUMERATED = 2000;
const ANY_CLASS_MIN = 8; // a class list this long came from a negation (`!Druid`)

function lower(s) {
	return String(s).trim().toLowerCase();
}

// Contract race name -> the race file name guides use ('Undead' -> 'Scourge');
// unknown races (Skyborne) pass through.
function raceFile(race) {
	const r = RACES[lower(race).replace(/[\s_-]/g, '')];
	return r ? r.file : String(race);
}

function onlyHolds(only, ctx) {
	if (!only) return true;
	if (only.factions && !only.factions.includes(ctx.faction)) return false;
	if (only.races && !only.races.includes(ctx.race)) return false;
	if (only.classes) {
		if (ctx.cls) return only.classes.includes(ctx.cls);
		return only.classes.length >= ANY_CLASS_MIN;
	}
	return true;
}

function guideEvents(g, ctx) {
	const events = [{ t: 'guide', title: g.title, zone: g.zoneName || null, levels: g.minLevel != null ? [g.minLevel, g.maxLevel ?? g.minLevel] : null, id: g.id }];
	for (const step of g.steps || []) {
		if (!onlyHolds(step.only, ctx)) continue;
		const seen = new Set();
		for (const goal of step.goals || []) {
			if (!onlyHolds(goal.only, ctx)) continue;
			let e = null;
			if (goal.t === 'level') e = { t: 'level', level: goal.level, xp: null };
			else if (goal.quest == null) continue;
			else if (goal.t === 'accept' || goal.t === 'turnin') e = { t: goal.t, q: goal.quest };
			else {
				const key = `${goal.quest}/${goal.oi ?? ''}`;
				if (seen.has(key)) continue;
				seen.add(key);
				e = { t: 'complete', q: goal.quest, obj: goal.oi ?? null };
			}
			if (goal.optional) e.optional = true;
			events.push(e);
		}
	}
	return events;
}

function shortNamer(ids, faction) {
	const prefix = `forever/${lower(faction)}/`;
	const rel = (id) => (id.startsWith(prefix) ? id.slice(prefix.length) : id);
	const base = (id) => id.slice(id.lastIndexOf('/') + 1);
	const counts = new Map();
	for (const id of ids) counts.set(base(id), (counts.get(base(id)) || 0) + 1);
	return (id) => (counts.get(base(id)) === 1 ? base(id) : rel(id));
}

// Routes for a race: { default, variants: [{ label, choices, sequence }], graph }
// or null when no Polestar guide starts that race. Event objects are shared
// between the sequences; treat them as read-only.
function loadPolestarRoutes({ guidesDir, dataDir, data = null, faction = null, race, cls = null, quests = null, maxPaths = MAX_ENUMERATED } = {}) {
	const rFile = raceFile(race);
	// A one-side race implies its faction; Skyborne (both sides) needs one given.
	const sides = Object.keys((RACES[lower(race).replace(/[\s_-]/g, '')] || {}).sides || {});
	const fac = faction || (sides.length === 1 ? sides[0] : null);
	if (!fac) throw new Error(`polestar: faction needed for race ${race}`);
	const compiled = compileProject({ guidesDir, dataDir, data });
	if (!quests) quests = compiled.data && compiled.data.quests;
	// Guide id -> its file (relative to guidesDir); resolved guides drop it.
	const fileOf = new Map();
	for (const rel of compiled.files) {
		const m = fs.readFileSync(path.join(guidesDir, rel), 'utf8').match(/^guide\s+(\S+)/m);
		if (m && !fileOf.has(m[1])) fileOf.set(m[1], rel);
	}
	const clsFile = cls ? (CLASSES[lower(cls)] || {}).file || String(cls).toUpperCase() : null;
	const ctx = { faction: fac, race: rFile, cls: clsFile };

	const leveling = compiled.guides.filter((g) => g.category === 'Leveling' && (!g.faction || g.faction === fac));
	const byId = new Map(leveling.map((g) => [g.id, g]));
	const starts = leveling
		.filter((g) => g.races && g.races.includes(rFile))
		.sort((a, b) => (a.minLevel ?? 99) - (b.minLevel ?? 99) || (a.id < b.id ? -1 : 1));
	const start = starts[0];
	if (!start) return null;

	const options = (g) => {
		const list = g.nextChoices && g.nextChoices.length ? g.nextChoices : g.next ? [g.next] : [];
		return list.filter((id) => byId.has(id));
	};

	// Graph of everything reachable from the start guide.
	const nodes = [];
	const edges = [];
	const reach = new Set([start.id]);
	for (let i = 0, queue = [start.id]; i < queue.length; i++) {
		const g = byId.get(queue[i]);
		nodes.push({ id: g.id, title: g.title, levels: g.minLevel != null ? [g.minLevel, g.maxLevel ?? g.minLevel] : null, zone: g.zoneName || null });
		for (const to of options(g)) {
			edges.push({ from: g.id, to, default: to === g.next });
			if (!reach.has(to)) {
				reach.add(to);
				queue.push(to);
			}
		}
	}
	const short = shortNamer([...reach], fac);

	const eventCache = new Map();
	const eventsOf = (id) => {
		if (!eventCache.has(id)) eventCache.set(id, guideEvents(byId.get(id), ctx));
		return eventCache.get(id);
	};

	const makeSequence = (ids, label) => {
		const events = [];
		for (const id of ids) events.push(...eventsOf(id));
		const qids = [];
		const seen = new Set();
		for (const e of events) {
			if (e.q == null || seen.has(e.q)) continue;
			seen.add(e.q);
			qids.push(e.q);
		}
		return {
			source: 'polestar',
			label,
			faction: fac,
			race,
			class: cls || null,
			guides: ids.map((id) => ({ title: byId.get(id).title, file: fileOf.get(id) || null, id })),
			events,
			missing: quests ? qids.filter((q) => !Object.hasOwn(quests, String(q))) : [],
			flagged: [],
		};
	};

	const choicesOf = (ids) => {
		const out = [];
		for (let i = 0; i + 1 < ids.length; i++) {
			const g = byId.get(ids[i]);
			if (ids[i + 1] !== g.next) out.push({ from: ids[i], to: ids[i + 1] });
		}
		return out;
	};
	const labelOf = (choices) => (choices.length ? choices.map((c) => `${short(c.to)}@${short(c.from)}`).join(' + ') : 'default');

	// Default: follow `next` until it ends or would revisit a guide.
	const defIds = [start.id];
	for (let g = start; g.next && byId.has(g.next) && !defIds.includes(g.next); g = byId.get(g.next)) defIds.push(g.next);

	// Complete paths through the choices (no guide twice), counted up to the cap.
	let count = 0;
	const countPaths = (id, seen) => {
		if (count > maxPaths) return;
		const opts = options(byId.get(id)).filter((o) => !seen.has(o));
		if (!opts.length) {
			count++;
			return;
		}
		for (const o of opts) {
			seen.add(o);
			countPaths(o, seen);
			seen.delete(o);
		}
	};
	countPaths(start.id, new Set([start.id]));

	const paths = [];
	if (count <= maxPaths) {
		const walk = (ids, seen) => {
			const opts = options(byId.get(ids[ids.length - 1])).filter((o) => !seen.has(o));
			if (!opts.length) {
				paths.push(ids.slice());
				return;
			}
			for (const o of opts) {
				ids.push(o);
				seen.add(o);
				walk(ids, seen);
				seen.delete(o);
				ids.pop();
			}
		};
		walk([start.id], new Set([start.id]));
	} else {
		// Too many: the default route, and the default route with one choice
		// changed (then defaults again, or the first unvisited option).
		paths.push(defIds);
		for (let i = 0; i < defIds.length; i++) {
			const prefix = defIds.slice(0, i + 1);
			const g = byId.get(defIds[i]);
			for (const o of options(g)) {
				if (o === defIds[i + 1] || prefix.includes(o)) continue;
				const ids = [...prefix, o];
				const seen = new Set(ids);
				for (let cur = byId.get(o); ; ) {
					const nx = cur.next && byId.has(cur.next) && !seen.has(cur.next) ? cur.next : options(cur).find((x) => !seen.has(x));
					if (!nx) break;
					ids.push(nx);
					seen.add(nx);
					cur = byId.get(nx);
				}
				paths.push(ids);
			}
		}
	}

	const first = start.minLevel ?? 1;
	const rangeOf = (ids) => {
		const last = byId.get(ids[ids.length - 1]);
		return `${first}-${last.maxLevel ?? last.minLevel ?? '?'}`;
	};
	const variants = paths.map((ids) => {
		const choices = choicesOf(ids);
		const label = labelOf(choices);
		return { label, choices, sequence: makeSequence(ids, `Polestar ${rangeOf(ids)} ${label}`) };
	});
	const defKey = defIds.join('>');
	const defVariant = variants.find((v) => v.sequence.guides.map((x) => x.id).join('>') === defKey);
	return {
		default: defVariant ? defVariant.sequence : makeSequence(defIds, `Polestar ${rangeOf(defIds)} default`),
		variants,
		graph: { nodes, edges },
		mode: count <= maxPaths ? 'all' : 'single-change',
		pathCount: count > maxPaths ? null : count,
	};
}

module.exports = { loadPolestarRoutes };
