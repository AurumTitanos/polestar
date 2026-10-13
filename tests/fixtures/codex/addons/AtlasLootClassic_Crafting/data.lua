-- Synthetic fixture mimicking AtlasLoot's Crafting layout (made-up ids).
local _G = getfenv(0)
local format = _G.string.format
local RAID_CLASS_COLORS = _G["RAID_CLASS_COLORS"]

local addonname, private = ...
local AtlasLoot = _G.AtlasLoot
local data = AtlasLoot.ItemDB:Add(addonname, 1, AtlasLoot.CLASSIC_VERSION_NUM)

local GetColorSkill = AtlasLoot.Data.Profession.GetColorSkillRankNoSpell
local AL = AtlasLoot.Locales
local ALIL = AtlasLoot.IngameLocales

local NORMAL_DIFF = data:AddDifficulty(AL["Normal"], "n", 1, nil, true)
local NORMAL_ITTYPE = data:AddItemTableType("Item", "Item")
local PROF_ITTYPE = data:AddItemTableType("Profession", "Item")
local PROF_CONTENT = data:AddContentType(ALIL["Professions"], ATLASLOOT_PRIMPROFESSION_COLOR)

data["Alchemy"] = {
	name = ALIL["Alchemy"],
	ContentType = PROF_CONTENT,
	TableType = PROF_ITTYPE,
	CorrespondingFields = private.ALCHEMY_LINK,
	items = {
		{
			name = AL["Potions"],
			SkillText = GetColorSkill(1, 2, 3),
			[NORMAL_DIFF] = {
				{ 1, "INV_sword_04", nil, ALIL["Potions"] },
				{ 2, 910001 },
				{ 3, 910002 },
				{ 4, 910003 },
			},
		},
	},
}

data["Herbalism"] = {
	name = ALIL["Herbalism"],
	ContentType = PROF_CONTENT,
	TableType = NORMAL_ITTYPE,
	items = {
		{
			name = AL["Apprentice"],
			[NORMAL_DIFF] = {
				{ 1, 920201, 920202 },
			},
		},
	},
}

data["RoguePoisons"] = {
	name = format("|c%s%s|r", RAID_CLASS_COLORS["ROGUE"].colorStr, ALIL["ROGUE"]),
	ContentType = PROF_CONTENT,
	TableType = PROF_ITTYPE,
	items = { { name = ALIL["Poisons"], [NORMAL_DIFF] = {} } },
}
