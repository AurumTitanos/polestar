-- Synthetic fixture mimicking AtlasLoot's DungeonsAndRaids layout (made-up ids).
if C_Seasons and C_Seasons.GetActiveSeason and C_Seasons.GetActiveSeason() == 2 then return end

local _G = getfenv(0)
local format = _G.string.format

local addonname = ...
local AtlasLoot = _G.AtlasLoot
local data = AtlasLoot.ItemDB:Add(addonname, 1, AtlasLoot.CLASSIC_VERSION_NUM)

local AL = AtlasLoot.Locales
local GetForVersion = AtlasLoot.ReturnForGameVersion

local NORMAL_DIFF = data:AddDifficulty("NORMAL", nil, nil, nil, true)
local FOREVER_DUNGEON_CONTENT = data:AddContentType("Forever Dungeons", { 0.3, 0.5, 0.7, 1 })
local LTNX = "|cffffffff|TInterface\\AddOns\\AtlasLootClassic\\ltn4.tga:18:18:2:0|t|r"

local ALLIANCE_DIFF, HORDE_DIFF, LOAD_DIFF
if UnitFactionGroup("player") == "Horde" then
	HORDE_DIFF = data:AddDifficulty(FACTION_HORDE, "horde", nil, 1)
	ALLIANCE_DIFF = data:AddDifficulty(FACTION_ALLIANCE, "alliance", nil, 1)
	LOAD_DIFF = HORDE_DIFF
else
	ALLIANCE_DIFF = data:AddDifficulty(FACTION_ALLIANCE, "alliance", nil, 1)
	HORDE_DIFF = data:AddDifficulty(FACTION_HORDE, "horde", nil, 1)
	LOAD_DIFF = ALLIANCE_DIFF
end

local NORMAL_ITTYPE = data:AddItemTableType("Item", "Item")
local SET_ITTYPE = data:AddItemTableType("Set", "Item")

local QUEST_EXTRA_ITTYPE = data:AddExtraItemTableType("Quest")
local PRICE_EXTRA_ITTYPE = data:AddExtraItemTableType("Price")

local DUNGEON_CONTENT = data:AddContentType(AL["Dungeons"], ATLASLOOT_DUNGEON_COLOR)
local RAID40_CONTENT = data:AddContentType(AL["40 Raids"], ATLASLOOT_RAID40_COLOR)

local KEYS = {
	name = AL["Keys"],
	TableType = NORMAL_ITTYPE,
	ExtraList = true,
	IgnoreAsSource = true,
	[NORMAL_DIFF] = {
		{ 1, "INV_Box_01", nil, AL["Key"], nil },
		{ 2, 900901 },
	},
}

local SETS = {
	name = format(AL["Tier %s Sets"], "1"),
	ExtraList = true,
	TableType = SET_ITTYPE,
	[ALLIANCE_DIFF] = {
		{ 1, 501 },
	},
	[HORDE_DIFF] = {
		GetItemsFromDiff = ALLIANCE_DIFF,
		{ 2, 502 },
	},
}

data["FixtureKeep"] = {
	name = C_Map.GetAreaInfo(9001) .. LTNX,
	MapID = 9001,
	InstanceID = 901,
	ContentType = DUNGEON_CONTENT,
	LoadDifficulty = NORMAL_DIFF,
	LevelRange = GetForVersion({ 20, 24, 30 }, { 18, 22, 28 }),
	items = {
		{ -- FKWarden
			name = AL["Warden Fixture"],
			npcID = 900101,
			Level = 26,
			[NORMAL_DIFF] = {
				{ 1, "INV_Box_01", nil, AL["Misc"], nil },
				{ 2, 900001 },
				{ 3, 900002, [QUEST_EXTRA_ITTYPE] = 990001 },
				{ 4, 900003, [PRICE_EXTRA_ITTYPE] = "money:2500" },
				{ 5, [ATLASLOOT_IT_HORDE] = 900004, [ATLASLOOT_IT_ALLIANCE] = 900005 },
				{ 6, 0, "INV_Misc_QuestionMark", "Loot will be updated asap!", "" },
			},
		},
		{ -- FKTwins
			name = AL["Fixture Twins"],
			npcID = { 900102, 900103 },
			[NORMAL_DIFF] = {
				{ 1, 900006 },
				{ 2, 900007 },
			},
		},
		{ -- FKChest
			name = AL["Fixture Cache"],
			npcID = 900104,
			ObjectID = 900201,
			[ALLIANCE_DIFF] = {
				{ 1, 900008 },
				{ 2, 900009 },
				{ 3, 900010 },
			},
			[HORDE_DIFF] = {
				GetItemsFromDiff = ALLIANCE_DIFF,
				{ 2, 900011 },
				{ 3 },
			},
		},
		KEYS,
		SETS,
		AtlasLoot:GameVersion_GE(AtlasLoot.BC_VERSION_NUM, { name = AL["Burning Boss"], [NORMAL_DIFF] = { { 1, 900099 } } }),
	},
}

data["FixtureCore"] = {
	name = AL["Fixture Core"],
	MapID = 9002,
	ContentType = RAID40_CONTENT,
	LoadDifficulty = NORMAL_DIFF,
	ContentPhase = 3,
	items = {
		{
			name = AL["Fixture Lord"],
			npcID = 900105,
			[NORMAL_DIFF] = {
				{ 1, 900012 },
			},
		},
	},
}

data["FixtureHollow"] = {
	name = "Fixture Hollow" .. LTNX,
	ContentType = FOREVER_DUNGEON_CONTENT,
	LoadDifficulty = NORMAL_DIFF,
	LevelRange = { 12, 15, 20 },
	items = {
		{
			name = "Fixture Hollow Boss",
			[NORMAL_DIFF] = {
				{ 1, 900013 },
			},
		},
		{
			name = "Loot will be updated asap! Data mining is not yet fully possible!",
			[NORMAL_DIFF] = {},
		},
	},
}

-- UI code the real file carries after its tables.
local watcher = CreateFrame("Frame")
watcher:SetScript("OnUpdate", function(self, delta)
	local btn = _G["AtlasLoot-DropDown-Button1"]
	if btn then hooksecurefunc(btn, "SetText", function() end) end
end)
