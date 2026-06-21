---
id: 081KDVJT3E008QG0R001Q5R4K5
priority: P2
status: open
title: TS survey tool for orphan branches (unmerged + no-PR)
tier: factory-hygiene
effort: S
depends_on:
  - 081KDVJT3E008QG0R000SCFYN5
composes_with:
  - 081KQ8P5D0008QG0R0002TN22C
last_updated: 2026-05-13
renumbered_from: 081KDVJT3E008QG0R00183ME0R
renumbered_reason: "ID collision with the second 081KQ8P5D0008QG0R0002TN22C decomposition (PR #2680). Part of Riven's earlier ts-* atomic series renumbered .1→.5/.2→.6/.3→.7/.4→.8 as a unit. Internal depends_on 081KDVJT3E008QG0R003GV8BHV also remapped to 081KDVJT3E008QG0R000SCFYN5. Substrate-cleanup tracked in 081KRFA460008QG0R00308W7FJ."
tags: [riven-2026-05-10, ts-prefer, lost-substrate, orphan-branch, renumbered]
---

# 081KDVJT3E008QG0R001Q5R4K5 — Atomic child: TS orphan branch survey (renumbered from 081KDVJT3E008QG0R00183ME0R)

Depends on 081KDVJT3E008QG0R000SCFYN5 pattern (renumbered from 081KDVJT3E008QG0R003GV8BHV). Implement `tools/hygiene/audit-orphan-branch-survey.ts` using `git for-each-ref` + gh api intersect, 3-bucket classify, JSON output.

Smallest, S, TS only.
