---
section: contributors
---
- Guide fixes for the latest release can ship as a patch, without the full
  data build: their pull requests go to `hotfix/<version>` (for example
  `hotfix/0.2.5`), everything else to `next` (CONTRIBUTING.md, "Branches";
  docs/RELEASING.md, "Patch releases"). The `Base branch` check fails a pull
  request to `main`, and one to a `hotfix/` branch that changes more than a
  patch may carry (`release scope`). A fix merged into `next` with the
  `backport` label gets its cherry-pick pull request to the `hotfix/`
  branch on its own. `next`, `main` and `hotfix/` branches take changes by
  pull request only, with CI green.
- `release patch` builds a patch in a `hotfix/` checkout with that
  release's own tools and data addons, and stops when the branch carries
  more than guide fixes or the reference data has moved on; `release notes`
  drafts the GitHub, CurseForge and Discord notes from the changelog.
  Publishing a release opens the pull request that merges it back into
  `next`.
