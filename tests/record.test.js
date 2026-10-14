'use strict';
// `record import|watch|draft` (tools/commands/record.js, tools/lib/recording/)
// against a fixture PolestarRecorderDB SavedVariables file.

const { test } = require('node:test');
const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');
const { importFile, findSavedVariables, normalizeSession } = require('../tools/lib/recording/import');
const { applyRecordings } = require('../tools/lib/data/recordings');
const { watchSavedVariables } = require('../tools/lib/recording/watch');
const { draftGuide } = require('../tools/lib/recording/draft');

// The guide compiler's parser: drafts must parse cleanly.
const { parseGuide } = require('../tools/lib/dsl/parse');
const { Diagnostics } = require('../tools/lib/dsl/diag');
const { tmpdir } = require('./helpers/tmp');

const CLI = path.join(__dirname, '..', 'tools', 'polestar.js');
const HUMAN = '1791000000-Testchar';
const UNDEAD = '1790990000-Altchar';

// A Northshire → Goldshire → Stormwind session, as the recorder writes it
// (two decimals, numeric map keys, empty tables, sparse caps bookkeeping),
// plus a short Undead session whose only map has uiMapID 1 (so Lua's table
// is a 1..n "array").
function humanSession(extra = '') {
	return `{
		["schema"] = 1, ["build"] = "1.60.1.70338", ["session"] = "${HUMAN}",
		["char"] = { ["name"] = "Testchar", ["realm"] = "Test Realm", ["race"] = "Human", ["class"] = "WARRIOR", ["faction"] = "Alliance" },
		["started"] = 1791000000, ["ended"] = 1791003000,
		["counts"] = { ["pos"] = 3 }, ["dropped"] = { ["pos"] = 2, ["kill"] = 0 },
		["maps"] = {
			[1429] = { ["name"] = "Elwynn Forest", ["type"] = 3, ["parent"] = 1415, ["c"] = 0, ["top"] = 1800, ["left"] = 1100, ["bottom"] = -1666.67, ["right"] = -4100 },
			[1453] = { ["name"] = "Stormwind City", ["type"] = 3, ["parent"] = 1429, ["c"] = 0, ["top"] = 1722.17, ["left"] = -7997.7, ["bottom"] = 564.11, ["right"] = -9733.2 },
		},
		["events"] = {
			{ ["t"] = 0, ["e"] = "zone", ["map"] = 1429, ["zone"] = "Elwynn Forest", ["subzone"] = "Northshire Valley" },
			{ ["t"] = 5, ["e"] = "gossip", ["npc"] = 823, ["npcName"] = "Deputy Willem", ["available"] = { 783 }, ["active"] = {}, ["map"] = 1429, ["x"] = 48.17, ["y"] = 42.95 },
			{ ["t"] = 12, ["e"] = "accept", ["q"] = 783, ["title"] = "A Threat Within", ["qlvl"] = 1, ["lvl"] = 1, ["xp"] = 0, ["npc"] = 823, ["npcName"] = "Deputy Willem", ["map"] = 1429, ["x"] = 48.17, ["y"] = 42.95 },
			{ ["t"] = 30, ["e"] = "pos", ["map"] = 1429, ["x"] = 48.9, ["y"] = 41.6 },
			{ ["t"] = 41, ["e"] = "turnin", ["q"] = 783, ["xpReward"] = 40, ["money"] = 0, ["lvl"] = 1, ["npc"] = 197, ["npcName"] = "Marshal McBride", ["map"] = 1429, ["x"] = 48.93, ["y"] = 41.61 },
			{ ["t"] = 50, ["e"] = "accept", ["q"] = 7, ["title"] = "Kobold Camp Cleanup", ["qlvl"] = 2, ["lvl"] = 1, ["xp"] = 40, ["npc"] = 197, ["npcName"] = "Marshal McBride", ["map"] = 1429, ["x"] = 48.93, ["y"] = 41.61 },
			{ ["t"] = 58, ["e"] = "accept", ["q"] = 33, ["title"] = "Wolves Across the Border", ["qlvl"] = 2, ["lvl"] = 1, ["xp"] = 40, ["npc"] = 196, ["npcName"] = "Eagan Peltskinner", ["map"] = 1429, ["x"] = 48.6, ["y"] = 42.0 },
			{ ["t"] = 200, ["e"] = "pos", ["map"] = 1429, ["x"] = 47.5, ["y"] = 37.0 },
			{ ["t"] = 230, ["e"] = "kill", ["npc"] = 6, ["npcName"] = "Kobold Vermin", ["q"] = 7, ["oi"] = 1, ["map"] = 1429, ["x"] = 47.2, ["y"] = 35.4 },
			{ ["t"] = 231, ["e"] = "progress", ["q"] = 7, ["oi"] = 1, ["text"] = "Kobold Vermin slain: 1/10", ["cur"] = 1, ["max"] = 10, ["type"] = "monster", ["map"] = 1429, ["x"] = 47.2, ["y"] = 35.4 },
			{ ["t"] = 260, ["e"] = "kill", ["npc"] = 6, ["npcName"] = "Kobold Vermin", ["q"] = 7, ["oi"] = 1, ["map"] = 1429, ["x"] = 47.8, ["y"] = 34.8 },
			{ ["t"] = 261, ["e"] = "progress", ["q"] = 7, ["oi"] = 1, ["text"] = "Kobold Vermin slain: 2/10", ["cur"] = 2, ["max"] = 10, ["type"] = "monster", ["map"] = 1429, ["x"] = 47.8, ["y"] = 34.8 },
			{ ["t"] = 300, ["e"] = "loot", ["item"] = 750, ["itemName"] = "Tough Wolf Meat", ["count"] = 1, ["q"] = 33, ["oi"] = 1, ["map"] = 1429, ["x"] = 46.0, ["y"] = 38.0 },
			{ ["t"] = 301, ["e"] = "progress", ["q"] = 33, ["oi"] = 1, ["text"] = "Tough Wolf Meat: 1/8", ["cur"] = 1, ["max"] = 8, ["type"] = "item", ["map"] = 1429, ["x"] = 46.0, ["y"] = 38.0 },
			{ ["t"] = 320, ["e"] = "kill", ["npc"] = 6, ["npcName"] = "Kobold Vermin", ["q"] = 7, ["oi"] = 1, ["map"] = 1429, ["x"] = 47.0, ["y"] = 36.0 },
			{ ["t"] = 321, ["e"] = "progress", ["q"] = 7, ["oi"] = 1, ["text"] = "Kobold Vermin slain: 3/10", ["cur"] = 3, ["max"] = 10, ["type"] = "monster", ["map"] = 1429, ["x"] = 47.0, ["y"] = 36.0 },
			{ ["t"] = 340, ["e"] = "progress", ["q"] = 33, ["oi"] = 1, ["text"] = "Tough Wolf Meat: 2/8", ["cur"] = 2, ["max"] = 8, ["type"] = "item", ["map"] = 1429, ["x"] = 46.4, ["y"] = 37.6 },
			{ ["t"] = 350, ["e"] = "level", ["lvl"] = 2, ["map"] = 1429, ["x"] = 46.4, ["y"] = 37.6 },
			{ ["t"] = 360, ["e"] = "mark", ["text"] = "Kobolds respawn fast -- pull at the \\"tunnel\\" mouth", ["map"] = 1429, ["x"] = 46.5, ["y"] = 37.5 },
			{ ["t"] = 365, ["e"] = "progress", ["q"] = 7, ["oi"] = 2, ["text"] = "Supply crates searched: 1/1", ["cur"] = 1, ["max"] = 1, ["type"] = "object", ["map"] = 1429, ["x"] = 46.9, ["y"] = 35.2 },
			{ ["t"] = 370, ["e"] = "complete", ["q"] = 7 },
			{ ["t"] = 380, ["e"] = "death", ["map"] = 1429, ["x"] = 47.1, ["y"] = 35.0 },
			{ ["t"] = 500, ["e"] = "turnin", ["q"] = 7, ["xpReward"] = 110, ["money"] = 50, ["lvl"] = 2, ["npc"] = 197, ["npcName"] = "Marshal McBride", ["map"] = 1429, ["x"] = 48.93, ["y"] = 41.61 },
			{ ["t"] = 510, ["e"] = "trainer", ["npc"] = 911, ["npcName"] = "Llane Beshere", ["map"] = 1429, ["x"] = 50.24, ["y"] = 42.28 },
			{ ["t"] = 520, ["e"] = "abandon", ["q"] = 33 },
			{ ["t"] = 1200, ["e"] = "accept", ["q"] = 62, ["title"] = "The Fargodeep Mine", ["qlvl"] = 5, ["lvl"] = 3, ["xp"] = 300, ["npc"] = 240, ["npcName"] = "Marshal Dughan", ["map"] = 1429, ["x"] = 42.1, ["y"] = 65.93 },
			{ ["t"] = 1210, ["e"] = "bind", ["location"] = "Goldshire", ["map"] = 1429, ["x"] = 43.77, ["y"] = 65.8 },
			{ ["t"] = 1220, ["e"] = "vendor", ["npc"] = 1213, ["npcName"] = "Godric Rothgar", ["map"] = 1429, ["x"] = 41.71, ["y"] = 65.55 },
			{ ["t"] = 1500, ["e"] = "zone", ["map"] = 1453, ["zone"] = "Stormwind City", ["subzone"] = "Trade District" },
			{ ["t"] = 1510, ["e"] = "fp", ["location"] = "Stormwind, Elwynn", ["npc"] = 352, ["npcName"] = "Dungar Longdrink", ["map"] = 1453, ["x"] = 66.28, ["y"] = 62.13 },
			{ ["t"] = 1520, ["e"] = "taxi", ["from"] = "Stormwind, Elwynn", ["to"] = "Sentinel Hill, Westfall" },
			${extra}
		},
	}`;
}

const UNDEAD_SESSION = `{
	["schema"] = 1, ["build"] = "1.60.1.70338", ["session"] = "${UNDEAD}",
	["char"] = { ["name"] = "Altchar", ["realm"] = "Test Realm", ["race"] = "Scourge", ["class"] = "MAGE", ["faction"] = "Horde" },
	["started"] = 1790990000, ["ended"] = 1790990100,
	["maps"] = { { ["name"] = "Durotar", ["type"] = 3, ["parent"] = 1414 } },
	["events"] = {
		{ ["t"] = 0, ["e"] = "zone", ["map"] = 1, ["zone"] = "Durotar", ["subzone"] = "" },
		{ ["t"] = 3, ["e"] = "gossip", ["npc"] = 3143, ["npcName"] = "Gornek", ["available"] = {}, ["active"] = { 4641 }, ["map"] = 1, ["x"] = 42.07, ["y"] = 68.33 },
	},
}`;

function svText({ human = humanSession(), undead = UNDEAD_SESSION } = {}) {
	const sessions = [human && `["${HUMAN}"] = ${human}`, undead && `["${UNDEAD}"] = ${undead}`].filter(Boolean).join(',\n');
	return `
PolestarRecorderDB = {
	["schema"] = 1,
	["current"] = "${HUMAN}",
	["fp"] = { ["Testchar-Test Realm"] = { ["Stormwind, Elwynn"] = true } },
	["maps"] = {
		[947] = { ["name"] = "Azeroth", ["type"] = 1, ["parent"] = 946 },
		[1415] = { ["name"] = "Eastern Kingdoms", ["type"] = 2, ["parent"] = 947, ["c"] = 0, ["top"] = 4000, ["left"] = 4000, ["bottom"] = -16000, ["right"] = -4000 },
		[1411] = { ["name"] = "Durotar", ["type"] = 3, ["parent"] = 1414 },
	},
	["sessions"] = {
${sessions}
	},
}
`;
}

// <dir>/WTF/Account/<account>/SavedVariables/Polestar_Recorder.lua
function writeSv(dir, text, account = 'TESTACCOUNT') {
	const svDir = path.join(dir, 'WTF', 'Account', account, 'SavedVariables');
	fs.mkdirSync(svDir, { recursive: true });
	const file = path.join(svDir, 'Polestar_Recorder.lua');
	fs.writeFileSync(file, text);
	return file;
}

function readJson(file) {
	return JSON.parse(fs.readFileSync(file, 'utf8'));
}

test('import normalizes each session to the recordings schema', () => {
	const dir = tmpdir('polestar-record-');
	const sv = writeSv(dir, svText());
	const out = path.join(dir, 'recordings');
	const result = importFile(sv, { outDir: out, now: new Date('2026-10-12T15:30:00Z') });
	assert.deepEqual(result.sessions.map((s) => [path.basename(s.file), s.status]), [
		[`${UNDEAD}.json`, 'new'],
		[`${HUMAN}.json`, 'new'],
	]);

	const human = readJson(path.join(out, `${HUMAN}.json`));
	assert.deepEqual(Object.keys(human), ['schema', 'build', 'session', 'char', 'started', 'ended', 'events', 'maps', 'dropped']);
	assert.equal(human.schema, 1);
	assert.equal(human.build, '1.60.1.70338');
	assert.deepEqual(human.char, { name: 'Testchar', realm: 'Test Realm', race: 'Human', class: 'WARRIOR', faction: 'Alliance' });
	assert.equal(human.started, 1791000000);
	assert.equal(human.events.length, 31);
	assert.deepEqual(human.events[1], { t: 5, e: 'gossip', active: [], available: [783], map: 1429, npc: 823, npcName: 'Deputy Willem', x: 48.17, y: 42.95 });
	assert.deepEqual(Object.keys(human.events[2]).slice(0, 2), ['t', 'e']);
	assert.equal(human.events[18].text, 'Kobolds respawn fast -- pull at the "tunnel" mouth');
	// session maps plus their parents from the /psrec maps dump; recorder bookkeeping dropped
	assert.deepEqual(Object.keys(human.maps), ['947', '1415', '1429', '1453']);
	assert.deepEqual(human.maps['1429'], { name: 'Elwynn Forest', type: 3, parent: 1415, c: 0, left: 1100, right: -4100, top: 1800, bottom: -1666.67 });
	assert.equal(human.counts, undefined);
	assert.deepEqual(human.dropped, { pos: 2 });

	const undead = readJson(path.join(out, `${UNDEAD}.json`));
	assert.deepEqual(undead.maps, { 1: { name: 'Durotar', type: 3, parent: 1414 } });
	assert.deepEqual(undead.events[1].available, []);
	assert.deepEqual(undead.events[1].active, [4641]);
	assert.equal(undead.dropped, undefined);
});

test('import archives the raw file once per distinct content, under the account name', () => {
	const dir = tmpdir('polestar-record-');
	const sv = writeSv(dir, svText(), 'MYACCOUNT');
	const out = path.join(dir, 'recordings');
	const first = importFile(sv, { outDir: out, now: new Date('2026-10-12T15:30:00Z') });
	assert.equal(first.archive.created, true);
	assert.equal(path.relative(out, first.archive.path), path.join('raw', '20261012T153000Z-MYACCOUNT.lua'));
	assert.equal(fs.readFileSync(first.archive.path, 'utf8'), fs.readFileSync(sv, 'utf8'));

	const again = importFile(sv, { outDir: out, now: new Date('2026-10-12T15:31:00Z') });
	assert.equal(again.archive.created, false);
	assert.deepEqual(again.sessions.map((s) => s.status), ['unchanged', 'unchanged']);

	fs.writeFileSync(sv, svText({ undead: null }));
	const changed = importFile(sv, { outDir: out, now: new Date('2026-10-12T15:32:00Z') });
	assert.equal(changed.archive.created, true);
	assert.deepEqual(fs.readdirSync(path.join(out, 'raw')).sort(), ['20261012T153000Z-MYACCOUNT.lua', '20261012T153200Z-MYACCOUNT.lua']);
});

test('a session already imported keeps the longer event list; sessions missing from a reset file survive', () => {
	const dir = tmpdir('polestar-record-');
	const out = path.join(dir, 'recordings');
	const sv = writeSv(dir, svText());
	importFile(sv, { outDir: out });

	// Cold-start reset: the client lost the table, the logout wrote only a new, shorter
	// copy of the human session (same key) and nothing else.
	const shortHuman = `{
		["session"] = "${HUMAN}", ["started"] = 1791000000, ["ended"] = 1791000100,
		["char"] = { ["name"] = "Testchar", ["realm"] = "Test Realm", ["race"] = "Human", ["class"] = "WARRIOR", ["faction"] = "Alliance" },
		["events"] = { { ["t"] = 0, ["e"] = "zone", ["map"] = 1429, ["zone"] = "Elwynn Forest", ["subzone"] = "Goldshire" } },
	}`;
	fs.writeFileSync(sv, svText({ human: shortHuman, undead: null }));
	const reset = importFile(sv, { outDir: out });
	assert.deepEqual(reset.sessions.map((s) => s.status), ['unchanged']);
	assert.equal(readJson(path.join(out, `${HUMAN}.json`)).events.length, 31);
	assert.equal(readJson(path.join(out, `${UNDEAD}.json`)).events.length, 2);

	// The session grew: the longer list wins.
	const longer = svText({ human: humanSession(`{ ["t"] = 1600, ["e"] = "mark", ["text"] = "landed", ["map"] = 1436, ["x"] = 56.5, ["y"] = 52.6 },`), undead: null });
	fs.writeFileSync(sv, longer);
	const grown = importFile(sv, { outDir: out });
	assert.deepEqual(grown.sessions.map((s) => s.status), ['updated']);
	const merged = readJson(path.join(out, `${HUMAN}.json`));
	assert.equal(merged.events.length, 32);
	assert.equal(merged.events[31].text, 'landed');
});

test('auto-detection prefers the launch "_forever_" client in any Wine prefix over a leftover beta', () => {
	const home = tmpdir('polestar-record-');
	// Never the machine's own native install (C:\... or /Applications/...).
	const native = { platform: 'linux' };
	const client = (prefix, name, flavor) => {
		const dir = path.join(home, ...prefix, 'drive_c', 'Program Files (x86)', 'World of Warcraft', name);
		fs.mkdirSync(dir, { recursive: true });
		fs.writeFileSync(path.join(dir, '.flavor.info'), `Product Flavor!STRING:0\n${flavor}\n`);
		return dir;
	};
	const saved = process.env.POLESTAR_WTF;
	delete process.env.POLESTAR_WTF;
	try {
		const beta = client(['Games'], '_classic_beta_', 'wow_classic_beta');
		const betaSv = writeSv(beta, svText());
		assert.deepEqual(findSavedVariables({ home, native }), [betaSv]);

		// After launch the client lives in a Faugus prefix as _forever_; the old beta WTF stays behind.
		const live = client(['Faugus', 'battlenet'], '_forever_', 'wow_forever');
		const liveSv = writeSv(live, svText({ undead: null }));
		assert.deepEqual(findSavedVariables({ home, native }), [liveSv]);

		// A _forever_ folder without a .flavor.info under the fixed install path is still found.
		const plain = path.join(home, '.wine', 'drive_c', 'Program Files (x86)', 'World of Warcraft', '_forever_');
		fs.rmSync(path.join(home, 'Faugus'), { recursive: true });
		const plainSv = writeSv(plain, svText());
		assert.deepEqual(findSavedVariables({ home, native }), [plainSv]);

		// A native install is searched too, at the injected root.
		const root = tmpdir('polestar-record-');
		const mac = path.join(root, 'Applications', 'World of Warcraft', '_forever_');
		fs.rmSync(path.join(home, '.wine'), { recursive: true });
		const macSv = writeSv(mac, svText());
		assert.deepEqual(findSavedVariables({ home, native: { platform: 'darwin', root } }), [macSv]);
	} finally {
		if (saved !== undefined) process.env.POLESTAR_WTF = saved;
	}
});

test('data build: recorded kills linked to a quest nobody knows are skipped, not fatal', () => {
	const db = {
		quests: { 7: { id: 7, title: 'Kobold Camp Cleanup', start: { npc: [], object: [], item: [] }, end: { npc: [], object: [] }, objectives: [{ type: 'kill', id: 6, count: 10, text: 'Kobold Vermin' }], source: ['era'] } },
		npcs: {}, objects: {}, items: {}, zones: {}, factions: null,
	};
	const rec = {
		schema: 1,
		events: [
			// accepted in a lost session: no accept, turnin, reward or progress event anywhere
			{ t: 1, e: 'kill', npc: 61000, npcName: 'Skyborne Raider', q: 90001, oi: 1, map: 1429, x: 40, y: 40 },
			{ t: 2, e: 'loot', item: 190001, itemName: 'Raider Insignia', q: 90002, oi: 2, map: 1429, x: 40, y: 41 },
			{ t: 3, e: 'kill', npc: 6, npcName: 'Kobold Vermin', q: 7, oi: 1, map: 1429, x: 47, y: 35 },
		],
	};
	assert.doesNotThrow(() => applyRecordings(db, [{ file: 'a.json', rec }]));
	assert.deepEqual(Object.keys(db.quests), ['7']);
	assert.equal(db.npcs[61000].name, 'Skyborne Raider');
	assert.equal(db.items[190001].name, 'Raider Insignia');
	assert.deepEqual(db.quests[7].objectives, [{ type: 'kill', id: 6, count: 10, text: 'Kobold Vermin' }]);
});

test('SavedVariables are found per account under a WTF folder; --sv wins', () => {
	const dir = tmpdir('polestar-record-');
	const a = writeSv(dir, svText(), 'ACCOUNT_A');
	const b = writeSv(dir, svText(), 'ACCOUNT_B');
	fs.mkdirSync(path.join(dir, 'WTF', 'Account', 'ACCOUNT_C', 'SavedVariables'), { recursive: true });
	assert.deepEqual(findSavedVariables({ wtf: path.join(dir, 'WTF') }), [a, b]);
	assert.deepEqual(findSavedVariables({ sv: [b] }), [b]);
	assert.deepEqual(findSavedVariables({ wtf: path.join(dir, 'nowhere') }), []);
});

// Reviewed by hand: hub steps by NPC proximity, one kill line at the centroid
// of the kill objective's progress, the abandoned quest's accept and progress
// left out, the mark as a note (" -- " defused, quotes escaped), Stormwind as
// a zone change, the flight closing the last step.
const EXPECTED_DRAFT = String.raw`guide draft/alliance/human/2026-10-03-0400
title Elwynn Forest (draft 2026-10-03)
faction Alliance
race Human
levels 1-3
zone Elwynn Forest
coords live
# drafted from recording 1791000000-Testchar: Testchar-Test Realm, Warrior

step Deputy Willem
  accept 783 "A Threat Within" npc 823 @48.2,43.0
  turnin 783 "A Threat Within" npc 197 @48.9,41.6
  accept 7 "Kobold Camp Cleanup" npc 197 @48.9,41.6

step Kobold Camp Cleanup
  kill 6 x10 quest 7.1 @47.3,35.4
  # reached level 2 @46.4,37.6
  note "Kobolds respawn fast - pull at the \"tunnel\" mouth"
  # quest 7.2 (object): no target id recorded
  goto 46.9,35.2 "Supply crates searched"
  # died @47.1,35.0

step Marshal McBride
  turnin 7 "Kobold Camp Cleanup" npc 197 @48.9,41.6
  train 911 @50.2,42.3 only Warrior
  # abandoned quest 33 Wolves Across the Border

step Marshal Dughan
  accept 62 "The Fargodeep Mine" npc 240 @42.1,65.9
  sethome "Goldshire" @43.8,65.8
  vendor 1213 @41.7,65.5

step Dungar Longdrink
  zone Stormwind City
  getfp "Stormwind, Elwynn" npc 352 @66.3,62.1
  fly "Sentinel Hill, Westfall"
`;

test('draft turns a session into a guide in the .guide DSL', () => {
	const dir = tmpdir('polestar-record-');
	const sv = writeSv(dir, svText());
	const out = path.join(dir, 'recordings');
	importFile(sv, { outDir: out });
	const session = readJson(path.join(out, `${HUMAN}.json`));
	const draft = draftGuide(session);
	assert.equal(draft.id, 'draft/alliance/human/2026-10-03-0400');
	assert.equal(draft.name, 'alliance-human-2026-10-03-0400');
	assert.equal(draft.text, EXPECTED_DRAFT);
	// Quest XP rewards change nothing in the draft.
	const withRewards = structuredClone(session);
	Object.assign(withRewards.events[2], { rewardXp: 80, rewardXpBase: 80 });
	withRewards.events.splice(7, 0, { t: 59, e: 'reward', q: 33, rewardXp: 170, rewardXpBase: 170, lvl: 1 });
	assert.equal(draftGuide(withRewards).text, EXPECTED_DRAFT);
});

test('the draft parses without diagnostics in the guide compiler', () => {
	const diag = new Diagnostics();
	const guide = parseGuide(EXPECTED_DRAFT, 'draft.guide', diag);
	assert.deepEqual(diag.list, []);
	assert.equal(guide.id, 'draft/alliance/human/2026-10-03-0400');
	assert.deepEqual(
		guide.steps.map((s) => s.goals.map((g) => g.verb)),
		[
			['accept', 'turnin', 'accept'],
			['kill', 'note', 'goto'],
			['turnin', 'train'],
			['accept', 'sethome', 'vendor'],
			['getfp', 'fly'],
		],
	);
	const kill = guide.steps[1].goals[0];
	assert.deepEqual([kill.npc, kill.count, kill.quest, kill.oi, kill.x, kill.y], [6, 10, 7, 1, 47.3, 35.4]);
	assert.deepEqual(guide.steps[4].goals[0].zone.name, 'Stormwind City');
});

test('record CLI: import then draft, refusing to overwrite an edited draft', () => {
	const dir = tmpdir('polestar-record-');
	const sv = writeSv(dir, svText());
	const out = path.join(dir, 'recordings');
	const drafts = path.join(dir, 'drafts');
	const run = (...args) => spawnSync(process.execPath, [CLI, 'record', ...args], { encoding: 'utf8' });

	const imported = run('import', '--wtf', path.join(dir, 'WTF'), '--out', out);
	assert.equal(imported.status, 0, imported.stderr);
	assert.match(imported.stdout, /TESTACCOUNT: 2 session\(s\) — 2 new/);

	const listed = run('list', '--out', out);
	assert.match(listed.stdout, new RegExp(`${HUMAN}.*31 events.*Testchar Human WARRIOR Alliance`));

	const drafted = run('draft', HUMAN, '--recordings', out, '--out', drafts);
	assert.equal(drafted.status, 0, drafted.stderr);
	const file = path.join(drafts, 'alliance-human-2026-10-03-0400.guide');
	assert.equal(fs.readFileSync(file, 'utf8'), EXPECTED_DRAFT);

	fs.writeFileSync(file, 'edited by hand\n');
	const again = run('draft', path.join(out, `${HUMAN}.json`), '--out', drafts);
	assert.equal(again.status, 1);
	assert.equal(fs.readFileSync(file, 'utf8'), 'edited by hand\n');
	assert.equal(run('draft', HUMAN, '--recordings', out, '--out', drafts, '--force').status, 0);
	assert.equal(fs.readFileSync(file, 'utf8'), EXPECTED_DRAFT);

	const missing = run('import', '--wtf', path.join(dir, 'empty'));
	assert.equal(missing.status, 1);
	assert.match(missing.stderr, /no Polestar_Recorder SavedVariables found/);
});

test('watch re-imports when the client rewrites the file and reports sessions that vanished', async () => {
	const dir = tmpdir('polestar-record-');
	const out = path.join(dir, 'recordings');
	const sv = writeSv(dir, svText());
	const seen = [];
	let notify;
	const watcher = watchSavedVariables([sv], {
		outDir: out,
		interval: 25,
		debounce: 25,
		onImport: (result, missing) => {
			seen.push({ keys: result.keys, missing });
			if (notify) notify();
		},
		onError: (err) => {
			throw err;
		},
	});
	try {
		assert.deepEqual(seen, [{ keys: [UNDEAD, HUMAN], missing: [] }]);
		const next = new Promise((resolve, reject) => {
			const timer = setTimeout(() => reject(new Error('watch did not re-import within 5 s')), 5000);
			notify = () => {
				clearTimeout(timer);
				resolve();
			};
		});
		// Make sure the mtime moves even on coarse-timestamp filesystems.
		fs.writeFileSync(sv, svText({ undead: null }));
		const later = new Date(Date.now() + 5000);
		fs.utimesSync(sv, later, later);
		await next;
		assert.deepEqual(seen[1], { keys: [HUMAN], missing: [UNDEAD] });
		assert.ok(fs.existsSync(path.join(out, `${UNDEAD}.json`)));
	} finally {
		watcher.close();
	}
});

test('quest XP reward fields pass through import unchanged', () => {
	const dir = tmpdir('polestar-record-');
	const extra = `{ ["t"] = 1530, ["e"] = "reward", ["q"] = 62, ["rewardXp"] = 450, ["rewardXpBase"] = 420, ["lvl"] = 3 },`;
	const human = humanSession(extra).replace('["xp"] = 300,', '["xp"] = 300, ["rewardXp"] = 450, ["rewardXpBase"] = 420,');
	const sv = writeSv(dir, svText({ human, undead: null }));
	importFile(sv, { outDir: path.join(dir, 'recordings') });
	const s = readJson(path.join(dir, 'recordings', `${HUMAN}.json`));
	const accept = s.events.find((e) => e.e === 'accept' && e.q === 62);
	assert.equal(accept.rewardXp, 450);
	assert.equal(accept.rewardXpBase, 420);
	assert.deepEqual(s.events[s.events.length - 1], { t: 1530, e: 'reward', lvl: 3, q: 62, rewardXp: 450, rewardXpBase: 420 });
});

function progressSession({ events = 'full', factionsAt = 1791000500, standing = 5 } = {}) {
	const list = [
		`{ ["t"] = 10, ["e"] = "rep", ["faction"] = 72, ["factionName"] = "Stormwind", ["standing"] = 5, ["value"] = 3350, ["delta"] = 250, ["map"] = 1429, ["x"] = 40, ["y"] = 60 }`,
		`{ ["t"] = 20, ["e"] = "skill", ["skill"] = "Mining", ["skillLine"] = 186, ["rank"] = 41, ["max"] = 75, ["map"] = 1429, ["x"] = 40, ["y"] = 60 }`,
		`{ ["t"] = 30, ["e"] = "explore", ["area"] = "Goldshire", ["areaID"] = 87, ["xp"] = 40, ["map"] = 1429, ["x"] = 42, ["y"] = 65 }`,
		`{ ["t"] = 40, ["e"] = "craft", ["spell"] = 2660, ["item"] = 2862, ["count"] = 2, ["skill"] = 164 }`,
		`{ ["t"] = 50, ["e"] = "learn", ["spell"] = 133, ["name"] = "Fireball" }`,
		`{ ["t"] = 60, ["e"] = "achieve", ["id"] = 6, ["name"] = "Level 10" }`,
	];
	return `{
		["session"] = "${HUMAN}", ["started"] = 1791000000, ["ended"] = 1791001000,
		["char"] = { ["name"] = "Testchar", ["realm"] = "Test Realm", ["race"] = "Human", ["class"] = "WARRIOR", ["faction"] = "Alliance" },
		["events"] = { ${(events === 'full' ? list : list.slice(0, 1)).join(',\n')} },
		["rewards"] = { [7] = true }, ["explored"] = { [87] = true }, ["learned"] = { [133] = true },
		["dumped"] = { ["factions"] = ${factionsAt}, ["legacy"] = 1791000600 },
		["factions"] = {
			[469] = { ["name"] = "Alliance", ["order"] = 1, ["header"] = true },
			[72] = { ["name"] = "Stormwind", ["order"] = 2, ["parent"] = 469, ["standing"] = ${standing}, ["value"] = 3350, ["min"] = 3000, ["max"] = 9000 },
		},
		["legacy"] = {
			["rewardFaction"] = 2802, ["pointsCurrency"] = 4225,
			["categories"] = { [92] = { ["name"] = "General", ["order"] = 1, ["legacy"] = true, ["achievements"] = { 6 } } },
			["achievements"] = { [6] = { ["name"] = "Level 10", ["points"] = 10, ["completed"] = true, ["legacyPoints"] = 5, ["legacy"] = true, ["category"] = 92, ["criteria"] = {} } },
			["majorFactions"] = { [2802] = { ["name"] = "Legacy", ["level"] = 3, ["legacy"] = true, ["levels"] = {} } },
			["trees"] = { { ["id"] = 1187, ["key"] = "professions", ["groups"] = {}, ["nodes"] = {} } },
		},
	}`;
}

test('progress events and the factions/skills/legacy dumps pass through import; per-session bookkeeping does not', () => {
	const dir = tmpdir('polestar-record-');
	const out = path.join(dir, 'recordings');
	const sv = writeSv(dir, svText({ human: progressSession(), undead: null }));
	importFile(sv, { outDir: out });
	const s = readJson(path.join(out, `${HUMAN}.json`));
	assert.deepEqual(s.events.map((e) => e.e), ['rep', 'skill', 'explore', 'craft', 'learn', 'achieve']);
	assert.deepEqual(s.events[0], { t: 10, e: 'rep', delta: 250, faction: 72, factionName: 'Stormwind', map: 1429, standing: 5, value: 3350, x: 40, y: 60 });
	assert.deepEqual(s.events[3], { t: 40, e: 'craft', count: 2, item: 2862, skill: 164, spell: 2660 });
	assert.deepEqual(s.factions, {
		72: { name: 'Stormwind', order: 2, parent: 469, standing: 5, value: 3350, min: 3000, max: 9000 },
		469: { name: 'Alliance', order: 1, header: true },
	});
	assert.deepEqual(s.legacy.categories, { 92: { name: 'General', order: 1, legacy: true, achievements: [6] } });
	assert.deepEqual(s.legacy.achievements['6'].criteria, []);
	assert.deepEqual(s.legacy.majorFactions['2802'].levels, []);
	assert.deepEqual(s.legacy.trees, [{ id: 1187, key: 'professions', groups: [], nodes: [] }]);
	assert.deepEqual(s.dumped, { factions: 1791000500, legacy: 1791000600 });
	assert.equal(s.skills, undefined);
	for (const k of ['rewards', 'explored', 'learned']) assert.equal(s[k], undefined);

	// A shorter copy of the session with a newer faction dump: the events
	// stay the longer list, the factions become the newer dump.
	fs.writeFileSync(sv, svText({ human: progressSession({ events: 'short', factionsAt: 1791000900, standing: 6 }), undead: null }));
	importFile(sv, { outDir: out });
	const merged = readJson(path.join(out, `${HUMAN}.json`));
	assert.equal(merged.events.length, 6);
	assert.equal(merged.factions['72'].standing, 6);
	assert.equal(merged.dumped.factions, 1791000900);
	assert.equal(merged.dumped.legacy, 1791000600);
});

test('normalizing tolerates a session written by an older or damaged recorder', () => {
	const s = normalizeSession('k', { events: { 1: { e: 'mark', text: 'a' }, 3: { t: 9, e: 'mark', text: 'b' }, 4: 'junk' } });
	assert.deepEqual(s.events, [{ t: 0, e: 'mark', text: 'a' }, { t: 9, e: 'mark', text: 'b' }]);
	assert.equal(s.session, 'k');
	assert.deepEqual(s.char, { name: null, realm: null, race: null, class: null, faction: null });
	assert.deepEqual(s.maps, {});
});

test('record draft inside a guide pack writes a pack-prefixed draft into <pack>/drafts/', () => {
	const dir = tmpdir('polestar-record-');
	const out = path.join(dir, 'recordings');
	importFile(writeSv(dir, svText()), { outDir: out });
	const session = readJson(path.join(out, `${HUMAN}.json`));
	assert.equal(draftGuide(session, { pack: 'joe' }).id, 'joe/draft/alliance/human/2026-10-03-0400');
	assert.equal(draftGuide(session, { pack: 'guides' }).id, 'draft/alliance/human/2026-10-03-0400');

	const pack = tmpdir('polestar-pack-');
	fs.cpSync(path.join(__dirname, 'fixtures', 'packs', 'joe'), pack, { recursive: true });
	const r = spawnSync(process.execPath, [CLI, 'record', 'draft', HUMAN, '--recordings', out], { cwd: path.join(pack, 'guides'), encoding: 'utf8' });
	assert.equal(r.status, 0, r.stderr);
	const file = path.join(pack, 'drafts', 'alliance-human-2026-10-03-0400.guide');
	const text = fs.readFileSync(file, 'utf8');
	assert.equal(text, EXPECTED_DRAFT.replace('guide draft/', 'guide joe/draft/'));
	assert.match(r.stdout, /joe\/draft\/alliance\/human\/2026-10-03-0400/);
	// --pack names the pack from anywhere.
	const other = tmpdir('polestar-pack-');
	fs.cpSync(path.join(__dirname, 'fixtures', 'packs', 'mini'), other, { recursive: true });
	const r2 = spawnSync(process.execPath, [CLI, 'record', 'draft', HUMAN, '--recordings', out, '--pack', other], { encoding: 'utf8' });
	assert.equal(r2.status, 0, r2.stderr);
	assert.match(fs.readFileSync(path.join(other, 'drafts', 'alliance-human-2026-10-03-0400.guide'), 'utf8'), /^guide mini\/draft\/alliance\/human\/2026-10-03-0400$/m);
});
