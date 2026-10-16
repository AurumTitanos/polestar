# Changelog fragments

Each change's changelog entry is its own file here, so pull requests never
edit the same lines of CHANGELOG.md. A release gathers them into
CHANGELOG.md under its version and deletes them.

A fragment, `changes/<slug>.md`, names its section in front matter
(`players`, `authors` or `contributors`, for "For players", "For guide
authors" and "For contributors"), then gives the entry as CHANGELOG.md
writes it: a list item, wrapped at 78 columns.

```markdown
---
section: players
---
- Ticking a quest's accept off without taking the quest no longer sends you
  to farm for it.
```

```sh
node tools/polestar.js changelog add players --text "..."  # write one
node tools/polestar.js changelog check                     # validate them
node tools/polestar.js changelog show                      # the next release's entries
node tools/polestar.js changelog build 0.2.5               # at release only
```
