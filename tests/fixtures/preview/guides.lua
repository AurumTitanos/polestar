-- The Horde road from Durotar through the Barrens to Stonetalon Mountains, as
-- `compile` built it at 1990760: the six -- Source blocks of
-- addon/Polestar_Guides/Guides.lua, copied unchanged. The guide menu scenes of
-- `node tools/polestar.js preview` load these instead of the shipped guides, so
-- docs/preview changes only with the UI, never with a recompile. Copy the
-- blocks again when the compiled guide shape changes.

-- Source: forever/horde/orc-troll/01-durotar.guide
do
	local function register()
		Polestar.RegisterGuide({
			id = "forever/horde/orc-troll/01-durotar",
			pack = "guides",
			title = "Durotar",
			faction = "Horde",
			races = { "Orc", "Troll" },
			minLevel = 1,
			maxLevel = 12,
			category = "Leveling",
			zone = 1411,
			zoneName = "Durotar",
			next = "forever/horde/orc-troll/02-the-barrens",
			author = "Polestar",
			version = 1,
			steps = {
				{
					title = "Kaltunk",
					goals = {
						{ t = "accept", quest = 4641, title = "Your Place In The World", npc = 10176, npcName = "Kaltunk", minLevel = 1, qlvl = 1, closedBy = { 788 }, preTitles = { [788] = "Cutting Teeth" }, map = 1411, x = 43.29, y = 68.53, f = "e", note = "Kaltunk, where you start" },
					},
				},
				{
					title = "Gornek",
					note = "Gornek waits inside the Den, the building just west of Kaltunk.",
					goals = {
						{ t = "turnin", quest = 4641, title = "Your Place In The World", npc = 3143, npcName = "Gornek", map = 1411, x = 42.06, y = 68.33, f = "e" },
						{ t = "accept", quest = 788, title = "Cutting Teeth", npc = 3143, npcName = "Gornek", minLevel = 1, qlvl = 2, map = 1411, x = 42.06, y = 68.33, f = "e" },
						{ t = "accept", quest = 97279, title = "Wayward Weapons", npc = 3143, npcName = "Gornek", minLevel = 1, qlvl = 2, map = 1411, x = 42.06, y = 68.33, f = "e" },
					},
				},
				{
					title = "Training weapons and boars",
					note = "The weapons lie around the Den and the training grounds; the Mottled Boars roam the whole valley floor.",
					goals = {
						{ t = "collect", quest = 97279, title = "Wayward Weapons", item = 277653, itemName = "Abandoned Training Weapon", count = 6, oi = 1, map = 1411, x = 44, y = 67.2, f = "e", spots = { { x = 44.4, y = 66.6, r = 45, n = 4 }, { x = 45, y = 64.9, r = 38, n = 3 }, { x = 44.3, y = 70.8, r = 21, n = 2 }, { x = 42.3, y = 63.8, r = 26, n = 2 }, { x = 45.3, y = 63.1, r = 20, n = 2 }, { x = 43.8, y = 62.6, r = 43, n = 3 }, { x = 45.3, y = 71.2, r = 15, n = 1, alt = true }, { x = 43.6, y = 72.4, r = 54, n = 4, alt = true }, { x = 41.4, y = 71.6, r = 39, n = 3, alt = true }, { x = 40.9, y = 63.2, r = 33, n = 3, alt = true }, { x = 45.6, y = 60.6, r = 48, n = 3, alt = true }, { x = 47.1, y = 61.7, r = 15, n = 1, alt = true } } },
						{ t = "kill", quest = 788, title = "Cutting Teeth", target = "Mottled Boar", npc = 3098, count = 10, oi = 1, map = 1411, x = 44.49, y = 65.1, f = "e", spots = { { x = 45, y = 65.7, r = 56, n = 8 }, { x = 44.2, y = 63.6, r = 50, n = 7 }, { x = 46.2, y = 66.6, r = 27, n = 3 }, { x = 45.7, y = 62.6, r = 55, n = 6 }, { x = 42.4, y = 64.3, r = 67, n = 8 }, { x = 46.8, y = 64.6, r = 25, n = 2 }, { x = 44.5, y = 60.7, r = 51, n = 7, alt = true }, { x = 46.1, y = 69, r = 53, n = 4, alt = true }, { x = 42.7, y = 61.2, r = 51, n = 7, alt = true }, { x = 44.3, y = 71.2, r = 54, n = 6, alt = true }, { x = 42.4, y = 72.1, r = 56, n = 6, alt = true } } },
					},
				},
				{
					title = "Kzan Thornslash",
					note = "Kzan stands behind the Den, on its west side.",
					goals = {
						{ t = "turnin", quest = 97279, title = "Wayward Weapons", npc = 3159, npcName = "Kzan Thornslash", map = 1411, x = 40.47, y = 68, f = "e" },
					},
				},
				{
					title = "Hana'zua",
					note = "Hana'zua lies wounded at the foot of the hills north-west of the Den.",
					goals = {
						{ t = "accept", quest = 790, title = "Sarkoth", npc = 3287, npcName = "Hana'zua", minLevel = 1, qlvl = 5, map = 1411, x = 40.6, y = 62.58, f = "e" },
					},
				},
				{
					title = "Sarkoth",
					note = "Sarkoth, a large scorpid, prowls the slope south of Hana'zua.",
					goals = {
						{ t = "collect", quest = 790, title = "Sarkoth", item = 4905, itemName = "Sarkoth's Mangled Claw", oi = 1, map = 1411, x = 40.5, y = 66.83, f = "e" },
						{ t = "kill", quest = 788, title = "Cutting Teeth", target = "Mottled Boar", npc = 3098, count = 10, oi = 1, map = 1411, x = 41.27, y = 65.1, f = "e", spots = { { x = 42.4, y = 64.3, r = 67, n = 8 }, { x = 42.7, y = 61.2, r = 51, n = 7 }, { x = 44.2, y = 63.6, r = 50, n = 7 }, { x = 45, y = 65.7, r = 56, n = 8 }, { x = 44.5, y = 60.7, r = 51, n = 7 }, { x = 45.7, y = 62.6, r = 55, n = 6 }, { x = 42.4, y = 72.1, r = 56, n = 6, alt = true }, { x = 46.2, y = 66.6, r = 27, n = 3, alt = true }, { x = 44.3, y = 71.2, r = 54, n = 6, alt = true }, { x = 46.1, y = 69, r = 53, n = 4, alt = true }, { x = 46.8, y = 64.6, r = 25, n = 2, alt = true } } },
					},
				},
				{
					title = "Hana'zua",
					goals = {
						{ t = "turnin", quest = 790, title = "Sarkoth", npc = 3287, npcName = "Hana'zua", map = 1411, x = 40.6, y = 62.58, f = "e" },
						{ t = "accept", quest = 804, title = "Sarkoth", npc = 3287, npcName = "Hana'zua", minLevel = 1, qlvl = 5, pre = { 790 }, preTitles = { [790] = "Sarkoth" }, map = 1411, x = 40.6, y = 62.58, f = "e" },
					},
				},
				{
					title = "The Den",
					goals = {
						{ t = "turnin", quest = 804, title = "Sarkoth", npc = 3143, npcName = "Gornek", map = 1411, x = 42.06, y = 68.33, f = "e", note = "Gornek" },
						{ t = "turnin", quest = 788, title = "Cutting Teeth", npc = 3143, npcName = "Gornek", map = 1411, x = 42.06, y = 68.33, f = "e" },
						{ t = "accept", quest = 789, title = "Sting of the Scorpid", npc = 3143, npcName = "Gornek", minLevel = 1, qlvl = 3, pre = { 788 }, preTitles = { [788] = "Cutting Teeth" }, map = 1411, x = 42.06, y = 68.33, f = "e" },
						{ t = "accept", quest = 4402, title = "Galgar's Cactus Apple Surprise", npc = 9796, npcName = "Galgar", minLevel = 1, qlvl = 3, pre = { 788 }, preTitles = { [788] = "Cutting Teeth" }, map = 1411, x = 42.73, y = 67.23, f = "e", note = "Galgar, by the cooking fire" },
						{ t = "accept", quest = 792, title = "Vile Familiars", npc = 3145, npcName = "Zureetha Fargaze", minLevel = 2, qlvl = 4, map = 1411, x = 42.85, y = 69.15, f = "e", only = { classes = { "WARRIOR", "PALADIN", "HUNTER", "ROGUE", "PRIEST", "SHAMAN", "MAGE", "DRUID" } }, note = "Zureetha Fargaze" },
						{ t = "accept", quest = 1485, title = "Vile Familiars", npc = 5765, npcName = "Ruzan", minLevel = 1, qlvl = 4, closedBy = { 1470 }, preTitles = { [1470] = "Piercing the Veil" }, map = 1411, x = 42.59, y = 69, f = "e", only = { classes = { "WARLOCK" } }, note = "Ruzan" },
						{ t = "train", class = true, candidates = { { npc = 5884, npcName = "Mai'ah", map = 1411, x = 42.51, y = 69.04, f = "e", faction = "H", classes = { "MAGE" } }, { npc = 3157, npcName = "Shikrik", map = 1411, x = 42.39, y = 69, f = "e", faction = "H", classes = { "SHAMAN" } }, { npc = 3707, npcName = "Ken'jai", map = 1411, x = 42.36, y = 68.81, f = "e", faction = "H", classes = { "PRIEST" } }, { npc = 3154, npcName = "Jen'shan", map = 1411, x = 42.84, y = 69.33, f = "e", faction = "H", classes = { "HUNTER" } }, { npc = 3153, npcName = "Frang", map = 1411, x = 42.89, y = 69.44, f = "e", faction = "H", classes = { "WARRIOR" } }, { npc = 3155, npcName = "Rwag", map = 1411, x = 41.28, y = 68, f = "e", faction = "H", classes = { "ROGUE" } }, { npc = 3156, npcName = "Nartok", map = 1411, x = 40.65, y = 68.52, f = "e", faction = "H", classes = { "WARLOCK" } }, { npc = 5880, npcName = "Un'Thuwa", map = 1411, x = 56.31, y = 75.11, f = "e", faction = "H", classes = { "MAGE" } }, { npc = 3170, npcName = "Kaplak", map = 1411, x = 51.98, y = 43.69, f = "e", faction = "H", classes = { "ROGUE" } }, { npc = 3171, npcName = "Thotar", map = 1411, x = 51.85, y = 43.49, f = "e", faction = "H", classes = { "HUNTER" } }, { npc = 3706, npcName = "Tai'jin", map = 1411, x = 54.26, y = 42.93, f = "e", faction = "H", classes = { "PRIEST" } }, { npc = 3169, npcName = "Tarshaw Jaggedscar", map = 1411, x = 54.19, y = 42.47, f = "e", faction = "H", classes = { "WARRIOR" } }, { npc = 3173, npcName = "Swart", map = 1411, x = 54.42, y = 42.59, f = "e", faction = "H", classes = { "SHAMAN" } }, { npc = 3172, npcName = "Dhugru Gorelust", map = 1411, x = 54.38, y = 41.2, f = "e", faction = "H", classes = { "WARLOCK" } }, { npc = 6018, npcName = "Ur'kyo", map = 1454, x = 35.59, y = 87.82, f = "e", faction = "H", classes = { "PRIEST" } }, { npc = 7311, npcName = "Uthel'nay", map = 1454, x = 39.16, y = 86.27, f = "e", faction = "H", classes = { "MAGE" } }, { npc = 3328, npcName = "Ormok", map = 1454, x = 43.9, y = 54.63, f = "e", faction = "H", classes = { "ROGUE" } }, { npc = 3325, npcName = "Mirket", map = 1454, x = 48.62, y = 46.95, f = "e", faction = "H", classes = { "WARLOCK" } }, { npc = 3344, npcName = "Kardris Dreamseeker", map = 1454, x = 38.8, y = 36.37, f = "e", faction = "H", classes = { "SHAMAN" } }, { npc = 3354, npcName = "Sorek", map = 1454, x = 80.39, y = 32.38, f = "e", faction = "H", classes = { "WARRIOR" } }, { npc = 3406, npcName = "Xor'juul", map = 1454, x = 67.24, y = 20.2, f = "e", faction = "H", classes = { "HUNTER" } }, { npc = 3034, npcName = "Sheal Runetotem", map = 1456, x = 77.14, y = 27.02, f = "e", faction = "H", classes = { "DRUID" } }, { npc = 3040, npcName = "Urek Thunderhorn", map = 1456, x = 59.13, y = 86.87, f = "e", faction = "H", classes = { "HUNTER" } }, { npc = 3063, npcName = "Krang Stonehoof", map = 1412, x = 48.35, y = 63.74, faction = "H", classes = { "WARRIOR" } }, { npc = 3065, npcName = "Yaw Sharpmane", map = 1412, x = 46.93, y = 59.65, faction = "H", classes = { "HUNTER" } }, { npc = 3043, npcName = "Ker Ragetotem", map = 1456, x = 57.58, y = 85.5, f = "e", faction = "H", classes = { "WARRIOR" } }, { npc = 3066, npcName = "Narm Skychaser", map = 1412, x = 47.4, y = 62.54, faction = "H", classes = { "SHAMAN" } }, { npc = 3064, npcName = "Gennia Runetotem", map = 1412, x = 47.48, y = 62.95, faction = "H", classes = { "DRUID" } }, { npc = 3048, npcName = "Ursyn Ghull", map = 1456, x = 25.7, y = 14.19, f = "e", faction = "H", classes = { "MAGE" } }, { npc = 246344, npcName = "Alodan the Hopeful", map = 1456, x = 25.6, y = 14.8, f = "e", faction = "H", classes = { "PALADIN" } }, { npc = 3046, npcName = "Father Cobb", map = 1456, x = 25.64, y = 20.7, f = "e", faction = "H", classes = { "PRIEST" } }, { npc = 3031, npcName = "Tigor Skychaser", map = 1456, x = 23.64, y = 18.79, f = "e", faction = "H", classes = { "SHAMAN" } }, { npc = 3060, npcName = "Gart Mistrunner", map = 1412, x = 44.65, y = 76.55, faction = "H", classes = { "DRUID" } }, { npc = 3062, npcName = "Meela Dawnstrider", map = 1412, x = 44.58, y = 76.56, faction = "H", classes = { "SHAMAN" } }, { npc = 3061, npcName = "Lanka Farshot", map = 1412, x = 43.96, y = 76.35, faction = "H", classes = { "HUNTER" } }, { npc = 3059, npcName = "Harutt Thunderhorn", map = 1412, x = 43.75, y = 76.72, faction = "H", classes = { "WARRIOR" } }, { npc = 2119, npcName = "Dannal Stern", map = 1420, x = 32.69, y = 65.56, f = "e", faction = "H", classes = { "WARRIOR" } }, { npc = 2122, npcName = "David Trias", map = 1420, x = 32.53, y = 65.65, f = "e", faction = "H", classes = { "ROGUE" } }, { npc = 2123, npcName = "Dark Cleric Duesten", map = 1420, x = 31.11, y = 66.03, f = "e", faction = "H", classes = { "PRIEST" } }, { npc = 2124, npcName = "Isabella", map = 1420, x = 30.93, y = 66.06, f = "e", faction = "H", classes = { "MAGE" } }, { npc = 2126, npcName = "Maximillion", map = 1420, x = 30.91, y = 66.34, f = "e", faction = "H", classes = { "WARLOCK" } }, { npc = 2127, npcName = "Rupert Boch", map = 1420, x = 61.59, y = 52.4, f = "e", faction = "H", classes = { "WARLOCK" } }, { npc = 2128, npcName = "Cain Firesong", map = 1420, x = 61.97, y = 52.47, f = "e", faction = "H", classes = { "MAGE" } }, { npc = 2129, npcName = "Dark Cleric Beryl", map = 1420, x = 61.57, y = 52.19, f = "e", faction = "H", classes = { "PRIEST" } }, { npc = 2130, npcName = "Marion Call", map = 1420, x = 61.75, y = 52, f = "e", faction = "H", classes = { "ROGUE" } }, { npc = 2131, npcName = "Austil de Mon", map = 1420, x = 61.85, y = 52.54, f = "e", faction = "H", classes = { "WARRIOR" } }, { npc = 244808, npcName = "Aramis Hammerhand", map = 1420, x = 31.09, y = 66.32, f = "e", faction = "H", classes = { "PALADIN" } }, { npc = 246152, npcName = "Shari Stilwell", map = 1420, x = 60.25, y = 52.63, f = "e", faction = "H", classes = { "PALADIN" } }, { npc = 246389, npcName = "Hilda the Breaker", map = 1420, x = 21.92, y = 47.19, f = "e", faction = "H", classes = { "PALADIN" } }, { npc = 4563, npcName = "Kaal Soulreaper", map = 1458, x = 86.21, y = 15.93, f = "e", faction = "H", classes = { "WARLOCK" } }, { npc = 4566, npcName = "Kaelystia Hatebringer", map = 1458, x = 85.02, y = 14.02, f = "e", faction = "H", classes = { "MAGE" } }, { npc = 4582, npcName = "Carolyn Ward", map = 1458, x = 83.86, y = 72.07, f = "e", faction = "H", classes = { "ROGUE" } }, { npc = 4593, npcName = "Christoph Walker", map = 1458, x = 46.93, y = 15.23, f = "e", faction = "H", classes = { "WARRIOR" } }, { npc = 4606, npcName = "Aelthalyste", map = 1458, x = 49.26, y = 17.12, f = "e", faction = "H", classes = { "PRIEST" } }, { npc = 260093, npcName = "Garen Largo", map = 1458, x = 47.49, y = 15.23, f = "e", faction = "H", classes = { "PALADIN" } }, { npc = 251373, npcName = "Xyton Silverwind", map = 2521, x = 41.72, y = 23.38, faction = "AH", classes = { "DRUID" } }, { npc = 251374, npcName = "Windshaper Boro", map = 2521, x = 42.76, y = 23.58, faction = "H", classes = { "SHAMAN" } }, { npc = 251376, npcName = "Tai'ree Farsight", map = 2521, x = 42.44, y = 23.68, faction = "AH", classes = { "HUNTER" } }, { npc = 251389, npcName = "Akeri Duskblade", map = 2521, x = 43.71, y = 24.3, faction = "AH", classes = { "ROGUE" } }, { npc = 251964, npcName = "Blademaster Ren", map = 2521, x = 43.68, y = 24.17, faction = "AH", classes = { "WARRIOR" } } } },
					},
				},
				{
					title = "Foreman Thazz'ril",
					note = "The foreman stands at the lumber pile east of the Den.",
					goals = {
						{ t = "accept", quest = 5441, title = "Lazy Peons", npc = 11378, npcName = "Foreman Thazz'ril", minLevel = 3, qlvl = 4, map = 1411, x = 44.63, y = 68.65, f = "e" },
					},
				},
				{
					title = "Lazy Peons",
					note = "Hit the sleeping peons north of the Den with the Foreman's Blackjack.",
					goals = {
						{ t = "kill", quest = 5441, title = "Lazy Peons", target = "Lazy Peon", npc = 10556, count = 5, oi = 1, map = 1411, x = 44.98, y = 69.13, f = "e", spots = { { x = 46.3, y = 67.4, r = 96, n = 4 }, { x = 42.8, y = 72.9, r = 99, n = 3 }, { x = 40.3, y = 60.4, r = 93, n = 3 }, { x = 43.4, y = 57.5, r = 80, n = 2 }, { x = 46.9, y = 59.3, r = 80, n = 2 } }, spread = true },
					},
				},
				{
					title = "Foreman Thazz'ril",
					goals = {
						{ t = "turnin", quest = 5441, title = "Lazy Peons", npc = 11378, npcName = "Foreman Thazz'ril", map = 1411, x = 44.63, y = 68.65, f = "e" },
						{ t = "accept", quest = 6394, title = "Thazz'ril's Pick", npc = 11378, npcName = "Foreman Thazz'ril", minLevel = 3, qlvl = 4, pre = { 5441 }, preTitles = { [5441] = "Lazy Peons" }, map = 1411, x = 44.63, y = 68.65, f = "e" },
					},
				},
				{
					title = "North end of the valley",
					note = "Collect Cactus Apples and kill Scorpid Workers on the way north. The Vile Familiars swarm the slope by the cave on the valley's north side; Thazz'ril's Pick lies just inside the cave mouth.",
					goals = {
						{ t = "collect", quest = 4402, title = "Galgar's Cactus Apple Surprise", item = 11583, itemName = "Cactus Apple", count = 10, oi = 1, map = 1411, x = 43.99, y = 67.09, f = "e", spots = { { x = 44, y = 65.8, r = 55, n = 3 }, { x = 45.1, y = 63.3, r = 86, n = 6 }, { x = 47.3, y = 64, r = 55, n = 2 }, { x = 45.5, y = 59.5, r = 76, n = 5 }, { x = 41.5, y = 59.2, r = 65, n = 3 }, { x = 42, y = 56.5, r = 55, n = 1 }, { x = 40.9, y = 64.3, r = 87, n = 5 }, { x = 39.9, y = 68.1, r = 55, n = 1 }, { x = 44.4, y = 71.3, r = 55, n = 3 } }, spread = true },
						{ t = "collect", quest = 789, title = "Sting of the Scorpid", item = 4862, itemName = "Scorpid Worker Tail", count = 10, oi = 1, map = 1411, x = 41.83, y = 65.81, f = "e", spots = { { x = 41.4, y = 66.1, r = 40, n = 4 }, { x = 40.9, y = 63.7, r = 44, n = 5 }, { x = 39.8, y = 62.2, r = 45, n = 6 }, { x = 41.2, y = 61.4, r = 40, n = 5 }, { x = 42.8, y = 58.7, r = 73, n = 7 }, { x = 43.1, y = 56.4, r = 40, n = 1 }, { x = 46, y = 59.6, r = 45, n = 7 }, { x = 46.9, y = 61.6, r = 40, n = 3 }, { x = 47.4, y = 63.7, r = 40, n = 3 }, { x = 45.2, y = 72.1, r = 40, n = 2 }, { x = 43.6, y = 73.7, r = 40, n = 2 }, { x = 41, y = 70.6, r = 40, n = 2 }, { x = 40.5, y = 67.5, r = 59, n = 9, alt = true } }, spread = true },
						{ t = "kill", quest = 792, title = "Vile Familiars", target = "Vile Familiar", npc = 3101, count = 12, oi = 1, map = 1411, x = 43.82, y = 58.29, f = "e", spots = { { x = 44.2, y = 58.4, r = 21, n = 2 }, { x = 44.7, y = 57.1, r = 44, n = 6 }, { x = 45.5, y = 55.8, r = 37, n = 4 }, { x = 46.1, y = 57.3, r = 49, n = 6 }, { x = 43.7, y = 54.1, r = 71, n = 15 } }, only = { classes = { "WARRIOR", "PALADIN", "HUNTER", "ROGUE", "PRIEST", "SHAMAN", "MAGE", "DRUID" } } },
						{ t = "collect", quest = 1485, title = "Vile Familiars", item = 6487, itemName = "Vile Familiar Head", count = 6, oi = 1, map = 1411, x = 43.82, y = 58.29, f = "e", spots = { { x = 44.2, y = 58.4, r = 21, n = 2 }, { x = 44.7, y = 57.1, r = 44, n = 6 }, { x = 45.5, y = 55.8, r = 37, n = 4 }, { x = 46.1, y = 57.3, r = 49, n = 6 }, { x = 43.7, y = 54.1, r = 71, n = 15 } }, only = { classes = { "WARLOCK" } } },
						{ t = "collect", quest = 6394, title = "Thazz'ril's Pick", item = 16332, itemName = "Thazz'ril's Pick", oi = 1, map = 1411, x = 43.7, y = 53.8, f = "e" },
					},
				},
				{
					title = "Back at the Den",
					goals = {
						{ t = "turnin", quest = 6394, title = "Thazz'ril's Pick", npc = 11378, npcName = "Foreman Thazz'ril", map = 1411, x = 44.63, y = 68.65, f = "e", note = "Foreman Thazz'ril" },
						{ t = "turnin", quest = 4402, title = "Galgar's Cactus Apple Surprise", npc = 9796, npcName = "Galgar", map = 1411, x = 42.73, y = 67.23, f = "e", note = "Galgar" },
						{ t = "turnin", quest = 789, title = "Sting of the Scorpid", npc = 3143, npcName = "Gornek", map = 1411, x = 42.06, y = 68.33, f = "e", note = "Gornek" },
						{ t = "turnin", quest = 792, title = "Vile Familiars", npc = 3145, npcName = "Zureetha Fargaze", map = 1411, x = 42.85, y = 69.15, f = "e", only = { classes = { "WARRIOR", "PALADIN", "HUNTER", "ROGUE", "PRIEST", "SHAMAN", "MAGE", "DRUID" } }, note = "Zureetha Fargaze" },
						{ t = "turnin", quest = 1485, title = "Vile Familiars", npc = 5765, npcName = "Ruzan", map = 1411, x = 42.59, y = 69, f = "e", only = { classes = { "WARLOCK" } }, note = "Ruzan" },
						{ t = "accept", quest = 1499, title = "Vile Familiars", npc = 5765, npcName = "Ruzan", minLevel = 1, qlvl = 4, pre = { 1470, 1485 }, preTitles = { [1470] = "Piercing the Veil", [1485] = "Vile Familiars" }, map = 1411, x = 42.59, y = 69, f = "e", only = { classes = { "WARLOCK" } } },
						{ t = "turnin", quest = 1499, title = "Vile Familiars", npc = 3145, npcName = "Zureetha Fargaze", map = 1411, x = 42.85, y = 69.15, f = "e", only = { classes = { "WARLOCK" } }, note = "Zureetha Fargaze" },
						{ t = "accept", quest = 794, title = "Burning Blade Medallion", npc = 3145, npcName = "Zureetha Fargaze", minLevel = 1, qlvl = 5, pre = { 792, 1499 }, preTitles = { [792] = "Vile Familiars", [1499] = "Vile Familiars" }, map = 1411, x = 42.85, y = 69.15, f = "e" },
					},
				},
				{
					title = "Canaga Earthcaller",
					note = "Canaga stands just outside the Den.",
					only = { classes = { "SHAMAN" } },
					goals = {
						{ t = "accept", quest = 1516, title = "Call of Earth", npc = 5887, npcName = "Canaga Earthcaller", minLevel = 4, qlvl = 4, closedBy = { 1519, 92466 }, preTitles = { [1519] = "Call of Earth", [92466] = "Call of Earth" }, map = 1411, x = 42.4, y = 69.17, f = "e", note = "Canaga Earthcaller" },
					},
				},
				{
					title = "Burning Blade Coven",
					note = "Yarrog Baneshadow waits at the back of the cave on the valley's north side.",
					goals = {
						{ t = "collect", quest = 794, title = "Burning Blade Medallion", item = 4859, itemName = "Burning Blade Medallion", count = 1, oi = 1, map = 1411, x = 42.71, y = 52.95, f = "e" },
					},
				},
				{
					title = "Felstalker hooves",
					note = "Felstalkers roam the slope below the cave, on the valley's north side.",
					only = { classes = { "SHAMAN" } },
					goals = {
						{ t = "collect", quest = 1516, title = "Call of Earth", item = 6640, itemName = "Felstalker Hoof", count = 2, oi = 1, map = 1411, x = 42.52, y = 53.5, f = "e", spots = { { x = 42.9, y = 53.2, r = 51, n = 5 }, { x = 44.1, y = 54.8, r = 61, n = 5 }, { x = 44.6, y = 52.8, r = 26, n = 3 }, { x = 45.4, y = 55.5, r = 15, n = 2 } } },
					},
				},
				{
					title = "Zureetha Fargaze",
					goals = {
						{ t = "turnin", quest = 794, title = "Burning Blade Medallion", npc = 3145, npcName = "Zureetha Fargaze", map = 1411, x = 42.85, y = 69.15, f = "e" },
						{ t = "accept", quest = 805, title = "Report to Sen'jin Village", npc = 3145, npcName = "Zureetha Fargaze", minLevel = 1, qlvl = 5, pre = { 794 }, preTitles = { [794] = "Burning Blade Medallion" }, map = 1411, x = 42.85, y = 69.15, f = "e" },
						{ t = "accept", quest = 96652, title = "The Adventurer", object = 654925, objName = "Lost Journal", minLevel = 4, qlvl = 6, pre = { 794 }, closedBy = { 96604, 96627, 96628, 96630, 96638, 96656, 96659 }, preTitles = { [794] = "Burning Blade Medallion", [96604] = "The Great Outdoors", [96627] = "The Adventurer", [96628] = "The Adventurer", [96630] = "The Adventurer", [96638] = "The Adventurer", [96656] = "The Adventurer", [96659] = "The Adventurer" }, map = 1411, x = 42.82, y = 69.14, f = "e", note = "the Lost Journal on the ground beside her" },
						{ t = "train", class = true, candidates = { { npc = 3154, npcName = "Jen'shan", map = 1411, x = 42.84, y = 69.33, f = "e", faction = "H", classes = { "HUNTER" } }, { npc = 3153, npcName = "Frang", map = 1411, x = 42.89, y = 69.44, f = "e", faction = "H", classes = { "WARRIOR" } }, { npc = 5884, npcName = "Mai'ah", map = 1411, x = 42.51, y = 69.04, f = "e", faction = "H", classes = { "MAGE" } }, { npc = 3157, npcName = "Shikrik", map = 1411, x = 42.39, y = 69, f = "e", faction = "H", classes = { "SHAMAN" } }, { npc = 3707, npcName = "Ken'jai", map = 1411, x = 42.36, y = 68.81, f = "e", faction = "H", classes = { "PRIEST" } }, { npc = 3155, npcName = "Rwag", map = 1411, x = 41.28, y = 68, f = "e", faction = "H", classes = { "ROGUE" } }, { npc = 3156, npcName = "Nartok", map = 1411, x = 40.65, y = 68.52, f = "e", faction = "H", classes = { "WARLOCK" } }, { npc = 5880, npcName = "Un'Thuwa", map = 1411, x = 56.31, y = 75.11, f = "e", faction = "H", classes = { "MAGE" } }, { npc = 3170, npcName = "Kaplak", map = 1411, x = 51.98, y = 43.69, f = "e", faction = "H", classes = { "ROGUE" } }, { npc = 3171, npcName = "Thotar", map = 1411, x = 51.85, y = 43.49, f = "e", faction = "H", classes = { "HUNTER" } }, { npc = 3706, npcName = "Tai'jin", map = 1411, x = 54.26, y = 42.93, f = "e", faction = "H", classes = { "PRIEST" } }, { npc = 3169, npcName = "Tarshaw Jaggedscar", map = 1411, x = 54.19, y = 42.47, f = "e", faction = "H", classes = { "WARRIOR" } }, { npc = 3173, npcName = "Swart", map = 1411, x = 54.42, y = 42.59, f = "e", faction = "H", classes = { "SHAMAN" } }, { npc = 3172, npcName = "Dhugru Gorelust", map = 1411, x = 54.38, y = 41.2, f = "e", faction = "H", classes = { "WARLOCK" } }, { npc = 6018, npcName = "Ur'kyo", map = 1454, x = 35.59, y = 87.82, f = "e", faction = "H", classes = { "PRIEST" } }, { npc = 7311, npcName = "Uthel'nay", map = 1454, x = 39.16, y = 86.27, f = "e", faction = "H", classes = { "MAGE" } }, { npc = 3328, npcName = "Ormok", map = 1454, x = 43.9, y = 54.63, f = "e", faction = "H", classes = { "ROGUE" } }, { npc = 3325, npcName = "Mirket", map = 1454, x = 48.62, y = 46.95, f = "e", faction = "H", classes = { "WARLOCK" } }, { npc = 3344, npcName = "Kardris Dreamseeker", map = 1454, x = 38.8, y = 36.37, f = "e", faction = "H", classes = { "SHAMAN" } }, { npc = 3354, npcName = "Sorek", map = 1454, x = 80.39, y = 32.38, f = "e", faction = "H", classes = { "WARRIOR" } }, { npc = 3406, npcName = "Xor'juul", map = 1454, x = 67.24, y = 20.2, f = "e", faction = "H", classes = { "HUNTER" } }, { npc = 3034, npcName = "Sheal Runetotem", map = 1456, x = 77.14, y = 27.02, f = "e", faction = "H", classes = { "DRUID" } }, { npc = 3040, npcName = "Urek Thunderhorn", map = 1456, x = 59.13, y = 86.87, f = "e", faction = "H", classes = { "HUNTER" } }, { npc = 3063, npcName = "Krang Stonehoof", map = 1412, x = 48.35, y = 63.74, faction = "H", classes = { "WARRIOR" } }, { npc = 3065, npcName = "Yaw Sharpmane", map = 1412, x = 46.93, y = 59.65, faction = "H", classes = { "HUNTER" } }, { npc = 3043, npcName = "Ker Ragetotem", map = 1456, x = 57.58, y = 85.5, f = "e", faction = "H", classes = { "WARRIOR" } }, { npc = 3066, npcName = "Narm Skychaser", map = 1412, x = 47.4, y = 62.54, faction = "H", classes = { "SHAMAN" } }, { npc = 3064, npcName = "Gennia Runetotem", map = 1412, x = 47.48, y = 62.95, faction = "H", classes = { "DRUID" } }, { npc = 3048, npcName = "Ursyn Ghull", map = 1456, x = 25.7, y = 14.19, f = "e", faction = "H", classes = { "MAGE" } }, { npc = 246344, npcName = "Alodan the Hopeful", map = 1456, x = 25.6, y = 14.8, f = "e", faction = "H", classes = { "PALADIN" } }, { npc = 3046, npcName = "Father Cobb", map = 1456, x = 25.64, y = 20.7, f = "e", faction = "H", classes = { "PRIEST" } }, { npc = 3031, npcName = "Tigor Skychaser", map = 1456, x = 23.64, y = 18.79, f = "e", faction = "H", classes = { "SHAMAN" } }, { npc = 3060, npcName = "Gart Mistrunner", map = 1412, x = 44.65, y = 76.55, faction = "H", classes = { "DRUID" } }, { npc = 3062, npcName = "Meela Dawnstrider", map = 1412, x = 44.58, y = 76.56, faction = "H", classes = { "SHAMAN" } }, { npc = 3061, npcName = "Lanka Farshot", map = 1412, x = 43.96, y = 76.35, faction = "H", classes = { "HUNTER" } }, { npc = 3059, npcName = "Harutt Thunderhorn", map = 1412, x = 43.75, y = 76.72, faction = "H", classes = { "WARRIOR" } }, { npc = 2119, npcName = "Dannal Stern", map = 1420, x = 32.69, y = 65.56, f = "e", faction = "H", classes = { "WARRIOR" } }, { npc = 2122, npcName = "David Trias", map = 1420, x = 32.53, y = 65.65, f = "e", faction = "H", classes = { "ROGUE" } }, { npc = 2123, npcName = "Dark Cleric Duesten", map = 1420, x = 31.11, y = 66.03, f = "e", faction = "H", classes = { "PRIEST" } }, { npc = 2124, npcName = "Isabella", map = 1420, x = 30.93, y = 66.06, f = "e", faction = "H", classes = { "MAGE" } }, { npc = 2126, npcName = "Maximillion", map = 1420, x = 30.91, y = 66.34, f = "e", faction = "H", classes = { "WARLOCK" } }, { npc = 2127, npcName = "Rupert Boch", map = 1420, x = 61.59, y = 52.4, f = "e", faction = "H", classes = { "WARLOCK" } }, { npc = 2128, npcName = "Cain Firesong", map = 1420, x = 61.97, y = 52.47, f = "e", faction = "H", classes = { "MAGE" } }, { npc = 2129, npcName = "Dark Cleric Beryl", map = 1420, x = 61.57, y = 52.19, f = "e", faction = "H", classes = { "PRIEST" } }, { npc = 2130, npcName = "Marion Call", map = 1420, x = 61.75, y = 52, f = "e", faction = "H", classes = { "ROGUE" } }, { npc = 2131, npcName = "Austil de Mon", map = 1420, x = 61.85, y = 52.54, f = "e", faction = "H", classes = { "WARRIOR" } }, { npc = 244808, npcName = "Aramis Hammerhand", map = 1420, x = 31.09, y = 66.32, f = "e", faction = "H", classes = { "PALADIN" } }, { npc = 246152, npcName = "Shari Stilwell", map = 1420, x = 60.25, y = 52.63, f = "e", faction = "H", classes = { "PALADIN" } }, { npc = 246389, npcName = "Hilda the Breaker", map = 1420, x = 21.92, y = 47.19, f = "e", faction = "H", classes = { "PALADIN" } }, { npc = 4563, npcName = "Kaal Soulreaper", map = 1458, x = 86.21, y = 15.93, f = "e", faction = "H", classes = { "WARLOCK" } }, { npc = 4566, npcName = "Kaelystia Hatebringer", map = 1458, x = 85.02, y = 14.02, f = "e", faction = "H", classes = { "MAGE" } }, { npc = 4582, npcName = "Carolyn Ward", map = 1458, x = 83.86, y = 72.07, f = "e", faction = "H", classes = { "ROGUE" } }, { npc = 4593, npcName = "Christoph Walker", map = 1458, x = 46.93, y = 15.23, f = "e", faction = "H", classes = { "WARRIOR" } }, { npc = 4606, npcName = "Aelthalyste", map = 1458, x = 49.26, y = 17.12, f = "e", faction = "H", classes = { "PRIEST" } }, { npc = 260093, npcName = "Garen Largo", map = 1458, x = 47.49, y = 15.23, f = "e", faction = "H", classes = { "PALADIN" } }, { npc = 251373, npcName = "Xyton Silverwind", map = 2521, x = 41.72, y = 23.38, faction = "AH", classes = { "DRUID" } }, { npc = 251374, npcName = "Windshaper Boro", map = 2521, x = 42.76, y = 23.58, faction = "H", classes = { "SHAMAN" } }, { npc = 251376, npcName = "Tai'ree Farsight", map = 2521, x = 42.44, y = 23.68, faction = "AH", classes = { "HUNTER" } }, { npc = 251389, npcName = "Akeri Duskblade", map = 2521, x = 43.71, y = 24.3, faction = "AH", classes = { "ROGUE" } }, { npc = 251964, npcName = "Blademaster Ren", map = 2521, x = 43.68, y = 24.17, faction = "AH", classes = { "WARRIOR" } } } },
					},
				},
				{
					title = "Call of Earth",
					note = "Canaga stands outside the Den. Spirit Rock is the hill just south of it: drink the Earth Sapta there to see the Minor Manifestation of Earth, then take the Rough Quartz back to Canaga.",
					only = { classes = { "SHAMAN" } },
					goals = {
						{ t = "turnin", quest = 1516, title = "Call of Earth", npc = 5887, npcName = "Canaga Earthcaller", map = 1411, x = 42.4, y = 69.17, f = "e", note = "Canaga Earthcaller" },
						{ t = "accept", quest = 1517, title = "Call of Earth", npc = 5887, npcName = "Canaga Earthcaller", minLevel = 4, qlvl = 4, pre = { 1516, 1519 }, preTitles = { [1516] = "Call of Earth", [1519] = "Call of Earth" }, map = 1411, x = 42.4, y = 69.17, f = "e" },
						{ t = "turnin", quest = 1517, title = "Call of Earth", npc = 5891, npcName = "Minor Manifestation of Earth", map = 1411, x = 44.03, y = 76.2, f = "e", note = "Minor Manifestation of Earth, on Spirit Rock" },
						{ t = "accept", quest = 1518, title = "Call of Earth", npc = 5891, npcName = "Minor Manifestation of Earth", minLevel = 4, qlvl = 4, pre = { 1517 }, preTitles = { [1517] = "Call of Earth" }, map = 1411, x = 44.03, y = 76.2, f = "e" },
						{ t = "turnin", quest = 1518, title = "Call of Earth", npc = 5887, npcName = "Canaga Earthcaller", map = 1411, x = 42.4, y = 69.17, f = "e", note = "Canaga Earthcaller: Stoneskin Totem and your Earth Totem" },
					},
				},
				{
					title = "Ukor",
					note = "Ukor stands on the road at the valley's eastern exit.",
					goals = {
						{ t = "accept", quest = 2161, title = "A Peon's Burden", npc = 6786, npcName = "Ukor", minLevel = 1, qlvl = 5, map = 1411, x = 52.06, y = 68.31, f = "e" },
					},
				},
				{
					title = "Sen'jin Village",
					note = "Follow the road east out of the valley to Sen'jin Village on the coast.",
					goals = {
						{ t = "turnin", quest = 805, title = "Report to Sen'jin Village", npc = 3188, npcName = "Master Gadrin", map = 1411, x = 55.95, y = 74.72, f = "e", note = "Master Gadrin" },
						{ t = "accept", quest = 96821, title = "Legging It", npc = 3194, npcName = "Vel'rin Fang", minLevel = 1, qlvl = 6, map = 1411, x = 55.96, y = 73.93, f = "e", note = "Vel'rin Fang" },
					},
				},
				{
					title = "Ridgeshade spiders",
					note = "The spiders lurk in the hills along the road north toward Razor Hill.",
					goals = {
						{ t = "kill", quest = 96821, title = "Legging It", target = "Ridgeshade Creeper", npc = 266850, count = 6, oi = 1, map = 1411, x = 51.68, y = 64.69, f = "e", spots = { { x = 51.8, y = 63.1, r = 58, n = 8 }, { x = 52.8, y = 60.9, r = 15, n = 2 }, { x = 51.7, y = 60.1, r = 35, n = 5 }, { x = 51.9, y = 58, r = 23, n = 3 }, { x = 50.8, y = 56.2, r = 40, n = 5 }, { x = 50.6, y = 54.2, r = 46, n = 8 }, { x = 50.8, y = 52, r = 38, n = 7, alt = true }, { x = 52, y = 49.4, r = 15, n = 1, alt = true } } },
						{ t = "kill", quest = 96821, title = "Legging It", target = "Ridgeshade Lurker", npc = 266849, count = 6, oi = 2, map = 1411, x = 51.51, y = 64.08, f = "e", spots = { { x = 51.9, y = 64, r = 68, n = 9 }, { x = 51.9, y = 61.3, r = 40, n = 6 }, { x = 51.9, y = 58.8, r = 41, n = 5 }, { x = 50.9, y = 55.9, r = 75, n = 10 }, { x = 50.5, y = 53.7, r = 49, n = 8 }, { x = 51.1, y = 51.1, r = 40, n = 7 }, { x = 51.7, y = 49, r = 40, n = 4 } }, spread = true },
					},
				},
				{
					title = "Brakk's campfire",
					note = "Brakk camps just south of Razor Hill. Sit by his campfire (/sit) until the Boosted Rest buff appears.",
					goals = {
						{ t = "turnin", quest = 96652, title = "The Adventurer", npc = 265809, npcName = "Brakk", map = 1411, x = 52.03, y = 47.41, f = "e", note = "Brakk" },
						{ t = "accept", quest = 96604, title = "The Great Outdoors", npc = 265809, npcName = "Brakk", minLevel = 4, qlvl = 6, closedBy = { 95998, 96101, 96605, 96606, 96607, 96608 }, preTitles = { [95998] = "The Great Outdoors", [96101] = "The Great Outdoors", [96605] = "The Great Outdoors", [96606] = "The Great Outdoors", [96607] = "The Great Outdoors", [96608] = "The Great Outdoors" }, map = 1411, x = 52.03, y = 47.41, f = "e" },
						{ t = "complete", quest = 96604, title = "The Great Outdoors", map = 1411, x = 52.1, y = 47.4, f = "e" },
						{ t = "turnin", quest = 96604, title = "The Great Outdoors", npc = 265809, npcName = "Brakk", map = 1411, x = 52.03, y = 47.41, f = "e" },
						{ t = "accept", quest = 96655, title = "Camping 101: Cooking", npc = 265809, npcName = "Brakk", minLevel = 4, qlvl = 6, pre = { 95998, 96101, 96604, 96605, 96606, 96607, 96608 }, closedBy = { 96626, 96629, 96634, 96646, 96658, 96661 }, preTitles = { [95998] = "The Great Outdoors", [96101] = "The Great Outdoors", [96604] = "The Great Outdoors", [96605] = "The Great Outdoors", [96606] = "The Great Outdoors", [96607] = "The Great Outdoors", [96608] = "The Great Outdoors", [96626] = "Camping 101: Cooking", [96629] = "Camping 101: Cooking", [96634] = "Camping 101: Cooking", [96646] = "Camping 101: Cooking", [96658] = "Camping 101: Cooking", [96661] = "Camping 101: Cooking" }, map = 1411, x = 52.03, y = 47.41, f = "e" },
					},
				},
				{
					title = "Razor Hill",
					goals = {
						{ t = "turnin", quest = 2161, title = "A Peon's Burden", npc = 6928, npcName = "Innkeeper Grosk", map = 1411, x = 51.51, y = 41.64, f = "e", note = "Innkeeper Grosk" },
						{ t = "sethome", location = "Razor Hill" },
						{ t = "turnin", quest = 96821, title = "Legging It", npc = 3139, npcName = "Gar'Thok", map = 1411, x = 51.95, y = 43.5, f = "e", note = "Gar'Thok" },
						{ t = "accept", quest = 784, title = "Vanquish the Betrayers", npc = 3139, npcName = "Gar'Thok", minLevel = 3, qlvl = 7, map = 1411, x = 51.95, y = 43.5, f = "e" },
						{ t = "complete", quest = 96655, title = "Camping 101: Cooking", map = 1411, x = 51.1, y = 42.5, f = "e", note = "Talk to Cook Torka" },
						{ t = "turnin", quest = 96655, title = "Camping 101: Cooking", npc = 3191, npcName = "Cook Torka", map = 1411, x = 51.11, y = 42.45, f = "e" },
						{ t = "accept", quest = 96825, title = "This Fruit Could Bite Back", npc = 3191, npcName = "Cook Torka", minLevel = 3, qlvl = 6, map = 1411, x = 51.11, y = 42.45, f = "e" },
						{ t = "accept", quest = 791, title = "Carry Your Weight", npc = 3147, npcName = "Furl Scornbrow", minLevel = 4, qlvl = 7, map = 1411, x = 49.88, y = 40.39, f = "e", note = "Furl Scornbrow, in the watchtower" },
						{ t = "accept", quest = 96822, title = "For Honor", npc = 266940, npcName = "Turroc", minLevel = 3, qlvl = 6, map = 1411, x = 53.94, y = 42.6, f = "e", note = "Turroc" },
					},
				},
				{
					title = "Prickly pears",
					note = "The prickly pears grow among the quilboar huts just west of town.",
					goals = {
						{ t = "collect", quest = 96825, title = "This Fruit Could Bite Back", item = 275718, itemName = "Prickly Pear Fruit", count = 8, oi = 1, map = 1411, x = 49.5, y = 47.7, f = "e", spots = { { x = 49.3, y = 48.3, r = 36, n = 3 }, { x = 47.4, y = 49.1, r = 36, n = 5 }, { x = 44.4, y = 50.2, r = 44, n = 3 } } },
					},
				},
				{
					title = "Cook Torka",
					goals = {
						{ t = "turnin", quest = 96825, title = "This Fruit Could Bite Back", npc = 3191, npcName = "Cook Torka", map = 1411, x = 51.11, y = 42.45, f = "e" },
						{ t = "accept", quest = 815, title = "Break a Few Eggs", npc = 3191, npcName = "Cook Torka", minLevel = 6, qlvl = 8, map = 1411, x = 51.11, y = 42.45, f = "e" },
						{ t = "accept", quest = 837, title = "Encroachment", npc = 3139, npcName = "Gar'Thok", minLevel = 6, qlvl = 10, map = 1411, x = 51.95, y = 43.5, f = "e", note = "Gar'Thok" },
					},
				},
				{
					title = "Razormane Grounds",
					note = "Quilboars and scouts hold the huts west of town; dustrunners and battleguards hold the camps farther west.",
					goals = {
						{ t = "kill", quest = 837, title = "Encroachment", target = "Razormane Quilboar", npc = 3111, count = 4, oi = 1, map = 1411, x = 51, y = 48.2, f = "e", spots = { { x = 50, y = 48.7, r = 56, n = 6 }, { x = 47.3, y = 48.3, r = 51, n = 6 }, { x = 44.1, y = 49.8, r = 56, n = 6 }, { x = 50.2, y = 50.6, r = 15, n = 1, alt = true } } },
						{ t = "kill", quest = 837, title = "Encroachment", target = "Razormane Scout", npc = 3112, count = 4, oi = 2, map = 1411, x = 50.8, y = 48.8, f = "e", spots = { { x = 50.4, y = 49.7, r = 39, n = 3 }, { x = 49.4, y = 48.1, r = 39, n = 4 }, { x = 47.2, y = 48.6, r = 45, n = 5 }, { x = 43.8, y = 50.1, r = 43, n = 3 }, { x = 44.4, y = 48.8, r = 15, n = 1, alt = true } } },
						{ t = "kill", quest = 837, title = "Encroachment", target = "Razormane Dustrunner", npc = 3113, count = 4, oi = 3, map = 1411, x = 44.6, y = 40.6, f = "e", spots = { { x = 44.2, y = 39.7, r = 65, n = 5 }, { x = 44, y = 41.4, r = 40, n = 1 }, { x = 42.7, y = 41.2, r = 57, n = 7 }, { x = 41.5, y = 38.3, r = 42, n = 5 }, { x = 42.6, y = 37.2, r = 42, n = 4 }, { x = 44.4, y = 37.3, r = 46, n = 5 }, { x = 39.4, y = 52.4, r = 40, n = 1 }, { x = 38.4, y = 53.8, r = 51, n = 6 } }, spread = true },
						{ t = "kill", quest = 837, title = "Encroachment", target = "Razormane Battleguard", npc = 3114, count = 4, oi = 4, map = 1411, x = 44.6, y = 40.6, f = "e", spots = { { x = 44.2, y = 41.2, r = 40, n = 3 }, { x = 42.7, y = 40.5, r = 47, n = 5 }, { x = 42.1, y = 37.7, r = 51, n = 7 }, { x = 44.5, y = 38.4, r = 50, n = 6 }, { x = 41, y = 51.6, r = 40, n = 1 }, { x = 38.8, y = 52.9, r = 58, n = 5 }, { x = 38.4, y = 54.6, r = 40, n = 1 } }, spread = true },
					},
				},
				{
					title = "Gar'Thok",
					goals = {
						{ t = "turnin", quest = 837, title = "Encroachment", npc = 3139, npcName = "Gar'Thok", map = 1411, x = 51.95, y = 43.5, f = "e" },
					},
				},
				{
					title = "Tiragarde Keep",
					note = "The keep stands on the coast south-east of Razor Hill. The raiders' axe, bow and shield lie on its outskirts. Sailors and marines drop the Canvas Scraps. Lieutenant Benedict waits at the top of the keep; his key opens the chest beside him, which holds the Aged Envelope.",
					goals = {
						{ t = "collect", quest = 96822, title = "For Honor", item = 275716, itemName = "Raider's Battleaxe", count = 1, oi = 1, map = 1411, x = 57.4, y = 56.4, f = "e" },
						{ t = "collect", quest = 96822, title = "For Honor", item = 275713, itemName = "Raider's Bow", oi = 2, map = 1411, x = 57.3, y = 57.9, f = "e" },
						{ t = "collect", quest = 96822, title = "For Honor", item = 275717, itemName = "Raider's Shield", oi = 3, map = 1411, x = 56.6, y = 53, f = "e" },
						{ t = "kill", quest = 784, title = "Vanquish the Betrayers", target = "Kul Tiras Sailor", npc = 3128, count = 10, oi = 1, map = 1411, x = 56.61, y = 52.97, f = "e", spots = { { x = 56.5, y = 52.6, r = 51, n = 5 }, { x = 56.7, y = 55.4, r = 42, n = 3 }, { x = 58.4, y = 53, r = 34, n = 3 }, { x = 58, y = 57.1, r = 35, n = 4 }, { x = 56.7, y = 58.2, r = 57, n = 6 }, { x = 59.6, y = 59.1, r = 58, n = 5 }, { x = 61, y = 58.8, r = 15, n = 1, alt = true } } },
						{ t = "kill", quest = 784, title = "Vanquish the Betrayers", target = "Kul Tiras Marine", npc = 3129, count = 8, oi = 2, map = 1411, x = 57.79, y = 53.79, f = "e", spots = { { x = 57.8, y = 54.9, r = 40, n = 3 }, { x = 59.5, y = 55.5, r = 36, n = 4 }, { x = 59.3, y = 57.8, r = 52, n = 7 }, { x = 60.5, y = 59.8, r = 21, n = 2 }, { x = 59.5, y = 53.5, r = 15, n = 1, alt = true }, { x = 56.5, y = 50.8, r = 15, n = 1, alt = true } } },
						{ t = "collect", quest = 791, title = "Carry Your Weight", item = 4870, itemName = "Canvas Scraps", count = 8, oi = 1, map = 1411, x = 57.79, y = 53.79, f = "e", spots = { { x = 58.5, y = 53.3, r = 56, n = 5 }, { x = 57.5, y = 55.7, r = 53, n = 6 }, { x = 56.8, y = 57.8, r = 65, n = 8 }, { x = 58.8, y = 60.2, r = 40, n = 1 }, { x = 60.3, y = 59.2, r = 41, n = 6 }, { x = 59.5, y = 55.9, r = 48, n = 6 }, { x = 56.5, y = 51.4, r = 40, n = 3 }, { x = 52.4, y = 76.9, r = 40, n = 2 }, { x = 52.4, y = 81.6, r = 40, n = 2 }, { x = 49.7, y = 80.4, r = 45, n = 6 }, { x = 47.9, y = 78.6, r = 68, n = 9 }, { x = 46.5, y = 79.5, r = 40, n = 5 }, { x = 56.6, y = 53.3, r = 40, n = 3, alt = true }, { x = 59.3, y = 58.3, r = 51, n = 10, alt = true }, { x = 52.2, y = 79.8, r = 50, n = 3, alt = true }, { x = 50.1, y = 78.9, r = 40, n = 2, alt = true } }, spread = true },
						{ t = "kill", quest = 784, title = "Vanquish the Betrayers", target = "Lieutenant Benedict", npc = 3192, oi = 3, map = 1411, x = 59.72, y = 58.27, f = "e" },
						{ t = "collect", item = 4882, itemName = "Benedict's Key", map = 1411, x = 59.72, y = 58.27, f = "e", from = "Lieutenant Benedict", fromKind = "npc", fromFaction = "A" },
						{ t = "collect", item = 4881, itemName = "Aged Envelope", map = 1411, x = 59.3, y = 57.6, f = "e", from = "Benedict's Chest", fromKind = "object" },
						{ t = "accept", quest = 830, title = "The Admiral's Orders", item = 4881, itemName = "Aged Envelope", minLevel = 1, qlvl = 7 },
					},
				},
				{
					title = "Razor Hill",
					goals = {
						{ t = "turnin", quest = 96822, title = "For Honor", npc = 266940, npcName = "Turroc", map = 1411, x = 53.94, y = 42.6, f = "e", note = "Turroc" },
						{ t = "turnin", quest = 784, title = "Vanquish the Betrayers", npc = 3139, npcName = "Gar'Thok", map = 1411, x = 51.95, y = 43.5, f = "e", note = "Gar'Thok" },
						{ t = "turnin", quest = 830, title = "The Admiral's Orders", npc = 3139, npcName = "Gar'Thok", map = 1411, x = 51.95, y = 43.5, f = "e" },
						{ t = "accept", quest = 825, title = "From The Wreckage....", npc = 3139, npcName = "Gar'Thok", minLevel = 3, qlvl = 8, pre = { 784 }, preTitles = { [784] = "Vanquish the Betrayers" }, map = 1411, x = 51.95, y = 43.5, f = "e" },
						{ t = "turnin", quest = 791, title = "Carry Your Weight", npc = 3147, npcName = "Furl Scornbrow", map = 1411, x = 49.88, y = 40.39, f = "e", note = "Furl Scornbrow" },
						{ t = "train", class = true, candidates = { { npc = 3171, npcName = "Thotar", map = 1411, x = 51.85, y = 43.49, f = "e", faction = "H", classes = { "HUNTER" } }, { npc = 3170, npcName = "Kaplak", map = 1411, x = 51.98, y = 43.69, f = "e", faction = "H", classes = { "ROGUE" } }, { npc = 3169, npcName = "Tarshaw Jaggedscar", map = 1411, x = 54.19, y = 42.47, f = "e", faction = "H", classes = { "WARRIOR" } }, { npc = 3172, npcName = "Dhugru Gorelust", map = 1411, x = 54.38, y = 41.2, f = "e", faction = "H", classes = { "WARLOCK" } }, { npc = 3706, npcName = "Tai'jin", map = 1411, x = 54.26, y = 42.93, f = "e", faction = "H", classes = { "PRIEST" } }, { npc = 3173, npcName = "Swart", map = 1411, x = 54.42, y = 42.59, f = "e", faction = "H", classes = { "SHAMAN" } }, { npc = 3155, npcName = "Rwag", map = 1411, x = 41.28, y = 68, f = "e", faction = "H", classes = { "ROGUE" } }, { npc = 3707, npcName = "Ken'jai", map = 1411, x = 42.36, y = 68.81, f = "e", faction = "H", classes = { "PRIEST" } }, { npc = 5884, npcName = "Mai'ah", map = 1411, x = 42.51, y = 69.04, f = "e", faction = "H", classes = { "MAGE" } }, { npc = 3157, npcName = "Shikrik", map = 1411, x = 42.39, y = 69, f = "e", faction = "H", classes = { "SHAMAN" } }, { npc = 3154, npcName = "Jen'shan", map = 1411, x = 42.84, y = 69.33, f = "e", faction = "H", classes = { "HUNTER" } }, { npc = 3153, npcName = "Frang", map = 1411, x = 42.89, y = 69.44, f = "e", faction = "H", classes = { "WARRIOR" } }, { npc = 3156, npcName = "Nartok", map = 1411, x = 40.65, y = 68.52, f = "e", faction = "H", classes = { "WARLOCK" } }, { npc = 7311, npcName = "Uthel'nay", map = 1454, x = 39.16, y = 86.27, f = "e", faction = "H", classes = { "MAGE" } }, { npc = 6018, npcName = "Ur'kyo", map = 1454, x = 35.59, y = 87.82, f = "e", faction = "H", classes = { "PRIEST" } }, { npc = 5880, npcName = "Un'Thuwa", map = 1411, x = 56.31, y = 75.11, f = "e", faction = "H", classes = { "MAGE" } }, { npc = 3328, npcName = "Ormok", map = 1454, x = 43.9, y = 54.63, f = "e", faction = "H", classes = { "ROGUE" } }, { npc = 3325, npcName = "Mirket", map = 1454, x = 48.62, y = 46.95, f = "e", faction = "H", classes = { "WARLOCK" } }, { npc = 3344, npcName = "Kardris Dreamseeker", map = 1454, x = 38.8, y = 36.37, f = "e", faction = "H", classes = { "SHAMAN" } }, { npc = 3354, npcName = "Sorek", map = 1454, x = 80.39, y = 32.38, f = "e", faction = "H", classes = { "WARRIOR" } }, { npc = 3406, npcName = "Xor'juul", map = 1454, x = 67.24, y = 20.2, f = "e", faction = "H", classes = { "HUNTER" } }, { npc = 3034, npcName = "Sheal Runetotem", map = 1456, x = 77.14, y = 27.02, f = "e", faction = "H", classes = { "DRUID" } }, { npc = 3040, npcName = "Urek Thunderhorn", map = 1456, x = 59.13, y = 86.87, f = "e", faction = "H", classes = { "HUNTER" } }, { npc = 3043, npcName = "Ker Ragetotem", map = 1456, x = 57.58, y = 85.5, f = "e", faction = "H", classes = { "WARRIOR" } }, { npc = 3065, npcName = "Yaw Sharpmane", map = 1412, x = 46.93, y = 59.65, faction = "H", classes = { "HUNTER" } }, { npc = 3048, npcName = "Ursyn Ghull", map = 1456, x = 25.7, y = 14.19, f = "e", faction = "H", classes = { "MAGE" } }, { npc = 246344, npcName = "Alodan the Hopeful", map = 1456, x = 25.6, y = 14.8, f = "e", faction = "H", classes = { "PALADIN" } }, { npc = 3044, npcName = "Miles Welsh", map = 1456, x = 25.32, y = 15.27, f = "e", faction = "H", classes = { "PRIEST" } }, { npc = 3063, npcName = "Krang Stonehoof", map = 1412, x = 48.35, y = 63.74, faction = "H", classes = { "WARRIOR" } }, { npc = 3031, npcName = "Tigor Skychaser", map = 1456, x = 23.64, y = 18.79, f = "e", faction = "H", classes = { "SHAMAN" } }, { npc = 3066, npcName = "Narm Skychaser", map = 1412, x = 47.4, y = 62.54, faction = "H", classes = { "SHAMAN" } }, { npc = 3064, npcName = "Gennia Runetotem", map = 1412, x = 47.48, y = 62.95, faction = "H", classes = { "DRUID" } }, { npc = 3060, npcName = "Gart Mistrunner", map = 1412, x = 44.65, y = 76.55, faction = "H", classes = { "DRUID" } }, { npc = 3062, npcName = "Meela Dawnstrider", map = 1412, x = 44.58, y = 76.56, faction = "H", classes = { "SHAMAN" } }, { npc = 3061, npcName = "Lanka Farshot", map = 1412, x = 43.96, y = 76.35, faction = "H", classes = { "HUNTER" } }, { npc = 3059, npcName = "Harutt Thunderhorn", map = 1412, x = 43.75, y = 76.72, faction = "H", classes = { "WARRIOR" } }, { npc = 2119, npcName = "Dannal Stern", map = 1420, x = 32.69, y = 65.56, f = "e", faction = "H", classes = { "WARRIOR" } }, { npc = 2122, npcName = "David Trias", map = 1420, x = 32.53, y = 65.65, f = "e", faction = "H", classes = { "ROGUE" } }, { npc = 2123, npcName = "Dark Cleric Duesten", map = 1420, x = 31.11, y = 66.03, f = "e", faction = "H", classes = { "PRIEST" } }, { npc = 2124, npcName = "Isabella", map = 1420, x = 30.93, y = 66.06, f = "e", faction = "H", classes = { "MAGE" } }, { npc = 2126, npcName = "Maximillion", map = 1420, x = 30.91, y = 66.34, f = "e", faction = "H", classes = { "WARLOCK" } }, { npc = 2127, npcName = "Rupert Boch", map = 1420, x = 61.59, y = 52.4, f = "e", faction = "H", classes = { "WARLOCK" } }, { npc = 2128, npcName = "Cain Firesong", map = 1420, x = 61.97, y = 52.47, f = "e", faction = "H", classes = { "MAGE" } }, { npc = 2129, npcName = "Dark Cleric Beryl", map = 1420, x = 61.57, y = 52.19, f = "e", faction = "H", classes = { "PRIEST" } }, { npc = 2130, npcName = "Marion Call", map = 1420, x = 61.75, y = 52, f = "e", faction = "H", classes = { "ROGUE" } }, { npc = 2131, npcName = "Austil de Mon", map = 1420, x = 61.85, y = 52.54, f = "e", faction = "H", classes = { "WARRIOR" } }, { npc = 244808, npcName = "Aramis Hammerhand", map = 1420, x = 31.09, y = 66.32, f = "e", faction = "H", classes = { "PALADIN" } }, { npc = 246152, npcName = "Shari Stilwell", map = 1420, x = 60.25, y = 52.63, f = "e", faction = "H", classes = { "PALADIN" } }, { npc = 246389, npcName = "Hilda the Breaker", map = 1420, x = 21.92, y = 47.19, f = "e", faction = "H", classes = { "PALADIN" } }, { npc = 4563, npcName = "Kaal Soulreaper", map = 1458, x = 86.21, y = 15.93, f = "e", faction = "H", classes = { "WARLOCK" } }, { npc = 4566, npcName = "Kaelystia Hatebringer", map = 1458, x = 85.02, y = 14.02, f = "e", faction = "H", classes = { "MAGE" } }, { npc = 4582, npcName = "Carolyn Ward", map = 1458, x = 83.86, y = 72.07, f = "e", faction = "H", classes = { "ROGUE" } }, { npc = 4593, npcName = "Christoph Walker", map = 1458, x = 46.93, y = 15.23, f = "e", faction = "H", classes = { "WARRIOR" } }, { npc = 4606, npcName = "Aelthalyste", map = 1458, x = 49.26, y = 17.12, f = "e", faction = "H", classes = { "PRIEST" } }, { npc = 260093, npcName = "Garen Largo", map = 1458, x = 47.49, y = 15.23, f = "e", faction = "H", classes = { "PALADIN" } }, { npc = 251373, npcName = "Xyton Silverwind", map = 2521, x = 41.72, y = 23.38, faction = "AH", classes = { "DRUID" } }, { npc = 251374, npcName = "Windshaper Boro", map = 2521, x = 42.76, y = 23.58, faction = "H", classes = { "SHAMAN" } }, { npc = 251376, npcName = "Tai'ree Farsight", map = 2521, x = 42.44, y = 23.68, faction = "AH", classes = { "HUNTER" } }, { npc = 251389, npcName = "Akeri Duskblade", map = 2521, x = 43.71, y = 24.3, faction = "AH", classes = { "ROGUE" } }, { npc = 251964, npcName = "Blademaster Ren", map = 2521, x = 43.68, y = 24.17, faction = "AH", classes = { "WARRIOR" } } } },
					},
				},
				{
					title = "Rezlak",
					note = "Follow the road north toward Orgrimmar. Rezlak camps beside it; the stolen sacks lie along the road south of him.",
					goals = {
						{ t = "accept", quest = 834, title = "Winds in the Desert", npc = 3293, npcName = "Rezlak", minLevel = 7, qlvl = 9, map = 1411, x = 46.37, y = 22.94, f = "e", note = "Rezlak" },
						{ t = "collect", quest = 834, title = "Winds in the Desert", item = 4918, itemName = "Sack of Supplies", count = 5, oi = 1, map = 1411, x = 49.1, y = 22.59, f = "e", spots = { { x = 49.7, y = 23.3, r = 50, n = 4 }, { x = 50.3, y = 26.5, r = 36, n = 4 }, { x = 47.5, y = 30.9, r = 53, n = 3 }, { x = 48.4, y = 33.5, r = 58, n = 5 }, { x = 51.7, y = 27.8, r = 15, n = 1, alt = true }, { x = 49.6, y = 32.1, r = 15, n = 1, alt = true } } },
						{ t = "turnin", quest = 834, title = "Winds in the Desert", npc = 3293, npcName = "Rezlak", map = 1411, x = 46.37, y = 22.94, f = "e", note = "Rezlak" },
						{ t = "accept", quest = 835, title = "Securing the Lines", npc = 3293, npcName = "Rezlak", minLevel = 7, qlvl = 11, pre = { 834 }, preTitles = { [834] = "Winds in the Desert" }, map = 1411, x = 46.37, y = 22.94, f = "e" },
					},
				},
				{
					title = "Drygulch Ravine",
					note = "Savages and Storm Witches nest in Drygulch Ravine, east of Rezlak. A Storm Witch drops the Dull Storm Orb.",
					goals = {
						{ t = "kill", quest = 835, title = "Securing the Lines", target = "Dustwind Savage", npc = 3117, count = 12, oi = 1, map = 1411, x = 51.43, y = 20.86, f = "e", spots = { { x = 52.1, y = 21, r = 37, n = 3 }, { x = 52.6, y = 24.2, r = 44, n = 4 }, { x = 53.9, y = 22.7, r = 32, n = 3 }, { x = 54, y = 25.3, r = 37, n = 3 }, { x = 54, y = 27.6, r = 15, n = 2 } } },
						{ t = "kill", quest = 835, title = "Securing the Lines", target = "Dustwind Storm Witch", npc = 3118, count = 8, oi = 2, map = 1411, x = 51.34, y = 20.19, f = "e", spots = { { x = 51.4, y = 19.6, r = 23, n = 5 }, { x = 51.6, y = 22.8, r = 54, n = 6 }, { x = 53.7, y = 22, r = 27, n = 2 }, { x = 53.2, y = 24, r = 15, n = 3 } } },
						{ t = "collect", item = 277661, itemName = "Dull Storm Orb", map = 1411, x = 51.34, y = 20.19, f = "e", spots = { { x = 51.4, y = 20, r = 60, n = 10 }, { x = 51.6, y = 23.6, r = 35, n = 6 }, { x = 53.7, y = 22, r = 27, n = 2 }, { x = 53.2, y = 24, r = 15, n = 3 } } },
						{ t = "accept", quest = 97281, title = "A Simmering Storm", item = 277661, itemName = "Dull Storm Orb", minLevel = 7, qlvl = 11 },
					},
				},
				{
					title = "Rezlak",
					goals = {
						{ t = "turnin", quest = 835, title = "Securing the Lines", npc = 3293, npcName = "Rezlak", map = 1411, x = 46.37, y = 22.94, f = "e" },
						{ t = "turnin", quest = 97281, title = "A Simmering Storm", npc = 3293, npcName = "Rezlak", map = 1411, x = 46.37, y = 22.94, f = "e" },
						{ t = "accept", quest = 97282, title = "Stormy Potential", npc = 3293, npcName = "Rezlak", minLevel = 7, qlvl = 11, map = 1411, x = 46.37, y = 22.94, f = "e" },
					},
				},
				{
					title = "Thunder lizards",
					note = "Thunder Lizards and Lightning Hides graze on Thunder Ridge, just west and south-west of Rezlak.",
					goals = {
						{ t = "collect", quest = 97282, title = "Stormy Potential", item = 277665, itemName = "Charged Thunder Lizard Organ", count = 5, oi = 1, map = 1411, x = 43.63, y = 24.14, f = "e", spots = { { x = 42.8, y = 24.2, r = 44, n = 5 }, { x = 40.4, y = 24.1, r = 54, n = 4 }, { x = 39.2, y = 25.6, r = 36, n = 3 }, { x = 40.3, y = 29, r = 48, n = 5 }, { x = 39.1, y = 30, r = 53, n = 5 } } },
					},
				},
				{
					title = "Rezlak",
					goals = {
						{ t = "turnin", quest = 97282, title = "Stormy Potential", npc = 3293, npcName = "Rezlak", map = 1411, x = 46.37, y = 22.94, f = "e" },
					},
				},
				{
					title = "Misha Tor'kren",
					note = "Misha's hut stands south of the lizards. The crocolisks along the Southfury River to the west carry Kron's Amulet.",
					goals = {
						{ t = "accept", quest = 816, title = "Lost But Not Forgotten", npc = 3193, npcName = "Misha Tor'kren", minLevel = 8, qlvl = 11, map = 1411, x = 43.1, y = 30.24, f = "e" },
						{ t = "collect", quest = 816, title = "Lost But Not Forgotten", item = 4891, itemName = "Kron's Amulet", oi = 1, map = 1411, x = 35.24, y = 30.11, f = "e", spots = { { x = 35.3, y = 29.2, r = 43, n = 2 }, { x = 35.3, y = 25.4, r = 43, n = 3 }, { x = 36.7, y = 22.2, r = 43, n = 2 }, { x = 36.9, y = 16.5, r = 43, n = 2 }, { x = 35.1, y = 39.2, r = 43, n = 1 }, { x = 34.4, y = 44.2, r = 43, n = 1 }, { x = 34.2, y = 47.1, r = 43, n = 2 }, { x = 34.6, y = 53.2, r = 43, n = 4 }, { x = 35.4, y = 56.7, r = 43, n = 2 }, { x = 36.6, y = 61.7, r = 43, n = 2 }, { x = 37.5, y = 67.1, r = 43, n = 2 } }, spread = true },
						{ t = "turnin", quest = 816, title = "Lost But Not Forgotten", npc = 3193, npcName = "Misha Tor'kren", map = 1411, x = 43.1, y = 30.24, f = "e" },
						{ t = "hearth", location = "Razor Hill" },
					},
				},
				{
					title = "The wreckage",
					note = "The gnomish toolboxes lie in the wreckage along the shore east and south-east of Razor Hill. Follow the shore south to Sen'jin.",
					goals = {
						{ t = "collect", quest = 825, title = "From The Wreckage....", item = 4863, itemName = "Gnomish Tools", count = 3, oi = 1, map = 1411, x = 61.94, y = 42.35, f = "e", spots = { { x = 62, y = 42, r = 40, n = 2 }, { x = 62.1, y = 46, r = 40, n = 3 }, { x = 64.3, y = 50.2, r = 40, n = 3 }, { x = 64.3, y = 53.4, r = 40, n = 3 }, { x = 63.4, y = 57.2, r = 40, n = 3 }, { x = 61.9, y = 56, r = 40, n = 3 }, { x = 62.3, y = 60.4, r = 40, n = 3 } }, spread = true },
					},
				},
				{
					title = "Sen'jin Village",
					goals = {
						{ t = "accept", quest = 96873, title = "A Pain in the Neck", npc = 266881, npcName = "Pa'zula", minLevel = 5, qlvl = 8, map = 1411, x = 56.67, y = 73.75, f = "e", note = "Pa'zula" },
						{ t = "accept", quest = 817, title = "Practical Prey", npc = 3194, npcName = "Vel'rin Fang", minLevel = 5, qlvl = 8, map = 1411, x = 55.96, y = 73.93, f = "e", note = "Vel'rin Fang" },
						{ t = "accept", quest = 818, title = "A Solvent Spirit", npc = 3304, npcName = "Master Vornal", minLevel = 5, qlvl = 7, map = 1411, x = 55.94, y = 74.39, f = "e", note = "Master Vornal" },
						{ t = "accept", quest = 97225, title = "Forgotten Loa Idols", npc = 3304, npcName = "Master Vornal", minLevel = 4, qlvl = 9, map = 1411, x = 55.94, y = 74.39, f = "e" },
						{ t = "accept", quest = 826, title = "Zalazane", npc = 3188, npcName = "Master Gadrin", minLevel = 4, qlvl = 10, map = 1411, x = 55.95, y = 74.72, f = "e", note = "Master Gadrin" },
						{ t = "accept", quest = 823, title = "Report to Orgnil", npc = 3188, npcName = "Master Gadrin", minLevel = 4, qlvl = 7, map = 1411, x = 55.95, y = 74.72, f = "e" },
						{ t = "accept", quest = 808, title = "Minshina's Skull", npc = 3188, npcName = "Master Gadrin", minLevel = 4, qlvl = 9, map = 1411, x = 55.95, y = 74.72, f = "e" },
						{ t = "accept", quest = 786, title = "Thwarting Kolkar Aggression", npc = 3140, npcName = "Lar Prowltusk", minLevel = 5, qlvl = 8, map = 1411, x = 54.44, y = 74.35, f = "e", note = "Lar Prowltusk" },
						{ t = "accept", quest = 97223, title = "Bloodtalon Matriarch", npc = 7953, npcName = "Xar'Ti", minLevel = 5, qlvl = 8, map = 1411, x = 55.28, y = 75.49, f = "e", note = "Xar'Ti" },
					},
				},
				{
					title = "Makrura and crawlers",
					note = "Makrura and surf crawlers line the beaches north-east of Sen'jin.",
					goals = {
						{ t = "collect", quest = 818, title = "A Solvent Spirit", item = 4887, itemName = "Intact Makrura Eye", count = 4, oi = 1, map = 1411, x = 57.34, y = 80.02, f = "e", spots = { { x = 58.2, y = 81.1, r = 63, n = 2 }, { x = 52.7, y = 84.9, r = 69, n = 3 }, { x = 60.9, y = 96.3, r = 63, n = 1 }, { x = 70.1, y = 87.3, r = 63, n = 2 }, { x = 71.7, y = 72.6, r = 63, n = 1 }, { x = 63.4, y = 73.8, r = 63, n = 1 }, { x = 63.4, y = 59.3, r = 72, n = 4 }, { x = 61.5, y = 52.6, r = 63, n = 2 }, { x = 62.3, y = 45.6, r = 63, n = 3 }, { x = 60.1, y = 28.4, r = 72, n = 3 }, { x = 58, y = 9.8, r = 63, n = 2 }, { x = 39.1, y = 75.6, r = 63, n = 3 }, { x = 55.1, y = 82.9, r = 63, n = 1, alt = true }, { x = 61.4, y = 78.9, r = 63, n = 2, alt = true }, { x = 58.9, y = 86.6, r = 64, n = 3, alt = true }, { x = 61, y = 84.7, r = 63, n = 1, alt = true }, { x = 60.3, y = 73.1, r = 94, n = 5, alt = true }, { x = 59.2, y = 91.5, r = 63, n = 1, alt = true }, { x = 61.9, y = 68.5, r = 63, n = 3, alt = true }, { x = 66.2, y = 77.5, r = 84, n = 3, alt = true }, { x = 62.2, y = 92.5, r = 63, n = 1, alt = true }, { x = 65.8, y = 72.7, r = 63, n = 2, alt = true }, { x = 69.7, y = 76.6, r = 74, n = 3, alt = true }, { x = 70.5, y = 82.3, r = 63, n = 1, alt = true }, { x = 64.1, y = 55.3, r = 89, n = 5, alt = true }, { x = 61.8, y = 49.2, r = 63, n = 2, alt = true }, { x = 64.7, y = 50.4, r = 65, n = 5, alt = true }, { x = 61.6, y = 41.4, r = 102, n = 6, alt = true }, { x = 60.7, y = 22, r = 63, n = 2, alt = true }, { x = 59.7, y = 16, r = 111, n = 5, alt = true } }, spread = true },
						{ t = "collect", quest = 818, title = "A Solvent Spirit", item = 4888, itemName = "Crawler Mucus", count = 8, oi = 2, map = 1411, x = 58.19, y = 78.81, f = "e", spots = { { x = 57.5, y = 78.7, r = 43, n = 3 }, { x = 61.3, y = 87.1, r = 43, n = 2 }, { x = 64.2, y = 97.6, r = 50, n = 3 }, { x = 69.6, y = 87.5, r = 43, n = 1 }, { x = 64.1, y = 72.9, r = 65, n = 3 }, { x = 70.5, y = 69, r = 43, n = 1 }, { x = 62.5, y = 61.8, r = 63, n = 3 }, { x = 66, y = 53.5, r = 43, n = 1 }, { x = 63, y = 44.5, r = 43, n = 3 }, { x = 59.4, y = 27.8, r = 43, n = 2 }, { x = 60.9, y = 17.7, r = 43, n = 1 }, { x = 57.9, y = 8.4, r = 43, n = 1 }, { x = 59.6, y = 81.3, r = 43, n = 1, alt = true }, { x = 56, y = 79.7, r = 43, n = 5, alt = true }, { x = 58.3, y = 83.5, r = 43, n = 1, alt = true }, { x = 59.8, y = 73.6, r = 43, n = 1, alt = true }, { x = 62.1, y = 80.9, r = 56, n = 4, alt = true }, { x = 54.5, y = 82.6, r = 49, n = 6, alt = true }, { x = 62.8, y = 76.6, r = 47, n = 3, alt = true }, { x = 59.5, y = 86, r = 43, n = 2, alt = true }, { x = 64.2, y = 78.9, r = 43, n = 1, alt = true }, { x = 52.4, y = 83.4, r = 57, n = 5, alt = true }, { x = 61, y = 69.9, r = 43, n = 1, alt = true }, { x = 66.1, y = 79.4, r = 43, n = 1, alt = true }, { x = 65.9, y = 74.4, r = 59, n = 3, alt = true }, { x = 62.1, y = 90.5, r = 43, n = 1, alt = true }, { x = 67.2, y = 75.9, r = 43, n = 2, alt = true }, { x = 60.3, y = 92.3, r = 43, n = 1, alt = true }, { x = 64.5, y = 89.5, r = 43, n = 2, alt = true }, { x = 66.1, y = 70.4, r = 43, n = 2, alt = true }, { x = 69, y = 78.5, r = 55, n = 3, alt = true }, { x = 64, y = 93.4, r = 62, n = 5, alt = true }, { x = 61.9, y = 94.9, r = 43, n = 1, alt = true }, { x = 69.7, y = 76.1, r = 43, n = 2, alt = true }, { x = 66.5, y = 91.1, r = 43, n = 2, alt = true }, { x = 67.9, y = 68.7, r = 43, n = 1, alt = true }, { x = 70.5, y = 80.1, r = 43, n = 1, alt = true }, { x = 71, y = 74, r = 43, n = 1, alt = true }, { x = 71.1, y = 71.5, r = 43, n = 1, alt = true }, { x = 63.3, y = 57.7, r = 43, n = 2, alt = true }, { x = 63.7, y = 54.8, r = 62, n = 4, alt = true }, { x = 61.3, y = 52.9, r = 43, n = 2, alt = true }, { x = 62.8, y = 51.6, r = 43, n = 1, alt = true }, { x = 60.7, y = 48.6, r = 58, n = 4, alt = true }, { x = 65.7, y = 50.1, r = 43, n = 2, alt = true }, { x = 63.5, y = 48.2, r = 48, n = 4, alt = true }, { x = 60.5, y = 44.1, r = 43, n = 3, alt = true }, { x = 61.5, y = 39.5, r = 43, n = 1, alt = true }, { x = 60.2, y = 23.9, r = 76, n = 6, alt = true }, { x = 59.1, y = 16.6, r = 43, n = 1, alt = true }, { x = 58.1, y = 14.5, r = 52, n = 4, alt = true }, { x = 57.1, y = 11, r = 73, n = 7, alt = true } }, spread = true },
					},
				},
				{
					title = "Bloodtalon Matriarch",
					note = "Wade across to the northern Echo Isle. The Matriarch prowls among the raptors there.",
					goals = {
						{ t = "collect", quest = 97223, title = "Bloodtalon Matriarch", item = 277128, itemName = "Bloodtalon Martriarch Eggs", oi = 1, map = 1411, x = 67.84, y = 72.84, f = "e", spots = { { x = 68.5, y = 71.9, r = 49, n = 9 } } },
					},
				},
				{
					title = "Echo Isles",
					note = "Head south through the isles. The Loa idols lie all over the southern isles; Voodoo and Hexed Trolls hold them and drop the Hexed Pendants. Zalazane and Minshina's cage are on the southernmost isle.",
					goals = {
						{ t = "collect", quest = 97225, title = "Forgotten Loa Idols", item = 277135, itemName = "Forgotten Loa Idol", count = 8, oi = 1, map = 1411, x = 67.8, y = 81.4, f = "e", spots = { { x = 67.5, y = 82.4, r = 45, n = 4 }, { x = 68.7, y = 84, r = 39, n = 4 }, { x = 65.1, y = 82.8, r = 28, n = 3 }, { x = 67.8, y = 86.1, r = 35, n = 2 }, { x = 65.1, y = 85.1, r = 47, n = 5 }, { x = 66, y = 87.8, r = 53, n = 4 } } },
						{ t = "kill", quest = 826, title = "Zalazane", target = "Voodoo Troll", npc = 3206, count = 8, oi = 1, map = 1411, x = 67.82, y = 82.06, f = "e", spots = { { x = 68.1, y = 83, r = 55, n = 5 }, { x = 67, y = 87.1, r = 59, n = 6 }, { x = 65.9, y = 82.8, r = 15, n = 1, alt = true } } },
						{ t = "kill", quest = 826, title = "Zalazane", target = "Hexed Troll", npc = 3207, count = 8, oi = 2, map = 1411, x = 68.29, y = 83.23, f = "e", spots = { { x = 68.2, y = 83.5, r = 30, n = 4 }, { x = 66.6, y = 84, r = 46, n = 3 }, { x = 67.3, y = 87, r = 62, n = 6 } } },
						{ t = "complete", quest = 96873, title = "A Pain in the Neck" },
						{ t = "collect", quest = 826, title = "Zalazane", item = 4866, itemName = "Zalazane's Head", oi = 3, map = 1411, x = 67.55, y = 87.81, f = "e" },
						{ t = "collect", quest = 808, title = "Minshina's Skull", item = 4864, itemName = "Minshina's Skull", oi = 1, map = 1411, x = 67.4, y = 87.8, f = "e" },
					},
				},
				{
					title = "South-east shore",
					note = "Wade back west to the shore south of Sen'jin. Durotar Tigers roam it and the Taillasher eggs sit in nests along the beach.",
					goals = {
						{ t = "collect", quest = 817, title = "Practical Prey", item = 4892, itemName = "Durotar Tiger Fur", count = 4, oi = 1, map = 1411, x = 69.14, y = 84.83, f = "e", spots = { { x = 69.1, y = 84.8, r = 49, n = 1 }, { x = 69.1, y = 80.3, r = 49, n = 1 }, { x = 65.3, y = 80.8, r = 49, n = 3 }, { x = 64.6, y = 85, r = 49, n = 1 }, { x = 65, y = 88.2, r = 49, n = 2 }, { x = 60.4, y = 91, r = 76, n = 4 }, { x = 63.3, y = 96.2, r = 60, n = 5 }, { x = 60, y = 83.4, r = 53, n = 3 }, { x = 60.2, y = 80, r = 49, n = 1 }, { x = 67.2, y = 70.7, r = 49, n = 1 }, { x = 69.2, y = 69.7, r = 49, n = 1 }, { x = 69.2, y = 73.2, r = 84, n = 5 }, { x = 61.2, y = 89.2, r = 49, n = 2, alt = true } }, spread = true },
						{ t = "collect", quest = 815, title = "Break a Few Eggs", item = 4890, itemName = "Taillasher Egg", count = 3, oi = 1, map = 1411, x = 69.23, y = 82.26, f = "e", spots = { { x = 68.6, y = 81.3, r = 72, n = 2 }, { x = 64.4, y = 83.1, r = 72, n = 2 }, { x = 61.1, y = 78.6, r = 72, n = 2 }, { x = 59.9, y = 83.3, r = 72, n = 2 }, { x = 59.8, y = 89.7, r = 72, n = 1 }, { x = 62.1, y = 96.2, r = 72, n = 1 }, { x = 68.3, y = 88.5, r = 72, n = 1 }, { x = 69.7, y = 74.6, r = 72, n = 1 }, { x = 68.4, y = 70.9, r = 76, n = 5 }, { x = 64, y = 73.8, r = 72, n = 2 } }, spread = true },
					},
				},
				{
					title = "Sen'jin Village",
					goals = {
						{ t = "turnin", quest = 96873, title = "A Pain in the Neck", npc = 266881, npcName = "Pa'zula", map = 1411, x = 56.67, y = 73.75, f = "e", note = "Pa'zula" },
						{ t = "turnin", quest = 817, title = "Practical Prey", npc = 3194, npcName = "Vel'rin Fang", map = 1411, x = 55.96, y = 73.93, f = "e", note = "Vel'rin Fang" },
						{ t = "turnin", quest = 818, title = "A Solvent Spirit", npc = 3304, npcName = "Master Vornal", map = 1411, x = 55.94, y = 74.39, f = "e", note = "Master Vornal" },
						{ t = "turnin", quest = 97225, title = "Forgotten Loa Idols", npc = 3188, npcName = "Master Gadrin", map = 1411, x = 55.95, y = 74.72, f = "e", note = "Master Gadrin" },
						{ t = "turnin", quest = 826, title = "Zalazane", npc = 3188, npcName = "Master Gadrin", map = 1411, x = 55.95, y = 74.72, f = "e" },
						{ t = "turnin", quest = 808, title = "Minshina's Skull", npc = 3188, npcName = "Master Gadrin", map = 1411, x = 55.95, y = 74.72, f = "e" },
						{ t = "turnin", quest = 97223, title = "Bloodtalon Matriarch", npc = 7953, npcName = "Xar'Ti", map = 1411, x = 55.28, y = 75.49, f = "e", note = "Xar'Ti" },
					},
				},
				{
					title = "Kolkar Crag",
					note = "Kolkar Crag lies west of Sen'jin. The three attack plans sit on the ground among the centaur tents. Pal'juh is held at the crag as well.",
					goals = {
						{ t = "interact", quest = 786, title = "Thwarting Kolkar Aggression", object = 3189, objName = "Attack Plan: Valley of Trials", oi = 1, map = 1411, x = 49.8, y = 81.3, f = "e" },
						{ t = "interact", quest = 786, title = "Thwarting Kolkar Aggression", object = 3190, objName = "Attack Plan: Sen'jin Village", oi = 2, map = 1411, x = 47.7, y = 77.3, f = "e" },
						{ t = "interact", quest = 786, title = "Thwarting Kolkar Aggression", object = 3192, objName = "Attack Plan: Orgrimmar", oi = 3, map = 1411, x = 46.2, y = 78.9, f = "e" },
						{ t = "accept", quest = 99123, title = "Lost in the Shadows", npc = 275811, npcName = "Pal'juh", minLevel = 4, qlvl = 8, map = 1411, x = 46.3, y = 78.7, f = "e" },
						{ t = "goto", text = "Kolkar Crag", map = 1411, x = 46.3, y = 78.7, f = "e", note = "Free Pal'juh and see her safely out of the crag" },
					},
				},
				{
					title = "Sen'jin Village",
					goals = {
						{ t = "turnin", quest = 786, title = "Thwarting Kolkar Aggression", npc = 3140, npcName = "Lar Prowltusk", map = 1411, x = 54.44, y = 74.35, f = "e", note = "Lar Prowltusk" },
						{ t = "turnin", quest = 99123, title = "Lost in the Shadows", npc = 3304, npcName = "Master Vornal", map = 1411, x = 55.94, y = 74.39, f = "e", note = "Master Vornal" },
					},
				},
				{
					title = "Razor Hill",
					note = "Follow the road north to Razor Hill.",
					goals = {
						{ t = "turnin", quest = 825, title = "From The Wreckage....", npc = 3139, npcName = "Gar'Thok", map = 1411, x = 51.95, y = 43.5, f = "e", note = "Gar'Thok" },
						{ t = "turnin", quest = 815, title = "Break a Few Eggs", npc = 3191, npcName = "Cook Torka", map = 1411, x = 51.11, y = 42.45, f = "e", note = "Cook Torka" },
						{ t = "turnin", quest = 823, title = "Report to Orgnil", npc = 3142, npcName = "Orgnil Soulscar", map = 1411, x = 52.24, y = 43.15, f = "e", note = "Orgnil Soulscar" },
						{ t = "accept", quest = 806, title = "Dark Storms", npc = 3142, npcName = "Orgnil Soulscar", minLevel = 4, qlvl = 12, pre = { 823 }, preTitles = { [823] = "Report to Orgnil" }, map = 1411, x = 52.24, y = 43.15, f = "e" },
						{ t = "accept", quest = 99048, title = "A Missing Hand", npc = 3142, npcName = "Orgnil Soulscar", minLevel = 9, qlvl = 11, map = 1411, x = 52.24, y = 43.15, f = "e" },
						{ t = "accept", quest = 99051, title = "Threat from Below", npc = 3142, npcName = "Orgnil Soulscar", minLevel = 9, qlvl = 11, map = 1411, x = 52.24, y = 43.15, f = "e" },
						{ t = "accept", quest = 840, title = "Conscript of the Horde", npc = 3336, npcName = "Takrin Pathseeker", minLevel = 10, qlvl = 12, map = 1411, x = 50.84, y = 43.59, f = "e", note = "Takrin Pathseeker" },
						{ t = "train", class = true, candidates = { { npc = 3171, npcName = "Thotar", map = 1411, x = 51.85, y = 43.49, f = "e", faction = "H", classes = { "HUNTER" } }, { npc = 3170, npcName = "Kaplak", map = 1411, x = 51.98, y = 43.69, f = "e", faction = "H", classes = { "ROGUE" } }, { npc = 3169, npcName = "Tarshaw Jaggedscar", map = 1411, x = 54.19, y = 42.47, f = "e", faction = "H", classes = { "WARRIOR" } }, { npc = 3706, npcName = "Tai'jin", map = 1411, x = 54.26, y = 42.93, f = "e", faction = "H", classes = { "PRIEST" } }, { npc = 3173, npcName = "Swart", map = 1411, x = 54.42, y = 42.59, f = "e", faction = "H", classes = { "SHAMAN" } }, { npc = 3172, npcName = "Dhugru Gorelust", map = 1411, x = 54.38, y = 41.2, f = "e", faction = "H", classes = { "WARLOCK" } }, { npc = 3707, npcName = "Ken'jai", map = 1411, x = 42.36, y = 68.81, f = "e", faction = "H", classes = { "PRIEST" } }, { npc = 3155, npcName = "Rwag", map = 1411, x = 41.28, y = 68, f = "e", faction = "H", classes = { "ROGUE" } }, { npc = 5884, npcName = "Mai'ah", map = 1411, x = 42.51, y = 69.04, f = "e", faction = "H", classes = { "MAGE" } }, { npc = 3157, npcName = "Shikrik", map = 1411, x = 42.39, y = 69, f = "e", faction = "H", classes = { "SHAMAN" } }, { npc = 3154, npcName = "Jen'shan", map = 1411, x = 42.84, y = 69.33, f = "e", faction = "H", classes = { "HUNTER" } }, { npc = 3153, npcName = "Frang", map = 1411, x = 42.89, y = 69.44, f = "e", faction = "H", classes = { "WARRIOR" } }, { npc = 3156, npcName = "Nartok", map = 1411, x = 40.65, y = 68.52, f = "e", faction = "H", classes = { "WARLOCK" } }, { npc = 5880, npcName = "Un'Thuwa", map = 1411, x = 56.31, y = 75.11, f = "e", faction = "H", classes = { "MAGE" } }, { npc = 7311, npcName = "Uthel'nay", map = 1454, x = 39.16, y = 86.27, f = "e", faction = "H", classes = { "MAGE" } }, { npc = 6018, npcName = "Ur'kyo", map = 1454, x = 35.59, y = 87.82, f = "e", faction = "H", classes = { "PRIEST" } }, { npc = 3328, npcName = "Ormok", map = 1454, x = 43.9, y = 54.63, f = "e", faction = "H", classes = { "ROGUE" } }, { npc = 3325, npcName = "Mirket", map = 1454, x = 48.62, y = 46.95, f = "e", faction = "H", classes = { "WARLOCK" } }, { npc = 3354, npcName = "Sorek", map = 1454, x = 80.39, y = 32.38, f = "e", faction = "H", classes = { "WARRIOR" } }, { npc = 3344, npcName = "Kardris Dreamseeker", map = 1454, x = 38.8, y = 36.37, f = "e", faction = "H", classes = { "SHAMAN" } }, { npc = 3406, npcName = "Xor'juul", map = 1454, x = 67.24, y = 20.2, f = "e", faction = "H", classes = { "HUNTER" } }, { npc = 3034, npcName = "Sheal Runetotem", map = 1456, x = 77.14, y = 27.02, f = "e", faction = "H", classes = { "DRUID" } }, { npc = 3040, npcName = "Urek Thunderhorn", map = 1456, x = 59.13, y = 86.87, f = "e", faction = "H", classes = { "HUNTER" } }, { npc = 3043, npcName = "Ker Ragetotem", map = 1456, x = 57.58, y = 85.5, f = "e", faction = "H", classes = { "WARRIOR" } }, { npc = 3065, npcName = "Yaw Sharpmane", map = 1412, x = 46.93, y = 59.65, faction = "H", classes = { "HUNTER" } }, { npc = 3063, npcName = "Krang Stonehoof", map = 1412, x = 48.35, y = 63.74, faction = "H", classes = { "WARRIOR" } }, { npc = 3066, npcName = "Narm Skychaser", map = 1412, x = 47.4, y = 62.54, faction = "H", classes = { "SHAMAN" } }, { npc = 3064, npcName = "Gennia Runetotem", map = 1412, x = 47.48, y = 62.95, faction = "H", classes = { "DRUID" } }, { npc = 3048, npcName = "Ursyn Ghull", map = 1456, x = 25.7, y = 14.19, f = "e", faction = "H", classes = { "MAGE" } }, { npc = 246344, npcName = "Alodan the Hopeful", map = 1456, x = 25.6, y = 14.8, f = "e", faction = "H", classes = { "PALADIN" } }, { npc = 3044, npcName = "Miles Welsh", map = 1456, x = 25.32, y = 15.27, f = "e", faction = "H", classes = { "PRIEST" } }, { npc = 3031, npcName = "Tigor Skychaser", map = 1456, x = 23.64, y = 18.79, f = "e", faction = "H", classes = { "SHAMAN" } }, { npc = 3060, npcName = "Gart Mistrunner", map = 1412, x = 44.65, y = 76.55, faction = "H", classes = { "DRUID" } }, { npc = 3062, npcName = "Meela Dawnstrider", map = 1412, x = 44.58, y = 76.56, faction = "H", classes = { "SHAMAN" } }, { npc = 3061, npcName = "Lanka Farshot", map = 1412, x = 43.96, y = 76.35, faction = "H", classes = { "HUNTER" } }, { npc = 3059, npcName = "Harutt Thunderhorn", map = 1412, x = 43.75, y = 76.72, faction = "H", classes = { "WARRIOR" } }, { npc = 2119, npcName = "Dannal Stern", map = 1420, x = 32.69, y = 65.56, f = "e", faction = "H", classes = { "WARRIOR" } }, { npc = 2122, npcName = "David Trias", map = 1420, x = 32.53, y = 65.65, f = "e", faction = "H", classes = { "ROGUE" } }, { npc = 2123, npcName = "Dark Cleric Duesten", map = 1420, x = 31.11, y = 66.03, f = "e", faction = "H", classes = { "PRIEST" } }, { npc = 2124, npcName = "Isabella", map = 1420, x = 30.93, y = 66.06, f = "e", faction = "H", classes = { "MAGE" } }, { npc = 2126, npcName = "Maximillion", map = 1420, x = 30.91, y = 66.34, f = "e", faction = "H", classes = { "WARLOCK" } }, { npc = 2127, npcName = "Rupert Boch", map = 1420, x = 61.59, y = 52.4, f = "e", faction = "H", classes = { "WARLOCK" } }, { npc = 2128, npcName = "Cain Firesong", map = 1420, x = 61.97, y = 52.47, f = "e", faction = "H", classes = { "MAGE" } }, { npc = 2129, npcName = "Dark Cleric Beryl", map = 1420, x = 61.57, y = 52.19, f = "e", faction = "H", classes = { "PRIEST" } }, { npc = 2130, npcName = "Marion Call", map = 1420, x = 61.75, y = 52, f = "e", faction = "H", classes = { "ROGUE" } }, { npc = 2131, npcName = "Austil de Mon", map = 1420, x = 61.85, y = 52.54, f = "e", faction = "H", classes = { "WARRIOR" } }, { npc = 244808, npcName = "Aramis Hammerhand", map = 1420, x = 31.09, y = 66.32, f = "e", faction = "H", classes = { "PALADIN" } }, { npc = 246152, npcName = "Shari Stilwell", map = 1420, x = 60.25, y = 52.63, f = "e", faction = "H", classes = { "PALADIN" } }, { npc = 246389, npcName = "Hilda the Breaker", map = 1420, x = 21.92, y = 47.19, f = "e", faction = "H", classes = { "PALADIN" } }, { npc = 4563, npcName = "Kaal Soulreaper", map = 1458, x = 86.21, y = 15.93, f = "e", faction = "H", classes = { "WARLOCK" } }, { npc = 4566, npcName = "Kaelystia Hatebringer", map = 1458, x = 85.02, y = 14.02, f = "e", faction = "H", classes = { "MAGE" } }, { npc = 4582, npcName = "Carolyn Ward", map = 1458, x = 83.86, y = 72.07, f = "e", faction = "H", classes = { "ROGUE" } }, { npc = 4593, npcName = "Christoph Walker", map = 1458, x = 46.93, y = 15.23, f = "e", faction = "H", classes = { "WARRIOR" } }, { npc = 4606, npcName = "Aelthalyste", map = 1458, x = 49.26, y = 17.12, f = "e", faction = "H", classes = { "PRIEST" } }, { npc = 260093, npcName = "Garen Largo", map = 1458, x = 47.49, y = 15.23, f = "e", faction = "H", classes = { "PALADIN" } }, { npc = 251373, npcName = "Xyton Silverwind", map = 2521, x = 41.72, y = 23.38, faction = "AH", classes = { "DRUID" } }, { npc = 251374, npcName = "Windshaper Boro", map = 2521, x = 42.76, y = 23.58, faction = "H", classes = { "SHAMAN" } }, { npc = 251376, npcName = "Tai'ree Farsight", map = 2521, x = 42.44, y = 23.68, faction = "AH", classes = { "HUNTER" } }, { npc = 251389, npcName = "Akeri Duskblade", map = 2521, x = 43.71, y = 24.3, faction = "AH", classes = { "ROGUE" } }, { npc = 251964, npcName = "Blademaster Ren", map = 2521, x = 43.68, y = 24.17, faction = "AH", classes = { "WARRIOR" } } } },
						{ t = "accept", quest = 1505, title = "Veteran Uzzek", npc = 3169, npcName = "Tarshaw Jaggedscar", minLevel = 10, qlvl = 10, closedBy = { 1498, 1818, 1819 }, preTitles = { [1498] = "Path of Defense", [1818] = "Speak with Dillinger", [1819] = "Ulag the Cleaver" }, map = 1411, x = 54.19, y = 42.47, f = "e", only = { classes = { "WARRIOR" } }, note = "Tarshaw Jaggedscar" },
						{ t = "accept", quest = 2983, title = "Call of Fire", npc = 3173, npcName = "Swart", minLevel = 10, qlvl = 10, closedBy = { 1524, 1522, 1523, 2984 }, preTitles = { [1522] = "Call of Fire", [1523] = "Call of Fire", [1524] = "Call of Fire", [2984] = "Call of Fire" }, map = 1411, x = 54.42, y = 42.59, f = "e", only = { classes = { "SHAMAN" } }, note = "Swart" },
						{ t = "accept", quest = 6062, title = "Taming the Beast", npc = 3171, npcName = "Thotar", minLevel = 10, qlvl = 10, map = 1411, x = 51.85, y = 43.49, f = "e", only = { classes = { "HUNTER" } }, note = "Thotar" },
						{ t = "accept", quest = 1506, title = "Gan'rul's Summons", npc = 3294, npcName = "Ophek", minLevel = 10, qlvl = 10, closedBy = { 1501, 1478 }, preTitles = { [1478] = "Halgar's Summons", [1501] = "Creature of the Void" }, map = 1411, x = 54.37, y = 41.29, f = "e", only = { classes = { "WARLOCK" } }, note = "Ophek, by the inn" },
						{ t = "accept", quest = 5654, title = "Hex of Weakness", npc = 3706, npcName = "Tai'jin", minLevel = 10, qlvl = 10, closedBy = { 5652, 5655, 5656, 5657 }, preTitles = { [5652] = "Hex of Weakness", [5655] = "Hex of Weakness", [5656] = "Hex of Weakness", [5657] = "Hex of Weakness" }, map = 1411, x = 54.26, y = 42.93, f = "e", only = { classes = { "PRIEST" }, races = { "Troll" } }, note = "Tai'jin, for Ur'kyo in Orgrimmar: keep it" },
					},
				},
				{
					title = "Fizzle Darkstorm",
					note = "Fizzle holds the Burning Blade camp on Thunder Ridge, north-west of Razor Hill. Hunters: tame a Dire Mottled Boar with the Taming Rod on the way.",
					goals = {
						{ t = "kill", quest = 6062, title = "Taming the Beast", target = "Dire Mottled Boar", npc = 3099, count = 1, oi = 1, map = 1411, x = 53.43, y = 46.16, f = "e", spots = { { x = 52.6, y = 46.1, r = 50, n = 2 }, { x = 51.6, y = 55.6, r = 76, n = 6 }, { x = 53.9, y = 62.6, r = 50, n = 1 }, { x = 54.1, y = 68.8, r = 70, n = 3 }, { x = 51.8, y = 78.1, r = 50, n = 1 }, { x = 41.8, y = 50.4, r = 61, n = 3 }, { x = 45, y = 43.2, r = 70, n = 4 }, { x = 46, y = 34.9, r = 50, n = 1 }, { x = 41.7, y = 32.4, r = 68, n = 3 }, { x = 38.8, y = 36.8, r = 50, n = 3 }, { x = 53.6, y = 31.6, r = 50, n = 4 }, { x = 58.4, y = 41.6, r = 50, n = 1 }, { x = 55.4, y = 44, r = 50, n = 1, alt = true }, { x = 52.3, y = 49.6, r = 103, n = 6, alt = true }, { x = 57.6, y = 45.6, r = 50, n = 2, alt = true }, { x = 54.2, y = 53.1, r = 50, n = 1, alt = true }, { x = 55.6, y = 39.8, r = 68, n = 6, alt = true }, { x = 52.3, y = 37.2, r = 52, n = 2, alt = true }, { x = 47.2, y = 44.6, r = 74, n = 7, alt = true }, { x = 48.2, y = 40.2, r = 50, n = 1, alt = true }, { x = 54.2, y = 35.9, r = 75, n = 4, alt = true }, { x = 56.2, y = 36, r = 50, n = 2, alt = true }, { x = 55, y = 57.1, r = 68, n = 5, alt = true }, { x = 49.5, y = 36.1, r = 67, n = 3, alt = true }, { x = 45.7, y = 48.4, r = 50, n = 2, alt = true }, { x = 51.2, y = 34, r = 50, n = 3, alt = true }, { x = 55.4, y = 32.8, r = 50, n = 1, alt = true }, { x = 52.6, y = 59.8, r = 74, n = 5, alt = true }, { x = 45.9, y = 38.2, r = 82, n = 4, alt = true }, { x = 42.4, y = 45.4, r = 89, n = 9, alt = true }, { x = 44.1, y = 34.3, r = 50, n = 2, alt = true }, { x = 51.9, y = 64.6, r = 91, n = 7, alt = true }, { x = 40.7, y = 40.7, r = 50, n = 1, alt = true }, { x = 41.1, y = 36.8, r = 50, n = 1, alt = true }, { x = 39.5, y = 47.2, r = 92, n = 5, alt = true }, { x = 50.5, y = 73.2, r = 66, n = 4, alt = true } }, spread = true, only = { classes = { "HUNTER" } }, note = "Tame it with the Taming Rod" },
						{ t = "collect", quest = 806, title = "Dark Storms", item = 4869, itemName = "Fizzle's Claw", oi = 1, map = 1411, x = 42.12, y = 26.66, f = "e" },
					},
				},
				{
					title = "Razor Hill",
					goals = {
						{ t = "turnin", quest = 806, title = "Dark Storms", npc = 3142, npcName = "Orgnil Soulscar", map = 1411, x = 52.24, y = 43.15, f = "e", note = "Orgnil Soulscar" },
						{ t = "accept", quest = 828, title = "Margoz", npc = 3142, npcName = "Orgnil Soulscar", minLevel = 4, qlvl = 12, pre = { 806 }, preTitles = { [806] = "Dark Storms" }, map = 1411, x = 52.24, y = 43.15, f = "e" },
						{ t = "turnin", quest = 6062, title = "Taming the Beast", npc = 3171, npcName = "Thotar", map = 1411, x = 51.85, y = 43.49, f = "e", only = { classes = { "HUNTER" } }, note = "Thotar" },
						{ t = "accept", quest = 6083, title = "Taming the Beast", npc = 3171, npcName = "Thotar", minLevel = 10, qlvl = 10, pre = { 6062 }, preTitles = { [6062] = "Taming the Beast" }, map = 1411, x = 51.85, y = 43.49, f = "e", only = { classes = { "HUNTER" } } },
					},
				},
				{
					title = "Heglan Shadeeye",
					note = "Heglan stands on the shore east of Razor Hill. The trident, banner and dagger lie on the beach around him.",
					goals = {
						{ t = "turnin", quest = 99048, title = "A Missing Hand", npc = 275657, npcName = "Heglan Shadeeye", map = 1411, x = 58.58, y = 45.61, f = "e" },
						{ t = "accept", quest = 99049, title = "Threat from Below", npc = 275657, npcName = "Heglan Shadeeye", minLevel = 9, qlvl = 11, map = 1411, x = 58.58, y = 45.61, f = "e" },
						{ t = "collect", quest = 99049, title = "Threat from Below", item = 286010, itemName = "Broken Bone Trident", oi = 1, map = 1411, x = 60.1, y = 44.8, f = "e" },
						{ t = "collect", quest = 99049, title = "Threat from Below", item = 286011, itemName = "Banner Scrap", oi = 2, map = 1411, x = 60.1, y = 42.4, f = "e" },
						{ t = "collect", quest = 99049, title = "Threat from Below", item = 286012, itemName = "Orcish Dagger", oi = 3, map = 1411, x = 58.9, y = 44.4, f = "e" },
					},
				},
				{
					title = "Spitelash naga",
					note = "Follow the shore north. Spitelash Scouts and Attendants hold the beach below Drygulch Ravine. Hunters: tame a Surf Crawler on the beach.",
					goals = {
						{ t = "collect", quest = 99051, title = "Threat from Below", item = 286008, itemName = "Naga Spinefin", count = 9, oi = 1, map = 1411, x = 59.04, y = 29.94, f = "e", spots = { { x = 58.9, y = 29.3, r = 32, n = 12 }, { x = 58.1, y = 29.5, r = 27, n = 8 }, { x = 58.6, y = 27.6, r = 72, n = 34 }, { x = 59.1, y = 24.5, r = 73, n = 20 }, { x = 59.4, y = 22.8, r = 55, n = 8 } } },
						{ t = "kill", quest = 6083, title = "Taming the Beast", target = "Surf Crawler", npc = 3107, count = 1, oi = 1, map = 1411, x = 58.85, y = 28.34, f = "e", spots = { { x = 59.9, y = 26.5, r = 86, n = 4 }, { x = 60.9, y = 17.7, r = 58, n = 1 }, { x = 70.8, y = 70.2, r = 58, n = 2 }, { x = 65.4, y = 73.6, r = 86, n = 5 }, { x = 65.1, y = 79.1, r = 58, n = 2 }, { x = 61.6, y = 81, r = 105, n = 5 }, { x = 59.1, y = 85.2, r = 73, n = 3 }, { x = 61.2, y = 91.4, r = 58, n = 2 }, { x = 65.5, y = 90.3, r = 96, n = 4 }, { x = 69.6, y = 87.5, r = 58, n = 1 }, { x = 69.8, y = 79.1, r = 58, n = 3 }, { x = 64.2, y = 97.6, r = 58, n = 3 }, { x = 60.1, y = 23.7, r = 58, n = 3, alt = true }, { x = 66.7, y = 69.8, r = 74, n = 3, alt = true }, { x = 62.9, y = 75.9, r = 68, n = 4, alt = true }, { x = 70.7, y = 74.9, r = 58, n = 2, alt = true }, { x = 67.8, y = 76.7, r = 67, n = 4, alt = true }, { x = 61.3, y = 87.1, r = 58, n = 2, alt = true }, { x = 63.6, y = 93.6, r = 103, n = 6, alt = true } }, spread = true, only = { classes = { "HUNTER" } }, note = "Tame it with the Taming Rod" },
					},
				},
				{
					title = "Margoz",
					note = "Margoz camps on the hill west of the naga beach, south of Skull Rock.",
					goals = {
						{ t = "turnin", quest = 828, title = "Margoz", npc = 3208, npcName = "Margoz", map = 1411, x = 56.41, y = 20.04, f = "e" },
						{ t = "accept", quest = 827, title = "Skull Rock", npc = 3208, npcName = "Margoz", minLevel = 4, qlvl = 12, pre = { 828 }, preTitles = { [828] = "Margoz" }, map = 1411, x = 56.41, y = 20.04, f = "e" },
					},
				},
				{
					title = "Gan'rul Bloodeye",
					note = "Orgrimmar's main gate is just west of Skull Rock. Gan'rul stands in the Cleft of Shadow, the canyon under the Valley of Strength.",
					only = { classes = { "WARLOCK" } },
					goals = {
						{ t = "turnin", quest = 1506, title = "Gan'rul's Summons", npc = 5875, npcName = "Gan'rul Bloodeye", map = 1454, x = 48.25, y = 45.28, f = "e", note = "Gan'rul Bloodeye" },
						{ t = "accept", quest = 1501, title = "Creature of the Void", npc = 5875, npcName = "Gan'rul Bloodeye", minLevel = 10, qlvl = 11, closedBy = { 1473 }, preTitles = { [1473] = "Creature of the Void" }, map = 1454, x = 48.25, y = 45.28, f = "e" },
					},
				},
				{
					title = "Skull Rock",
					note = "Burning Blade cultists hold the caves of Skull Rock to the north; any of them drops a Searing Collar. Gazz'uz, a level 14 warlock, stands deep inside and drops the Eye of Burning Shadow.",
					goals = {
						{ t = "collect", quest = 827, title = "Skull Rock", item = 4871, itemName = "Searing Collar", oi = 1, map = 1411, x = 52.93, y = 28.38, f = "e", spots = { { x = 52.9, y = 28.3, r = 56, n = 8 }, { x = 52.3, y = 25.8, r = 46, n = 11 }, { x = 42.3, y = 26.7, r = 40, n = 6 }, { x = 52, y = 9.3, r = 56, n = 12 }, { x = 53.3, y = 8.6, r = 42, n = 10 }, { x = 53.1, y = 10.6, r = 45, n = 6 }, { x = 54.7, y = 9.2, r = 40, n = 4 } }, spread = true },
						{ t = "collect", item = 4903, itemName = "Eye of Burning Shadow", map = 1411, x = 52.61, y = 8.82, f = "e", from = "Gazz'uz", fromKind = "npc" },
						{ t = "accept", quest = 832, title = "Burning Shadows", item = 4903, itemName = "Eye of Burning Shadow", minLevel = 4, qlvl = 12 },
					},
				},
				{
					title = "Tablet of Verga",
					note = "The Burning Blade Stash stands in Skull Rock, among the cultists you just fought.",
					only = { classes = { "WARLOCK" } },
					goals = {
						{ t = "collect", quest = 1501, title = "Creature of the Void", item = 6535, itemName = "Tablet of Verga", count = 1, oi = 1, map = 1411, x = 51.62, y = 9.76, f = "e" },
					},
				},
				{
					title = "The Binding",
					note = "Back to Gan'rul in the Cleft of Shadow. Use the Glyphs of Summoning on the summoning circle there and defeat the voidwalker to bind it.",
					only = { classes = { "WARLOCK" } },
					goals = {
						{ t = "turnin", quest = 1501, title = "Creature of the Void", npc = 5875, npcName = "Gan'rul Bloodeye", map = 1454, x = 48.25, y = 45.28, f = "e", note = "Gan'rul Bloodeye" },
						{ t = "accept", quest = 1504, title = "The Binding", npc = 5875, npcName = "Gan'rul Bloodeye", minLevel = 10, qlvl = 11, pre = { 1501 }, preTitles = { [1501] = "Creature of the Void" }, map = 1454, x = 48.25, y = 45.28, f = "e" },
						{ t = "use", item = 7464, itemName = "Glyphs of Summoning", map = 1454, x = 49.3, y = 50, f = "e", note = "Glyphs of Summoning" },
						{ t = "kill", quest = 1504, title = "The Binding", target = "Summoned Voidwalker", npc = 5676, oi = 1, map = 1454, x = 49.3, y = 50, f = "e" },
						{ t = "turnin", quest = 1504, title = "The Binding", npc = 5875, npcName = "Gan'rul Bloodeye", map = 1454, x = 48.25, y = 45.28, f = "e", note = "Gan'rul Bloodeye: Summon Voidwalker" },
					},
				},
				{
					title = "Margoz",
					goals = {
						{ t = "turnin", quest = 827, title = "Skull Rock", npc = 3208, npcName = "Margoz", map = 1411, x = 56.41, y = 20.04, f = "e" },
					},
				},
				{
					title = "Razor Hill",
					note = "Back south to Razor Hill.",
					goals = {
						{ t = "turnin", quest = 99049, title = "Threat from Below", npc = 3142, npcName = "Orgnil Soulscar", map = 1411, x = 52.24, y = 43.15, f = "e", note = "Orgnil Soulscar" },
						{ t = "turnin", quest = 99051, title = "Threat from Below", npc = 3142, npcName = "Orgnil Soulscar", map = 1411, x = 52.24, y = 43.15, f = "e" },
						{ t = "turnin", quest = 6083, title = "Taming the Beast", npc = 3171, npcName = "Thotar", map = 1411, x = 51.85, y = 43.49, f = "e", only = { classes = { "HUNTER" } }, note = "Thotar" },
						{ t = "accept", quest = 6082, title = "Taming the Beast", npc = 3171, npcName = "Thotar", minLevel = 10, qlvl = 10, pre = { 6083 }, preTitles = { [6083] = "Taming the Beast" }, map = 1411, x = 51.85, y = 43.49, f = "e", only = { classes = { "HUNTER" } } },
						{ t = "train", class = true, candidates = { { npc = 3171, npcName = "Thotar", map = 1411, x = 51.85, y = 43.49, f = "e", faction = "H", classes = { "HUNTER" } }, { npc = 3170, npcName = "Kaplak", map = 1411, x = 51.98, y = 43.69, f = "e", faction = "H", classes = { "ROGUE" } }, { npc = 3169, npcName = "Tarshaw Jaggedscar", map = 1411, x = 54.19, y = 42.47, f = "e", faction = "H", classes = { "WARRIOR" } }, { npc = 3706, npcName = "Tai'jin", map = 1411, x = 54.26, y = 42.93, f = "e", faction = "H", classes = { "PRIEST" } }, { npc = 3173, npcName = "Swart", map = 1411, x = 54.42, y = 42.59, f = "e", faction = "H", classes = { "SHAMAN" } }, { npc = 3172, npcName = "Dhugru Gorelust", map = 1411, x = 54.38, y = 41.2, f = "e", faction = "H", classes = { "WARLOCK" } }, { npc = 3707, npcName = "Ken'jai", map = 1411, x = 42.36, y = 68.81, f = "e", faction = "H", classes = { "PRIEST" } }, { npc = 5884, npcName = "Mai'ah", map = 1411, x = 42.51, y = 69.04, f = "e", faction = "H", classes = { "MAGE" } }, { npc = 3154, npcName = "Jen'shan", map = 1411, x = 42.84, y = 69.33, f = "e", faction = "H", classes = { "HUNTER" } }, { npc = 3157, npcName = "Shikrik", map = 1411, x = 42.39, y = 69, f = "e", faction = "H", classes = { "SHAMAN" } }, { npc = 3155, npcName = "Rwag", map = 1411, x = 41.28, y = 68, f = "e", faction = "H", classes = { "ROGUE" } }, { npc = 3153, npcName = "Frang", map = 1411, x = 42.89, y = 69.44, f = "e", faction = "H", classes = { "WARRIOR" } }, { npc = 3156, npcName = "Nartok", map = 1411, x = 40.65, y = 68.52, f = "e", faction = "H", classes = { "WARLOCK" } }, { npc = 5880, npcName = "Un'Thuwa", map = 1411, x = 56.31, y = 75.11, f = "e", faction = "H", classes = { "MAGE" } }, { npc = 7311, npcName = "Uthel'nay", map = 1454, x = 39.16, y = 86.27, f = "e", faction = "H", classes = { "MAGE" } }, { npc = 6018, npcName = "Ur'kyo", map = 1454, x = 35.59, y = 87.82, f = "e", faction = "H", classes = { "PRIEST" } }, { npc = 3328, npcName = "Ormok", map = 1454, x = 43.9, y = 54.63, f = "e", faction = "H", classes = { "ROGUE" } }, { npc = 3325, npcName = "Mirket", map = 1454, x = 48.62, y = 46.95, f = "e", faction = "H", classes = { "WARLOCK" } }, { npc = 3354, npcName = "Sorek", map = 1454, x = 80.39, y = 32.38, f = "e", faction = "H", classes = { "WARRIOR" } }, { npc = 3344, npcName = "Kardris Dreamseeker", map = 1454, x = 38.8, y = 36.37, f = "e", faction = "H", classes = { "SHAMAN" } }, { npc = 3406, npcName = "Xor'juul", map = 1454, x = 67.24, y = 20.2, f = "e", faction = "H", classes = { "HUNTER" } }, { npc = 3034, npcName = "Sheal Runetotem", map = 1456, x = 77.14, y = 27.02, f = "e", faction = "H", classes = { "DRUID" } }, { npc = 3040, npcName = "Urek Thunderhorn", map = 1456, x = 59.13, y = 86.87, f = "e", faction = "H", classes = { "HUNTER" } }, { npc = 3043, npcName = "Ker Ragetotem", map = 1456, x = 57.58, y = 85.5, f = "e", faction = "H", classes = { "WARRIOR" } }, { npc = 3065, npcName = "Yaw Sharpmane", map = 1412, x = 46.93, y = 59.65, faction = "H", classes = { "HUNTER" } }, { npc = 3063, npcName = "Krang Stonehoof", map = 1412, x = 48.35, y = 63.74, faction = "H", classes = { "WARRIOR" } }, { npc = 3066, npcName = "Narm Skychaser", map = 1412, x = 47.4, y = 62.54, faction = "H", classes = { "SHAMAN" } }, { npc = 3064, npcName = "Gennia Runetotem", map = 1412, x = 47.48, y = 62.95, faction = "H", classes = { "DRUID" } }, { npc = 3048, npcName = "Ursyn Ghull", map = 1456, x = 25.7, y = 14.19, f = "e", faction = "H", classes = { "MAGE" } }, { npc = 246344, npcName = "Alodan the Hopeful", map = 1456, x = 25.6, y = 14.8, f = "e", faction = "H", classes = { "PALADIN" } }, { npc = 3044, npcName = "Miles Welsh", map = 1456, x = 25.32, y = 15.27, f = "e", faction = "H", classes = { "PRIEST" } }, { npc = 3031, npcName = "Tigor Skychaser", map = 1456, x = 23.64, y = 18.79, f = "e", faction = "H", classes = { "SHAMAN" } }, { npc = 3060, npcName = "Gart Mistrunner", map = 1412, x = 44.65, y = 76.55, faction = "H", classes = { "DRUID" } }, { npc = 3062, npcName = "Meela Dawnstrider", map = 1412, x = 44.58, y = 76.56, faction = "H", classes = { "SHAMAN" } }, { npc = 3061, npcName = "Lanka Farshot", map = 1412, x = 43.96, y = 76.35, faction = "H", classes = { "HUNTER" } }, { npc = 3059, npcName = "Harutt Thunderhorn", map = 1412, x = 43.75, y = 76.72, faction = "H", classes = { "WARRIOR" } }, { npc = 2119, npcName = "Dannal Stern", map = 1420, x = 32.69, y = 65.56, f = "e", faction = "H", classes = { "WARRIOR" } }, { npc = 2122, npcName = "David Trias", map = 1420, x = 32.53, y = 65.65, f = "e", faction = "H", classes = { "ROGUE" } }, { npc = 2123, npcName = "Dark Cleric Duesten", map = 1420, x = 31.11, y = 66.03, f = "e", faction = "H", classes = { "PRIEST" } }, { npc = 2124, npcName = "Isabella", map = 1420, x = 30.93, y = 66.06, f = "e", faction = "H", classes = { "MAGE" } }, { npc = 2126, npcName = "Maximillion", map = 1420, x = 30.91, y = 66.34, f = "e", faction = "H", classes = { "WARLOCK" } }, { npc = 2127, npcName = "Rupert Boch", map = 1420, x = 61.59, y = 52.4, f = "e", faction = "H", classes = { "WARLOCK" } }, { npc = 2128, npcName = "Cain Firesong", map = 1420, x = 61.97, y = 52.47, f = "e", faction = "H", classes = { "MAGE" } }, { npc = 2129, npcName = "Dark Cleric Beryl", map = 1420, x = 61.57, y = 52.19, f = "e", faction = "H", classes = { "PRIEST" } }, { npc = 2130, npcName = "Marion Call", map = 1420, x = 61.75, y = 52, f = "e", faction = "H", classes = { "ROGUE" } }, { npc = 2131, npcName = "Austil de Mon", map = 1420, x = 61.85, y = 52.54, f = "e", faction = "H", classes = { "WARRIOR" } }, { npc = 244808, npcName = "Aramis Hammerhand", map = 1420, x = 31.09, y = 66.32, f = "e", faction = "H", classes = { "PALADIN" } }, { npc = 246152, npcName = "Shari Stilwell", map = 1420, x = 60.25, y = 52.63, f = "e", faction = "H", classes = { "PALADIN" } }, { npc = 246389, npcName = "Hilda the Breaker", map = 1420, x = 21.92, y = 47.19, f = "e", faction = "H", classes = { "PALADIN" } }, { npc = 4563, npcName = "Kaal Soulreaper", map = 1458, x = 86.21, y = 15.93, f = "e", faction = "H", classes = { "WARLOCK" } }, { npc = 4566, npcName = "Kaelystia Hatebringer", map = 1458, x = 85.02, y = 14.02, f = "e", faction = "H", classes = { "MAGE" } }, { npc = 4582, npcName = "Carolyn Ward", map = 1458, x = 83.86, y = 72.07, f = "e", faction = "H", classes = { "ROGUE" } }, { npc = 4593, npcName = "Christoph Walker", map = 1458, x = 46.93, y = 15.23, f = "e", faction = "H", classes = { "WARRIOR" } }, { npc = 4606, npcName = "Aelthalyste", map = 1458, x = 49.26, y = 17.12, f = "e", faction = "H", classes = { "PRIEST" } }, { npc = 260093, npcName = "Garen Largo", map = 1458, x = 47.49, y = 15.23, f = "e", faction = "H", classes = { "PALADIN" } }, { npc = 251373, npcName = "Xyton Silverwind", map = 2521, x = 41.72, y = 23.38, faction = "AH", classes = { "DRUID" } }, { npc = 251374, npcName = "Windshaper Boro", map = 2521, x = 42.76, y = 23.58, faction = "H", classes = { "SHAMAN" } }, { npc = 251376, npcName = "Tai'ree Farsight", map = 2521, x = 42.44, y = 23.68, faction = "AH", classes = { "HUNTER" } }, { npc = 251389, npcName = "Akeri Duskblade", map = 2521, x = 43.71, y = 24.3, faction = "AH", classes = { "ROGUE" } }, { npc = 251964, npcName = "Blademaster Ren", map = 2521, x = 43.68, y = 24.17, faction = "AH", classes = { "WARRIOR" } } } },
					},
				},
				{
					title = "Armored Scorpid",
					note = "Armored Scorpids crawl over the plains west of Razor Hill. Tame one, then return to Thotar.",
					only = { classes = { "HUNTER" } },
					goals = {
						{ t = "kill", quest = 6082, title = "Taming the Beast", target = "Armored Scorpid", npc = 3126, count = 1, oi = 1, map = 1411, x = 50.99, y = 37.7, f = "e", spots = { { x = 51, y = 37.7, r = 60, n = 1 }, { x = 54.6, y = 35.2, r = 60, n = 2 }, { x = 57.2, y = 29.6, r = 108, n = 6 }, { x = 55.6, y = 22.3, r = 60, n = 4 }, { x = 51.3, y = 19.6, r = 82, n = 4 }, { x = 48.6, y = 30.6, r = 60, n = 1 }, { x = 45.3, y = 27.4, r = 60, n = 2 }, { x = 41.9, y = 28.8, r = 60, n = 1 }, { x = 43.4, y = 33.5, r = 60, n = 3 }, { x = 40.8, y = 39.9, r = 63, n = 3 }, { x = 36.2, y = 37.2, r = 60, n = 4 }, { x = 41.9, y = 49.5, r = 91, n = 5 }, { x = 48.1, y = 36.7, r = 79, n = 6, alt = true }, { x = 45.5, y = 31.4, r = 60, n = 1, alt = true }, { x = 44.2, y = 45.7, r = 86, n = 5, alt = true }, { x = 58, y = 24.3, r = 60, n = 3, alt = true }, { x = 39.7, y = 46.5, r = 94, n = 4, alt = true }, { x = 37.9, y = 34.5, r = 72, n = 4, alt = true }, { x = 37.9, y = 41.6, r = 86, n = 4, alt = true } }, spread = true, note = "Tame it with the Taming Rod" },
						{ t = "turnin", quest = 6082, title = "Taming the Beast", npc = 3171, npcName = "Thotar", map = 1411, x = 51.85, y = 43.49, f = "e", note = "Thotar" },
						{ t = "accept", quest = 6081, title = "Training the Beast", npc = 3171, npcName = "Thotar", minLevel = 10, qlvl = 10, pre = { 6082 }, preTitles = { [6082] = "Taming the Beast" }, map = 1411, x = 51.85, y = 43.49, f = "e", note = "Thotar: Ormak Grimshot in Orgrimmar teaches Beast Training" },
					},
				},
				{
					title = "Far Watch Post",
					note = "Follow the road west from Razor Hill over the Southfury River bridge; Far Watch Post sits just above it on the Barrens side.",
					goals = {
						{ t = "turnin", quest = 840, title = "Conscript of the Horde", npc = 3337, npcName = "Kargal Battlescar", map = 1413, x = 62.26, y = 19.38, f = "e", note = "Kargal Battlescar" },
						{ t = "accept", quest = 842, title = "Crossroads Conscription", npc = 3337, npcName = "Kargal Battlescar", minLevel = 10, qlvl = 12, pre = { 840 }, preTitles = { [840] = "Conscript of the Horde" }, map = 1413, x = 62.26, y = 19.38, f = "e" },
						{ t = "turnin", quest = 1505, title = "Veteran Uzzek", npc = 5810, npcName = "Uzzek", map = 1413, x = 61.38, y = 21.12, f = "e", only = { classes = { "WARRIOR" } }, note = "Uzzek" },
						{ t = "accept", quest = 1498, title = "Path of Defense", npc = 5810, npcName = "Uzzek", minLevel = 10, qlvl = 10, closedBy = { 1819 }, preTitles = { [1819] = "Ulag the Cleaver" }, map = 1413, x = 61.38, y = 21.12, f = "e", only = { classes = { "WARRIOR" } } },
					},
				},
				{
					title = "Thunder lizards across the river",
					note = "Thunder Lizards and Lightning Hides graze on Thunder Ridge across the bridge; any of them can drop a Singed Scale.",
					only = { classes = { "WARRIOR" } },
					goals = {
						{ t = "collect", quest = 1498, title = "Path of Defense", item = 6486, itemName = "Singed Scale", count = 5, oi = 1, map = 1411, x = 39.67, y = 29.24, f = "e", spots = { { x = 40.3, y = 29, r = 48, n = 5 }, { x = 39.1, y = 30, r = 53, n = 5 }, { x = 39.2, y = 25.6, r = 36, n = 3 }, { x = 40.4, y = 24.1, r = 54, n = 4 }, { x = 42.8, y = 24.2, r = 44, n = 5 } } },
					},
				},
				{
					title = "Uzzek",
					only = { classes = { "WARRIOR" } },
					goals = {
						{ t = "turnin", quest = 1498, title = "Path of Defense", npc = 5810, npcName = "Uzzek", map = 1413, x = 61.38, y = 21.12, f = "e" },
						{ t = "accept", quest = 1502, title = "Thun'grim Firegaze", npc = 5810, npcName = "Uzzek", minLevel = 10, qlvl = 10, pre = { 1498, 1819 }, preTitles = { [1498] = "Path of Defense", [1819] = "Ulag the Cleaver" }, map = 1413, x = 61.38, y = 21.12, f = "e" },
					},
				},
				{
					title = "The Crossroads",
					note = "Follow the road south-west from Far Watch Post to the Crossroads. The Barrens guide starts here.",
					goals = {
						{ t = "getfp", location = "Crossroads" },
						{ t = "sethome", location = "The Crossroads" },
					},
				},
			},
		})
	end
	register()
end

-- Source: forever/horde/orc-troll/02-the-barrens.guide
do
	local function register()
		Polestar.RegisterGuide({
			id = "forever/horde/orc-troll/02-the-barrens",
			pack = "guides",
			title = "The Barrens",
			faction = "Horde",
			races = { "Orc", "Troll" },
			minLevel = 11,
			maxLevel = 17,
			category = "Leveling",
			zone = 1413,
			zoneName = "The Barrens",
			next = "forever/horde/02-the-barrens",
			author = "Polestar",
			version = 1,
			steps = {
				{
					title = "The Crossroads",
					note = "You arrive from Far Watch Post. Sergra stands by the inn; Thork and Darsok on the tower platform; Helbrim and Gazrog by the north gate; Tonga at the south gate.",
					goals = {
						{ t = "turnin", quest = 842, title = "Crossroads Conscription", npc = 3338, npcName = "Sergra Darkthorn", map = 1413, x = 52.23, y = 31.01, f = "e", note = "Sergra Darkthorn" },
						{ t = "accept", quest = 844, title = "Plainstrider Menace", npc = 3338, npcName = "Sergra Darkthorn", minLevel = 10, qlvl = 12, map = 1413, x = 52.23, y = 31.01, f = "e" },
						{ t = "accept", quest = 871, title = "Disrupt the Attacks", npc = 3429, npcName = "Thork", minLevel = 9, qlvl = 12, map = 1413, x = 51.5, y = 30.87, f = "e", note = "Thork" },
						{ t = "accept", quest = 5041, title = "Supplies for the Crossroads", npc = 3429, npcName = "Thork", minLevel = 9, qlvl = 14, map = 1413, x = 51.5, y = 30.87, f = "e" },
						{ t = "accept", quest = 848, title = "Fungal Spores", npc = 3390, npcName = "Apothecary Helbrim", minLevel = 10, qlvl = 15, map = 1413, x = 51.44, y = 30.15, f = "e", note = "Apothecary Helbrim" },
						{ t = "accept", quest = 1492, title = "Wharfmaster Dizzywig", npc = 3390, npcName = "Apothecary Helbrim", minLevel = 9, qlvl = 11, map = 1413, x = 51.44, y = 30.15, f = "e" },
						{ t = "accept", quest = 869, title = "Raptor Thieves", npc = 3464, npcName = "Gazrog", minLevel = 9, qlvl = 13, map = 1413, x = 51.93, y = 30.32, f = "e", note = "Gazrog" },
						{ t = "accept", quest = 870, title = "The Forgotten Pools", npc = 3448, npcName = "Tonga Runetotem", minLevel = 10, qlvl = 13, map = 1413, x = 52.26, y = 31.93, f = "e", note = "Tonga Runetotem" },
					},
				},
				{
					title = "Plainstriders and raptors",
					note = "Plainstriders and Sunscale raptors roam the plains all around the Crossroads.",
					goals = {
						{ t = "collect", quest = 844, title = "Plainstrider Menace", item = 5087, itemName = "Plainstrider Beak", count = 7, oi = 1, map = 1413, x = 52.94, y = 33.58, f = "e", spots = { { x = 53.2, y = 32.8, r = 59, n = 5 }, { x = 48.9, y = 23.5, r = 73, n = 6 }, { x = 52.3, y = 15.4, r = 63, n = 3 }, { x = 58.7, y = 20.7, r = 50, n = 2 }, { x = 60.9, y = 10.4, r = 50, n = 2 }, { x = 56, y = 5.8, r = 50, n = 2 }, { x = 44.9, y = 13.6, r = 50, n = 3 }, { x = 37.6, y = 28.1, r = 50, n = 2 }, { x = 44.9, y = 35.9, r = 50, n = 1 }, { x = 49.4, y = 47.9, r = 54, n = 4 }, { x = 59.5, y = 52.8, r = 50, n = 2 }, { x = 63.9, y = 35.7, r = 50, n = 2 }, { x = 53, y = 34.8, r = 50, n = 2, alt = true }, { x = 54.4, y = 34.8, r = 92, n = 4, alt = true }, { x = 53.3, y = 30.8, r = 52, n = 3, alt = true }, { x = 54.6, y = 32.1, r = 50, n = 1, alt = true }, { x = 51.3, y = 35.2, r = 75, n = 4, alt = true }, { x = 50.8, y = 33.2, r = 50, n = 3, alt = true }, { x = 52.4, y = 37, r = 50, n = 1, alt = true }, { x = 54.4, y = 36.4, r = 50, n = 1, alt = true }, { x = 53.4, y = 37.4, r = 50, n = 1, alt = true }, { x = 50.6, y = 31.2, r = 61, n = 3, alt = true }, { x = 56, y = 32.5, r = 50, n = 2, alt = true }, { x = 53.6, y = 28.7, r = 92, n = 6, alt = true }, { x = 54.7, y = 38.5, r = 50, n = 1, alt = true }, { x = 49.6, y = 36.4, r = 94, n = 4, alt = true }, { x = 56.8, y = 34.5, r = 50, n = 1, alt = true }, { x = 48.9, y = 32.2, r = 50, n = 3, alt = true }, { x = 51.4, y = 27.6, r = 73, n = 5, alt = true }, { x = 49.2, y = 29.9, r = 82, n = 5, alt = true }, { x = 56.6, y = 29.2, r = 95, n = 7, alt = true }, { x = 49.5, y = 38.5, r = 50, n = 2, alt = true }, { x = 57.3, y = 30.7, r = 76, n = 9, alt = true }, { x = 52.8, y = 26.3, r = 52, n = 4, alt = true }, { x = 47.7, y = 34.4, r = 50, n = 2, alt = true }, { x = 47.7, y = 32.1, r = 72, n = 4, alt = true }, { x = 58.3, y = 31.9, r = 50, n = 1, alt = true }, { x = 57.8, y = 28.7, r = 50, n = 2, alt = true }, { x = 57.1, y = 27.4, r = 60, n = 5, alt = true }, { x = 47.8, y = 37.8, r = 78, n = 5, alt = true }, { x = 47.5, y = 29.8, r = 50, n = 1, alt = true }, { x = 48, y = 27.8, r = 61, n = 3, alt = true }, { x = 46.5, y = 33.2, r = 75, n = 4, alt = true }, { x = 55.6, y = 24.5, r = 50, n = 3, alt = true }, { x = 59.6, y = 32.7, r = 74, n = 4, alt = true }, { x = 54.2, y = 23.4, r = 53, n = 3, alt = true }, { x = 48.6, y = 25.4, r = 72, n = 4, alt = true }, { x = 46.2, y = 30.6, r = 50, n = 3, alt = true }, { x = 58, y = 26.1, r = 50, n = 1, alt = true }, { x = 53.3, y = 22.7, r = 92, n = 4, alt = true }, { x = 51.6, y = 22.4, r = 55, n = 5, alt = true }, { x = 47.2, y = 26.1, r = 66, n = 3, alt = true }, { x = 46.3, y = 28, r = 51, n = 2, alt = true }, { x = 55.8, y = 22.7, r = 50, n = 1, alt = true }, { x = 60.8, y = 33.8, r = 61, n = 3, alt = true }, { x = 60.9, y = 31.4, r = 54, n = 2, alt = true }, { x = 44.9, y = 32.2, r = 50, n = 2, alt = true }, { x = 57.2, y = 23, r = 50, n = 2, alt = true }, { x = 52.4, y = 21.2, r = 69, n = 5, alt = true }, { x = 44.5, y = 34.5, r = 59, n = 4, alt = true }, { x = 46.7, y = 24.4, r = 50, n = 1, alt = true }, { x = 49.5, y = 21.1, r = 80, n = 5, alt = true }, { x = 45.1, y = 26.7, r = 50, n = 1, alt = true }, { x = 47.4, y = 44.5, r = 50, n = 2, alt = true }, { x = 50.1, y = 46.7, r = 50, n = 2, alt = true }, { x = 52.4, y = 47.4, r = 68, n = 3, alt = true }, { x = 57, y = 21, r = 50, n = 3, alt = true }, { x = 43.5, y = 31.7, r = 50, n = 2, alt = true }, { x = 45.8, y = 43.3, r = 50, n = 1, alt = true }, { x = 51.4, y = 19.2, r = 57, n = 5, alt = true }, { x = 43.2, y = 33, r = 50, n = 1, alt = true }, { x = 53, y = 18.9, r = 50, n = 1, alt = true }, { x = 53.7, y = 48.3, r = 67, n = 4, alt = true }, { x = 55.6, y = 47.8, r = 50, n = 3, alt = true }, { x = 47.5, y = 21, r = 80, n = 6, alt = true }, { x = 48.7, y = 19.8, r = 87, n = 7, alt = true }, { x = 44.2, y = 25.1, r = 64, n = 3, alt = true }, { x = 42.6, y = 29.9, r = 50, n = 1, alt = true }, { x = 60.9, y = 22.6, r = 76, n = 3, alt = true }, { x = 51.2, y = 17.5, r = 50, n = 4, alt = true }, { x = 63.8, y = 31, r = 63, n = 3, alt = true }, { x = 56.2, y = 49.4, r = 50, n = 1, alt = true }, { x = 63.6, y = 29.1, r = 50, n = 2, alt = true }, { x = 54.7, y = 50, r = 63, n = 4, alt = true }, { x = 49.1, y = 17.8, r = 88, n = 5, alt = true }, { x = 49.5, y = 49.6, r = 77, n = 4, alt = true }, { x = 46.5, y = 19.4, r = 50, n = 2, alt = true }, { x = 42.6, y = 25.1, r = 50, n = 1, alt = true }, { x = 54.1, y = 51.8, r = 50, n = 3, alt = true }, { x = 55.6, y = 51.5, r = 70, n = 3, alt = true }, { x = 50.9, y = 15.4, r = 50, n = 2, alt = true }, { x = 59.1, y = 49.7, r = 50, n = 2, alt = true }, { x = 61.2, y = 48.3, r = 50, n = 2, alt = true }, { x = 55, y = 52.6, r = 50, n = 1, alt = true }, { x = 48.4, y = 15.5, r = 50, n = 2, alt = true }, { x = 57.8, y = 51.9, r = 69, n = 3, alt = true }, { x = 45.5, y = 17.1, r = 50, n = 1, alt = true }, { x = 50.1, y = 13.9, r = 88, n = 5, alt = true }, { x = 62, y = 49.2, r = 50, n = 1, alt = true }, { x = 51, y = 13, r = 50, n = 2, alt = true }, { x = 47.8, y = 14.1, r = 80, n = 7, alt = true }, { x = 44.1, y = 17.2, r = 50, n = 1, alt = true }, { x = 45.5, y = 15.3, r = 51, n = 3, alt = true }, { x = 39.9, y = 24.7, r = 50, n = 1, alt = true }, { x = 46.8, y = 12.8, r = 50, n = 2, alt = true }, { x = 44.1, y = 15.1, r = 87, n = 4, alt = true }, { x = 38.8, y = 25, r = 50, n = 1, alt = true }, { x = 38.1, y = 26.3, r = 50, n = 2, alt = true }, { x = 61.4, y = 13.2, r = 50, n = 1, alt = true }, { x = 42.1, y = 15.7, r = 50, n = 2, alt = true }, { x = 58.3, y = 7.9, r = 50, n = 1, alt = true }, { x = 60, y = 8.5, r = 50, n = 1, alt = true }, { x = 57.3, y = 6.4, r = 50, n = 1, alt = true }, { x = 59.3, y = 7.3, r = 50, n = 2, alt = true } }, spread = true },
						{ t = "collect", quest = 869, title = "Raptor Thieves", item = 5062, itemName = "Raptor Head", count = 12, oi = 1, map = 1413, x = 52.93, y = 33.04, f = "e", spots = { { x = 53.1, y = 33.7, r = 60, n = 2 }, { x = 60, y = 35.6, r = 60, n = 1 }, { x = 62.3, y = 25.9, r = 60, n = 1 }, { x = 59.8, y = 14.4, r = 71, n = 5 }, { x = 53.4, y = 14.7, r = 60, n = 1 }, { x = 48.9, y = 23.8, r = 60, n = 1 }, { x = 41.4, y = 20.3, r = 68, n = 3 }, { x = 40.5, y = 29, r = 60, n = 1 }, { x = 42.7, y = 38.3, r = 60, n = 2 }, { x = 50.1, y = 45.3, r = 60, n = 1 }, { x = 61, y = 46.8, r = 78, n = 3 }, { x = 63.6, y = 6, r = 60, n = 1 }, { x = 52.2, y = 35.9, r = 60, n = 1, alt = true }, { x = 54.2, y = 35.9, r = 60, n = 2, alt = true }, { x = 56.2, y = 34.3, r = 60, n = 2, alt = true }, { x = 57.4, y = 36.4, r = 72, n = 5, alt = true }, { x = 50.1, y = 39.4, r = 78, n = 3, alt = true }, { x = 54.4, y = 40.5, r = 74, n = 3, alt = true }, { x = 56, y = 39.4, r = 60, n = 3, alt = true }, { x = 58.6, y = 34.1, r = 60, n = 3, alt = true }, { x = 57.6, y = 38.4, r = 60, n = 1, alt = true }, { x = 57.4, y = 40.2, r = 60, n = 2, alt = true }, { x = 54.6, y = 23.2, r = 60, n = 1, alt = true }, { x = 48.1, y = 25.6, r = 60, n = 2, alt = true }, { x = 48.9, y = 41.7, r = 60, n = 1, alt = true }, { x = 53.1, y = 43.6, r = 70, n = 3, alt = true }, { x = 51.3, y = 22.6, r = 60, n = 1, alt = true }, { x = 51.6, y = 43.8, r = 62, n = 3, alt = true }, { x = 58.8, y = 39.9, r = 60, n = 1, alt = true }, { x = 45.6, y = 30.3, r = 60, n = 1, alt = true }, { x = 57.6, y = 42.3, r = 60, n = 1, alt = true }, { x = 60.4, y = 29.2, r = 60, n = 3, alt = true }, { x = 55.4, y = 44.4, r = 60, n = 2, alt = true }, { x = 44.8, y = 33.4, r = 60, n = 1, alt = true }, { x = 55.4, y = 21.2, r = 60, n = 1, alt = true }, { x = 54.7, y = 46.1, r = 60, n = 1, alt = true }, { x = 52.8, y = 46.5, r = 94, n = 3, alt = true }, { x = 53.1, y = 19.4, r = 60, n = 1, alt = true }, { x = 59.1, y = 43.5, r = 100, n = 5, alt = true }, { x = 43.6, y = 34.1, r = 69, n = 3, alt = true }, { x = 51.8, y = 18.7, r = 60, n = 1, alt = true }, { x = 58, y = 20.5, r = 60, n = 1, alt = true }, { x = 44.3, y = 26.1, r = 60, n = 1, alt = true }, { x = 61.5, y = 41.3, r = 60, n = 1, alt = true }, { x = 44.1, y = 41, r = 60, n = 5, alt = true }, { x = 60.6, y = 22.7, r = 60, n = 2, alt = true }, { x = 60, y = 44.5, r = 74, n = 6, alt = true }, { x = 59.1, y = 46.1, r = 89, n = 10, alt = true }, { x = 42, y = 33.7, r = 60, n = 3, alt = true }, { x = 42.1, y = 30, r = 60, n = 2, alt = true }, { x = 61.9, y = 23.1, r = 60, n = 1, alt = true }, { x = 54.3, y = 16.3, r = 118, n = 4, alt = true }, { x = 56.3, y = 16.8, r = 60, n = 1, alt = true }, { x = 57.6, y = 17.4, r = 60, n = 1, alt = true }, { x = 42.4, y = 25.6, r = 60, n = 2, alt = true }, { x = 59.7, y = 17.2, r = 98, n = 6, alt = true }, { x = 56.3, y = 14.7, r = 61, n = 2, alt = true }, { x = 44, y = 19.2, r = 64, n = 6, alt = true }, { x = 39.8, y = 31.5, r = 60, n = 1, alt = true }, { x = 54.7, y = 13.4, r = 60, n = 2, alt = true }, { x = 47.7, y = 14.5, r = 60, n = 1, alt = true }, { x = 41.2, y = 23.1, r = 60, n = 2, alt = true }, { x = 53, y = 12.8, r = 71, n = 4, alt = true }, { x = 40.6, y = 24.7, r = 85, n = 3, alt = true }, { x = 50.3, y = 13.1, r = 60, n = 1, alt = true }, { x = 58.3, y = 14.2, r = 82, n = 5, alt = true }, { x = 58.1, y = 12.6, r = 110, n = 7, alt = true }, { x = 56.7, y = 10.8, r = 79, n = 4, alt = true }, { x = 54.7, y = 10.1, r = 80, n = 5, alt = true }, { x = 60.2, y = 11.9, r = 60, n = 1, alt = true }, { x = 59.2, y = 10.6, r = 60, n = 2, alt = true }, { x = 54.8, y = 8.1, r = 60, n = 2, alt = true } }, spread = true },
					},
				},
				{
					title = "Sergra Darkthorn",
					goals = {
						{ t = "turnin", quest = 844, title = "Plainstrider Menace", npc = 3338, npcName = "Sergra Darkthorn", map = 1413, x = 52.23, y = 31.01, f = "e" },
						{ t = "accept", quest = 845, title = "The Zhevra", npc = 3338, npcName = "Sergra Darkthorn", minLevel = 10, qlvl = 13, pre = { 844 }, preTitles = { [844] = "Plainstrider Menace" }, map = 1413, x = 52.23, y = 31.01, f = "e" },
					},
				},
				{
					title = "Zhevra and raptors",
					note = "Zhevra Runners graze on the same plains; finish the raptor heads as you go.",
					goals = {
						{ t = "collect", quest = 845, title = "The Zhevra", item = 5086, itemName = "Zhevra Hooves", count = 4, oi = 1, map = 1413, x = 50.79, y = 34.14, f = "e", spots = { { x = 50.8, y = 34.1, r = 51, n = 1 }, { x = 47.8, y = 37.4, r = 84, n = 4 }, { x = 44.3, y = 33.2, r = 53, n = 4 }, { x = 46.9, y = 25.6, r = 60, n = 3 }, { x = 42.5, y = 23.8, r = 51, n = 3 }, { x = 49.5, y = 13.3, r = 51, n = 1 }, { x = 52.5, y = 17.1, r = 75, n = 5 }, { x = 55.7, y = 21.6, r = 91, n = 4 }, { x = 61.8, y = 18.3, r = 53, n = 3 }, { x = 56.3, y = 32.6, r = 51, n = 1 }, { x = 55.7, y = 38.8, r = 51, n = 1 }, { x = 64.5, y = 34.6, r = 51, n = 1 }, { x = 50.5, y = 36.1, r = 51, n = 2, alt = true }, { x = 52.3, y = 35.4, r = 68, n = 5, alt = true }, { x = 49.3, y = 36.3, r = 65, n = 3, alt = true }, { x = 51.3, y = 37.6, r = 51, n = 4, alt = true }, { x = 52.3, y = 37.4, r = 56, n = 3, alt = true }, { x = 53.3, y = 36.1, r = 51, n = 3, alt = true }, { x = 49.2, y = 37.8, r = 81, n = 6, alt = true }, { x = 54, y = 33, r = 51, n = 1, alt = true }, { x = 53, y = 39, r = 51, n = 3, alt = true }, { x = 54.8, y = 34.9, r = 62, n = 3, alt = true }, { x = 54.5, y = 38, r = 59, n = 4, alt = true }, { x = 47.1, y = 28.6, r = 51, n = 1, alt = true }, { x = 56.3, y = 34.4, r = 66, n = 6, alt = true }, { x = 45.8, y = 30.4, r = 84, n = 6, alt = true }, { x = 44.6, y = 35.3, r = 51, n = 1, alt = true }, { x = 46.3, y = 27.2, r = 74, n = 6, alt = true }, { x = 43.4, y = 31.6, r = 51, n = 2, alt = true }, { x = 43.6, y = 28.4, r = 74, n = 7, alt = true }, { x = 44.6, y = 25.9, r = 70, n = 4, alt = true }, { x = 56.7, y = 23.1, r = 51, n = 1, alt = true }, { x = 52.8, y = 20.3, r = 51, n = 1, alt = true }, { x = 42.8, y = 26.1, r = 60, n = 4, alt = true }, { x = 52.8, y = 18.9, r = 54, n = 2, alt = true }, { x = 57, y = 21.7, r = 51, n = 1, alt = true }, { x = 61.2, y = 34.5, r = 51, n = 1, alt = true }, { x = 57, y = 19.7, r = 51, n = 3, alt = true }, { x = 58.1, y = 20.5, r = 51, n = 4, alt = true }, { x = 53.8, y = 16.7, r = 51, n = 1, alt = true }, { x = 59.3, y = 21.2, r = 61, n = 3, alt = true }, { x = 60.7, y = 22, r = 73, n = 4, alt = true }, { x = 52.3, y = 15, r = 51, n = 2, alt = true }, { x = 63.6, y = 31.5, r = 51, n = 1, alt = true }, { x = 51.4, y = 14.7, r = 51, n = 1, alt = true }, { x = 61.6, y = 22.9, r = 56, n = 3, alt = true }, { x = 64.7, y = 33.8, r = 64, n = 3, alt = true }, { x = 62.3, y = 22.1, r = 51, n = 2, alt = true }, { x = 51.2, y = 12.8, r = 56, n = 3, alt = true } }, spread = true },
						{ t = "collect", quest = 869, title = "Raptor Thieves", item = 5062, itemName = "Raptor Head", count = 12, oi = 1, map = 1413, x = 52.93, y = 33.04, f = "e", spots = { { x = 53.1, y = 33.7, r = 60, n = 2 }, { x = 60, y = 35.6, r = 60, n = 1 }, { x = 62.3, y = 25.9, r = 60, n = 1 }, { x = 59.8, y = 14.4, r = 71, n = 5 }, { x = 53.4, y = 14.7, r = 60, n = 1 }, { x = 48.9, y = 23.8, r = 60, n = 1 }, { x = 41.4, y = 20.3, r = 68, n = 3 }, { x = 40.5, y = 29, r = 60, n = 1 }, { x = 42.7, y = 38.3, r = 60, n = 2 }, { x = 50.1, y = 45.3, r = 60, n = 1 }, { x = 61, y = 46.8, r = 78, n = 3 }, { x = 63.6, y = 6, r = 60, n = 1 }, { x = 52.2, y = 35.9, r = 60, n = 1, alt = true }, { x = 54.2, y = 35.9, r = 60, n = 2, alt = true }, { x = 56.2, y = 34.3, r = 60, n = 2, alt = true }, { x = 57.4, y = 36.4, r = 72, n = 5, alt = true }, { x = 50.1, y = 39.4, r = 78, n = 3, alt = true }, { x = 54.4, y = 40.5, r = 74, n = 3, alt = true }, { x = 56, y = 39.4, r = 60, n = 3, alt = true }, { x = 58.6, y = 34.1, r = 60, n = 3, alt = true }, { x = 57.6, y = 38.4, r = 60, n = 1, alt = true }, { x = 57.4, y = 40.2, r = 60, n = 2, alt = true }, { x = 54.6, y = 23.2, r = 60, n = 1, alt = true }, { x = 48.1, y = 25.6, r = 60, n = 2, alt = true }, { x = 48.9, y = 41.7, r = 60, n = 1, alt = true }, { x = 53.1, y = 43.6, r = 70, n = 3, alt = true }, { x = 51.3, y = 22.6, r = 60, n = 1, alt = true }, { x = 51.6, y = 43.8, r = 62, n = 3, alt = true }, { x = 58.8, y = 39.9, r = 60, n = 1, alt = true }, { x = 45.6, y = 30.3, r = 60, n = 1, alt = true }, { x = 57.6, y = 42.3, r = 60, n = 1, alt = true }, { x = 60.4, y = 29.2, r = 60, n = 3, alt = true }, { x = 55.4, y = 44.4, r = 60, n = 2, alt = true }, { x = 44.8, y = 33.4, r = 60, n = 1, alt = true }, { x = 55.4, y = 21.2, r = 60, n = 1, alt = true }, { x = 54.7, y = 46.1, r = 60, n = 1, alt = true }, { x = 52.8, y = 46.5, r = 94, n = 3, alt = true }, { x = 53.1, y = 19.4, r = 60, n = 1, alt = true }, { x = 59.1, y = 43.5, r = 100, n = 5, alt = true }, { x = 43.6, y = 34.1, r = 69, n = 3, alt = true }, { x = 51.8, y = 18.7, r = 60, n = 1, alt = true }, { x = 58, y = 20.5, r = 60, n = 1, alt = true }, { x = 44.3, y = 26.1, r = 60, n = 1, alt = true }, { x = 61.5, y = 41.3, r = 60, n = 1, alt = true }, { x = 44.1, y = 41, r = 60, n = 5, alt = true }, { x = 60.6, y = 22.7, r = 60, n = 2, alt = true }, { x = 60, y = 44.5, r = 74, n = 6, alt = true }, { x = 59.1, y = 46.1, r = 89, n = 10, alt = true }, { x = 42, y = 33.7, r = 60, n = 3, alt = true }, { x = 42.1, y = 30, r = 60, n = 2, alt = true }, { x = 61.9, y = 23.1, r = 60, n = 1, alt = true }, { x = 54.3, y = 16.3, r = 118, n = 4, alt = true }, { x = 56.3, y = 16.8, r = 60, n = 1, alt = true }, { x = 57.6, y = 17.4, r = 60, n = 1, alt = true }, { x = 42.4, y = 25.6, r = 60, n = 2, alt = true }, { x = 59.7, y = 17.2, r = 98, n = 6, alt = true }, { x = 56.3, y = 14.7, r = 61, n = 2, alt = true }, { x = 44, y = 19.2, r = 64, n = 6, alt = true }, { x = 39.8, y = 31.5, r = 60, n = 1, alt = true }, { x = 54.7, y = 13.4, r = 60, n = 2, alt = true }, { x = 47.7, y = 14.5, r = 60, n = 1, alt = true }, { x = 41.2, y = 23.1, r = 60, n = 2, alt = true }, { x = 53, y = 12.8, r = 71, n = 4, alt = true }, { x = 40.6, y = 24.7, r = 85, n = 3, alt = true }, { x = 50.3, y = 13.1, r = 60, n = 1, alt = true }, { x = 58.3, y = 14.2, r = 82, n = 5, alt = true }, { x = 58.1, y = 12.6, r = 110, n = 7, alt = true }, { x = 56.7, y = 10.8, r = 79, n = 4, alt = true }, { x = 54.7, y = 10.1, r = 80, n = 5, alt = true }, { x = 60.2, y = 11.9, r = 60, n = 1, alt = true }, { x = 59.2, y = 10.6, r = 60, n = 2, alt = true }, { x = 54.8, y = 8.1, r = 60, n = 2, alt = true } }, spread = true },
					},
				},
				{
					title = "The Crossroads",
					goals = {
						{ t = "turnin", quest = 869, title = "Raptor Thieves", npc = 3464, npcName = "Gazrog", map = 1413, x = 51.93, y = 30.32, f = "e", note = "Gazrog" },
						{ t = "turnin", quest = 845, title = "The Zhevra", npc = 3338, npcName = "Sergra Darkthorn", map = 1413, x = 52.23, y = 31.01, f = "e", note = "Sergra Darkthorn" },
						{ t = "accept", quest = 903, title = "Prowlers of the Barrens", npc = 3338, npcName = "Sergra Darkthorn", minLevel = 10, qlvl = 15, pre = { 845 }, preTitles = { [845] = "The Zhevra" }, map = 1413, x = 52.23, y = 31.01, f = "e" },
						{ t = "accept", quest = 867, title = "Harpy Raiders", npc = 3449, npcName = "Darsok Swiftdagger", minLevel = 12, qlvl = 15, map = 1413, x = 51.62, y = 30.9, f = "e", note = "Darsok Swiftdagger, on the tower platform: needs level 12" },
					},
				},
				{
					title = "Thun'grim Firegaze",
					note = "Thun'grim camps beside the road east toward Ratchet.",
					only = { classes = { "WARRIOR" } },
					goals = {
						{ t = "turnin", quest = 1502, title = "Thun'grim Firegaze", npc = 5878, npcName = "Thun'grim Firegaze", map = 1413, x = 57.23, y = 30.34, f = "e" },
						{ t = "accept", quest = 1503, title = "Forged Steel", npc = 5878, npcName = "Thun'grim Firegaze", minLevel = 10, qlvl = 10, pre = { 1502 }, preTitles = { [1502] = "Thun'grim Firegaze" }, map = 1413, x = 57.23, y = 30.34, f = "e" },
					},
				},
				{
					title = "Kranal Fiss",
					note = "Kranal Fiss stands on the ridge north of the Razormane camp, east of the Crossroads.",
					only = { classes = { "SHAMAN" } },
					goals = {
						{ t = "turnin", quest = 2983, title = "Call of Fire", npc = 5907, npcName = "Kranal Fiss", map = 1413, x = 56.03, y = 19.89, f = "e" },
						{ t = "accept", quest = 1524, title = "Call of Fire", npc = 5907, npcName = "Kranal Fiss", minLevel = 10, qlvl = 11, map = 1413, x = 56.03, y = 19.89, f = "e" },
					},
				},
				{
					title = "Telf Joolam",
					note = "Telf waits on the Durotar bank of the Southfury River, east of the Razormane camp.",
					only = { classes = { "SHAMAN" } },
					goals = {
						{ t = "turnin", quest = 1524, title = "Call of Fire", npc = 5900, npcName = "Telf Joolam", map = 1411, x = 38.55, y = 58.96, f = "e" },
						{ t = "accept", quest = 1525, title = "Call of Fire", npc = 5900, npcName = "Telf Joolam", minLevel = 10, qlvl = 12, pre = { 1524 }, preTitles = { [1524] = "Call of Fire" }, map = 1411, x = 38.55, y = 58.96, f = "e" },
					},
				},
				{
					title = "Dustwind Gulch cultists",
					note = "Burning Blade Cultists hold Dustwind Gulch in northern Durotar, by Drygulch Ravine; they drop the Reagent Pouch.",
					only = { classes = { "SHAMAN" } },
					goals = {
						{ t = "collect", quest = 1525, title = "Call of Fire", item = 6652, itemName = "Reagent Pouch", count = 1, oi = 2, map = 1411, x = 52.41, y = 26.8, f = "e", spots = { { x = 52.4, y = 25.5, r = 46, n = 7 } } },
					},
				},
				{
					title = "Razormane camp",
					note = "Water Seekers, Thornweavers and Hunters hold the camp east of the Crossroads. The supply crates sit at its eastern end. Warriors: the Stolen Iron Chest stands in the camp. Shamans: the quilboar drop the Fire Tar. Kill Savannah Prowlers you pass for their claws.",
					goals = {
						{ t = "kill", quest = 871, title = "Disrupt the Attacks", target = "Razormane Water Seeker", npc = 3267, count = 8, oi = 1, map = 1413, x = 54.59, y = 25.93, f = "e", spots = { { x = 54.2, y = 25.5, r = 45, n = 5 }, { x = 55.4, y = 26.9, r = 48, n = 5 }, { x = 53.5, y = 25.1, r = 46, n = 3 }, { x = 55.5, y = 25.8, r = 15, n = 1, alt = true } } },
						{ t = "kill", quest = 871, title = "Disrupt the Attacks", target = "Razormane Thornweaver", npc = 3268, count = 8, oi = 2, map = 1413, x = 54.74, y = 25.6, f = "e", spots = { { x = 54.5, y = 25.2, r = 54, n = 6 }, { x = 55.1, y = 26.9, r = 41, n = 3 }, { x = 55.7, y = 26.6, r = 31, n = 3 } } },
						{ t = "kill", quest = 871, title = "Disrupt the Attacks", target = "Razormane Hunter", npc = 3265, count = 3, oi = 3, map = 1413, x = 54.92, y = 25.24, f = "e", spots = { { x = 55.2, y = 25.8, r = 59, n = 3 }, { x = 53.8, y = 25.3, r = 50, n = 1 }, { x = 57.9, y = 24.1, r = 50, n = 3 }, { x = 59.4, y = 23.9, r = 50, n = 1 }, { x = 59.2, y = 26.5, r = 50, n = 1 } }, spread = true },
						{ t = "collect", quest = 5041, title = "Supplies for the Crossroads", item = 12708, itemName = "Crossroads' Supply Crates", oi = 1, map = 1413, x = 58.8, y = 25.8, f = "e", spots = { { x = 58.8, y = 25.8, r = 37, n = 1 }, { x = 59.3, y = 24.6, r = 21, n = 3, alt = true }, { x = 58.6, y = 27.2, r = 27, n = 3, alt = true } } },
						{ t = "collect", quest = 1503, title = "Forged Steel", item = 6534, itemName = "Forged Steel Bars", count = 1, oi = 1, map = 1413, x = 55.05, y = 26.65, f = "e", only = { classes = { "WARRIOR" } } },
						{ t = "collect", quest = 1525, title = "Call of Fire", item = 5026, itemName = "Fire Tar", count = 1, oi = 1, map = 1413, x = 55.11, y = 26.59, f = "e", spots = { { x = 55.4, y = 26.8, r = 72, n = 11 }, { x = 55.3, y = 25.5, r = 40, n = 2 }, { x = 54.4, y = 25.3, r = 49, n = 8 }, { x = 53.9, y = 25.7, r = 40, n = 3 }, { x = 53.4, y = 24.8, r = 40, n = 2 }, { x = 57, y = 25.3, r = 52, n = 3 }, { x = 57.1, y = 24.4, r = 40, n = 3 }, { x = 59.1, y = 24.4, r = 45, n = 6 }, { x = 58.5, y = 26.7, r = 43, n = 4 } }, spread = true, only = { classes = { "SHAMAN" } } },
						{ t = "collect", quest = 903, title = "Prowlers of the Barrens", item = 5096, itemName = "Prowler Claws", count = 7, oi = 1, map = 1413, x = 55.6, y = 16.32, f = "e", spots = { { x = 55.5, y = 16.2, r = 40, n = 2 }, { x = 60.4, y = 7.9, r = 40, n = 2 }, { x = 63.6, y = 5.9, r = 40, n = 3 }, { x = 63, y = 27.7, r = 42, n = 3 }, { x = 59.7, y = 34.4, r = 40, n = 1 }, { x = 59.1, y = 40.9, r = 53, n = 3 }, { x = 43.5, y = 39.3, r = 40, n = 1 }, { x = 42.5, y = 34.9, r = 40, n = 2 }, { x = 44.3, y = 31.6, r = 40, n = 3 }, { x = 42.6, y = 28.9, r = 40, n = 1 }, { x = 41.3, y = 24.3, r = 40, n = 1 }, { x = 40.6, y = 20.7, r = 49, n = 4 }, { x = 55.6, y = 14.7, r = 40, n = 2, alt = true }, { x = 54.6, y = 14.9, r = 43, n = 4, alt = true }, { x = 53.5, y = 15.5, r = 51, n = 7, alt = true }, { x = 53.7, y = 13.7, r = 40, n = 2, alt = true }, { x = 63.3, y = 7.3, r = 40, n = 1, alt = true }, { x = 63, y = 29.1, r = 40, n = 2, alt = true }, { x = 59, y = 36.5, r = 40, n = 1, alt = true }, { x = 41.9, y = 23.4, r = 40, n = 2, alt = true }, { x = 40.8, y = 22.2, r = 51, n = 4, alt = true }, { x = 57.7, y = 39.3, r = 40, n = 1, alt = true }, { x = 43.9, y = 32.8, r = 40, n = 2, alt = true }, { x = 40.9, y = 26.7, r = 40, n = 3, alt = true }, { x = 41.3, y = 28.5, r = 40, n = 2, alt = true }, { x = 43, y = 33.5, r = 40, n = 3, alt = true }, { x = 42.5, y = 32.9, r = 44, n = 4, alt = true }, { x = 43.6, y = 35.4, r = 40, n = 2, alt = true }, { x = 43.8, y = 37.8, r = 40, n = 2, alt = true } }, spread = true, optional = true },
					},
				},
				{
					title = "Telf Joolam",
					note = "Telf makes Fire Sapta from the tar and pouch. Use it by the brazier next to him to reveal the Minor Manifestation of Fire, kill it for the Glowing Ember, then place the ember in the brazier.",
					only = { classes = { "SHAMAN" } },
					goals = {
						{ t = "turnin", quest = 1525, title = "Call of Fire", npc = 5900, npcName = "Telf Joolam", map = 1411, x = 38.55, y = 58.96, f = "e" },
						{ t = "accept", quest = 1526, title = "Call of Fire", npc = 5900, npcName = "Telf Joolam", minLevel = 10, qlvl = 13, pre = { 1525 }, preTitles = { [1525] = "Call of Fire" }, map = 1411, x = 38.55, y = 58.96, f = "e" },
						{ t = "collect", quest = 1526, title = "Call of Fire", item = 6655, itemName = "Glowing Ember", count = 1, oi = 1, map = 1411, x = 38.72, y = 58.29, f = "e" },
						{ t = "turnin", quest = 1526, title = "Call of Fire", object = 61934, objName = "Brazier of the Dormant Flame", map = 1411, x = 38.96, y = 58.22, f = "e" },
						{ t = "accept", quest = 1527, title = "Call of Fire", object = 61934, objName = "Brazier of the Dormant Flame", minLevel = 10, qlvl = 13, pre = { 1526 }, preTitles = { [1526] = "Call of Fire" }, map = 1411, x = 38.96, y = 58.22, f = "e" },
					},
				},
				{
					title = "Kranal Fiss",
					only = { classes = { "SHAMAN" } },
					goals = {
						{ t = "turnin", quest = 1527, title = "Call of Fire", npc = 5907, npcName = "Kranal Fiss", map = 1413, x = 56.03, y = 19.89, f = "e" },
					},
				},
				{
					title = "Thun'grim Firegaze",
					only = { classes = { "WARRIOR" } },
					goals = {
						{ t = "turnin", quest = 1503, title = "Forged Steel", npc = 5878, npcName = "Thun'grim Firegaze", map = 1413, x = 57.23, y = 30.34, f = "e" },
					},
				},
				{
					title = "Ratchet",
					note = "Follow the road south-east to Ratchet on the coast.",
					goals = {
						{ t = "getfp", location = "Ratchet" },
						{ t = "sethome", location = "Ratchet" },
						{ t = "turnin", quest = 1492, title = "Wharfmaster Dizzywig", npc = 3453, npcName = "Wharfmaster Dizzywig", map = 1413, x = 63.35, y = 38.45, f = "e", note = "Wharfmaster Dizzywig" },
						{ t = "accept", quest = 887, title = "Southsea Freebooters", npc = 3391, npcName = "Gazlowe", minLevel = 9, qlvl = 14, map = 1413, x = 62.68, y = 36.23, f = "e", note = "Gazlowe" },
						{ t = "accept", quest = 97253, title = "Parts and Pieces", npc = 7161, npcName = "Wrenix the Wretched", minLevel = 9, qlvl = 14, map = 1413, x = 63.07, y = 36.32, f = "e", note = "Wrenix the Wretched" },
						{ t = "accept", quest = 894, title = "Samophlange", npc = 3442, npcName = "Sputtervalve", minLevel = 10, qlvl = 14, map = 1413, x = 62.98, y = 37.22, f = "e", note = "Sputtervalve" },
					},
				},
				{
					title = "Southsea beach",
					note = "The pirates camp along the beach south of Ratchet. The piles of complicated parts lie in and around their camp.",
					goals = {
						{ t = "kill", quest = 887, title = "Southsea Freebooters", target = "Southsea Brigand", npc = 3381, count = 12, oi = 1, map = 1413, x = 63.58, y = 43.35, f = "e", spots = { { x = 64.1, y = 43.8, r = 61, n = 5 }, { x = 63.8, y = 44.9, r = 40, n = 3 }, { x = 63.6, y = 46, r = 40, n = 2 }, { x = 64.1, y = 47, r = 40, n = 4 }, { x = 63.8, y = 48.9, r = 40, n = 3 }, { x = 62.8, y = 49.9, r = 40, n = 2 } }, spread = true },
						{ t = "kill", quest = 887, title = "Southsea Freebooters", target = "Southsea Cannoneer", npc = 3382, count = 6, oi = 2, map = 1413, x = 63.86, y = 43.83, f = "e", spots = { { x = 63.7, y = 46.3, r = 34, n = 3 }, { x = 64.3, y = 47.2, r = 41, n = 4 }, { x = 63.8, y = 49, r = 23, n = 2 }, { x = 62.8, y = 49.7, r = 46, n = 4 }, { x = 63.9, y = 43.8, r = 15, n = 1, alt = true }, { x = 64.6, y = 44.1, r = 15, n = 1, alt = true }, { x = 62.9, y = 44, r = 15, n = 1, alt = true } } },
						{ t = "collect", quest = 97253, title = "Parts and Pieces", item = 277331, itemName = "Handful of Complicated Parts", count = 5, oi = 1, map = 1413, x = 62.2, y = 44, f = "e", spots = { { x = 61.9, y = 44.9, r = 69, n = 4 }, { x = 61.8, y = 48.2, r = 68, n = 3 } } },
					},
				},
				{
					title = "Ratchet",
					goals = {
						{ t = "turnin", quest = 97253, title = "Parts and Pieces", npc = 7161, npcName = "Wrenix the Wretched", map = 1413, x = 63.07, y = 36.32, f = "e", note = "Wrenix the Wretched" },
						{ t = "turnin", quest = 887, title = "Southsea Freebooters", npc = 3391, npcName = "Gazlowe", map = 1413, x = 62.68, y = 36.23, f = "e", note = "Gazlowe" },
						{ t = "accept", quest = 890, title = "The Missing Shipment", npc = 3391, npcName = "Gazlowe", minLevel = 9, qlvl = 14, pre = { 887 }, preTitles = { [887] = "Southsea Freebooters" }, map = 1413, x = 62.68, y = 36.23, f = "e" },
						{ t = "turnin", quest = 890, title = "The Missing Shipment", npc = 3453, npcName = "Wharfmaster Dizzywig", map = 1413, x = 63.35, y = 38.45, f = "e", note = "Wharfmaster Dizzywig" },
						{ t = "accept", quest = 892, title = "The Missing Shipment", npc = 3453, npcName = "Wharfmaster Dizzywig", minLevel = 9, qlvl = 14, pre = { 890 }, preTitles = { [890] = "The Missing Shipment" }, map = 1413, x = 63.35, y = 38.45, f = "e" },
						{ t = "turnin", quest = 892, title = "The Missing Shipment", npc = 3391, npcName = "Gazlowe", map = 1413, x = 62.68, y = 36.23, f = "e", note = "Gazlowe" },
						{ t = "accept", quest = 888, title = "Stolen Booty", npc = 3391, npcName = "Gazlowe", minLevel = 9, qlvl = 16, pre = { 892 }, preTitles = { [892] = "The Missing Shipment" }, map = 1413, x = 62.68, y = 36.23, f = "e" },
					},
				},
				{
					title = "Stolen Booty",
					note = "Back to the pirate camp: the boots are in the crate marked Drizzlik's Emporium at the camp's south end, the lens in the Fragile crate just east of it.",
					goals = {
						{ t = "collect", quest = 888, title = "Stolen Booty", item = 5076, itemName = "Shipment of Boots", count = 1, oi = 1, map = 1413, x = 62.6, y = 49.6, f = "e" },
						{ t = "collect", quest = 888, title = "Stolen Booty", item = 5077, itemName = "Telescopic Lens", oi = 2, map = 1413, x = 63.6, y = 49.3, f = "e" },
					},
				},
				{
					title = "Gazlowe",
					goals = {
						{ t = "turnin", quest = 888, title = "Stolen Booty", npc = 3391, npcName = "Gazlowe", map = 1413, x = 62.68, y = 36.23, f = "e" },
					},
				},
				{
					title = "Back to the Crossroads",
					note = "Walk back up the road to the Crossroads. Savannah Prowlers hunt along it and on the plains west of town: finish the claws before you hand them in.",
					goals = {
						{ t = "collect", quest = 903, title = "Prowlers of the Barrens", item = 5096, itemName = "Prowler Claws", count = 7, oi = 1, map = 1413, x = 59.68, y = 34.41, f = "e", spots = { { x = 59.7, y = 34.4, r = 40, n = 1 }, { x = 59.1, y = 40.9, r = 53, n = 3 }, { x = 63, y = 27.7, r = 42, n = 3 }, { x = 53.5, y = 15.5, r = 51, n = 7 }, { x = 60.4, y = 7.9, r = 40, n = 2 }, { x = 63.6, y = 5.9, r = 40, n = 3 }, { x = 40.6, y = 20.7, r = 49, n = 4 }, { x = 41.3, y = 24.3, r = 40, n = 1 }, { x = 42.6, y = 28.9, r = 40, n = 1 }, { x = 44.3, y = 31.6, r = 40, n = 3 }, { x = 42.5, y = 34.9, r = 40, n = 2 }, { x = 43.5, y = 39.3, r = 40, n = 1 }, { x = 59, y = 36.5, r = 40, n = 1, alt = true }, { x = 57.7, y = 39.3, r = 40, n = 1, alt = true }, { x = 63, y = 29.1, r = 40, n = 2, alt = true }, { x = 55.5, y = 16.2, r = 40, n = 2, alt = true }, { x = 55.6, y = 14.7, r = 40, n = 2, alt = true }, { x = 54.6, y = 14.9, r = 43, n = 4, alt = true }, { x = 53.7, y = 13.7, r = 40, n = 2, alt = true }, { x = 43.9, y = 32.8, r = 40, n = 2, alt = true }, { x = 43.8, y = 37.8, r = 40, n = 2, alt = true }, { x = 43.6, y = 35.4, r = 40, n = 2, alt = true }, { x = 43, y = 33.5, r = 40, n = 3, alt = true }, { x = 42.5, y = 32.9, r = 44, n = 4, alt = true }, { x = 63.3, y = 7.3, r = 40, n = 1, alt = true }, { x = 41.3, y = 28.5, r = 40, n = 2, alt = true }, { x = 41.9, y = 23.4, r = 40, n = 2, alt = true }, { x = 40.9, y = 26.7, r = 40, n = 3, alt = true }, { x = 40.8, y = 22.2, r = 51, n = 4, alt = true } }, spread = true, optional = true },
						{ t = "turnin", quest = 903, title = "Prowlers of the Barrens", npc = 3338, npcName = "Sergra Darkthorn", map = 1413, x = 52.23, y = 31.01, f = "e", note = "Sergra Darkthorn" },
						{ t = "accept", quest = 881, title = "Echeyakee", npc = 3338, npcName = "Sergra Darkthorn", minLevel = 10, qlvl = 16, pre = { 903 }, preTitles = { [903] = "Prowlers of the Barrens" }, map = 1413, x = 52.23, y = 31.01, f = "e" },
						{ t = "turnin", quest = 871, title = "Disrupt the Attacks", npc = 3429, npcName = "Thork", map = 1413, x = 51.5, y = 30.87, f = "e", note = "Thork" },
						{ t = "turnin", quest = 5041, title = "Supplies for the Crossroads", npc = 3429, npcName = "Thork", map = 1413, x = 51.5, y = 30.87, f = "e" },
						{ t = "accept", quest = 872, title = "The Disruption Ends", npc = 3429, npcName = "Thork", minLevel = 9, qlvl = 15, pre = { 871 }, preTitles = { [871] = "Disrupt the Attacks" }, map = 1413, x = 51.5, y = 30.87, f = "e" },
					},
				},
				{
					title = "Regthar Deathgate",
					note = "Regthar stands at the Kolkar watch post just west of the Crossroads.",
					goals = {
						{ t = "accept", quest = 855, title = "Centaur Bracers", npc = 3389, npcName = "Regthar Deathgate", minLevel = 9, qlvl = 14, map = 1413, x = 45.34, y = 28.41, f = "e" },
					},
				},
				{
					title = "Kolkar camps and the Forgotten Pools",
					note = "The Kolkar camps spread north-west of Regthar; every Kolkar can drop Centaur Bracers. The Forgotten Pools lie in their middle, with Laden Mushrooms around the water. Savannah Prowlers roam the same plains.",
					goals = {
						{ t = "collect", quest = 855, title = "Centaur Bracers", item = 5030, itemName = "Centaur Bracers", count = 15, oi = 1, map = 1413, x = 45.88, y = 25.4, f = "e", spots = { { x = 45.7, y = 25.6, r = 40, n = 3 }, { x = 43.1, y = 23.6, r = 50, n = 6 }, { x = 42.2, y = 26.9, r = 40, n = 5 }, { x = 44.9, y = 20.1, r = 55, n = 6 }, { x = 46.8, y = 36.5, r = 40, n = 1 }, { x = 48.8, y = 39, r = 40, n = 2 }, { x = 48.5, y = 42.5, r = 40, n = 1 }, { x = 45.8, y = 41, r = 49, n = 6 }, { x = 53.2, y = 42, r = 48, n = 4 }, { x = 53.1, y = 36.8, r = 40, n = 4 }, { x = 57, y = 40.9, r = 40, n = 4 }, { x = 55.7, y = 46, r = 59, n = 4 }, { x = 45.6, y = 23.3, r = 61, n = 4, alt = true }, { x = 44.6, y = 24.1, r = 40, n = 3, alt = true }, { x = 46.5, y = 22.9, r = 40, n = 4, alt = true }, { x = 47.2, y = 23.4, r = 40, n = 2, alt = true }, { x = 47.9, y = 24.5, r = 42, n = 3, alt = true }, { x = 45.5, y = 22.1, r = 40, n = 1, alt = true }, { x = 44.5, y = 22.6, r = 40, n = 3, alt = true }, { x = 43.5, y = 26.5, r = 40, n = 4, alt = true }, { x = 43.8, y = 21.3, r = 52, n = 6, alt = true }, { x = 42.2, y = 24.7, r = 51, n = 6, alt = true }, { x = 45.7, y = 37.1, r = 40, n = 3, alt = true }, { x = 46.7, y = 37.5, r = 43, n = 4, alt = true }, { x = 47.8, y = 37.4, r = 40, n = 2, alt = true }, { x = 45.7, y = 38.1, r = 40, n = 3, alt = true }, { x = 44.4, y = 38.2, r = 40, n = 5, alt = true }, { x = 47.1, y = 38.7, r = 40, n = 3, alt = true }, { x = 48.1, y = 38.5, r = 40, n = 1, alt = true }, { x = 45.1, y = 39.5, r = 46, n = 5, alt = true }, { x = 47.7, y = 39.4, r = 40, n = 1, alt = true }, { x = 47.1, y = 40.8, r = 40, n = 3, alt = true }, { x = 48.3, y = 40.6, r = 53, n = 5, alt = true }, { x = 47.4, y = 41.8, r = 40, n = 2, alt = true }, { x = 46.6, y = 42.1, r = 40, n = 2, alt = true }, { x = 52.7, y = 38.9, r = 40, n = 1, alt = true }, { x = 54.8, y = 37.2, r = 40, n = 2, alt = true }, { x = 53.4, y = 40.6, r = 40, n = 4, alt = true }, { x = 54.7, y = 41, r = 40, n = 2, alt = true }, { x = 53.9, y = 42.9, r = 40, n = 2, alt = true }, { x = 55.3, y = 41.3, r = 40, n = 1, alt = true }, { x = 52.8, y = 44.7, r = 48, n = 5, alt = true }, { x = 54.7, y = 42.9, r = 40, n = 1, alt = true }, { x = 56.4, y = 41.9, r = 40, n = 4, alt = true }, { x = 55.7, y = 43.9, r = 40, n = 2, alt = true }, { x = 56.7, y = 43.2, r = 43, n = 4, alt = true }, { x = 54.3, y = 46.8, r = 40, n = 1, alt = true } }, spread = true },
						{ t = "goto", text = "The Forgotten Pools", map = 1413, x = 45.1, y = 22.5, f = "e", note = "Wade into the pools to explore them" },
						{ t = "complete", quest = 870, title = "The Forgotten Pools" },
						{ t = "collect", quest = 848, title = "Fungal Spores", item = 5012, itemName = "Fungal Spores", count = 4, oi = 1, map = 1413, x = 45.56, y = 22.47, f = "e", spots = { { x = 45.2, y = 22.3, r = 56, n = 7 }, { x = 44.2, y = 25, r = 59, n = 2 }, { x = 45.9, y = 38, r = 66, n = 5 }, { x = 47.1, y = 39.2, r = 62, n = 3 }, { x = 47.6, y = 40.6, r = 72, n = 4 }, { x = 46.8, y = 41.9, r = 46, n = 1 }, { x = 45.9, y = 40.3, r = 46, n = 3 }, { x = 47.4, y = 37.5, r = 46, n = 1 }, { x = 53.4, y = 43.4, r = 46, n = 1 }, { x = 55.3, y = 44.3, r = 46, n = 1 }, { x = 56, y = 43, r = 46, n = 3 }, { x = 55.6, y = 41.5, r = 78, n = 5 }, { x = 45, y = 23.5, r = 68, n = 5, alt = true }, { x = 54.9, y = 42.9, r = 57, n = 3, alt = true } }, spread = true },
					},
				},
				{
					title = "Regthar Deathgate",
					goals = {
						{ t = "turnin", quest = 855, title = "Centaur Bracers", npc = 3389, npcName = "Regthar Deathgate", map = 1413, x = 45.34, y = 28.41, f = "e" },
					},
				},
				{
					title = "Witchwing harpies",
					note = "The harpies nest in the Dry Hills north-west of the Forgotten Pools; any of them can drop a talon.",
					goals = {
						{ t = "collect", quest = 867, title = "Harpy Raiders", item = 5064, itemName = "Witchwing Talon", count = 8, oi = 1, map = 1413, x = 41.85, y = 19.32, f = "e", spots = { { x = 41.6, y = 18.9, r = 43, n = 7 }, { x = 40.8, y = 17.2, r = 67, n = 8 }, { x = 39.5, y = 16.8, r = 41, n = 4 }, { x = 38.6, y = 17.4, r = 40, n = 6 }, { x = 37.6, y = 16, r = 44, n = 6 }, { x = 38.1, y = 14.9, r = 40, n = 3 }, { x = 39.1, y = 15, r = 51, n = 5 }, { x = 39.1, y = 13.5, r = 40, n = 4 }, { x = 39.7, y = 11.9, r = 40, n = 3 }, { x = 39.1, y = 10.7, r = 40, n = 5 }, { x = 40.9, y = 14.8, r = 46, n = 7 }, { x = 40.2, y = 19, r = 59, n = 8 }, { x = 41.1, y = 19.7, r = 40, n = 1, alt = true }, { x = 40.8, y = 15.9, r = 41, n = 4, alt = true }, { x = 40.1, y = 15.9, r = 50, n = 7, alt = true }, { x = 41.6, y = 14.8, r = 40, n = 3, alt = true }, { x = 38.3, y = 16.3, r = 40, n = 4, alt = true }, { x = 38.4, y = 13.2, r = 59, n = 9, alt = true }, { x = 38.9, y = 12, r = 61, n = 7, alt = true } }, spread = true },
					},
				},
				{
					title = "The Sludge Fen",
					note = "Head east to the Venture Co. research site west of the Sludge Fen. Use the Control Console, close the three valves around the drill, use the console again, then take the Console Key from Tinkerer Sniggles.",
					goals = {
						{ t = "turnin", quest = 894, title = "Samophlange", object = 4141, objName = "Control Console", map = 1413, x = 52.4, y = 11.65, f = "e" },
						{ t = "accept", quest = 900, title = "Samophlange", object = 4141, objName = "Control Console", minLevel = 10, qlvl = 14, pre = { 894 }, preTitles = { [894] = "Samophlange" }, map = 1413, x = 52.4, y = 11.65, f = "e" },
						{ t = "interact", quest = 900, title = "Samophlange", object = 61936, objName = "Fuel Control Valve", oi = 1, map = 1413, x = 52.4, y = 11.41, f = "e" },
						{ t = "interact", quest = 900, title = "Samophlange", object = 61935, objName = "Regulator Valve", oi = 2, map = 1413, x = 52.3, y = 11.42, f = "e" },
						{ t = "interact", quest = 900, title = "Samophlange", object = 4072, objName = "Main Control Valve", oi = 3, map = 1413, x = 52.33, y = 11.56, f = "e" },
						{ t = "turnin", quest = 900, title = "Samophlange", object = 4141, objName = "Control Console", map = 1413, x = 52.4, y = 11.65, f = "e" },
						{ t = "accept", quest = 901, title = "Samophlange", object = 4141, objName = "Control Console", minLevel = 10, qlvl = 14, pre = { 900 }, preTitles = { [900] = "Samophlange" }, map = 1413, x = 52.4, y = 11.65, f = "e" },
						{ t = "collect", quest = 901, title = "Samophlange", item = 5089, itemName = "Console Key", count = 1, oi = 1, map = 1413, x = 52.84, y = 10.39, f = "e" },
						{ t = "turnin", quest = 901, title = "Samophlange", object = 4141, objName = "Control Console", map = 1413, x = 52.4, y = 11.65, f = "e" },
						{ t = "accept", quest = 902, title = "Samophlange", object = 4141, objName = "Control Console", minLevel = 10, qlvl = 16, pre = { 901 }, preTitles = { [901] = "Samophlange" }, map = 1413, x = 52.4, y = 11.65, f = "e" },
					},
				},
				{
					title = "Echeyakee",
					note = "Echeyakee's lair lies south of the Sludge Fen, north-east of the Crossroads. Use the horn Sergra gave you there to call the white lion out. Then hearth to Ratchet.",
					goals = {
						{ t = "collect", quest = 881, title = "Echeyakee", item = 5100, itemName = "Echeyakee's Hide", oi = 1, map = 1413, x = 55.86, y = 17.19, f = "e" },
						{ t = "hearth", location = "Ratchet" },
					},
				},
				{
					title = "Sputtervalve",
					goals = {
						{ t = "turnin", quest = 902, title = "Samophlange", npc = 3442, npcName = "Sputtervalve", map = 1413, x = 62.98, y = 37.22, f = "e" },
						{ t = "accept", quest = 3921, title = "Wenikee Boltbucket", npc = 3442, npcName = "Sputtervalve", minLevel = 10, qlvl = 14, pre = { 902 }, preTitles = { [902] = "Samophlange" }, map = 1413, x = 62.98, y = 37.22, f = "e" },
					},
				},
				{
					title = "The Disruption Ends",
					note = "On the way back to the Crossroads, the Razormane camp again: Geomancers and Defenders hold its eastern half; Kreenig Snarlsnout walks among them.",
					goals = {
						{ t = "kill", quest = 872, title = "The Disruption Ends", target = "Razormane Geomancer", npc = 3269, count = 8, oi = 1, map = 1413, x = 59.14, y = 25.06, f = "e", spots = { { x = 59.1, y = 24.4, r = 45, n = 6 }, { x = 57.1, y = 24.4, r = 27, n = 3 }, { x = 57, y = 25.3, r = 52, n = 3 } } },
						{ t = "kill", quest = 872, title = "The Disruption Ends", target = "Razormane Defender", npc = 3266, count = 8, oi = 2, map = 1413, x = 58.9, y = 25, f = "e", spots = { { x = 59.2, y = 24.4, r = 51, n = 4 }, { x = 58.7, y = 26.6, r = 41, n = 4 }, { x = 59.2, y = 27.3, r = 33, n = 3 }, { x = 57.1, y = 25.1, r = 55, n = 4 }, { x = 59.3, y = 25.6, r = 15, n = 1, alt = true }, { x = 58, y = 24.7, r = 15, n = 1, alt = true } } },
						{ t = "collect", quest = 872, title = "The Disruption Ends", item = 5063, itemName = "Kreenig Snarlsnout's Tusk", oi = 3, map = 1413, x = 58.52, y = 27.04, f = "e" },
					},
				},
				{
					title = "The Crossroads",
					goals = {
						{ t = "turnin", quest = 872, title = "The Disruption Ends", npc = 3429, npcName = "Thork", map = 1413, x = 51.5, y = 30.87, f = "e", note = "Thork" },
						{ t = "turnin", quest = 867, title = "Harpy Raiders", npc = 3449, npcName = "Darsok Swiftdagger", map = 1413, x = 51.62, y = 30.9, f = "e", note = "Darsok Swiftdagger" },
						{ t = "accept", quest = 875, title = "Harpy Lieutenants", npc = 3449, npcName = "Darsok Swiftdagger", minLevel = 12, qlvl = 16, pre = { 867 }, preTitles = { [867] = "Harpy Raiders" }, map = 1413, x = 51.62, y = 30.9, f = "e" },
						{ t = "turnin", quest = 881, title = "Echeyakee", npc = 3338, npcName = "Sergra Darkthorn", map = 1413, x = 52.23, y = 31.01, f = "e", note = "Sergra Darkthorn" },
						{ t = "accept", quest = 905, title = "The Angry Scytheclaws", npc = 3338, npcName = "Sergra Darkthorn", minLevel = 10, qlvl = 17, pre = { 881 }, preTitles = { [881] = "Echeyakee" }, map = 1413, x = 52.23, y = 31.01, f = "e" },
						{ t = "turnin", quest = 848, title = "Fungal Spores", npc = 3390, npcName = "Apothecary Helbrim", map = 1413, x = 51.44, y = 30.15, f = "e", note = "Apothecary Helbrim" },
						{ t = "turnin", quest = 870, title = "The Forgotten Pools", npc = 3448, npcName = "Tonga Runetotem", map = 1413, x = 52.26, y = 31.93, f = "e", note = "Tonga Runetotem" },
						{ t = "accept", quest = 877, title = "The Stagnant Oasis", npc = 3448, npcName = "Tonga Runetotem", minLevel = 10, qlvl = 16, pre = { 870 }, preTitles = { [870] = "The Forgotten Pools" }, map = 1413, x = 52.26, y = 31.93, f = "e" },
					},
				},
				{
					title = "The Stagnant Oasis",
					note = "The oasis lies south-east of the Crossroads. Test the seeds at the bubbling fissure in the middle of the water.",
					goals = {
						{ t = "interact", quest = 877, title = "The Stagnant Oasis", object = 3737, objName = "Bubbling Fissure", oi = 1, map = 1413, x = 55.6, y = 42.8, f = "e" },
					},
				},
				{
					title = "Raptor Grounds",
					note = "The Raptor Grounds lie south-west of the oasis. Sunscale Scytheclaws drop the feathers you use on the three nests.",
					goals = {
						{ t = "interact", quest = 905, title = "The Angry Scytheclaws", object = 6906, objName = "Red Raptor Nest", oi = 1, map = 1413, x = 52.5, y = 46.6, f = "e" },
						{ t = "interact", quest = 905, title = "The Angry Scytheclaws", object = 6907, objName = "Blue Raptor Nest", oi = 2, map = 1413, x = 52.6, y = 46.1, f = "e" },
						{ t = "interact", quest = 905, title = "The Angry Scytheclaws", object = 6908, objName = "Yellow Raptor Nest", oi = 3, map = 1413, x = 52, y = 46.5, f = "e" },
					},
				},
				{
					title = "The Crossroads",
					goals = {
						{ t = "turnin", quest = 905, title = "The Angry Scytheclaws", npc = 3338, npcName = "Sergra Darkthorn", map = 1413, x = 52.23, y = 31.01, f = "e", note = "Sergra Darkthorn" },
						{ t = "turnin", quest = 877, title = "The Stagnant Oasis", npc = 3448, npcName = "Tonga Runetotem", map = 1413, x = 52.26, y = 31.93, f = "e", note = "Tonga Runetotem" },
						{ t = "accept", quest = 880, title = "Altered Beings", npc = 3448, npcName = "Tonga Runetotem", minLevel = 10, qlvl = 16, pre = { 877 }, preTitles = { [877] = "The Stagnant Oasis" }, map = 1413, x = 52.26, y = 31.93, f = "e" },
					},
				},
				{
					title = "Lushwater Oasis",
					note = "Oasis Snapjaws crowd the water of Lushwater Oasis, south-west of the Crossroads.",
					goals = {
						{ t = "collect", quest = 880, title = "Altered Beings", item = 5098, itemName = "Altered Snapjaw Shell", count = 8, oi = 1, map = 1413, x = 48.07, y = 39.92, f = "e", spots = { { x = 48.1, y = 40.3, r = 40, n = 2 }, { x = 47.5, y = 39.9, r = 40, n = 4 }, { x = 46.5, y = 40, r = 65, n = 6 }, { x = 46.1, y = 39, r = 47, n = 6 }, { x = 55.2, y = 42.4, r = 41, n = 4 }, { x = 55.7, y = 43.2, r = 42, n = 4 }, { x = 55.9, y = 42, r = 45, n = 3 } }, spread = true },
					},
				},
				{
					title = "Tonga Runetotem",
					goals = {
						{ t = "turnin", quest = 880, title = "Altered Beings", npc = 3448, npcName = "Tonga Runetotem", map = 1413, x = 52.26, y = 31.93, f = "e" },
						{ t = "accept", quest = 3301, title = "Mura Runetotem", npc = 3448, npcName = "Tonga Runetotem", minLevel = 10, qlvl = 15, pre = { 880 }, preTitles = { [880] = "Altered Beings" }, map = 1413, x = 52.26, y = 31.93, f = "e" },
					},
				},
				{
					title = "Wenikee Boltbucket",
					note = "Follow the road north to the Mor'shan Rampart; Wenikee stands just south of it.",
					goals = {
						{ t = "turnin", quest = 3921, title = "Wenikee Boltbucket", npc = 9316, npcName = "Wenikee Boltbucket", map = 1413, x = 49.05, y = 11.17, f = "e" },
						{ t = "accept", quest = 3922, title = "Nugget Slugs", npc = 9316, npcName = "Wenikee Boltbucket", minLevel = 10, qlvl = 15, pre = { 3921 }, preTitles = { [3921] = "Wenikee Boltbucket" }, map = 1413, x = 49.05, y = 11.17, f = "e" },
					},
				},
				{
					title = "Nugget Slugs",
					note = "The Tool Buckets sit around the Venture Co. camp in the Sludge Fen, east of Wenikee.",
					goals = {
						{ t = "collect", quest = 3922, title = "Nugget Slugs", item = 11143, itemName = "Nugget Slug", count = 15, oi = 1, map = 1413, x = 55.61, y = 8.84, f = "e", spots = { { x = 56, y = 8.4, r = 58, n = 5 }, { x = 56, y = 9.5, r = 30, n = 3 }, { x = 56.1, y = 7.1, r = 44, n = 5 }, { x = 57, y = 8.7, r = 40, n = 3 }, { x = 57.3, y = 7.2, r = 15, n = 1, alt = true } } },
					},
				},
				{
					title = "Wenikee Boltbucket",
					goals = {
						{ t = "turnin", quest = 3922, title = "Nugget Slugs", npc = 9316, npcName = "Wenikee Boltbucket", map = 1413, x = 49.05, y = 11.17, f = "e" },
					},
				},
				{
					title = "Witchwing Slayers",
					note = "The Slayers hold the western end of the Dry Hills, past the harpies you fought before; they drop the rings.",
					goals = {
						{ t = "collect", quest = 875, title = "Harpy Lieutenants", item = 5065, itemName = "Harpy Lieutenant Ring", count = 6, oi = 1, map = 1413, x = 39.92, y = 11.89, f = "e", spots = { { x = 39.8, y = 11.8, r = 18, n = 2 }, { x = 38.9, y = 12, r = 25, n = 2 }, { x = 39.1, y = 10.7, r = 31, n = 3 }, { x = 39.1, y = 13.3, r = 18, n = 2 }, { x = 38.4, y = 12.7, r = 29, n = 2 }, { x = 38.3, y = 13.6, r = 44, n = 4 }, { x = 39.1, y = 15, r = 51, n = 5, alt = true }, { x = 39.9, y = 15.8, r = 45, n = 5, alt = true }, { x = 38.1, y = 15, r = 20, n = 2, alt = true }, { x = 38.4, y = 16.1, r = 22, n = 2, alt = true }, { x = 39.5, y = 16.9, r = 37, n = 3, alt = true }, { x = 37.6, y = 16.1, r = 44, n = 4, alt = true }, { x = 38.6, y = 17.4, r = 28, n = 3, alt = true } } },
						{ t = "level", level = 16, note = "grind on Witchwing Slayers at the Dry Hills, The Barrens" },
					},
				},
				{
					title = "The Crossroads",
					note = "Back to the Crossroads; the next guide starts here.",
					goals = {
						{ t = "turnin", quest = 875, title = "Harpy Lieutenants", npc = 3449, npcName = "Darsok Swiftdagger", map = 1413, x = 51.62, y = 30.9, f = "e", note = "Darsok Swiftdagger" },
						{ t = "sethome", location = "The Crossroads" },
					},
				},
			},
		})
	end
	register()
end

-- Source: forever/horde/02-the-barrens.guide
do
	local function register()
		Polestar.RegisterGuide({
			id = "forever/horde/02-the-barrens",
			pack = "guides",
			title = "The Barrens",
			faction = "Horde",
			minLevel = 12,
			maxLevel = 17,
			category = "Leveling",
			zone = 1413,
			zoneName = "The Barrens",
			next = "forever/horde/03-silverpine-forest",
			author = "Polestar",
			version = 1,
			steps = {
				{
					title = "The Crossroads",
					note = "The Crossroads is your base for this guide. Everyone you need stands within a few steps of the inn.",
					goals = {
						{ t = "getfp", npc = 3615, npcName = "Devrak", location = "Crossroads", map = 1413, x = 51.5, y = 30.34, f = "e", note = "Devrak, the wind rider master" },
						{ t = "sethome", npc = 3934, npcName = "Innkeeper Boorand Plainswind", location = "The Crossroads", map = 1413, x = 51.99, y = 29.89, f = "e", note = "Innkeeper Boorand Plainswind" },
						{ t = "accept", quest = 870, title = "The Forgotten Pools", npc = 3448, npcName = "Tonga Runetotem", minLevel = 10, qlvl = 13, map = 1413, x = 52.26, y = 31.93, f = "e", note = "Tonga Runetotem" },
						{ t = "accept", quest = 844, title = "Plainstrider Menace", npc = 3338, npcName = "Sergra Darkthorn", minLevel = 10, qlvl = 12, map = 1413, x = 52.23, y = 31.01, f = "e", note = "Sergra Darkthorn" },
						{ t = "accept", quest = 867, title = "Harpy Raiders", npc = 3449, npcName = "Darsok Swiftdagger", minLevel = 12, qlvl = 15, map = 1413, x = 51.62, y = 30.9, f = "e", note = "Darsok Swiftdagger: the harpies come later, in the Dry Hills" },
						{ t = "accept", quest = 871, title = "Disrupt the Attacks", npc = 3429, npcName = "Thork", minLevel = 9, qlvl = 12, map = 1413, x = 51.5, y = 30.87, f = "e", note = "Thork" },
						{ t = "accept", quest = 5041, title = "Supplies for the Crossroads", npc = 3429, npcName = "Thork", minLevel = 9, qlvl = 14, map = 1413, x = 51.5, y = 30.87, f = "e" },
						{ t = "accept", quest = 848, title = "Fungal Spores", npc = 3390, npcName = "Apothecary Helbrim", minLevel = 10, qlvl = 15, map = 1413, x = 51.44, y = 30.15, f = "e", note = "Apothecary Helbrim" },
						{ t = "accept", quest = 1492, title = "Wharfmaster Dizzywig", npc = 3390, npcName = "Apothecary Helbrim", minLevel = 9, qlvl = 11, map = 1413, x = 51.44, y = 30.15, f = "e" },
						{ t = "accept", quest = 869, title = "Raptor Thieves", npc = 3464, npcName = "Gazrog", minLevel = 9, qlvl = 13, map = 1413, x = 51.93, y = 30.32, f = "e", note = "Gazrog" },
					},
				},
				{
					title = "Plainstriders and raptors",
					note = "Plainstriders and Sunscale raptors roam the plains all around the Crossroads, thickest to the north.",
					goals = {
						{ t = "collect", quest = 844, title = "Plainstrider Menace", item = 5087, itemName = "Plainstrider Beak", count = 7, oi = 1, map = 1413, x = 53.12, y = 30.42, f = "e", spots = { { x = 53.3, y = 30.8, r = 52, n = 3 }, { x = 53, y = 18.9, r = 50, n = 1 }, { x = 60.9, y = 22.6, r = 76, n = 3 }, { x = 61.4, y = 13.2, r = 50, n = 1 }, { x = 56, y = 5.8, r = 50, n = 2 }, { x = 44.9, y = 13.6, r = 50, n = 3 }, { x = 45.1, y = 26.7, r = 50, n = 1 }, { x = 37.6, y = 28.1, r = 50, n = 2 }, { x = 45.8, y = 43.3, r = 50, n = 1 }, { x = 52.4, y = 47.4, r = 68, n = 3 }, { x = 59.5, y = 52.8, r = 50, n = 2 }, { x = 63.9, y = 35.7, r = 50, n = 2 }, { x = 53.6, y = 28.7, r = 92, n = 6, alt = true }, { x = 53.2, y = 32.8, r = 59, n = 5, alt = true }, { x = 54.6, y = 32.1, r = 50, n = 1, alt = true }, { x = 51.4, y = 27.6, r = 73, n = 5, alt = true }, { x = 50.6, y = 31.2, r = 61, n = 3, alt = true }, { x = 52.8, y = 26.3, r = 52, n = 4, alt = true }, { x = 53, y = 34.8, r = 50, n = 2, alt = true }, { x = 50.8, y = 33.2, r = 50, n = 3, alt = true }, { x = 54.4, y = 34.8, r = 92, n = 4, alt = true }, { x = 56, y = 32.5, r = 50, n = 2, alt = true }, { x = 56.6, y = 29.2, r = 95, n = 7, alt = true }, { x = 51.3, y = 35.2, r = 75, n = 4, alt = true }, { x = 49.2, y = 29.9, r = 82, n = 5, alt = true }, { x = 57.3, y = 30.7, r = 76, n = 9, alt = true }, { x = 54.4, y = 36.4, r = 50, n = 1, alt = true }, { x = 48.9, y = 32.2, r = 50, n = 3, alt = true }, { x = 52.4, y = 37, r = 50, n = 1, alt = true }, { x = 57.1, y = 27.4, r = 60, n = 5, alt = true }, { x = 56.8, y = 34.5, r = 50, n = 1, alt = true }, { x = 55.6, y = 24.5, r = 50, n = 3, alt = true }, { x = 53.4, y = 37.4, r = 50, n = 1, alt = true }, { x = 54.2, y = 23.4, r = 53, n = 3, alt = true }, { x = 57.8, y = 28.7, r = 50, n = 2, alt = true }, { x = 53.3, y = 22.7, r = 92, n = 4, alt = true }, { x = 58.3, y = 31.9, r = 50, n = 1, alt = true }, { x = 49.6, y = 36.4, r = 94, n = 4, alt = true }, { x = 48, y = 27.8, r = 61, n = 3, alt = true }, { x = 47.7, y = 32.1, r = 72, n = 4, alt = true }, { x = 51.6, y = 22.4, r = 55, n = 5, alt = true }, { x = 54.7, y = 38.5, r = 50, n = 1, alt = true }, { x = 48.6, y = 25.4, r = 72, n = 4, alt = true }, { x = 47.5, y = 29.8, r = 50, n = 1, alt = true }, { x = 58, y = 26.1, r = 50, n = 1, alt = true }, { x = 55.8, y = 22.7, r = 50, n = 1, alt = true }, { x = 47.7, y = 34.4, r = 50, n = 2, alt = true }, { x = 52.4, y = 21.2, r = 69, n = 5, alt = true }, { x = 48.9, y = 23.5, r = 73, n = 6, alt = true }, { x = 57.2, y = 23, r = 50, n = 2, alt = true }, { x = 49.5, y = 38.5, r = 50, n = 2, alt = true }, { x = 47.2, y = 26.1, r = 66, n = 3, alt = true }, { x = 59.6, y = 32.7, r = 74, n = 4, alt = true }, { x = 46.5, y = 33.2, r = 75, n = 4, alt = true }, { x = 46.2, y = 30.6, r = 50, n = 3, alt = true }, { x = 46.3, y = 28, r = 51, n = 2, alt = true }, { x = 49.5, y = 21.1, r = 80, n = 5, alt = true }, { x = 47.8, y = 37.8, r = 78, n = 5, alt = true }, { x = 57, y = 21, r = 50, n = 3, alt = true }, { x = 46.7, y = 24.4, r = 50, n = 1, alt = true }, { x = 51.4, y = 19.2, r = 57, n = 5, alt = true }, { x = 60.9, y = 31.4, r = 54, n = 2, alt = true }, { x = 60.8, y = 33.8, r = 61, n = 3, alt = true }, { x = 44.9, y = 32.2, r = 50, n = 2, alt = true }, { x = 48.7, y = 19.8, r = 87, n = 7, alt = true }, { x = 47.5, y = 21, r = 80, n = 6, alt = true }, { x = 58.7, y = 20.7, r = 50, n = 2, alt = true }, { x = 51.2, y = 17.5, r = 50, n = 4, alt = true }, { x = 44.9, y = 35.9, r = 50, n = 1, alt = true }, { x = 44.5, y = 34.5, r = 59, n = 4, alt = true }, { x = 49.1, y = 17.8, r = 88, n = 5, alt = true }, { x = 44.2, y = 25.1, r = 64, n = 3, alt = true }, { x = 43.5, y = 31.7, r = 50, n = 2, alt = true }, { x = 46.5, y = 19.4, r = 50, n = 2, alt = true }, { x = 52.3, y = 15.4, r = 63, n = 3, alt = true }, { x = 43.2, y = 33, r = 50, n = 1, alt = true }, { x = 50.9, y = 15.4, r = 50, n = 2, alt = true }, { x = 63.6, y = 29.1, r = 50, n = 2, alt = true }, { x = 42.6, y = 29.9, r = 50, n = 1, alt = true }, { x = 63.8, y = 31, r = 63, n = 3, alt = true }, { x = 47.4, y = 44.5, r = 50, n = 2, alt = true }, { x = 48.4, y = 15.5, r = 50, n = 2, alt = true }, { x = 42.6, y = 25.1, r = 50, n = 1, alt = true }, { x = 50.1, y = 46.7, r = 50, n = 2, alt = true }, { x = 50.1, y = 13.9, r = 88, n = 5, alt = true }, { x = 45.5, y = 17.1, r = 50, n = 1, alt = true }, { x = 51, y = 13, r = 50, n = 2, alt = true }, { x = 55.6, y = 47.8, r = 50, n = 3, alt = true }, { x = 53.7, y = 48.3, r = 67, n = 4, alt = true }, { x = 47.8, y = 14.1, r = 80, n = 7, alt = true }, { x = 49.4, y = 47.9, r = 54, n = 4, alt = true }, { x = 44.1, y = 17.2, r = 50, n = 1, alt = true }, { x = 45.5, y = 15.3, r = 51, n = 3, alt = true }, { x = 56.2, y = 49.4, r = 50, n = 1, alt = true }, { x = 54.7, y = 50, r = 63, n = 4, alt = true }, { x = 49.5, y = 49.6, r = 77, n = 4, alt = true }, { x = 46.8, y = 12.8, r = 50, n = 2, alt = true }, { x = 44.1, y = 15.1, r = 87, n = 4, alt = true }, { x = 39.9, y = 24.7, r = 50, n = 1, alt = true }, { x = 59.1, y = 49.7, r = 50, n = 2, alt = true }, { x = 55.6, y = 51.5, r = 70, n = 3, alt = true }, { x = 54.1, y = 51.8, r = 50, n = 3, alt = true }, { x = 61.2, y = 48.3, r = 50, n = 2, alt = true }, { x = 42.1, y = 15.7, r = 50, n = 2, alt = true }, { x = 38.8, y = 25, r = 50, n = 1, alt = true }, { x = 55, y = 52.6, r = 50, n = 1, alt = true }, { x = 57.8, y = 51.9, r = 69, n = 3, alt = true }, { x = 38.1, y = 26.3, r = 50, n = 2, alt = true }, { x = 62, y = 49.2, r = 50, n = 1, alt = true }, { x = 60.9, y = 10.4, r = 50, n = 2, alt = true }, { x = 58.3, y = 7.9, r = 50, n = 1, alt = true }, { x = 60, y = 8.5, r = 50, n = 1, alt = true }, { x = 57.3, y = 6.4, r = 50, n = 1, alt = true }, { x = 59.3, y = 7.3, r = 50, n = 2, alt = true } }, spread = true },
						{ t = "collect", quest = 869, title = "Raptor Thieves", item = 5062, itemName = "Raptor Head", count = 12, oi = 1, map = 1413, x = 52.93, y = 33.04, f = "e", spots = { { x = 53.1, y = 33.7, r = 60, n = 2 }, { x = 60, y = 35.6, r = 60, n = 1 }, { x = 62.3, y = 25.9, r = 60, n = 1 }, { x = 59.8, y = 14.4, r = 71, n = 5 }, { x = 53.4, y = 14.7, r = 60, n = 1 }, { x = 48.9, y = 23.8, r = 60, n = 1 }, { x = 41.4, y = 20.3, r = 68, n = 3 }, { x = 40.5, y = 29, r = 60, n = 1 }, { x = 42.7, y = 38.3, r = 60, n = 2 }, { x = 50.1, y = 45.3, r = 60, n = 1 }, { x = 61, y = 46.8, r = 78, n = 3 }, { x = 63.6, y = 6, r = 60, n = 1 }, { x = 52.2, y = 35.9, r = 60, n = 1, alt = true }, { x = 54.2, y = 35.9, r = 60, n = 2, alt = true }, { x = 56.2, y = 34.3, r = 60, n = 2, alt = true }, { x = 57.4, y = 36.4, r = 72, n = 5, alt = true }, { x = 50.1, y = 39.4, r = 78, n = 3, alt = true }, { x = 54.4, y = 40.5, r = 74, n = 3, alt = true }, { x = 56, y = 39.4, r = 60, n = 3, alt = true }, { x = 58.6, y = 34.1, r = 60, n = 3, alt = true }, { x = 57.6, y = 38.4, r = 60, n = 1, alt = true }, { x = 57.4, y = 40.2, r = 60, n = 2, alt = true }, { x = 54.6, y = 23.2, r = 60, n = 1, alt = true }, { x = 48.1, y = 25.6, r = 60, n = 2, alt = true }, { x = 48.9, y = 41.7, r = 60, n = 1, alt = true }, { x = 53.1, y = 43.6, r = 70, n = 3, alt = true }, { x = 51.3, y = 22.6, r = 60, n = 1, alt = true }, { x = 51.6, y = 43.8, r = 62, n = 3, alt = true }, { x = 58.8, y = 39.9, r = 60, n = 1, alt = true }, { x = 45.6, y = 30.3, r = 60, n = 1, alt = true }, { x = 57.6, y = 42.3, r = 60, n = 1, alt = true }, { x = 60.4, y = 29.2, r = 60, n = 3, alt = true }, { x = 55.4, y = 44.4, r = 60, n = 2, alt = true }, { x = 44.8, y = 33.4, r = 60, n = 1, alt = true }, { x = 55.4, y = 21.2, r = 60, n = 1, alt = true }, { x = 54.7, y = 46.1, r = 60, n = 1, alt = true }, { x = 52.8, y = 46.5, r = 94, n = 3, alt = true }, { x = 53.1, y = 19.4, r = 60, n = 1, alt = true }, { x = 59.1, y = 43.5, r = 100, n = 5, alt = true }, { x = 43.6, y = 34.1, r = 69, n = 3, alt = true }, { x = 51.8, y = 18.7, r = 60, n = 1, alt = true }, { x = 58, y = 20.5, r = 60, n = 1, alt = true }, { x = 44.3, y = 26.1, r = 60, n = 1, alt = true }, { x = 61.5, y = 41.3, r = 60, n = 1, alt = true }, { x = 44.1, y = 41, r = 60, n = 5, alt = true }, { x = 60.6, y = 22.7, r = 60, n = 2, alt = true }, { x = 60, y = 44.5, r = 74, n = 6, alt = true }, { x = 59.1, y = 46.1, r = 89, n = 10, alt = true }, { x = 42, y = 33.7, r = 60, n = 3, alt = true }, { x = 42.1, y = 30, r = 60, n = 2, alt = true }, { x = 61.9, y = 23.1, r = 60, n = 1, alt = true }, { x = 54.3, y = 16.3, r = 118, n = 4, alt = true }, { x = 56.3, y = 16.8, r = 60, n = 1, alt = true }, { x = 57.6, y = 17.4, r = 60, n = 1, alt = true }, { x = 42.4, y = 25.6, r = 60, n = 2, alt = true }, { x = 59.7, y = 17.2, r = 98, n = 6, alt = true }, { x = 56.3, y = 14.7, r = 61, n = 2, alt = true }, { x = 44, y = 19.2, r = 64, n = 6, alt = true }, { x = 39.8, y = 31.5, r = 60, n = 1, alt = true }, { x = 54.7, y = 13.4, r = 60, n = 2, alt = true }, { x = 47.7, y = 14.5, r = 60, n = 1, alt = true }, { x = 41.2, y = 23.1, r = 60, n = 2, alt = true }, { x = 53, y = 12.8, r = 71, n = 4, alt = true }, { x = 40.6, y = 24.7, r = 85, n = 3, alt = true }, { x = 50.3, y = 13.1, r = 60, n = 1, alt = true }, { x = 58.3, y = 14.2, r = 82, n = 5, alt = true }, { x = 58.1, y = 12.6, r = 110, n = 7, alt = true }, { x = 56.7, y = 10.8, r = 79, n = 4, alt = true }, { x = 54.7, y = 10.1, r = 80, n = 5, alt = true }, { x = 60.2, y = 11.9, r = 60, n = 1, alt = true }, { x = 59.2, y = 10.6, r = 60, n = 2, alt = true }, { x = 54.8, y = 8.1, r = 60, n = 2, alt = true } }, spread = true },
					},
				},
				{
					title = "The Crossroads",
					goals = {
						{ t = "turnin", quest = 844, title = "Plainstrider Menace", npc = 3338, npcName = "Sergra Darkthorn", map = 1413, x = 52.23, y = 31.01, f = "e", note = "Sergra Darkthorn" },
						{ t = "accept", quest = 845, title = "The Zhevra", npc = 3338, npcName = "Sergra Darkthorn", minLevel = 10, qlvl = 13, pre = { 844 }, preTitles = { [844] = "Plainstrider Menace" }, map = 1413, x = 52.23, y = 31.01, f = "e" },
						{ t = "turnin", quest = 869, title = "Raptor Thieves", npc = 3464, npcName = "Gazrog", map = 1413, x = 51.93, y = 30.32, f = "e", note = "Gazrog" },
					},
				},
				{
					title = "The Zhevra",
					note = "Zhevra Runners graze north and east of town.",
					goals = {
						{ t = "goto", text = "Zhevra", map = 1413, x = 52.5, y = 27.5, f = "e" },
						{ t = "collect", quest = 845, title = "The Zhevra", item = 5086, itemName = "Zhevra Hooves", count = 4, oi = 1, map = 1413, x = 50.79, y = 34.14, f = "e", spots = { { x = 50.8, y = 34.1, r = 51, n = 1 }, { x = 47.8, y = 37.4, r = 84, n = 4 }, { x = 44.3, y = 33.2, r = 53, n = 4 }, { x = 46.9, y = 25.6, r = 60, n = 3 }, { x = 42.5, y = 23.8, r = 51, n = 3 }, { x = 49.5, y = 13.3, r = 51, n = 1 }, { x = 52.5, y = 17.1, r = 75, n = 5 }, { x = 55.7, y = 21.6, r = 91, n = 4 }, { x = 61.8, y = 18.3, r = 53, n = 3 }, { x = 56.3, y = 32.6, r = 51, n = 1 }, { x = 55.7, y = 38.8, r = 51, n = 1 }, { x = 64.5, y = 34.6, r = 51, n = 1 }, { x = 50.5, y = 36.1, r = 51, n = 2, alt = true }, { x = 52.3, y = 35.4, r = 68, n = 5, alt = true }, { x = 49.3, y = 36.3, r = 65, n = 3, alt = true }, { x = 51.3, y = 37.6, r = 51, n = 4, alt = true }, { x = 52.3, y = 37.4, r = 56, n = 3, alt = true }, { x = 53.3, y = 36.1, r = 51, n = 3, alt = true }, { x = 49.2, y = 37.8, r = 81, n = 6, alt = true }, { x = 54, y = 33, r = 51, n = 1, alt = true }, { x = 53, y = 39, r = 51, n = 3, alt = true }, { x = 54.8, y = 34.9, r = 62, n = 3, alt = true }, { x = 54.5, y = 38, r = 59, n = 4, alt = true }, { x = 47.1, y = 28.6, r = 51, n = 1, alt = true }, { x = 56.3, y = 34.4, r = 66, n = 6, alt = true }, { x = 45.8, y = 30.4, r = 84, n = 6, alt = true }, { x = 44.6, y = 35.3, r = 51, n = 1, alt = true }, { x = 46.3, y = 27.2, r = 74, n = 6, alt = true }, { x = 43.4, y = 31.6, r = 51, n = 2, alt = true }, { x = 43.6, y = 28.4, r = 74, n = 7, alt = true }, { x = 44.6, y = 25.9, r = 70, n = 4, alt = true }, { x = 56.7, y = 23.1, r = 51, n = 1, alt = true }, { x = 52.8, y = 20.3, r = 51, n = 1, alt = true }, { x = 42.8, y = 26.1, r = 60, n = 4, alt = true }, { x = 52.8, y = 18.9, r = 54, n = 2, alt = true }, { x = 57, y = 21.7, r = 51, n = 1, alt = true }, { x = 61.2, y = 34.5, r = 51, n = 1, alt = true }, { x = 57, y = 19.7, r = 51, n = 3, alt = true }, { x = 58.1, y = 20.5, r = 51, n = 4, alt = true }, { x = 53.8, y = 16.7, r = 51, n = 1, alt = true }, { x = 59.3, y = 21.2, r = 61, n = 3, alt = true }, { x = 60.7, y = 22, r = 73, n = 4, alt = true }, { x = 52.3, y = 15, r = 51, n = 2, alt = true }, { x = 63.6, y = 31.5, r = 51, n = 1, alt = true }, { x = 51.4, y = 14.7, r = 51, n = 1, alt = true }, { x = 61.6, y = 22.9, r = 56, n = 3, alt = true }, { x = 64.7, y = 33.8, r = 64, n = 3, alt = true }, { x = 62.3, y = 22.1, r = 51, n = 2, alt = true }, { x = 51.2, y = 12.8, r = 56, n = 3, alt = true } }, spread = true },
					},
				},
				{
					title = "The Crossroads",
					goals = {
						{ t = "turnin", quest = 845, title = "The Zhevra", npc = 3338, npcName = "Sergra Darkthorn", map = 1413, x = 52.23, y = 31.01, f = "e", note = "Sergra Darkthorn" },
						{ t = "accept", quest = 903, title = "Prowlers of the Barrens", npc = 3338, npcName = "Sergra Darkthorn", minLevel = 10, qlvl = 15, pre = { 845 }, preTitles = { [845] = "The Zhevra" }, map = 1413, x = 52.23, y = 31.01, f = "e" },
					},
				},
				{
					title = "Razormane camp",
					note = "The Savannah Prowlers hunt the plains between town and the Razormane camp to the east. In the camp, Water Seekers and Thornweavers hold the western half, Hunters the middle; the supply crates sit at its eastern end.",
					goals = {
						{ t = "goto", text = "Razormane camp", map = 1413, x = 55, y = 26, f = "e" },
						{ t = "collect", quest = 903, title = "Prowlers of the Barrens", item = 5096, itemName = "Prowler Claws", count = 7, oi = 1, map = 1413, x = 55.6, y = 16.32, f = "e", spots = { { x = 55.5, y = 16.2, r = 40, n = 2 }, { x = 60.4, y = 7.9, r = 40, n = 2 }, { x = 63.6, y = 5.9, r = 40, n = 3 }, { x = 63, y = 27.7, r = 42, n = 3 }, { x = 59.7, y = 34.4, r = 40, n = 1 }, { x = 59.1, y = 40.9, r = 53, n = 3 }, { x = 43.5, y = 39.3, r = 40, n = 1 }, { x = 42.5, y = 34.9, r = 40, n = 2 }, { x = 44.3, y = 31.6, r = 40, n = 3 }, { x = 42.6, y = 28.9, r = 40, n = 1 }, { x = 41.3, y = 24.3, r = 40, n = 1 }, { x = 40.6, y = 20.7, r = 49, n = 4 }, { x = 55.6, y = 14.7, r = 40, n = 2, alt = true }, { x = 54.6, y = 14.9, r = 43, n = 4, alt = true }, { x = 53.5, y = 15.5, r = 51, n = 7, alt = true }, { x = 53.7, y = 13.7, r = 40, n = 2, alt = true }, { x = 63.3, y = 7.3, r = 40, n = 1, alt = true }, { x = 63, y = 29.1, r = 40, n = 2, alt = true }, { x = 59, y = 36.5, r = 40, n = 1, alt = true }, { x = 41.9, y = 23.4, r = 40, n = 2, alt = true }, { x = 40.8, y = 22.2, r = 51, n = 4, alt = true }, { x = 57.7, y = 39.3, r = 40, n = 1, alt = true }, { x = 43.9, y = 32.8, r = 40, n = 2, alt = true }, { x = 40.9, y = 26.7, r = 40, n = 3, alt = true }, { x = 41.3, y = 28.5, r = 40, n = 2, alt = true }, { x = 43, y = 33.5, r = 40, n = 3, alt = true }, { x = 42.5, y = 32.9, r = 44, n = 4, alt = true }, { x = 43.6, y = 35.4, r = 40, n = 2, alt = true }, { x = 43.8, y = 37.8, r = 40, n = 2, alt = true } }, spread = true },
						{ t = "kill", quest = 871, title = "Disrupt the Attacks", target = "Razormane Water Seeker", npc = 3267, count = 8, oi = 1, map = 1413, x = 53.65, y = 24.51, f = "e", spots = { { x = 53.5, y = 25.1, r = 46, n = 3 }, { x = 54.2, y = 25.5, r = 45, n = 5 }, { x = 55.4, y = 26.9, r = 48, n = 5 }, { x = 55.5, y = 25.8, r = 15, n = 1, alt = true } } },
						{ t = "kill", quest = 871, title = "Disrupt the Attacks", target = "Razormane Thornweaver", npc = 3268, count = 8, oi = 2, map = 1413, x = 54.16, y = 25.09, f = "e", spots = { { x = 54.5, y = 25.2, r = 54, n = 6 }, { x = 55.1, y = 26.9, r = 41, n = 3 }, { x = 55.7, y = 26.6, r = 31, n = 3 } } },
						{ t = "kill", quest = 871, title = "Disrupt the Attacks", target = "Razormane Hunter", npc = 3265, count = 3, oi = 3, map = 1413, x = 53.76, y = 25.29, f = "e", spots = { { x = 53.8, y = 25.3, r = 50, n = 1 }, { x = 55.2, y = 25.8, r = 59, n = 3 }, { x = 57.9, y = 24.1, r = 50, n = 3 }, { x = 59.4, y = 23.9, r = 50, n = 1 }, { x = 59.2, y = 26.5, r = 50, n = 1 } }, spread = true },
						{ t = "collect", quest = 5041, title = "Supplies for the Crossroads", item = 12708, itemName = "Crossroads' Supply Crates", oi = 1, map = 1413, x = 58.8, y = 25.8, f = "e", spots = { { x = 58.8, y = 25.8, r = 37, n = 1 }, { x = 59.3, y = 24.6, r = 21, n = 3, alt = true }, { x = 58.6, y = 27.2, r = 27, n = 3, alt = true } } },
					},
				},
				{
					title = "Kranal Fiss",
					note = "Kranal Fiss stands on the ridge north of the Razormane camp.",
					only = { classes = { "SHAMAN" }, races = { "Tauren" } },
					goals = {
						{ t = "turnin", quest = 1523, title = "Call of Fire", npc = 5907, npcName = "Kranal Fiss", map = 1413, x = 56.03, y = 19.89, f = "e" },
						{ t = "accept", quest = 1524, title = "Call of Fire", npc = 5907, npcName = "Kranal Fiss", minLevel = 10, qlvl = 11, map = 1413, x = 56.03, y = 19.89, f = "e" },
					},
				},
				{
					title = "Far Watch Post",
					note = "Follow the road east to the outpost above the Southfury River. Crossroads Conscription follows Conscript of the Horde from Razor Hill, so only Orcs, Trolls and Tauren are sent here.",
					only = { races = { "Orc", "Troll", "Tauren" } },
					goals = {
						{ t = "turnin", quest = 840, title = "Conscript of the Horde", npc = 3337, npcName = "Kargal Battlescar", map = 1413, x = 62.26, y = 19.38, f = "e", note = "Kargal Battlescar" },
						{ t = "accept", quest = 842, title = "Crossroads Conscription", npc = 3337, npcName = "Kargal Battlescar", minLevel = 10, qlvl = 12, pre = { 840 }, preTitles = { [840] = "Conscript of the Horde" }, map = 1413, x = 62.26, y = 19.38, f = "e" },
						{ t = "turnin", quest = 1505, title = "Veteran Uzzek", npc = 5810, npcName = "Uzzek", map = 1413, x = 61.38, y = 21.12, f = "e", only = { classes = { "WARRIOR" }, races = { "Tauren" } }, note = "Uzzek" },
						{ t = "accept", quest = 1498, title = "Path of Defense", npc = 5810, npcName = "Uzzek", minLevel = 10, qlvl = 10, closedBy = { 1819 }, preTitles = { [1819] = "Ulag the Cleaver" }, map = 1413, x = 61.38, y = 21.12, f = "e", only = { classes = { "WARRIOR" }, races = { "Tauren" } } },
					},
				},
				{
					title = "Thunder lizards across the river",
					note = "Thunder Lizards and Lightning Hides graze just across the bridge below Far Watch Post.",
					only = { classes = { "WARRIOR" }, races = { "Tauren" } },
					goals = {
						{ t = "collect", quest = 1498, title = "Path of Defense", item = 6486, itemName = "Singed Scale", count = 5, oi = 1, map = 1411, x = 39.67, y = 29.24, f = "e", spots = { { x = 40.3, y = 29, r = 48, n = 5 }, { x = 39.1, y = 30, r = 53, n = 5 }, { x = 39.2, y = 25.6, r = 36, n = 3 }, { x = 40.4, y = 24.1, r = 54, n = 4 }, { x = 42.8, y = 24.2, r = 44, n = 5 } } },
					},
				},
				{
					title = "Uzzek",
					only = { classes = { "WARRIOR" }, races = { "Tauren" } },
					goals = {
						{ t = "turnin", quest = 1498, title = "Path of Defense", npc = 5810, npcName = "Uzzek", map = 1413, x = 61.38, y = 21.12, f = "e" },
						{ t = "accept", quest = 1502, title = "Thun'grim Firegaze", npc = 5810, npcName = "Uzzek", minLevel = 10, qlvl = 10, pre = { 1498, 1819 }, preTitles = { [1498] = "Path of Defense", [1819] = "Ulag the Cleaver" }, map = 1413, x = 61.38, y = 21.12, f = "e" },
					},
				},
				{
					title = "Telf Joolam",
					note = "Telf waits on the riverbank south of Far Watch Post, across the bridge.",
					only = { classes = { "SHAMAN" }, races = { "Tauren" } },
					goals = {
						{ t = "turnin", quest = 1524, title = "Call of Fire", npc = 5900, npcName = "Telf Joolam", map = 1411, x = 38.55, y = 58.96, f = "e" },
						{ t = "accept", quest = 1525, title = "Call of Fire", npc = 5900, npcName = "Telf Joolam", minLevel = 10, qlvl = 12, pre = { 1524 }, preTitles = { [1524] = "Call of Fire" }, map = 1411, x = 38.55, y = 58.96, f = "e" },
					},
				},
				{
					title = "Dustwind Gulch cultists",
					note = "Burning Blade Cultists hold Dustwind Gulch in northern Durotar; they drop the Reagent Pouch. The Fire Tar comes from the Razormane on your next visit to their camp.",
					only = { classes = { "SHAMAN" }, races = { "Tauren" } },
					goals = {
						{ t = "collect", quest = 1525, title = "Call of Fire", item = 6652, itemName = "Reagent Pouch", count = 1, oi = 2, map = 1411, x = 52.41, y = 26.8, f = "e", spots = { { x = 52.4, y = 25.5, r = 46, n = 7 } } },
					},
				},
				{
					title = "Thun'grim Firegaze",
					note = "Thun'grim camps beside the road from the Crossroads to Ratchet. The Stolen Iron Chest sits in the south of the Razormane camp just north of him.",
					only = { classes = { "WARRIOR" }, races = { "Tauren" } },
					goals = {
						{ t = "turnin", quest = 1502, title = "Thun'grim Firegaze", npc = 5878, npcName = "Thun'grim Firegaze", map = 1413, x = 57.23, y = 30.34, f = "e" },
						{ t = "accept", quest = 1503, title = "Forged Steel", npc = 5878, npcName = "Thun'grim Firegaze", minLevel = 10, qlvl = 10, pre = { 1502 }, preTitles = { [1502] = "Thun'grim Firegaze" }, map = 1413, x = 57.23, y = 30.34, f = "e" },
						{ t = "collect", quest = 1503, title = "Forged Steel", item = 6534, itemName = "Forged Steel Bars", count = 1, oi = 1, map = 1413, x = 55.05, y = 26.65, f = "e" },
						{ t = "turnin", quest = 1503, title = "Forged Steel", npc = 5878, npcName = "Thun'grim Firegaze", map = 1413, x = 57.23, y = 30.34, f = "e" },
					},
				},
				{
					title = "Ratchet",
					note = "Follow the road south-east to Ratchet on the coast.",
					goals = {
						{ t = "getfp", npc = 16227, npcName = "Bragok", location = "Ratchet", map = 1413, x = 63.08, y = 37.16, f = "e", note = "Bragok" },
						{ t = "turnin", quest = 1492, title = "Wharfmaster Dizzywig", npc = 3453, npcName = "Wharfmaster Dizzywig", map = 1413, x = 63.35, y = 38.45, f = "e", note = "Wharfmaster Dizzywig" },
						{ t = "accept", quest = 887, title = "Southsea Freebooters", npc = 3391, npcName = "Gazlowe", minLevel = 9, qlvl = 14, map = 1413, x = 62.68, y = 36.23, f = "e", note = "Gazlowe" },
						{ t = "accept", quest = 97253, title = "Parts and Pieces", npc = 7161, npcName = "Wrenix the Wretched", minLevel = 9, qlvl = 14, map = 1413, x = 63.07, y = 36.32, f = "e", note = "Wrenix the Wretched" },
						{ t = "accept", quest = 894, title = "Samophlange", npc = 3442, npcName = "Sputtervalve", minLevel = 10, qlvl = 14, map = 1413, x = 62.98, y = 37.22, f = "e", note = "Sputtervalve: the console is in the Sludge Fen, later" },
					},
				},
				{
					title = "Southsea beach",
					note = "The pirates camp on the beach south of Ratchet. The piles of complicated parts lie in the sand among them.",
					goals = {
						{ t = "kill", quest = 887, title = "Southsea Freebooters", target = "Southsea Brigand", npc = 3381, count = 12, oi = 1, map = 1413, x = 63.58, y = 43.35, f = "e", spots = { { x = 64.1, y = 43.8, r = 61, n = 5 }, { x = 63.8, y = 44.9, r = 40, n = 3 }, { x = 63.6, y = 46, r = 40, n = 2 }, { x = 64.1, y = 47, r = 40, n = 4 }, { x = 63.8, y = 48.9, r = 40, n = 3 }, { x = 62.8, y = 49.9, r = 40, n = 2 } }, spread = true },
						{ t = "kill", quest = 887, title = "Southsea Freebooters", target = "Southsea Cannoneer", npc = 3382, count = 6, oi = 2, map = 1413, x = 63.86, y = 43.83, f = "e", spots = { { x = 63.7, y = 46.3, r = 34, n = 3 }, { x = 64.3, y = 47.2, r = 41, n = 4 }, { x = 63.8, y = 49, r = 23, n = 2 }, { x = 62.8, y = 49.7, r = 46, n = 4 }, { x = 63.9, y = 43.8, r = 15, n = 1, alt = true }, { x = 64.6, y = 44.1, r = 15, n = 1, alt = true }, { x = 62.9, y = 44, r = 15, n = 1, alt = true } } },
						{ t = "collect", quest = 97253, title = "Parts and Pieces", item = 277331, itemName = "Handful of Complicated Parts", count = 5, oi = 1, map = 1413, x = 62.2, y = 44, f = "e", spots = { { x = 61.9, y = 44.9, r = 69, n = 4 }, { x = 61.8, y = 48.2, r = 68, n = 3 } } },
					},
				},
				{
					title = "Ratchet",
					goals = {
						{ t = "turnin", quest = 97253, title = "Parts and Pieces", npc = 7161, npcName = "Wrenix the Wretched", map = 1413, x = 63.07, y = 36.32, f = "e", note = "Wrenix the Wretched" },
						{ t = "turnin", quest = 887, title = "Southsea Freebooters", npc = 3391, npcName = "Gazlowe", map = 1413, x = 62.68, y = 36.23, f = "e", note = "Gazlowe" },
						{ t = "accept", quest = 890, title = "The Missing Shipment", npc = 3391, npcName = "Gazlowe", minLevel = 9, qlvl = 14, pre = { 887 }, preTitles = { [887] = "Southsea Freebooters" }, map = 1413, x = 62.68, y = 36.23, f = "e" },
						{ t = "turnin", quest = 890, title = "The Missing Shipment", npc = 3453, npcName = "Wharfmaster Dizzywig", map = 1413, x = 63.35, y = 38.45, f = "e", note = "Wharfmaster Dizzywig" },
						{ t = "accept", quest = 892, title = "The Missing Shipment", npc = 3453, npcName = "Wharfmaster Dizzywig", minLevel = 9, qlvl = 14, pre = { 890 }, preTitles = { [890] = "The Missing Shipment" }, map = 1413, x = 63.35, y = 38.45, f = "e" },
						{ t = "turnin", quest = 892, title = "The Missing Shipment", npc = 3391, npcName = "Gazlowe", map = 1413, x = 62.68, y = 36.23, f = "e", note = "Gazlowe" },
						{ t = "accept", quest = 888, title = "Stolen Booty", npc = 3391, npcName = "Gazlowe", minLevel = 9, qlvl = 16, pre = { 892 }, preTitles = { [892] = "The Missing Shipment" }, map = 1413, x = 62.68, y = 36.23, f = "e" },
					},
				},
				{
					title = "Stolen Booty",
					note = "Back down the beach, past the pirate camp: the crate of boots and the fragile crate with the lens sit at its south end.",
					goals = {
						{ t = "collect", quest = 888, title = "Stolen Booty", item = 5076, itemName = "Shipment of Boots", count = 1, oi = 1, map = 1413, x = 62.6, y = 49.6, f = "e" },
						{ t = "collect", quest = 888, title = "Stolen Booty", item = 5077, itemName = "Telescopic Lens", oi = 2, map = 1413, x = 63.6, y = 49.3, f = "e" },
					},
				},
				{
					title = "Ratchet",
					goals = {
						{ t = "turnin", quest = 888, title = "Stolen Booty", npc = 3391, npcName = "Gazlowe", map = 1413, x = 62.68, y = 36.23, f = "e", note = "Gazlowe" },
					},
				},
				{
					title = "The Crossroads",
					note = "Walk back west along the road to the Crossroads.",
					goals = {
						{ t = "turnin", quest = 903, title = "Prowlers of the Barrens", npc = 3338, npcName = "Sergra Darkthorn", map = 1413, x = 52.23, y = 31.01, f = "e", note = "Sergra Darkthorn" },
						{ t = "turnin", quest = 842, title = "Crossroads Conscription", npc = 3338, npcName = "Sergra Darkthorn", map = 1413, x = 52.23, y = 31.01, f = "e", only = { races = { "Orc", "Troll", "Tauren" } } },
						{ t = "accept", quest = 881, title = "Echeyakee", npc = 3338, npcName = "Sergra Darkthorn", minLevel = 10, qlvl = 16, pre = { 903 }, preTitles = { [903] = "Prowlers of the Barrens" }, map = 1413, x = 52.23, y = 31.01, f = "e" },
						{ t = "turnin", quest = 871, title = "Disrupt the Attacks", npc = 3429, npcName = "Thork", map = 1413, x = 51.5, y = 30.87, f = "e", note = "Thork" },
						{ t = "turnin", quest = 5041, title = "Supplies for the Crossroads", npc = 3429, npcName = "Thork", map = 1413, x = 51.5, y = 30.87, f = "e" },
						{ t = "accept", quest = 872, title = "The Disruption Ends", npc = 3429, npcName = "Thork", minLevel = 9, qlvl = 15, pre = { 871 }, preTitles = { [871] = "Disrupt the Attacks" }, map = 1413, x = 51.5, y = 30.87, f = "e" },
					},
				},
				{
					title = "The Disruption Ends",
					note = "Back to the Razormane camp. Geomancers and Defenders hold its eastern half; Kreenig Snarlsnout walks among them.",
					goals = {
						{ t = "kill", quest = 872, title = "The Disruption Ends", target = "Razormane Geomancer", npc = 3269, count = 8, oi = 1, map = 1413, x = 56.78, y = 25.39, f = "e", spots = { { x = 57, y = 25.3, r = 52, n = 3 }, { x = 57.1, y = 24.4, r = 27, n = 3 }, { x = 59.1, y = 24.4, r = 45, n = 6 } } },
						{ t = "kill", quest = 872, title = "The Disruption Ends", target = "Razormane Defender", npc = 3266, count = 8, oi = 2, map = 1413, x = 57.07, y = 25.21, f = "e", spots = { { x = 57.1, y = 25.1, r = 55, n = 4 }, { x = 58.7, y = 26.6, r = 41, n = 4 }, { x = 59.2, y = 24.4, r = 51, n = 4 }, { x = 59.2, y = 27.3, r = 33, n = 3 }, { x = 58, y = 24.7, r = 15, n = 1, alt = true }, { x = 59.3, y = 25.6, r = 15, n = 1, alt = true } } },
						{ t = "collect", quest = 872, title = "The Disruption Ends", item = 5063, itemName = "Kreenig Snarlsnout's Tusk", oi = 3, map = 1413, x = 58.5, y = 27, f = "e" },
						{ t = "collect", quest = 1525, title = "Call of Fire", item = 5026, itemName = "Fire Tar", count = 1, oi = 1, map = 1413, x = 58.51, y = 27.22, f = "e", spots = { { x = 58.5, y = 26.7, r = 43, n = 4 }, { x = 59.1, y = 24.4, r = 45, n = 6 }, { x = 57.1, y = 24.4, r = 40, n = 3 }, { x = 57, y = 25.3, r = 52, n = 3 }, { x = 55.3, y = 25.5, r = 40, n = 2 }, { x = 55.4, y = 26.8, r = 72, n = 11 }, { x = 54.4, y = 25.3, r = 49, n = 8 }, { x = 53.9, y = 25.7, r = 40, n = 3 }, { x = 53.4, y = 24.8, r = 40, n = 2 } }, spread = true, only = { classes = { "SHAMAN" }, races = { "Tauren" } } },
					},
				},
				{
					title = "Telf Joolam",
					note = "Telf makes Fire Sapta from the tar and pouch. Use it by the brazier next to him to reveal the Minor Manifestation of Fire, kill it for the Glowing Ember, then place the ember in the brazier.",
					only = { classes = { "SHAMAN" }, races = { "Tauren" } },
					goals = {
						{ t = "turnin", quest = 1525, title = "Call of Fire", npc = 5900, npcName = "Telf Joolam", map = 1411, x = 38.55, y = 58.96, f = "e" },
						{ t = "accept", quest = 1526, title = "Call of Fire", npc = 5900, npcName = "Telf Joolam", minLevel = 10, qlvl = 13, pre = { 1525 }, preTitles = { [1525] = "Call of Fire" }, map = 1411, x = 38.55, y = 58.96, f = "e" },
						{ t = "collect", quest = 1526, title = "Call of Fire", item = 6655, itemName = "Glowing Ember", count = 1, oi = 1, map = 1411, x = 38.72, y = 58.29, f = "e" },
						{ t = "turnin", quest = 1526, title = "Call of Fire", object = 61934, objName = "Brazier of the Dormant Flame", map = 1411, x = 38.96, y = 58.22, f = "e" },
						{ t = "accept", quest = 1527, title = "Call of Fire", object = 61934, objName = "Brazier of the Dormant Flame", minLevel = 10, qlvl = 13, pre = { 1526 }, preTitles = { [1526] = "Call of Fire" }, map = 1411, x = 38.96, y = 58.22, f = "e" },
					},
				},
				{
					title = "Kranal Fiss",
					only = { classes = { "SHAMAN" }, races = { "Tauren" } },
					goals = {
						{ t = "turnin", quest = 1527, title = "Call of Fire", npc = 5907, npcName = "Kranal Fiss", map = 1413, x = 56.03, y = 19.89, f = "e" },
					},
				},
				{
					title = "Echeyakee",
					note = "Echeyakee, a white lion, prowls the plains north of the Razormane camp.",
					goals = {
						{ t = "collect", quest = 881, title = "Echeyakee", item = 5100, itemName = "Echeyakee's Hide", oi = 1, map = 1413, x = 55.86, y = 17.19, f = "e" },
					},
				},
				{
					title = "Samophlange",
					note = "The Control Console stands at the Venture Co. research site west of the Sludge Fen. Close the three valves around the drill, use the console again, then take the Console Key from Tinkerer Sniggles beside it.",
					goals = {
						{ t = "turnin", quest = 894, title = "Samophlange", object = 4141, objName = "Control Console", map = 1413, x = 52.4, y = 11.65, f = "e" },
						{ t = "accept", quest = 900, title = "Samophlange", object = 4141, objName = "Control Console", minLevel = 10, qlvl = 14, pre = { 894 }, preTitles = { [894] = "Samophlange" }, map = 1413, x = 52.4, y = 11.65, f = "e" },
						{ t = "interact", quest = 900, title = "Samophlange", object = 4072, objName = "Main Control Valve", oi = 1, map = 1413, x = 52.33, y = 11.56, f = "e" },
						{ t = "interact", quest = 900, title = "Samophlange", object = 61935, objName = "Regulator Valve", oi = 2, map = 1413, x = 52.3, y = 11.42, f = "e" },
						{ t = "interact", quest = 900, title = "Samophlange", object = 61936, objName = "Fuel Control Valve", oi = 3, map = 1413, x = 52.4, y = 11.41, f = "e" },
						{ t = "turnin", quest = 900, title = "Samophlange", object = 4141, objName = "Control Console", map = 1413, x = 52.4, y = 11.65, f = "e" },
						{ t = "accept", quest = 901, title = "Samophlange", object = 4141, objName = "Control Console", minLevel = 10, qlvl = 14, pre = { 900 }, preTitles = { [900] = "Samophlange" }, map = 1413, x = 52.4, y = 11.65, f = "e" },
						{ t = "collect", quest = 901, title = "Samophlange", item = 5089, itemName = "Console Key", count = 1, oi = 1, map = 1413, x = 52.84, y = 10.39, f = "e" },
						{ t = "turnin", quest = 901, title = "Samophlange", object = 4141, objName = "Control Console", map = 1413, x = 52.4, y = 11.65, f = "e" },
						{ t = "accept", quest = 902, title = "Samophlange", object = 4141, objName = "Control Console", minLevel = 10, qlvl = 16, pre = { 901 }, preTitles = { [901] = "Samophlange" }, map = 1413, x = 52.4, y = 11.65, f = "e", note = "Sputtervalve in Ratchet: later, on the way" },
					},
				},
				{
					title = "The Dry Hills",
					note = "West to the Dry Hills. The Witchwing harpies nest all over them; any of them can drop a talon. Chen's Empty Keg lies in their hills.",
					goals = {
						{ t = "collect", quest = 867, title = "Harpy Raiders", item = 5064, itemName = "Witchwing Talon", count = 8, oi = 1, map = 1413, x = 41.89, y = 14.73, f = "e", spots = { { x = 41.6, y = 14.8, r = 40, n = 3 }, { x = 40.8, y = 17.2, r = 67, n = 8 }, { x = 39.5, y = 16.8, r = 41, n = 4 }, { x = 38.6, y = 17.4, r = 40, n = 6 }, { x = 37.6, y = 16, r = 44, n = 6 }, { x = 38.1, y = 14.9, r = 40, n = 3 }, { x = 39.1, y = 15, r = 51, n = 5 }, { x = 39.1, y = 13.5, r = 40, n = 4 }, { x = 39.7, y = 11.9, r = 40, n = 3 }, { x = 39.1, y = 10.7, r = 40, n = 5 }, { x = 40.2, y = 19, r = 59, n = 8 }, { x = 41.1, y = 19.7, r = 40, n = 1 }, { x = 40.9, y = 14.8, r = 46, n = 7, alt = true }, { x = 40.8, y = 15.9, r = 41, n = 4, alt = true }, { x = 40.1, y = 15.9, r = 50, n = 7, alt = true }, { x = 41.6, y = 18.9, r = 43, n = 7, alt = true }, { x = 38.9, y = 12, r = 61, n = 7, alt = true }, { x = 38.4, y = 13.2, r = 59, n = 9, alt = true }, { x = 38.3, y = 16.3, r = 40, n = 4, alt = true } }, spread = true },
						{ t = "collect", item = 4926, itemName = "Chen's Empty Keg", map = 1413, x = 37.9, y = 16.2, f = "e", spots = { { x = 37.9, y = 16.2, r = 150, n = 1 }, { x = 43.8, y = 12.2, r = 150, n = 1, alt = true }, { x = 41.8, y = 38.8, r = 150, n = 1, alt = true }, { x = 55.8, y = 20, r = 150, n = 1, alt = true }, { x = 55.7, y = 27.3, r = 150, n = 1, alt = true }, { x = 57.2, y = 9, r = 150, n = 1, alt = true }, { x = 54.7, y = 37.2, r = 150, n = 1, alt = true }, { x = 56.6, y = 43.7, r = 150, n = 1, alt = true }, { x = 45, y = 62.2, r = 150, n = 1, alt = true } }, from = "Chen's Empty Keg", fromKind = "object" },
						{ t = "accept", quest = 819, title = "Chen's Empty Keg", item = 4926, itemName = "Chen's Empty Keg", minLevel = 11, qlvl = 15 },
					},
				},
				{
					title = "Regthar Deathgate",
					note = "South to Regthar's watch post on the Kolkar border.",
					goals = {
						{ t = "accept", quest = 855, title = "Centaur Bracers", npc = 3389, npcName = "Regthar Deathgate", minLevel = 9, qlvl = 14, map = 1413, x = 45.34, y = 28.41, f = "e" },
					},
				},
				{
					title = "The Forgotten Pools",
					note = "The pools lie just north of Regthar. Walk into the water to explore them; the Laden Mushrooms for Helbrim grow around them. Kill every Kolkar you pass for bracers.",
					goals = {
						{ t = "complete", quest = 870, title = "The Forgotten Pools", map = 1413, x = 45.3, y = 22.8, f = "e" },
						{ t = "collect", quest = 848, title = "Fungal Spores", item = 5012, itemName = "Fungal Spores", count = 4, oi = 1, map = 1413, x = 45.56, y = 22.47, f = "e", spots = { { x = 45.2, y = 22.3, r = 56, n = 7 }, { x = 44.2, y = 25, r = 59, n = 2 }, { x = 45.9, y = 38, r = 66, n = 5 }, { x = 47.1, y = 39.2, r = 62, n = 3 }, { x = 47.6, y = 40.6, r = 72, n = 4 }, { x = 46.8, y = 41.9, r = 46, n = 1 }, { x = 45.9, y = 40.3, r = 46, n = 3 }, { x = 47.4, y = 37.5, r = 46, n = 1 }, { x = 53.4, y = 43.4, r = 46, n = 1 }, { x = 55.3, y = 44.3, r = 46, n = 1 }, { x = 56, y = 43, r = 46, n = 3 }, { x = 55.6, y = 41.5, r = 78, n = 5 }, { x = 45, y = 23.5, r = 68, n = 5, alt = true }, { x = 54.9, y = 42.9, r = 57, n = 3, alt = true } }, spread = true },
						{ t = "collect", quest = 855, title = "Centaur Bracers", item = 5030, itemName = "Centaur Bracers", count = 15, oi = 1, map = 1413, x = 45.76, y = 22.68, f = "e", spots = { { x = 45.6, y = 23.3, r = 61, n = 4 }, { x = 44.9, y = 20.1, r = 55, n = 6 }, { x = 43.1, y = 23.6, r = 50, n = 6 }, { x = 42.2, y = 26.9, r = 40, n = 5 }, { x = 47.9, y = 24.5, r = 42, n = 3 }, { x = 47.8, y = 37.4, r = 40, n = 2 }, { x = 45.1, y = 39.5, r = 46, n = 5 }, { x = 48.5, y = 42.5, r = 40, n = 1 }, { x = 53.2, y = 42, r = 48, n = 4 }, { x = 53.1, y = 36.8, r = 40, n = 4 }, { x = 57, y = 40.9, r = 40, n = 4 }, { x = 55.7, y = 46, r = 59, n = 4 }, { x = 45.5, y = 22.1, r = 40, n = 1, alt = true }, { x = 46.5, y = 22.9, r = 40, n = 4, alt = true }, { x = 44.5, y = 22.6, r = 40, n = 3, alt = true }, { x = 44.6, y = 24.1, r = 40, n = 3, alt = true }, { x = 47.2, y = 23.4, r = 40, n = 2, alt = true }, { x = 45.7, y = 25.6, r = 40, n = 3, alt = true }, { x = 43.8, y = 21.3, r = 52, n = 6, alt = true }, { x = 43.5, y = 26.5, r = 40, n = 4, alt = true }, { x = 42.2, y = 24.7, r = 51, n = 6, alt = true }, { x = 46.8, y = 36.5, r = 40, n = 1, alt = true }, { x = 45.7, y = 37.1, r = 40, n = 3, alt = true }, { x = 46.7, y = 37.5, r = 43, n = 4, alt = true }, { x = 45.7, y = 38.1, r = 40, n = 3, alt = true }, { x = 44.4, y = 38.2, r = 40, n = 5, alt = true }, { x = 47.1, y = 38.7, r = 40, n = 3, alt = true }, { x = 48.1, y = 38.5, r = 40, n = 1, alt = true }, { x = 48.8, y = 39, r = 40, n = 2, alt = true }, { x = 47.7, y = 39.4, r = 40, n = 1, alt = true }, { x = 47.1, y = 40.8, r = 40, n = 3, alt = true }, { x = 45.8, y = 41, r = 49, n = 6, alt = true }, { x = 48.3, y = 40.6, r = 53, n = 5, alt = true }, { x = 52.7, y = 38.9, r = 40, n = 1, alt = true }, { x = 47.4, y = 41.8, r = 40, n = 2, alt = true }, { x = 46.6, y = 42.1, r = 40, n = 2, alt = true }, { x = 54.8, y = 37.2, r = 40, n = 2, alt = true }, { x = 53.4, y = 40.6, r = 40, n = 4, alt = true }, { x = 54.7, y = 41, r = 40, n = 2, alt = true }, { x = 55.3, y = 41.3, r = 40, n = 1, alt = true }, { x = 53.9, y = 42.9, r = 40, n = 2, alt = true }, { x = 54.7, y = 42.9, r = 40, n = 1, alt = true }, { x = 52.8, y = 44.7, r = 48, n = 5, alt = true }, { x = 56.4, y = 41.9, r = 40, n = 4, alt = true }, { x = 55.7, y = 43.9, r = 40, n = 2, alt = true }, { x = 56.7, y = 43.2, r = 43, n = 4, alt = true }, { x = 54.3, y = 46.8, r = 40, n = 1, alt = true } }, spread = true },
					},
				},
				{
					title = "Kolkar camps",
					note = "Kolkar Wranglers and Stormers hold the camps south of Regthar.",
					goals = {
						{ t = "goto", text = "Kolkar camps", map = 1413, x = 46.5, y = 31.5, f = "e" },
						{ t = "collect", quest = 855, title = "Centaur Bracers", item = 5030, itemName = "Centaur Bracers", count = 15, oi = 1, map = 1413, x = 46.77, y = 36.45, f = "e", spots = { { x = 46.8, y = 36.5, r = 40, n = 1 }, { x = 48.8, y = 39, r = 40, n = 2 }, { x = 48.5, y = 42.5, r = 40, n = 1 }, { x = 45.8, y = 41, r = 49, n = 6 }, { x = 53.2, y = 42, r = 48, n = 4 }, { x = 53.1, y = 36.8, r = 40, n = 4 }, { x = 57, y = 40.9, r = 40, n = 4 }, { x = 55.7, y = 46, r = 59, n = 4 }, { x = 47.9, y = 24.5, r = 42, n = 3 }, { x = 44.6, y = 24.1, r = 40, n = 3 }, { x = 44.9, y = 20.1, r = 55, n = 6 }, { x = 42.2, y = 26.9, r = 40, n = 5 }, { x = 46.7, y = 37.5, r = 43, n = 4, alt = true }, { x = 45.7, y = 37.1, r = 40, n = 3, alt = true }, { x = 47.8, y = 37.4, r = 40, n = 2, alt = true }, { x = 45.7, y = 38.1, r = 40, n = 3, alt = true }, { x = 47.1, y = 38.7, r = 40, n = 3, alt = true }, { x = 48.1, y = 38.5, r = 40, n = 1, alt = true }, { x = 47.7, y = 39.4, r = 40, n = 1, alt = true }, { x = 45.1, y = 39.5, r = 46, n = 5, alt = true }, { x = 44.4, y = 38.2, r = 40, n = 5, alt = true }, { x = 47.1, y = 40.8, r = 40, n = 3, alt = true }, { x = 48.3, y = 40.6, r = 53, n = 5, alt = true }, { x = 47.4, y = 41.8, r = 40, n = 2, alt = true }, { x = 46.6, y = 42.1, r = 40, n = 2, alt = true }, { x = 52.7, y = 38.9, r = 40, n = 1, alt = true }, { x = 53.4, y = 40.6, r = 40, n = 4, alt = true }, { x = 45.7, y = 25.6, r = 40, n = 3, alt = true }, { x = 43.5, y = 26.5, r = 40, n = 4, alt = true }, { x = 54.8, y = 37.2, r = 40, n = 2, alt = true }, { x = 52.8, y = 44.7, r = 48, n = 5, alt = true }, { x = 53.9, y = 42.9, r = 40, n = 2, alt = true }, { x = 54.7, y = 41, r = 40, n = 2, alt = true }, { x = 47.2, y = 23.4, r = 40, n = 2, alt = true }, { x = 45.6, y = 23.3, r = 61, n = 4, alt = true }, { x = 54.7, y = 42.9, r = 40, n = 1, alt = true }, { x = 46.5, y = 22.9, r = 40, n = 4, alt = true }, { x = 42.2, y = 24.7, r = 51, n = 6, alt = true }, { x = 55.3, y = 41.3, r = 40, n = 1, alt = true }, { x = 43.1, y = 23.6, r = 50, n = 6, alt = true }, { x = 44.5, y = 22.6, r = 40, n = 3, alt = true }, { x = 45.5, y = 22.1, r = 40, n = 1, alt = true }, { x = 54.3, y = 46.8, r = 40, n = 1, alt = true }, { x = 55.7, y = 43.9, r = 40, n = 2, alt = true }, { x = 56.4, y = 41.9, r = 40, n = 4, alt = true }, { x = 43.8, y = 21.3, r = 52, n = 6, alt = true }, { x = 56.7, y = 43.2, r = 43, n = 4, alt = true } }, spread = true },
					},
				},
				{
					title = "Regthar Deathgate",
					goals = {
						{ t = "turnin", quest = 855, title = "Centaur Bracers", npc = 3389, npcName = "Regthar Deathgate", map = 1413, x = 45.34, y = 28.41, f = "e" },
					},
				},
				{
					title = "The Crossroads",
					goals = {
						{ t = "turnin", quest = 870, title = "The Forgotten Pools", npc = 3448, npcName = "Tonga Runetotem", map = 1413, x = 52.26, y = 31.93, f = "e", note = "Tonga Runetotem" },
						{ t = "accept", quest = 877, title = "The Stagnant Oasis", npc = 3448, npcName = "Tonga Runetotem", minLevel = 10, qlvl = 16, pre = { 870 }, preTitles = { [870] = "The Forgotten Pools" }, map = 1413, x = 52.26, y = 31.93, f = "e" },
						{ t = "turnin", quest = 881, title = "Echeyakee", npc = 3338, npcName = "Sergra Darkthorn", map = 1413, x = 52.23, y = 31.01, f = "e", note = "Sergra Darkthorn" },
						{ t = "accept", quest = 905, title = "The Angry Scytheclaws", npc = 3338, npcName = "Sergra Darkthorn", minLevel = 10, qlvl = 17, pre = { 881 }, preTitles = { [881] = "Echeyakee" }, map = 1413, x = 52.23, y = 31.01, f = "e" },
						{ t = "turnin", quest = 872, title = "The Disruption Ends", npc = 3429, npcName = "Thork", map = 1413, x = 51.5, y = 30.87, f = "e", note = "Thork" },
						{ t = "turnin", quest = 848, title = "Fungal Spores", npc = 3390, npcName = "Apothecary Helbrim", map = 1413, x = 51.44, y = 30.15, f = "e", note = "Apothecary Helbrim" },
						{ t = "turnin", quest = 867, title = "Harpy Raiders", npc = 3449, npcName = "Darsok Swiftdagger", map = 1413, x = 51.62, y = 30.9, f = "e", note = "Darsok Swiftdagger" },
						{ t = "accept", quest = 875, title = "Harpy Lieutenants", npc = 3449, npcName = "Darsok Swiftdagger", minLevel = 12, qlvl = 16, pre = { 867 }, preTitles = { [867] = "Harpy Raiders" }, map = 1413, x = 51.62, y = 30.9, f = "e" },
					},
				},
				{
					title = "The Stagnant Oasis",
					note = "South-east of the Crossroads. Test the seeds at the bubbling fissure on the oasis' east bank.",
					goals = {
						{ t = "interact", quest = 877, title = "The Stagnant Oasis", object = 3737, objName = "Bubbling Fissure", oi = 1, map = 1413, x = 55.61, y = 42.75, f = "e" },
					},
				},
				{
					title = "Raptor nests",
					note = "The three nests sit together in the Raptor Grounds south-west of the oasis; Sunscale Scytheclaws guard them.",
					goals = {
						{ t = "interact", quest = 905, title = "The Angry Scytheclaws", object = 6906, objName = "Red Raptor Nest", oi = 1, map = 1413, x = 52.46, y = 46.56, f = "e" },
						{ t = "interact", quest = 905, title = "The Angry Scytheclaws", object = 6907, objName = "Blue Raptor Nest", oi = 2, map = 1413, x = 52.6, y = 46.11, f = "e" },
						{ t = "interact", quest = 905, title = "The Angry Scytheclaws", object = 6908, objName = "Yellow Raptor Nest", oi = 3, map = 1413, x = 52.02, y = 46.47, f = "e" },
					},
				},
				{
					title = "Ratchet",
					note = "East to Ratchet, on the coast.",
					goals = {
						{ t = "turnin", quest = 902, title = "Samophlange", npc = 3442, npcName = "Sputtervalve", map = 1413, x = 62.98, y = 37.22, f = "e", note = "Sputtervalve" },
						{ t = "accept", quest = 3921, title = "Wenikee Boltbucket", npc = 3442, npcName = "Sputtervalve", minLevel = 10, qlvl = 14, pre = { 902 }, preTitles = { [902] = "Samophlange" }, map = 1413, x = 62.98, y = 37.22, f = "e" },
						{ t = "turnin", quest = 819, title = "Chen's Empty Keg", npc = 3292, npcName = "Brewmaster Drohn", map = 1413, x = 62.26, y = 38.39, f = "e", note = "Brewmaster Drohn" },
						{ t = "vendor", candidates = { { npc = 3493, npcName = "Grazlix", map = 1413, x = 62.21, y = 38.41, f = "e", faction = "AH" }, { npc = 3159, npcName = "Kzan Thornslash", map = 1411, x = 40.47, y = 68, f = "e", faction = "H" }, { npc = 3486, npcName = "Halija Whitestrider", map = 1413, x = 52.25, y = 31.86, f = "e", faction = "H" }, { npc = 10369, npcName = "Trayexir", map = 1411, x = 56.47, y = 73.12, f = "e", faction = "H" }, { npc = 3167, npcName = "Wuark", map = 1411, x = 51.9, y = 41.14, f = "e", faction = "H" }, { npc = 3683, npcName = "Kiknikle", map = 1413, x = 41.79, y = 38.69, f = "e", faction = "AH" }, { npc = 10380, npcName = "Sanuye Runetotem", map = 1413, x = 45.12, y = 59.01, f = "e", faction = "H" }, { npc = 9552, npcName = "Zanara", map = 1445, x = 35.5, y = 30.09, f = "e", faction = "H" }, { npc = 14754, npcName = "Kelm Hargunth", map = 1413, x = 46.65, y = 8.38, f = "e", faction = "H" }, { npc = 3682, npcName = "Vrang Wildgore", map = 1413, x = 43.8, y = 12.21, f = "e", faction = "H" }, { npc = 3349, npcName = "Ukra'nor", map = 1454, x = 29.74, y = 74.17, f = "e", faction = "H" }, { npc = 3317, npcName = "Ollanus", map = 1454, x = 56.52, y = 73.77, f = "e", faction = "H" }, { npc = 5816, npcName = "Katis", map = 1454, x = 44.18, y = 48.44, f = "e", faction = "H" }, { npc = 3316, npcName = "Handor", map = 1454, x = 62.88, y = 44.69, f = "e", faction = "H" }, { npc = 3356, npcName = "Sumi", map = 1454, x = 82.6, y = 23.96, f = "e", faction = "H" }, { npc = 6028, npcName = "Burkrum", map = 1440, x = 73.54, y = 60.31, f = "e", faction = "H" }, { npc = 3018, npcName = "Hogor Thunderhoof", map = 1456, x = 55.55, y = 57.07, f = "e", faction = "H" }, { npc = 3080, npcName = "Harant Ironbrace", map = 1412, x = 45.32, y = 62.19, faction = "H" }, { npc = 3074, npcName = "Varia Hardhide", map = 1412, x = 43.86, y = 77.65, faction = "H" }, { npc = 4086, npcName = "Veenix", map = 1442, x = 58.22, y = 51.74, f = "e", faction = "AH" }, { npc = 9551, npcName = "Starn", map = 1441, x = 44.89, y = 50.68, f = "e", faction = "H" }, { npc = 10361, npcName = "Gruul Darkblade", map = 1447, x = 22.22, y = 51.09, f = "e", faction = "H" }, { npc = 4085, npcName = "Nizzik", map = 1442, x = 62.7, y = 40.18, f = "e", faction = "AH" }, { npc = 9549, npcName = "Borand", map = 1442, x = 45.36, y = 59.1, f = "e", faction = "H" }, { npc = 8159, npcName = "Worb Strongstitch", map = 1444, x = 74.71, y = 42.58, f = "e", faction = "H" }, { npc = 3053, npcName = "Synge", map = 1441, x = 80.4, y = 77.01, f = "e", faction = "AH" }, { npc = 8878, npcName = "Muuran", map = 1443, x = 55.59, y = 56.5, f = "e", faction = "H" }, { npc = 3000, npcName = "Gibbert", map = 1449, x = 44.1, y = 7.19, f = "e", faction = "AH" }, { npc = 8131, npcName = "Blizrik Buckshot", map = 1446, x = 50.74, y = 27.53, f = "e", faction = "AH" }, { npc = 12045, npcName = "Hae'Wilani", map = 1443, x = 25.8, y = 71.02, f = "e", faction = "H" }, { npc = 10379, npcName = "Altsoba Ragetotem", map = 1448, x = 34.81, y = 53.16, f = "e", faction = "H" }, { npc = 15176, npcName = "Vargus", map = 1451, x = 51.23, y = 38.86, f = "e", faction = "AH" }, { npc = 11184, npcName = "Wixxrak", map = 1452, x = 61.72, y = 38.03, f = "e", faction = "AH" }, { npc = 12029, npcName = "Narianna", map = 1450, x = 53.34, y = 42.7, f = "e", faction = "AH" }, { npc = 3537, npcName = "Zixil", map = 1416, x = 53.6, y = 98.7, f = "e", faction = "AH" }, { npc = 3539, npcName = "Ott", map = 1416, x = 58.9, y = 88.8, f = "e", faction = "H" }, { npc = 13219, npcName = "Jekyll Flandring", map = 1416, x = 62.84, y = 59.27, f = "e", faction = "H" }, { npc = 9555, npcName = "Mu'uta", map = 1417, x = 72.52, y = 33.35, f = "e", faction = "H" }, { npc = 9179, npcName = "Jazzrik", map = 1418, x = 42.47, y = 52.5, f = "e", faction = "AH" }, { npc = 9544, npcName = "Yuka Screwspigot", map = 1418, x = 4.9, y = 94.7, f = "e", faction = "AH" }, { npc = 2113, npcName = "Archibald Kava", map = 1420, x = 32.41, y = 65.66, f = "e", faction = "H" }, { npc = 2135, npcName = "Abe Winters", map = 1420, x = 60.22, y = 53.1, f = "e", faction = "H" }, { npc = 3522, npcName = "Constance Brisboise", map = 1420, x = 52.6, y = 55.77, f = "e", faction = "H" }, { npc = 3534, npcName = "Wallace the Blind", map = 1421, x = 46.5, y = 86.49, f = "e", faction = "AH" }, { npc = 3552, npcName = "Alexandre Lefevre", map = 1421, x = 44.6, y = 39.11, f = "e", faction = "H" }, { npc = 10856, npcName = "Argent Quartermaster Hasana", map = 1422, x = 26.6, y = 55.2, f = "e", faction = "AH" }, { npc = 10857, npcName = "Argent Quartermaster Lightspark", map = 1422, x = 42.84, y = 83.72, f = "e", faction = "AH" }, { npc = 11278, npcName = "Magnus Frostwake", map = 1422, x = 68.12, y = 77.57, f = "e", faction = "AH" }, { npc = 16376, npcName = "Craftsman Wilhelm", map = 1423, x = 71.24, y = 49.9, faction = "AH" }, { npc = 3536, npcName = "Kris Legace", map = 1424, x = 80.14, y = 38.89, f = "e", faction = "AH" }, { npc = 14737, npcName = "Smith Slagtree", map = 1425, x = 77.23, y = 80.13, f = "e", faction = "H" }, { npc = 1407, npcName = "Sranda", map = 1427, x = 82, y = 38.5, f = "e", faction = "H" }, { npc = 14624, npcName = "Master Smith Burninate", map = 1427, x = 38.8, y = 28.51, f = "e", faction = "AH" }, { npc = 1146, npcName = "Vharr", map = 1434, x = 32.36, y = 27.95, f = "e", faction = "H" }, { npc = 2482, npcName = "Zarena Cromwind", map = 1434, x = 28.34, y = 75.46, f = "e", faction = "AH" }, { npc = 2483, npcName = "Jaquilina Dramet", map = 1434, x = 35.75, y = 10.66, f = "e", faction = "AH" }, { npc = 14921, npcName = "Rin'wosho the Trader", map = 1434, x = 15.07, y = 16, f = "e", faction = "AH" }, { npc = 980, npcName = "Grimnal", map = 1435, x = 45.08, y = 50.43, f = "e", faction = "H" }, { npc = 1669, npcName = "Defias Profiteer", map = 1436, x = 43.47, y = 66.76, f = "e", faction = "AH" }, { npc = 4556, npcName = "Gordon Wendham", map = 1458, x = 61.49, y = 41.79, f = "e", faction = "H" }, { npc = 3343, npcName = "Grelkor", map = 1459, x = 49.68, y = 82.46, f = "e", faction = "H" } } },
					},
				},
				{
					title = "The Crossroads",
					note = "Back west along the road.",
					goals = {
						{ t = "turnin", quest = 877, title = "The Stagnant Oasis", npc = 3448, npcName = "Tonga Runetotem", map = 1413, x = 52.26, y = 31.93, f = "e", note = "Tonga Runetotem" },
						{ t = "accept", quest = 880, title = "Altered Beings", npc = 3448, npcName = "Tonga Runetotem", minLevel = 10, qlvl = 16, pre = { 877 }, preTitles = { [877] = "The Stagnant Oasis" }, map = 1413, x = 52.26, y = 31.93, f = "e" },
						{ t = "turnin", quest = 905, title = "The Angry Scytheclaws", npc = 3338, npcName = "Sergra Darkthorn", map = 1413, x = 52.23, y = 31.01, f = "e", note = "Sergra Darkthorn" },
					},
				},
				{
					title = "Lushwater Oasis",
					note = "Oasis Snapjaws crawl around Lushwater Oasis, south-west of the Crossroads, and around the Stagnant Oasis.",
					goals = {
						{ t = "collect", quest = 880, title = "Altered Beings", item = 5098, itemName = "Altered Snapjaw Shell", count = 8, oi = 1, map = 1413, x = 48.07, y = 39.92, f = "e", spots = { { x = 48.1, y = 40.3, r = 40, n = 2 }, { x = 47.5, y = 39.9, r = 40, n = 4 }, { x = 46.5, y = 40, r = 65, n = 6 }, { x = 46.1, y = 39, r = 47, n = 6 }, { x = 55.2, y = 42.4, r = 41, n = 4 }, { x = 55.7, y = 43.2, r = 42, n = 4 }, { x = 55.9, y = 42, r = 45, n = 3 } }, spread = true },
					},
				},
				{
					title = "The Crossroads",
					goals = {
						{ t = "turnin", quest = 880, title = "Altered Beings", npc = 3448, npcName = "Tonga Runetotem", map = 1413, x = 52.26, y = 31.93, f = "e", note = "Tonga Runetotem" },
						{ t = "accept", quest = 3301, title = "Mura Runetotem", npc = 3448, npcName = "Tonga Runetotem", minLevel = 10, qlvl = 15, pre = { 880 }, preTitles = { [880] = "Altered Beings" }, map = 1413, x = 52.26, y = 31.93, f = "e", note = "Mura Runetotem: the Sepulcher in Silverpine Forest, next guide" },
					},
				},
				{
					title = "Harpy Lieutenants",
					note = "The Witchwing Slayers hold the western Dry Hills; they wear the rings.",
					goals = {
						{ t = "collect", quest = 875, title = "Harpy Lieutenants", item = 5065, itemName = "Harpy Lieutenant Ring", count = 6, oi = 1, map = 1413, x = 40.17, y = 15.97, f = "e", spots = { { x = 39.9, y = 15.8, r = 45, n = 5 }, { x = 39.5, y = 16.9, r = 37, n = 3 }, { x = 39.1, y = 15, r = 51, n = 5 }, { x = 38.4, y = 16.1, r = 22, n = 2 }, { x = 38.6, y = 17.4, r = 28, n = 3 }, { x = 39.1, y = 13.3, r = 18, n = 2 }, { x = 38.1, y = 15, r = 20, n = 2, alt = true }, { x = 38.3, y = 13.6, r = 44, n = 4, alt = true }, { x = 37.6, y = 16.1, r = 44, n = 4, alt = true }, { x = 39.8, y = 11.8, r = 18, n = 2, alt = true }, { x = 38.4, y = 12.7, r = 29, n = 2, alt = true }, { x = 38.9, y = 12, r = 25, n = 2, alt = true }, { x = 39.1, y = 10.7, r = 31, n = 3, alt = true } } },
					},
				},
				{
					title = "Wenikee Boltbucket",
					note = "East to the Mor'shan Rampart; Wenikee stands at the camp just south of it.",
					goals = {
						{ t = "turnin", quest = 3921, title = "Wenikee Boltbucket", npc = 9316, npcName = "Wenikee Boltbucket", map = 1413, x = 49.05, y = 11.17, f = "e" },
						{ t = "accept", quest = 3922, title = "Nugget Slugs", npc = 9316, npcName = "Wenikee Boltbucket", minLevel = 10, qlvl = 15, pre = { 3921 }, preTitles = { [3921] = "Wenikee Boltbucket" }, map = 1413, x = 49.05, y = 11.17, f = "e" },
					},
				},
				{
					title = "Nugget Slugs",
					note = "The tool buckets with the slugs lie around the Venture Co. drill site in the Sludge Fen, east of Wenikee.",
					goals = {
						{ t = "collect", quest = 3922, title = "Nugget Slugs", item = 11143, itemName = "Nugget Slug", count = 15, oi = 1, map = 1413, x = 55.61, y = 8.84, f = "e", spots = { { x = 56, y = 8.4, r = 58, n = 5 }, { x = 56, y = 9.5, r = 30, n = 3 }, { x = 56.1, y = 7.1, r = 44, n = 5 }, { x = 57, y = 8.7, r = 40, n = 3 }, { x = 57.3, y = 7.2, r = 15, n = 1, alt = true } } },
					},
				},
				{
					title = "Wenikee Boltbucket",
					goals = {
						{ t = "turnin", quest = 3922, title = "Nugget Slugs", npc = 9316, npcName = "Wenikee Boltbucket", map = 1413, x = 49.05, y = 11.17, f = "e" },
						{ t = "accept", quest = 3923, title = "Rilli Greasygob", npc = 9316, npcName = "Wenikee Boltbucket", minLevel = 10, qlvl = 18, pre = { 3922 }, preTitles = { [3922] = "Nugget Slugs" }, map = 1413, x = 49.05, y = 11.17, f = "e", note = "Keep it: Rilli Greasygob stands outside Orgrimmar; a later guide hands it in" },
					},
				},
				{
					title = "The Crossroads",
					note = "Walk back south to the Crossroads. The next guide starts here and takes you to Orgrimmar and the zeppelin to Tirisfal Glades.",
					goals = {
						{ t = "turnin", quest = 875, title = "Harpy Lieutenants", npc = 3449, npcName = "Darsok Swiftdagger", map = 1413, x = 51.62, y = 30.9, f = "e", note = "Darsok Swiftdagger" },
					},
				},
			},
		})
	end
	register()
end

-- Source: forever/horde/03-silverpine-forest.guide
do
	local function register()
		Polestar.RegisterGuide({
			id = "forever/horde/03-silverpine-forest",
			pack = "guides",
			title = "Silverpine Forest & Orgrimmar",
			faction = "Horde",
			minLevel = 16,
			maxLevel = 20,
			category = "Leveling",
			zone = 1421,
			zoneName = "Silverpine Forest",
			next = "forever/horde/04-the-barrens",
			author = "Polestar",
			version = 1,
			steps = {
				{
					title = "To Orgrimmar",
					note = "From the Crossroads, follow the road north-east to Orgrimmar and walk in by the main gate. Doras, the wind rider master, stands on the tower in the Valley of Strength.",
					goals = {
						{ t = "getfp", npc = 3310, npcName = "Doras", location = "Orgrimmar", map = 1454, x = 45.12, y = 63.89, f = "e", note = "Doras" },
						{ t = "train", class = true, candidates = { { npc = 3328, npcName = "Ormok", map = 1454, x = 43.9, y = 54.63, f = "e", faction = "H", classes = { "ROGUE" } }, { npc = 3325, npcName = "Mirket", map = 1454, x = 48.62, y = 46.95, f = "e", faction = "H", classes = { "WARLOCK" } }, { npc = 5882, npcName = "Pephredo", map = 1454, x = 38.35, y = 85.56, f = "e", faction = "H", classes = { "MAGE" } }, { npc = 6018, npcName = "Ur'kyo", map = 1454, x = 35.59, y = 87.82, f = "e", faction = "H", classes = { "PRIEST" } }, { npc = 3344, npcName = "Kardris Dreamseeker", map = 1454, x = 38.8, y = 36.37, f = "e", faction = "H", classes = { "SHAMAN" } }, { npc = 3406, npcName = "Xor'juul", map = 1454, x = 67.24, y = 20.2, f = "e", faction = "H", classes = { "HUNTER" } }, { npc = 3354, npcName = "Sorek", map = 1454, x = 80.39, y = 32.38, f = "e", faction = "H", classes = { "WARRIOR" } }, { npc = 3172, npcName = "Dhugru Gorelust", map = 1411, x = 54.38, y = 41.2, f = "e", faction = "H", classes = { "WARLOCK" } }, { npc = 3171, npcName = "Thotar", map = 1411, x = 51.85, y = 43.49, f = "e", faction = "H", classes = { "HUNTER" } }, { npc = 3169, npcName = "Tarshaw Jaggedscar", map = 1411, x = 54.19, y = 42.47, f = "e", faction = "H", classes = { "WARRIOR" } }, { npc = 3170, npcName = "Kaplak", map = 1411, x = 51.98, y = 43.69, f = "e", faction = "H", classes = { "ROGUE" } }, { npc = 3173, npcName = "Swart", map = 1411, x = 54.42, y = 42.59, f = "e", faction = "H", classes = { "SHAMAN" } }, { npc = 3706, npcName = "Tai'jin", map = 1411, x = 54.26, y = 42.93, f = "e", faction = "H", classes = { "PRIEST" } }, { npc = 3155, npcName = "Rwag", map = 1411, x = 41.28, y = 68, f = "e", faction = "H", classes = { "ROGUE" } }, { npc = 3156, npcName = "Nartok", map = 1411, x = 40.65, y = 68.52, f = "e", faction = "H", classes = { "WARLOCK" } }, { npc = 3707, npcName = "Ken'jai", map = 1411, x = 42.36, y = 68.81, f = "e", faction = "H", classes = { "PRIEST" } }, { npc = 3157, npcName = "Shikrik", map = 1411, x = 42.39, y = 69, f = "e", faction = "H", classes = { "SHAMAN" } }, { npc = 5884, npcName = "Mai'ah", map = 1411, x = 42.51, y = 69.04, f = "e", faction = "H", classes = { "MAGE" } }, { npc = 3154, npcName = "Jen'shan", map = 1411, x = 42.84, y = 69.33, f = "e", faction = "H", classes = { "HUNTER" } }, { npc = 3153, npcName = "Frang", map = 1411, x = 42.89, y = 69.44, f = "e", faction = "H", classes = { "WARRIOR" } }, { npc = 5880, npcName = "Un'Thuwa", map = 1411, x = 56.31, y = 75.11, f = "e", faction = "H", classes = { "MAGE" } }, { npc = 3034, npcName = "Sheal Runetotem", map = 1456, x = 77.14, y = 27.02, f = "e", faction = "H", classes = { "DRUID" } }, { npc = 3040, npcName = "Urek Thunderhorn", map = 1456, x = 59.13, y = 86.87, f = "e", faction = "H", classes = { "HUNTER" } }, { npc = 3043, npcName = "Ker Ragetotem", map = 1456, x = 57.58, y = 85.5, f = "e", faction = "H", classes = { "WARRIOR" } }, { npc = 3048, npcName = "Ursyn Ghull", map = 1456, x = 25.7, y = 14.19, f = "e", faction = "H", classes = { "MAGE" } }, { npc = 246344, npcName = "Alodan the Hopeful", map = 1456, x = 25.6, y = 14.8, f = "e", faction = "H", classes = { "PALADIN" } }, { npc = 3044, npcName = "Miles Welsh", map = 1456, x = 25.32, y = 15.27, f = "e", faction = "H", classes = { "PRIEST" } }, { npc = 3031, npcName = "Tigor Skychaser", map = 1456, x = 23.64, y = 18.79, f = "e", faction = "H", classes = { "SHAMAN" } }, { npc = 3065, npcName = "Yaw Sharpmane", map = 1412, x = 46.93, y = 59.65, faction = "H", classes = { "HUNTER" } }, { npc = 3063, npcName = "Krang Stonehoof", map = 1412, x = 48.35, y = 63.74, faction = "H", classes = { "WARRIOR" } }, { npc = 3066, npcName = "Narm Skychaser", map = 1412, x = 47.4, y = 62.54, faction = "H", classes = { "SHAMAN" } }, { npc = 3064, npcName = "Gennia Runetotem", map = 1412, x = 47.48, y = 62.95, faction = "H", classes = { "DRUID" } }, { npc = 3060, npcName = "Gart Mistrunner", map = 1412, x = 44.65, y = 76.55, faction = "H", classes = { "DRUID" } }, { npc = 3062, npcName = "Meela Dawnstrider", map = 1412, x = 44.58, y = 76.56, faction = "H", classes = { "SHAMAN" } }, { npc = 3061, npcName = "Lanka Farshot", map = 1412, x = 43.96, y = 76.35, faction = "H", classes = { "HUNTER" } }, { npc = 3059, npcName = "Harutt Thunderhorn", map = 1412, x = 43.75, y = 76.72, faction = "H", classes = { "WARRIOR" } }, { npc = 2119, npcName = "Dannal Stern", map = 1420, x = 32.69, y = 65.56, f = "e", faction = "H", classes = { "WARRIOR" } }, { npc = 2122, npcName = "David Trias", map = 1420, x = 32.53, y = 65.65, f = "e", faction = "H", classes = { "ROGUE" } }, { npc = 2123, npcName = "Dark Cleric Duesten", map = 1420, x = 31.11, y = 66.03, f = "e", faction = "H", classes = { "PRIEST" } }, { npc = 2124, npcName = "Isabella", map = 1420, x = 30.93, y = 66.06, f = "e", faction = "H", classes = { "MAGE" } }, { npc = 2126, npcName = "Maximillion", map = 1420, x = 30.91, y = 66.34, f = "e", faction = "H", classes = { "WARLOCK" } }, { npc = 2127, npcName = "Rupert Boch", map = 1420, x = 61.59, y = 52.4, f = "e", faction = "H", classes = { "WARLOCK" } }, { npc = 2128, npcName = "Cain Firesong", map = 1420, x = 61.97, y = 52.47, f = "e", faction = "H", classes = { "MAGE" } }, { npc = 2129, npcName = "Dark Cleric Beryl", map = 1420, x = 61.57, y = 52.19, f = "e", faction = "H", classes = { "PRIEST" } }, { npc = 2130, npcName = "Marion Call", map = 1420, x = 61.75, y = 52, f = "e", faction = "H", classes = { "ROGUE" } }, { npc = 2131, npcName = "Austil de Mon", map = 1420, x = 61.85, y = 52.54, f = "e", faction = "H", classes = { "WARRIOR" } }, { npc = 244808, npcName = "Aramis Hammerhand", map = 1420, x = 31.09, y = 66.32, f = "e", faction = "H", classes = { "PALADIN" } }, { npc = 246152, npcName = "Shari Stilwell", map = 1420, x = 60.25, y = 52.63, f = "e", faction = "H", classes = { "PALADIN" } }, { npc = 246389, npcName = "Hilda the Breaker", map = 1420, x = 21.92, y = 47.19, f = "e", faction = "H", classes = { "PALADIN" } }, { npc = 4563, npcName = "Kaal Soulreaper", map = 1458, x = 86.21, y = 15.93, f = "e", faction = "H", classes = { "WARLOCK" } }, { npc = 4566, npcName = "Kaelystia Hatebringer", map = 1458, x = 85.02, y = 14.02, f = "e", faction = "H", classes = { "MAGE" } }, { npc = 4582, npcName = "Carolyn Ward", map = 1458, x = 83.86, y = 72.07, f = "e", faction = "H", classes = { "ROGUE" } }, { npc = 4593, npcName = "Christoph Walker", map = 1458, x = 46.93, y = 15.23, f = "e", faction = "H", classes = { "WARRIOR" } }, { npc = 4606, npcName = "Aelthalyste", map = 1458, x = 49.26, y = 17.12, f = "e", faction = "H", classes = { "PRIEST" } }, { npc = 260093, npcName = "Garen Largo", map = 1458, x = 47.49, y = 15.23, f = "e", faction = "H", classes = { "PALADIN" } }, { npc = 251373, npcName = "Xyton Silverwind", map = 2521, x = 41.72, y = 23.38, faction = "AH", classes = { "DRUID" } }, { npc = 251374, npcName = "Windshaper Boro", map = 2521, x = 42.76, y = 23.58, faction = "H", classes = { "SHAMAN" } }, { npc = 251376, npcName = "Tai'ree Farsight", map = 2521, x = 42.44, y = 23.68, faction = "AH", classes = { "HUNTER" } }, { npc = 251389, npcName = "Akeri Duskblade", map = 2521, x = 43.71, y = 24.3, faction = "AH", classes = { "ROGUE" } }, { npc = 251964, npcName = "Blademaster Ren", map = 2521, x = 43.68, y = 24.17, faction = "AH", classes = { "WARRIOR" } } } },
					},
				},
				{
					title = "Orgrimmar class quests",
					note = "Ormak Grimshot stands in the Valley of Honor, Ur'kyo in the Valley of Spirits on the city's west side.",
					only = { classes = { "HUNTER", "PRIEST" } },
					goals = {
						{ t = "turnin", quest = 6081, title = "Training the Beast", npc = 3352, npcName = "Ormak Grimshot", map = 1454, x = 66.05, y = 18.53, f = "e", only = { classes = { "HUNTER" } }, note = "Ormak Grimshot: Beast Training" },
						{ t = "turnin", quest = 5654, title = "Hex of Weakness", npc = 6018, npcName = "Ur'kyo", map = 1454, x = 35.59, y = 87.82, f = "e", only = { classes = { "PRIEST" }, races = { "Troll" } }, note = "Ur'kyo: Hex of Weakness" },
					},
				},
				{
					title = "A Lesson to Learn",
					note = "Turak Runetotem trains you on Elder Rise in Thunder Bluff.",
					only = { classes = { "DRUID" }, races = { "Tauren" } },
					goals = {
						{ t = "accept", quest = 27, title = "A Lesson to Learn", npc = 3033, npcName = "Turak Runetotem", minLevel = 16, qlvl = 16, map = 1456, x = 76.48, y = 27.22, f = "e", note = "Turak Runetotem" },
					},
				},
				{
					title = "Trial of the Lake",
					note = "Cast Teleport: Moonglade; Dendrite Starblaze is in Nighthaven. The Shrine Baubles lie on the bed of Lake Elune'ara and fade within minutes: swim one straight to the Shrine of Remulos on the north-west shore, use it there and speak to Tajarri.",
					only = { classes = { "DRUID" }, races = { "Tauren" } },
					goals = {
						{ t = "turnin", quest = 27, title = "A Lesson to Learn", npc = 11802, npcName = "Dendrite Starblaze", map = 1450, x = 56.21, y = 30.64, f = "e", note = "Dendrite Starblaze" },
						{ t = "accept", quest = 28, title = "Trial of the Lake", npc = 11802, npcName = "Dendrite Starblaze", minLevel = 16, qlvl = 16, pre = { 27 }, preTitles = { [27] = "A Lesson to Learn" }, map = 1450, x = 56.21, y = 30.64, f = "e" },
						{ t = "complete", quest = 28, title = "Trial of the Lake" },
						{ t = "turnin", quest = 28, title = "Trial of the Lake", npc = 11799, npcName = "Tajarri", map = 1450, x = 36.52, y = 40.1, f = "e", note = "Tajarri, at the Shrine of Remulos" },
						{ t = "accept", quest = 30, title = "Trial of the Sea Lion", npc = 11799, npcName = "Tajarri", minLevel = 16, qlvl = 16, pre = { 28 }, preTitles = { [28] = "Trial of the Lake" }, map = 1450, x = 36.52, y = 40.1, f = "e" },
						{ t = "fly", location = "Thunder Bluff", note = "Bunthen Plainswind in Nighthaven flies druids there; then fly on to Orgrimmar for the zeppelin" },
					},
				},
				{
					title = "Zeppelin to Tirisfal Glades",
					note = "The zeppelin towers stand just outside Orgrimmar's main gate. Take the zeppelin to Tirisfal Glades (the other one goes to Grom'gol).",
					goals = {
						{ t = "goto", text = "Zeppelin tower", map = 1411, x = 50.8, y = 13.5, f = "e" },
					},
				},
				{
					title = "Into Silverpine",
					note = "The zeppelin lands at the towers outside the Ruins of Lordaeron. Walk west along the road past the ruins and south into Silverpine Forest; follow the road to the Sepulcher.",
					goals = {
						{ t = "goto", text = "Road to Silverpine", map = 1420, x = 54.5, y = 72, f = "e" },
					},
				},
				{
					title = "The Sepulcher",
					note = "The Sepulcher is the Forsaken crypt-town in the middle of the forest. Everyone you need stands around the crypt entrance; Karos Razok, the bat handler, is just east of it.",
					goals = {
						{ t = "getfp", npc = 2226, npcName = "Karos Razok", location = "The Sepulcher", map = 1421, x = 45.62, y = 42.6, f = "e", note = "Karos Razok" },
						{ t = "sethome", npc = 6739, npcName = "Innkeeper Bates", location = "The Sepulcher", map = 1421, x = 43.18, y = 41.28, f = "e", note = "Innkeeper Bates" },
						{ t = "turnin", quest = 3301, title = "Mura Runetotem", npc = 8385, npcName = "Mura Runetotem", map = 1421, x = 42.91, y = 41.99, f = "e", note = "Mura Runetotem" },
						{ t = "accept", quest = 477, title = "Border Crossings", npc = 2121, npcName = "Shadow Priest Allister", minLevel = 10, qlvl = 14, map = 1421, x = 43.98, y = 40.93, f = "e", note = "Shadow Priest Allister" },
						{ t = "accept", quest = 428, title = "Lost Deathstalkers", npc = 1952, npcName = "High Executor Hadrec", minLevel = 10, qlvl = 12, closedBy = { 429 }, preTitles = { [429] = "Wild Hearts" }, map = 1421, x = 43.42, y = 40.86, f = "e", note = "High Executor Hadrec" },
						{ t = "accept", quest = 437, title = "The Dead Fields", npc = 1952, npcName = "High Executor Hadrec", minLevel = 10, qlvl = 14, map = 1421, x = 43.42, y = 40.86, f = "e" },
						{ t = "accept", quest = 91921, title = "Return to Quinn (Again)", npc = 1937, npcName = "Apothecary Renferrel", minLevel = 10, qlvl = 11, map = 1421, x = 42.8, y = 40.86, f = "e", note = "Apothecary Renferrel" },
					},
				},
				{
					title = "Border Crossings",
					note = "Follow the road south. The Dalaran Crate sits beside it, north of Pyrewood.",
					goals = {
						{ t = "turnin", quest = 477, title = "Border Crossings", object = 1627, objName = "Dalaran Crate", map = 1421, x = 49.89, y = 60.33, f = "e" },
						{ t = "accept", quest = 478, title = "Maps and Runes", object = 1627, objName = "Dalaran Crate", minLevel = 10, qlvl = 14, pre = { 477 }, preTitles = { [477] = "Border Crossings" }, map = 1421, x = 49.89, y = 60.33, f = "e" },
					},
				},
				{
					title = "The Sepulcher",
					goals = {
						{ t = "turnin", quest = 478, title = "Maps and Runes", npc = 2121, npcName = "Shadow Priest Allister", map = 1421, x = 43.98, y = 40.93, f = "e", note = "Shadow Priest Allister" },
						{ t = "accept", quest = 481, title = "Dalar's Analysis", npc = 2121, npcName = "Shadow Priest Allister", minLevel = 10, qlvl = 14, pre = { 478 }, preTitles = { [478] = "Maps and Runes" }, map = 1421, x = 43.98, y = 40.93, f = "e" },
						{ t = "turnin", quest = 481, title = "Dalar's Analysis", npc = 1938, npcName = "Dalar Dawnweaver", map = 1421, x = 44.2, y = 39.81, f = "e", note = "Dalar Dawnweaver" },
						{ t = "accept", quest = 482, title = "Dalaran's Intentions", npc = 1938, npcName = "Dalar Dawnweaver", minLevel = 10, qlvl = 14, pre = { 481 }, preTitles = { [481] = "Dalar's Analysis" }, map = 1421, x = 44.2, y = 39.81, f = "e" },
						{ t = "turnin", quest = 482, title = "Dalaran's Intentions", npc = 2121, npcName = "Shadow Priest Allister", map = 1421, x = 43.98, y = 40.93, f = "e", note = "Shadow Priest Allister" },
						{ t = "accept", quest = 479, title = "Ambermill Investigations", npc = 2121, npcName = "Shadow Priest Allister", minLevel = 10, qlvl = 16, pre = { 482 }, preTitles = { [482] = "Dalaran's Intentions" }, map = 1421, x = 43.98, y = 40.93, f = "e", note = "Ambermill comes later, on the southern loop" },
					},
				},
				{
					title = "The Dead Field",
					note = "North of the Sepulcher. Nightlash haunts the Dead Field: kill it, then walk across the field.",
					goals = {
						{ t = "collect", quest = 437, title = "The Dead Fields", item = 3622, itemName = "Essence of Nightlash", count = 1, oi = 1, map = 1421, x = 44, y = 21, f = "e", spots = { { x = 44.7, y = 20.7, r = 31, n = 3 } } },
						{ t = "complete", quest = 437, title = "The Dead Fields", map = 1421, x = 45.1, y = 21.7, f = "e" },
					},
				},
				{
					title = "Strange Lockbox",
					note = "The Strange Lockbox lies on the coast west of the Dead Field. It holds the Half Pendant of Aquatic Endurance for Trial of the Sea Lion.",
					only = { classes = { "DRUID" }, races = { "Tauren" } },
					goals = {
						{ t = "collect", item = 15882, itemName = "Half Pendant of Aquatic Endurance", map = 1421, x = 29.56, y = 29.2, f = "e", from = "Strange Lockbox", fromKind = "object" },
					},
				},
				{
					title = "Malden's Orchard",
					note = "Follow the road north-east to the Yoricks' house at Malden's Orchard.",
					goals = {
						{ t = "turnin", quest = 428, title = "Lost Deathstalkers", npc = 1950, npcName = "Rane Yorick", map = 1421, x = 53.46, y = 13.43, f = "e", note = "Rane Yorick" },
						{ t = "accept", quest = 429, title = "Wild Hearts", npc = 1950, npcName = "Rane Yorick", minLevel = 10, qlvl = 11, map = 1421, x = 53.46, y = 13.43, f = "e" },
						{ t = "turnin", quest = 91921, title = "Return to Quinn (Again)", npc = 1951, npcName = "Quinn Yorick", map = 1421, x = 53.43, y = 12.59, f = "e", note = "Quinn Yorick" },
						{ t = "accept", quest = 91920, title = "Wild Eyes", npc = 1951, npcName = "Quinn Yorick", minLevel = 10, qlvl = 11, map = 1421, x = 53.43, y = 12.59, f = "e" },
					},
				},
				{
					title = "Escorting Erland",
					note = "Deathstalker Erland waits north-east of the house. Escort him back to Rane; worgs attack on the way.",
					goals = {
						{ t = "accept", quest = 435, title = "Escorting Erland", npc = 1978, npcName = "Deathstalker Erland", minLevel = 10, qlvl = 11, map = 1421, x = 56.18, y = 9.18, f = "e", note = "Deathstalker Erland" },
						{ t = "complete", quest = 435, title = "Escorting Erland" },
					},
				},
				{
					title = "Rane Yorick",
					goals = {
						{ t = "turnin", quest = 435, title = "Escorting Erland", npc = 1950, npcName = "Rane Yorick", map = 1421, x = 53.46, y = 13.43, f = "e" },
						{ t = "accept", quest = 449, title = "The Deathstalkers' Report", npc = 1950, npcName = "Rane Yorick", minLevel = 10, qlvl = 11, pre = { 435 }, preTitles = { [435] = "Escorting Erland" }, map = 1421, x = 53.46, y = 13.43, f = "e" },
					},
				},
				{
					title = "Worgs and murlocs",
					note = "Mottled Worgs prowl the hills around the house. Then walk south along the lake shore: the Vile Fin Shredders and Tidehunters there drop the murloc eyes.",
					goals = {
						{ t = "collect", quest = 429, title = "Wild Hearts", item = 3164, itemName = "Discolored Worg Heart", count = 6, oi = 1, map = 1421, x = 54.88, y = 13.61, f = "e", spots = { { x = 55.2, y = 12.9, r = 43, n = 4 }, { x = 59.5, y = 16, r = 40, n = 1 }, { x = 61.6, y = 8.8, r = 40, n = 3 }, { x = 69.1, y = 6.6, r = 50, n = 8 }, { x = 49.7, y = 14.5, r = 40, n = 2 }, { x = 50.9, y = 21.8, r = 40, n = 1 }, { x = 44.5, y = 26.1, r = 40, n = 2 }, { x = 44.2, y = 47.9, r = 40, n = 1 }, { x = 49.8, y = 75.9, r = 55, n = 4 }, { x = 45.3, y = 80, r = 40, n = 2 }, { x = 50, y = 84.5, r = 40, n = 2 }, { x = 55, y = 80.3, r = 40, n = 1 }, { x = 56.5, y = 16.4, r = 49, n = 3, alt = true }, { x = 57.2, y = 9.4, r = 52, n = 7, alt = true }, { x = 52.3, y = 17.5, r = 40, n = 1, alt = true }, { x = 58.6, y = 13.8, r = 40, n = 2, alt = true }, { x = 59.3, y = 10.5, r = 40, n = 2, alt = true }, { x = 50.7, y = 18.7, r = 40, n = 2, alt = true }, { x = 59.2, y = 7.8, r = 42, n = 3, alt = true }, { x = 61.3, y = 11.9, r = 40, n = 1, alt = true }, { x = 49, y = 20.1, r = 40, n = 1, alt = true }, { x = 48.3, y = 22.1, r = 40, n = 2, alt = true }, { x = 64, y = 11.1, r = 43, n = 3, alt = true }, { x = 47.1, y = 24.9, r = 47, n = 4, alt = true }, { x = 65, y = 6.6, r = 67, n = 7, alt = true }, { x = 66.5, y = 9.1, r = 50, n = 4, alt = true }, { x = 46.5, y = 45.9, r = 40, n = 1, alt = true }, { x = 47.9, y = 48.1, r = 40, n = 1, alt = true }, { x = 45.8, y = 50.2, r = 40, n = 1, alt = true }, { x = 43.2, y = 52.4, r = 40, n = 1, alt = true }, { x = 51.7, y = 77.7, r = 50, n = 5, alt = true }, { x = 47.5, y = 77.2, r = 40, n = 2, alt = true }, { x = 48.6, y = 81.3, r = 50, n = 5, alt = true }, { x = 52.5, y = 81.9, r = 40, n = 1, alt = true } }, spread = true },
						{ t = "collect", quest = 91920, title = "Wild Eyes", item = 730, itemName = "Murloc Eye", count = 3, oi = 1, map = 1421, x = 57.57, y = 18.41, f = "e", spots = { { x = 58.3, y = 18.4, r = 64, n = 11 }, { x = 57.5, y = 22.7, r = 57, n = 7 }, { x = 56.3, y = 27, r = 58, n = 8 }, { x = 67.5, y = 20.5, r = 40, n = 3 }, { x = 71, y = 22.1, r = 54, n = 4 }, { x = 73, y = 16.9, r = 57, n = 11 }, { x = 64.4, y = 12.5, r = 40, n = 9 }, { x = 76.5, y = 33.5, r = 79, n = 11 }, { x = 80.6, y = 31.9, r = 40, n = 5 }, { x = 80.5, y = 27.8, r = 40, n = 4 }, { x = 64.9, y = 42.3, r = 42, n = 8 }, { x = 67.3, y = 49, r = 40, n = 2 }, { x = 60.3, y = 16.7, r = 52, n = 11, alt = true }, { x = 62, y = 13.5, r = 53, n = 8, alt = true }, { x = 65.1, y = 20.4, r = 51, n = 6, alt = true }, { x = 66.4, y = 12.7, r = 40, n = 10, alt = true }, { x = 67.8, y = 17.9, r = 61, n = 5, alt = true }, { x = 69.8, y = 20.1, r = 40, n = 3, alt = true }, { x = 70.5, y = 17.8, r = 40, n = 5, alt = true }, { x = 74.2, y = 18.6, r = 40, n = 5, alt = true }, { x = 75.2, y = 16.7, r = 40, n = 4, alt = true }, { x = 66.7, y = 44.1, r = 40, n = 4, alt = true }, { x = 66.4, y = 46.1, r = 49, n = 7, alt = true }, { x = 77.8, y = 31.2, r = 91, n = 18, alt = true }, { x = 79.8, y = 29, r = 56, n = 9, alt = true } }, spread = true },
					},
				},
				{
					title = "Hearth to the Sepulcher",
					goals = {
						{ t = "hearth", location = "The Sepulcher" },
						{ t = "turnin", quest = 437, title = "The Dead Fields", npc = 1952, npcName = "High Executor Hadrec", map = 1421, x = 43.42, y = 40.86, f = "e", note = "High Executor Hadrec" },
						{ t = "accept", quest = 438, title = "The Decrepit Ferry", npc = 1952, npcName = "High Executor Hadrec", minLevel = 10, qlvl = 16, pre = { 437 }, preTitles = { [437] = "The Dead Fields" }, map = 1421, x = 43.42, y = 40.86, f = "e" },
						{ t = "turnin", quest = 449, title = "The Deathstalkers' Report", npc = 1952, npcName = "High Executor Hadrec", map = 1421, x = 43.42, y = 40.86, f = "e" },
						{ t = "accept", quest = 3221, title = "Speak with Renferrel", npc = 1952, npcName = "High Executor Hadrec", minLevel = 10, qlvl = 12, pre = { 449 }, preTitles = { [449] = "The Deathstalkers' Report" }, map = 1421, x = 43.42, y = 40.86, f = "e" },
						{ t = "turnin", quest = 3221, title = "Speak with Renferrel", npc = 1937, npcName = "Apothecary Renferrel", map = 1421, x = 42.8, y = 40.86, f = "e", note = "Apothecary Renferrel" },
						{ t = "turnin", quest = 429, title = "Wild Hearts", npc = 1937, npcName = "Apothecary Renferrel", map = 1421, x = 42.8, y = 40.86, f = "e" },
						{ t = "accept", quest = 430, title = "Return to Quinn", npc = 1937, npcName = "Apothecary Renferrel", minLevel = 10, qlvl = 11, pre = { 429 }, preTitles = { [429] = "Wild Hearts" }, map = 1421, x = 42.8, y = 40.86, f = "e" },
						{ t = "turnin", quest = 91920, title = "Wild Eyes", npc = 1937, npcName = "Apothecary Renferrel", map = 1421, x = 42.8, y = 40.86, f = "e" },
					},
				},
				{
					title = "The Decrepit Ferry",
					note = "The Corpse Laden Boat lies at the ferry landing on the lake shore east of the Sepulcher.",
					goals = {
						{ t = "turnin", quest = 438, title = "The Decrepit Ferry", object = 1593, objName = "Corpse Laden Boat", map = 1421, x = 58.44, y = 34.9, f = "e" },
						{ t = "accept", quest = 439, title = "Rot Hide Clues", object = 1593, objName = "Corpse Laden Boat", minLevel = 10, qlvl = 16, pre = { 438 }, preTitles = { [438] = "The Decrepit Ferry" }, map = 1421, x = 58.44, y = 34.9, f = "e" },
					},
				},
				{
					title = "The Sepulcher",
					goals = {
						{ t = "turnin", quest = 439, title = "Rot Hide Clues", npc = 1952, npcName = "High Executor Hadrec", map = 1421, x = 43.42, y = 40.86, f = "e", note = "High Executor Hadrec" },
						{ t = "accept", quest = 443, title = "Rot Hide Ichor", npc = 1952, npcName = "High Executor Hadrec", minLevel = 10, qlvl = 17, pre = { 439 }, preTitles = { [439] = "Rot Hide Clues" }, map = 1421, x = 43.42, y = 40.86, f = "e" },
					},
				},
				{
					title = "The Ivar Patch",
					note = "North again to the Yoricks' house. Ivar the Foul lurks a short walk west of it.",
					goals = {
						{ t = "turnin", quest = 430, title = "Return to Quinn", npc = 1951, npcName = "Quinn Yorick", map = 1421, x = 53.43, y = 12.59, f = "e", note = "Quinn Yorick" },
						{ t = "accept", quest = 425, title = "Ivar the Foul", npc = 1950, npcName = "Rane Yorick", minLevel = 10, qlvl = 12, pre = { 430 }, preTitles = { [430] = "Return to Quinn" }, map = 1421, x = 53.46, y = 13.43, f = "e", note = "Rane Yorick" },
						{ t = "collect", quest = 425, title = "Ivar the Foul", item = 3621, itemName = "Ivar's Head", oi = 1, map = 1421, x = 51.52, y = 13.9, f = "e" },
						{ t = "turnin", quest = 425, title = "Ivar the Foul", npc = 1950, npcName = "Rane Yorick", map = 1421, x = 53.46, y = 13.43, f = "e" },
					},
				},
				{
					title = "Fenris Isle",
					note = "Follow the lake shore south-east and swim out to Fenris Isle. Rot Hide gnolls cover the island; every type drops ichor. Stay out of Fenris Keep on its north side unless you go for the optional niche: the gnolls there are level 18-22.",
					goals = {
						{ t = "collect", quest = 443, title = "Rot Hide Ichor", item = 3236, itemName = "Rot Hide Ichor", count = 8, oi = 1, map = 1421, x = 63.7, y = 22.9, f = "e", spots = { { x = 65.5, y = 23.9, r = 81, n = 26 }, { x = 65.7, y = 26.9, r = 51, n = 6 }, { x = 67.5, y = 24.6, r = 45, n = 6 }, { x = 67.6, y = 31.2, r = 15, n = 2 }, { x = 66.1, y = 33.9, r = 68, n = 4 }, { x = 68.8, y = 34, r = 33, n = 3 }, { x = 67.8, y = 35.7, r = 27, n = 2, alt = true }, { x = 69.8, y = 37.1, r = 15, n = 1, alt = true } } },
						{ t = "collect", item = 3317, itemName = "A Talking Head", map = 1421, x = 63.7, y = 22.9, f = "e", spots = { { x = 65.5, y = 23.9, r = 81, n = 26 }, { x = 65.7, y = 26.9, r = 51, n = 6 }, { x = 67.5, y = 24.6, r = 45, n = 6 }, { x = 67.6, y = 31.2, r = 15, n = 2 }, { x = 66.1, y = 33.9, r = 68, n = 4 }, { x = 68.8, y = 34, r = 33, n = 3 }, { x = 67.8, y = 35.7, r = 27, n = 2, alt = true }, { x = 69.8, y = 37.1, r = 15, n = 1, alt = true } }, optional = true, note = "A Talking Head: a rare drop from the gnolls" },
						{ t = "accept", quest = 460, title = "Resting in Pieces", item = 3317, itemName = "A Talking Head", minLevel = 12, qlvl = 17, optional = true },
						{ t = "turnin", quest = 460, title = "Resting in Pieces", object = 1599, objName = "Shallow Grave", map = 1421, x = 67.87, y = 24.85, f = "e", optional = true, note = "Shallow Grave, just east of the keep" },
						{ t = "accept", quest = 461, title = "The Hidden Niche", object = 1599, objName = "Shallow Grave", minLevel = 12, qlvl = 18, pre = { 460 }, preTitles = { [460] = "Resting in Pieces" }, map = 1421, x = 67.87, y = 24.85, f = "e", optional = true },
						{ t = "turnin", quest = 461, title = "The Hidden Niche", object = 112888, objName = "Dusty Shelf", map = 1421, x = 65.36, y = 24.81, f = "e", optional = true, note = "Dusty Shelf, inside the keep" },
					},
				},
				{
					title = "The Sepulcher",
					note = "Swim back and follow the road west to the Sepulcher.",
					goals = {
						{ t = "turnin", quest = 443, title = "Rot Hide Ichor", npc = 1937, npcName = "Apothecary Renferrel", map = 1421, x = 42.8, y = 40.86, f = "e", note = "Apothecary Renferrel" },
						{ t = "accept", quest = 95981, title = "Watching the Roads", npc = 2121, npcName = "Shadow Priest Allister", minLevel = 10, qlvl = 20, map = 1421, x = 43.98, y = 40.93, f = "e", note = "Shadow Priest Allister" },
						{ t = "accept", quest = 98298, title = "Arugal's Folly", npc = 1938, npcName = "Dalar Dawnweaver", minLevel = 9, qlvl = 16, map = 1421, x = 44.2, y = 39.81, f = "e", optional = true, note = "Dalar Dawnweaver: take it if he offers it; it may follow his Arugal's Folly series, which the route does not run" },
						{ t = "accept", quest = 98299, title = "Stop the Spread", npc = 1938, npcName = "Dalar Dawnweaver", minLevel = 9, qlvl = 20, map = 1421, x = 44.2, y = 39.81, f = "e" },
					},
				},
				{
					title = "Ambermill",
					note = "South-east down the road to Ambermill. Protectors guard the outskirts and Mages the town; both drop pendants. Wizards and Watchers patrol the roads around it. Stay out of the middle, where Archmage Ataeric stands.",
					goals = {
						{ t = "collect", quest = 479, title = "Ambermill Investigations", item = 3354, itemName = "Dalaran Pendant", count = 8, oi = 1, map = 1421, x = 54.85, y = 54.4, f = "e", spots = { { x = 55.7, y = 55, r = 45, n = 3 }, { x = 55.2, y = 60.8, r = 16, n = 2 }, { x = 58.7, y = 62.7, r = 65, n = 13 }, { x = 59.3, y = 66.1, r = 83, n = 14 }, { x = 62, y = 62.7, r = 60, n = 10 }, { x = 63.3, y = 65, r = 36, n = 5 }, { x = 56.5, y = 58.8, r = 15, n = 1, alt = true }, { x = 55.2, y = 67.8, r = 15, n = 1, alt = true }, { x = 62.3, y = 68.3, r = 48, n = 5, alt = true }, { x = 62.2, y = 71.8, r = 15, n = 1, alt = true } } },
						{ t = "kill", quest = 95981, title = "Watching the Roads", target = "Dalaran Wizard", npc = 1889, count = 8, oi = 1, map = 1421, x = 63.4, y = 57.11, f = "e", spots = { { x = 63.8, y = 58.3, r = 52, n = 8 }, { x = 65.4, y = 56.4, r = 40, n = 1 }, { x = 65.2, y = 52.3, r = 40, n = 1 }, { x = 65.6, y = 50, r = 40, n = 3 }, { x = 63.3, y = 65.4, r = 40, n = 2 }, { x = 64.1, y = 73.6, r = 53, n = 3 }, { x = 65.1, y = 76.4, r = 45, n = 4 }, { x = 66.3, y = 78.2, r = 40, n = 1 }, { x = 62.6, y = 76.3, r = 40, n = 2 }, { x = 57.6, y = 77.5, r = 40, n = 1 } }, spread = true },
						{ t = "kill", quest = 95981, title = "Watching the Roads", target = "Dalaran Watcher", npc = 1888, count = 8, oi = 2, map = 1421, x = 63.75, y = 57.07, f = "e", spots = { { x = 64.4, y = 56.9, r = 40, n = 4 }, { x = 65.7, y = 58.5, r = 40, n = 3 }, { x = 63.5, y = 59.5, r = 46, n = 4 }, { x = 64.6, y = 62.8, r = 40, n = 2 }, { x = 62.5, y = 73.9, r = 40, n = 2 }, { x = 62.8, y = 76.7, r = 40, n = 8 }, { x = 61.7, y = 79.9, r = 40, n = 2 }, { x = 59.4, y = 80.2, r = 40, n = 2 }, { x = 57.8, y = 78.2, r = 40, n = 2 }, { x = 56, y = 78, r = 40, n = 1 }, { x = 60.3, y = 75.8, r = 40, n = 4 } }, spread = true },
					},
				},
				{
					title = "Moonrage Bloodhowlers",
					note = "Only if Dalar gave you Arugal's Folly: the Bloodhowlers prowl the woods south-west of Ambermill, east of Pyrewood; they drop the Worgen Bits.",
					goals = {
						{ t = "collect", quest = 98298, title = "Arugal's Folly", item = 280375, itemName = "Worgen Bits", count = 6, oi = 1, map = 1421, x = 58.49, y = 42.33, f = "e", spots = { { x = 59.1, y = 41.5, r = 51, n = 4 }, { x = 51, y = 74.4, r = 56, n = 4 }, { x = 49, y = 77.2, r = 75, n = 5 }, { x = 50.8, y = 79.7, r = 47, n = 3 }, { x = 54.1, y = 81.9, r = 45, n = 2 }, { x = 52.5, y = 85.5, r = 47, n = 3 }, { x = 47.6, y = 82.4, r = 44, n = 2 }, { x = 46.1, y = 79, r = 68, n = 5 }, { x = 54, y = 76.9, r = 57, n = 3 } }, spread = true, optional = true },
					},
				},
				{
					title = "The refugees",
					note = "The Sickly and Haggard Refugees shamble along the road south of Pyrewood toward the Greymane Wall.",
					goals = {
						{ t = "kill", quest = 98299, title = "Stop the Spread", target = "Sickly Refugee", npc = 2054, count = 5, oi = 1, map = 1421, x = 44.98, y = 82.79, f = "e", spots = { { x = 44.7, y = 83.9, r = 34, n = 4 }, { x = 46.4, y = 85.9, r = 36, n = 7 } } },
						{ t = "kill", quest = 98299, title = "Stop the Spread", target = "Haggard Refugee", npc = 2053, count = 5, oi = 2, map = 1421, x = 44.33, y = 84.41, f = "e", spots = { { x = 45.7, y = 85.3, r = 63, n = 7 }, { x = 47.2, y = 86, r = 21, n = 3 } } },
					},
				},
				{
					title = "Hearth to the Sepulcher",
					goals = {
						{ t = "hearth", location = "The Sepulcher" },
						{ t = "turnin", quest = 479, title = "Ambermill Investigations", npc = 2121, npcName = "Shadow Priest Allister", map = 1421, x = 43.98, y = 40.93, f = "e", note = "Shadow Priest Allister" },
						{ t = "turnin", quest = 95981, title = "Watching the Roads", npc = 2121, npcName = "Shadow Priest Allister", map = 1421, x = 43.98, y = 40.93, f = "e" },
						{ t = "turnin", quest = 98298, title = "Arugal's Folly", npc = 1938, npcName = "Dalar Dawnweaver", map = 1421, x = 44.2, y = 39.81, f = "e", optional = true, note = "Dalar Dawnweaver" },
						{ t = "turnin", quest = 98299, title = "Stop the Spread", npc = 1938, npcName = "Dalar Dawnweaver", map = 1421, x = 44.2, y = 39.81, f = "e" },
					},
				},
				{
					title = "Lordamere Lake shore",
					note = "The Vile Fin Lakestalkers and Oracles sit on the lake shore south of the Decrepit Ferry, east of the Sepulcher.",
					goals = {
						{ t = "goto", text = "Lordamere Lake shore", map = 1421, x = 66, y = 44, f = "e" },
						{ t = "level", level = 19, note = "grind on Vile Fin Lakestalker at Lordamere Lake, Silverpine Forest" },
					},
				},
				{
					title = "Apothecary Renferrel",
					goals = {
						{ t = "accept", quest = 493, title = "Journey to Hillsbrad Foothills", npc = 1937, npcName = "Apothecary Renferrel", minLevel = 19, qlvl = 20, map = 1421, x = 42.8, y = 40.86, f = "e", note = "Keep it: Apothecary Lydon in Tarren Mill, a later guide" },
					},
				},
				{
					title = "Zeppelin to Orgrimmar",
					note = "Follow the road north out of Silverpine into Tirisfal Glades and east to the zeppelin towers outside the Ruins of Lordaeron. Take the zeppelin to Orgrimmar.",
					goals = {
						{ t = "goto", text = "Zeppelin tower", map = 1420, x = 60.7, y = 58.9, f = "e" },
					},
				},
				{
					title = "Valley of Strength",
					note = "Walk in through the main gate. Thatog stands in the Valley of Strength; Borstan's Firepit is a few steps north.",
					goals = {
						{ t = "accept", quest = 97246, title = "Meal Appeal", npc = 268701, npcName = "Thatog", minLevel = 5, qlvl = 15, map = 1454, x = 55.76, y = 72.29, f = "e", spots = { { x = 55.8, y = 72.3, r = 15, n = 2 } }, note = "Thatog" },
						{ t = "turnin", quest = 97246, title = "Meal Appeal", npc = 3368, npcName = "Borstan", map = 1454, x = 57.2, y = 53.32, f = "e", note = "Borstan" },
						{ t = "accept", quest = 97249, title = "Favorite Food", npc = 3368, npcName = "Borstan", minLevel = 5, qlvl = 15, map = 1454, x = 57.2, y = 53.32, f = "e" },
					},
				},
				{
					title = "Cleft of Shadow",
					note = "The Cleft of Shadow is the canyon under the Valley of Strength; Neeru Fireblade stands at its far end.",
					goals = {
						{ t = "turnin", quest = 832, title = "Burning Shadows", npc = 3216, npcName = "Neeru Fireblade", map = 1454, x = 49.47, y = 50.59, f = "e", note = "Neeru Fireblade" },
					},
				},
				{
					title = "The Drag",
					note = "Kor'geld and Yelmak run the alchemy shop in the Drag; Whuut is next door.",
					goals = {
						{ t = "accept", quest = 97242, title = "Yelmak's Medley", npc = 3348, npcName = "Kor'geld", minLevel = 9, qlvl = 15, map = 1454, x = 56.05, y = 34.12, f = "e", note = "Kor'geld" },
						{ t = "accept", quest = 97275, title = "Whuut's the Rush", npc = 3347, npcName = "Yelmak", minLevel = 9, qlvl = 15, map = 1454, x = 56.84, y = 33.03, f = "e", note = "Yelmak" },
						{ t = "turnin", quest = 97275, title = "Whuut's the Rush", npc = 11046, npcName = "Whuut", map = 1454, x = 55.79, y = 32.9, f = "e", note = "Whuut" },
					},
				},
				{
					title = "Valley of Honor",
					note = "The cattails and speargrass grow along the water in the Valley of Honor, east of the Drag.",
					goals = {
						{ t = "collect", quest = 97242, title = "Yelmak's Medley", item = 277278, itemName = "Handful of Cattails", oi = 1, map = 1454, x = 66.1, y = 28.9, f = "e", spots = { { x = 69.5, y = 31, r = 52, n = 17 } } },
						{ t = "collect", quest = 97242, title = "Yelmak's Medley", item = 277279, itemName = "Speargrass Cuttings", oi = 2, map = 1454, x = 66.2, y = 28.8, f = "e", spots = { { x = 69.3, y = 30.6, r = 68, n = 18 } } },
					},
				},
				{
					title = "Kor'geld",
					goals = {
						{ t = "turnin", quest = 97242, title = "Yelmak's Medley", npc = 3348, npcName = "Kor'geld", map = 1454, x = 56.05, y = 34.12, f = "e" },
					},
				},
				{
					title = "Valley of Wisdom",
					note = "Thra and Migi sit behind Grommash Hold in the Valley of Wisdom; the Smooth Boulders lie around them. Train while you are in the city. The next guide starts at Doras, the wind rider master in the Valley of Strength.",
					goals = {
						{ t = "accept", quest = 97326, title = "Rocks to Rests", npc = 268684, npcName = "Thra", minLevel = 5, qlvl = 15, map = 1454, x = 39.05, y = 28.96, f = "e", spots = { { x = 37.3, y = 28.7, r = 35, n = 9 } }, note = "Thra" },
						{ t = "collect", quest = 97326, title = "Rocks to Rests", item = 277952, itemName = "Smooth Boulder", count = 8, oi = 1, map = 1454, x = 39.2, y = 28.3, f = "e", spots = { { x = 42, y = 31.1, r = 65, n = 38 }, { x = 45.8, y = 38.1, r = 52, n = 27 } } },
						{ t = "turnin", quest = 97326, title = "Rocks to Rests", npc = 268684, npcName = "Thra", map = 1454, x = 39.05, y = 28.96, f = "e", spots = { { x = 37.3, y = 28.7, r = 35, n = 9 } } },
						{ t = "turnin", quest = 97249, title = "Favorite Food", npc = 268682, npcName = "Migi", map = 1454, x = 36.77, y = 29.08, f = "e", spots = { { x = 36.6, y = 29, r = 15, n = 2 } }, note = "Migi" },
						{ t = "turnin", quest = 95350, title = "Welcome to Azeroth", npc = 4949, npcName = "Thrall", map = 1454, x = 31.73, y = 37.82, f = "e", only = { races = { "Skyborne" } }, note = "Thrall, inside Grommash Hold" },
						{ t = "accept", quest = 98024, title = "Journey to the Crossroads", npc = 4949, npcName = "Thrall", minLevel = 7, qlvl = 13, pre = { 95350 }, preTitles = { [95350] = "Welcome to Azeroth" }, map = 1454, x = 31.73, y = 37.82, f = "e", only = { races = { "Skyborne" } }, note = "Keep it: Thork at the Crossroads" },
						{ t = "train", class = true, candidates = { { npc = 13417, npcName = "Sagorne Creststrider", map = 1454, x = 38.66, y = 35.92, f = "e", faction = "H", classes = { "SHAMAN" } }, { npc = 3327, npcName = "Gest", map = 1454, x = 42.69, y = 51.48, f = "e", faction = "H", classes = { "ROGUE" } }, { npc = 3324, npcName = "Grol'dar", map = 1454, x = 47.98, y = 45.93, f = "e", faction = "H", classes = { "WARLOCK" } }, { npc = 5882, npcName = "Pephredo", map = 1454, x = 38.35, y = 85.56, f = "e", faction = "H", classes = { "MAGE" } }, { npc = 6018, npcName = "Ur'kyo", map = 1454, x = 35.59, y = 87.82, f = "e", faction = "H", classes = { "PRIEST" } }, { npc = 3352, npcName = "Ormak Grimshot", map = 1454, x = 66.05, y = 18.53, f = "e", faction = "H", classes = { "HUNTER" } }, { npc = 3354, npcName = "Sorek", map = 1454, x = 80.39, y = 32.38, f = "e", faction = "H", classes = { "WARRIOR" } }, { npc = 3172, npcName = "Dhugru Gorelust", map = 1411, x = 54.38, y = 41.2, f = "e", faction = "H", classes = { "WARLOCK" } }, { npc = 3171, npcName = "Thotar", map = 1411, x = 51.85, y = 43.49, f = "e", faction = "H", classes = { "HUNTER" } }, { npc = 3170, npcName = "Kaplak", map = 1411, x = 51.98, y = 43.69, f = "e", faction = "H", classes = { "ROGUE" } }, { npc = 3169, npcName = "Tarshaw Jaggedscar", map = 1411, x = 54.19, y = 42.47, f = "e", faction = "H", classes = { "WARRIOR" } }, { npc = 3173, npcName = "Swart", map = 1411, x = 54.42, y = 42.59, f = "e", faction = "H", classes = { "SHAMAN" } }, { npc = 3706, npcName = "Tai'jin", map = 1411, x = 54.26, y = 42.93, f = "e", faction = "H", classes = { "PRIEST" } }, { npc = 3155, npcName = "Rwag", map = 1411, x = 41.28, y = 68, f = "e", faction = "H", classes = { "ROGUE" } }, { npc = 3156, npcName = "Nartok", map = 1411, x = 40.65, y = 68.52, f = "e", faction = "H", classes = { "WARLOCK" } }, { npc = 3707, npcName = "Ken'jai", map = 1411, x = 42.36, y = 68.81, f = "e", faction = "H", classes = { "PRIEST" } }, { npc = 3157, npcName = "Shikrik", map = 1411, x = 42.39, y = 69, f = "e", faction = "H", classes = { "SHAMAN" } }, { npc = 5884, npcName = "Mai'ah", map = 1411, x = 42.51, y = 69.04, f = "e", faction = "H", classes = { "MAGE" } }, { npc = 3154, npcName = "Jen'shan", map = 1411, x = 42.84, y = 69.33, f = "e", faction = "H", classes = { "HUNTER" } }, { npc = 3153, npcName = "Frang", map = 1411, x = 42.89, y = 69.44, f = "e", faction = "H", classes = { "WARRIOR" } }, { npc = 5880, npcName = "Un'Thuwa", map = 1411, x = 56.31, y = 75.11, f = "e", faction = "H", classes = { "MAGE" } }, { npc = 3034, npcName = "Sheal Runetotem", map = 1456, x = 77.14, y = 27.02, f = "e", faction = "H", classes = { "DRUID" } }, { npc = 3048, npcName = "Ursyn Ghull", map = 1456, x = 25.7, y = 14.19, f = "e", faction = "H", classes = { "MAGE" } }, { npc = 246344, npcName = "Alodan the Hopeful", map = 1456, x = 25.6, y = 14.8, f = "e", faction = "H", classes = { "PALADIN" } }, { npc = 3044, npcName = "Miles Welsh", map = 1456, x = 25.32, y = 15.27, f = "e", faction = "H", classes = { "PRIEST" } }, { npc = 3040, npcName = "Urek Thunderhorn", map = 1456, x = 59.13, y = 86.87, f = "e", faction = "H", classes = { "HUNTER" } }, { npc = 3043, npcName = "Ker Ragetotem", map = 1456, x = 57.58, y = 85.5, f = "e", faction = "H", classes = { "WARRIOR" } }, { npc = 3031, npcName = "Tigor Skychaser", map = 1456, x = 23.64, y = 18.79, f = "e", faction = "H", classes = { "SHAMAN" } }, { npc = 3065, npcName = "Yaw Sharpmane", map = 1412, x = 46.93, y = 59.65, faction = "H", classes = { "HUNTER" } }, { npc = 3063, npcName = "Krang Stonehoof", map = 1412, x = 48.35, y = 63.74, faction = "H", classes = { "WARRIOR" } }, { npc = 3066, npcName = "Narm Skychaser", map = 1412, x = 47.4, y = 62.54, faction = "H", classes = { "SHAMAN" } }, { npc = 3064, npcName = "Gennia Runetotem", map = 1412, x = 47.48, y = 62.95, faction = "H", classes = { "DRUID" } }, { npc = 3060, npcName = "Gart Mistrunner", map = 1412, x = 44.65, y = 76.55, faction = "H", classes = { "DRUID" } }, { npc = 3062, npcName = "Meela Dawnstrider", map = 1412, x = 44.58, y = 76.56, faction = "H", classes = { "SHAMAN" } }, { npc = 3061, npcName = "Lanka Farshot", map = 1412, x = 43.96, y = 76.35, faction = "H", classes = { "HUNTER" } }, { npc = 3059, npcName = "Harutt Thunderhorn", map = 1412, x = 43.75, y = 76.72, faction = "H", classes = { "WARRIOR" } }, { npc = 2119, npcName = "Dannal Stern", map = 1420, x = 32.69, y = 65.56, f = "e", faction = "H", classes = { "WARRIOR" } }, { npc = 2122, npcName = "David Trias", map = 1420, x = 32.53, y = 65.65, f = "e", faction = "H", classes = { "ROGUE" } }, { npc = 2123, npcName = "Dark Cleric Duesten", map = 1420, x = 31.11, y = 66.03, f = "e", faction = "H", classes = { "PRIEST" } }, { npc = 2124, npcName = "Isabella", map = 1420, x = 30.93, y = 66.06, f = "e", faction = "H", classes = { "MAGE" } }, { npc = 2126, npcName = "Maximillion", map = 1420, x = 30.91, y = 66.34, f = "e", faction = "H", classes = { "WARLOCK" } }, { npc = 2127, npcName = "Rupert Boch", map = 1420, x = 61.59, y = 52.4, f = "e", faction = "H", classes = { "WARLOCK" } }, { npc = 2128, npcName = "Cain Firesong", map = 1420, x = 61.97, y = 52.47, f = "e", faction = "H", classes = { "MAGE" } }, { npc = 2129, npcName = "Dark Cleric Beryl", map = 1420, x = 61.57, y = 52.19, f = "e", faction = "H", classes = { "PRIEST" } }, { npc = 2130, npcName = "Marion Call", map = 1420, x = 61.75, y = 52, f = "e", faction = "H", classes = { "ROGUE" } }, { npc = 2131, npcName = "Austil de Mon", map = 1420, x = 61.85, y = 52.54, f = "e", faction = "H", classes = { "WARRIOR" } }, { npc = 244808, npcName = "Aramis Hammerhand", map = 1420, x = 31.09, y = 66.32, f = "e", faction = "H", classes = { "PALADIN" } }, { npc = 246152, npcName = "Shari Stilwell", map = 1420, x = 60.25, y = 52.63, f = "e", faction = "H", classes = { "PALADIN" } }, { npc = 246389, npcName = "Hilda the Breaker", map = 1420, x = 21.92, y = 47.19, f = "e", faction = "H", classes = { "PALADIN" } }, { npc = 4563, npcName = "Kaal Soulreaper", map = 1458, x = 86.21, y = 15.93, f = "e", faction = "H", classes = { "WARLOCK" } }, { npc = 4566, npcName = "Kaelystia Hatebringer", map = 1458, x = 85.02, y = 14.02, f = "e", faction = "H", classes = { "MAGE" } }, { npc = 4582, npcName = "Carolyn Ward", map = 1458, x = 83.86, y = 72.07, f = "e", faction = "H", classes = { "ROGUE" } }, { npc = 4593, npcName = "Christoph Walker", map = 1458, x = 46.93, y = 15.23, f = "e", faction = "H", classes = { "WARRIOR" } }, { npc = 4606, npcName = "Aelthalyste", map = 1458, x = 49.26, y = 17.12, f = "e", faction = "H", classes = { "PRIEST" } }, { npc = 260093, npcName = "Garen Largo", map = 1458, x = 47.49, y = 15.23, f = "e", faction = "H", classes = { "PALADIN" } }, { npc = 251373, npcName = "Xyton Silverwind", map = 2521, x = 41.72, y = 23.38, faction = "AH", classes = { "DRUID" } }, { npc = 251374, npcName = "Windshaper Boro", map = 2521, x = 42.76, y = 23.58, faction = "H", classes = { "SHAMAN" } }, { npc = 251376, npcName = "Tai'ree Farsight", map = 2521, x = 42.44, y = 23.68, faction = "AH", classes = { "HUNTER" } }, { npc = 251389, npcName = "Akeri Duskblade", map = 2521, x = 43.71, y = 24.3, faction = "AH", classes = { "ROGUE" } }, { npc = 251964, npcName = "Blademaster Ren", map = 2521, x = 43.68, y = 24.17, faction = "AH", classes = { "WARRIOR" } } } },
					},
				},
			},
		})
	end
	register()
end

-- Source: forever/horde/04-the-barrens.guide
do
	local function register()
		Polestar.RegisterGuide({
			id = "forever/horde/04-the-barrens",
			pack = "guides",
			title = "The Barrens",
			faction = "Horde",
			minLevel = 19,
			maxLevel = 24,
			category = "Leveling",
			zone = 1413,
			zoneName = "The Barrens",
			next = "forever/horde/05-stonetalon-mountains",
			author = "Polestar",
			version = 1,
			steps = {
				{
					title = "Fly to Ratchet",
					note = "Doras, the wind rider master, stands on the tower in the Valley of Strength.",
					goals = {
						{ t = "fly", location = "Ratchet" },
					},
				},
				{
					title = "Ratchet",
					goals = {
						{ t = "accept", quest = 865, title = "Raptor Horns", npc = 3446, npcName = "Mebok Mizzyrix", minLevel = 13, qlvl = 18, map = 1413, x = 62.37, y = 37.62, f = "e", note = "Mebok Mizzyrix" },
						{ t = "accept", quest = 895, title = "WANTED: Baron Longshore", object = 3972, objName = "WANTED", minLevel = 11, qlvl = 16, map = 1413, x = 62.59, y = 37.47, f = "e", note = "WANTED poster" },
						{ t = "accept", quest = 92706, title = "WANTED: Bruuz", object = 3972, objName = "WANTED", minLevel = 15, qlvl = 20, map = 1413, x = 62.59, y = 37.47, f = "e", optional = true, note = "WANTED poster" },
						{ t = "accept", quest = 891, title = "The Guns of Northwatch", npc = 3339, npcName = "Captain Thalo'thas Brightsun", minLevel = 13, qlvl = 20, map = 1413, x = 62.29, y = 39.03, f = "e", note = "Captain Thalo'thas Brightsun" },
						{ t = "accept", quest = 896, title = "Miner's Fortune", npc = 3453, npcName = "Wharfmaster Dizzywig", minLevel = 13, qlvl = 18, map = 1413, x = 63.35, y = 38.45, f = "e", note = "Wharfmaster Dizzywig" },
						{ t = "accept", quest = 1483, title = "Ziz Fizziks", npc = 3442, npcName = "Sputtervalve", minLevel = 16, qlvl = 21, closedBy = { 1093 }, preTitles = { [1093] = "Super Reaper 6000" }, map = 1413, x = 62.98, y = 37.22, f = "e", note = "Sputtervalve. Keep it: Ziz Fizziks is in Stonetalon, later" },
					},
				},
				{
					title = "Bruuz",
					note = "Bruuz swims in the harbour just off Ratchet's docks. Bruuz is elite: grouping up is advised.",
					goals = {
						{ t = "collect", quest = 92706, title = "WANTED: Bruuz", item = 253710, itemName = "Bruuz's Dorsal Fin", oi = 1, map = 1413, x = 63.7, y = 38.7, f = "e", optional = true },
					},
				},
				{
					title = "Baron Longshore",
					note = "The pirates camp on the beach south of Ratchet; Baron Longshore stands at its southern end.",
					goals = {
						{ t = "collect", quest = 895, title = "WANTED: Baron Longshore", item = 5084, itemName = "Baron Longshore's Head", oi = 1, map = 1413, x = 64.22, y = 47.13, f = "e", spots = { { x = 64.2, y = 47.1, r = 15, n = 1 }, { x = 63.3, y = 49, r = 15, n = 1 }, { x = 62.6, y = 49.8, r = 15, n = 1 } } },
					},
				},
				{
					title = "Northwatch Hold",
					note = "Northwatch Hold, on the coast further south. The Theramore Marines and Preservers (15-16) drop the medals; Captain Fairmount (20) and the two cannoneers (19) stand in the keep and on its walls, and they are why the hold waits until now.",
					goals = {
						{ t = "collect", quest = 891, title = "The Guns of Northwatch", item = 5078, itemName = "Theramore Medal", count = 10, oi = 1, map = 1413, x = 62.01, y = 51.66, f = "e", spots = { { x = 62.1, y = 52.2, r = 55, n = 5 }, { x = 61.4, y = 53.5, r = 40, n = 8 }, { x = 62.2, y = 53.7, r = 39, n = 4 }, { x = 60.7, y = 52.3, r = 52, n = 4 }, { x = 61.7, y = 55.1, r = 65, n = 11 }, { x = 60.5, y = 54.9, r = 63, n = 9 }, { x = 62.7, y = 56.6, r = 56, n = 7, alt = true } } },
						{ t = "kill", quest = 891, title = "The Guns of Northwatch", target = "Captain Fairmount", npc = 3393, oi = 2, map = 1413, x = 61.85, y = 54.65, f = "e" },
						{ t = "kill", quest = 891, title = "The Guns of Northwatch", target = "Cannoneer Whessan", npc = 3455, oi = 3, map = 1413, x = 60.43, y = 54.77, f = "e" },
						{ t = "kill", quest = 891, title = "The Guns of Northwatch", target = "Cannoneer Smythe", npc = 3454, oi = 4, map = 1413, x = 63.18, y = 56.64, f = "e" },
					},
				},
				{
					title = "Free From the Hold",
					note = "Gilthares Firebough is chained inside the hold. Talk to him to start the escort and stay close: Theramore soldiers attack on the way out. He walks you back to Ratchet.",
					goals = {
						{ t = "accept", quest = 898, title = "Free From the Hold", npc = 3465, npcName = "Gilthares Firebough", minLevel = 13, qlvl = 20, map = 1413, x = 61.96, y = 54.96, f = "e" },
						{ t = "complete", quest = 898, title = "Free From the Hold" },
					},
				},
				{
					title = "Ratchet",
					goals = {
						{ t = "turnin", quest = 898, title = "Free From the Hold", npc = 3339, npcName = "Captain Thalo'thas Brightsun", map = 1413, x = 62.29, y = 39.03, f = "e", note = "Captain Thalo'thas Brightsun" },
						{ t = "turnin", quest = 891, title = "The Guns of Northwatch", npc = 3339, npcName = "Captain Thalo'thas Brightsun", map = 1413, x = 62.29, y = 39.03, f = "e" },
						{ t = "turnin", quest = 895, title = "WANTED: Baron Longshore", npc = 3391, npcName = "Gazlowe", map = 1413, x = 62.68, y = 36.23, f = "e", note = "Gazlowe" },
						{ t = "turnin", quest = 92706, title = "WANTED: Bruuz", npc = 3391, npcName = "Gazlowe", map = 1413, x = 62.68, y = 36.23, f = "e", optional = true },
					},
				},
				{
					title = "Raptor Horns",
					note = "Sunscale Scytheclaws hunt the plains south of the Crossroads, around the Raptor Grounds; they drop the horns. Hand them in on your next pass through Ratchet.",
					goals = {
						{ t = "collect", quest = 865, title = "Raptor Horns", item = 5055, itemName = "Intact Raptor Horn", count = 5, oi = 1, map = 1413, x = 61.23, y = 34.04, f = "e", spots = { { x = 61, y = 33.7, r = 70, n = 2 }, { x = 60.6, y = 50.2, r = 70, n = 2 }, { x = 57.3, y = 53.5, r = 112, n = 7 }, { x = 54.3, y = 49.4, r = 70, n = 1 }, { x = 48.9, y = 49.9, r = 102, n = 4 }, { x = 44.5, y = 43.8, r = 77, n = 5 }, { x = 36.2, y = 28.8, r = 70, n = 1 }, { x = 39.3, y = 25.7, r = 70, n = 1 }, { x = 45.7, y = 14.8, r = 106, n = 4 }, { x = 56.2, y = 5.1, r = 70, n = 2 }, { x = 60.1, y = 8.4, r = 70, n = 3 }, { x = 60.8, y = 12.7, r = 70, n = 1 }, { x = 60.6, y = 31.4, r = 74, n = 4, alt = true }, { x = 56.7, y = 48.2, r = 70, n = 2, alt = true }, { x = 58.3, y = 50, r = 70, n = 1, alt = true }, { x = 52.4, y = 46.3, r = 70, n = 2, alt = true }, { x = 55.7, y = 51.3, r = 70, n = 2, alt = true }, { x = 52.3, y = 48.5, r = 76, n = 3, alt = true }, { x = 50.2, y = 46.2, r = 70, n = 3, alt = true }, { x = 53, y = 51.2, r = 70, n = 1, alt = true }, { x = 51.1, y = 51.3, r = 70, n = 2, alt = true }, { x = 48.1, y = 46.7, r = 71, n = 3, alt = true }, { x = 46.8, y = 43.6, r = 103, n = 4, alt = true }, { x = 58.6, y = 7, r = 112, n = 6, alt = true }, { x = 48, y = 12.1, r = 70, n = 2, alt = true }, { x = 43.6, y = 15.6, r = 107, n = 5, alt = true }, { x = 37.2, y = 26.9, r = 70, n = 3, alt = true } }, spread = true },
					},
				},
				{
					title = "The Crossroads",
					goals = {
						{ t = "sethome", npc = 3934, npcName = "Innkeeper Boorand Plainswind", location = "The Crossroads", map = 1413, x = 51.99, y = 29.89, f = "e", note = "Innkeeper Boorand Plainswind" },
						{ t = "accept", quest = 899, title = "Consumed by Hatred", npc = 3432, npcName = "Mankrik", minLevel = 14, qlvl = 20, map = 1413, x = 51.95, y = 31.58, f = "e", note = "Mankrik" },
						{ t = "accept", quest = 4921, title = "Lost in Battle", npc = 3432, npcName = "Mankrik", minLevel = 14, qlvl = 20, map = 1413, x = 51.95, y = 31.58, f = "e" },
						{ t = "accept", quest = 95774, title = "Her Name Is Olgra", npc = 3432, npcName = "Mankrik", minLevel = 14, qlvl = 20, map = 1413, x = 51.95, y = 31.58, f = "e" },
						{ t = "accept", quest = 3261, title = "Jorn Skyseer", npc = 3338, npcName = "Sergra Darkthorn", minLevel = 10, qlvl = 18, pre = { 905 }, preTitles = { [905] = "The Angry Scytheclaws" }, map = 1413, x = 52.23, y = 31.01, f = "e", note = "Sergra Darkthorn" },
						{ t = "accept", quest = 3281, title = "Stolen Silver", npc = 3464, npcName = "Gazrog", minLevel = 9, qlvl = 18, pre = { 869 }, preTitles = { [869] = "Raptor Thieves" }, map = 1413, x = 51.93, y = 30.32, f = "e", note = "Gazrog" },
						{ t = "accept", quest = 876, title = "Serena Bloodfeather", npc = 3449, npcName = "Darsok Swiftdagger", minLevel = 12, qlvl = 20, pre = { 875 }, preTitles = { [875] = "Harpy Lieutenants" }, map = 1413, x = 51.62, y = 30.9, f = "e", note = "Darsok Swiftdagger" },
						{ t = "accept", quest = 6541, title = "Report to Kadrak", npc = 3429, npcName = "Thork", minLevel = 17, qlvl = 19, closedBy = { 6543, 6542 }, preTitles = { [6542] = "Report to Kadrak", [6543] = "The Warsong Reports" }, map = 1413, x = 51.5, y = 30.87, f = "e", note = "Thork. Keep it: Kadrak at the Mor'shan Rampart, next guide" },
						{ t = "accept", quest = 868, title = "Egg Hunt", npc = 3428, npcName = "Korran", minLevel = 17, qlvl = 22, map = 1413, x = 51.07, y = 29.63, f = "e", note = "Korran: the eggs are in the Field of Giants, later" },
						{ t = "turnin", quest = 98024, title = "Journey to the Crossroads", npc = 3429, npcName = "Thork", map = 1413, x = 51.5, y = 30.87, f = "e", only = { races = { "Skyborne" } }, note = "Thork, at the top of the tower" },
					},
				},
				{
					title = "Level 20",
					note = "The level-20 class quests in Orgrimmar (Sorek, Searn Firewarder, the Warlock and Rogue trainers) are only offered from level 20, so finish the level here before you fly. The Thunderhawk Hatchlings (18) on the plains south-west of the Crossroads and the Kolkar (14-15) at the Stagnant Oasis are the nearest mobs worth killing; you need well under a level.",
					goals = {
						{ t = "level", level = 20, note = "grind on Thunderhawk Hatchlings south-west of the Crossroads" },
					},
				},
				{
					title = "Orgrimmar",
					note = "Fly to Orgrimmar to train your level 20 ranks (Druids train in Thunder Bluff instead). Sorek is in the Valley of Honor, Searn Firewarder in the Valley of Wisdom.",
					goals = {
						{ t = "fly", location = "Orgrimmar" },
						{ t = "train", class = true, candidates = { { npc = 3156, npcName = "Nartok", map = 1411, x = 40.65, y = 68.52, f = "e", faction = "H", classes = { "WARLOCK" } }, { npc = 3155, npcName = "Rwag", map = 1411, x = 41.28, y = 68, f = "e", faction = "H", classes = { "ROGUE" } }, { npc = 3707, npcName = "Ken'jai", map = 1411, x = 42.36, y = 68.81, f = "e", faction = "H", classes = { "PRIEST" } }, { npc = 3157, npcName = "Shikrik", map = 1411, x = 42.39, y = 69, f = "e", faction = "H", classes = { "SHAMAN" } }, { npc = 5884, npcName = "Mai'ah", map = 1411, x = 42.51, y = 69.04, f = "e", faction = "H", classes = { "MAGE" } }, { npc = 3154, npcName = "Jen'shan", map = 1411, x = 42.84, y = 69.33, f = "e", faction = "H", classes = { "HUNTER" } }, { npc = 3153, npcName = "Frang", map = 1411, x = 42.89, y = 69.44, f = "e", faction = "H", classes = { "WARRIOR" } }, { npc = 3171, npcName = "Thotar", map = 1411, x = 51.85, y = 43.49, f = "e", faction = "H", classes = { "HUNTER" } }, { npc = 3170, npcName = "Kaplak", map = 1411, x = 51.98, y = 43.69, f = "e", faction = "H", classes = { "ROGUE" } }, { npc = 3706, npcName = "Tai'jin", map = 1411, x = 54.26, y = 42.93, f = "e", faction = "H", classes = { "PRIEST" } }, { npc = 3169, npcName = "Tarshaw Jaggedscar", map = 1411, x = 54.19, y = 42.47, f = "e", faction = "H", classes = { "WARRIOR" } }, { npc = 5880, npcName = "Un'Thuwa", map = 1411, x = 56.31, y = 75.11, f = "e", faction = "H", classes = { "MAGE" } }, { npc = 3034, npcName = "Sheal Runetotem", map = 1456, x = 77.14, y = 27.02, f = "e", faction = "H", classes = { "DRUID" } }, { npc = 3173, npcName = "Swart", map = 1411, x = 54.42, y = 42.59, f = "e", faction = "H", classes = { "SHAMAN" } }, { npc = 3172, npcName = "Dhugru Gorelust", map = 1411, x = 54.38, y = 41.2, f = "e", faction = "H", classes = { "WARLOCK" } }, { npc = 6018, npcName = "Ur'kyo", map = 1454, x = 35.59, y = 87.82, f = "e", faction = "H", classes = { "PRIEST" } }, { npc = 5885, npcName = "Deino", map = 1454, x = 38.45, y = 86.13, f = "e", faction = "H", classes = { "MAGE" } }, { npc = 3040, npcName = "Urek Thunderhorn", map = 1456, x = 59.13, y = 86.87, f = "e", faction = "H", classes = { "HUNTER" } }, { npc = 3043, npcName = "Ker Ragetotem", map = 1456, x = 57.58, y = 85.5, f = "e", faction = "H", classes = { "WARRIOR" } }, { npc = 3401, npcName = "Shenthul", map = 1454, x = 43.05, y = 53.74, f = "e", faction = "H", classes = { "ROGUE" } }, { npc = 3048, npcName = "Ursyn Ghull", map = 1456, x = 25.7, y = 14.19, f = "e", faction = "H", classes = { "MAGE" } }, { npc = 246344, npcName = "Alodan the Hopeful", map = 1456, x = 25.6, y = 14.8, f = "e", faction = "H", classes = { "PALADIN" } }, { npc = 3044, npcName = "Miles Welsh", map = 1456, x = 25.32, y = 15.27, f = "e", faction = "H", classes = { "PRIEST" } }, { npc = 3065, npcName = "Yaw Sharpmane", map = 1412, x = 46.93, y = 59.65, faction = "H", classes = { "HUNTER" } }, { npc = 3344, npcName = "Kardris Dreamseeker", map = 1454, x = 38.8, y = 36.37, f = "e", faction = "H", classes = { "SHAMAN" } }, { npc = 3325, npcName = "Mirket", map = 1454, x = 48.62, y = 46.95, f = "e", faction = "H", classes = { "WARLOCK" } }, { npc = 3031, npcName = "Tigor Skychaser", map = 1456, x = 23.64, y = 18.79, f = "e", faction = "H", classes = { "SHAMAN" } }, { npc = 3063, npcName = "Krang Stonehoof", map = 1412, x = 48.35, y = 63.74, faction = "H", classes = { "WARRIOR" } }, { npc = 3066, npcName = "Narm Skychaser", map = 1412, x = 47.4, y = 62.54, faction = "H", classes = { "SHAMAN" } }, { npc = 3064, npcName = "Gennia Runetotem", map = 1412, x = 47.48, y = 62.95, faction = "H", classes = { "DRUID" } }, { npc = 3406, npcName = "Xor'juul", map = 1454, x = 67.24, y = 20.2, f = "e", faction = "H", classes = { "HUNTER" } }, { npc = 3354, npcName = "Sorek", map = 1454, x = 80.39, y = 32.38, f = "e", faction = "H", classes = { "WARRIOR" } }, { npc = 3060, npcName = "Gart Mistrunner", map = 1412, x = 44.65, y = 76.55, faction = "H", classes = { "DRUID" } }, { npc = 3062, npcName = "Meela Dawnstrider", map = 1412, x = 44.58, y = 76.56, faction = "H", classes = { "SHAMAN" } }, { npc = 3061, npcName = "Lanka Farshot", map = 1412, x = 43.96, y = 76.35, faction = "H", classes = { "HUNTER" } }, { npc = 3059, npcName = "Harutt Thunderhorn", map = 1412, x = 43.75, y = 76.72, faction = "H", classes = { "WARRIOR" } }, { npc = 2119, npcName = "Dannal Stern", map = 1420, x = 32.69, y = 65.56, f = "e", faction = "H", classes = { "WARRIOR" } }, { npc = 2122, npcName = "David Trias", map = 1420, x = 32.53, y = 65.65, f = "e", faction = "H", classes = { "ROGUE" } }, { npc = 2123, npcName = "Dark Cleric Duesten", map = 1420, x = 31.11, y = 66.03, f = "e", faction = "H", classes = { "PRIEST" } }, { npc = 2124, npcName = "Isabella", map = 1420, x = 30.93, y = 66.06, f = "e", faction = "H", classes = { "MAGE" } }, { npc = 2126, npcName = "Maximillion", map = 1420, x = 30.91, y = 66.34, f = "e", faction = "H", classes = { "WARLOCK" } }, { npc = 2127, npcName = "Rupert Boch", map = 1420, x = 61.59, y = 52.4, f = "e", faction = "H", classes = { "WARLOCK" } }, { npc = 2128, npcName = "Cain Firesong", map = 1420, x = 61.97, y = 52.47, f = "e", faction = "H", classes = { "MAGE" } }, { npc = 2129, npcName = "Dark Cleric Beryl", map = 1420, x = 61.57, y = 52.19, f = "e", faction = "H", classes = { "PRIEST" } }, { npc = 2130, npcName = "Marion Call", map = 1420, x = 61.75, y = 52, f = "e", faction = "H", classes = { "ROGUE" } }, { npc = 2131, npcName = "Austil de Mon", map = 1420, x = 61.85, y = 52.54, f = "e", faction = "H", classes = { "WARRIOR" } }, { npc = 244808, npcName = "Aramis Hammerhand", map = 1420, x = 31.09, y = 66.32, f = "e", faction = "H", classes = { "PALADIN" } }, { npc = 246152, npcName = "Shari Stilwell", map = 1420, x = 60.25, y = 52.63, f = "e", faction = "H", classes = { "PALADIN" } }, { npc = 246389, npcName = "Hilda the Breaker", map = 1420, x = 21.92, y = 47.19, f = "e", faction = "H", classes = { "PALADIN" } }, { npc = 4563, npcName = "Kaal Soulreaper", map = 1458, x = 86.21, y = 15.93, f = "e", faction = "H", classes = { "WARLOCK" } }, { npc = 4566, npcName = "Kaelystia Hatebringer", map = 1458, x = 85.02, y = 14.02, f = "e", faction = "H", classes = { "MAGE" } }, { npc = 4582, npcName = "Carolyn Ward", map = 1458, x = 83.86, y = 72.07, f = "e", faction = "H", classes = { "ROGUE" } }, { npc = 4593, npcName = "Christoph Walker", map = 1458, x = 46.93, y = 15.23, f = "e", faction = "H", classes = { "WARRIOR" } }, { npc = 4606, npcName = "Aelthalyste", map = 1458, x = 49.26, y = 17.12, f = "e", faction = "H", classes = { "PRIEST" } }, { npc = 260093, npcName = "Garen Largo", map = 1458, x = 47.49, y = 15.23, f = "e", faction = "H", classes = { "PALADIN" } }, { npc = 251373, npcName = "Xyton Silverwind", map = 2521, x = 41.72, y = 23.38, faction = "AH", classes = { "DRUID" } }, { npc = 251374, npcName = "Windshaper Boro", map = 2521, x = 42.76, y = 23.58, faction = "H", classes = { "SHAMAN" } }, { npc = 251376, npcName = "Tai'ree Farsight", map = 2521, x = 42.44, y = 23.68, faction = "AH", classes = { "HUNTER" } }, { npc = 251389, npcName = "Akeri Duskblade", map = 2521, x = 43.71, y = 24.3, faction = "AH", classes = { "ROGUE" } }, { npc = 251964, npcName = "Blademaster Ren", map = 2521, x = 43.68, y = 24.17, faction = "AH", classes = { "WARRIOR" } } } },
						{ t = "accept", quest = 1823, title = "Speak with Ruga", npc = 3354, npcName = "Sorek", minLevel = 20, qlvl = 20, closedBy = { 1824 }, preTitles = { [1824] = "Trial at the Field of Giants" }, map = 1454, x = 80.39, y = 32.38, f = "e", only = { classes = { "WARRIOR" } }, note = "Sorek" },
						{ t = "accept", quest = 1528, title = "Call of Water", npc = 5892, npcName = "Searn Firewarder", minLevel = 20, qlvl = 20, closedBy = { 1530, 1529, 2985, 2986 }, preTitles = { [1529] = "Call of Water", [1530] = "Call of Water", [2985] = "Call of Water", [2986] = "Call of Water" }, map = 1454, x = 37.96, y = 37.73, f = "e", only = { classes = { "SHAMAN" } }, note = "Searn Firewarder" },
					},
				},
				{
					title = "Gan'rul Bloodeye",
					note = "The Cleft of Shadow is the canyon under the Valley of Strength.",
					only = { classes = { "WARLOCK" } },
					goals = {
						{ t = "accept", quest = 1507, title = "Devourer of Souls", npc = 5875, npcName = "Gan'rul Bloodeye", minLevel = 20, closedBy = { 1472 }, preTitles = { [1472] = "Devourer of Souls" }, map = 1454, x = 48.25, y = 45.28, f = "e", note = "Gan'rul Bloodeye" },
						{ t = "turnin", quest = 1507, title = "Devourer of Souls", npc = 5909, npcName = "Cazul", map = 1454, x = 47.06, y = 46.43, f = "e", note = "Cazul, a few steps away" },
						{ t = "accept", quest = 1508, title = "Blind Cazul", npc = 5909, npcName = "Cazul", minLevel = 20, pre = { 1507 }, closedBy = { 1472 }, preTitles = { [1472] = "Devourer of Souls", [1507] = "Devourer of Souls" }, map = 1454, x = 47.06, y = 46.43, f = "e" },
						{ t = "turnin", quest = 1508, title = "Blind Cazul", npc = 5910, npcName = "Zankaja", map = 1454, x = 37.04, y = 59.45, f = "e", note = "Zankaja, Valley of Strength" },
						{ t = "accept", quest = 1509, title = "News of Dogran", npc = 5910, npcName = "Zankaja", minLevel = 20, qlvl = 20, pre = { 1508 }, closedBy = { 1472 }, preTitles = { [1472] = "Devourer of Souls", [1508] = "Blind Cazul" }, map = 1454, x = 37.04, y = 59.45, f = "e" },
					},
				},
				{
					title = "Shenthul",
					note = "Shenthul stands in the Cleft of Shadow. Target him and type /salute to finish The Shattered Salute.",
					only = { classes = { "ROGUE" } },
					goals = {
						{ t = "accept", quest = 2460, title = "The Shattered Salute", npc = 3401, npcName = "Shenthul", minLevel = 20, qlvl = 20, map = 1454, x = 43.05, y = 53.74, f = "e" },
						{ t = "complete", quest = 2460, title = "The Shattered Salute" },
						{ t = "turnin", quest = 2460, title = "The Shattered Salute", npc = 3401, npcName = "Shenthul", map = 1454, x = 43.05, y = 53.74, f = "e" },
						{ t = "accept", quest = 2458, title = "Deep Cover", npc = 3401, npcName = "Shenthul", minLevel = 20, qlvl = 20, pre = { 2460 }, preTitles = { [2460] = "The Shattered Salute" }, map = 1454, x = 43.05, y = 53.74, f = "e", note = "Deep Cover: Taskmaster Fizzule, by the Sludge Fen" },
					},
				},
				{
					title = "Ur'kyo",
					note = "Ur'kyo stands in the Valley of Spirits, on the city's west side.",
					only = { classes = { "PRIEST" } },
					goals = {
						{ t = "accept", quest = 5680, title = "Shadowguard", npc = 6018, npcName = "Ur'kyo", minLevel = 20, qlvl = 20, closedBy = { 5642, 5643 }, preTitles = { [5642] = "Shadowguard", [5643] = "Shadowguard" }, map = 1454, x = 35.59, y = 87.82, f = "e", only = { races = { "Troll" } }, note = "Ur'kyo" },
						{ t = "turnin", quest = 5680, title = "Shadowguard", npc = 6018, npcName = "Ur'kyo", map = 1454, x = 35.59, y = 87.82, f = "e", only = { races = { "Troll" } }, note = "Ur'kyo: Shadowguard" },
						{ t = "accept", quest = 5646, title = "Devouring Plague", npc = 6018, npcName = "Ur'kyo", minLevel = 20, qlvl = 20, closedBy = { 5644, 5679 }, preTitles = { [5644] = "Devouring Plague", [5679] = "Devouring Plague" }, map = 1454, x = 35.59, y = 87.82, f = "e", only = { races = { "Scourge" } }, note = "Ur'kyo: Aelthalyste in the Undercity, two guides on" },
					},
				},
				{
					title = "Back to the Crossroads",
					goals = {
						{ t = "fly", location = "Crossroads" },
						{ t = "turnin", quest = 1509, title = "News of Dogran", npc = 3464, npcName = "Gazrog", map = 1413, x = 51.93, y = 30.32, f = "e", only = { classes = { "WARLOCK" } }, note = "Gazrog" },
						{ t = "accept", quest = 1510, title = "News of Dogran", npc = 3464, npcName = "Gazrog", minLevel = 20, qlvl = 20, pre = { 1509 }, closedBy = { 1472 }, preTitles = { [1472] = "Devourer of Souls", [1509] = "News of Dogran" }, map = 1413, x = 51.93, y = 30.32, f = "e", only = { classes = { "WARLOCK" } } },
					},
				},
				{
					title = "Regthar Deathgate",
					note = "Regthar stands at the Kolkar watch post just west of the Crossroads.",
					goals = {
						{ t = "accept", quest = 850, title = "Kolkar Leaders", npc = 3389, npcName = "Regthar Deathgate", minLevel = 11, qlvl = 16, map = 1413, x = 45.34, y = 28.41, f = "e" },
					},
				},
				{
					title = "Barak Kodobane",
					note = "Barak stands in the Kolkar camp north-west of Regthar.",
					goals = {
						{ t = "collect", quest = 850, title = "Kolkar Leaders", item = 5022, itemName = "Barak's Head", oi = 1, map = 1413, x = 42.8, y = 23.52, f = "e" },
					},
				},
				{
					title = "Regthar Deathgate",
					goals = {
						{ t = "turnin", quest = 850, title = "Kolkar Leaders", npc = 3389, npcName = "Regthar Deathgate", map = 1413, x = 45.34, y = 28.41, f = "e" },
						{ t = "accept", quest = 851, title = "Verog the Dervish", npc = 3389, npcName = "Regthar Deathgate", minLevel = 11, qlvl = 18, pre = { 850 }, preTitles = { [850] = "Kolkar Leaders" }, map = 1413, x = 45.34, y = 28.41, f = "e" },
					},
				},
				{
					title = "Ken'zigla",
					note = "Ken'zigla lives in Malaka'jin, the troll village just inside Stonetalon at the end of the road west from Regthar.",
					only = { classes = { "WARLOCK" } },
					goals = {
						{ t = "turnin", quest = 1510, title = "News of Dogran", npc = 4197, npcName = "Ken'zigla", map = 1442, x = 73.25, y = 95.13, f = "e" },
						{ t = "accept", quest = 1511, title = "Ken'zigla's Draught", npc = 4197, npcName = "Ken'zigla", minLevel = 20, qlvl = 20, pre = { 1510 }, closedBy = { 1472 }, preTitles = { [1472] = "Devourer of Souls", [1510] = "News of Dogran" }, map = 1442, x = 73.25, y = 95.13, f = "e" },
					},
				},
				{
					title = "Walton and Vrang",
					note = "North to the Dry Hills. Walton's camp and Vrang Wildgore are a few steps apart below the hills.",
					goals = {
						{ t = "accept", quest = 95508, title = "Unwelcome Guests", npc = 261366, npcName = "Walton", minLevel = 14, qlvl = 18, map = 1413, x = 42.01, y = 11.44, f = "e", note = "Walton" },
						{ t = "turnin", quest = 95508, title = "Unwelcome Guests", npc = 261366, npcName = "Walton", map = 1413, x = 42.01, y = 11.44, f = "e", note = "Assist Walton: stay by him when Terry Longdrink and the Kul Tiras marines come up the ridge" },
						{ t = "accept", quest = 95621, title = "Trouble in the Valley", npc = 261366, npcName = "Walton", minLevel = 14, qlvl = 18, map = 1413, x = 42.01, y = 11.44, f = "e" },
						{ t = "accept", quest = 95494, title = "Bruised Pride and Lion Hides", npc = 3682, npcName = "Vrang Wildgore", minLevel = 14, qlvl = 18, map = 1413, x = 43.8, y = 12.21, f = "e", note = "Vrang Wildgore" },
						{ t = "accept", quest = 95495, title = "The Hermit Tanner", npc = 3682, npcName = "Vrang Wildgore", minLevel = 14, qlvl = 18, map = 1413, x = 43.8, y = 12.21, f = "e" },
						{ t = "accept", quest = 95507, title = "Vrang's Game", npc = 3682, npcName = "Vrang Wildgore", minLevel = 14, qlvl = 18, map = 1413, x = 43.8, y = 12.21, f = "e" },
					},
				},
				{
					title = "The Dry Hills",
					note = "Corporal Adamore and his marines hold the wrecked caravan south of Walton. Savannah Patriarchs roam the plains east of the hills, and the Sprung Traps lie among them. Serena Bloodfeather leads the Witchwing harpies in the hills to the west.",
					goals = {
						{ t = "collect", quest = 95621, title = "Trouble in the Valley", item = 270151, itemName = "Benedict's Orders", oi = 1, map = 1413, x = 41.8, y = 15.6, f = "e" },
						{ t = "collect", quest = 95494, title = "Bruised Pride and Lion Hides", item = 269715, itemName = "Savannah Lion Hide", count = 6, oi = 1, map = 1413, x = 43.1, y = 15.03, f = "e", spots = { { x = 44, y = 15.4, r = 104, n = 4 }, { x = 45.5, y = 16.6, r = 78, n = 1 }, { x = 47, y = 13.7, r = 78, n = 1 }, { x = 60, y = 32.7, r = 78, n = 2 }, { x = 61.9, y = 33.1, r = 115, n = 8 } }, spread = true },
						{ t = "collect", quest = 95507, title = "Vrang's Game", item = 269719, itemName = "Trapped Game", count = 8, oi = 1, map = 1413, x = 42.9, y = 15, f = "e", spots = { { x = 43.4, y = 14.6, r = 130, n = 5 }, { x = 45.1, y = 16.1, r = 88, n = 2 }, { x = 46, y = 13.3, r = 104, n = 4 }, { x = 47.5, y = 12, r = 88, n = 3 }, { x = 50.2, y = 12.7, r = 88, n = 1 }, { x = 42.7, y = 21.2, r = 88, n = 1 } }, spread = true },
						{ t = "collect", quest = 876, title = "Serena Bloodfeather", item = 5067, itemName = "Serena's Head", oi = 1, map = 1413, x = 39.16, y = 12.17, f = "e" },
					},
				},
				{
					title = "Walton and Vrang",
					goals = {
						{ t = "turnin", quest = 95494, title = "Bruised Pride and Lion Hides", npc = 3682, npcName = "Vrang Wildgore", map = 1413, x = 43.8, y = 12.21, f = "e", note = "Vrang Wildgore" },
						{ t = "turnin", quest = 95507, title = "Vrang's Game", npc = 3682, npcName = "Vrang Wildgore", map = 1413, x = 43.8, y = 12.21, f = "e" },
						{ t = "turnin", quest = 95495, title = "The Hermit Tanner", npc = 261366, npcName = "Walton", map = 1413, x = 42.01, y = 11.44, f = "e", note = "Walton" },
						{ t = "turnin", quest = 95621, title = "Trouble in the Valley", npc = 261366, npcName = "Walton", map = 1413, x = 42.01, y = 11.44, f = "e" },
					},
				},
				{
					title = "Strange Lockbox",
					note = "The Strange Lockbox lies at the north edge of the Sludge Fen, by the Venture Co. tower. It holds the Half Pendant of Aquatic Agility for Trial of the Sea Lion.",
					only = { classes = { "DRUID" }, races = { "Tauren" } },
					goals = {
						{ t = "collect", item = 15883, itemName = "Half Pendant of Aquatic Agility", map = 1413, x = 56.67, y = 8.32, f = "e", from = "Strange Lockbox", fromKind = "object" },
					},
				},
				{
					title = "Ignition",
					note = "East to the Sludge Fen. Wizzlecrank's Shredder stands inside the Venture Co. camp; Supervisor Lugwizzle carries the key.",
					goals = {
						{ t = "accept", quest = 858, title = "Ignition", npc = 3439, npcName = "Wizzlecrank's Shredder", minLevel = 13, qlvl = 18, map = 1413, x = 56.52, y = 7.45, f = "e" },
						{ t = "collect", quest = 858, title = "Ignition", item = 5050, itemName = "Ignition Key", count = 1, oi = 1, map = 1413, x = 56.27, y = 8.58, f = "e" },
						{ t = "turnin", quest = 858, title = "Ignition", npc = 3439, npcName = "Wizzlecrank's Shredder", map = 1413, x = 56.52, y = 7.45, f = "e" },
						{ t = "accept", quest = 863, title = "The Escape", npc = 3439, npcName = "Wizzlecrank's Shredder", minLevel = 13, qlvl = 18, pre = { 858 }, preTitles = { [858] = "Ignition" }, map = 1413, x = 56.52, y = 7.45, f = "e" },
					},
				},
				{
					title = "The Escape",
					note = "Wizzlecrank drives his shredder out of the camp: stay with him and kill whatever attacks him. Sputtervalve takes it in Ratchet.",
					goals = {
						{ t = "complete", quest = 863, title = "The Escape" },
					},
				},
				{
					title = "Taskmaster Fizzule",
					note = "Fizzule runs the Venture Co. camp at the east end of the Sludge Fen. He attacks strangers: target him and /salute before he does.",
					only = { classes = { "ROGUE" } },
					goals = {
						{ t = "turnin", quest = 2458, title = "Deep Cover", npc = 7233, npcName = "Taskmaster Fizzule", map = 1413, x = 55.44, y = 5.56, f = "e" },
						{ t = "accept", quest = 2478, title = "Mission: Possible But Not Probable", npc = 7233, npcName = "Taskmaster Fizzule", minLevel = 20, qlvl = 24, pre = { 2458 }, preTitles = { [2458] = "Deep Cover" }, map = 1413, x = 55.44, y = 5.56, f = "e", optional = true },
					},
				},
				{
					title = "Mission: Possible But Not Probable",
					note = "Stay stealthed: Foreman Silixiz carries the key to the tower; Gallywix and his lockbox are at the top. Gallywix is elite: grouping up is advised.",
					only = { classes = { "ROGUE" } },
					goals = {
						{ t = "goto", text = "Venture Co. tower", map = 1413, x = 54.8, y = 5.6, f = "e", optional = true },
						{ t = "collect", quest = 2478, title = "Mission: Possible But Not Probable", item = 8072, itemName = "Silixiz's Tower Key", oi = 1, map = 1413, x = 54.8, y = 5.97, f = "e", optional = true },
						{ t = "kill", quest = 2478, title = "Mission: Possible But Not Probable", target = "Mutated Venture Co. Drone", npc = 7310, count = 2, oi = 2, map = 1413, x = 54.7, y = 5.7, f = "e", optional = true },
						{ t = "kill", quest = 2478, title = "Mission: Possible But Not Probable", target = "Venture Co. Patroller", npc = 7308, count = 2, oi = 3, map = 1413, x = 54.66, y = 5.68, f = "e", optional = true },
						{ t = "kill", quest = 2478, title = "Mission: Possible But Not Probable", target = "Venture Co. Lookout", npc = 7307, count = 2, oi = 4, map = 1413, x = 54.64, y = 5.77, f = "e", optional = true },
						{ t = "collect", quest = 2478, title = "Mission: Possible But Not Probable", item = 8073, itemName = "Cache of Zanzil's Altered Mixture", count = 1, oi = 5, map = 1413, x = 54.76, y = 5.56, f = "e", optional = true },
						{ t = "collect", quest = 2478, title = "Mission: Possible But Not Probable", item = 8074, itemName = "Gallywix's Head", oi = 6, map = 1413, x = 54.75, y = 5.59, f = "e", optional = true },
					},
				},
				{
					title = "Boulder Lode Mine",
					note = "The Venture Co. Overseers and Enforcers at the mine in the north-east corner of the zone drop the Cats Eye Emerald.",
					goals = {
						{ t = "collect", quest = 896, title = "Miner's Fortune", item = 5097, itemName = "Cats Eye Emerald", count = 1, oi = 1, map = 1413, x = 59.63, y = 3.78, f = "e", spots = { { x = 60, y = 3.5, r = 70, n = 14 }, { x = 61.5, y = 4, r = 72, n = 7 }, { x = 61.4, y = 5.3, r = 33, n = 5 }, { x = 62.1, y = 3.7, r = 22, n = 4 }, { x = 62, y = 5.4, r = 39, n = 4 } } },
					},
				},
				{
					title = "Hearth to the Crossroads",
					goals = {
						{ t = "hearth", location = "The Crossroads" },
						{ t = "turnin", quest = 876, title = "Serena Bloodfeather", npc = 3449, npcName = "Darsok Swiftdagger", map = 1413, x = 51.62, y = 30.9, f = "e", note = "Darsok Swiftdagger" },
					},
				},
				{
					title = "Verog the Dervish",
					note = "Verog walks among the Kolkar at the Stagnant Oasis south-east of the Crossroads.",
					goals = {
						{ t = "collect", quest = 851, title = "Verog the Dervish", item = 5023, itemName = "Verog's Head", oi = 1, map = 1413, x = 53.06, y = 41.74, f = "e" },
					},
				},
				{
					title = "Camp Taurajo",
					note = "Follow the Gold Road south to Camp Taurajo.",
					goals = {
						{ t = "getfp", npc = 10378, npcName = "Omusa Thunderhorn", location = "Camp Taurajo", map = 1413, x = 44.45, y = 59.15, f = "e", note = "Omusa Thunderhorn" },
						{ t = "turnin", quest = 3261, title = "Jorn Skyseer", npc = 3387, npcName = "Jorn Skyseer", map = 1413, x = 44.86, y = 59.14, f = "e", note = "Jorn Skyseer" },
						{ t = "accept", quest = 882, title = "Ishamuhale", npc = 3387, npcName = "Jorn Skyseer", minLevel = 10, qlvl = 19, pre = { 3261 }, preTitles = { [3261] = "Jorn Skyseer" }, map = 1413, x = 44.86, y = 59.14, f = "e" },
						{ t = "accept", quest = 878, title = "Tribes at War", npc = 3430, npcName = "Mangletooth", minLevel = 14, qlvl = 21, map = 1413, x = 44.55, y = 59.26, f = "e", note = "Mangletooth, in the cage" },
						{ t = "accept", quest = 893, title = "Weapons of Choice", npc = 3433, npcName = "Tatternack Steelforge", minLevel = 17, qlvl = 24, map = 1413, x = 45.1, y = 57.68, f = "e", note = "Tatternack Steelforge" },
						{ t = "turnin", quest = 1511, title = "Ken'zigla's Draught", npc = 5911, npcName = "Grunt Logmar", map = 1413, x = 44.62, y = 59.27, f = "e", only = { classes = { "WARLOCK" } }, note = "Grunt Logmar" },
						{ t = "accept", quest = 1515, title = "Dogran's Captivity", npc = 5911, npcName = "Grunt Logmar", minLevel = 20, qlvl = 20, pre = { 1511 }, closedBy = { 1472 }, preTitles = { [1472] = "Devourer of Souls", [1511] = "Ken'zigla's Draught" }, map = 1413, x = 44.62, y = 59.27, f = "e", only = { classes = { "WARLOCK" } } },
						{ t = "turnin", quest = 1823, title = "Speak with Ruga", npc = 6394, npcName = "Ruga Ragetotem", map = 1413, x = 44.67, y = 59.42, f = "e", only = { classes = { "WARRIOR" } }, note = "Ruga Ragetotem" },
						{ t = "accept", quest = 1824, title = "Trial at the Field of Giants", npc = 6394, npcName = "Ruga Ragetotem", minLevel = 20, qlvl = 20, map = 1413, x = 44.67, y = 59.42, f = "e", only = { classes = { "WARRIOR" } } },
					},
				},
				{
					title = "Bristleback camps",
					note = "The Bristleback quilboar camps spread over the plains north of Camp Taurajo, either side of the Gold Road. Every Bristleback drops a tusk and the Razormane Raiders among them carry Olgra's Adornments; Mankrik's wife lies at the north edge. Keep one Blood Shard. Lakota'mani, a grey kodo, sometimes wanders here: his hoof starts a quest.",
					goals = {
						{ t = "collect", quest = 899, title = "Consumed by Hatred", item = 5085, itemName = "Bristleback Quilboar Tusk", count = 60, oi = 1, map = 1413, x = 45.09, y = 55.26, f = "e", spots = { { x = 45.2, y = 54.9, r = 40, n = 3 }, { x = 43.2, y = 55.2, r = 48, n = 9 }, { x = 43.2, y = 52.1, r = 54, n = 9 }, { x = 45.3, y = 51.5, r = 40, n = 4 }, { x = 47.4, y = 52.8, r = 40, n = 4 }, { x = 51.2, y = 54.2, r = 40, n = 2 }, { x = 52.4, y = 53.8, r = 63, n = 5 }, { x = 52.7, y = 52.3, r = 57, n = 6 }, { x = 53.4, y = 54.3, r = 44, n = 7 }, { x = 51, y = 57.3, r = 66, n = 12 }, { x = 43.7, y = 48.1, r = 40, n = 3 }, { x = 40.7, y = 45.3, r = 40, n = 7 }, { x = 45.2, y = 54, r = 55, n = 9, alt = true }, { x = 46.8, y = 53.7, r = 49, n = 10, alt = true }, { x = 44.4, y = 51.7, r = 47, n = 6, alt = true }, { x = 43.1, y = 48.4, r = 40, n = 6, alt = true }, { x = 43.1, y = 47.3, r = 78, n = 6, alt = true }, { x = 51.2, y = 55.1, r = 54, n = 10, alt = true }, { x = 51.7, y = 57.6, r = 40, n = 5, alt = true }, { x = 41.3, y = 46.1, r = 40, n = 4, alt = true }, { x = 41.4, y = 44.7, r = 40, n = 3, alt = true }, { x = 53.3, y = 53.3, r = 40, n = 7, alt = true } }, spread = true },
						{ t = "collect", quest = 95774, title = "Her Name Is Olgra", item = 277277, itemName = "Olgra's Adornments", count = 4, oi = 1, map = 1413, x = 48.56, y = 53.39, f = "e", spots = { { x = 49.8, y = 50.8, r = 100, n = 5 }, { x = 52.5, y = 50.3, r = 16, n = 2 }, { x = 48.6, y = 53.4, r = 15, n = 1, alt = true } } },
						{ t = "complete", quest = 4921, title = "Lost in Battle", map = 1413, x = 49.3, y = 50.3, f = "e" },
						{ t = "kill", quest = 878, title = "Tribes at War", target = "Bristleback Water Seeker", npc = 3260, count = 6, oi = 1, map = 1413, x = 47.72, y = 52.79, f = "e", spots = { { x = 47.4, y = 52.9, r = 40, n = 3 }, { x = 46.7, y = 53.7, r = 55, n = 6 }, { x = 45.2, y = 54, r = 43, n = 4 }, { x = 45.3, y = 55, r = 40, n = 2 }, { x = 43.2, y = 55.2, r = 45, n = 5 }, { x = 51.1, y = 54.9, r = 40, n = 2 }, { x = 51.2, y = 57.6, r = 40, n = 3 }, { x = 53.6, y = 53.8, r = 40, n = 2 }, { x = 52.6, y = 52.4, r = 40, n = 2 } }, spread = true },
						{ t = "kill", quest = 878, title = "Tribes at War", target = "Bristleback Thornweaver", npc = 3261, count = 12, oi = 2, map = 1413, x = 45.48, y = 51.62, f = "e", spots = { { x = 45.1, y = 51.5, r = 40, n = 4 }, { x = 44, y = 51.3, r = 40, n = 1 }, { x = 43.2, y = 52.1, r = 40, n = 3 }, { x = 50.5, y = 57.2, r = 40, n = 3 }, { x = 51.2, y = 56.2, r = 40, n = 2 }, { x = 51.2, y = 55, r = 52, n = 3 }, { x = 51.3, y = 54.2, r = 40, n = 1 }, { x = 52.8, y = 53.6, r = 45, n = 4 }, { x = 53.2, y = 52.8, r = 40, n = 2 }, { x = 53, y = 51.7, r = 40, n = 1 }, { x = 53.2, y = 54.5, r = 40, n = 2 }, { x = 51.7, y = 57.4, r = 40, n = 2 } }, spread = true },
						{ t = "kill", quest = 878, title = "Tribes at War", target = "Bristleback Geomancer", npc = 3263, count = 12, oi = 3, map = 1413, x = 43.81, y = 48.17, f = "e", spots = { { x = 43.8, y = 48.2, r = 40, n = 1 }, { x = 43, y = 48.2, r = 43, n = 3 }, { x = 42.8, y = 46.8, r = 40, n = 2 }, { x = 41, y = 45.4, r = 67, n = 7 }, { x = 52.6, y = 52.7, r = 44, n = 4 }, { x = 53.4, y = 53.9, r = 49, n = 6 }, { x = 51.7, y = 57.8, r = 40, n = 2 }, { x = 51, y = 57.2, r = 40, n = 5 } }, spread = true },
						{ t = "collect", item = 5075, itemName = "Blood Shard", count = 1, map = 1413, x = 43.81, y = 48.17, f = "e", spots = { { x = 43.7, y = 48.1, r = 40, n = 3 }, { x = 44.4, y = 51.7, r = 47, n = 6 }, { x = 43.2, y = 52.1, r = 54, n = 9 }, { x = 43.2, y = 55.2, r = 48, n = 9 }, { x = 45.2, y = 54.9, r = 40, n = 3 }, { x = 46.8, y = 53.7, r = 49, n = 10 }, { x = 51.2, y = 54.2, r = 40, n = 2 }, { x = 52.4, y = 53.8, r = 63, n = 5 }, { x = 52.7, y = 52.3, r = 57, n = 6 }, { x = 53.4, y = 54.3, r = 44, n = 7 }, { x = 51, y = 57.3, r = 66, n = 12 }, { x = 40.7, y = 45.3, r = 40, n = 7 }, { x = 43.1, y = 48.4, r = 40, n = 6, alt = true }, { x = 43.1, y = 47.3, r = 78, n = 6, alt = true }, { x = 45.3, y = 51.5, r = 40, n = 4, alt = true }, { x = 41.3, y = 46.1, r = 40, n = 4, alt = true }, { x = 41.4, y = 44.7, r = 40, n = 3, alt = true }, { x = 45.2, y = 54, r = 55, n = 9, alt = true }, { x = 47.4, y = 52.8, r = 40, n = 4, alt = true }, { x = 51.2, y = 55.1, r = 54, n = 10, alt = true }, { x = 53.3, y = 53.3, r = 40, n = 7, alt = true }, { x = 51.7, y = 57.6, r = 40, n = 5, alt = true } }, spread = true, from = "Bristleback Geomancer", fromKind = "npc" },
						{ t = "collect", item = 5099, itemName = "Hoof of Lakota'mani", map = 1413, x = 46.13, y = 49.28, f = "e", spots = { { x = 46.1, y = 49.3, r = 15, n = 1 }, { x = 47.4, y = 51.3, r = 15, n = 1 }, { x = 45.1, y = 52.7, r = 15, n = 1 }, { x = 50.1, y = 53.2, r = 15, n = 1 } }, spread = true, optional = true, note = "Hoof of Lakota'mani", from = "Lakota'mani", fromKind = "npc" },
						{ t = "accept", quest = 883, title = "Lakota'mani", item = 5099, itemName = "Hoof of Lakota'mani", minLevel = 10, qlvl = 22, optional = true },
					},
				},
				{
					title = "Grunt Dogran",
					note = "Dogran is chained up in the quilboar camp west of the road.",
					only = { classes = { "WARLOCK" } },
					goals = {
						{ t = "turnin", quest = 1515, title = "Dogran's Captivity", npc = 5908, npcName = "Grunt Dogran", map = 1413, x = 43.3, y = 47.89, f = "e" },
						{ t = "accept", quest = 1512, title = "Love's Gift", npc = 5908, npcName = "Grunt Dogran", minLevel = 20, qlvl = 20, pre = { 1515 }, closedBy = { 1472 }, preTitles = { [1472] = "Devourer of Souls", [1515] = "Dogran's Captivity" }, map = 1413, x = 43.3, y = 47.89, f = "e", note = "Keep it: Gan'rul in Orgrimmar, at the end of this guide" },
					},
				},
				{
					title = "Camp Taurajo",
					goals = {
						{ t = "turnin", quest = 878, title = "Tribes at War", npc = 3430, npcName = "Mangletooth", map = 1413, x = 44.55, y = 59.26, f = "e", note = "Mangletooth" },
						{ t = "accept", quest = 5052, title = "Blood Shards of Agamaggan", npc = 3430, npcName = "Mangletooth", minLevel = 14, qlvl = 21, pre = { 878 }, preTitles = { [878] = "Tribes at War" }, map = 1413, x = 44.55, y = 59.26, f = "e" },
						{ t = "turnin", quest = 5052, title = "Blood Shards of Agamaggan", npc = 3430, npcName = "Mangletooth", map = 1413, x = 44.55, y = 59.26, f = "e" },
						{ t = "accept", quest = 879, title = "Betrayal from Within", npc = 3430, npcName = "Mangletooth", minLevel = 17, qlvl = 25, pre = { 5052 }, preTitles = { [5052] = "Blood Shards of Agamaggan" }, map = 1413, x = 44.55, y = 59.26, f = "e" },
						{ t = "turnin", quest = 883, title = "Lakota'mani", npc = 3387, npcName = "Jorn Skyseer", map = 1413, x = 44.86, y = 59.14, f = "e", optional = true, note = "Jorn Skyseer" },
					},
				},
				{
					title = "Stolen Silver",
					note = "East across the plains toward the coast: the stolen silver lies in a raptor nest north-west of Northwatch Hold.",
					goals = {
						{ t = "collect", quest = 3281, title = "Stolen Silver", item = 5061, itemName = "Stolen Silver", count = 1, oi = 1, map = 1413, x = 58.04, y = 53.87, f = "e" },
					},
				},
				{
					title = "Islen Waterseer",
					note = "Islen waits on the hill south of Ratchet, on your way north.",
					only = { classes = { "SHAMAN" } },
					goals = {
						{ t = "turnin", quest = 1528, title = "Call of Water", npc = 5901, npcName = "Islen Waterseer", map = 1413, x = 65.83, y = 43.78, f = "e" },
						{ t = "accept", quest = 1530, title = "Call of Water", npc = 5901, npcName = "Islen Waterseer", minLevel = 20, qlvl = 22, map = 1413, x = 65.83, y = 43.78, f = "e" },
					},
				},
				{
					title = "Ratchet",
					goals = {
						{ t = "turnin", quest = 865, title = "Raptor Horns", npc = 3446, npcName = "Mebok Mizzyrix", map = 1413, x = 62.37, y = 37.62, f = "e", note = "Mebok Mizzyrix" },
						{ t = "turnin", quest = 896, title = "Miner's Fortune", npc = 3453, npcName = "Wharfmaster Dizzywig", map = 1413, x = 63.35, y = 38.45, f = "e", note = "Wharfmaster Dizzywig" },
						{ t = "turnin", quest = 863, title = "The Escape", npc = 3442, npcName = "Sputtervalve", map = 1413, x = 62.98, y = 37.22, f = "e", note = "Sputtervalve" },
						{ t = "vendor", candidates = { { npc = 3491, npcName = "Ironzar", map = 1413, x = 62.24, y = 37.48, f = "e", faction = "AH" }, { npc = 3159, npcName = "Kzan Thornslash", map = 1411, x = 40.47, y = 68, f = "e", faction = "H" }, { npc = 3486, npcName = "Halija Whitestrider", map = 1413, x = 52.25, y = 31.86, f = "e", faction = "H" }, { npc = 10369, npcName = "Trayexir", map = 1411, x = 56.47, y = 73.12, f = "e", faction = "H" }, { npc = 3167, npcName = "Wuark", map = 1411, x = 51.9, y = 41.14, f = "e", faction = "H" }, { npc = 3683, npcName = "Kiknikle", map = 1413, x = 41.79, y = 38.69, f = "e", faction = "AH" }, { npc = 10380, npcName = "Sanuye Runetotem", map = 1413, x = 45.12, y = 59.01, f = "e", faction = "H" }, { npc = 9552, npcName = "Zanara", map = 1445, x = 35.5, y = 30.09, f = "e", faction = "H" }, { npc = 3349, npcName = "Ukra'nor", map = 1454, x = 29.74, y = 74.17, f = "e", faction = "H" }, { npc = 14754, npcName = "Kelm Hargunth", map = 1413, x = 46.65, y = 8.38, f = "e", faction = "H" }, { npc = 3682, npcName = "Vrang Wildgore", map = 1413, x = 43.8, y = 12.21, f = "e", faction = "H" }, { npc = 3317, npcName = "Ollanus", map = 1454, x = 56.52, y = 73.77, f = "e", faction = "H" }, { npc = 5816, npcName = "Katis", map = 1454, x = 44.18, y = 48.44, f = "e", faction = "H" }, { npc = 3316, npcName = "Handor", map = 1454, x = 62.88, y = 44.69, f = "e", faction = "H" }, { npc = 3356, npcName = "Sumi", map = 1454, x = 82.6, y = 23.96, f = "e", faction = "H" }, { npc = 6028, npcName = "Burkrum", map = 1440, x = 73.54, y = 60.31, f = "e", faction = "H" }, { npc = 3018, npcName = "Hogor Thunderhoof", map = 1456, x = 55.55, y = 57.07, f = "e", faction = "H" }, { npc = 3080, npcName = "Harant Ironbrace", map = 1412, x = 45.32, y = 62.19, faction = "H" }, { npc = 3074, npcName = "Varia Hardhide", map = 1412, x = 43.86, y = 77.65, faction = "H" }, { npc = 10361, npcName = "Gruul Darkblade", map = 1447, x = 22.22, y = 51.09, f = "e", faction = "H" }, { npc = 4085, npcName = "Nizzik", map = 1442, x = 62.7, y = 40.18, f = "e", faction = "AH" }, { npc = 4086, npcName = "Veenix", map = 1442, x = 58.22, y = 51.74, f = "e", faction = "AH" }, { npc = 9551, npcName = "Starn", map = 1441, x = 44.89, y = 50.68, f = "e", faction = "H" }, { npc = 9549, npcName = "Borand", map = 1442, x = 45.36, y = 59.1, f = "e", faction = "H" }, { npc = 8159, npcName = "Worb Strongstitch", map = 1444, x = 74.71, y = 42.58, f = "e", faction = "H" }, { npc = 3053, npcName = "Synge", map = 1441, x = 80.4, y = 77.01, f = "e", faction = "AH" }, { npc = 8878, npcName = "Muuran", map = 1443, x = 55.59, y = 56.5, f = "e", faction = "H" }, { npc = 3000, npcName = "Gibbert", map = 1449, x = 44.1, y = 7.19, f = "e", faction = "AH" }, { npc = 8131, npcName = "Blizrik Buckshot", map = 1446, x = 50.74, y = 27.53, f = "e", faction = "AH" }, { npc = 12045, npcName = "Hae'Wilani", map = 1443, x = 25.8, y = 71.02, f = "e", faction = "H" }, { npc = 10379, npcName = "Altsoba Ragetotem", map = 1448, x = 34.81, y = 53.16, f = "e", faction = "H" }, { npc = 15176, npcName = "Vargus", map = 1451, x = 51.23, y = 38.86, f = "e", faction = "AH" }, { npc = 11184, npcName = "Wixxrak", map = 1452, x = 61.72, y = 38.03, f = "e", faction = "AH" }, { npc = 12029, npcName = "Narianna", map = 1450, x = 53.34, y = 42.7, f = "e", faction = "AH" }, { npc = 3537, npcName = "Zixil", map = 1416, x = 53.6, y = 98.7, f = "e", faction = "AH" }, { npc = 3539, npcName = "Ott", map = 1416, x = 58.9, y = 88.8, f = "e", faction = "H" }, { npc = 13219, npcName = "Jekyll Flandring", map = 1416, x = 62.84, y = 59.27, f = "e", faction = "H" }, { npc = 9555, npcName = "Mu'uta", map = 1417, x = 72.52, y = 33.35, f = "e", faction = "H" }, { npc = 9179, npcName = "Jazzrik", map = 1418, x = 42.47, y = 52.5, f = "e", faction = "AH" }, { npc = 9544, npcName = "Yuka Screwspigot", map = 1418, x = 4.9, y = 94.7, f = "e", faction = "AH" }, { npc = 2113, npcName = "Archibald Kava", map = 1420, x = 32.41, y = 65.66, f = "e", faction = "H" }, { npc = 2135, npcName = "Abe Winters", map = 1420, x = 60.22, y = 53.1, f = "e", faction = "H" }, { npc = 3522, npcName = "Constance Brisboise", map = 1420, x = 52.6, y = 55.77, f = "e", faction = "H" }, { npc = 3534, npcName = "Wallace the Blind", map = 1421, x = 46.5, y = 86.49, f = "e", faction = "AH" }, { npc = 3552, npcName = "Alexandre Lefevre", map = 1421, x = 44.6, y = 39.11, f = "e", faction = "H" }, { npc = 10856, npcName = "Argent Quartermaster Hasana", map = 1422, x = 26.6, y = 55.2, f = "e", faction = "AH" }, { npc = 10857, npcName = "Argent Quartermaster Lightspark", map = 1422, x = 42.84, y = 83.72, f = "e", faction = "AH" }, { npc = 11278, npcName = "Magnus Frostwake", map = 1422, x = 68.12, y = 77.57, f = "e", faction = "AH" }, { npc = 16376, npcName = "Craftsman Wilhelm", map = 1423, x = 71.24, y = 49.9, faction = "AH" }, { npc = 3536, npcName = "Kris Legace", map = 1424, x = 80.14, y = 38.89, f = "e", faction = "AH" }, { npc = 14737, npcName = "Smith Slagtree", map = 1425, x = 77.23, y = 80.13, f = "e", faction = "H" }, { npc = 1407, npcName = "Sranda", map = 1427, x = 82, y = 38.5, f = "e", faction = "H" }, { npc = 14624, npcName = "Master Smith Burninate", map = 1427, x = 38.8, y = 28.51, f = "e", faction = "AH" }, { npc = 1146, npcName = "Vharr", map = 1434, x = 32.36, y = 27.95, f = "e", faction = "H" }, { npc = 2482, npcName = "Zarena Cromwind", map = 1434, x = 28.34, y = 75.46, f = "e", faction = "AH" }, { npc = 2483, npcName = "Jaquilina Dramet", map = 1434, x = 35.75, y = 10.66, f = "e", faction = "AH" }, { npc = 14921, npcName = "Rin'wosho the Trader", map = 1434, x = 15.07, y = 16, f = "e", faction = "AH" }, { npc = 980, npcName = "Grimnal", map = 1435, x = 45.08, y = 50.43, f = "e", faction = "H" }, { npc = 1669, npcName = "Defias Profiteer", map = 1436, x = 43.47, y = 66.76, f = "e", faction = "AH" }, { npc = 4556, npcName = "Gordon Wendham", map = 1458, x = 61.49, y = 41.79, f = "e", faction = "H" }, { npc = 3343, npcName = "Grelkor", map = 1459, x = 49.68, y = 82.46, f = "e", faction = "H" } } },
					},
				},
				{
					title = "Ishamuhale",
					note = "Ishamuhale, a big Sunscale raptor, hunts the plains north of the road from Ratchet to the Crossroads.",
					goals = {
						{ t = "collect", quest = 882, title = "Ishamuhale", item = 5101, itemName = "Ishamuhale's Fang", oi = 1, map = 1413, x = 59.8, y = 30.6, f = "e" },
					},
				},
				{
					title = "The Crossroads",
					goals = {
						{ t = "turnin", quest = 899, title = "Consumed by Hatred", npc = 3432, npcName = "Mankrik", map = 1413, x = 51.95, y = 31.58, f = "e", note = "Mankrik" },
						{ t = "turnin", quest = 4921, title = "Lost in Battle", npc = 3432, npcName = "Mankrik", map = 1413, x = 51.95, y = 31.58, f = "e" },
						{ t = "turnin", quest = 95774, title = "Her Name Is Olgra", npc = 3432, npcName = "Mankrik", map = 1413, x = 51.95, y = 31.58, f = "e" },
						{ t = "turnin", quest = 3281, title = "Stolen Silver", npc = 3464, npcName = "Gazrog", map = 1413, x = 51.93, y = 30.32, f = "e", note = "Gazrog" },
					},
				},
				{
					title = "Regthar Deathgate",
					goals = {
						{ t = "turnin", quest = 851, title = "Verog the Dervish", npc = 3389, npcName = "Regthar Deathgate", map = 1413, x = 45.34, y = 28.41, f = "e" },
						{ t = "accept", quest = 852, title = "Hezrul Bloodmark", npc = 3389, npcName = "Regthar Deathgate", minLevel = 11, qlvl = 19, pre = { 851 }, preTitles = { [851] = "Verog the Dervish" }, map = 1413, x = 45.34, y = 28.41, f = "e" },
					},
				},
				{
					title = "Hezrul Bloodmark",
					note = "Hezrul leads the Kolkar on the west shore of Lushwater Oasis, south of Regthar. Hand his head to Regthar on your last Crossroads stop.",
					goals = {
						{ t = "collect", quest = 852, title = "Hezrul Bloodmark", item = 5025, itemName = "Hezrul's Head", oi = 1, map = 1413, x = 46, y = 41.1, f = "e" },
					},
				},
				{
					title = "Camp Taurajo",
					note = "Down the Gold Road to Camp Taurajo again.",
					goals = {
						{ t = "sethome", npc = 7714, npcName = "Innkeeper Byula", location = "Camp Taurajo", map = 1413, x = 45.58, y = 59.04, f = "e", note = "Innkeeper Byula" },
						{ t = "turnin", quest = 882, title = "Ishamuhale", npc = 3387, npcName = "Jorn Skyseer", map = 1413, x = 44.86, y = 59.14, f = "e", note = "Jorn Skyseer" },
						{ t = "accept", quest = 907, title = "Enraged Thunder Lizards", npc = 3387, npcName = "Jorn Skyseer", minLevel = 10, qlvl = 18, pre = { 882 }, preTitles = { [882] = "Ishamuhale" }, map = 1413, x = 44.86, y = 59.14, f = "e" },
						{ t = "accept", quest = 6382, title = "The Ashenvale Hunt", npc = 3387, npcName = "Jorn Skyseer", minLevel = 20, qlvl = 20, pre = { 882 }, closedBy = { 235, 742 }, preTitles = { [235] = "The Ashenvale Hunt", [742] = "The Ashenvale Hunt", [882] = "Ishamuhale" }, map = 1413, x = 44.86, y = 59.14, f = "e", note = "Keep it: Senani Thunderheart in Ashenvale, next guide" },
					},
				},
				{
					title = "Enraged Thunder Lizards",
					note = "Thunderheads graze on the plains just south of Camp Taurajo. Owatanka, a blue thunder lizard, roams among them: his Tailspike starts a quest.",
					goals = {
						{ t = "collect", quest = 907, title = "Enraged Thunder Lizards", item = 5143, itemName = "Thunder Lizard Blood", count = 3, oi = 1, map = 1413, x = 43.81, y = 60.64, f = "e", spots = { { x = 44, y = 60.9, r = 46, n = 2 }, { x = 45.6, y = 66.9, r = 67, n = 5 }, { x = 46.8, y = 72.7, r = 46, n = 2 }, { x = 50.4, y = 76.5, r = 46, n = 2 }, { x = 47.1, y = 82.3, r = 46, n = 1 }, { x = 43.2, y = 78.4, r = 46, n = 1 }, { x = 49, y = 62, r = 64, n = 5 }, { x = 49.1, y = 55.8, r = 64, n = 4 }, { x = 52.7, y = 54.8, r = 56, n = 3 }, { x = 45.5, y = 52.3, r = 46, n = 1 }, { x = 42.2, y = 48.8, r = 46, n = 1 }, { x = 46.2, y = 44.8, r = 46, n = 1 }, { x = 42.8, y = 60.6, r = 46, n = 3, alt = true }, { x = 43.7, y = 62.2, r = 46, n = 2, alt = true }, { x = 44.4, y = 63.6, r = 46, n = 2, alt = true }, { x = 42.2, y = 57.7, r = 46, n = 1, alt = true }, { x = 46, y = 63.6, r = 64, n = 4, alt = true }, { x = 45.2, y = 64.9, r = 46, n = 1, alt = true }, { x = 46.9, y = 62.3, r = 54, n = 3, alt = true }, { x = 45.5, y = 56.4, r = 54, n = 3, alt = true }, { x = 46.6, y = 56.1, r = 46, n = 3, alt = true }, { x = 47.1, y = 65.2, r = 46, n = 1, alt = true }, { x = 48.4, y = 60.3, r = 100, n = 7, alt = true }, { x = 48, y = 63.8, r = 46, n = 3, alt = true }, { x = 48.2, y = 58, r = 46, n = 3, alt = true }, { x = 44.2, y = 53.4, r = 46, n = 1, alt = true }, { x = 48.4, y = 56.8, r = 46, n = 3, alt = true }, { x = 47.3, y = 66.8, r = 46, n = 2, alt = true }, { x = 49.7, y = 59.3, r = 79, n = 5, alt = true }, { x = 46.3, y = 68.9, r = 53, n = 3, alt = true }, { x = 49.8, y = 58.1, r = 46, n = 1, alt = true }, { x = 50.2, y = 60.7, r = 46, n = 2, alt = true }, { x = 47.7, y = 51.8, r = 46, n = 1, alt = true }, { x = 46.7, y = 50.5, r = 73, n = 4, alt = true }, { x = 43.5, y = 49.5, r = 46, n = 2, alt = true }, { x = 49.8, y = 53.9, r = 46, n = 4, alt = true }, { x = 44.7, y = 49.4, r = 46, n = 1, alt = true }, { x = 48.9, y = 51.3, r = 46, n = 3, alt = true }, { x = 47.5, y = 49.2, r = 46, n = 1, alt = true }, { x = 50.5, y = 52.8, r = 52, n = 3, alt = true }, { x = 45.4, y = 47.9, r = 46, n = 3, alt = true }, { x = 44.4, y = 74, r = 62, n = 3, alt = true }, { x = 44.3, y = 47.2, r = 76, n = 4, alt = true }, { x = 47, y = 47.7, r = 78, n = 5, alt = true }, { x = 52.6, y = 56.5, r = 53, n = 4, alt = true }, { x = 42.7, y = 46.3, r = 63, n = 4, alt = true }, { x = 45.5, y = 74.9, r = 46, n = 1, alt = true }, { x = 46.4, y = 46.3, r = 46, n = 1, alt = true }, { x = 47.1, y = 74.9, r = 46, n = 3, alt = true }, { x = 44.1, y = 75.9, r = 64, n = 4, alt = true }, { x = 45.3, y = 45.5, r = 46, n = 2, alt = true }, { x = 48.5, y = 74.3, r = 63, n = 4, alt = true }, { x = 44.1, y = 44.7, r = 51, n = 2, alt = true }, { x = 45, y = 76.8, r = 46, n = 2, alt = true }, { x = 48.2, y = 75.9, r = 46, n = 4, alt = true }, { x = 46.6, y = 77.3, r = 46, n = 2, alt = true }, { x = 48.9, y = 76.6, r = 46, n = 3, alt = true }, { x = 44.5, y = 78.9, r = 46, n = 2, alt = true }, { x = 46.5, y = 79.5, r = 46, n = 2, alt = true }, { x = 49.3, y = 79.3, r = 60, n = 3, alt = true }, { x = 47.9, y = 80.9, r = 46, n = 2, alt = true }, { x = 50.1, y = 80.4, r = 46, n = 1, alt = true } }, spread = true },
						{ t = "collect", item = 5102, itemName = "Owatanka's Tailspike", map = 1413, x = 44.2, y = 62, f = "e", spots = { { x = 44.2, y = 62, r = 15, n = 1 }, { x = 45.4, y = 62.8, r = 15, n = 1 }, { x = 49.2, y = 61.6, r = 15, n = 1 }, { x = 49.4, y = 59.2, r = 15, n = 1 } }, spread = true, optional = true, note = "Owatanka's Tailspike", from = "Owatanka", fromKind = "npc" },
						{ t = "accept", quest = 884, title = "Owatanka", item = 5102, itemName = "Owatanka's Tailspike", minLevel = 10, qlvl = 24, optional = true },
					},
				},
				{
					title = "Jorn Skyseer",
					goals = {
						{ t = "turnin", quest = 907, title = "Enraged Thunder Lizards", npc = 3387, npcName = "Jorn Skyseer", map = 1413, x = 44.86, y = 59.14, f = "e" },
						{ t = "accept", quest = 913, title = "Cry of the Thunderhawk", npc = 3387, npcName = "Jorn Skyseer", minLevel = 10, qlvl = 20, pre = { 907 }, preTitles = { [907] = "Enraged Thunder Lizards" }, map = 1413, x = 44.86, y = 59.14, f = "e" },
						{ t = "turnin", quest = 884, title = "Owatanka", npc = 3387, npcName = "Jorn Skyseer", map = 1413, x = 44.86, y = 59.14, f = "e", optional = true },
					},
				},
				{
					title = "Cry of the Thunderhawk",
					note = "Thunderhawk Cloudscrapers circle over the same plains south of the camp.",
					goals = {
						{ t = "collect", quest = 913, title = "Cry of the Thunderhawk", item = 5164, itemName = "Thunderhawk Wings", oi = 1, map = 1413, x = 46.69, y = 61.49, f = "e", spots = { { x = 47.9, y = 61.3, r = 124, n = 3 }, { x = 50.1, y = 60.5, r = 106, n = 1 }, { x = 49.6, y = 54.7, r = 173, n = 4 }, { x = 46.7, y = 49.9, r = 122, n = 4 }, { x = 44.8, y = 53, r = 106, n = 2 }, { x = 44.3, y = 46.3, r = 156, n = 4 }, { x = 44.8, y = 63.1, r = 106, n = 1 }, { x = 45.5, y = 67, r = 106, n = 1 }, { x = 44.5, y = 75.1, r = 106, n = 4 }, { x = 44.1, y = 77.9, r = 106, n = 3 }, { x = 46.1, y = 80.2, r = 106, n = 2 }, { x = 47.7, y = 75.3, r = 155, n = 6 } }, spread = true },
					},
				},
				{
					title = "Jorn Skyseer",
					goals = {
						{ t = "turnin", quest = 913, title = "Cry of the Thunderhawk", npc = 3387, npcName = "Jorn Skyseer", map = 1413, x = 44.86, y = 59.14, f = "e" },
					},
				},
				{
					title = "Field of Giants",
					note = "South of Camp Taurajo the Silithid Mounds dot the Field of Giants; the eggs lie in them, and Silithid Swarmers come out to defend them. Silithid Harvesters are rare: if you see one, kill it for its head.",
					goals = {
						{ t = "collect", quest = 868, title = "Egg Hunt", item = 5058, itemName = "Silithid Egg", count = 12, oi = 1, map = 1413, x = 44.94, y = 69.4, f = "e", spots = { { x = 44.9, y = 69.4, r = 40, n = 1 }, { x = 43.5, y = 70.2, r = 40, n = 1 }, { x = 42.6, y = 69.9, r = 40, n = 1 }, { x = 42.9, y = 71.3, r = 40, n = 2 }, { x = 44.2, y = 71.9, r = 40, n = 2 }, { x = 45.2, y = 72.3, r = 40, n = 2 }, { x = 47.7, y = 70.5, r = 52, n = 4 }, { x = 48.5, y = 70.1, r = 40, n = 1 } }, spread = true },
						{ t = "collect", quest = 1824, title = "Trial at the Field of Giants", item = 7119, itemName = "Twitching Antenna", oi = 1, map = 1413, x = 45.06, y = 69.48, f = "e", spots = { { x = 45.1, y = 69.5, r = 47, n = 5 }, { x = 43.7, y = 69.7, r = 67, n = 7 }, { x = 42.5, y = 69.6, r = 75, n = 7 }, { x = 42.8, y = 71.1, r = 40, n = 6 }, { x = 42.6, y = 72.1, r = 59, n = 4 }, { x = 43.9, y = 71.5, r = 40, n = 3 }, { x = 44, y = 72.7, r = 44, n = 4 }, { x = 45.1, y = 72.2, r = 57, n = 7 }, { x = 47.5, y = 71.1, r = 40, n = 2 }, { x = 48.2, y = 71, r = 43, n = 5 }, { x = 48.6, y = 69.8, r = 58, n = 6 }, { x = 49.3, y = 69.2, r = 40, n = 2 }, { x = 47.4, y = 70.2, r = 40, n = 4, alt = true }, { x = 42.1, y = 70.2, r = 40, n = 2, alt = true } }, spread = true, only = { classes = { "WARRIOR" } }, note = "Twitching Antennae from the silithid" },
						{ t = "collect", item = 5138, itemName = "Harvester's Head", map = 1413, x = 42, y = 70, f = "e", optional = true, note = "Harvester's Head", from = "Silithid Harvester", fromKind = "npc", fromRank = 4 },
						{ t = "accept", quest = 897, title = "The Harvester", item = 5138, itemName = "Harvester's Head", minLevel = 10, qlvl = 24, optional = true },
					},
				},
				{
					title = "Gann Stonespire",
					note = "Gann waits in a small camp further south, on the road toward Bael Modan.",
					goals = {
						{ t = "accept", quest = 843, title = "Gann's Reclamation", npc = 3341, npcName = "Gann Stonespire", minLevel = 17, qlvl = 23, map = 1413, x = 45.89, y = 77, f = "e" },
						{ t = "accept", quest = 98093, title = "Field to Clear", npc = 14242, npcName = "Sulhasa", minLevel = 18, qlvl = 23, map = 1413, x = 47.8, y = 77.6, f = "e", note = "Sulhasa, up in the tree just east of Gann" },
						{ t = "turnin", quest = 1530, title = "Call of Water", npc = 5899, npcName = "Brine", map = 1413, x = 43.42, y = 77.41, f = "e", only = { classes = { "SHAMAN" } }, note = "Brine, just west of Gann" },
						{ t = "accept", quest = 1535, title = "Call of Water", npc = 5899, npcName = "Brine", minLevel = 20, qlvl = 22, pre = { 1530 }, preTitles = { [1530] = "Call of Water" }, map = 1413, x = 43.42, y = 77.41, f = "e", only = { classes = { "SHAMAN" } } },
						{ t = "collect", quest = 1535, title = "Call of Water", item = 7769, itemName = "Filled Brown Waterskin", oi = 1, map = 1413, x = 44.3, y = 76.8, f = "e", only = { classes = { "SHAMAN" } }, note = "Fill the Empty Brown Waterskin at the quilboar watering hole" },
						{ t = "turnin", quest = 1535, title = "Call of Water", npc = 5899, npcName = "Brine", map = 1413, x = 43.42, y = 77.41, f = "e", only = { classes = { "SHAMAN" } } },
						{ t = "accept", quest = 1536, title = "Call of Water", npc = 5899, npcName = "Brine", minLevel = 20, qlvl = 22, pre = { 1535 }, preTitles = { [1535] = "Call of Water" }, map = 1413, x = 43.42, y = 77.41, f = "e", only = { classes = { "SHAMAN" } }, note = "Keep it: the Spring Well is beside Tarren Mill" },
					},
				},
				{
					title = "Blackthorn Ridge",
					note = "West of Gann, the Razormane hold Blackthorn Ridge. Kuz is on the east side, Nak to the south, Lok Orcbane at the west end. Lok (25) and the Warfrenzies (24-25) are a few levels above you; Hagg Taurenbane, a rare elite, sometimes walks the ridge: leave him. Pathfinders and Stalkers drop the Backstabber, Seers the Wand, Warfrenzies the War Shield. Stormhide lizards and Hecklefang Stalkers roam the plain between Gann and the ridge. Washte Pawne, a rare red wind serpent, flies over the ridge: its feather starts a quest.",
					goals = {
						{ t = "goto", text = "Blackthorn Ridge", map = 1413, x = 42.5, y = 81, f = "e" },
						{ t = "collect", quest = 879, title = "Betrayal from Within", item = 5074, itemName = "Kuz's Skull", oi = 3, map = 1413, x = 45.12, y = 80.07, f = "e" },
						{ t = "collect", quest = 879, title = "Betrayal from Within", item = 5073, itemName = "Nak's Skull", oi = 2, map = 1413, x = 43.75, y = 83.26, f = "e" },
						{ t = "collect", quest = 879, title = "Betrayal from Within", item = 5072, itemName = "Lok's Skull", oi = 1, map = 1413, x = 40.15, y = 80.54, f = "e" },
						{ t = "collect", quest = 893, title = "Weapons of Choice", item = 5093, itemName = "Razormane Backstabber", count = 1, oi = 1, map = 1413, x = 41.84, y = 79.22, f = "e", spots = { { x = 41.9, y = 79, r = 18, n = 2 }, { x = 42.7, y = 81.5, r = 53, n = 3 }, { x = 44, y = 80.5, r = 36, n = 5 }, { x = 43.1, y = 82.9, r = 54, n = 6 }, { x = 44, y = 82.2, r = 31, n = 3 }, { x = 44, y = 83.5, r = 52, n = 6 }, { x = 42.6, y = 80.5, r = 15, n = 1, alt = true }, { x = 44.7, y = 81.2, r = 15, n = 1, alt = true }, { x = 45.4, y = 80.1, r = 15, n = 2, alt = true }, { x = 45.1, y = 84, r = 36, n = 2, alt = true } } },
						{ t = "collect", quest = 893, title = "Weapons of Choice", item = 5092, itemName = "Charred Razormane Wand", count = 1, oi = 2, map = 1413, x = 41.49, y = 78.67, f = "e", spots = { { x = 41.3, y = 78.9, r = 25, n = 2 }, { x = 42.4, y = 78.7, r = 34, n = 2 }, { x = 41, y = 80.6, r = 57, n = 4 }, { x = 41.9, y = 81.9, r = 68, n = 6 }, { x = 43.2, y = 82.9, r = 64, n = 4 }, { x = 44.5, y = 83.3, r = 15, n = 1, alt = true } } },
						{ t = "collect", quest = 893, title = "Weapons of Choice", item = 5094, itemName = "Razormane War Shield", count = 1, oi = 3, map = 1413, x = 41.62, y = 78.93, f = "e", spots = { { x = 41.5, y = 79, r = 68, n = 6 }, { x = 42, y = 80.8, r = 25, n = 3 }, { x = 40.8, y = 81.1, r = 25, n = 2 }, { x = 41.9, y = 81.7, r = 36, n = 4 } } },
						{ t = "kill", quest = 98093, title = "Field to Clear", target = "Stormhide", npc = 3238, count = 7, oi = 1, map = 1413, x = 43.19, y = 78.39, f = "e", spots = { { x = 43.2, y = 78.4, r = 52, n = 1 }, { x = 44.5, y = 78.9, r = 52, n = 2 }, { x = 44.4, y = 76.2, r = 86, n = 6 }, { x = 44.4, y = 74, r = 62, n = 3 }, { x = 46.8, y = 72.7, r = 52, n = 2 }, { x = 48.5, y = 74.5, r = 70, n = 5 }, { x = 48.7, y = 76.4, r = 65, n = 5 }, { x = 50.4, y = 76.5, r = 52, n = 2 }, { x = 50.1, y = 80.4, r = 52, n = 1 }, { x = 47.1, y = 82.3, r = 52, n = 1 }, { x = 46.5, y = 79.5, r = 52, n = 2 }, { x = 46.6, y = 77.3, r = 52, n = 2 }, { x = 45.5, y = 74.9, r = 52, n = 1, alt = true }, { x = 47.3, y = 75.1, r = 77, n = 4, alt = true }, { x = 47.9, y = 80.9, r = 52, n = 2, alt = true }, { x = 49.3, y = 79.3, r = 60, n = 3, alt = true } }, spread = true, note = "Stormhide, on the plain between Gann and the ridge" },
						{ t = "kill", quest = 98093, title = "Field to Clear", target = "Hecklefang Stalker", npc = 4128, count = 7, oi = 2, map = 1413, x = 44.12, y = 79.43, f = "e", spots = { { x = 44.1, y = 79.4, r = 46, n = 1 }, { x = 45.3, y = 77.7, r = 86, n = 5 }, { x = 44.2, y = 76.6, r = 46, n = 2 }, { x = 44.4, y = 74.8, r = 55, n = 4 }, { x = 45.5, y = 75.3, r = 47, n = 2 }, { x = 47.1, y = 77.4, r = 46, n = 1 }, { x = 48.9, y = 79.3, r = 52, n = 3 }, { x = 50, y = 79, r = 46, n = 1 }, { x = 49.6, y = 76.2, r = 55, n = 3 }, { x = 47.5, y = 73.5, r = 47, n = 4 }, { x = 48.3, y = 81, r = 46, n = 1 }, { x = 46.8, y = 81.3, r = 59, n = 5 }, { x = 46.7, y = 79.9, r = 46, n = 1, alt = true }, { x = 48.1, y = 74.9, r = 46, n = 3, alt = true } }, spread = true, note = "Hecklefang Stalker" },
						{ t = "collect", item = 5103, itemName = "Washte Pawne's Feather", map = 1413, x = 44.81, y = 78.88, f = "e", spots = { { x = 44.8, y = 78.9, r = 15, n = 1 }, { x = 43.2, y = 80.9, r = 15, n = 1 }, { x = 47.4, y = 79.9, r = 15, n = 1 }, { x = 44.8, y = 74.9, r = 15, n = 1 } }, spread = true, optional = true, note = "Washte Pawne's Feather", from = "Washte Pawne", fromKind = "npc" },
						{ t = "accept", quest = 885, title = "Washte Pawne", item = 5103, itemName = "Washte Pawne's Feather", minLevel = 10, qlvl = 25, optional = true },
					},
				},
				{
					title = "Bael Modan",
					note = "South of Gann, the Bael'dun dwarves dig at Bael Modan. Excavators and Foremen work the pit; Prospector Khazgorm (26) carries the journal: pull him alone.",
					goals = {
						{ t = "kill", quest = 843, title = "Gann's Reclamation", target = "Bael'dun Excavator", npc = 3374, count = 15, oi = 1, map = 1413, x = 47.06, y = 83.87, f = "e", spots = { { x = 47.3, y = 84.3, r = 42, n = 5 }, { x = 47.2, y = 85.6, r = 46, n = 6 }, { x = 48, y = 85, r = 15, n = 2 }, { x = 48.1, y = 86.1, r = 23, n = 3 } } },
						{ t = "kill", quest = 843, title = "Gann's Reclamation", target = "Bael'dun Foreman", npc = 3375, count = 5, oi = 2, map = 1413, x = 47.41, y = 84.32, f = "e", spots = { { x = 47.6, y = 84.6, r = 27, n = 2 }, { x = 47.4, y = 85.5, r = 15, n = 1 }, { x = 48.1, y = 85.9, r = 15, n = 1 } } },
						{ t = "collect", quest = 843, title = "Gann's Reclamation", item = 5006, itemName = "Khazgorm's Journal", oi = 3, map = 1413, x = 47.5, y = 85.06, f = "e", spots = { { x = 47.6, y = 85.5, r = 37, n = 3 }, { x = 48.3, y = 86.2, r = 15, n = 1 } } },
					},
				},
				{
					title = "Gann Stonespire",
					goals = {
						{ t = "turnin", quest = 843, title = "Gann's Reclamation", npc = 3341, npcName = "Gann Stonespire", map = 1413, x = 45.89, y = 77, f = "e" },
						{ t = "turnin", quest = 98093, title = "Field to Clear", npc = 14242, npcName = "Sulhasa", map = 1413, x = 47.8, y = 77.6, f = "e", note = "Sulhasa" },
						{ t = "accept", quest = 846, title = "Revenge of Gann", npc = 3341, npcName = "Gann Stonespire", minLevel = 17, qlvl = 26, pre = { 843 }, preTitles = { [843] = "Gann's Reclamation" }, map = 1413, x = 45.89, y = 77, f = "e" },
					},
				},
				{
					title = "Bael'dun fortress",
					note = "The Bael'dun Soldiers, Riflemen and Officers guard the fortress on the east side of the dig; all three items drop from them.",
					goals = {
						{ t = "collect", quest = 846, title = "Revenge of Gann", item = 5017, itemName = "Nitroglycerin", count = 6, oi = 1, map = 1413, x = 48.45, y = 83.77, f = "e", spots = { { x = 48.8, y = 84.3, r = 51, n = 14 }, { x = 49.5, y = 84, r = 31, n = 10 }, { x = 47.1, y = 85.8, r = 15, n = 1, alt = true } } },
						{ t = "collect", quest = 846, title = "Revenge of Gann", item = 5018, itemName = "Wood Pulp", count = 6, oi = 2, map = 1413, x = 48.45, y = 83.77, f = "e", spots = { { x = 48.8, y = 84.3, r = 51, n = 14 }, { x = 49.5, y = 84, r = 31, n = 10 }, { x = 47.1, y = 85.8, r = 15, n = 1, alt = true } } },
						{ t = "collect", quest = 846, title = "Revenge of Gann", item = 5019, itemName = "Sodium Nitrate", count = 6, oi = 3, map = 1413, x = 48.45, y = 83.77, f = "e", spots = { { x = 48.8, y = 84.3, r = 51, n = 14 }, { x = 49.5, y = 84, r = 31, n = 10 }, { x = 47.1, y = 85.8, r = 15, n = 1, alt = true } } },
					},
				},
				{
					title = "Gann Stonespire",
					goals = {
						{ t = "turnin", quest = 846, title = "Revenge of Gann", npc = 3341, npcName = "Gann Stonespire", map = 1413, x = 45.89, y = 77, f = "e" },
						{ t = "accept", quest = 849, title = "Revenge of Gann", npc = 3341, npcName = "Gann Stonespire", minLevel = 17, qlvl = 26, pre = { 846 }, preTitles = { [846] = "Revenge of Gann" }, map = 1413, x = 45.89, y = 77, f = "e" },
					},
				},
				{
					title = "The flying machine",
					note = "The dwarves' flying machine sits on its platform inside the dig site.",
					goals = {
						{ t = "interact", quest = 849, title = "Revenge of Gann", object = 3644, objName = "Bael Modan Flying Machine", oi = 1, map = 1413, x = 46.97, y = 85.63, f = "e" },
					},
				},
				{
					title = "Gann Stonespire",
					goals = {
						{ t = "turnin", quest = 849, title = "Revenge of Gann", npc = 3341, npcName = "Gann Stonespire", map = 1413, x = 45.89, y = 77, f = "e" },
					},
				},
				{
					title = "Camp Taurajo",
					goals = {
						{ t = "hearth", location = "Camp Taurajo" },
						{ t = "turnin", quest = 879, title = "Betrayal from Within", npc = 3430, npcName = "Mangletooth", map = 1413, x = 44.55, y = 59.26, f = "e", note = "Mangletooth" },
						{ t = "accept", quest = 906, title = "Betrayal from Within", npc = 3430, npcName = "Mangletooth", minLevel = 17, qlvl = 25, pre = { 879 }, preTitles = { [879] = "Betrayal from Within" }, map = 1413, x = 44.55, y = 59.26, f = "e" },
						{ t = "turnin", quest = 893, title = "Weapons of Choice", npc = 3433, npcName = "Tatternack Steelforge", map = 1413, x = 45.1, y = 57.68, f = "e", note = "Tatternack Steelforge" },
						{ t = "turnin", quest = 885, title = "Washte Pawne", npc = 3387, npcName = "Jorn Skyseer", map = 1413, x = 44.86, y = 59.14, f = "e", optional = true, note = "Jorn Skyseer" },
						{ t = "turnin", quest = 897, title = "The Harvester", npc = 3387, npcName = "Jorn Skyseer", map = 1413, x = 44.86, y = 59.14, f = "e", optional = true },
						{ t = "turnin", quest = 1824, title = "Trial at the Field of Giants", npc = 6394, npcName = "Ruga Ragetotem", map = 1413, x = 44.67, y = 59.42, f = "e", only = { classes = { "WARRIOR" } }, note = "Ruga Ragetotem" },
						{ t = "accept", quest = 1825, title = "Speak with Thun'grim", npc = 6394, npcName = "Ruga Ragetotem", minLevel = 20, qlvl = 20, pre = { 1824 }, closedBy = { 1838 }, preTitles = { [1824] = "Trial at the Field of Giants", [1838] = "Brutal Armor" }, map = 1413, x = 44.67, y = 59.42, f = "e", only = { classes = { "WARRIOR" } } },
						{ t = "vendor", candidates = { { npc = 10380, npcName = "Sanuye Runetotem", map = 1413, x = 45.12, y = 59.01, f = "e", faction = "H" }, { npc = 9552, npcName = "Zanara", map = 1445, x = 35.5, y = 30.09, f = "e", faction = "H" }, { npc = 3683, npcName = "Kiknikle", map = 1413, x = 41.79, y = 38.69, f = "e", faction = "AH" }, { npc = 3080, npcName = "Harant Ironbrace", map = 1412, x = 45.32, y = 62.19, faction = "H" }, { npc = 3075, npcName = "Bronk Steelrage", map = 1412, x = 43.91, y = 77.86, faction = "H" }, { npc = 3486, npcName = "Halija Whitestrider", map = 1413, x = 52.25, y = 31.86, f = "e", faction = "H" }, { npc = 3018, npcName = "Hogor Thunderhoof", map = 1456, x = 55.55, y = 57.07, f = "e", faction = "H" }, { npc = 3658, npcName = "Lizzarik", map = 1413, x = 61.76, y = 38.29, f = "e", faction = "AH" }, { npc = 3159, npcName = "Kzan Thornslash", map = 1411, x = 40.47, y = 68, f = "e", faction = "H" }, { npc = 8159, npcName = "Worb Strongstitch", map = 1444, x = 74.71, y = 42.58, f = "e", faction = "H" }, { npc = 9551, npcName = "Starn", map = 1441, x = 44.89, y = 50.68, f = "e", faction = "H" }, { npc = 3682, npcName = "Vrang Wildgore", map = 1413, x = 43.8, y = 12.21, f = "e", faction = "H" }, { npc = 14754, npcName = "Kelm Hargunth", map = 1413, x = 46.65, y = 8.38, f = "e", faction = "H" }, { npc = 10369, npcName = "Trayexir", map = 1411, x = 56.47, y = 73.12, f = "e", faction = "H" }, { npc = 8878, npcName = "Muuran", map = 1443, x = 55.59, y = 56.5, f = "e", faction = "H" }, { npc = 3000, npcName = "Gibbert", map = 1449, x = 44.1, y = 7.19, f = "e", faction = "AH" }, { npc = 3167, npcName = "Wuark", map = 1411, x = 51.9, y = 41.14, f = "e", faction = "H" }, { npc = 4086, npcName = "Veenix", map = 1442, x = 58.22, y = 51.74, f = "e", faction = "AH" }, { npc = 3053, npcName = "Synge", map = 1441, x = 80.4, y = 77.01, f = "e", faction = "AH" }, { npc = 9549, npcName = "Borand", map = 1442, x = 45.36, y = 59.1, f = "e", faction = "H" }, { npc = 4085, npcName = "Nizzik", map = 1442, x = 62.7, y = 40.18, f = "e", faction = "AH" }, { npc = 3349, npcName = "Ukra'nor", map = 1454, x = 29.74, y = 74.17, f = "e", faction = "H" }, { npc = 3314, npcName = "Urtharo", map = 1454, x = 47.56, y = 68.38, f = "e", faction = "H" }, { npc = 6028, npcName = "Burkrum", map = 1440, x = 73.54, y = 60.31, f = "e", faction = "H" }, { npc = 3315, npcName = "Tor'phan", map = 1454, x = 62.81, y = 50.44, f = "e", faction = "H" }, { npc = 12045, npcName = "Hae'Wilani", map = 1443, x = 25.8, y = 71.02, f = "e", faction = "H" }, { npc = 8131, npcName = "Blizrik Buckshot", map = 1446, x = 50.74, y = 27.53, f = "e", faction = "AH" }, { npc = 15176, npcName = "Vargus", map = 1451, x = 51.23, y = 38.86, f = "e", faction = "AH" }, { npc = 3356, npcName = "Sumi", map = 1454, x = 82.6, y = 23.96, f = "e", faction = "H" }, { npc = 10361, npcName = "Gruul Darkblade", map = 1447, x = 22.22, y = 51.09, f = "e", faction = "H" }, { npc = 10379, npcName = "Altsoba Ragetotem", map = 1448, x = 34.81, y = 53.16, f = "e", faction = "H" }, { npc = 11184, npcName = "Wixxrak", map = 1452, x = 61.72, y = 38.03, f = "e", faction = "AH" }, { npc = 12029, npcName = "Narianna", map = 1450, x = 53.34, y = 42.7, f = "e", faction = "AH" }, { npc = 3537, npcName = "Zixil", map = 1416, x = 53.6, y = 98.7, f = "e", faction = "AH" }, { npc = 3539, npcName = "Ott", map = 1416, x = 58.9, y = 88.8, f = "e", faction = "H" }, { npc = 13219, npcName = "Jekyll Flandring", map = 1416, x = 62.84, y = 59.27, f = "e", faction = "H" }, { npc = 9555, npcName = "Mu'uta", map = 1417, x = 72.52, y = 33.35, f = "e", faction = "H" }, { npc = 9179, npcName = "Jazzrik", map = 1418, x = 42.47, y = 52.5, f = "e", faction = "AH" }, { npc = 9544, npcName = "Yuka Screwspigot", map = 1418, x = 4.9, y = 94.7, f = "e", faction = "AH" }, { npc = 2113, npcName = "Archibald Kava", map = 1420, x = 32.41, y = 65.66, f = "e", faction = "H" }, { npc = 2135, npcName = "Abe Winters", map = 1420, x = 60.22, y = 53.1, f = "e", faction = "H" }, { npc = 3522, npcName = "Constance Brisboise", map = 1420, x = 52.6, y = 55.77, f = "e", faction = "H" }, { npc = 3534, npcName = "Wallace the Blind", map = 1421, x = 46.5, y = 86.49, f = "e", faction = "AH" }, { npc = 3552, npcName = "Alexandre Lefevre", map = 1421, x = 44.6, y = 39.11, f = "e", faction = "H" }, { npc = 10856, npcName = "Argent Quartermaster Hasana", map = 1422, x = 26.6, y = 55.2, f = "e", faction = "AH" }, { npc = 10857, npcName = "Argent Quartermaster Lightspark", map = 1422, x = 42.84, y = 83.72, f = "e", faction = "AH" }, { npc = 11278, npcName = "Magnus Frostwake", map = 1422, x = 68.12, y = 77.57, f = "e", faction = "AH" }, { npc = 16376, npcName = "Craftsman Wilhelm", map = 1423, x = 71.24, y = 49.9, faction = "AH" }, { npc = 3536, npcName = "Kris Legace", map = 1424, x = 80.14, y = 38.89, f = "e", faction = "AH" }, { npc = 14737, npcName = "Smith Slagtree", map = 1425, x = 77.23, y = 80.13, f = "e", faction = "H" }, { npc = 1407, npcName = "Sranda", map = 1427, x = 82, y = 38.5, f = "e", faction = "H" }, { npc = 14624, npcName = "Master Smith Burninate", map = 1427, x = 38.8, y = 28.51, f = "e", faction = "AH" }, { npc = 1146, npcName = "Vharr", map = 1434, x = 32.36, y = 27.95, f = "e", faction = "H" }, { npc = 2482, npcName = "Zarena Cromwind", map = 1434, x = 28.34, y = 75.46, f = "e", faction = "AH" }, { npc = 2483, npcName = "Jaquilina Dramet", map = 1434, x = 35.75, y = 10.66, f = "e", faction = "AH" }, { npc = 14921, npcName = "Rin'wosho the Trader", map = 1434, x = 15.07, y = 16, f = "e", faction = "AH" }, { npc = 980, npcName = "Grimnal", map = 1435, x = 45.08, y = 50.43, f = "e", faction = "H" }, { npc = 1669, npcName = "Defias Profiteer", map = 1436, x = 43.47, y = 66.76, f = "e", faction = "AH" }, { npc = 4556, npcName = "Gordon Wendham", map = 1458, x = 61.49, y = 41.79, f = "e", faction = "H" }, { npc = 3343, npcName = "Grelkor", map = 1459, x = 49.68, y = 82.46, f = "e", faction = "H" } } },
					},
				},
				{
					title = "The Crossroads",
					goals = {
						{ t = "fly", location = "Crossroads" },
						{ t = "turnin", quest = 906, title = "Betrayal from Within", npc = 3429, npcName = "Thork", map = 1413, x = 51.5, y = 30.87, f = "e", note = "Thork, at the top of the tower" },
						{ t = "turnin", quest = 868, title = "Egg Hunt", npc = 3428, npcName = "Korran", map = 1413, x = 51.07, y = 29.63, f = "e", note = "Korran" },
					},
				},
				{
					title = "Regthar Deathgate",
					goals = {
						{ t = "turnin", quest = 852, title = "Hezrul Bloodmark", npc = 3389, npcName = "Regthar Deathgate", map = 1413, x = 45.34, y = 28.41, f = "e" },
					},
				},
				{
					title = "Thun'grim Firegaze",
					note = "Thun'grim camps beside the road east of the Crossroads.",
					only = { classes = { "WARRIOR" } },
					goals = {
						{ t = "turnin", quest = 1825, title = "Speak with Thun'grim", npc = 5878, npcName = "Thun'grim Firegaze", map = 1413, x = 57.23, y = 30.34, f = "e" },
						{ t = "note", text = "He offers Brutal Armor next: level 30, with pieces all over Kalimdor and the Eastern Kingdoms. Leave it." },
					},
				},
				{
					title = "Orgrimmar",
					note = "Fly to Orgrimmar to train (Druids train in Thunder Bluff instead).",
					goals = {
						{ t = "fly", location = "Orgrimmar" },
						{ t = "train", class = true, candidates = { { npc = 3156, npcName = "Nartok", map = 1411, x = 40.65, y = 68.52, f = "e", faction = "H", classes = { "WARLOCK" } }, { npc = 3155, npcName = "Rwag", map = 1411, x = 41.28, y = 68, f = "e", faction = "H", classes = { "ROGUE" } }, { npc = 3707, npcName = "Ken'jai", map = 1411, x = 42.36, y = 68.81, f = "e", faction = "H", classes = { "PRIEST" } }, { npc = 3157, npcName = "Shikrik", map = 1411, x = 42.39, y = 69, f = "e", faction = "H", classes = { "SHAMAN" } }, { npc = 5884, npcName = "Mai'ah", map = 1411, x = 42.51, y = 69.04, f = "e", faction = "H", classes = { "MAGE" } }, { npc = 3154, npcName = "Jen'shan", map = 1411, x = 42.84, y = 69.33, f = "e", faction = "H", classes = { "HUNTER" } }, { npc = 3153, npcName = "Frang", map = 1411, x = 42.89, y = 69.44, f = "e", faction = "H", classes = { "WARRIOR" } }, { npc = 3171, npcName = "Thotar", map = 1411, x = 51.85, y = 43.49, f = "e", faction = "H", classes = { "HUNTER" } }, { npc = 3170, npcName = "Kaplak", map = 1411, x = 51.98, y = 43.69, f = "e", faction = "H", classes = { "ROGUE" } }, { npc = 5880, npcName = "Un'Thuwa", map = 1411, x = 56.31, y = 75.11, f = "e", faction = "H", classes = { "MAGE" } }, { npc = 3706, npcName = "Tai'jin", map = 1411, x = 54.26, y = 42.93, f = "e", faction = "H", classes = { "PRIEST" } }, { npc = 3169, npcName = "Tarshaw Jaggedscar", map = 1411, x = 54.19, y = 42.47, f = "e", faction = "H", classes = { "WARRIOR" } }, { npc = 3173, npcName = "Swart", map = 1411, x = 54.42, y = 42.59, f = "e", faction = "H", classes = { "SHAMAN" } }, { npc = 3172, npcName = "Dhugru Gorelust", map = 1411, x = 54.38, y = 41.2, f = "e", faction = "H", classes = { "WARLOCK" } }, { npc = 6018, npcName = "Ur'kyo", map = 1454, x = 35.59, y = 87.82, f = "e", faction = "H", classes = { "PRIEST" } }, { npc = 5885, npcName = "Deino", map = 1454, x = 38.45, y = 86.13, f = "e", faction = "H", classes = { "MAGE" } }, { npc = 3328, npcName = "Ormok", map = 1454, x = 43.9, y = 54.63, f = "e", faction = "H", classes = { "ROGUE" } }, { npc = 3325, npcName = "Mirket", map = 1454, x = 48.62, y = 46.95, f = "e", faction = "H", classes = { "WARLOCK" } }, { npc = 3344, npcName = "Kardris Dreamseeker", map = 1454, x = 38.8, y = 36.37, f = "e", faction = "H", classes = { "SHAMAN" } }, { npc = 3406, npcName = "Xor'juul", map = 1454, x = 67.24, y = 20.2, f = "e", faction = "H", classes = { "HUNTER" } }, { npc = 3354, npcName = "Sorek", map = 1454, x = 80.39, y = 32.38, f = "e", faction = "H", classes = { "WARRIOR" } }, { npc = 3034, npcName = "Sheal Runetotem", map = 1456, x = 77.14, y = 27.02, f = "e", faction = "H", classes = { "DRUID" } }, { npc = 3040, npcName = "Urek Thunderhorn", map = 1456, x = 59.13, y = 86.87, f = "e", faction = "H", classes = { "HUNTER" } }, { npc = 3043, npcName = "Ker Ragetotem", map = 1456, x = 57.58, y = 85.5, f = "e", faction = "H", classes = { "WARRIOR" } }, { npc = 3065, npcName = "Yaw Sharpmane", map = 1412, x = 46.93, y = 59.65, faction = "H", classes = { "HUNTER" } }, { npc = 3063, npcName = "Krang Stonehoof", map = 1412, x = 48.35, y = 63.74, faction = "H", classes = { "WARRIOR" } }, { npc = 3066, npcName = "Narm Skychaser", map = 1412, x = 47.4, y = 62.54, faction = "H", classes = { "SHAMAN" } }, { npc = 3064, npcName = "Gennia Runetotem", map = 1412, x = 47.48, y = 62.95, faction = "H", classes = { "DRUID" } }, { npc = 3048, npcName = "Ursyn Ghull", map = 1456, x = 25.7, y = 14.19, f = "e", faction = "H", classes = { "MAGE" } }, { npc = 246344, npcName = "Alodan the Hopeful", map = 1456, x = 25.6, y = 14.8, f = "e", faction = "H", classes = { "PALADIN" } }, { npc = 3044, npcName = "Miles Welsh", map = 1456, x = 25.32, y = 15.27, f = "e", faction = "H", classes = { "PRIEST" } }, { npc = 3031, npcName = "Tigor Skychaser", map = 1456, x = 23.64, y = 18.79, f = "e", faction = "H", classes = { "SHAMAN" } }, { npc = 3060, npcName = "Gart Mistrunner", map = 1412, x = 44.65, y = 76.55, faction = "H", classes = { "DRUID" } }, { npc = 3062, npcName = "Meela Dawnstrider", map = 1412, x = 44.58, y = 76.56, faction = "H", classes = { "SHAMAN" } }, { npc = 3061, npcName = "Lanka Farshot", map = 1412, x = 43.96, y = 76.35, faction = "H", classes = { "HUNTER" } }, { npc = 3059, npcName = "Harutt Thunderhorn", map = 1412, x = 43.75, y = 76.72, faction = "H", classes = { "WARRIOR" } }, { npc = 2119, npcName = "Dannal Stern", map = 1420, x = 32.69, y = 65.56, f = "e", faction = "H", classes = { "WARRIOR" } }, { npc = 2122, npcName = "David Trias", map = 1420, x = 32.53, y = 65.65, f = "e", faction = "H", classes = { "ROGUE" } }, { npc = 2123, npcName = "Dark Cleric Duesten", map = 1420, x = 31.11, y = 66.03, f = "e", faction = "H", classes = { "PRIEST" } }, { npc = 2124, npcName = "Isabella", map = 1420, x = 30.93, y = 66.06, f = "e", faction = "H", classes = { "MAGE" } }, { npc = 2126, npcName = "Maximillion", map = 1420, x = 30.91, y = 66.34, f = "e", faction = "H", classes = { "WARLOCK" } }, { npc = 2127, npcName = "Rupert Boch", map = 1420, x = 61.59, y = 52.4, f = "e", faction = "H", classes = { "WARLOCK" } }, { npc = 2128, npcName = "Cain Firesong", map = 1420, x = 61.97, y = 52.47, f = "e", faction = "H", classes = { "MAGE" } }, { npc = 2129, npcName = "Dark Cleric Beryl", map = 1420, x = 61.57, y = 52.19, f = "e", faction = "H", classes = { "PRIEST" } }, { npc = 2130, npcName = "Marion Call", map = 1420, x = 61.75, y = 52, f = "e", faction = "H", classes = { "ROGUE" } }, { npc = 2131, npcName = "Austil de Mon", map = 1420, x = 61.85, y = 52.54, f = "e", faction = "H", classes = { "WARRIOR" } }, { npc = 244808, npcName = "Aramis Hammerhand", map = 1420, x = 31.09, y = 66.32, f = "e", faction = "H", classes = { "PALADIN" } }, { npc = 246152, npcName = "Shari Stilwell", map = 1420, x = 60.25, y = 52.63, f = "e", faction = "H", classes = { "PALADIN" } }, { npc = 246389, npcName = "Hilda the Breaker", map = 1420, x = 21.92, y = 47.19, f = "e", faction = "H", classes = { "PALADIN" } }, { npc = 4563, npcName = "Kaal Soulreaper", map = 1458, x = 86.21, y = 15.93, f = "e", faction = "H", classes = { "WARLOCK" } }, { npc = 4566, npcName = "Kaelystia Hatebringer", map = 1458, x = 85.02, y = 14.02, f = "e", faction = "H", classes = { "MAGE" } }, { npc = 4582, npcName = "Carolyn Ward", map = 1458, x = 83.86, y = 72.07, f = "e", faction = "H", classes = { "ROGUE" } }, { npc = 4593, npcName = "Christoph Walker", map = 1458, x = 46.93, y = 15.23, f = "e", faction = "H", classes = { "WARRIOR" } }, { npc = 4606, npcName = "Aelthalyste", map = 1458, x = 49.26, y = 17.12, f = "e", faction = "H", classes = { "PRIEST" } }, { npc = 260093, npcName = "Garen Largo", map = 1458, x = 47.49, y = 15.23, f = "e", faction = "H", classes = { "PALADIN" } }, { npc = 251373, npcName = "Xyton Silverwind", map = 2521, x = 41.72, y = 23.38, faction = "AH", classes = { "DRUID" } }, { npc = 251374, npcName = "Windshaper Boro", map = 2521, x = 42.76, y = 23.58, faction = "H", classes = { "SHAMAN" } }, { npc = 251376, npcName = "Tai'ree Farsight", map = 2521, x = 42.44, y = 23.68, faction = "AH", classes = { "HUNTER" } }, { npc = 251389, npcName = "Akeri Duskblade", map = 2521, x = 43.71, y = 24.3, faction = "AH", classes = { "ROGUE" } }, { npc = 251964, npcName = "Blademaster Ren", map = 2521, x = 43.68, y = 24.17, faction = "AH", classes = { "WARRIOR" } } } },
					},
				},
				{
					title = "The Binding",
					note = "Gan'rul Bloodeye stands in the Cleft of Shadow. Use Dogran's Pendant on the summoning circle there and defeat the succubus to bind her.",
					only = { classes = { "WARLOCK" } },
					goals = {
						{ t = "turnin", quest = 1512, title = "Love's Gift", npc = 5875, npcName = "Gan'rul Bloodeye", map = 1454, x = 48.25, y = 45.28, f = "e" },
						{ t = "accept", quest = 1513, title = "The Binding", npc = 5875, npcName = "Gan'rul Bloodeye", minLevel = 20, qlvl = 20, pre = { 1512 }, closedBy = { 1472 }, preTitles = { [1472] = "Devourer of Souls", [1512] = "Love's Gift" }, map = 1454, x = 48.25, y = 45.28, f = "e" },
						{ t = "use", item = 6626, itemName = "Dogran's Pendant", map = 1454, x = 49.4, y = 50, f = "e", note = "Dogran's Pendant" },
						{ t = "kill", quest = 1513, title = "The Binding", target = "Summoned Succubus", npc = 5677, oi = 1, map = 1454, x = 49.4, y = 50, f = "e" },
						{ t = "turnin", quest = 1513, title = "The Binding", npc = 5875, npcName = "Gan'rul Bloodeye", map = 1454, x = 48.25, y = 45.28, f = "e" },
					},
				},
				{
					title = "Shenthul",
					only = { classes = { "ROGUE" } },
					goals = {
						{ t = "turnin", quest = 2478, title = "Mission: Possible But Not Probable", npc = 3401, npcName = "Shenthul", map = 1454, x = 43.05, y = 53.74, f = "e", optional = true, note = "Shenthul, Cleft of Shadow" },
						{ t = "accept", quest = 2479, title = "Hinott's Assistance", npc = 3401, npcName = "Shenthul", minLevel = 20, qlvl = 26, pre = { 2478 }, preTitles = { [2478] = "Mission: Possible But Not Probable" }, map = 1454, x = 43.05, y = 53.74, f = "e", optional = true, note = "Serge Hinott in Tarren Mill teaches Poisons: keep it" },
					},
				},
				{
					title = "The Great Cat Spirit",
					note = "Turak Runetotem trains you on Elder Rise in Thunder Bluff.",
					only = { classes = { "DRUID" } },
					goals = {
						{ t = "accept", quest = 98340, title = "The Great Cat Spirit", npc = 3033, npcName = "Turak Runetotem", minLevel = 20, qlvl = 20, map = 1456, x = 76.48, y = 27.22, f = "e", note = "Turak Runetotem" },
					},
				},
				{
					title = "Moonglade",
					note = "Cast Teleport: Moonglade. Tauren: join the two pendant halves at the Shrine of Remulos, on the north-west shore of the lake, before you see Dendrite Starblaze in Nighthaven.",
					only = { classes = { "DRUID" } },
					goals = {
						{ t = "collect", quest = 30, title = "Trial of the Sea Lion", item = 15885, itemName = "Pendant of the Sea Lion", count = 1, oi = 1, map = 1450, x = 36, y = 41.42, f = "e", only = { races = { "Tauren" } }, note = "Pendant of the Sea Lion: use a half at the Shrine of Remulos" },
						{ t = "turnin", quest = 30, title = "Trial of the Sea Lion", npc = 11802, npcName = "Dendrite Starblaze", map = 1450, x = 56.21, y = 30.64, f = "e", only = { races = { "Tauren" } }, note = "Dendrite Starblaze" },
						{ t = "accept", quest = 31, title = "Aquatic Form", npc = 11802, npcName = "Dendrite Starblaze", minLevel = 16, qlvl = 16, pre = { 30 }, preTitles = { [30] = "Trial of the Sea Lion" }, map = 1450, x = 56.21, y = 30.64, f = "e", only = { races = { "Tauren" } } },
						{ t = "turnin", quest = 94913, title = "Moonglade", npc = 11802, npcName = "Dendrite Starblaze", map = 1450, x = 56.21, y = 30.64, f = "e", only = { races = { "Skyborne" } }, note = "Dendrite Starblaze: the welcome from Turak" },
						{ t = "turnin", quest = 98340, title = "The Great Cat Spirit", npc = 11802, npcName = "Dendrite Starblaze", map = 1450, x = 56.21, y = 30.64, f = "e", note = "Dendrite Starblaze" },
						{ t = "accept", quest = 98405, title = "The Great Cat Spirit", npc = 11802, npcName = "Dendrite Starblaze", minLevel = 20, qlvl = 20, map = 1450, x = 56.21, y = 30.64, f = "e", only = { races = { "Tauren" } } },
						{ t = "accept", quest = 98341, title = "The Great Windborne Cat Spirit", npc = 11802, npcName = "Dendrite Starblaze", minLevel = 20, qlvl = 20, map = 1450, x = 56.21, y = 30.64, f = "e", only = { races = { "Skyborne" } } },
					},
				},
				{
					title = "The Stormrage Barrow Dens",
					note = "Tauren: the Great Cat Spirit waits on the southern hill above the bridge. Skyborne: the Avatar of Saeyleenan stands south of the twin bridges. Then the dens east of the lake: leave your form, click the statue at the entrance for five minutes of stealth, keep clear of the spirits inside and take one of each relic; the Relic of the Silent Shadow lies at the foot of the white cat statue.",
					only = { classes = { "DRUID" } },
					goals = {
						{ t = "turnin", quest = 98405, title = "The Great Cat Spirit", npc = 11957, npcName = "Great Cat Spirit", map = 1450, x = 58.39, y = 73.52, f = "e", only = { races = { "Tauren" } }, note = "Great Cat Spirit" },
						{ t = "accept", quest = 98342, title = "The Great Cat Spirit", npc = 11957, npcName = "Great Cat Spirit", minLevel = 20, qlvl = 20, map = 1450, x = 58.39, y = 73.52, f = "e", only = { races = { "Tauren" } } },
						{ t = "turnin", quest = 98341, title = "The Great Windborne Cat Spirit", npc = 272054, npcName = "Avatar of Saeyleenan", map = 1450, x = 44, y = 73.4, f = "e", only = { races = { "Skyborne" } }, note = "Avatar of Saeyleenan" },
						{ t = "accept", quest = 98404, title = "The Great Windborne Cat Spirit", npc = 272054, npcName = "Avatar of Saeyleenan", minLevel = 20, qlvl = 20, map = 1450, x = 44, y = 73.4, f = "e", only = { races = { "Skyborne" } } },
						{ t = "collect", quest = 98342, title = "The Great Cat Spirit", item = 280502, itemName = "Relic of the Fang", count = 1, oi = 1, map = 1450, x = 72.4, y = 66, f = "e", only = { races = { "Tauren" } } },
						{ t = "collect", quest = 98342, title = "The Great Cat Spirit", item = 280679, itemName = "Relic of the Claw", oi = 2, map = 1450, x = 75.2, y = 67.2, f = "e", only = { races = { "Tauren" } } },
						{ t = "collect", quest = 98342, title = "The Great Cat Spirit", item = 280680, itemName = "Relic of the Silent Shadow", oi = 3, map = 1450, x = 74.4, y = 65.4, f = "e", only = { races = { "Tauren" } } },
						{ t = "collect", quest = 98404, title = "The Great Windborne Cat Spirit", item = 280502, itemName = "Relic of the Fang", count = 1, oi = 1, map = 1450, x = 72.4, y = 66, f = "e", only = { races = { "Skyborne" } } },
						{ t = "collect", quest = 98404, title = "The Great Windborne Cat Spirit", item = 280679, itemName = "Relic of the Claw", oi = 2, map = 1450, x = 75.2, y = 67.2, f = "e", only = { races = { "Skyborne" } } },
						{ t = "collect", quest = 98404, title = "The Great Windborne Cat Spirit", item = 280680, itemName = "Relic of the Silent Shadow", oi = 3, map = 1450, x = 74.4, y = 65.4, f = "e", only = { races = { "Skyborne" } } },
						{ t = "turnin", quest = 98342, title = "The Great Cat Spirit", npc = 11957, npcName = "Great Cat Spirit", map = 1450, x = 58.39, y = 73.52, f = "e", only = { races = { "Tauren" } }, note = "Great Cat Spirit" },
						{ t = "accept", quest = 98739, title = "Blessings of the Great Cat Spirit", npc = 11957, npcName = "Great Cat Spirit", minLevel = 20, qlvl = 20, map = 1450, x = 58.39, y = 73.52, f = "e", only = { races = { "Tauren" } } },
						{ t = "turnin", quest = 98404, title = "The Great Windborne Cat Spirit", npc = 272054, npcName = "Avatar of Saeyleenan", map = 1450, x = 44, y = 73.4, f = "e", only = { races = { "Skyborne" } }, note = "Avatar of Saeyleenan" },
						{ t = "accept", quest = 98738, title = "Blessings of the Great Windborne Cat Spirit", npc = 272054, npcName = "Avatar of Saeyleenan", minLevel = 20, qlvl = 20, map = 1450, x = 44, y = 73.4, f = "e", only = { races = { "Skyborne" } } },
					},
				},
				{
					title = "Dendrite Starblaze",
					only = { classes = { "DRUID" } },
					goals = {
						{ t = "turnin", quest = 98739, title = "Blessings of the Great Cat Spirit", npc = 11802, npcName = "Dendrite Starblaze", map = 1450, x = 56.21, y = 30.64, f = "e", only = { races = { "Tauren" } }, note = "Dendrite Starblaze, Nighthaven" },
						{ t = "turnin", quest = 98738, title = "Blessings of the Great Windborne Cat Spirit", npc = 11802, npcName = "Dendrite Starblaze", map = 1450, x = 56.21, y = 30.64, f = "e", only = { races = { "Skyborne" } } },
						{ t = "accept", quest = 98362, title = "To Thunder Bluff", npc = 11802, npcName = "Dendrite Starblaze", minLevel = 20, qlvl = 20, map = 1450, x = 56.21, y = 30.64, f = "e" },
					},
				},
				{
					title = "Turak Runetotem",
					only = { classes = { "DRUID" } },
					goals = {
						{ t = "fly", location = "Thunder Bluff", note = "Bunthen Plainswind in Nighthaven flies druids there" },
						{ t = "turnin", quest = 31, title = "Aquatic Form", npc = 3033, npcName = "Turak Runetotem", map = 1456, x = 76.48, y = 27.22, f = "e", only = { races = { "Tauren" } }, note = "Turak Runetotem: Aquatic Form" },
						{ t = "turnin", quest = 98362, title = "To Thunder Bluff", npc = 3033, npcName = "Turak Runetotem", map = 1456, x = 76.48, y = 27.22, f = "e", note = "Turak Runetotem: Cat Form" },
					},
				},
				{
					title = "Back to the Crossroads",
					note = "Fly back to the Crossroads. The next guide starts here and takes the road north to the Mor'shan Rampart and Ashenvale.",
					goals = {
						{ t = "fly", location = "Crossroads" },
					},
				},
			},
		})
	end
	register()
end

-- Source: forever/horde/05-stonetalon-mountains.guide
do
	local function register()
		Polestar.RegisterGuide({
			id = "forever/horde/05-stonetalon-mountains",
			pack = "guides",
			title = "Stonetalon Mountains & Ashenvale",
			faction = "Horde",
			minLevel = 23,
			maxLevel = 25,
			category = "Leveling",
			zone = 1442,
			zoneName = "Stonetalon Mountains",
			next = "forever/horde/06-hillsbrad-foothills",
			author = "Polestar",
			version = 1,
			steps = {
				{
					title = "Kadrak",
					note = "From the Crossroads follow the road north. Kadrak stands on the watch tower of the Mor'shan Rampart where the road enters Ashenvale. Open the Bundle of Reports he gives you.",
					goals = {
						{ t = "turnin", quest = 6541, title = "Report to Kadrak", npc = 8582, npcName = "Kadrak", map = 1440, x = 68.6, y = 89.1, f = "e", note = "Kadrak" },
						{ t = "accept", quest = 6543, title = "The Warsong Reports", npc = 8582, npcName = "Kadrak", minLevel = 17, qlvl = 19, map = 1440, x = 68.6, y = 89.1, f = "e" },
					},
				},
				{
					title = "Warsong Scout",
					note = "Keep north on the road. The Warsong Scout waits at the Warsong lumber camp, south of Splintertree.",
					goals = {
						{ t = "collect", quest = 6543, title = "The Warsong Reports", item = 16764, itemName = "Warsong Scout Update", oi = 2, map = 1440, x = 71.05, y = 68.36, f = "e", note = "Warsong Scout" },
					},
				},
				{
					title = "Splintertree Post",
					note = "Splintertree Post is just north up the road.",
					goals = {
						{ t = "getfp", location = "Splintertree Post" },
						{ t = "sethome", location = "Splintertree Post" },
						{ t = "vendor", candidates = { { npc = 6028, npcName = "Burkrum", map = 1440, x = 73.54, y = 60.31, f = "e", faction = "H" }, { npc = 14754, npcName = "Kelm Hargunth", map = 1413, x = 46.65, y = 8.38, f = "e", faction = "H" }, { npc = 3682, npcName = "Vrang Wildgore", map = 1413, x = 43.8, y = 12.21, f = "e", faction = "H" }, { npc = 3349, npcName = "Ukra'nor", map = 1454, x = 29.74, y = 74.17, f = "e", faction = "H" }, { npc = 5816, npcName = "Katis", map = 1454, x = 44.18, y = 48.44, f = "e", faction = "H" }, { npc = 3319, npcName = "Sana", map = 1454, x = 55.97, y = 72.73, f = "e", faction = "H" }, { npc = 3316, npcName = "Handor", map = 1454, x = 62.88, y = 44.69, f = "e", faction = "H" }, { npc = 3477, npcName = "Hraq", map = 1413, x = 51.13, y = 28.96, f = "e", faction = "H" }, { npc = 3360, npcName = "Koru", map = 1454, x = 81.48, y = 18.74, f = "e", faction = "H" }, { npc = 10361, npcName = "Gruul Darkblade", map = 1447, x = 22.22, y = 51.09, f = "e", faction = "H" }, { npc = 4085, npcName = "Nizzik", map = 1442, x = 62.7, y = 40.18, f = "e", faction = "AH" }, { npc = 3163, npcName = "Uhgar", map = 1411, x = 52.02, y = 40.45, f = "e", faction = "H" }, { npc = 4086, npcName = "Veenix", map = 1442, x = 58.22, y = 51.74, f = "e", faction = "AH" }, { npc = 3161, npcName = "Rarc", map = 1411, x = 40.48, y = 67.82, f = "e", faction = "H" }, { npc = 3684, npcName = "Pizznukle", map = 1413, x = 41.77, y = 38.62, f = "e", faction = "AH" }, { npc = 3491, npcName = "Ironzar", map = 1413, x = 62.24, y = 37.48, f = "e", faction = "AH" }, { npc = 9549, npcName = "Borand", map = 1442, x = 45.36, y = 59.1, f = "e", faction = "H" }, { npc = 10379, npcName = "Altsoba Ragetotem", map = 1448, x = 34.81, y = 53.16, f = "e", faction = "H" }, { npc = 10369, npcName = "Trayexir", map = 1411, x = 56.47, y = 73.12, f = "e", faction = "H" }, { npc = 3015, npcName = "Kuna Thunderhorn", map = 1456, x = 47, y = 45.7, f = "e", faction = "H" }, { npc = 10380, npcName = "Sanuye Runetotem", map = 1413, x = 45.12, y = 59.01, f = "e", faction = "H" }, { npc = 3080, npcName = "Harant Ironbrace", map = 1412, x = 45.32, y = 62.19, faction = "H" }, { npc = 9552, npcName = "Zanara", map = 1445, x = 35.5, y = 30.09, f = "e", faction = "H" }, { npc = 11184, npcName = "Wixxrak", map = 1452, x = 61.72, y = 38.03, f = "e", faction = "AH" }, { npc = 8878, npcName = "Muuran", map = 1443, x = 55.59, y = 56.5, f = "e", faction = "H" }, { npc = 3074, npcName = "Varia Hardhide", map = 1412, x = 43.86, y = 77.65, faction = "H" }, { npc = 12029, npcName = "Narianna", map = 1450, x = 53.34, y = 42.7, f = "e", faction = "AH" }, { npc = 12045, npcName = "Hae'Wilani", map = 1443, x = 25.8, y = 71.02, f = "e", faction = "H" }, { npc = 8159, npcName = "Worb Strongstitch", map = 1444, x = 74.71, y = 42.58, f = "e", faction = "H" }, { npc = 9551, npcName = "Starn", map = 1441, x = 44.89, y = 50.68, f = "e", faction = "H" }, { npc = 3000, npcName = "Gibbert", map = 1449, x = 44.1, y = 7.19, f = "e", faction = "AH" }, { npc = 3053, npcName = "Synge", map = 1441, x = 80.4, y = 77.01, f = "e", faction = "AH" }, { npc = 8131, npcName = "Blizrik Buckshot", map = 1446, x = 50.74, y = 27.53, f = "e", faction = "AH" }, { npc = 15176, npcName = "Vargus", map = 1451, x = 51.23, y = 38.86, f = "e", faction = "AH" }, { npc = 3537, npcName = "Zixil", map = 1416, x = 53.6, y = 98.7, f = "e", faction = "AH" }, { npc = 3539, npcName = "Ott", map = 1416, x = 58.9, y = 88.8, f = "e", faction = "H" }, { npc = 13219, npcName = "Jekyll Flandring", map = 1416, x = 62.84, y = 59.27, f = "e", faction = "H" }, { npc = 9555, npcName = "Mu'uta", map = 1417, x = 72.52, y = 33.35, f = "e", faction = "H" }, { npc = 9179, npcName = "Jazzrik", map = 1418, x = 42.47, y = 52.5, f = "e", faction = "AH" }, { npc = 9544, npcName = "Yuka Screwspigot", map = 1418, x = 4.9, y = 94.7, f = "e", faction = "AH" }, { npc = 2113, npcName = "Archibald Kava", map = 1420, x = 32.41, y = 65.66, f = "e", faction = "H" }, { npc = 2135, npcName = "Abe Winters", map = 1420, x = 60.22, y = 53.1, f = "e", faction = "H" }, { npc = 3522, npcName = "Constance Brisboise", map = 1420, x = 52.6, y = 55.77, f = "e", faction = "H" }, { npc = 3534, npcName = "Wallace the Blind", map = 1421, x = 46.5, y = 86.49, f = "e", faction = "AH" }, { npc = 3552, npcName = "Alexandre Lefevre", map = 1421, x = 44.6, y = 39.11, f = "e", faction = "H" }, { npc = 10856, npcName = "Argent Quartermaster Hasana", map = 1422, x = 26.6, y = 55.2, f = "e", faction = "AH" }, { npc = 10857, npcName = "Argent Quartermaster Lightspark", map = 1422, x = 42.84, y = 83.72, f = "e", faction = "AH" }, { npc = 11278, npcName = "Magnus Frostwake", map = 1422, x = 68.12, y = 77.57, f = "e", faction = "AH" }, { npc = 16376, npcName = "Craftsman Wilhelm", map = 1423, x = 71.24, y = 49.9, faction = "AH" }, { npc = 3536, npcName = "Kris Legace", map = 1424, x = 80.14, y = 38.89, f = "e", faction = "AH" }, { npc = 14737, npcName = "Smith Slagtree", map = 1425, x = 77.23, y = 80.13, f = "e", faction = "H" }, { npc = 1407, npcName = "Sranda", map = 1427, x = 82, y = 38.5, f = "e", faction = "H" }, { npc = 14624, npcName = "Master Smith Burninate", map = 1427, x = 38.8, y = 28.51, f = "e", faction = "AH" }, { npc = 1146, npcName = "Vharr", map = 1434, x = 32.36, y = 27.95, f = "e", faction = "H" }, { npc = 2482, npcName = "Zarena Cromwind", map = 1434, x = 28.34, y = 75.46, f = "e", faction = "AH" }, { npc = 2483, npcName = "Jaquilina Dramet", map = 1434, x = 35.75, y = 10.66, f = "e", faction = "AH" }, { npc = 14921, npcName = "Rin'wosho the Trader", map = 1434, x = 15.07, y = 16, f = "e", faction = "AH" }, { npc = 980, npcName = "Grimnal", map = 1435, x = 45.08, y = 50.43, f = "e", faction = "H" }, { npc = 1669, npcName = "Defias Profiteer", map = 1436, x = 43.47, y = 66.76, f = "e", faction = "AH" }, { npc = 4556, npcName = "Gordon Wendham", map = 1458, x = 61.49, y = 41.79, f = "e", faction = "H" }, { npc = 3343, npcName = "Grelkor", map = 1459, x = 49.68, y = 82.46, f = "e", faction = "H" } } },
					},
				},
				{
					title = "Night Run",
					note = "Senani Thunderheart stands at Night Run, the Warsong camp just north-east of Splintertree, beside the hunt board.",
					goals = {
						{ t = "turnin", quest = 6382, title = "The Ashenvale Hunt", npc = 12696, npcName = "Senani Thunderheart", map = 1440, x = 73.78, y = 61.46, f = "e", note = "Senani Thunderheart" },
						{ t = "accept", quest = 6383, title = "The Ashenvale Hunt", npc = 12696, npcName = "Senani Thunderheart", minLevel = 20, qlvl = 20, map = 1440, x = 73.78, y = 61.46, f = "e" },
						{ t = "turnin", quest = 6383, title = "The Ashenvale Hunt", npc = 12696, npcName = "Senani Thunderheart", map = 1440, x = 73.78, y = 61.46, f = "e" },
						{ t = "note", text = "Senani's hunt targets (Ursangous, Shadumbra, Sharptalon) are for the next Ashenvale visit, at 27." },
					},
				},
				{
					title = "Warsong Outrider",
					note = "The Warsong Outrider patrols the road east of Night Run toward the Satyrnaar.",
					goals = {
						{ t = "collect", quest = 6543, title = "The Warsong Reports", item = 16765, itemName = "Warsong Outrider Update", oi = 3, map = 1440, x = 81.83, y = 53.51, f = "e", note = "Warsong Outrider" },
					},
				},
				{
					title = "Zoram'gar Outpost",
					note = "Ride west along the main road across Ashenvale, past Astranaar (Alliance: keep to the road), to the coast. Zoram'gar Outpost is on the Zoram Strand in the north-west. Its other quests are for the next visit, at 27.",
					goals = {
						{ t = "getfp", location = "Zoram'gar Outpost" },
						{ t = "collect", quest = 6543, title = "The Warsong Reports", item = 16763, itemName = "Warsong Runner Update", oi = 1, map = 1440, x = 12.22, y = 34.22, f = "e", note = "Warsong Runner" },
						{ t = "accept", quest = 6442, title = "Naga at the Zoram Strand", npc = 12719, npcName = "Marukai", minLevel = 14, qlvl = 19, map = 1440, x = 11.69, y = 34.91, f = "e", note = "Marukai" },
					},
				},
				{
					title = "Naga heads",
					note = "Every Wrathtail naga along the strand north of the outpost drops heads.",
					goals = {
						{ t = "collect", quest = 6442, title = "Naga at the Zoram Strand", item = 5490, itemName = "Wrathtail Head", count = 20, oi = 1, map = 1440, x = 11.84, y = 31.86, f = "e", spots = { { x = 11.7, y = 31, r = 45, n = 3 }, { x = 8.9, y = 29.5, r = 59, n = 7 }, { x = 9.7, y = 25.3, r = 48, n = 5 }, { x = 11.8, y = 24.3, r = 40, n = 2 }, { x = 14.8, y = 22.8, r = 40, n = 2 }, { x = 14.9, y = 25.8, r = 41, n = 3 }, { x = 15.9, y = 15.8, r = 40, n = 2 }, { x = 13.5, y = 15.1, r = 42, n = 3 }, { x = 10.7, y = 13.6, r = 40, n = 1 }, { x = 8, y = 16.4, r = 40, n = 3 }, { x = 5.6, y = 14.5, r = 45, n = 5 }, { x = 6.4, y = 11.7, r = 46, n = 6 }, { x = 13.7, y = 30.9, r = 40, n = 1, alt = true }, { x = 11, y = 28.9, r = 45, n = 4, alt = true }, { x = 12.8, y = 28.8, r = 58, n = 5, alt = true }, { x = 11.3, y = 26.7, r = 40, n = 3, alt = true }, { x = 11, y = 25, r = 40, n = 2, alt = true }, { x = 14.5, y = 20.2, r = 42, n = 6, alt = true }, { x = 14.9, y = 17, r = 40, n = 3, alt = true }, { x = 7.5, y = 15.5, r = 65, n = 7, alt = true }, { x = 7.5, y = 13.4, r = 44, n = 8, alt = true } }, spread = true },
					},
				},
				{
					title = "Zoram'gar Outpost",
					goals = {
						{ t = "turnin", quest = 6442, title = "Naga at the Zoram Strand", npc = 12719, npcName = "Marukai", map = 1440, x = 11.69, y = 34.91, f = "e", note = "Marukai" },
					},
				},
				{
					title = "Back to Kadrak",
					note = "Fly to Splintertree Post and ride south down the road to the Mor'shan Rampart.",
					goals = {
						{ t = "fly", location = "Splintertree Post" },
						{ t = "turnin", quest = 6543, title = "The Warsong Reports", npc = 8582, npcName = "Kadrak", map = 1440, x = 68.6, y = 89.1, f = "e", note = "Kadrak" },
					},
				},
				{
					title = "Malaka'jin",
					note = "Ride south to the Crossroads, then west along the road out of the Barrens into Stonetalon. The troll village of Malaka'jin sits at the entrance of the canyon.",
					goals = {
						{ t = "accept", quest = 1058, title = "Jin'Zil's Forest Magic", npc = 3995, npcName = "Witch Doctor Jin'Zil", minLevel = 20, qlvl = 26, map = 1442, x = 74.54, y = 97.94, f = "e", note = "Witch Doctor Jin'Zil" },
					},
				},
				{
					title = "Ziz Fizziks",
					note = "The road climbs north as the Webwinder Path. Ziz Fizziks has a hut where the road forks east to Windshear Crag.",
					goals = {
						{ t = "turnin", quest = 1483, title = "Ziz Fizziks", npc = 4201, npcName = "Ziz Fizziks", map = 1442, x = 58.99, y = 62.6, f = "e", note = "Ziz Fizziks" },
						{ t = "accept", quest = 1093, title = "Super Reaper 6000", npc = 4201, npcName = "Ziz Fizziks", minLevel = 16, qlvl = 21, map = 1442, x = 58.99, y = 62.6, f = "e" },
					},
				},
				{
					title = "Windshear Crag",
					note = "East of Ziz, the Venture Company is clear-cutting Windshear Crag; one of the Operators carries the blueprints. Piznik mines in the small mine on the east side: stay with him while he mines, Venture Co. thugs come for him.",
					goals = {
						{ t = "collect", quest = 1093, title = "Super Reaper 6000", item = 5734, itemName = "Super Reaper 6000 Blueprints", count = 1, oi = 1, map = 1442, x = 62.51, y = 53.84, f = "e", spots = { { x = 62.6, y = 53.7, r = 40, n = 2 }, { x = 61.8, y = 51.7, r = 40, n = 2 }, { x = 66.3, y = 51.9, r = 43, n = 3 }, { x = 66.7, y = 45.5, r = 40, n = 2 }, { x = 70.9, y = 42.8, r = 40, n = 2 }, { x = 73.1, y = 49, r = 40, n = 2 }, { x = 71.7, y = 49.9, r = 40, n = 2 }, { x = 74.3, y = 54.5, r = 40, n = 2 }, { x = 75.4, y = 56.4, r = 40, n = 2 }, { x = 73.3, y = 56.7, r = 40, n = 1 }, { x = 70, y = 55.9, r = 40, n = 1 } }, spread = true },
						{ t = "accept", quest = 1090, title = "Gerenzo's Orders", npc = 4276, npcName = "Piznik", minLevel = 17, qlvl = 22, map = 1442, x = 71.87, y = 60, f = "e", note = "Piznik" },
						{ t = "complete", quest = 1090, title = "Gerenzo's Orders" },
						{ t = "turnin", quest = 1090, title = "Gerenzo's Orders", npc = 4276, npcName = "Piznik", map = 1442, x = 71.87, y = 60, f = "e" },
						{ t = "accept", quest = 1092, title = "Gerenzo's Orders", npc = 4276, npcName = "Piznik", minLevel = 17, qlvl = 22, pre = { 1090 }, preTitles = { [1090] = "Gerenzo's Orders" }, map = 1442, x = 71.87, y = 60, f = "e" },
					},
				},
				{
					title = "Ziz Fizziks",
					goals = {
						{ t = "turnin", quest = 1092, title = "Gerenzo's Orders", npc = 4201, npcName = "Ziz Fizziks", map = 1442, x = 58.99, y = 62.6, f = "e", note = "Ziz Fizziks" },
						{ t = "turnin", quest = 1093, title = "Super Reaper 6000", npc = 4201, npcName = "Ziz Fizziks", map = 1442, x = 58.99, y = 62.6, f = "e" },
						{ t = "accept", quest = 1094, title = "Further Instructions", npc = 4201, npcName = "Ziz Fizziks", minLevel = 16, qlvl = 21, pre = { 1093 }, preTitles = { [1093] = "Super Reaper 6000" }, map = 1442, x = 58.99, y = 62.6, f = "e", note = "Sputtervalve in Ratchet: the next guide passes there" },
					},
				},
				{
					title = "Sun Rock Retreat",
					note = "Follow the road west to Sun Rock Retreat.",
					goals = {
						{ t = "getfp", location = "Sun Rock Retreat" },
						{ t = "sethome", location = "Sun Rock Retreat" },
						{ t = "accept", quest = 5881, title = "Calling in the Reserves", npc = 11860, npcName = "Maggran Earthbinder", minLevel = 23, qlvl = 28, map = 1442, x = 47.2, y = 61.16, f = "e", note = "Maggran Earthbinder: Grish is at the Great Lift, in the next guide" },
						{ t = "accept", quest = 6282, title = "Harpies Threaten", npc = 11860, npcName = "Maggran Earthbinder", minLevel = 18, qlvl = 26, map = 1442, x = 47.2, y = 61.16, f = "e" },
						{ t = "accept", quest = 86576, title = "Bloodfury Trinkets", npc = 11860, npcName = "Maggran Earthbinder", minLevel = 18, qlvl = 26, map = 1442, x = 47.2, y = 61.16, f = "e", note = "Maggran Earthbinder: Glittering Sunstones from the Bloodfury harpies" },
						{ t = "accept", quest = 1087, title = "Cenarius' Legacy", npc = 4198, npcName = "Braelyn Firehand", minLevel = 20, qlvl = 25, map = 1442, x = 45.94, y = 60.42, f = "e", note = "Braelyn Firehand, outside the gate" },
						{ t = "accept", quest = 6393, title = "Elemental War", npc = 11862, npcName = "Tsunaman", minLevel = 19, qlvl = 25, map = 1442, x = 47.36, y = 64.25, f = "e", note = "Tsunaman" },
						{ t = "accept", quest = 6562, title = "Trouble in the Deeps", npc = 11862, npcName = "Tsunaman", minLevel = 17, qlvl = 22, closedBy = { 6563 }, preTitles = { [6563] = "The Essence of Aku'Mai" }, map = 1442, x = 47.36, y = 64.25, f = "e", note = "Je'neu Sancrea at Zoram'gar, at 27" },
						{ t = "accept", quest = 6301, title = "Cycle of Rebirth", npc = 11864, npcName = "Tammra Windfield", minLevel = 17, qlvl = 23, map = 1442, x = 47.46, y = 58.38, f = "e", note = "Tammra Windfield" },
						{ t = "vendor", candidates = { { npc = 9549, npcName = "Borand", map = 1442, x = 45.36, y = 59.1, f = "e", faction = "H" }, { npc = 4086, npcName = "Veenix", map = 1442, x = 58.22, y = 51.74, f = "e", faction = "AH" }, { npc = 4085, npcName = "Nizzik", map = 1442, x = 62.7, y = 40.18, f = "e", faction = "AH" }, { npc = 3093, npcName = "Grod", map = 1456, x = 42.66, y = 43.51, f = "e", faction = "H" }, { npc = 8878, npcName = "Muuran", map = 1443, x = 55.59, y = 56.5, f = "e", faction = "H" }, { npc = 3682, npcName = "Vrang Wildgore", map = 1413, x = 43.8, y = 12.21, f = "e", faction = "H" }, { npc = 14754, npcName = "Kelm Hargunth", map = 1413, x = 46.65, y = 8.38, f = "e", faction = "H" }, { npc = 3684, npcName = "Pizznukle", map = 1413, x = 41.77, y = 38.62, f = "e", faction = "AH" }, { npc = 12045, npcName = "Hae'Wilani", map = 1443, x = 25.8, y = 71.02, f = "e", faction = "H" }, { npc = 3078, npcName = "Kennah Hawkseye", map = 1412, x = 44.98, y = 61.97, faction = "H" }, { npc = 6028, npcName = "Burkrum", map = 1440, x = 73.54, y = 60.31, f = "e", faction = "H" }, { npc = 3477, npcName = "Hraq", map = 1413, x = 51.13, y = 28.96, f = "e", faction = "H" }, { npc = 3074, npcName = "Varia Hardhide", map = 1412, x = 43.86, y = 77.65, faction = "H" }, { npc = 10379, npcName = "Altsoba Ragetotem", map = 1448, x = 34.81, y = 53.16, f = "e", faction = "H" }, { npc = 10380, npcName = "Sanuye Runetotem", map = 1413, x = 45.12, y = 59.01, f = "e", faction = "H" }, { npc = 3658, npcName = "Lizzarik", map = 1413, x = 61.76, y = 38.29, f = "e", faction = "AH" }, { npc = 3349, npcName = "Ukra'nor", map = 1454, x = 29.74, y = 74.17, f = "e", faction = "H" }, { npc = 3161, npcName = "Rarc", map = 1411, x = 40.48, y = 67.82, f = "e", faction = "H" }, { npc = 5816, npcName = "Katis", map = 1454, x = 44.18, y = 48.44, f = "e", faction = "H" }, { npc = 8159, npcName = "Worb Strongstitch", map = 1444, x = 74.71, y = 42.58, f = "e", faction = "H" }, { npc = 3319, npcName = "Sana", map = 1454, x = 55.97, y = 72.73, f = "e", faction = "H" }, { npc = 3316, npcName = "Handor", map = 1454, x = 62.88, y = 44.69, f = "e", faction = "H" }, { npc = 9552, npcName = "Zanara", map = 1445, x = 35.5, y = 30.09, f = "e", faction = "H" }, { npc = 3167, npcName = "Wuark", map = 1411, x = 51.9, y = 41.14, f = "e", faction = "H" }, { npc = 3360, npcName = "Koru", map = 1454, x = 81.48, y = 18.74, f = "e", faction = "H" }, { npc = 10361, npcName = "Gruul Darkblade", map = 1447, x = 22.22, y = 51.09, f = "e", faction = "H" }, { npc = 10369, npcName = "Trayexir", map = 1411, x = 56.47, y = 73.12, f = "e", faction = "H" }, { npc = 9551, npcName = "Starn", map = 1441, x = 44.89, y = 50.68, f = "e", faction = "H" }, { npc = 3000, npcName = "Gibbert", map = 1449, x = 44.1, y = 7.19, f = "e", faction = "AH" }, { npc = 12024, npcName = "Meliri", map = 1450, x = 51.18, y = 42.31, f = "e", faction = "AH" }, { npc = 15176, npcName = "Vargus", map = 1451, x = 51.23, y = 38.86, f = "e", faction = "AH" }, { npc = 11184, npcName = "Wixxrak", map = 1452, x = 61.72, y = 38.03, f = "e", faction = "AH" }, { npc = 3053, npcName = "Synge", map = 1441, x = 80.4, y = 77.01, f = "e", faction = "AH" }, { npc = 8131, npcName = "Blizrik Buckshot", map = 1446, x = 50.74, y = 27.53, f = "e", faction = "AH" }, { npc = 3537, npcName = "Zixil", map = 1416, x = 53.6, y = 98.7, f = "e", faction = "AH" }, { npc = 3539, npcName = "Ott", map = 1416, x = 58.9, y = 88.8, f = "e", faction = "H" }, { npc = 13219, npcName = "Jekyll Flandring", map = 1416, x = 62.84, y = 59.27, f = "e", faction = "H" }, { npc = 9555, npcName = "Mu'uta", map = 1417, x = 72.52, y = 33.35, f = "e", faction = "H" }, { npc = 9179, npcName = "Jazzrik", map = 1418, x = 42.47, y = 52.5, f = "e", faction = "AH" }, { npc = 9544, npcName = "Yuka Screwspigot", map = 1418, x = 4.9, y = 94.7, f = "e", faction = "AH" }, { npc = 2113, npcName = "Archibald Kava", map = 1420, x = 32.41, y = 65.66, f = "e", faction = "H" }, { npc = 2135, npcName = "Abe Winters", map = 1420, x = 60.22, y = 53.1, f = "e", faction = "H" }, { npc = 3522, npcName = "Constance Brisboise", map = 1420, x = 52.6, y = 55.77, f = "e", faction = "H" }, { npc = 3534, npcName = "Wallace the Blind", map = 1421, x = 46.5, y = 86.49, f = "e", faction = "AH" }, { npc = 3552, npcName = "Alexandre Lefevre", map = 1421, x = 44.6, y = 39.11, f = "e", faction = "H" }, { npc = 10856, npcName = "Argent Quartermaster Hasana", map = 1422, x = 26.6, y = 55.2, f = "e", faction = "AH" }, { npc = 10857, npcName = "Argent Quartermaster Lightspark", map = 1422, x = 42.84, y = 83.72, f = "e", faction = "AH" }, { npc = 11278, npcName = "Magnus Frostwake", map = 1422, x = 68.12, y = 77.57, f = "e", faction = "AH" }, { npc = 16376, npcName = "Craftsman Wilhelm", map = 1423, x = 71.24, y = 49.9, faction = "AH" }, { npc = 3536, npcName = "Kris Legace", map = 1424, x = 80.14, y = 38.89, f = "e", faction = "AH" }, { npc = 14737, npcName = "Smith Slagtree", map = 1425, x = 77.23, y = 80.13, f = "e", faction = "H" }, { npc = 1407, npcName = "Sranda", map = 1427, x = 82, y = 38.5, f = "e", faction = "H" }, { npc = 14624, npcName = "Master Smith Burninate", map = 1427, x = 38.8, y = 28.51, f = "e", faction = "AH" }, { npc = 1146, npcName = "Vharr", map = 1434, x = 32.36, y = 27.95, f = "e", faction = "H" }, { npc = 2482, npcName = "Zarena Cromwind", map = 1434, x = 28.34, y = 75.46, f = "e", faction = "AH" }, { npc = 2483, npcName = "Jaquilina Dramet", map = 1434, x = 35.75, y = 10.66, f = "e", faction = "AH" }, { npc = 14921, npcName = "Rin'wosho the Trader", map = 1434, x = 15.07, y = 16, f = "e", faction = "AH" }, { npc = 980, npcName = "Grimnal", map = 1435, x = 45.08, y = 50.43, f = "e", faction = "H" }, { npc = 1669, npcName = "Defias Profiteer", map = 1436, x = 43.47, y = 66.76, f = "e", faction = "AH" }, { npc = 4556, npcName = "Gordon Wendham", map = 1458, x = 61.49, y = 41.79, f = "e", faction = "H" }, { npc = 3343, npcName = "Grelkor", map = 1459, x = 49.68, y = 82.46, f = "e", faction = "H" } } },
					},
				},
				{
					title = "Gaea Seeds",
					note = "The Gaea Seeds lie in the grass around the southern shore of Mirkfallon Lake, north of Sun Rock.",
					goals = {
						{ t = "collect", quest = 6301, title = "Cycle of Rebirth", item = 16205, itemName = "Gaea Seed", count = 10, oi = 1, map = 1442, x = 49.74, y = 45.11, f = "e", spots = { { x = 49.1, y = 44.1, r = 55, n = 4 }, { x = 51.4, y = 41.9, r = 34, n = 2 }, { x = 46.5, y = 40.8, r = 83, n = 4 }, { x = 50.4, y = 37.7, r = 50, n = 3 }, { x = 47.5, y = 36.7, r = 52, n = 2 } } },
					},
				},
				{
					title = "Stonetalon Peak",
					note = "Follow the road north toward Stonetalon Peak. Antlered Coursers graze along the way; the Sap Beasts, Twilight Runners and Fey Dragons roam the woods below the Peak, and the Cenarion druids hold the grove there.",
					goals = {
						{ t = "collect", quest = 1058, title = "Jin'Zil's Forest Magic", item = 5585, itemName = "Courser Eye", count = 30, oi = 3, map = 1442, x = 46.76, y = 38.18, f = "e", spots = { { x = 46.8, y = 38.2, r = 43, n = 1 }, { x = 47.1, y = 31.6, r = 43, n = 1 }, { x = 46.7, y = 27.4, r = 43, n = 2 }, { x = 44.8, y = 23.7, r = 60, n = 5 }, { x = 45.5, y = 21, r = 43, n = 3 }, { x = 40.1, y = 15.3, r = 43, n = 1 }, { x = 40.3, y = 11.1, r = 44, n = 4 }, { x = 39.5, y = 8.3, r = 43, n = 4 }, { x = 40, y = 6, r = 43, n = 2 }, { x = 36.9, y = 16.5, r = 43, n = 2 }, { x = 51.1, y = 35.9, r = 43, n = 2 } }, spread = true },
						{ t = "collect", quest = 1058, title = "Jin'Zil's Forest Magic", item = 5582, itemName = "Stonetalon Sap", count = 5, oi = 1, map = 1442, x = 46.79, y = 29.51, f = "e", spots = { { x = 46.8, y = 29.5, r = 52, n = 1 }, { x = 36.8, y = 19.5, r = 69, n = 5 }, { x = 38.2, y = 15.4, r = 52, n = 1 }, { x = 40, y = 12.5, r = 52, n = 1 }, { x = 38.1, y = 10.1, r = 52, n = 2 }, { x = 33.9, y = 17.5, r = 100, n = 8 } }, spread = true },
						{ t = "collect", quest = 1058, title = "Jin'Zil's Forest Magic", item = 5584, itemName = "Twilight Whisker", count = 5, oi = 2, map = 1442, x = 39.57, y = 17.74, f = "e", spots = { { x = 39.6, y = 17.7, r = 47, n = 1 }, { x = 39, y = 12.1, r = 47, n = 1 }, { x = 33.9, y = 9, r = 53, n = 5 }, { x = 32, y = 11, r = 76, n = 8 } }, spread = true },
						{ t = "collect", quest = 1058, title = "Jin'Zil's Forest Magic", item = 5583, itemName = "Fey Dragon Scale", count = 1, oi = 4, map = 1442, x = 39.77, y = 13.76, f = "e", spots = { { x = 39.8, y = 13.8, r = 15, n = 1 }, { x = 37.4, y = 20.9, r = 15, n = 1 }, { x = 33.1, y = 13.2, r = 15, n = 1 }, { x = 25.6, y = 11.5, r = 15, n = 1 } }, spread = true },
						{ t = "kill", quest = 1087, title = "Cenarius' Legacy", target = "Son of Cenarius", npc = 4057, count = 4, oi = 1, map = 1442, x = 38.22, y = 11.42, f = "e", spots = { { x = 37.6, y = 12.3, r = 42, n = 3 }, { x = 35.6, y = 12.9, r = 17, n = 2 }, { x = 35.9, y = 10.5, r = 15, n = 1, alt = true }, { x = 35.4, y = 15.3, r = 15, n = 1, alt = true } } },
						{ t = "kill", quest = 1087, title = "Cenarius' Legacy", target = "Daughter of Cenarius", npc = 4053, count = 4, oi = 2, map = 1442, x = 38.31, y = 13.29, f = "e", spots = { { x = 38.3, y = 13.3, r = 15, n = 1 }, { x = 36.5, y = 13.1, r = 15, n = 1 }, { x = 36.7, y = 15.6, r = 15, n = 1 }, { x = 35.3, y = 11.6, r = 19, n = 2 } } },
						{ t = "kill", quest = 1087, title = "Cenarius' Legacy", target = "Cenarion Botanist", npc = 4051, count = 4, oi = 3, map = 1442, x = 36.97, y = 14.98, f = "e", spots = { { x = 36.5, y = 14.8, r = 28, n = 2 }, { x = 36.4, y = 11.9, r = 15, n = 1 }, { x = 34.7, y = 12.4, r = 15, n = 1 } } },
					},
				},
				{
					title = "Sun Rock Retreat",
					goals = {
						{ t = "hearth", location = "Sun Rock Retreat" },
						{ t = "turnin", quest = 6301, title = "Cycle of Rebirth", npc = 11864, npcName = "Tammra Windfield", map = 1442, x = 47.46, y = 58.38, f = "e", note = "Tammra Windfield" },
						{ t = "accept", quest = 6381, title = "New Life", npc = 11864, npcName = "Tammra Windfield", minLevel = 17, qlvl = 25, pre = { 6301 }, preTitles = { [6301] = "Cycle of Rebirth" }, map = 1442, x = 47.46, y = 58.38, f = "e" },
						{ t = "turnin", quest = 1087, title = "Cenarius' Legacy", npc = 4198, npcName = "Braelyn Firehand", map = 1442, x = 45.94, y = 60.42, f = "e", note = "Braelyn Firehand" },
						{ t = "note", text = "Braelyn's next quest, Ordanus, is on the Alliance side of Ashenvale. Skip it." },
					},
				},
				{
					title = "The Charred Vale",
					note = "South-west of Sun Rock lies the burned Charred Vale. Plant the Gaea Seeds in the dirt mounds on the valley floor; the fire elementals drop Incendrites. Bloodfury Harpies and Ambushers nest on the north side, Slayers and Roguefeathers to the south.",
					goals = {
						{ t = "interact", quest = 6381, title = "New Life", object = 177929, objName = "Gaea Dirt Mound", oi = 1, map = 1442, x = 37.8, y = 66.2, f = "e", spots = { { x = 36.4, y = 66.4, r = 69, n = 4 }, { x = 36.2, y = 70.8, r = 52, n = 3 }, { x = 34.4, y = 62.3, r = 62, n = 3 }, { x = 33.9, y = 69, r = 66, n = 4 }, { x = 34.2, y = 72.6, r = 27, n = 2 }, { x = 31.6, y = 62.8, r = 50, n = 2 }, { x = 36.6, y = 74.4, r = 15, n = 1, alt = true }, { x = 31, y = 68.6, r = 96, n = 8, alt = true }, { x = 30.5, y = 72.1, r = 55, n = 4, alt = true }, { x = 29, y = 63.7, r = 67, n = 3, alt = true } }, note = "Gaea Dirt Mounds" },
						{ t = "collect", quest = 6393, title = "Elemental War", item = 16312, itemName = "Incendrites", count = 10, oi = 1, map = 1442, x = 35.42, y = 66.27, f = "e", spots = { { x = 34.7, y = 63.3, r = 112, n = 3 }, { x = 37.3, y = 60.5, r = 78, n = 1 }, { x = 36.6, y = 50.6, r = 108, n = 4 }, { x = 44, y = 41, r = 78, n = 1 }, { x = 29.4, y = 65.6, r = 95, n = 4 }, { x = 31.7, y = 73.3, r = 92, n = 5 }, { x = 35.9, y = 72.9, r = 78, n = 2 } }, spread = true },
						{ t = "kill", quest = 6282, title = "Harpies Threaten", target = "Bloodfury Harpy", npc = 4022, count = 7, oi = 1, map = 1442, x = 35.25, y = 63.21, f = "e", spots = { { x = 34.9, y = 62, r = 78, n = 2 }, { x = 32.1, y = 65.1, r = 98, n = 4 }, { x = 31.7, y = 59.8, r = 78, n = 4 }, { x = 37.4, y = 49.1, r = 78, n = 1 }, { x = 37.8, y = 44.1, r = 78, n = 1 } }, spread = true },
						{ t = "kill", quest = 6282, title = "Harpies Threaten", target = "Bloodfury Ambusher", npc = 4025, count = 7, oi = 2, map = 1442, x = 32.07, y = 60.43, f = "e", spots = { { x = 32.1, y = 60.4, r = 15, n = 1 }, { x = 31.1, y = 58.6, r = 15, n = 1 }, { x = 30.1, y = 61.9, r = 40, n = 3 }, { x = 30.8, y = 65.3, r = 15, n = 1 } } },
						{ t = "kill", quest = 6282, title = "Harpies Threaten", target = "Bloodfury Slayer", npc = 4024, count = 7, oi = 3, map = 1442, x = 30.06, y = 67.49, f = "e", spots = { { x = 30.1, y = 68.6, r = 66, n = 2 }, { x = 27.8, y = 70.1, r = 77, n = 3 }, { x = 36.5, y = 68.4, r = 100, n = 5 } }, spread = true },
						{ t = "kill", quest = 6282, title = "Harpies Threaten", target = "Bloodfury Roguefeather", npc = 4023, count = 7, oi = 4, map = 1442, x = 29.49, y = 68.63, f = "e", spots = { { x = 29.8, y = 69.3, r = 51, n = 4 }, { x = 35, y = 69.9, r = 32, n = 3 }, { x = 35.2, y = 67.4, r = 33, n = 3 }, { x = 36.8, y = 67.7, r = 15, n = 1, alt = true } } },
						{ t = "collect", quest = 86576, title = "Bloodfury Trinkets", item = 277936, itemName = "Glittering Sunstone", count = 15, oi = 1, map = 1442, x = 29.49, y = 68.63, f = "e", spots = { { x = 29.3, y = 68.5, r = 59, n = 6 }, { x = 27.1, y = 69.3, r = 71, n = 10 }, { x = 30.5, y = 62.7, r = 58, n = 13 }, { x = 32.4, y = 65, r = 80, n = 10 }, { x = 35.3, y = 63.6, r = 40, n = 3 }, { x = 34.5, y = 61.4, r = 40, n = 3 }, { x = 31.4, y = 58.9, r = 50, n = 6 }, { x = 37.3, y = 65.7, r = 40, n = 1 }, { x = 36.9, y = 69.4, r = 40, n = 3 }, { x = 35, y = 70.3, r = 40, n = 3 }, { x = 37.4, y = 49.1, r = 40, n = 1 }, { x = 37.8, y = 44.1, r = 40, n = 1 }, { x = 30.3, y = 69.2, r = 40, n = 3, alt = true }, { x = 28.9, y = 70.6, r = 40, n = 3, alt = true }, { x = 35.1, y = 68.4, r = 40, n = 4, alt = true }, { x = 32.7, y = 60.2, r = 40, n = 5, alt = true }, { x = 36.2, y = 67.4, r = 46, n = 4, alt = true } }, spread = true, note = "Glittering Sunstone, from any Bloodfury harpy" },
					},
				},
				{
					title = "Sun Rock Retreat",
					goals = {
						{ t = "turnin", quest = 6381, title = "New Life", npc = 11864, npcName = "Tammra Windfield", map = 1442, x = 47.46, y = 58.38, f = "e", note = "Tammra Windfield" },
						{ t = "turnin", quest = 6393, title = "Elemental War", npc = 11862, npcName = "Tsunaman", map = 1442, x = 47.36, y = 64.25, f = "e", note = "Tsunaman" },
						{ t = "turnin", quest = 6282, title = "Harpies Threaten", npc = 11860, npcName = "Maggran Earthbinder", map = 1442, x = 47.2, y = 61.16, f = "e", note = "Maggran Earthbinder" },
						{ t = "turnin", quest = 86576, title = "Bloodfury Trinkets", npc = 11861, npcName = "Mor'rogal", map = 1442, x = 47.22, y = 64.04, f = "e", note = "Mor'rogal, beside Maggran" },
					},
				},
				{
					title = "Malaka'jin",
					note = "Ride back down the Webwinder Path to Malaka'jin.",
					goals = {
						{ t = "turnin", quest = 1058, title = "Jin'Zil's Forest Magic", npc = 3995, npcName = "Witch Doctor Jin'Zil", map = 1442, x = 74.54, y = 97.94, f = "e", note = "Witch Doctor Jin'Zil" },
					},
				},
				{
					title = "To the Undercity",
					note = "Ride east to the Crossroads and fly to Orgrimmar. Take the zeppelin from the towers outside Orgrimmar to Tirisfal Glades; the Undercity lies below the Ruins of Lordaeron. The bat handler is in the Trade Quarter.",
					goals = {
						{ t = "getfp", location = "Undercity" },
					},
				},
				{
					title = "Aelthalyste",
					note = "Aelthalyste stands in the War Quarter.",
					only = { classes = { "PRIEST" }, races = { "Scourge" } },
					goals = {
						{ t = "turnin", quest = 5646, title = "Devouring Plague", npc = 4606, npcName = "Aelthalyste", map = 1458, x = 49.26, y = 17.12, f = "e", note = "Aelthalyste: Dark Sacrifice" },
					},
				},
				{
					title = "Southpoint Tower",
					note = "If you already know the Tarren Mill flight path, fly there and skip this step. Otherwise leave the Undercity and ride south down the road through Silverpine Forest past the Sepulcher and Pyrewood. Where the road turns east into Hillsbrad, Deathstalker Lesh waits at Southpoint Tower.",
					goals = {
						{ t = "accept", quest = 494, title = "Time To Strike", npc = 2214, npcName = "Deathstalker Lesh", minLevel = 19, qlvl = 20, map = 1424, x = 20.79, y = 47.4, f = "e", optional = true, note = "Deathstalker Lesh: Darthalia in Tarren Mill" },
					},
				},
				{
					title = "Tarren Mill",
					note = "Follow the road east along the river, then north-east up into the hills to Tarren Mill.",
					goals = {
						{ t = "getfp", location = "Tarren Mill" },
						{ t = "sethome", location = "Tarren Mill" },
					},
				},
			},
		})
	end
	register()
end
