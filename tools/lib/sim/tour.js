'use strict';
// Order of a package's steps (accepts, objective sites, turn-ins): nearest
// neighbour under precedence, then 2-opt moves that keep the precedence (as
// `draft` orders its objective tours).
//
// Precedence inside one package:
//   accept(q) before every task(q) and turnin(q)
//   every task(q) before turnin(q)
//   accept(q) after the turn-ins of q's prerequisites that are here (all of
//   them: stricter than the game's any-of, never wrong)
//   accept(child) after accept(parent), before turnin(parent) (quest.inLog)
//   turnin(parent) after the turn-ins of quest.after (its children)
// Steps whose accept is in another package are free to go first.

const FAR = 1e6;

function planOrder(steps, { dist }) {
	const n = steps.length;
	if (n <= 1) return steps.slice();
	const D = (a, b) => {
		const d = dist(steps[a].pt, steps[b].pt);
		return Number.isFinite(d) ? d : FAR;
	};
	// Index the package's steps by quest.
	const byQuest = new Map();
	steps.forEach((s, i) => {
		if (!byQuest.has(s.q)) byQuest.set(s.q, { accept: -1, tasks: [], turnin: -1 });
		const e = byQuest.get(s.q);
		if (s.kind === 'accept') e.accept = i;
		else if (s.kind === 'task') e.tasks.push(i);
		else e.turnin = i;
	});
	// preds[i]: all-of list; anyOf[i]: at least one of these must come first.
	const preds = steps.map(() => []);
	const anyOf = steps.map(() => null);
	steps.forEach((s, i) => {
		const e = byQuest.get(s.q);
		if (s.kind === 'task' && e.accept >= 0) preds[i].push(e.accept);
		if (s.kind === 'turnin') {
			if (e.accept >= 0) preds[i].push(e.accept);
			for (const t of e.tasks) preds[i].push(t);
			for (const c of s.quest.after || []) {
				const x = byQuest.get(c);
				if (x && x.turnin >= 0) preds[i].push(x.turnin);
			}
		}
		if (s.kind === 'accept') {
			for (const p of s.quest.pre || []) {
				const x = byQuest.get(p);
				if (x && x.turnin >= 0) preds[i].push(x.turnin);
			}
			// A child is taken while its parent is in the log: after the
			// parent's accept, before its turn-in.
			const par = s.quest.inLog != null ? byQuest.get(s.quest.inLog) : null;
			if (par && par.accept >= 0) preds[i].push(par.accept);
			if (par && par.turnin >= 0) preds[par.turnin].push(i);
		}
	});
	const placed = new Uint8Array(n);
	const ready = (i) => {
		if (placed[i]) return false;
		for (const p of preds[i]) if (!placed[p]) return false;
		if (anyOf[i] && !anyOf[i].some((p) => placed[p])) return false;
		return true;
	};
	// Start: the ready step with the most ready steps within 150 yd (a hub).
	let cur = -1;
	let bestN = -1;
	for (let i = 0; i < n; i++) {
		if (!ready(i)) continue;
		let c = 0;
		for (let j = 0; j < n; j++) if (D(i, j) <= 150) c++;
		if (c > bestN || (c === bestN && steps[i].kind === 'accept' && steps[cur].kind !== 'accept')) {
			bestN = c;
			cur = i;
		}
	}
	if (cur < 0) cur = 0;
	const order = [cur];
	placed[cur] = 1;
	while (order.length < n) {
		let best = -1;
		let bd = Infinity;
		for (let i = 0; i < n; i++) {
			if (!ready(i)) continue;
			const d = D(cur, i);
			// Same spot: turn-ins first, then accepts, then tasks.
			const tie = d - (steps[i].kind === 'turnin' ? 0.002 : steps[i].kind === 'accept' ? 0.001 : 0);
			if (tie < bd) {
				bd = tie;
				best = i;
			}
		}
		if (best < 0) {
			// Cyclic or unsatisfiable precedence (data loops): take the first left.
			for (let i = 0; i < n; i++) if (!placed[i]) {
				best = i;
				break;
			}
		}
		placed[best] = 1;
		order.push(best);
		cur = best;
	}
	// 2-opt keeping precedence.
	const pos = new Int32Array(n);
	const validRev = (i, j) => {
		for (let k = i; k <= j; k++) {
			const s = order[k];
			for (const p of preds[s]) if (pos[p] >= i && pos[p] <= j) return false;
			if (anyOf[s]) {
				// After reversal, at least one any-of predecessor must still precede.
				let ok = false;
				for (const p of anyOf[s]) {
					const pp = pos[p];
					if (pp < i) ok = true;
					else if (pp <= j && pp > k) ok = true; // reversed: p now before s
				}
				if (!ok) return false;
			}
		}
		return true;
	};
	let improved = true;
	let passes = 0;
	while (improved && passes++ < 50) {
		improved = false;
		for (let k = 0; k < n; k++) pos[order[k]] = k;
		for (let i = 1; i < n - 1; i++) {
			for (let j = i + 1; j < n; j++) {
				const a = order[i - 1];
				const b = order[i];
				const c = order[j];
				const d = j + 1 < n ? order[j + 1] : -1;
				const before = D(a, b) + (d >= 0 ? D(c, d) : 0);
				const after = D(a, c) + (d >= 0 ? D(b, d) : 0);
				if (after < before - 1e-6 && validRev(i, j)) {
					for (let l = i, r = j; l < r; l++, r--) {
						const t = order[l];
						order[l] = order[r];
						order[r] = t;
					}
					for (let k = i; k <= j; k++) pos[order[k]] = k;
					improved = true;
				}
			}
		}
	}
	return order.map((i) => steps[i]);
}

module.exports = { planOrder };
