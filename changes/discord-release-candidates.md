---
section: contributors
---
- `tools/discord-bot`: a prerelease (`v0.3.0-rc.1`) tells no #bugs thread
  its fix is out; it pings the tester role once in the testers channel,
  with its player entries, when `DISCORD_TESTERS_CHANNEL_ID` and
  `DISCORD_TESTER_ROLE_ID` are set. A full release tells an issue closed by
  a commit only when its tag holds that commit, so a patch no longer
  claims fixes merged into `next`; one closed by hand still counts from the
  full release before, never from a prerelease. The release workflow runs
  `next`'s bot, so a patch tag cut from an older release gets the current
  one (`tools/discord-bot/README.md`).
