'use strict';
// Guide legs: the walks between a guide's located goals, the unit the
// navigation grid's arrow waypoints (via.json, `nav via`) are kept per. One
// definition for the compiler (attaching `via`), the generator and the planner
// (docs/superpowers/specs/2026-10-15-arrow-waypoints-design.md, section 1).
//
// guideLegs(guide, { frames }) -> [{ si, gi, from, to, key, yards }]
//   guide: compiled (resolveGuide output); frames: map-frames.json
//   ({ era, forever }). si/gi: the step and goal index of the leg's goal (its
//   end); from/to: { map, x, y, f, isGoto } with f "e" (Era) or "l" (live) and
//   isGoto true when that end's goal is a `goto` (a hand-placed arrow fix);
//   yards: the straight distance.
// legKey(from, to) -> "1426:29.81,71.2>1426e:22.6,71.43"
//
// A goal is located when it has map, x and y and no `candidates` (smart
// targets are placed at runtime). The leg into a located goal G starts at the
// last located goal P before it in the same guide (steps, then goals) whose
// conditions are the same as G's or weaker: P's effective `only` (step `only`
// and goal `only`) is none, or equals G's. Legs whose ends lie on different
// continents (frames' `c`), on maps without bounds, or less than
// LEG_MIN_YARDS apart are not legs.

const LEG_MIN_YARDS = 40;
const ONLY_KEYS = ['classes', 'races', 'factions'];

// Two decimals, no trailing zeros ("71.2", "50").
function coord(n) {
	return String(Number(Number(n).toFixed(2)));
}

function end(p) {
	return `${p.map}${p.f === 'e' ? 'e' : ''}:${coord(p.x)},${coord(p.y)}`;
}

function legKey(from, to) {
	return `${end(from)}>${end(to)}`;
}

// The bounds a point is read with: Era for "e", else live (Era when the live
// ones are unknown), as the addon reads them.
function boundsOf(frames, map, f) {
	const era = (frames && frames.era) || {};
	const live = (frames && frames.forever) || {};
	return (f === 'e' ? era[map] : live[map] || era[map]) || null;
}

function world(b, x, y) {
	return [b.left + ((b.right - b.left) * x) / 100, b.top + ((b.bottom - b.top) * y) / 100];
}

// A step's and a goal's `only` as one canonical string ('' for none): per
// key, the lists that apply (each sorted, duplicates dropped), in key order.
function effectiveOnly(step, goal) {
	const parts = [];
	for (const k of ONLY_KEYS) {
		const lists = new Set();
		for (const o of [step.only, goal.only]) if (o && Array.isArray(o[k]) && o[k].length) lists.add(JSON.stringify([...o[k]].map(String).sort()));
		if (lists.size) parts.push(`${k}=${[...lists].sort().join('&')}`);
	}
	return parts.join(';');
}

function located(goal) {
	return goal.map !== undefined && goal.x !== undefined && goal.y !== undefined && goal.candidates === undefined;
}

function guideLegs(guide, { frames } = {}) {
	const legs = [];
	const seen = []; // located goals so far: { point, only }
	(guide.steps || []).forEach((step, si) => {
		(step.goals || []).forEach((goal, gi) => {
			if (!located(goal)) return;
			const to = { map: goal.map, x: goal.x, y: goal.y, f: goal.f === 'e' ? 'e' : 'l', isGoto: goal.t === 'goto' };
			const only = effectiveOnly(step, goal);
			let prev = null;
			for (let i = seen.length - 1; i >= 0; i--) {
				if (seen[i].only === '' || seen[i].only === only) {
					prev = seen[i];
					break;
				}
			}
			seen.push({ point: to, only });
			if (!prev) return;
			const from = prev.point;
			const a = boundsOf(frames, from.map, from.f);
			const b = boundsOf(frames, to.map, to.f);
			if (!a || !b || a.c !== b.c) return;
			const [ax, ay] = world(a, from.x, from.y);
			const [bx, by] = world(b, to.x, to.y);
			const yards = Math.hypot(bx - ax, by - ay);
			if (yards < LEG_MIN_YARDS) return;
			legs.push({ si, gi, from: { ...from }, to: { ...to }, key: legKey(from, to), yards });
		});
	});
	return legs;
}

module.exports = { guideLegs, legKey, LEG_MIN_YARDS };
