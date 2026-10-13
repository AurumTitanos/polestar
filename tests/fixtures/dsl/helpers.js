'use strict';
// Shared helpers for the toolchain tests (tests/dsl*, compile*, pack*, install*).

const fs = require('node:fs');
const path = require('node:path');
const { tmpdir } = require('../../helpers/tmp');
const { loadData } = require('../../../tools/lib/dsl/data');
const { compileSources } = require('../../../tools/lib/dsl/project');
const { format } = require('../../../tools/lib/dsl/diag');

const FIXTURES = __dirname;
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

// compile({ 'a.guide': text, ... } | text) -> { guides, diag, errors, warnings }
// errors/warnings are "file:line: message" strings.
function compile(sources, data = fixtureData()) {
	const map = typeof sources === 'string' ? { 'test.guide': sources } : sources;
	const list = Object.keys(map).map((file) => ({ file, text: map[file] }));
	const { guides, diag } = compileSources(list, data);
	const strip = (d) => `${d.file}:${d.line}: ${d.message}`;
	return {
		guides,
		diag,
		errors: diag.sorted().filter((d) => d.severity === 'error').map(strip),
		warnings: diag.sorted().filter((d) => d.severity === 'warning').map(strip),
		text: diag.sorted().map(format).join('\n'),
	};
}

// Run fn with console output captured; returns { result, out }.
async function quiet(fn) {
	const out = [];
	const saved = { log: console.log, warn: console.warn, error: console.error };
	console.log = console.warn = console.error = (...a) => out.push(a.join(' '));
	try {
		const result = await fn();
		return { result, out: out.join('\n') };
	} finally {
		Object.assign(console, saved);
	}
}

// A JSON-plain copy (drops non-enumerable bookkeeping and undefined fields).
function plain(v) {
	return JSON.parse(JSON.stringify(v));
}

// Minimal addon folders with TOCs, for pack/install tests.
function fakeAddons(root, names = ['Polestar', 'Polestar_Guides', 'Polestar_Recorder'], version = '0.1.0') {
	for (const n of names) {
		const dir = path.join(root, n);
		fs.mkdirSync(dir, { recursive: true });
		fs.writeFileSync(path.join(dir, `${n}.toc`), `## Interface: 16001\n## Title: ${n}\n## Version: ${version}\n\n${n === 'Polestar_Guides' ? 'Pack.xml' : 'Main.lua'}\n`);
		if (n !== 'Polestar_Guides') fs.writeFileSync(path.join(dir, 'Main.lua'), `local ADDON, ns = ...\n-- ${n}\n`);
		fs.writeFileSync(path.join(dir, '.hidden'), 'not shipped\n');
	}
	return root;
}

module.exports = { FIXTURES, DATA_DIR, GUIDES_DIR, fixtureData, guideText, lineOf, compile, tmpdir, quiet, plain, fakeAddons };
