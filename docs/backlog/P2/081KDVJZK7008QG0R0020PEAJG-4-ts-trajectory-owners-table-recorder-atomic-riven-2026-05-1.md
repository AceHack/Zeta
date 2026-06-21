---
id: 081KDVJZK7008QG0R0020PEAJG
priority: P2
status: open
title: TS trajectory owners + triggers + recording surfaces table
tier: factory-hygiene
effort: S
depends_on:
  - 081KDVJZK7008QG0R001QH4W62
composes_with:
  - 081KQ8P5D0008QG0R003MY8246
  - 081KQ8P5D0008QG0R003ZF64GG
tags: [riven-2026-05-11, ts-prefer, trajectory-owners, recording-surface]
---
# 081KDVJZK7008QG0R0020PEAJG — Atomic child: TS trajectory owners table + recorder

Smallest slice of 081KQ8P5D0008QG0R003MY8246 enhancement #5: implement `tools/hygiene/audit-trajectory-owners.ts` that generates the owners/triggers/recording table (Continuous self-audit | Otto | before commit | commit notes, etc.) and injects into 081KQ8P5D0008QG0R003ZF64GG or produces compliance audit log. Enforces "happens" not "should".

Depends on inference firewall. S effort, TS.

Focused check: table generation matches spec, no drift, 0 lint.

Unblocks lattice convergence (research) + bead audit.
