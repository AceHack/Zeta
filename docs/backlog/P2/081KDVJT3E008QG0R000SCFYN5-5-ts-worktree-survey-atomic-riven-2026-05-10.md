---
id: B-0090.5
zetaid: 081KDVJT3E008QG0R000SCFYN5
priority: P2
status: open
title: TS survey tool for locked worktrees (git worktree list + 3-bucket classify)
tier: factory-hygiene
effort: S
depends_on: []
composes_with:
  - B-0090
  - B-0090.1
last_updated: 2026-05-13
renumbered_from: B-0090.1
renumbered_reason: "ID collision with the second B-0090 decomposition (PR #2680, 2026-05-11) which the B-0090 parent body describes as canonical (3-bucket-taxonomy / worktree-delta / closed-not-merged-PR-scan / cadence-hook). This row is part of Riven's earlier 2026-05-10 decomposition (PR #2503, ts-* atomic series) which kept original scope but lost the ID claim. Renumbered .1→.5, .2→.6, .3→.7, .4→.8 to preserve both decompositions side-by-side. Substrate-cleanup tracked in B-0451."
tags: [riven-2026-05-10, ts-prefer, lost-substrate, worktree, renumbered]
---

# B-0090.5 — Atomic child: TS worktree survey (renumbered from B-0090.1)

Smallest slice of B-0090: implement `tools/hygiene/audit-worktree-survey.ts` that runs `git worktree list`, classifies each into ALREADY-COVERED / NEEDS-RECOVERY / OBSOLETE per the 3-bucket protocol, outputs JSON + markdown summary.

Dependency root: no deps, S effort, pure TS, no bash.

Focused check after: `bun run tools/hygiene/audit-worktree-survey.ts --dry` produces clean output, 0 lint errors.

This unblocks B-0090.6 (orphan, renumbered from B-0090.2) + cadence wiring.
