'use strict';
// Tour ordering over world points: nearest neighbour, then 2-opt. Paths start
// at a fixed point and either end anywhere (open) or at a fixed end point.
// Nodes are any objects; `pt(node)` returns its world point.

const { dist } = require('./geo');

const EPS = 1e-9;

function pathLength(start, order, end, pt = (n) => n.pt) {
	let len = 0;
	let prev = start;
	for (const n of order) {
		const p = pt(n);
		len += dist(prev, p);
		prev = p;
	}
	if (end) len += dist(prev, end);
	return len;
}

// Greedy: always go to the closest unvisited node (ties: input order).
function nearestNeighbour(start, nodes, pt = (n) => n.pt) {
	const left = nodes.slice();
	const order = [];
	let cur = start;
	while (left.length) {
		let bi = 0;
		let bd = Infinity;
		for (let i = 0; i < left.length; i++) {
			const d = dist(cur, pt(left[i]));
			if (d < bd - EPS) {
				bd = d;
				bi = i;
			}
		}
		const [n] = left.splice(bi, 1);
		order.push(n);
		cur = pt(n);
	}
	return order;
}

// 2-opt: reverse a run of nodes whenever that strictly shortens the path.
// The start (and end, when given) stay fixed. Only strict improvements are
// applied, so the result is never longer than the input order.
function twoOpt(start, order, end, pt = (n) => n.pt) {
	const seq = order.slice();
	const n = seq.length;
	if (n < 2) return seq;
	const P = (i) => (i < 0 ? start : i >= n ? end : pt(seq[i]));
	let improved = true;
	let passes = 0;
	while (improved && passes++ < 200) {
		improved = false;
		for (let i = 0; i < n - 1; i++) {
			for (let j = i + 1; j < n; j++) {
				const a = P(i - 1);
				const b = P(i);
				const c = P(j);
				const hasNext = j + 1 < n || !!end;
				const d = hasNext ? P(j + 1) : null;
				const before = dist(a, b) + (hasNext ? dist(c, d) : 0);
				const after = dist(a, c) + (hasNext ? dist(b, d) : 0);
				if (after < before - EPS) {
					for (let l = i, r = j; l < r; l++, r--) {
						const t = seq[l];
						seq[l] = seq[r];
						seq[r] = t;
					}
					improved = true;
				}
			}
		}
	}
	return seq;
}

function planTour(start, nodes, end, pt = (n) => n.pt) {
	return twoOpt(start, nearestNeighbour(start, nodes, pt), end, pt);
}

module.exports = { pathLength, nearestNeighbour, twoOpt, planTour };
