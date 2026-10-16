'use strict';
// Polestar.Gear upgrade advice (addon/Polestar/Gear): the tooltip upgrade
// line's decisions (usable or not, two-hand vs one-hand, rings and trinkets
// against the weaker one, unique items, empty slots), the reward pick on
// quest choices and its tooltip line, racials, every spec's shipped weights,
// laziness (no ItemDB load at login) and the cost of one tooltip show.

const { test } = require('node:test');
const assert = require('node:assert/strict');
const { runAddon } = require('./helpers/lua');
const { fakeLocale } = require('./helpers/locale');

const ADDON = { name: 'Polestar', files: ['Core/Core.xml', 'Gear/Gear.xml'] };

// Items in the generated ItemDB format (tools/lib/itemdb/stats.js encode).
const ITEMS = `{
	[9101] = "1 25 20 2 4 3 str10 sta6 armor180",
	[9102] = "1 25 20 2 4 1 int10 spi6 armor40",
	[9103] = "1 25 20 2 4 3 str10 sta6 armor180",
	[9105] = "5 26 20 2 4 4 str12 sta8 armor400",
	[9106] = "13 25 20 2 2 4 str5 dmin20 dmax30 speed2000",
	[9107] = "13 25 20 2 2 0 str5 dmin20 dmax30 speed2000",
	[9110] = "17 25 20 2 2 1 str12 dmin50 dmax70 speed3300",
	[9111] = "14 25 20 2 4 6 sta4 armor600",
	[9120] = "11 25 20 2 4 0 str4",
	[9121] = "11 25 20 2 4 0 str8",
	[9122] = "11 25 20 2 4 0 str2",
	[9123] = "11 25 20 3 4 0 str6 uniq1",
	[9130] = "12 25 20 2 4 0 ap20",
	[9131] = "12 25 20 2 4 0 ap40",
	[9140] = "13 25 20 2 2 15 agi3 dmin10 dmax18 speed1700",
	[9150] = "1 25 20 2 4 1 int10 spi6 armor40 cls128",
}`;

const LEVELING = `{
	names = { [9101] = "Militia Helm", [9102] = "Scholar Cap", [9103] = "Twin Helm" },
	src = { [9101] = "q5001", [9102] = "q5001", [9103] = "q5001" },
	quests = { [5001] = "20 15 1 12 0 0 0|9101,9102,9103||Alliance Choice" },
	npcs = {}, zones = { [12] = "Elwynn Forest" },
}`;

function run(script, { cls = 'WARRIOR', className = 'Warrior', classID = 1, level = 22, race = 'Troll', raceID = 8, faction = 'Horde', register = true, locale = '' } = {}) {
	return runAddon({
		stubs: ['stub_world.lua', 'stub_gear.lua'],
		before: `w = stub.world; g = stub.gear
w.class, w.className, w.classID, w.level = "${cls}", "${className}", ${classID}, ${level}
w.race, w.raceName, w.raceID, w.faction = "${race}", "${race}", ${raceID}, "${faction}"
${locale}`,
		addons: [ADDON],
		login: true,
		script: `G = Polestar.Gear
${register ? `Polestar.ItemDB.Register({ schema = 1, build = "test" }, ${ITEMS})
Polestar.ItemDB.RegisterLeveling({ source = "test" }, ${LEVELING})` : ''}
G.RefreshPlayer()
local function line(link) for _, l in ipairs(g.showTooltip(GameTooltip, link)) do if l:find("^Polestar") then return l end end return false end
${script}`,
	}).emitted;
}

test('every spec: an item of its best stats outscores one of its worst at 10, 30 and 60, with the shipped weights', () => {
	const [out] = run(`
		local res = {}
		local P = { "str", "agi", "int", "spi" }
		for class, meta in pairs(G.CLASSES) do
			for _, spec in ipairs(meta.specs) do
				for _, level in ipairs({ 10, 30, 60 }) do
					local w = G.WeightsFor(class, spec.key, level)
					local s = { unpack(P) }
					table.sort(s, function(a, b) return (w[a] or 0) > (w[b] or 0) end)
					local up = { inv = 16, class = 4, subclass = 1, stats = { [s[1]] = 10, [s[2]] = 6 } }
					local down = { inv = 16, class = 4, subclass = 1, stats = { [s[4]] = 10, [s[3]] = 6 } }
					res[#res + 1] = { class .. "." .. spec.key .. "@" .. level, G.ScoreWith(up, w, false) > G.ScoreWith(down, w, false) }
				end
			end
		end
		emit(res)
	`);
	assert.equal(out.length, 27 * 3);
	for (const [name, ok] of out) assert.ok(ok, name);
});

test('upgrade line: unusable items say why; class-restricted; the downgrade in red; equipped items get no line', () => {
	const [mail, mage, clsOnly, worn] = run(`
		g.equip(1, "item:9101")
		emit(line("item:9101"))
	`).concat(
		run('emit(line("item:9101"))', { cls: 'MAGE', className: 'Mage', classID: 8 }),
		run('emit(line("item:9150"))'),
		run('g.equip(1, "item:9101"); emit(line("item:9101"))'),
	).slice(0, 4);
	assert.equal(mail, false, 'the worn helm itself');
	assert.equal(mage, 'Polestar · Frost | armor you cannot wear');
	assert.equal(clsOnly, 'Polestar · Arms | not for your class');
	assert.equal(worn, false);
});

test('upgrade line: why an item is unusable is in the client language', () => {
	const es = fakeLocale('itIT', { 'armor you cannot wear': 'armadura que no puedes llevar', 'not for your class': 'no es para tu clase' });
	const [mage] = run('emit(line("item:9101"))', { cls: 'MAGE', className: 'Mage', classID: 8, locale: es });
	const [cls] = run('emit(line("item:9150"))', { locale: es });
	assert.equal(mage, 'Polestar · Frost | armadura que no puedes llevar');
	assert.equal(cls, 'Polestar · Arms | no es para tu clase');
});

test('two-hand vs one-hand: a two-hander against main + off hand; a one-hander against a worn two-hander pairs with the best bag off-hand', () => {
	const [twoHand, oneHand] = run(`
		g.equip(16, "item:9106"); g.equip(17, "item:9111")
		emit(line("item:9110"))
		g.equip(17, nil); g.equip(16, "item:9110"); g.bag(0, 1, "item:9111")
		emit(line("item:9107"))
	`);
	assert.match(twoHand, /^Polestar · Arms \| \+[\d.]+% upgrade · Main Hand$/);
	assert.match(oneHand, /^Polestar · Arms \| -[\d.]+% downgrade · Main Hand$/);
});

test('rings and trinkets: against the weaker equipped one; a unique ring only against its own copy; an empty slot first', () => {
	const [ring, unique, trinket, empty] = run(`
		g.equip(11, "item:9120"); g.equip(12, "item:9121")
		emit(line("item:9122"))
		emit(line("item:9123"))
		g.equip(13, "item:9130"); g.equip(14, "item:9130")
		emit(line("item:9131"))
		g.equip(14, nil)
		emit(line("item:9131"))
	`);
	// 9122 (str 2) against the weaker ring 9120 (str 4): -50%
	assert.equal(ring, 'Polestar · Arms | -50% downgrade · Finger');
	assert.equal(unique, 'Polestar · Arms | +50% upgrade · Finger');
	assert.equal(trinket, 'Polestar · Arms | big upgrade · Trinket');
	assert.equal(empty, 'Polestar · Arms | upgrade (empty slot)');
});

test('reward picks: a known upgrade above a known downgrade, the same in any order; ties to the lower item ID; nothing better still names the best', () => {
	const [a, b, c, none] = run(`
		g.equip(1, "item:9102")
		local function pick(links) local list, p, best = G.RankChoices(links); return { list[p].id, best and list[best].id or false } end
		emit(pick({ "item:9102", "item:9103", "item:9101" }))
		emit(pick({ "item:9101", "item:9102", "item:9103" }))
		emit(pick({ "item:9103", "item:9101", "item:9102" }))
		g.equip(1, "item:9105")
		G.Invalidate("equipment")
		local p = G.QuestPick(5001)
		emit({ p.entry.id, p.upgrade })
	`);
	assert.deepEqual(a, [9101, 9101]);
	assert.deepEqual(b, a);
	assert.deepEqual(c, a);
	assert.deepEqual(none, [9101, false]);
});

test('reward-item tooltips: "Best pick" on an upgrade pick, "Reward pick" naming it on the others; nothing when no choice is an upgrade; off with gear.pickTooltip', () => {
	const [best, other, none, off] = run(`
		g.equip(1, "item:9102")
		emit(g.showTooltip(GameTooltip, "item:9101"))
		emit(g.showTooltip(GameTooltip, "item:9103"))
		g.equip(1, "item:9105")
		G.Invalidate("equipment")
		emit(g.showTooltip(GameTooltip, "item:9101"))
		g.equip(1, "item:9102")
		G.Invalidate("equipment")
		Polestar.Set("gear.pickTooltip", false)
		emit(g.showTooltip(GameTooltip, "item:9101"))
	`);
	assert.equal(best[1], 'Best pick | Alliance Choice');
	assert.equal(other[1], 'Reward pick | Militia Helm');
	// No upgrade: the reward panel's coin (the most valuable) decides, not Gear.
	assert.ok(!none.some((l) => /^(Best|Reward) pick/.test(l)), JSON.stringify(none));
	assert.equal(off.length, 1);
});

test('racials: Mace Specialization makes a Dwarf Shaman (a Forever pair) prefer the mace; an Orc the axe', () => {
	const R = `G.RACIALS[3] = { weaponCrit = { pct = 1, subclasses = { [4] = true, [5] = true } } }
		G.RACIALS[2] = { weaponCrit = { pct = 1, subclasses = { [0] = true, [1] = true } } }
		G.RefreshPlayer()`;
	const [dwarf] = run(`${R}; emit(G.ScoreItem("item:9106") > G.ScoreItem("item:9107"))`, { cls: 'SHAMAN', className: 'Shaman', classID: 7, race: 'Dwarf', raceID: 3, faction: 'Alliance' });
	const [orc] = run(`${R}; emit(G.ScoreItem("item:9107") > G.ScoreItem("item:9106"))`, { cls: 'SHAMAN', className: 'Shaman', classID: 7, race: 'Orc', raceID: 2 });
	assert.equal(dwarf, true);
	assert.equal(orc, true);
});

test('lazy: login loads no item data and reads no bags; the first tooltip loads Polestar_ItemDB once', () => {
	const [out] = run(`
		local calls, bagReads = 0, 0
		C_AddOns.LoadAddOn = function(name) calls = calls + 1; return true end
		local slots = C_Container.GetContainerItemLink
		C_Container.GetContainerItemLink = function(...) bagReads = bagReads + 1; return slots(...) end
		stub.login()
		local atLogin = { calls, bagReads, Polestar.ItemDB.IsLoaded() }
		g.showTooltip(GameTooltip, "item:9101")
		emit({ atLogin = atLogin, after = calls })
	`, { register: false });
	assert.deepEqual(out.atLogin, [0, 0, false]);
	assert.equal(out.after, 1);
});

test('cost: a tooltip show stays under 1 ms (cold, and cached per item, spec and level)', () => {
	const [t] = run(`
		g.equip(1, "item:9102"); g.equip(11, "item:9120"); g.equip(12, "item:9121"); g.equip(16, "item:9106"); g.equip(17, "item:9111")
		local items = { "item:9101", "item:9103", "item:9105", "item:9110", "item:9122", "item:9123", "item:9131", "item:9140" }
		local clock = os.clock
		local n, t0 = 0, clock()
		for round = 1, 50 do
			G.Invalidate("equipment") -- every show cold: no cached answer
			for _, link in ipairs(items) do g.showTooltip(GameTooltip, link); n = n + 1 end
		end
		local cold = (clock() - t0) / n * 1000
		n, t0 = 0, clock()
		for round = 1, 200 do
			for _, link in ipairs(items) do g.showTooltip(GameTooltip, link); n = n + 1 end
		end
		local warm = (clock() - t0) / n * 1000
		emit({ cold = cold, warm = warm })
	`);
	console.log(`tooltip show: ${t.cold.toFixed(4)} ms cold, ${t.warm.toFixed(4)} ms cached`);
	assert.ok(t.cold < 1, `cold ${t.cold} ms`);
	assert.ok(t.warm < 1, `cached ${t.warm} ms`);
});
