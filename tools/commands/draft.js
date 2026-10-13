'use strict';
// `polestar draft`: generate a first-draft leveling route as a .guide file.

const fs = require('node:fs');
const path = require('node:path');
const { draft, loadData } = require('../lib/route');

const ROOT = path.resolve(__dirname, '..', '..');

const usage = `usage: node tools/polestar.js draft --faction <Alliance|Horde> --race <Race> --zone <name> [--zone <name>...] --levels <min>-<max> [options]

Generates an efficient first-draft route (docs/GUIDE_FORMAT.md) from the
reference data: hub-style accepts and turn-ins, objective areas ordered by
nearest neighbour + 2-opt over world distances, level gating by estimated XP.

options:
  --class <Class>          route for one class; otherwise class quests get "only <Class>"
  --start-quest <id>       begin at this quest's giver
  --start <x,y>            begin at these coordinates in the first zone
  --id <guide id>          default forever/<faction>/<race>/<zones>-<min>-<max>
  --title <text>           default "<zones> <min>-<max>"
  --next <guide id>        header "next"
  --done <ids|file.guide>  quests already turned in (comma list, or the turnins of a guide); repeatable
  --trainer <Class>:<npc>  a class trainer the data does not mark; repeatable
  --keep-breadcrumbs       end with optional accepts of breadcrumbs leading out of the area
  --data <dir>             reference data (default data/forever)
  --out <file>             write the guide here (default stdout)
  --quiet                  no summary on stderr

Races: Human Dwarf Gnome NightElf Orc Troll Tauren Undead Skyborne; a new race
takes its bit as <Name>:<bit> (e.g. Newrace:512).`;

const VALUE = new Set(['faction', 'race', 'class', 'zone', 'levels', 'start-quest', 'start', 'id', 'title', 'next', 'done', 'trainer', 'data', 'out']);
const FLAGS = new Set(['keep-breadcrumbs', 'quiet', 'help']);
const MULTI = new Set(['zone', 'done', 'trainer']);

function parseArgs(argv) {
	const out = { zone: [], done: [], trainer: [] };
	for (let i = 0; i < argv.length; i++) {
		const a = argv[i];
		const m = /^--([a-z-]+)(?:=(.*))?$/.exec(a);
		if (!m) throw new Error(`unexpected argument "${a}"`);
		const key = m[1];
		if (FLAGS.has(key)) {
			if (m[2] != null) throw new Error(`--${key} takes no value`);
			out[key] = true;
			continue;
		}
		if (!VALUE.has(key)) throw new Error(`unknown option --${key}`);
		const v = m[2] != null ? m[2] : argv[++i];
		if (v == null) throw new Error(`--${key} needs a value`);
		if (MULTI.has(key)) out[key].push(v);
		else if (out[key] != null) throw new Error(`--${key} given twice`);
		else out[key] = v;
	}
	return out;
}

function parseDone(list) {
	const ids = [];
	for (const v of list) {
		if (/^[\d,\s]+$/.test(v)) {
			for (const s of v.split(',')) if (s.trim()) ids.push(Number(s));
			continue;
		}
		if (!fs.existsSync(v)) throw new Error(`--done ${v}: neither an id list nor a file`);
		for (const line of fs.readFileSync(v, 'utf8').split(/\r?\n/)) {
			const m = /^\s+turnin\s+(\d+)\b/i.exec(line);
			if (m) ids.push(Number(m[1]));
		}
	}
	return ids;
}

function toOptions(a) {
	if (!a.faction || !a.race || !a.zone.length || !a.levels) throw new Error('--faction, --race, --zone and --levels are required');
	const lv = /^(\d+)-(\d+)$/.exec(a.levels);
	if (!lv) throw new Error(`--levels must be <min>-<max>, got "${a.levels}"`);
	if (a.id != null && !/^[a-z0-9/_-]+$/.test(a.id)) throw new Error('--id may only contain a-z 0-9 / _ -');
	if (a['start-quest'] != null && a.start != null) throw new Error('use --start-quest or --start, not both');
	let start = null;
	if (a.start != null) {
		const m = /^\s*(\d+(?:\.\d+)?)\s*,\s*(\d+(?:\.\d+)?)\s*$/.exec(a.start);
		if (!m || Number(m[1]) > 100 || Number(m[2]) > 100) throw new Error(`--start must be x,y in 0-100, got "${a.start}"`);
		start = [Number(m[1]), Number(m[2])];
	}
	if (a['start-quest'] != null && !/^\d+$/.test(a['start-quest'])) throw new Error('--start-quest must be a quest id');
	const trainers = a.trainer.map((t) => {
		const m = /^([A-Za-z]+):(\d+)$/.exec(t);
		if (!m) throw new Error(`--trainer must be <Class>:<npcId>, got "${t}"`);
		return [m[1], Number(m[2])];
	});
	return {
		faction: a.faction,
		race: a.race,
		class: a.class || null,
		zones: a.zone,
		levels: [Number(lv[1]), Number(lv[2])],
		startQuest: a['start-quest'] != null ? Number(a['start-quest']) : null,
		start,
		id: a.id || null,
		title: a.title || null,
		next: a.next || null,
		done: parseDone(a.done),
		trainers,
		keepBreadcrumbs: !!a['keep-breadcrumbs'],
	};
}

async function run(argv) {
	let args;
	let opts;
	try {
		args = parseArgs(argv);
		if (args.help) {
			console.log(usage);
			return 0;
		}
		opts = toOptions(args);
	} catch (e) {
		console.error(`draft: ${e.message}\n\n${usage}`);
		return 2;
	}
	let result;
	try {
		const data = loadData(path.resolve(args.data || path.join(ROOT, 'data', 'forever')));
		result = draft(data, opts);
	} catch (e) {
		console.error(`draft: ${e.message}`);
		return 1;
	}
	if (args.out) {
		fs.mkdirSync(path.dirname(path.resolve(args.out)), { recursive: true });
		fs.writeFileSync(args.out, result.text);
	} else {
		process.stdout.write(result.text);
	}
	if (!args.quiet) {
		const r = result.report;
		const lines = [`draft: ${r.routed.length} quests routed, ${r.excluded.length} skipped, estimated end level ${r.final.toFixed(1)}${args.out ? ` -> ${args.out}` : ''}`];
		for (const e of r.excluded) lines.push(`  skipped ${e.id} "${e.title}": ${e.reason}`);
		for (const w of result.warnings) lines.push(`  warning: ${w}`);
		console.error(lines.join('\n'));
	}
	return 0;
}

module.exports = { name: 'draft', summary: 'Generate a first-draft leveling route (.guide) from the reference data', usage, run };
