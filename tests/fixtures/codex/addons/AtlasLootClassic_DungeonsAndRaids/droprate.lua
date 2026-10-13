local Droprate = _G.AtlasLoot.Data.Droprate
--##START-DATA##
local DropRateData = {
	[900101] = {
		[900001] = 12.5,
		[900002] = 3.25
	},
	[900103] = {
		[900006] = 40
	},
	[900105] = {
		[900012] = 7.5
	},
}
--##END-DATA##

if (AtlasLoot.Data.ContentPhase:GetActivePhase() < 5) then
	DropRateData[900101][900001] = 99
end

Droprate:AddData(DropRateData)
DropRateData = nil
