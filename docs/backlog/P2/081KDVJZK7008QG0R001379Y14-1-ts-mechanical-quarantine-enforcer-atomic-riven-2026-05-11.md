---
id: 081KDVJZK7008QG0R001379Y14
priority: P2
status: open
title: TS mechanical quarantine enforcer (.quarantine/ + gitignore + gitattributes)
tier: factory-hygiene
effort: S
depends_on: []
composes_with:
  - 081KQ8P5D0008QG0R003MY8246
tags: [riven-2026-05-11, ts-prefer, mechanical-quarantine, compliance]
---
# 081KDVJZK7008QG0R001379Y14 — Atomic child: TS mechanical quarantine enforcer

Smallest slice of 081KQ8P5D0008QG0R003MY8246 enhancement #1: implement `tools/hygiene/audit-quarantine-enforcer.ts` that ensures `.quarantine/` exists in .gitignore and .gitattributes (export-ignore), creates dir if missing, outputs verification report. Pure TS, no bash. Unblocks scanner + inference children.

Dependency root: none. S effort.

Focused check: `bun run tools/hygiene/audit-quarantine-enforcer.ts --verify` produces clean report, 0 lint errors, .gitignore/.gitattributes updated correctly.

This unblocks 081KDVJZK7008QG0R0023FS41G (scanner self-destruct) by providing the quarantine surface.
