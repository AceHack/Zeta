---
id: 081KDVJT3E008QG0R000SCFYN5
priority: P2
status: open
title: TS survey tool for locked worktrees (git worktree list + 3-bucket classify)
tier: factory-hygiene
effort: S
depends_on: []
composes_with:
  - 081KQ8P5D0008QG0R0002TN22C
  - 081KDVJT3E008QG0R003GV8BHV
last_updated: 2026-05-13
renumbered_from: 081KDVJT3E008QG0R003GV8BHV
renumbered_reason: "ID collision with the second 081KQ8P5D0008QG0R0002TN22C decomposition (PR #2680, 2026-05-11) which the 081KQ8P5D0008QG0R0002TN22C parent body describes as canonical (3-bucket-taxonomy / worktree-delta / closed-not-merged-PR-scan / cadence-hook). This row is part of Riven's earlier 2026-05-10 decomposition (PR #2503, ts-* atomic series) which kept original scope but lost the ID claim. Renumbered .1→.5, .2→.6, .3→.7, .4→.8 to preserve both decompositions side-by-side. Substrate-cleanup tracked in 081KRFA460008QG0R00308W7FJ."
tags: [riven-2026-05-10, ts-prefer, lost-substrate, worktree, renumbered]
---

# 081KDVJT3E008QG0R000SCFYN5 — Atomic child: TS worktree survey (renumbered from 081KDVJT3E008QG0R003GV8BHV)

Smallest slice of 081KQ8P5D0008QG0R0002TN22C: implement `tools/hygiene/audit-worktree-survey.ts` that runs `git worktree list`, classifies each into ALREADY-COVERED / NEEDS-RECOVERY / OBSOLETE per the 3-bucket protocol, outputs JSON + markdown summary.

Dependency root: no deps, S effort, pure TS, no bash.

Focused check after: `bun run tools/hygiene/audit-worktree-survey.ts --dry` produces clean output, 0 lint errors.

This unblocks 081KDVJT3E008QG0R001Q5R4K5 (orphan, renumbered from 081KDVJT3E008QG0R00183ME0R) + cadence wiring.
