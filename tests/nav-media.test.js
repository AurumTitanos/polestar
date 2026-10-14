'use strict';
// Navigation textures (tools/media/nav.js): valid power-of-two TGAs that the
// addon's Nav code actually references.

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const media = require('../tools/media/nav');
const { ROOT, runAddon } = require('./helpers/lua');
const { tmpdir } = require('./helpers/tmp');

const isPow2 = (n) => n > 0 && (n & (n - 1)) === 0;

function readTGA(file) {
	const b = fs.readFileSync(file);
	const width = b.readUInt16LE(12);
	const height = b.readUInt16LE(14);
	const at = (x, y) => 18 + (y * width + x) * 4;
	return {
		idLength: b[0], colorMapType: b[1], imageType: b[2], bpp: b[16], descriptor: b[17],
		width, height, size: b.length,
		alpha: (x, y) => b[at(x, y) + 3],
		rgb: (x, y) => [b[at(x, y) + 2], b[at(x, y) + 1], b[at(x, y)]],
	};
}

function tmpRoot() {
	return tmpdir('polestar-nav-media-');
}

test('generate() writes uncompressed 32-bit power-of-two TGAs into Media/Nav', () => {
	const root = tmpRoot();
	try {
		const files = media.generate(root);
		assert.equal(media.name, 'nav');
		assert.deepEqual(files.map((f) => path.basename(f, '.tga')).sort(), [...media.textures].sort());
		for (const file of files) {
			assert.equal(path.dirname(file), path.join(root, 'Media', 'Nav'));
			const t = readTGA(file);
			const name = path.basename(file);
			assert.equal(t.idLength, 0, name);
			assert.equal(t.colorMapType, 0, name);
			assert.equal(t.imageType, 2, `${name}: uncompressed true-colour`);
			assert.equal(t.bpp, 32, name);
			assert.equal(t.descriptor, 0x28, `${name}: 8 alpha bits, top-left origin`);
			assert.ok(isPow2(t.width) && isPow2(t.height), `${name}: ${t.width}x${t.height}`);
			assert.equal(t.size, 18 + t.width * t.height * 4, `${name}: pixel data length`);
		}
	} finally {
		fs.rmSync(root, { recursive: true, force: true });
	}
});

test('the 3D sheets: one lit frame per heading, neutral grey, clean margins, matching spec sheet', () => {
	const root = tmpRoot();
	try {
		media.generate(root);
		const L = media.arrow3dLayout;
		const body = readTGA(path.join(root, 'Media', 'Nav', 'arrow3d.tga'));
		const spec = readTGA(path.join(root, 'Media', 'Nav', 'arrow3d-spec.tga'));
		assert.deepEqual([body.width, body.height, spec.width, spec.height], [L.size, L.size, L.specSize, L.specSize]);
		assert.ok(L.cols * L.cell <= L.size && Math.ceil(L.frames / L.cols) * L.cell <= L.size, 'grid fits the sheet');
		assert.ok(L.frames >= 72 && L.frames <= 108);
		assert.equal((L.cell / L.size) * L.specSize, L.cell / 2, 'spec cells share the body texcoords');

		// Solid body pixels (opaque, not the black shadow) of a frame, as cell-relative x/y.
		const solid = (f) => {
			const ox = (f % L.cols) * L.cell;
			const oy = Math.floor(f / L.cols) * L.cell;
			const pts = [];
			const greys = new Set();
			let edge = 0;
			for (let y = 0; y < L.cell; y++) {
				for (let x = 0; x < L.cell; x++) {
					const a = body.alpha(ox + x, oy + y);
					if ((x < 2 || y < 2 || x >= L.cell - 2 || y >= L.cell - 2) && a > 0) edge++;
					if (a < 250) continue;
					const [r, g, b] = body.rgb(ox + x, oy + y);
					assert.ok(r === g && g === b, `frame ${f}: neutral grey (${r},${g},${b})`);
					if (r < 20) continue;
					greys.add(r);
					pts.push([x - L.cell / 2, y - L.cell / 2]);
				}
			}
			return { pts, greys, edge };
		};
		const extent = (pts) => ({
			left: -Math.min(...pts.map((p) => p[0])),
			right: Math.max(...pts.map((p) => p[0])),
		});
		for (let f = 0; f < L.frames; f += 5) {
			const s = solid(f);
			assert.ok(s.pts.length > 300, `frame ${f} has a body (${s.pts.length} px)`);
			assert.ok(s.greys.size > 20, `frame ${f} is shaded, not flat (${s.greys.size} grey levels)`);
			assert.equal(s.edge, 0, `frame ${f}: margin stays clear`);
		}
		// Frame 25 points left (tip far left, wings to the right), frame 75 right, 0 and 50 symmetric.
		const left = extent(solid(L.frames / 4).pts);
		const right = extent(solid((3 * L.frames) / 4).pts);
		assert.ok(left.left > left.right * 1.3, `frame 25 points left: ${JSON.stringify(left)}`);
		assert.ok(right.right > right.left * 1.3, `frame 75 points right: ${JSON.stringify(right)}`);
		for (const f of [0, L.frames / 2]) {
			const e = extent(solid(f).pts);
			assert.ok(Math.abs(e.left - e.right) <= 2, `frame ${f} is symmetric: ${JSON.stringify(e)}`);
		}
		// The highlight sits on the body and is white.
		let lit = 0;
		for (let y = 0; y < L.cell / 2; y++) {
			for (let x = 0; x < L.cell / 2; x++) {
				if (spec.alpha(x, y) > 40) {
					lit++;
					assert.deepEqual(spec.rgb(x, y), [255, 255, 255]);
				}
			}
		}
		assert.ok(lit > 0, 'frame 0 has a specular highlight');
	} finally {
		fs.rmSync(root, { recursive: true, force: true });
	}
});

test('the arrow points up, centred, and stays inside the rotation circle', () => {
	const root = tmpRoot();
	try {
		media.generate(root);
		const t = readTGA(path.join(root, 'Media', 'Nav', 'arrow.tga'));
		const c = t.width / 2;
		assert.equal(t.alpha(c, Math.round(t.height * 0.2)), 255, 'opaque near the tip, on the centre line');
		assert.equal(t.alpha(c, Math.round(t.height * 0.78)), 0, 'tail notch is open');
		// Nothing outside the inscribed circle, so SetRotation never clips.
		for (let y = 0; y < t.height; y++) {
			for (let x = 0; x < t.width; x++) {
				if (Math.hypot(x + 0.5 - c, y + 0.5 - c) > c) assert.equal(t.alpha(x, y), 0, `pixel ${x},${y}`);
			}
		}
	} finally {
		fs.rmSync(root, { recursive: true, force: true });
	}
});

test('every texture the Nav UI puts on screen is shipped in the addon', () => {
	const [used] = runAddon({
		stubs: ['stub_nav.lua'],
		addons: [{ name: 'Polestar', files: ['Core/Init.lua', 'Nav/Nav.xml'] }],
		login: true,
		script: `
			local m, x, y = stub.nav.mapPoint(100, 0)
			Polestar.Nav.SetTarget(m, x, y, "T")
			stub.nav.showWorldMap(9000)
			stub.advance(0.2)
			local seen, out = {}, {}
			local function scan(f)
				for _, r in ipairs(f.regions or {}) do
					local t = r.texture
					if type(t) == "string" and t:find("Polestar\\\\Media\\\\Nav\\\\") and not seen[t] then
						seen[t] = true
						out[#out + 1] = t
					end
				end
			end
			for _, f in ipairs(stub.frames) do scan(f) end
			table.sort(out)
			emit(out)`,
	}).emitted;
	assert.ok(used.length >= 6, `textures in use: ${used.join(', ')}`);
	for (const tex of used) {
		const rel = tex.replace(/^Interface\\AddOns\\/, '').replace(/\\/g, '/');
		assert.ok(fs.existsSync(path.join(ROOT, 'addon', `${rel}.tga`)), `${rel}.tga is shipped`);
	}
});
