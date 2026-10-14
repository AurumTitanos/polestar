# Third-party material

| Component | Used for | Licence | Where |
|---|---|---|---|
| [pfQuest](https://github.com/shagu/pfQuest) database by Shagu | Era-baseline quest, NPC, object and item facts used by the data pipeline and resolved into the guides | MIT | `data/forever/meta.json` records the exact revision; the notice ships as `addon/Polestar_Guides/LICENSE-DATA.txt` |
| Blizzard client data tables (`UiMap`, `UiMapAssignment`, `AreaTable`) via [wago.tools](https://wago.tools) | Zone names, AreaID→UiMap mapping and Era map world bounds | Game data © Blizzard Entertainment; used as facts for interoperability | `data/sources/wago/` (cache, not distributed) |
| [Inter](https://github.com/rsms/inter) by Rasmus Andersson | UI typeface | SIL Open Font License 1.1 | `addon/Polestar/Media/Fonts/` (licence text alongside) |
| [Cinzel](https://github.com/NDISCOVER/Cinzel) by Natanael Gama | The "POLESTAR" wordmark, rendered once into `addon/Polestar/Media/UI/wordmark.tga` and `wordmark-small.tga`, and drawn as outlines into the README's banners (`docs/assets/banner-*.svg`); the font file itself is not shipped | SIL Open Font License 1.1 | `tools/media/fonts/` (font and licence, build-time only) |
| [Marcellus](https://github.com/google/fonts/tree/main/ofl/marcellus) by Brian J. Bonislawsky (Astigmatic) | The lines under the wordmark in the README banner and the README's download button, drawn as outlines into `docs/assets/banner-*.svg` and `download.svg`; not used in the addon | SIL Open Font License 1.1 | `tools/media/fonts/` (font and licence, build-time only) |
| Screenshots of World of Warcraft: Forever | The README's pictures of the addon in the game | Game imagery © Blizzard Entertainment | `docs/assets/screenshots/` (documentation only; not in the addon packages) |
| Discord's logo (the symbol from [Discord's brand kit](https://discord.com/branding)) | The mark beside every link to the Polestar Discord: the report window, the invite's copy window, the welcome's last page, the foot of the hub's and the settings' sidebars | Trademark of Discord Inc., used as Discord's brand guidelines allow: unaltered, in its own colour, to link to the Polestar Discord | The symbol's outline as published, in `tools/media/ui.js`, rendered into `addon/Polestar/Media/UI/discord.tga` |
| Blizzard client data tables (`ItemSparse`, `Item`, `ItemEffect`, `SpellEffect`) via [wago.tools](https://wago.tools) | Item stats for gear advice (`Polestar_ItemDB`) | Game data © Blizzard Entertainment; used as facts for interoperability | generated into `addon/Polestar_ItemDB/` |
| Blizzard client data tables (`UiMapXMapArt`, `UiMapArt`, `UiMapArtStyleLayer`, `WorldMapOverlay`, `WorldMapOverlayTile`, `UiMap`; Forever build 1.60.1.70338) via [wago.tools](https://wago.tools) | Which world map overlay textures each zone map art has, so the zone art shows a zone without fog of war (file IDs and offsets only; no art is shipped) | Game data © Blizzard Entertainment; used as facts for interoperability | generated into `addon/Polestar/UI/ZoneArtOverlays.lua` |
| [Blizzard UI source](https://github.com/Gethe/wow-ui-source) (`forever` branch) | API reference while developing; not copied or distributed | © Blizzard Entertainment | `.ref/` (gitignored) |
| [QuestieDB](https://github.com/Questie/QuestieDB) Forever store (Questie v12) | Forever quest, NPC, object and item facts (including Forever-only quests and zones) and quest XP for the data pipeline | No licence file published | Read from the installed copy at build time; the data lands in `data/forever/` (gitignored). Facts resolved from it ship in releases: in the compiled guide pack (quest titles, givers, positions, levels) and in `Polestar_QuestDB` (quest markers), which the release zip includes and git does not |
| [ForeverLevelingBiS](https://www.curseforge.com/wow/addons/forever-leveling-bis) by Thunder (v0.5.1-beta, data 2026-10-06) | Forever item stats and where leveling gear comes from (quest rewards and choices, dungeon drops, crafts), racial gear traits; the same item sources feed the Codex's "where to get it" | MIT (Copyright (c) 2026 Thunder) | Read from the installed copy by `gear build` and `codex build` (`tools/lib/consume/foreverlevelingbis.js`); facts generated into `addon/Polestar_ItemDB/Forever.lua`, the `Gear.RACIALS` table of `addon/Polestar/Gear/SpecData.lua`, and the local `data/forever/codex/` and `Polestar_Codex` |
| [wowsims](https://github.com/wowsims) (`classic` at 7779ebbf, `sod` at four phase commits) by the wowsims team | Simulated stat weights blended into the level bands that score upgrades | MIT (Copyright (c) 2024 wowsims team) | Cached under `data/sources/wowsims/` (`gear fetch`); numbers generated into `addon/Polestar/Gear/SpecData.lua` with each band's commit and file; notice in `addon/Polestar/Gear/LICENSE-DATA.txt` |
| DungeonJournal (ForeverDungeonJournal addon) by Exehn | Dungeon facts for `dungeons build`: levels, entrances, bosses and loot, dungeon quests with chains, rewards, observed Forever XP and quest-giver positions; the Dungeons section shows them (facts only, our own wording) | No licence file published | Read from the installed copy at build time; the output stays local: `data/forever/dungeons.json` and the Codex pack's `Dungeons1.lua` (both gitignored) |
| [AtlasLoot Classic](https://github.com/Hoizame/AtlasLootClassic) (the installed "AtlasLoot Forever", version "Forever 1.60.1", by sliccer) | Codex facts: dungeon and raid bosses and their loot (including the Forever instances and per-boss drop rates), collections (mounts, companions, tabards, sets), crafted items, faction rewards by standing, PvP rewards by rank | GPL-2.0 | Importer code only (`tools/lib/consume/atlasloot.js`, reading the installed `AtlasLootClassic_*` modules and the core's `Data/Profession.lua` and `Data/Requirements.lua`); the output stays local: `data/forever/codex/` and `addon/Polestar_Codex/` (both gitignored) |
| RareScanner (1.60.1.b7) by maqjav and Maciza-Tyrande | Codex facts: rare NPC ids, maps and positions, their loot, treasure loot, mount and pet item ids | All Rights Reserved | Importer code only (`tools/lib/consume/rarescanner.js`, reading the installed copy's `Tables/`); the output stays local: `data/forever/codex/` and `addon/Polestar_Codex/` |
| Blizzard client data tables (`Item`, `ItemSparse`, `ItemEffect`, `ItemXItemEffect`, `SpellEffect`, `SpellName`, `SkillLine`, `SkillLineAbility`; Forever build 1.60.1.70338, plus Classic Era 1.15.9.70003 `Item`/`ItemSparse`/`ItemEffect` for items Forever's tables lack) via [wago.tools](https://wago.tools) | Codex item names, quality and level; which aura spell each mount and pet item teaches (mount spotting), class mounts; profession names | Game data © Blizzard Entertainment; used as facts for interoperability | `data/sources/wago/` (cache); generated into the local `data/forever/codex/` and `Polestar_Codex` |
| Web research: [Wowhead](https://www.wowhead.com/forever) database pages (Forever and Classic npc, item, quest and spell pages, and the Forever zone quest lists), wowforevertalents.com, foreverchanges.pro and Blizzard's own Forever pages | Facts checked or filled by hand or by `data build`: quest XP the data lacked (`data/sources/webxp/`), the XP and level changes Wowhead's Forever change notes record (`data/sources/wowhead/`), trainer roles of Forever NPCs, a few spawn and chain corrections (`tools/lib/data/corrections.json`, each entry with its source), mount and pet sources for the collectible guides, Forever zones, ships and race/class rules | Facts only; no text, images or code copied | Each correction entry, and each guide that relies on a web fact, names the page it used |

## Distributing Polestar

Polestar's own code and guides are GPL-3.0 (see LICENSE). What a release
(`node tools/polestar.js pack`) holds from the inputs above:

- QuestieDB: facts only, credited in the table above, in the compiled guide
  pack and in `Polestar_QuestDB`. QuestieDB publishes no licence; if its
  maintainers ask, they come out: `data build --no-questie` builds without
  them, after which `Polestar_QuestDB` is rebuilt and the guides that need
  Forever-only facts give them themselves or are recompiled from other
  sources.
- DungeonJournal: nothing. The compiler does not read
  `data/forever/dungeons.json`; a quest only it knows gets its title and
  level in the guide, from a public source the guide names.
- The Codex (`data/forever/codex/`, `addon/Polestar_Codex/`) and the zone
  crossings pack (`Polestar_Travel`) never ship: they hold AtlasLoot (GPL),
  RareScanner (All Rights Reserved), QuestieDB and DungeonJournal facts, and
  crossings from a local file. Lookup then says the Codex is missing and
  still searches guides.

EllesmereUI is all rights reserved: nothing from it is copied; Polestar only
calls its public skinning API at runtime.
