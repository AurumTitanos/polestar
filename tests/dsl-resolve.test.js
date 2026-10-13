'use strict';
// The resolver (tools/lib/dsl/resolve.js): what the compiler fills in from
// reference data, per docs/GUIDE_FORMAT.md "What the compiler fills in".
// Fixture data: tests/fixtures/dsl/data (Elwynn Forest, uiMapID 1429).

const { test } = require('node:test');
const assert = require('node:assert/strict');
const { compile, guideText, plain, fixtureData } = require('./fixtures/dsl/helpers');

function goalsOf(lines) {
	const r = compile(guideText(lines));
	assert.deepEqual(r.errors, [], r.text);
	return { goals: plain(r.guides[0].steps.flatMap((s) => s.goals)), r };
}

// Spawns of an npc or object on Elwynn (1429) that lie outside every spot of
// `goal`, measured in yards through the map's Era frame.
function outsideSpots(goal, kind, id) {
	const data = fixtureData();
	const fr = data.eraFrame(1429);
	const sx = Math.abs(fr.right - fr.left) / 100;
	const sy = Math.abs(fr.bottom - fr.top) / 100;
	const s = data.spawns(kind, id).find((sp) => sp.map === 1429);
	const pts = [...s.pts, ...s.more];
	return pts.filter(([x, y]) => !(goal.spots || []).some((s) => Math.hypot((x - s.x) * sx, (y - s.y) * sy) <= s.r));
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
	// spawns make the spawn areas: a pack of two and, with only three spawns, the
	// lone one too; nearest to the goal's point first.
	// Outside a quest objective the dominant source (50% or more) is named.
	const pack = { x: 45.5, y: 39, r: 30, n: 2 };
	const lone = { x: 44, y: 45, r: 15, n: 1 };
	const alone = goalsOf(['step One', '  collect 750 x4']).goals[0];
	assert.deepEqual(alone, { t: 'collect', item: 750, itemName: 'Tough Wolf Meat', from: 'Timber Wolf', fromKind: 'npc', fromFaction: 'A', count: 4, map: 1429, x: 44.5, y: 42.5, f: 'e', spots: [lone, pack] });
	// After meeting Eagan (48.94,40.17) the nearest spawn of any source wins: a Young Wolf at 46,38.
	const linked = goalsOf(['step One', '  accept 33', '  collect 750 quest 33']).goals[1];
	assert.deepEqual(linked, { t: 'collect', quest: 33, title: 'Wolves Across the Border', item: 750, itemName: 'Tough Wolf Meat', count: 8, oi: 1, map: 1429, x: 46, y: 38, f: 'e', spots: [pack, lone] });
});

test('kill goals carry the spawn areas of their mob, nearest to the chosen point first, every other place as an alternative; single spawns get none', () => {
	// Camp Gnoll: two camps of three 140 yd apart (around 40,70 and 44,70) and a lone spawn at 42,74:
	// seven spawns, more than six, so the arrow keeps to the camps and the lone one is an alternative.
	const { goals } = goalsOf(['step One', '  goto 41,71', '  kill 95021', '  goto 44,70', '  kill 95021', '  kill 823']);
	const west = { x: 40, y: 70.2, r: 15, n: 3 };
	const east = { x: 44.1, y: 70, r: 15, n: 3 };
	const lone = { x: 42, y: 74, r: 15, n: 1, alt: true };
	assert.deepEqual([goals[1].x, goals[1].y, goals[1].spots, goals[1].spread], [40.3, 70.3, [west, east, lone], undefined], 'from the west camp: west first');
	assert.deepEqual([goals[3].x, goals[3].y, goals[3].spots], [44, 70, [east, west, lone]], 'from the east camp: east first');
	assert.equal(goals[4].spots, undefined, 'a single-spawn npc stays a point');
});

test('a hand-placed point stays the spot the arrow takes; the other places the data knows are alternatives', () => {
	// Camp Gnoll from 40,70 (its west camp): the lone spawn and the east camp follow as alternatives, nearest first.
	const { goals } = goalsOf(['step One', '  kill 95021 @40,70', '  kill 95023 @20,20']);
	assert.deepEqual(goals[0].spots[0], { x: 40, y: 70, r: 20, n: 3 }, 'the author point, wide enough for the camp it stands in');
	assert.deepEqual(goals[0].spots.slice(1), [{ x: 42, y: 74, r: 15, n: 1, alt: true }, { x: 44.1, y: 70, r: 15, n: 3, alt: true }]);
	assert.deepEqual(outsideSpots(goals[0], 'npc', 95021), []);
	// Baron Testshore at 20,20: more than a thousand yards from every known spawn, so the author places
	// him where the data does not, and the data's places would mislead.
	assert.equal(goals[1].spots, undefined);
});

test('an NPC to talk to, accept from or hand in to that stands at several places gets every one', () => {
	const g = goalsOf(['step One', '  talk 95023']).goals[0];
	assert.deepEqual(outsideSpots(g, 'npc', 95023), []);
	assert.equal(g.spots.length, 2);
	assert.ok(g.spots.every((s) => !s.alt), 'a handful of places: the arrow may take any of them');
	assert.equal(g.spread, undefined);
});

test('a target with six spawns or fewer keeps a spot at every one: a named NPC may stand at any of them', () => {
	// Baron Testshore: a pair around 61,50 and a third spawn 224 yd off at 66,44.
	// From the north that third spawn is the goal's point, and it is a spot of its own, first.
	const g = goalsOf(['step One', '  goto 66.5,43.5', '  kill 95023']).goals[1];
	assert.deepEqual([g.x, g.y], [66, 44]);
	assert.deepEqual(outsideSpots(g, 'npc', 95023), []);
	assert.deepEqual([g.spots[0].x, g.spots[0].y, g.spots.length], [66, 44, 2]);
});

test('spawn areas include the points the reference data left out past its cap, data-placed and hand-placed', () => {
	// Capped Wolf: two spread points at 20,60 and 21,60; the cap left out a third at 27,66 (more than 250 yd off).
	const { goals } = goalsOf(['step One', '  goto 20,60', '  kill 95024', '  kill 95024 @20.5,60']);
	for (const g of [goals[1], goals[2]]) assert.deepEqual(outsideSpots(g, 'npc', 95024), [], g.x === 20.5 ? 'hand-placed' : 'data-placed');
	assert.ok(goals[1].spots.some((s) => s.x === 27 && s.y === 66), 'the left-out point is a place of its own');
});

test('object targets get spawn areas too: interact goals and collects from objects', () => {
	// Kobold Crate (object 1617): crates at 47,32 and 51,28, 168 yd apart; Earthroot (2449) comes from them.
	const { goals } = goalsOf(['step One', '  accept 9400', '  interact 1617 quest 9400', '  collect 2449 x5']);
	for (const g of [goals[1], goals[2]]) {
		assert.deepEqual(outsideSpots(g, 'object', 1617), [], g.t);
		assert.deepEqual(g.spots.map((s) => [s.x, s.y]).sort(), [[47, 32], [51, 28]], `${g.t}: two crates are two places, not one area between them`);
	}
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

test('an area objective with more clusters than the cap searches spots spread evenly over the whole area; every other place is an alternative', () => {
	// Plains Strider: twenty lone spawns on a 5 x 4 grid across Elwynn (x 10-90, y 20-80).
	const g = goalsOf(['step One', '  goto 12,22', '  kill 95022']).goals[1];
	assert.equal(g.spread, true);
	const searched = g.spots.filter((s) => !s.alt);
	assert.equal(searched.length, 12);
	assert.deepEqual(g.spots.slice(0, 12), searched, 'the searched spots come first');
	assert.deepEqual([g.spots[0].x, g.spots[0].y], [10, 20], 'the walk starts at the chosen point');
	assert.equal(new Set(g.spots.map((s) => `${s.x},${s.y}`)).size, 20, 'all twenty places, each once');
	assert.deepEqual(outsideSpots(g, 'npc', 95022), []);
	const xs = searched.map((s) => s.x);
	const ys = searched.map((s) => s.y);
	assert.deepEqual([Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)], [10, 90, 20, 80], 'the searched picks reach every edge of the area');
	for (const [x0, x1, y0, y1] of [[10, 50, 20, 50], [50, 90, 20, 50], [10, 50, 50, 80], [50, 90, 50, 80]]) {
		assert.ok(searched.some((s) => s.x >= x0 && s.x <= x1 && s.y >= y0 && s.y <= y1), `a spot in ${x0}-${x1}, ${y0}-${y1}`);
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
