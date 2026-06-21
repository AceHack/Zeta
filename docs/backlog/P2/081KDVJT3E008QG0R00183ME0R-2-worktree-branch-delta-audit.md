---
id: 081KDVJT3E008QG0R00183ME0R
priority: P2
status: open
title: Worktree-branch delta audit (locked .claude/worktrees/ only, last-N-days)
tier: factory-hygiene
effort: S
depends_on: [081KDVJT3E008QG0R003GV8BHV]
composes_with: [081KQ8P5D0008QG0R0002TN22C]
tags: [b0090-decomp, worktree, delta-scan, lost-substrate]
type: friction-reducer
---

# 081KDVJT3E008QG0R00183ME0R — Worktree-branch delta audit

## Why this child exists

The 57 locked worktrees are the highest-volume surface. 081KDVJT3E008QG0R003GV8BHV taxonomy now exists; this row is the minimal delta scanner that classifies only worktrees changed since last audit (not full 57 every time). Keeps cost S per cycle.

## Atomic scope (S effort)

- TS script (tools/hygiene/audit-worktree-delta.ts) or equivalent that:
  - Lists locked worktree branches.
  - Diffs against last-audit marker (file or git note).
  - Applies 081KDVJT3E008QG0R003GV8BHV 3-bucket classification.
  - Outputs markdown table + count of NEEDS-RECOVERY.
- No auto-prune, no recovery PRs, no cadence wiring.
- Focused check: run on current .claude/worktrees/ and report bucket counts (include in PR body of this decomp).

## Dependency note

Depends on 081KDVJT3E008QG0R003GV8BHV for bucket names. Re-decomp assumption: "delta" may be over-constrained if no marker exists yet; first cycle may be full scan (still S).

## Acceptance

- [ ] Script passes dotnet build gate + focused lint.
- [ ] Output exactly matches 3-bucket taxonomy.
- [ ] No writes to root checkout (worktree only).
- [ ] One-page runbook in the script header.

## Evidence

- Parent 081KQ8P5D0008QG0R0002TN22C
- 081KDVJT3E008QG0R003GV8BHV taxonomy

Co-Authored-By: Grok <noreply@x.ai>
