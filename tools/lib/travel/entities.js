'use strict';
// NPC/object lookups over data/forever/{npcs,objects}.json for the travel
// build: spawn points in world space, and lookups by exact name.

// Spawn points of an entity as { map, x, y, f, c, wx, wy }. Era-frame ("e")
// points convert through map-frames.json; live ("l") points through the live
// bounds recordings carry (liveFrames: Map uiMapID -> { c, left, right, top, bottom }).
function spawnPoints(entity, frames, liveFrames = new Map()) {
	const out = [];
	for (const [mapKey, s] of Object.entries((entity && entity.spawns) || {})) {
		const map = Number(mapKey);
		for (const [x, y] of s.pts || []) {
			let w = null;
			if (s.f === 'l') {
				const b = liveFrames.get(map);
				if (b) w = { c: b.c, wx: b.top + (b.bottom - b.top) * (y / 100), wy: b.left + (b.right - b.left) * (x / 100) };
			} else {
				w = frames.toWorld(map, x, y);
			}
			if (w) out.push({ map, x, y, f: s.f === 'l' ? 'l' : 'e', ...w });
		}
	}
	return out;
}

// name -> [entities] (exact, case-sensitive names as the client shows them),
// ids ascending so lookups are deterministic.
function indexByName(table) {
	const idx = new Map();
	const ids = Object.keys(table || {})
		.map(Number)
		.sort((a, b) => a - b);
	for (const id of ids) {
		const e = table[id];
		if (!e || !e.name) continue;
		if (!idx.has(e.name)) idx.set(e.name, []);
		idx.get(e.name).push(e);
	}
	return idx;
}

module.exports = { spawnPoints, indexByName };
