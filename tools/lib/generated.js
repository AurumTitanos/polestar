'use strict';
// Shared by the commands that write committed, generated files.

const fs = require('node:fs');
const path = require('node:path');

// Writes { name: text } into dir (check = false), or compares them with what
// is there (check = true). Returns the names written, or the names that are
// missing or differ.
function syncFiles(files, dir, { check = false } = {}) {
	if (check) return Object.entries(files).filter(([name, text]) => {
		const file = path.join(dir, name);
		return !fs.existsSync(file) || fs.readFileSync(file, 'utf8') !== text;
	}).map(([name]) => name);
	fs.mkdirSync(dir, { recursive: true });
	for (const [name, text] of Object.entries(files)) fs.writeFileSync(path.join(dir, name), text);
	return Object.keys(files);
}

// The end of a `<generator> build|check` command: prints what was written, or
// which files are stale (exit 1) with the command that rebuilds them.
function reportSync(files, dir, { check, command }) {
	const names = syncFiles(files, dir, { check });
	if (!check) {
		console.log(`wrote ${names.join(', ')}`);
		return 0;
	}
	for (const name of names) console.error(`${name} is out of date (node tools/polestar.js ${command})`);
	if (!names.length) console.log(`${Object.keys(files).length} files up to date`);
	return names.length ? 1 : 0;
}

module.exports = { syncFiles, reportSync };
