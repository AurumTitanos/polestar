'use strict';
// The committed SVGs (the README's art and charts, the UI renders) are shown
// as images by GitHub and browsers, which refuse a file that is not
// well-formed XML. The usual way to break one is a comment holding "--" (a
// generated header naming a command's options did once): every comment of
// every committed SVG must be free of it, and the file must start with the
// root element or a comment.

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const ROOT = path.join(__dirname, '..');

function committedSvgs() {
	const git = spawnSync('git', ['ls-files', '-z', '--cached', '--others', '--exclude-standard', '--', '*.svg'], { cwd: ROOT, encoding: 'utf8' });
	assert.equal(git.status, 0, 'git ls-files failed');
	return git.stdout.split('\0').filter(Boolean).sort();
}

test('every committed SVG opens with its root or a comment, and no comment holds "--"', () => {
	const bad = [];
	const files = committedSvgs();
	assert.ok(files.length > 10, 'the SVGs are found');
	for (const rel of files) {
		const text = fs.readFileSync(path.join(ROOT, rel), 'utf8');
		if (!/^(<svg[\s>]|<!--)/.test(text)) bad.push(`${rel}: starts with ${JSON.stringify(text.slice(0, 20))}`);
		for (const m of text.matchAll(/<!--([\s\S]*?)-->/g)) {
			if (m[1].includes('--') || m[1].endsWith('-')) bad.push(`${rel}: a comment holds "--": ${m[1].slice(0, 80)}`);
		}
	}
	assert.deepEqual(bad, []);
});
