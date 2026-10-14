# Contributing to Polestar

Polestar is a guide addon for WoW: Forever: a Lua 5.1 addon in `addon/`, the
guides in `guides/`, and Node tools in `tools/` that check, compile, play and
package them. You can help without touching any code.

## Ways to help

- **Report a wrong step.** A quest that is not where the guide says, a step
  that never checks off, an order that wastes a trip. Open an issue with the
  "Wrong step" form.
- **Fix a guide.** Guides are plain text files; a fix is often one line. See
  [Fixing a guide](#fixing-a-guide).
- **Record a session.** The Polestar Recorder addon (shipped beside Polestar)
  logs your play while you follow a guide. Import it with
  `node tools/polestar.js record import` and attach the output of
  `node tools/polestar.js record report`: per step times, XP per hour, deaths
  and detours show where a route is slow.
- **Code.** Bugs in the addon or the tools; see [Code changes](#code-changes).
  For a Lua error, use the "Bug report" form.

## A good wrong-step report

- The guide and the step as the guide window shows them (the guide's title
  and the step's number and text).
- What is wrong: what the step says, and what you found in the game.
- The right spot: stand there and type `/polestar where`. It prints your map
  and position as guide lines (`zone map <id>` and `goto <x>,<y> live`) and
  opens them in a box you can copy from.
- Your race, class and level.
- Your Polestar version (shown at the foot of the Options sidebar and in the
  game's AddOns list).

## Fixing a guide

Each guide's title leads to its file: the leveling guides live under
`guides/forever/<faction>/...` (for example
`guides/forever/alliance/02-westfall.guide` is "Westfall"), and the first
line of every file names the guide's id. To find the step for a quest, search
for the quest id:

```sh
git grep "accept 184"
```

- The format is in [docs/GUIDE_FORMAT.md](docs/GUIDE_FORMAT.md), and on one
  page in [docs/GUIDE_CHEATSHEET.md](docs/GUIDE_CHEATSHEET.md).
- The comments at the top of a leveling guide explain the route's choices
  (where it comes from, the flow through the zone, what it leaves out). Read
  them before moving steps around, and update them when a fix changes the
  route.
- Check your change:

  ```sh
  node tools/polestar.js lint                       # every compile check, writes nothing
  node tools/polestar.js playtest --filter westfall  # play the matching guides to the end for every class
  ```

  `--filter` plays only the guides whose file or id contains its text;
  `--class Warrior` narrows it to one class.

Both need the reference data (below). If you cannot build it, send the fix
anyway: describe what you changed and why, say that you could not run the
checks, and they are run before it is merged.

## Setup

- Node 24 or newer: every command.
- Lua 5.1 or LuaJIT: `play`, `playtest`, `record import` and the addon tests.
  `$LUA` picks one when you have several.
- The reference data, `data/forever/`: quest titles, givers and coordinates,
  used by every guide command. `node tools/polestar.js data build` assembles
  it from pfQuest, Blizzard client tables and recordings, and reads QuestieDB's
  Forever store from addons installed with your game (`--no-questie` builds
  without it). `node tools/polestar.js help data` lists the options;
  [docs/PACKS.md](docs/PACKS.md) has the install commands per system.

`node tools/polestar.js doctor` checks Node, Lua, the reference data, the
AddOns folder and `pack.json`. `node tools/polestar.js help` lists every
command.

## Code changes

- [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) explains how the addon and the
  tools fit together; [docs/README.md](docs/README.md) maps every document.
- Keep the suite green:

  ```sh
  npm test        # the same as: node --test "tests/**/*.test.js"
  ```

  A few tests skip when the reference data or the game client is missing.
  [tests/README.md](tests/README.md) describes the suite, and
  [docs/SUITE.md](docs/SUITE.md) what is in and out of scope. CI runs
  `npm test` on every pull request, then fails when the textures in
  `addon/Polestar/Media` differ from what `node tools/polestar.js media`
  builds: after changing `tools/media`, run it and commit the textures.
- For UI changes, `node tools/polestar.js preview` renders the guide window,
  menu and options to `docs/preview/*.svg`; look at them before and after,
  and commit them with the change: CI renders them again and fails when they
  differ. They change only with the addon's Lua, never with a guide
  recompile: the guide menu scenes load frozen copies of six compiled guides
  (`tests/fixtures/preview`). [docs/DESIGN.md](docs/DESIGN.md) describes the
  visual system.

## Commits and pull requests

- One change per commit.
- Plain messages that describe the change for the players or authors it
  affects (for example "Westfall: turn in at Sentinel Hill before the farms"), not
  how it was made.
- Behaviour changes come with tests that show the behaviour.

## Licence

Contributions to Polestar are under GPL-3.0 ([LICENSE](LICENSE)). Guide packs
written by others are separate works; see
[LICENSE-EXCEPTION.md](LICENSE-EXCEPTION.md).
