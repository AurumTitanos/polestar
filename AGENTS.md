# Polestar: for coding agents

Polestar is a leveling guide addon for WoW: Forever: a Lua 5.1 addon in
`addon/`, guides in `guides/`, Node tools in `tools/`
(`node tools/polestar.js help`). Before you work here, read the skill for
your task:

| Task | Skill |
|---|---|
| Any change, commit, pull request or issue comment | [skills/polestar-contributing/SKILL.md](skills/polestar-contributing/SKILL.md) |
| Looking at, triaging or answering a bug report | [skills/polestar-triage/SKILL.md](skills/polestar-triage/SKILL.md) |
| Fixing a step, route, giver or coordinate in `guides/` | [skills/polestar-guide-fix/SKILL.md](skills/polestar-guide-fix/SKILL.md) |
| Writing a separate guide pack | [skills/polestar-guide-pack/SKILL.md](skills/polestar-guide-pack/SKILL.md) |

The rules that hold for every task:

- A bug report is a lead, not a verdict. Check it against the guide, the
  data and Forever's own sources before agreeing it is a bug.
- Pull requests go to `next`, or to `hotfix/<version>` for a guide-only fix
  to the latest release. Never to `main`.
- Never claim a check passed that you did not run, and never invent quest
  ids, coordinates or names.
- A human reads every comment before it is posted.

CONTRIBUTING.md is the long form for people.
