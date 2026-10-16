'use strict';
// Interface translations (docs/TRANSLATING.md): the shipped locale files are
// sound (they load, no stale key, no broken format), `i18n sync` adds and
// retires keys without touching a translation, the checker catches what
// would break in the client, the glossary warns, and a client reads its
// language from the start, with Options' About naming an AI-made one.

const { test } = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const fs = require('node:fs');
const { spawnSync } = require('node:child_process');
const { runAddon, ADDONS, ROOT } = require('./helpers/lua');
const { fakeLocale } = require('./helpers/locale');
const { tmpdir } = require('./helpers/tmp');
const { formatProblems } = require('../tools/lib/i18n/check');
const { extractKeys, DATA_KEYS } = require('../tools/lib/i18n/keys');
const { RETIRED, readLocaleFiles, parseLocaleText, updateLocaleText, newLocaleText } = require('../tools/lib/i18n/files');
const { LOCALES, LOCALE_CODES } = require('../tools/lib/i18n/locales');
const { localeState } = require('../tools/lib/i18n/project');
const { TERMS, GLOSSARY_DIR, readGlossary, glossaryWarnings } = require('../tools/lib/i18n/glossary');

const POLESTAR = path.join(ADDONS, 'Polestar');
const shipped = LOCALE_CODES.filter((l) => fs.existsSync(path.join(POLESTAR, 'Locales', `${l}.lua`)));

test('the keys are every literal L[...] and LC("context", "text") in the code, grouped by first use, plus the text that comes from data; a key in a comment or inside a string is none', () => {
	const dir = tmpdir();
	const write = (rel, text) => {
		fs.mkdirSync(path.dirname(path.join(dir, rel)), { recursive: true });
		fs.writeFileSync(path.join(dir, rel), text);
	};
	const [dataFile, dataKeys] = Object.entries(DATA_KEYS)[0];
	write('A.lua', `local L = ns.L
local HERE = { boat = L["Docked %s"] }
print(L['Single'], L[ [[Long]] ], ns.LC("boss", "Chest"), L["Shared"])
-- L["In a comment"]
--[[ L["In a block comment"] ]]
print("L[\\"In a string\\"]")
`);
	write(dataFile, 'local L = ns.L\nprint(L["Shared"])\n');
	write('Gear/Weights.lua', 'local SPECS = { { key = "arms", label = "A spec" } }\n');
	const keys = extractKeys(dir);
	for (const k of ['Docked %s', 'Single', 'Long', 'boss: Chest', 'Shared']) assert.ok(keys.has(k), `${JSON.stringify(k)} is not found`);
	for (const k of ['In a comment', 'In a block comment', 'In a string']) assert.ok(!keys.has(k), `${JSON.stringify(k)} is not code`);
	assert.deepEqual(keys.get('Shared').map((w) => w.file), ['A.lua', dataFile], 'its first use comes first');
	for (const k of [...dataKeys, 'A spec']) assert.ok(keys.get(k) && keys.get(k).every((w) => w.data), `${JSON.stringify(k)}: a data key`);
});

test('the format check refuses what the client would show broken, and allows reordering with numbered values', () => {
	assert.deepEqual(formatProblems('%d quests', '%d quêtes'), []);
	assert.deepEqual(formatProblems('Step %d of %d', 'Étape %d sur %d'), []);
	assert.deepEqual(formatProblems('level %d %s', '%2$s niveau %1$d'), []);
	assert.deepEqual(formatProblems('%d |4quest:quests;', '%d |4quête:quêtes;'), []);
	assert.deepEqual(formatProblems('100%% done', 'fini à 100 %%'), []);
	assert.equal(formatProblems('%d quests', '%s quêtes').length, 1, 'a number shown as text');
	assert.equal(formatProblems('%s from %s', 'de %s').length, 1, 'a value dropped');
	assert.equal(formatProblems('%d |4quest:quests;', '%d quêtes').length, 1, 'the plural grammar dropped');
	assert.equal(formatProblems('|cffff0000Red|r', 'Rouge').length, 2, 'a colour and its end dropped');
	assert.equal(formatProblems('level %d %s', '%2$s niveau %d').length, 1, 'numbered and plain mixed');
	assert.equal(formatProblems('%d done', '%d fini à 100 %').length, 1, 'a lone percent sign in a formatted string');
	assert.deepEqual(formatProblems('Done', 'Fini à 100 %'), [], 'a plain string is shown as it is');
});

// A small addon: its code, and a German file in Polestar's layout with a
// stale translation, a stale "to do", and keys missing from a group it has
// and from a file it has no group for.
function miniAddon() {
	const dir = tmpdir();
	fs.mkdirSync(path.join(dir, 'Locales'));
	fs.mkdirSync(path.join(dir, 'UI'));
	fs.writeFileSync(path.join(dir, 'Main.lua'), 'local L = Polestar.L\nprint(L["Hello %s"], L["Bye"], L["New in Main"], Polestar.LC("slot", "Back"))\n-- L["In a comment"]\n');
	fs.writeFileSync(path.join(dir, 'UI', 'Window.lua'), 'local L = Polestar.L\nprint(L["Close the window"])\n');
	return dir;
}

const GERMAN = `-- German (deDE). Hand-written header.

local _, ns = ...
if not (GetLocale and GetLocale() == "deDE") then return end
local L = ns.L

-- Main.lua
L["Hello %s"] = "Hallo %s"
-- L["Bye"] = ""
L["Gone"] = "Weg"
-- L["Gone too"] = ""

-- Main.lua (the slot)
L["slot: Back"] = "Rücken"
`;

// A locale file's keys -> { kind: 'entry' | 'todo', files: those its group's
// header names }, and the translations in its end block.
function placed(text) {
	const doc = parseLocaleText(text, 'test.lua');
	const keys = {};
	for (const g of doc.groups) for (const l of g.lines) if (l.kind === 'entry' || l.kind === 'todo') keys[l.key] = { kind: l.kind, files: g.files };
	return { keys, retired: doc.tail[0] === RETIRED ? doc.tail.slice(1) : [] };
}

// Whether every one of `lines` is in `text`, in the same order.
function inOrder(lines, text) {
	const out = text.split('\n');
	let at = 0;
	for (const l of lines) {
		at = out.indexOf(l, at);
		if (at < 0) return false;
		at++;
	}
	return true;
}

test('sync adds missing keys under their file\'s group, retires lost translations to the end, and leaves every other line alone', () => {
	const dir = miniAddon();
	const keys = extractKeys(dir);
	const out = updateLocaleText({ text: GERMAN, file: 'deDE.lua', keys });
	const gone = GERMAN.split('\n').find((l) => l.startsWith('L["Gone"]'));
	const lost = new Set([gone, '-- L["Gone too"] = ""']);
	assert.ok(inOrder(GERMAN.split('\n').filter((l) => !lost.has(l)), out.text), 'every other line (the header, the hand-made group headers, each translation) stays as it was, in order');
	const p = placed(out.text);
	assert.deepEqual(p.keys['New in Main'], { kind: 'todo', files: ['Main.lua'] }, 'commented out in a group of the file that uses it');
	assert.deepEqual(p.keys['Close the window'], { kind: 'todo', files: ['UI/Window.lua'] }, 'in a new group for a file the locale file had none for');
	assert.ok(!('Gone' in p.keys) && !('Gone too' in p.keys), 'keys the code lost leave the groups');
	assert.deepEqual(p.retired, [`-- ${gone}`], 'the lost translation is kept, commented out, at the end');
	assert.deepEqual(out.added, ['New in Main', 'Close the window']);
	assert.deepEqual(out.retired, ['Gone']);
	assert.deepEqual(out.dropped, ['Gone too']);
	assert.equal(updateLocaleText({ text: out.text, file: 'deDE.lua', keys }).text, out.text, 'a second sync changes nothing');
});

test('a new file has every key commented out under its file; filled keys are translated and unknown ones retired', () => {
	const dir = miniAddon();
	const keys = extractKeys(dir);
	const out = newLocaleText({ locale: 'frFR', keys, fill: { Bye: 'Au revoir' }, retire: { Old: 'Vieux' } });
	const p = placed(out.text);
	assert.equal(Object.keys(p.keys).length, keys.size);
	for (const [k, where] of keys) assert.deepEqual(p.keys[k], { kind: k === 'Bye' ? 'entry' : 'todo', files: [where[0].file] }, k);
	assert.deepEqual(p.retired, ['-- L["Old"] = "Vieux"']);
	const file = path.join(dir, 'Locales', 'frFR.lua');
	fs.writeFileSync(file, out.text);
	const [fr, de] = readLocaleFiles([{ file, locale: 'frFR' }, { file, locale: 'deDE' }]);
	assert.deepEqual([fr.layout, fr.strings], ['L', { Bye: 'Au revoir' }], 'it loads on its client');
	assert.deepEqual(de.strings, {}, 'and sets nothing on another');
	assert.equal(updateLocaleText({ text: out.text, file, keys }).text, out.text, 'a sync changes nothing');
});

test('the reader takes Polestar\'s layout, Ding!\'s ns.AddTranslations and a returned table', () => {
	const dir = tmpdir();
	const write = (name, text) => {
		fs.writeFileSync(path.join(dir, name), text);
		return { file: path.join(dir, name), locale: 'frFR' };
	};
	const [ours, ding, table] = readLocaleFiles([
		write('ours.lua', 'local _, ns = ...\nif not (GetLocale and GetLocale() == "frFR") then return end\nlocal L = ns.L\nL["Accept"] = "Accepter"\n'),
		write('ding.lua', 'local _, ns = ...\nif ns.locale ~= "frFR" then return end\nns.AddTranslations("frFR", {\n\t["Accept"] = "Accepter",\n\t-- ["Skip"] = "",\n})\n'),
		write('table.lua', 'return { ["Accept"] = "Accepter" }\n'),
	]);
	assert.deepEqual([ours.layout, ding.layout, table.layout], ['L', 'AddTranslations', 'return']);
	for (const r of [ours, ding, table]) assert.deepEqual(r.strings, { Accept: 'Accepter' });
});

test('glossary: a translation without its locale\'s word warns, its forms count without case or accents, and every glossary names known terms', () => {
	const g = { 'flight master': { term: 'Maître de vol', match: ['maitre de vol', 'maitres de vol'], client: null } };
	const w = glossaryWarnings(g, {
		'Flight masters': 'Maîtres de vol',
		'Walk to the flight master': 'Allez voir le maître de vol',
		'Fly from the flight master': 'Partez du griffon',
		'/pole flight master: where': 'où',
	});
	assert.deepEqual(w.map((x) => x.key), ['Fly from the flight master']);
	for (const f of fs.readdirSync(GLOSSARY_DIR).filter((n) => n.endsWith('.json'))) {
		const locale = f.replace(/\.json$/, '');
		assert.ok(LOCALES[locale], `${f}: not a locale Polestar ships`);
		const read = readGlossary(locale);
		for (const id of Object.keys(read)) assert.ok(TERMS[id], `${f}: ${id}`);
	}
});

test('the checker reports stale keys, broken formats, a key set twice and a file Lua cannot load', () => {
	const dir = miniAddon();
	const head = (l) => `local _, ns = ...\nif not (GetLocale and GetLocale() == "${l}") then return end\nlocal L = ns.L\n`;
	fs.writeFileSync(path.join(dir, 'Locales', 'frFR.lua'), `${head('frFR')}L["Hello %s"] = "Bonjour %d"\nL["Gone"] = "Parti"\nL["Bye"] = "Salut"\nL["Bye"] = "Au revoir"\n`);
	fs.writeFileSync(path.join(dir, 'Locales', 'deDE.lua'), `${head('deDE')}L["Bye"] = "Tschüss"\nL["Hello %s" = "Hallo %s"\n`);
	const st = localeState(dir, ['frFR', 'deDE', 'koKR'], { glossaryDir: dir });
	const fr = st.locales.frFR;
	assert.deepEqual(fr.stale, { Gone: 'Parti' });
	assert.deepEqual(fr.problems.map((p) => p.key).sort(), ['Bye', 'Hello %s']);
	assert.deepEqual(fr.missing.sort(), ['Close the window', 'New in Main', 'slot: Back'], 'a broken translation is translated, and refused');
	assert.match(st.locales.deDE.error, /expected|'\]'/);
	assert.equal(st.locales.koKR.exists, false);
});

test('i18n status lists every locale with its status and translators', () => {
	const r = spawnSync(process.execPath, [path.join(ROOT, 'tools', 'polestar.js'), 'i18n', 'status', '--json'], { encoding: 'utf8', cwd: ROOT });
	assert.equal(r.status, 0, r.stderr);
	const out = JSON.parse(r.stdout);
	assert.deepEqual(out.locales.map((l) => [l.locale, l.status, l.translators]), LOCALE_CODES.map((l) => [l, LOCALES[l].status, LOCALES[l].translators]));
	assert.deepEqual(out.locales.filter((l) => l.file).map((l) => l.locale), shipped);
	for (const l of out.locales.filter((x) => x.file)) assert.ok(l.translated > 0 && l.translated <= out.keys, `${l.locale}: ${l.translated}/${out.keys}`);
});

test('every shipped interface file loads, has no stale key or key set twice, and keeps the English formats', () => {
	const files = fs.readdirSync(path.join(POLESTAR, 'Locales')).filter((f) => f.endsWith('.lua'));
	assert.ok(files.length > 0);
	for (const f of files) assert.ok(LOCALES[f.replace(/\.lua$/, '')], `Locales/${f}: not a locale of tools/lib/i18n/locales.js`);
	const st = localeState(POLESTAR, shipped);
	for (const locale of shipped) {
		const s = st.locales[locale];
		assert.equal(s.error, null, `${locale}: ${s.error}`);
		assert.deepEqual(Object.keys(s.stale), [], `${locale}: stale keys (run \`node tools/polestar.js i18n sync ${locale}\`)`);
		assert.deepEqual(s.problems, [], `${locale}: broken translations`);
		assert.ok(Object.keys(s.translated).length > 1000, `${locale}: ${Object.keys(s.translated).length} translations`);
	}
});

test('sync keeps every translation line of the shipped files byte for byte', () => {
	const keys = extractKeys(POLESTAR);
	for (const locale of shipped) {
		const file = path.join(POLESTAR, 'Locales', `${locale}.lua`);
		const text = fs.readFileSync(file, 'utf8');
		const out = updateLocaleText({ text, file, keys });
		const after = new Set(out.text.split('\n'));
		const lost = text.split('\n').filter((l) => l.startsWith('L[') && !after.has(l) && !after.has(`-- ${l}`));
		assert.deepEqual(lost, [], `${locale}: translation lines sync would change`);
		assert.equal(updateLocaleText({ text: out.text, file, keys }).text, out.text, `${locale}: a second sync changes nothing`);
	}
});

test('game terms come in the client\'s words: a standing in the character\'s gender, a quality, a faction, a gear slot', () => {
	const [out] = runAddon({
		before: `function GetText(tag, sex) return sex == 3 and _G[tag .. "_FEMALE"] or _G[tag] end
function UnitSex() return 3 end
FACTION_STANDING_LABEL8, FACTION_STANDING_LABEL8_FEMALE = "Exalté", "Exaltée"
ITEM_QUALITY3_DESC, FACTION_HORDE, BACKSLOT = "Rare", "Horde", "Dos"`,
		addons: [{ name: 'Polestar', files: ['Core/Core.xml', 'Gear/Gear.xml'] }],
		script: 'emit({ Polestar.StandingName(8), Polestar.QualityName(3), Polestar.FactionName("H"), Polestar.Gear.SlotName(15), Polestar.StandingName(9) or false })',
	}).emitted;
	assert.deepEqual(out, ['Exaltée', 'Rare', 'Horde', 'Dos', false]);
});

test('each shipped language loads before the code that reads L at load: the key binding labels are translated', () => {
	const st = localeState(POLESTAR, shipped);
	for (const locale of shipped) {
		const [label] = runAddon({ before: `function GetLocale() return "${locale}" end`, addons: [{ name: 'Polestar', files: ['Core/Core.xml'] }], script: 'emit(BINDING_NAME_POLESTAR_TOGGLE)' }).emitted;
		assert.equal(label, st.locales[locale].translated['Toggle guide window'], locale);
	}
	const [en] = runAddon({ addons: [{ name: 'Polestar', files: ['Core/Core.xml'] }], script: 'emit(BINDING_NAME_POLESTAR_TOGGLE)' }).emitted;
	assert.equal(en, 'Toggle guide window');
});

test('the Lua list of AI-made locales is locales.js\'s', () => {
	const [ai] = runAddon({ addons: [{ name: 'Polestar', files: ['Core/Init.lua'] }], script: 'emit(Polestar.AI_LOCALES)' }).emitted;
	assert.deepEqual(Object.keys(ai).sort(), LOCALE_CODES.filter((l) => LOCALES[l].status === 'ai'));
});

// Options > About on a client: the AI line's text, or false when hidden.
function aboutNote(before, between = '') {
	return runAddon({
		stubs: ['stub_ui.lua'],
		before,
		addons: [{ name: 'Polestar', files: ['Core/Core.xml', 'Theme/Theme.xml', 'UI/UI.xml'] }],
		script: `${between}\nuistub.install()\nstub.login()\nPolestar.UI.ShowOptions("about")
		local v = Polestar.UI.Options.view
		emit(v.AINote:IsShown() and { note = v.AINote:GetText(), link = v.AILink.Label:GetText(), url = Polestar.DiscordURL } or false)`,
	}).emitted[0];
}

test('Options > About says an AI-made translation is one, with the Discord invite; a reviewed one and English say nothing', () => {
	const ai = aboutNote(fakeLocale('itIT', { 'A translated text': 'Un testo tradotto' }), 'Polestar.AI_LOCALES.itIT = true');
	assert.ok(ai && typeof ai.note === 'string' && ai.note !== '', 'the note shows');
	assert.equal(ai.link, ai.url.replace(/^\w+:\/\//, ''), 'with the Discord invite');
	assert.equal(aboutNote(fakeLocale('itIT', {}), 'Polestar.AI_LOCALES.itIT = true'), false, 'no translation loaded: English, no note');
	assert.equal(aboutNote('function GetLocale() return "deDE" end'), false, 'reviewed');
	assert.equal(aboutNote(''), false, 'English');
});
