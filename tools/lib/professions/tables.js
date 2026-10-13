'use strict';
// Blizzard client tables (DB2 as CSV from wago.tools) that describe the
// professions, cached per build next to the map tables of `data build`
// (<sources>/wago/<build>/<Table>.csv; a cached build is immutable, so a
// present file is never fetched again).
//
// Columns used (inspected on wow_classic_era 1.15.9.70003, 2026-10):
//   SkillLine            ID, DisplayName_lang, CategoryID (11 profession, 9 secondary)
//   SkillLineAbility     SkillLine, Spell, AcquireMethod (1 = known with the skill),
//                        TrivialSkillLineRankLow (yellow), TrivialSkillLineRankHigh (grey),
//                        MinSkillLineRank, NumSkillUps, RaceMask_0, ClassMask
//   SpellName            ID, Name_lang
//   SpellEffect          SpellID, DifficultyID, Effect (24 create item, 36 learn spell,
//                        53 enchant item, 118 skill), EffectItemType, EffectBasePoints,
//                        EffectDieSides, EffectTriggerSpell, EffectMiscValue_0
//   SpellReagents        SpellID, Reagent_0..7, ReagentCount_0..7
//   SpellTotems          SpellID, Totem_0..1 (tools such as Blacksmith Hammer)
//   SpellCastingRequirements SpellID, RequiresSpellFocus -> SpellFocusObject (Anvil, Forge...)
//   ItemSparse           ID, Display_lang, BuyPrice, SellPrice, VendorStackCount,
//                        OverallQualityID, RequiredSkill, RequiredSkillRank, RequiredAbility
//   Item                 ID, ClassID (9 = recipe)
//   ItemEffect           ParentItemID, SpellID (a recipe item's learn spell)

const fs = require('node:fs');
const path = require('node:path');
const { parseCsv } = require('../data/csv');
const { compareVersions, tableUrl, PRODUCT, PRODUCTS, BUILDS_URL } = require('../data/wago');

const TABLES = [
	'SkillLine',
	'SkillLineAbility',
	'SpellName',
	'SpellEffect',
	'SpellReagents',
	'SpellTotems',
	'SpellCastingRequirements',
	'SpellFocusObject',
	'ItemSparse',
	'Item',
	'ItemEffect',
];

function hasAll(dir, tables) {
	return tables.every((t) => fs.existsSync(path.join(dir, `${t}.csv`)));
}

// Classic Era builds only: data/sources/wago also caches Forever (1.60) builds.
function newestCachedBuild(cacheRoot, tables) {
	if (!fs.existsSync(cacheRoot)) return null;
	const builds = fs
		.readdirSync(cacheRoot)
		.filter((b) => /^\d+(\.\d+)+$/.test(b) && PRODUCTS.era.family.test(b) && hasAll(path.join(cacheRoot, b), tables))
		.sort(compareVersions);
	return builds.length ? builds[builds.length - 1] : null;
}

async function fetchText(fetchImpl, url) {
	const res = await fetchImpl(url, { headers: { 'user-agent': 'polestar-data-build' } });
	if (!res.ok) throw new Error(`GET ${url}: HTTP ${res.status}`);
	return res.text();
}

async function latestBuild(fetchImpl) {
	const builds = JSON.parse(await fetchText(fetchImpl, BUILDS_URL));
	const list = Array.isArray(builds[PRODUCT]) ? builds[PRODUCT].map((b) => b.version).filter((v) => v && PRODUCTS.era.family.test(v)) : [];
	if (!list.length) throw new Error(`${BUILDS_URL}: no ${PRODUCT} builds listed`);
	return list.sort(compareVersions)[list.length - 1];
}

// -> { build, tables: { SkillLine: rows, ... }, urls, warnings }
async function loadTables({ sourcesDir, build, offline = false, fetchImpl = globalThis.fetch, log = () => {}, tables = TABLES }) {
	const cacheRoot = path.join(sourcesDir, 'wago');
	const warnings = [];
	let chosen = build || null;
	if (!chosen) {
		if (offline) {
			chosen = newestCachedBuild(cacheRoot, tables);
			if (!chosen) throw new Error(`--offline: no cached wago.tools build under ${cacheRoot} with ${tables.join(', ')}`);
		} else {
			try {
				chosen = await latestBuild(fetchImpl);
			} catch (err) {
				chosen = newestCachedBuild(cacheRoot, tables);
				if (!chosen) throw err;
				warnings.push(`wago.tools: ${err.message}; using cached build ${chosen}`);
			}
		}
	}
	const dir = path.join(cacheRoot, chosen);
	const out = {};
	const urls = {};
	for (const t of tables) {
		const file = path.join(dir, `${t}.csv`);
		urls[t] = tableUrl(t, chosen);
		if (!fs.existsSync(file)) {
			if (offline) throw new Error(`--offline: missing cached ${path.relative(process.cwd(), file)}`);
			log(`fetching ${urls[t]}`);
			const text = await fetchText(fetchImpl, urls[t]);
			const rows = parseCsv(text);
			if (!rows.length || !('ID' in rows[0])) throw new Error(`${urls[t]}: not a DB2 CSV export`);
			fs.mkdirSync(dir, { recursive: true });
			fs.writeFileSync(`${file}.tmp`, text);
			fs.renameSync(`${file}.tmp`, file);
		}
		out[t] = parseCsv(fs.readFileSync(file, 'utf8'));
	}
	return { build: chosen, tables: out, urls, warnings };
}

module.exports = { loadTables, TABLES };
