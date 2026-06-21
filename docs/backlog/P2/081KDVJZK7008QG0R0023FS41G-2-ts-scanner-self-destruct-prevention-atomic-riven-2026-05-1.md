---
id: 081KDVJZK7008QG0R0023FS41G
priority: P2
status: open
title: TS scanner self-destruct prevention (allowlist + bypass comment)
tier: factory-hygiene
effort: S
depends_on:
  - 081KDVJZK7008QG0R001379Y14
composes_with:
  - 081KQ8P5D0008QG0R003MY8246
  - 081KQ8P5D0008QG0R003ZF64GG
tags: [riven-2026-05-11, ts-prefer, scanner, compliance, self-destruct]
---
# 081KDVJZK7008QG0R0023FS41G — Atomic child: TS scanner self-destruct prevention

Smallest slice of 081KQ8P5D0008QG0R003MY8246 enhancement #2: extend the 081KQ8P5D0008QG0R003ZF64GG compliance scanner (rg-based) with path allowlist (`--glob '!**/CONTRIBUTOR-COMPLIANCE.md'`) and `<!-- compliance-term-definition-ok -->` bypass comment support. Implement in TS wrapper `tools/hygiene/audit-compliance-scanner.ts` (or update existing) so rule-definition files are explicitly allowed and Goodhart prevented.

Depends on 081KDVJZK7008QG0R001379Y14 quarantine surface for tainted-file handling. S effort, pure TS.

Focused check: run scanner on rule files, confirm ALLOW class hits only, 0 false self-destruct, lint clean.

Unblocks trajectory owners table (081KDVJZK7008QG0R001QH4W62).
