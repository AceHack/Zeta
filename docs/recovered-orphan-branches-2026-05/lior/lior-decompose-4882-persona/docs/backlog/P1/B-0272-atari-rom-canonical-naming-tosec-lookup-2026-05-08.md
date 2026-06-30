---
id: B-0272
priority: P1
status: open
title: "Atari 2600 ROM canonical naming via TOSEC/No-Intro hash lookup"
created: 2026-05-08
last_updated: 2026-05-08
parent: B-0083
depends_on: []
classification: buildable-now
decomposition: atomic
type: friction-reducer
---

# B-0272 — ROM canonical naming

Hash each ROM file, look up in TOSEC/No-Intro DAT files,
rename to canonical form. TS script at tools/roms/.

## Acceptance criteria

- Script at tools/roms/canonicalize.ts
- Renames ROMs to TOSEC canonical names
- Reports unmatched hashes
