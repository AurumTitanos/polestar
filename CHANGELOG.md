# Changelog

## 0.2.2 (unreleased)

### For players

- Distances can read in metres: Options, Arrow & routes, Distances.
- The starting zones follow Forever's new quest chains: a follow-up is taken
  once the quest before it is handed in, where the guides offered several
  links of a chain at once (Northshire's book chain and Jason Mathers'
  murloc quests in Elwynn Forest, Dun Morogh, Teldrassil, Durotar and
  Mulgore). The Big Picture and what follows it stay optional extras, as
  Shinyfinder Narf is elite.
- Profession quests are optional and say who they are for: Rough Wolf Pelts
  (skinners), A Pain in the Neck (enchanters) and The Quarry's Smith
  (blacksmiths). Other characters could not take or finish them.
- The Skyborne start points at the Ley Line, the Elemental Convergence and
  Raan's campfire again: their ids changed in Forever's data.
- The world map's zone level ranges are rebuilt from Questie 12.1.0's
  Forever creatures (Mulgore reads 3-11, no longer 3-27).
- Reading ahead with Next no longer stops quest automation for the step you
  are on: its quests are still accepted and handed in while the window shows
  a later step.

### For guide authors

- A skill for coding agents, `skills/polestar-guide-pack/`: the workflow from
  `new` to `pack` (look up every id with `find`, then lint and playtest until
  both pass) and the guide format on one page. `new` copies it into the pack's
  `.agents/skills/` and `.claude/skills/`, and the pack's AGENTS.md points to
  it.
- `data build` reads Wowhead's Forever zone quest lists (cached a day in
  `data/sources/wowhead/`) and applies Forever's change notes: "Experience X
  instead of Y", "Level X instead of Y" and "Requires level X instead of Y"
  set X where the data still holds the old value (Scaring Shaky now gives
  3300 XP, not 820). Quests still without XP take Wowhead's. `--no-wowhead`
  skips it; guide pack workflows and Codespaces build with it.

## 0.2.1 (2026-10-14)

### For players

- Quests with several objectives check off the right one: a goal counted the
  objective at its place in the quest's text instead of its place in the quest
  log, so in The Guns of Northwatch "Kill Cannoneer Smythe" showed the 10/10
  medals and Captain Fairmount never ticked. 135 goals in 46 quests of the
  leveling guides now count the objective they name.
- A new character's welcome survives the intro cinematic: the cinematic
  closed it as it started and it never came back. It now waits for the
  cinematic to end, or comes back on the page it was on.
- The welcome is redesigned: three pages under a starlit hero (two for a
  later character), with step dots. It shows the guide window, the arrow and
  every guide at a glance; setup shows each choice's description and the
  colour schemes as cards that apply as you click; the last page shows your
  first guide on its zone painting, the beta note, the Discord invite as a
  link that opens it ready to copy, and what guide packs are.
- The guide menu lists only the guides your character can follow on your own
  faction: an Undead no longer sees the Orc and Troll Durotar and Barrens
  guides there. The other faction's button and All still list every guide.
- Guide packs page: the problem report box grows to fit long problem
  messages.
- Options > Guide packs says plainly what a guide pack is: someone else's
  guides in a separate addon, supported by its author. Its link opens
  docs/GUIDE_PACKS.md, a new page on packs for players and for authors.
- Search ranks an item first as covered by a guide only when a guide Lookup
  would open for it collects it: one of Polestar's own, or one from the pack
  chosen under Suggest guides from.
- Polestar is open source: the code, the guides and the tools that build
  them are on GitHub under the GPL-3.0.
- Report a problem from the game: the bug in the guide window, beside Skip,
  opens a report on the step on screen. Say what went wrong and Polestar
  writes the rest (the step and each goal's state and position, where you
  stand, your race, class and level, the versions and any errors it caught),
  sized to fit one Discord message, for you to copy and paste on the Polestar
  Discord (the game can't open links: "Get the invite" gives the invite once
  if you haven't joined yet). The guide window's menu and `/polestar report`
  open it too.
- The Polestar Discord is one click away: Discord's mark at the foot of the
  hub's and the settings' sidebars, and `/polestar discord`, give its invite
  to copy.

### For guide authors

- A pack reads as a pack in the game's AddOns list: its TOC title is
  "Polestar Pack: <title>", it sits under Polestar's entry next to
  Polestar's own addons, and without `notes` in `pack.json` its line is
  "Guide pack for Polestar by <author>". Polestar's menus show the title
  as written.
- docs/GUIDE_PACKS.md: what a pack is, the steps from `new` to publishing,
  what the tools require and what we ask of authors.
- `playtest` plays a step for a class none of the guide's races can be, and a
  guide with a `class` header, as the first race on the guide's side that can
  be that class: an `only Druid` step in a Horde guide is played as a Tauren.
- `play` and `dev --play` stop the Lua session and exit when it cannot start,
  instead of waiting on it; the page redraws on its own after a rebuild.
- `new` keeps the port of an http origin (`http://host:3000/...`) in the
  pack's workflow and dev container.
- `lint` reports a `|` in a second or later `pro` or `con` at that entry's own
  line, once for each entry that has one.
- `compile` no longer reads `data/forever/dungeons.json`: a quest only
  DungeonJournal knows gives its title and `lvl` in the guide, so nothing from
  DungeonJournal reaches a guide pack.
- `find` and `lint` number a quest's objectives as the game lists them in the
  quest log: creatures, objects, items, kill credits, then exploration, with
  QuestieDB's exceptions. `quest Q.O` in a guide written before 0.2.1 may
  point at another objective: check each against `find <quest>`.

### For contributors

- THIRD_PARTY.md, docs/RELEASING.md and the README say what a release holds
  from each data source: QuestieDB facts in the guides and the quest markers,
  credited; never the Codex or the zone crossings pack.
- Two more independent route searches (the fourth on the data 0.2.0 ships
  with) back the README's numbers and docs/SIMULATION.md; the charts compare
  the guides with those of 0.1.0.
- The README charts display again: an SVG's generated header no longer holds
  `--`, which XML comments forbid, and a test checks every committed SVG for
  it.
- docs/curseforge holds the CurseForge listing: the description to paste,
  the summary, the project settings and what to upload where. `readme
  brand` draws the project avatar and, with `rsvg-convert` installed, writes
  the listing's PNGs (avatar, banner, route charts) beside it.
- `preview` draws a multi-line edit box's text wrapped from the top, and the
  report window and the Discord invite are scenes of their own, held to the
  text-fit audit. THIRD_PARTY.md credits Discord's mark, the one piece of
  art Polestar ships that it did not draw.

## 0.2.0 (2026-10-14)

### For players

- Guide packs: guides written by other players load beside Polestar's own.
  A Guide packs page in Options (`/polestar packs`) shows each pack, turns it
  on or off and reports its problems.
- A centred welcome greets each new character by name, with the guide
  Polestar suggests; its Set up page appears only on the account's first
  character.
- The leveling guides of both factions are reworked: quests that block a solo
  player are dropped or made optional, rare drops are optional, flight paths
  and training come at the right levels, and Forever's own additions, fixed
  points and level tips are in.
- Class quests are in the leveling guides of both factions, at the start and
  level where each class gets them: Shaman totems, Warlock demons, Hunter
  pets and Beast Training, Paladin and Priest spells, Warrior stances, Druid
  forms and Rogue poisons.
- Each training stop in the leveling guides is for the classes whose trainer
  stands there, with stops of their own for Horde Druids (Thunder Bluff),
  Undead Paladins (Brill, the Undercity, Thunder Bluff), Alliance Shamans
  (Ironforge) and Alliance Druids (Stormwind, Darnassus), no Horde gap of more
  than about five levels, and riding at 40 from each race's own riding
  trainer. Alliance guides add training in Ironforge on the way out of Dun
  Morogh, and in Stormwind after Duskwood and on the way to Stranglethorn,
  drop it in Auberdine, which has no class trainer, and take every race to the
  Sentinel Hill flight path.
- Alliance 40-50 grinds less: Keeping Pace on the ride through the Shimmering
  Flats into Tanaris, and The Curse of the Tides, Pearl Diving and Return to
  Corporal Kaleb on one loop through northern Stranglethorn.
- Stranglethorn Vale and Un'Goro Crater, which were split into parts, are now
  one guide per stay in the zone. Inn names are the ones the game reports, so
  binding and hearthing check off; Northwatch Hold's step names its levels;
  and no travel step comes before goals that lead there themselves.
- Collectible, Legacy and reputation guides have clearer notes (warlock mount
  hand-offs, Merchant's Favor camps, Timbermaw and Cenarion Circle standings)
  and mark optional extras as such. Gathering loops in Mulgore and Redridge
  point at the nodes, and an exploration area the game names twice is listed
  once.
- The guide arrow knows every place a target spawns: the map marks the other
  places, fainter ("It also spawns here"), and a click on the arrow, the arrow
  button or a mark moves on to the next one.
- Quest markers cover every place a quest's mobs and objects spawn (before: at
  most 8 areas per mob per map), and a kill no longer redraws them all. Quest
  nameplate icons sit beside the health bar you see, on replacement
  nameplates as well as the game's own.
- Guide window: each tab shows its guide's level range; a narrow tab cuts the
  title, not the range.
- Windows fit their text in any font: a page's subtitle wraps to two lines
  inside the header, no text runs past a window's edge in the game font or in
  Inter, and the hub's search placeholder picks the first of its wordings
  that fits the box.
- Beta wording everywhere, and British spelling in the interface.
- The Recorder's command is `/psrec`, replacing `/lsrec`; `/polestarrec`
  still works.
- The README starts with a quick start for players, a download button and
  screenshots from the game.

### For guide authors

- Guide packs: write your own guides in a pack of your own, with `new` to
  start one from a template, `lint`, `playtest`, `dev` (rebuilds into the game
  on every save), `play` (the real addon in the browser), `compile`,
  `install` and `pack` (the release zip). See docs/PACKS.md.
- Lint checks the places of `sethome`, `hearth`, `fly` and `getfp`, and warns
  on a `goto` whose next goal is within 200 yards; route drafts no longer
  write one.
- `lint`, `compile`, `dev`, `play`, `install` and `pack` stop with one clear
  message when the reference data is missing.
- `dev` reports a deleted `pack.json`, keeps the last good build and builds
  again once it is back.
- `find` lists inns and flight points as guide lines.
- `sim compare` takes the pack folder as its argument, like the other pack
  commands.
- Docs: the guide format on one page (docs/GUIDE_CHEATSHEET.md), and what the
  `fly` check accepts.

### For contributors

- A second, independent route search checks the first; the README's numbers
  and charts show both.
- `version` sets `guides/pack.json` too, so the guides addon's TOC carries
  the release version after compile; docs/RELEASING.md separates private test
  builds from public releases.
- The UI renders in docs/preview show this release's windows and come out
  byte for byte the same from any checkout: textures go through a zlib
  encoder of the preview's own (Node's zlib gives different bytes from one
  Node to the next), quest markers are built in quest ID order (LuaJIT walked
  the quest log in another order and stacked overlapping markers
  differently), the test client's `date()` is UTC, `preview` refuses local
  inputs unless they render outside the repository, and the guide menu scenes
  load frozen copies of six compiled guides, so they change only with the UI,
  never with a guide recompile.
- CI runs `npm test` on pushes and pull requests, and fails when the committed
  textures differ from a fresh `media` build or the committed UI renders
  differ from fresh ones.
- `--help` prints a command's usage and never runs it; test helpers live in
  tests/helpers; one copy of each client helper in Core/Compat; every AddOns
  and WTF folder lookup goes through tools/lib/addons.js
  (`$WOW_FOREVER_ADDONS` first, then the detected clients); `.gitattributes`
  and `.editorconfig`.
- A docs map (docs/README.md), READMEs in the main folders, CONTRIBUTING.md
  and issue forms for wrong steps and bugs.
- The design system is docs/DESIGN.md, which now also says who the windows
  are for and what they must do (formerly PRODUCT.md and docs/UI_BRIEF.md).
- The tools share one copy of each foundation: the repository's folders
  (tools/lib/paths.js), the argument parser (tools/lib/cli.js), the XP rules
  (tools/lib/game/xp.js) and the races and classes with their mask bits
  (tools/lib/game/races.js).
- Fields the addon sets on game frames share one prefix, `ps`, explained in
  addon/README.md.

## 0.1.0 (2026-10-13)

The first public beta. One addon for the whole of WoW: Forever, with 164
guides: 63 leveling guides that take both factions from 1 to 60 from every
race's starting zone (Zephras Isle for the Skyborne included), the twelve
professions from 1 to 300, 17 reputations, 7 exploration guides, the Legacy
challenges and 64 collectible guides, one per mount and per pet. Around them:
a 3D waypoint arrow with a travel planner, quest markers on the map, an
upgrade indicator on item tooltips, a search for where any item, mount or pet
comes from, a dungeon quest journal, rare alerts and quality-of-life helpers.
The leveling routes come from a simulator that plays millions of complete
1-60 routes for each start and keeps the one that reaches 60 soonest under
its model.
