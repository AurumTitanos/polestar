'use strict';
// DungeonJournal (the ForeverDungeonJournal addon by Exehn) as a data source
// for dungeon runs: dungeons with level ranges and entrances, bosses in kill
// order with their loot, and each dungeon's quests with prerequisite chains,
// rewards, XP, money and where they start and end.
//
// DungeonJournal publishes no licence, so it is read from the
// installed copy at build time and everything derived from it stays local:
// data/forever/dungeons.json (data/ is gitignored). Only facts are taken (ids,
// names, levels, coordinates, rewards, chains); none of its prose.
//
// Layout (inspected at 1.6.0, 2026-10): every Data/*.lua file starts with
// `local ADDON_NAME, FDJ = ...` and fills the shared namespace:
//   FDJ.DB[dungeon] = { level = "13-20", location, quests = { quest... },
//                       bosses = { { name, npcID, aliases, rare, trash, loot = { {id, name, slot, quality} } } },
//                       entrance = { mapID, x, y } (DungeonEntrances.lua, 0-1, live map frame) }
//   quest = { id, name, faction = "Both"|"Alliance"|"Horde", level, requires, pickup, turnin (text),
//             objective (text), rewardItems = { {id, name, quality[, count]} }, rewardChoice,
//             additionalRewardItems, rewardSummary ("7s  •  Ironforge +100"), liveXPFallback,
//             startItem = {id, name, count, source}, startMap = { mapID, x, y, targetName },
//             classOnly = "PALADIN", startsInDungeon, hideFromMainList }
//   FDJ.ORDER                      dungeon names in journal order
//   FDJ.QUEST_PREREQ_CHAINS[id]    { {id, name[, itemStep]} } in order; may list the quest itself and
//                                  its follow-ups after it; itemStep entries are not quests
//   FDJ.QUEST_PREREQ_DETAILS[id]   chain quests: { level, requires, pickup, turnin, map, turninMap, startItem }
//   FDJ.QUEST_START_MAPS[id]       { mapID, x, y, label, targetName }
//   FDJ.FOREVER_QUEST_XP_FALLBACK  [id] = observed Forever XP
//   FDJ.PREREQ_REWARD_ITEMS_FALLBACK[id] = { items, choice }; FDJ.PREREQ_REWARD_MONEY_FALLBACK[id] = copper
//   FDJ.BOSS_LEVELS[dungeon][boss] = "28" | "19-21"
// Coordinates are the client's live map frame (the addon places pins with
// C_Map); they are kept as `f: "l"`, the way npcs.json marks live spawns.

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { luaToJson } = require('../lua');
const { pickSpawn } = require('../dsl/resolve');

const FOLDER = 'ForeverDungeonJournal';
const DATA_FILES = ['Dungeons', 'DungeonEntrances', 'DungeonRoutes', 'Bosses', 'QuestMaps', 'QuestChains', 'QuestRewards', 'QuestShareability', 'QuestUpdates'];
// Constants Core/Bootstrap.lua defines before the data files run.
const CONSTANTS = { ALBA_FAIRMOON_LOCATION: 'Alba Fairmoon, Sentinel Hill inn, Westfall' };

const ALLIANCE_RACES = 1 | 4 | 8 | 64;
const HORDE_RACES = 2 | 16 | 32 | 128;
const CLASS_BITS = { WARRIOR: 1, PALADIN: 2, HUNTER: 4, ROGUE: 8, PRIEST: 16, SHAMAN: 64, MAGE: 128, WARLOCK: 256, DRUID: 1024 };

// Positions found by hand where neither our data nor DungeonJournal has one:
// `<questId>:start|end` -> { map, x, y, f, npc (name), note, ref (where it was read) }.
// Coordinates are live-frame map percent, as the cited pages show them.
const WEB_POSITIONS = {
	// No spawn in our data or DungeonJournal. She waits in the Royal Gallery of Stormwind Keep; the keep's position is
	// Highlord Bolvar Fordragon's spawn (npc 1748) in npcs.json.
	'95189:end': { map: 1453, x: 80.21, y: 38.35, f: 'l', npc: 'Lady Dena Kennedy', note: 'In the Royal Gallery of Stormwind Keep', ref: 'npcs.json npc 1748' },
};

// Travel advice for a faction whose way to the entrance is long, in our own
// words, with the stops it
// names as optional waypoints: dungeon -> faction -> { tips, stops: [{ map, x, y, label }] }.
const TRAVEL = {
	'Hall of Thanes': {
		Horde: {
			tips: [
				'A long run into Alliance land: Undercity, south through Silverpine and Hillsbrad to Tarren Mill, east into Arathi, over Thandol Span, then the Wetlands road and Loch Modan to Dun Morogh.',
				'Take your gear off before Ironforge; the guards will kill you a few times. The portal is on the lava bridge in Old Ironforge, reached through the webbed passage left of the High Seat.',
			],
			stops: [{ map: 1411, x: 50.8, y: 13.5, label: 'Zeppelin to Undercity' }],
		},
	},
	'Ruins of Lordaeron': {
		Alliance: {
			tips: [
				'Sail from Stormwind Harbor to Auberdine, then take the Menethil ship and stay on it to Southshore.',
				'From Southshore follow the road north past Hillsbrad Fields, skirt Dalaran to Lordamere Lake, swim north into Tirisfal and follow the road to the Undercity ruins.',
			],
			stops: [{ map: 1453, x: 22.8, y: 56.0, label: 'Ship to Auberdine' }],
		},
	},
};

// Common short names, for the guide menu search.
const ABBREVIATIONS = {
	'Hall of Thanes': ['HoT'],
	'Ragefire Chasm': ['RFC'],
	'Ruins of Lordaeron': ['RoL'],
	'The Deadmines': ['DM', 'VC', 'Deadmines'],
	'Wailing Caverns': ['WC'],
	'Shadowfang Keep': ['SFK'],
	'Blackfathom Deeps': ['BFD'],
	'Excavation Site: Wetlands': ['Excavation'],
	'The Stockade': ['Stocks', 'Stockade'],
	'City of Dalaran': ['Dalaran'],
	'Gnomeregan': ['Gnomer'],
	'Razorfen Kraul': ['RFK'],
	'Scarlet Monastery: Graveyard': ['SM', 'GY'],
	'Scarlet Monastery: Library': ['SM', 'Lib'],
};

// --- locating and loading ----------------------------------------------------

function isDir(p) {
	try {
		return fs.statSync(p).isDirectory();
	} catch {
		return false;
	}
}

// The installed addon folder: --source, WOW_FOREVER_ADDONS, else the Forever
// clients `install` detects. -> dir | null
function findDungeonJournal({ source, env = process.env, home = os.homedir() } = {}) {
	if (source) return isDir(source) ? path.resolve(source) : null;
	if (env.WOW_FOREVER_ADDONS && isDir(path.join(env.WOW_FOREVER_ADDONS, FOLDER))) return path.join(env.WOW_FOREVER_ADDONS, FOLDER);
	const { detectAddonsDirs } = require('../addons');
	for (const c of detectAddonsDirs(home)) {
		const dir = path.join(c.addons, FOLDER);
		if (isDir(dir)) return dir;
	}
	return null;
}

// `## Key: value` lines of the addon's TOC -> { title, version, author, interface }.
function readToc(dir) {
	const out = {};
	const file = path.join(dir, `${FOLDER}.toc`);
	if (!fs.existsSync(file)) return out;
	for (const line of fs.readFileSync(file, 'utf8').split(/\r?\n/)) {
		const m = /^##\s*(Title|Version|Author|Interface)\s*:\s*(.*?)\s*$/.exec(line);
		if (m) out[m[1].toLowerCase()] = m[2];
	}
	return out;
}

// A Lua string literal for any text (non-printable bytes as \ddd).
function luaString(s) {
	let out = '"';
	for (const b of Buffer.from(String(s), 'utf8')) {
		if (b === 0x22 || b === 0x5c) out += `\\${String.fromCharCode(b)}`;
		else if (b >= 0x20 && b < 0x7f) out += String.fromCharCode(b);
		else out += `\\${b}`;
	}
	return `${out}"`;
}

// Run the data files under Lua 5.1 (sandboxed, see tools/lib/lua.js) the way
// the client does: each receives the addon name and the shared namespace.
// -> the namespace (without Constants), Lua tables as tools/lib/lua.js returns them.
function loadDungeonJournal(dir) {
	const files = DATA_FILES.map((f) => path.join(dir, 'Data', `${f}.lua`));
	const missing = files.filter((f) => !fs.existsSync(f));
	if (missing.length) throw new Error(`DungeonJournal at ${dir} is missing ${missing.map((f) => path.relative(dir, f)).join(', ')}`);
	const constants = Object.entries(CONSTANTS).map(([k, v]) => `${k} = ${luaString(v)}`).join(', ');
	const prelude = `
local __ns = { Constants = { ${constants} } }
ForeverDungeonJournal_NS = __ns
ForeverDungeonJournal = __ns
for _, p in ipairs({ ${files.map(luaString).join(', ')} }) do
  local ok, err = __polestar_loaddata(p, ${luaString(FOLDER)}, __ns)
  if not ok then error(err, 0) end
end
__dj = __ns`;
	return luaToJson({ prelude, expr: 'local t = {} for k, v in pairs(__dj) do if k ~= "Constants" then t[k] = v end end return t' });
}

// --- Lua-shaped values -------------------------------------------------------

// A Lua sequence as a JS array: arrays stay, {} and nil become [], objects with
// integer keys come back in key order.
function list(v) {
	if (Array.isArray(v)) return v;
	if (!v || typeof v !== 'object') return [];
	return Object.keys(v)
		.filter((k) => /^\d+$/.test(k))
		.sort((a, b) => a - b)
		.map((k) => v[k]);
}

function byId(table, id) {
	if (!table || typeof table !== 'object') return undefined;
	return table[id] !== undefined ? table[id] : table[String(id)];
}

const round2 = (n) => Math.round(n * 100) / 100;
const pct = (v) => round2(Number(v) * 100);

function slug(name) {
	return String(name)
		.toLowerCase()
		.replace(/^the /, '')
		.replace(/['’]/g, '')
		.replace(/[^a-z0-9]+/g, '-')
		.replace(/^-|-$/g, '');
}

function levelRange(s) {
	const m = /^(\d+)\s*-\s*(\d+)$/.exec(String(s || '').trim());
	return m ? { min: Number(m[1]), max: Number(m[2]) } : null;
}

function bossLevel(s) {
	if (s === undefined || s === null || s === '') return null;
	const r = levelRange(s);
	if (r) return r;
	return /^\d+$/.test(String(s)) ? Number(s) : null;
}

// { id, name, quality[, count] } from {id, name, quality[, count]} tuples.
function itemList(v) {
	const out = [];
	for (const t of list(v)) {
		const a = list(t);
		if (!(Number(a[0]) > 0)) continue;
		const it = { item: Number(a[0]), name: String(a[1] || '') };
		if (Number.isInteger(Number(a[2]))) it.quality = Number(a[2]);
		if (Number(a[3]) > 1) it.count = Number(a[3]);
		out.push(it);
	}
	return out;
}

// Money in copper from a reward summary ("1g 50s  •  Ironforge +100"), or null.
function parseMoney(text) {
	for (const part of String(text || '').split(/[•\n]/)) {
		const t = part.trim();
		if (!/^(\d[\d,]*\s*[gsc]\s*)+$/i.test(t)) continue;
		let copper = 0;
		for (const m of t.matchAll(/(\d[\d,]*)\s*([gsc])/gi)) {
			const n = Number(m[1].replace(/,/g, ''));
			copper += m[2].toLowerCase() === 'g' ? n * 10000 : m[2].toLowerCase() === 's' ? n * 100 : n;
		}
		if (copper > 0) return copper;
	}
	return null;
}

// --- quest positions ---------------------------------------------------------

// The NPC a pickup/turn-in text names: the part before the first comma, when
// it reads like a name ("Nalpak, above the entrance ..." -> "Nalpak").
function npcNameOf(text) {
	const head = String(text || '')
		.split(',')[0]
		.replace(/\s*\(.*?\)\s*/g, ' ')
		.trim();
	if (!head || /^(item start|use |follow |keep |you |stone tablet|the quest|drops?|found|dropped|extra-destructive)/i.test(head)) return null;
	if (!/^[A-Z]/.test(head) || head.split(/\s+/).length > 5) return null;
	return head;
}

function dungeonWords(name) {
	const words = [name.toLowerCase(), name.toLowerCase().replace(/^the /, ''), 'the dungeon', 'the instance'];
	const sub = /:\s*(.+)$/.exec(name);
	if (sub) words.push(`the ${sub[1].toLowerCase()}`, sub[1].toLowerCase());
	return words;
}

// "inside Ruins of Lordaeron", "just inside ...", "inside the Graveyard".
function saysInside(text, dungeonName) {
	const t = String(text || '').toLowerCase();
	if (!/\binside\b/.test(t)) return false;
	return dungeonWords(dungeonName).some((w) => t.includes(`inside ${w}`));
}

function saysAtEntrance(text) {
	return /\b(near|by|at) the (dungeon|instance) (entrance|portal)\b|\bnear the dungeon entrance\b/i.test(String(text || ''));
}

// The zone a pickup/turn-in text names after the NPC ("Muln Earthfury,
// Skywatcher Plateau, Mulgore" -> Mulgore) as a map hint, or null.
function zoneHint(data, text) {
	const parts = String(text || '').split(',').slice(1).map((s) => s.replace(/\(.*?\)/g, '').trim()).filter(Boolean);
	for (const part of parts.reverse()) {
		const z = data.zoneNamed(part) || data.zoneNamed(`${part} City`);
		if (z) return { map: z.zone.id };
	}
	return null;
}

class NameIndex {
	constructor(data) {
		this.byName = new Map(); // lower-case name -> [npc ids with spawns]
		for (const n of Object.values(data.npcs || {})) {
			if (!n || !n.name || !n.spawns || !Object.keys(n.spawns).length) continue;
			const k = n.name.toLowerCase();
			this.byName.set(k, [...(this.byName.get(k) || []), n.id]);
		}
		this.dj = new Map();
	}

	// DungeonJournal map entries name their NPC (targetName, or the label before " — ").
	addDj(entry) {
		if (!entry || entry.mapID === undefined) return;
		const name = entry.targetName || String(entry.label || '').split(' — ')[0].trim();
		if (!name) return;
		const k = name.toLowerCase();
		if (!this.dj.has(k)) this.dj.set(k, entry);
	}

	npcs(name) {
		return (name && this.byName.get(name.toLowerCase())) || [];
	}

	djEntry(name) {
		return name ? this.dj.get(name.toLowerCase()) || null : null;
	}
}

function djPoint(entry, source, extra = {}) {
	return { map: Number(entry.mapID), x: pct(entry.x), y: pct(entry.y), f: 'l', source, ...extra };
}

// --- building the dataset ----------------------------------------------------

// raw: loadDungeonJournal() output; data: tools/lib/dsl/data.js Data.
// -> { dataset, report } where report = { unresolved: [..], coverage: { source: n } }.
function buildDungeons(raw, data, { toc = {} } = {}) {
	const DB = raw.DB || {};
	const order = list(raw.ORDER).filter((n) => DB[n]);
	const chains = raw.QUEST_PREREQ_CHAINS || {};
	const details = raw.QUEST_PREREQ_DETAILS || {};
	const startMaps = raw.QUEST_START_MAPS || {};
	const xpFallback = raw.FOREVER_QUEST_XP_FALLBACK || {};
	const rewardFallback = raw.PREREQ_REWARD_ITEMS_FALLBACK || {};
	const moneyFallback = raw.PREREQ_REWARD_MONEY_FALLBACK || {};
	const bossLevels = raw.BOSS_LEVELS || {};
	const names = new NameIndex(data);
	for (const e of Object.values(startMaps)) names.addDj(e);
	for (const d of Object.values(details)) {
		names.addDj(d && d.map);
		names.addDj(d && d.turninMap);
	}
	for (const n of order) for (const q of list(DB[n].quests)) names.addDj(q && q.startMap);

	// Which dungeon each main quest belongs to (first listing wins).
	const homeOf = new Map();
	for (const n of order) for (const q of list(DB[n].quests)) if (q && q.id && !homeOf.has(Number(q.id))) homeOf.set(Number(q.id), n);

	const report = { unresolved: [], coverage: {} };
	const dungeons = [];
	for (const name of order) {
		const d = DB[name];
		const ent = d.entrance;
		const entrance = ent && ent.mapID ? { map: Number(ent.mapID), x: pct(ent.x), y: pct(ent.y), f: 'l' } : null;
		const bosses = list(d.bosses)
			.filter((b) => b && b.name && !b.trash)
			.map((b) => ({
				name: String(b.name),
				npc: Number(b.npcID) > 0 ? Number(b.npcID) : null,
				aliases: list(b.aliases).map(String),
				level: bossLevel(byId(bossLevels[name], b.name)),
				rare: b.rare ? true : false,
				loot: list(b.loot)
					.map((l) => list(l))
					.filter((l) => Number(l[0]) > 0)
					.map((l) => ({ item: Number(l[0]), name: String(l[1] || ''), slot: l[2] ? String(l[2]) : null, quality: Number.isInteger(Number(l[3])) ? Number(l[3]) : null })),
			}));

		const ctx = { name, entrance, bosses, data, names, details, startMaps, report, shareable: raw.QUEST_SHAREABILITY_AUDIT || {} };
		const seen = new Set();
		const quests = [];
		const chainQuests = {};
		for (const q of list(d.quests)) {
			if (!q || !(Number(q.id) > 0) || seen.has(Number(q.id))) continue;
			const id = Number(q.id);
			seen.add(id);
			const chainList = list(byId(chains, id));
			const self = chainList.findIndex((c) => Number(c.id) === id);
			const before = self >= 0 ? chainList.slice(0, self) : chainList;
			const after = self >= 0 ? chainList.slice(self + 1) : [];
			const real = (c) => c && Number(c.id) > 0 && !c.itemStep && Number(c.id) < 1000000;
			const entry = mainQuest(q, ctx, { xpFallback, moneyFallback });
			entry.chain = withDataPre(data, before.filter(real).map((c) => Number(c.id)), id, entry.faction);
			entry.followUps = after.filter(real).map((c) => Number(c.id));
			const steps = before.filter((c) => c && !real(c)).map((c) => String(c.name));
			if (steps.length) entry.itemSteps = steps;
			if (q.hideFromMainList) entry.hidden = true;
			for (const cid of [...entry.chain, ...entry.followUps]) {
				if (!chainQuests[cid]) chainQuests[cid] = chainQuest(cid, chainList.find((c) => Number(c.id) === cid), ctx, { xpFallback, moneyFallback, rewardFallback, faction: entry.faction });
				const home = homeOf.get(cid);
				if (home && home !== name) chainQuests[cid].dungeon = slug(home);
			}
			quests.push(entry);
		}
		const lv = levelRange(d.level) || { min: 1, max: 60 };
		const factions = ['Alliance', 'Horde'].filter((s) => quests.some((q) => !q.hidden && (!q.faction || q.faction === s)));
		dungeons.push({
			key: slug(name),
			name,
			levels: lv,
			zone: entrance ? entrance.map : null,
			zoneName: entrance && data.zone(entrance.map) ? String(data.zone(entrance.map).name) : null,
			entrance,
			abbreviations: ABBREVIATIONS[name] || [],
			factions,
			bosses: bosses.map(({ aliases, ...b }) => b),
			quests,
			chainQuests,
		});
	}
	const dataset = {
		source: { name: 'DungeonJournal', addon: FOLDER, title: toc.title || null, version: toc.version || null, author: toc.author || null, license: null },
		dungeons,
	};
	return { dataset, report };
}

// A chain in doing order: DungeonJournal's list, with every prerequisite our
// data names (`pre`, any one suffices; the first one the faction can take) put
// before the quest that needs it, recursively. The quest itself is left out.
function withDataPre(data, djChain, id, side) {
	const out = [];
	const visiting = new Set();
	const takes = (pq) => !pq || !side || raceOk(pq, side);
	const add = (qid) => {
		if (out.includes(qid) || visiting.has(qid)) return;
		visiting.add(qid);
		const q = ourQuest(data, qid);
		const pre = q && Array.isArray(q.pre) ? q.pre.map(Number).filter((p) => p > 0) : [];
		if (pre.length && !pre.some((p) => out.includes(p))) {
			const pick = pre.find((p) => djChain.includes(p)) || pre.find((p) => takes(ourQuest(data, p)));
			if (pick) add(pick);
		}
		visiting.delete(qid);
		if (qid !== id) out.push(qid);
	};
	for (const c of djChain) add(c);
	add(id);
	return out;
}

function raceOk(q, side) {
	if (!q || q.races === null || q.races === undefined) return true;
	const mask = side === 'Alliance' ? ALLIANCE_RACES : HORDE_RACES;
	return (Number(q.races) & mask) !== 0;
}

function classesOf(mask) {
	if (!(Number(mask) > 0)) return null;
	const out = Object.entries(CLASS_BITS)
		.filter(([, bit]) => (Number(mask) & bit) !== 0)
		.map(([c]) => c);
	return out.length && out.length < Object.keys(CLASS_BITS).length ? out : null;
}

function factionOf(v) {
	return v === 'Alliance' || v === 'Horde' ? v : null;
}

// Our quest record, never the copy dungeons.json itself feeds into the data
// (tools/lib/dsl/data.js adds its quests): a rebuild starts from the real data.
function ourQuest(data, id) {
	const q = data.quest(id);
	if (!q || (Array.isArray(q.source) && q.source.length === 1 && q.source[0] === 'dungeonjournal')) return null;
	return q;
}

function spawnPoint(data, cands, hint, source, extra) {
	const p = pickSpawn(data, cands, hint ? hint.map : null, hint && hint.x !== undefined ? hint : null);
	if (!p || p.map === undefined) return null;
	if (hint && source === 'data-npc' && p.map !== hint.map) return null; // a namesake elsewhere
	const e = p.cand.kind === 'npc' ? data.npc(p.cand.id) : data.object(p.cand.id);
	return { map: p.map, x: p.x, y: p.y, f: p.f === 'e' ? 'e' : 'l', source, kind: p.cand.kind, id: p.cand.id, ...extra, name: e && e.name ? String(e.name) : extra.name };
}

// Where a quest starts or ends. Precedence: our data (the quest's giver or
// ender with spawns, else an NPC of the named giver), DungeonJournal's maps,
// then positions found by hand (WEB_POSITIONS). DungeonJournal's map for the
// NPC picks which of our spawns to use. A giver or ender inside the dungeon
// stands at the entrance. -> point | null
function place(id, which, info, ctx) {
	const { data, names, entrance, name } = ctx;
	const q = ourQuest(data, id);
	const text = which === 'start' ? info.pickup : info.turnin;
	const npcName = npcNameOf(text);
	const own = which === 'start' ? info.startMap || byId(ctx.startMaps, id) || info.map : info.turninMap;
	const djEntry = own && own.mapID !== undefined ? own : names.djEntry(npcName);
	const dj = djEntry ? djPoint(djEntry, 'dj', { kind: 'npc', name: npcName || djEntry.targetName || null }) : null;
	const ids = q ? (which === 'start' ? q.start : q.end) || {} : {};
	const cands = [...(ids.npc || []).map((i) => ({ kind: 'npc', id: i })), ...(ids.object || []).map((i) => ({ kind: 'object', id: i }))];
	if (cands.length) {
		const p = spawnPoint(data, cands, dj, 'data', { name: npcName });
		if (p) return p;
	}
	if (which === 'start') {
		const item = info.startItem && list(info.startItem);
		const dataItem = q && !cands.length && (q.start.item || []).length ? Number(q.start.item[0]) : null;
		if (dataItem) return { source: 'data', kind: 'item', item: dataItem, name: data.item(dataItem) ? String(data.item(dataItem).name) : null };
		if (item && Number(item[0]) > 0) {
			const it = { kind: 'item', item: Number(item[0]), name: String(item[1] || '') };
			if (data.item(it.item)) return { ...it, source: 'data' };
			if (entrance && (saysInside(text, name) || saysInside(item[3], name) || /inside|drops? from|dropped by/i.test(String(item[3] || '')))) {
				return { ...entrance, ...it, source: 'entrance', inDungeon: true };
			}
		}
		if (info.startObject && entrance) return { ...entrance, source: 'entrance', kind: 'object', name: String(list(info.startObject)[0] || ''), inDungeon: true };
	}
	if (entrance && (saysInside(text, name) || (which === 'start' && info.startsInDungeon && !npcName))) {
		return { ...entrance, source: 'entrance', kind: 'npc', name: npcName, inDungeon: true };
	}
	// An NPC of the named giver: the one on DungeonJournal's map, else on a zone
	// the text names; several namesakes and no such hint is no answer.
	const namesakes = names.npcs(npcName);
	const hint = dj || zoneHint(data, text);
	if (namesakes.length && (namesakes.length === 1 || hint)) {
		const p = spawnPoint(data, namesakes.map((n) => ({ kind: 'npc', id: n })), hint, 'data-npc', { name: npcName });
		if (p) return p;
	}
	if (dj) return dj;
	const web = WEB_POSITIONS[`${id}:${which}`];
	if (web) return { map: web.map, x: web.x, y: web.y, f: web.f || 'l', source: 'web', kind: 'npc', name: web.npc || npcName, note: web.note, ref: web.ref };
	if (entrance && saysAtEntrance(text)) return { ...entrance, source: 'entrance', kind: 'npc', name: npcName };
	return null;
}

function track(ctx, id, which, p) {
	const key = p ? p.source : 'none';
	ctx.report.coverage[key] = (ctx.report.coverage[key] || 0) + 1;
	if (!p) ctx.report.unresolved.push({ dungeon: ctx.name, quest: id, which });
}

function xpOf(id, q, dj, fallback) {
	if (q && typeof q.xp === 'number' && q.xp > 0) return { xp: q.xp, xpSource: 'data' };
	const fb = Number(byId(fallback, id));
	if (fb > 0) return { xp: fb, xpSource: 'dungeonjournal' };
	if (dj && Number(dj.liveXPFallback) > 0) return { xp: Number(dj.liveXPFallback), xpSource: 'dungeonjournal' };
	return { xp: null, xpSource: null };
}

function textMentions(text, boss) {
	const t = String(text || '').toLowerCase();
	return [boss.name, ...boss.aliases].some((n) => n && t.includes(n.toLowerCase()));
}

// Boss indexes whose kill (or drop) a quest's objectives need.
function bossesFor(q, dj, ctx) {
	const out = new Set();
	const objs = (q && q.objectives) || [];
	ctx.bosses.forEach((b, i) => {
		const lootIds = new Set(b.loot.map((l) => l.item));
		for (const o of objs) {
			if (o.type === 'kill' && b.npc && Number(o.id) === b.npc) out.add(i);
			if (o.type === 'item') {
				if (lootIds.has(Number(o.id))) out.add(i);
				const it = ctx.data.item(o.id);
				if (it && it.drops && b.npc && it.drops.npc && it.drops.npc[b.npc] !== undefined) out.add(i);
			}
		}
		if (textMentions(dj && dj.objective, b)) out.add(i);
	});
	return [...out].sort((a, b) => a - b);
}

// The boss whose drop starts a quest, or null.
function dropBoss(item, ctx) {
	if (!item) return null;
	const id = Number(item[0]);
	const it = ctx.data.item(id);
	for (let i = 0; i < ctx.bosses.length; i++) {
		const b = ctx.bosses[i];
		if (b.loot.some((l) => l.item === id)) return i;
		if (it && it.drops && b.npc && it.drops.npc && it.drops.npc[b.npc] !== undefined) return i;
		if (textMentions(item[3], b)) return i;
	}
	return null;
}

function rewardsOf(dj) {
	const main = itemList(dj.rewardItems);
	const extra = itemList(dj.additionalRewardItems);
	const choice = dj.rewardChoice ? true : false;
	return { items: choice ? extra : [...main, ...extra], choices: choice ? main : [] };
}

function mainQuest(dj, ctx, { xpFallback, moneyFallback }) {
	const id = Number(dj.id);
	const q = ourQuest(ctx.data, id);
	const start = place(id, 'start', dj, ctx);
	const end = place(id, 'end', dj, ctx);
	track(ctx, id, 'start', start);
	track(ctx, id, 'end', end);
	const startItem = dj.startItem ? list(dj.startItem) : null;
	const boss = dropBoss(startItem, ctx);
	const classes = dj.classOnly ? [String(dj.classOnly).toUpperCase()] : classesOf(q && q.classes);
	const sides = ['Alliance', 'Horde'].filter((s) => raceOk(q, s));
	let faction = factionOf(dj.faction);
	if (!faction && sides.length === 1) faction = sides[0];
	const money = parseMoney(dj.rewardSummary) || parseMoney(dj.rewards) || (Number(byId(moneyFallback, id)) > 0 ? Number(byId(moneyFallback, id)) : null);
	return {
		id,
		title: q && q.title ? String(q.title) : String(dj.name || ''),
		faction,
		level: q && Number(q.level) > 0 ? Number(q.level) : Number(dj.level) || null,
		minLevel: q && Number(q.minLevel) > 0 ? Number(q.minLevel) : Number(dj.requires) || null,
		classes,
		...xpOf(id, q, dj, xpFallback),
		money,
		rewards: rewardsOf(dj),
		start,
		end,
		startItem: startItem && Number(startItem[0]) > 0 ? { item: Number(startItem[0]), name: String(startItem[1] || '') } : null,
		startBoss: boss === null ? null : ctx.bosses[boss].name,
		// A giver or object inside, by the boss its pickup names.
		startNear: start && start.inDungeon && boss === null ? (ctx.bosses.find((b) => textMentions(dj.pickup, b)) || {}).name || null : null,
		bosses: bossesFor(q, dj, ctx).map((i) => ctx.bosses[i].name),
		inData: !!q,
		shareable: shareableOf(ctx, id),
	};
}

function chainQuest(id, link, ctx, { xpFallback, moneyFallback, rewardFallback, faction }) {
	const q = ourQuest(ctx.data, id);
	const det = byId(ctx.details, id) || {};
	const info = { ...det, startMap: undefined, map: det.map, startItem: det.startItem };
	const start = place(id, 'start', info, ctx);
	const end = place(id, 'end', info, ctx);
	track(ctx, id, 'start', start);
	track(ctx, id, 'end', end);
	const fb = byId(rewardFallback, id);
	const rewards = { items: [], choices: [] };
	if (fb) {
		const items = itemList(fb.items);
		if (fb.choice) rewards.choices = items;
		else rewards.items = items;
	}
	const money = Number(byId(moneyFallback, id)) > 0 ? Number(byId(moneyFallback, id)) : null;
	return {
		id,
		title: q && q.title ? String(q.title) : String((link && link.name) || ''),
		faction,
		level: q && Number(q.level) > 0 ? Number(q.level) : Number(det.level) || null,
		minLevel: q && Number(q.minLevel) > 0 ? Number(q.minLevel) : Number(det.requires) || null,
		classes: det.classOnly ? [String(det.classOnly).toUpperCase()] : classesOf(q && q.classes),
		...xpOf(id, q, null, xpFallback),
		money,
		rewards,
		start,
		end,
		startItem: det.startItem && Number(list(det.startItem)[0]) > 0 ? { item: Number(list(det.startItem)[0]), name: String(list(det.startItem)[1] || '') } : null,
		inData: !!q,
		shareable: shareableOf(ctx, id),
	};
}

// DungeonJournal's audited shareability (true / false), null where not audited.
function shareableOf(ctx, id) {
	const v = byId(ctx.shareable, id);
	return typeof v === 'boolean' ? v : null;
}

module.exports = {
	FOLDER,
	WEB_POSITIONS,
	TRAVEL,
	findDungeonJournal,
	readToc,
	loadDungeonJournal,
	buildDungeons,
	parseMoney,
	npcNameOf,
	saysInside,
	slug,
	raceOk,
	ALLIANCE_RACES,
	HORDE_RACES,
};
