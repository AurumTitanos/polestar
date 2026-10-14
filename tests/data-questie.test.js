'use strict';
// QuestieDB Forever import (tools/lib/data/questie.js, questie-merge.js):
// the baked-store decoder on a synthetic store encoded here (CBOR, zlib,
// base64, chunked values, presence masks, defaults), merge precedence
// (recordings > questie-forever > pfQuest) and map-frame tagging, on top of
// the tests/fixtures/data pfQuest and wago fixtures.

const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const zlib = require('node:zlib');

const { decodeCbor, storedValue, readQuestie, dropRate, questieDbDir } = require('../tools/lib/data/questie');
const { raceMask } = require('../tools/lib/data/questie-merge');
const { buildData } = require('../tools/lib/data/build');
const { tmpdir } = require('./helpers/tmp');

const FIX = path.join(__dirname, 'fixtures', 'data');

// --- a minimal CBOR encoder (the shapes C_EncodingUtil.SerializeCBOR emits) ---

function head(major, n) {
	if (n < 24) return Buffer.from([(major << 5) | n]);
	if (n < 256) return Buffer.from([(major << 5) | 24, n]);
	if (n < 65536) {
		const b = Buffer.alloc(3);
		b[0] = (major << 5) | 25;
		b.writeUInt16BE(n, 1);
		return b;
	}
	if (n < 2 ** 32) {
		const b = Buffer.alloc(5);
		b[0] = (major << 5) | 26;
		b.writeUInt32BE(n, 1);
		return b;
	}
	const b = Buffer.alloc(9);
	b[0] = (major << 5) | 27;
	b.writeBigUInt64BE(BigInt(n), 1);
	return b;
}

function cbor(v) {
	if (v === null) return Buffer.from([0xf6]);
	if (v === true) return Buffer.from([0xf5]);
	if (v === false) return Buffer.from([0xf4]);
	if (typeof v === 'number') {
		if (Number.isInteger(v)) return v >= 0 ? head(0, v) : head(1, -1 - v);
		const b = Buffer.alloc(9);
		b[0] = 0xfb;
		b.writeDoubleBE(v, 1);
		return b;
	}
	if (typeof v === 'string') {
		const s = Buffer.from(v, 'utf8');
		return Buffer.concat([head(3, s.length), s]);
	}
	if (Array.isArray(v)) return Buffer.concat([head(4, v.length), ...v.map(cbor)]);
	if (v instanceof Map) {
		const parts = [head(5, v.size)];
		for (const [k, x] of v) parts.push(cbor(k), cbor(x));
		return Buffer.concat(parts);
	}
	// Plain objects: integer-looking keys become integer keys, as in Lua.
	return cbor(new Map(Object.entries(v).map(([k, x]) => [/^-?\d+$/.test(k) ? Number(k) : k, x])));
}

const b64 = (buf) => buf.toString('base64');

// --- a synthetic QuestieDB install -------------------------------------------

// Field layouts (synthetic indices: the decoder reads them from the meta files).
const METAS = {
	Quest: [
		['name', 'string'], ['startedBy', 'table', 'questgivers'], ['finishedBy', 'table', 'questgivers'],
		['requiredLevel', 'number'], ['questLevel', 'number'], ['requiredRaces', 'number'],
		['objectivesText', 'table', 'stringarray'], ['objectives', 'table', 'objectives'], ['preQuestSingle', 'table', 'idarray'],
		['preQuestGroup', 'table', 'idarray'], ['exclusiveTo', 'table', 'idarray'], ['nextQuestInChain', 'number'],
		['breadcrumbs', 'table', 'idarray'], ['triggerEnd', 'table', 'trigger'], ['zoneOrSort', 'number'],
		['requiredClasses', 'number'], ['retired', 'number', null, 7], ['breadcrumbForQuestId', 'number'],
		['parentQuest', 'number'], ['childQuests', 'table', 'idarray'],
	],
	Npc: [
		['name', 'string'], ['minLevel', 'number'], ['maxLevel', 'number'], ['spawns', 'table', 'spawnlist'],
		['friendlyToFaction', 'string'], ['npcFlags', 'number'], ['questStarts', 'table', 'idarray'], ['rank', 'number'],
		['minLevelHealth', 'number', null, 0],
	],
	Object: [['name', 'string'], ['spawns', 'table', 'spawnlist'], ['questStarts', 'table', 'idarray'], ['questEnds', 'table', 'idarray']],
	Item: [['name', 'string'], ['npcDrops', 'table', 'idarray'], ['objectDrops', 'table', 'idarray'], ['vendors', 'table', 'idarray']],
};
const META_FILE = { Quest: 'questMeta.lua', Npc: 'npcMeta.lua', Object: 'objectMeta.lua', Item: 'itemMeta.lua' };

function metaLua(entity) {
	const f = METAS[entity];
	const list = (pick) => f.map((x, i) => (pick(x) === null || pick(x) === undefined ? null : `[${i + 1}]=${typeof pick(x) === 'number' ? pick(x) : `'${pick(x)}'`}`)).filter(Boolean).join(', ');
	return `local _, LibQuestieDB = ...
local meta = {
  entity = '${entity}', metaPrefix = '${entity}-', fieldCount = ${f.length},
  names = { ${list((x) => x[0])} },
  types = { ${list((x) => x[1])} },
  structures = { ${list((x) => x[2])} },
  constantValues = { ${list((x) => x[3])} },
}
return meta
`;
}

// records: { id: { fieldName: value } } -> TOC lines. opts.chunk: ids whose
// scalar row is split into a two-part chunked value; opts.hidden: [id, field]
// table values stored without their presence bit.
function storeLines(entity, records, opts = {}) {
	const fields = METAS[entity];
	const lines = [];
	const ids = Object.keys(records).map(Number).sort((a, b) => a - b);
	const encIds = b64(zlib.deflateSync(cbor(ids)));
	lines.push(`## X-${entity}-IDS: ~2~`, `## X-${entity}-IDS-1: ${encIds.slice(0, 10)}`, `## X-${entity}-IDS-2: ${encIds.slice(10)}`);
	for (const id of ids) {
		const row = new Map();
		let p = 0;
		fields.forEach(([name, type, , constant], i) => {
			const v = records[id][name];
			if (v === undefined || constant !== undefined) return;
			if (type === 'table') {
				p += 2 ** i;
				lines.push(`## X-${entity}-${id}-${i + 1}: ${b64(cbor(v))}`);
			} else {
				row.set(i + 1, v);
			}
		});
		row.set('p', p);
		const s = b64(cbor(row));
		if ((opts.chunk || []).includes(id)) {
			lines.push(`## X-${entity}-${id}-S: ~2~`, `## X-${entity}-${id}-S-1: ${s.slice(0, 7)}`, `## X-${entity}-${id}-S-2: ${s.slice(7)}`);
		} else {
			lines.push(`## X-${entity}-${id}-S: ${s}`);
		}
	}
	for (const [id, name, v] of opts.hidden || []) {
		const i = fields.findIndex((f) => f[0] === name);
		lines.push(`## X-${entity}-${id}-${i + 1}: ${b64(cbor(v))}`);
	}
	return lines;
}

const QUESTS = {
	100: { name: 'Fixture Calling (Questie)', questLevel: 3, requiredLevel: 1, startedBy: [[1]], finishedBy: [[2]], objectivesText: ['Speak with Alice.'] },
	101: {
		name: 'Wolf Trouble', questLevel: 3, requiredLevel: 2, requiredRaces: 77, requiredClasses: 1,
		startedBy: [[2]], finishedBy: [[2]],
		objectivesText: ['Bring 3 pieces of Wolf Pelt, and kill 10 Fixture Wolves and 4 Fixture Wolf Alphas for Alice.'],
		objectives: [[{ 1: 3, 3: 0 }, { 1: 4, 3: 0 }], [], [{ 1: 50, 3: 0 }]],
		preQuestSingle: [100], exclusiveTo: [102, 105], breadcrumbs: [103], childQuests: [104],
	},
	102: { name: 'Fixture Altar', questLevel: 4, requiredLevel: 2, startedBy: [[], [500]], finishedBy: [[], [500]], preQuestSingle: [101, 102, 100] },
	// Sparse questgivers (object slot only) and an ender known only from the object's questEnds.
	92461: { name: 'The Missing Scholar', questLevel: 5, requiredLevel: 2, startedBy: { 2: [700] } },
	92460: {
		name: 'Coming of Age', questLevel: 1, requiredLevel: 1, requiredRaces: 2 ** 32 + 2 ** 33,
		startedBy: [[251362]], finishedBy: [[251361]], objectivesText: ['Find the shrine.', '', 'Return to Rorian.'],
		preQuestGroup: [100], zoneOrSort: 16593, triggerEnd: ['Find the shrine', { 16593: [[40.5, 60.25]] }],
		breadcrumbForQuestId: 92461, parentQuest: 100, retired: 99,
	},
};
const NPCS = {
	1: { name: 'Bob', minLevel: 20, maxLevel: 20, spawns: { 12: [[48.9, 41.6]] }, friendlyToFaction: 'A', npcFlags: 10 },
	2: { name: 'Alice', minLevel: 5, maxLevel: 6, rank: 1, spawns: { 12: [[42.1, 65.9]], 1519: [[60, 60]] }, friendlyToFaction: 'AH', npcFlags: 6, questStarts: [101] },
	3: { name: 'Fixture Wolf', minLevel: 2, maxLevel: 3, spawns: { 12: [[21, 31]] }, friendlyToFaction: 'AH', npcFlags: 0 },
	251361: { name: 'Rorian the Dayseeker', minLevel: 1, maxLevel: 1, spawns: { 16593: [[44, 25]] }, friendlyToFaction: 'AH', npcFlags: 2 },
	251362: { name: 'Ailee Farheart', minLevel: 1, maxLevel: 1, spawns: { 16593: [[42.82, 23.37], [-1, -1]] }, friendlyToFaction: 'AH', npcFlags: 2, questStarts: [92460] },
};
const OBJECTS = { 500: { name: 'Fixture Altar', spawns: { 12: [[30.12, 40.99]] } }, 700: { name: 'Bloodstained Satchel', spawns: { 16593: [[53.25, 72.17]] }, questStarts: [92461], questEnds: [92461] }, 600: { name: 'Peacebloom', spawns: { 1519: [[10, 10]] } } };
const ITEMS = {
	50: { name: 'Wolf Pelt', npcDrops: [3, 4] },
	// QuestieDB lists fewer vendors than pfQuest (16042 Schematic: Thorium Widget shape).
	52: { name: 'Fixture Schematic', vendors: [2] },
	252665: { name: "Head of Urs'anah", npcDrops: [251361] },
};

// store: { quests (added to QUESTS), files ({ path in QuestieDB: text }) }
function writeQuestie(dir, store = {}) {
	const q = path.join(dir, 'QuestieDB');
	const w = (rel, text) => {
		fs.mkdirSync(path.dirname(path.join(q, rel)), { recursive: true });
		fs.writeFileSync(path.join(q, rel), text);
	};
	const toc = [
		'## Interface: 16001', '## Title: QuestieDB', '## Author: Fixture Authors', '## Version: 9.9.9',
		'## X-Contract-Version: 3', '## X-Flavor: Forever', '## X-Mode: baked', '## X-BUILD-COMMIT: abc123', '## X-BUILD-TIME: 2026-01-01T00:00:00Z', '',
		...storeLines('Quest', { ...QUESTS, ...(store.quests || {}) }, { chunk: [92460], hidden: [[92460, 'breadcrumbs', [7]]] }),
		...storeLines('Npc', NPCS),
		...storeLines('Object', OBJECTS),
		...storeLines('Item', ITEMS),
		'', 'src\\config.lua', '',
	];
	w('QuestieDB_Forever.toc', toc.join('\r\n'));
	for (const e of Object.keys(METAS)) w(`src/meta/${META_FILE[e]}`, metaLua(e));
	w('support/Forever/QuestXP/xpDB-classic.lua', 'local QuestXP = QuestieLoader:ImportModule("QuestXP");\nQuestXP.db = {\n  [100] = {1, 85},\n  [101] = {3, 170},\n  [92460] = {1, 40},\n}\n');
	w(
		'support/Forever/DropTables/classicItemDrops.lua',
		'local D = QuestieLoader:CreateModule("QuestieClassicItemDrops")\nD.wowheadData = [[return {\n  [50] = { [3] = 12.5, [4] = 20 },\n}]]\nD.cmangosData = [[return {\n  [50] = { [4] = 70.0 },\n}]]\n',
	);
	w(
		'support/Forever/DropTables/itemDropCorrections.lua',
		'local DropDB = QuestieLoader:ImportModule("DropDB")\nlocal K = DropDB.correctionKeys\nlocal C = QuestieLoader:CreateModule("QuestieItemDropCorrections")\nC.Era = {\n  [50] = { [3] = K.PSERVER },\n  [252665] = { [251361] = 100 },\n}\n',
	);
	w('support/Forever/Zones/areaIdToUiMapId.lua', 'local ZoneDB = QuestieLoader:ImportModule("ZoneDB")\nZoneDB.private.areaIdToUiMapIdOverride = [[return { [0] = 0 }]]\nZoneDB.private.areaIdToUiMapId = [[return {\n  [12] = 1429, [87] = 1429, [1519] = 1453, [16593] = 2521,\n}]]\n');
	w('support/Forever/Zones/uiMapIdToAreaId.lua', 'local ZoneDB = QuestieLoader:ImportModule("ZoneDB")\nZoneDB.private.uiMapIdToAreaId = [[return {\n  [1429] = 12, [1453] = 1519, [2521] = 16593,\n}]]\n');
	w(
		'src/support/eraToForever.lua',
		'-- DBC bounds: 1.15.9.1 -> 1.60.1.2. Assumes unchanged world positions.\nlocal transforms = {\n  [1519] = { 0.77, 19.68, 0.77, 24.43 }, -- Stormwind City\n}\nlocal uiMapToArea = {\n  [1453] = 1519, -- Stormwind City\n}\n',
	);
	w('../Questie/Questie_Camelot.toc', '## Title: Questie\n## Version: 8.8.8\n## Author: Fixture Questie Authors\n## X-BUILD-COMMIT: def456\n');
	for (const [rel, text] of Object.entries(store.files || {})) w(rel, text);
	return q;
}

async function build(extra = {}, store = {}) {
	const root = tmpdir('polestar-questie-');
	const questieDir = writeQuestie(root, store);
	const outDir = path.join(root, 'out');
	const result = await buildData({
		offline: true,
		pfquestDir: path.join(FIX, 'pfquest'),
		sourcesDir: path.join(FIX, 'sources'),
		recordingsDir: path.join(root, 'no-recordings'),
		questieDir,
		outDir,
		builtAt: '2026-01-01T00:00:00Z',
		...extra,
	});
	const read = (name) => JSON.parse(fs.readFileSync(path.join(outDir, `${name}.json`), 'utf8'));
	return { result, read, questieDir, root };
}

// --- tests --------------------------------------------------------------------

describe('QuestieDB decoder', () => {
	test('CBOR round trip: integers past 2^32, floats, UTF-8, arrays and Lua-style maps', () => {
		const values = [
			0, 23, 24, 255, 65535, 65536, 2 ** 32 - 1, 2 ** 32 + 2 ** 33, -1, -500, 1.5, -48.92, "Urs'anah ü", '',
			[1, [2, [3]], 'x'], true, false,
		];
		for (const v of values) assert.deepEqual(decodeCbor(cbor(v)), v);
		// Map keys 1..n read back as a list; anything else as a string-keyed object.
		assert.deepEqual(decodeCbor(cbor(new Map([[1, 'a'], [2, 'b']]))), ['a', 'b']);
		assert.deepEqual(decodeCbor(cbor(new Map([[1, 182], [3, 0]]))), { 1: 182, 3: 0 });
		assert.deepEqual(decodeCbor(cbor(new Map([[16593, [[40.5, 60.25]]], ['p', 6]]))), { 16593: [[40.5, 60.25]], p: 6 });
		// Half and single floats, byte strings, tags, indefinite arrays, null entries.
		assert.equal(decodeCbor(Buffer.from([0xf9, 0x3e, 0x00])), 1.5);
		assert.equal(decodeCbor(Buffer.from([0xfa, 0x3f, 0xc0, 0x00, 0x00])), 1.5);
		assert.equal(decodeCbor(Buffer.from([0x43, 0x41, 0x42, 0x43])), 'ABC');
		assert.equal(decodeCbor(Buffer.from([0xc1, 0x05])), 5);
		assert.deepEqual(decodeCbor(Buffer.from([0x9f, 0x01, 0x02, 0xff])), [1, 2]);
		assert.deepEqual(decodeCbor(Buffer.from([0x83, 0x01, 0xf6, 0x03])), { 1: 1, 3: 3 }, 'a nil hole breaks the list, as in Lua');
		assert.throws(() => decodeCbor(Buffer.from([0x01, 0x02])), /trailing/);
		assert.throws(() => decodeCbor(Buffer.from([0x82, 0x01])), /truncated/);
	});

	test('chunked values reassemble; a missing part is corruption', () => {
		const m = new Map([['K', '~2~'], ['K-1', 'ab'], ['K-2', 'cd'], ['L', 'plain'], ['M', '~3~'], ['M-1', 'x']]);
		assert.equal(storedValue(m, 'K'), 'abcd');
		assert.equal(storedValue(m, 'L'), 'plain');
		assert.equal(storedValue(m, 'nope'), null);
		assert.throws(() => storedValue(m, 'M'), /declares 3 parts but part 2 is missing/);
	});

	test('reads every entity with defaults, presence masks and constants', () => {
		const dir = writeQuestie(tmpdir('polestar-questie-'));
		assert.equal(questieDbDir(path.dirname(dir)), dir, 'an AddOns folder resolves to its QuestieDB');
		const qz = readQuestie(dir);
		assert.deepEqual([...qz.quests.keys()], [100, 101, 102, 92460, 92461]);
		assert.deepEqual(qz.quests.get(92461).startedBy, { 2: [700] }, 'sparse questgivers decode as a Lua table with a hole');
		const q = qz.quests.get(92460);
		assert.equal(q.name, 'Coming of Age', 'chunked scalar row');
		assert.equal(q.requiredRaces, 2 ** 32 + 2 ** 33);
		assert.deepEqual(q.startedBy, [[251362]]);
		assert.deepEqual(q.triggerEnd, ['Find the shrine', { 16593: [[40.5, 60.25]] }]);
		assert.equal(q.breadcrumbs, undefined, 'a stored table without its presence bit is not read');
		assert.equal(q.retired, 7, 'constant fields read back as the schema constant');
		assert.equal(q.nextQuestInChain, 0, 'absent numbers read back as 0');
		assert.deepEqual(qz.quests.get(100).objectives, [], 'objectives (never-nil structure) default to an empty table');
		assert.deepEqual(qz.quests.get(102).startedBy, [[], [500]]);
		assert.equal(qz.quests.get(100).preQuestSingle, undefined);
		assert.equal(qz.npcs.get(251362).minLevelHealth, 0);
		assert.deepEqual(qz.npcs.get(2).spawns, { 12: [[42.1, 65.9]], 1519: [[60, 60]] });
		assert.equal(qz.objects.get(500).name, 'Fixture Altar');
		assert.deepEqual(qz.items.get(50).npcDrops, [3, 4]);
		// Support data.
		assert.deepEqual(qz.xp.get(92460), { level: 1, xp: 40 });
		assert.equal(qz.areaToUiMap.get(16593), 2521);
		assert.equal(qz.uiMapToArea.get(2521), 16593);
		assert.deepEqual([...qz.eraToForever.uiMapToArea], [[1453, 1519]]);
		assert.deepEqual(qz.eraToForever.dbc, { from: '1.15.9.1', to: '1.60.1.2' });
		assert.deepEqual(qz.info.questie, { title: 'Questie', version: '8.8.8', author: 'Fixture Questie Authors', buildCommit: 'def456', buildTime: null });
		// DropDB.GetItemDroprate order: correction (a reference falls through when missing), pserver, wowhead.
		assert.deepEqual(dropRate(qz.drops, 50, 3), { chance: 12.5, source: 'wowhead' });
		assert.deepEqual(dropRate(qz.drops, 50, 4), { chance: 70, source: 'cmangos' });
		assert.deepEqual(dropRate(qz.drops, 252665, 251361), { chance: 100, source: 'questie' });
		assert.equal(dropRate(qz.drops, 50, 99), null);
	});

	test('race masks keep the Skyborne bits; all races means unrestricted', () => {
		assert.equal(raceMask(77), 77);
		assert.equal(raceMask(2 ** 32), 2 ** 32);
		assert.equal(raceMask(255 + 2 ** 32 + 2 ** 33), null);
		assert.equal(raceMask(255), 255, 'all Era races but no Skyborne is a restriction');
		assert.equal(raceMask(0), null);
	});

	test('refuses a store that is not baked Forever', () => {
		const dir = writeQuestie(tmpdir('polestar-questie-'));
		const toc = path.join(dir, 'QuestieDB_Forever.toc');
		fs.writeFileSync(toc, fs.readFileSync(toc, 'utf8').replace('## X-Flavor: Forever', '## X-Flavor: Era'));
		assert.throws(() => readQuestie(dir), /flavor Era, not Forever/);
	});
});

describe('QuestieDB merge', () => {
	test('Forever-only quests, npcs and items are added', async () => {
		const { read } = await build();
		const q = read('quests');
		assert.deepEqual(q[92460], {
			id: 92460, title: 'Coming of Age', level: 1, minLevel: 1, races: 2 ** 32 + 2 ** 33, classes: null,
			start: { npc: [251362], object: [], item: [] }, end: { npc: [251361], object: [] },
			pre: [100], excl: [], next: null,
			objectives: [{ type: 'event', id: null, count: null, text: 'Find the shrine', map: 2521, f: 'l', x: 40.5, y: 60.25 }],
			objectiveText: 'Find the shrine.$B$BReturn to Rorian.', zone: 2521, xp: 40, skill: null, event: null,
			source: ['questie-forever'], preAll: [100], breadcrumbFor: 92461, parent: 100, area: 16593,
		});
		const npcs = read('npcs');
		assert.deepEqual(npcs[251362], { id: 251362, name: 'Ailee Farheart', level: 1, faction: 'AH', spawns: { 2521: { f: 'l', pts: [[42.82, 23.37]] } }, source: ['questie-forever'] });
		assert.deepEqual(read('items')[252665], { id: 252665, name: "Head of Urs'anah", drops: { npc: { 251361: 100 }, object: {} }, vendors: [], source: ['questie-forever'] });
		assert.deepEqual(read('zones')[2521], { id: 2521, name: null, areaId: 16593, parent: null, type: 3 });
	});

	test('shared entities: Questie wins on the fields it has, pfQuest-only fields stay', async () => {
		const { read, result } = await build();
		const q = read('quests');
		assert.equal(q[100].title, 'Fixture Calling (Questie)');
		assert.equal(q[100].level, 3);
		assert.equal(q[100].xp, 85, 'xp from QuestieDB QuestXP');
		assert.deepEqual(q[100].source, ['pfquest', 'questie-forever']);
		// 101: objectives in the order the game lists them, creatures before
		// items, though the text names the pelts first; counts from the text.
		assert.deepEqual(q[101].objectives, [
			{ type: 'kill', id: 3, count: 10, text: 'Fixture Wolf' },
			{ type: 'kill', id: 4, count: 4, text: 'Fixture Wolf Alpha' },
			{ type: 'item', id: 50, count: 3, text: 'Wolf Pelt' },
		]);
		assert.deepEqual(q[101].pre, [100]);
		assert.deepEqual(q[101].preAny, [100]);
		assert.deepEqual(q[101].excl, [102, 105]);
		assert.deepEqual(q[101].breadcrumbs, [103]);
		assert.deepEqual(q[101].children, [104]);
		assert.equal(q[101].races, 77);
		// 102: Questie has no objectives, skill or event: pfQuest's stay.
		assert.equal(q[102].event, 12);
		assert.equal(q[102].skill, 186);
		assert.equal(q[102].objectives.length, 2);
		assert.equal('preAll' in q[102], false, 'fields Questie has no value for are omitted');
		assert.deepEqual(q[102].preAny, [100], 'a quest never requires itself or a quest exclusive with it');
		assert.equal(result.meta.counts.prereqsCleaned, 1);
		// 104: pfQuest only.
		assert.deepEqual(q[104].source, ['pfquest']);
		assert.deepEqual(result.meta.questie.notInStore, [104]);

		const npcs = read('npcs');
		assert.deepEqual(npcs[2].roles, ['vendor'], 'npc flags give roles');
		assert.equal(npcs[2].faction, 'AH', 'faction stays pfQuest’s');
		assert.equal(npcs[3].faction, null, 'Questie "AH" (not hostile) on wildlife is not a side');
		assert.deepEqual(npcs[1].roles, ['flightmaster']);
		assert.deepEqual(npcs[1].source, ['pfquest', 'questie-forever']);
		// Gathering nodes keep pfQuest's maps that QuestieDB does not list.
		assert.deepEqual(read('objects')[600].spawns, { 1429: { f: 'e', pts: [[33.3, 44.4]] }, 1453: { f: 'l', pts: [[10, 10]] } });
		const items = read('items');
		assert.deepEqual(items[50].drops, { npc: { 3: 12.5, 4: 70, 5: 2.5 }, object: { 600: 2.5 } }, 'union: DropDB chances win, pfQuest-only droppers and objects kept');
		assert.deepEqual(items[52].vendors, [1, 2], 'a shorter QuestieDB vendor list never drops pfQuest vendors');
		assert.deepEqual(items[52].source, ['pfquest', 'questie-forever']);
		assert.equal(result.meta.counts.itemsRegainedEntries, 2);

		const src = result.meta.sources.find((s) => /QuestieDB/.test(s.name));
		assert.equal(src.revision, '9.9.9 abc123');
		assert.equal(src.questie.version, '8.8.8');
		assert.match(src.license, /all rights reserved/);
		assert.equal(result.meta.counts.questieOnlyQuests, 2);
		assert.deepEqual(q[92461].start, { npc: [], object: [700], item: [] }, 'sparse questgivers keep the object slot');
		assert.deepEqual(q[92461].end, { npc: [], object: [700] }, 'ender from the object questEnds');
		assert.equal(result.meta.counts.reverseLinks, 1);
		assert.equal(result.meta.counts.questsWithXp, 3);
	});

	test('recordings win over QuestieDB', async () => {
		const { read } = await build({ recordingsDir: path.join(FIX, 'recordings') });
		const q = read('quests');
		assert.equal(q[100].title, 'Fixture Calling (Forever)');
		assert.equal(q[100].level, 2);
		assert.equal(q[100].xp, 40, 'recorded xp beats QuestXP');
		assert.deepEqual(q[100].source, ['pfquest', 'questie-forever', 'recorder', 'recorder:xp-turnin']);
		assert.deepEqual(read('npcs')[1].spawns, { 1429: { f: 'l', pts: [[47.5, 40.25]] } });
	});

	test("objectives come in the game's order: creatures, objects, items, kill credits, the trigger", async () => {
		const { read } = await build({}, {
			quests: {
				// The Guns of Northwatch: the text names the medals first, the game
				// lists the three kills first and the medals fourth.
				891: {
					name: 'The Guns of Northwatch', questLevel: 20, requiredLevel: 13, startedBy: [[2]], finishedBy: [[2]],
					objectivesText: ["Captain Thalo'thas Brightsun of Ratchet wants you to collect 10 Theramore Medals and slay Captain Fairmount, Cannoneer Whessan and Cannoneer Smythe."],
					objectives: [[{ 1: 3393, 2: 'Captain Fairmount' }, { 1: 3455, 2: 'Cannoneer Whessan' }, { 1: 3454, 2: 'Cannoneer Smythe' }], [], [{ 1: 5078, 2: 'Theramore Medal' }]],
				},
				110: {
					name: 'Fixture Order', questLevel: 3, requiredLevel: 1, startedBy: [[2]], finishedBy: [[2]],
					objectivesText: ['Scout the ridge, question Bob, bring 3 Wolf Pelts, light the Fixture Altar and kill 5 Fixture Wolves.'],
					objectives: { 1: [{ 1: 3 }], 2: [{ 1: 500 }], 3: [{ 1: 50 }], 5: [{ 1: [1, 2], 2: 1, 3: 'Bob questioned' }] },
					triggerEnd: ['Scout the ridge', { 12: [[50, 50]] }],
				},
			},
		});
		const q = read('quests');
		const order = (id) => q[id].objectives.map((o) => `${o.type} ${o.id ?? o.text}`);
		assert.deepEqual(order(891), ['kill 3393', 'kill 3455', 'kill 3454', 'item 5078']);
		assert.equal(q[891].objectives[3].count, 10);
		assert.deepEqual(order(110), ['kill 3', 'object 500', 'item 50', 'kill 1', 'event Scout the ridge']);
	});

	test("QuestieDB's hints move a kind to the front; commented hints and other scopes' do not count", async () => {
		const quest = (name) => ({ name, questLevel: 3, requiredLevel: 1, startedBy: [[2]], finishedBy: [[2]], objectives: [[{ 1: 3 }], [], [{ 1: 50 }]] });
		const { read } = await build({}, {
			quests: { 111: quest('Fixture Item First'), 112: quest('Fixture Commented'), 113: quest('Fixture Era'), 114: quest('Fixture Season') },
			files: {
				'src/corrections/Forever/legacy/classicQuestFixes.lua': 'QuestieCorrections.itemObjectiveFirst[111] = true\n-- QuestieCorrections.itemObjectiveFirst[112] = true\n',
				'src/corrections/Era/classicQuestFixes.lua': 'QuestieCorrections.itemObjectiveFirst[113] = true\n',
				'src/corrections/Sod/sodQuestFixes.lua': 'QuestieCorrections.itemObjectiveFirst[114] = true\n',
			},
		});
		const q = read('quests');
		const order = (id) => q[id].objectives.map((o) => `${o.type} ${o.id}`);
		assert.deepEqual(order(111), ['item 50', 'kill 3']);
		for (const id of [112, 113, 114]) assert.deepEqual(order(id), ['kill 3', 'item 50'], `quest ${id}`);
	});
});

describe('QuestieDB frames', () => {
	test('points are Era-tagged on unchanged maps, live on changed and Forever-only maps', async () => {
		const { read, result } = await build();
		const npcs = read('npcs');
		assert.deepEqual(npcs[2].spawns, { 1429: { f: 'e', pts: [[42.1, 65.9]] }, 1453: { f: 'l', pts: [[60, 60]] } });
		assert.equal(npcs[251361].spawns[2521].f, 'l');
		assert.deepEqual(result.meta.liveFrameMaps, [1453], 'without Forever tables, QuestieDB eraToForever names the changed maps');
	});

	test('with Forever client tables, frame changes decide and Forever maps get names and frames', async () => {
		const sourcesDir = tmpdir('polestar-questie-');
		fs.cpSync(path.join(FIX, 'sources', 'wago'), path.join(sourcesDir, 'wago'), { recursive: true });
		const era = path.join(sourcesDir, 'wago', '1.15.9.11111');
		const fv = path.join(sourcesDir, 'wago', '1.60.1.1');
		fs.mkdirSync(fv);
		fs.writeFileSync(path.join(fv, 'UiMap.csv'), `${fs.readFileSync(path.join(era, 'UiMap.csv'), 'utf8').trimEnd()}\n"Zephras Isle",2521,947,4,0,3\n`);
		// Stormwind keeps its frame here, Elwynn moves 10 yards, Zephras Isle is new.
		const asg = fs.readFileSync(path.join(era, 'UiMapAssignment.csv'), 'utf8').replace('-10254.166015625,-1935.4166259766', '-10264.166015625,-1935.4166259766').trimEnd();
		fs.writeFileSync(path.join(fv, 'UiMapAssignment.csv'), `${asg}\n0,0,1,1,1247.917,-1331.25,-1000000,4956.25,4231.25,1000000,50000,2521,0,2991,16593,0,0\n`);
		fs.writeFileSync(path.join(fv, 'AreaTable.csv'), `${fs.readFileSync(path.join(era, 'AreaTable.csv'), 'utf8').trimEnd()}\n16593,ZephrasIsle,"Zephras Isle",2991,0\n`);
		const { read, result } = await build({ sourcesDir, forever: true });
		assert.deepEqual(result.meta.liveFrameMaps, [1429]);
		assert.deepEqual(read('zones')[2521], { id: 2521, name: 'Zephras Isle', areaId: 16593, parent: 947, type: 3 });
		const frames = read('map-frames');
		assert.deepEqual(frames.forever[2521], { c: 2991, left: 4231.25, right: -1331.25, top: 4956.25, bottom: 1247.917 });
		assert.equal(frames.era[2521], undefined);
		const npcs = read('npcs');
		assert.equal(npcs[2].spawns[1429].f, 'l');
		assert.equal(npcs[2].spawns[1453].f, 'e');
		assert.match(result.meta.sources.find((s) => /Forever client tables/.test(s.name)).revision, /wow_classic_beta 1\.60\.1\.1/);
	});
});
