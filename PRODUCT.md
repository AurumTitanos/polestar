# Polestar

## What it is
An in-game guide addon for World of Warcraft: Forever (Blizzard's "Classic+", launch Nov 4 2026):
step-by-step leveling routes, profession, reputation, exploration and Legacy Challenge guides,
a waypoint arrow with a travel planner, and auto accept/turn-in. Free and open source; an
authoring toolchain and recorder turn real play sessions into guides.

## Who uses it
Forever players levelling characters, many of them alts, who want a quick, smooth path without
alt-tabbing to a website. They play in long sessions with the game world behind every surface, often
beside full UI suites such as EllesmereUI, ElvUI or default Blizzard frames.

## What success looks like
- The guide window and arrow sit on screen for hours without fatigue: legible over any terrain, out of the
  way in combat, instantly readable at a glance mid-pull.
- Menus feel as considered as a crafted options window: clear hierarchy, consistent rhythm, every control
  explained, not like a utility panel.
- Several guides run side by side in tabs (e.g. a class quest guide next to the leveling route).

## Constraints
- WoW addon UI: Lua frames, textures and FontStrings only; no web tech. Power-of-two textures.
- Free and open source (GPL-3.0); the code stays readable (Blizzard add-on policy).
- No third-party assets, code or text beyond the credited data sources ([THIRD_PARTY.md](THIRD_PARTY.md)); EllesmereUI is integrated only through its public
  skinning API (accent, font).
- Assumption: English first; layout must survive longer localized strings later.
