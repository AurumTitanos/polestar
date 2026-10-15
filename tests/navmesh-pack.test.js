'use strict';
// The grid in Shortest Path Forever's walking-map format
// (tools/lib/nav/pack.js) on synthetic tiles built by the real grid build,
// read back with his decoder's logic in Node (helpers/spfnav.js). Ids in
// test names are rows of docs/superpowers/specs/2026-10-15-spf-issues.md.

const test = require('node:test');
const assert = require('node:assert/strict');
const zlib = require('node:zlib');
const { Scene, ADT } = require('./helpers/navscene');
const { tmpdir } = require('./helpers/tmp');
const { buildGrid } = require('../tools/lib/nav/grid/build');
const { packNav, cellGridFromDir, buildHpa, encodeMaps, BLOCK_BYTES, PART_BYTES, ZQ } = require('../tools/lib/nav/pack');
const S = require('./helpers/spfnav');

const CELL = ADT / 256;

async function gridOf(...scenes) {
	const dir = tmpdir('polestar-pack-');
	const byKey = new Map(scenes.map((s) => [`${s.col}_${s.row}`, s]));
	await buildGrid({
		outDir: dir, workers: 0,
		continents: [{ c: 0, name: 'test', tiles: scenes.map((s) => ({ col: s.col, row: s.row })) }],
		geometryJob: (c, t) => ({ geom: byKey.get(`${t.col}_${t.row}`).geom() }),
	});
	return dir;
}

async function packOf(scenes, cells = 128) {
	const dir = await gridOf(...scenes);
	const files = await packNav({ dir, cells, global: 'TestPathData' });
	return { dir, files, D: S.loadPack(files, 0) };
}

// The decoded cluster and node of a scene point (the base surface, or the surface nearest z).
function at(D, s, x, y, z) {
	const w = s.world(x, y);
	const p = S.locate(D, w.wx, w.wy);
	const cl = S.decodeCluster(D, p.k);
	const node = z === undefined ? (cl.val[p.lc] ? p.lc : null) : S.surface(cl.C, cl.val, cl.z, cl.at, p.lc, -1, z);
	return { ...p, cl, node };
}

test('pack: a wall on a cell edge closes the step, a door through it opens (spf-issues themes: wall cuts)', async () => {
	// A thin wall (0.3 yd) along x = 100 columns, on a 128-cell edge, across
	// the whole tile but for a 6 yd door at y 300..306.
	const s = new Scene();
	const x = 100 * CELL;
	s.box(x - 0.15, -1, -1, x + 0.15, 300, 10).box(x - 0.15, 306, -1, x + 0.15, ADT + 1, 10);
	const { D } = await packOf([s]);
	const west = at(D, s, x - 1, 150);
	const east = at(D, s, x + 1, 150);
	assert.equal(west.k, east.k);
	assert.ok(west.cl.val[west.lc] && west.cl.val[east.lc], 'both sides walkable');
	assert.equal(Math.abs(west.lc - east.lc), 1, 'neighbouring cells');
	const lower = Math.min(west.lc, east.lc);
	assert.ok(Math.floor(west.cl.m[lower] / 16) & 2, 'the +y step across the wall is closed');
	const reach = S.reach(west.cl, west.node);
	assert.ok(reach.has(east.node), 'round through the door');
	const door = at(D, s, x - 1, 303);
	const doorLower = Math.min(door.lc, door.lc - 1);
	assert.equal(Math.floor(door.cl.m[doorLower] / 16) & 2, 0, 'the door is open');
	// Without the door the two sides never meet.
	const s2 = new Scene();
	s2.box(x - 0.15, -1, -1, x + 0.15, ADT + 1, 10);
	const p2 = await packOf([s2]);
	const w2 = at(p2.D, s2, x - 1, 150);
	const e2 = at(p2.D, s2, x + 1, 150);
	assert.equal(S.reach(w2.cl, w2.node).has(e2.node), false, 'no way through a closed wall');
});

test('pack: a ridge too steep to walk is not crossed, a gentle one is (the Barrens ridge north of Camp Taurajo)', async () => {
	// Terrain ridges along x = 260: 70° flanks (our grid climbs them upward
	// only, a fall the other way) and 27° flanks.
	const steep = new Scene({ height: (x) => Math.max(0, 40 - 2.75 * Math.abs(x - 260)) });
	const gentle = new Scene({ height: (x) => Math.max(0, 20 - 0.5 * Math.abs(x - 260)) });
	for (const [s, crossed] of [[steep, false], [gentle, true]]) {
		const { D } = await packOf([s]);
		const a = at(D, s, 150, 250);
		const b = at(D, s, 370, 250);
		assert.ok(a.node !== null && b.node !== null);
		assert.equal(S.reach(a.cl, a.node).has(b.node), crossed, crossed ? 'over the gentle ridge' : 'never over the steep ridge');
	}
});

test('pack: floors stack over the ground and a ramp joins them; the street over a canal snaps to the street (C6)', async () => {
	// A 60 x 60 yd platform 10 yd up over flat ground, a ramp (about 27°) from the ground onto its west edge.
	const s = new Scene();
	s.box(200, 200, 9.5, 260, 260, 10, 1);
	s.quad([180, 220, 0], [200, 220, 10], [200, 240, 10], [180, 240, 0], 1);
	const { D } = await packOf([s]);
	const p = at(D, s, 230, 230);
	const { cl } = p;
	const first = cl.at.get(-(p.lc + 1));
	assert.ok(first !== undefined && first >= cl.N, 'a floor over the cell');
	assert.equal(cl.at.get(first), p.lc);
	assert.notEqual(cl.at.get(first + 1), p.lc, 'one floor');
	// The base is the larger region's surface, then the higher (gen_nav.py); both are one region here.
	const [low, high] = cl.z[p.lc] < cl.z[first] ? [p.lc, first] : [first, p.lc];
	assert.ok(Math.abs(cl.z[low]) <= ZQ, `the ground (${cl.z[low]})`);
	assert.ok(Math.abs(cl.z[high] - 10) <= ZQ, `the platform (${cl.z[high]})`);
	assert.equal(S.surface(cl.C, cl.val, cl.z, cl.at, p.lc, -1, 10.2), high, 'a point on the platform stands on it');
	assert.equal(S.surface(cl.C, cl.val, cl.z, cl.at, p.lc, -1, 0.3), low, 'a point under it stands on the ground');
	const ground = at(D, s, 100, 230);
	assert.ok(S.reach(cl, ground.node).has(high), 'up the ramp onto the platform');
	assert.ok(S.reach(cl, high).has(low), 'and down to the ground under it');
});

test('pack: round trip through the decoder: cells, flags, heights, floors and graph agree with the cell grid', async () => {
	// Two tiles side by side (col 32 west of col 33), a wall on their border with a 30 yd gap, a platform with a ramp.
	const a = new Scene({ col: 32 });
	const b = new Scene({ col: 33, height: (x, y) => Math.sin(y / 30) * 3 });
	a.box(ADT - 0.3, -1, -1, ADT - 0.02, 200, 10).box(ADT - 0.3, 230, -1, ADT - 0.02, ADT + 1, 10);
	a.box(100, 100, 9.5, 160, 160, 10, 1).quad([80, 120, 0], [100, 120, 10], [100, 140, 10], [80, 140, 0], 1);
	const dir = await gridOf(a, b);
	for (const cells of [67, 128]) {
		const { cg } = await cellGridFromDir({ dir, c: 0, C: cells });
		const hpa = buildHpa(cg);
		const maps = encodeMaps(cg, hpa);
		const files = await packNav({ dir, cells, global: 'TestPathData' });
		const D = S.loadPack(files, 0);
		assert.equal(D.cells, cells);
		const NB = cg.GW * cg.GH;
		let floors = 0;
		for (const [k, cl] of cg.clusters) {
			assert.equal(D.grid[k + 1], maps.grid.get(k));
			const dc = S.decodeCluster(D, k);
			for (let l = 0; l < cells * cells; l++) {
				assert.equal(dc.val[l], cl.val[l], `value of ${k}:${l}`);
				assert.equal(Math.floor(dc.m[l] / 16), cl.flags[l], `flags of ${k}:${l}`);
				if (cl.val[l]) assert.equal(dc.z[l], cl.zq[l] * ZQ, `height of ${k}:${l}`);
			}
			for (let f = cl.floorStart; f < cl.floorEnd; f++) {
				const node = cells * cells + f - cl.floorStart;
				assert.equal(dc.at.get(node), (Math.floor(cg.floorCell[f] / cg.GH) % cells) * cells + (cg.floorCell[f] % cg.GH) % cells);
				assert.equal(dc.z[node], Math.round(cg.floorZ[f]));
				floors++;
				// Every link of the floor inside the cluster decodes to the same surface.
				for (const v of cg.links.get(NB + f) || []) {
					if (cg.clusterOfCell(cg.cellOf(v)) !== k) continue;
					const want = v >= NB ? cells * cells + v - NB - cl.floorStart : (Math.floor(v / cg.GH) % cells) * cells + (v % cg.GH) % cells;
					assert.ok(S.movesOf(dc, node).some(([t]) => t === want), `floor ${node} of ${k} steps to ${want}`);
					assert.ok(S.movesOf(dc, want).some(([t]) => t === node), `and back from ${want}`);
				}
			}
			const graph = S.decodeGraph(D, k);
			for (const e of graph) {
				assert.ok(e.cell < cells * cells, `an entrance names its local cell (${e.cell})`);
				assert.ok(S.surface(dc.C, dc.val, dc.z, dc.at, e.cell, e.layer, 0) !== null, 'an entrance stands on a surface');
				for (const edge of e.edges) assert.ok(edge.costs[0] >= edge.costs[1] && edge.costs[1] > 0, 'swimming costs at least walking on water');
			}
		}
		assert.ok(floors > 0, 'the platform is a floor');
		// The border wall: every crossing between the clusters lies in the gap.
		const crossing = [];
		for (const k of cg.clusters.keys()) {
			for (const e of S.decodeGraph(D, k)) {
				if (e.edges.some((x) => x.offset !== 4)) crossing.push((cg.CX0 * ADT + (Math.floor(k / cg.NY) * cells + Math.floor((e.cell % (cells * cells)) / cells) + 0.5) * (ADT / cells)));
			}
		}
		assert.ok(crossing.length >= 2, `entrances across the border (${cells} cells)`);
		for (const wx of crossing) {
			const y = a.north - wx;
			assert.ok(y > 200 - ADT / cells && y < 230 + ADT / cells, `a crossing at y ${y.toFixed(1)} lies in the gap`);
		}
	}
});

test('pack: deterministic', async () => {
	const s = new Scene({ height: (x, y) => Math.sin(x / 40) * 5 + Math.cos(y / 50) * 4 });
	s.box(100, 100, -1, 103, 300, 10).box(300, 50, 6, 360, 120, 6.5, 2);
	const dir = await gridOf(s);
	const one = await packNav({ dir, cells: 67 });
	const two = await packNav({ dir, cells: 67 });
	assert.deepEqual([...one.entries()], [...two.entries()]);
});

test('pack: blocks fit the client\'s 16 KB inflate buffer, parts stay under 512 KB, a decoded cluster fits Path.cacheKB / 8 (C17)', async () => {
	// Rolling hills, a walled pen and three two-storey houses with outside stairs (floors over the ground).
	const s = new Scene({ height: (x, y) => Math.sin(x / 40) * 6 + Math.cos(y / 30) * 5 });
	s.box(100, 100, -10, 102, 300, 8).box(300, 100, -10, 302, 300, 8).box(100, 100, -10, 300, 102, 8);
	for (let i = 0; i < 3; i++) s.box(350 + i * 50, 350, 9.5, 380 + i * 50, 380, 10, 1).quad([340 + i * 50, 360, 0], [350 + i * 50, 360, 10], [350 + i * 50, 370, 10], [340 + i * 50, 370, 0], 1);
	const { files, D } = await packOf([s], 128);
	for (const [name, src] of files) {
		assert.ok(Buffer.byteLength(src) <= PART_BYTES, `${name} within a part`);
		for (const m of src.matchAll(/"([A-Za-z0-9+/=]{8,})"/g)) assert.ok(zlib.inflateSync(Buffer.from(m[1], 'base64')).length <= BLOCK_BYTES);
	}
	assert.match(files.get('Nav.xml'), /<Script file="Nav0.lua"\/>\n\t<Script file="Nav0_1.lua"\/>/);
	assert.match(files.get('Nav0.lua'), /^TestPathData = TestPathData or \{\}$/m);
	// PathGrid.lua gridSize: array capacity * 48 bytes + 320, 64 per `at` entry, 128 + 32 per link of a linked node.
	const cl = S.decodeCluster(D, 0);
	let cap = 1;
	while (cap < cl.nodes) cap *= 2;
	let bytes = cap * 48 + 320 + cl.at.size * 64;
	for (const l of cl.links.values()) bytes += 128 + l.length * 32;
	assert.ok(bytes / 1024 <= 24576 / 8, `${(bytes / 1024).toFixed(0)} KB per cluster`);
});

test('pack: a floor across a tile border is an entrance on its own cell and layer, and a route climbs onto it (SpfUpstream: Path.lua:185 trace(R, nil))', async () => {
	// A platform 10 yd up across the border of tiles 32 and 33 (west to east), over flat ground, a ramp onto it in tile 32.
	const a = new Scene({ col: 32 });
	const b = new Scene({ col: 33 });
	a.box(480, 200, 9.5, ADT, 260, 10, 1).quad([460, 220, 0], [480, 220, 10], [480, 240, 10], [460, 240, 0], 1);
	b.box(0, 200, 9.5, 40, 260, 10, 1);
	const dir = await gridOf(a, b);
	for (const cells of [67, 128]) {
		const D = S.loadPack(await packNav({ dir, cells }), 0);
		const C2 = cells * cells;
		let floorEntrances = 0;
		let onPlatform = 0;
		for (let k = 0; k < D.nx * D.ny; k++) {
			if (!D.graph[k + 1]) continue;
			const dc = S.decodeCluster(D, k);
			for (const e of S.decodeGraph(D, k)) {
				assert.ok(e.cell < C2, `entrance cell ${e.cell} is a local cell (${cells} cells)`);
				const node = S.surface(dc.C, dc.val, dc.z, dc.at, e.cell, e.layer, 0);
				assert.ok(node !== null, `entrance ${e.cell}:${e.layer} decodes to a node`);
				if (e.layer > 0) {
					floorEntrances++;
					assert.ok(node >= C2 && dc.at.get(node) === e.cell, 'a floor entrance is a floor of its cell');
				}
				if (Math.abs(dc.z[node] - 10) <= 1) {
					onPlatform++;
				}
			}
		}
		assert.ok(floorEntrances > 0, `stacked surfaces cross the border through floor entrances (${cells} cells)`);
		assert.ok(onPlatform > 0, `the platform crosses the border (${cells} cells)`);
		// From the ground west of the ramp up onto the platform's floor at the border, inside tile 32's cluster.
		const ground = a.world(400, 230);
		const edge = a.world(ADT - 2, 230);
		const g = S.locate(D, ground.wx, ground.wy);
		const p = S.locate(D, edge.wx, edge.wy);
		const dc = S.decodeCluster(D, g.k);
		const top = S.surface(dc.C, dc.val, dc.z, dc.at, p.lc, -1, 10);
		assert.ok(Math.abs(dc.z[top] - 10) <= 1);
		assert.ok(S.reach(dc, g.lc).has(top), `up the ramp onto the platform at the border (${cells} cells)`);
	}
});
