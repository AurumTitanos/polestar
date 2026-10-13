'use strict';
// World geometry for the route planner. Map percent (0-100) converts to world
// yards through the Era bounds in map-frames.json (docs/ARCHITECTURE.md "Map
// frames"): wx = top + (bottom - top) * y/100, wy = left + (right - left) * x/100.
// Live-frame spawns ("l") convert to world yards through the map's Forever
// bounds (`forever`) and come back as Era-frame percent, so every point a
// projector returns is in the Era frame when the map has Era bounds: clusters
// never mix frames, and generators can write the numbers into `coords era`
// guides as they are.

// Distance between points on different continents. Finite so that tour
// arithmetic stays exact; large enough that no route ever prefers it.
const FAR = 1e6;

// Fallback when a map has no registered bounds: a 1000-yard square.
const FALLBACK = { c: 0, left: 0, right: -1000, top: 0, bottom: -1000 };

function makeProjector(frames, warn) {
	const era = (frames && frames.era) || {};
	const forever = (frames && frames.forever) || {};
	const warned = new Set();
	function bounds(map) {
		const b = era[String(map)];
		if (b && [b.left, b.right, b.top, b.bottom].every((v) => typeof v === 'number')) return b;
		if (!warned.has(map)) {
			warned.add(map);
			if (warn) warn(`map ${map} has no Era bounds in map-frames.json; distances assume a 1000-yard square`);
		}
		return { ...FALLBACK, c: -Number(map) };
	}
	// A route point: map percent (in frame `f` of its source spawns, "e" or
	// "l"; null when given by the author) plus world position. An "l" point
	// on a map with both Forever and Era bounds comes back in the Era frame
	// (f "e"); without Era bounds it stays live and projects through Forever's.
	function point(map, x, y, f = null) {
		const lb = f === 'l' ? liveBounds(map) : null;
		if (lb) {
			const wx = lb.top + ((lb.bottom - lb.top) * y) / 100;
			const wy = lb.left + ((lb.right - lb.left) * x) / 100;
			const eb = era[String(map)];
			if (eb && hasBounds(eb) && eb.c === lb.c) {
				return {
					map: Number(map),
					x: round2(((wy - eb.left) / (eb.right - eb.left)) * 100),
					y: round2(((wx - eb.top) / (eb.bottom - eb.top)) * 100),
					f: 'e',
					c: eb.c,
					wx,
					wy,
				};
			}
			if (!eb) return { map: Number(map), x, y, f, c: lb.c, wx, wy };
		}
		const b = bounds(map);
		return {
			map: Number(map),
			x,
			y,
			f,
			c: b.c,
			wx: b.top + ((b.bottom - b.top) * y) / 100,
			wy: b.left + ((b.right - b.left) * x) / 100,
		};
	}
	function liveBounds(map) {
		const b = forever[String(map)];
		return b && hasBounds(b) ? b : null;
	}
	return { point, bounds };
}

function hasBounds(b) {
	return [b.left, b.right, b.top, b.bottom].every((v) => typeof v === 'number');
}

function round2(v) {
	return Math.round(v * 100) / 100;
}

function dist(a, b) {
	if (a.c !== b.c) return FAR;
	return Math.hypot(a.wx - b.wx, a.wy - b.wy);
}

// Distance from p to the segment a-b, in yards.
function segDist(p, a, b) {
	if (p.c !== a.c || p.c !== b.c) return Math.min(dist(p, a), dist(p, b));
	const dx = b.wx - a.wx;
	const dy = b.wy - a.wy;
	const len2 = dx * dx + dy * dy;
	let t = len2 > 0 ? ((p.wx - a.wx) * dx + (p.wy - a.wy) * dy) / len2 : 0;
	if (t < 0) t = 0;
	else if (t > 1) t = 1;
	return Math.hypot(p.wx - (a.wx + t * dx), p.wy - (a.wy + t * dy));
}

function byMapXY(a, b) {
	return a.map - b.map || a.x - b.x || a.y - b.y;
}

// Greedy density clustering: repeatedly take the point with the most
// neighbours within `radius` yards (ties: first in map/x/y order), make it and
// its neighbours a cluster, and remove them. Clusters come out densest first;
// each has a centroid point on the map of its seed.
function clusters(points, radius, project) {
	let rest = points.slice().sort(byMapXY);
	const out = [];
	while (rest.length) {
		let best = 0;
		let bestCount = -1;
		for (let i = 0; i < rest.length; i++) {
			let n = 0;
			for (let j = 0; j < rest.length; j++) if (dist(rest[i], rest[j]) <= radius) n++;
			if (n > bestCount) {
				bestCount = n;
				best = i;
			}
		}
		const seed = rest[best];
		const members = [];
		const keep = [];
		for (const p of rest) (dist(seed, p) <= radius ? members : keep).push(p);
		const same = members.filter((p) => p.map === seed.map);
		const cx = same.reduce((s, p) => s + p.x, 0) / same.length;
		const cy = same.reduce((s, p) => s + p.y, 0) / same.length;
		out.push({ pt: project.point(seed.map, round1(cx), round1(cy), seed.f), size: members.length });
		rest = keep;
	}
	return out;
}

function round1(v) {
	return Math.round(v * 10) / 10;
}

module.exports = { makeProjector, dist, segDist, clusters };
