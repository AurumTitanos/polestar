'use strict';
// Profiles the whole addon while the guide simulator plays a guide
// (tests/lua/profile.lua inside the harness of tests/helpers/guide-sim.js).
//
//   const { profileGuide } = require('./helpers/profile');
//   const r = profileGuide(pack, guide, { race: 'Orc', faction: 'Horde', cls: 'WARRIOR', sample: 1000, packs: true });
//   // r.wall (s), r.handlers [{ key, calls, incl, excl }] (ms, per OnEvent/OnUpdate/timer
//   // handler), r.functions [{ key, name, samples }] (inclusive stack samples),
//   // r.lines [{ key, samples }] (self samples), r.result (SIMULATE's output)
//
// packs: true makes the local data packs (Polestar_QuestDB, Polestar_Codex,
// Polestar_ItemDB, when built) loadable on demand, so the Quests, Lookup,
// Rares and Gear modules run the way they do in game (localPacks() gives the
// stubs and setup for any runAddon call).
//
// From the shell, one persona per guide (default: the guide's faction, Orc or
// Human, as a WARRIOR):
//
//   node tests/helpers/profile.js forever/professions/mining.guide [race] [class] [--sample=1000] [--top=30] [--packs]
//
// Handler keys are "<file>:<line> <event>": the file names the module (Core,
// Quests, Rares, Maps...). Sampled functions are keyed the same way. Timing
// starts before the addon loads, so loading and login are included.

const fs = require('node:fs');
const path = require('node:path');
const { buildSimPack, playGuide, SIMULATE } = require('./guide-sim');
const { tocFiles, ADDONS } = require('./lua');

const PACKS = ['Polestar_QuestDB', 'Polestar_Codex', 'Polestar_ItemDB'];

// { stubs, before, present }: on-demand loading of the local packs present.
function localPacks() {
	const present = PACKS.filter((p) => fs.existsSync(path.join(ADDONS, p, `${p}.toc`)));
	const before = present
		.map((p) => `stub.packs[${JSON.stringify(p)}] = { ${tocFiles(p).map((f) => JSON.stringify(f)).join(', ')} }`)
		.join('\n');
	return { stubs: ['stub_quests.lua', 'stub_packs.lua'], before, present };
}

function profileGuide(pack, g, { race, faction, cls, sample = 0, top = 40, packs = false }) {
	const extra = packs ? localPacks() : { stubs: [], before: '' };
	const t0 = Date.now();
	const out = playGuide(pack, g, {
		race, faction, cls,
		stubs: [...extra.stubs, 'profile.lua'],
		before: `${extra.before}\nstub.profile.start({ sample = ${Number(sample) || 0} })`,
		script: `
			local __emit = emit
			local result
			emit = function(v) result = v end
			${SIMULATE}
			emit = __emit
			stub.profile.stop()
			emit(result)
			emit(stub.profile.report(${top}))`,
	});
	const [result, report] = out;
	return { wall: (Date.now() - t0) / 1000, result, ...report };
}

// The module a handler or function key belongs to: addon/Polestar/<Module>/...
function moduleOf(key) {
	const m = key.match(/^Polestar\/([^/]+)\/([^:]+)/);
	if (m) return m[1] === 'Core' ? `Core/${m[2]}` : m[1];
	if (key.startsWith('lua/')) return 'harness';
	return key.split(':')[0];
}

function table(rows, cols) {
	const widths = cols.map((c) => Math.max(c.length, ...rows.map((r) => String(r[c]).length)));
	const line = (r) => cols.map((c, i) => String(r[c]).padEnd(widths[i])).join('  ');
	return [line(Object.fromEntries(cols.map((c) => [c, c]))), ...rows.map(line)].join('\n');
}

function format(r) {
	const out = [];
	out.push(`wall ${r.wall.toFixed(1)} s, handlers ${(r.total / 1000).toFixed(2)} s CPU, done=${r.result && r.result.done}`);
	const byModule = new Map();
	for (const h of r.handlers) byModule.set(moduleOf(h.key), (byModule.get(moduleOf(h.key)) || 0) + h.excl);
	out.push('\nexclusive handler time by module (top handlers only):');
	out.push(table([...byModule].sort((a, b) => b[1] - a[1]).map(([m, ms]) => ({ module: m, ms: ms.toFixed(0) })), ['module', 'ms']));
	out.push('\nhandlers:');
	out.push(table(r.handlers.map((h) => ({ handler: h.key, calls: h.calls, excl_ms: h.excl.toFixed(1), incl_ms: h.incl.toFixed(1), per_call: (h.excl / h.calls).toFixed(3) })), ['handler', 'calls', 'excl_ms', 'incl_ms', 'per_call']));
	if (r.samples) {
		out.push(`\nfunctions (inclusive share of ${r.samples} samples):`);
		out.push(table(r.functions.map((f) => ({ fn: f.key, name: f.name || '', pct: ((100 * f.samples) / r.samples).toFixed(1) })), ['fn', 'name', 'pct']));
		out.push('\nlines (self):');
		out.push(table(r.lines.map((l) => ({ line: l.key, pct: ((100 * l.samples) / r.samples).toFixed(1) })), ['line', 'pct']));
	}
	return out.join('\n');
}

module.exports = { profileGuide, localPacks, moduleOf, format };

if (require.main === module) {
	const args = process.argv.slice(2);
	const flags = Object.fromEntries(args.filter((a) => a.startsWith('--')).map((a) => a.slice(2).split('=')));
	const [file, raceArg, clsArg] = args.filter((a) => !a.startsWith('--'));
	if (!file) {
		console.error('usage: node tests/helpers/profile.js <guide file under guides/ or path> [race] [class] [--sample=N] [--top=N] [--packs]');
		process.exit(2);
	}
	const rel = fs.existsSync(file) ? path.relative(path.join(__dirname, '..', '..', 'guides'), path.resolve(file)) : file;
	const pack = buildSimPack([rel]);
	try {
		const g = pack.guides[0];
		const faction = g.faction || (['Orc', 'Troll', 'Tauren', 'Scourge'].includes(raceArg) ? 'Horde' : 'Alliance');
		const race = raceArg || (faction === 'Horde' ? 'Orc' : 'Human');
		const r = profileGuide(pack, g, { race, faction, cls: clsArg || 'WARRIOR', sample: flags.sample || 0, top: Number(flags.top) || 40, packs: 'packs' in flags });
		console.log(`${g.id} as ${faction} ${race} ${clsArg || 'WARRIOR'}`);
		console.log(format(r));
	} finally {
		pack.dispose();
	}
}
