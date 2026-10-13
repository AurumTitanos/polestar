'use strict';
// The resolver (tools/lib/dsl/resolve.js): what the compiler fills in from
// reference data, per docs/GUIDE_FORMAT.md "What the compiler fills in".
// Fixture data: tests/fixtures/dsl/data (Elwynn Forest, uiMapID 1429).

const { test } = require('node:test');
const assert = require('node:assert/strict');
const { compile, guideText, plain } = require('./fixtures/dsl/helpers');

function goalsOf(lines) {
	const r = compile(guideText(lines));
	assert.deepEqual(r.errors, [], r.text);
	return { goals: plain(r.guides[0].steps.flatMap((s) => s.goals)), r };
}

test('quest titles, quest givers and their positions come from data; Era-sourced points carry f = "e"', () => {
	const { goals } = goalsOf(['step One', '  accept 783', '  turnin 783', '  accept 7 "My Own Title"']);
	assert.deepEqual(goals[0], { t: 'accept', quest: 783, title: 'A Threat Within', npc: 823, npcName: 'Deputy Willem', minLevel: 1, qlvl: 1, map: 1429, x: 48.17, y: 42.94, f: 'e' });
	assert.deepEqual(goals[1], { t: 'turnin', quest: 783, title: 'A Threat Within', npc: 197, npcName: 'Marshal McBride', map: 1429, x: 48.92, y: 41.61, f: 'e' });
	assert.equal(goals[2].title, 'My Own Title', 'explicit title wins over data');
});

test('the spawn nearest the previous goal on the same map is chosen, measured in yards', () => {
	// From 47.6,35.1 the nearest Kobold Vermin in map percent is 47.6,31.2, but
	// Elwynn is wider than tall: in yards 49.0,32.4 is closer.
	const a = goalsOf(['step One', '  goto 47.6,35.1', '  kill 6']).goals;
	assert.deepEqual([a[1].x, a[1].y, a[1].f], [49, 32.4, 'e']);
	const b = goalsOf(['step One', '  goto 52,27', '  kill 6']).goals;
	assert.deepEqual([b[1].x, b[1].y], [52.3, 26.8]);
	// The previous goal can be in an earlier step.
	const c = goalsOf(['step One', '  goto 45,34', 'step Two', '  kill 6']).goals;
	assert.deepEqual([c[1].x, c[1].y], [45.1, 33.9]);
});

test('among several quest enders the one nearest the previous goal wins; npc picks one explicitly', () => {
	const near197 = goalsOf(['step One', '  accept 5261', '  goto 48.9,41.7', '  turnin 5261']).goals[2];
	assert.deepEqual([near197.npc, near197.npcName], [197, 'Marshal McBride']);
	const near196 = goalsOf(['step One', '  accept 5261', '  goto 48.9,40.0', '  turnin 5261']).goals[2];
	assert.deepEqual([near196.npc, near196.npcName], [196, 'Eagan Peltskinner']);
	const explicit = goalsOf(['step One', '  accept 5261', '  goto 48.9,40.0', '  turnin 5261 npc 197']).goals[2];
	assert.deepEqual([explicit.npc, explicit.x, explicit.y], [197, 48.92, 41.61]);
});

test('without previous coordinates the spawn centroid in the current zone is used', () => {
	const elwynn = goalsOf(['step One', '  kill 1423']).goals[0];
	assert.deepEqual([elwynn.map, elwynn.x, elwynn.y], [1429, 50, 60]);
	const city = goalsOf(['step One', '  zone Stormwind City', '  kill 1423']).goals[0];
	assert.deepEqual([city.map, city.x, city.y, city.f], [1453, 60, 70, 'e']);
});

test('collect positions at the item drop sources, preferring the current zone, then nearness, then drop chance', () => {
	// Timber Wolf (80%) and Young Wolf (40%) both spawn in Elwynn. With no earlier
	// point on the map, the higher-chance source's centroid is used. Both droppers'
	// spawns make the spawn areas (the lone one dropped next to a pack of two).
	// Outside a quest objective the dominant source (50% or more) is named.
	const wolves = [{ x: 45.5, y: 39, r: 30, n: 2 }];
	const alone = goalsOf(['step One', '  collect 750 x4']).goals[0];
	assert.deepEqual(alone, { t: 'collect', item: 750, itemName: 'Tough Wolf Meat', from: 'Timber Wolf', fromKind: 'npc', fromFaction: 'A', count: 4, map: 1429, x: 44.5, y: 42.5, f: 'e', spots: wolves });
	// After meeting Eagan (48.94,40.17) the nearest spawn of any source wins: a Young Wolf at 46,38.
	const linked = goalsOf(['step One', '  accept 33', '  collect 750 quest 33']).goals[1];
	assert.deepEqual(linked, { t: 'collect', quest: 33, title: 'Wolves Across the Border', item: 750, itemName: 'Tough Wolf Meat', count: 8, oi: 1, map: 1429, x: 46, y: 38, f: 'e', spots: wolves });
});

test('kill goals carry the spawn areas of their mob, nearest to the chosen point first; points and single spawns get none', () => {
	// Camp Gnoll: two camps of three 140 yd apart (around 40,70 and 44,70) and a lone spawn at 42,74.
	const { goals } = goalsOf(['step One', '  goto 41,71', '  kill 95021', '  goto 44,70', '  kill 95021', '  kill 95021 @40,70', '  kill 823']);
	const west = { x: 40, y: 70.2, r: 15, n: 3 };
	const east = { x: 44.1, y: 70, r: 15, n: 3 };
	assert.deepEqual([goals[1].x, goals[1].y, goals[1].spots, goals[1].spread], [40.3, 70.3, [west, east], undefined], 'from the west camp: west first, the lone spawn dropped');
	assert.deepEqual([goals[3].x, goals[3].y, goals[3].spots], [44, 70, [east, west]], 'from the east camp: east first');
	assert.equal(goals[4].spots, undefined, 'hand-placed coordinates stay a point');
	assert.equal(goals[5].spots, undefined, 'a single-spawn npc stays a point');
});

test('mobs spread over a wide area make an area objective: every cluster, lone spawns too, as a walk from the chosen point', () => {
	// Roaming Gnoll: camps around 30,30 and 60,30 (a thousand yards apart) and a lone spawn at 80,80.
	const g = goalsOf(['step One', '  goto 58,32', '  kill 95020']).goals[1];
	assert.equal(g.spread, true);
	assert.deepEqual(g.spots, [
		{ x: 60.3, y: 29.9, r: 40, n: 3 },
		{ x: 30, y: 30.4, r: 40, n: 3 },
		{ x: 80, y: 80, r: 40, n: 1 },
	]);
});

test('an area objective with more clusters than the cap keeps spots spread evenly over the whole area', () => {
	// Plains Strider: twenty lone spawns on a 5 x 4 grid across Elwynn (x 10-90, y 20-80).
	const g = goalsOf(['step One', '  goto 12,22', '  kill 95022']).goals[1];
	assert.equal(g.spread, true);
	assert.equal(g.spots.length, 12);
	assert.deepEqual([g.spots[0].x, g.spots[0].y], [10, 20], 'the walk starts at the chosen point');
	assert.equal(new Set(g.spots.map((s) => `${s.x},${s.y}`)).size, 12);
	const xs = g.spots.map((s) => s.x);
	const ys = g.spots.map((s) => s.y);
	assert.deepEqual([Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)], [10, 90, 20, 80], 'the picks reach every edge of the area');
	for (const [x0, x1, y0, y1] of [[10, 50, 20, 50], [50, 90, 20, 50], [10, 50, 50, 80], [50, 90, 50, 80]]) {
		assert.ok(g.spots.some((s) => s.x >= x0 && s.x <= x1 && s.y >= y0 && s.y <= y1), `a spot in ${x0}-${x1}, ${y0}-${y1}`);
	}
});

test('objective index and count come from the linked objective; explicit values win', () => {
	const { goals, r } = goalsOf(['step One', '  accept 7', '  kill 6 quest 7', '  kill 6 x3 quest 7', '  accept 9400', '  interact 1617 quest 9400', '  kill 6 quest 7.1 x2']);
	assert.deepEqual([goals[1].oi, goals[1].count, goals[1].title], [1, 10, 'Kobold Camp Cleanup']);
	assert.deepEqual([goals[2].oi, goals[2].count], [1, 3]);
	assert.deepEqual([goals[4].oi, goals[4].count, goals[4].objName], [1, undefined, 'Kobold Crate']);
	assert.deepEqual([goals[5].oi, goals[5].count], [1, 2]);
	assert.deepEqual(r.warnings.filter((w) => /objective/.test(w)), []);
});

test('a quest link with no matching objective warns and leaves the index unset', () => {
	const { goals, r } = goalsOf(['step One', '  accept 7', '  kill 69 quest 7']);
	assert.equal(goals[1].oi, undefined);
	assert.match(r.warnings.join('\n'), /test\.guide:9: quest 7 has no objective for this npc/);
});

test('live-frame (recorded) spawns carry no frame flag; hand-typed coordinates are Era-frame by default', () => {
	const { goals } = goalsOf(['step One', '  talk 9001', '  talk 823 @48.2,42.9']);
	assert.deepEqual(goals[0], { t: 'talk', npc: 9001, npcName: 'Skyborne Herald', map: 1429, x: 40, y: 60 });
	assert.deepEqual(goals[1], { t: 'talk', npc: 823, npcName: 'Deputy Willem', map: 1429, x: 48.2, y: 42.9, f: 'e' });
});

test('buy without an npc picks a vendor of the item; map modifiers and zone directives place coordinates', () => {
	const { goals } = goalsOf(['step One', '  buy 159 x5', '  goto 50,50 map 1453 "Trade District"', '  zone map 1411', '  note "Durotar now" @10,20']);
	assert.deepEqual([goals[0].npc, goals[0].npcName, goals[0].count, goals[0].x, goals[0].y], [152, 'Brother Danil', 5, 47.5, 41.6]);
	assert.deepEqual([goals[1].map, goals[1].text], [1453, 'Trade District']);
	assert.deepEqual([goals[2].map, goals[2].x, goals[2].y], [1411, 10, 20]);
});

test('header fields compile to the guide schema with defaults', () => {
	const r = compile(
		guideText(['guide t/full', 'title Full', 'faction Horde', 'race Orc,Undead', 'class !Hunter', 'levels 3-9', 'zone map 1411', 'next t/other', 'category Dungeons', 'author Someone', 'version 4', '', 'step S', '  level 4']),
	);
	const g = plain(r.guides[0]);
	delete g.steps;
	assert.deepEqual(g, {
		id: 't/full',
		pack: 'guides',
		title: 'Full',
		faction: 'Horde',
		races: ['Orc', 'Scourge'],
		classes: ['WARRIOR', 'PALADIN', 'ROGUE', 'PRIEST', 'SHAMAN', 'MAGE', 'WARLOCK', 'DRUID'],
		minLevel: 3,
		maxLevel: 9,
		category: 'Dungeons',
		zone: 1411,
		zoneName: 'Durotar',
		next: 't/other',
		author: 'Someone',
		version: 4,
	});
	const d = plain(compile(guideText(['step S', '  level 2'])).guides[0]);
	assert.deepEqual([d.category, d.author, d.version, d.pack, d.zone, d.zoneName], ['Leveling', 'Polestar', 1, 'guides', 1429, 'Elwynn Forest']);
});

test('step titles, tips and only conditions compile onto the step', () => {
	const r = compile(guideText(['step Camp', '  tip First line.', '  tip Second line.', '  only Warrior,Dwarf', '  level 2']));
	assert.deepEqual(plain(r.guides[0].steps[0]), {
		title: 'Camp',
		note: 'First line.\nSecond line.',
		only: { classes: ['WARRIOR'], races: ['Dwarf'] },
		goals: [{ t: 'level', level: 2 }],
	});
});

test('unknown zone names are errors at the zone line', () => {
	const text = guideText(['step S', '  zone Atlantis', '  level 2']);
	const r = compile(text);
	assert.deepEqual(r.errors, ['test.guide:8: unknown zone "Atlantis" (not in zones.json; use `zone map <uiMapID>`)']);
});
