'use strict';
// Game names in the client's language (addon/Polestar/Core/Names.lua and its
// consumers) on a fake French client with a small Polestar_Names_frFR
// (tests/helpers/names.js): the client's own quest and item names first,
// then the pack's, else English; one server request per name, one redraw
// when they arrive; an English client loads nothing and reads the guides'
// English as before.

const { test } = require('node:test');
const assert = require('node:assert/strict');
const { runAddon } = require('./helpers/lua');
const { namesPack } = require('./helpers/names');
const { TEST_PACK, TEST_SOURCE } = require('./helpers/packs');

const FR = {
	quest: { 7: 'Nettoyer le camp des kobolds', 33: 'Les loups à la frontière', 176: 'Avis de recherche : Lardeur' },
	npc: { 6: 'Vermine kobold', 197: 'Maréchal McBride', 240: 'Maréchal Dughan', 448: 'Lardeur' },
	object: { 68: 'Avis de recherche' },
	item: { 750: 'Viande de loup coriace', 1528: "Poignée d'avoine" },
};
const PACK = namesPack('frFR', FR);

// The client's quest and item APIs as the names need them; requests recorded.
const CLIENT = `
__asked = { quest = {}, item = {} }
__itemNames = {}
function C_QuestLog.RequestLoadQuestByID(id) table.insert(__asked.quest, id) end
function C_Item.GetItemNameByID(id) return __itemNames[id] end
function C_Item.IsItemDataCachedByID(id) return __itemNames[id] ~= nil end
function C_Item.RequestLoadItemDataByID(id) table.insert(__asked.item, id) end
local w = stub.world
w.addMap(1429, { name = "Forêt d'Elwynn", c = 0, left = 1500, right = -1500, top = 500, bottom = -1500 })
w.moveTo(1429, 48, 42)
`;

// Every name kind on one step; NPC 999 and item 9999 have no French name.
const GUIDE = `
${TEST_PACK}
${TEST_SOURCE}
Polestar.RegisterGuide({
	id = "test/names", pack = "test", title = "Names", minLevel = 1, maxLevel = 10,
	steps = {
		{ title = "Goldshire", goals = {
			{ t = "accept", quest = 176, title = "Wanted: Hogger", npc = 240, npcName = "Marshal Dughan", map = 1429, x = 48, y = 42 },
			{ t = "kill", quest = 7, title = "Kobold Camp Cleanup", target = "Kobold Vermin", npc = 6, count = 10, oi = 1, map = 1429, x = 47, y = 35 },
			{ t = "collect", quest = 7, title = "Kobold Camp Cleanup", item = 1528, itemName = "Handful of Oats", count = 8, oi = 2, map = 1429, x = 47, y = 35 },
			{ t = "interact", object = 68, objName = "Wanted Poster", map = 1429, x = 48, y = 42 },
			{ t = "talk", npc = 999, npcName = "Nobody Translated", map = 1429, x = 48, y = 42 },
			{ t = "use", item = 9999, itemName = "Untranslated Thing" },
			{ t = "turnin", quest = 33, title = "Wolves Across the Border", npc = 197, npcName = "Marshal McBride", map = 1429, x = 48, y = 42 },
		} },
	},
})
`;

// The French interface file stays out (its "%1$s" formats need the client's
// string.format, which Lua 5.1's lacks): these tests are about the names.
const NO_INTERFACE_FILE = `
do
	local load = loadfile
	function loadfile(file)
		if file:match("[/\\\\]Locales[/\\\\]%a%a%u%u%.lua$") then return function() end end
		return load(file)
	end
end`;

function run({ locale = 'frFR', before = '', guide = false, script }) {
	return runAddon({
		stubs: ['stub_world.lua'],
		before: `${locale ? `function GetLocale() return ${JSON.stringify(locale)} end` : ''}
${NO_INTERFACE_FILE}
${PACK.stubLua}
${CLIENT}
${before}`,
		addons: ['Polestar'],
		script: `${guide ? GUIDE : ''}
stub.login()
stub.fire("QUEST_LOG_UPDATE"); stub.advance(0.6)
N = Polestar.Names
${script}`,
	}).emitted;
}

// ---------------------------------------------------------------------------
// Polestar.Names
// ---------------------------------------------------------------------------

test('a French client: NPCs and objects from the pack, quests and items from the client first, asked for once when it has none', () => {
	const [basics, quests, items] = run({
		script: `
emit({ N.Localised(), N.Npc(448), N.Npc(1) or false, N.Object(68), N.Npc("448") or false, __namesLoads })
stub.world.titles[33] = "Les loups à la frontière (client)"
emit({ N.Quest(33), N.Quest(176), N.Quest(176), N.Quest(5) or false, __asked.quest })
__itemNames[750] = "Viande de loup coriace (client)"
emit({ N.Item(750), N.Item(1528), N.Item(1528), __asked.item, __namesLoads })`,
	});
	assert.deepEqual(basics, [true, 'Lardeur', false, 'Avis de recherche', false, 1]);
	assert.deepEqual(quests, ['Les loups à la frontière (client)', 'Avis de recherche : Lardeur', 'Avis de recherche : Lardeur', false, [176, 5]],
		'the client\'s title wins; 176 and 5 are asked for once each');
	assert.deepEqual(items, ['Viande de loup coriace (client)', "Poignée d'avoine", "Poignée d'avoine", [1528], 1], 'the pack loaded once');
});

test('the asked names arriving redraw the guide window once (STEP_UPDATED); a name never asked for does not', () => {
	const [counts] = run({
		guide: true,
		script: `
local fired = 0
Polestar.On("STEP_UPDATED", function() fired = fired + 1 end)
N.Quest(176); N.Item(1528)
stub.fire("QUEST_DATA_LOAD_RESULT", 4242, true)
stub.advance(1)
local unasked = fired
stub.fire("QUEST_DATA_LOAD_RESULT", 176, true)
stub.fire("ITEM_DATA_LOAD_RESULT", 1528, true)
stub.advance(1)
local burst = fired
stub.fire("QUEST_DATA_LOAD_RESULT", 176, true)
stub.advance(1)
emit({ unasked, burst, fired })`,
	});
	assert.deepEqual(counts, [0, 1, 1]);
});

test('in combat the pack waits (English meanwhile) and loads once out of it; a pack for another language changes nothing', () => {
	const [inCombat, after] = run({
		script: `
stub.inCombat = true
emit({ N.Npc(448) or false, __namesLoads })
stub.inCombat = false
N.Add("deDE", "npc", { [448] = "Hogger (deDE)" })
emit({ N.Npc(448), __namesLoads, N.Ready() })`,
	});
	assert.deepEqual(inCombat, [false, 0]);
	assert.deepEqual(after, ['Lardeur', 1, true]);
});

test('an English client loads no names pack and asks the server for nothing', () => {
	for (const locale of [null, 'enGB']) {
		const [out] = run({
			locale,
			guide: true,
			script: `
stub.world.titles[176] = "Wanted: Hogger"
emit({ N.Localised(), N.Quest(176) or false, N.Npc(448) or false, N.Object(68) or false, N.Item(1528) or false, N.Ready(), __namesLoads, #__asked.quest, #__asked.item })`,
		});
		assert.deepEqual(out, [false, false, false, false, false, true, 0, 0, 0], String(locale));
	}
});

test('the names pack is optional: never reported missing, named when it is from another version', () => {
	const check = (addons) => run({
		before: `stub.addons = { { name = "Polestar" }, { name = "Polestar_Guides" }, { name = "Polestar_Codex" }${addons} }`,
		script: 'local missing, stale = Polestar.Data.CheckInstall(); emit({ table.concat(missing, ","), table.concat(stale, ",") })',
	})[0];
	assert.deepEqual(check(''), ['', '']);
	assert.deepEqual(check(', { name = "Polestar_Names_frFR" }'), ['', '']);
	assert.deepEqual(run({
		before: 'stub.addons = { { name = "Polestar" }, { name = "Polestar_Guides" }, { name = "Polestar_Codex" }, { name = "Polestar_Names_frFR" } }\nstub.addonMeta["Polestar_Names_frFR"] = { Version = "0.0.1" }',
		script: 'local missing, stale = Polestar.Data.CheckInstall(); emit({ table.concat(missing, ","), table.concat(stale, ",") })',
	})[0], ['', 'Polestar_Names_frFR (0.0.1)']);
});

// ---------------------------------------------------------------------------
// The guide window (Engine.GetStepView)
// ---------------------------------------------------------------------------

const VIEW = `
local v = Polestar.Engine.GetStepView(1)
local out = {}
for i, g in ipairs(v.goals) do out[i] = { g.subject, g.detail or false, g.npcName or false } end
emit(out)`;

test('a French client: the guide window names quests, NPCs, objects and items in French, the client\'s quest title first; English where no French name exists', () => {
	const [view] = run({ guide: true, before: 'stub.world.titles[33] = "Les loups à la frontière (client)"', script: VIEW });
	assert.deepEqual(view, [
		['Avis de recherche : Lardeur', 'from Maréchal Dughan', 'Maréchal Dughan'],
		['Vermine kobold', 'for Nettoyer le camp des kobolds', false],
		["Poignée d'avoine", 'for Nettoyer le camp des kobolds', false],
		['Avis de recherche', false, false],
		['Nobody Translated', false, 'Nobody Translated'],
		['Untranslated Thing', false, false],
		['Les loups à la frontière (client)', 'at Maréchal McBride', 'Maréchal McBride'],
	]);
});

test('an English client keeps the guide\'s English, its quest title before the client\'s', () => {
	const [view] = run({ locale: null, guide: true, before: 'stub.world.titles[176] = "Wanted: Hogger (client)"', script: VIEW });
	assert.deepEqual(view.map((g) => g[0]), ['Wanted: Hogger', 'Kobold Vermin', 'Handful of Oats', 'Wanted Poster', 'Nobody Translated', 'Untranslated Thing', 'Wolves Across the Border']);
	assert.deepEqual(view[0], ['Wanted: Hogger', 'from Marshal Dughan', 'Marshal Dughan']);
});
