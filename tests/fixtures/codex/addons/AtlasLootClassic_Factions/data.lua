-- Synthetic fixture mimicking AtlasLoot's Factions layout (made-up ids).
local _G = getfenv(0)
local format = _G.string.format

local addonname = ...
local AtlasLoot = _G.AtlasLoot
local data = AtlasLoot.ItemDB:Add(addonname, 1, 1)

local AL = AtlasLoot.Locales
local ALIL = AtlasLoot.IngameLocales

local NORMAL_DIFF = data:AddDifficulty(AL["Normal"], "n", 1, nil, true)
local ALLIANCE_DIFF = data:AddDifficulty(FACTION_ALLIANCE, "alliance", nil, 1)
local HORDE_DIFF = data:AddDifficulty(FACTION_HORDE, "horde", nil, 1)

local NORMAL_ITTYPE = data:AddItemTableType("Item", "Item")
local PRICE_EXTRA_ITTYPE = data:AddExtraItemTableType("Price")
local FACTIONS_CONTENT = data:AddContentType(AL["Factions"], ATLASLOOT_FACTION_COLOR)

data["FixtureWardens"] = {
	FactionID = 9501,
	ContentType = FACTIONS_CONTENT,
	items = {
		{ -- Exalted
			name = ALIL["Exalted"],
			[NORMAL_DIFF] = {
				{ 1, "f9501rep8" },
				{ 2, 950001 },
				{ 17, 950002, 950003, [ATLASLOOT_IT_AMOUNT1] = format("%d", 5) },
			},
		},
		{ -- Honored
			name = ALIL["Honored"],
			[NORMAL_DIFF] = {
				{ 1, "f9501rep6" },
				{ 2, 950004, [PRICE_EXTRA_ITTYPE] = "money:900" },
			},
		},
	},
}

data["FixtureTraders"] = {
	FactionID = 9502,
	ContentType = FACTIONS_CONTENT,
	items = {
		{ -- Friendly, no header row: standing comes from the section name
			name = ALIL["Friendly"],
			[ALLIANCE_DIFF] = {
				{ 1, 950005 },
			},
			[HORDE_DIFF] = {
				{ 1, 950006 },
			},
		},
	},
}
