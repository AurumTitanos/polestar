'use strict';
// Shared lookups for the generated profession guides: data context, NPC
// positions, nearest trainer / vendor / flight master, and number formatting.

const path = require('node:path');
const { loadData } = require('../../dsl/data');
const { dist } = require('../../route/geo');
const { SIDE } = require('./groups');
const R = require('./route');

const ROOT = path.join(__dirname, '..', '..', '..', '..');
const OUT_DIR = path.join(ROOT, 'guides', 'forever', 'professions');
const FACTIONS = ['Alliance', 'Horde'];
const CITY_MAPS = new Set([1453, 1454, 1455, 1456, 1457, 1458]);

function context(dataDir = path.join(ROOT, 'data', 'forever')) {
	const data = loadData(dataDir);
	return { data, project: R.projector(data) };
}

function fmt(v) {
	return (Math.round(v * 10) / 10).toFixed(1);
}

function zoneName(ctx, map) {
	return (ctx.data.zone(map) || {}).name || `map ${map}`;
}

// An NPC's spawn as { id, name, map, pt } or null: on `prefer` (the zone the
// player is in) when the NPC shows there, else on a capital city map, else on
// the map where the point sits farthest from the edges (Tarren Mill shows on
// both the Alterac and the Hillsbrad map).
function npcSpawn(ctx, id, prefer = null) {
	let best = null;
	for (const s of ctx.data.spawns('npc', id)) {
		if (!ctx.data.eraFrame(s.map)) continue;
		const [x, y] = s.pts[0];
		const score = (s.map === prefer ? 2000 : 0) + (CITY_MAPS.has(s.map) ? 1000 : 0) + Math.min(x, 100 - x, y, 100 - y);
		if (!best || score > best.score) best = { s, score };
	}
	if (!best) return null;
	const [x, y] = best.s.pts[0];
	return { id, name: ctx.data.npc(id).name, map: best.s.map, pt: ctx.project.point(best.s.map, x, y, best.s.f) };
}

function nearest(list, near) {
	let best = null;
	for (const t of list) if (!best || (near && dist(near, t.pt) < dist(near, best.pt))) best = t;
	return best;
}

// Nearest of `list` on the continent of `near`, else the first one.
function nearestSameContinent(list, near) {
	const same = near ? list.filter((t) => t.pt.c === near.c) : [];
	return nearest(same.length ? same : list, near);
}

// Trainers of a profession for `faction` that teach `rank` (professions.json).
function trainerSpawns(ctx, skill, faction, rank) {
	const p = ctx.data.professionNamed(skill);
	const r = p && Array.isArray(p.ranks) ? p.ranks.find((x) => x.name === rank) : null;
	const fromRank = r && r.trainers && r.trainers[faction];
	const ids = new Set((fromRank && fromRank.length ? fromRank : (p && p.trainers && p.trainers[faction]) || []).map(Number));
	return [...ids]
		.sort((a, b) => a - b)
		.map((id) => npcSpawn(ctx, id))
		.filter(Boolean);
}

function rankInfo(ctx, skill, rank) {
	const p = ctx.data.professionNamed(skill);
	return (p && Array.isArray(p.ranks) && p.ranks.find((x) => x.name === rank)) || null;
}

// Vendors of an item usable by `faction` (own side or neutral), placed on
// `prefer` when they show there.
function vendorSpawns(ctx, itemId, faction, ids = null, prefer = null) {
	const it = ctx.data.item(itemId);
	const out = [];
	for (const id of ids || (it && it.vendors) || []) {
		const n = ctx.data.npc(id);
		if (!n || (n.faction !== SIDE[faction] && n.faction !== 'AH')) continue;
		const v = npcSpawn(ctx, id, prefer);
		if (v) out.push(v);
	}
	return out;
}

function vendorNear(ctx, itemId, faction, near) {
	return nearestSameContinent(vendorSpawns(ctx, itemId, faction), near);
}

function flightMaster(ctx, map, faction) {
	const out = [];
	for (const n of Object.values(ctx.data.npcs)) {
		if (!n.roles || !n.roles.includes('flightmaster')) continue;
		if (n.faction !== SIDE[faction]) continue;
		const s = n.spawns && n.spawns[String(map)];
		if (s) out.push({ id: n.id, name: n.name, pt: ctx.project.point(map, s.pts[0][0], s.pts[0][1], s.f) });
	}
	return out.sort((a, b) => a.id - b.id)[0] || null;
}

module.exports = {
	ROOT,
	OUT_DIR,
	FACTIONS,
	context,
	fmt,
	zoneName,
	npcSpawn,
	nearest,
	nearestSameContinent,
	trainerSpawns,
	rankInfo,
	vendorSpawns,
	vendorNear,
	flightMaster,
};
