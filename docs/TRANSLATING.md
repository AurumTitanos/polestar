# Translating Polestar

Polestar follows the game's language: a German client reads Polestar's
interface in German, and any text without a translation in English. The
translation tools are adapted from Ding! by Yendi (@moust4ki), GPL-3.0.

## Languages

`node tools/polestar.js i18n status` lists every language with how much of it
is translated (`--markdown` prints the table for the README and release
notes). The list, with each language's status and translators, is
`tools/lib/i18n/locales.js`.

- **reviewed**: written or checked by a native speaker. The tools never fill
  or rewrite its translations. German (`deDE`, thecodingcortex), Latin
  American Spanish (`esMX`, CDVolvik), French (`frFR`, Yendi).
- **ai**: made by a machine. On that client, Options > About says so and
  links to the Discord. Spanish of Spain (`esES`), Korean (`koKR`), Brazilian
  Portuguese (`ptBR`), Russian (`ruRU`), Chinese (`zhCN`, `zhTW`).

Spain's and Latin America's clients use different words for game terms
(mazmorra, calabozo), so `esES` and `esMX` are separate files. English clients
(`enUS`, `enGB`) read the English text.

## The file

Each language has one file, `addon/Polestar/Locales/<locale>.lua`:

```lua
-- German (deDE). ...

local _, ns = ...
if not (GetLocale and GetLocale() == "deDE") then return end
local L = ns.L

-- Core/Commands.lua
L["Toggle guide window"] = "Guide-Fenster ein-/ausblenden"
-- L["Next step"] = ""
```

- The key, between `L[` and `]`, is the exact English text the code shows.
  Leave it byte for byte as it is; translate the right-hand side only.
- A line starting `-- L[` is not translated yet and shows in English. To
  translate it, remove the `-- ` and write the translation between the quotes.
- Lines are grouped under the file that first uses them (`-- Core/Commands.lua`),
  so you can see where a text appears. Your own comment lines and group
  headers stay as you wrote them.
- A key `"context: text"` (`"boss: Chest"`) is one meaning of a word: translate
  the text after the colon, in that meaning.
- The block at the end, `-- No longer in the code (its English changed or it
  went away): reuse or delete.`, keeps your translations of texts the code no
  longer has, commented out. When the English of a text changed, its new key
  is in the file as a `-- L[...] = ""` line: copy your old translation there,
  adapt it, and delete the old line.

## Formats

Keep every `%s`, `%d`, `%.1f` of the key, of the same kind, in the same order.
If the sentence needs another order, number them all: `"%2$s niveau %1$d"`.
Keep `|4singular:plural;` (translate both forms), `|cAARRGGBB…|r` colours and
`|T…|t` textures. In a text with a `%s` or `%d`, write a percent sign `%%`.

## Game terms and the glossary

Where the game names something itself, Polestar shows the game's word and
there is nothing to translate: reputation standings, item qualities, the
Alliance and the Horde, gear slots, the Dungeon Journal.

For the rest, use the game's vocabulary. `tools/lib/i18n/glossary/<locale>.json`
holds about forty terms (quest, step, flight master, hearthstone, dungeon…)
with the word chosen for that language: the game client's own word first,
then the reviewed translators' choice. `i18n check` warns where the
translation of a text holding one of those terms does not use the glossary's
word. A warning is a question, not an error: fix the line, or keep your
wording where it reads better.

```json
"flight master": { "term": "Flugmeister", "client": "MINIMAP_TRACKING_FLIGHTMASTER" }
```

`term` is the word; `match` (optional) lists the forms that count, compared
without case or accents anywhere in the translation (`["annehm", "angenommen"]`);
`client` names the game's string the word comes from; `note` is any remark.
The English terms are `TERMS` in `tools/lib/i18n/glossary.js`. The game's
strings (Blizzard's GlobalStrings) are not in the repository: download them
for your language from
`https://wago.tools/db2/GlobalStrings/csv?build=<build>&locale=<locale>` into
`data/sources/wago/` (ignored by git) when you need them.

## Commands

- `node tools/polestar.js i18n sync [<locale>...]` adds every text the code
  gained to the file, commented out at the end of its file's group, and moves
  translations of texts the code lost to the block at the end. It never
  changes a line that holds a translation. A language named that has no file
  gets one, loaded from `addon/Polestar/Core/Core.xml`. Without a locale it
  updates every existing file.
- `node tools/polestar.js i18n check [<locale>...]` lists each language's
  translated and missing counts and fails on a file Lua cannot load, a stale
  key (a translated text the code no longer has, outside the end block), a key
  set twice, or a translation whose formats differ from the English. Missing
  translations are fine. CI runs it (`npm run i18n:check`), and `npm test` runs
  the same checks (`tests/i18n.test.js`).
- `node tools/polestar.js i18n status` prints the table of languages.
- `node tools/polestar.js i18n keys` lists every key with the files and lines
  that use it.
- `node tools/polestar.js i18n import <locale> <file.lua>...` merges
  translations written elsewhere: a file that returns
  `{ ["English"] = "translation" }`, sets `L["English"] = "..."`, or calls
  `ns.AddTranslations` (Ding!'s layout). It fills only texts not translated
  yet, refuses a broken format, and puts texts the code lacks in the end block.

## For developers

Write every player-facing text as a literal `L["..."]` (or
`ns.LC("context", "text")`) where it is used, so `i18n keys` finds it. After
adding, changing or removing texts, run `node tools/polestar.js i18n sync`
and commit the locale files with the change: a stale key fails `npm test`. A
text looked up through a variable (`L[category]`) must be listed in
`DATA_KEYS` in `tools/lib/i18n/keys.js`. A game term the client names
(`ITEM_QUALITY3_DESC`, `FACTION_HORDE`…) is read from the client, not put in
`L`, and its English value goes in `tests/lua/wow_stub.lua`. Tests that need a
translated client fake a language Polestar does not ship:
`fakeLocale('itIT', { ... })` (`tests/helpers/locale.js`).

## Adding a language

Add it to `LOCALES` in `tools/lib/i18n/locales.js` with its status and
translators (and to `ns.AI_LOCALES` in `addon/Polestar/Core/Init.lua` when its
status is `ai`), then run `node tools/polestar.js i18n sync <locale>`.

## Reviewing an AI-made language

Play with it, correct what reads wrong, and open a pull request that also
sets its `status` to `"reviewed"` with your name in `translators`
(`tools/lib/i18n/locales.js`) and removes it from `ns.AI_LOCALES`
(`addon/Polestar/Core/Init.lua`).
