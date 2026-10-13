'use strict';
// What the exploration guides cover and in which order (general game
// knowledge: zone neighbours, roads, towns; for Forever's new zones, the
// ways in Blizzard and the guide sites describe: the Riverglades fork off the
// Redridge road and the Tanaris ship, Shen'dralas through the Valley of Bones,
// Hyjal through Darkwhisper Gorge, the Zephras Isle skyboats). Coordinates
// never come from here: every point is an overlay centre from the Forever
// client's map tables (areas.js), every flight master a TaxiNodes row
// (data/forever/travel.json). The generator fails when a name below does not
// match those tables.
//
// Bands follow the areas' own ExplorationLevel (median per zone): Eastern
// Kingdoms 1-30 is Elwynn ... Hillsbrad (medians 7-26), 30-45 Alterac ...
// Swamp of Sorrows (33-40), 45-60 the rest; Kalimdor 1-30 Durotar ...
// Thousand Needles, 30-45 Desolace, Feralas, Dustwallow Marsh, 45-60 Tanaris
// onwards. Moonglade's single area is level 15 but sits behind Felwood, so it
// goes with 45-60.
//
// A route is per faction (`Alliance` / `Horde`) where the two travel
// differently enough to want another zone order, else `both` with
// per-faction travel lines.
//
// Visit fields:
//   zone     zone map name (zones.json)
//   travel   how to get there: text, or { Alliance, Horde, both }
//   from     where the zone's tour starts when the player does not walk in
//            from the previous zone: { taxi: '<TaxiNodes short name>' },
//            { stop: '<transport stop name>' } or { area: '<area name>' }
//            (that area is visited first)
//   exit     { area: '<area name>' }: visited last, where the road to the
//            next zone leaves
//   tip      extra zone tip

const GUIDES = [
	{
		id: 'eastern-kingdoms-1-30',
		title: 'Exploration: Eastern Kingdoms 1-30',
		continent: 'Eastern Kingdoms',
		levels: [1, 30],
		next: 'eastern-kingdoms-30-45',
		intro: {
			both: 'Discovering an area gives experience scaled to its level, so this runs alongside leveling.',
			Alliance: 'Alliance starts in Elwynn Forest; dwarves and gnomes can begin at the Dun Morogh step.',
			Horde: 'Horde starts in Tirisfal Glades; orcs, trolls and tauren arrive by zeppelin from Orgrimmar.',
		},
		routes: {
			Alliance: {
				start: { area: 'Northshire Valley' },
				visits: [
					{ zone: 'Elwynn Forest', travel: 'Northshire Valley opens onto Elwynn Forest; Goldshire is south down the road.' },
					{ zone: 'Westfall', travel: 'Westfall borders Elwynn Forest to the west: follow the road out past the Westbrook Garrison.' },
					{ zone: 'Duskwood', travel: 'Duskwood is east of Westfall and south of Elwynn Forest. Its road runs east to Darkshire.' },
					{ zone: 'Redridge Mountains', travel: 'Redridge starts at Three Corners, where the roads from Elwynn Forest and Duskwood meet.' },
					{
						zone: 'Dun Morogh',
						from: { taxi: 'Ironforge' },
						travel: "Take the Deeprun Tram from Stormwind's Dwarven District to Ironforge (or fly to Ironforge), then leave the city through its gates.",
					},
					{ zone: 'Loch Modan', exit: { area: 'North Gate Pass' }, travel: 'Leave Dun Morogh east through the gate tunnel; it opens into Loch Modan at Algaz Station.' },
					{ zone: 'Wetlands', exit: { area: 'Dun Modr' }, travel: 'From Algaz Station, the road north through the Dun Algaz pass leads into the Wetlands.' },
					{
						zone: 'Hillsbrad Foothills',
						travel:
							'Cross the Thandol Span in northern Wetlands into the Arathi Highlands (level 30+ creatures off the road), follow the road west past Refuge Pointe and on into Hillsbrad Foothills.',
					},
					{ zone: 'Silverpine Forest', travel: 'Follow the road west from Hillsbrad past Southpoint Tower into Silverpine Forest, Horde country with Horde guards at the Sepulcher.' },
					{ zone: 'Tirisfal Glades', travel: "Silverpine's road north leads into Tirisfal Glades. Brill, Deathknell and the Undercity ruins are Horde ground." },
				],
			},
			Horde: {
				start: { area: 'Deathknell' },
				visits: [
					{ zone: 'Tirisfal Glades', travel: "Deathknell opens onto Tirisfal Glades; Brill is east along the road. Orcs, trolls and tauren arrive at the zeppelin tower by the Undercity." },
					{ zone: 'Silverpine Forest', travel: 'Silverpine Forest is south of Tirisfal Glades: follow the road south from Brill.' },
					{
						zone: 'Hillsbrad Foothills',
						travel: 'At the south end of Silverpine the road turns east into Hillsbrad Foothills by Southpoint Tower. Tarren Mill in the north-east is the Horde town; Southshore is Alliance.',
					},
					{
						zone: 'Wetlands',
						travel:
							"Walk east from Hillsbrad into the Arathi Highlands (level 30+ creatures off the road), south to the Thandol Span bridge, and across it into the Wetlands. Menethil Harbor is an Alliance town.",
					},
					{ zone: 'Loch Modan', exit: { area: 'North Gate Pass' }, travel: 'The Dun Algaz pass in south-eastern Wetlands leads down into Loch Modan by Algaz Station.' },
					{ zone: 'Dun Morogh', travel: "From Algaz Station take the tunnel west into Dun Morogh. Kharanos and Ironforge's gates are Alliance ground." },
					{
						zone: 'Duskwood',
						from: { stop: "Grom'gol" },
						travel:
							"Hearth or fly back to the Undercity (or go to Orgrimmar), take the zeppelin to Grom'gol Base Camp in Stranglethorn Vale and walk north along the road into Duskwood. Northern Stranglethorn is level 30+ off the road.",
					},
					{ zone: 'Westfall', travel: 'Westfall borders Duskwood to the west. Sentinel Hill is an Alliance town.' },
					{ zone: 'Elwynn Forest', travel: "Elwynn Forest is north of Westfall and Duskwood. Goldshire, Northshire Valley and Stormwind's gates are Alliance ground with guards." },
					{ zone: 'Redridge Mountains', travel: 'Go east through Elwynn Forest to Three Corners, where Redridge starts. Lakeshire is an Alliance town.' },
				],
			},
		},
	},
	{
		id: 'eastern-kingdoms-30-45',
		title: 'Exploration: Eastern Kingdoms 30-45',
		continent: 'Eastern Kingdoms',
		levels: [30, 45],
		next: 'eastern-kingdoms-45-60',
		intro: { both: 'Picks up in Hillsbrad Foothills, where the 1-30 guide leaves the Horde and passes the Alliance.' },
		routes: {
			both: {
				start: { area: "Corrahn's Dagger" },
				visits: [
					{
						zone: 'Alterac Mountains',
						travel: {
							Alliance: 'Fly to Southshore in Hillsbrad Foothills and walk north into the Alterac Mountains.',
							Horde: 'Fly to Tarren Mill in Hillsbrad Foothills and walk north into the Alterac Mountains.',
						},
					},
					{
						zone: 'Arathi Highlands',
						exit: { area: 'Thandol Span' },
						travel: {
							both: 'The Arathi Highlands lie east of the Alterac Mountains and Hillsbrad Foothills.',
							Alliance: 'Refuge Pointe in the middle is the Alliance town; Hammerfall in the east is Horde.',
							Horde: 'Hammerfall in the east is the Horde town; Refuge Pointe in the middle is Alliance.',
						},
					},
					{
						zone: 'Badlands',
						travel: {
							both: 'Cross the Thandol Span south into the Wetlands, go through the Dun Algaz pass into Loch Modan and take the road south out of Loch Modan into the Badlands.',
							Alliance: 'Faster: fly to Thelsamar in Loch Modan.',
							Horde: 'Kargath in the west is the Horde town.',
						},
					},
					{
						zone: 'Riverglades',
						travel:
							'The Riverglades lie east of the Badlands and the Burning Steppes: the way in is the fork east off the Redridge Mountains road (a ship also runs from Tanaris to Powderfuse Port, the neutral goblin port on its coast). Krol\'dok Stronghold is an ogre clan\'s outdoor dungeon.',
					},
					{
						zone: 'Stranglethorn Vale',
						from: { stop: "Grom'gol" },
						travel: {
							Alliance: 'Fly to Darkshire (or Stormwind) and take the road south out of Duskwood into northern Stranglethorn Vale.',
							Horde: "Take the zeppelin from Orgrimmar or the Undercity to Grom'gol Base Camp.",
						},
						tip: 'Booty Bay at the southern tip is a neutral goblin port with a boat to Ratchet.',
					},
					{
						zone: 'Swamp of Sorrows',
						travel: {
							both: 'Go back north into Duskwood and follow its road east through Deadwind Pass (level 50+ creatures off the road) into the Swamp of Sorrows.',
							Horde: 'Stonard is the Horde town.',
						},
					},
				],
			},
		},
	},
	{
		id: 'eastern-kingdoms-45-60',
		title: 'Exploration: Eastern Kingdoms 45-60',
		continent: 'Eastern Kingdoms',
		levels: [45, 60],
		intro: { both: 'Starts where the 30-45 guide ends, in the Swamp of Sorrows. The last area of this guide completes the Eastern Kingdoms map.' },
		routes: {
			both: {
				start: { taxi: 'Nethergarde Keep' },
				visits: [
					{ zone: 'Blasted Lands', travel: 'The Blasted Lands are south of the Swamp of Sorrows; the road arrives at Nethergarde Keep (Alliance).' },
					{ zone: 'Deadwind Pass', travel: 'Go back north through the Swamp of Sorrows and west into Deadwind Pass.' },
					{
						zone: 'Burning Steppes',
						exit: { area: 'Blackrock Mountain' },
						travel: "Continue west into Duskwood, north to Redridge Mountains and take the pass north out of Redridge into the Burning Steppes; Morgan's Vigil (Alliance) is near the top.",
					},
					{
						zone: 'Searing Gorge',
						travel: 'Cross Blackrock Mountain from the western Burning Steppes into the Searing Gorge: stay on the chain path inside, past the dungeon entrances.',
					},
					{
						zone: 'The Hinterlands',
						from: { taxi: 'Aerie Peak' },
						travel: {
							Alliance: 'Fly to Aerie Peak if you have it; otherwise fly to Southshore and walk north-east from Hillsbrad Foothills into the Hinterlands.',
							Horde: 'Fly to Revantusk Village if you have it; otherwise fly to Tarren Mill and walk east from Hillsbrad Foothills into the Hinterlands.',
						},
					},
					{
						zone: 'Western Plaguelands',
						travel: {
							Alliance: 'Walk back to Hillsbrad Foothills and north through the Alterac Mountains to Chillwind Camp in southern Western Plaguelands.',
							Horde: 'Walk back to Hillsbrad Foothills and north through the Alterac Mountains, or from Tirisfal Glades east past The Bulwark, into Western Plaguelands.',
						},
					},
					{
						zone: 'Eastern Plaguelands',
						travel: "Eastern Plaguelands lie east of Western Plaguelands, across the Thondroril River. Light's Hope Chapel in the east has flight masters for both factions.",
					},
				],
			},
		},
	},
	{
		id: 'kalimdor-1-30',
		title: 'Exploration: Kalimdor 1-30',
		continent: 'Kalimdor',
		levels: [1, 30],
		next: 'kalimdor-30-45',
		intro: {
			both: 'Discovering an area gives experience scaled to its level, so this runs alongside leveling.',
			Alliance: 'Alliance starts on Teldrassil; humans, dwarves and gnomes arrive by boat at Auberdine and can begin at the Darkshore step.',
			Horde: 'Horde starts in Durotar; tauren can begin at the Mulgore step, undead arrive by zeppelin at Orgrimmar.',
		},
		routes: {
			Alliance: {
				start: { area: 'Shadowglen' },
				visits: [
					{ zone: 'Teldrassil', travel: 'Shadowglen opens onto Teldrassil; Dolanaar is south along the road. Rut\'theran Village, at the foot of the tree, is reached through the portal in Darnassus.' },
					{ zone: 'Darkshore', from: { stop: 'Auberdine' }, travel: "Take the boat from Rut'theran Village to Auberdine." },
					{ zone: 'Ashenvale', travel: "Follow Darkshore's coast road south into Ashenvale. Astranaar is the Alliance town." },
					{ zone: 'Stonetalon Mountains', travel: 'The Stonetalon Mountains border Ashenvale to the south-west; Stonetalon Peak in the north is the Alliance flight point.' },
					{
						zone: 'The Barrens',
						travel: 'Walk east out of Stonetalon (or south out of Ashenvale) into the Barrens. The Crossroads and Camp Taurajo are Horde towns; Ratchet is a neutral port.',
					},
					{ zone: 'Durotar', travel: 'Cross the Southfury River east from the northern Barrens into Durotar: Horde country, with guards at Razor Hill, Sen\'jin Village and Orgrimmar.' },
					{ zone: 'Mulgore', travel: 'Go back west across the Barrens; the road west from Camp Taurajo climbs into Mulgore, tauren country with guards at Bloodhoof Village and Thunder Bluff.' },
					{ zone: 'Thousand Needles', travel: 'From the southern Barrens take the Great Lift down into Thousand Needles. Freewind Post is a Horde town.' },
				],
			},
			Horde: {
				start: { area: 'Valley of Trials' },
				visits: [
					{ zone: 'Durotar', travel: 'The Valley of Trials opens onto Durotar; Razor Hill is north along the road.' },
					{ zone: 'The Barrens', travel: 'Cross the Southfury River bridges west out of Durotar into the Barrens. Northwatch Hold in the east is an Alliance fort.' },
					{ zone: 'Mulgore', travel: 'The road west from Camp Taurajo climbs into Mulgore.' },
					{ zone: 'Stonetalon Mountains', travel: "Go back into the Barrens and west through Honor's Stand into the Stonetalon Mountains. Sun Rock Retreat is the Horde town; Stonetalon Peak in the north is Alliance." },
					{ zone: 'Ashenvale', travel: "The Talondeep Path tunnel in eastern Stonetalon leads north into Ashenvale. Splintertree Post and Zoram'gar Outpost are Horde; Astranaar is Alliance." },
					{ zone: 'Darkshore', travel: "Follow Ashenvale's road north-west to the coast and into Darkshore, Alliance country with guards at Auberdine." },
					{
						zone: 'Teldrassil',
						from: { stop: "Rut'theran Village" },
						travel: "Take the boat from Auberdine to Rut'theran Village. Teldrassil is night elf country: Dolanaar and Shadowglen have guards, and Darnassus is reached only through the portal in Rut'theran Village.",
					},
					{ zone: 'Thousand Needles', from: { taxi: 'Camp Taurajo' }, travel: 'Fly to Camp Taurajo and walk south through the Barrens to the Great Lift down into Thousand Needles.' },
				],
			},
		},
	},
	{
		id: 'kalimdor-30-45',
		title: 'Exploration: Kalimdor 30-45',
		continent: 'Kalimdor',
		levels: [30, 45],
		next: 'kalimdor-45-60',
		intro: { both: 'Picks up west of the Barrens, in Desolace, and ends in Dustwallow Marsh.' },
		routes: {
			both: {
				start: { area: 'Thunder Axe Fortress' },
				visits: [
					{
						zone: 'Desolace',
						travel: {
							Alliance: "Take the road south-west out of the Stonetalon Mountains into Desolace; Nijel's Point in the north is the Alliance town.",
							Horde: 'Fly to Sun Rock Retreat and take the road south-west into Desolace; Shadowprey Village on the west coast is the Horde town.',
						},
					},
					{
						zone: "Shen'dralas",
						from: { area: 'Valley of Bones' },
						travel: "Shen'dralas, the ruins between Desolace and Mulgore, is entered from southern Desolace through the Valley of Bones.",
					},
					{
						zone: 'Feralas',
						travel: {
							both: 'Go back into southern Desolace; the road continues south into Feralas.',
							Alliance: 'Feathermoon Stronghold on Sardor Isle is the Alliance town (boat from the Forgotten Coast).',
							Horde: 'Camp Mojache in the east is the Horde town.',
						},
					},
					{
						zone: 'Dustwallow Marsh',
						travel: {
							Alliance: 'Fly to Theramore (or take the boat from Menethil Harbor); Theramore Isle is the Alliance town.',
							Horde: 'Dustwallow Marsh is east of the southern Barrens; Brackenwall Village in the north-west is the Horde town.',
						},
					},
				],
			},
		},
	},
	{
		id: 'kalimdor-45-60',
		title: 'Exploration: Kalimdor 45-60',
		continent: 'Kalimdor',
		levels: [45, 60],
		intro: { both: 'Starts in Tanaris, south of Dustwallow Marsh. The last area of this guide completes the Kalimdor map.' },
		routes: {
			both: {
				start: { taxi: 'Gadgetzan' },
				visits: [
					{ zone: 'Tanaris', travel: 'Tanaris is south of Dustwallow Marsh and Thousand Needles. Gadgetzan is a neutral goblin town.' },
					{ zone: "Un'Goro Crater", travel: "From western Tanaris take the path down into Un'Goro Crater. Marshal's Refuge in the north is a neutral camp." },
					{ zone: 'Silithus', travel: "Silithus is west of Un'Goro Crater. Cenarion Hold is neutral." },
					{
						zone: 'Azshara',
						from: { area: 'Haldarr Encampment' },
						travel: {
							Alliance: 'Fly to Talrendis Point if you have it, otherwise to Astranaar, and walk east out of Ashenvale into Azshara.',
							Horde: 'Fly to Valormok if you have it, otherwise to Splintertree Post, and walk east out of Ashenvale into Azshara.',
						},
					},
					{ zone: 'Felwood', exit: { area: 'Felpaw Village' }, travel: 'Felwood is north of Ashenvale.' },
					{ zone: 'Moonglade', travel: "Take the Timbermaw Hold tunnel in northern Felwood through to Moonglade (druids: Teleport: Moonglade). Nighthaven is neutral." },
					{ zone: 'Winterspring', travel: 'The other exit of the Timbermaw Hold tunnel leads into Winterspring. Everlook is a neutral goblin town with flight masters for both factions.' },
					{ zone: 'Mount Hyjal', travel: "Mount Hyjal is reached from Winterspring through Darkwhisper Gorge in the south. It is Forever's endgame leveling zone." },
				],
			},
		},
	},
	{
		id: 'zephras-isle',
		title: 'Exploration: Zephras Isle',
		continent: 'Zephras Isle',
		levels: [1, 12],
		intro: { both: 'Zephras Isle is the Skyborne starting island, a world of its own in Skywall; anyone may visit, and its map counts towards exploring the world.' },
		routes: {
			both: {
				visits: [
					{
						zone: 'Zephras Isle',
						travel: {
							both: 'Skyborne start here. Everyone else takes a skyboat, about every five minutes; either faction may take either one.',
							Alliance: 'The skyboat leaves the north side of Dalaran in the Alterac Mountains (another flies from north of Thunder Bluff).',
							Horde: 'The skyboat leaves the cliffs south of Skywatcher Plateau, north of Thunder Bluff (another flies from Dalaran).',
						},
					},
				],
			},
		},
	},
];

// Towns with guards of one faction. The other faction only needs to touch an
// area's edge for the discovery, so its goal says so. Names as AreaTable has them.
const TOWNS = {
	Horde: [
		'Valley of Trials',
		"Sen'jin Village",
		'Razor Hill',
		'Orgrimmar',
		'Bloodhoof Village',
		'Thunder Bluff',
		'The Crossroads',
		'Camp Taurajo',
		'Deathknell',
		'Brill',
		'Ruins of Lordaeron',
		'The Sepulcher',
		'Tarren Mill',
		'Hammerfall',
		'Kargath',
		"Grom'gol Base Camp",
		'Stonard',
		'Sun Rock Retreat',
		"Malaka'jin",
		'Freewind Post',
		'Shadowprey Village',
		'Camp Mojache',
		'Brackenwall Village',
		'Valormok',
	],
	Alliance: [
		'Northshire Valley',
		'Goldshire',
		'Stormwind City',
		'Coldridge Valley',
		'Kharanos',
		'Gates of Ironforge',
		'Thelsamar',
		'Sentinel Hill',
		'Lakeshire',
		'Darkshire',
		'Menethil Harbor',
		'Southshore',
		'Refuge Pointe',
		'Aerie Peak',
		'Nethergarde Keep',
		"Morgan's Vigil",
		'Shadowglen',
		'Dolanaar',
		'Darnassus',
		"Rut'theran Village",
		'Auberdine',
		'Astranaar',
		'Theramore Isle',
		"Nijel's Point",
		'Stonetalon Peak',
		'Sardor Isle',
		'Talonbranch Glade',
	],
};

// Areas with a hazard beyond their level (general game knowledge).
const CAUTIONS = {
	'Stromgarde Keep': 'elite Syndicate and ogres inside the walls: the discovery triggers at the gate',
	"Mosh'Ogg Ogre Mound": 'elite ogres: discover it from the edge',
	'Gurubashi Arena': 'free-for-all PvP inside the arena ring',
	"Jintha'Alor": 'elite trolls on the upper terraces: discover it from the bottom',
	'Blackrock Stronghold': 'elite Blackrock orcs: discover it from the edge',
	'Grim Batol': 'the discovery triggers at the Dragonmaw Gates: do not go into Grim Batol itself',
	'Karazhan': 'high-level undead around the tower: discover it from the road',
};

// Zone maps that are a world of their own, on no continent (UiMap names):
// each gets explored like a continent.
const ISLANDS = ['Zephras Isle'];

const LEGACY_NOTE =
	'Exploring the entire world map on one character is a Forever Legacy Challenge (1 account-wide Legacy Point).';

module.exports = { GUIDES, TOWNS, CAUTIONS, ISLANDS, LEGACY_NOTE };
