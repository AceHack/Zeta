---
id: 081M24J1YKM087G0R001T9YC9K
type: task
state: backlog
priority: P2
slug: land-the-hidden-switch-compiled-transfer-inventory-and-nativ
title: "Land the hidden-switch compiled transfer inventory and native-replay reference tooling"
created: 2026-09-10T02:23:54.996Z
depends_on: []
composes_with: []
---

# Land the hidden-switch compiled transfer inventory and native-replay reference tooling

<!-- Work-item body. ZetaId-keyed (conflict-free, time-sortable). "Backlog" is a
     STATE = this folder; completion moves the file to workitems/done/YYYY/MM/.
     Identity is the zetaid prefix — resolve cross-refs by `081M24J1YKM087G0R001T9YC9K-*.md` glob. -->

## Why

Three swarm branches (`codex/hidden-switch-compiled-native-`,
`-reference-`, `codex/compiled-runtime-admission-review-20260907`) carry the
three lanes of the three-writer plan in
`docs/research/2026-09-07-hidden-switch-compiled-implementation-plan.md`.
The lanes' *evidence* trees largely landed on `main` via PR #16928 and its
successors; the lanes' *source* never did, and no branch ever opened a PR.

## What lands

- Six `src/Research.FSharp.Cli/` transfer/data-range tools + their six unit-test
  modules (71 tests, all passing)
- `src/Interp.Python/zeta_interp/hidden_switch_compiled_native_replay.py` and its
  55-case test, plus the 33 small `native-replay-inputs` fixtures the test reads
- 15 `docs/research/2026-09-0[78]-hidden-switch-compiled-*.md` plan / inventory /
  review records, and the 32 text custody indexes they link to (zero dangling
  in-repo links after the cut)

## What is excluded

The 475 remaining `.log.gz` capture archives in
`docs/research/hidden-switch-compiled-validation/` that nothing reads. They stay
on the three branches, which are not deleted.
