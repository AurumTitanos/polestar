# Route simulation and optimization

Goal: find, for each faction and each race's start, the 1-60 leveling route
that reaches 60 in the least /played time under one explicit model of the
game, by simulating very large numbers of complete routes; measure how robust
the winners are to the model's uncertainty, and score Polestar's own routes
under the same model.

"Proven" here means: best found under the model, after a search large enough
that more search stops improving it, and still best (or within a stated margin)
across thousands of plausible variations of the model's parameters. Real-world
proof comes from recorded play (`record report`), which also recalibrates the
model.

Code: `tools/lib/sim/` (Node ≥24, CommonJS, zero npm dependencies,
`worker_threads` for parallel search). CLI: `node tools/polestar.js sim <cmd>`.
Outputs: `data/sim/` and `data/bench/` (both gitignored).

## 1. World model (built once per faction, cached in data/sim/world-<faction>.json)

- **Quests** available to the faction (quests.json race/class masks; class
  quests kept with their class): level, minLevel, prerequisites, exclusive
  quests, next links, giver and ender positions (world coordinates
  via map-frames.json), objectives with workload:
  - kill N of a mob: N kills at the mob's spawn clusters (npcs.json levels).
    A kill objective on an NPC of the character's faction that gives or ends
    the quest, or whose objective text opens with speak/listen/talk/hear/
    show/wait/watch, is Questie's kill credit for a conversation (Kalaran
    Windblade 3441/3453, Tirion Fordring 5742, the faction leaders of
    93739/93963): one interaction at the NPC, never elite; in such a quest
    the other faction's NPC is that faction's counterpart and costs nothing.
    A deed on an NPC of the character's own faction proper (A or H; text
    opening with find/heal/use/locate/keep searching: healing Grunt Kor'ja,
    waking Lazy Peons) is one interaction per credit. A friendly-flagged NPC
    that is really fought (the AH Threshwackonator 2078) stays a kill;
  - collect N items: N / (drop chance) kills of the best dropper, or N object
    uses for object sources, or a purchase from the friendly vendor nearest
    the quest giver. A source on another landmass than the quest giver is
    used only when the giver's has none. Drops without a recorded rate
    (Forever creatures, `null` in items.json) count at 30%, quest-only items
    (`questItem`) at 60%, unless a dropper of the item with a recorded rate
    lives on the giver's landmass or has no open-world site (Kum'isha's
    sphere: 0.01% recorded, one null dropper, stays rare); on Zephras Isle,
    where every recorded strider is on another continent, Galestrider (null)
    is the source of 92553's meat;
  - quest-starting items: the expected kills of the best solo dropper; with no
    recorded rate for the item at all, its droppers count at the same 30% /
    60% (91741 Nibbled-On Book, 97281 A Simmering Storm), elites still not.
    An item handed over by another quest's turn-in (the data has no quest
    rewards; `startItemFrom` in tools/lib/sim/solo.js: the Paladin Tome of
    Divinity 1642/1646 from 1641/1645) starts the quest at that quest's ender
    once it is done;
  - interact/use/event: one visit (plus the object's site); an event counted
    in its text ("Free 6 Webbed Forsaken", "Motivate 5 Deathguards") is that
    many interactions;
  - escort/event quests: a fixed duration (parameter); a rescue reads as an
    escort ("Help Perith Stormhoof escape Palemane Rock", 98430).
- **Placement**: zone map frames overlap (the Barrens map covers Durotar),
  so one spawn can be recorded on two maps. Such a spawn counts once, on the
  map most spawn records around it use (every NPC and object, 150 yd cells),
  then the map most of the entity's own spawns use, then the map where it
  lies furthest from the edge. Two of the Valley of Trials' Lazy Peons are
  also recorded on the Barrens map; they stay in Durotar, so Lazy Peons is a
  Durotar 1-5 quest, not a Barrens one. Gryphon Master Talonaxe stays in The
  Hinterlands (9.75, 44.47, not Hillsbrad 94.3, 3.5).
- **Givers in several places** (Minor Manifestation of Earth: the Valley of
  Trials and Mulgore): the quest starts at the giver's site nearest its
  turn-in (Call of Earth 1518 in the valley, 1521 in Mulgore).
- **Child quests** (Questie `parentQuest`): a child is offered only while
  its parent is in the log, so the parent is not its prerequisite and the
  child is accepted after the parent's accept and before its turn-in. A
  parent whose objective items are its children's rewards turns in after
  them (`turninAfter` in tools/lib/sim/solo.js: Stranglethorn Fever 348
  after 349; The Green Hills of Stranglethorn 338 after chapters 339-342).
- **Prerequisites**: the canonical blocking prerequisites of
  tools/lib/data/prereqs.js, the ones the guide compiler and validator use:
  preAll all-of, preAny (else pfQuest's `pre`) any-of; breadcrumbs (an
  any-of group holding one is optional as a whole: 788 Cutting Teeth needs
  neither 787 nor 4641), exclusive quests, the parent and quests nobody can
  start (786's 785) never block. A DungeonJournal-only quest (no quests.json
  record) keeps its journal chain. A quest with no prerequisite data at all
  (no pre/preAny/preAll/breadcrumbs/breadcrumbFor) gets an implied any-of
  over every quest whose `next` it is (e.g. 5093/5094/5095 -> 5096, never
  only the first). `world.preRules` counts each rule.
- **Exclusive quests** are one-way: quests.json `excl` merges pfQuest's
  `close` (symmetric, both sides list each other) and Questie's exclusiveTo
  (one-way). A quest is unavailable while any quest of its own `excl` is in
  the log or done; taking it closes nothing else. So 287 stays open after
  282 and 322 after 324, while 526 (excl 322, 324) closes once 324 is taken
  and 5601/5142 close each other.
- **Tasks** group a quest's objectives by site (spawn clusters, 70 yd).
- **Hubs**: givers and enders clustered (150 yd), with flight masters, inns
  and class trainers nearby (trainers.json, TravelData).
- **Travel graph**: walking (straight line × detour factor, per continent),
  flights between known flight paths (TravelData flight times), boats,
  zeppelins and trams (wait + ride, data/forever/travel.json), hearthstone
  (bind, 60 min cooldown, parameter). All-pairs shortest paths over the
  transport nodes are precomputed per known-flight-path set; a leg is
  walk-to-node + network + walk-from-node (the network part must use a
  flight or a ride), or walking, whichever is cheaper. A place the
  character cannot reach (another landmass with no transport, e.g. back to
  Zephras Isle) skips the step and is counted (`unreachable`).
- **Travel safety**: each zone's level is the P10 of its hostile normal-rank
  spawns (the `maps build` ZoneLevels heuristic, tools/lib/maps/zonelevels.js),
  and each 200-yard cell of a landmass belongs to the zone with the most NPC
  spawns in it (gaps filled from neighbours up to 600 yd). A direct walk
  whose straight line (sampled every 200 yd) crosses a zone, other than the
  ones it starts and ends in, whose minimum level is 5 or more above the
  character costs `deathRisk` seconds per such zone (deaths, corpse runs,
  detours; prior 300 ± 150 s), so the flight/boat path wins when it is safer.
  Crossed zones are sampled once per point pair and cached (measured cost:
  0.22-0.29 ms per full route evaluation, vs 0.20-0.24 ms without).
- **Packages**: the unit the route search orders. A package is one visit to one
  zone doing a set of quests: built by splitting each zone's quests by quest
  level into bands (default width 5, parameter) and keeping chains inside a
  package when their levels allow; every quest belongs to exactly one package
  per split. Each package precomputes: entry hub, internal task order
  (nearest neighbour + 2-opt, as `draft` does), internal walking distance,
  per-quest kill counts by mob level, quest XP tier estimates, and the flight
  paths and inn it offers.

### Solo filter (tools/lib/sim/solo.js)

The solo world keeps only quests a levelling character can do alone. Each
exclusion has one category, counted by `sim world` (`world.solo.counts`):

| category | rule |
|---|---|
| dungeon, raid, pvp | the quest's Questie area (zoneOrSort) lies in an instance (an area on a map with Map.csv InstanceType 1 / 2 / 3, the instance map's own area, or an entrance subzone named after the instance: Gnomeregan 133, Uldaman 1517), or it is a dungeons.json dungeon quest, **and** its giver or ender has no open-world site or one of its objectives cannot be placed in the open world (no open-world spawns, drops only inside, an item made nowhere, an event without a place). The area is the quest's story zone, so talk breadcrumbs and outer-cave quests whose work is outside stay (2864 Tran'rek, 721 A Sign of Hope, 709 Solution to Doom, 6562/6563, 8263, the Unending Torment chain in the Undercity) while 92421/92422 (work inside the Ruins of Lordaeron) stay out. Forever client build 1.60.1.70338 (wago.tools, cached in data/sources/wago/). |
| elite | a kill objective on an elite (rank 1-3); or a collect objective or quest-starting item whose only droppers are elites or mobs 5+ levels above the quest level |
| rareDrop | a collect objective whose every dropper is below 1%, a rare spawn (rank 4), or a friendly NPC with a low "drop" rate (killed by the other faction) |
| reputation | needs more than Friendly (3000) with a faction |
| repeatable | a repeatable quest without a recorded reward that no other quest needs |

Every quest counts once. A repeatable another quest needs (349 for 348's
turn-in) is kept and gives no XP unless its reward is recorded. A quest
whose prerequisite was excluded is unreachable at run time, so a chain after
an excluded quest goes with it (the Mau'ari E'ko chain after 969). The
Forever client's QuestInfo table (1 Elite, 41 PvP, 62 Raid, 81 Dungeon)
only names the types; which quest has which type, and suggested group
sizes, are server data that neither the client tables nor QuestieDB carry,
so the types are derived from areas and objectives as above.

`OVERRIDES` in solo.js is the explicit hook for what the data cannot
express: `exclude` (Naxxramas-era Argent Dawn turn-ins 9124-9142 and
armaments 9221-9228; Luck Be With You 969, whose shards lie among the
Frostmaul giants; Brann Bronzebeard's Lost Letter 8308, whose non-elite
droppers are hive-event spawns; Concerted Efforts 8371/8385 and the Eastern
Plaguelands tower captures 9664/9665 (PvP); the corrupted plant quests and
their Salve via ... turn-ins, Smokey LaRue's crafted 6026/6041 and the
Midsummer flame thefts 9324-9326/9330-9332, without a category), `allow`
(keep a quest whatever the rules say, the profession rule included: the
Cooking rank 1 quests 384 and 4161, whose cooking trainer the starting-zone
guides visit; Unending Torment 97291, whose Blisterweed has no data) and
`turninAfter` (348 after 349, 338 after 339-342, 812 after 813, 5060 after
5059, 1190 after 1191: the children pay no XP but the parent needs their
work). The dungeon family re-admits dungeons.json's quests as dungeon
packages.

### Starts (route rules)

- **Zephras Isle is Skyborne-only**: quests whose giver, ender, quest-starting
  drop or objective sites are on the isle maps (2521, 2665) are closed to
  every other race. The isle's exits (Horde airship to Mulgore, Alliance
  zeppelin + portal to Stormwind) are one way.
- **Home first**: a route must run its home packages before any other: the
  start zone's first band (1-5, chains kept with it) for the Era races, every
  Zephras Isle package for the Skyborne (who leave the isle at about level
  12, after it). A route that puts another package first is infeasible;
  construction draws only home packages while any are left.
- **No continent change before level 10**: a package on another continent
  than the start, or on another starting island (Teldrassil for non-Night
  Elves, Zephras Isle), entered below level 10 makes the character grind to
  10 first (counted). Dwarves/Gnomes and Orcs/Trolls leave their continent
  at 10+.
- **Catch-up (robustness only)**: when `sim robust` re-evaluates a route
  under a parameter draw, a package in which nothing could be done because
  every available quest is above the level gate (`gateGap`) makes the
  character grind to the gate's level and run it then: the route is followed
  as a plan, under-levelled, as a player would. Without it one gated package
  skipped the rest of the route and the character ground to 60 (the old
  Tauren robustness tail, 90% interval 93-225 h). The search does not use it
  (it would turn the gate into "grind to any package": a trial run let the
  Human route grind 6 -> 26 before Duskwood).
- Guide sequences (`sim compare`) are scored as written: only travel, levels
  and prerequisites apply, not these route rules.

## 2. Character and XP/time model (parameters with priors in data/sim/params.json)

- XP to level: the Classic table (same as tools/lib/dsl/validate.js).
- Quest XP: the client's QuestXP table (wago.tools DB2 `QuestXP`, cached under
  data/sources/wago) at the quest's level and an estimated difficulty tier:
  breadcrumbs (no objectives, talk to someone) low, normal kill/collect quests
  middle, chain ends, escorts and group quests high; recorded quest XP
  (quests.json `xp`) overrides the estimate. Reduced by level difference:
  100% up to quest level + 5, then 80/60/40/20/10%.
- Kill XP: the Classic mob formula (45 + 5 × level, ±5% per level of
  difference above, zero-difference table below, nothing for grey), elites ×2,
  rested XP optional.
- Kill time: per-level base time (fight + downtime) × level-difference factor
  × class factor; travel between mobs inside a site from spawn density.
- Speeds: run 7 yd/s, mount ×1.6 from `mountLevel` (default 40), flight and
  transport times from TravelData.
- Grinding fills gaps: when no package is worth doing, the character grinds at
  the best site for its level (kill XP per hour at Δ = 0..+2). "Grinding" is
  only killing for XP with no quest involved; kills for objectives and drops
  are quest work (`xpSplit.kill`).
- Route policies (not measurements; reported times stay real): routes are
  compared by time to 60 with every hour of grinding counted 2.5 times
  (`grindWeight`) and every move into another zone counted 7.5 minutes more
  (`zoneChange`, `zoneChanges` in results). So a route grinds only where no
  quest is nearly as good, takes a hub's quests, does them in one go and
  hands them in, and switches zones only when it is clearly worth it. With
  neither, the search ground wherever the next quests were barely better
  (Orc consensus: 46 h of grinding in 129 h) or flew across continents for a
  single quest (Orc at 40-60: 32 visits in 41-50 and 62 in 51-60, 58
  hearthstone uses). The values come from a sweep on the Orc and Human
  searches (600k routes each): a stronger zone weight brought grinding back
  (Human 23 h at 600 s with weight 2), a stronger grind weight brought the
  single-quest trips back; 450 s and 2.5 gave Orc 121.5 h with 2.9 h of
  grinding and 22 visits for one quest or none, Human 120.7 h with 10.2 h
  and 23.
- Quest log limit 20; a package that needs more open quests is split.
- Every parameter has a prior (mean and spread). Calibration (§4) narrows
  them.

## 3. Route evaluation and search

- A **route** is an ordered list of packages starting at the race's start zone
  at level 1. `evaluate(route, params) -> { seconds, levelAt[t], timeTo[10..60],
  xpSplit {quest, kill, grind}, travelSeconds, perPackage[] }`, deterministic for
  given params, fast (target ≤ 1 ms per full route) so millions run in minutes
  across 16 cores.
- Feasibility: prerequisites done earlier (or inside the same package), level
  ≥ minLevel on arrival (else grind first, counted). A package runs up to
  three times: a return does only what opened since, so quest chains that go
  to another zone and back are kept (Scholomance and the Argent Dawn turn-ins,
  Loramus in Azshara); home packages run once.
  A package runs in its tour order (by place); an accept still too low for
  the character is taken as soon as the level allows, within the same walk,
  and does right away the objectives and turn-in the tour has already passed,
  and any passed accept its turn-in opens (Lazy Peons, then Thazz'ril's Pick
  at the same foreman). A second pass does only what is still too low after
  the whole tour (grinding first).
- **Search**, per faction and start race (class factor as a parameter):
  1. randomized greedy construction (next package chosen with probability
     ∝ exp(XP per hour of package incl. travel to it / τ); a package already
     run is a candidate again and scores only what opened since);
  2. local search on the best routes (swap, insert, drop, add, replace,
     merge; add and replace also bring returns) and simulated annealing;
  3. restarts until the best route stops improving over the last N% of samples
     (report the convergence curve);
  4. at least 10^6 evaluated routes per faction by default (`--paths`).
- **Robustness**: draw K parameter sets from the (calibrated) priors (default
  K = 2000), re-evaluate the top routes under each, and report each route's
  win rate, mean and 90% interval of time to 60, and which parameters flip the
  ranking.

## 4. Calibration

- From quest data: quests.json rewards against the QuestXP-table estimate
  (`questEstScale`) and Forever-observed rewards from the installed
  ForeverDungeonJournal (`--fdj <dir>`; `questXpScale`).
- From recordings (data/recordings): kill rates (`killSec1`, `killSec60`).
- `extraKill` (incidental kill XP, the main unobserved XP source) is a fixed
  prior in params.js (0.043 ± 0.038, fitted 2026-10-12 against level
  checkpoints).

Only the fitted parameter values are kept (data/sim/params.json).

## 5. Baselines (scored under the same model)

- Polestar: the compiled guides (default route and every route choice),
  against the best route found (solo and with dungeons).
- A guide pack (`sim compare --pack <dir>`, or the pack folder as the one
  argument): its chain, after our chain up to the pack's first level when it
  starts above 1, under the same model
  (`data/bench/compare-<faction>-<race>-<pack id>.json`).

## 6. CLI

```
sim world   [--faction F] [--rebuild]               build/cache the world model (data/sim/world-<faction>.json)
sim calibrate [--fdj DIR]                            fit parameters to quest data and recordings
sim run     --faction F [--race R] [--class C] [--paths N] [--workers W] [--seed S] [--dungeons]
            [--jobs J] [--anneal A] [--max-paths M]
sim robust  --faction F [--race R] [--draws K] [--top N]   robustness of the top routes
sim compare --faction F [--race R] [--guides DIR] [--pack DIR | DIR] [--to 10,20,30]  Polestar's routes vs the best found, same model
sim bench   --faction F [--race R]                  bracket table: zones, levels, quests per 10 levels
sim export  --result <file> --out <dir>             zone-by-zone skeleton guides + visits.json for authors
sim consensus --faction F [--dungeons] [--evals N]  one 12-60 route shared by the faction's starts (+ exports)
```

Less common options: `--fdj <dir>` (calibrate: the ForeverDungeonJournal
folder, default the installed one), `--band <levels>` (level width of the
world's quest packages, default 5; a new width rebuilds the world), `--jobs
<n>` (run: search jobs per round, default 32), `--anneal <n>` (run:
annealing evaluations per job, default 6000), `--max-paths <n>` (run: hard
cap on evaluated routes, default 3x `--paths`), `--guides <dir>` (compare:
the guides folder to score, default `guides/`), `--pack <dir>` or a pack
folder as the one argument (compare: also score a guide pack's chain, after
our chain up to its first level when it starts above 1; written to
`data/bench/compare-<faction>-<race>-<pack id>.json`), `--to <levels>`
(compare: levels to show, default 10,20,30,40,50,60), `--top <n>` (robust:
routes re-evaluated), `--dungeons` (run, robust and consensus: the
dungeon-inclusive family, needs `data/forever/dungeons.json`), `--offline`
(never download the QuestXP table), `--quiet` (less output); `--data <dir>`
and `--sim <dir>` move the reference data and simulator outputs (default
`data/forever`, `data/sim`).

`sim run` writes `data/sim/results/<faction>-<race>-<class>.json`
(`…-dungeons.json` with `--dungeons`) and prints a
report: the best route as zone visits with level ranges and times, time to
each tenth level, XP split, travel share, convergence, and the comparison.

`sim export` writes one `.guide` skeleton per zone visit (accepts, objectives,
turn-ins in the simulator's order, plus `getfp`, `sethome`, `hearth` and
`level` steps where it learned a flight path, bound or used the hearthstone,
or ground) and `visits.json`: per visit the level range, time, packages,
quests in order (id, title, level, giver/ender name, hub = its flight master
or inn or "near" the nearest one, map position), binds, flight paths,
hearthstone uses, grind stops (where, from-to level, minutes) and dungeons.
The simulator grinds where it stands (a rate per level, no place), which
can be a capital city, so each grind stop also gets a `spot`: the nearest
camp on the landmass (6+ spawns of one normal quest mob within 120 yd; quest
mobs keep out town guards and event spawns) with mobs from one level below
the character to two above, nearer and bigger preferred. The skeleton's
`level` step names that camp. The skeletons compile with the guide compiler
(0 errors).

## 7. Consensus route

`sim consensus --faction F` builds one route from level 12 to 60 that every
start of the faction can follow: each start keeps its own best route up to
its level-12 point (and all its home packages); the shared part is one
package sequence run in order by every start (a package a start already ran
or does not have is skipped for it; no deferral).

- **Cross-evaluation bound**: each start's own 12-60 sequence is run as the
  shared route by every start; the best row sum is the bound the consensus
  must beat (reported as a matrix).
- **Search**: simulated annealing (swap, move, reverse, drop, add from any
  start's route) for the summed time to 60 of every start, 2 rounds of 32
  jobs on worker threads (round 1 from the seeds: those sequences and the
  median order of the packages most starts share; round 2 from the best),
  1.2M suffix evaluations by default (`--evals`); deterministic for any
  number of workers. Packages that do nothing for any start are dropped.
- **Report**: each start's consensus time vs its own best (hours lost), the
  realised visit order per start (zone, levels, quests, hours), and its
  **route choices**: level stretches where its own route gains more than
  1 h on the consensus, with the zones each route visits there.

Outputs: data/sim/consensus-<faction>.json and .md, and per start an export
of the consensus route under data/sim/export/consensus-<faction>-<race>/.
Export place names (`hub`, grind `near`) are the nearest named map area
(subzone or town, client WorldMapOverlay/AreaTable) on the point's own zone
map.

## 8. Results: world f7bd5e2cccab (final run, 2026-10-13)

Every number below comes from one world: data hash
`f7bd5e2cccab91eb0a8f2bd4b4b673b58eb8af13`, both factions, builder 18
(builder 17 plus friendly kill credit for find/heal/use/locate objectives,
escorts named "escape", counted events as `use`, quests started from an
item another quest rewards), with the route policies of §2 (grinding
counted 2.5 times, 7.5 minutes per zone change), run from a frozen copy of
the repository. Results record the hash; anything from another world
(bde7513ac7b8 and earlier) is refused. The Forever rank corrections that
came after the run (22 NPCs, see Known limitations) are in the current data
but not in this world.

These are **model estimates in /played hours**, not measurements: no
recordings exist yet, so time parameters keep their priors (only quest XP
is calibrated; `extraKill` is a fixed prior, §4), and Forever's 30-60
content is not in the data. Rankings under the model are what the numbers
support; absolute hours are not.

### Solo filter counts

| faction | quests | dungeon | raid | pvp | elite | rareDrop | reputation | repeatable | kept no-XP repeatables |
|---|---|---|---|---|---|---|---|---|---|
| Horde | 1654 | 165 | 12 | 88 | 128 | 8 | 30 | 72 | 12 |
| Alliance | 1886 | 171 | 12 | 89 | 128 | 5 | 30 | 58 | 14 |

### Per start (hours to 60, solo)

| start | best found | consensus | guides (grinding) | previous guides (grinding) |
|---|---|---|---|---|
| Orc | 119.4 | 120.5 | 122.9 (14.3) | 128.0 (44.1) |
| Tauren | 120.4 | 120.2 | 122.4 (13.8) | 127.9 (44.8) |
| Undead | 120.8 | 120.6 | 123.5 (13.9) | 127.9 (43.1) |
| Skyborne H | 120.2 | 120.1 | 122.8 (13.1) | 127.7 (41.8) |
| Human | 119.6 | 119.1 | 128.7 (28.5) | 133.3 (61.4) |
| Dwarf | 119.5 | 119.5 | 129.3 (28.4) | 133.1 (61.8) |
| NightElf | 120.0 | 119.5 | 129.3 (28.8) | 133.7 (62.5) |
| Skyborne A | 121.2 | 119.6 | 129.0 (27.7) | 133.0 (60.4) |

Guides: each race's default chain as written (`sim compare --guides`),
grinding at their own `level` steps. The leveling guides were rebuilt from
this run's consensus exports with a flow pass the model does not make:
side trips for one or two small quests behind a flight, boat, hearth or long
ride were dropped, every hub is one loop, and where the level then falls
short a `level` step names a camp (with an optional dungeon past 20
minutes at 40+). That costs 2.0-2.7 h (Horde) and 9.1-9.8 h (Alliance)
against the consensus, almost all of it grinding: the Alliance 44-50 has
few solo quests left once the Booty Bay, Shimmering Flats and OOX trips are
gone (the longest stop is 48 to 50 at the Un'Goro gorillas). The previous
guides (written against builder 15, scored on this world) are 3.8-5.5 h
slower with 29-34 h more grinding.

Consensus time to 10/20/30/40/50/60 (h):

| start | 10 | 20 | 30 | 40 | 50 | 60 |
|---|---|---|---|---|---|---|
| Orc | 2.3 | 11.3 | 26.7 | 52.3 | 81.6 | 120.5 |
| Tauren | 1.9 | 11.1 | 26.5 | 52.1 | 81.4 | 120.2 |
| Undead | 2.4 | 11.5 | 26.9 | 52.5 | 81.8 | 120.6 |
| Skyborne H | 2.1 | 11.2 | 26.5 | 52.2 | 81.5 | 120.1 |
| Human | 2.2 | 9.3 | 23.9 | 48.8 | 80.0 | 119.1 |
| Dwarf | 2.0 | 9.7 | 24.3 | 49.2 | 80.4 | 119.5 |
| NightElf | 2.1 | 10.0 | 24.3 | 49.2 | 80.4 | 119.5 |
| Skyborne A | 2.1 | 9.6 | 24.4 | 49.3 | 80.5 | 119.6 |

On world bde7513a (builder 17, grinding and zone changes at face value) the
consensus was 128.7-128.9 h (Horde) and 129.7-130.5 h (Alliance) with about
46 h of grinding: returns to a zone and the grind policy save 8-11 h.

### Consensus and convergence

- Horde: 173 shared packages from level 12; bound (Skyborne's own 12-60)
  542.7 summed policy cost, consensus 542.6. Alliance: 169 packages; bound
  (Dwarf's own) 591.9, consensus 591.9. 1.2M evaluations each.
- Searches: 3.46-9.03M routes per start. Human and Skyborne H reached the
  route cap (3x the 3M paths) still improving (last improvement at 99% and
  96% of the evaluations); the others converged (last improvement at
  72-98%).

### Robustness (2000 parameter draws, top 10 routes per start)

| start | #1 wins | #1 within 1% | #1 cost 5-95% (h) |
|---|---|---|---|
| Orc | 37% | 99% | 121.8-241.8 |
| Tauren | 13% | 30% | 130.5-248.5 |
| Undead | 31% | 98% | 128.7-259.4 |
| Skyborne H | 24% | 57% | 121.9-199.0 |
| Human | 17% | 93% | 129.3-207.5 |
| Dwarf | 31% | 81% | 126.9-195.4 |
| NightElf | 29% | 69% | 129.2-209.5 |
| Skyborne A | 24% | 86% | 128.3-193.6 |

Costs include the route policies (hours plus the weighted grinding and zone
changes), so they sit above the hours. The top routes are close: the best
found route is within 1% of each draw's best in 30-99% of draws, and no
route wins a majority.

### Dungeon family

Horde only (the Skyborne and Alliance dungeon searches were stopped):
Orc 120.0, Tauren 120.4, Undead 121.8 h, never ahead of the solo best
found. Under the model dungeons do not beat questing solo.

### Second search (verification)

The same pipeline run again to test whether the first search's routes are
as good as the method gets: another random seed (2), up to twice the routes
(`--paths 6000000`, cap 18M), and the current data with the 22 rank
corrections, world `165d88c5eaaa`. Best found / consensus, hours to 60:

| start | first search | second search | guides on the second world (grinding) |
|---|---|---|---|
| Orc | 119.4 / 120.5 | 120.7 / 117.8 | 123.0 (14.4) |
| Tauren | 120.4 / 120.2 | 119.1 / 117.4 | 122.5 (13.9) |
| Undead | 120.8 / 120.6 | 119.0 / 118.1 | 123.5 (14.0) |
| Skyborne H | 120.2 / 120.1 | 117.3 / 117.3 | 122.9 (13.2) |
| Human | 119.6 / 119.1 | 120.7 / 118.8 | 128.7 (28.5) |
| Dwarf | 119.5 / 119.5 | 120.8 / 118.8 | 129.3 (28.4) |
| NightElf | 120.0 / 119.5 | 120.9 / 118.9 | 129.2 (28.8) |
| Skyborne A | 121.2 / 119.6 | 118.6 / 118.6 | 129.0 (27.7) |

- Searches: 6.54-18.07M routes per start; Horde Tauren, Undead and
  Skyborne and Alliance Skyborne reached the cap still improving (last
  improvement at 95-100% of the evaluations).
- Consensus: Horde 167 shared packages, 531.4 summed policy cost (bound
  531.6); Alliance 169 packages, 586.9 (bound 587.3).
- Robustness: the best found route stays within 1% of each draw's best in
  48-100% of draws; win rates 9-78%.
- The two searches' consensus routes differ by at most 2.8 h (Horde) and
  1.0 h (Alliance), every start within 117.3-121.2 h: the top of the search
  space is flat, and more search still finds small gains. The guides score
  the same on both worlds (within 0.1 h); against the second consensus they
  cost 5.1-5.6 h (Horde) and 9.9-10.5 h (Alliance), almost all of it the
  grinding the flow rules add.

## Known limitations

- **No recordings**: time parameters (kill time, travel detours, talk and
  interact times) are priors, not measurements. Absolute hours are model
  estimates; the robustness interval is wide.
- **Forever 30-60 content is missing** (Riverglades, Shen'dralas, Mount
  Hyjal, the rest of the Wetlands expansion): the beta caps at 30 and the
  data has none of it. Results are "Era + known Forever quests".
- **Forever NPC ranks**: QuestieDB's Forever store gives every Forever NPC
  rank 0; the corrections carry Wowhead Forever's ranks for the 305 Forever
  NPCs that quests need, and every quest NPC (4,432) was checked against
  Wowhead Forever on 2026-10-13 (22 Era NPCs Forever reclassified, e.g.
  Bruuz now elite).
- **Quest types are derived**: the client's QuestInfo names Elite, PvP,
  Raid and Dungeon, but which quest has which type (and suggested group
  sizes) is server data; the filter infers them from areas, objectives and
  droppers, plus the explicit listings.
- **Child quests** follow Questie's parentQuest; parents whose turn-in
  needs a child's reward or effect are listed by hand (`turninAfter`: 348,
  338, 812, 5060, 1190).
- **Bag items**: cloth donations and items bought or carried over are
  modelled as gathered where they drop, so scoring a guide that hands them
  in from the bags adds trips the player does not make.
- **Search depth**: see convergence above; Human and Skyborne H were still
  improving at the route cap.

## 9. Refresh (launch day)

Results are labelled "Era + known Forever quests": Forever's 30-60 content
(Riverglades, Shen'dralas, Mount Hyjal, the rest of the Wetlands expansion)
is not in the data yet (the beta caps at 30). When it lands:

```
node tools/polestar.js data build
node tools/polestar.js sim world --rebuild
node tools/polestar.js sim calibrate
node tools/polestar.js sim run --faction horde
node tools/polestar.js sim run --faction alliance
node tools/polestar.js sim run --faction horde --dungeons && node tools/polestar.js sim run --faction alliance --dungeons
node tools/polestar.js sim robust --faction horde && node tools/polestar.js sim robust --faction alliance
node tools/polestar.js sim consensus --faction horde && node tools/polestar.js sim consensus --faction alliance
```

then re-export (`sim export`) the starts the guides follow.
