'use strict';
// data build, Wowhead Forever: zone quest lists (parsing, the zone guard,
// the day-long cache) and how their change notes and XP reach quests.json.

const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const { parseZoneQuests, parseChangeNotes, zonePages, loadZoneQuests, applyChangeNotes, fillWowheadXp, applyWowheadFacts } = require('../tools/lib/data/wowhead');
const { tmpdir } = require('./helpers/tmp');

// A zone page as Wowhead serves it: a quest Listview among other script.
function page(rows) {
	return `<script>var x = [1, [2]];</script><script>new Listview({template: 'quest', id: 'quests', note: "View [quest givers]", data: ${JSON.stringify(rows)}});</script>`;
}

function quest(id, extra = {}) {
	return { id, title: `Quest ${id}`, level: 20, minLevel: 15, xp: null, source: ['pfquest', 'questie-forever'], ...extra };
}

describe('Wowhead zone quest lists', () => {
	test('keeps only the zone\'s own rows, so a generic fallback list adds nothing', () => {
		const html = page([
			{ category: 11, id: 2, name: 'Has a ] and " in it', level: 25, reqlevel: 20, xp: 1750, envChange: { status: 'new', lines: [] } },
			{ category: 40, id: 1, name: 'Westfall quest', level: 12, xp: 900 },
			{ category: 11, id: 3, name: 'Updated', level: 30, reqlevel: 26, xp: 1200, envChange: { status: 'updated', lines: ['Experience <b>1200</b> instead of 1000'] } },
		]);
		const row = (r) => ({ zone: 11, type: 0, side: 0, choices: [], items: [], money: 0, rep: [], ...r });
		assert.deepEqual(parseZoneQuests(html, 11), [
			row({ id: 2, name: 'Has a ] and " in it', level: 25, reqlevel: 20, xp: 1750, status: 'new', lines: [] }),
			row({ id: 3, name: 'Updated', level: 30, reqlevel: 26, xp: 1200, status: 'updated', lines: ['Experience 1200 instead of 1000'] }),
		]);
		assert.deepEqual(parseZoneQuests('<html>no list</html>', 11), []);
	});

	test('the dungeon and raid pages keep every row with its instance, type, side and rewards', () => {
		const html = page([
			{ category: 1581, id: 166, name: 'The Defias Brotherhood', level: 22, reqlevel: 14, xp: 2600, type: 81, side: 1, itemchoices: [[6087, 1], [2041, 1]], itemrewards: [], money: 0, reprewards: [[72, 200]] },
			{ category: 718, id: 1486, name: 'Deviate Hides', type: 81, side: 3, itemchoices: [], itemrewards: [[918, 1], [6480, 2]], money: 1800, reprewards: [] },
		]);
		assert.deepEqual(
			parseZoneQuests(html, null).map((r) => [r.id, r.zone, r.type, r.side, r.choices, r.items, r.money, r.rep]),
			[
				[166, 1581, 81, 1, [[6087, 1], [2041, 1]], [], 0, [[72, 200]]],
				[1486, 718, 81, 3, [], [[918, 1], [6480, 2]], 1800, []],
			],
		);
	});

	test('reads XP, level and required level notes; other notes are ignored', () => {
		assert.deepEqual(parseChangeNotes(['Experience 3,300 instead of 820', 'Requires level 26 instead of 28', 'Level 30 instead of 25', 'Description reworded', 'Experience 630 instead of none']), [
			{ field: 'xp', value: 3300, was: 820 },
			{ field: 'minLevel', value: 26, was: 28 },
			{ field: 'level', value: 30, was: 25 },
			{ field: 'xp', value: 630, was: null },
		]);
	});

	test('asks for every class page, and zone and city maps; a zone without a continent is tried under both and bare', () => {
		const pages = zonePages({
			1437: { name: 'Wetlands', areaId: 11, parent: 1415, type: 3 },
			1447: { name: "Un'Goro Crater", areaId: 490, parent: 1414, type: 3 },
			2521: { name: 'Zephras Isle', areaId: 16593, parent: 947, type: 3 },
			1415: { name: 'Eastern Kingdoms', areaId: null, parent: 947, type: 2 },
		});
		assert.equal(pages.filter((p) => p.area < 0).length, 9, 'one page per class');
		assert.deepEqual(pages.find((p) => p.name === 'Warrior'), { area: -81, page: '-81', name: 'Warrior', paths: ['classes/warrior'] });
		assert.deepEqual(pages.filter((p) => p.area > 0), [
			{ area: 11, page: '11', name: 'Wetlands', paths: ['eastern-kingdoms/wetlands'] },
			{ area: 490, page: '490', name: "Un'Goro Crater", paths: ['kalimdor/ungoro-crater'] },
			{ area: 16593, page: '16593', name: 'Zephras Isle', paths: ['kalimdor/zephras-isle', 'eastern-kingdoms/zephras-isle', 'zephras-isle'] },
		]);
		assert.deepEqual(
			pages.filter((p) => p.area === null).map((p) => [p.page, p.paths]),
			[
				['dungeons', ['dungeons']],
				['raids', ['raids']],
			],
			'every dungeon and raid quest, two pages',
		);
	});
});

describe('Wowhead change notes and XP', () => {
	const rows = new Map([
		[606, { id: 606, status: 'updated', xp: 3300, lines: ['Experience 3300 instead of 820'] }],
		[472, { id: 472, status: 'updated', xp: 1200, lines: ['Level 30 instead of 25', 'Requires level 26 instead of 28'] }],
		[700, { id: 700, status: 'updated', xp: 500, lines: ['Experience 500 instead of 400'] }],
		[7738, { id: 7738, status: 'unchanged', xp: 440, lines: [] }],
		[99, { id: 99, status: 'new', xp: 630, lines: [] }],
		[5645, { id: 5645, name: 'Chastise', status: 'updated', lines: ['Renamed from A Lack of Fear', 'Rewards: adds Chastise'] }],
		[5641, { id: 5641, name: 'Chastise', status: 'updated', lines: ['Renamed from A Lack of Fear'] }],
	]);

	test('a note replaces the value only while we still hold the old one', () => {
		const quests = {
			606: quest(606, { xp: 820 }),
			472: quest(472, { level: 25, minLevel: 20 }),
			700: quest(700, { xp: 450 }),
			5645: quest(5645, { title: 'A Lack of Fear' }),
			5641: quest(5641, { title: 'Our Own Name' }),
		};
		assert.deepEqual(applyChangeNotes(quests, rows), { xp: 1, level: 1, minLevel: 0, title: 1 });
		assert.equal(quests[606].xp, 3300);
		assert.deepEqual(quests[606].source, ['pfquest', 'questie-forever', 'wowhead:xp']);
		assert.equal(quests[472].level, 30);
		assert.equal(quests[472].minLevel, 20, 'our 20 is not the noted old 28: left alone');
		assert.equal(quests[700].xp, 450, 'a value that is neither old nor new is left alone');
		assert.equal(quests[5645].title, 'Chastise', 'renamed in Forever, and we still had the old name');
		assert.deepEqual(quests[5645].source, ['pfquest', 'questie-forever', 'wowhead:title']);
		assert.equal(quests[5641].title, 'Our Own Name', 'a title that is not the noted old name is left alone');
	});

	test('XP fills quests without any, never overrides one', () => {
		const quests = { 99: quest(99, { source: ['questie-forever'] }), 7738: quest(7738, { xp: 2200 }) };
		assert.equal(fillWowheadXp(quests, rows), 1);
		assert.equal(quests[99].xp, 630);
		assert.deepEqual(quests[99].source, ['questie-forever', 'wowhead:xp']);
		assert.equal(quests[7738].xp, 2200, 'an unchanged quest whose Wowhead XP differs keeps ours');
	});

	test('Wowhead facts: instance, type, side, rewards; an item in both lists is a choice unless a note says it no longer is', () => {
		const quests = { 166: quest(166), 962: quest(962), 1486: quest(1486), 1367: quest(1367), 7: quest(7) };
		const facts = new Map([
			[166, { id: 166, zone: 1581, type: 81, side: 1, choices: [[6087, 1]], items: [], money: 0, rep: [[72, 200]], lines: [] }],
			[962, { id: 962, zone: 718, type: 81, side: 3, choices: [[10919, 1], [270008, 1]], items: [[10919, 1]], money: 2000, rep: [], lines: ['Rewards: adds Choice of Heat Resistant Mitts'] }],
			[1486, { id: 1486, zone: 718, type: 81, side: 3, choices: [[918, 1], [6480, 1]], items: [[918, 1], [6480, 1]], money: 1800, rep: [], lines: ['Rewards: adds Deviate Hide Pack, Slick Deviate Leggings', 'Rewards: no longer Choice of Deviate Hide Pack, Choice of Slick Deviate Leggings'] }],
			[1367, { id: 1367, zone: 405, type: 0, side: 3, choices: [], items: [], money: 0, rep: [[93, 250], [92, 1]], lines: [] }],
			[8, { id: 8, zone: 12, type: 0, side: 1, choices: [], items: [], money: 0, rep: [], lines: [] }],
		]);
		assert.equal(applyWowheadFacts(quests, facts), 4, 'quest 8 is not ours');
		assert.deepEqual(quests[166].wowhead, { zone: 1581, type: 81, side: 1, choices: [[6087, 1]], items: [], money: 0, rep: [[72, 200]] });
		assert.deepEqual([quests[962].wowhead.choices, quests[962].wowhead.items], [[[10919, 1], [270008, 1]], []], 'the gloves became one of the choices');
		assert.deepEqual([quests[1486].wowhead.choices, quests[1486].wowhead.items], [[], [[918, 1], [6480, 1]]], 'both given now');
		assert.deepEqual(quests[1367].wowhead.rep, [[93, 250]], 'a reputation of 1 is no amount');
		assert.equal(quests[7].wowhead, undefined);
	});
});

describe('Wowhead zone list cache', () => {
	const zones = { 1437: { name: 'Wetlands', areaId: 11, parent: 1415, type: 3 } };
	const T0 = Date.parse('2026-10-14T00:00:00Z');
	function fakeFetch(calls, { fail = false, xp = 100 } = {}) {
		return async (url) => {
			calls.push(url);
			if (fail) return { ok: false, status: 503, text: async () => '' };
			return { ok: true, status: 200, text: async () => page([{ category: 11, id: 5, name: 'Q', xp }]) };
		};
	}

	test('fetches once, reuses the cache for a day, then refreshes', async () => {
		const sourcesDir = tmpdir('polestar-wowhead-');
		const calls = [];
		const first = await loadZoneQuests({ sourcesDir, zones, fetchImpl: fakeFetch(calls), now: T0 });
		assert.equal(calls.length, 12, 'the nine class pages, the zone and the dungeon and raid pages, once each');
		assert.ok(calls.includes('https://www.wowhead.com/forever/quests/eastern-kingdoms/wetlands'));
		assert.ok(calls.includes('https://www.wowhead.com/forever/quests/classes/warrior'));
		assert.ok(calls.includes('https://www.wowhead.com/forever/quests/dungeons'));
		assert.equal(first.rows.get(5).xp, 100);

		await loadZoneQuests({ sourcesDir, zones, fetchImpl: fakeFetch(calls), now: T0 + 3600e3 });
		assert.equal(calls.length, 12, 'within a day: cache only');

		const later = await loadZoneQuests({ sourcesDir, zones, fetchImpl: fakeFetch(calls, { xp: 200 }), now: T0 + 25 * 3600e3 });
		assert.equal(calls.length, 24);
		assert.equal(later.rows.get(5).xp, 200);
	});

	test('a cache from before a page was added is read again, however fresh: the class pages reach an old zones.json', async () => {
		const sourcesDir = tmpdir('polestar-wowhead-');
		fs.mkdirSync(path.join(sourcesDir, 'wowhead'), { recursive: true });
		// Written an hour ago by a build that read only the zone pages.
		fs.writeFileSync(path.join(sourcesDir, 'wowhead', 'zones.json'), JSON.stringify({ fetchedAt: new Date(T0).toISOString(), zones: { 11: [{ id: 5, xp: 100 }] } }));
		const calls = [];
		await loadZoneQuests({ sourcesDir, zones, fetchImpl: fakeFetch(calls), now: T0 + 3600e3 });
		assert.ok(calls.includes('https://www.wowhead.com/forever/quests/classes/warrior'), 'the class pages are fetched');
		const n = calls.length;
		await loadZoneQuests({ sourcesDir, zones, fetchImpl: fakeFetch(calls), now: T0 + 2 * 3600e3 });
		assert.equal(calls.length, n, 'then the cache, which now records every page it read, is enough');
	});

	test('a cache an older parser wrote (no version) is read again, however fresh', async () => {
		const sourcesDir = tmpdir('polestar-wowhead-');
		fs.mkdirSync(path.join(sourcesDir, 'wowhead'), { recursive: true });
		const pages = zonePages(zones).map((p) => p.page);
		fs.writeFileSync(path.join(sourcesDir, 'wowhead', 'zones.json'), JSON.stringify({ fetchedAt: new Date(T0).toISOString(), pages, zones: { 11: [{ id: 5, xp: 100 }] } }));
		const calls = [];
		const r = await loadZoneQuests({ sourcesDir, zones, fetchImpl: fakeFetch(calls), now: T0 + 3600e3 });
		assert.equal(calls.length, 12);
		assert.equal(r.rows.get(5).zone, 11);
		assert.equal(JSON.parse(fs.readFileSync(path.join(sourcesDir, 'wowhead', 'zones.json'), 'utf8')).version, 2);
	});

	test('a failed refresh keeps the cached lists; --offline never fetches', async () => {
		const sourcesDir = tmpdir('polestar-wowhead-');
		await loadZoneQuests({ sourcesDir, zones, fetchImpl: fakeFetch([]), now: T0 });
		const failed = await loadZoneQuests({ sourcesDir, zones, fetchImpl: fakeFetch([], { fail: true }), now: T0 + 25 * 3600e3 });
		assert.equal(failed.rows.get(5).xp, 100);
		assert.match(failed.warnings.join('\n'), /kept the cached lists/);
		assert.equal(JSON.parse(fs.readFileSync(path.join(sourcesDir, 'wowhead', 'zones.json'), 'utf8')).fetchedAt, new Date(T0).toISOString());

		const calls = [];
		const offline = await loadZoneQuests({ sourcesDir: tmpdir('polestar-wowhead-'), zones, offline: true, fetchImpl: fakeFetch(calls), now: T0 });
		assert.equal(calls.length, 0);
		assert.equal(offline.rows.size, 0);
		assert.match(offline.warnings.join('\n'), /--offline: no cached Wowhead zone lists/);
	});
});
