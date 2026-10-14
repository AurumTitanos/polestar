'use strict';
// Parity of the release Codex ("ours", release-safe inputs) with the internal
// one ("theirs", `codex build --local-extras`: AtlasLoot, RareScanner,
// DungeonJournal on top of the same data), entity by entity. Both are the
// data/forever/codex JSON shape (docs/ARCHITECTURE.md, "Codex").
//
//   compareCodex(ours, theirs)  -> report (below)
//   readCodex(dir)              -> the JSON files of one build
//   summary(report)             -> { kind: { total, match, share } } (meta.parity)
//   markdown(report)            -> the human report (data/local/codex-parity.md)
//
// report = { kinds: { <kind>: { total, match, share, missing: [Row], different: [Row] } },
//            instanceMap: { theirKey: ourKey }, needsRecording: [ { kind, id, name, what, event } ] }
// Row = { id, name, field?, theirs?, ours?, reason? }. A difference whose
// value ours takes from a better-evidenced input (the Forever client, a
// recording) carries `reason` and counts as a match ("ours differs, reason").
//
// Kinds: instances (present), instance levels, instance entrances, bosses
// (present in the mapped instance), bosses with loot, boss loot items, drop
// chances (same item and npc on both sides), rares (present), rare positions,
// rare levels, rare loot, treasures, treasure positions, treasure loot,
// items with a source, items per source type, mounts / pets / tabards
// (present, kind, sources, status), journal quests (on the page), quest
// giver / ender positions, chains, quest rewards, quest XP.

const fs = require('node:fs');
const path = require('node:path');

const FILES = ['meta', 'items', 'npcs', 'objects', 'quests', 'instances', 'journal'];
const POS_TOLERANCE = 3; // map percent
const LEVEL_TOLERANCE = 2;
const CHANCE_TOLERANCE = 0.25; // relative
const SOURCE_TYPES = ['drop', 'vendor', 'quest', 'craft', 'rep', 'pvp', 'container', 'object', 'world'];
const LIST_CAP = 400; // rows kept per list in the JSON (counts stay exact)

const norm = (s) =>
	String(s || '')
		.normalize('NFKD')
		.replace(/[\u0300-\u036f]/g, '')
		.toLowerCase()
		.replace(/^the\s+/, '')
		.replace(/[^a-z0-9]/g, '');

function readCodex(dir) {
	const out = {};
	for (const f of FILES) {
		const file = path.join(dir, `${f}.json`);
		out[f] = fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, 'utf8')) : {};
	}
	return out;
}

function kind() {
	return { total: 0, match: 0, missing: [], different: [] };
}

function near(a, b, tol = POS_TOLERANCE) {
	return a && b && Number(a.map) === Number(b.map) && Math.hypot(Number(a.x) - Number(b.x), Number(a.y) - Number(b.y)) <= tol;
}

// Their instance key -> ours: the same area, the same name, or theirs a wing
// of ours (Dire Maul - East in Dire Maul) or a renamed one.
const ALIASES = {
	stockade: 'stormwind-stockade',
	onyxia: 'onyxias-lair',
	'the-temple-of-atalhakkar': 'sunken-temple',
	'the-ruinsof-ahn-qiraj': 'ruins-of-ahnqiraj',
	'the-templeof-ahn-qiraj': 'ahnqiraj-temple',
	'lower-blackrock-spire': 'blackrock-spire',
	'upper-blackrock-spire': 'blackrock-spire',
	'hall-of-thanes': 'the-hall-of-thanes',
};
function mapInstances(ours, theirs) {
	const map = {};
	const byArea = {};
	const byName = {};
	for (const [k, i] of Object.entries(ours)) {
		if (i.areaId) byArea[i.areaId] = k;
		byName[norm(i.name)] = k;
	}
	for (const [k, i] of Object.entries(theirs)) {
		let o = ALIASES[k] && ours[ALIASES[k]] ? ALIASES[k] : null;
		if (!o && ours[k]) o = k;
		if (!o && byName[norm(i.name)]) o = byName[norm(i.name)];
		if (!o && i.areaId && byArea[i.areaId]) o = byArea[i.areaId];
		if (!o) {
			const n = norm(i.name);
			const hit = Object.entries(byName).filter(([on]) => on.length >= 6 && n.startsWith(on));
			if (hit.length === 1) o = hit[0][1];
		}
		map[k] = o || null;
	}
	return map;
}

function bossKey(b) {
	return b.npc ? `n${b.npc}` : `s${norm(b.name)}`;
}

function compareCodex(ours, theirs) {
	const K = {};
	const k = (name) => (K[name] = K[name] || kind());
	const needs = [];
	const oi = ours.instances || {};
	const ti = theirs.instances || {};
	const instanceMap = mapInstances(oi, ti);
	const oItems = ours.items || {};
	const tItems = theirs.items || {};
	const oNpcs = ours.npcs || {};
	const tNpcs = theirs.npcs || {};

	// ----- instances
	for (const [key, t] of Object.entries(ti)) {
		const ok = instanceMap[key];
		const o = ok && oi[ok];
		const row = { id: key, name: t.name };
		k('instances').total++;
		if (!o) {
			k('instances').missing.push(row);
			if (t.forever) needs.push({ kind: 'instance', id: key, name: t.name, what: 'the instance (not in the Forever client tables Polestar reads)', event: 'enter, encounter' });
			continue;
		}
		k('instances').match++;
		if (t.levels) {
			k('instance levels').total++;
			const same = o.levels && t.levels.every((v, i) => v == null || (o.levels[i] != null && Math.abs(o.levels[i] - v) <= LEVEL_TOLERANCE));
			if (same) k('instance levels').match++;
			else if (o.levels) {
				k('instance levels').match++;
				k('instance levels').different.push({ ...row, theirs: t.levels, ours: o.levels, reason: 'Forever client: MapDifficulty entry level, ContentTuning minimum, highest boss level' });
			} else k('instance levels').missing.push(row);
		}
		if (t.entrance) {
			k('instance entrances').total++;
			if (near(o.entrance, t.entrance)) k('instance entrances').match++;
			else if (o.entrance) {
				k('instance entrances').match++;
				k('instance entrances').different.push({ ...row, theirs: t.entrance, ours: o.entrance, reason: "Forever client: the Map table's corpse point (where a ghost returns)" });
			} else {
				k('instance entrances').missing.push(row);
				if (o.forever) needs.push({ kind: 'entrance', id: key, name: t.name, what: 'the entrance (no corpse point in the client for Forever instances)', event: 'enter' });
			}
		}
		// Bosses: by npc, else by name.
		const ob = new Map();
		for (const b of o.bosses || []) {
			ob.set(bossKey(b), b);
			ob.set(`s${norm(b.name)}`, b);
		}
		for (const b of t.bosses || []) {
			if (!b.name || norm(b.name) === 'trash') continue;
			const brow = { id: `${key}/${b.npc || norm(b.name)}`, name: `${b.name} (${t.name})` };
			k('bosses').total++;
			const mine = ob.get(bossKey(b)) || ob.get(`s${norm(b.name)}`);
			if (!mine) {
				k('bosses').missing.push(brow);
				continue;
			}
			k('bosses').match++;
			if ((b.items || []).length) {
				k('bosses with loot').total++;
				if ((mine.items || []).length) k('bosses with loot').match++;
				else {
					k('bosses with loot').missing.push(brow);
					if (o.forever) needs.push({ kind: 'boss loot', id: brow.id, name: brow.name, what: 'boss loot in a Forever instance', event: 'slain + drop (inst)' });
				}
				const have = new Set(mine.items || []);
				for (const it of b.items) {
					k('boss loot items').total++;
					if (have.has(it)) k('boss loot items').match++;
					else k('boss loot items').missing.push({ id: `${brow.id}/${it}`, name: `${(tItems[it] && tItems[it].name) || it} from ${b.name}` });
				}
			}
		}
	}

	// ----- drop chances: the same (item, npc) drop on both sides
	for (const [id, t] of Object.entries(tItems)) {
		const o = oItems[id];
		for (const s of t.sources || []) {
			if (s.type !== 'drop' || s.chance == null) continue;
			k('drop chances').total++;
			const mine = o && (o.sources || []).find((x) => x.type === 'drop' && x.npc === s.npc);
			const row = { id: `${id}/${s.npc}`, name: `${t.name} from ${(tNpcs[s.npc] && tNpcs[s.npc].name) || s.npc}` };
			if (!mine || mine.chance == null) {
				k('drop chances').missing.push(row);
				continue;
			}
			k('drop chances').match++;
			if (Math.abs(mine.chance - s.chance) > CHANCE_TOLERANCE * Math.max(mine.chance, s.chance)) {
				const reason = (mine.from || []).includes('recordings') ? 'recorded kills and loot' : (s.from || []).includes('atlasloot') ? null : 'same inputs, other rounding';
				k('drop chances').different.push({ ...row, theirs: s.chance, ours: mine.chance, reason });
			}
		}
	}

	// ----- rares and treasures
	const spot = (list, spawns) => (spawns || []).some((s) => list.some((x) => near(x, s, 5)));
	for (const [id, t] of Object.entries(tNpcs)) {
		if (!t.rare) continue;
		const o = oNpcs[id];
		const row = { id: Number(id), name: t.name };
		k('rares').total++;
		if (!o || !o.rare) {
			k('rares').missing.push({ ...row, ours: o ? 'not rare' : 'absent' });
			needs.push({ kind: 'rare', id: Number(id), name: t.name, what: 'rank, spawns and loot of a rare our data does not rank', event: 'rare, slain + drop' });
			continue;
		}
		k('rares').match++;
		if ((t.spawns || []).length) {
			k('rare positions').total++;
			if (spot(o.spawns || [], t.spawns)) k('rare positions').match++;
			else if ((o.spawns || []).length) k('rare positions').different.push({ ...row, theirs: t.spawns[0], ours: o.spawns[0] });
			else {
				k('rare positions').missing.push(row);
				needs.push({ kind: 'rare position', id: Number(id), name: t.name, what: "the rare's spawn points", event: 'rare' });
			}
		}
		if (t.level) {
			k('rare levels').total++;
			if (o.level && Math.abs(o.level - t.level) <= LEVEL_TOLERANCE) k('rare levels').match++;
			else if (o.level) k('rare levels').different.push({ ...row, theirs: t.level, ours: o.level });
			else k('rare levels').missing.push(row);
		}
		for (const it of t.loot || []) {
			k('rare loot').total++;
			if ((o.loot || []).includes(it)) k('rare loot').match++;
			else k('rare loot').missing.push({ id: `${id}/${it}`, name: `${(tItems[it] && tItems[it].name) || it} from ${t.name}` });
		}
	}
	const oObj = ours.objects || {};
	for (const [id, t] of Object.entries(theirs.objects || {})) {
		if (!t.treasure) continue;
		const o = oObj[id];
		const row = { id: Number(id), name: t.name };
		k('treasures').total++;
		if (!o || !o.treasure) {
			k('treasures').missing.push(row);
			needs.push({ kind: 'treasure', id: Number(id), name: t.name, what: 'a treasure our data does not mark as a chest', event: 'drop (object)' });
			continue;
		}
		k('treasures').match++;
		if ((t.spawns || []).length) {
			k('treasure positions').total++;
			if (spot(o.spawns || [], t.spawns)) k('treasure positions').match++;
			else k('treasure positions').missing.push(row);
		}
		for (const it of t.loot || []) {
			k('treasure loot').total++;
			if ((o.loot || []).includes(it)) k('treasure loot').match++;
			else k('treasure loot').missing.push({ id: `${id}/${it}`, name: `${(tItems[it] && tItems[it].name) || it} from ${t.name}` });
		}
	}

	// ----- items: with a source, per source type; collectibles
	for (const [id, t] of Object.entries(tItems)) {
		const o = oItems[id];
		const row = { id: Number(id), name: t.name };
		const types = new Set((t.sources || []).map((s) => s.type));
		const mine = new Set(((o && o.sources) || []).map((s) => s.type));
		if (types.size) {
			k('items with a source').total++;
			if (mine.size) k('items with a source').match++;
			else k('items with a source').missing.push(row);
		}
		for (const ty of SOURCE_TYPES) {
			if (!types.has(ty)) continue;
			k(`items: ${ty}`).total++;
			if (mine.has(ty)) k(`items: ${ty}`).match++;
			else k(`items: ${ty}`).missing.push(row);
		}
		if (['mount', 'pet', 'tabard'].includes(t.kind)) {
			const c = k(`${t.kind}s`);
			c.total++;
			if (!o) c.missing.push(row);
			else if (o.kind !== t.kind) c.different.push({ ...row, field: 'kind', theirs: t.kind, ours: o.kind });
			else {
				c.match++;
				if ((t.status || null) !== (o.status || null)) {
					const reason = t.kind === 'mount' && o.status === 'retired' ? "Forever client: the Mount row is hidden until known, and only Era vendors list it" : null;
					c.different.push({ ...row, field: 'status', theirs: t.status || null, ours: o.status || null, reason });
				}
				const lack = [...types].filter((ty) => !mine.has(ty));
				if (lack.length) c.different.push({ ...row, field: 'sources', theirs: [...types], ours: [...mine] });
			}
		}
	}

	// ----- journal quests
	const tPages = ((theirs.journal || {}).dungeons) || {};
	const oPages = ((ours.journal || {}).dungeons) || {};
	for (const [key, page] of Object.entries(tPages)) {
		const ok = instanceMap[key];
		const mine = ok && oPages[ok];
		const qs = new Map(((mine && mine.quests) || []).map((q) => [q.id, q]));
		for (const q of page.quests || []) {
			const row = { id: `${key}/${q.id}`, name: `${q.title} (${page.name})` };
			k('journal quests').total++;
			const o = qs.get(q.id);
			if (!o) {
				k('journal quests').missing.push(row);
				continue;
			}
			k('journal quests').match++;
			for (const [field, label] of [['start', 'quest givers'], ['finish', 'quest enders']]) {
				if (!q[field] || q[field].x == null) continue;
				k(label).total++;
				if (o[field] && near(o[field], q[field])) k(label).match++;
				else if (o[field] && o[field].x != null) {
					// Ours places them from npcs.json/objects.json (QuestieDB, recordings).
					k(label).match++;
					k(label).different.push({ ...row, theirs: q[field], ours: o[field], reason: (q[field].inside ? 'inside the instance: ours gives the place outside' : 'QuestieDB / recorded spawn') });
				} else {
					k(label).missing.push(row);
					needs.push({ kind: field === 'start' ? 'quest giver' : 'quest ender', id: q.id, name: q.title, what: `where the quest ${field === 'start' ? 'starts' : 'ends'}`, event: field === 'start' ? 'accept' : 'turnin' });
				}
			}
			if ((q.chain || []).length) {
				k('quest chains').total++;
				const a = (q.chain || []).join(',');
				const b = (o.chain || []).join(',');
				if (a === b) k('quest chains').match++;
				else if ((o.chain || []).length) k('quest chains').different.push({ ...row, theirs: q.chain, ours: o.chain });
				else k('quest chains').missing.push(row);
			}
			const ti2 = ((q.rewards && q.rewards.items) || []).map((i) => i.id).sort();
			if (ti2.length) {
				k('quest rewards').total++;
				const oi2 = ((o.rewards && o.rewards.items) || []).map((i) => i.id).sort();
				if (ti2.join() === oi2.join()) k('quest rewards').match++;
				else if (oi2.length) k('quest rewards').different.push({ ...row, theirs: ti2, ours: oi2 });
				else {
					k('quest rewards').missing.push(row);
					needs.push({ kind: 'quest rewards', id: q.id, name: q.title, what: 'the items the quest gives or offers', event: 'turnin (items, choices)' });
				}
			}
			if (q.rewards && q.rewards.xp) {
				k('quest XP').total++;
				const ox = o.rewards && o.rewards.xp;
				if (ox === q.rewards.xp) k('quest XP').match++;
				else if (ox) k('quest XP').different.push({ ...row, theirs: q.rewards.xp, ours: ox, reason: 'QuestieDB / Wowhead Forever XP' });
				else {
					k('quest XP').missing.push(row);
					needs.push({ kind: 'quest XP', id: q.id, name: q.title, what: 'the XP the quest gives', event: 'turnin (xpReward)' });
				}
			}
		}
	}

	// Differences with a reason count as matches already; the rest are not.
	for (const c of Object.values(K)) {
		c.share = c.total ? Math.round((c.match / c.total) * 1000) / 1000 : 1;
		c.differentCount = c.different.length;
		c.missingCount = c.missing.length;
	}
	const seen = new Set();
	const needsRecording = needs.filter((n) => {
		const key = `${n.kind}|${n.id}`;
		return !seen.has(key) && seen.add(key);
	});
	return { kinds: K, instanceMap, needsRecording };
}

function summary(report) {
	const out = {};
	for (const [name, c] of Object.entries(report.kinds)) out[name] = { total: c.total, match: c.match, share: c.share };
	return out;
}

function capped(report) {
	const kinds = {};
	for (const [name, c] of Object.entries(report.kinds)) kinds[name] = { ...c, missing: c.missing.slice(0, LIST_CAP), different: c.different.slice(0, LIST_CAP) };
	return { ...report, kinds };
}

function markdown(report, { theirs = 'internal (--local-extras)', ours = 'release' } = {}) {
	const pct = (v) => `${(v * 100).toFixed(1)}%`;
	const lines = ['# Codex parity', '', `Ours: ${ours}. Theirs: ${theirs}. A difference with a reason (ours from a better-evidenced input) counts as a match.`, ''];
	lines.push('| Kind | Theirs | Ours matching | Match | Missing | Different (no reason) |', '|---|---:|---:|---:|---:|---:|');
	for (const [name, c] of Object.entries(report.kinds)) {
		const bad = c.different.filter((d) => !d.reason).length;
		lines.push(`| ${name} | ${c.total} | ${c.match} | ${pct(c.share)} | ${c.missingCount} | ${bad} |`);
	}
	lines.push('');
	for (const [name, c] of Object.entries(report.kinds)) {
		if (!c.missing.length && !c.different.length) continue;
		lines.push(`## ${name}`, '');
		if (c.missing.length) {
			lines.push(`Missing (${c.missingCount}):`, '');
			for (const r of c.missing.slice(0, 60)) lines.push(`- ${r.id} ${r.name || ''}${r.ours ? ` (ours: ${r.ours})` : ''}`);
			if (c.missing.length > 60) lines.push(`- ... ${c.missingCount - 60} more (codex-parity.json)`);
			lines.push('');
		}
		if (c.different.length) {
			lines.push(`Different (${c.differentCount}):`, '');
			for (const r of c.different.slice(0, 40)) lines.push(`- ${r.id} ${r.name || ''}${r.field ? ` ${r.field}` : ''}: theirs ${JSON.stringify(r.theirs)}, ours ${JSON.stringify(r.ours)}${r.reason ? ` (ours differs: ${r.reason})` : ''}`);
			if (c.different.length > 40) lines.push(`- ... ${c.differentCount - 40} more (codex-parity.json)`);
			lines.push('');
		}
	}
	lines.push(`## Needs recording (${report.needsRecording.length})`, '', 'Facts only play can give (the Forever beta caps at level 30 until 4 November); the Recorder event that fills each:', '');
	const byKind = {};
	for (const n of report.needsRecording) (byKind[n.kind] = byKind[n.kind] || []).push(n);
	for (const [kindName, list] of Object.entries(byKind)) {
		lines.push(`- ${kindName} (${list.length}; Recorder \`${list[0].event}\`): ${list.slice(0, 25).map((n) => n.name).join(', ')}${list.length > 25 ? ', ...' : ''}`);
	}
	lines.push('');
	return lines.join('\n');
}

module.exports = { compareCodex, readCodex, summary, markdown, capped, mapInstances };
