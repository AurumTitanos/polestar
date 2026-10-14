'use strict';
// A zlib stream (RFC 1950/1951) for the preview's PNG textures, written here
// so the committed SVGs are byte-identical on any Node: node:zlib's output
// changes with the zlib build (Node 24's zlib-ng and Node 22's zlib give
// different bytes for the same pixels). One dynamic Huffman block over LZ77
// matches found through hash chains, with one step of lazy matching; ties
// are broken by symbol and position, so the same input always gives the same
// bytes. About 10% larger than zlib's default level on the UI textures.
//
//   const { deflate } = require('./deflate');
//   zlib.inflateSync(deflate(buf)).equals(buf) // true

const LEN_BASE = [3, 4, 5, 6, 7, 8, 9, 10, 11, 13, 15, 17, 19, 23, 27, 31, 35, 43, 51, 59, 67, 83, 99, 115, 131, 163, 195, 227, 258];
const LEN_EXTRA = [0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 1, 1, 2, 2, 2, 2, 3, 3, 3, 3, 4, 4, 4, 4, 5, 5, 5, 5, 0];
const DIST_BASE = [1, 2, 3, 4, 5, 7, 9, 13, 17, 25, 33, 49, 65, 97, 129, 193, 257, 385, 513, 769, 1025, 1537, 2049, 3073, 4097, 6145, 8193, 12289, 16385, 24577];
const DIST_EXTRA = [0, 0, 0, 0, 1, 1, 2, 2, 3, 3, 4, 4, 5, 5, 6, 6, 7, 7, 8, 8, 9, 9, 10, 10, 11, 11, 12, 12, 13, 13];
// The order the code length code's lengths are sent in.
const CL_ORDER = [16, 17, 18, 0, 8, 7, 9, 6, 10, 5, 11, 4, 12, 3, 13, 2, 14, 1, 15];
const WINDOW = 32768;
const MAX_MATCH = 258;
// Candidates tried per position: past 32 the textures shrink by under 3%.
const CHAIN = 32;
const HASH_BITS = 15;

// Length and distance -> their code.
const LEN_CODE = new Uint8Array(MAX_MATCH + 1);
const DIST_CODE = new Uint8Array(WINDOW + 1);
for (let c = 0; c < LEN_BASE.length; c++) {
	for (let l = LEN_BASE[c]; l <= (c + 1 < LEN_BASE.length ? LEN_BASE[c + 1] - 1 : MAX_MATCH); l++) LEN_CODE[l] = c;
}
for (let c = 0; c < DIST_BASE.length; c++) {
	for (let d = DIST_BASE[c]; d <= (c + 1 < DIST_BASE.length ? DIST_BASE[c + 1] - 1 : WINDOW); d++) DIST_CODE[d] = c;
}

// Huffman code lengths of at most maxBits for the frequencies. The two
// lightest nodes merge first, ties to the earlier one (symbols, then merges
// in order); a tree too deep is rebuilt from flattened frequencies. At least
// two symbols get a code, so every code is complete.
function codeLengths(freq, maxBits) {
	const used = [];
	for (let s = 0; s < freq.length; s++) if (freq[s]) used.push(s);
	for (let s = 0; used.length < 2; s++) if (!freq[s]) used.push(s);
	used.sort((a, b) => a - b);
	for (let shift = 0; ; shift++) {
		const len = new Array(freq.length).fill(0);
		const before = (a, b) => a.w - b.w || a.order - b.order;
		const queue = used.map((s) => ({ w: Math.max(1, freq[s] >> shift), order: s, sym: s, kids: null })).sort(before);
		let order = freq.length;
		while (queue.length > 1) {
			const a = queue.shift(), b = queue.shift();
			const node = { w: a.w + b.w, order: order++, sym: -1, kids: [a, b] };
			let i = 0;
			while (i < queue.length && before(queue[i], node) <= 0) i++;
			queue.splice(i, 0, node);
		}
		let deepest = 0;
		const walk = (node, depth) => {
			if (node.kids) {
				walk(node.kids[0], depth + 1);
				walk(node.kids[1], depth + 1);
			} else {
				len[node.sym] = depth;
				if (depth > deepest) deepest = depth;
			}
		};
		walk(queue[0], 0);
		if (deepest <= maxBits) return len;
	}
}

// Canonical codes for the lengths, bit-reversed: deflate sends codes from
// the most significant bit into a least-significant-first stream.
function canonical(len) {
	const count = new Array(16).fill(0);
	for (const l of len) if (l) count[l]++;
	const next = new Array(16).fill(0);
	for (let bits = 1, code = 0; bits < 16; bits++) {
		code = (code + count[bits - 1]) << 1;
		next[bits] = code;
	}
	return len.map((l) => {
		if (!l) return 0;
		let c = next[l]++, r = 0;
		for (let i = 0; i < l; i++) {
			r = (r << 1) | (c & 1);
			c >>= 1;
		}
		return r;
	});
}

// LZ77 tokens: a literal byte (< 256), or a match as distance << 9 | length
// (distance >= 1, so a match is always >= 512).
function tokenize(data) {
	const n = data.length;
	const tokens = new Uint32Array(n);
	let count = 0;
	const mask = (1 << HASH_BITS) - 1;
	const head = new Int32Array(1 << HASH_BITS).fill(-1);
	const prev = new Int32Array(n);
	const hash = (i) => ((data[i] << 10) ^ (data[i + 1] << 5) ^ data[i + 2]) & mask;
	const insert = (i) => {
		if (i + 2 < n) {
			const h = hash(i);
			prev[i] = head[h];
			head[h] = i;
		}
	};
	// The longest match at i (the nearest of equal length): matchLen, matchDist.
	let matchLen = 0, matchDist = 0;
	const find = (i) => {
		matchLen = 0;
		matchDist = 0;
		if (i + 2 >= n) return;
		const limit = Math.min(MAX_MATCH, n - i);
		for (let j = head[hash(i)], tries = 0; j >= 0 && i - j <= WINDOW && tries < CHAIN; j = prev[j], tries++) {
			if (data[j + matchLen] !== data[i + matchLen]) continue;
			let l = 0;
			while (l < limit && data[j + l] === data[i + l]) l++;
			if (l > matchLen) {
				matchLen = l;
				matchDist = i - j;
				if (l === limit) break;
			}
		}
		if (matchLen < 3) matchLen = 0;
	};
	let i = 0;
	while (i < n) {
		find(i);
		insert(i);
		if (!matchLen) {
			tokens[count++] = data[i++];
			continue;
		}
		const len = matchLen, dist = matchDist;
		// A longer match one byte on: send this byte as a literal instead.
		find(i + 1);
		if (matchLen > len) {
			tokens[count++] = data[i++];
			continue;
		}
		tokens[count++] = (dist << 9) | len;
		for (let k = 1; k < len; k++) insert(i + k);
		i += len;
	}
	return tokens.subarray(0, count);
}

function adler32(data) {
	let a = 1, b = 0;
	for (let i = 0; i < data.length; i++) {
		a = (a + data[i]) % 65521;
		b = (b + a) % 65521;
	}
	return ((b << 16) | a) >>> 0;
}

function deflate(data) {
	const tokens = tokenize(data);
	const litFreq = new Array(286).fill(0), distFreq = new Array(30).fill(0);
	for (const t of tokens) {
		if (t < 256) {
			litFreq[t]++;
		} else {
			litFreq[257 + LEN_CODE[t & 511]]++;
			distFreq[DIST_CODE[t >>> 9]]++;
		}
	}
	litFreq[256]++;
	const litLen = codeLengths(litFreq, 15), distLen = codeLengths(distFreq, 15);
	let hlit = 286;
	while (hlit > 257 && !litLen[hlit - 1]) hlit--;
	let hdist = 30;
	while (hdist > 1 && !distLen[hdist - 1]) hdist--;

	// Both tables' lengths, run-length coded: 16 repeats the previous length
	// 3-6 times, 17 and 18 send 3-10 and 11-138 zeros.
	const seq = [...litLen.slice(0, hlit), ...distLen.slice(0, hdist)];
	const runs = [];
	for (let k = 0; k < seq.length;) {
		let r = 1;
		while (k + r < seq.length && seq[k + r] === seq[k]) r++;
		if (seq[k] === 0 && r >= 3) {
			const z = Math.min(r, 138);
			runs.push(z >= 11 ? [18, z - 11, 7] : [17, z - 3, 3]);
			k += z;
		} else if (seq[k] !== 0 && r >= 4) {
			const rep = Math.min(r - 1, 6);
			runs.push([seq[k], 0, 0], [16, rep - 3, 2]);
			k += 1 + rep;
		} else {
			runs.push([seq[k], 0, 0]);
			k++;
		}
	}
	const clFreq = new Array(19).fill(0);
	for (const [s] of runs) clFreq[s]++;
	const clLen = codeLengths(clFreq, 7);
	let hclen = 19;
	while (hclen > 4 && !clLen[CL_ORDER[hclen - 1]]) hclen--;
	const litCode = canonical(litLen), distCode = canonical(distLen), clCode = canonical(clLen);

	// At most 15 bits a literal and 48 a match of 3 or more bytes.
	const out = Buffer.alloc(2 * data.length + 512);
	let o = 0, acc = 0, nbits = 0;
	const put = (v, bits) => {
		acc |= v << nbits;
		nbits += bits;
		while (nbits >= 8) {
			out[o++] = acc & 0xff;
			acc >>>= 8;
			nbits -= 8;
		}
	};
	// zlib header: deflate, 32K window, default level; (CMF*256+FLG) % 31 == 0.
	out[o++] = 0x78;
	out[o++] = 0x9c;
	put(1, 1); // the final block
	put(2, 2); // dynamic Huffman codes
	put(hlit - 257, 5);
	put(hdist - 1, 5);
	put(hclen - 4, 4);
	for (let k = 0; k < hclen; k++) put(clLen[CL_ORDER[k]], 3);
	for (const [s, extra, bits] of runs) {
		put(clCode[s], clLen[s]);
		if (bits) put(extra, bits);
	}
	for (const t of tokens) {
		if (t < 256) {
			put(litCode[t], litLen[t]);
			continue;
		}
		const len = t & 511, lc = LEN_CODE[len];
		put(litCode[257 + lc], litLen[257 + lc]);
		if (LEN_EXTRA[lc]) put(len - LEN_BASE[lc], LEN_EXTRA[lc]);
		const dist = t >>> 9, dc = DIST_CODE[dist];
		put(distCode[dc], distLen[dc]);
		if (DIST_EXTRA[dc]) put(dist - DIST_BASE[dc], DIST_EXTRA[dc]);
	}
	put(litCode[256], litLen[256]);
	if (nbits) out[o++] = acc & 0xff;
	out.writeUInt32BE(adler32(data), o);
	return Buffer.from(out.subarray(0, o + 4));
}

module.exports = { deflate };
