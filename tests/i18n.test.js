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
const { ADDONS } = require('./helpers/lua');
const { tmpdir } = require('./helpers/tmp');
const { formatProblems } = require('../tools/lib/i18n/check');
const { extractKeys } = require('../tools/lib/i18n/keys');
const { readLocaleFiles, updateLocaleText, newLocaleText } = require('../tools/lib/i18n/files');

const POLESTAR = path.join(ADDONS, 'Polestar');

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
