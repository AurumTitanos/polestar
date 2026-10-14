# Changelog

## 0.2.0 (unreleased)

### For players

- Guide packs: guides written by other players load beside Polestar's own,
  with a Guide packs page in Options (`/polestar packs`) that shows each
  pack, turns it on or off and reports its problems.
- A welcome greets each new character by name, centred, with the guide
  Polestar suggests; Set up appears only on the account's first character.
- Guides: one guide per stay in a zone (Stranglethorn Vale and Un'Goro
  Crater, which were split into parts, are one guide per stay); inn names as
  the game reports them, so binding and hearthing check off; Northwatch
  Hold's step names its levels; no travel step before goals that lead there
  themselves.
- Class quests in the leveling guides of both factions, at the start and
  level where each class gets them: Shaman totems, Warlock demons, Hunter
  pets and Beast Training, Paladin and Priest spells, Warrior stances, Druid
  forms and Rogue poisons.
- Leveling guides of both factions reworked: quests that block a solo player
  dropped or made optional, flight paths and training at the right levels,
  Forever's own additions, rare drops optional, fixed points and level tips.
- Alliance 40-50: less grinding. Keeping Pace on the ride through the
  Shimmering Flats into Tanaris; The Curse of the Tides, Pearl Diving and
  Return to Corporal Kaleb on one loop through northern Stranglethorn.
- Horde leveling guides: each training stop is for the classes whose trainer
  stands there, with stops of their own for Druids (Thunder Bluff) and Undead
  Paladins (Brill, the Undercity, Thunder Bluff), no gap of more than about
  five levels, and riding at 40 from each race's own riding trainer.
- Alliance leveling guides: each training stop is for the classes whose
  trainer stands there, with stops of their own for Shamans (Ironforge) and
  Druids (Stormwind, Darnassus); new training in Ironforge on the way out of
  Dun Morogh, in Stormwind after Duskwood and on the way to Stranglethorn, no
  training in Auberdine, which has no class trainer; the Sentinel Hill flight
  path for every race; riding at 40 from each race's own riding trainer.
- Collectible, Legacy and reputation guides: clearer notes (warlock mount
  hand-offs, Merchant's Favor camps, Timbermaw and Cenarion Circle
  standings), and optional extras marked as such.
- Gathering loops in Mulgore and Redridge point at the nodes; an exploration
  area the game names twice is listed once.
- The guide arrow knows every place a target spawns: the map marks the other
  places (fainter, "It also spawns here"), and a click on the arrow, the arrow
  button or a mark moves on to the next one.
- Quest markers cover every place a quest's mobs and objects spawn (before:
  at most 8 areas per mob per map), and a kill no longer redraws them all.
- Quest nameplate icons sit beside the health bar you see, with replacement
  nameplates as well as the game's own.
- Guide window: each tab shows its guide's level range; a narrow tab cuts the
  title, not the range.
- Windows: a page's subtitle wraps to two lines inside the header, and no
  text runs past a window's edge, in the game font or in Inter.
- Hub: the search placeholder picks the first of its wordings that fits the
  box, in any font.
- Beta wording everywhere, and British spelling in the interface.
- The README starts with a quick start for players, a download button and
  screenshots from the game.
- The Recorder's command is `/psrec`, replacing `/lsrec`; `/polestarrec`
  still works.

### For guide authors

- Guide packs: write your own guides in a pack of your own, with `new` to
  start one from a template, `lint`, `playtest`, `dev` (rebuilds into the game
  on every save), `play` (the real addon in the browser), `compile`,
  `install` and `pack` (the release zip). See docs/PACKS.md.
- Lint checks the places of `sethome`, `hearth`, `fly` and `getfp`, and warns
  on a `goto` whose next goal is within 200 yards; route drafts no longer
  write one.
- `find` lists inns and flight points as guide lines.
- `dev` reports a deleted `pack.json`, keeps the last good build and builds
  again once it is back.
- `sim compare` takes the pack folder as its argument, like the other pack
  commands.
- `lint`, `compile`, `dev`, `play`, `install` and `pack` stop with one clear
  message when the reference data is missing.
- Docs: the guide format on one page (docs/GUIDE_CHEATSHEET.md), what the
  `fly` check accepts.

### For contributors

- `version` sets `guides/pack.json` too, so the guides addon's TOC carries
  the release version after compile; docs/RELEASING.md separates private test
  builds from public releases.
- A second, independent route search checks the first; the README's numbers
  and charts show both.
- A docs map (docs/README.md) and READMEs in the main folders.
- CONTRIBUTING.md and issue forms for wrong steps and bugs.
- `--help` prints a command's usage and never runs it; CI runs `npm test` on
  pushes and pull requests and fails when the committed textures differ from
  a fresh `media` build; test helpers live in tests/helpers; one copy of each
  client helper in Core/Compat; every AddOns and WTF folder lookup goes
  through tools/lib/addons.js (`$WOW_FOREVER_ADDONS` first, then the detected
  clients); `.gitattributes` and `.editorconfig`.
- The UI renders in docs/preview show this release's windows and come out
  byte for byte the same from any checkout: their textures are compressed by
  a zlib encoder of the preview's own (Node's zlib gives different bytes from
  one Node to the next), quest markers are built in quest ID order (LuaJIT
  walked the quest log in another order and stacked overlapping markers
  differently), the test client's `date()` is UTC, and
  `preview` refuses local inputs unless they render outside the repository.
  The guide menu scenes load frozen copies of six compiled guides, so they
  change only with the UI, never with a guide recompile. CI renders them
  again and fails when they differ from the committed ones.
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
