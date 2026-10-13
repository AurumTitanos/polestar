'use strict';
// The built Codex pack (addon/Polestar_Codex, local: `node tools/polestar.js
// codex build`) end to end: searching a mount's name finds it, it has ranked
// sources, the curated guide that collects it is the one Lookup opens, and the
// guide Lookup builds from its best source plays to the end in the real engine
// (tests/helpers/guide-sim.js). Skips when the pack has not been built.

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { runAddon, ROOT } = require('./helpers/lua');
const { SIMULATE, luaValue } = require('./helpers/guide-sim');

const PACK = path.join(ROOT, 'addon', 'Polestar_Codex');
const TOC = path.join(PACK, 'Polestar_Codex.toc');
const FRAMES = path.join(ROOT, 'data', 'forever', 'map-frames.json');
const skip = !fs.existsSync(TOC) || !fs.existsSync(FRAMES) ? 'Codex pack not built (node tools/polestar.js codex build)' : false;

function packLua() {
	const files = fs
		.readFileSync(TOC, 'utf8')
		.split(/\r?\n/)
		.map((l) => l.trim())
		.filter((l) => l && !l.startsWith('#'))
		.map((f) => path.join(PACK, f));
	const list = `{ ${files.map((f) => JSON.stringify(f)).join(', ')} }`;
	return `do
  local __files, __load = ${list}, C_AddOns.LoadAddOn
  function C_AddOns.LoadAddOn(name)
    if name ~= "Polestar_Codex" then return __load(name) end
    if not stub.addonsLoaded[name] then
      for _, f in ipairs(__files) do dofile(f) end
      stub.addonsLoaded[name] = true
    end
    return true, nil
  end
end`;
}

// Every map the client knows, in its live frame (Forever's own bounds where
// they differ from Era's); Era-frame coordinates convert through the frames
// the pack registers.
function mapsLua() {
	const { era, forever = {} } = JSON.parse(fs.readFileSync(FRAMES, 'utf8'));
	const ids = new Set([...Object.keys(era), ...Object.keys(forever)]);
	return [...ids]
		.map((id) => {
			const f = forever[id] || era[id];
			return `w.addMap(${id}, { name = "", c = ${f.c}, left = ${f.left}, right = ${f.right}, top = ${f.top}, bottom = ${f.bottom} })`;
		})
		.join('\n');
}

// query: the search text; pick: Lua predicate over a result; who: the character.
function lookUp({ query, kindOf, race, faction, cls, level, at }) {
	const [found, built, out] = runAddon({
		stubs: ['stub_world.lua'],
		before: `${packLua()}
local w = stub.world
${mapsLua()}
w.race, w.raceName, w.class, w.className, w.faction = ${luaValue(race)}, ${luaValue(race)}, ${luaValue(cls)}, ${luaValue(cls)}, ${luaValue(faction)}
w.level = ${level}
w.moveTo(${at.join(', ')})`,
		addons: ['Polestar', 'Polestar_Guides'],
		script: `
stub.login()
Polestar.Set("behavior.autoNextGuide", false)
local results = Polestar.Search.Query(${luaValue(query)})
local hit
for _, r in ipairs(results) do
	if r.kind == ${luaValue(kindOf)} then hit = r; break end
end
local rows = hit and Polestar.Lookup.Sources(hit.kind, hit.id) or {}
local types = {}
for i, r in ipairs(rows) do types[i] = r.type .. (r.available and "" or ("!" .. tostring(r.why))) end
local mounts = {}
for _, r in ipairs(results) do
	if r.kind == "mount" then mounts[#mounts + 1] = { id = r.id, status = r.status or false, curated = r.curated or false } end
end
emit({ id = hit and hit.id or false, title = hit and hit.title or false, kinds = #results, types = types, mounts = mounts,
	curated = hit and Polestar.Lookup.CuratedGuide(hit.kind, hit.id) or false })
local best
for i, r in ipairs(rows) do if r.available and r.guideable then best = i; break end end
local gid, why = Polestar.Lookup.Guide(hit.kind, hit.id, best or 1)
local g = gid and Polestar.Guides.Get(gid)
emit({ id = gid or false, why = why or false, steps = g and #g.steps or 0 })
stub.advance(0.6)
${SIMULATE}`,
	}).emitted;
	return { found, built, out };
}

function assertPlays({ found, built, out }) {
	assert.ok(built.id, `a guide was built (${built.why})`);
	assert.ok(built.steps > 0);
	assert.ok(!out.stuck, `stuck: ${JSON.stringify(out.stuck)}`);
	assert.equal(out.done, true);
	assert.deepEqual(out.missing, {}, 'every accept and turn-in has a location');
	return found;
}

test('"Striped Frostsaber" finds the Night Elf saber sold in Darnassus, its curated guide, and the built guide plays', { skip }, () => {
	const found = assertPlays(
		lookUp({ query: 'Striped Frostsaber', kindOf: 'mount', race: 'NightElf', faction: 'Alliance', cls: 'HUNTER', level: 40, at: [1438, 55.5, 50.1] }),
	);
	assert.equal(found.id, 8631);
	assert.ok(found.types.some((t) => t === 'vendor'), `an available vendor source: ${found.types}`);
	assert.match(String(found.curated), /^forever\/collectibles\/mounts\//);
});

test('"Deathcharger" finds the Deathcharger\'s Reins with its Stratholme drop, and the built guide plays', { skip }, () => {
	const found = assertPlays(
		lookUp({ query: 'Deathcharger', kindOf: 'mount', race: 'Scourge', faction: 'Horde', cls: 'WARRIOR', level: 60, at: [1423, 50, 50] }),
	);
	assert.equal(found.id, 13335);
	assert.ok(found.types.some((t) => t === 'drop'), `an available drop source: ${found.types}`);
	assert.match(String(found.curated), /^forever\/collectibles\/mounts\/neutral\/deathcharger/);
});

test('"Frostsaber": the sabers on sale and covered by a guide come first, the retired Reins of the Frostsaber last', { skip }, () => {
	const found = assertPlays(
		lookUp({ query: 'Frostsaber', kindOf: 'mount', race: 'NightElf', faction: 'Alliance', cls: 'HUNTER', level: 60, at: [1438, 55.5, 50.1] }),
	);
	assert.notEqual(found.id, 12302);
	assert.equal(found.mounts[0].curated, true, `first mount is guide-backed: ${JSON.stringify(found.mounts)}`);
	const retired = found.mounts.findIndex((m) => m.id === 12302);
	assert.ok(retired >= 0, 'still listed, for reference');
	assert.equal(found.mounts[retired].status, 'retired');
	assert.ok(found.mounts.slice(retired).every((m) => m.status), 'nothing obtainable ranks below it');
});
