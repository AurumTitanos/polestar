'use strict';
// Wowhead's Forever database (https://www.wowhead.com/forever), per entity:
// the facts the Codex's other release-safe inputs lack. Facts only (ids,
// numbers, coordinates); credited in THIRD_PARTY.md; provenance `wowhead`,
// below recordings and the client tables (docs/SUITE.md, "Data layer").
//
//   npc page     level, classification (rare, rareelite, elite, boss), spawns
//                (the page's mapper: uiMap ids, map percent on the live
//                frames), drops (each row's count out of the looted kills),
//                location (the AreaTable ids the page's g_npcs entry places it
//                in: an instance's area for an NPC inside one, mapper or not),
//                boss (Wowhead's boss flag on that entry)
//   object page  spawns, location, contents (count out of the looted opens)
//   spell page   usedBy (the NPCs that cast it: Duke Hydraxis's Create Aqual
//                Quintessence)
//   item tooltip (nether.wowhead.com/forever/tooltip/item/<id>) the
//                reputation ("Requires <Faction> - <Standing>") and PvP rank
//                ("Requires <Title> (Rank N)") the item asks for, or none
//
// List pages (/forever/npcs, /forever/objects, /forever/items) give up to
// LIST_CAP rows per request: id, name, levels, classification, boss flag,
// location (npcs, objects) and envChange (how Forever differs from Classic:
// new, updated with the change lines, or unchanged). `codex wowhead` reads
// them first, in id ranges (Wowhead's ID filter: >= lo and < hi; a range that
// shows LIST_CAP rows, the "15,205 NPCs found (1,000 displayed)" cap, is split
// until each fits), cached in <sources>/wowhead/codex/lists/<type>.json. They
// decide which pages to fetch, and give `codex build` the level of NPCs
// nothing else levels (loadWowhead's `listed`; a row is no page).
//
// The page crawl is bounded: `codex wowhead` wants only the entities the
// parity report (tools/lib/codex/parity.js) lists as missing or different,
// plus the bosses of our own instances, one request at a time, DELAY_MS
// apart, with a pause and retry on 403/429. Each entity's facts are cached in
// <sources>/wowhead/codex/<npc|object|item|spell>/<id>.json. A wanted page is
// fetched when it is not cached, an older parser wrote it (VERSION), its list
// row changed since (listSig), or it is older than --max-age and either an
// open parity gap (openGaps), Forever's own (envChange new or updated) or not
// on a list; an entity Forever left as in Classic keeps its page. `codex
// build` only reads the cache.
//
//   parseEntity(html, type, id)   page HTML -> facts | null
//   parseTooltip(json, id)        tooltip JSON -> { id, type: 'item', rep: [ { faction, standing } ], pvpRank }
//   parseList(html, type)         list page HTML -> { rows: [listRow], found, truncated }
//   wowheadWants(report, instances, objects, ours) -> { npc: [ids], object: [ids], item: [ids], spell: [ids] }
//   openGaps(report)              -> the report's unsettled rows (a report wowheadWants reads)
//   fetchLists({ sourcesDir, ... }) -> { rows: { npc: { id: row } | null, ... }, requests, planned, failed }
//   planPages({ sourcesDir, want, lists, gaps, ... }) -> { queue, cached, reasons, adopt }
//   fetchEntities({ sourcesDir, want, lists, gaps, ... }) -> { fetched, cached, missing, failed, requests, reasons }
//   loadWowhead(sourcesDir)       -> { npc: { id: facts }, object: {...}, item: {...}, spell: {...} } (list rows under the pages)
//   chanceOf(drop)                -> percent, 2 decimals

const fs = require('node:fs');
const path = require('node:path');

const BASE = 'https://www.wowhead.com/forever';
const TOOLTIP = 'https://nether.wowhead.com/forever/tooltip/item';
const DELAY_MS = 1500;
const RETRY_PAUSE_MS = 30000;
const MAX_AGE_DAYS = 7;
const TYPES = ['npc', 'object', 'item', 'spell'];
const STANDINGS = { hated: 1, hostile: 2, unfriendly: 3, neutral: 4, friendly: 5, honored: 6, revered: 7, exalted: 8 };
const CLASSES = { 'rare elite': 'rareelite', rare: 'rare', elite: 'elite', boss: 'boss', normal: 'normal' };
// The parser's version per type: a cached page an older one read is fetched again.
const VERSION = { npc: 2, object: 2, item: 1, spell: 1 };
// List pages: the row cap, each type's path and ID filter criterion, the
// first ranges (LIST_SPAN wide up to LIST_TOP, then one open range) and the
// list's numeric classification.
const LIST_CAP = 1000;
const LISTS = { npc: { path: 'npcs', filter: 37 }, object: { path: 'objects', filter: 15 }, item: { path: 'items', filter: 151 } };
const LIST_SPAN = 25000;
const LIST_TOP = 300000;
const CLASS_IDS = { 1: 'elite', 2: 'rareelite', 3: 'boss', 4: 'rare' };
// A type's list never takes more than this many requests a run (a split
// gone wrong stops here instead of crawling id by id).
const LIST_MAX_REQUESTS = 150;

// The index of the bracket closing the one at start (strings skipped).
function blockEnd(text, start) {
	const open = text[start];
	const close = open === '[' ? ']' : '}';
	let depth = 0;
	let inString = false;
	for (let i = start; i < text.length; i++) {
		const c = text[i];
		if (inString) {
			if (c === '\\') i++;
			else if (c === '"') inString = false;
		} else if (c === '"') inString = true;
		else if (c === open) depth++;
		else if (c === close && --depth === 0) return i;
	}
	return -1;
}

function jsonAt(text, start) {
	const end = blockEnd(text, start);
	return end < 0 ? null : JSON.parse(text.slice(start, end + 1));
}

// A JavaScript literal with bare keys (the item list's `firstseenpatch: 0`).
function looseJsonAt(text, start) {
	const end = blockEnd(text, start);
	if (end < 0) return null;
	let out = '';
	let last = '';
	for (let i = start; i <= end; i++) {
		const c = text[i];
		if (c === '"') {
			let j = i + 1;
			while (j <= end && text[j] !== '"') j += text[j] === '\\' ? 2 : 1;
			out += text.slice(i, j + 1);
			i = j;
			last = '"';
			continue;
		}
		if ((last === '{' || last === ',') && /[A-Za-z_$]/.test(c)) {
			const m = /^[A-Za-z_$][\w$]*(?=\s*:)/.exec(text.slice(i, i + 64));
			if (m) {
				out += `"${m[0]}"`;
				i += m[0].length - 1;
				last = '"';
				continue;
			}
		}
		out += c;
		if (!/\s/.test(c)) last = c;
	}
	return JSON.parse(out);
}

function listview(html, id) {
	const at = html.indexOf(`id: '${id}'`);
	if (at < 0) return [];
	const end = html.indexOf('new Listview(', at + 1);
	const data = html.indexOf('data:', at);
	if (data < 0 || (end > 0 && data > end)) return [];
	try {
		return jsonAt(html, html.indexOf('[', data)) || [];
	} catch {
		return [];
	}
}

const unhtml = (s) =>
	String(s)
		.replace(/<[^>]*>/g, '')
		.replace(/&#0?39;/g, "'")
		.replace(/&lt;/g, '<')
		.replace(/&gt;/g, '>')
		.replace(/&amp;/g, '&')
		.trim();

function parseEntity(html, type, id) {
	if (!html || !['npc', 'object', 'spell'].includes(type)) return null;
	const title = /<h1[^>]*class="heading-size-1"[^>]*>([^<]*)</.exec(html) || /<meta property="og:title" content="([^"]*)"/.exec(html);
	const name = title ? unhtml(title[1]).replace(/\s*<[^>]*>\s*$/, '').trim() : null;
	if (type === 'spell') {
		const usedBy = [...new Set(listview(html, 'used-by-npc').map((r) => Number(r.id)).filter((n) => n > 0))].sort((a, b) => a - b);
		return { id: Number(id), type, v: VERSION.spell, name, usedBy };
	}
	const out = { id: Number(id), type, v: VERSION[type], name, level: null, classification: null, boss: false, location: [], spawns: {}, drops: [] };
	const lv = /\[li\]Level: (\?\?|\d+)(?:\s*-\s*(\d+))?\[\\?\/li/.exec(html);
	if (lv && lv[1] !== '??') out.level = [Number(lv[1]), Number(lv[2] || lv[1])];
	const cls = /\[li\]Classification: (?:\[span[^\]]*\])?([A-Za-z ]+?)(?:\[\\?\/span\])?\[\\?\/li/.exec(html);
	if (cls) out.classification = CLASSES[cls[1].trim().toLowerCase()] || null;
	const mapper = html.indexOf('g_mapperData = ');
	if (mapper >= 0) {
		try {
			for (const floors of Object.values(jsonAt(html, html.indexOf('{', mapper)) || {})) {
				for (const f of floors || []) {
					if (!f || !f.uiMapId || !Array.isArray(f.coords)) continue;
					(out.spawns[f.uiMapId] = out.spawns[f.uiMapId] || []).push(...f.coords.filter((c) => Array.isArray(c) && c.length >= 2).map(([x, y]) => [Number(x), Number(y)]));
				}
			}
		} catch {
			// no usable mapper: no spawns
		}
	}
	// The page's own entry: `$.extend(g_npcs[<id>], { boss, location: [areaIds], ... })`.
	const ext = new RegExp(`\\$\\.extend\\(g_${type}s\\[${Number(id)}\\],\\s*`).exec(html);
	if (ext) {
		try {
			const g = jsonAt(html, ext.index + ext[0].length) || {};
			out.location = [...new Set((g.location || []).map(Number).filter((a) => a > 0))].sort((a, b) => a - b);
			out.boss = !!g.boss;
		} catch {
			// no usable entry: no location
		}
	}
	for (const r of listview(html, type === 'npc' ? 'drops' : 'contains')) {
		const mode = (r.modes && r.modes['0']) || { count: r.count, outof: r.outof };
		const count = Number(mode && mode.count);
		const outof = Number(mode && mode.outof);
		if (!r.id || !(count > 0) || !(outof > 0)) continue;
		out.drops.push({ item: Number(r.id), count, outof, common: !!r.commondrop });
	}
	out.drops.sort((a, b) => a.item - b.item);
	return out;
}

function parseTooltip(json, id) {
	const t = (json && json.tooltip) || '';
	const out = { id: Number(id), type: 'item', v: VERSION.item, name: json && json.name ? unhtml(json.name) : null, rep: [], pvpRank: null };
	for (const m of t.matchAll(/Requires ([^<]*?) - (Hated|Hostile|Unfriendly|Neutral|Friendly|Honored|Revered|Exalted)\b/g)) {
		out.rep.push({ faction: unhtml(m[1]), standing: STANDINGS[m[2].toLowerCase()] });
	}
	const pvp = /Requires [^<]*?\(Rank (\d+)\)/.exec(t);
	if (pvp) out.pvpRank = Number(pvp[1]);
	return out;
}

// A list row, compacted: what a page would give without drops or spawns, and
// envChange (status new | updated | unchanged, the change lines).
function listRow(r, type) {
	const out = { id: Number(r.id), name: r.name ? unhtml(r.name) : null };
	if (type !== 'item') out.location = [...new Set((r.location || []).map(Number).filter((a) => a > 0))].sort((a, b) => a - b);
	if (type === 'npc') {
		const lo = Number(r.minlevel) || 0;
		out.level = lo > 0 ? [lo, Math.max(lo, Number(r.maxlevel) || lo)] : null;
		out.classification = CLASS_IDS[r.classification] || null;
		out.boss = !!r.boss;
		out.react = Array.isArray(r.react) ? r.react : null;
		out.kind = r.type == null ? null : Number(r.type);
	}
	const ch = r.envChange || {};
	out.change = { status: ch.status || null, lines: Array.isArray(ch.lines) ? ch.lines.map(unhtml) : [] };
	return out;
}

// List page HTML -> { rows, found, truncated } | null (not a list page of
// that type). npcs carry `new Listview({..."template":"npc","data":[...]})`,
// objects the same object in a JSON script (data.page.listPage.listviews),
// items `listviewitems = [...]` with bare keys. A page with no match has no
// list at all, only the list's template script: no rows.
function parseList(html, type) {
	if (!html || !LISTS[type]) return null;
	let rows = null;
	const items = type === 'item' ? html.indexOf('listviewitems = [') : -1;
	if (items >= 0) rows = looseJsonAt(html, html.indexOf('[', items));
	else {
		const tpl = new RegExp(`"template":"${type}"|template: '${type}'`, 'g');
		for (let m = tpl.exec(html); m && rows === null; m = tpl.exec(html)) {
			const at = m.index + m[0].length;
			const data = /^,\s*"?data"?\s*:\s*\[/.exec(html.slice(at, at + 32));
			if (data) rows = jsonAt(html, at + data[0].length - 1);
		}
		if (rows === null && new RegExp(`Listview/Templates/${type}\\.js`).test(html)) rows = [];
	}
	if (!Array.isArray(rows)) return null;
	const note = /([\d,]+) [^"<()]*? found \(([\d,]+) displayed\)/.exec(html);
	const found = note ? Number(note[1].replace(/,/g, '')) : rows.length;
	return { rows: rows.map((r) => listRow(r, type)).filter((r) => r.id > 0), found, truncated: rows.length >= LIST_CAP || !!note };
}

// The entities worth a page: what the parity report misses or differs on,
// every boss of our instances (their loot and chances), the objects
// (objects.json) named like a missing boss (a boss chest: Dark Coffer), and
// the spells that create an item of those rows ours has no source for
// (ours.creates, the client's SpellEffect: who casts it gives the item).
function wowheadWants(report, instances = {}, objects = {}, ours = {}) {
	const want = { npc: new Set(), object: new Set(), item: new Set(), spell: new Set() };
	const kinds = (report && report.kinds) || {};
	const rows = (name) => [...((kinds[name] && kinds[name].missing) || []), ...((kinds[name] && kinds[name].different) || [])];
	const ids = (name, part = 0) => rows(name).map((r) => String(r.id).split('/')[part]);
	for (const id of ids('bosses', 1)) want.npc.add(id);
	for (const id of ids('boss loot items', 1)) want.npc.add(id);
	for (const id of ids('drop chances', 1)) want.npc.add(id);
	for (const k of ['rares', 'rare loot', 'rare positions']) for (const id of ids(k, 0)) want.npc.add(id);
	for (const k of ['treasures', 'treasure loot']) for (const id of ids(k, 0)) want.object.add(id);
	for (const k of ['items: rep', 'items: pvp']) for (const id of ids(k, 0)) want.item.add(id);
	for (const inst of Object.values(instances)) {
		for (const b of inst.bosses || []) {
			if (b.npc) want.npc.add(String(b.npc));
			if (b.object) want.object.add(String(b.object));
		}
	}
	const oursItems = ours.items || {};
	for (const k of ['items with a source', 'items: rep']) {
		for (const id of ids(k, 0)) {
			const it = oursItems[id];
			if (it && (it.sources || []).length) continue;
			for (const spell of (ours.creates || {})[id] || []) want.spell.add(spell);
		}
	}
	// Boss rows read "<boss> (<instance>)".
	const lower = (s) => String(s || '').toLowerCase();
	const bossNames = new Set(rows('bosses').map((r) => lower(String(r.name).replace(/\s*\([^()]*\)$/, ''))));
	for (const [id, o] of Object.entries(objects)) if (bossNames.has(lower(o.name))) want.object.add(id);
	const clean = (s) => [...s].map(Number).filter((n) => Number.isInteger(n) && n > 0).sort((a, b) => a - b);
	return { npc: clean(want.npc), object: clean(want.object), item: clean(want.item), spell: clean(want.spell) };
}

// The parity report's open gaps, as a report wowheadWants reads: rows
// neither settled (a reason: cut by a cap, Wowhead ranks it ordinary, a
// tooltip without the rank) nor "not in Forever". A settled row's page has
// answered already; it is fetched again only as any other page.
function openGaps(report) {
	const kinds = {};
	for (const [name, c] of Object.entries((report && report.kinds) || {})) {
		const open = (rows) => (rows || []).filter((r) => !r.reason && r.verdict !== 'not in Forever');
		kinds[name] = { missing: open(c.missing), different: open(c.different) };
	}
	return { kinds };
}

function cacheFile(sourcesDir, type, id) {
	return path.join(sourcesDir, 'wowhead', 'codex', type, `${id}.json`);
}

function listFile(sourcesDir, type) {
	return path.join(sourcesDir, 'wowhead', 'codex', 'lists', `${type}.json`);
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const readJson = (file) => (fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, 'utf8')) : null);

function writeJson(file, value) {
	fs.mkdirSync(path.dirname(file), { recursive: true });
	fs.writeFileSync(`${file}.tmp`, `${JSON.stringify(value)}\n`);
	fs.renameSync(`${file}.tmp`, file);
}

// One client per run, shared by lists and pages: requests delayMs apart, a
// pause (retryPauseMs, longer each time) and retry on 403/429, three tries.
// get(url, 'text' | 'json') -> { status, body } | { status, error }.
function politeClient({ fetchImpl = globalThis.fetch, delayMs = DELAY_MS, retryPauseMs = RETRY_PAUSE_MS, log = () => {} } = {}) {
	let last = 0;
	const client = { requests: 0, delayMs };
	client.get = async (url, as = 'text') => {
		let error = null;
		for (let attempt = 0; attempt < 3; attempt++) {
			const wait = last + delayMs - Date.now();
			if (client.requests && wait > 0) await sleep(wait);
			last = Date.now();
			client.requests++;
			try {
				const r = await fetchImpl(url, { headers: { 'user-agent': 'Mozilla/5.0 (polestar-codex-build)' }, redirect: 'follow' });
				if (r.status === 403 || r.status === 429) {
					error = `HTTP ${r.status}`;
					log(`wowhead: ${url}: ${error}; pausing ${(retryPauseMs * (attempt + 1)) / 1000} s`);
					await sleep(retryPauseMs * (attempt + 1));
					continue;
				}
				if (r.status === 404) return { status: 404 };
				if (!r.ok) return { status: r.status, error: `HTTP ${r.status}` };
				return { status: r.status, body: as === 'json' ? await r.json() : await r.text() };
			} catch (err) {
				error = err.message;
			}
		}
		return { status: 0, error };
	};
	return client;
}

function listUrl(type, { lo, hi }) {
	const f = LISTS[type].filter;
	return `${BASE}/${LISTS[type].path}?filter=${hi == null ? `${f};2;${lo}` : `${f}:${f};2:5;${lo}:${hi}`}`;
}

function firstRanges() {
	const out = [];
	for (let lo = 0; lo < LIST_TOP; lo += LIST_SPAN) out.push({ lo, hi: lo + LIST_SPAN });
	out.push({ lo: LIST_TOP, hi: null });
	return out;
}

// A range past the cap -> narrower ranges, about 3/4 of the cap each by the
// count the note gives (evenly spread ids); an open range halves its start.
function splitRange({ lo, hi }, found) {
	if (hi == null) return [{ lo, hi: lo * 2 }, { lo: lo * 2, hi: null }];
	const n = Math.min(hi - lo, Math.max(2, Math.ceil((found || 0) / (LIST_CAP * 0.75))));
	const step = Math.ceil((hi - lo) / n);
	const out = [];
	for (let a = lo; a < hi; a += step) out.push({ lo: a, hi: Math.min(hi, a + step) });
	return out;
}

// The list pages of types, by id range, each range cached with its rows and
// fetchedAt; a range older than maxAgeDays is fetched again (and split when
// it outgrew the cap). dryRun fetches nothing: `planned` counts the ranges
// it would (at least: a split costs more). rows[type] is null unless every
// range of that type is cached: a partial list can't tell "not listed".
async function fetchLists({ sourcesDir, types = Object.keys(LISTS), client, maxAgeDays = MAX_AGE_DAYS, now = Date.now(), dryRun = false, log = () => {}, ...opts }) {
	client = client || politeClient({ log, ...opts });
	const before = client.requests;
	const res = { rows: {}, requests: 0, planned: 0, failed: [] };
	for (const type of types) {
		const file = listFile(sourcesDir, type);
		const old = readJson(file);
		const chunks = [];
		const queue = [];
		for (const c of (old && old.chunks) || firstRanges()) {
			if (c.rows && now - Date.parse(c.fetchedAt) < maxAgeDays * 86400000) chunks.push(c);
			else queue.push({ lo: c.lo, hi: c.hi, old: c.rows ? c : null });
		}
		let complete = true;
		if (dryRun) {
			res.planned += queue.length;
			for (const q of queue) {
				if (q.old) chunks.push(q.old);
				else complete = false;
			}
		} else {
			if (queue.length) log(`wowhead: ${type} list, ${queue.length} ranges to fetch (${chunks.length} cached)`);
			let spent = 0;
			while (queue.length) {
				const q = queue.shift();
				const url = listUrl(type, q);
				if (++spent > LIST_MAX_REQUESTS) {
					res.failed.push({ type, url, error: `over ${LIST_MAX_REQUESTS} list requests: ${queue.length + 1} ranges left` });
					complete = false;
					for (const left of [q, ...queue]) if (left.old) chunks.push(left.old);
					break;
				}
				const got = await client.get(url);
				let parsed = null;
				try {
					parsed = got.body ? parseList(got.body, type) : null;
				} catch (err) {
					got.error = err.message;
				}
				// Wowhead ignores an ID filter starting past its last id: the
				// whole list comes back. All below the range: nothing in it.
				const outside = parsed ? parsed.rows.filter((r) => r.id < q.lo || (q.hi != null && r.id >= q.hi)).length : 0;
				if (parsed && outside) {
					if (outside === parsed.rows.length && parsed.rows.every((r) => r.id < q.lo)) parsed = { rows: [], found: 0, truncated: false };
					else {
						got.error = `the ID filter was ignored (${outside} rows outside ${q.lo}-${q.hi == null ? '' : q.hi})`;
						parsed = null;
					}
				}
				if (!parsed) {
					res.failed.push({ type, url, error: got.error || 'not a list page' });
					if (q.old) chunks.push(q.old);
					else complete = false;
					continue;
				}
				if (parsed.truncated && (q.hi == null || q.hi - q.lo > 1)) {
					queue.unshift(...splitRange(q, parsed.found).map((r) => ({ ...r, old: null })));
					continue;
				}
				chunks.push({ lo: q.lo, hi: q.hi, fetchedAt: new Date(now).toISOString(), url, rows: parsed.rows });
			}
			chunks.sort((a, b) => a.lo - b.lo);
			if (chunks.length) writeJson(file, { type, chunks });
		}
		const rows = {};
		for (const c of chunks) for (const r of c.rows) rows[r.id] = r;
		res.rows[type] = complete ? rows : null;
	}
	res.requests = client.requests - before;
	return res;
}

// Which wanted pages to fetch, and why: missing (not cached), version (an
// older parser), changed (its list row differs from the one it was fetched
// with, or a page Wowhead had not is listed now), stale (older than
// maxAgeDays and a parity gap, Forever's own (envChange new or updated) or
// not on a complete list). A kept page without a listSig adopts its row's
// (adopt), so the next change shows.
function planPages({ sourcesDir, want, lists = {}, gaps = {}, maxAgeDays = MAX_AGE_DAYS, now = Date.now() }) {
	const out = { queue: [], cached: 0, reasons: { missing: 0, version: 0, changed: 0, stale: 0 }, adopt: [] };
	for (const type of TYPES) {
		const rows = (lists && lists[type]) || null;
		const gap = new Set(((gaps && gaps[type]) || []).map(Number));
		for (const id of want[type] || []) {
			const file = cacheFile(sourcesDir, type, id);
			const old = readJson(file);
			const row = rows ? rows[id] : null;
			const sig = row ? JSON.stringify(row) : null;
			let reason = null;
			if (!old) reason = 'missing';
			else if (!old.notFound && (old.v || 1) < VERSION[type]) reason = 'version';
			else if (sig && (old.notFound || (old.listSig && old.listSig !== sig))) reason = 'changed';
			else if (now - Date.parse(old.fetchedAt) >= maxAgeDays * 86400000) {
				if (!rows || (!row && !old.notFound) || (row && (gap.has(Number(id)) || row.change.status !== 'unchanged'))) reason = 'stale';
			}
			if (reason) {
				out.reasons[reason]++;
				out.queue.push({ type, id, file, sig, reason });
			} else {
				out.cached++;
				if (sig && !old.listSig) out.adopt.push({ file, sig });
			}
		}
	}
	return out;
}

async function fetchEntities({ sourcesDir, want, lists = {}, gaps = {}, client, log = () => {}, maxAgeDays = MAX_AGE_DAYS, now = Date.now(), dryRun = false, limit = Infinity, ...opts }) {
	client = client || politeClient({ log, ...opts });
	const before = client.requests;
	const plan = planPages({ sourcesDir, want, lists, gaps, maxAgeDays, now });
	const res = { fetched: 0, cached: plan.cached, missing: 0, failed: [], requests: 0, queued: plan.queue.length, reasons: plan.reasons };
	const why = Object.entries(plan.reasons).filter(([, n]) => n).map(([k, n]) => `${n} ${k}`).join(', ');
	log(`wowhead: ${plan.queue.length} pages to fetch${why ? ` (${why})` : ''}, ${plan.cached} cached, ${client.delayMs} ms apart${plan.queue.length > limit ? `; ${limit} this run` : ''}`);
	if (dryRun) return res;
	plan.queue = plan.queue.slice(0, Math.max(0, limit));
	for (const { file, sig } of plan.adopt) writeJson(file, { ...readJson(file), listSig: sig });
	for (const [n, { type, id, file, sig }] of plan.queue.entries()) {
		const url = type === 'item' ? `${TOOLTIP}/${id}` : `${BASE}/${type}=${id}`;
		const got = await client.get(url, type === 'item' ? 'json' : 'text');
		let facts = null;
		if (got.status === 404) facts = { id, type, notFound: true };
		else if (got.body != null) facts = type === 'item' ? parseTooltip(got.body, id) : parseEntity(got.body, type, id);
		if (facts) {
			facts.fetchedAt = new Date(now).toISOString();
			facts.url = url;
			if (sig) facts.listSig = sig;
			writeJson(file, facts);
			if (facts.notFound) res.missing++;
			else res.fetched++;
		} else res.failed.push({ type, id, error: got.error || 'unparsed' });
		if ((n + 1) % 100 === 0) log(`wowhead: ${n + 1}/${plan.queue.length}`);
	}
	res.requests = client.requests - before;
	return res;
}

// The cached pages; `listed` holds the list rows by type (the pages' own
// facts stay what the pages said: a row is no page, and parity's verdicts
// read only pages).
function loadWowhead(sourcesDir) {
	const out = { npc: {}, object: {}, item: {}, spell: {}, listed: {} };
	for (const type of TYPES) {
		const dir = path.join(sourcesDir, 'wowhead', 'codex', type);
		if (!fs.existsSync(dir)) continue;
		for (const f of fs.readdirSync(dir).sort()) {
			if (!f.endsWith('.json')) continue;
			const facts = JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8'));
			if (!facts.notFound) out[type][facts.id] = facts;
		}
	}
	for (const type of Object.keys(LISTS)) {
		const list = readJson(listFile(sourcesDir, type));
		if (!list) continue;
		const rows = (out.listed[type] = {});
		for (const c of list.chunks || []) for (const r of c.rows || []) rows[r.id] = r;
	}
	return out;
}

function chanceOf(d) {
	return Math.round((d.count / d.outof) * 10000) / 100;
}

module.exports = { parseEntity, parseTooltip, parseList, wowheadWants, openGaps, fetchLists, planPages, fetchEntities, loadWowhead, chanceOf, politeClient, listUrl, splitRange, BASE, TOOLTIP, DELAY_MS, MAX_AGE_DAYS, VERSION, LIST_CAP };
