---
id: 081M24H9976087G0R0001DRA3W
type: task
state: backlog
priority: P2
slug: land-the-checked-mixed-message-module-epoch-implementation-f
title: "Land the checked mixed-message module-epoch implementation from its abandoned swarm branch"
created: 2026-09-10T02:10:26.662Z
depends_on: []
composes_with: []
---

# Land the checked mixed-message module-epoch implementation from its abandoned swarm branch

<!-- Work-item body. ZetaId-keyed (conflict-free, time-sortable). "Backlog" is a
     STATE = this folder; completion moves the file to workitems/done/YYYY/MM/.
     Identity is the zetaid prefix — resolve cross-refs by `081M24H9976087G0R0001DRA3W-*.md` glob. -->

## Why

`main` carries the SPEC for checked mixed-message module epochs
(`docs/DECISIONS/2026-09-08-checked-mixed-message-module-epochs.md`, PR #17052)
and the source contract that names
`src/Research.FSharp/MixedMessageEpochReplay.fsx` — but not the implementation.
The implementation was written on `codex/mixed-message-epoch-integration-20260908`
and three sibling swarm branches, none of which ever opened a PR.

## What lands

- `src/Bayesian/MixedMessageEpoch.fs` (2314 lines), `src/Bayesian/BoundedModuleLearner.fs`
- `tests/Bayesian.Tests/{MixedMessageEpoch,BoundedModuleLearner}.Tests.fs` (71 tests)
- `src/Research.FSharp/MixedMessageEpochReplay.fsx` — the finite F# peer the
  contract already names
- `src/Interp.Python/zeta_interp/mixed_message_epoch_{bridge,controls}.py` + tests
- The 2026-09-08 mixed-message research record, and the TEXT custody indexes it links

## What is deliberately excluded

1,284 `.log.gz` / `custody.tar.gz` capture archives (~68 MiB) under the
`docs/research/mixed-message-*` evidence trees. They are binary, and
`.claude/rules/no-binary-in-proof-lineage.md` keeps verification artifacts text.
They remain on `codex/mixed-message-epoch-integration-20260908`, which is not
deleted.
