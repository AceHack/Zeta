---
pr_number: 3253
title: "feat(b-0461): file 081KRFA460008QG0R00061SXRW slice 5.3 row (missed-substrate-cascade handler)"
author: "AceHack"
state: "MERGED"
created_at: "2026-05-14T21:25:45Z"
merged_at: "2026-05-14T21:28:07Z"
closed_at: "2026-05-14T21:28:07Z"
head_ref: "otto/b0461-missed-substrate-cascade-handler-2026-05-14"
base_ref: "main"
archived_at: "2026-05-14T21:31:39Z"
archive_tool: "tools/pr-preservation/archive-pr.ts"
---

# PR #3253: feat(b-0461): file 081KRFA460008QG0R00061SXRW slice 5.3 row (missed-substrate-cascade handler)

## PR description

## Summary

Closes the broken `composes_with` edge surfaced by [`audit-backlog-items.ts`](tools/hygiene/audit-backlog-items.ts) on origin/main: 081KRHWGX0008QG0R001E9KEJ1 frontmatter listed `composes_with: [..., 081KRHWGX0008QG0R000JMEYBH]` but 081KRHWGX0008QG0R000JMEYBH didn't exist as a file. The reference existed as a placeholder in two rows (081KRFA460008QG0R002DG8KPZ design pass + 081KRHWGX0008QG0R001E9KEJ1 sibling table) explicitly naming "081KRHWGX0008QG0R000JMEYBH — `missed-substrate-cascade` handler (slice 5.3)". This PR makes it real.

## Sibling row family (per [081KRFA460008QG0R002DG8KPZ](docs/backlog/P1/081KRFA460008QG0R002DG8KPZ-bg-services-slice-5-subscriber-agent-design-pass-2026-05-13.md) Option C design)

| Slice | Topic | Producer | Row |
|-------|-------|----------|-----|
| 5.1 | `infinite-backlog-nudge` | `standing-by-detector` (081KRFA460008QG0R001KC0VBH) | [081KRHWGX0008QG0R000TVGDGV](docs/backlog/P1/081KRHWGX0008QG0R000TVGDGV-b0440-slice-5-infinite-backlog-nudge-handler-2026-05-14.md) |
| 5.2 | `work-assignment` | `backlog-ready-notifier` (081KRFA460008QG0R00229616S) | [081KRHWGX0008QG0R001E9KEJ1](docs/backlog/P1/081KRHWGX0008QG0R001E9KEJ1-b0441-slice-5-2-work-assignment-subscriber-handler-2026-05-14.md) |
| 5.3 | `missed-substrate-cascade` | `missed-substrate-detector` (081KRFA460008QG0R00061SXRW) | **081KRHWGX0008QG0R000JMEYBH (this PR)** |

## Audit verification

```text
Before: **Broken composes_with edges: 1** (081KRHWGX0008QG0R001E9KEJ1 → missing 081KRHWGX0008QG0R000JMEYBH)
After:  **Broken composes_with edges: 0**
```

The audit drove the gap-detection; this PR closes the gap.

## Scope (stub handler)

- Reads + logs `missed-substrate-cascade` envelopes from the bus dir
- Reports drift to tick output (visibility)
- Does NOT auto-open recovery PR — that's [081KRHWGX0008QG0R0027YXBTB](docs/backlog/P1/081KRHWGX0008QG0R0027YXBTB-b0442-slice5a-open-recovery-pr-core-function-2026-05-14.md) (core) + 081KRHWGX0008QG0R000PVB6FF (wiring)

## Why P1

The audit-driven completeness of the slice-5 row family unblocks future implementation of all three subscriber handlers as a coherent set. Without 081KRHWGX0008QG0R000JMEYBH, edge references in 081KRHWGX0008QG0R001E9KEJ1 are ambiguous.

## Test plan

- [x] `markdownlint-cli2` clean
- [x] `bun tools/hygiene/audit-backlog-items.ts` → broken-composes_with edges: 0 (verified)
- [x] Composite branch-guard + `gh pr create --head` used
- [ ] CI clears
- [ ] Auto-merge

🤖 Generated with [Claude Code](https://claude.com/claude-code)

Co-Authored-By: Claude <noreply@anthropic.com>

## Reviews

### COMMENTED — @copilot-pull-request-reviewer (2026-05-14T21:29:22Z)

## Pull request overview

Adds the missing 081KRHWGX0008QG0R000JMEYBH backlog row for the 081KRFA460008QG0R00061SXRW slice 5.3 `missed-substrate-cascade` subscriber handler, completing the sibling row family referenced by 081KRFA460008QG0R002DG8KPZ/081KRHWGX0008QG0R001E9KEJ1.

**Changes:**

- Creates 081KRHWGX0008QG0R000JMEYBH as a P1 backlog item.
- Documents origin, intended handler scope, acceptance criteria, dependencies, and related rows.
- Links the row to the 081KRFA460008QG0R001KC0VBH/081KRFA460008QG0R00229616S/081KRFA460008QG0R00061SXRW subscriber-handler family.

## Review threads

### Thread 1: docs/backlog/P1/081KRHWGX0008QG0R000JMEYBH-b0442-slice-5-3-missed-substrate-cascade-handler-2026-05-14.md:2 (unresolved)

**@copilot-pull-request-reviewer** (2026-05-14T21:29:20Z):

This PR adds 081KRHWGX0008QG0R000JMEYBH but does not regenerate `docs/BACKLOG.md`; that generated index currently has no 081KRHWGX0008QG0R000JMEYBH entry. The backlog-index-integrity workflow runs `bun tools/backlog/generate-index.ts --check` when `docs/backlog/**` changes, so this will fail until the regenerated index is committed with the row.

### Thread 2: docs/backlog/P1/081KRHWGX0008QG0R000JMEYBH-b0442-slice-5-3-missed-substrate-cascade-handler-2026-05-14.md:55 (unresolved)

**@copilot-pull-request-reviewer** (2026-05-14T21:29:21Z):

The documented payload shape does not match the current producer. `tools/bg/missed-substrate-detector.ts` publishes `branchName`, `missingCommits`, `recommendedAction`, and `urgency`; it does not publish `branchRef`, `headRefOid`, `squashCommit`, `missedCommitCount`, or `rationale`. Leaving this schema here will cause the future handler to read nonexistent fields.

### Thread 3: docs/backlog/P1/081KRHWGX0008QG0R000JMEYBH-b0442-slice-5-3-missed-substrate-cascade-handler-2026-05-14.md:68 (unresolved)

**@copilot-pull-request-reviewer** (2026-05-14T21:29:21Z):

This acceptance criterion asks the handler to log `rationale`, but the 081KRFA460008QG0R00061SXRW producer's `MissedSubstrateCascadePayload` has no rationale field. Align the logging requirement with the actual payload fields, otherwise implementers will either log undefined data or invent a field the producer never sends.

### Thread 4: docs/backlog/P1/081KRHWGX0008QG0R000JMEYBH-b0442-slice-5-3-missed-substrate-cascade-handler-2026-05-14.md:104 (unresolved)

**@copilot-pull-request-reviewer** (2026-05-14T21:29:21Z):

This dependency chain makes 081KRHWGX0008QG0R0027YXBTB/081KRHWGX0008QG0R000PVB6FF look downstream of 081KRHWGX0008QG0R000JMEYBH, but their row frontmatter does not depend on 081KRHWGX0008QG0R000JMEYBH (`081KRHWGX0008QG0R0027YXBTB` has no dependencies and `081KRHWGX0008QG0R000PVB6FF` depends only on `081KRHWGX0008QG0R0027YXBTB`). Representing them as children of this row will mislead backlog traversal; show them as related/parallel recovery work unless you also intend to add a real dependency edge.
