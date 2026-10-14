'use strict';
// Wowhead's Forever database (https://www.wowhead.com/forever), per entity:
// the facts the Codex's other release-safe inputs lack. Facts only (ids,
// numbers, coordinates); credited in THIRD_PARTY.md; provenance `wowhead`,
// below recordings and the client tables (docs/SUITE.md, "Data layer").
//
//   npc page     level, classification (rare, rareelite, elite, boss), spawns
//                (the page's mapper: uiMap ids, map percent on the live
//                frames), drops (each row's count out of the looted kills)
//   object page  spawns, contents (count out of the looted opens)
//   item tooltip (nether.wowhead.com/forever/tooltip/item/<id>) the
//                reputation ("Requires <Faction> - <Standing>") and PvP rank
//                ("Requires <Title> (Rank N)") the item asks for, or none
//
// The crawl is bounded: `codex wowhead` fetches only the entities the parity
// report (tools/lib/codex/parity.js) lists as missing or different, plus the
// bosses of our own instances, one request at a time, DELAY_MS apart, with a
// pause and retry on 403/429. Each entity's facts are cached in
// <sources>/wowhead/codex/<npc|object|item>/<id>.json (a fresh one is never
// fetched again); `codex build` only reads that cache.
//
//   parseEntity(html, type, id)   page HTML -> facts | null
//   parseTooltip(json, id)        tooltip JSON -> { id, type: 'item', rep: [ { faction, standing } ], pvpRank }
//   wowheadWants(report, instances) -> { npc: [ids], object: [ids], item: [ids] }
//   fetchEntities({ sourcesDir, want, ... }) -> { fetched, cached, missing, failed }
//   loadWowhead(sourcesDir)       -> { npc: { id: facts }, object: {...}, item: {...} }
//   chanceOf(drop)                -> percent, 2 decimals

const fs = require('node:fs');
const path = require('node:path');

const BASE = 'https://www.wowhead.com/forever';
const TOOLTIP = 'https://nether.wowhead.com/forever/tooltip/item';
const DELAY_MS = 1500;
const RETRY_PAUSE_MS = 30000;
const MAX_AGE_DAYS = 14;
const TYPES = ['npc', 'object', 'item'];
const STANDINGS = { hated: 1, hostile: 2, unfriendly: 3, neutral: 4, friendly: 5, honored: 6, revered: 7, exalted: 8 };
const CLASSES = { 'rare elite': 'rareelite', rare: 'rare', elite: 'elite', boss: 'boss', normal: 'normal' };

function jsonAt(text, start) {
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
		else if (c === close && --depth === 0) return JSON.parse(text.slice(start, i + 1));
	}
	return null;
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
	if (!html || (type !== 'npc' && type !== 'object')) return null;
	const title = /<h1[^>]*class="heading-size-1"[^>]*>([^<]*)</.exec(html) || /<meta property="og:title" content="([^"]*)"/.exec(html);
	const name = title ? unhtml(title[1]).replace(/\s*<[^>]*>\s*$/, '').trim() : null;
	const out = { id: Number(id), type, name, level: null, classification: null, spawns: {}, drops: [] };
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
	const out = { id: Number(id), type: 'item', name: json && json.name ? unhtml(json.name) : null, rep: [], pvpRank: null };
	for (const m of t.matchAll(/Requires ([^<]*?) - (Hated|Hostile|Unfriendly|Neutral|Friendly|Honored|Revered|Exalted)\b/g)) {
		out.rep.push({ faction: unhtml(m[1]), standing: STANDINGS[m[2].toLowerCase()] });
	}
	const pvp = /Requires [^<]*?\(Rank (\d+)\)/.exec(t);
	if (pvp) out.pvpRank = Number(pvp[1]);
	return out;
}

// The entities worth a page: what the parity report misses or differs on,
// and every boss of our instances (their loot and chances).
function wowheadWants(report, instances = {}) {
	const want = { npc: new Set(), object: new Set(), item: new Set() };
	const kinds = (report && report.kinds) || {};
	const ids = (name, part = 0) => [...((kinds[name] && kinds[name].missing) || []), ...((kinds[name] && kinds[name].different) || [])].map((r) => String(r.id).split('/')[part]);
	for (const id of ids('bosses', 1)) want.npc.add(id);
	for (const id of ids('boss loot items', 1)) want.npc.add(id);
	for (const id of ids('drop chances', 1)) want.npc.add(id);
	for (const k of ['rares', 'rare loot', 'rare positions']) for (const id of ids(k, 0)) want.npc.add(id);
	for (const k of ['treasures', 'treasure loot']) for (const id of ids(k, 0)) want.object.add(id);
	for (const k of ['items: rep', 'items: pvp']) for (const id of ids(k, 0)) want.item.add(id);
	for (const inst of Object.values(instances)) for (const b of inst.bosses || []) if (b.npc) want.npc.add(String(b.npc));
	const clean = (s) => [...s].map(Number).filter((n) => Number.isInteger(n) && n > 0).sort((a, b) => a - b);
	return { npc: clean(want.npc), object: clean(want.object), item: clean(want.item) };
}

function cacheFile(sourcesDir, type, id) {
	return path.join(sourcesDir, 'wowhead', 'codex', type, `${id}.json`);
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function fetchEntities({ sourcesDir, want, fetchImpl = globalThis.fetch, delayMs = DELAY_MS, retryPauseMs = RETRY_PAUSE_MS, log = () => {}, maxAgeDays = MAX_AGE_DAYS, now = Date.now() }) {
	const res = { fetched: 0, cached: 0, missing: 0, failed: [] };
	const queue = [];
	for (const type of TYPES) {
		for (const id of want[type] || []) {
			const file = cacheFile(sourcesDir, type, id);
			if (fs.existsSync(file) && now - Date.parse(JSON.parse(fs.readFileSync(file, 'utf8')).fetchedAt) < maxAgeDays * 86400000) {
				res.cached++;
				continue;
			}
			queue.push({ type, id, file });
		}
	}
	log(`wowhead: ${queue.length} pages to fetch (${res.cached} cached), ${delayMs} ms apart`);
	for (const [n, { type, id, file }] of queue.entries()) {
		const url = type === 'item' ? `${TOOLTIP}/${id}` : `${BASE}/${type}=${id}`;
		let facts = null;
		let error = null;
		for (let attempt = 0; attempt < 3 && !facts; attempt++) {
			try {
				const r = await fetchImpl(url, { headers: { 'user-agent': 'Mozilla/5.0 (polestar-codex-build)' }, redirect: 'follow' });
				if (r.status === 403 || r.status === 429) {
					error = `HTTP ${r.status}`;
					log(`wowhead: ${url}: ${error}; pausing ${retryPauseMs / 1000} s`);
					await sleep(retryPauseMs * (attempt + 1));
					continue;
				}
				if (r.status === 404) {
					facts = { id, type, notFound: true };
					break;
				}
				if (!r.ok) {
					error = `HTTP ${r.status}`;
					break;
				}
				facts = type === 'item' ? parseTooltip(await r.json(), id) : parseEntity(await r.text(), type, id);
				error = facts ? null : 'unparsed';
			} catch (err) {
				error = err.message;
				await sleep(delayMs);
			}
		}
		if (facts) {
			facts.fetchedAt = new Date(now).toISOString();
			facts.url = url;
			fs.mkdirSync(path.dirname(file), { recursive: true });
			fs.writeFileSync(`${file}.tmp`, `${JSON.stringify(facts)}\n`);
			fs.renameSync(`${file}.tmp`, file);
			if (facts.notFound) res.missing++;
			else res.fetched++;
		} else res.failed.push({ type, id, error });
		if ((n + 1) % 100 === 0) log(`wowhead: ${n + 1}/${queue.length}`);
		if (n + 1 < queue.length) await sleep(delayMs);
	}
	return res;
}

function loadWowhead(sourcesDir) {
	const out = { npc: {}, object: {}, item: {} };
	for (const type of TYPES) {
		const dir = path.join(sourcesDir, 'wowhead', 'codex', type);
		if (!fs.existsSync(dir)) continue;
		for (const f of fs.readdirSync(dir).sort()) {
			if (!f.endsWith('.json')) continue;
			const facts = JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8'));
			if (!facts.notFound) out[type][facts.id] = facts;
		}
	}
	return out;
}

function chanceOf(d) {
	return Math.round((d.count / d.outof) * 10000) / 100;
}

module.exports = { parseEntity, parseTooltip, wowheadWants, fetchEntities, loadWowhead, chanceOf, BASE, TOOLTIP, DELAY_MS };
