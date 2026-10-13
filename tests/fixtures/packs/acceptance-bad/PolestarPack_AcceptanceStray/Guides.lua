-- One guide of its own, and one under our forever/ prefix that Polestar
-- refuses: our guide of that id stays.
Polestar.RegisterGuide({
	id = "acceptance-stray/walk",
	pack = "acceptance-stray",
	title = "A Walk",
	faction = "Alliance",
	minLevel = 5,
	maxLevel = 10,
	category = "Exploration",
	steps = { { goals = { { t = "goto", map = 1429, x = 42.9, y = 65.6 } } } },
})
Polestar.RegisterGuide({
	id = "forever/alliance/02-westfall",
	pack = "acceptance-stray",
	title = "Not Westfall",
	faction = "Alliance",
	minLevel = 7,
	maxLevel = 16,
	steps = { { goals = { { t = "goto", map = 1436, x = 56.3, y = 47.5 } } } },
})
