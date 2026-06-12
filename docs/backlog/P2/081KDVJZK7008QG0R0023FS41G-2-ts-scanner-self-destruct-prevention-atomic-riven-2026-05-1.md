---
id: B-0093.2
zetaid: 081KDVJZK7008QG0R0023FS41G
priority: P2
status: open
title: TS scanner self-destruct prevention (allowlist + bypass comment)
tier: factory-hygiene
effort: S
depends_on:
  - B-0093.1
composes_with:
  - B-0093
  - B-0092
tags: [riven-2026-05-11, ts-prefer, scanner, compliance, self-destruct]
---
# B-0093.2 — Atomic child: TS scanner self-destruct prevention

Smallest slice of B-0093 enhancement #2: extend the B-0092 compliance scanner (rg-based) with path allowlist (`--glob '!**/CONTRIBUTOR-COMPLIANCE.md'`) and `<!-- compliance-term-definition-ok -->` bypass comment support. Implement in TS wrapper `tools/hygiene/audit-compliance-scanner.ts` (or update existing) so rule-definition files are explicitly allowed and Goodhart prevented.

Depends on B-0093.1 quarantine surface for tainted-file handling. S effort, pure TS.

Focused check: run scanner on rule files, confirm ALLOW class hits only, 0 false self-destruct, lint clean.

Unblocks trajectory owners table (B-0093.3).
