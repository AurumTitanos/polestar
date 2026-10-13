'use strict';
// consume/wowsims: EP parsing, stat mapping, normalization, gear presets and
// an offline read of a fixture cache (synthetic numbers in wowsims' layout).

const { test } = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const fs = require('node:fs');
const ws = require('../tools/lib/consume/wowsims');
const { tmpdir } = require('./helpers/tmp');

const CACHE = path.join(__dirname, 'fixtures/consume/wowsims/cache');

test('parseSimTs reads epWeights stats, pseudo-stats and the reference stat', () => {
	const src = [
		'epReferenceStat: Stat.StatAttackPower,',
		'epWeights: Stats.fromMap(',
		'\t{',
		'\t\t[Stat.StatStrength]: 2.51,',
		'\t\t// [Stat.StatAgility]: 9,',
		'\t\t[Stat.StatMeleeHit]: 28.67,',
		'\t\t[Stat.StatMeleeCrit]: .5,',
		'\t},',
		'\t{ [PseudoStat.PseudoStatMainHandDps]: 11.92 },',
		'),',
		'consumes: Stats.fromMap({ [Stat.StatStamina]: 3 }),',
	].join('\n');
	assert.deepEqual(ws.parseSimTs(src), {
		raw: { StatStrength: 2.51, StatMeleeHit: 28.67, StatMeleeCrit: 0.5, PseudoStatMainHandDps: 11.92 },
		reference: 'StatAttackPower',
	});
	assert.equal(ws.parseSimTs('no weights here'), null);
});

test('mapWeights maps wowsims stats to Polestar keys and drops the rest', () => {
	const raw = {
		StatStrength: 2, StatAttackPower: 1, StatRangedAttackPower: 1, StatMeleeHit: 20, StatSpellHit: 10,
		StatMeleeCrit: 15, StatSpellCrit: 12, StatDefense: 4, StatBlockValue: 1, StatMP5: 2, StatFirePower: 0.5,
		StatSpellPower: 1, StatSpellDamage: 1, StatBonusArmor: 0.2, StatMeleeHaste: 9, StatIntellect: 0,
		PseudoStatMainHandDps: 8, PseudoStatOffHandDps: 3, PseudoStatRangedDps: 5,
	};
	const dps = ws.mapWeights(raw);
	assert.deepEqual(dps.weights, {
		str: 2, ap: 1, rap: 1, hit: 20, spellHit: 10, crit: 15, spellCrit: 12, defense: 4, blockValue: 1,
		mp5: 2, spFire: 0.5, sp: 1, dps: 8, rdps: 5,
	});
	assert.deepEqual(dps.dropped, { StatSpellDamage: 1, StatBonusArmor: 0.2, StatMeleeHaste: 9, PseudoStatOffHandDps: 3 });
	// Healers: wowsims spell power (damage+healing) is Polestar heal.
	const heal = ws.mapWeights({ StatSpellPower: 1, StatIntellect: 0.5 }, { healer: true });
	assert.deepEqual(heal.weights, { heal: 1, int: 0.5 });
});

test('normalize scales the main stat to 1, falling back to the reference', () => {
	assert.deepEqual(ws.normalize({ str: 2.5, ap: 1, hit: 25 }, 'str', 'ap'), { weights: { str: 1, ap: 0.4, hit: 10 }, normalizedTo: 'str' });
	assert.deepEqual(ws.normalize({ ap: 2, hit: 30 }, 'str', 'ap'), { weights: { ap: 1, hit: 15 }, normalizedTo: 'ap' });
	assert.deepEqual(ws.normalize({ sp: 1, spellHit: 1 / 3 }, 'sp', 'sp').weights, { sp: 1, spellHit: 0.3333 });
	assert.equal(ws.normalize({ hit: 3 }, 'str', 'ap'), null);
});

test('percentScale separates Classic per-% EP from WotLK per-rating defaults', () => {
	assert.equal(ws.percentScale({ StatAttackPower: 1, StatMeleeHit: 28.67, StatMeleeCrit: 25.1 }, 'StatAttackPower'), 28.67);
	assert.equal(ws.percentScale({ StatAttackPower: 1, StatMeleeHit: 0.79, StatMeleeCrit: 2.12 }, 'StatAttackPower'), 2.12);
	// A sub-1 reference (tank sets scaled to stamina) is not divided out.
	assert.equal(ws.percentScale({ StatAttackPower: 0.32, StatMeleeHit: 1.432 }, 'StatAttackPower'), 1.432);
	assert.equal(ws.percentScale({ StatStrength: 1 }, 'StatAttackPower'), null);
});

test('gear presets: labels, phases and slot order', () => {
	const presets = [
		"import P0BISGear from './gear_sets/p0.bis.gear.json';",
		"import Phase2Gear from './gear_sets/phase_2.gear.json';",
		"export const A = PresetUtils.makePresetGear('Pre-BiS', P0BISGear);",
		"export const B = PresetUtils.makePresetGear('Phase 2', Phase2Gear);",
		"export const C = PresetUtils.makePresetGear('Missing', NotImported);",
	].join('\n');
	assert.deepEqual(ws.parseGearPresets(presets), [{ label: 'Pre-BiS', file: 'p0.bis.gear.json' }, { label: 'Phase 2', file: 'phase_2.gear.json' }]);
	assert.equal(ws.gearPhase('P3 BiS'), 3);
	assert.equal(ws.gearPhase('Phase 6'), 6);
	assert.equal(ws.gearPhase('Backstab P2 BiS'), 2);
	assert.equal(ws.gearPhase('Pre-BIS'), 0);
	assert.equal(ws.gearPhase('MC'), 1);
	assert.equal(ws.gearPhase('Odd'), null);
	const items = ws.parseGearSet({ items: [{ id: 1 }, {}, { id: 3, enchant: 9 }, ...Array(11).fill({}), { id: 15 }, { id: 0 }, { id: 17 }] });
	assert.deepEqual(items, { head: 1, shoulder: 3, mainhand: 15, ranged: 17 });
	assert.equal(ws.SLOTS.length, 17);
});

test('readWowsims reads a fixture cache without the network', async t => {
	t.mock.method(globalThis, 'fetch', () => {
		throw new Error('network used');
	});
	const r = await ws.readWowsims({ cacheDir: CACHE });

	assert.equal(r.meta.source, 'wowsims');
	assert.equal(r.meta.licence, 'MIT');
	assert.equal(r.meta.fetched, '2026-10-12T00:00:00.000Z');
	assert.equal(r.meta.commits.classic, ws.CLASSIC_HEAD);

	const fury = r.weights.WARRIOR.fury;
	assert.deepEqual(fury.map(e => [e.level, e.phase, e.origin]), [[50, 'sod-p3', 'sod'], [60, 'era', 'era']]);
	assert.deepEqual(r.weights.WARRIOR.arms, fury);
	const era = fury[1];
	assert.deepEqual(era.weights, { str: 1, agi: 0.75, ap: 0.5, hit: 10, crit: 8, dps: 4 });
	assert.equal(era.normalizedTo, 'str');
	assert.equal(era.runeInfluenced, false);
	assert.equal(era.file, 'ui/warrior/sim.ts');
	assert.deepEqual(era.dropped, { StatFireResistance: 0.5, PseudoStatOffHandDps: 3 });
	assert.equal(fury[0].runeInfluenced, true);
	assert.equal(fury[0].weights.hit, 8);

	const holy = r.weights.PALADIN.holy[0];
	assert.equal(holy.normalizedTo, 'heal');
	assert.deepEqual(holy.weights, { int: 0.5, spi: 0.25, heal: 1, spellCrit: 5, mp5: 2 });

	assert.deepEqual(r.rejected.map(x => [x.sim, x.phase]), [['warrior', 'sod-p1']]);
	assert.match(r.rejected[0].reason, /WotLK per-rating/);
	assert.deepEqual(r.rejected[0].targets, ['WARRIOR.arms', 'WARRIOR.fury']);

	const sets = r.gearSets.WARRIOR.fury;
	assert.deepEqual(Object.keys(sets), ['Pre-BiS', 'P1 BiS']);
	assert.deepEqual(sets['Pre-BiS'].items, { head: 1001, neck: 1002, back: 1004 });
	assert.equal(sets['P1 BiS'].phase, 1);
	assert.equal(sets['P1 BiS'].level, 60);
	assert.equal(Object.keys(sets['P1 BiS'].items).length, 17);
	assert.equal(sets['P1 BiS'].items.ranged, 2016);
	assert.equal(sets['P1 BiS'].file, 'ui/warrior/gear_sets/phase_1.gear.json');

	const unmapped = Object.fromEntries(r.unmapped.map(u => [u.stat, u.sets]));
	assert.deepEqual(unmapped, { StatFireResistance: 1, PseudoStatOffHandDps: 1, StatMeleeHaste: 1 });
});

test('readWowsims without a cache asks for a fetch', async () => {
	const empty = tmpdir('wowsims-');
	await assert.rejects(ws.readWowsims({ cacheDir: empty }), /fetch: true/);
});
