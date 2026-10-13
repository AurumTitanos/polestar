#!/usr/bin/env node
'use strict';
// Polestar's command line. Each command is a module in tools/commands/
// exporting { name, summary, usage, run(argv) -> exit code }; this file only
// finds and dispatches them, so adding a command never edits a shared file.
//
//   node tools/polestar.js help
//   node tools/polestar.js help <command>

const fs = require('node:fs');
const path = require('node:path');

const DIR = path.join(__dirname, 'commands');

function load() {
	const cmds = new Map();
	if (!fs.existsSync(DIR)) return cmds;
	for (const file of fs.readdirSync(DIR).sort()) {
		if (!file.endsWith('.js')) continue;
		const mod = require(path.join(DIR, file));
		if (!mod || typeof mod.run !== 'function' || !mod.name) {
			throw new Error(`tools/commands/${file} must export { name, summary, usage, run }`);
		}
		if (cmds.has(mod.name)) throw new Error(`duplicate command "${mod.name}" in tools/commands/${file}`);
		cmds.set(mod.name, mod);
	}
	return cmds;
}

function overview(cmds) {
	const names = [...cmds.keys()];
	const width = Math.max(4, ...names.map((n) => n.length));
	return [
		'usage: node tools/polestar.js <command> [args]',
		'',
		'commands:',
		...names.map((n) => `  ${n.padEnd(width)}  ${cmds.get(n).summary || ''}`),
		'',
		'node tools/polestar.js help <command> for details',
	].join('\n');
}

async function main(argv) {
	const cmds = load();
	const [name, ...rest] = argv;
	if (!name || name === 'help' || name === '--help' || name === '-h') {
		const target = name === 'help' && rest[0] ? cmds.get(rest[0]) : null;
		if (name === 'help' && rest[0] && !target) {
			console.error(`unknown command "${rest[0]}"`);
			return 2;
		}
		console.log(target ? target.usage || target.summary || target.name : overview(cmds));
		return 0;
	}
	const cmd = cmds.get(name);
	if (!cmd) {
		console.error(`unknown command "${name}"\n\n${overview(cmds)}`);
		return 2;
	}
	const code = await cmd.run(rest);
	return typeof code === 'number' ? code : 0;
}

if (require.main === module) {
	main(process.argv.slice(2)).then(
		(code) => {
			process.exitCode = code;
		},
		(err) => {
			console.error(err && err.stack ? err.stack : String(err));
			process.exitCode = 1;
		},
	);
}

module.exports = { main, load };
