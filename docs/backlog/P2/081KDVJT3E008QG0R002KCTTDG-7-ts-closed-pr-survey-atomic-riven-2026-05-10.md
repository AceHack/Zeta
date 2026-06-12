---
id: B-0090.7
zetaid: 081KDVJT3E008QG0R002KCTTDG
priority: P2
status: open
title: TS survey for closed-not-merged PRs aged + content diff
tier: factory-hygiene
effort: S
depends_on:
  - B-0090.5
composes_with:
  - B-0090
last_updated: 2026-05-13
renumbered_from: B-0090.3
renumbered_reason: "ID collision with the second B-0090 decomposition (PR #2680). Part of Riven's earlier ts-* atomic series renumbered .1→.5/.2→.6/.3→.7/.4→.8 as a unit. Internal depends_on B-0090.1 also remapped to B-0090.5. Substrate-cleanup tracked in B-0451."
tags: [riven-2026-05-10, ts-prefer, lost-substrate, closed-pr, renumbered]
---

# B-0090.7 — Atomic child: TS closed-not-merged PR survey (renumbered from B-0090.3)

Depends on survey pattern (B-0090.5, renumbered from B-0090.1). `tools/hygiene/audit-closed-pr-survey.ts` : gh pr list --state closed, filter !merged, age >N, compute content loss vs main, 3-bucket.

S effort, TS.
