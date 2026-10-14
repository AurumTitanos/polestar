'use strict';
// trainers build: data/forever/trainers.json, the class trainers `train class`
// chooses from (see tools/lib/dsl/trainers.js for the sources), and
// addon/Polestar/Core/ClassTrainers.lua, the same trainers placed on the map
// for the Engine's class-training reminder.

const fs = require('node:fs');
const path = require('node:path');
const { parseArgs, resolvePath } = require('../lib/cli');
const { ROOT } = require('../lib/paths');
const { loadData } = require('../lib/dsl/data');
const { buildTrainers } = require('../lib/dsl/trainers');
const { buildCandidates } = require('../lib/dsl/candidates');
const { emitClassTrainers } = require('../lib/dsl/emit');

const usage = `usage: node tools/polestar.js trainers build [options]

Builds data/forever/trainers.json, the class trainers \`train class\` picks from:
every \`train <npcId> only <Class>\` goal under guides/, recorded trainer visits
in data/recordings (by the recording character's class), and Polestar's curated
list of capital and starting-town trainers, each verified by name and map
against npcs.json. Without the file, compile uses the curated list alone.
Also writes addon/Polestar/Core/ClassTrainers.lua (one trainer per town and
class, with positions and map frames) for the class-training reminder.

options:
  --guides <dir>      guide sources (default guides/)
  --data <dir>        reference data, also the output folder (default data/forever/)
  --recordings <dir>  normalized recordings (default data/recordings/)
  --out <file>        output file (default <data>/trainers.json)
  --lua <file>        Lua output (default addon/Polestar/Core/ClassTrainers.lua)`;

function writeAtomic(file, text) {
	fs.mkdirSync(path.dirname(file), { recursive: true });
	const tmp = `${file}.tmp-${process.pid}`;
	fs.writeFileSync(tmp, text);
	fs.renameSync(tmp, file);
}

// Every trainer at each town it stands in, both factions, with the frames.
function classTrainersLua(data, trainers) {
	const entries = Object.values(trainers).map((t) => ({ npc: t.id, classes: t.classes }));
	const { candidates } = buildCandidates(data, entries, { sides: ['Alliance', 'Horde'], ref: null });
	const frames = {};
	for (const c of candidates) {
		const fr = data.eraFrame(c.map);
		if (fr) frames[c.map] = { c: fr.c, left: fr.left, right: fr.right, top: fr.top, bottom: fr.bottom };
	}
	const sorted = candidates.slice().sort((a, b) => a.npc - b.npc || a.map - b.map);
	return { lua: emitClassTrainers(sorted, frames), count: sorted.length };
}

async function run(argv) {
	const { opts, positional, error } = parseArgs(argv, { flags: [], options: ['--guides', '--data', '--recordings', '--out', '--lua'] });
	if (opts.help) {
		console.log(usage);
		return 0;
	}
	if (error || positional.length !== 1 || positional[0] !== 'build') {
		console.error(`${error || 'expected `trainers build`'}\n\n${usage}`);
		return 2;
	}
	const dataDir = resolvePath(opts.data, 'data/forever', ROOT);
	if (!fs.existsSync(path.join(dataDir, 'npcs.json'))) {
		console.error(`no npcs.json in ${dataDir} (run \`node tools/polestar.js data build\` first)`);
		return 1;
	}
	const data = loadData(dataDir);
	const { trainers, report } = buildTrainers({
		data,
		guidesDir: resolvePath(opts.guides, 'guides', ROOT),
		recordingsDir: resolvePath(opts.recordings, 'data/recordings', ROOT),
	});
	const out = opts.out ? path.resolve(opts.out) : path.join(dataDir, 'trainers.json');
	writeAtomic(out, `${JSON.stringify(trainers, null, '\t')}\n`);
	for (const [cls, name, map] of report.unverified) console.warn(`warning: curated ${cls} trainer "${name}" not found on map ${map} in npcs.json; skipped`);
	console.log(
		`wrote ${out}: ${Object.keys(trainers).length} class trainers (curated ${report.curated}, from guides ${report.guide} goals, from recordings ${report.record} npcs)`,
	);
	const luaFile = opts.lua ? path.resolve(opts.lua) : path.join(ROOT, 'addon', 'Polestar', 'Core', 'ClassTrainers.lua');
	const { lua, count } = classTrainersLua(data, trainers);
	writeAtomic(luaFile, lua);
	console.log(`wrote ${luaFile}: ${count} trainer positions`);
	return 0;
}

module.exports = { name: 'trainers', summary: 'Build trainers.json and Core/ClassTrainers.lua (class trainers)', usage, run };
