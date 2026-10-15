'use strict';
// Talent plans (addon/Polestar/Talents): the plans in Builds.lua replayed
// under the snapshot's rules, plan progress (T.State), the snapshot checked
// against the live tree (moved IDs found by name, a missing talent makes the
// plan out of date), the marks on the talent frame (next ring, planned
// levels, off-plan flags, the tooltip line; nothing while inspecting, for
// another loadout or in combat until it ends), the level-up reminder and the
// hub section. The client is tests/lua/stub_talents.lua.

const { test } = require('node:test');
const assert = require('node:assert/strict');
const { runAddon } = require('./helpers/lua');

const CORE = ['Core/Core.xml', 'Theme/Theme.xml', 'Talents/Talents.xml'];
const WITH_UI = ['Core/Core.xml', 'Theme/Theme.xml', 'UI/UI.xml', 'Talents/Talents.xml'];

const PRELUDE = `
local T, TS = Polestar.Talents, stub.talents
local data = T.Data("PALADIN")
TS.useSnapshot(data)
local function plan(key) return T.BuildByKey(data, key) end
`;

function run(script, { files = CORE, stubs = [] } = {}) {
	return runAddon({
		stubs: ['stub_world.lua', 'stub_talents.lua', ...stubs],
		addons: [{ name: 'Polestar', files }],
		script: `${PRELUDE}\n${script}`,
	}).emitted;
}

// ------------------------------------------------------------ the plans

test('Builds.lua: three Paladin plans, 51 picks each, every one legal under the snapshot', () => {
	const [out] = run(`
local o = { prereq = data.prereq, tree = data.tree, specs = data.specs, plans = {} }
for _, b in ipairs(data.builds) do
	o.plans[#o.plans + 1] = { key = b.key, spec = b.specName, picks = #b.picks, first = b.picks[1].level, last = b.picks[#b.picks].level, errors = T.Replay(data, b) }
end
emit(o)`);
	assert.equal(out.tree, 1100);
	assert.equal(out.prereq, 'full', 'arrows need full rank until checked in game');
	assert.deepEqual(out.specs, ['Holy', 'Protection', 'Retribution']);
	for (const p of out.plans) {
		assert.equal(p.picks, 51, p.key);
		assert.equal(p.first, 10);
		assert.equal(p.last, 60);
		assert.equal(Object.keys(p.errors).length, 0, `${p.key}: ${JSON.stringify(p.errors)}`);
	}
});

test('Replay: a skipped arrow, an early tier and a skipped rank are caught; "started" relaxes arrows', () => {
	const [out, started] = run(`
local ret = plan("retribution")
local function copy(b, edit)
	local c = { key = b.key, picks = {} }
	for i, p in ipairs(b.picks) do c.picks[i] = { level = p.level, node = p.node, rank = p.rank } end
	edit(c.picks)
	return c
end
-- Vengeance needs Sanctified Judgement (an arrow): drop that pick's ranks.
local arrow
for _, e in ipairs(data.edges) do if data.nodes[e[2]].name == "Vengeance" then arrow = e end end
local fromNode = arrow[1]
local broken = copy(ret, function(p)
	local first
	for i, x in ipairs(p) do if x.node == fromNode and x.rank == data.nodes[fromNode].max then first = i end end
	p[first] = { level = p[first].level, node = p[1].node, rank = 99 }
end)
local early = copy(ret, function(p) p[1], p[25] = p[25], p[1]; p[1].level, p[25].level = 10, 34 end)
local errs = T.Replay(data, broken)
local arrowErr = false
for _, e in ipairs(errs) do if e:find("needs " .. data.nodes[fromNode].name, 1, true) then arrowErr = true end end
emit({ arrowErr = arrowErr, rankErr = errs[1] ~= nil, early = #T.Replay(data, early) > 0 })
data.prereq = "started"
emit(#T.Replay(data, ret))`);
	assert.ok(out.rankErr);
	assert.ok(out.arrowErr, 'the arrow into Vengeance');
	assert.ok(out.early, 'a deep talent at level 10');
	assert.equal(started, 0, 'the plans also hold if one rank opens an arrow');
});

// ------------------------------------------------------------ progress

test('State: next pick, unspent points, projected past the cap, off-plan ranks, complete', () => {
	const outs = run(`
local b = plan("retribution")
local function at(n, level, cap, extra)
	local ranks = {}
	for i = 1, n do ranks[b.picks[i].node] = b.picks[i].rank end
	for id, r in pairs(extra or {}) do ranks[id] = r end
	local s = T.State(b, ranks, level, cap)
	return { status = s.status, done = s.done, unspent = s.unspent, nextLevel = s.next and s.next.level, projected = s.next and T.Projected(s.next, s) or false, off = next(s.offPlan) ~= nil }
end
emit(at(0, 5, 30))
emit(at(10, 20, 30))
emit(at(11, 20, 30))
emit(at(21, 30, 30))
local holy = plan("holy").picks[1].node
emit(at(11, 20, 30, { [holy] = 5 }))
emit(at(51, 60, 60))`);
	assert.equal(outs[0].status, 'early');
	assert.deepEqual([outs[1].status, outs[1].unspent, outs[1].nextLevel], ['behind', 1, 20]);
	assert.deepEqual([outs[2].status, outs[2].unspent, outs[2].nextLevel], ['onplan', 0, 21]);
	assert.deepEqual([outs[3].status, outs[3].nextLevel, outs[3].projected], ['capped', 31, true]);
	assert.equal(outs[4].status, 'offplan');
	assert.equal(outs[5].status, 'complete');
});

// ------------------------------------------------------------ the live tree

test('Validate: a moved node is found by name and rank count; a missing one makes the plan out of date', () => {
	const outs = run(`
local soc
for id, n in pairs(data.nodes) do if n.name == "Seal of Command" then soc = id end end
TS.nodes[soc + 90000], TS.nodes[soc] = TS.nodes[soc], nil
local v = T.Validate(data, T.Read(data))
emit({ ok = v.ok, moved = v.moved, to = v.map[soc] == soc + 90000 })
TS.nodes[soc + 90000] = nil
v = T.Validate(data, T.Read(data))
emit({ ok = v.ok, missing = v.missing })
stub.login()
local c, why = T.Current()
emit({ why = why, state = c.state ~= nil })`);
	assert.deepEqual(outs[0], { ok: true, moved: 1, to: true });
	assert.deepEqual(outs[1], { ok: false, missing: ['Seal of Command'] });
	assert.deepEqual(outs[2], { why: 'stale', state: false }, 'no guessing: no state, no marks');
});

test('ActiveBuild: the chosen plan, else the spec with the most points; Choose("auto") follows again', () => {
	const outs = run(`
TS.learn(plan("protection"), 12)
stub.login()
emit(T.Current().build.key)
T.Choose("holy")
emit({ key = T.Current().build.key, choice = T.Choice() })
T.Choose("auto")
emit(T.Current().build.key)`);
	assert.equal(outs[0], 'protection');
	assert.deepEqual(outs[1], { key: 'holy', choice: 'holy' });
	assert.equal(outs[2], 'protection');
});

// ------------------------------------------------------------ the talent frame

const FRAME = `
local b = plan("retribution")
TS.learn(b, 20) -- level 30 with one point unspent: next is pick 21 (level 30)
stub.login()
local f = TS.openFrame()
stub.addonLoaded("Blizzard_PlayerSpells")
stub.runTimers()
local O = T.Overlay
local function markOf(id) return O.marks[TS.button(id)] end
local function view()
	local s = T.Current().staged
	local nxt = s.next.node
	local m = markOf(nxt)
	local shownMarks = 0
	for _, x in pairs(O.marks) do if x:IsShown() then shownMarks = shownMarks + 1 end end
	return { ring = m and m:IsShown() and m.Ring:IsShown() or false, badge = m and m.Badge.Text:GetText(), marks = shownMarks }
end
`;

test('Overlay: a ring on the next pick, its level as a badge, a flag off the plan; staged ranks move the ring', () => {
	const outs = run(`${FRAME}
emit(view())
local nxt = T.Current().staged.next
-- Stage the next pick in the frame (not applied yet).
TS.staged[nxt.node] = nxt.rank
EventRegistry:TriggerEvent("TalentFrameBase.ButtonsUpdated")
stub.fire("TRAIT_NODE_CHANGED", nxt.node)
stub.runTimers()
stub.runTimers()
local after = view()
after.moved = T.Current().staged.next ~= nxt
emit(after)
-- A point outside the plan.
local holy = plan("holy").picks[1].node
TS.ranks[holy] = 1
stub.fire("TRAIT_CONFIG_UPDATED", 7)
stub.runTimers()
stub.runTimers()
local m = markOf(holy)
emit({ flag = m and m:IsShown() and m.Flag:IsShown() or false })`, { stubs: [] });
	assert.equal(outs[0].ring, true);
	assert.equal(outs[0].badge, '30');
	assert.ok(outs[0].marks > 1, 'every planned talent with a rank to come has a badge');
	assert.equal(outs[1].moved, true);
	assert.equal(outs[1].ring, true, 'the ring is on the new next pick');
	assert.equal(outs[2].flag, true);
});

test('Overlay: projected picks are muted; tooltip line names the level and rank', () => {
	const outs = run(`${FRAME}
local s = T.Current().staged
local later
for _, p in ipairs(b.picks) do if p.level > 30 and s.nodeNext[p.node] == p then later = p break end end
emit({ projected = T.Projected(later, s) })
local btn = TS.button(s.next.node)
GameTooltip:SetOwner(btn, "ANCHOR_RIGHT")
stub.RunScript(btn, "OnEnter")
emit(GameTooltip.lines)
local other = TS.button(later.node)
GameTooltip:SetOwner(other, "ANCHOR_RIGHT")
stub.RunScript(other, "OnEnter")
emit(GameTooltip.lines)
Polestar.Set("talents.tooltip", false)
GameTooltip:SetOwner(btn, "ANCHOR_RIGHT")
stub.RunScript(btn, "OnEnter")
emit(#GameTooltip.lines)`);
	assert.equal(outs[0].projected, true);
	assert.equal(outs[1].length, 1);
	assert.match(outs[1][0], /^Polestar: level 30, rank \d\/\d \(Retribution plan\)  next$/);
	assert.match(outs[2][0], /\(past the level cap\)$/);
	assert.equal(outs[3], 0);
});

test('Overlay: nothing while inspecting or for another loadout; combat defers the redraw', () => {
	const outs = run(`${FRAME}
TS.inspecting = true
EventRegistry:TriggerEvent("TalentFrameBase.ConfigUpdated")
stub.runTimers()
emit(view().marks)
TS.inspecting = nil
TS.frameConfig = 99
EventRegistry:TriggerEvent("TalentFrameBase.ConfigUpdated")
stub.runTimers()
emit(view().marks)
TS.frameConfig = nil
stub.inCombat = true
EventRegistry:TriggerEvent("TalentFrameBase.ConfigUpdated")
stub.runTimers()
emit(view().marks)
stub.inCombat = false
stub.fire("PLAYER_REGEN_ENABLED")
stub.runTimers()
emit(view().marks)
-- Marks up, then inspecting someone mid-fight.
stub.inCombat = true
TS.inspecting = true
EventRegistry:TriggerEvent("TalentFrameBase.ConfigUpdated")
stub.runTimers()
emit(view().marks)
TS.inspecting = nil
stub.inCombat = false
stub.fire("PLAYER_REGEN_ENABLED")
stub.runTimers()
emit(view().marks)`);
	assert.equal(outs[0], 0, 'inspecting');
	assert.equal(outs[1], 0, 'another loadout');
	assert.equal(outs[2], 0, 'still hidden: the redraw waits for combat to end');
	assert.ok(outs[3] > 0, 'drawn after combat');
	assert.equal(outs[4], 0, 'marks come down when the frame changes in combat');
	assert.ok(outs[5] > 0, 'and come back after combat');
});

// ------------------------------------------------------------ reminder

test('Reminder: a chat line on level-up when a point waits, none past the cap or when switched off', () => {
	const outs = run(`
local b = plan("retribution")
TS.learn(b, 10)
TS.level = 20
stub.login()
stub.messages = {}
stub.fire("PLAYER_LEVEL_UP", 20)
stub.advance(2)
emit(stub.messages)
TS.learn(b, 21)
TS.level, TS.cap = 31, 30
stub.messages = {}
stub.fire("PLAYER_LEVEL_UP", 31)
stub.advance(2)
emit(#stub.messages)
TS.cap = 60
Polestar.Set("talents.reminder", false)
stub.messages = {}
stub.fire("PLAYER_LEVEL_UP", 31)
stub.advance(2)
emit(#stub.messages)`);
	assert.equal(outs[0].length, 1);
	assert.match(outs[0][0], /Talent point: Seal of Command 1\/1 \(Retribution plan\)\./);
	assert.equal(outs[1], 0, 'the next pick is past the cap');
	assert.equal(outs[2], 0);
});

// ------------------------------------------------------------ the hub section

test('View: the Talents section lists the followed plan with its status, tabs per spec, follow buttons', () => {
	const outs = run(`
local b = plan("retribution")
TS.learn(b, 20)
uistub = uistub
stub.login()
local TV = Polestar.UI.TalentsSection
TV.Show()
local s = TV.Shown()
emit({ rows = s.rows, spec = s.spec, mine = s.mine, status = s.status, follow = s.follow, auto = s.auto, notes = #s.notes, first = s.notes[1] })
local nav, active = TV.Nav()
local labels = {}
for _, n in ipairs(nav) do labels[#labels + 1] = n.label end
emit({ labels = labels, active = active })
TV.SetTab("1")
s = TV.Shown()
emit({ spec = s.spec, mine = s.mine, status = s.status, follow = s.follow })
TV.Follow()
emit({ choice = T.Choice(), followed = TV.Shown().followed })
TV.FollowSpec()
emit(T.Choice())`, { files: WITH_UI, stubs: ['stub_ui.lua'] });
	assert.deepEqual(outs[0], { rows: 51, spec: 'Retribution', mine: true, status: 'behind', follow: true, auto: false, notes: outs[0].notes, first: outs[0].first });
	assert.match(outs[0].first, /^1 point to spend\. Next: Vengeance 1\/3\.$/, 'one point: the talent, not the count');
	assert.ok(outs[0].notes >= 10, 'status, summary, the plan notes and the source');
	assert.deepEqual(outs[1], { labels: ['Holy', 'Protection', 'Retribution'], active: '3' });
	assert.deepEqual(outs[2], { spec: 'Holy', mine: false, status: 'other', follow: true });
	assert.deepEqual(outs[3], { choice: 'holy', followed: 'Holy' });
	assert.equal(outs[4], 'auto');
});

test('View: another class sees why there is no plan', () => {
	const [out] = runAddon({
		stubs: ['stub_world.lua', 'stub_talents.lua', 'stub_ui.lua'],
		before: 'stub.talents.class, stub.talents.className = "MAGE", "Mage"',
		addons: [{ name: 'Polestar', files: WITH_UI }],
		login: true,
		script: 'Polestar.UI.TalentsSection.Show(); emit(Polestar.UI.TalentsSection.Shown().empty)',
	}).emitted;
	assert.equal(out, 'class');
});
