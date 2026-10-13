'use strict';
// Spawn point reduction: round to two decimals, drop near-identical points,
// and cap the points kept per entity per map with an even spatial spread
// (farthest-point sampling from the point nearest the centroid). Entities
// with at most `cap` distinct points keep all of them. Output is sorted by
// x then y, so the result depends only on the input set.

const DEFAULTS = { cap: 24, dedupe: 0.3 };

function round2(v) {
	return Math.round(v * 100) / 100;
}

function byXY(a, b) {
	return a[0] - b[0] || a[1] - b[1];
}

function dedupe(points, eps) {
	const sorted = points.slice().sort(byXY);
	const out = [];
	if (eps <= 0) {
		for (const p of sorted) {
			const last = out[out.length - 1];
			if (!last || last[0] !== p[0] || last[1] !== p[1]) out.push(p);
		}
		return out;
	}
	const grid = new Map();
	const eps2 = eps * eps;
	for (const p of sorted) {
		const gx = Math.floor(p[0] / eps);
		const gy = Math.floor(p[1] / eps);
		let near = false;
		for (let dx = -1; dx <= 1 && !near; dx++) {
			for (let dy = -1; dy <= 1 && !near; dy++) {
				const cell = grid.get(`${gx + dx},${gy + dy}`);
				if (!cell) continue;
				for (const q of cell) {
					const ex = q[0] - p[0];
					const ey = q[1] - p[1];
					if (ex * ex + ey * ey <= eps2) {
						near = true;
						break;
					}
				}
			}
		}
		if (near) continue;
		const key = `${gx},${gy}`;
		if (!grid.has(key)) grid.set(key, []);
		grid.get(key).push(p);
		out.push(p);
	}
	return out;
}

function spread(points, cap) {
	if (points.length <= cap) return points;
	let cx = 0;
	let cy = 0;
	for (const p of points) {
		cx += p[0];
		cy += p[1];
	}
	cx /= points.length;
	cy /= points.length;
	let first = 0;
	let bestD = Infinity;
	for (let i = 0; i < points.length; i++) {
		const dx = points[i][0] - cx;
		const dy = points[i][1] - cy;
		const d = dx * dx + dy * dy;
		if (d < bestD) {
			bestD = d;
			first = i;
		}
	}
	const minD = new Float64Array(points.length).fill(Infinity);
	const chosen = [];
	let next = first;
	while (chosen.length < cap) {
		chosen.push(points[next]);
		const [px, py] = points[next];
		minD[next] = -1;
		let far = -1;
		let farD = -1;
		for (let i = 0; i < points.length; i++) {
			if (minD[i] < 0) continue;
			const dx = points[i][0] - px;
			const dy = points[i][1] - py;
			const d = dx * dx + dy * dy;
			if (d < minD[i]) minD[i] = d;
			if (minD[i] > farD) {
				farD = minD[i];
				far = i;
			}
		}
		if (far < 0) break;
		next = far;
	}
	return chosen.sort(byXY);
}

// points: [[x, y], ...] in 0-100 map percent. Returns the reduced list.
function reducePoints(points, options = {}) {
	const { cap, dedupe: eps } = { ...DEFAULTS, ...options };
	const valid = [];
	for (const p of points) {
		const x = round2(Number(p[0]));
		const y = round2(Number(p[1]));
		if (Number.isFinite(x) && Number.isFinite(y) && x >= 0 && x <= 100 && y >= 0 && y <= 100) valid.push([x, y]);
	}
	return spread(dedupe(valid, eps), cap);
}

// pfQuest coords [[x, y, areaId, respawn], ...] -> { "<uiMapID>": { f: "e", pts } }
// plus the number of points dropped because their area has no UiMap.
function eraSpawns(coords, resolveArea, options) {
	const perMap = new Map();
	let unmapped = 0;
	for (const c of coords) {
		if (!Array.isArray(c) || c.length < 3) continue;
		const map = resolveArea(c[2]);
		if (!map) {
			unmapped++;
			continue;
		}
		if (!perMap.has(map)) perMap.set(map, []);
		perMap.get(map).push([c[0], c[1]]);
	}
	const spawns = {};
	for (const map of [...perMap.keys()].sort((a, b) => a - b)) {
		const pts = reducePoints(perMap.get(map), options);
		if (pts.length) spawns[map] = { f: 'e', pts };
	}
	return { spawns, unmapped };
}

module.exports = { reducePoints, eraSpawns, round2, DEFAULTS };
