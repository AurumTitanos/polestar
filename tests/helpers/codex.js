'use strict';
// Turns a codex object (the data/forever/codex JSON shape, e.g.
// tests/fixtures/codex/sample.json) into a loadable Polestar_Codex pack.
//
//   const { writeCodexPack, sampleCodex } = require('./helpers/codex');
//   const pack = writeCodexPack(sampleCodex());
//   runAddon({
//     before: pack.stubLua,      // C_AddOns.LoadAddOn("Polestar_Codex") dofiles the pack
//     addons: ['Polestar'],
//     script: 'emit(Polestar.Codex.Load())',
//   });
//   pack.cleanup();
//
// `loadLua` dofiles the pack directly (run it after Polestar has loaded);
// `stubLua` instead makes the stubbed client load it when asked, the way the
// game does, so Data.Pack / Codex.Load / Search behave as in game.

const fs = require('node:fs');
const { tmpdir } = require('./tmp');
const path = require('node:path');
const { emitPack, packOrder, ADDON } = require('../../tools/lib/codex/pack');

const SAMPLE = path.join(__dirname, '..', 'fixtures', 'codex', 'sample.json');

function sampleCodex() {
	return JSON.parse(fs.readFileSync(SAMPLE, 'utf8'));
}

function luaString(s) {
	return '"' + String(s).replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\n/g, '\\n') + '"';
}

// -> { dir, files (absolute, TOC order), loadLua, stubLua, cleanup }
function writeCodexPack(codex, opts = {}) {
	const out = emitPack(codex, { version: '0.0.0-test', build: '1.60.1.70338', ...opts });
	const dir = tmpdir('polestar-codex-');
	const addonDir = path.join(dir, ADDON);
	fs.mkdirSync(addonDir);
	for (const [rel, text] of Object.entries(out)) fs.writeFileSync(path.join(addonDir, rel), text);
	const files = packOrder(out).map((f) => path.join(addonDir, f));
	const list = `{ ${files.map(luaString).join(', ')} }`;
	const loadLua = `for _, f in ipairs(${list}) do dofile(f) end`;
	const stubLua = `do
  local __codexFiles = ${list}
  local __load = C_AddOns.LoadAddOn
  function C_AddOns.LoadAddOn(name)
    if name ~= ${luaString(ADDON)} then return __load(name) end
    if not stub.addonsLoaded[name] then
      for _, f in ipairs(__codexFiles) do dofile(f) end
      stub.addonsLoaded[name] = true
    end
    return true, nil
  end
end`;
	return {
		dir: addonDir,
		files,
		loadLua,
		stubLua,
		cleanup: () => fs.rmSync(dir, { recursive: true, force: true }),
	};
}

module.exports = { writeCodexPack, sampleCodex, SAMPLE };
