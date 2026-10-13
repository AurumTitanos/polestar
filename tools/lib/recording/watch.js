'use strict';
// Re-import SavedVariables files whenever the client rewrites them.
//
//   const w = watchSavedVariables(files, { outDir, onImport, onError });
//   ...
//   w.close();
//
// Polls with fs.watchFile (reliable for files written through Wine and for
// files that do not exist yet), debounces bursts of writes, and imports only
// when the content changed. A session that disappears from the file between
// two imports is reported: that is the signature of the cold-start bug
// (client restored nil, logout wrote only the new session). Its JSON stays
// in data/recordings, so nothing is lost.

const crypto = require('node:crypto');
const fs = require('node:fs');
const { importFile } = require('./import');

function hashOf(file) {
	try {
		return crypto.createHash('sha1').update(fs.readFileSync(file)).digest('hex');
	} catch {
		return null;
	}
}

function watchSavedVariables(files, { outDir, interval = 1000, debounce = 1500, onImport = () => {}, onError = () => {}, now } = {}) {
	const state = new Map(); // file -> { hash, keys:Set, timer }

	function run(file) {
		const s = state.get(file);
		s.timer = null;
		const hash = hashOf(file);
		if (!hash || hash === s.hash) return;
		let result;
		try {
			result = importFile(file, { outDir, now: now ? now() : new Date() });
		} catch (err) {
			onError(err, file);
			return;
		}
		s.hash = hash;
		const keys = new Set(result.keys);
		// Sessions the previous import saw that this one lacks.
		const missing = [...s.keys].filter((k) => !keys.has(k));
		s.keys = keys;
		onImport(result, missing);
	}

	function schedule(file) {
		const s = state.get(file);
		clearTimeout(s.timer);
		s.timer = setTimeout(() => run(file), debounce);
	}

	for (const file of files) {
		state.set(file, { hash: null, keys: new Set(), timer: null });
		if (fs.existsSync(file)) run(file);
		fs.watchFile(file, { interval, persistent: true }, (cur, prev) => {
			if (cur.mtimeMs !== prev.mtimeMs || cur.size !== prev.size) schedule(file);
		});
		// watchFile takes its baseline stat asynchronously; a write landing
		// before it would never count as a change. One content check after the
		// debounce catches it (run() does nothing when the hash is unchanged).
		schedule(file);
	}

	return {
		close() {
			for (const [file, s] of state) {
				clearTimeout(s.timer);
				fs.unwatchFile(file);
			}
		},
	};
}

module.exports = { watchSavedVariables };
