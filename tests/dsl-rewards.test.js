'use strict';
// Turn-in rewards (`reward`, `choose`, `xp`, `money` on `turnin`): parse,
// names from data, errors, Lua emission through the engine registry, the step
// view, and the guide window's reward line.

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { runAddon } = require('./helpers/lua');
const { compile, guideText, lineOf, plain, writeTestPack } = require('./fixtures/dsl/helpers');
const { TEST_PACK, TEST_SOURCE } = require('./helpers/packs');

const LINES = ['step S', '  accept 783', '  turnin 783 choose 159 750 "Wolf Steak" uncommon reward 990010 "Miner\'s Lantern" rare xp 1050 money 1g7s'];

function turnin(r) {
	return plain(r.guides[0].steps[0].goals[1]);
}

test('rewards: choices and items with names from data or the line, quality words, XP and money', () => {
	const r = compile(guideText(LINES));
	assert.deepEqual(r.errors, []);
	assert.deepEqual(r.warnings, [], 'an unknown reward item with a name is display only, no warning');
	assert.deepEqual(turnin(r).rewards, {
		choices: [
			{ item: 159, itemName: 'Refreshing Spring Water' },
			{ item: 750, itemName: 'Wolf Steak', quality: 2 },
		],
		items: [{ item: 990010, itemName: "Miner's Lantern", quality: 3 }],
		xp: 1050,
		money: 10700,
	});
	const plainMoney = compile(guideText(['step S', '  accept 783', '  turnin 783 money 350']));
	assert.deepEqual(turnin(plainMoney).rewards, { money: 350 });
});

test('rewards: XP from the line counts toward the route level when data has no XP', () => {
	// 9300 needs level 20; a 100000 XP turn-in before it makes that plausible.
	const lines = ['step S', '  accept 990900 "New Quest" @48,42', '  turnin 990900 "New Quest" @48,42 xp 100000', '  accept 9300'];
	const r = compile(guideText(lines));
	assert.deepEqual(r.warnings.filter((w) => /needs level 20/.test(w)), []);
	const without = compile(guideText(['step S', '  accept 990900 "New Quest" @48,42', '  turnin 990900 "New Quest" @48,42', '  accept 9300']));
	assert.equal(without.warnings.filter((w) => /needs level 20/.test(w)).length, 1);
});

test('rewards: malformed lists, unknown unnamed items, bad money and other verbs are errors', () => {
	const src = guideText([
		'step S',
		'  accept 783',
		'  turnin 783 choose xp 5',
		'  turnin 783 reward 990010',
		'  turnin 783 choose 159 159',
		'  turnin 783 money 5x',
		'  turnin 783 xp 0',
		'  accept 7 xp 50',
		'  turnin 783 choose 159 choose 750',
	]);
	const r = compile(src);
	assert.deepEqual(r.errors, [
		`test.guide:${lineOf(src, '  turnin 783 choose xp 5')}: \`choose\` needs item ids: choose <itemId> ["Item name"] [quality] ...`,
		`test.guide:${lineOf(src, '  turnin 783 reward 990010')}: reward item 990010 is not in data; give its name: \`990010 "Item name"\``,
		`test.guide:${lineOf(src, '  turnin 783 choose 159 159')}: \`choose\` lists item 159 twice`,
		`test.guide:${lineOf(src, '  turnin 783 money 5x')}: malformed money "5x" (copper, or e.g. 1g50s, 7s)`,
		`test.guide:${lineOf(src, '  turnin 783 xp 0')}: malformed xp amount "0"`,
		`test.guide:${lineOf(src, '  accept 7 xp 50')}: \`xp <N>\` does not apply to \`accept\``,
		`test.guide:${lineOf(src, '  turnin 783 choose 159 choose 750')}: duplicate \`choose\``,
	]);
});

test('rewards: emitted Lua passes the engine registry and the step view carries them', () => {
	const r = compile(guideText(LINES).replace(/^guide t\//, 'guide test/'), undefined, { pack: 'test' });
	const file = path.join(writeTestPack(r.guides).dir, 'Guides.lua');
	assert.match(fs.readFileSync(file, 'utf8'), /rewards = \{ choices = \{ \{ item = 159, itemName = "Refreshing Spring Water" \}, \{ item = 750, itemName = "Wolf Steak", quality = 2 \} \}, items = \{ \{ item = 990010, itemName = "Miner's Lantern", quality = 3 \} \}, money = 10700, xp = 1050 \}/);
	const [out] = runAddon({
		stubs: ['stub_world.lua'],
		before: 'stub.world.addMap(1429, { name = "Elwynn Forest", c = 0, left = 1500, right = -1500, top = 500, bottom = -1500 })\nstub.world.moveTo(1429, 48, 42)',
		addons: [{ name: 'Polestar', files: ['Core/Core.xml'] }],
		script: `
			local res = {}
			local real = Polestar.RegisterGuide
			Polestar.RegisterGuide = function(g) local ok, e = real(g); res[#res + 1] = ok and "ok" or e; return ok, e end
			${TEST_PACK}
			${TEST_SOURCE}
			assert(loadfile(${JSON.stringify(file)}))("Polestar_Guides", {})
			stub.login()
			Polestar.Engine.SetGuide("test/main")
			stub.advance(0.6)
			local view = Polestar.Engine.GetStepView(1)
			emit({ res = res, rewards = view.goals[2].rewards })`,
	}).emitted;
	assert.deepEqual(out.res, ['ok']);
	assert.deepEqual(out.rewards, turnin(r).rewards);
	const bad = runAddon({
		addons: [{ name: 'Polestar', files: ['Core/Core.xml'] }],
		script: `${TEST_PACK}
${TEST_SOURCE}\nemit({ Polestar.RegisterGuide({ id = "test/bad", pack = "test", title = "B", steps = { { goals = { { t = "turnin", quest = 1, title = "Q", rewards = { choices = { { itemName = "x" } } } } } } } }) })`,
	}).emitted[0];
	assert.deepEqual(bad, [false, 'step 1 goal 1: bad reward 1']);
});

test('the guide window shows an open turn-in\'s rewards under it and in its tooltip, item names in quality colours', () => {
	const [out] = runAddon({
		stubs: ['stub_ui.lua'],
		before: 'ITEM_QUALITY_COLORS = { [2] = { r = 0.12, g = 1, b = 0 }, [3] = { r = 0, g = 0.44, b = 0.87 } }',
		addons: [{ name: 'Polestar', files: ['Core/Core.xml', 'Theme/Theme.xml', 'UI/UI.xml'] }],
		script: `
			local real = Polestar.Compat
			uistub.install()
			stub.login()
			-- The fake Compat keeps the real item-quality lookups (uncached items: compiled quality).
			Polestar.Compat.GetItemQuality, Polestar.Compat.ItemQualityHex = real.GetItemQuality, real.ItemQualityHex
			local UI = Polestar.UI
			local goal = { t = "turnin", status = "active", note = "Inside",
				rewards = { choices = { { item = 1, itemName = "Cloak", quality = 3 }, { item = 2, itemName = "Boots", quality = 2 }, { item = 3, itemName = "Ring" } },
					items = { { item = 4, itemName = "Map" } }, xp = 3570, money = 10750 } }
			local done = { t = "turnin", status = "done", rewards = goal.rewards }
			emit({ line = UI.GoalRewards(goal), sub = UI.GoalSubline(goal), done = UI.GoalSubline(done) or false,
				none = UI.GoalRewards({ t = "turnin" }) or false, item = Polestar.Theme.Hex("item") })`,
	}).emitted;
	const blue = 'ff0070de';
	const green = 'ff1fff00';
	assert.equal(out.line, `Choose: |c${blue}Cloak|r, |c${green}Boots|r or |c${out.item}Ring|r  \u00b7  Get: |c${out.item}Map|r  \u00b7  3,570 XP  \u00b7  1g 7s 50c`);
	assert.equal(out.sub, `Inside  \u00b7  ${out.line}`);
	assert.equal(out.done, false, 'a done turn-in drops its rewards');
	assert.equal(out.none, false);
});
