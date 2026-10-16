<!-- Base branch: a guide fix for the latest release goes to hotfix/<next patch>; everything else goes to next. Never main. See CONTRIBUTING.md, "Branches". -->

## What and why

<!-- What changes for the player or author, and why. Issues: "closes #N" on next, "fixes #N" on a hotfix branch. -->

## The report, checked

<!-- For a bug fix: the verdict (confirmed / partly right) and the evidence: guide file and step, quest id, data, Wowhead Forever, a recording. A report is a lead, not a verdict. -->

## Checks

- [ ] `npm test`
- [ ] `node tools/polestar.js lint` and `playtest --filter <guide>` (guide changes)
- [ ] Not run, and why:
- [ ] A changelog fragment in `changes/` (`node tools/polestar.js changelog add`), crediting the reporter
- [ ] An AI agent wrote or helped with this
