'use strict';
// The location of sethome, hearth, fly and getfp is checked against the inns
// and flight points of travel.json and the zones of zones.json, matched as
// the addon matches it; `find --kind inn|flight` lists those places.

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { DATA_DIR, compile, guideText, lineOf } = require('./helpers/dsl');
const { quiet } = require('./helpers/cli');
const { tmpdir } = require('./helpers/tmp');
const { loadData } = require('../tools/lib/dsl/data');
const { parseGuide } = require('../tools/lib/dsl/parse');
const { Diagnostics, format } = require('../tools/lib/dsl/diag');
const findCmd = require('../tools/commands/find');

const INNS = [
	{ location: 'Goldshire', names: ['Goldshire'], npc: 295, npcName: 'Innkeeper Farley', map: 1429, x: 43.77, y: 65.8 },
	{ location: 'Thunderbrew Distillery', names: ['Thunderbrew Distillery', 'Kharanos'], npc: 1247, npcName: 'Innkeeper Belm', map: 1426, x: 47.38, y: 52.52 },
	{ location: "Grom'gol Base Camp", names: ["Grom'gol Base Camp"], npc: 5814, npcName: 'Innkeeper Thulbek', map: 1434, x: 31.5, y: 29.8 },
];
const NODES = [
	{ id: 2, name: 'Stormwind, Elwynn', short: 'Stormwind', map: 1453, x: 66.3, y: 62.67, faction: 1, npc: 352, npcName: 'Dungar Longdrink' },
	{ id: 20, name: "Grom'gol, Stranglethorn", short: "Grom'gol", map: 1434, x: 32.54, y: 29.36, faction: 2, npc: 1387, npcName: 'Thysta' },
];

// The test data with a travel.json holding `travel`.
function dataWith(travel) {
	const dir = tmpdir();
	for (const f of fs.readdirSync(DATA_DIR)) fs.copyFileSync(path.join(DATA_DIR, f), path.join(dir, f));
	fs.writeFileSync(path.join(dir, 'travel.json'), `${JSON.stringify(travel)}\n`);
	return { dir, data: loadData(dir) };
}
const full = dataWith({ inns: INNS, taxi: { nodes: NODES } });

// The place warnings of a guide made of `goals`, with their hints.
function placeWarnings(goals, data) {
	const r = compile(guideText(['step S', ...goals.map((g) => `  ${g}`)]), data);
	assert.deepEqual(r.errors, []);
	return r.diag
		.sorted()
		.filter((d) => /^(sethome|hearth|fly|getfp) ".*": no /.test(d.message))
		.map((d) => ({ line: d.line, severity: d.severity, message: d.message, hint: d.hint }));
}

test('an inn\'s town, its other names, its zone and a flight point\'s town pass, in any case', () => {
	const goals = [
		'sethome "Goldshire"',
		'sethome "kharanos"',
		'hearth "Thunderbrew Distillery"',
		'hearth "Elwynn Forest"',
		'fly "Stormwind"',
		'fly "Stormwind City"',
		"fly \"Grom'gol Base Camp\"",
		'getfp "Stormwind"',
		'getfp "Stormwind, Elwynn"',
		"getfp \"grom'gol\"",
	];
	assert.deepEqual(placeWarnings(goals, full.data), []);
});

test('a misspelled or unknown place warns, with the closest known names', () => {
	const src = guideText(['step S', '  sethome "Goldshyre"', "  hearth \"Grom'gol\"", '  getfp "Stormwnd"', '  fly "Nowhere At All"', '  getfp "Elwynn"']);
	const got = placeWarnings(['sethome "Goldshyre"', "hearth \"Grom'gol\"", 'getfp "Stormwnd"', 'fly "Nowhere At All"', 'getfp "Elwynn"'], full.data);
	assert.deepEqual(got, [
		{
			line: lineOf(src, 'sethome "Goldshyre"'),
			severity: 'warning',
			message: 'sethome "Goldshyre": no inn has that bind location; the game never reports that name, so the goal never checks off by itself',
			hint: 'did you mean "Goldshire"? (`polestar find --kind inn` lists every inn)',
		},
		{
			line: lineOf(src, "hearth \"Grom'gol\""),
			severity: 'warning',
			message: "hearth \"Grom'gol\": no inn stands there (an inn's area or the zone it is in); the game never reports that name, so the goal never checks off by itself",
			hint: "did you mean \"Grom'gol Base Camp\"? (`polestar find --kind inn` lists every inn)",
		},
		{
			line: lineOf(src, 'getfp "Stormwnd"'),
			severity: 'warning',
			message: 'getfp "Stormwnd": no flight point has that name; the game never reports that name, so the goal never checks off by itself',
			hint: 'did you mean "Stormwind"? (`polestar find --kind flight` lists every flight point)',
		},
		{
			line: lineOf(src, 'fly "Nowhere At All"'),
			severity: 'warning',
			message: 'fly "Nowhere At All": no flight point lands there (its town, an inn\'s area or the zone it is in); the game never reports that name, so the goal never checks off by itself',
			hint: '`polestar find --kind flight` lists every flight point',
		},
		{
			// The node's area after the comma is not what the addon compares.
			line: lineOf(src, 'getfp "Elwynn"'),
			severity: 'warning',
			message: 'getfp "Elwynn": no flight point has that name; the game never reports that name, so the goal never checks off by itself',
			hint: '`polestar find --kind flight` lists every flight point',
		},
	]);
});

test('a kind of place the data has nothing for is not checked', () => {
	const goals = ['sethome "Nowhere At All"', 'hearth "Nowhere At All"', 'fly "Nowhere At All"', 'getfp "Nowhere At All"'];
	// Without travel.json nothing is checked.
	assert.deepEqual(placeWarnings(goals, undefined), []);
	// Inns without flight points: sethome and hearth only.
	const inns = dataWith({ inns: INNS }).data;
	assert.deepEqual(placeWarnings(goals, inns).map((w) => w.message.split(':')[0]), ['sethome "Nowhere At All"', 'hearth "Nowhere At All"']);
	// Flight points without inns: fly and getfp only.
	const nodes = dataWith({ taxi: { nodes: NODES } }).data;
	assert.deepEqual(placeWarnings(goals, nodes).map((w) => w.message.split(':')[0]), ['fly "Nowhere At All"', 'getfp "Nowhere At All"']);
});

test('find --kind inn lists every inn with its innkeeper and coordinates; a text matches any of its names or its zone', async () => {
	const all = await quiet(() => findCmd.run(['--kind', 'inn', '--data', full.dir]));
	assert.equal(all.result, 0, all.out);
	assert.deepEqual(all.out.split('\n'), [
		'sethome "Goldshire"  # Innkeeper Farley (npc 295), Elwynn Forest 43.8,65.8',
		"sethome \"Grom'gol Base Camp\"  # Innkeeper Thulbek (npc 5814), Stranglethorn Vale 31.5,29.8",
		'sethome "Thunderbrew Distillery"  # Innkeeper Belm (npc 1247), Dun Morogh 47.4,52.5',
		'# the game may also report "Kharanos"',
	]);
	const json = await quiet(() => findCmd.run(['kharanos', '--kind', 'inn', '--json', '--data', full.dir]));
	assert.equal(json.result, 0, json.out);
	assert.deepEqual(JSON.parse(json.out), [
		{
			kind: 'inn',
			id: 1247,
			name: 'Thunderbrew Distillery',
			names: ['Thunderbrew Distillery', 'Kharanos'],
			npc: 1247,
			npcName: 'Innkeeper Belm',
			zone: 'Dun Morogh',
			map: 1426,
			x: 47.38,
			y: 52.52,
			line: 'sethome "Thunderbrew Distillery"  # Innkeeper Belm (npc 1247), Dun Morogh 47.4,52.5',
			notes: ['# the game may also report "Kharanos"'],
		},
	]);
	const zone = await quiet(() => findCmd.run(['stranglethorn', '--kind', 'inn', '--data', full.dir]));
	assert.match(zone.out, /^sethome "Grom'gol Base Camp"/);
});

test('find --kind flight lists every flight point with its side, master and coordinates; --faction keeps one side', async () => {
	const all = await quiet(() => findCmd.run(['--kind', 'flight', '--data', full.dir]));
	assert.equal(all.result, 0, all.out);
	assert.deepEqual(all.out.split('\n'), [
		"getfp \"Grom'gol\"  # Grom'gol, Stranglethorn, Horde: Thysta (npc 1387), Stranglethorn Vale 32.5,29.4",
		'getfp "Stormwind"  # Stormwind, Elwynn, Alliance: Dungar Longdrink (npc 352), Stormwind City 66.3,62.7',
	]);
	const json = await quiet(() => findCmd.run(['stormwind', '--kind', 'flight', '--json', '--data', full.dir]));
	assert.deepEqual(JSON.parse(json.out).map((r) => [r.kind, r.id, r.name, r.node, r.faction, r.zone, r.x, r.y]), [['flight', 2, 'Stormwind', 'Stormwind, Elwynn', 'Alliance', 'Stormwind City', 66.3, 62.67]]);
	const horde = await quiet(() => findCmd.run(['--kind', 'flight', '--faction', 'Horde', '--data', full.dir]));
	assert.deepEqual(horde.out.split('\n').map((l) => l.split('  #')[0]), ["getfp \"Grom'gol\""]);
	// Every line parses as a goal.
	for (const line of [...all.out.split('\n'), 'sethome "Goldshire"  # Innkeeper Farley (npc 295), Elwynn Forest 43.8,65.8']) {
		const diag = new Diagnostics();
		parseGuide(`${guideText(['step S', `  ${line}`])}`, 'find.guide', diag);
		assert.deepEqual(diag.errors.map(format), [], line);
	}
	// Without travel.json: the file to build, not "nothing matches".
	const none = await quiet(() => findCmd.run(['--kind', 'flight', '--data', DATA_DIR]));
	assert.equal(none.result, 1);
	assert.match(none.out, /is missing travel\.json; run node tools\/polestar\.js travel build/);
});
