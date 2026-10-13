'use strict';
// The shared reader for other addons' Lua data (docs/SUITE.md, "Data layer").
// Every importer under tools/lib/consume/ reads through here, on top of the
// toolchain's sandboxed Lua 5.1 (tools/lib/lua.js): the interpreter parses, so
// table constructors, string concatenation, local constants and the small
// amount of setup code data files carry all evaluate exactly as in the game.
//
//   const { addonsDir, readAddonLua } = require('./lua');
//   const dir = addonsDir();                      // the Forever client's Interface/AddOns
//   const out = readAddonLua({
//     files: [path.join(dir, 'X', 'Data.lua')],
//     addonName: 'X',
//     prelude: 'X = {}',                          // trusted: stubs the files expect
//     expr: 'return POLESTAR_pairs(POLESTAR_NS.Items)',
//   });
//
// Files load in order, sandboxed, each called with `...` = addonName and one
// private namespace table shared by the call (POLESTAR_NS), as the client
// passes them. `getfenv(0)` / `getfenv()` (the usual "upvalue the globals"
// idiom) is rewritten to POLESTAR_G, a read-only view of the globals. Lua
// helpers available to `prelude` and `expr`:
//   POLESTAR_pairs(t)  -> { { k, v }, ... } sorted by key, so id-keyed tables
//                         never collapse to JSON arrays
//   POLESTAR_STUB      -> a value that can be called, indexed and concatenated
//                         without failing (for UI calls the data files make)
// Only facts leave this module: callers keep ids, names, numbers and
// relations, never another addon's prose or code.

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { luaToJson } = require('../lua');

// Fixed client folders Forever has used, newest first.
const CLIENT_FOLDERS = ['_forever_', '_classic_beta_'];
const WOW_PATHS = [
	['Games', 'drive_c', 'Program Files (x86)', 'World of Warcraft'],
	['.wine', 'drive_c', 'Program Files (x86)', 'World of Warcraft'],
];

function isDir(p) {
	try {
		return fs.statSync(p).isDirectory();
	} catch {
		return false;
	}
}

// -> absolute path of the Forever client's Interface/AddOns, or null.
// explicit > $POLESTAR_ADDONS > $WOW_FOREVER_ADDONS > `install`'s detection >
// the usual Wine install paths.
function addonsDir(explicit, env = process.env, home = os.homedir()) {
	if (explicit) return isDir(explicit) ? path.resolve(explicit) : null;
	for (const key of ['POLESTAR_ADDONS', 'WOW_FOREVER_ADDONS']) {
		if (env[key] && isDir(env[key])) return path.resolve(env[key]);
	}
	try {
		const { detectAddonsDirs } = require('../addons');
		const found = detectAddonsDirs(home);
		const live = found.find((f) => f.kind === 'forever') || found[0];
		if (live && isDir(live.addons)) return live.addons;
	} catch {
		// detection is a convenience; fall through to the fixed paths
	}
	for (const parts of WOW_PATHS) {
		for (const client of CLIENT_FOLDERS) {
			const p = path.join(home, ...parts, client, 'Interface', 'AddOns');
			if (isDir(p)) return p;
		}
	}
	return null;
}

// Version line of an addon's TOC (the first TOC found, or `toc` when given).
function addonVersion(dir, toc) {
	const files = toc ? [toc] : fs.existsSync(dir) ? fs.readdirSync(dir).filter((f) => f.endsWith('.toc')).sort() : [];
	for (const f of files) {
		const text = fs.readFileSync(path.join(dir, f), 'utf8');
		const m = text.match(/^##\s*Version:\s*(.+)$/m);
		if (m) return m[1].trim();
	}
	return null;
}

const HELPERS = String.raw`
local function POLESTAR_cmp(a, b)
  local ta, tb = type(a), type(b)
  if ta ~= tb then return ta < tb end
  if ta == "number" or ta == "string" then return a < b end
  return tostring(a) < tostring(b)
end
function POLESTAR_pairs(t)
  local out = {}
  if type(t) ~= "table" then return out end
  local keys = {}
  for k in pairs(t) do keys[#keys + 1] = k end
  table.sort(keys, POLESTAR_cmp)
  for i, k in ipairs(keys) do out[i] = { k, t[k] } end
  return out
end
local __stubmt = {}
POLESTAR_STUB = setmetatable({}, __stubmt)
__stubmt.__index = function() return POLESTAR_STUB end
__stubmt.__call = function() return POLESTAR_STUB end
__stubmt.__concat = function(a, b)
  local function s(v) if v == POLESTAR_STUB then return "" end return tostring(v) end
  return s(a) .. s(b)
end
__stubmt.__tostring = function() return "" end
POLESTAR_G = setmetatable({}, {
  __index = function(_, k) return rawget(_G, k) end,
  __newindex = function(_, k, v) rawset(_G, k, v) end,
})
POLESTAR_NS = {}
`;

const GETFENV = /\bgetfenv\s*\(\s*0?\s*\)/g;

function luaQuote(s) {
	return `"${String(s).replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\n/g, '\\n').replace(/\r/g, '\\r')}"`;
}

// -> JSON value of `expr`. `rewrite(src, file)` may adjust a file's text before
// it loads (e.g. drop a line that needs the live client); keep it to the
// minimum the file needs. Throws when a file fails to load, naming it.
function readAddonLua({ files = [], addonName = 'Addon', prelude = '', expr, rewrite, timeout } = {}) {
	if (!expr) throw new Error('readAddonLua: expr is required');
	const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'polestar-consume-'));
	try {
		const loads = files.map((file, i) => {
			let src = fs.readFileSync(file, 'latin1');
			if (src.charCodeAt(0) === 27) throw new Error(`${file}: precompiled Lua is not accepted`);
			src = src.replace(/^\uFEFF/, '').replace(GETFENV, 'POLESTAR_G');
			if (rewrite) src = rewrite(src, file);
			const copy = path.join(dir, `${String(i).padStart(4, '0')}-${path.basename(file)}`);
			fs.writeFileSync(copy, src, 'latin1');
			return `do
  local ok, err = __polestar_loaddata(${luaQuote(copy)}, ${luaQuote(addonName)}, POLESTAR_NS)
  if not ok then error(${luaQuote(file)} .. ": " .. tostring(err), 0) end
end`;
		});
		return luaToJson({
			prelude: `${HELPERS}\n${prelude}\n${loads.join('\n')}`,
			expr,
			...(timeout ? { timeout } : {}),
		});
	} finally {
		fs.rmSync(dir, { recursive: true, force: true });
	}
}

// [[k, v], ...] (from POLESTAR_pairs) -> { k: v }
function pairsToObject(list) {
	const out = {};
	for (const [k, v] of Array.isArray(list) ? list : []) out[k] = v;
	return out;
}

module.exports = { addonsDir, addonVersion, readAddonLua, pairsToObject, luaQuote };
