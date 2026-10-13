# Releasing

Releases are built on a maintainer's machine, not in CI: the data addons are
generated from the game client's tables and local sources that are not in the
repository. CI (`.github/workflows/ci.yml`) runs the test suite on every push
and pull request against a fresh clone, where the tests that need built data
skip with a reason.

## What ships

`node tools/polestar.js pack` writes three files to `dist/`:

| File | Contents |
|---|---|
| `Polestar-<version>.zip` | `Polestar` (with `LICENSE` and a player `README.txt`), `Polestar_Guides`, and `Polestar_QuestDB` / `Polestar_ItemDB` when built |
| `Polestar_Recorder-<version>.zip` | `Polestar_Recorder` (optional, with `LICENSE`) |
| `SHA256SUMS` | checksums of both zips, in the format `sha256sum -c` reads |

Addon folders sit at the top level of each zip, so a player (or an addon
manager) extracts straight into `Interface/AddOns/`. The zips are
reproducible: the same sources give byte-identical archives.

Guide packs are packed by their authors with `polestar pack` in the pack
folder (`<pack>/dist/<folder>-<version>.zip`, version from its `pack.json`);
see docs/PACKS.md.

## Version

The version lives in `package.json`, in `guides/pack.json` (the manifest of
our guides' pack: `compile` writes its version into `Polestar_Guides.toc`)
and in the `## Version` line of every addon TOC. One command sets them all:

```sh
node tools/polestar.js version            # print it; exit 1 if guides/pack.json or a TOC disagrees
node tools/polestar.js version 0.2.0      # set package.json, guides/pack.json and every addon TOC
```

Data addons rebuilt later take the version from `package.json`. Versions
follow `x.y.z`; `0.x` releases are betas.

## Private builds and public releases

A private build, for testing while the repository is private, may use the
full local data build of the steps below. A public release follows
[THIRD_PARTY.md](../THIRD_PARTY.md) ("Distributing Polestar"): the data
rebuilt with `data build --no-questie`, then `Polestar_QuestDB` and the
guides rebuilt from it, without `data/forever/dungeons.json` and without the
Codex.

## Steps

Replace `0.2.0` with the new version throughout.

1. Start from a clean, up-to-date `main` with the game client installed
   (the data build reads its tables and installed addons).

2. Set the version and rebuild the data, the data addons and the guides (for
   a public release, build the data as
   [Private builds and public releases](#private-builds-and-public-releases)
   says):

   ```sh
   node tools/polestar.js version 0.2.0
   node tools/polestar.js data build
   node tools/polestar.js questdb build
   node tools/polestar.js itemdb build && node tools/polestar.js gear build
   node tools/polestar.js lint
   node tools/polestar.js compile
   ```

3. Run the whole suite with the data built (nothing skips for missing data
   now):

   ```sh
   node --test "tests/**/*.test.js"
   ```

4. Pack and check the archives:

   ```sh
   rm -rf dist && node tools/polestar.js pack
   (cd dist && sha256sum -c SHA256SUMS)
   unzip -l dist/Polestar-0.2.0.zip
   ```

5. Smoke-test the zips as a player gets them: unpack both into an empty
   AddOns folder and load the addons from there under Lua 5.1, with the stub
   client the tests use (`POLESTAR_ADDON_DIR` points the test loader at
   another addon folder):

   ```sh
   smoke=$(mktemp -d)
   unzip -q dist/Polestar-0.2.0.zip -d "$smoke/AddOns"
   unzip -q dist/Polestar_Recorder-0.2.0.zip -d "$smoke/AddOns"
   POLESTAR_ADDON_DIR="$smoke/AddOns" node --test tests/release.test.js
   rm -rf "$smoke"
   ```

   The test loads every addon in the folder in client order, logs in, and
   checks that the guides registered, a guide opened, the data addons loaded
   and every TOC carries the release version.

6. Then install the zip into the game itself, restart it fully and play the
   first steps of a guide.

7. Commit the version bump and the regenerated files that are tracked
   (`git status` lists them; `Polestar_QuestDB` and the other local packs are
   ignored), tag the commit and push:

   ```sh
   git add package.json guides/pack.json addon/Polestar addon/Polestar_Guides addon/Polestar_ItemDB addon/Polestar_Recorder
   git commit -m "Release: 0.2.0"
   git tag -a v0.2.0 -m "Polestar 0.2.0"
   git push origin main v0.2.0
   ```

8. Write the release notes to `dist/notes-0.2.0.md` (`dist/` is not
   committed): what changed for players first (guides, routes, features,
   fixes), then for guide authors and the toolchain. Hours to 60 are the
   simulator's model estimates and are written as such, with the world they
   come from.

9. Publish the release with the three files from step 4:

   ```sh
   gh release create v0.2.0 --verify-tag --title "Polestar 0.2.0" \
     --notes-file dist/notes-0.2.0.md --prerelease \
     dist/Polestar-0.2.0.zip dist/Polestar_Recorder-0.2.0.zip dist/SHA256SUMS
   ```

   Drop `--prerelease` from 1.0.0 on.
