---
id: 081KDVJT3E008QG0R002KCTTDG
priority: P2
status: open
title: TS survey for closed-not-merged PRs aged + content diff
tier: factory-hygiene
effort: S
depends_on:
  - 081KDVJT3E008QG0R000SCFYN5
composes_with:
  - 081KQ8P5D0008QG0R0002TN22C
last_updated: 2026-05-13
renumbered_from: 081KDVJT3E008QG0R000P3YGTX
renumbered_reason: "ID collision with the second 081KQ8P5D0008QG0R0002TN22C decomposition (PR #2680). Part of Riven's earlier ts-* atomic series renumbered .1→.5/.2→.6/.3→.7/.4→.8 as a unit. Internal depends_on 081KDVJT3E008QG0R003GV8BHV also remapped to 081KDVJT3E008QG0R000SCFYN5. Substrate-cleanup tracked in 081KRFA460008QG0R00308W7FJ."
tags: [riven-2026-05-10, ts-prefer, lost-substrate, closed-pr, renumbered]
---

# 081KDVJT3E008QG0R002KCTTDG — Atomic child: TS closed-not-merged PR survey (renumbered from 081KDVJT3E008QG0R000P3YGTX)

Depends on survey pattern (081KDVJT3E008QG0R000SCFYN5, renumbered from 081KDVJT3E008QG0R003GV8BHV). `tools/hygiene/audit-closed-pr-survey.ts` : gh pr list --state closed, filter !merged, age >N, compute content loss vs main, 3-bucket.

S effort, TS.
