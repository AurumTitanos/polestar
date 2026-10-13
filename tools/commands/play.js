'use strict';
// `node tools/polestar.js play`: the browser playground (tools/play). Starts
// the local server over one live Lua session of the real addons and prints
// the URL; Ctrl-C saves the SavedVariables and stops it.

const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.join(__dirname, '..', '..');
const DEFAULT_ART = '/tmp/polestar-art';

function parse(argv) {
	const opts = { port: 8077, art: null, fresh: false, host: '127.0.0.1' };
	for (let i = 0; i < argv.length; i++) {
		const a = argv[i];
		const value = () => {
			const eq = a.indexOf('=');
			if (eq >= 0) return a.slice(eq + 1);
			i++;
			if (i >= argv.length) throw new Error(`${a} needs a value`);
			return argv[i];
		};
		if (a === '--fresh') opts.fresh = true;
		else if (a === '--port' || a.startsWith('--port=')) opts.port = Number(value());
		else if (a === '--art' || a.startsWith('--art=')) opts.art = value();
		else if (a === '--no-art') opts.art = '';
		else throw new Error(`unknown option ${a}`);
	}
	if (!Number.isInteger(opts.port) || opts.port < 0 || opts.port > 65535) throw new Error('--port needs a port number');
	if (opts.art === null) {
		const env = process.env.POLESTAR_CLIENT_ART;
		opts.art = env || (fs.existsSync(path.join(DEFAULT_ART, 'maps.json')) ? DEFAULT_ART : '');
	}
	return opts;
}

async function run(argv) {
	let opts;
	try {
		opts = parse(argv);
	} catch (err) {
		console.error(err.message);
		return 2;
	}
	if (!fs.existsSync(path.join(ROOT, 'data', 'forever', 'races.json'))) {
		console.error('data/forever is not built: run node tools/polestar.js data build first');
		return 1;
	}
	const { startServer } = require('../play/server');
	const t0 = Date.now();
	const play = await startServer({
		port: opts.port, host: opts.host, artDir: opts.art || null, fresh: opts.fresh,
		dataDir: path.join(ROOT, 'data', 'play'),
		log: (m) => console.log(`[play] ${m}`),
	});
	console.log(`Polestar playground: ${play.url}  (started in ${Date.now() - t0} ms${opts.art ? `, art from ${opts.art}` : ', no client art'})`);
	console.log('SavedVariables in data/play/ (--fresh resets them). Ctrl-C to stop.');
	await new Promise((resolve) => {
		let stopping = false;
		const stop = () => {
			if (stopping) return;
			stopping = true;
			console.log('\nSaving and stopping...');
			play.close({ save: true }).finally(resolve);
		};
		process.once('SIGINT', stop);
		process.once('SIGTERM', stop);
	});
	return 0;
}

module.exports = {
	name: 'play',
	summary: 'Play with the real addon in the browser (local playground)',
	usage: [
		'usage: node tools/polestar.js play [--port 8077] [--art <dir>] [--fresh]',
		'',
		'Starts a local server running the real Polestar, Polestar_Guides and the',
		'built data packs against the simulated world, and prints its URL. Click,',
		'hover, scroll, drag and type in the game screen; the side panel sets the',
		'character, moves them, plays guide goals and tweaks the look live.',
		'',
		'  --port <n>   port on 127.0.0.1 (default 8077; 0 picks a free one)',
		'  --art <dir>  local client art (default $POLESTAR_CLIENT_ART, else',
		'               /tmp/polestar-art when present); served locally only',
		'  --no-art     draw without client art',
		'  --fresh      forget the character and SavedVariables in data/play/',
	].join('\n'),
	run,
};
