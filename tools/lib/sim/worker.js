'use strict';
// Worker thread: builds a run from the cached world and answers jobs.

const fs = require('node:fs');
const { parentPort, workerData } = require('node:worker_threads');
const { compileRun, makeTables } = require('./run');
const { Evaluator } = require('./evaluate');
const { runJob } = require('./search');

const world = JSON.parse(fs.readFileSync(workerData.worldFile, 'utf8'));
const run = compileRun(world, workerData.runOpts);
const ev = new Evaluator(run, makeTables(run, workerData.params));

parentPort.on('message', (msg) => {
	try {
		if (msg.type === 'search') {
			parentPort.postMessage(runJob(ev, msg.job));
		} else if (msg.type === 'robust') {
			// Evaluate each route under each parameter draw: seconds[draw][route],
			// following the route as a plan (catch-up grinding, evaluate.js).
			const out = [];
			for (const p of msg.draws) {
				const dev = new Evaluator(run, makeTables(run, p), { catchUp: true });
				const row = [];
				for (const r of msg.routes) row.push(dev.cost(r));
				out.push(row);
			}
			parentPort.postMessage({ seconds: out });
		} else throw new Error(`unknown job type ${msg.type}`);
	} catch (err) {
		parentPort.postMessage({ error: err && err.stack ? err.stack : String(err) });
	}
});
