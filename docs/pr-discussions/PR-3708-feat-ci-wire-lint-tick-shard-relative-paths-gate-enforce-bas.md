---
pr_number: 3708
title: "feat(ci): wire lint (tick-shard relative-paths) gate \u2014 --enforce --baseline"
author: "AceHack"
state: "MERGED"
created_at: "2026-05-16T03:27:56Z"
merged_at: "2026-05-16T03:30:59Z"
closed_at: "2026-05-16T03:30:59Z"
head_ref: "feat/wire-tick-shard-relative-paths-ci-gate-otto-cli-2026-05-16"
base_ref: "main"
archived_at: "2026-05-16T03:37:33Z"
archive_tool: "tools/pr-preservation/archive-pr.ts"
---

# PR #3708: feat(ci): wire lint (tick-shard relative-paths) gate — --enforce --baseline

## PR description

## What

Adds the final step of the tick-shard-relative-path audit lifecycle: a CI gate (`lint-tick-shard-relative-paths`) that runs

```bash
bun tools/hygiene/audit-tick-shard-relative-paths.ts \
  --enforce \
  --baseline tools/hygiene/audit-tick-shard-relative-paths.baseline.json
```

Exit 1 only on NEW findings (not in baseline). 10 pre-existing findings stay grandfathered.

## Lifecycle now complete

| Step | PR | State |
|------|-----|-------|
| Discovery | #3676 + #3679 | merged |
| Narrow fix per-shard | #3680 | merged |
| Scanner | #3692 | merged |
| Filter + quality × 3 | #3692 (fixups) | merged |
| Baseline mechanism | #3699 | merged |
| **CI enforce gate** | **this** | **proposed** |

Same 4-step §33 audit lifecycle pattern (PR #3513 → #3552 → enforce), compressed across 14 ticks of this session.

## Local verify

- 842 shards scanned (was 833 in tick 7; +9 from this session's merges)
- 10 grandfathered (matches baseline)
- 0 NEW findings
- exit 0

## CI surface

Per existing convention in `.github/workflows/gate.yml`, this job is **non-required by default**. The gate surfaces on every PR as a status check; branch-protection rules govern which subset is required for merge. The §33-migration-xrefs sibling is also a non-required check by default.

Co-Authored-By: Claude <noreply@anthropic.com>

## Reviews

### COMMENTED — @copilot-pull-request-reviewer (2026-05-16T03:29:10Z)

## Pull request overview

Adds a non-required CI lint job that enforces the tick-shard relative-path audit with the existing baseline, so new broken relative links fail while historical findings remain grandfathered.

**Changes:**

- Adds `lint-tick-shard-relative-paths` to `.github/workflows/gate.yml`.
- Runs the audit with `--enforce --baseline`.
- Documents the lifecycle and rationale inline with the new job.
