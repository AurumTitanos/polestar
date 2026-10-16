---
section: contributors
---
- `node tools/polestar.js i18n` keeps the interface translations, adapted
  from Ding! by Yendi (@moust4ki): `status` lists the nine languages with
  their counts, status (reviewed or AI-made) and translators; `check` (run in
  CI) fails on a file Lua cannot load, a stale key or a broken format and
  warns where a translation leaves out its glossary's word; `sync` adds the
  texts the code gained to each file, commented out under their file, and
  moves translations of texts it lost to a block at the end, never touching a
  translation; `import` merges translations written apart.
  docs/TRANSLATING.md.
