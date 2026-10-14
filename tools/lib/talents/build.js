'use strict';
// Talent plans for the addon's Talents module: talents/forever/<class>.json
// (picks by talent name, one per level) resolved against the Forever client's
// trait tables and replayed point by point under the client's rules, then
// written as addon/Polestar/Talents/Builds.lua with a snapshot of the tree,
// so the addon can check its plan against the live tree at run time.
//
// Forever's three-column trees are one C_Traits tree per class:
//   SkillLineXTraitTree  SkillLineID (class skill line) -> TraitTreeID
//   TraitNode            ID, TraitTreeID, PosX, PosY (columns by PosX, rows by PosY)
//   TraitNodeXTraitNodeEntry -> TraitNodeEntry (MaxRanks, TraitDefinitionID)
//   TraitDefinition      SpellID (name from SpellName)
//   TraitNodeGroupXTraitNode, TraitNodeGroupXTraitCond -> TraitCond: a node
//                        group gated on points spent (CondType 0,
//                        SpentAmountRequired) in the group TraitNodeGroupID
//   TraitEdge            LeftTraitNodeID -> RightTraitNodeID (an arrow)

// Whether an arrow needs the talent before it at full rank ("full") or one
// rank ("started"). Unconfirmed in game: the one switch for the tool's replay
// and the addon (Builds.lua carries it). Flip it, then `talents build`.
const PREREQ_RULE = 'full';

const TABLES = [
	'SkillLineXTraitTree',
	'TraitNode',
	'TraitNodeEntry',
	'TraitDefinition',
	'TraitNodeXTraitNodeEntry',
	'TraitNodeGroupXTraitNode',
	'TraitNodeGroupXTraitCond',
	'TraitCond',
	'TraitEdge',
	'SpellName',
];

const CLASSES = { PALADIN: { skillLine: 184, name: 'Paladin' } };
const FIRST_LEVEL = 10; // the first talent point
const COLUMN_GAP = 1200; // PosX distance that separates two spec columns
const SAME_X = 100; // PosX within this is one column of a spec

const num = (v) => Number(v) || 0;

// Clusters sorted values: a new cluster wherever the gap exceeds `gap`.
function clusters(values, gap) {
	const out = [];
	for (const v of [...new Set(values)].sort((a, b) => a - b)) {
		const last = out[out.length - 1];
		if (last && v - last[last.length - 1] <= gap) last.push(v);
		else out.push([v]);
	}
	return out;
}

// -> { treeID, nodes: { id: { entry, max, spell, name, spec, row, col } }, specs: [[ids]], groups, gates, edges }
function treeFacts(tables, cls) {
	const info = CLASSES[cls];
	if (!info) throw new Error(`talents: no tree known for class ${cls}`);
	const link = tables.SkillLineXTraitTree.find((r) => num(r.SkillLineID) === info.skillLine);
	if (!link) throw new Error(`talents: no TraitTree for skill line ${info.skillLine}`);
	const treeID = num(link.TraitTreeID);
	const spells = new Map(tables.SpellName.map((r) => [num(r.ID), r.Name_lang]));
	const defs = new Map(tables.TraitDefinition.map((r) => [num(r.ID), r]));
	const entries = new Map(tables.TraitNodeEntry.map((r) => [num(r.ID), r]));
	const entryOf = new Map();
	for (const r of tables.TraitNodeXTraitNodeEntry) if (!entryOf.has(num(r.TraitNodeID)) || num(r._Index) === 0) entryOf.set(num(r.TraitNodeID), num(r.TraitNodeEntryID));
	const raw = tables.TraitNode.filter((r) => num(r.TraitTreeID) === treeID);
	const nodes = {};
	for (const r of raw) {
		const id = num(r.ID);
		const entry = entries.get(entryOf.get(id));
		if (!entry) continue;
		const def = defs.get(num(entry.TraitDefinitionID));
		const spell = def ? num(def.SpellID) : 0;
		const name = (def && def.OverrideName_lang) || spells.get(spell) || '';
		nodes[id] = { entry: num(entry.ID), max: num(entry.MaxRanks), spell, name, x: num(r.PosX), y: num(r.PosY) };
	}
	const all = Object.values(nodes);
	const specCols = clusters(all.map((n) => n.x), COLUMN_GAP);
	const rows = [...new Set(all.map((n) => n.y))].sort((a, b) => a - b);
	const specs = specCols.map(() => []);
	for (const [id, n] of Object.entries(nodes)) {
		const s = specCols.findIndex((c) => c.includes(n.x));
		const cols = clusters(specCols[s], SAME_X);
		n.spec = s + 1;
		n.row = rows.indexOf(n.y) + 1;
		n.col = cols.findIndex((c) => c.includes(n.x)) + 1;
		specs[s].push(num(id));
	}
	// Gates: a node in a gated group needs points spent in the counted group.
	const conds = new Map(tables.TraitCond.filter((r) => num(r.CondType) === 0 && num(r.SpentAmountRequired) > 0).map((r) => [num(r.ID), r]));
	const condsOfGroup = new Map();
	for (const r of tables.TraitNodeGroupXTraitCond) {
		const c = conds.get(num(r.TraitCondID));
		if (!c) continue;
		const g = num(r.TraitNodeGroupID);
		if (!condsOfGroup.has(g)) condsOfGroup.set(g, []);
		condsOfGroup.get(g).push({ group: num(c.TraitNodeGroupID), need: num(c.SpentAmountRequired) });
	}
	const members = new Map();
	const gates = {};
	for (const r of tables.TraitNodeGroupXTraitNode) {
		const id = num(r.TraitNodeID);
		const g = num(r.TraitNodeGroupID);
		if (!nodes[id]) continue;
		if (!members.has(g)) members.set(g, []);
		members.get(g).push(id);
		for (const gate of condsOfGroup.get(g) || []) (gates[id] = gates[id] || []).push(gate);
	}
	const groups = {};
	for (const list of Object.values(gates)) for (const { group } of list) groups[group] = (members.get(group) || []).slice().sort((a, b) => a - b);
	for (const list of Object.values(gates)) list.sort((a, b) => a.need - b.need || a.group - b.group);
	const edges = tables.TraitEdge.filter((r) => nodes[num(r.LeftTraitNodeID)] && nodes[num(r.RightTraitNodeID)])
		.map((r) => ({ from: num(r.LeftTraitNodeID), to: num(r.RightTraitNodeID) }))
		.sort((a, b) => a.to - b.to || a.from - b.from);
	return { cls, treeID, nodes, specs, groups, gates, edges };
}

// A plan's picks by name -> node IDs. tree names the column (source.order).
function resolveBuild(facts, source, build) {
	const errors = [];
	const picks = [];
	const notes = {};
	build.picks.forEach((p, i) => {
		const where = `${build.key} pick ${i + 1} (level ${p.level}, ${p.talent})`;
		const spec = source.order.indexOf(p.tree) + 1;
		if (!spec) return errors.push(`${where}: unknown tree "${p.tree}"`);
		const hits = facts.specs[spec - 1].filter((id) => facts.nodes[id].name === p.talent);
		if (hits.length !== 1) return errors.push(`${where}: ${hits.length ? 'more than one' : 'no'} ${p.tree} talent named "${p.talent}"`);
		picks.push({ level: p.level, node: hits[0], rank: p.rank });
		if (p.note) notes[p.level] = p.note;
	});
	return { picks, notes, errors };
}

// Every pick under the client's rules: one point per level from 10, the next
// rank of its talent, the tier gate met and every arrow into it satisfied.
function replay(facts, picks, { prereq = PREREQ_RULE } = {}) {
	const errors = [];
	const ranks = {};
	const spent = (g) => (facts.groups[g] || []).reduce((s, id) => s + (ranks[id] || 0), 0);
	picks.forEach((p, i) => {
		const n = facts.nodes[p.node];
		const where = `pick ${i + 1} (level ${p.level}, ${n ? n.name : p.node})`;
		if (!n) return errors.push(`${where}: node ${p.node} is not in tree ${facts.treeID}`);
		if (p.level !== FIRST_LEVEL + i) errors.push(`${where}: expected level ${FIRST_LEVEL + i}`);
		const have = ranks[p.node] || 0;
		if (p.rank !== have + 1) errors.push(`${where}: rank ${p.rank} after ${have}`);
		if (p.rank > n.max) errors.push(`${where}: rank ${p.rank} of ${n.max}`);
		for (const g of facts.gates[p.node] || []) if (spent(g.group) < g.need) errors.push(`${where}: needs ${g.need} points in its tree, has ${spent(g.group)}`);
		for (const e of facts.edges) {
			if (e.to !== p.node) continue;
			const from = facts.nodes[e.from];
			const need = prereq === 'full' ? from.max : 1;
			if ((ranks[e.from] || 0) < need) errors.push(`${where}: needs ${from.name} ${need}/${from.max}`);
		}
		ranks[p.node] = p.rank;
	});
	return errors;
}

function luaStr(s) {
	return `"${String(s).replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\n/g, '\\n')}"`;
}

function emitLua(header, facts, source, builds) {
	const L = [header, '', 'local ADDON, ns = ...', 'local T = ns.Talents', '', 'T.Register({'];
	L.push(`\tclass = ${luaStr(source.class)}, tree = ${facts.treeID}, prereq = ${luaStr(PREREQ_RULE)},`);
	L.push(`\tsource = ${luaStr(source.source)}, url = ${luaStr(source.sourceUrl)},`);
	L.push(`\tsummary = ${luaStr(source.summary)},`);
	L.push(`\tspecs = { ${source.order.map(luaStr).join(', ')} },`);
	L.push('\t-- node = { entry, max ranks, spell, spec column, row, column, name }');
	L.push('\tnodes = {');
	for (const id of Object.keys(facts.nodes).map(Number).sort((a, b) => a - b)) {
		const n = facts.nodes[id];
		L.push(`\t\t[${id}] = { ${n.entry}, ${n.max}, ${n.spell}, ${n.spec}, ${n.row}, ${n.col}, ${luaStr(n.name)} },`);
	}
	L.push('\t},');
	L.push('\t-- node = { { counted group, points }, ... }');
	L.push('\tgates = {');
	for (const id of Object.keys(facts.gates).map(Number).sort((a, b) => a - b)) {
		L.push(`\t\t[${id}] = { ${facts.gates[id].map((g) => `{ ${g.group}, ${g.need} }`).join(', ')} },`);
	}
	L.push('\t},');
	L.push('\tgroups = {');
	for (const g of Object.keys(facts.groups).map(Number).sort((a, b) => a - b)) L.push(`\t\t[${g}] = { ${facts.groups[g].join(', ')} },`);
	L.push('\t},');
	L.push('\t-- { from, to }: the arrow\'s target needs its source first');
	L.push(`\tedges = { ${facts.edges.map((e) => `{ ${e.from}, ${e.to} }`).join(', ')} },`);
	L.push('\tbuilds = {');
	for (const b of builds) {
		L.push('\t\t{');
		L.push(`\t\t\tkey = ${luaStr(b.key)}, spec = ${source.order.indexOf(b.spec) + 1}, split = ${luaStr(b.split)}, link = ${luaStr(b.link)},`);
		L.push('\t\t\t-- one per level from 10: { node, rank }');
		const rows = [];
		for (let i = 0; i < b.picks.length; i += 6) rows.push(`\t\t\t\t${b.picks.slice(i, i + 6).map((p) => `{ ${p.node}, ${p.rank} },`).join(' ')}`);
		L.push('\t\t\tpicks = {', ...rows, '\t\t\t},');
		L.push('\t\t\tnotes = {');
		for (const lv of Object.keys(b.notes).map(Number).sort((x, y) => x - y)) L.push(`\t\t\t\t[${lv}] = ${luaStr(b.notes[lv])},`);
		L.push('\t\t\t},', '\t\t},');
	}
	L.push('\t},', '})', '');
	return L.join('\n');
}

// source (talents/forever/<class>.json) + tables -> { lua, errors, facts, builds }
function buildTalents(source, tables, { header, prereq = PREREQ_RULE } = {}) {
	const facts = treeFacts(tables, source.class);
	const errors = [];
	const builds = [];
	for (const b of source.builds) {
		const r = resolveBuild(facts, source, b);
		errors.push(...r.errors);
		if (!r.errors.length) errors.push(...replay(facts, r.picks, { prereq }).map((e) => `${b.key} ${e}`));
		builds.push({ ...b, picks: r.picks, notes: r.notes });
	}
	return { facts, builds, errors, lua: emitLua(header || '-- Talents', facts, source, builds) };
}

module.exports = { PREREQ_RULE, TABLES, CLASSES, FIRST_LEVEL, treeFacts, resolveBuild, replay, buildTalents, emitLua };
