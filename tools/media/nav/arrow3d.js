'use strict';
// A tiny software renderer for the 3D waypoint arrow (zero dependencies).
//
// A beveled, extruded arrowhead with a raised centre ridge lies on a ground
// plane, seen by a perspective camera tilted PITCH degrees down. Each frame
// turns the arrow by 360 / FRAMES degrees counter-clockwise (frame 0 points
// away from the viewer, frame FRAMES/4 points left) under a fixed point light
// at the viewer's upper left, so its lit and shaded facets swap as it turns.
// Shading: Lambert diffuse with a wall ambient-occlusion ramp, a soft
// contact shadow on the ground, and a Blinn-Phong highlight. Every output
// pixel averages SS x SS samples.
//
// Two power-of-two sheets with the same grid (texcoords are identical):
//   arrow3d       body in neutral greys (SetVertexColor tints it) plus the
//                 black contact shadow; straight alpha
//   arrow3d-spec  the white specular highlight at half resolution, to draw
//                 untinted with the ADD blend mode over the body

const { Canvas } = require('../../lib/tga');

const LAYOUT = Object.freeze({ frames: 100, cols: 10, cell: 102, size: 1024, specSize: 512 });
const SS = 4;
const PITCH = (56 * Math.PI) / 180;
const CAM_DIST = 7;
const MARGIN = 3; // output pixels kept clear around each cell (no bleeding between frames)

// Arrowhead outline on the ground, counter-clockwise, centred near the pivot.
const OUTLINE = [
	[0, 1.0],
	[-0.72, -0.62],
	[0, -0.26],
	[0.72, -0.62],
];
const WALL = 0.14; // height of the vertical walls
const BEVEL = 0.1; // inset of the top surface
const SHOULDER = 0.23; // height where the bevel meets the top at the wings
const RIDGE = 0.36; // height of the centre ridge (tip and notch)

const LIGHT = [-2.6, -1.8, 4.2]; // point light: viewer's upper left, above
const AMBIENT = 0.3;
const DIFFUSE = 0.74;
const SHININESS = 42;
const SPECULAR = 0.75;
const SHADOW_SHIFT = [0.07, 0.05]; // shadow falls away from the light

const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const norm = (a) => {
	const l = Math.hypot(a[0], a[1], a[2]) || 1;
	return [a[0] / l, a[1] / l, a[2] / l];
};
const smooth = (e0, e1, x) => {
	const t = Math.min(1, Math.max(0, (x - e0) / (e1 - e0)));
	return t * t * (3 - 2 * t);
};

// Inset polygon: each vertex moves to the intersection of its two edges
// shifted `by` toward the inside (left of a counter-clockwise edge).
function insetPolygon(pts, by) {
	const n = pts.length;
	const shifted = (p, q) => {
		const dx = q[0] - p[0];
		const dy = q[1] - p[1];
		const l = Math.hypot(dx, dy);
		const nx = -dy / l;
		const ny = dx / l;
		return { px: p[0] + nx * by, py: p[1] + ny * by, dx, dy };
	};
	return pts.map((p, i) => {
		const a = shifted(pts[(i + n - 1) % n], p);
		const b = shifted(p, pts[(i + 1) % n]);
		const den = a.dx * b.dy - a.dy * b.dx;
		const t = ((b.px - a.px) * b.dy - (b.py - a.py) * b.dx) / den;
		return [a.px + a.dx * t, a.py + a.dy * t];
	});
}

// Triangles { v: [3 points], hint: outward direction, wall: bool }.
function arrowMesh() {
	const n = OUTLINE.length;
	const inner = insetPolygon(OUTLINE, BEVEL);
	const topZ = [RIDGE, SHOULDER, RIDGE, SHOULDER];
	const tris = [];
	const at = (p, z) => [p[0], p[1], z];
	for (let i = 0; i < n; i++) {
		const j = (i + 1) % n;
		const a = OUTLINE[i];
		const b = OUTLINE[j];
		const out = norm([b[1] - a[1], -(b[0] - a[0]), 0]);
		tris.push({ v: [at(a, 0), at(b, 0), at(b, WALL)], hint: out, wall: true });
		tris.push({ v: [at(a, 0), at(b, WALL), at(a, WALL)], hint: out, wall: true });
		const up = [out[0], out[1], 1];
		tris.push({ v: [at(a, WALL), at(b, WALL), at(inner[j], topZ[j])], hint: up });
		tris.push({ v: [at(a, WALL), at(inner[j], topZ[j]), at(inner[i], topZ[i])], hint: up });
	}
	tris.push({ v: [at(inner[0], RIDGE), at(inner[1], SHOULDER), at(inner[2], RIDGE)], hint: [0, 0, 1] });
	tris.push({ v: [at(inner[0], RIDGE), at(inner[2], RIDGE), at(inner[3], SHOULDER)], hint: [0, 0, 1] });
	return tris;
}

function rotate(p, c, s) {
	return [p[0] * c - p[1] * s, p[0] * s + p[1] * c, p[2]];
}

// Camera behind and above the origin, looking at it.
const CAM = [0, -CAM_DIST * Math.cos(PITCH), CAM_DIST * Math.sin(PITCH)];
const FWD = [0, Math.cos(PITCH), -Math.sin(PITCH)];
const UP = [0, Math.sin(PITCH), Math.cos(PITCH)];

// Camera-space ratios (x/z, y/z) of a world point.
function viewRatio(p) {
	const d = sub(p, CAM);
	const zc = dot(d, FWD);
	return [d[0] / zc, dot(d, UP) / zc];
}

// Focal length (in samples) that fits every frame, shadow included, in a cell.
function focal(mesh, cellSamples, marginSamples) {
	const pts = [];
	for (const t of mesh) for (const v of t.v) pts.push(v);
	for (const p of insetPolygon(OUTLINE, -0.22)) pts.push([p[0] + SHADOW_SHIFT[0], p[1] + SHADOW_SHIFT[1], 0]);
	let m = 0;
	for (let f = 0; f < LAYOUT.frames; f++) {
		const a = (f * 2 * Math.PI) / LAYOUT.frames;
		const c = Math.cos(a);
		const s = Math.sin(a);
		for (const p of pts) {
			const [x, y] = viewRatio(rotate(p, c, s));
			m = Math.max(m, Math.abs(x), Math.abs(y));
		}
	}
	return (cellSamples / 2 - marginSamples) / m;
}

// Signed distance (outside positive) from (x, y) to a 2D polygon.
function polyDistance(poly, x, y) {
	let d = Infinity;
	let inside = false;
	for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
		const [xi, yi] = poly[i];
		const [xj, yj] = poly[j];
		const ex = xj - xi;
		const ey = yj - yi;
		const wx = x - xi;
		const wy = y - yi;
		const h = Math.max(0, Math.min(1, (wx * ex + wy * ey) / (ex * ex + ey * ey)));
		d = Math.min(d, Math.hypot(wx - ex * h, wy - ey * h));
		if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
	}
	return inside ? -d : d;
}

// Render one heading. Returns per-output-pixel { body: Float32Array RGBA (straight), spec: Float32Array alpha (half res) }.
function renderFrame(mesh, angle, F) {
	const cell = LAYOUT.cell;
	const S = cell * SS;
	const half = S / 2;
	const c = Math.cos(angle);
	const s = Math.sin(angle);

	const tris = mesh.map((t) => {
		const v = t.v.map((p) => rotate(p, c, s));
		let n = norm(cross(sub(v[1], v[0]), sub(v[2], v[0])));
		const hint = rotate(t.hint, c, s);
		if (dot(n, hint) < 0) n = [-n[0], -n[1], -n[2]];
		const scr = v.map((p) => {
			const [x, y] = viewRatio(p);
			return [half + F * x, half - F * y];
		});
		return { v, n, scr, wall: t.wall };
	});
	const outline = OUTLINE.map((p) => rotate([p[0], p[1], 0], c, s));
	const shadowPoly = outline.map((p) => [p[0] + SHADOW_SHIFT[0], p[1] + SHADOW_SHIFT[1]]);

	// Visibility: nearest triangle per sample.
	const depth = new Float32Array(S * S).fill(Infinity);
	const owner = new Int16Array(S * S).fill(-1);
	const dir = [0, 0, 0];
	const rayAt = (sx, sy) => {
		const a = (sx - half) / F;
		const b = -(sy - half) / F;
		dir[0] = FWD[0] + a;
		dir[1] = FWD[1] + b * UP[1];
		dir[2] = FWD[2] + b * UP[2];
		return dir;
	};
	tris.forEach((t, ti) => {
		const [p0, p1, p2] = t.scr;
		const area = (p1[0] - p0[0]) * (p2[1] - p0[1]) - (p1[1] - p0[1]) * (p2[0] - p0[0]);
		if (Math.abs(area) < 1e-9) return;
		const sign = area > 0 ? 1 : -1;
		const x0 = Math.max(0, Math.floor(Math.min(p0[0], p1[0], p2[0])));
		const x1 = Math.min(S - 1, Math.ceil(Math.max(p0[0], p1[0], p2[0])));
		const y0 = Math.max(0, Math.floor(Math.min(p0[1], p1[1], p2[1])));
		const y1 = Math.min(S - 1, Math.ceil(Math.max(p0[1], p1[1], p2[1])));
		const nd = dot(t.n, sub(t.v[0], CAM));
		for (let y = y0; y <= y1; y++) {
			const py = y + 0.5;
			for (let x = x0; x <= x1; x++) {
				const px = x + 0.5;
				const w0 = ((p1[0] - p0[0]) * (py - p0[1]) - (p1[1] - p0[1]) * (px - p0[0])) * sign;
				const w1 = ((p2[0] - p1[0]) * (py - p1[1]) - (p2[1] - p1[1]) * (px - p1[0])) * sign;
				const w2 = ((p0[0] - p2[0]) * (py - p2[1]) - (p0[1] - p2[1]) * (px - p2[0])) * sign;
				if (w0 < 0 || w1 < 0 || w2 < 0) continue;
				const d = rayAt(px, py);
				const tt = nd / dot(t.n, d);
				const i = y * S + x;
				if (tt > 0 && tt < depth[i]) {
					depth[i] = tt;
					owner[i] = ti;
				}
			}
		}
	});

	// Shade and resolve.
	const body = new Float32Array(cell * cell * 4);
	const specCell = cell / 2;
	const spec = new Float32Array(specCell * specCell);
	for (let oy = 0; oy < cell; oy++) {
		for (let ox = 0; ox < cell; ox++) {
			let sumC = 0;
			let sumA = 0;
			for (let jy = 0; jy < SS; jy++) {
				for (let jx = 0; jx < SS; jx++) {
					const x = ox * SS + jx;
					const y = oy * SS + jy;
					const i = y * S + x;
					const d = rayAt(x + 0.5, y + 0.5);
					const ti = owner[i];
					if (ti >= 0) {
						const t = tris[ti];
						const P = [CAM[0] + d[0] * depth[i], CAM[1] + d[1] * depth[i], CAM[2] + d[2] * depth[i]];
						const Ld = norm(sub(LIGHT, P));
						const V = norm(sub(CAM, P));
						const lam = Math.max(0, dot(t.n, Ld));
						let g = AMBIENT + DIFFUSE * lam;
						if (t.wall) g *= 0.5 + 0.5 * Math.min(1, P[2] / WALL);
						const H = norm([Ld[0] + V[0], Ld[1] + V[1], Ld[2] + V[2]]);
						const sp = lam > 0 ? SPECULAR * Math.pow(Math.max(0, dot(t.n, H)), SHININESS) : 0;
						sumC += Math.min(1, g);
						sumA += 1;
						spec[Math.floor(oy / 2) * specCell + Math.floor(ox / 2)] += sp;
					} else if (d[2] < 0) {
						const tg = -CAM[2] / d[2];
						const gx = CAM[0] + d[0] * tg;
						const gy = CAM[1] + d[1] * tg;
						const soft = 0.5 * (1 - smooth(-0.1, 0.2, polyDistance(shadowPoly, gx, gy)));
						const contact = 0.45 * (1 - smooth(0, 0.05, polyDistance(outline, gx, gy)));
						sumA += 1 - (1 - soft) * (1 - contact);
					}
				}
			}
			const k = (oy * cell + ox) * 4;
			const a = sumA / (SS * SS);
			const g = sumA > 0 ? sumC / sumA : 0;
			body[k] = g;
			body[k + 1] = g;
			body[k + 2] = g;
			body[k + 3] = a;
		}
	}
	for (let i = 0; i < spec.length; i++) spec[i] = Math.min(1, spec[i] / (SS * SS * 4));
	return { body, spec };
}

// Clear the margin so bilinear filtering never pulls in a neighbouring frame.
function clearMargin(frameData, cell, margin, channels) {
	for (let y = 0; y < cell; y++) {
		for (let x = 0; x < cell; x++) {
			if (x >= margin && y >= margin && x < cell - margin && y < cell - margin) continue;
			for (let ch = 0; ch < channels; ch++) frameData[(y * cell + x) * channels + ch] = 0;
		}
	}
}

// -> { body: Canvas, spec: Canvas }
function renderSheets() {
	const { frames, cols, cell, size, specSize } = LAYOUT;
	const mesh = arrowMesh();
	const F = focal(mesh, cell * SS, MARGIN * SS);
	const body = new Canvas(size, size);
	const spec = new Canvas(specSize, specSize);
	const sc = cell / 2;
	for (let f = 0; f < frames; f++) {
		const frame = renderFrame(mesh, (f * 2 * Math.PI) / frames, F);
		clearMargin(frame.body, cell, MARGIN, 4);
		clearMargin(frame.spec, sc, Math.ceil(MARGIN / 2), 1);
		const col = f % cols;
		const row = Math.floor(f / cols);
		for (let y = 0; y < cell; y++) {
			for (let x = 0; x < cell; x++) {
				const src = (y * cell + x) * 4;
				const dst = ((row * cell + y) * size + col * cell + x) * 4;
				for (let ch = 0; ch < 4; ch++) body.px[dst + ch] = frame.body[src + ch];
			}
		}
		for (let y = 0; y < sc; y++) {
			for (let x = 0; x < sc; x++) {
				const dst = ((row * sc + y) * specSize + col * sc + x) * 4;
				spec.px[dst] = 1;
				spec.px[dst + 1] = 1;
				spec.px[dst + 2] = 1;
				spec.px[dst + 3] = frame.spec[y * sc + x];
			}
		}
	}
	return { body, spec };
}

let cached = null;
function sheets() {
	if (!cached) cached = renderSheets();
	return cached;
}

module.exports = { LAYOUT, sheets, arrowMesh, insetPolygon, renderFrame };
