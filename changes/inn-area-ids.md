---
section: contributors
---
- `travel build` gives every inn in `Nav/TravelData.lua` its AreaTable area,
  from the AreaTable `data build` caches (`tools/lib/data/areas.js`, also read
  by `compile`); `Compat.GetAreaName` reads `C_Map.GetAreaInfo`; Nav exposes
  `Nav.FindInn` and `Nav.BoundInn`. `tests/engine-l10n.test.js` plays the
  steps on a fake French client.
