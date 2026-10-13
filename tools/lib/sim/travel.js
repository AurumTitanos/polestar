'use strict';
// Travel between two points (docs/SIMULATION.md §1 "Travel graph"):
// walking (straight line × the continent's detour factor) or walk to a
// transport node + the network + walk from a node, whichever is cheaper.
// The network: flights between known flight paths, boats/zeppelins/trams
// (average wait + ride) and walking between nodes of the same landmass.
// All-pairs shortest times over the nodes are kept per known-flight-path set
// (and mounted or not); learning one flight path updates the parent set's
// matrix in O(edges × N²) instead of recomputing it.
//
// Travel safety: a direct walk whose straight line crosses zones (other than
// the zones it starts and ends in) whose minimum mob level is DANGER_GAP or
// more above the character costs `deathRisk` seconds per such zone (deaths,
// corpse runs, detours), so the network path wins when it is safer. The
// crossed zones of a leg are sampled once (every 200 yd on run.danger) and
// cached by point pair.

const { NEAR_K } = require('./run');

const SHORT = 400; // yards: below this, walking always wins
const DANGER_GAP = 5; // levels: zones this far above the character are dangerous to cross
const NONE = new Int32Array(0);

class Travel {
	constructor(run, tables, { cacheMax = 6000 } = {}) {
		this.run = run;
		this.t = tables;
		this.N = run.N;
		this.cacheMax = cacheMax;
		this.cache = new Map();
		this.crossCache = new Map();
		this.NP = run.ptList ? run.ptList.length : 0;
		// Flight-path bit -> node.
		this.fpNode = [];
		for (let n = 0; n < run.N; n++) if (run.fpBit[n] >= 0) this.fpNode[run.fpBit[n]] = n;
		// Taxi edges by node.
		this.taxiFrom = Array.from({ length: run.N }, () => []);
		for (const [a, b, sec] of run.taxi) this.taxiFrom[a].push([b, sec]);
		this.base = [this.baseMatrix(false), this.baseMatrix(true)];
	}

	speed(mounted) {
		const p = this.t.p;
		return p.runSpeed * (mounted ? p.mountMul : 1);
	}

	baseMatrix(mounted) {
		const { run, N } = this;
		const p = this.t.p;
		const D = new Float32Array(N * N).fill(Infinity);
		const v = this.speed(mounted);
		for (let i = 0; i < N; i++) {
			D[i * N + i] = 0;
			for (let j = 0; j < N; j++) {
				if (i === j || run.nodeR[i] !== run.nodeR[j]) continue;
				const d = Math.hypot(run.nodeX[i] - run.nodeX[j], run.nodeY[i] - run.nodeY[j]);
				D[i * N + j] = (d * this.t.detour(run.nodeC[i])) / v;
			}
		}
		for (const [a, b, ride, wait] of run.rides) {
			const c = ride + wait * p.transportWait;
			if (c < D[a * N + b]) D[a * N + b] = c;
		}
		// Floyd-Warshall.
		for (let k = 0; k < N; k++) {
			for (let i = 0; i < N; i++) {
				const dik = D[i * N + k];
				if (dik === Infinity) continue;
				for (let j = 0; j < N; j++) {
					const c = dik + D[k * N + j];
					if (c < D[i * N + j]) D[i * N + j] = c;
				}
			}
		}
		return D;
	}

	// Matrix for `mask` (bits = run.fpBit of known flight masters) when the
	// parent matrix `D` (mask without node k) is known.
	learn(D, mask, k, mounted) {
		const key = mounted ? mask + 2 ** 51 : mask;
		let M = this.cache.get(key);
		if (M) return M;
		if (this.cache.size >= this.cacheMax) this.cache.clear();
		M = D.slice();
		const { run, N } = this;
		const over = this.t.p.flightOverhead;
		const edges = [];
		for (const [b, sec] of this.taxiFrom[k]) {
			const bb = run.fpBit[b];
			if (bb >= 0 && Math.floor(mask / 2 ** bb) % 2 === 1) {
				edges.push(k, b, sec + over);
			}
		}
		for (let a = 0; a < N; a++) {
			if (a === k) continue;
			const ab = run.fpBit[a];
			if (ab < 0 || Math.floor(mask / 2 ** ab) % 2 !== 1) continue;
			for (const [b, sec] of this.taxiFrom[a]) if (b === k) edges.push(a, k, sec + over);
		}
		for (let e = 0; e < edges.length; e += 3) {
			const a = edges[e];
			const b = edges[e + 1];
			const w = edges[e + 2];
			if (!(w < M[a * N + b])) continue;
			for (let i = 0; i < N; i++) {
				const ia = M[i * N + a];
				if (ia === Infinity) continue;
				const base = ia + w;
				for (let j = 0; j < N; j++) {
					const c = base + M[b * N + j];
					if (c < M[i * N + j]) M[i * N + j] = c;
				}
			}
		}
		this.cache.set(key, M);
		return M;
	}

	// Matrix for a known-flight-path set, always built the same way: from the
	// set without its highest bit, adding that node (cached by set). A route's
	// times therefore never depend on which routes were evaluated before
	// (Float32 sums taken in another order would round differently).
	matrixFor(mask, mounted) {
		if (mask === 0) return this.base[mounted ? 1 : 0];
		const key = mounted ? mask + 2 ** 51 : mask;
		const hit = this.cache.get(key);
		if (hit) return hit;
		let b = this.fpNode.length - 1;
		while (b > 0 && Math.floor(mask / 2 ** b) % 2 !== 1) b--;
		return this.learn(this.matrixFor(mask - 2 ** b, mounted), mask, this.fpNode[b], mounted);
	}

	// Minimum levels of the zones a straight walk from a to b crosses (not
	// counting the zones of a and b), highest first; cached per pair.
	crossed(a, b) {
		const key = a * this.NP + b;
		let c = this.crossCache.get(key);
		if (c) return c;
		const run = this.run;
		c = NONE;
		const g = run.danger && run.danger.get(run.pR[a]);
		if (g) {
			const za = run.pMap[a];
			const zb = run.pMap[b];
			const ax = run.pX[a];
			const ay = run.pY[a];
			const dx = run.pX[b] - ax;
			const dy = run.pY[b] - ay;
			const n = Math.ceil(Math.hypot(dx, dy) / g.cell);
			const seen = [];
			for (let i = 1; i < n; i++) {
				const gx = Math.floor((ax + (dx * i) / n) / g.cell) - g.gx0;
				const gy = Math.floor((ay + (dy * i) / n) / g.cell) - g.gy0;
				if (gx < 0 || gy < 0 || gx >= g.nx || gy >= g.ny) continue;
				const z = g.z[gx * g.ny + gy];
				if (!z || z === za || z === zb || seen.includes(z)) continue;
				seen.push(z);
			}
			const mins = [];
			for (const z of seen) {
				const m = run.zoneMin.get(z);
				if (m != null) mins.push(m);
			}
			if (mins.length) c = Int32Array.from(mins.sort((x, y) => y - x));
		}
		if (this.crossCache.size >= 200000) this.crossCache.clear();
		this.crossCache.set(key, c);
		return c;
	}

	// Seconds from point a to point b (run point indices) with matrix D, for
	// a character of `level` (travel safety). Returns walking-only time when
	// that is cheaper. Sets this.lastMode: 0 walk, 1 network; this.lastRisk:
	// dangerous zones the chosen walk crosses.
	leg(a, b, D, mounted, level = 60) {
		this.lastRisk = 0;
		if (a === b) return 0;
		const run = this.run;
		const v = this.speed(mounted);
		let walk = Infinity;
		if (run.pR[a] === run.pR[b]) {
			const d = Math.hypot(run.pX[a] - run.pX[b], run.pY[a] - run.pY[b]);
			walk = (d * this.t.detour(run.pC[a])) / v;
			if (d < SHORT) {
				this.lastMode = 0;
				return walk;
			}
			const risk = this.t.p.deathRisk;
			if (risk > 0) {
				const mins = this.crossed(a, b);
				let k = 0;
				while (k < mins.length && mins[k] >= level + DANGER_GAP) k++;
				if (k) {
					walk += k * risk;
					this.lastRisk = k;
				}
			}
		}
		let best = walk;
		this.lastMode = 0;
		const N = this.N;
		const ka = a * NEAR_K;
		const kb = b * NEAR_K;
		const da = this.t.detour(run.pC[a]) / v;
		const db = this.t.detour(run.pC[b]) / v;
		for (let i = 0; i < NEAR_K; i++) {
			const ni = run.pNear[ka + i];
			if (ni < 0) break;
			const wi = run.pNearD[ka + i] * da;
			if (wi >= best) continue;
			for (let j = 0; j < NEAR_K; j++) {
				const nj = run.pNear[kb + j];
				if (nj < 0) break;
				const dn = D[ni * N + nj];
				const c = wi + dn + run.pNearD[kb + j] * db;
				if (c < best) {
					// A "network" path that only walks between nodes is a walk
					// (never cheaper than the direct one, which carries the
					// travel-safety cost): it does not count.
					if (ni === nj) continue;
					if (run.nodeR[ni] === run.nodeR[nj] && dn >= (Math.hypot(run.nodeX[ni] - run.nodeX[nj], run.nodeY[ni] - run.nodeY[nj]) * this.t.detour(run.nodeC[ni])) / v - 0.05) continue;
					best = c;
					this.lastMode = 1;
				}
			}
		}
		if (this.lastMode === 1) this.lastRisk = 0;
		return best;
	}
}

module.exports = { Travel, SHORT, DANGER_GAP };
