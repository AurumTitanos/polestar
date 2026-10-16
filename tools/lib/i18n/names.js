'use strict';
// `i18n names`: the quest, NPC, object and item names of Polestar's data in
// each client language, as one load-on-demand addon per language,
// addon/Polestar_Names_<locale> (docs/ARCHITECTURE.md, "Names"; the runtime
// side is addon/Polestar/Core/Names.lua).
//
// Sources, first one with a name wins:
//   1. DingDB (Ding/DB/Locales/<locale>.lua of Ding! by Yendi, GPL-3.0, used
//      with his permission: THIRD_PARTY.md), cloned into data/sources/ding
//      and pinned: the checkout must sit at DING.commit and every file must
//      have the sha256 below, or the build stops. Moving the pin is an edit
//      here, after reading what changed. Its base data comes from QuestieDB,
//      so --no-questie leaves it out.
//   2. pfQuest's db/<locale> (MIT; Era names, no esMX), the cache clone
//      `data build` uses (data/sources/pfQuest), for the names DingDB lacks.
//      A pfQuest name equal to its English one is no translation and is
//      skipped.
// Only the ids Polestar's data names are kept: the compiled guides
// (addon/Polestar_Guides/Guides.lua), the quest database
// (addon/Polestar_QuestDB) and the Codex's data (data/forever/codex).

const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { luaToJson } = require('../lua');
const { header } = require('../generated');
const { checkLicense, REPO: PFQUEST_REPO } = require('../data/pfquest');
const { ROOT, DATA, SOURCES } = require('../paths');
const { luaString } = require('./files');
const { LOCALES, LOCALE_CODES } = require('./locales');

const NAME_KINDS = ['quest', 'npc', 'object', 'item'];
const ADDON_PREFIX = 'Polestar_Names_';
const CHUNK = 1000; // names per add() call

// DingDB at Ding v1.8.1. CREDITS.md ships beside the names.
const DING = {
	repo: 'https://github.com/moust4ki/DingGuideWoWForever',
	version: 'v1.8.1',
	commit: 'fb0a06a43d054ab53b67e8d7af9743a9f8953ac3',
	files: {
		'Ding/DB/CREDITS.md': 'd32ce3d857766e88d0afd94d39eb0d4e3317ccc5538a46720f0ac743dfd64ab9',
		'Ding/DB/Locales/deDE.lua': 'a2f4ebd5caaadf07c1704c494b3a41442211298d61f527201eb0ab4af2d7d1ec',
		'Ding/DB/Locales/esES.lua': '6bcc8a55f21723c641f7b8daa275649c548ea3eb08df3793197e75c4579ecf66',
		'Ding/DB/Locales/esMX.lua': '380da93d12f47ede6b8e248a8d8096431de6a8865e9cd5cf8ff775cb78a90ceb',
		'Ding/DB/Locales/frFR.lua': '5ba47c1ed481e9367c283adab21296103a63c3abe18dcfe7719e44f2d57d2469',
		'Ding/DB/Locales/koKR.lua': '8efe170a161c47ed64b1e4d0c9048773f6e2ce594906e95fa005c63940375f45',
		'Ding/DB/Locales/ptBR.lua': 'e9c320db5293eabf638158daae947585878811e7ec493fa5763759c83f1cd1dd',
		'Ding/DB/Locales/ruRU.lua': '3a7ec4e35701a690282ed0b5ec91240c8c7c62b1f0a32d0000e780f5d52f8636',
		'Ding/DB/Locales/zhCN.lua': 'c159cf9b6e2f4aa644fde6afc801168faf44273a4358ff7859ef3be5f9139646',
		'Ding/DB/Locales/zhTW.lua': '61fb6753b026f50314583cd6cbd90eb5e2332c839d0de2ab2eb4122756312b4b',
	},
};
const CREDITS = 'Ding/DB/CREDITS.md';
const dingFile = (locale) => `Ding/DB/Locales/${locale}.lua`;

const DEFAULTS = {
	ding: path.join(SOURCES, 'ding'),
	pfquest: path.join(SOURCES, 'pfQuest'),
	guides: path.join(ROOT, 'addon', 'Polestar_Guides', 'Guides.lua'),
	questdb: path.join(ROOT, 'addon', 'Polestar_QuestDB'),
	codex: path.join(DATA, 'codex'),
	out: path.join(ROOT, 'addon'),
};

const sha256 = (file) => crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');

function git(args, cwd) {
	return spawnSync('git', args, { cwd, encoding: 'utf8' });
}

// The commit a checkout rooted at dir is at, or null (not a checkout of its own).
function revisionOf(dir) {
	const top = git(['rev-parse', '--show-toplevel'], dir);
	if (top.status !== 0 || fs.realpathSync(top.stdout.trim()) !== fs.realpathSync(dir)) return null;
	const rev = git(['rev-parse', 'HEAD'], dir);
	return rev.status === 0 ? rev.stdout.trim() : null;
}

// Clones DingDB into dir when it is not there (not with `explicit`, a folder
// the user named, or `offline`), moves the cache clone to the pinned commit,
// and checks every pinned file's sha256. A named folder is used as it is: at
// another commit, or with a file that differs, it stops the build.
// -> { dir, revision (null for a folder that is no checkout), pin, files: [{ path, sha256 }] }
function ensureDing({ dir = DEFAULTS.ding, explicit = false, offline = false, pin = DING, log = () => {} } = {}) {
	if (!fs.existsSync(path.join(dir, 'Ding', 'DB'))) {
		if (explicit) throw new Error(`DingDB: ${dir} has no Ding/DB folder`);
		if (offline) throw new Error(`--offline: no cached DingDB at ${dir} (run once without --offline)`);
		log(`cloning ${pin.repo} into ${dir}`);
		fs.mkdirSync(path.dirname(dir), { recursive: true });
		const r = git(['clone', '--quiet', pin.repo, dir]);
		if (r.status !== 0) throw new Error(`git clone ${pin.repo} failed: ${(r.stderr || r.error || '').toString().trim()}`);
	}
	let revision = revisionOf(dir);
	if (!explicit && !revision) throw new Error(`DingDB: ${dir} is not a git checkout; delete it to clone again, or pass --ding <dir>`);
	if (revision && revision !== pin.commit) {
		if (explicit) throw new Error(`DingDB: ${dir} is at ${revision}, the pin is ${pin.commit} (${pin.version}): check that out, or move the pin (DING in tools/lib/i18n/names.js)`);
		let r = git(['-c', 'advice.detachedHead=false', 'checkout', '--quiet', pin.commit], dir);
		if (r.status !== 0 && !offline) {
			log(`fetching ${pin.repo} for ${pin.commit}`);
			git(['fetch', '--quiet', 'origin'], dir);
			r = git(['-c', 'advice.detachedHead=false', 'checkout', '--quiet', pin.commit], dir);
		}
		if (r.status !== 0) throw new Error(`DingDB: cannot check out ${pin.commit} in ${dir}: ${(r.stderr || '').trim()}`);
		revision = revisionOf(dir);
	}
	const files = [];
	for (const rel of Object.keys(pin.files).sort()) {
		const file = path.join(dir, rel);
		if (!fs.existsSync(file)) throw new Error(`DingDB: ${rel} is missing from ${dir}`);
		const got = sha256(file);
		if (got !== pin.files[rel]) {
			throw new Error(`DingDB: ${rel} has sha256 ${got}, the pin (${pin.version}, ${pin.commit.slice(0, 7)}) says ${pin.files[rel]}: read what changed, then move the pin (DING in tools/lib/i18n/names.js)`);
		}
		files.push({ path: rel, sha256: got });
	}
	return { dir, revision, pin, files };
}

const emptyKinds = () => Object.fromEntries(NAME_KINDS.map((k) => [k, new Map()]));

// DingDB's names of each locale whose file the pin lists, read by Lua the way
// Ding loads them (the file returns at once unless GetLocale() is its
// language). -> { [locale]: { quest, npc, object, item: Map id -> name } }
function readDing(ding, locales) {
	const out = {};
	for (const l of locales) out[l] = emptyKinds();
	const wanted = locales.filter((l) => ding.pin.files[dingFile(l)]);
	if (!wanted.length) return out;
	const calls = wanted.map((l) => `read(${luaString(path.join(ding.dir, dingFile(l)))}, ${luaString(l)})`).join('\n');
	const raw = luaToJson({
		expr: `
local out = {}
local function list(t)
  local l = {}
  for id, name in pairs(t) do
    if type(id) == "number" and type(name) == "string" then l[#l + 1] = { id, name } end
  end
  return l
end
local function read(file, locale)
  GetLocale = function() return locale end
  local Ding = { DB = { names = { quests = {}, npcs = {}, objects = {}, items = {} } } }
  local ok, err = __polestar_loaddata(file, "Ding", Ding)
  if not ok then error(err, 0) end
  local n = Ding.DB.names
  out[locale] = { quest = list(n.quests), npc = list(n.npcs), object = list(n.objects), item = list(n.items) }
end
${calls}
return out`,
	});
	for (const l of wanted) {
		for (const kind of NAME_KINDS) {
			const list = Array.isArray(raw[l] && raw[l][kind]) ? raw[l][kind] : [];
			for (const [id, name] of list.sort((a, b) => a[0] - b[0])) out[l][kind].set(Number(id), name);
		}
	}
	return out;
}

// --- The ids Polestar's data names -------------------------------------------

const LIST = `
local function list(set)
  local l = {}
  for id in pairs(set) do l[#l + 1] = id end
  table.sort(l)
  return l
end
return { quest = list(__ids.quest), npc = list(__ids.npc), object = list(__ids.object), item = list(__ids.item) }`;

// Every compiled guide's goals, candidates, reagents and rewards: the keys
// quest, npc, object and item, the quests of pre, preAll and closedBy (one id
// or a list) and of preTitles (its keys).
const GUIDE_WALK = `
__ids = { quest = {}, npc = {}, object = {}, item = {} }
local KIND = { quest = "quest", npc = "npc", object = "object", item = "item" }
local QUESTS = { pre = true, preAll = true, closedBy = true }
local function add(kind, v) if type(v) == "number" then __ids[kind][v] = true end end
local function walk(t)
  for k, v in pairs(t) do
    if KIND[k] then add(KIND[k], v)
    elseif QUESTS[k] then
      if type(v) == "table" then for _, q in ipairs(v) do add("quest", q) end else add("quest", v) end
    elseif k == "preTitles" and type(v) == "table" then
      for q in pairs(v) do add("quest", q) end
    end
    if type(v) == "table" then walk(v) end
  end
end
Polestar = { RegisterGuide = function(g) if type(g) == "table" then walk(g) end return true end }
`;

const QUESTDB_ADD = `
__ids = { quest = {}, npc = {}, object = {}, item = {} }
local KIND = { quests = "quest", npcs = "npc", objects = "object", items = "item" }
Polestar = { QuestDB = { AddData = function(kind, records)
  local into = KIND[kind] and __ids[KIND[kind]]
  if into and type(records) == "table" then for id in pairs(records) do if type(id) == "number" then into[id] = true end end end
end } }
`;

const QUESTDB_FILES = ['Quests.lua', 'Npcs.lua', 'Objects.lua', 'Items.lua'];
const CODEX_FILES = { quest: 'quests.json', npc: 'npcs.json', object: 'objects.json', item: 'items.json' };

function toSets(raw) {
	return Object.fromEntries(NAME_KINDS.map((k) => [k, new Set((Array.isArray(raw[k]) ? raw[k] : []).map(Number))]));
}

// { guides: Guides.lua, questdb: addon folder, codex: data/forever/codex }
// -> { quest, npc, object, item: Set of ids, counts: { guides, questdb, codex: { kind: n } } }
function usedIds({ guides = DEFAULTS.guides, questdb = DEFAULTS.questdb, codex = DEFAULTS.codex } = {}) {
	if (!fs.existsSync(guides)) throw new Error(`no compiled guides at ${guides}: run node tools/polestar.js compile, or pass --guides <Guides.lua>`);
	const qFiles = QUESTDB_FILES.map((f) => path.join(questdb, f));
	if (qFiles.some((f) => !fs.existsSync(f))) {
		throw new Error(`the quest database is not built (no ${path.join(questdb, 'Quests.lua')}): run node tools/polestar.js questdb build, or pass --questdb <Polestar_QuestDB folder>`);
	}
	const cFiles = Object.fromEntries(Object.entries(CODEX_FILES).map(([k, f]) => [k, path.join(codex, f)]));
	if (Object.values(cFiles).some((f) => !fs.existsSync(f))) {
		throw new Error(`the Codex data is not built (no ${cFiles.quest}): run node tools/polestar.js codex build, or pass --codex <data/forever/codex folder>`);
	}
	const sources = {
		guides: toSets(luaToJson({ files: [guides], prelude: GUIDE_WALK, expr: LIST })),
		questdb: toSets(luaToJson({ files: qFiles, prelude: QUESTDB_ADD, expr: LIST })),
		codex: Object.fromEntries(Object.entries(cFiles).map(([k, f]) => [k, new Set(Object.keys(JSON.parse(fs.readFileSync(f, 'utf8'))).map(Number).filter(Number.isFinite))])),
	};
	const out = { counts: {} };
	for (const kind of NAME_KINDS) out[kind] = new Set();
	for (const [src, sets] of Object.entries(sources)) {
		out.counts[src] = {};
		for (const kind of NAME_KINDS) {
			out.counts[src][kind] = sets[kind].size;
			for (const id of sets[kind]) out[kind].add(id);
		}
	}
	return out;
}

// --- Merging ------------------------------------------------------------------

const clean = (s) => (typeof s === 'string' ? s.trim() : '');

// ding: readDing's result or null (--no-questie); pf: loadPfQuestNames' with
// enUS among its locales. -> { [locale]: { names: { kind: Map id -> name }
// (sorted by id), from: { kind: { ding, pfquest } } } }
function buildNames({ locales = LOCALE_CODES, ids, ding = null, pf = null }) {
	const out = {};
	const en = pf && pf.enUS;
	for (const locale of locales) {
		const d = ding && ding[locale];
		const p = pf && pf[locale];
		const names = emptyKinds();
		const from = Object.fromEntries(NAME_KINDS.map((k) => [k, { ding: 0, pfquest: 0 }]));
		for (const kind of NAME_KINDS) {
			for (const id of [...ids[kind]].sort((a, b) => a - b)) {
				let name = clean(d && d[kind].get(id));
				let src = 'ding';
				if (!name) {
					const pn = clean(p && p[kind].get(id));
					if (pn && !(en && clean(en[kind].get(id)) === pn)) {
						name = pn;
						src = 'pfquest';
					}
				}
				if (!name) continue;
				names[kind].set(id, name);
				from[kind][src]++;
			}
		}
		out[locale] = { names, from };
	}
	return out;
}

const total = (built) => NAME_KINDS.reduce((n, k) => n + built.names[k].size, 0);

// --- Output -------------------------------------------------------------------

function sourceLabel(sources) {
	const parts = [];
	if (sources.ding) parts.push(`DingDB ${sources.ding.pin.version}`);
	parts.push(`pfQuest${sources.pf && sources.pf.revision ? ` ${sources.pf.revision.slice(0, 7)}` : ''}`);
	return parts.join(' and ');
}

function licenseText(locale, built, sources) {
	const { language } = LOCALES[locale];
	const counts = (src) => NAME_KINDS.map((k) => `${built.from[k][src]} ${k === 'npc' ? 'NPC' : k}${built.from[k][src] === 1 ? '' : 's'}`).join(', ');
	const out = [
		`Polestar names (${locale}): third-party notices`,
		'='.repeat(`Polestar names (${locale}): third-party notices`.length),
		'',
		`The quest, NPC, object and item names in this folder are the game's names in`,
		`${language}, for Polestar's guides. Names and texts of the game belong to`,
		'Blizzard Entertainment. They come from the sources below, the first one',
		'with a name winning.',
		'',
	];
	const { ding, pf } = sources;
	if (ding) {
		out.push('DingDB, the game database of Ding! by Yendi (@moust4ki)', '-------------------------------------------------------');
		out.push(`URL: ${ding.pin.repo}`, `Version: ${ding.pin.version}, commit ${ding.pin.commit}`);
		for (const f of ding.files.filter((x) => x.path === dingFile(locale) || x.path === CREDITS)) out.push(`File: ${f.path} (sha256 ${f.sha256})`);
		out.push(
			'License: GPL-3.0 (Copyright Yendi), used in Polestar with his permission',
			'(THIRD_PARTY.md in the Polestar repository).',
			`Names taken: ${counts('ding')}.`,
			'DingDB\'s base data is generated from Questie and QuestieDB: see CREDITS.md',
			'beside this file.',
			'',
		);
	} else {
		out.push('Built with --no-questie: no names from DingDB (whose base data comes from', 'QuestieDB).', '');
	}
	out.push('pfQuest database by Shagu', '-------------------------');
	out.push(`URL: ${PFQUEST_REPO}`);
	if (pf && pf.revision) out.push(`Revision: ${pf.revision}`);
	out.push(`Files: db/${locale}/{quests,units,objects,items}.lua`, 'License: MIT', `Names taken: ${counts('pfquest')}${ding ? ' (the ones DingDB lacks)' : ''}.`);
	const notice = pf && pf.dir ? checkLicense(pf.dir).notice : null;
	if (notice) out.push('', notice);
	out.push('');
	return out.join('\n');
}

// One language's addon folder: { file name: text }.
function emitNamesAddon(locale, built, { version = require('../../../package.json').version, iface = null, sources }) {
	const { coreInterface } = require('../dsl/project');
	const { language } = LOCALES[locale];
	const name = `${ADDON_PREFIX}${locale}`;
	const from = sourceLabel(sources);
	const files = {};
	files[`${name}.toc`] = [
		`## Interface: ${iface || coreInterface()}`,
		`## Title: Polestar Names (${locale})`,
		`## Notes: Quest, NPC, object and item names in ${language} for Polestar's guides. Loaded on demand on a ${language} client.`,
		'## Author: Polestar',
		'## X-License: GPL-3.0-only',
		`## Version: ${version}`,
		'## Category: Quests',
		'## LoadOnDemand: 1',
		'## Dependencies: Polestar',
		'',
		'Names.lua',
		'',
	].join('\n');
	const lines = [
		header('lua', 'i18n names', from),
		`-- Quest, NPC, object and item names in ${language} (${locale}) for Polestar.Names`,
		'-- (addon/Polestar/Core/Names.lua). Sources and licences: LICENSE-DATA.txt.',
		'',
		'local add = Polestar and Polestar.Names and Polestar.Names.Add',
		'if not add then return end',
		'',
	];
	for (const kind of NAME_KINDS) {
		const entries = [...built.names[kind]];
		for (let i = 0; i < entries.length; i += CHUNK) {
			lines.push(`add(${luaString(locale)}, ${luaString(kind)}, {`);
			for (const [id, n] of entries.slice(i, i + CHUNK)) lines.push(`[${id}]=${luaString(n)},`);
			lines.push('})');
		}
	}
	files['Names.lua'] = lines.join('\n') + '\n';
	files['LICENSE-DATA.txt'] = licenseText(locale, built, sources);
	if (sources.ding) files['CREDITS.md'] = fs.readFileSync(path.join(sources.ding.dir, CREDITS), 'utf8');
	return files;
}

// Writes each language with names into addonsDir/Polestar_Names_<locale>
// (files the folder no longer gets are removed) and removes the folder of a
// language left without any. -> [{ locale, dir, bytes }] for those written.
function writeNamesAddons(out, addonsDir, { sources, version, iface } = {}) {
	const written = [];
	for (const locale of Object.keys(out).sort()) {
		const dir = path.join(addonsDir, `${ADDON_PREFIX}${locale}`);
		if (total(out[locale]) === 0) {
			fs.rmSync(dir, { recursive: true, force: true });
			continue;
		}
		const files = emitNamesAddon(locale, out[locale], { sources, version, iface });
		fs.mkdirSync(dir, { recursive: true });
		for (const f of fs.readdirSync(dir)) if (!(f in files)) fs.rmSync(path.join(dir, f), { recursive: true, force: true });
		let bytes = 0;
		for (const [f, text] of Object.entries(files)) {
			fs.writeFileSync(path.join(dir, f), text);
			bytes += Buffer.byteLength(text);
		}
		written.push({ locale, dir, bytes, luaBytes: Buffer.byteLength(files['Names.lua']) });
	}
	return written;
}

module.exports = {
	DING, NAME_KINDS, ADDON_PREFIX, DEFAULTS,
	ensureDing, readDing, usedIds, buildNames, emitNamesAddon, writeNamesAddons, total,
};
