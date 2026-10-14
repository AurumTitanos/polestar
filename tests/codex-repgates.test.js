'use strict';
// The cited reputation gate table (tools/lib/codex/repgates.json): a row gates
// the vendor, giver or quest it names (the item takes the standing, Lookup
// blocks that row until the character has it, per side where both sides'
// vendors sell the item), and a row whose item or npc the Codex lacks is a
// build warning, not a silent skip.

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { runAddon } = require('./helpers/lua');
const { writeCodexPack } = require('./helpers/codex');
const { tmpdir } = require('./helpers/tmp');
const { mergeCodex, loadRepGateTable } = require('../tools/lib/codex/build');

const SOURCE = 'https://warcraft.wiki.gg/wiki/Example';
const FRAME = { c: 0, left: 1000, right: -1000, top: 1000, bottom: -1000 };

function vendor(id, name, side, x) {
	return { id, name, level: 60, faction: side, roles: ['vendor'], spawns: { 9001: { f: 'e', pts: [[x, 50]] } }, source: ['questie-forever'] };
}

// Vale Ration: the Alliance quartermasters (7001, 7003) sell it at Revered
// with the Vale Wardens, the Horde ones (7002, 7004) at Honored with the Ember
// Clan. Two rows are stale: 7009 sells nothing, item 9599 does not exist.
function inputs(rows) {
	const dir = tmpdir('polestar-repgates-');
	const file = path.join(dir, 'repgates.json');
	fs.writeFileSync(file, JSON.stringify({ gates: rows }));
	const forever = {
		zones: { 9001: { id: 9001, name: 'Amber Vale' } },
		factions: { 9100: { id: 9100, name: 'Vale Wardens', side: 'Alliance' }, 9101: { id: 9101, name: 'Ember Clan', side: 'Horde' } },
		mapFrames: { era: { 9001: FRAME } },
		meta: { builtAt: '2026-10-14T00:00:00.000Z', sources: [] },
		npcs: {
			7001: vendor(7001, 'Wardens Quartermaster', 'A', 40),
			7002: vendor(7002, 'Ember Quartermaster', 'H', 60),
			7003: vendor(7003, 'Wardens Supply Officer', 'A', 45),
			7004: vendor(7004, 'Ember Supply Officer', 'H', 65),
			7009: vendor(7009, 'Somebody Else', 'A', 50),
		},
		objects: {},
		items: { 9500: { id: 9500, name: 'Vale Ration', drops: { npc: {}, object: {} }, vendors: [7001, 7002, 7003, 7004], source: ['questie-forever'] } },
		quests: {},
		professions: {},
		trainers: {},
	};
	const repTable = loadRepGateTable(file);
	fs.rmSync(dir, { recursive: true, force: true });
	return { forever, repTable };
}

const ROWS = [
	{ item: 9500, name: 'Vale Ration', faction: 9100, standing: 7, npcs: [7001, 7003], source: SOURCE },
	{ item: 9500, name: 'Vale Ration', faction: 9101, standing: 6, npcs: [7002, 7004], source: SOURCE },
];

test('repgates: a row gates its vendors and sets the item standing; a stale row warns', () => {
	const stale = [
		{ item: 9500, name: 'Vale Ration', faction: 9100, standing: 5, npcs: [7009], source: SOURCE },
		{ item: 9599, name: 'Gone Ration', faction: 9100, standing: 5, npcs: [7001], source: SOURCE },
	];
	const codex = mergeCodex(inputs([...ROWS, ...stale]));
	const item = codex.items[9500];
	assert.deepEqual(
		item.sources.filter((s) => s.type === 'rep'),
		[
			{ type: 'rep', faction: 9100, standing: 7, npc: 7001, from: ['curated'] },
			{ type: 'rep', faction: 9101, standing: 6, npc: 7002, from: ['curated'] },
		],
	);
	assert.equal(item.repFaction, 9100);
	assert.equal(item.repStanding, 7);
	assert.ok(codex.warnings.some((w) => /9500 Vale Ration: npc 7009 neither sells nor gives it/.test(w)), codex.warnings.join('\n'));
	assert.ok(codex.warnings.some((w) => /item 9599 Gone Ration is not in the Codex/.test(w)), codex.warnings.join('\n'));
});

test('repgates: a malformed row stops the build', () => {
	assert.throws(() => inputs([{ item: 9500, faction: 9100, standing: 9, npcs: [7001], source: SOURCE }]), /bad row/);
	assert.throws(() => inputs([{ item: 9500, faction: 9100, standing: 5, npcs: [7001], source: 'wiki' }]), /bad row/);
	assert.throws(() => inputs([{ item: 9500, faction: 9100, standing: 5, source: SOURCE }]), /bad row/);
});

test('repgates: the shipped table loads, every row cites a page', () => {
	const table = loadRepGateTable();
	const rows = Object.values(table).flat();
	assert.ok(rows.length > 100);
	for (const r of rows) assert.match(r.source, /^https:\/\/(warcraft\.wiki\.gg|www\.wowhead\.com)\//, JSON.stringify(r));
});

test('repgates: Lookup blocks each vendor until its own side\'s standing', () => {
	const merged = mergeCodex(inputs(ROWS));
	const { warnings, evidence, ...rest } = merged;
	const pack = writeCodexPack({ meta: { schema: 1, builtAt: '2026-10-14T00:00:00Z', build: '1.60.1.70338', sources: [] }, ...rest });
	try {
		const run = (race, faction, setup) =>
			runAddon({
				stubs: ['stub_world.lua', 'stub_lookup_runtime.lua'],
				before: `${pack.stubLua}
local w = stub.world
w.addMap(9001, { name = "Amber Vale", c = 0, left = 1000, right = -1000, top = 1000, bottom = -1000 })
w.level, w.race, w.raceName, w.faction = 60, "${race}", "${race}", "${faction}"
w.class, w.className = "WARRIOR", "WARRIOR"
w.moveTo(9001, 50, 50)
${setup}`,
				addons: [{ name: 'Polestar', files: ['Core/Core.xml', 'Lookup/Lookup.xml'] }],
				login: true,
				script: `
local out = {}
for _, r in ipairs((Polestar.Lookup.Sources("item", 9500))) do
	if r.type == "vendor" then out[#out + 1] = { label = r.label, available = r.available, why = r.why or false, whyText = r.whyText or false } end
end
table.sort(out, function(a, b) return a.label < b.label end)
emit(out)`,
			}).emitted[0];
		const label = (list) => Object.fromEntries(list.map((r) => [r.label, r.available ? 'ok' : r.why === 'reputation' ? r.whyText : r.why]));
		assert.deepEqual(label(run('Human', 'Alliance', 'w.setRep(9100, "Vale Wardens", 6, 9000, 21000, 12000)')), {
			'Ember Quartermaster': 'faction',
			'Ember Supply Officer': 'faction',
			'Wardens Quartermaster': 'Requires Revered (Vale Wardens)',
			'Wardens Supply Officer': 'Requires Revered (Vale Wardens)',
		});
		// 7004 has no rep source of its own: it takes its side's (Ember Clan), not the item's (Vale Wardens).
		assert.deepEqual(label(run('Orc', 'Horde', 'w.setRep(9101, "Ember Clan", 5, 3000, 9000, 4000)')), {
			'Ember Quartermaster': 'Requires Honored (Ember Clan)',
			'Ember Supply Officer': 'Requires Honored (Ember Clan)',
			'Wardens Quartermaster': 'faction',
			'Wardens Supply Officer': 'faction',
		});
		const honored = label(run('Orc', 'Horde', 'w.setRep(9101, "Ember Clan", 6, 9000, 21000, 12000)'));
		assert.equal(honored['Ember Quartermaster'], 'ok');
		assert.equal(honored['Ember Supply Officer'], 'ok');
	} finally {
		pack.cleanup();
	}
});
