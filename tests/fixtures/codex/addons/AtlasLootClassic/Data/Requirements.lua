-- Synthetic fixture: the shape of the core requirements table.
local ALName, ALPrivate = ...

local AtlasLoot = _G.AtlasLoot
local Requirements = {}
AtlasLoot.Data.Requirements = Requirements
local bit_band = bit.band

local ReqData, ReqData_RAW = AtlasLoot:GetGameVersionDataTable()
ReqData_RAW.CLASSIC = {
	[940001] = { 1, 6 },
	[940002] = { 2 },
}

local PVP_RANK = {}
for i = 1, 14 do PVP_RANK[i] = { "H" .. i, "A" .. i, 136765 + i } end

function Requirements.ClassCanUseItem(classBit, itemID)
	return not ReqData[itemID] or bit_band(ReqData[itemID][1], classBit) ~= 0
end

function Requirements.GetPvPRankName(rank, faction)
	return PVP_RANK[rank][faction == "Horde" and 1 or 2]
end

function Requirements.GetPvPRankIcon(rank)
	return PVP_RANK[rank][3]
end

function Requirements.GetPvPRankIconForItem(itemID)
	if not ReqData[itemID] or not ReqData[itemID][2] then return end
	return PVP_RANK[ReqData[itemID][2]][3]
end
