# Native live Planner

Open **Live dashboard** or **Compact map** in the guide window's menu, or
use `/polestar live` and `/polestar minimap`. Both windows start hidden and
have optional key bindings. Their size and position are saved separately.

The full Planner shows the active guide's complete steps, a terrain map,
and live character, XP, quest-log and quest-item details. Clicking a future
step previews it only in this window. **Follow current** returns to the
active step; browsing never advances the guide or retargets its arrow.

The compact map uses one shallow toolbar and no XP footer. Drag the zone
name to move the window or the terrain to pan. Use the wheel and +/- to
zoom; zooming out from a zone reaches its parent map. Its options menu
controls locking, opacity and automatic zoom. With **Follow** and **Auto
zoom** enabled, the camera fits the remaining connected walk and gradually
zooms in as the player approaches. Manual zoom turns automatic zoom off.
The full and compact windows have independent cameras.

**Layers** controls objective regions, optional spawn circles, guide markers
and Questie spawn icons. Hover regions and markers for objective details.
Questie is optional. Its active objective pins are copied into separate
viewer frames, including colors and tooltips; existing Questie frames are
never reparented or moved. This shows known spawn locations, not live mobs.

## Data and boundaries

Navigation uses Polestar's existing route geometry and compiled objective
locations. This is a viewer, not new pathfinding. A direct segment is labeled
as unverified. Missing terrain, position or character APIs remain visibly
unavailable instead of being simulated. Protected health/resource values are
passed directly to the client's text renderer; they are not exported or used
for calculations. Hidden windows stop their update handlers. Visible map
position updates are capped at five per second; optional Questie registry
scans run at most twice per second with bounded work and reusable frames.

No external bridge, network service, process-memory access, saved-file polling,
movement automation or guide pack is required. No purchased guide content or
client artwork is bundled with this implementation. An optional `RoutePlan`
module can annotate completed quests; this viewer works without that module.

## Terrain index provenance and regeneration

`addon/Polestar/UI/LiveTerrain.lua` contains native client FileDataIDs for the
same minimap terrain used by the browser Planner. Its header records the
product and client build. Artwork stays in the installed game client.

After building the browser Planner artwork cache with the project's existing
`planner art` command, run:

```sh
node tools/build-live-terrain.js
node tools/build-live-terrain.js --check
```

The generator reads the repository's cached `Map.csv` and WDT MAID records,
checks that their tile coordinates and bounds match the Planner art index,
and writes only IDs, coordinates and sea colors. It performs no downloads.
`--check` needs those source caches, even though ordinary viewer tests do not.
Other client builds may need regeneration; a rejected texture is reported in
the map and retried on an explicit refresh rather than every position tick.

## Review and validation

The `tests/live-*.test.js` suites run the actual Lua against synthetic client
APIs. They cover projection/clipping, route framing, independent cameras,
hidden-window inactivity, optional data, protected values, and read-only
guide browsing. `node tools/polestar.js preview` includes full and compact
views with flat synthetic terrain. The committed SVGs contain no game art.

This implementation is submitted for review as a draft. Remaining validation
includes current in-client layout/reload checks, high-pin-count profiling,
broader client-build coverage, and native-speaker translation review. The
Questie overlay reads its private `QuestieMap.questIdFrames` registry (tested
against the installed Questie 12.1.0 shape); that compatibility boundary needs
maintainer review. Missing or incompatible registries degrade to a status
message. The terrain index's generation/release policy also needs agreement.
