'use strict';
// Core plumbing (addon/Polestar/Core/Init.lua): message bus, settings, lifecycle, slash commands.

const { test } = require('node:test');
const assert = require('node:assert/strict');
const { runAddon } = require('./helpers/lua');

const CORE = { name: 'Polestar', files: ['Core/Init.lua'] };

test('a handler removed during dispatch does not make the bus skip the next one', () => {
	const [calls] = runAddon({
		addons: [CORE],
		script: `
			local calls = {}
			local a
			a = Polestar.On("X", function() calls[#calls + 1] = "a"; Polestar.Off(a) end)
			Polestar.On("X", function() calls[#calls + 1] = "b" end)
			Polestar.Fire("X")
			Polestar.Fire("X")
			emit(calls)`,
	}).emitted;
	assert.deepEqual(calls, ['a', 'b', 'b']);
});

test('one failing handler does not stop the others', () => {
	const [out] = runAddon({
		addons: [CORE],
		script: `
			local errors, calls = {}, {}
			geterrorhandler = function() return function(e) errors[#errors + 1] = tostring(e) end end
			Polestar.On("X", function() error("boom") end)
			Polestar.On("X", function(v) calls[#calls + 1] = v end)
			Polestar.Fire("X", 7)
			emit({ errors = #errors, calls = calls })`,
	}).emitted;
	assert.deepEqual(out, { errors: 1, calls: [7] });
});

test('settings fall back to defaults, store only non-default values, and announce changes', () => {
	const [out] = runAddon({
		addons: [CORE],
		script: `
			Polestar.RegisterDefaults("ui", { scale = 1, locked = false })
			local seen = {}
			Polestar.On("SETTING_CHANGED", function(p, v) seen[#seen + 1] = p .. "=" .. tostring(v) end)
			local before = Polestar.Get("ui.scale")
			Polestar.Set("ui.scale", 1.25)
			local stored = PolestarDB.settings.ui.scale
			Polestar.Set("ui.scale", 1)
			emit({ before = before, stored = stored, cleared = PolestarDB.settings.ui.scale == nil, now = Polestar.Get("ui.scale"), seen = seen })`,
	}).emitted;
	assert.deepEqual(out, { before: 1, stored: 1.25, cleared: true, now: 1, seen: ['ui.scale=1.25', 'ui.scale=1'] });
});

test('settings survive SavedVariables coming back nil after a cold restart', () => {
	const [out] = runAddon({
		addons: [CORE],
		script: `
			Polestar.RegisterDefaults("nav", { arrow = true })
			Polestar.Set("nav.arrow", false)
			PolestarDB = nil      -- the client failed to restore the file
			PolestarCharDB = nil
			local state = Polestar.CharState()
			emit({ arrow = Polestar.Get("nav.arrow"), manual = type(state.manual), flags = type(state.flags) })`,
	}).emitted;
	assert.deepEqual(out, { arrow: true, manual: 'table', flags: 'table' });
});

test('restored SavedVariables are used once ADDON_LOADED fires', () => {
	const [out] = runAddon({
		addons: [CORE],
		saved: { Polestar: 'PolestarDB = { schema = 1, settings = { ui = { scale = 0.9 } } }' },
		script: `
			Polestar.RegisterDefaults("ui", { scale = 1 })
			emit(Polestar.Get("ui.scale"))`,
	}).emitted;
	assert.equal(out, 0.9);
});

test('init and login callbacks run in order, and late registrations run at once', () => {
	const [out] = runAddon({
		before: `__order = {}`,
		addons: [
			{
				name: 'Polestar',
				files: ['Core/Init.lua'],
			},
		],
		login: true,
		script: `
			Polestar.OnLogin(function() __order[#__order + 1] = "late-login" end)
			emit(__order)`,
	}).emitted;
	assert.deepEqual(out, ['late-login']);

	const [ordered] = runAddon({
		before: `
			__order = {}
			local realLoad = loadfile
			loadfile = function(path)
				local chunk, err = realLoad(path)
				if not chunk then return nil, err end
				return function(...)
					chunk(...)
					local ns = Polestar
					ns.OnInit(function() __order[#__order + 1] = "init1" end)
					ns.OnLogin(function() __order[#__order + 1] = "login1" end)
					ns.OnInit(function() __order[#__order + 1] = "init2" end)
					ns.OnLogin(function() __order[#__order + 1] = "login2" end)
				end
			end`,
		addons: [CORE],
		script: `
			__order[#__order + 1] = "loaded"
			stub.login()
			emit(__order)`,
	}).emitted;
	assert.deepEqual(ordered, ['init1', 'init2', 'loaded', 'login1', 'login2']);
});

test('slash command: bare toggles the frame, names dispatch with the rest of the line, unknown prints help', () => {
	const [out] = runAddon({
		addons: [CORE],
		script: `
			local got = {}
			Polestar.On("TOGGLE_FRAME", function() got[#got + 1] = "toggle" end)
			Polestar.RegisterCommand("Goto", function(rest) got[#got + 1] = "goto:" .. rest end, "help text")
			SlashCmdList.POLESTAR("")
			SlashCmdList.POLESTAR("  goto   12 extra  ")
			local before = #stub.messages
			SlashCmdList.POLESTAR("nope")
			local printed = table.concat(stub.messages, "\\n", before + 1)
			emit({ got = got, mentionsUnknown = printed:find("nope", 1, true) ~= nil, listsGoto = printed:find("/polestar goto", 1, true) ~= nil })`,
	}).emitted;
	assert.deepEqual(out, { got: ['toggle', 'goto:12 extra'], mentionsUnknown: true, listsGoto: true });
});

test('registering an event the client does not know returns false instead of erroring', () => {
	const [out] = runAddon({
		addons: [CORE],
		script: `
			local real = stub.Methods.RegisterEvent
			stub.Methods.RegisterEvent = function(self, ev)
				if ev == "NOT_A_FOREVER_EVENT" then error("Attempt to register unknown event") end
				return real(self, ev)
			end
			local ok1 = Polestar.RegisterEvent("NOT_A_FOREVER_EVENT", function() end)
			local hits = 0
			local ok2 = Polestar.RegisterEvent("QUEST_ACCEPTED", function(_, id) hits = hits + id end)
			stub.fire("QUEST_ACCEPTED", 5)
			emit({ ok1 = ok1, ok2 = ok2, hits = hits })`,
	}).emitted;
	assert.deepEqual(out, { ok1: false, ok2: true, hits: 5 });
});

test('every slash command is registered by exactly one module (a second registration would silently replace the first)', () => {
	const fs = require('node:fs');
	const path = require('node:path');
	const root = path.join(__dirname, '..', 'addon');
	const seen = new Map();
	const walk = (dir) => {
		for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
			const p = path.join(dir, e.name);
			if (e.isDirectory()) walk(p);
			else if (e.name.endsWith('.lua')) {
				for (const m of fs.readFileSync(p, 'utf8').matchAll(/RegisterCommand\("([^"]+)"/g)) {
					const name = m[1].toLowerCase();
					seen.set(name, [...(seen.get(name) || []), path.relative(root, p)]);
				}
			}
		}
	};
	walk(root);
	const dupes = [...seen].filter(([, files]) => files.length > 1).map(([name, files]) => `${name}: ${files.join(', ')}`);
	assert.deepEqual(dupes, []);
});
