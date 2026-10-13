-- Synthetic fixture: a later-expansion file the Classic client skips.
local _G = getfenv(0)
local addonname = ...
local AtlasLoot = _G.AtlasLoot
if AtlasLoot:GameVersion_LT(AtlasLoot.BC_VERSION_NUM) then return end
local data = AtlasLoot.ItemDB:Add(addonname, 2, AtlasLoot.BC_VERSION_NUM)

data["FixtureOutland"] = {
	name = "Fixture Outland",
	items = { { name = "Outland Boss", [1] = { { 1, 900098 } } } },
}
