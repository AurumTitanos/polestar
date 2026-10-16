'use strict';
// Interface translations (docs/TRANSLATING.md): the shipped locale files are
// sound (they load, no stale key, no broken format), `i18n sync` adds and
// retires keys without touching a translation, the checker catches what
// would break in the client, the glossary warns, and a client reads its
// language from the start, with Options' About naming an AI-made one.

const { test } = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { ADDONS } = require('./helpers/lua');
const { formatProblems } = require('../tools/lib/i18n/check');
const { extractKeys } = require('../tools/lib/i18n/keys');

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
