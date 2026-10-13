# Polestar guide format (v1)

Guides are written as `.guide` text files under `guides/` and compiled to Lua
by `node tools/polestar.js compile`. The compiler fills in names, titles and
coordinates from the reference data in `data/forever/`, so a line can be as
short as `accept 783`. Anything you write explicitly wins over the data.

```
guide forever/alliance/human/01-northshire
title Northshire Valley
faction Alliance
race Human
levels 1-6
zone Elwynn Forest
next forever/alliance/human/02-elwynn

step Deputy Willem
  accept 783                          -- He stands at the abbey gate
  turnin 783
  accept 7
  accept 5261 npc 196

step Kobold camp
  tip Pull one kobold at a time until level 3.
  goto 47.6,35.1 "Kobold camp"
  kill 6 x10 quest 7.1
  collect 750 x8 quest 33.1 optional

step Back to the abbey
  turnin 7
  train only Warrior,Paladin          -- Llane Beshere is inside the abbey
  level 4
```

## Lexical rules

- UTF-8, one guide per file. Blank lines are ignored.
- `#` starts an author comment (dropped) when it is the first non-blank
  character of a line or follows whitespace outside a quoted string.
- ` -- ` (space, two dashes, space) starts a **player-facing note** for the
  goal on that line; the rest of the line is the note.
- Header lines and `step` lines start in column 0. Lines inside a step are
  indented (any spaces or tabs).
- Tokens are whitespace-separated. `"double quoted"` is one token, with `\"`
  and `\\` escapes. Keywords are case-insensitive; IDs are integers.

## Header

Every line before the first `step`.

| Key | Required | Value |
|---|---|---|
| `guide` | yes, first line | id: `[a-z0-9/_-]+`, unique across all guides |
| `title` | yes | rest of line |
| `levels` | yes | `<min>-<max>` |
| `zone` | yes | default zone: map name from `data/forever/zones.json`, or `map <uiMapID>` |
| `faction` | no | `Alliance` or `Horde` |
| `race` | no | comma list (see Conditions) |
| `class` | no | comma list |
| `next` | no | id of the guide that follows, or several ids separated by commas: a **route choice**. The player picks where to level next in the "Choose your path" window; the first id is the author's default. Every option must be the guide's own faction. |
| `category` | no | default `Leveling`; others: `Professions`, `Reputation`, `Legacy`, `Exploration`, `Collectibles`, `Dungeons` |
| `folder` | no | the guide menu folder this guide is listed under, any category (e.g. `Mounts · Level 40`, `Companion pets · Vendors`). Guides sharing a folder sort by faction (yours first), then level. Without it: the category's folder (Leveling: by faction and level band). |
| `keywords` | no | comma list of extra words the guide menu search matches (e.g. the colours a mount guide covers); an empty entry is an error, a repeated one a warning |
| `collects` | no | comma list of item ids this guide obtains (a mount guide: every colour it sells). Compiled as `collects = { ... }`; the Lookup module opens this guide for those items instead of building one. Malformed or repeated ids are errors; an id missing from `items.json` is a warning. |
| `author` | no | default `Polestar` |
| `version` | no | integer, default `1` |
| `coords` | no | `era` (default) or `live`: the map frame of coordinates typed in this guide (`@x,y`, `goto`, `explore`). Era-frame ones compile with `f = "e"`; on a map without Era bounds they compile live. `record draft` writes `coords live`. |
| `pitch` | no | one line selling the zone, shown on its card in the route choice window (required, as a warning, when the guide is a route option) |
| `pro` / `con` | no | repeatable: one advantage / disadvantage per line, shown under the pitch. Keep them short, factual and true for every race that can choose the route. |

A route choice, as excerpts of two guides' headers:

```
# guides/forever/horde/undead/01-tirisfal.guide
next forever/horde/02-barrens, forever/horde/02-silverpine

# guides/forever/horde/02-silverpine.guide
pitch Undercity's backyard: a compact forest with the Forsaken's own story and short walks between quests.
pro Ends in the Undercity, where the next guide starts: no zeppelin ride
con Hunters, Shamans and Druids have no trainer here: they train next in Orgrimmar at about 22
```

Characters arrive at a route option from any of its predecessors, so its
turn-ins of earlier quests must not assume one starting zone; the engine skips
a turn-in or objective for a quest the character never had (see ARCHITECTURE,
"Route choice").

## Steps

```
step [title]
  <directive | goal> ...
```

Step directives:

| Directive | Effect |
|---|---|
| `zone <Name>` / `zone map <uiMapID>` | Current zone for coordinates from here on (sticky across later steps). |
| `only <cond>[,<cond>...]` | The step applies only to matching characters. |
| `tip <text>` | Player-facing step note (compiled to `step.note`). |

A step must contain at least one goal.

## Goals

```
<verb> <positional args> <modifiers...> [-- note]
```

| Verb | Positional | Notes |
|---|---|---|
| `accept` | `<questId> ["Title"]` | Title and quest giver from data; a quoted title overrides it (required if the quest is not in data). |
| `turnin` | `<questId> ["Title"]` | Turn-in NPC/object from data. |
| `complete` | `<questId> ["Title"]` | Finish all objectives. |
| `kill` | `<npcId>` or `"Target name"` | Pair with `quest Q.O` to track a quest objective. |
| `collect` | `<itemId> ["Item name"]` | Pair with `quest Q.O`; otherwise tracked by bag count `xN`. `collect <item> xN nearest` (no `quest`) compiles to farm spots: clusters of normal or rare mobs that drop the item at 2% or more, outside towns and guard posts, each with the zone's safety (`A`/`H` faction zone, `AH` contested), mob level range, items per kill and spawn count; at most 16 per continent, spread over safety and 10-level bands. The engine picks one by the player's level, faction and travel time. |
| `goto` | `<x>,<y> ["Label"]` | Coordinates are mandatory here. |
| `talk` | `<npcId>` | |
| `interact` | `<objectId>` | Click a game object. |
| `use` | `<itemId> ["Item name"]` | |
| `sethome` | `"Location"` or `nearest` | Inn location as the game names it, e.g. `"Goldshire"`. `sethome nearest` binds at the nearest own-faction inn when the step comes up. |
| `hearth` | `"Location"` | |
| `getfp` | `"Location"` | Discover a flight path. |
| `fly` | `"Location"` | Take a flight. |
| `train` | `[npcId]`, `<Profession> [Rank]`, or `class` | `train First Aid` / `train Mining Expert`: the nearest own-faction trainer of that profession and rank (`Apprentice`, `Journeyman`, `Expert`, `Artisan`; ranks taught by a book or quest point at its vendor or quest giver). Without a rank: the highest rank whose minimum skill (0/50/125/225) the last earlier `skill` (or `craft … until`) target for that profession in the guide reaches, Apprentice when there is none, and always above a rank the guide already trained. `train class`: the nearest trainer of the player's class. Resolved at runtime from the player's faction and position. |
| `buy` | `<itemId> ["Item name"]` | Use `xN` for quantity. Add `nearest` to send the player to the closest own-faction vendor selling it. |
| `vendor` | `[npcId]` or `nearest` | Sell junk / repair; `nearest` picks the closest own-faction vendor. |
| `level` | `<N>` | Reach level N (grind if needed). |
| `note` | `<text...>` | Informational line; never blocks. Quotes optional. |
| `skill` | `<Profession> <N>` | Reach skill rank N (`Alchemy`, `Blacksmithing`, `Enchanting`, `Engineering`, `Herbalism`, `Leatherworking`, `Mining`, `Skinning`, `Tailoring`, `Cooking`, `Fishing`, `First Aid`, quoted when multi-word). |
| `learn` | `<spellId> ["Name"]` | Learn a recipe or spell (trainer or recipe item); name from `professions.json`. |
| `craft` | `<spellId> ["Name"]` | Craft a recipe; `x<N>` crafts, or `until <N>` = until the recipe's profession reaches N. |
| `rep` | `<Faction> <Standing>` | Reach a standing (`Neutral`, `Friendly`, `Honored`, `Revered`, `Exalted`) with a faction named in `factions.json`, or `rep <factionId> <Standing>`. |
| `explore` | `<x>,<y> ["Area"]` | Discover the map area at those coordinates (current zone). |
| `achieve` | `<achievementId> ["Name"]` | Complete an achievement / Legacy Challenge; `criteria <n>` targets one criterion. |

**Smart targets.** `nearest` (and the profession/class forms of `train`) compile to a
*candidate set* instead of one NPC: every matching NPC in the data with its faction.
At runtime the engine keeps the candidates the character may use (faction, and race
or class where it matters) and picks the cheapest by travel time from where the
player stands, re-deciding on zone changes. Explicit npc ids stay fixed. Profession
guides should use these forms instead of per-race branches.
Sources: profession trainers from `professions.json`; class trainers from
`trainers.json` (`node tools/polestar.js trainers build`: `train <npcId> only <Class>`
goals in `guides/`, recorded trainer visits, and a curated list verified against
`npcs.json`; without the file, the curated list); innkeepers from the `innkeeper`
and `vendor nearest` from the `repair` role in `npcs.json`; `buy … nearest` from the
item's `vendors`; `collect … nearest` from the item's droppers (see `collect`). Only
factions the goal can apply to are kept, and each set keeps one candidate per town
(within 250 yards), nearest to the previous goal first.
Smart targets take no coordinates.

Modifiers, in any order after the positional arguments:

| Modifier | Meaning |
|---|---|
| `@x,y` or `@ x,y` | Coordinates (0–100) in the current zone. |
| `map <uiMapID>` | Zone for this goal's `@` coordinates only. |
| `npc <id>` / `object <id>` / `item <id>` | Explicit entity (e.g. which quest giver). |
| `quest <id>` / `quest <id>.<objective>` | Quest objective link (1-based objective). |
| `x<N>` | Count. |
| `"text"` | Display text override (for `goto`: the label). A quoted token directly after the entity id of `kill`, `talk`, `interact`, `train` or `vendor` (like `collect`/`use`/`buy`) names that entity instead, for new Forever content missing from the data. |
| `r <yards>` | Arrival radius (`goto`, default 8). |
| `lvl <N>` | Minimum level shown on an `accept`. |
| `optional` | Never blocks the step. |
| `only <cond>[,<cond>...]` | Goal applies only to matching characters. |
| `era` / `live` | Map frame of this goal's typed coordinates, overriding `coords`. |
| `choose <item> ["Name"] [quality] ...` | `turnin` only: the reward choices, shown under the turn-in and in its tooltip. Each entry is an item id, optionally its quoted name and a quality word (`poor` `common` `uncommon` `rare` `epic` `legendary` `artifact` `heirloom`); entries follow one another (`choose 6480 918 "Deviate Hide Pack" common`). Names and qualities default to `items.json`; an id missing there needs its name. Display only: a named unknown id is not a warning. |
| `reward <item> ["Name"] [quality] ...` | `turnin` only: items given outright, same entries as `choose`. |
| `xp <N>` | `turnin` only: the XP it pays. Shown with the rewards, and used for the route-level check when the quest has no `xp` in the data. |
| `money <amount>` | `turnin` only: copper (`money 350`) or `1g50s` / `7s` / `25c` forms. |

## Conditions

Comma-separated names, case-insensitive:

- Classes: `Warrior Paladin Hunter Rogue Priest Shaman Mage Warlock Druid`.
  A class may be negated with `!` (`only !Hunter`).
- Races: `Human Dwarf Gnome NightElf Orc Troll Tauren Undead Skyborne` (compiled
  to the client's race file names, UnitRace's second return; `Undead` →
  `Scourge`). Skyborne plays on both sides: a guide's `faction` or an `only`
  faction picks the side. Unknown race names are passed through with a warning
  (new Forever races).
- Factions: `Alliance Horde`.

Classes OR together, races OR together, factions OR together; the three groups
AND. `only Warrior,Paladin,Dwarf` = (Warrior or Paladin) and Dwarf.

## What the compiler fills in

| Missing | Filled from |
|---|---|
| quest title | `quests.json` |
| quest giver / turn-in target | `start` / `end` of the quest; `npc`/`object` modifiers pick one explicitly |
| coordinates | the target's spawns, trying maps in order: the current zone, then maps the guide already used (most recent first), then anywhere. On the chosen map: the spawn nearest the previous goal when that goal is on the same map, else the centroid of the highest-priority candidate |
| `kill` target name | `npcs.json` |
| `collect` coordinates | every drop source with spawns, ranked as above (zone, used maps, nearness), then by drop chance |
| `collect` source `from`, `fromKind`, `fromRank`, `fromFaction` | a `collect` outside a quest objective whose item has one source with spawns, or one that drops it at 50% or more: the source's name, `npc` or `object`, the NPC's rank (1 elite, 2 rare elite, 3 boss, 4 rare) and faction (`A`, `H`, `AH`; none for a hostile mob). The guide window says "Kill Aean Swiftriver (rare elite)" for an enemy, "From <name>" otherwise; a quest started by that item reads as one line ("Runed Scroll: kill Aean Swiftriver (rare elite)") |
| profession, recipe, trainer | `professions.json` (skill line, recipe name, created item, reagents, recipe item; a `learn` from a trainer gets the nearest trainer of the guide's faction in the current zone or a used map). Classic profession names resolve without it. |
| faction | `factions.json` by name (lowest id on ties) or id |
| objective index | the quest's objective whose `id` matches the npc/item, when `quest Q` has no `.O` |
| count | the linked objective's count |
| Era frame flag `f = "e"` | when coordinates come from Era-frame data, or were typed in an `era` guide/goal |
| spawn areas `spots` | `kill` goals and mob-drop `collect` goals whose coordinates come from the data (not `@x,y`): see "Spawn areas" below |

**Spawn areas.** Mobs usually spawn over a wide area, so a kill or mob-drop
collect goal also gets the areas they spawn in: `spots = { { x, y, r, n }, ... }`,
each the centre (map percent, in the goal's own `map` and frame `f`), radius in
yards covering its spawns, and spawn count of one cluster of the target's spawns
(for `collect`: the likely droppers' spawns on that map, as chosen above). The
clusters come from the quest database's clustering (`tools/lib/questdb/cluster.js`):
70 yd, widened for thinly spread mobs to twice the median spacing between
neighbouring spawns (at most 250 yd). Same map only. The goal keeps its `x`/`y`
as the default point. A target with fewer than two spawns on the map (a named
NPC) and hand-placed `@x,y` goals get no `spots`.

- **Camps** (90% of the spawns within 250 yd of their centre): radius at least
  15 yd, lone spawns dropped when any cluster holds two or more, nearest to the
  goal's `x`/`y` first, at most 6. At runtime the waypoint is the spot nearest
  the player and the arrow counts the whole area as arrived.
- **Area objectives** (spawns reaching further: raptors all over the northern
  Barrens) also get `spread = true`. Every cluster counts, lone spawns too,
  each at least as wide as the spacing between spawns (40-150 yd); beyond 12
  the kept ones are spread evenly over the area (farthest-point picks from the
  cluster nearest the goal's point), then ordered as a walk from the goal's
  point. At runtime the player searches spot by spot: the arrow says "Search
  here" inside a spot (never "Arrived"), moves on to the nearest spot not
  visited lately once the player leaves it, and the world map marks every spot.

See docs/ARCHITECTURE.md, Smart logic, "Spawn areas".

## Validation

Errors fail `compile` and `lint`; warnings print.

Errors:
- syntax errors, unknown verbs or modifiers, malformed IDs or coordinates
- duplicate guide ids; `next` pointing to an unknown guide
- a step with no goals
- quest, npc, item or object id unknown in data **and** no explicit name/title
- profession, faction or spell unknown in data **and** no quoted name; a faction
  not in `factions.json` also needs its id (`rep <factionId> "Name" <Standing>`);
  `achieve` always needs its quoted name
- `rep` standing outside 1–8 / Hated–Exalted; `craft` with both `xN` and `until`
- empty quoted strings (names, titles, labels, notes)
- `era`/`live` on a goal without typed coordinates
- `choose`/`reward` without item ids, an item listed twice, a reward item missing from `items.json` without a name; malformed `money` or `xp`
- a smart target (`nearest`, `train <Profession>`, `train class`, `collect … nearest`) with no candidate
  in the data or with coordinates; `collect … nearest` without `xN` or with `quest`;
  `nearest`/`train class` with an `npc` (`train <Profession> npc <id>` keeps that
  trainer); an unknown profession in `train`
- `turnin`/`complete`/objective goals for a quest that is never accepted earlier
  in this guide or in a guide that chains into it via `next`
- `accept` for a quest whose `races`/`classes` exclude every character the
  step or goal can apply to
- coordinates outside 0–100
- required elite work in a `Leveling` guide (elite work may appear there only as
  an `optional` extra, with the tip `<Target> is elite: grouping up is advised.`):
  a non-`optional` `kill` of an npc of rank 1–3 (elite, rare elite, boss) hostile
  to a side the goal applies to (a friendly one is a talk credit), or `collect` of
  an item whose every located dropper is such an npc; `lint` also errors on a
  non-`optional` quest goal of a quest the cached simulator world (below) excludes
  as `elite`, unless the goal was already reported as elite

Warnings:
- an `accept` whose prerequisites (`pre`, any one suffices) are none of them turned in earlier in the chain
- an `accept` above the level the route plausibly reaches (when XP data exists)
- an `accept` of a quest whose `excl` (exclusive) quest is accepted or turned in
  earlier in the chain: the game does not offer it while that quest is in the
  log or done
- a non-`optional` `accept` never turned in later in the guide or the guides
  after it, checked for every route choice
- `complete` on a quest with no objectives: the turn-in is the action; use `turnin`
- explicit coordinates more than 50 yards from every known spawn of the entity
- ids missing from data but given explicit names/coordinates (new Forever content)
- objective-capable goals with no coordinates
- a `craft` before any `learn` of that spell earlier in the chain (free starter
  recipes excepted); `until <N>` past the recipe's grey skill
- a coordinate on a map other than the step's zone that the guide never sets as
  a zone (catches a target resolved onto another continent)
- profession, faction or spell missing from data but given a quoted name
- a smart target with no candidate for a faction the goal applies to (and, for
  `train class`, for a class that faction's allowed races can be); a `train
  <Profession>` whose default rank needs more skill than any earlier `skill` target
- `lint` only, with a simulator world cached in `data/sim` (or `--sim <dir>`): a
  non-`optional` quest goal in a `Leveling` guide on a quest the solo filter
  excludes (dungeon, raid, pvp, rare drop, reputation, repeatable or profession;
  `elite` is an error, above)

These quest checks count a goal only for the characters its `only` (and the
quest's own race and class masks) leaves.

## Output

One Lua file per guide at `addon/Polestar_Guides/Guides/<id>.lua` (nested by the `/` in the id), plus
`MapFrames.lua` (Era bounds for referenced maps), `Pack.lua` and the
`Pack.xml` manifest. Output is deterministic: the same inputs give
byte-identical files.
