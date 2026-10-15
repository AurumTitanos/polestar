'use strict';
// A guide's `reward` and `why` headers (docs/GUIDE_FORMAT.md, "Header"): what
// its goal gives and why it is worth doing, for the guide menu's details.
// Parse, names from data, errors, the Class-guide warnings and Lua emission
// through the engine registry.

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { runAddon } = require('./helpers/lua');
const { compile, plain, writeTestPack } = require('./helpers/dsl');
const { TEST_PACK, TEST_SOURCE } = require('./helpers/packs');

function guide(headers, category = 'Class', id = 't/main') {
	return `${[`guide ${id}`, 'title Test', 'faction Alliance', `category ${category}`, 'levels 1-10', 'zone Elwynn Forest', ...headers, '', 'step S', '  accept 783', '  turnin 783'].join('\n')}\n`;
}

test('reward: an item, several items as a choice of one, a spell and words, in header order; why as written', () => {
	const r = compile(
		guide(['reward item 159', 'reward item 750 "Wolf Steak" uncommon 990010 "Miner\'s Lantern" rare', 'reward spell 23161 "Summon Dreadsteed"', 'reward text Summon Incubus', 'why A tireless demon horse.']),
	);
	assert.deepEqual(r.errors, []);
	assert.deepEqual(r.warnings, []);
	const g = plain(r.guides[0]);
	assert.deepEqual(g.reward, [
		{ item: 159, itemName: 'Refreshing Spring Water' },
		{ item: 750, itemName: 'Wolf Steak', quality: 2, choice: true },
		{ item: 990010, itemName: "Miner's Lantern", quality: 3, choice: true },
		{ spell: 23161, spellName: 'Summon Dreadsteed' },
		{ text: 'Summon Incubus' },
	]);
	assert.equal(g.why, 'A tireless demon horse.');
});

test('reward: malformed lines are errors; an unknown item or a spell needs its name; why is given once', () => {
	const cases = [
		['reward', '`reward` needs a value'],
		['reward mount 5', 'unknown reward kind "mount"'],
		['reward item', '`reward item` needs item ids'],
		['reward item 159 159', 'lists item 159 twice'],
		['reward item 159 epic sword', 'unexpected "sword"'],
		['reward spell x', 'malformed `reward spell`'],
		['reward spell 23161', 'reward spell 23161 needs its name'],
		['reward item 990010', 'reward item 990010 is not in data'],
		['reward text', '`reward text` needs words'],
	];
	for (const [line, want] of cases) {
		const r = compile(guide([line, 'why Because.']));
		assert.ok(
			r.errors.some((e) => e.includes(want)),
			`${line}: ${r.errors.join(' | ')}`,
		);
	}
	const twice = compile(guide(['reward text A', 'why One.', 'why Two.']));
	assert.ok(twice.errors.some((e) => e.includes('duplicate header key `why`')), twice.errors.join(' | '));
});

test('a Class guide without reward or why warns; another category does not', () => {
	const bare = compile(guide([]));
	assert.deepEqual(bare.errors, []);
	assert.ok(bare.warnings.some((w) => w.includes('a Class guide needs `reward`')), bare.warnings.join(' | '));
	assert.ok(bare.warnings.some((w) => w.includes('a Class guide needs `why`')), bare.warnings.join(' | '));
	assert.deepEqual(compile(guide([], 'Collectibles')).warnings, []);
});

test('reward and why reach the registry and the guide list (Lua); bad shapes are refused', () => {
	const r = compile(guide(['reward item 750 "Wolf Steak" uncommon 159', 'reward spell 23161 "Summon Dreadsteed"', 'why Worth it.'], 'Class', 'test/main'), undefined, { pack: 'test' });
	assert.deepEqual(r.errors, []);
	const file = path.join(writeTestPack(r.guides).dir, 'Guides.lua');
	assert.match(
		fs.readFileSync(file, 'utf8'),
		/reward = \{ \{ item = 750, itemName = "Wolf Steak", quality = 2, choice = true \}, \{ item = 159, itemName = "Refreshing Spring Water", choice = true \}, \{ spell = 23161, spellName = "Summon Dreadsteed" \} \},\n\t+why = "Worth it\.",/,
	);
	const [out] = runAddon({
		addons: [{ name: 'Polestar', files: ['Core/Core.xml'] }],
		script: `${TEST_PACK}
${TEST_SOURCE}
assert(loadfile(${JSON.stringify(file)}))("Polestar_Guides", {})
local h
for _, g in ipairs(Polestar.Guides.List()) do if g.id == "test/main" then h = g end end
local function bad(extra)
	local def = { id = "test/bad", pack = "test", title = "B", steps = { { goals = { { t = "note", text = "n" } } } } }
	for k, v in pairs(extra) do def[k] = v end
	return { Polestar.RegisterGuide(def) }
end
emit({ reward = h.reward, why = h.why, noId = bad({ reward = { { itemName = "x" } } }), why3 = bad({ why = 3 }) })`,
	}).emitted;
	assert.deepEqual(out.reward, plain(r.guides[0]).reward);
	assert.equal(out.why, 'Worth it.');
	assert.deepEqual(out.noId, [false, 'bad reward 1']);
	assert.deepEqual(out.why3, [false, 'bad why']);
});
