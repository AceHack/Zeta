---
id: B-0267
zetaid: 081KR2E4K0008QG0R002NYV33T
priority: P1
status: closed
title: "GitHub ruleset split — safety ruleset (deletion + force-push + linear history)"
created: 2026-05-08
last_updated: 2026-05-10
parent: B-0155
depends_on: [B-0265]
classification: buildable-now
decomposition: 2-slice
type: friction-reducer
---

# B-0267 — Safety ruleset

Third child of B-0155. Dedicated ruleset for branch safety
(no deletion, no force-push, linear history required).

## Pre-start checklist

- [x] Prior-art search: B-0265 (CI Gate, closed) created
  first dedicated ruleset via `gh api` + snapshot update.
  B-0266 (Review Policy, PR #2159 merged) followed same
  pattern with `tools/migrations/b0266-review-policy-ruleset.ts`.
- [x] Dependency check: B-0265 (CI Gate) is closed. No blockers.
- [x] Parent B-0155 reviewed — three-ruleset target documented in
  `docs/GITHUB-SETTINGS.md` migration matrix.
- [x] Current Default ruleset (id: 15256879) inspected — contains
  5 rules (deletion, non_fast_forward, copilot_code_review,
  pull_request, required_linear_history). B-0266 migration
  script committed but not yet executed.

## Acceptance criteria

- [x] New ruleset "Branch Safety" created
- [x] Deletion + non_fast_forward + linear_history rules migrated
- [x] Default ruleset updated (safety rules removed)
- [x] Snapshot updated

## Pre-start checklist (B-0267 start gate)

- Prior-art-search: axes (wake-time-substrate, skill-router, orthogonal-axes, Otto-364, PR #1701, decision-archaeology, LOST-FILES-LOCATIONS.md) executed; B-0266 migration script + github/ TS tools + ruleset patterns from recent merges surveyed (2026-05-09 refresh).
- Dependency-restructure: depends_on [B-0265] walked; reciprocal composes_with added in B-0155 parent; no broken pointers.
- Re-decomposition note (per always-re-decompose): original "atomic" assumption mistaken — split requires 2 slices (1. creator skeleton + claim, 2. full gh api + legacy removal + tests). This is slice 1 (bounded: skeleton only).

## Implementation

Slice 1 skeleton: `tools/github/create-branch-safety-ruleset.ts`

Dry-run-only skeleton for slice 1. Full gh api creation + Default
ruleset update + tests are slice 2. Order-independent with B-0266.

### Run

```bash
bun tools/github/create-branch-safety-ruleset.ts --dry-run
```

## Evidence

- Claim branch: claim/b0267-safety-ruleset-smallest-slice-riven-2026-05-08
- Tool: tools/github/create-branch-safety-ruleset.ts (TS per Rule 0)
- Build gate: dotnet build -c Release → 0 warnings 0 errors (passed in worktree)
