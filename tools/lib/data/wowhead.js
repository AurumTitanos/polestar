'use strict';
// Wowhead's Forever database (https://www.wowhead.com/forever): the quest
// facts Forever changed. Facts only (ids, XP, levels); results stay in data/,
// which is gitignored.
//
// Quest lists: /forever/quests/<continent>/<zone> carries a Listview of the
// zone's quests: id, name, level, reqlevel, xp, category (the zone's AreaTable
// id) and envChange { status: new | updated | unchanged, lines }. Class quests
// are filed under the class instead (/forever/quests/classes/<class>, a
// negative category per class). Wowhead answers an unknown path with a generic
// list, so only rows whose category is the page's own count.
//
// Cache: <sources>/wowhead/zones.json ({ fetchedAt, zones: { "<area>": rows } }),
// refetched once it is a day old (Wowhead adds quests as players find them);
// --offline builds read it and fetch nothing.
//
// What the build does with it:
// - applyChangeNotes: a note "Experience X instead of Y", "Level X instead of
//   Y" or "Requires level X instead of Y" sets X where our value is still Y
//   (or, for XP, missing): the note says Forever changed it, and we still hold
//   the old value. A different value of ours is left alone.
// - fillWowheadXp: XP for quests still without any after QuestieDB and the web
//   XP sources, from the zone list's xp.
// Wowhead's Forever database also lists datamined quests that are not live
// (<NYI> placeholders, Season of Discovery leftovers), so a quest's presence
// there says nothing about whether it is in the game.

const fs = require('node:fs');
const path = require('node:path');

const BASE = 'https://www.wowhead.com/forever';
const CONCURRENCY = 4;
const ZONE_TTL_MS = 24 * 60 * 60 * 1000;
const CONTINENTS = { 1414: 'kalimdor', 1415: 'eastern-kingdoms' };
// Wowhead's quest categories for the class pages.
const CLASS_PAGES = [
	['Warlock', -61], ['Warrior', -81], ['Shaman', -82], ['Paladin', -141], ['Mage', -161],
	['Rogue', -162], ['Hunter', -261], ['Priest', -262], ['Druid', -263],
];

// "Un'Goro Crater" -> "ungoro-crater"
function slug(name) {
	return String(name).toLowerCase().replace(/['’]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

// The JSON array starting at text[start] ('['), strings respected.
function arrayAt(text, start) {
	let depth = 0;
	let inString = false;
	for (let i = start; i < text.length; i++) {
		const c = text[i];
		if (inString) {
			if (c === '\\') i++;
			else if (c === '"') inString = false;
		} else if (c === '"') inString = true;
		else if (c === '[') depth++;
		else if (c === ']' && --depth === 0) return JSON.parse(text.slice(start, i + 1));
	}
	throw new Error('unterminated array');
}

function plain(s) {
	return String(s).replace(/<[^>]*>/g, '').replace(/&amp;/g, '&').replace(/&#0?39;|&#x27;/g, "'").trim();
}

// Zone page HTML -> rows of the quest Listview whose category is `area`
// ([] for a page without one).
function parseZoneQuests(html, area) {
	const i = html.indexOf("new Listview({template: 'quest'");
	if (i < 0) return [];
	const d = html.indexOf('data:', i);
	const open = d < 0 ? -1 : html.indexOf('[', d);
	if (open < 0) return [];
	return arrayAt(html, open)
		.filter((q) => q.category === area && Number.isInteger(q.id))
		.map((q) => ({
			id: q.id,
			name: q.name,
			level: q.level || null,
			reqlevel: q.reqlevel || null,
			xp: q.xp || null,
			status: (q.envChange && q.envChange.status) || 'unchanged',
			lines: ((q.envChange && q.envChange.lines) || []).map(plain),
		}))
		.sort((a, b) => a.id - b.id);
}

const NOTES = [
	['xp', /^Experience ([\d,]+) instead of ([\d,]+|none)$/],
	['minLevel', /^Requires level (\d+) instead of (\d+|none)$/],
	['level', /^Level (\d+) instead of (\d+|none)$/],
];

// Change-note lines -> [{ field, value, was }] (was: null for "none").
function parseChangeNotes(lines) {
	const out = [];
	for (const line of lines) {
		for (const [field, re] of NOTES) {
			const m = re.exec(line);
			if (!m) continue;
			const num = (s) => (s === 'none' ? null : Number(s.replace(/,/g, '')));
			out.push({ field, value: num(m[1]), was: num(m[2]) });
			break;
		}
	}
	return out;
}

// Quest lists worth asking for: the class pages, then zone and city maps
// (UiMap type 3) with an area. A zone's continent comes from its parent; a
// zone without one is tried under both continents and bare.
function zonePages(zones) {
	const out = CLASS_PAGES.map(([name, area]) => ({ area, name, paths: [`classes/${name.toLowerCase()}`] }));
	const seen = new Set();
	for (const z of Object.values(zones)) {
		if (z.type !== 3 || !z.areaId || !z.name || seen.has(z.areaId)) continue;
		seen.add(z.areaId);
		const s = slug(z.name);
		const cont = CONTINENTS[z.parent];
		out.push({ area: z.areaId, name: z.name, paths: cont ? [`${cont}/${s}`] : [`kalimdor/${s}`, `eastern-kingdoms/${s}`, s] });
	}
	return out.sort((a, b) => a.area - b.area);
}

async function get(fetchImpl, url) {
	const res = await fetchImpl(url, { headers: { 'user-agent': 'Mozilla/5.0 (polestar-data-build)' } });
	if (res.status === 404) return null;
	if (!res.ok) throw new Error(`GET ${url}: HTTP ${res.status}`);
	return res.text();
}

async function pool(items, fn) {
	let next = 0;
	const workers = Array.from({ length: Math.min(CONCURRENCY, items.length) }, async () => {
		while (next < items.length) await fn(items[next++]);
	});
	await Promise.all(workers);
}

// -> { rows: Map<id, row>, file, fetchedAt, warnings }
async function loadZoneQuests({ sourcesDir, zones, offline = false, fetchImpl = globalThis.fetch, log = () => {}, now = Date.now() }) {
	const file = path.join(sourcesDir, 'wowhead', 'zones.json');
	let cache = fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, 'utf8')) : null;
	const warnings = [];
	if ((!cache || now - Date.parse(cache.fetchedAt) >= ZONE_TTL_MS) && !offline) {
		const pages = zonePages(zones);
		log(`reading ${pages.length} Wowhead Forever zone quest lists`);
		const fresh = { fetchedAt: new Date(now).toISOString(), zones: {} };
		let errors = 0;
		await pool(pages, async (z) => {
			try {
				for (const p of z.paths) {
					const rows = parseZoneQuests((await get(fetchImpl, `${BASE}/quests/${p}`)) || '', z.area);
					if (rows.length) {
						fresh.zones[z.area] = rows;
						break;
					}
				}
			} catch (err) {
				errors++;
				if (errors <= 3) warnings.push(`Wowhead ${z.name}: ${err.message}`);
			}
		});
		if (errors) {
			warnings.push(`${errors} Wowhead zone lists failed; ${cache ? 'kept the cached lists' : 'building without them'}`);
		} else {
			cache = fresh;
			fs.mkdirSync(path.dirname(file), { recursive: true });
			fs.writeFileSync(`${file}.tmp`, `${JSON.stringify(cache, null, '\t')}\n`);
			fs.renameSync(`${file}.tmp`, file);
		}
	}
	const rows = new Map();
	if (cache) for (const list of Object.values(cache.zones)) for (const r of list) rows.set(r.id, r);
	else warnings.push(offline ? '--offline: no cached Wowhead zone lists' : 'no Wowhead zone lists');
	return { rows, file, fetchedAt: cache ? cache.fetchedAt : null, warnings };
}

function tag(q, source) {
	if (!q.source.includes(source)) q.source.push(source);
}

// quests: the merged table (mutated). rows: Map from loadZoneQuests.
// -> { xp, level, minLevel } counts of values changed
function applyChangeNotes(quests, rows) {
	const changed = { xp: 0, level: 0, minLevel: 0 };
	for (const r of rows.values()) {
		const q = quests[r.id];
		if (!q || r.status !== 'updated') continue;
		for (const n of parseChangeNotes(r.lines)) {
			const cur = q[n.field];
			const stale = n.field === 'xp' ? !Number.isFinite(cur) || cur === n.was : cur === n.was;
			if (!stale || cur === n.value || !(n.value > 0)) continue;
			q[n.field] = n.value;
			tag(q, `wowhead:${n.field}`);
			changed[n.field]++;
		}
	}
	return changed;
}

// XP from the zone lists for quests that still have none. -> count
function fillWowheadXp(quests, rows) {
	let n = 0;
	for (const r of rows.values()) {
		const q = quests[r.id];
		if (!q || Number.isFinite(q.xp) || !(r.xp > 0)) continue;
		q.xp = r.xp;
		tag(q, 'wowhead:xp');
		n++;
	}
	return n;
}

module.exports = { BASE, slug, parseZoneQuests, parseChangeNotes, zonePages, loadZoneQuests, applyChangeNotes, fillWowheadXp };
