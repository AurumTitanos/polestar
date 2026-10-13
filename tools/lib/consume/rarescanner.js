'use strict';
// RareScanner (All Rights Reserved): rare NPCs, treasures and what they drop,
// and which mounts / pets come from a drop. Reads the installed addon's data
// tables (Tables/*.lua, plain `private.X = { ... }` data). Facts only: ids,
// map ids, coordinates, item ids. Every row is kept; filtering to the
// Forever client's zones is codex build's job.
//
//   const { readRareScanner } = require('./rarescanner');
//   const rs = readRareScanner();
//   rs.rares[0] -> { npc, name: null, map, x, y, points, loot }
//
// Output (docs: docs/ARCHITECTURE.md, section "Lookup"):
//   meta      { source, version, licence, files, warnings }
//   rares     [{ npc, name, map, x, y, points, loot }]   one row per map an NPC is placed on;
//             map/x/y null when RareScanner has no position (zoneID 0)
//   treasures [{ object, name, map, x, y, points, loot }]
//   mounts    { "<mountId>": [itemIds] }  (DROPPED_MOUNT_IDS)
//   pets      { "<speciesId>": [itemIds] } (DROPPED_PET_IDS)
// Coordinates are 0-100. RareScanner stores them as 0-10000 integers (or 0-1
// fractions), spawn points as "xxxx-yyyy" strings; `points` lists the
// overlay spawn points, [x, y] each. Names live only in source comments and
// are not read (name is always null; codex build names NPCs from QuestieDB).

const fs = require('node:fs');
const path = require('node:path');
const { addonsDir, addonVersion, readAddonLua } = require('./lua');

const ADDON = 'RareScanner';
const FILES = [
	'Tables/NpcInfoTables.lua',
	'Tables/NpcLootTables.lua',
	'Tables/ContainerInfoTables.lua',
	'Tables/ContainerLootTables.lua',
	'Tables/Mounts.lua',
	'Tables/Pets.lua',
];

// Placement tables keyed by map id can look like arrays to the JSON encoder;
// every id-keyed table leaves Lua as sorted pairs.
const EXPR = String.raw`local ns = POLESTAR_NS
local function places(info)
  local out = {}
  for _, kv in ipairs(POLESTAR_pairs(info)) do
    local id, v = kv[1], kv[2]
    if type(v) == "table" then
      local z = v.zoneID
      local rec = { id = id }
      if type(z) == "table" then
        rec.zones = {}
        for _, zk in ipairs(POLESTAR_pairs(z)) do
          local p = zk[2]
          if type(p) == "table" then
            rec.zones[#rec.zones + 1] = { map = zk[1], x = p.x, y = p.y, overlay = p.overlay }
          end
        end
      else
        rec.zones = { { map = z, x = v.x, y = v.y, overlay = v.overlay } }
      end
      out[#out + 1] = rec
    end
  end
  return out
end
return {
  npcs = places(ns.NPC_INFO),
  npcLoot = POLESTAR_pairs(ns.NPC_LOOT),
  containers = places(ns.CONTAINER_INFO),
  containerLoot = POLESTAR_pairs(ns.CONTAINER_LOOT),
  mounts = POLESTAR_pairs(ns.DROPPED_MOUNT_IDS),
  pets = POLESTAR_pairs(ns.DROPPED_PET_IDS),
}`;

const list = (v) => (Array.isArray(v) ? v : []);

// One coordinate -> 0-100 (two decimals), or null.
function coord(v) {
	let n = typeof v === 'string' ? Number(v) : v;
	if (typeof n !== 'number' || !Number.isFinite(n) || n < 0) return null;
	if (typeof v === 'string' && v.includes('.')) n = n <= 1 ? n * 100 : n;
	else n = n <= 1 ? n * 100 : n / 100;
	return n > 100 ? null : Math.round(n * 100) / 100;
}

// "4100-4940" / "41004940" -> [41, 49.4]
function point(s) {
	if (typeof s !== 'string') return null;
	let m = s.match(/^\s*([\d.]+)\s*-\s*([\d.]+)\s*$/);
	if (!m) {
		const d = s.trim().match(/^(\d{4})(\d{4})$/);
		if (d) m = d;
	}
	if (!m) return null;
	const x = coord(m[1].includes('.') ? m[1] : Number(m[1]));
	const y = coord(m[2].includes('.') ? m[2] : Number(m[2]));
	return x == null || y == null ? null : [x, y];
}

function ids(v) {
	return list(v).filter((n) => typeof n === 'number' && n > 0);
}

// [[id, [items]], ...] -> Map(id -> items)
function lootMap(pairs) {
	const m = new Map();
	for (const [id, items] of list(pairs)) m.set(id, ids(items));
	return m;
}

function placedRows(records, loot, idKey) {
	const out = [];
	const seen = new Set();
	for (const rec of list(records)) {
		seen.add(rec.id);
		const items = loot.get(rec.id) || [];
		const zones = list(rec.zones);
		if (!zones.length) zones.push({});
		for (const z of zones) {
			const map = typeof z.map === 'number' && z.map > 0 ? z.map : null;
			const points = list(z.overlay).map(point).filter(Boolean);
			let x = map ? coord(z.x) : null;
			let y = map ? coord(z.y) : null;
			if (map && (x == null || y == null) && points.length) [x, y] = points[0];
			out.push({ [idKey]: rec.id, name: null, map, x: x ?? null, y: y ?? null, points: map ? points : [], loot: items });
		}
	}
	// Loot without a placement record still names a source.
	for (const [id, items] of loot) {
		if (!seen.has(id)) out.push({ [idKey]: id, name: null, map: null, x: null, y: null, points: [], loot: items });
	}
	return out;
}

function idLists(pairs) {
	const out = {};
	for (const [id, items] of list(pairs)) out[String(id)] = ids(items);
	return out;
}

// -> { meta, rares, treasures, mounts, pets }
function readRareScanner(dir = addonsDir(), opts = {}) {
	const started = Date.now();
	const meta = { source: ADDON, version: null, licence: 'All Rights Reserved', files: [], warnings: [] };
	const out = { meta, rares: [], treasures: [], mounts: {}, pets: {} };
	const addonDir = dir ? path.join(dir, ADDON) : null;
	if (!addonDir || !fs.existsSync(addonDir)) {
		meta.warnings.push(`${ADDON} not installed${dir ? ` in ${dir}` : ''}`);
		meta.ms = Date.now() - started;
		return out;
	}
	meta.version = addonVersion(addonDir);
	const files = [];
	for (const f of FILES) {
		const p = path.join(addonDir, f);
		if (fs.existsSync(p)) files.push(p);
		else meta.warnings.push(`${ADDON}/${f} missing`);
	}
	meta.files = files.map((f) => path.relative(dir, f).split(path.sep).join('/'));
	if (!files.length) {
		meta.ms = Date.now() - started;
		return out;
	}
	const res = readAddonLua({ files, addonName: ADDON, expr: EXPR, ...(opts.timeout ? { timeout: opts.timeout } : {}) });
	out.rares = placedRows(res.npcs, lootMap(res.npcLoot), 'npc');
	out.treasures = placedRows(res.containers, lootMap(res.containerLoot), 'object');
	out.mounts = idLists(res.mounts);
	out.pets = idLists(res.pets);
	meta.ms = Date.now() - started;
	return out;
}

module.exports = { readRareScanner, coord, point };
