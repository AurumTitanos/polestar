'use strict';
// Minimal ZIP (PKWARE APPNOTE 6.3) writer and reader: deflate via node:zlib,
// CRC-32, UTF-8 names. No ZIP64, no encryption. Output is deterministic: a
// fixed timestamp and the entry order given.
//
//   const { writeZip, readZip, directoryEntries } = require('./zip');
//   writeZip('out.zip', [{ name: 'Dir/' }, { name: 'Dir/a.txt', data: Buffer }]);
//   for (const e of readZip('out.zip')) console.log(e.name, e.dir, e.data.length);

const fs = require('node:fs');
const path = require('node:path');
const zlib = require('node:zlib');

const CRC_TABLE = (() => {
	const t = new Uint32Array(256);
	for (let n = 0; n < 256; n++) {
		let c = n;
		for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
		t[n] = c >>> 0;
	}
	return t;
})();

function crc32(buf) {
	let c = 0xffffffff;
	for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
	return (c ^ 0xffffffff) >>> 0;
}

// 2026-01-01 00:00:00 in MS-DOS format; constant so archives are reproducible.
const DOS_TIME = 0;
const DOS_DATE = ((2026 - 1980) << 9) | (1 << 5) | 1;
const FLAG_UTF8 = 0x0800;
const MADE_BY = (3 << 8) | 20; // Unix, spec 2.0
const LIMIT = 0xffffffff;

// entries: [{ name, data?: Buffer|string, mode? }]; names ending in "/" are
// directories. Returns the archive as a Buffer.
function buildZip(entries) {
	const locals = [];
	const centrals = [];
	let offset = 0;
	for (const e of entries) {
		const dir = e.name.endsWith('/');
		const name = Buffer.from(e.name, 'utf8');
		const raw = dir ? Buffer.alloc(0) : Buffer.isBuffer(e.data) ? e.data : Buffer.from(e.data || '', 'utf8');
		const crc = crc32(raw);
		let method = 0;
		let body = raw;
		if (raw.length) {
			const deflated = zlib.deflateRawSync(raw, { level: 9 });
			if (deflated.length < raw.length) {
				method = 8;
				body = deflated;
			}
		}
		if (raw.length >= LIMIT || offset >= LIMIT) throw new Error('zip: archives over 4 GiB are not supported');
		const local = Buffer.alloc(30);
		local.writeUInt32LE(0x04034b50, 0);
		local.writeUInt16LE(20, 4);
		local.writeUInt16LE(FLAG_UTF8, 6);
		local.writeUInt16LE(method, 8);
		local.writeUInt16LE(DOS_TIME, 10);
		local.writeUInt16LE(DOS_DATE, 12);
		local.writeUInt32LE(crc, 14);
		local.writeUInt32LE(body.length, 18);
		local.writeUInt32LE(raw.length, 22);
		local.writeUInt16LE(name.length, 26);
		local.writeUInt16LE(0, 28);
		locals.push(local, name, body);

		const mode = e.mode || (dir ? 0o40755 : 0o100644);
		const central = Buffer.alloc(46);
		central.writeUInt32LE(0x02014b50, 0);
		central.writeUInt16LE(MADE_BY, 4);
		central.writeUInt16LE(20, 6);
		central.writeUInt16LE(FLAG_UTF8, 8);
		central.writeUInt16LE(method, 10);
		central.writeUInt16LE(DOS_TIME, 12);
		central.writeUInt16LE(DOS_DATE, 14);
		central.writeUInt32LE(crc, 16);
		central.writeUInt32LE(body.length, 20);
		central.writeUInt32LE(raw.length, 24);
		central.writeUInt16LE(name.length, 28);
		central.writeUInt16LE(0, 30);
		central.writeUInt16LE(0, 32);
		central.writeUInt16LE(0, 34);
		central.writeUInt16LE(0, 36);
		central.writeUInt32LE((((mode & 0xffff) << 16) | (dir ? 0x10 : 0)) >>> 0, 38);
		central.writeUInt32LE(offset, 42);
		centrals.push(central, name);
		offset += local.length + name.length + body.length;
	}
	const cd = Buffer.concat(centrals);
	if (entries.length > 0xffff) throw new Error('zip: too many entries');
	const end = Buffer.alloc(22);
	end.writeUInt32LE(0x06054b50, 0);
	end.writeUInt16LE(0, 4);
	end.writeUInt16LE(0, 6);
	end.writeUInt16LE(entries.length, 8);
	end.writeUInt16LE(entries.length, 10);
	end.writeUInt32LE(cd.length, 12);
	end.writeUInt32LE(offset, 16);
	end.writeUInt16LE(0, 20);
	return Buffer.concat([...locals, cd, end]);
}

function writeZip(file, entries) {
	fs.mkdirSync(path.dirname(file), { recursive: true });
	const tmp = `${file}.tmp-${process.pid}`;
	fs.writeFileSync(tmp, buildZip(entries));
	fs.renameSync(tmp, file);
}

// Entries for whole directory trees, each stored under its own basename:
// directoryEntries(['/x/Polestar']) -> Polestar/, Polestar/Polestar.toc, ...
// Hidden files and folders (leading ".") are skipped; order is sorted.
function directoryEntries(dirs) {
	const entries = [];
	const walk = (abs, rel) => {
		entries.push({ name: `${rel}/` });
		const names = fs
			.readdirSync(abs, { withFileTypes: true })
			.filter((d) => !d.name.startsWith('.'))
			.sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0));
		for (const d of names) {
			const p = path.join(abs, d.name);
			const st = fs.statSync(p);
			if (st.isDirectory()) walk(p, `${rel}/${d.name}`);
			else if (st.isFile()) entries.push({ name: `${rel}/${d.name}`, data: fs.readFileSync(p) });
		}
	};
	for (const d of dirs) walk(d, path.basename(d));
	return entries;
}

// Sizes are capped so a corrupt archive cannot exhaust memory: an entry
// inflates to at most its declared size, and all entries together to at most
// `maxTotal` bytes (default 256 MiB).
function readZip(fileOrBuffer, { maxTotal = 256 * 1024 * 1024 } = {}) {
	const buf = Buffer.isBuffer(fileOrBuffer) ? fileOrBuffer : fs.readFileSync(fileOrBuffer);
	let eocd = -1;
	for (let i = buf.length - 22; i >= Math.max(0, buf.length - 22 - 0xffff); i--) {
		if (buf.readUInt32LE(i) === 0x06054b50) {
			eocd = i;
			break;
		}
	}
	if (eocd < 0) throw new Error('zip: end of central directory not found (not a zip file?)');
	const count = buf.readUInt16LE(eocd + 10);
	let p = buf.readUInt32LE(eocd + 16);
	const out = [];
	let total = 0;
	for (let n = 0; n < count; n++) {
		if (buf.readUInt32LE(p) !== 0x02014b50) throw new Error('zip: bad central directory entry');
		const flags = buf.readUInt16LE(p + 8);
		const method = buf.readUInt16LE(p + 10);
		const crc = buf.readUInt32LE(p + 16);
		const csize = buf.readUInt32LE(p + 20);
		const usize = buf.readUInt32LE(p + 24);
		const nlen = buf.readUInt16LE(p + 28);
		const xlen = buf.readUInt16LE(p + 30);
		const clen = buf.readUInt16LE(p + 32);
		const lho = buf.readUInt32LE(p + 42);
		if (csize === LIMIT || usize === LIMIT || lho === LIMIT) throw new Error('zip: ZIP64 archives are not supported');
		if (flags & 1) throw new Error('zip: encrypted entries are not supported');
		const name = buf.subarray(p + 46, p + 46 + nlen).toString(flags & FLAG_UTF8 ? 'utf8' : 'latin1');
		p += 46 + nlen + xlen + clen;
		if (buf.readUInt32LE(lho) !== 0x04034b50) throw new Error(`zip: bad local header for ${name}`);
		const start = lho + 30 + buf.readUInt16LE(lho + 26) + buf.readUInt16LE(lho + 28);
		const body = buf.subarray(start, start + csize);
		let data;
		if (usize > maxTotal - total) throw new Error(`zip: ${name} would exceed the ${maxTotal}-byte limit`);
		if (method === 0) data = Buffer.from(body);
		else if (method === 8) {
			try {
				// One byte of slack so an entry larger than declared is caught below.
				data = zlib.inflateRawSync(body, { maxOutputLength: usize + 1 });
			} catch (e) {
				throw new Error(`zip: corrupt entry ${name} (${e.code || e.message})`);
			}
		} else throw new Error(`zip: unsupported compression method ${method} for ${name}`);
		if (data.length !== usize || crc32(data) !== crc) throw new Error(`zip: corrupt entry ${name}`);
		total += data.length;
		out.push({ name, data, dir: name.endsWith('/') });
	}
	return out;
}

module.exports = { crc32, buildZip, writeZip, readZip, directoryEntries };
