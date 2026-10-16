'use strict';
// Changelog fragments: each change is its own file, changes/<slug>.md, so
// pull requests into next and into a hotfix branch never touch the same lines
// of CHANGELOG.md. A fragment is front matter naming its section, then the
// entry as CHANGELOG.md writes it:
//
//   ---
//   section: players
//   ---
//   - Ticking a quest's accept off without taking the quest no longer sends
//     you to farm for it.
//
// A release gathers the fragments under one `## <version> (<date>)` heading,
// above the newest release, and deletes them.

const fs = require('node:fs');
const path = require('node:path');

const DIR = 'changes';
const README = 'README.md';

// The sections, in CHANGELOG.md's order, with their headings.
const SECTIONS = [
	{ key: 'players', heading: 'For players' },
	{ key: 'authors', heading: 'For guide authors' },
	{ key: 'contributors', heading: 'For contributors' },
];
const SECTION_KEYS = SECTIONS.map((s) => s.key);

const WRAP = 78;
const SLUG_WORDS = 6;
const SLUG_MAX = 48;

// parseFragment(text) -> { section, body } or { error }. The body has no
// leading blank lines and no trailing whitespace.
function parseFragment(text) {
	const lines = text.replace(/\r\n?/g, '\n').split('\n');
	if (lines[0] !== '---') return { error: 'no front matter (a first line "---")' };
	const end = lines.indexOf('---', 1);
	if (end < 0) return { error: 'front matter not closed by "---"' };
	let section = null;
	for (const line of lines.slice(1, end)) {
		if (!line.trim()) continue;
		const m = /^([A-Za-z]+):\s*(.*?)\s*$/.exec(line);
		if (!m) return { error: `front matter line "${line}" is not "key: value"` };
		if (m[1] !== 'section') return { error: `unknown front matter key "${m[1]}"` };
		section = m[2];
	}
	if (section === null) return { error: `no section (use ${SECTION_KEYS.join(', ')})` };
	if (!SECTION_KEYS.includes(section)) return { error: `unknown section "${section}" (use ${SECTION_KEYS.join(', ')})` };
	const body = lines
		.slice(end + 1)
		.join('\n')
		.replace(/^(?:[ \t]*\n)+/, '')
		.trimEnd();
	if (!body) return { error: 'no entry after the front matter' };
	if (!body.startsWith('- ')) return { error: 'the entry does not start with "- "' };
	return { section, body };
}

function formatFragment(section, body) {
	return `---\nsection: ${section}\n---\n${body.trimEnd()}\n`;
}

// Every file in <root>/changes/ but its README, sorted by name (code units,
// so the order is the same everywhere): [{ name, file, section, body, error }].
function readFragments(root) {
	const dir = path.join(root, DIR);
	if (!fs.existsSync(dir)) return [];
	return fs
		.readdirSync(dir, { withFileTypes: true })
		.filter((e) => e.name !== README && !e.name.startsWith('.'))
		.map((e) => e.name)
		.sort((a, b) => (a < b ? -1 : a > b ? 1 : 0))
		.map((name) => {
			const file = path.join(dir, name);
			const rel = `${DIR}/${name}`;
			if (!name.endsWith('.md') || !fs.statSync(file).isFile()) return { name: rel, file, error: 'not a .md fragment' };
			return { name: rel, file, ...parseFragment(fs.readFileSync(file, 'utf8')) };
		});
}

// The `### ...` sections the fragments fill, in order, each followed by its
// entries; '' when there are none. Fragments must be valid.
function assemble(fragments) {
	const parts = [];
	for (const { key, heading } of SECTIONS) {
		const bodies = fragments.filter((f) => f.section === key).map((f) => f.body);
		if (bodies.length) parts.push(`### ${heading}\n\n${bodies.join('\n')}\n`);
	}
	return parts.join('\n');
}

const UNRELEASED = /^## Unreleased[^\S\n]*$/m;

function hasUnreleased(changelog) {
	return UNRELEASED.test(changelog.replace(/\r\n?/g, '\n'));
}

const escape = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

function hasVersion(changelog, version) {
	return new RegExp(`^## ${escape(version)}(?:[^\\S\\n]+\\(|[^\\S\\n]*$)`, 'm').test(changelog);
}

// The changelog with a `## <version> (<date>)` section holding the
// fragments, placed above the first `## ` heading (the newest release), or
// at the end when there is none.
function insertRelease(changelog, version, date, fragments) {
	const section = `## ${version} (${date})\n\n${assemble(fragments)}`;
	const m = /^## /m.exec(changelog);
	if (m) return `${changelog.slice(0, m.index)}${section}\n${changelog.slice(m.index)}`;
	const head = changelog.trimEnd();
	return head ? `${head}\n\n${section}` : section;
}

// A file name from the first words of text (or from a name given).
function slugify(text) {
	const words = text
		.toLowerCase()
		.normalize('NFKD')
		.replace(/[\u0300-\u036f]/g, '')
		.replace(/^\s*-\s+/, '')
		.match(/[a-z0-9]+/g);
	if (!words) return '';
	let slug = '';
	for (const w of words.slice(0, SLUG_WORDS)) {
		const next = slug ? `${slug}-${w}` : w;
		if (next.length > SLUG_MAX) break;
		slug = next;
	}
	return slug || words[0].slice(0, SLUG_MAX);
}

// Entry text as a fragment body: text already a list item ("- ...") is kept
// as written; plain text becomes one item, wrapped at WRAP columns.
function toEntry(text) {
	const t = text.replace(/\r\n?/g, '\n').trim();
	if (t.startsWith('- ')) return t;
	const lines = [];
	let line = '-';
	let words = 0;
	for (const word of t.split(/\s+/)) {
		if (words && line.length + 1 + word.length > WRAP) {
			lines.push(line);
			line = ' ';
			words = 0;
		}
		line += ` ${word}`;
		words++;
	}
	lines.push(line);
	return lines.join('\n');
}

module.exports = {
	DIR,
	SECTIONS,
	SECTION_KEYS,
	parseFragment,
	formatFragment,
	readFragments,
	assemble,
	hasUnreleased,
	hasVersion,
	insertRelease,
	slugify,
	toEntry,
};
