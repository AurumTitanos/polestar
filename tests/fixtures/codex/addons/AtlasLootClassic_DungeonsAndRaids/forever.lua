-- Synthetic fixture: a stale Forever file outside the TOC (uses LTNX without defining it).
local _G = getfenv(0)
local addonname = ...
local AtlasLoot = _G.AtlasLoot
local data = AtlasLoot.ItemDB:Add(addonname, 1, AtlasLoot.CLASSIC_VERSION_NUM)

local NORMAL_DIFF = data:AddDifficulty("NORMAL", nil, nil, nil, true)
local FOREVER_DUNGEON_CONTENT = data:AddContentType("Forever Dungeons", { 0.3, 0.5, 0.7, 1 })

data["FixtureHollow"] = {
	name = "Fixture Hollow (old)" .. LTNX,
	ContentType = FOREVER_DUNGEON_CONTENT,
	LoadDifficulty = NORMAL_DIFF,
	items = { { name = "Old Boss", [NORMAL_DIFF] = { { 1, 900097 } } } },
}

data["FixtureSpire"] = {
	name = "Fixture Spire" .. LTNX,
	ContentType = FOREVER_DUNGEON_CONTENT,
	LoadDifficulty = NORMAL_DIFF,
	LevelRange = { 40, 44, 48 },
	items = { { name = "Spire Boss", [NORMAL_DIFF] = { { 1, 900014 } } } },
}
