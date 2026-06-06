---
id: B-0093.4
zetaid: 081KDVJZK7008QG0R0020PEAJG
priority: P2
status: open
title: TS trajectory owners + triggers + recording surfaces table
tier: factory-hygiene
effort: S
depends_on:
  - B-0093.3
composes_with:
  - B-0093
  - B-0092
tags: [riven-2026-05-11, ts-prefer, trajectory-owners, recording-surface]
---
# B-0093.4 — Atomic child: TS trajectory owners table + recorder

Smallest slice of B-0093 enhancement #5: implement `tools/hygiene/audit-trajectory-owners.ts` that generates the owners/triggers/recording table (Continuous self-audit | Otto | before commit | commit notes, etc.) and injects into B-0092 or produces compliance audit log. Enforces "happens" not "should".

Depends on inference firewall. S effort, TS.

Focused check: table generation matches spec, no drift, 0 lint.

Unblocks lattice convergence (research) + bead audit.
