'use strict';
// AtlasLoot Classic (GPL-2.0): who drops what, collections, crafting,
// reputation and PvP rewards, as the Forever build of the addon ships them.
// Reads the installed loot modules (only the files each module's
// `<Module>_Forever.toc` loads, as the Forever client does), the drop rates
// (DungeonsAndRaids/droprate.lua) and two core data files the modules lean on
// (Data/Profession.lua: craft spell -> created item and skill; Data/
// Requirements.lua: PvP rank per item). forever.lua (Forever's own dungeons
// and raids, not in the TOC) only adds instances data.lua lacks and marks the
// ones it defines as Forever content. Facts only: ids, names, levels, rates.
//
//   const { readAtlasLoot } = require('./atlasloot');
//   const al = readAtlasLoot();          // the installed copy
//   al.instances[0].bosses[0].items[0]   -> { item, faction?, quest?, price?, chance? }
//
// Output (read by `codex build`, docs/ARCHITECTURE.md "Codex (`codex build`)"):
//   meta        { source, version, licence, modules, files, warnings }
//   instances   [{ key, name, kind, forever, areaId, levels, phase, bosses: [{ name, npc, object?, items }] }]
//   droprates   { "<npcId>": { "<itemId>": percent } }
//   collections [{ group, groupName, section, item, faction }]
//   sets        [{ group, groupName, section, set (ItemSet id), faction }]  (Collections, PvP "Set" tables)
//   crafting    [{ profession, item, spell, skill, group }]
//   factions    [{ factionId, name, rewards: [{ item, standing, faction? }] }]
//   pvp         [{ group, groupName, section, item, faction, rank, honor }]
// Every run treats the client as Classic (AtlasLoot.CLASSIC_VERSION_NUM) and
// reads both faction difficulties, so faction-only rows carry 'A' / 'H'.

const fs = require('node:fs');
const path = require('node:path');
const { resolveAddonsDir } = require('../addons');
const { addonVersion, readAddonLua } = require('./lua');

const CORE = 'AtlasLootClassic';
const MODULES = ['DungeonsAndRaids', 'Collections', 'Crafting', 'Factions', 'PvP'];
// Core data files a module's run loads first (relative to the core folder).
const CORE_FILES = {
	Crafting: ['Data/Profession.lua'],
	PvP: ['Data/Requirements.lua'],
};
const STANDINGS = { hated: 1, hostile: 2, unfriendly: 3, neutral: 4, friendly: 5, honored: 6, revered: 7, exalted: 8 };

// What the data files expect from AtlasLoot's core and the client, as the
// Forever client (Classic game version, both factions' tables) would give it.
const PRELUDE = String.raw`
local AL_VERSION = 1
local function nameOf(prefix, id) return "{" .. prefix .. ":" .. tostring(id) .. "}" end
local function locale() return setmetatable({}, { __index = function(_, k) return k end }) end
POLESTAR_band = function(a, b)
  local r, bitv = 0, 1
  a, b = math.floor(a or 0), math.floor(b or 0)
  while a > 0 and b > 0 do
    if a % 2 == 1 and b % 2 == 1 then r = r + bitv end
    a, b, bitv = math.floor(a / 2), math.floor(b / 2), bitv * 2
  end
  return r
end
POLESTAR_AL = { stores = {}, order = {}, droprates = {} }
local Store = {}
function Store:AddDifficulty(dif, uniqueName)
  local meta = rawget(self, "__al")
  local key = tostring(uniqueName or dif)
  if not meta.diffIndex[key] then
    meta.diffs[#meta.diffs + 1] = { name = tostring(dif), unique = uniqueName and tostring(uniqueName) or nil }
    meta.diffIndex[key] = #meta.diffs
  end
  return meta.diffIndex[key]
end
function Store:AddContentType(typ)
  local meta = rawget(self, "__al")
  local key = tostring(typ)
  if not meta.ctypeIndex[key] then
    meta.ctypes[#meta.ctypes + 1] = key
    meta.ctypeIndex[key] = #meta.ctypes
  end
  return meta.ctypeIndex[key]
end
function Store:AddItemTableType(typ)
  local meta = rawget(self, "__al")
  meta.ttypes[#meta.ttypes + 1] = tostring(typ)
  return #meta.ttypes
end
function Store:AddExtraItemTableType(typ)
  local meta = rawget(self, "__al")
  for i, v in ipairs(meta.extras) do if v == typ then return i + 100 end end
  meta.extras[#meta.extras + 1] = tostring(typ)
  return #meta.extras + 100
end
local storeMt = {
  __index = Store,
  __newindex = function(t, k, v)
    local meta = rawget(t, "__al")
    if rawget(t, k) == nil then meta.order[#meta.order + 1] = k end
    rawset(t, k, v)
  end,
}
local Droprate = {}
function Droprate:AddData(d)
  if type(d) ~= "table" then return end
  for npc, items in pairs(d) do POLESTAR_AL.droprates[npc] = items end
end
function Droprate:GetData(npc, item) local d = POLESTAR_AL.droprates[npc] return d and d[item] end
local ContentPhase = {}
function ContentPhase:GetActivePhase() return 6 end
function ContentPhase:IsActive() return true end
function ContentPhase:GetForItemID() return nil end
function ContentPhase:GetPhaseTexture() return "" end
function ContentPhase:GetPhaseTextureForItemID() return "" end
AtlasLoot = {
  RETAIL_VERSION_NUM = 99, CLASSIC_VERSION_NUM = 1, BC_VERSION_NUM = 2, WRATH_VERSION_NUM = 3,
  CURRENT_VERSION_NUM = AL_VERSION, IS_CLASSIC = true, IS_BC = false, IS_WRATH = false, IS_RETAIL = false,
  Locales = locale(), IngameLocales = locale(),
  Data = {
    Droprate = Droprate,
    ContentPhase = ContentPhase,
    Requirements = { GetPvPRankName = function() return "" end, GetPvPRankIcon = function() return 0 end },
    Profession = { GetColorSkillRankNoSpell = function() return "" end },
  },
  ItemDB = {},
}
function AtlasLoot.ItemDB:Add(addonName)
  local name = tostring(addonName)
  if not POLESTAR_AL.stores[name] then
    local store = { __al = { order = {}, diffs = {}, diffIndex = {}, ctypes = {}, ctypeIndex = {}, ttypes = {}, extras = {} } }
    POLESTAR_AL.stores[name] = setmetatable(store, storeMt)
    POLESTAR_AL.order[#POLESTAR_AL.order + 1] = name
  end
  return POLESTAR_AL.stores[name]
end
function AtlasLoot.ReturnForGameVersion(classic) return classic end
function AtlasLoot:GetGameVersion() return AL_VERSION end
function AtlasLoot:GameVersion_EQ(v, r, f) if AL_VERSION == v then return r or true end return f end
function AtlasLoot:GameVersion_NE(v, r, f) if AL_VERSION ~= v then return r or true end return f end
function AtlasLoot:GameVersion_GT(v, r, f) if AL_VERSION > v then return r or true end return f end
function AtlasLoot:GameVersion_LT(v, r, f) if AL_VERSION < v then return r or true end return f end
function AtlasLoot:GameVersion_GE(v, r, f) if AL_VERSION >= v then return r or true end return f end
function AtlasLoot:GameVersion_LE(v, r, f) if AL_VERSION <= v then return r or true end return f end
function AtlasLoot:GetRetByFaction(horde, alliance) return alliance end
function AtlasLoot:AddInitFunc() end
function AtlasLoot:GetGameVersionDataTable()
  local use = {}
  local data = setmetatable({}, { __newindex = function(_, _, v) for k, x in pairs(v) do use[k] = x end end })
  return use, data
end
POLESTAR_NS.IS_CLASSIC = true
ATLASLOOT_IT_FILTERIGNORE, ATLASLOOT_IT_HORDE, ATLASLOOT_IT_ALLIANCE, ATLASLOOT_IT_AMOUNT1, ATLASLOOT_IT_AMOUNT2 = 900, 901, 902, 903, 904
for _, k in ipairs({ "COLLECTION", "DUNGEON", "FACTION", "PERMRECEVENTS", "PRIMPROFESSION", "PVP", "RAID", "RAID40", "RAID20",
  "REMOVED", "SEASONALEVENTS", "SECPROFESSION", "WORLD_BOSS", "COLLECTIONS", "CLASSPROFESSION", "UNKNOWN", "HORDE", "ALLIANCE" }) do
  _G["ATLASLOOT_" .. k .. "_COLOR"] = { 0, 0, 0, 1 }
end
FACTION_HORDE, FACTION_ALLIANCE, GENERAL, UNKNOWN = "Horde", "Alliance", "General", "Unknown"
for i = 1, 8 do _G["FACTION_STANDING_LABEL" .. i] = ({ "Hated", "Hostile", "Unfriendly", "Neutral", "Friendly", "Honored", "Revered", "Exalted" })[i] end
RAID_CLASS_COLORS = setmetatable({}, { __index = function() return { colorStr = "ffffffff", r = 1, g = 1, b = 1 } end })
WOW_PROJECT_ID, WOW_PROJECT_CLASSIC, WOW_PROJECT_MAINLINE = 2, 2, 1
function UnitFactionGroup() return "Alliance", "Alliance" end
function GetFactionInfoByID(id) return nameOf("faction", id) end
function CreateFrame() return POLESTAR_STUB end
function hooksecurefunc() end
C_Map = { GetAreaInfo = function(id) return nameOf("area", id) end }
C_Spell = { GetSpellTexture = function() return 0 end, GetSpellName = function(id) return nameOf("spell", id) end }
C_Reputation = { GetFactionDataByID = function() return nil end }

-- Dump: plain tables only, numbers as numbers, ids as string keys.
local function sortedNumKeys(t)
  local keys = {}
  for k, v in pairs(t) do if type(k) == "number" and type(v) == "table" then keys[#keys + 1] = k end end
  table.sort(keys)
  return keys
end
local function plainIds(v)
  if type(v) == "number" then return { v } end
  if type(v) ~= "table" then return nil end
  local out = {}
  for k, x in pairs(v) do if type(x) == "number" then out[#out + 1] = x end end
  table.sort(out)
  return #out > 0 and out or nil
end
local function scalar(v) local t = type(v) if t == "number" or t == "string" or t == "boolean" then return v end return nil end
local function dumpRows(dif, extras)
  local rows = {}
  for _, pos in ipairs(sortedNumKeys(dif)) do
    local r = dif[pos]
    local row = { p = scalar(r[1]), c2 = scalar(r[2]), c3 = scalar(r[3]), h = scalar(r[901]), a = scalar(r[902]) }
    for i, name in ipairs(extras) do
      if r[i + 100] ~= nil then row[name] = scalar(r[i + 100]) end
    end
    rows[#rows + 1] = row
  end
  return rows
end
local function dumpBoss(boss, extras)
  local out = {
    name = scalar(boss.name), npc = plainIds(boss.npcID), object = plainIds(boss.ObjectID),
    phase = scalar(boss.ContentPhase), ignore = boss.IgnoreAsSource and true or nil, extra = boss.ExtraList and true or nil,
    tt = scalar(boss.TableType), diffs = {},
  }
  for _, d in ipairs(sortedNumKeys(boss)) do
    local dif = boss[d]
    out.diffs[#out.diffs + 1] = { d = d, tt = scalar(dif.TableType), from = scalar(dif.GetItemsFromDiff), rows = dumpRows(dif, extras) }
  end
  return out
end
function POLESTAR_dumpStore(name)
  local store = POLESTAR_AL.stores[name]
  if not store then return nil end
  local meta = rawget(store, "__al")
  local contents = {}
  for _, key in ipairs(meta.order) do
    local c = rawget(store, key)
    if type(c) == "table" then
      local bosses = {}
      if type(c.items) == "table" then
        for _, i in ipairs(sortedNumKeys(c.items)) do bosses[#bosses + 1] = dumpBoss(c.items[i], meta.extras) end
      end
      local levels
      if type(c.LevelRange) == "table" then levels = { c.LevelRange[1], c.LevelRange[2], c.LevelRange[3] } end
      contents[#contents + 1] = {
        key = tostring(key), name = scalar(c.name), ctype = c.ContentType and meta.ctypes[c.ContentType] or nil,
        areaId = scalar(c.MapID), instanceId = scalar(c.InstanceID), levels = levels, phase = scalar(c.ContentPhase),
        factionId = scalar(c.FactionID), gv = scalar(c.gameVersion),
        tt = scalar(c.TableType), itt = type(c.items) == "table" and scalar(c.items.TableType) or nil,
        bosses = bosses,
      }
    end
  end
  return { contents = contents, diffs = meta.diffs, ttypes = meta.ttypes }
end
function POLESTAR_dumpDroprates()
  local out = {}
  for npc, items in pairs(POLESTAR_AL.droprates) do
    if type(items) == "table" then
      local row = {}
      for item, rate in pairs(items) do if type(rate) == "number" then row[tostring(item)] = rate end end
      out[tostring(npc)] = row
    end
  end
  return out
end
`;

// "<name>.toc" lines that are files, in order (comments and directives skipped).
function tocFiles(dir, folder) {
	const forever = path.join(dir, `${folder}_Forever.toc`);
	const toc = fs.existsSync(forever) ? forever : path.join(dir, `${folder}.toc`);
	if (!fs.existsSync(toc)) return { toc: null, files: [] };
	const files = fs
		.readFileSync(toc, 'utf8')
		.split(/\r?\n/)
		.map((l) => l.trim())
		.filter((l) => l && !l.startsWith('#'))
		.map((l) => l.replace(/\\/g, '/'));
	return { toc: path.basename(toc), files };
}

// Display text without colour codes, textures or atlas markup.
function cleanText(s) {
	if (typeof s !== 'string') return null;
	const out = s
		.replace(/\|c[0-9a-fA-F]{8}/g, '')
		.replace(/\|r/g, '')
		.replace(/\|T[^|]*\|t/g, '')
		.replace(/\|A[^|]*\|a/g, '')
		.replace(/\s+/g, ' ')
		.trim();
	return out || null;
}

// "TheTempleOfAtal'Hakkar" -> "The Temple Of Atal'Hakkar"
function keyName(key) {
	return String(key)
		.replace(/([a-z])([A-Z])/g, '$1 $2')
		.replace(/([A-Z]+)([A-Z][a-z])/g, '$1 $2')
		.trim();
}

const MARKER = /\{(area|faction|spell):(\d+)\}/g;

// Name of a content/section; client-only lookups (area/faction names) are not
// available offline, so a name built from one falls back to `fallback`.
function displayName(raw, fallback) {
	const text = cleanText(raw);
	if (!text) return fallback;
	if (MARKER.test(text)) {
		MARKER.lastIndex = 0;
		return fallback;
	}
	return text;
}

function sectionName(raw) {
	const text = cleanText(raw);
	if (!text) return null;
	const stripped = text.replace(MARKER, '').replace(/\s+/g, ' ').replace(/^[\s:-]+|[\s:-]+$/g, '');
	return stripped || null;
}

function parsePrice(v) {
	if (typeof v === 'number') return v;
	if (typeof v !== 'string') return null;
	const m = v.match(/^money:(\d+)$/);
	return m ? Number(m[1]) : v;
}

// Diff index -> 'A' | 'H' | null, from the difficulty's unique name.
function diffSides(diffs) {
	return diffs.map((d) => (d.unique === 'alliance' ? 'A' : d.unique === 'horde' ? 'H' : null));
}

// The rows a difficulty shows: its own, plus those it inherits through
// GetItemsFromDiff for positions it does not occupy (AtlasLoot's rule).
function diffRows(boss, diff, seen = new Set()) {
	if (diff.from == null || seen.has(diff.d)) return diff.rows;
	seen.add(diff.d);
	const source = boss.diffs.find((d) => d.d === diff.from);
	if (!source) return diff.rows;
	const taken = new Set(diff.rows.map((r) => r.p));
	return [...diff.rows, ...diffRows(boss, source, seen).filter((r) => !taken.has(r.p))];
}

function tableType(store, content, boss, diff) {
	const idx = diff.tt ?? boss.tt ?? content.itt ?? content.tt ?? 1;
	return store.ttypes[idx - 1] || 'Item';
}

// Every reward a row stands for: { id, side } (side from the row's own
// faction fields, else the difficulty's).
function rowIds(row, side) {
	const out = [];
	if (typeof row.h === 'number' && row.h > 0) out.push({ id: row.h, side: 'H' });
	if (typeof row.a === 'number' && row.a > 0) out.push({ id: row.a, side: 'A' });
	const own = row.h === true ? 'H' : row.a === true ? 'A' : side;
	if (typeof row.c2 === 'number' && row.c2 > 0) out.push({ id: row.c2, side: own });
	if (typeof row.c2 === 'number' && typeof row.c3 === 'number' && row.c3 > 0) out.push({ id: row.c3, side: own });
	return out;
}

const REWARD_KINDS = new Set(['Item', 'Profession']);
const SET_KINDS = new Set(['Set']);

// Walk one boss/section: calls fn({ id, side, row, kind, rep }) per reward of
// a table type in `kinds`, where rep = { factionId, standing } from the
// latest "f<id>rep<n>" header.
function eachReward(store, content, boss, fn, kinds = REWARD_KINDS) {
	const sides = diffSides(store.diffs);
	for (const diff of boss.diffs) {
		const kind = tableType(store, content, boss, diff);
		if (!kinds.has(kind)) continue;
		const side = sides[diff.d - 1] ?? null;
		let rep = null;
		const rows = [...diffRows(boss, diff)].sort((a, b) => (a.p ?? 0) - (b.p ?? 0));
		for (const row of rows) {
			if (typeof row.c2 === 'string') {
				const m = row.c2.match(/^f(\d+)rep(\d)$/);
				if (m) rep = { factionId: Number(m[1]), standing: Number(m[2]) };
				continue; // header / icon row
			}
			for (const r of rowIds(row, side)) fn({ ...r, row, kind, rep });
		}
	}
}

// Merge sides of one id seen several times: both factions (or a neutral
// sighting) -> null.
class SideSet {
	constructor() {
		this.map = new Map();
	}
	add(id, side, extra) {
		const cur = this.map.get(id);
		if (!cur) {
			this.map.set(id, { side, extra: { ...extra } });
			return;
		}
		if (cur.side !== side) cur.side = null;
		for (const [k, v] of Object.entries(extra)) if (cur.extra[k] == null && v != null) cur.extra[k] = v;
	}
	entries() {
		return [...this.map.entries()];
	}
}

function compact(obj) {
	for (const k of Object.keys(obj)) if (obj[k] === undefined) delete obj[k];
	return obj;
}

function instanceKind(content) {
	if (content.key === 'WorldBosses') return 'world';
	return /raid/i.test(content.ctype || '') ? 'raid' : 'dungeon';
}

const PLACEHOLDER = /^loot will be updated/i;

function buildInstances(store, foreverKeys, droprates) {
	const out = [];
	for (const content of store.contents) {
		if (typeof content.gv === 'number' && content.gv > 1) continue;
		const bosses = [];
		for (const boss of content.bosses) {
			if (boss.ignore) continue;
			const set = new SideSet();
			eachReward(store, content, boss, ({ id, side, row, kind }) => {
				if (kind !== 'Item') return;
				set.add(id, side, { quest: typeof row.Quest === 'number' ? row.Quest : undefined, price: row.Price != null ? parsePrice(row.Price) : undefined });
			});
			const items = set.entries().map(([item, { side, extra }]) => {
				const rec = { item };
				if (side) rec.faction = side;
				if (extra.quest != null) rec.quest = extra.quest;
				if (extra.price != null) rec.price = extra.price;
				for (const npc of boss.npc || []) {
					const rate = droprates[npc] && droprates[npc][item];
					if (rate != null) {
						rec.chance = rate;
						break;
					}
				}
				return rec;
			});
			const name = cleanText(boss.name);
			if (!items.length && !boss.npc && !boss.object) {
				// Set / icon lists and Forever's "loot will be updated" notice
				// stand where a boss would.
				const lists = boss.diffs.some((d) => tableType(store, content, boss, d) === 'Item');
				if (!lists || PLACEHOLDER.test(name || '')) continue;
			}
			bosses.push(compact({ name, npc: boss.npc || null, object: boss.object || undefined, items }));
		}
		const ctype = content.ctype || '';
		out.push({
			key: content.key,
			name: displayName(content.name, keyName(content.key)),
			kind: instanceKind(content),
			forever: /^Forever /.test(ctype) || foreverKeys.has(content.key),
			areaId: typeof content.areaId === 'number' ? content.areaId : null,
			levels: Array.isArray(content.levels) && content.levels.every((n) => typeof n === 'number') ? content.levels : null,
			phase: typeof content.phase === 'number' ? content.phase : null,
			bosses,
		});
	}
	return out;
}

// Generic list modules (Collections, PvP): one row per reward and section.
function buildList(store, extraFor) {
	const out = [];
	for (const content of store.contents) {
		if (typeof content.gv === 'number' && content.gv > 1) continue;
		const groupName = displayName(content.name, keyName(content.key));
		for (const boss of content.bosses) {
			const set = new SideSet();
			eachReward(store, content, boss, ({ id, side, kind }) => {
				if (kind === 'Item') set.add(id, side, {});
			});
			const section = sectionName(boss.name);
			for (const [item, { side }] of set.entries()) out.push({ group: content.key, groupName, section, item, faction: side, ...(extraFor ? extraFor(item) : {}) });
		}
	}
	return out;
}

// "Set" tables (Collections, PvP): ItemSet ids, one row per set and section.
function buildSets(store) {
	const out = [];
	for (const content of store.contents) {
		if (typeof content.gv === 'number' && content.gv > 1) continue;
		const groupName = displayName(content.name, keyName(content.key));
		for (const boss of content.bosses) {
			const set = new SideSet();
			eachReward(store, content, boss, ({ id, side }) => set.add(id, side, {}), SET_KINDS);
			const section = sectionName(boss.name);
			for (const [id, { side }] of set.entries()) out.push({ group: content.key, groupName, section, set: id, faction: side });
		}
	}
	return out;
}

function buildCrafting(store, professions) {
	const out = [];
	for (const content of store.contents) {
		if (typeof content.gv === 'number' && content.gv > 1) continue;
		const profession = displayName(content.name, keyName(content.key));
		for (const boss of content.bosses) {
			const group = sectionName(boss.name);
			const seen = new Set();
			eachReward(store, content, boss, ({ id, kind }) => {
				const key = `${kind}:${id}`;
				if (seen.has(key)) return;
				seen.add(key);
				if (kind === 'Profession') {
					const p = professions[id];
					out.push({ profession, item: p && p.item ? p.item : null, spell: id, skill: p && p.skill ? p.skill : null, group });
				} else {
					out.push({ profession, item: id, spell: null, skill: null, group });
				}
			});
		}
	}
	return out;
}

// Rewards behind "f<id>rep<n>" headers in any module, plus the Factions
// module's sections (standing from the header, else the section's name).
function collectFactions(stores, factions) {
	for (const { store, isFactions } of stores) {
		for (const content of store.contents) {
			if (typeof content.gv === 'number' && content.gv > 1) continue;
			for (const boss of content.bosses) {
				const label = (cleanText(boss.name) || '').toLowerCase();
				eachReward(store, content, boss, ({ id, side, kind, rep }) => {
					if (kind !== 'Item') return;
					let factionId = rep ? rep.factionId : null;
					let standing = rep ? rep.standing : null;
					if (!rep) {
						if (!isFactions) return;
						factionId = typeof content.factionId === 'number' ? content.factionId : null;
						standing = STANDINGS[label] || null;
						if (!standing) return;
					}
					const fkey = factionId != null ? `id:${factionId}` : `key:${content.key}`;
					let rec = factions.get(fkey);
					if (!rec) {
						const named = isFactions && (factionId == null || content.factionId === factionId);
						rec = { factionId, name: named ? displayName(content.name, keyName(content.key)) : null, rewards: [], seen: new Map() };
						factions.set(fkey, rec);
					} else if (!rec.name && isFactions && content.factionId === factionId) {
						rec.name = displayName(content.name, keyName(content.key));
					}
					const prev = rec.seen.get(id);
					if (prev) {
						if (prev.faction !== side) delete prev.faction;
						if (standing < prev.standing) prev.standing = standing;
						return;
					}
					const reward = { item: id, standing };
					if (side) reward.faction = side;
					rec.seen.set(id, reward);
					rec.rewards.push(reward);
				});
			}
		}
	}
}

const EXPR_STORES = (names) => `return {
  stores = { ${names.map((n) => `[${JSON.stringify(n)}] = POLESTAR_dumpStore(${JSON.stringify(n)})`).join(', ')} },
  droprates = POLESTAR_dumpDroprates(),
  extra = POLESTAR_extra and POLESTAR_extra() or nil,
}`;

// Lua for each module's extra facts from core data files.
const EXTRA = {
	Crafting: `function POLESTAR_extra()
  local P = AtlasLoot.Data.Profession
  local out = {}
  if not P or not P.GetProfessionData then return out end
  for _, store in pairs(POLESTAR_AL.stores) do
    local meta = rawget(store, "__al")
    for _, key in ipairs(meta.order) do
      local c = rawget(store, key)
      if type(c) == "table" and type(c.items) == "table" then
        for _, boss in pairs(c.items) do
          if type(boss) == "table" then
            for _, dif in pairs(boss) do
              if type(dif) == "table" then
                for _, r in pairs(dif) do
                  if type(r) == "table" and type(r[2]) == "number" then
                    local d = P.GetProfessionData(r[2])
                    if d then out[tostring(r[2])] = { item = d[1], skill = d[3] } end
                  end
                end
              end
            end
          end
        end
      end
    end
  end
  return out
end`,
	// GetPvPRankIconForItem -> PVP_RANK[rank][3], icons 136766.. for ranks 1..
	PvP: `function POLESTAR_extra()
  local R = AtlasLoot.Data.Requirements
  local out = {}
  if not R or not R.GetPvPRankIconForItem then return out end
  for _, store in pairs(POLESTAR_AL.stores) do
    local meta = rawget(store, "__al")
    for _, key in ipairs(meta.order) do
      local c = rawget(store, key)
      if type(c) == "table" and type(c.items) == "table" then
        for _, boss in pairs(c.items) do
          if type(boss) == "table" then
            for _, dif in pairs(boss) do
              if type(dif) == "table" then
                for _, r in pairs(dif) do
                  if type(r) == "table" then
                    for _, id in ipairs({ r[2], r[901], r[902] }) do
                      if type(id) == "number" then
                        local ok, icon = pcall(R.GetPvPRankIconForItem, id)
                        if ok and type(icon) == "number" then out[tostring(id)] = icon - 136765 end
                      end
                    end
                  end
                end
              end
            end
          end
        end
      end
    end
  end
  return out
end`,
};

const FOREVER_STORE = 'POLESTAR_forever';

// An empty Lua table reaches JSON as {}: lists back to arrays.
const list = (v) => (Array.isArray(v) ? v : []);
function normStore(store) {
	if (!store) return null;
	const contents = list(store.contents).map((c) => ({
		...c,
		bosses: list(c.bosses).map((b) => ({ ...b, diffs: list(b.diffs).map((d) => ({ ...d, rows: list(d.rows) })) })),
	}));
	return { contents, diffs: list(store.diffs), ttypes: list(store.ttypes) };
}

function readModule(dir, coreDir, module, opts) {
	const folder = `${CORE}_${module}`;
	const modDir = path.join(dir, folder);
	const { toc, files } = tocFiles(modDir, folder);
	const luaFiles = files.filter((f) => f.toLowerCase().endsWith('.lua')).map((f) => path.join(modDir, f));
	const warnings = [];
	const core = (CORE_FILES[module] || []).map((f) => path.join(coreDir, f)).filter((f) => {
		if (fs.existsSync(f)) return true;
		warnings.push(`${CORE}/${path.relative(coreDir, f).split(path.sep).join('/')} missing: ${module} rows lack its facts`);
		return false;
	});
	const extraFiles = [];
	if (module === 'DungeonsAndRaids') {
		const forever = path.join(modDir, 'forever.lua');
		if (fs.existsSync(forever) && !luaFiles.includes(forever)) extraFiles.push(forever);
	}
	for (const f of luaFiles) if (!fs.existsSync(f)) warnings.push(`${folder}/${path.relative(modDir, f).split(path.sep).join('/')} listed in ${toc} but missing`);
	const run = (extra) => {
		const all = [...core, ...luaFiles.filter((f) => fs.existsSync(f)), ...extra];
		const res = readAddonLua({
			files: all,
			addonName: folder,
			prelude: PRELUDE + (EXTRA[module] || ''),
			// Every chunk sees the globals table as _G (droprate.lua indexes it
			// without a local); forever.lua fills a store of its own and uses
			// data.lua's LTNX icon without defining it; Requirements needs
			// bit.band, which the sandbox withholds.
			rewrite: (src, file) => {
				let out = `local _G = POLESTAR_G; ${src}`;
				if (extra.includes(file)) out = `local LTNX = ""; ${out.replace(/ItemDB:Add\(\s*addonname/g, `ItemDB:Add("${FOREVER_STORE}"`)}`;
				if (path.basename(file) === 'Requirements.lua') out = out.replace(/\bbit\.band\b/g, 'POLESTAR_band');
				return out;
			},
			expr: EXPR_STORES([folder, FOREVER_STORE]),
			...(opts.timeout ? { timeout: opts.timeout } : {}),
		});
		return { res, files: all };
	};
	let result;
	try {
		result = run(extraFiles);
	} catch (err) {
		// forever.lua is outside the TOC (the game never loads it): a file that
		// no longer loads costs only its gap-filling.
		if (!extraFiles.length || !extraFiles.some((f) => String(err.message).includes(f))) throw err;
		warnings.push(`${folder}/forever.lua did not load (${String(err.message).split('\n')[0].slice(-160)}); using the TOC files only`);
		result = run([]);
	}
	return { ...result, warnings, toc };
}

// -> { meta, instances, droprates, collections, crafting, factions, pvp }
function readAtlasLoot(dir = resolveAddonsDir(), opts = {}) {
	const started = Date.now();
	const meta = { source: 'AtlasLootClassic', version: null, licence: 'GPL-2.0', modules: [], files: [], warnings: [] };
	const out = { meta, instances: [], droprates: {}, collections: [], sets: [], crafting: [], factions: [], pvp: [] };
	if (!dir || !fs.existsSync(dir)) {
		meta.warnings.push(`AddOns folder not found${dir ? `: ${dir}` : ''}`);
		return out;
	}
	const coreDir = path.join(dir, CORE);
	meta.version = addonVersion(coreDir, fs.existsSync(path.join(coreDir, `${CORE}_Forever.toc`)) ? `${CORE}_Forever.toc` : undefined);
	const factionStores = [];
	for (const module of opts.modules || MODULES) {
		const folder = `${CORE}_${module}`;
		if (!fs.existsSync(path.join(dir, folder))) {
			meta.warnings.push(`${folder} not installed`);
			continue;
		}
		const { res, files, warnings } = readModule(dir, coreDir, module, opts);
		meta.warnings.push(...warnings);
		meta.modules.push(module);
		meta.files.push(...files.map((f) => path.relative(dir, f).split(path.sep).join('/')));
		if (!meta.version) meta.version = addonVersion(path.join(dir, folder));
		const store = normStore(res.stores && res.stores[folder]);
		if (!store) {
			meta.warnings.push(`${folder}: no loot tables registered`);
			continue;
		}
		if (module === 'DungeonsAndRaids') {
			const forever = normStore(res.stores && res.stores[FOREVER_STORE]);
			const foreverKeys = new Set(forever ? forever.contents.map((c) => c.key) : []);
			if (forever) {
				// forever.lua predates data.lua's copy; it only fills gaps.
				const have = new Set(store.contents.map((c) => c.key));
				const extra = forever.contents.filter((c) => !have.has(c.key));
				out.instances.push(...buildInstances(store, foreverKeys, res.droprates));
				out.instances.push(...buildInstances({ ...forever, contents: extra }, foreverKeys, res.droprates));
			} else {
				out.instances.push(...buildInstances(store, foreverKeys, res.droprates));
			}
			Object.assign(out.droprates, res.droprates);
		} else if (module === 'Collections') {
			out.collections.push(...buildList(store));
			out.sets.push(...buildSets(store));
		} else if (module === 'Crafting') {
			out.crafting.push(...buildCrafting(store, res.extra || {}));
		} else if (module === 'PvP') {
			const ranks = res.extra || {};
			out.pvp.push(...buildList(store, (item) => ({ rank: ranks[item] > 0 ? ranks[item] : null, honor: null })));
			out.sets.push(...buildSets(store));
		}
		factionStores.push({ store, isFactions: module === 'Factions' });
	}
	const factions = new Map();
	collectFactions(factionStores, factions);
	out.factions = [...factions.values()].map(({ seen, ...rec }) => rec);
	meta.ms = Date.now() - started;
	return out;
}

module.exports = { readAtlasLoot, cleanText, keyName };
