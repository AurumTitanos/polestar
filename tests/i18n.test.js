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
const { ADDONS, ROOT } = require('./helpers/lua');
const { tmpdir } = require('./helpers/tmp');
const { formatProblems } = require('../tools/lib/i18n/check');
const { extractKeys } = require('../tools/lib/i18n/keys');
const { readLocaleFiles, updateLocaleText, newLocaleText } = require('../tools/lib/i18n/files');
const { LOCALES, LOCALE_CODES } = require('../tools/lib/i18n/locales');
const { localeState } = require('../tools/lib/i18n/project');
const { TERMS, GLOSSARY_DIR, readGlossary, glossaryWarnings } = require('../tools/lib/i18n/glossary');

const POLESTAR = path.join(ADDONS, 'Polestar');
const shipped = LOCALE_CODES.filter((l) => fs.existsSync(path.join(POLESTAR, 'Locales', `${l}.lua`)));

test('the code\'s keys are found: literal L["..."], ns.LC pairs, the transport captions and the text that comes from data', () => {
	const keys = extractKeys(POLESTAR);
	assert.ok(keys.size > 1500, `only ${keys.size} keys found`);
	for (const k of ['Toggle guide window', 'boss: Chest', 'Next boat in about %s', 'Boat docked, leaves in %s', 'Collectibles', 'Night Elf', 'First Aid', 'Beta', 'Protection (tank)']) {
		assert.ok(keys.has(k), `${JSON.stringify(k)} is not found`);
	}
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

test('sync adds missing keys under their file\'s group, retires lost translations to the end, and leaves every other line alone', () => {
	const dir = miniAddon();
	const keys = extractKeys(dir);
	const out = updateLocaleText({ text: GERMAN, file: 'deDE.lua', keys });
	assert.equal(out.text, `-- German (deDE). Hand-written header.

local _, ns = ...
if not (GetLocale and GetLocale() == "deDE") then return end
local L = ns.L

-- Main.lua
L["Hello %s"] = "Hallo %s"
-- L["Bye"] = ""

-- Main.lua (the slot)
L["slot: Back"] = "Rücken"
-- L["New in Main"] = ""

-- UI/Window.lua
-- L["Close the window"] = ""

-- No longer in the code (its English changed or it went away): reuse or delete.
-- L["Gone"] = "Weg"
`);
	assert.deepEqual(out.added, ['New in Main', 'Close the window']);
	assert.deepEqual(out.retired, ['Gone']);
	assert.deepEqual(out.dropped, ['Gone too']);
	assert.equal(updateLocaleText({ text: out.text, file: 'deDE.lua', keys }).text, out.text, 'a second sync changes nothing');
});

test('a new file has every key commented out under its file; filled keys are translated and unknown ones retired', () => {
	const dir = miniAddon();
	const out = newLocaleText({ locale: 'frFR', keys: extractKeys(dir), fill: { Bye: 'Au revoir' }, retire: { Old: 'Vieux' } });
	assert.equal(out.text, `-- French (frFR): Polestar's interface strings.
-- Keys are the English strings exactly as the code writes them; a key
-- missing here, or commented out, shows in English. Grouped by the file that
-- first uses each key. docs/TRANSLATING.md explains the rest.

local _, ns = ...
if not (GetLocale and GetLocale() == "frFR") then return end
local L = ns.L

-- Main.lua
-- L["Hello %s"] = ""
L["Bye"] = "Au revoir"
-- L["New in Main"] = ""
-- L["slot: Back"] = ""

-- UI/Window.lua
-- L["Close the window"] = ""

-- No longer in the code (its English changed or it went away): reuse or delete.
-- L["Old"] = "Vieux"
`);
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
	assert.deepEqual(out.locales.map((l) => [l.locale, l.status]), LOCALE_CODES.map((l) => [l, LOCALES[l].status]));
	const de = out.locales.find((l) => l.locale === 'deDE');
	assert.deepEqual(de.translators, ['thecodingcortex']);
	assert.ok(de.file && de.translated > 1000 && de.translated <= out.keys);
});

test('every shipped interface file loads, has no stale key or key set twice, and keeps the English formats', () => {
	assert.deepEqual(shipped, ['deDE', 'esMX']);
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
