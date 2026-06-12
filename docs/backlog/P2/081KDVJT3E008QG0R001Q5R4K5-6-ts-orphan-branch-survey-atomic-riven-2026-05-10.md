---
id: B-0090.6
zetaid: 081KDVJT3E008QG0R001Q5R4K5
priority: P2
status: open
title: TS survey tool for orphan branches (unmerged + no-PR)
tier: factory-hygiene
effort: S
depends_on:
  - B-0090.5
composes_with:
  - B-0090
last_updated: 2026-05-13
renumbered_from: B-0090.2
renumbered_reason: "ID collision with the second B-0090 decomposition (PR #2680). Part of Riven's earlier ts-* atomic series renumbered .1→.5/.2→.6/.3→.7/.4→.8 as a unit. Internal depends_on B-0090.1 also remapped to B-0090.5. Substrate-cleanup tracked in B-0451."
tags: [riven-2026-05-10, ts-prefer, lost-substrate, orphan-branch, renumbered]
---

# B-0090.6 — Atomic child: TS orphan branch survey (renumbered from B-0090.2)

Depends on B-0090.5 pattern (renumbered from B-0090.1). Implement `tools/hygiene/audit-orphan-branch-survey.ts` using `git for-each-ref` + gh api intersect, 3-bucket classify, JSON output.

Smallest, S, TS only.
