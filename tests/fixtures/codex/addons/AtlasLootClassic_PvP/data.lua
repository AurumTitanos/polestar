-- Synthetic fixture mimicking AtlasLoot's PvP layout (made-up ids).
local _G = getfenv(0)
local format = _G.string.format

local addonname, private = ...
local AtlasLoot = _G.AtlasLoot
local data = AtlasLoot.ItemDB:Add(addonname, 1, AtlasLoot.CLASSIC_VERSION_NUM)

local AL = AtlasLoot.Locales
local ALIL = AtlasLoot.IngameLocales

local NORMAL_DIFF = data:AddDifficulty(AL["Normal"], "n", 1, nil, true)
local ALLIANCE_DIFF = data:AddDifficulty(FACTION_ALLIANCE, "alliance", nil, 1)
local HORDE_DIFF = data:AddDifficulty(FACTION_HORDE, "horde", nil, 1)

local NORMAL_ITTYPE = data:AddItemTableType("Item", "Item")
local SET_ITTYPE = data:AddItemTableType("Set", "Item")
local ICON_ITTYPE = data:AddItemTableType("Dummy")

local PVP_CONTENT = data:AddContentType(AL["Battlegrounds"], ATLASLOOT_PVP_COLOR)
local GENERAL_CONTENT = data:AddContentType(GENERAL, ATLASLOOT_RAID40_COLOR)

local GetRankName, GetRankIcon = AtlasLoot.Data.Requirements.GetPvPRankName, AtlasLoot.Data.Requirements.GetPvPRankIcon
local PVP_RANKS = {
	name = AL["PvP Ranks"],
	TableType = ICON_ITTYPE,
	ExtraList = true,
	[NORMAL_DIFF] = {
		{ 1, 136782, FACTION_HORDE },
		{ 2, GetRankIcon(1), GetRankName(1, "Horde"), format(AL["Rank %s"], 1) },
	},
}

data["FixtureGulch"] = {
	MapID = 9004,
	ContentType = PVP_CONTENT,
	items = {
		{
			name = _G["FACTION_STANDING_LABEL8"],
			[ALLIANCE_DIFF] = {
				{ 1, "f9601rep8" },
				{ 2, 960001 },
				{ 3, 960003 },
			},
			[HORDE_DIFF] = {
				{ 1, "f9602rep8" },
				{ 2, 960002 },
				{ 3, 960003 },
			},
		},
	},
}

data["ClassSets"] = {
	name = AL["Class Sets"],
	ContentType = GENERAL_CONTENT,
	TableType = SET_ITTYPE,
	items = {
		{
			name = ALIL["Epic"],
			[ALLIANCE_DIFF] = {
				{ 1, 701 },
				{ 2, 703 },
			},
			[HORDE_DIFF] = {
				{ 1, 702 },
				{ 2, 703 },
			},
		},
		PVP_RANKS,
	},
}

data["PvPMounts"] = {
	name = ALIL["Mounts"],
	ContentType = GENERAL_CONTENT,
	CorrespondingFields = private.MOUNTS_LINK,
	items = {
		{
			name = ALIL["Mounts"],
			[ALLIANCE_DIFF] = { { 1, 940001 } },
			[HORDE_DIFF] = { { 1, 940002 } },
		},
		PVP_RANKS,
	},
}
