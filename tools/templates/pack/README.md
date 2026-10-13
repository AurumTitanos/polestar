# {{title}}

A guide pack for Polestar, the leveling guide addon for World of Warcraft:
Forever, by {{author}}.

## For players

1. Install Polestar first.
2. Download `{{folder}}-<version>.zip` from this project's releases and unzip
   it into the game's `Interface/AddOns/` folder, next to `Polestar`.
3. Start the game. The pack's guides appear in Polestar's guide list; type
   `/polestar packs` to turn the pack on or off.

Credits: {{author}}. Licence: {{license}} (see `LICENSE`).

## For authors

This pack was started with `polestar new`, which needs an empty folder: for
your next pack, run `polestar new` first and `git init` in the folder after
(a folder holding only `.git` counts as not empty).

You need Node 24 or newer, Lua 5.1 and a Polestar clone with `npm link`
run in it (`polestar doctor` checks all of it). From this folder:

- `polestar find <text>`: look up quest, NPC, object, item and guide ids.
- `polestar lint`: check the guides (in VS Code: the default build task).
- `polestar playtest`: play every guide to the end in the real addon.
- `polestar dev`: copy the pack into the game's AddOns folder while you work.
- `polestar pack`: write the release zip to `dist/`.

The guide format is described in docs/GUIDE_FORMAT.md and packs in
docs/PACKS.md in Polestar's source. Start from `guides/example.guide`.
