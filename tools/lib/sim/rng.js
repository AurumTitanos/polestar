'use strict';
// Seeded pseudo-random numbers for the simulator: every random choice in a
// search or a robustness draw comes from one of these, so a seed reproduces a
// run exactly (on any number of workers).

// 32-bit hash of a list of integers (seed derivation: hashSeed(seed, round, job)).
function hashSeed(...parts) {
	let h = 0x811c9dc5;
	for (const p of parts) {
		let v = Number(p) >>> 0;
		for (let i = 0; i < 4; i++) {
			h ^= v & 0xff;
			h = Math.imul(h, 0x01000193) >>> 0;
			v >>>= 8;
		}
	}
	// Final avalanche (murmur3 fmix32).
	h ^= h >>> 16;
	h = Math.imul(h, 0x85ebca6b) >>> 0;
	h ^= h >>> 13;
	h = Math.imul(h, 0xc2b2ae35) >>> 0;
	h ^= h >>> 16;
	return h >>> 0;
}

// mulberry32: small, fast, good enough for search and sampling.
class Rng {
	constructor(seed) {
		this.s = seed >>> 0;
	}
	next() {
		let t = (this.s = (this.s + 0x6d2b79f5) >>> 0);
		t = Math.imul(t ^ (t >>> 15), t | 1);
		t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
		return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
	}
	int(n) {
		return Math.floor(this.next() * n);
	}
	// Standard normal (Box-Muller, one value per call).
	normal() {
		let u = 0;
		while (u <= 1e-12) u = this.next();
		const v = this.next();
		return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
	}
}

module.exports = { Rng, hashSeed };
