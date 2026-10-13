-- Synthetic fixture: the shape of the core craft-spell table.
local ALName, ALPrivate = ...

local AtlasLoot = _G.AtlasLoot
local Profession = {}
AtlasLoot.Data.Profession = Profession
local ALIL = AtlasLoot.IngameLocales

local PROFESSION_NAME = { [1] = ALIL["Alchemy"] }
local ICON = C_Spell.GetSpellTexture(1)

local PROFESSION, PROFESSION_DATA = AtlasLoot:GetGameVersionDataTable()
PROFESSION_DATA.CLASSIC = {
	-- [spellID] = { createdItemID, prof, minLvl, lowLvl, highLvl, reagents{}, reagentsCount{} }
	[910001] = { 920001, 1, 150, 165, 185, { 920100 }, { 2 } },
	[910002] = { nil, 1, 275, 290, 310, { 920101 }, { 1 } },
}

local function OnInit() end
AtlasLoot:AddInitFunc(OnInit)

function Profession.GetProfessionData(spellID)
	return PROFESSION[spellID]
end

function Profession.GetColorSkillRankNoSpell(min, low, high)
	return tostring(min)
end
