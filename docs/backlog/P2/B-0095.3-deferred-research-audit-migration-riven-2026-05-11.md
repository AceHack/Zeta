---
id: B-0095.3
zetaid: 081KRA5AR0008QG0R00267TPQX
priority: P2
status: open
title: Deferred research audit + per-item migration to escrow
tier: factory-hygiene
effort: S
ask: re-decomposition of B-0095 (2026-05-11)
created: 2026-05-11
last_updated: 2026-05-11
parent: B-0095
depends_on: [B-0095.1, B-0095.2]
composes_with: [B-0095, B-0095.1, B-0095.2]
tags: [riven-2026-05-11, escrow, migration, audit, deferred-research]
type: migration
---

# B-0095.3 — Deferred research audit and migration

Atomic: complete the audit of open backlog/P* rows + research/ (non-escrowed) items; classify ESCROWABLE/STAYS/etc per B-0095 sub-ask 3; migrate eligible items (one PR per item or small batch) with full schema + §33 headers. Starts only after rules + naming locked.

This child is intentionally S because audit surface is broad; future re-decomp allowed if needed.

## Acceptance

- [ ] full audit logged
- [ ] eligible items migrated with schema
- [ ] ineligible retain rationale
- [ ] no bulk move before rules
