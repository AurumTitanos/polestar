'use strict';
// A fake translation for the addon's tests: Lua for runAddon's `before` that
// makes GetLocale() return `locale` and fills Polestar.L with `strings`
// right after Core/Init.lua runs, where a locale file (Locales/<locale>.lua)
// loads in the client. Code that looks a string up too early, or two
// meanings sharing one key, then shows in the test. Use a locale Polestar
// does not ship (frFR): a shipped one's file (deDE, esMX) loads after these
// strings and replaces them.
//
//   const { fakeLocale } = require('./helpers/locale');
//   runAddon({ before: fakeLocale('frFR', { 'Open settings': 'Ouvrir les options' }), ... });

function luaString(s) {
	return '"' + String(s).replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\n/g, '\\n') + '"';
}

function fakeLocale(locale, strings) {
	const fill = Object.entries(strings)
		.map(([k, v]) => `\t\tns.L[${luaString(k)}] = ${luaString(v)}`)
		.join('\n');
	return `function GetLocale() return ${luaString(locale)} end
do
	local load = loadfile
	function loadfile(file)
		local chunk, err = load(file)
		if not chunk or not file:match("[/\\\\]Polestar[/\\\\]Core[/\\\\]Init%.lua$") then return chunk, err end
		return function(name, ns)
			chunk(name, ns)
${fill}
		end
	end
end`;
}

module.exports = { fakeLocale };
