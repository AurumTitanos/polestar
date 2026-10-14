'use strict';
// talents build (tools/lib/talents/build.js): a plan's picks by name resolved
// on the class's trait tree and replayed under the client's rules, against a
// small made-up tree; then the committed Builds.lua against the cached
// Forever tables when they are on this machine (data/sources is not in git).

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { treeFacts, resolveBuild, replay, buildTalents, PREREQ_RULE, TABLES } = require('../tools/lib/talents/build');

// Two columns of a made-up Paladin tree: A (3 ranks) -> B (arrow, 1 rank),
// C gated on 3 points in column one; D alone in column two.
function tables() {
	const n = (ID, PosX, PosY) => ({ ID, TraitTreeID: 1100, PosX, PosY });
	return {
		SkillLineXTraitTree: [{ ID: 1, SkillLineID: 184, TraitTreeID: 1100 }],
		TraitNode: [n(1, 1000, 100), n(2, 1600, 100), n(3, 1000, 700), n(4, 9000, 100), { ID: 9, TraitTreeID: 5, PosX: 0, PosY: 0 }],
		TraitNodeXTraitNodeEntry: [1, 2, 3, 4].map((i) => ({ ID: i, TraitNodeID: i, TraitNodeEntryID: 10 + i, _Index: 0 })),
		TraitNodeEntry: [[11, 3], [12, 1], [13, 2], [14, 5]].map(([ID, MaxRanks]) => ({ ID, TraitDefinitionID: ID + 10, MaxRanks })),
		TraitDefinition: [21, 22, 23, 24].map((ID) => ({ ID, SpellID: ID + 100, OverrideName_lang: '' })),
		SpellName: [['121', 'Alpha'], ['122', 'Beta'], ['123', 'Gamma'], ['124', 'Delta']].map(([ID, Name_lang]) => ({ ID, Name_lang })),
		TraitNodeGroupXTraitNode: [
			{ TraitNodeGroupID: 50, TraitNodeID: 1 }, { TraitNodeGroupID: 50, TraitNodeID: 2 }, { TraitNodeGroupID: 50, TraitNodeID: 3 },
			{ TraitNodeGroupID: 60, TraitNodeID: 3 },
		],
		TraitNodeGroupXTraitCond: [{ TraitCondID: 70, TraitNodeGroupID: 60 }],
		TraitCond: [{ ID: 70, CondType: 0, TraitNodeGroupID: 50, SpentAmountRequired: 3 }],
		TraitEdge: [{ LeftTraitNodeID: 1, RightTraitNodeID: 2 }],
	};
}

const SOURCE = { class: 'PALADIN', source: 'X', sourceUrl: 'https://example.invalid', summary: 's', order: ['One', 'Two'] };
const pick = (level, tree, talent, rank, note) => ({ level, tree, talent, rank, ...(note ? { note } : {}) });

test('treeFacts: the class tree only, spec columns by position, rows, gates and arrows', () => {
	const f = treeFacts(tables(), 'PALADIN');
	assert.equal(f.treeID, 1100);
	assert.deepEqual(Object.keys(f.nodes).map(Number), [1, 2, 3, 4]);
	assert.deepEqual(f.specs, [[1, 2, 3], [4]]);
	assert.deepEqual([f.nodes[3].spec, f.nodes[3].row, f.nodes[3].col], [1, 2, 1]);
	assert.deepEqual([f.nodes[2].col, f.nodes[4].spec], [2, 2]);
	assert.equal(f.nodes[2].name, 'Beta');
	assert.deepEqual(f.gates, { 3: [{ group: 50, need: 3 }] });
	assert.deepEqual(f.groups, { 50: [1, 2, 3] });
	assert.deepEqual(f.edges, [{ from: 1, to: 2 }]);
});

test('resolveBuild: names within their column; an unknown name or tree is an error', () => {
	const f = treeFacts(tables(), 'PALADIN');
	const r = resolveBuild(f, SOURCE, { key: 'k', picks: [pick(10, 'One', 'Alpha', 1, 'why'), pick(11, 'Two', 'Alpha', 1), pick(12, 'Three', 'Delta', 1)] });
	assert.deepEqual(r.picks, [{ level: 10, node: 1, rank: 1 }]);
	assert.deepEqual(r.notes, { 10: 'why' });
	assert.equal(r.errors.length, 2);
	assert.match(r.errors[0], /no Two talent named "Alpha"/);
	assert.match(r.errors[1], /unknown tree "Three"/);
});

test('replay: levels, ranks, tier gates and arrows (full rank, or one rank with "started")', () => {
	const f = treeFacts(tables(), 'PALADIN');
	const p = (level, node, rank) => ({ level, node, rank });
	assert.equal(PREREQ_RULE, 'full', 'full rank until checked in game');
	assert.deepEqual(replay(f, [p(10, 1, 1), p(11, 1, 2), p(12, 1, 3), p(13, 2, 1), p(14, 3, 1)]), []);
	assert.match(replay(f, [p(10, 1, 1), p(11, 2, 1)])[0], /needs Alpha 3\/3/);
	assert.deepEqual(replay(f, [p(10, 1, 1), p(11, 2, 1)], { prereq: 'started' }), []);
	assert.match(replay(f, [p(10, 1, 1), p(11, 3, 1)])[0], /needs 3 points in its tree, has 1/);
	assert.match(replay(f, [p(10, 1, 2)])[0], /rank 2 after 0/);
	assert.match(replay(f, [p(11, 4, 1)])[0], /expected level 10/);
});

test('buildTalents: the Lua names its rule, the snapshot and each plan, notes by level', () => {
	const src = { ...SOURCE, builds: [{ key: 'one', spec: 'One', split: '3/0', link: 'L', picks: [pick(10, 'One', 'Alpha', 1, 'Say "hi"'), pick(11, 'One', 'Alpha', 2)] }] };
	const r = buildTalents(src, tables(), { header: '-- H' });
	assert.deepEqual(r.errors, []);
	assert.match(r.lua, /^-- H\n/);
	assert.match(r.lua, /prereq = "full"/);
	assert.match(r.lua, /\[1\] = \{ 11, 3, 121, 1, 1, 1, "Alpha" \},/);
	assert.match(r.lua, /\[3\] = \{ \{ 50, 3 \} \},/);
	assert.match(r.lua, /edges = \{ \{ 1, 2 \} \},/);
	assert.match(r.lua, /\{ 1, 1 \}, \{ 1, 2 \},/);
	assert.match(r.lua, /\[10\] = "Say \\"hi\\"",/);
});

// The committed file matches the plans and the Forever tables (when cached).
const ROOT = path.join(__dirname, '..');
const CACHE = path.join(ROOT, 'data', 'sources', 'wago', '1.60.1.70374');
const cached = TABLES.every((t) => fs.existsSync(path.join(CACHE, `${t}.csv`)));

test('talents check: Builds.lua is up to date and every Paladin pick is legal', { skip: !cached && 'no cached Forever trait tables' }, async () => {
	const cmd = require('../tools/commands/talents');
	const log = console.log;
	console.log = () => {};
	try {
		assert.equal(await cmd.run(['check', '--offline']), 0);
	} finally {
		console.log = log;
	}
});
