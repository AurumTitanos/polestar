'use strict';
// Quests/Party.lua: quest progress shared with the party through hidden addon
// messages, against the fake client (tests/lua/stub_world.lua for the quest
// log, tests/lua/stub_party.lua for the group and the addon channel). Quest
// IDs and counts only, so players on other guides or other languages agree.

const { test } = require('node:test');
const assert = require('node:assert/strict');
const { runAddon } = require('./helpers/lua');

const FILES = ['Core/Core.xml', 'Quests/Party.lua'];

function run(script, { stubs = ['stub_world.lua'], files = FILES, login = false, before = '' } = {}) {
	return runAddon({
		stubs,
		before,
		addons: [{ name: 'Polestar', files }],
		login,
		script: `local P, w = Polestar.Party, stub.world\n${script}`,
	}).emitted;
}

test('party: a message round-trips quests, counts, a dropped quest and the snapshot mark', () => {
	const [msgs, snap, entries] = run(`
local msgs = P.Encode({ { q = 33, counts = { { 5, 8 }, { 0, 1 } } }, { q = 60, counts = false } }, true)
local snap, entries = P.Decode(msgs[1])
emit(msgs); emit(snap); emit(entries)`);
	assert.deepEqual(msgs, ['1S|33:5/8,0/1;60:-']);
	assert.equal(snap, true);
	assert.deepEqual(entries, [{ q: 33, counts: [[5, 8], [0, 1]] }, { q: 60, counts: false }]);
});

test('party: a full log splits into messages under 255 bytes, each one parsing alone', () => {
	const [out] = run(`
local entries = {}
for q = 1001, 1025 do
	local counts = {}
	for i = 1, 10 do counts[i] = { 999, 999 } end
	entries[#entries + 1] = { q = q, counts = counts }
end
local msgs = P.Encode(entries, true)
local res = { lengths = {}, snaps = {}, quests = {} }
for i, m in ipairs(msgs) do
	res.lengths[i] = #m
	local snap, got = P.Decode(m)
	res.snaps[i] = snap
	for _, e in ipairs(got) do res.quests[#res.quests + 1] = e.q end
end
emit(res)`);
	assert.ok(out.lengths.length > 1);
	for (const n of out.lengths) assert.ok(n <= 255, `message of ${n} bytes`);
	assert.deepEqual(out.snaps, out.lengths.map((_, i) => i === 0));
	assert.deepEqual(out.quests, Array.from({ length: 25 }, (_, i) => 1001 + i));
});

test('party: malformed text, another version and out-of-range counts are refused', () => {
	const eleven = Array.from({ length: 11 }, () => '1/2').join(',');
	const many = Array.from({ length: 26 }, (_, i) => `${i + 1}:1/2`).join(';');
	const bad = ['x', '', '2|33:1/2', '1|33:1000/2', '1|abc:1/2', '1|33:1/', '1|33', `1|33:${eleven}`, `1|${many}`];
	const out = run(bad.map((t) => `emit(P.Decode(${JSON.stringify(t)}) == nil)`).join('\n'));
	assert.deepEqual(out, bad.map(() => true));
});

test('party: a quest with no objectives is sent and read as an empty list', () => {
	const [msgs, n, q] = run(`
local msgs = P.Encode({ { q = 33, counts = {} } })
local _, entries = P.Decode(msgs[1])
emit(msgs); emit(#entries[1].counts); emit(entries[1].q)`);
	assert.deepEqual(msgs, ['1|33:']);
	assert.equal(n, 0);
	assert.equal(q, 33);
});

test('party: the log is read as quest id to counts', () => {
	const [log] = run(`
w.onQuest(33, { 8, 1 })
w.onQuest(60, {})
w.progress(33, 1, 5)
local out = {}
for q, s in pairs(P.ReadLog()) do out[tostring(q)] = s end
emit(out)`);
	assert.deepEqual(log, { 33: '5/8,0/1', 60: '' });
});

// Sending and receiving run with the party stub, logged in.
const LIVE = { stubs: ['stub_world.lua', 'stub_party.lua'], login: true };
const SENT = `
local p = stub.party
local function texts()
	local out = {}
	for i, m in ipairs(p.sent) do out[i] = m.text end
	return out
end`;

test('party: progress goes to the party 2 seconds after the log changes, once per burst', () => {
	const [before, after, chat] = run(`${SENT}
w.onQuest(33, { 8 })
p.join("Ana")
stub.advance(6)
emit(texts())
w.progress(33, 1, 1); stub.advance(0.3)
w.progress(33, 1, 2); stub.advance(0.3)
w.progress(33, 1, 3)
stub.advance(2)
emit(texts())
emit(p.sent[#p.sent].chatType .. " " .. p.sent[#p.sent].prefix)`, LIVE);
	assert.deepEqual(before, ['1S|33:0/8']);
	assert.deepEqual(after, ['1S|33:0/8', '1|33:3/8']);
	assert.equal(chat, 'PARTY Polestar');
});

test('party: unchanged quests are not sent again', () => {
	const [n] = run(`${SENT}
w.onQuest(33, { 8 })
p.join("Ana")
stub.advance(6)
stub.fire("QUEST_LOG_UPDATE")
stub.advance(3)
emit(#p.sent)`, LIVE);
	assert.equal(n, 1);
});

test('party: a quest that leaves the log is sent as dropped', () => {
	const [last] = run(`${SENT}
w.onQuest(33, { 8 })
w.onQuest(60, { 2 })
p.join("Ana")
stub.advance(6)
w.abandon(33)
stub.advance(2)
emit(p.sent[#p.sent].text)`, LIVE);
	assert.equal(last, '1|33:-');
});

test('party: a member joining gets a snapshot within 6 seconds', () => {
	const [early, late] = run(`${SENT}
w.onQuest(33, { 8 })
w.onQuest(60, {})
p.join("Ana")
stub.advance(2.9)
emit(#p.sent)
stub.advance(3.2)
emit(texts())`, LIVE);
	assert.equal(early, 0);
	assert.deepEqual(late, ['1S|33:0/8;60:']);
});

test('party: solo, in a raid, or with sharing off, nothing is sent', () => {
	const [solo, raid, off] = run(`${SENT}
w.onQuest(33, { 8 })
w.progress(33, 1, 2)
stub.advance(10)
emit(#p.sent)
p.join("Ana"); p.raid(true)
w.progress(33, 1, 3)
stub.advance(10)
emit(#p.sent)
p.disband()
Polestar.Set("party.share", false)
p.join("Ben")
w.progress(33, 1, 4)
stub.advance(10)
emit(#p.sent)`, LIVE);
	assert.deepEqual([solo, raid, off], [0, 0, 0]);
});

test('party: a refused send keeps the change for the next one, without retrying on its own', () => {
	const [attempts, last] = run(`${SENT}
w.onQuest(33, { 8 })
w.onQuest(60, { 4 })
p.join("Ana")
stub.advance(6)
p.result = Enum.SendAddonMessageResult.AddonMessageThrottle
w.progress(33, 1, 5)
stub.advance(10)
emit(#p.sent)
p.result = 0
w.progress(60, 1, 1)
stub.advance(2)
emit(p.sent[#p.sent].text)`, LIVE);
	assert.equal(attempts, 2);
	assert.equal(last, '1|33:5/8;60:1/4');
});

test('party: both settings off registers no events', () => {
	const [on, off] = run(`${SENT}
local EVENTS = { "GROUP_ROSTER_UPDATE", "GROUP_LEFT", "QUEST_LOG_UPDATE", "CHAT_MSG_ADDON" }
local function registered()
	local out = {}
	for _, ev in ipairs(EVENTS) do
		for _, f in ipairs(stub.frames) do
			if f.events and f.events[ev] then out[#out + 1] = ev break end
		end
	end
	return out
end
emit(registered())
Polestar.Set("party.share", false)
Polestar.Set("party.show", false)
emit(registered())`, LIVE);
	assert.ok(on.includes('CHAT_MSG_ADDON') && on.includes('GROUP_ROSTER_UPDATE'));
	assert.deepEqual(off.filter((e) => e !== 'QUEST_LOG_UPDATE'), []);
});
