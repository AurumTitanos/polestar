'use strict';
// Tabs of guides whose pack is missing or switched off (Engine "Tabs" with
// the guide pack registry): they stay saved, with their pins, and come back
// in their old place when the guide is there again.

const { test } = require('node:test');
const assert = require('node:assert/strict');
const { runAddon } = require('./helpers/lua');
const { TEST_PACK } = require('./helpers/packs');

const CORE = { name: 'Polestar', files: ['Core/Core.xml'] };

const WORLD = `
local w = stub.world
w.addMap(1429, { name = "Elwynn Forest", c = 0, left = 1500, right = -1500, top = 500, bottom = -1500 })
w.moveTo(1429, 20, 80)
`;

const STEPS = 'steps = { { goals = { { t = "level", level = 50 } } }, { goals = { { t = "level", level = 55 } } }, { goals = { { t = "level", level = 60 } } } }';

const TEST_GUIDES = `
${TEST_PACK}
for i = 1, 8 do
	Polestar.RegisterGuide({ id = "test/" .. i, pack = "test", title = "T" .. i, category = "Exploration", ${STEPS} })
end
Polestar.RegisterGuide({ id = "test/x", pack = "test", title = "X", category = "Exploration", ${STEPS} })
`;

const JOE = `
Polestar.RegisterPack({ addon = "JoeAddon", id = "joe", format = 1, title = "Joe", author = "Joe", version = "1", license = "MIT" })
Polestar.RegisterGuide({ id = "joe/a", pack = "joe", title = "A", category = "Exploration", ${STEPS} })
Polestar.RegisterGuide({ id = "joe/b", pack = "joe", title = "B", category = "Exploration", ${STEPS} })
`;

const HELPERS = `
E = Polestar.Engine
function flush() stub.advance(0.25) end
function ids()
	local list, active = E.GetTabs()
	local out = {}
	for i, t in ipairs(list) do out[i] = t.guideId end
	return { tabs = out, active = active }
end
function stepOf(id)
	for _, t in ipairs(E.GetTabs()) do if t.guideId == id then return t.stepIndex end end
	return false
end
-- SavedVariables as the client writes them back.
function dump(t)
	if type(t) ~= "table" then return t == nil and "nil" or (type(t) == "string" and string.format("%q", t) or tostring(t)) end
	local parts = {}
	local keys = {}
	for k in pairs(t) do keys[#keys + 1] = k end
	table.sort(keys, function(a, b) return tostring(a) < tostring(b) end)
	for _, k in ipairs(keys) do
		local key = type(k) == "number" and ("[" .. k .. "]") or ("[" .. string.format("%q", k) .. "]")
		parts[#parts + 1] = key .. " = " .. dump(t[k])
	end
	return "{ " .. table.concat(parts, ", ") .. " }"
end
`;

function run({ joe = true, saved, script }) {
	return runAddon({
		stubs: ['stub_world.lua'],
		before: WORLD,
		addons: [CORE],
		saved: saved ? { Polestar: saved } : undefined,
		script: `${TEST_GUIDES}\n${joe ? JOE : ''}\n${HELPERS}\nstub.login(); flush()\n${script}`,
	}).emitted;
}

const SAVED = 'PolestarCharDB = { schema = 1, tabs = { "joe/a", "test/x" }, activeTab = 1, pins = { ["joe/a"] = { step = 3, done = false }, ["test/x"] = { step = 2, done = false } } }';

test('a missing pack\'s tab stays saved with its pin and comes back in its old place at its step', () => {
	const [first] = run({
		joe: false,
		saved: SAVED,
		script: `
			local r = { login = ids(), step = stepOf("test/x") }
			E.OpenTab("test/1", false); flush()
			r.saved = PolestarCharDB.tabs
			r.pin = PolestarCharDB.pins["joe/a"] or false
			r.state = dump(PolestarCharDB)
			emit(r)
		`,
	});
	assert.deepEqual(first.login, { tabs: ['test/x'], active: 1 });
	assert.equal(first.step, 2);
	assert.deepEqual(first.saved, ['test/x', 'test/1', 'joe/a']);
	assert.deepEqual(first.pin, { step: 3, done: false });

	const [second] = run({
		saved: `PolestarCharDB = ${first.state}`,
		script: 'emit({ ids = ids(), step = stepOf("joe/a"), saved = PolestarCharDB.tabs })',
	});
	assert.deepEqual(second.ids.tabs, ['joe/a', 'test/x', 'test/1']);
	assert.equal(second.step, 3);
	assert.deepEqual(second.saved, ['joe/a', 'test/x', 'test/1']);
});

test('switching a pack off closes its tabs and keeps them saved; on again, they return in order at their step', () => {
	const [out] = run({
		script: `
			E.OpenTab("test/x"); E.OpenTab("joe/a"); E.OpenTab("test/1"); E.OpenTab("joe/b")
			E.SelectTab(2); E.Goto(3); flush()
			local r = { before = ids() }
			Polestar.Guides.SetPackShown("joe", false); flush()
			r.hidden = ids()
			r.guide = E.GetGuide().id
			r.saved = PolestarCharDB.tabs
			r.pin = PolestarCharDB.pins["joe/a"] or false
			Polestar.Guides.SetPackShown("joe", true); flush()
			r.back = ids()
			r.step = stepOf("joe/a")
			r.savedBack = PolestarCharDB.tabs
			emit(r)
		`,
	});
	assert.deepEqual(out.before, { tabs: ['test/x', 'joe/a', 'test/1', 'joe/b'], active: 2 });
	assert.deepEqual(out.hidden.tabs, ['test/x', 'test/1']);
	assert.ok(out.guide === 'test/x' || out.guide === 'test/1', out.guide);
	assert.deepEqual(out.saved, ['test/x', 'test/1', 'joe/a', 'joe/b']);
	assert.deepEqual(out.pin, { step: 3, done: false });
	assert.deepEqual(out.back.tabs, ['test/x', 'joe/a', 'test/1', 'joe/b']);
	assert.equal(out.step, 3);
	assert.deepEqual(out.savedBack, ['test/x', 'joe/a', 'test/1', 'joe/b']);
});

test('saved absent tabs never take an open tab\'s place, and at most MAX_TABS of them are kept, newest first', () => {
	const [out] = run({
		joe: false,
		saved: 'PolestarCharDB = { schema = 1, tabs = { "test/1", "test/2", "test/3", "test/4", "test/5", "gone/1", "gone/2" }, activeTab = 1 }',
		script: `
			local r = { max = E.MAX_TABS, login = ids().tabs }
			r.sixth = E.OpenTab("test/6") or false
			r.seventh = E.OpenTab("test/7") or false
			r.saved = PolestarCharDB.tabs
			emit(r)
		`,
	});
	assert.equal(out.max, 6);
	assert.deepEqual(out.login, ['test/1', 'test/2', 'test/3', 'test/4', 'test/5']);
	assert.equal(out.sixth, 6, 'five open tabs and two absent ones: a sixth still opens');
	assert.equal(out.seventh, false, 'six open tabs: full, as before');
	assert.deepEqual(out.saved, ['test/1', 'test/2', 'test/3', 'test/4', 'test/5', 'test/6', 'gone/1', 'gone/2']);

	const many = Array.from({ length: 9 }, (_, i) => `"gone/${i + 1}"`).join(', ');
	const [kept] = run({
		joe: false,
		saved: `PolestarCharDB = { schema = 1, tabs = { "test/1", ${many} }, activeTab = 1 }`,
		script: 'E.OpenTab("test/2", false); emit(PolestarCharDB.tabs)',
	});
	assert.deepEqual(kept, ['test/1', 'test/2', 'gone/4', 'gone/5', 'gone/6', 'gone/7', 'gone/8', 'gone/9']);
});

test('an absent guide put into a tab by SetGuide is no longer absent: closed, it stays closed', () => {
	const [out] = run({
		script: `
			Polestar.RegisterPack({ addon = "ZedAddon", id = "zed", format = 1, title = "Zed", author = "Z", version = "1", license = "MIT" })
			Polestar.RegisterGuide({ id = "zed/a", pack = "zed", title = "Z", category = "Exploration", ${STEPS} })
			local G = Polestar.Guides
			E.OpenTab("joe/a"); for i = 1, 5 do E.OpenTab("test/" .. i) end
			G.SetPackShown("joe", false); flush()
			E.OpenTab("test/6"); flush()
			G.SetPackShown("joe", true); flush()
			local r = { full = ids().tabs, savedFull = PolestarCharDB.tabs }
			E.SetGuide("joe/a"); flush()
			r.set = ids().tabs
			r.savedSet = PolestarCharDB.tabs
			E.CloseTab(ids().active); flush()
			r.closed = PolestarCharDB.tabs
			G.SetPackShown("zed", false); flush()
			r.afterZed = ids().tabs
			r.savedAfterZed = PolestarCharDB.tabs
			emit(r)
		`,
	});
	assert.deepEqual(out.full, ['test/1', 'test/2', 'test/3', 'test/4', 'test/5', 'test/6'], 'full strip: joe/a stays absent');
	assert.deepEqual(out.savedFull, ['test/1', 'test/2', 'test/3', 'test/4', 'test/5', 'test/6', 'joe/a']);
	assert.ok(out.set.includes('joe/a'), out.set.join(','));
	assert.equal(out.savedSet.filter((id) => id === 'joe/a').length, 1);
	assert.ok(!out.closed.includes('joe/a'), out.closed.join(','));
	assert.ok(!out.afterZed.includes('joe/a'), out.afterZed.join(','));
	assert.ok(!out.savedAfterZed.includes('joe/a'), out.savedAfterZed.join(','));
});

test('a tab reopened after its pack returns is no longer absent: closed, it stays closed', () => {
	const [out] = run({
		script: `
			local G = Polestar.Guides
			local function close(id) for i, t in ipairs(ids().tabs) do if t == id then E.CloseTab(i) end end; flush() end
			E.OpenTab("test/x"); E.OpenTab("joe/a"); E.OpenTab("joe/b"); flush()
			G.SetPackShown("joe", false); flush()
			G.SetPackShown("joe", true); flush()
			local r = { back = ids().tabs }
			close("joe/a")
			r.closed = PolestarCharDB.tabs
			G.SetPackShown("joe", false); flush()
			r.hidden = PolestarCharDB.tabs
			G.SetPackShown("joe", true); flush()
			r.reopened = ids().tabs
			close("joe/b")
			G.SetPackShown("joe", false); flush()
			G.SetPackShown("joe", true); flush()
			r.again = ids().tabs
			r.saved = PolestarCharDB.tabs
			emit(r)
		`,
	});
	assert.deepEqual(out.back, ['test/x', 'joe/a', 'joe/b']);
	assert.deepEqual(out.closed, ['test/x', 'joe/b']);
	assert.deepEqual(out.hidden, ['test/x', 'joe/b'], 'only the open joe tab is kept as absent');
	assert.deepEqual(out.reopened, ['test/x', 'joe/b']);
	assert.deepEqual(out.again, ['test/x']);
	assert.deepEqual(out.saved, ['test/x']);
});
