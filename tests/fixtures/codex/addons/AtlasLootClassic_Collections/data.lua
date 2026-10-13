-- Synthetic fixture mimicking AtlasLoot's Collections layout (made-up ids).
local _G = getfenv(0)
local format = _G.string.format

local function C_Map_GetAreaInfo(id)
	local d = C_Map.GetAreaInfo(id)
	return d or ("GetAreaInfo" .. id)
end

local GetFactionInfoByID = GetFactionInfoByID or function(factionID) end

local addonname, private = ...
local AtlasLoot = _G.AtlasLoot
local data = AtlasLoot.ItemDB:Add(addonname, 1, 0)

local AL = AtlasLoot.Locales
local ALIL = AtlasLoot.IngameLocales
local GetForVersion = AtlasLoot.ReturnForGameVersion

local NORMAL_DIFF = data:AddDifficulty("NORMAL", nil, nil, nil, true)
local ALLIANCE_DIFF = data:AddDifficulty(FACTION_ALLIANCE, "alliance", nil, 1)
local HORDE_DIFF = data:AddDifficulty(FACTION_HORDE, "horde", nil, 1)

local NORMAL_ITTYPE = data:AddItemTableType("Item", "Item")
local SET_ITTYPE = data:AddItemTableType("Set", "Item")

local SET_CONTENT = data:AddContentType(AL["Sets"], ATLASLOOT_PVP_COLOR)
local COLLECTIONS_CONTENT = data:AddContentType(AL["Collections"], ATLASLOOT_COLLECTIONS_COLOR)

data["TierSets"] = {
	name = AL["Tier Sets"],
	ContentType = SET_CONTENT,
	TableType = SET_ITTYPE,
	items = {
		{ name = format(AL["Tier %s Sets"], "1"), [NORMAL_DIFF] = { { 1, 601 }, { 2, 602 } } },
	},
}

data["Mounts"] = {
	name = ALIL["Mounts"],
	ContentType = COLLECTIONS_CONTENT,
	TableType = NORMAL_ITTYPE,
	gameVersion = AtlasLoot.CLASSIC_VERSION_NUM,
	CorrespondingFields = private.MOUNTS,
	items = {
		{
			name = AL["Faction Mounts"],
			[ALLIANCE_DIFF] = {
				{ 1, 930001 },
				{ 2, 930002 },
				{ 3, 930009 },
			},
			[HORDE_DIFF] = {
				{ 1, 930003 },
				{ 2, GetForVersion(930004, 930099) },
				{ 3, 930009 },
				AtlasLoot:GameVersion_GE(AtlasLoot.BC_VERSION_NUM, { 4, 930098 }),
			},
		},
		{
			name = AL["Drops"],
			[NORMAL_DIFF] = {
				{ 1, "INV_Box_01", nil, AL["Rare"] },
				{ 2, 930005 },
			},
		},
	},
}

data["Companions"] = {
	name = ALIL["Companions"],
	ContentType = COLLECTIONS_CONTENT,
	TableType = NORMAL_ITTYPE,
	items = {
		{
			name = format(AL["%s Sets"], C_Map_GetAreaInfo(9003)),
			[NORMAL_DIFF] = { { 1, 930006 } },
		},
		{
			name = GetFactionInfoByID(9909),
			[NORMAL_DIFF] = { { 1, 930007 } },
		},
	},
}
