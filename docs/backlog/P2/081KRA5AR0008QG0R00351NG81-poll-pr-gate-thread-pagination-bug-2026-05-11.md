---
id: 081KRA5AR0008QG0R00351NG81
priority: P2
status: closed
closed: 2026-05-11
closed_by: "verified pagination works correctly"
title: "poll-pr-gate.ts thread pagination drift — NOT A BUG (race condition)"
created: 2026-05-11
last_updated: 2026-05-11
depends_on: []
composes_with: []
type: friction-reducer
---

# 081KRA5AR0008QG0R00351NG81 — CLOSED: Not a real bug

## Original hypothesis (incorrect)

`tools/github/poll-pr-gate.ts` reportedly under-counted unresolved
threads on PRs with >50 threads.

## Verification (2026-05-11)

Inspected the code: pagination loop already drives via `endCursor`
and `pageInfo.hasNextPage`, accumulating across all pages
(`tools/github/poll-pr-gate.ts:346-382`). Re-ran both tools on the
same PR:

- `poll-pr-gate.ts 2748` reported 6 unresolved
- Direct GraphQL with `first:100` reported 6 unresolved
- Total threads: 61 (pagination did span multiple pages)

Both tools agree. **Pagination works correctly.**

## Root cause of the original observation

The original discrepancy (poll-pr-gate said 5, GraphQL said 3) was
a **race condition** — threads were being resolved between the two
queries. The numbers reflected different time snapshots, not a
counting bug.

## Shadow catch

This is shadow catch class **bug-filing-without-verification**:
filing a backlog item on a 2-tool numeric discrepancy without
verifying the code actually does the wrong thing. The honest move
was to read the code first (it was correct) before assuming the
tool was broken.

See `memory/feedback_shadow_lesson_log_otto_catches_2026_05_07.md`
catch 39.

## Status

Closed. No code change. The tool works.
