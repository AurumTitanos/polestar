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

function run({ locale = 'frFR', pack = PACK, before = '', guide = false, script }) {
	return runAddon({
		stubs: ['stub_world.lua'],
		before: `${locale ? `function GetLocale() return ${JSON.stringify(locale)} end` : ''}
${NO_INTERFACE_FILE}
${pack.stubLua}
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
	const subjects = view.map((g) => g[0]);
	assert.deepEqual(subjects, ['Avis de recherche : Lardeur', 'Vermine kobold', "Poignée d'avoine", 'Avis de recherche', 'Nobody Translated', 'Untranslated Thing', 'Les loups à la frontière (client)'],
		'French names, the client\'s quest title first; English where no French name exists');
	const has = (i, name) => assert.ok(view[i][1].includes(name), `${view[i][1]} names ${name}`);
	has(0, 'Maréchal Dughan');
	has(1, 'Nettoyer le camp des kobolds');
	has(2, 'Nettoyer le camp des kobolds');
	has(6, 'Maréchal McBride');
	assert.deepEqual(view.map((g) => g[2]), ['Maréchal Dughan', false, false, false, 'Nobody Translated', false, 'Maréchal McBride']);
});

test('an English client keeps the guide\'s English, its quest title before the client\'s', () => {
	const [view] = run({ locale: null, guide: true, before: 'stub.world.titles[176] = "Wanted: Hogger (client)"', script: VIEW });
	assert.deepEqual(view.map((g) => g[0]), ['Wanted: Hogger', 'Kobold Vermin', 'Handful of Oats', 'Wanted Poster', 'Nobody Translated', 'Untranslated Thing', 'Wolves Across the Border']);
	assert.ok(view[0][1].includes('Marshal Dughan'));
	assert.equal(view[0][2], 'Marshal Dughan');
});

// ---------------------------------------------------------------------------
// The target button, the quest database's names, objective matching
// ---------------------------------------------------------------------------

test('the target button\'s macro targets the French name; an English client\'s the English one', () => {
	const script = 'local B = Polestar.QoL.Buttons; emit(B.TargetMacro(B.TargetNames(), 1))';
	const before = 'stub.world.accept(7, { { text = "Kobold Vermin slain: 0/10", required = 10 }, { text = "Handful of Oats: 0/8", required = 8 } })';
	assert.deepEqual(run({ guide: true, before, script }), ['/targetexact Vermine kobold']);
	assert.deepEqual(run({ locale: null, guide: true, before, script }), ['/targetexact Kobold Vermin']);
});

const fs = require('node:fs');
const path = require('node:path');
const { buildQuestDB, writeQuestDB } = require('../tools/lib/questdb/build');
const { tmpdir } = require('./helpers/tmp');

// tests/fixtures/questdb plus quest 9500: 8 Kobold Vermin (6) and 5 Kobold
// Vermin Runts (9500), a name holding the other.
function questDb() {
	const FIX = path.join(__dirname, 'fixtures', 'questdb');
	const dir = tmpdir('polestar-names-questdb-');
	for (const f of fs.readdirSync(FIX)) fs.copyFileSync(path.join(FIX, f), path.join(dir, f));
	const quests = JSON.parse(fs.readFileSync(path.join(FIX, 'quests.json'), 'utf8'));
	const npcs = JSON.parse(fs.readFileSync(path.join(FIX, 'npcs.json'), 'utf8'));
	npcs[9500] = { ...npcs[6], id: 9500, name: 'Kobold Vermin Runt', spawns: { 1429: { f: 'e', pts: [[20, 20], [20.4, 20.3]] } } };
	quests[9500] = { ...quests[7], id: 9500, title: 'Quest 9500', pre: [], objectives: [{ type: 'kill', id: 6, count: 8, text: 'Kobold Vermin' }, { type: 'kill', id: 9500, count: 5, text: 'Kobold Vermin Runt' }] };
	fs.writeFileSync(path.join(dir, 'quests.json'), JSON.stringify(quests));
	fs.writeFileSync(path.join(dir, 'npcs.json'), JSON.stringify(npcs));
	const out = tmpdir('polestar-names-questdb-out-');
	writeQuestDB(buildQuestDB({ dataDir: dir }), out);
	return ['MapFrames.lua', 'Quests.lua', 'Npcs.lua', 'Objects.lua', 'Items.lua'].map((f) => path.join(out, f));
}

const QUEST_PACK = namesPack('frFR', {
	quest: { 60: 'Les chandelles kobolds' },
	npc: { 6: 'Vermine kobold', 40: 'Mineur kobold', 9500: 'Vermine kobold avorton' },
	object: { 77: 'Caisse de chandelles' },
	item: { 772: 'Grande chandelle' },
});

function questRun(script, { locale = 'frFR', setup = '' } = {}) {
	const files = questDb();
	return runAddon({
		stubs: ['stub_world.lua', 'stub_quests.lua'],
		before: `${locale ? `function GetLocale() return ${JSON.stringify(locale)} end` : ''}
${NO_INTERFACE_FILE}
${QUEST_PACK.stubLua}
function C_QuestLog.RequestLoadQuestByID() end
stub.quests.dbFiles = { ${files.map((f) => JSON.stringify(f)).join(', ')} }
local w = stub.world
w.addMap(1429, { name = "Elwynn Forest", c = 0, left = 1500, right = -1500, top = 500, bottom = -1500 })
w.moveTo(1429, 48, 40)
${setup}`,
		addons: ['Polestar'],
		saved: { Polestar: 'PolestarDB = { schema = 1, settings = { qol = { mapObjectives = true } } }' },
		script: `
local w, sq, Q = stub.world, stub.quests, Polestar.QuestDB
sq.installPins()
stub.login()
stub.advance(0.3)
local function prog(q, npc)
	for _, o in ipairs(Q._index.npc[npc] or {}) do
		if o.q == q then return o.cur .. "/" .. o.max .. (o.done and " done" or "") end
	end
	return "none"
end
${script}`,
	}).emitted;
}

test('the quest database names quests, NPCs and items in French (tooltips, the target button\'s droppers)', () => {
	const [names] = questRun(`
emit({ Q.GetQuestTitle(60), Q.EntityName(6), Q.GetObjectiveMobs(60, 1), Q.GetItemDroppers(772)[1].name, Q.GetItem(772).name, Q.GetNpc(6).name, Q.GetQuest(60).title, Q.EntityName(253) })`);
	assert.deepEqual(names, ['Les chandelles kobolds', 'Vermine kobold', ['Vermine kobold', 'Mineur kobold'], 'Vermine kobold', 'Grande chandelle', 'Vermine kobold', 'Les chandelles kobolds', 'William Pestle']);
});

test('an object\'s tooltip, which names it in French, finds the objectives it serves', () => {
	const [found] = questRun(`
w.accept(60, { { text = "Grande chandelle : 0/8", required = 8 } })
stub.advance(0.3)
local fr, en = Q.ObjectivesForObjectName("Caisse de chandelles"), Q.ObjectivesForObjectName("Candle Crate")
emit({ fr and #fr or 0, en and #en or 0 })`);
	assert.deepEqual(found, [1, 0]);
});

test('objective lines match their objectives by the French names before their order', () => {
	const lines = 'w.accept(9500, { { text = "Vermine kobold avorton tuée : 1/5", required = 5, fulfilled = 1 }, { text = "Vermine kobold tuée : 2/8", required = 8, fulfilled = 2 } })\nstub.advance(0.3)\nemit({ prog(9500, 6), prog(9500, 9500) })';
	assert.deepEqual(questRun(lines)[0], ['2/8', '1/5'], 'each line read for its own objective');
	assert.deepEqual(questRun(lines, { locale: null })[0], ['1/5', '2/8'], 'English names find nothing in French lines: by order');
});

// ---------------------------------------------------------------------------
// Lookup (Core/Search.lua) on the sample Codex
// ---------------------------------------------------------------------------

const { writeCodexPack, sampleCodex } = require('./helpers/codex');
const CODEX = writeCodexPack(sampleCodex());

const SEARCH = `
local function q(text)
	local out = {}
	for _, r in ipairs(Polestar.Search.Query(text)) do out[#out + 1] = r.kind .. ":" .. tostring(r.id) .. ":" .. r.title end
	return table.concat(out, "|")
end
emit(q("lardeur")); emit(q("hogger")); emit(q("foret d'elwynn")); emit(q("elwynn")); emit(q("viande de loup"))
local _, counts = Polestar.Search.Query("hogger")
emit(counts)
emit(__namesLoads)`;

const list = (s) => (s === '' ? [] : s.split('|'));

test('Lookup finds a quest, NPC, item or zone by its French name and by its English one, listed once under its French name', () => {
	const [lardeur, hogger, foret, elwynn, viande, counts, loads] = run({ before: CODEX.stubLua, script: SEARCH }).map((v) => (typeof v === 'string' ? list(v) : v));
	assert.deepEqual(lardeur, ['npc:448:Lardeur', 'quest:176:Avis de recherche : Lardeur']);
	assert.deepEqual(hogger, ['npc:448:Lardeur', 'quest:176:Avis de recherche : Lardeur'], 'the English names still find them');
	assert.deepEqual(foret, ["zone:1429:Forêt d'Elwynn"], 'accents and apostrophes fold away');
	assert.deepEqual(elwynn, ["zone:1429:Forêt d'Elwynn"], 'once, though both names match');
	assert.deepEqual(viande, ['item:750:Viande de loup coriace']);
	assert.deepEqual(counts, { npc: 1, quest: 1 });
	assert.equal(loads, 1);
});

test('an English client\'s Lookup is unchanged and loads no names pack', () => {
	const [lardeur, hogger, , elwynn, , counts, loads] = run({ locale: null, before: CODEX.stubLua, script: SEARCH }).map((v) => (typeof v === 'string' ? list(v) : v));
	assert.deepEqual(lardeur, []);
	assert.deepEqual(hogger, ['npc:448:Hogger', 'quest:176:Wanted: "Hogger"']);
	assert.deepEqual(elwynn, ['zone:1429:Elwynn Forest']);
	assert.deepEqual(counts, { npc: 1, quest: 1 });
	assert.equal(loads, 0);
});

test('a Russian client\'s Lookup finds a capitalised name from a lower-case query (Ё as Е); a Chinese name matches as typed; Œ folds to oe', () => {
	const ru = namesPack('ruRU', { npc: { 448: 'Хоггер' }, item: { 750: 'Жёсткое волчье мясо' } });
	const [hogger, meat, fold] = run({ locale: 'ruRU', pack: ru, before: CODEX.stubLua, script: `
local function q(text)
	local out = {}
	for _, r in ipairs(Polestar.Search.Query(text, { kinds = { npc = true, item = true } })) do out[#out + 1] = r.kind .. ":" .. tostring(r.id) .. ":" .. r.title end
	return table.concat(out, "|")
end
emit(q("хоггер")); emit(q("жесткое")); emit(Polestar.Search.Fold("Œuvre cœur"))` });
	assert.equal(hogger, 'npc:448:Хоггер');
	assert.equal(meat, 'item:750:Жёсткое волчье мясо');
	assert.equal(fold, ' oeuvre coeur');
	const zh = namesPack('zhCN', { npc: { 448: '霍格' } });
	const [cjk] = run({ locale: 'zhCN', pack: zh, before: CODEX.stubLua, script: `
local out = {}
for _, r in ipairs(Polestar.Search.Query("霍格", { kinds = { npc = true } })) do out[#out + 1] = r.kind .. ":" .. tostring(r.id) end
emit(table.concat(out, "|"))` });
	assert.equal(cjk, 'npc:448');
});

test('a names pack refused in combat loads when combat ends, without another ask, and redraws the guide window once', () => {
	const [out] = run({
		guide: true,
		before: 'stub.inCombat = true',
		script: `
local fired, names = 0, 0
Polestar.On("STEP_UPDATED", function() fired = fired + 1 end)
Polestar.On("NAMES_LOADED", function() names = names + 1 end)
local during = N.Npc(448) or false
stub.inCombat = false
stub.fire("PLAYER_REGEN_ENABLED")
stub.advance(1)
local loads = __namesLoads
stub.fire("PLAYER_REGEN_ENABLED")
stub.advance(1)
emit({ during, loads, N.Ready(), fired, names, __namesLoads })`,
	});
	assert.deepEqual(out, [false, 1, true, 1, 1, 1]);
});

test('the quest tracker reads the objective lines by the French names once a pack refused in combat arrives', () => {
	const [out] = questRun(`
local before = __namesLoads
stub.inCombat = true
w.accept(9500, { { text = "Vermine kobold avorton tuée : 1/5", required = 5, fulfilled = 1 }, { text = "Vermine kobold tuée : 2/8", required = 8, fulfilled = 2 } })
stub.advance(0.3)
stub.inCombat = false
stub.fire("PLAYER_REGEN_ENABLED")
stub.advance(0.6)
w.progress(9500, 2, 3)
stub.advance(0.3)
emit({ before, prog(9500, 6), prog(9500, 9500) })`);
	assert.deepEqual(out, [0, '3/8', '1/5']);
});
