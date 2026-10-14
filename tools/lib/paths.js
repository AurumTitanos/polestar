'use strict';
// The repository's folders, defined once: every tool resolves paths from
// these instead of counting `..` from its own place.
//
//   ROOT     the repository
//   DATA     data/forever, the reference data `data build` writes (gitignored)
//   SOURCES  data/sources, cached downloads (gitignored)

const path = require('node:path');

const ROOT = path.join(__dirname, '..', '..');
const DATA = path.join(ROOT, 'data', 'forever');
const SOURCES = path.join(ROOT, 'data', 'sources');

module.exports = { ROOT, DATA, SOURCES };
