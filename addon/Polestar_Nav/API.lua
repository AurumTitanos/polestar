-- Polestar_Nav's handoff to Polestar: the global Polestar_NavEngine is Shortest
-- Path Forever's Path table (Routing/), which Polestar's Nav keeps as
-- ns.Nav.Path. Its calls are upstream's: Find(map, from, to, callback,
-- waterWalking), FindCost, FindMany, Cancel(job), Busy(), with points in
-- UnitPosition's frame (x north, y west, z optional) and map the instance map
-- ID (0 Eastern Kingdoms, 1 Kalimdor, 2991 Zephras Isle). The maps of 0 and 1
-- are Polestar's own (`nav pack`, PACK.json: 128 cells a tile, 4.17 yd), 2991
-- is his. The engine reads only PolestarPathData, our own copy of the maps,
-- never an installed Shortest Path Forever's tables (its engine evicts
-- decoded entries while ours may be searching them). Added here:
--
--   Path.Available(map) -> true when walking routes can be found on that map
--
-- Memory ceilings (docs/ARCHITECTURE.md, "In-game walking routes"): his are
-- 24 MB of decoded grids and 4 MB of decoded graph, sized for his 8 yd cells.
-- Our 4.17 yd cells hold 3.7 times as many cells a tile: by the engine's own
-- accounting a cluster decodes to 3.3 MB on average (his: 1.0 MB): Razor
-- Hill to the Valley of Strength (through Orgrimmar, 4 clusters) decodes
-- 28.5 MB of grids, a 7,700 yd walk from the Crossroads to Tanaris 46.4 MB
-- in 17 clusters with 4.9 MB of graph; a continent's whole graph decodes to
-- 4.2 MB (Eastern Kingdoms) and 4.9 MB (Kalimdor). So 48 MB of grids holds
-- such a walk without evicting a cluster mid-search, and 6 MB of graph a
-- continent's whole graph. Both are ceilings: Idle drops the decoded grids
-- when no search is queued.
local _, ns = ...
local Path = ns.Path

Path.cacheKB = 48 * 1024
Path.graphKB = 6 * 1024

function Path.Available(map)
	return map ~= nil and Path.HasData(map)
end

Polestar_NavEngine = Path
