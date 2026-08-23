---
id: 081M0R35AWB087G0R000BPV3BP
type: bug
state: done
priority: P1
slug: keep-telemetry-flush-pr-heads-immutable-while-buffering-newe
title: "Keep telemetry flush PR heads immutable while buffering newer observations"
created: 2026-08-23T19:57:02.219Z
depends_on: []
composes_with: []
---

# Keep telemetry flush PR heads immutable while buffering newer observations

<!-- Work-item body. ZetaId-keyed (conflict-free, time-sortable). "Backlog" is a
     STATE = this folder; completion moves the file to workitems/done/YYYY/MM/.
     Identity is the zetaid prefix — resolve cross-refs by `081M0R35AWB087G0R000BPV3BP-*.md` glob. -->

## Reproduction

PR #14371 was running its required gate on head `4b597cbac404f308afcb2aac5bcbdddd08f5ebfd`.
Before its final Ubuntu job completed, the next drift tick force-pushed head
`8867add98af8438463db19b44223d4e3048f9ee8` to the same branch. GitHub discarded
the completed evidence and restarted the full matrix. On a busy `main`, every push
can repeat this, so publication has no liveness bound.

## Acceptance

- An open telemetry PR's active head is never changed by a later tick.
- New observations are preserved on a distinct aggregate buffer ref.
- Once no active PR exists, the buffer is promoted into the next active PR.
- Overlapping generated snapshots prefer the newer buffered value.
- A real-git test falsifies head immutability, buffer preservation, and bounded
  branch history.

## Verification

- `bun test` over the flush and heartbeat merge suites: 66 passed.
- Real-git five-tick test: immutable active head, complete buffered promotion,
  one commit and zero merge commits per staging ref.
- `bun run preflight`: all 15 checks passed, including release build and full
  .NET tests.
