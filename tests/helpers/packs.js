'use strict';
// The guide pack tests put their guides in: pack `test`, guide ids under
// `test/` (docs/ARCHITECTURE.md, "Guide data").
//
//   TEST_PACK     the Lua line registering it
//   TEST_SOURCE   the Lua line making it the suggestion source
//                 (behavior.suggestFrom): only ours and the chosen pack are
//                 ever suggested, so a test whose character is to be given a
//                 test guide (Suggest, a guide loaded at login) runs it too

const TEST_PACK = 'Polestar.RegisterPack({ addon = "Polestar_Test", id = "test", format = 1, title = "Test", author = "Test", version = "1", license = "MIT" })';
const TEST_SOURCE = 'Polestar.Set("behavior.suggestFrom", "test")';

module.exports = { TEST_PACK, TEST_SOURCE };
