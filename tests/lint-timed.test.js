'use strict';
// Timed quest items (docs/GUIDE_FORMAT.md, "Validation"; tools/lib/dsl/timed.js):
// lint warns when a guide carries an item that vanishes after a while
// (items.json `duration`) longer than it lasts, by the simulator's travel and
// kill times over the guide's goals. The fixture cases run everywhere; the
// guide orders the players' reports and our lint found (fixed in 1776c37 and
// after) need the real reference data and skip without it.

const { test } = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { compile, guideText, lineOf, DATA_DIR } = require('./helpers/dsl');
const { needs } = require('./helpers/data');
const { loadData } = require('../tools/lib/dsl/data');
const { compileSources, compileProject, OFFICIAL_DIR } = require('../tools/lib/dsl/project');
const { DATA } = require('../tools/lib/paths');

const timed = (r) => r.warnings.filter((w) => / lasts /.test(w));

// Refreshing Spring Water lasts five minutes here, and A Threat Within and
// Eagan Peltskinner each take one (a required item) at their turn-in.
function fixture() {
	const data = loadData(DATA_DIR);
	data.items[159].duration = 300;
	for (const id of [783, 5261]) data.quests[id].requiredItems = [159];
	return data;
}

// Bought at Brother Danil, both errands handed in beside him in Northshire;
// the second after a ride to the far south-east corner of Elwynn and back.
function errands(buys) {
	return guideText([
		'step Northshire',
		'  accept 783',
		'  accept 5261',
		...buys.first.map((b) => `  ${b}`),
		'  turnin 783',
		'step The far corner',
		'  goto 80.0,80.0 "The far corner"',
		'  goto 48.0,43.0 "Back"',
		...buys.second.map((b) => `  ${b}`),
		'  turnin 5261',
	]);
}

test('a timed item carried past its duration warns at the goal that gets it, with its duration and the estimate', () => {
	const text = errands({ first: ['buy 159 x2'], second: [] });
	const r = compile(text, fixture());
	assert.equal(timed(r).length, 1);
	assert.match(
		timed(r)[0],
		new RegExp(`^test\\.guide:${lineOf(text, 'buy 159 x2')}: item 159 \\(Refreshing Spring Water\\) lasts 5 minutes, but the route takes about \\d+:\\d\\d from here to the \`turnin\` that spends it \\(line ${lineOf(text, 'turnin 5261')}\\)$`),
	);
});

test('a timed item got again right before the goal that spends it does not warn', () => {
	assert.deepEqual(timed(compile(errands({ first: ['buy 159'], second: ['buy 159'] }), fixture())), []);
});

test('quantities: one bought serves only the first errand; the second is supplied elsewhere, so nothing warns', () => {
	assert.deepEqual(timed(compile(errands({ first: ['buy 159'], second: [] }), fixture())), []);
});

test('an item that does not vanish never warns', () => {
	const data = fixture();
	delete data.items[159].duration;
	assert.deepEqual(timed(compile(errands({ first: ['buy 159 x2'], second: [] }), data)), []);
});

// ---------------------------------------------------------------- real data

const skip = needs('quests.json', 'npcs.json', 'objects.json', 'items.json', 'travel.json');
let real;
function realData() {
	real = real || loadData(DATA);
	if (!Object.values(real.items).some((it) => it.duration > 0)) return null;
	return real;
}

function header(id, lines) {
	return `${[`guide t/${id}`, `title ${id}`, ...lines, ''].join('\n')}\n`;
}

// The orders before the fixes, cut to the stretch the item was carried; the
// fixed ones get the item where the guides now do.
const ORDERS = [
	{
		name: "Dun Morogh's Scalding Mornbrew (five minutes) taken before the troll cave",
		item: 10439,
		head: ['faction Alliance', 'race Dwarf,Gnome', 'levels 1-13', 'zone Dun Morogh'],
		old: ['step Grelin Whitebeard', '  accept 182', '  accept 3364 lvl 4', 'step The troll cave', '  kill 706 quest 182', 'step Grelin Whitebeard', '  turnin 182', '  accept 218', '  goto 26.0,79.0 "The troll cave"', "step Grik'nir the Cold", '  collect 2004 quest 218', 'step Grelin Whitebeard', '  turnin 218', 'step Anvilmar', '  turnin 3364'],
		fixed: ['step Grelin Whitebeard', '  accept 182', 'step The troll cave', '  kill 706 quest 182', 'step Grelin Whitebeard', '  turnin 182', '  accept 218', '  goto 26.0,79.0 "The troll cave"', "step Grik'nir the Cold", '  collect 2004 quest 218', 'step Grelin Whitebeard', '  turnin 218', '  accept 3364 lvl 4', 'step Anvilmar', '  turnin 3364'],
	},
	{
		name: "the Blasted Lands' Crate of Power Stones (an hour) carried through the bloodmages' beasts",
		item: 6091,
		head: ['faction Alliance', 'levels 46-48', 'zone Duskwood'],
		old: [
			'step Darkshire', '  fly "Darkshire"', '  accept 1395',
			'step The bloodmages', '  zone Blasted Lands', '  accept 2581', '  accept 2583', '  accept 2585', '  accept 2601', '  accept 2603',
			'step Scorpoks and snickerfangs', '  collect 8391 quest 2581', '  collect 8391 quest 2603', '  collect 8393 quest 2581', '  collect 8393 quest 2583', '  collect 8393 quest 2585', '  collect 8396 quest 2603', '  collect 8396 quest 2601', '  collect 8396 quest 2585',
			'step Boars and basilisks', '  collect 8392 quest 2581', '  collect 8392 quest 2583', '  collect 8392 quest 2585', '  collect 8394 quest 2601', '  collect 8394 quest 2583',
			'step The bloodmages', '  turnin 2601', '  turnin 2603', '  turnin 2581', '  turnin 2583', '  turnin 2585',
			'step Nethergarde Keep', '  getfp "Nethergarde Keep" npc 8609', '  turnin 1395',
		],
		fixed: [
			'step Darkshire', '  fly "Darkshire"', '  accept 1395',
			'step The bloodmages', '  zone Blasted Lands', '  accept 2581', '  accept 2583', '  accept 2585', '  accept 2601', '  accept 2603',
			'step Nethergarde Keep', '  getfp "Nethergarde Keep" npc 8609', '  turnin 1395',
		],
	},
	{
		name: "the Barrens' Twitching Antennae (fifteen minutes) gathered before the hour-long southern loop",
		item: 7119,
		head: ['faction Horde', 'class Warrior', 'levels 19-24', 'zone The Barrens'],
		old: [
			'step Field of Giants', '  collect 7119 quest 1824.1',
			'step Gann Stonespire', '  accept 843',
			'step Blackthorn Ridge', '  goto 42.5,81.0 "Blackthorn Ridge"', '  collect 5074 quest 879.1', '  collect 5073 quest 879.2', '  collect 5072 quest 879.3', '  collect 5093 quest 893.1', '  collect 5092 quest 893.2', '  collect 5094 quest 893.3',
			'step Bael Modan', '  kill 3374 quest 843.1', '  kill 3375 quest 843.2', '  collect 5006 quest 843.3',
			'step Gann Stonespire', '  turnin 843', '  accept 846',
			"step Bael'dun fortress", '  collect 5017 quest 846.1', '  collect 5018 quest 846.2', '  collect 5019 quest 846.3',
			'step Gann Stonespire', '  turnin 846', '  accept 849',
			'step The flying machine', '  interact 3644 quest 849.1',
			'step Gann Stonespire', '  turnin 849',
			'step Camp Taurajo', '  hearth "Camp Taurajo"', '  turnin 1824',
		],
		fixed: ['step Gann Stonespire', '  turnin 849', 'step Twitching Antennae', '  collect 7119 quest 1824.1', 'step Camp Taurajo', '  hearth "Camp Taurajo"', '  turnin 1824'],
	},
	{
		name: "Western Plaguelands' four Arcane Quickeners (thirty minutes) bought at the first Chillwind Camp stop",
		item: 13320,
		head: ['faction Alliance', 'levels 54-57', 'zone Western Plaguelands'],
		old: [
			'step Chillwind Camp', '  accept 5216', '  buy 13320 x4',
			'step Felstone Field cauldron', '  collect 13194 quest 5216.1', '  turnin 5216', '  accept 5217',
			'step Chillwind Camp', '  turnin 5217', '  accept 5219',
			'step Felstone Field cauldron', '  accept 5218', '  collect 13357 quest 5218.2', '  collect 14047 quest 5218.3', '  turnin 5218',
			"step Dalson's Tears cauldron", '  collect 13195 quest 5219.1', '  turnin 5219', '  accept 5220',
			'step Chillwind Camp', '  turnin 5220', '  accept 5222',
			'step Writhing Haunt cauldron', '  collect 13197 quest 5222.1', '  turnin 5222', '  accept 5223',
			'step Chillwind Camp', '  turnin 5223',
			'step Writhing Haunt cauldron', '  accept 5224', '  collect 13356 quest 5224.2', '  collect 14047 quest 5224.3', '  turnin 5224',
			"step Dalson's Tears cauldron", '  accept 5221', '  collect 13356 quest 5221.2', '  collect 14047 quest 5221.3', '  turnin 5221',
		],
		fixed: [
			'step Chillwind Camp', '  turnin 5217', '  accept 5219', '  buy 13320',
			'step Felstone Field cauldron', '  accept 5218', '  collect 13357 quest 5218.2', '  collect 14047 quest 5218.3', '  turnin 5218',
			'step Chillwind Camp', '  turnin 5223', '  buy 13320 x2',
			'step Writhing Haunt cauldron', '  accept 5224', '  collect 13356 quest 5224.2', '  collect 14047 quest 5224.3', '  turnin 5224',
			"step Dalson's Tears cauldron", '  accept 5221', '  collect 13356 quest 5221.2', '  collect 14047 quest 5221.3', '  turnin 5221',
		],
	},
];

function timedOf(text, data) {
	const file = path.join(OFFICIAL_DIR, 'reported.guide');
	const { diag } = compileSources([{ file, text }], data);
	return diag.warnings.filter((w) => / lasts /.test(w.message));
}

for (const o of ORDERS) {
	test(`${o.name}: the old order warns, the fixed one does not`, { skip }, (t) => {
		const data = realData();
		if (!data) return t.skip('data/forever/items.json has no item durations: rebuild with `node tools/polestar.js data build`');
		const old = timedOf(header('old', [...o.head, '', ...o.old]), data);
		assert.equal(old.length, 1, 'the old order warns once');
		assert.match(old[0].message, new RegExp(`^item ${o.item} \\(`));
		assert.deepEqual(timedOf(header('fixed', [...o.head, '', ...o.fixed]), data), []);
	});
}

test('every authored guide carries its timed items in time', { skip }, (t) => {
	const data = realData();
	if (!data) return t.skip('data/forever/items.json has no item durations: rebuild with `node tools/polestar.js data build`');
	const { diag } = compileProject({ packDir: OFFICIAL_DIR, manifest: { id: 'guides' }, data });
	assert.deepEqual(
		diag.warnings.filter((w) => / lasts /.test(w.message)).map((w) => `${path.relative(OFFICIAL_DIR, w.file)}:${w.line}: ${w.message}`),
		[],
	);
});
