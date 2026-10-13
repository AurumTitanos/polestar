'use strict';
// The DungeonJournal importer (tools/lib/data/dungeonjournal.js) on a
// synthetic DungeonJournal (tests/fixtures/dungeonjournal) and the DSL fixture data.

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const dj = require('../tools/lib/data/dungeonjournal');
const { loadData } = require('../tools/lib/dsl/data');
const { tmpdir, DATA_DIR } = require('./fixtures/dsl/helpers');

const DJ_DIR = path.join(__dirname, 'fixtures', 'dungeonjournal', 'ForeverDungeonJournal');

function build() {
	const raw = dj.loadDungeonJournal(DJ_DIR);
	const data = loadData(DATA_DIR);
	return { raw, data, ...dj.buildDungeons(raw, data, { toc: dj.readToc(DJ_DIR) }) };
}

// The fixture data plus a dungeons.json, as `dungeons build` compiles the guides.
function dataWith(dataset) {
	const dir = tmpdir();
	for (const f of fs.readdirSync(DATA_DIR)) fs.copyFileSync(path.join(DATA_DIR, f), path.join(dir, f));
	fs.writeFileSync(path.join(dir, 'dungeons.json'), JSON.stringify(dataset));
	return loadData(dir);
}

test('the data files load through the sandbox with the addon name and namespace, the way the client runs them', () => {
	const { raw } = build();
	assert.deepEqual(raw.ORDER, ['The Test Mine']);
	assert.equal(raw.FOREVER_QUEST_XP_FALLBACK['990002'], 900, 'QuestUpdates.lua patches the tables earlier files made');
	assert.equal(raw.QUEST_SHAREABILITY_AUDIT['990001'], true, 'files that use the global table see the same namespace');
	assert.deepEqual(dj.readToc(DJ_DIR), { interface: '16001', title: 'DungeonJournal', author: 'Fixture', version: '0.0.1' });
	assert.equal(dj.findDungeonJournal({ source: DJ_DIR }), DJ_DIR);
	assert.equal(dj.findDungeonJournal({ source: path.join(DJ_DIR, 'missing') }), null);
});

test('dungeons: levels, live-frame entrance, bosses in kill order without trash, with levels and loot', () => {
	const { dataset } = build();
	assert.equal(dataset.source.name, 'DungeonJournal');
	assert.equal(dataset.source.version, '0.0.1');
	const [d] = dataset.dungeons;
	assert.equal(d.key, 'test-mine');
	assert.deepEqual(d.levels, { min: 5, max: 10 });
	assert.deepEqual(d.entrance, { map: 1429, x: 50, y: 50, f: 'l' });
	assert.equal(d.zoneName, 'Elwynn Forest');
	assert.deepEqual(d.factions, ['Alliance', 'Horde']);
	assert.deepEqual(
		d.bosses.map((b) => [b.name, b.npc, b.level, b.rare]),
		[
			['Gnasher', 990100, 7, false],
			['Tunnel Rat', null, null, true],
			['Foreman Grub', 990101, { min: 9, max: 10 }, false],
		],
	);
	assert.deepEqual(d.bosses[0].loot, [{ item: 990030, name: "Gnasher's Tooth", slot: 'Neck', quality: 2 }]);
});

test('quests: positions by precedence (data, DungeonJournal maps, the entrance for givers inside), rewards, XP and money', () => {
	const { dataset, report } = build();
	const q = Object.fromEntries(dataset.dungeons[0].quests.map((x) => [x.id, x]));
	// Our data wins: the quest's giver with spawns.
	assert.deepEqual(q[7].start, { map: 1429, x: 48.92, y: 41.61, f: 'e', source: 'data', kind: 'npc', id: 197, name: 'Marshal McBride' });
	assert.equal(q[7].xp, 250);
	assert.equal(q[7].xpSource, 'data');
	assert.equal(q[7].money, 150);
	assert.deepEqual(q[7].rewards, { items: [], choices: [{ item: 159, name: 'Refreshing Spring Water', quality: 1 }, { item: 750, name: 'Tough Wolf Meat', quality: 2 }] });
	// Our data's prerequisite joins DungeonJournal's chain.
	assert.deepEqual(q[7].chain, [783]);
	// A giver inside stands at the entrance.
	assert.equal(q[990001].start.source, 'entrance');
	assert.equal(q[990001].start.inDungeon, true);
	assert.equal(q[990001].faction, null, '"Both" is either faction');
	assert.equal(q[990001].xp, 1100, 'the observed Forever XP');
	assert.equal(q[990001].money, 700);
	assert.deepEqual(q[990001].bosses, ['Foreman Grub'], 'linked to the boss its objective names');
	// A start item from a boss's loot.
	assert.equal(q[990002].startBoss, 'Foreman Grub');
	assert.deepEqual(q[990002].startItem, { item: 990020, name: 'Rusty Pick' });
	// DungeonJournal's map for a named NPC, reused for another quest's turn-in.
	assert.deepEqual(q[990002].end, { map: 1429, x: 42, y: 65, f: 'l', source: 'dj', kind: 'npc', name: 'Old Miner' });
	assert.deepEqual(q[990003].chain, [783], 'the quest itself is not part of its chain');
	assert.equal(q[990005].hidden, true);
	assert.deepEqual(report.unresolved, []);
	assert.equal(report.coverage.data + report.coverage.dj + report.coverage.entrance, 14);
});

test('money and NPC names read from reward and giver text', () => {
	assert.equal(dj.parseMoney('1g 50s  •  Ironforge +100'), 15000);
	assert.equal(dj.parseMoney('Choose: A or B\n3,570 XP • 7s • Gadgetzan +100'), 700);
	assert.equal(dj.parseMoney('Ironforge +100'), null);
	assert.equal(dj.npcNameOf('Nalpak, above the entrance to Wailing Caverns, The Barrens'), 'Nalpak');
	assert.equal(dj.npcNameOf('Item start: Abominable Head, inside Ruins of Lordaeron'), null);
	assert.equal(dj.saysInside('Captain Truman, just inside Ruins of Lordaeron', 'Ruins of Lordaeron'), true);
	assert.equal(dj.saysInside('Vorrel Sengutz, inside the Graveyard', 'Scarlet Monastery: Graveyard'), true);
	assert.equal(dj.saysInside('Thrall, Valley of Wisdom, Orgrimmar', 'Ragefire Chasm'), false);
});

test('dungeons.json fills quests.json gaps for the compiler, never overrides it, and rebuilds ignore its own copies', () => {
	const { dataset } = build();
	const data = dataWith(dataset);
	assert.equal(data.quest(990001).title, 'A Ghostly Errand');
	assert.deepEqual(data.quest(990001).source, ['dungeonjournal']);
	assert.equal(data.quest(7).source[0], 'fixture', 'quests.json wins');
	// Rebuilding with that data gives the same dataset.
	const again = dj.buildDungeons(dj.loadDungeonJournal(DJ_DIR), data, { toc: dj.readToc(DJ_DIR) }).dataset;
	assert.deepEqual(again, dataset);
});
