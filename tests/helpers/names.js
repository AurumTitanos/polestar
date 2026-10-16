'use strict';
// A names addon (Polestar_Names_<locale>, tools/lib/i18n/names.js) built
// from a few names, for the addon's tests: the stubbed client loads it when
// Polestar asks (C_AddOns.LoadAddOn), the way the game loads a
// load-on-demand addon, and counts every names pack it is asked for in
// __namesLoads.
//
//   const { namesPack } = require('./helpers/names');
//   const pack = namesPack('frFR', { npc: { 448: 'Lardeur' }, quest: { 176: '...' } });
//   runAddon({ before: `function GetLocale() return "frFR" end\n${pack.stubLua}`, ... });

const fs = require('node:fs');
const path = require('node:path');
const { tmpdir } = require('./tmp');
const { emitNamesAddon, NAME_KINDS, ADDON_PREFIX } = require('../../tools/lib/i18n/names');

function namesPack(locale, names) {
	const built = { names: {}, from: {} };
	for (const kind of NAME_KINDS) {
		const entries = Object.entries(names[kind] || {}).map(([id, n]) => [Number(id), n]).sort((a, b) => a[0] - b[0]);
		built.names[kind] = new Map(entries);
		built.from[kind] = { ding: 0, pfquest: entries.length };
	}
	const files = emitNamesAddon(locale, built, { version: '0.0.0-test', iface: '16001', sources: { ding: null, pf: { dir: null, revision: null } } });
	const name = `${ADDON_PREFIX}${locale}`;
	const dir = path.join(tmpdir('polestar-names-'), name);
	fs.mkdirSync(dir);
	for (const [f, text] of Object.entries(files)) fs.writeFileSync(path.join(dir, f), text);
	const stubLua = `__namesLoads = 0
do
  local __load = C_AddOns.LoadAddOn
  function C_AddOns.LoadAddOn(name)
    if type(name) == "string" and name:find("^${ADDON_PREFIX}") then __namesLoads = __namesLoads + 1 end
    if name ~= ${JSON.stringify(name)} then return __load(name) end
    if not stub.addonsLoaded[name] then
      dofile(${JSON.stringify(path.join(dir, 'Names.lua'))})
      stub.addonsLoaded[name] = true
    end
    return true, nil
  end
end`;
	return { dir, files, stubLua };
}

module.exports = { namesPack };
