'use strict';
// Temp directories for tests: tmpdir() makes a fresh one under the OS temp dir
// and removes it when the test process exits, so tests need no cleanup code.

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const made = [];
process.on('exit', () => {
	for (const d of made) fs.rmSync(d, { recursive: true, force: true });
});

function tmpdir(prefix = 'polestar-test-') {
	const d = fs.mkdtempSync(path.join(os.tmpdir(), prefix));
	made.push(d);
	return d;
}

module.exports = { tmpdir };
