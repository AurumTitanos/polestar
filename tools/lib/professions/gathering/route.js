'use strict';
// Gathering routes: score zones for a skill band by expected skill-ups per
// yard walked, and turn the winning zone's nodes into a short loop of goto
// waypoints (weighted density clusters ordered as a closed tour).

const { makeProjector, dist } = require('../../route/geo');
const { planTour, pathLength } = require('../../route/tour');
const { bandWeight } = require('./tables');

const DEDUPE_YARDS = 5;
// A lap shorter than this outruns node respawns, so short laps score as if
// they were this long (yards).
const MIN_LAP_YARDS = 3000;

function projector(data) {
	return makeProjector(data.mapFrames || data['map-frames'] || {});
}

// Every spawn on `map` of the objects whose name is in `table` ({ name: req })
// and whose roles include `role`, weighted for the band [from, to).
function nodePoints(objects, project, { table, role, map, from, to }) {
	const out = [];
	for (const o of Object.values(objects)) {
		if (!o.roles || !o.roles.includes(role)) continue;
		const req = table[o.name];
		if (req === undefined) continue;
		const w = bandWeight(req, from, to);
		if (w <= 0) continue;
		const s = o.spawns && o.spawns[String(map)];
		if (!s) continue;
		for (const [x, y] of s.pts) {
			const pt = project.point(map, x, y, s.f);
			if (out.some((p) => p.name === o.name && dist(p.pt, pt) < DEDUPE_YARDS)) continue;
			out.push({ name: o.name, req, w, pt });
		}
	}
	return out;
}

// Greedy weighted clustering: seed = point with the heaviest neighbourhood.
function weightedClusters(points, radius, project) {
	let rest = points.slice().sort((a, b) => a.pt.x - b.pt.x || a.pt.y - b.pt.y || a.name.localeCompare(b.name));
	const out = [];
	while (rest.length) {
		let best = 0;
		let bestW = -1;
		for (let i = 0; i < rest.length; i++) {
			let w = 0;
			for (const p of rest) if (dist(rest[i].pt, p.pt) <= radius) w += p.w;
			if (w > bestW + 1e-9) {
				bestW = w;
				best = i;
			}
		}
		const seed = rest[best];
		const members = rest.filter((p) => dist(seed.pt, p.pt) <= radius);
		rest = rest.filter((p) => dist(seed.pt, p.pt) > radius);
		const x = members.reduce((s, p) => s + p.pt.x, 0) / members.length;
		const y = members.reduce((s, p) => s + p.pt.y, 0) / members.length;
		const counts = {};
		for (const p of members) counts[p.name] = (counts[p.name] || 0) + 1;
		out.push({
			pt: project.point(seed.pt.map, Math.round(x * 10) / 10, Math.round(y * 10) / 10, seed.pt.f),
			w: bestW,
			counts,
		});
	}
	return out;
}

// Expected skill-ups per yard for one lap over every useful node in the zone.
function scorePoints(points) {
	if (!points.length) return { gain: 0, length: Infinity, score: 0 };
	const gain = points.reduce((s, p) => s + p.w, 0);
	const start = points[0].pt;
	const order = planTour(start, points.slice(1), start);
	const length = Math.max(1, pathLength(start, order, start));
	return { gain, length, score: gain / Math.max(length, MIN_LAP_YARDS) };
}

// A loop of at most `maxStops` cluster waypoints covering `cover` of the
// zone's skill-up weight, starting from the cluster nearest `entry`.
function loop(points, project, { radius = 110, maxStops = 12, cover = 0.85, entry = null } = {}) {
	const cl = weightedClusters(points, radius, project);
	const total = cl.reduce((s, c) => s + c.w, 0);
	const keep = [];
	let acc = 0;
	for (const c of cl) {
		if (keep.length >= maxStops || (keep.length >= 3 && acc >= cover * total)) break;
		keep.push(c);
		acc += c.w;
	}
	if (!keep.length) return [];
	let first = keep[0];
	if (entry) {
		for (const c of keep) if (dist(entry, c.pt) < dist(entry, first.pt)) first = c;
	}
	const rest = keep.filter((c) => c !== first);
	return [first, ...planTour(first.pt, rest, first.pt)];
}

module.exports = { projector, nodePoints, weightedClusters, scorePoints, loop };
