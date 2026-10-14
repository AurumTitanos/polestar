'use strict';
// Wowhead Forever list pages and the page crawl they steer
// (tools/lib/codex/wowhead.js): parseList for the three list formats, the
// id-range chunks split past the 1,000-row cap and cached, which pages a run
// fetches again (planPages), and the list rows under the pages in loadWowhead.

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { parseList, fetchLists, planPages, fetchEntities, loadWowhead, politeClient, openGaps, wowheadWants, LIST_CAP, VERSION } = require('../tools/lib/codex/wowhead');
const { tmpdir } = require('./helpers/tmp');

const T0 = Date.parse('2026-10-01T00:00:00Z');
const DAY = 86400000;

const npcRow = (id, extra = {}) => ({ boss: 0, classification: 0, id, location: [40, -3], maxlevel: 12, minlevel: 10, name: `Npc ${id}`, react: [1, -1], type: 7, envChange: { status: 'unchanged', labels: [], lines: [] }, popularity: 1, ...extra });

function npcPage(rows, found = rows.length) {
	const note = found > rows.length ? `"_truncated":1,"note":"${found.toLocaleString('en-US')} NPCs found (${rows.length.toLocaleString('en-US')} displayed) - Try filtering your results",` : '';
	return `<script src="https://wow.zamimg.com/js/WH/Listview/Templates/npc.js"></script><script>new Listview({${note}"sort":["popularity"],"id":"npcs","template":"npc","data":${JSON.stringify(rows)},"extraCols":[Listview.extraCols.popularity]});</script>`;
}

test('parseList reads the npc, object and item list formats, the cap and an empty list', () => {
	const npc = parseList(npcPage([npcRow(5, { classification: 4, envChange: { status: 'updated', labels: ['level_changed'], lines: ['Level 10 - 12 instead of 8'] } }), npcRow(6, { minlevel: 0, maxlevel: 0, classification: 3, boss: 1 })]), 'npc');
	assert.deepEqual(npc.rows, [
		{ id: 5, name: 'Npc 5', location: [40], level: [10, 12], classification: 'rare', boss: false, react: [1, -1], kind: 7, change: { status: 'updated', lines: ['Level 10 - 12 instead of 8'] } },
		{ id: 6, name: 'Npc 6', location: [40], level: null, classification: 'boss', boss: true, react: [1, -1], kind: 7, change: { status: 'unchanged', lines: [] } },
	]);
	assert.equal(npc.truncated, false);
	const capped = parseList(npcPage([npcRow(1)], 15205), 'npc');
	assert.deepEqual([capped.found, capped.truncated], [15205, true], 'the "N found (M displayed)" note marks a capped range');

	const objects = `<script type="application/json" id="data.page.listPage.listviews">[{"id":"objects","template":"object","data":[{"displayName":"Iron Deposit","id":1735,"location":[45,405,33,-1],"name":"Iron Deposit","type":-4,"envChange":{"status":"new","labels":[],"lines":[]}}]}]</script>`;
	assert.deepEqual(parseList(objects, 'object').rows, [{ id: 1735, name: 'Iron Deposit', location: [33, 45, 405], change: { status: 'new', lines: [] } }]);

	const items = `<script>var listviewitems = [{"classs":9,"id":1002,"name":"Tome","envChange":{"status":"unchanged","labels":[],"lines":[]},firstseenpatch: 0,"reqlevel":26,popularity:18},{"id":1004,"name":"Say \\"hi\\": {x}",popularity:1}];
new Listview({template: 'item', id: 'items', data: listviewitems});</script>`;
	assert.deepEqual(parseList(items, 'item').rows, [
		{ id: 1002, name: 'Tome', change: { status: 'unchanged', lines: [] } },
		{ id: 1004, name: 'Say "hi": {x}', change: { status: null, lines: [] } },
	]);

	assert.deepEqual(parseList('<script src="/js/WH/Listview/Templates/npc.js"></script><p>filters</p>', 'npc').rows, [], 'no match: the template script, no list');
	assert.equal(parseList('<html>Access denied</html>', 'npc'), null, 'not a list page');
});

// A fake Wowhead holding npc ids `ids`: answers a list URL with the rows in
// its id range (capped; a range starting past the last id gets the whole
// list, as Wowhead ignores such a filter), a page URL with a page; records
// every URL.
function fakeWowhead(ids, calls, { status = () => 200 } = {}) {
	return async (url) => {
		calls.push(url);
		const s = status(url);
		if (s !== 200) return { ok: false, status: s, text: async () => '' };
		const m = /npcs\?filter=37(?::37)?;2(?::5)?;(\d+)(?::(\d+))?$/.exec(url);
		if (m) {
			const lo = Number(m[1]);
			const hi = m[2] == null ? Infinity : Number(m[2]);
			const inRange = lo > Math.max(...ids) ? ids : ids.filter((id) => id >= lo && id < hi);
			return { ok: true, status: 200, text: async () => npcPage(inRange.slice(0, LIST_CAP).map((id) => npcRow(id)), inRange.length) };
		}
		if (/\/(objects|items)\?/.test(url)) return { ok: true, status: 200, text: async () => `<script src="/js/WH/Listview/Templates/${/objects/.test(url) ? 'object' : 'item'}.js"></script>` };
		const page = /npc=(\d+)$/.exec(url);
		if (page) return { ok: true, status: 200, text: async () => `<h1 class="heading-size-1">Npc ${page[1]}</h1>` };
		return { ok: false, status: 404, text: async () => '' };
	};
}

test('fetchLists splits a range past the cap, caches the ranges and refetches them after max-age', async () => {
	const sourcesDir = tmpdir('polestar-wh-lists-');
	// 1,500 NPCs in the first range (past the cap) and one above LIST_TOP.
	const ids = [...Array.from({ length: 1500 }, (_, i) => i + 1), 400000];
	const calls = [];
	const client = politeClient({ fetchImpl: fakeWowhead(ids, calls), delayMs: 0 });
	const res = await fetchLists({ sourcesDir, client, now: T0 });
	assert.equal(res.failed.length, 0);
	assert.equal(Object.keys(res.rows.npc).length, 1501, 'every NPC, the capped range split');
	assert.deepEqual(res.rows.object, {});
	const first = calls.filter((u) => /npcs/.test(u));
	assert.equal(first[0], 'https://www.wowhead.com/forever/npcs?filter=37:37;2:5;0:25000');
	assert.match(first[1], /;2:5;0:12500$/, 'the capped range split by the count its note gives');
	assert.ok(first.includes('https://www.wowhead.com/forever/npcs?filter=37;2;300000'), 'one open range above LIST_TOP');
	assert.equal(res.requests, calls.length);
	const cached = JSON.parse(fs.readFileSync(path.join(sourcesDir, 'wowhead', 'codex', 'lists', 'npc.json'), 'utf8'));
	assert.ok(cached.chunks.every((c) => c.rows.length < LIST_CAP));

	const again = await fetchLists({ sourcesDir, client, now: T0 + DAY });
	assert.equal(again.requests, 0, 'within max-age: the cache only');
	assert.equal(Object.keys(again.rows.npc).length, 1501);
	const dry = await fetchLists({ sourcesDir, client, now: T0 + 8 * DAY, dryRun: true });
	const others = ['object', 'item'].map((t) => JSON.parse(fs.readFileSync(path.join(sourcesDir, 'wowhead', 'codex', 'lists', `${t}.json`), 'utf8')).chunks.length);
	assert.deepEqual([dry.requests, dry.planned], [0, cached.chunks.length + others[0] + others[1]], 'a dry run counts the stale ranges');
	const later = await fetchLists({ sourcesDir, client, now: T0 + 8 * DAY, types: ['npc'] });
	assert.equal(later.requests, cached.chunks.length, 'stale: each cached range once, no re-split');
});

test('a failed list range keeps the cached one; a type never fully listed is incomplete', async () => {
	const sourcesDir = tmpdir('polestar-wh-lists-');
	const ok = politeClient({ fetchImpl: fakeWowhead([5], []), delayMs: 0 });
	const first = await fetchLists({ sourcesDir, client: ok, now: T0, types: ['npc'] });
	assert.deepEqual([first.failed, Object.keys(first.rows.npc)], [[], ['5']], 'a range past the last id (filter ignored, the whole list back) holds nothing');
	const down = politeClient({ fetchImpl: fakeWowhead([5], [], { status: () => 503 }), delayMs: 0, retryPauseMs: 0 });
	const res = await fetchLists({ sourcesDir, client: down, now: T0 + 8 * DAY, types: ['npc', 'object'] });
	assert.equal(res.rows.npc[5].name, 'Npc 5', 'the cached range kept');
	assert.equal(res.rows.object, null, 'no objects cached: not a complete list');
	assert.match(res.failed[0].error, /HTTP 503/);
});

test('a 403 or 429 pauses and retries; requests stay delayMs apart', async () => {
	const calls = [];
	let n = 0;
	const times = [];
	const fetchImpl = async (url) => {
		calls.push(url);
		times.push(Date.now());
		return ++n === 1 ? { ok: false, status: 429 } : { ok: true, status: 200, text: async () => 'ok' };
	};
	const logs = [];
	const client = politeClient({ fetchImpl, delayMs: 30, retryPauseMs: 5, log: (m) => logs.push(m) });
	assert.deepEqual(await client.get('u1'), { status: 200, body: 'ok' });
	await client.get('u2');
	assert.deepEqual(calls, ['u1', 'u1', 'u2']);
	assert.match(logs[0], /HTTP 429; pausing/);
	for (let i = 1; i < times.length; i++) assert.ok(times[i] - times[i - 1] >= 25, `request ${i} waited`);
	assert.equal(client.requests, 3);
});

function writePage(sourcesDir, type, id, facts) {
	const file = path.join(sourcesDir, 'wowhead', 'codex', type, `${id}.json`);
	fs.mkdirSync(path.dirname(file), { recursive: true });
	fs.writeFileSync(file, JSON.stringify({ id, type, v: VERSION[type], ...facts }));
}

test('planPages refetches what is missing, older, changed, or stale and Forever-specific or a gap', () => {
	const sourcesDir = tmpdir('polestar-wh-plan-');
	const old = new Date(T0 - 10 * DAY).toISOString();
	const fresh = new Date(T0 - DAY).toISOString();
	const row = (id, status = 'unchanged', extra = {}) => ({ id, name: `Npc ${id}`, location: [], level: [10, 10], classification: null, boss: false, react: null, kind: 7, change: { status, lines: [] }, ...extra });
	const rows = { 2: row(2), 3: row(3), 4: row(4, 'updated'), 5: row(5), 6: row(6), 7: row(7, 'unchanged', { level: [11, 11] }), 9: row(9) };
	writePage(sourcesDir, 'npc', 2, { fetchedAt: old, v: 1 }); // older parser
	writePage(sourcesDir, 'npc', 3, { fetchedAt: old }); // unchanged, stale, not a gap: kept (adopts its row)
	writePage(sourcesDir, 'npc', 4, { fetchedAt: old }); // updated in Forever, stale
	writePage(sourcesDir, 'npc', 5, { fetchedAt: old }); // a parity gap, stale
	writePage(sourcesDir, 'npc', 6, { fetchedAt: fresh, listSig: JSON.stringify(rows[6]) }); // fresh, same row
	writePage(sourcesDir, 'npc', 7, { fetchedAt: fresh, listSig: JSON.stringify(row(7)) }); // its row changed since
	writePage(sourcesDir, 'npc', 8, { fetchedAt: old }); // not on the list: can't tell, stale
	fs.writeFileSync(path.join(sourcesDir, 'wowhead', 'codex', 'npc', '9.json'), JSON.stringify({ id: 9, type: 'npc', notFound: true, fetchedAt: fresh })); // listed now
	fs.writeFileSync(path.join(sourcesDir, 'wowhead', 'codex', 'npc', '10.json'), JSON.stringify({ id: 10, type: 'npc', notFound: true, fetchedAt: old })); // still not listed
	writePage(sourcesDir, 'spell', 20, { fetchedAt: old }); // no list for spells: stale
	const plan = planPages({ sourcesDir, want: { npc: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10], spell: [20] }, lists: { npc: rows }, gaps: { npc: [5] }, now: T0 });
	const why = Object.fromEntries(plan.queue.map((q) => [`${q.type}=${q.id}`, q.reason]));
	assert.deepEqual(why, { 'npc=1': 'missing', 'npc=2': 'version', 'npc=4': 'stale', 'npc=5': 'stale', 'npc=7': 'changed', 'npc=8': 'stale', 'npc=9': 'changed', 'spell=20': 'stale' });
	assert.equal(plan.cached, 3);
	assert.deepEqual(plan.adopt.map((a) => path.basename(a.file)), ['3.json']);

	// Without lists: the old rule, every stale page.
	const bare = planPages({ sourcesDir, want: { npc: [3, 6] }, now: T0 });
	assert.deepEqual(bare.queue.map((q) => [q.id, q.reason]), [[3, 'stale']]);
});

test('fetchEntities fetches the plan, stores the list row, honours --limit and dry runs', async () => {
	const sourcesDir = tmpdir('polestar-wh-fetch-');
	const calls = [];
	const client = politeClient({ fetchImpl: fakeWowhead([], calls), delayMs: 0 });
	const rows = { 1: { id: 1, name: 'Npc 1', change: { status: 'new', lines: [] } } };
	const dry = await fetchEntities({ sourcesDir, want: { npc: [1, 2, 3] }, lists: { npc: rows }, client, now: T0, dryRun: true });
	assert.deepEqual([dry.queued, dry.requests, calls.length], [3, 0, 0]);
	const res = await fetchEntities({ sourcesDir, want: { npc: [1, 2, 3] }, lists: { npc: rows }, client, now: T0, limit: 2 });
	assert.deepEqual([res.fetched, res.requests], [2, 2]);
	const page = JSON.parse(fs.readFileSync(path.join(sourcesDir, 'wowhead', 'codex', 'npc', '1.json'), 'utf8'));
	assert.equal(page.listSig, JSON.stringify(rows[1]));
	assert.equal(page.fetchedAt, new Date(T0).toISOString());
});

test('loadWowhead keeps the list rows apart from the pages (listed)', () => {
	const sourcesDir = tmpdir('polestar-wh-load-');
	writePage(sourcesDir, 'npc', 5, { name: 'Paged', level: [3, 3], classification: 'rare', boss: false, location: [1], spawns: { 1: [[1, 2]] }, drops: [] });
	const file = path.join(sourcesDir, 'wowhead', 'codex', 'lists', 'npc.json');
	fs.mkdirSync(path.dirname(file), { recursive: true });
	const listed = (id) => ({ id, name: `Listed ${id}`, location: [2], level: [9, 10], classification: 'elite', boss: true, react: null, kind: 7, change: { status: 'new', lines: [] } });
	fs.writeFileSync(file, JSON.stringify({ type: 'npc', chunks: [{ lo: 0, hi: 25000, fetchedAt: new Date(T0).toISOString(), rows: [listed(5), listed(6)] }] }));
	const wh = loadWowhead(sourcesDir);
	assert.equal(wh.npc[5].name, 'Paged', 'a page stays the page');
	assert.equal(wh.npc[6], undefined, 'a row is no page: parity reads pages only');
	assert.deepEqual(Object.keys(wh.listed.npc), ['5', '6']);
	assert.deepEqual(wh.listed.npc[6].level, [9, 10]);
});

test('openGaps keeps the parity rows still open: neither not in Forever nor settled with a reason', () => {
	const report = { kinds: {
		rares: { missing: [{ id: 1, verdict: 'unverified' }, { id: 2, verdict: 'not in Forever' }, { id: 3, verdict: 'confirmed' }], different: [] },
		// "<item>/<npc>"
		'drop chances': { missing: [{ id: '5/10', verdict: 'confirmed', reason: 'cut by a cap' }], different: [{ id: '5/11', reason: 'QuestieDB Forever drop rate' }, { id: '5/12' }] },
	} };
	assert.deepEqual(wowheadWants(openGaps(report)).npc, [1, 3, 12]);
});
