# Guide packs

A guide pack is someone else's guides for Polestar. The first half of this
page is for players; the second half is for people who want to write their
own.

## For players

### What a guide pack is

- A guide pack is a separate addon, made by someone who is not part of
  Polestar.
- Its guides are that person's own. They are not Polestar's leveling routes,
  and Polestar does not test or vouch for them.
- Polestar does not ship, host or recommend any pack. You only see a pack if
  you install it yourself.
- A pack adds guides. It never replaces Polestar's guides or another pack's.

### Telling a pack from Polestar's own addons

In the game's AddOns list, Polestar has one entry in the Quests category.
Open it and you see Polestar's own addons and the packs you have installed,
side by side.

- **Polestar's own addons** are Polestar Guides and the addons that carry
  Polestar's data (Polestar Quest Database, Polestar Item Data, Polestar
  Codex), plus Polestar Recorder for guide authors. Each lists Polestar as
  its author.
- **A pack** built with Polestar's tools is titled "Polestar Pack:" and its
  own name, such as "Polestar Pack: Emberway Routes". Point at it and the
  tooltip shows its version and a line such as "Guide pack for Polestar by
  Ashka", unless its author wrote a line of their own.

### Installing a pack

1. Install Polestar first: a pack does nothing without it.
2. Download the pack from wherever its author publishes it, such as
   CurseForge, Wago or the author's own site. A pack's page there should say
   that it needs Polestar.
3. Install it like any addon: with your addon app, or by unzipping it into
   the game's `Interface/AddOns` folder, next to the `Polestar` folders.
4. Restart the game. After the first install, `/reload` is enough when the
   pack updates.

### Where its guides show

Open the guide menu (`/polestar guides`). Below Polestar's own categories is
a heading, **Guide packs**, with one entry per pack: its title and its
author. Each guide's details say who wrote it, as "By <author> · <pack>
<version> · <licence>".

Polestar suggests the next guide from its own guides. To have suggestions
come from a pack instead, pick it under **Suggest guides from** in Options >
Guide packs. Polestar's guides still fill in wherever the pack has nothing
for your character.

### Turning a pack on or off

Options > Guide packs (`/polestar packs`) lists every pack you have
installed, with its author, version, licence and website. The switch on a
pack's row shows or hides its guides at once, without a reload. To remove a
pack for good, delete its folder or uninstall it in your addon app.

If a pack cannot run, its row says why. If it has problems, the row says how
many, with **Show** to read them and **Copy report** to copy them for the
author.

### Who supports a pack

The pack's author. Report wrong steps and other problems in a pack to its
author, where they publish it, not to Polestar. The Guide packs page shows
the pack's website when the author gave one, and **Copy report** gives you
the details to send.

### A word on safety

A pack is an addon like any other, and the game runs it like any other.
Install packs only from authors you trust, and from the place the author
publishes them.

## For authors

### Your own guides, on Polestar's tools

If you write leveling guides, you can use everything Polestar uses for its
own:

- the guide format: plain text `.guide` files
  ([GUIDE_FORMAT.md](GUIDE_FORMAT.md), on one page in
  [GUIDE_CHEATSHEET.md](GUIDE_CHEATSHEET.md));
- the compiler, which fills in quest titles, givers and coordinates from the
  reference data;
- `lint`, which checks every guide, and `playtest`, which plays each one to
  the end in the real addon without the game;
- in the game, Polestar's guide engine, its waypoint arrow and its markers
  on the map.

Publish the result as your own addon, on the addon sites, in the shape
Polestar expects. Players install it next to Polestar and your guides appear
in Polestar's guide menu under **Guide packs**, with your name on them.

### From an empty folder to a published pack

```sh
git clone https://github.com/fitzforge/polestar.git
cd polestar
npm link               # puts `polestar` on your PATH
polestar data build    # the reference data every guide command reads
polestar doctor        # checks the setup and prints the fix for anything missing
cd ..                  # your pack goes beside the clone, not inside it
polestar new my-pack   # asks for the id, title, author and licence
cd my-pack
polestar dev --play    # lint and build on every save, with the browser playground
```

1. **`polestar new`** writes the pack: `pack.json`, an example guide, a
   README for your players and the `LICENSE` you chose. In a clone of the
   public repository it also writes a GitHub workflow that checks every push.
2. **Write your guides** in the `.guide` files. `polestar find <text>`
   prints quest, NPC and place lines ready to paste; in the game,
   `/polestar where` prints where you stand. An AI assistant can help you
   draft guides from your own material:
   [PACKS.md, "With an AI assistant"](PACKS.md#with-an-ai-assistant) says
   how, and why every id it writes needs checking. The pack `new` writes
   carries a skill for coding agents, polestar-guide-pack, with the
   workflow and the guide format on one page.
3. **Check them.** `polestar lint` checks every guide, and
   `polestar playtest` plays each one to the end in the real addon, for
   each race that can reach it and each class it has steps for.
4. **Try them in the game.** `polestar install` builds the pack and copies
   it into the game's AddOns folder; restart the game the first time.
5. **Build the release.** `polestar pack` writes
   `dist/<folder>-<version>.zip`.
6. **Publish it** as a new addon project on CurseForge, Wago or GitHub.
   On CurseForge and Wago, mark Polestar as a required dependency so the
   addon app installs it with your pack. With the template's workflow, a
   version tag on GitHub builds the zip and attaches it to a release.
7. **Update it**: raise `version` in `pack.json`, run `polestar pack` again
   and upload the new zip.

### What a pack holds

You write two things:

- `pack.json`: the pack's `id`, `title`, `author`, `version` and `license`,
  all required, and optionally a `website`, a `source` (where the guides come
  from, in your words), a `notes` line for the AddOns list and a `folder`
  name.
- your `.guide` files.

`polestar compile` (run for you by `dev`, `install` and `pack`) writes the
addon from them: the TOC, `Pack.lua` with your credits, `Guides.lua` with
the compiled guides, `MapFrames.lua`, and the licence files. Do not edit
these by hand: rebuild instead. [PACK_FORMAT.md](PACK_FORMAT.md) has every
line of them.

The TOC places your pack in the AddOns list for you: titled "Polestar Pack:
<your title>", under Polestar's entry in the Quests category, with the line
"Guide pack for Polestar by <author>" unless you write your own `notes`.
Polestar's own menus show your title as you wrote it.

### What the tools require

These are checked. `lint` reports them, and `compile`, `install` and `pack`
stop until they are fixed:

- `id`, `title`, `author`, `version` and `license` in `pack.json`. The id is
  2 to 32 lower-case letters, digits or hyphens, and not one Polestar
  reserves. A title and an author name are at most 64 characters.
- Every guide id starts with your pack id and a slash (`ashka-emberway/...`).
- The addon folder is not named `Polestar` and does not start with
  `Polestar_`. By default it is `PolestarPack_` and your title
  (`PolestarPack_EmberwayRoutes`).
- A `website`, when you give one, starts with `https://` or `http://`.
- A `next` line hands over only to a guide that exists, is for the same
  faction, and that the characters of your guide can follow.

`lint` also warns while `LICENSE` still holds the placeholder line `new`
writes for a licence it has no text for.

### What we ask of you

These are not checked by any tool. They are what players need to tell your
pack apart and to reach you:

- **A name that says whose it is.** Pick a title of your own that cannot be
  mistaken for Polestar's own addons (the tools put "Polestar Pack:" before
  it in the AddOns list), and say on your addon page that it is a guide pack
  for Polestar. If you write your own `notes`, keep it clear that the pack
  is yours and for Polestar.
- **Your name as author** (required), the name players will look for.
- **A version** you raise with every release (required by the tools).
- **A website or support link** in `website`, so the Guide packs page shows
  players where to report problems. Say the same on your addon page and in
  your README.
- **A licence of your choice** for your guides. Polestar's
  [LICENSE-EXCEPTION.md](../LICENSE-EXCEPTION.md) lets you publish a pack
  built by its compiler, including the reference data the compiler puts in
  it, under any terms you like.
- **Your own guide text.** Do not copy text from Polestar's own guides into
  your pack. The licence exception does not cover it. Handing over to one of
  Polestar's guides with `next` is fine: that points to the guide, it does
  not copy it.
- **Support for your pack.** Players are told to report problems in a pack
  to its author, so answer them there.

### More

[PACKS.md](PACKS.md) is the full handbook: setup on each system, the four
ways to write guides (by playing, from the simulator, by hand, with an AI
assistant), testing, publishing, updating after a game patch, and every
message the tools or the game can show, with its fix.

Questions, or a pack to show? Players and authors meet on the
[Polestar Discord](https://discord.gg/vMbee6F2e9).
