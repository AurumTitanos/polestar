# The CurseForge listing

Everything the Polestar project on CurseForge needs, in one folder:

| File | What it is |
|---|---|
| [description.md](description.md) | The project description, ready to paste whole into CurseForge's description editor in Markdown mode |
| `images/logo-1024.png`, `images/logo-400.png` | The project avatar: the gold emblem on a night tile, no text |
| `images/banner.png` | The banner at the top of the description (the README's dark banner at 2x) |
| `images/starts.png`, `images/levels.png` | The route charts at 2x; the description shows `starts.png` |

The description's images and links point at `main` on GitHub
(`https://raw.githubusercontent.com/fitzforge/polestar/main/...` and
`https://github.com/fitzforge/polestar/blob/main/...`): CurseForge does not
show SVG reliably, strips most HTML and cannot follow relative links. The
screenshots are the README's own, `docs/assets/screenshots/*.png`.

The images are drawn in code: `node tools/polestar.js readme brand` writes
`docs/assets/avatar.svg` and, with `rsvg-convert` (librsvg) installed, every
PNG here; `readme charts` re-exports the two charts when it redraws them
(tools/README.md, "Generated files").

## Summary

For the project's summary field (plain text, at most 150 characters; this one
is 145):

```text
Free, open-source guides for World of Warcraft: Forever: leveling routes for every start, found by simulation, plus professions, mounts and pets.
```

## Project settings

- [ ] **Name:** Polestar
- [ ] **Slug:** `polestar` (the project URL, curseforge.com/wow/addons/polestar)
- [ ] **Summary:** the text above
- [ ] **Description:** [description.md](description.md), pasted whole, editor in Markdown mode
- [ ] **Avatar:** `images/logo-1024.png` (`images/logo-400.png` where a smaller file is asked for)
- [ ] **Categories:** Quests & Leveling (primary); Map & Minimap, Professions, Tooltip
- [ ] **Game flavour and version:** Forever, 1.60.1
- [ ] **Licence:** GNU General Public License version 3 (GPL-3.0)
- [ ] **Source URL:** https://github.com/fitzforge/polestar
- [ ] **Issues URL:** https://github.com/fitzforge/polestar/issues
- [ ] **Wiki or docs URL** (if asked): https://github.com/fitzforge/polestar/blob/main/docs/README.md
- [ ] **Relations:** none; Polestar needs no other addon

The categories are CurseForge's World of Warcraft addon categories as its
search page lists them (checked 2026-10-14): Quests & Leveling for the guides,
Map & Minimap for the arrow, the quest markers and the travel planner,
Professions for the twelve profession guides, Tooltip for the upgrade
indicator.

## Uploads

### The file

- **File:** `dist/Polestar-<version>.zip`, from `node tools/polestar.js pack`
  (docs/RELEASING.md). Its addon folders sit at the top level, as CurseForge
  and its app expect.
- **Display name:** `Polestar <version>`
- **Release type:** Beta (Release from 1.0.0 on, when the GitHub release
  drops `--prerelease`)
- **Game version:** Forever 1.60.1
- **Changelog:** the version's "For players" section of CHANGELOG.md, in
  Markdown, each list item joined onto one line
- **Not uploaded:** `Polestar_Recorder-<version>.zip` and `SHA256SUMS` stay on
  the GitHub release; the description links to it for the Recorder.

### The gallery

The in-game screenshots, from `docs/assets/screenshots/`, each with its title
(the description's captions, shortened):

| File | Title | Description |
|---|---|---|
| `hub-guides.png` | The hub | Guides, Lookup, Dungeons and Rares on one rail; here the Horde leveling guides by level band |
| `guide-window.png` | The guide window | The step's goals with their counters, who comes next, XP per hour and the time to level |
| `guide-transparent.png` | Transparent mode | Outlined text straight on the world; the controls appear under the cursor |
| `arrow.png` | The arrow | Distance and the goal it leads to |
| `lookup.png` | Lookup | One search over guides, mounts, items, recipes, quests, NPCs and rares |
| `dungeons.png` | Dungeons | Every dungeon by level, its quests counted for your faction |
| `dungeon-quests.png` | A dungeon's page | Who starts and ends each quest and its chain |
| `dungeon-rewards.png` | Objectives and rewards | The items to choose from, the experience and the money |
| `rares.png` | Rares | Every rare and treasure, its drops, where it spawns and how far |
| `options-appearance.png` | Options | Every setting as one row, applied as you change it |

## For a new release

1. Upload the new zip as above, with its changelog.
2. Read [description.md](description.md) against the release: the guide
   counts in "What it is" (README.md, "What it is"), the hours in "How the
   routes are made" (README.md, "The numbers"; always as the simulator's
   estimates), the "Beta" section, and any feature the release adds or
   changes. Keep each paragraph and list item on one line, as now.
3. If the charts were redrawn (`readme charts`) or the brand art changed
   (`readme brand`), commit the new PNGs too.
4. Push to `main` first: the description's images load from there.
5. Paste description.md whole over the old description (Markdown mode) and
   check the page.
