'use strict';
// Hearthstone destinations: the bind location the client reports
// (GetBindLocation: the AreaTable name of the area the inn stands in) -> the
// innkeeper there.
//
// Names are curated from Blizzard's Classic Era AreaTable (wago.tools); where
// the inn has its own area (Thunderbrew Distillery in Kharanos, Stoutlager Inn
// in Thelsamar, Gallows' End Tavern in Brill, Deepwater Tavern in Menethil)
// both names are listed, since which one the server reports is only
// observable in game. The runtime also
// learns the pairing itself whenever the player binds (HEARTHSTONE_BOUND next
// to an innkeeper). The innkeeper and its position come from
// data/forever/npcs.json (role "innkeeper"), and each must spawn on the map
// listed here or the inn is dropped with a warning.
//
// Each inn also gets its `area`: the AreaTable area (the newest cached
// Forever build, tools/lib/data/areas.js) of its first name that names one
// in the inn's zone. The addon compares the bind location with that area's
// name in the client's language (C_Map.GetAreaInfo), so an inn is known on
// every client, not only on English ones.

const { round } = require('./geo');
const { spawnPoints } = require('./entities');
const { areaNamed } = require('../data/areas');

// [bind location names (first = display), uiMapID, innkeeper NPC id]
const INNS = [
	[['Goldshire'], 1429, 295],
	[['Thunderbrew Distillery', 'Kharanos'], 1426, 1247],
	[['Deepwater Tavern', 'Menethil Harbor'], 1437, 1464],
	[['Southshore'], 1424, 2352],
	[['Tarren Mill'], 1424, 2388],
	[['The Crossroads', 'Crossroads'], 1413, 3934],
	[['Ironforge'], 1455, 5111],
	[["Gallows' End Tavern", 'Brill'], 1420, 5688],
	[["Grom'gol Base Camp"], 1434, 5814],
	[['Theramore Isle'], 1445, 6272],
	[['Lakeshire'], 1433, 6727],
	[['Stoutlager Inn', 'Thelsamar'], 1432, 6734],
	[["Craftsmen's Terrace", 'Darnassus'], 1457, 6735],
	[['Dolanaar'], 1438, 6736],
	[['Auberdine'], 1439, 6737],
	[['Astranaar'], 1440, 6738],
	[['The Sepulcher'], 1421, 6739],
	[['Stormwind City'], 1453, 6740],
	[['Undercity'], 1458, 6741],
	[['Thunder Bluff'], 1456, 6746],
	[['Bloodhoof Village'], 1412, 6747],
	[['Darkshire'], 1431, 6790],
	[['Ratchet'], 1413, 6791],
	[['Booty Bay'], 1434, 6807],
	[['Razor Hill'], 1411, 6928],
	[['Orgrimmar'], 1454, 6929],
	[['Stonard'], 1435, 6930],
	[['Camp Taurajo'], 1413, 7714],
	[['Sun Rock Retreat'], 1442, 7731],
	[['Gadgetzan'], 1446, 7733],
	[['Feathermoon Stronghold'], 1444, 7736],
	[['Camp Mojache'], 1444, 7737],
	[['Aerie Peak', 'Wildhammer Keep'], 1425, 7744],
	[['Sentinel Hill'], 1436, 8931],
	[['Kargath'], 1418, 9356],
	[['Hammerfall'], 1417, 9501],
	[["Nijel's Point"], 1443, 11103],
	[['Shadowprey Village'], 1443, 11106],
	[['Freewind Post'], 1441, 11116],
	[['Everlook'], 1452, 11118],
	[['Splintertree Post'], 1440, 12196],
	[['Revantusk Village'], 1425, 14731],
	[['Cenarion Hold'], 1451, 15174],
	[["Light's Hope Chapel"], 1423, 16256],
	[['Stonetalon Peak'], 1442, 16458],
];

// areas: loadAreas() (tools/lib/data/areas.js) or null; zones: zones.json.
function buildInns({ frames, npcs, liveFrames, areas = null, zones = {} }) {
	const warnings = [];
	const inns = [];
	for (const [names, map, npcId] of INNS) {
		const location = names[0];
		const npc = npcs[String(npcId)];
		if (!npc) {
			warnings.push(`inn ${location}: innkeeper ${npcId} not in npcs.json`);
			continue;
		}
		if (!(npc.roles || []).includes('innkeeper')) warnings.push(`inn ${location}: npc ${npcId} "${npc.name}" lacks the innkeeper role`);
		const pts = spawnPoints(npc, frames, liveFrames).filter((p) => p.map === map);
		if (!pts.length) {
			warnings.push(`inn ${location}: ${npc.name} (${npcId}) does not spawn on map ${map} (${frames.name(map)})`);
			continue;
		}
		const p = pts[0];
		const zone = zones[String(map)];
		const area = areas ? names.map((n) => areaNamed(areas, n, zone && zone.areaId)).find(Boolean) : null;
		if (areas && !area) warnings.push(`inn ${location}: no AreaTable area named ${names.map((n) => `"${n}"`).join(' or ')} in ${frames.name(map)}; the addon matches it by name only`);
		inns.push({
			location,
			names: [...names],
			...(area ? { area: area.id } : {}),
			npc: npcId,
			npcName: npc.name,
			c: p.c,
			wx: round(p.wx, 1),
			wy: round(p.wy, 1),
			map: p.map,
			x: p.x,
			y: p.y,
			f: p.f,
		});
	}
	inns.sort((a, b) => (a.location < b.location ? -1 : a.location > b.location ? 1 : 0));
	return { inns, warnings };
}

module.exports = { buildInns, INNS };
