---
section: contributors
---
- `node tools/polestar.js i18n names` builds the names addons
  `addon/Polestar_Names_<locale>` (committed) from DingDB, cloned into
  `data/sources/ding` and pinned to Ding v1.8.1's commit and each file's
  sha256 (a file that differs stops the build), then pfQuest's locale files
  for the names DingDB lacks, keeping only the quests, NPCs, objects and items
  the guides, the quest database and the Codex name. `--no-questie` leaves
  DingDB out. Each folder's `LICENSE-DATA.txt` records the sources, versions,
  licences and counts, with Ding's `CREDITS.md` beside it. `Polestar.Names`
  (`Core/Names.lua`) reads them; docs/ARCHITECTURE.md, "Names", and
  docs/TRANSLATING.md, "Game names".
