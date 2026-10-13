'use strict';
// Blizzard map tables (UiMap, UiMapAssignment, AreaTable rows as parsed by
// csv.js) -> zones.json, Era map frames, and an AreaTable-ID -> UiMapID
// resolver for pfQuest coordinates.
//
// UiMapAssignment: Region_0..2 are world min (x, y, z), Region_3..5 world max.
// World x runs north (larger = north), world y runs west (larger = west). The
// region covers the UI sub-rectangle UiMin..UiMax (fractions 0-1 of the map,
// u to the right, v down), so the map's left edge is the region's max y
// extrapolated to u = 0, and so on. Result per contract:
//   wx = top + (bottom - top) * y/100,  wy = left + (right - left) * x/100

const ASPECT_MIN = 1.3;
const ASPECT_MAX = 1.7;

function num(v) {
	const n = Number(v);
	return Number.isFinite(n) ? n : 0;
}

function round3(v) {
	return Math.round(v * 1000) / 1000;
}

function frameFromAssignment(a) {
	const minX = num(a.Region_0);
	const minY = num(a.Region_1);
	const maxX = num(a.Region_3);
	const maxY = num(a.Region_4);
	const u0 = num(a.UiMin_0);
	const v0 = num(a.UiMin_1);
	const u1 = num(a.UiMax_0);
	const v1 = num(a.UiMax_1);
	const du = u1 - u0;
	const dv = v1 - v0;
	if (!(du > 0) || !(dv > 0)) return null;
	const wyAt = (u) => maxY + ((u - u0) * (minY - maxY)) / du;
	const wxAt = (v) => maxX + ((v - v0) * (minX - maxX)) / dv;
	return {
		c: num(a.MapID),
		left: round3(wyAt(0)),
		right: round3(wyAt(1)),
		top: round3(wxAt(0)),
		bottom: round3(wxAt(1)),
	};
}

function uiArea(a) {
	return (num(a.UiMax_0) - num(a.UiMin_0)) * (num(a.UiMax_1) - num(a.UiMin_1));
}

// Prefer the assignment covering most of the map, then lower OrderIndex, then lower ID.
function compareAssignments(a, b) {
	return uiArea(b) - uiArea(a) || num(a.OrderIndex) - num(b.OrderIndex) || num(a.ID) - num(b.ID);
}

function frameCheck(id, f, fullCoverage) {
	const problems = [];
	const width = f.left - f.right;
	const height = f.top - f.bottom;
	if (!(width > 0)) problems.push('left <= right (expected west edge to have larger world y)');
	if (!(height > 0)) problems.push('top <= bottom (expected north edge to have larger world x)');
	if (width > 0 && height > 0) {
		if (width < 50 || width > 60000 || height < 30 || height > 60000) problems.push(`implausible size ${width.toFixed(1)} x ${height.toFixed(1)} yd`);
		const aspect = width / height;
		if (fullCoverage && (aspect < ASPECT_MIN || aspect > ASPECT_MAX)) problems.push(`aspect ${aspect.toFixed(3)} outside ${ASPECT_MIN}-${ASPECT_MAX}`);
	}
	return problems.map((p) => `uiMap ${id}: ${p}`);
}

function buildMaps({ uiMap, assignment, area }) {
	const warnings = [];
	const maps = new Map();
	for (const row of uiMap) {
		const id = num(row.ID);
		if (id > 0) maps.set(id, row);
	}

	const byMap = new Map();
	for (const a of assignment) {
		const id = num(a.UiMapID);
		if (!maps.has(id)) continue;
		if (!byMap.has(id)) byMap.set(id, []);
		byMap.get(id).push(a);
	}

	const frames = {};
	const areaOf = new Map();
	for (const id of [...byMap.keys()].sort((x, y) => x - y)) {
		const list = byMap.get(id).slice().sort(compareAssignments);
		const area0 = list.find((a) => num(a.AreaID) > 0);
		if (area0) areaOf.set(id, num(area0.AreaID));
		const continents = new Set(list.map((a) => num(a.MapID)));
		if (continents.size > 1) {
			warnings.push(`uiMap ${id}: spans ${continents.size} continents (${[...continents].sort((x, y) => x - y).join(', ')}); no single Era frame`);
			continue;
		}
		const best = frameFromAssignment(list[0]);
		if (!best) {
			warnings.push(`uiMap ${id}: degenerate UiMin/UiMax`);
			continue;
		}
		for (const other of list.slice(1)) {
			const f = frameFromAssignment(other);
			if (!f) continue;
			const d = Math.max(Math.abs(f.left - best.left), Math.abs(f.right - best.right), Math.abs(f.top - best.top), Math.abs(f.bottom - best.bottom));
			if (d > 1) warnings.push(`uiMap ${id}: assignment ${other.ID} disagrees with ${list[0].ID} by ${d.toFixed(1)} yd`);
		}
		// Aspect 1.5 holds for world-system maps (System 0); taxi maps (System 1) are square.
		const problems = frameCheck(id, best, uiArea(list[0]) > 0.999 && num(maps.get(id).System) === 0);
		if (problems.length) {
			warnings.push(...problems);
			continue;
		}
		frames[id] = best;
	}

	const zones = {};
	for (const id of [...maps.keys()].sort((x, y) => x - y)) {
		const row = maps.get(id);
		const parent = num(row.ParentUiMapID);
		zones[id] = {
			id,
			name: row.Name_lang || '',
			areaId: areaOf.get(id) || null,
			parent: parent > 0 ? parent : null,
			type: num(row.Type),
		};
		// System 1: flight-map variants (Forever's 1463, 1464, 2665) that share a world map's name.
		if (num(row.System) !== 0) zones[id].system = num(row.System);
	}

	// AreaTable ID -> UiMapID. Direct assignments first (zone-level maps and
	// below beat continents); unassigned subzones walk ParentAreaID.
	const direct = new Map();
	for (const id of [...byMap.keys()].sort((x, y) => x - y)) {
		const type = zones[id].type;
		if (type < 3) continue;
		for (const a of byMap.get(id).slice().sort(compareAssignments)) {
			const aid = num(a.AreaID);
			if (aid > 0 && !direct.has(aid)) direct.set(aid, id);
		}
	}
	const parentArea = new Map();
	const areaNames = new Map();
	for (const row of area) {
		const aid = num(row.ID);
		parentArea.set(aid, num(row.ParentAreaID));
		areaNames.set(aid, row.AreaName_lang || row.ZoneName || '');
	}
	const memo = new Map();
	function resolveArea(areaId) {
		const start = num(areaId);
		if (memo.has(start)) return memo.get(start);
		let cur = start;
		let result = null;
		const seen = new Set();
		while (cur > 0 && !seen.has(cur)) {
			seen.add(cur);
			if (direct.has(cur)) {
				result = direct.get(cur);
				break;
			}
			cur = parentArea.get(cur) || 0;
		}
		memo.set(start, result);
		return result;
	}

	return { zones, frames, resolveArea, areaNames, warnings };
}

module.exports = { buildMaps, frameFromAssignment };
