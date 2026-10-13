'use strict';
// Worker pool for the search and robustness draws (node:worker_threads).
// Every worker builds its own run from the cached world file and the given
// character/params, then answers jobs: { type: 'search', job } or
// { type: 'robust', params, routes }. Results come back in job order.

const path = require('node:path');
const { Worker } = require('node:worker_threads');

const WORKER = path.join(__dirname, 'worker.js');

class Pool {
	// init: { worldFile, race, cls, raceBits, params }
	constructor(size, init) {
		this.size = size;
		this.workers = [];
		for (let i = 0; i < size; i++) this.workers.push(new Worker(WORKER, { workerData: init }));
	}

	// Run jobs (array of messages); resolves with results in the same order.
	run(messages) {
		return new Promise((resolve, reject) => {
			const out = new Array(messages.length);
			let next = 0;
			let doneN = 0;
			if (!messages.length) return resolve(out);
			const feed = (w) => {
				if (next >= messages.length) return;
				const i = next++;
				w.__job = i;
				w.postMessage(messages[i]);
			};
			const cleanup = () => {
				for (const w of this.workers) {
					w.removeAllListeners('message');
					w.removeAllListeners('error');
				}
			};
			for (const w of this.workers) {
				w.on('message', (msg) => {
					if (msg && msg.error) {
						cleanup();
						reject(new Error(msg.error));
						return;
					}
					out[w.__job] = msg;
					doneN++;
					if (doneN === messages.length) {
						cleanup();
						resolve(out);
					} else feed(w);
				});
				w.on('error', (err) => {
					cleanup();
					reject(err);
				});
			}
			for (const w of this.workers) feed(w);
		});
	}

	async close() {
		await Promise.all(this.workers.map((w) => w.terminate()));
	}
}

module.exports = { Pool };
