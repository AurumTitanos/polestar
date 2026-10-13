-------------------------------------------------------------------------------
-- Synthetic fixture (made-up ids).
-------------------------------------------------------------------------------
local FOLDER_NAME, private = ...

private.NPC_INFO = {
	[970001] = { zoneID = 1401, artID = { 11 }, x = 4125, y = 6050, overlay = { "4100-6000","4125-6050" }, displayID = 1 }; --one map
	[970002] = { zoneID = {
				[1402] = { x = 1000, y = 2000, artID = { 12 }, overlay = { "1000-2000" } };
				[1403] = { x = 0.5, y = 0.25, artID = { 13 } };
			  }, displayID = 2 }; --two maps
	[970003] = { zoneID = 0, displayID = 3 }; --no position
	[970004] = { zoneID = 1404, artID = { 14 }, overlay = { "70007500" } }; --position only in overlay
}
