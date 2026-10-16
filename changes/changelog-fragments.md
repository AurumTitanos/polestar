---
section: contributors
---
- A change's changelog entry is a file of its own in `changes/`, written
  with `node tools/polestar.js changelog add`, instead of an edit to
  CHANGELOG.md, so pull requests open side by side no longer edit the same
  lines. `changelog check` (in CI) checks them, `changelog show` prints them
  as the release will, and `changelog build <version>` assembles them into
  CHANGELOG.md at release time (changes/README.md).
