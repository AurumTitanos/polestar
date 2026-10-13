'use strict';
// The compiler's test fixtures (tests/fixtures/dsl) and helpers to compile
// guides and build packs from them.

const path = require('node:path');
const { tmpdir } = require('./tmp');
const { loadData } = require('../../tools/lib/dsl/data');
const { compileSources, OFFICIAL_DIR } = require('../../tools/lib/dsl/project');
const { readManifest } = require('../../tools/lib/pack/manifest');
const { writePackInto } = require('../../tools/lib/playtest');
const { format } = require('../../tools/lib/dsl/diag');

const FIXTURES = path.join(__dirname, '..', 'fixtures', 'dsl');
const DATA_DIR = path.join(FIXTURES, 'data');
const GUIDES_DIR = path.join(FIXTURES, 'guides');

let cached;
function fixtureData() {
	if (!cached) cached = loadData(DATA_DIR);
	return cached;
}

const HEADER = ['guide t/main', 'title Test', 'faction Alliance', 'levels 1-10', 'zone Elwynn Forest'];

// Guide text from lines; without a `guide` line the default header is prepended.
function guideText(lines) {
	const body = Array.isArray(lines) ? lines : lines.split('\n');
	return `${(body[0] || '').startsWith('guide ') ? body.join('\n') : [...HEADER, '', ...body].join('\n')}\n`;
}

// Line number (1-based) of the first line equal to `needle` (trimmed) in text.
function lineOf(text, needle) {
	const i = text.split('\n').findIndex((l) => l.trim() === needle.trim());
	if (i < 0) throw new Error(`line not found: ${needle}`);
	return i + 1;
}

// compile({ 'a.guide': text, ... } | text, data?, { pack }?) -> { guides, diag, errors, warnings }
// errors/warnings are "file:line: message" strings; the guides belong to
// `pack` (ours when absent).
function compile(sources, data = fixtureData(), opts = {}) {
	const map = typeof sources === 'string' ? { 'test.guide': sources } : sources;
	const list = Object.keys(map).map((file) => ({ file, text: map[file] }));
	const { guides, diag } = compileSources(list, data, undefined, opts);
	const strip = (d) => `${d.file}:${d.line}: ${d.message}`;
	return {
		guides,
		diag,
		errors: diag.sorted().filter((d) => d.severity === 'error').map(strip),
		warnings: diag.sorted().filter((d) => d.severity === 'warning').map(strip),
		text: diag.sorted().map(format).join('\n'),
	};
}

// A JSON-plain copy (drops non-enumerable bookkeeping and undefined fields).
function plain(v) {
	return JSON.parse(JSON.stringify(v));
}

// Our pack's manifest (guides/pack.json).
function ourManifest() {
	return readManifest(OFFICIAL_DIR, { official: true }).manifest;
}

// Build compiled guides into a pack folder (named after the manifest's folder,
// in a temp dir removed at exit) -> { dir, files, scripts }: scripts are the
// files its TOC loads, absolute, in load order.
function writeTestPack(guides, data = fixtureData(), manifest = ourManifest()) {
	return writePackInto(tmpdir(), { guides, manifest, data });
}

module.exports = { FIXTURES, DATA_DIR, GUIDES_DIR, fixtureData, guideText, lineOf, compile, plain, ourManifest, writeTestPack };
