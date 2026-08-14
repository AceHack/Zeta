---
id: 081KZYRDMZW087G0R0012K4QA0
type: bug
state: backlog
priority: P1
slug: tlc-runner-has-no-config-support-so-bftliveness-cfg-and-12-o
title: "TLC runner has no -config support, so BftLiveness.cfg and 12 other configs are ungated"
created: 2026-08-13T23:48:19.580Z
depends_on: []
composes_with: []
---

# TLC runner has no -config support, so BftLiveness.cfg and 12 other configs are ungated

<!-- Work-item body. ZetaId-keyed (conflict-free, time-sortable). "Backlog" is a
     STATE = this folder; completion moves the file to workitems/done/YYYY/MM/.
     Identity is the zetaid prefix — resolve cross-refs by `081KZYRDMZW087G0R0012K4QA0-*.md` glob. -->

## What

`tests/Tests.FSharp/Formal/Tlc.Runner.Tests.fs` shells out as `tlc2.TLC SpecName` with **no
config argument**. TLC therefore resolves `SpecName.cfg` and nothing else. Every non-default
`.cfg` under `src/Core.TLA/specs/` is never executed by CI.

## Why it matters

This is the "a check that did not run must never look like a check that passed" defect, same
class as #10429 (612 TS test files exist, ~95 run).

**`BftLiveness.cfg`** is the sharpest instance. `BftConsensus.cfg` carries a confident
falsification table dated 2026-08-11 — `ConditionalTermination` HOLDS, 4,665,495 states, 11min
14s, plus two recorded mutation refutations. All of it ran **once, by hand**. A reader of that
file has no way to know none of it re-runs, and a regression in `BftConsensus.tla` liveness
would land green.

The 2026-08-13 collateral round added 15 more configs of which **12 are ungated**: the R1/R2/R3
regimes for `QuorumCollateral`, its threshold config, both `Deterrence` liveness runs, four
reachability witnesses, and the three `WagerSolvency` negative configs. Their results are
recorded in
`docs/research/2026-08-13-soraya-bft-collateral-routing-slashing-tension-phase-cancellation.md`
sections 3 and 5 and nowhere else.

## Fix

1. Give `runTlcUnlocked` an optional config name; pass `-config NAME.cfg` when present.
2. Add `assertSpecValidWithConfig specName cfgName`.
3. Add `assertSpecViolates specName cfgName` for the EXPECT-VIOLATION probes — these must FAIL
   the build when TLC reports no error, since a witness that stops firing means the model has
   stopped modelling anything.
4. Wire `BftLiveness.cfg` and the 12 configs above.

Not bundled into the round that found it: this touches a shared harness that roughly 30 specs
depend on, and the liveness runs are minutes-long, so the CI-time budget needs its own decision.

## Related gap, same file

`toolchainReady()` skips TLC on CI unless the runner is Linux x64 and not `ubuntu-slim`. That is
reasonable de-duplication, but the entire TLA+ gate then rests on one leg of the matrix. If that
leg is dropped or renamed, every TLC check silently stops and every test still passes. Worth a
guard that asserts the TLC leg actually ran at least once per CI run.

## Sharpened 2026-08-13 by CI run on #10452 — raise from P2

The first spec this round that CI actually checked went **red**, and not for a reason either the
author or the reviewer predicted. `TLC validates QuorumPhaseCancellation` failed with exit 11,
`Error: Deadlock reached.`

The cause was **not** the missing `-config` (TLC resolved the right default cfg and explored the
right 48-state space). It was that the runs recorded in the companion research doc were driven by
a script passing `-deadlock` — which **disables** deadlock checking — while
`Tlc.Runner.Tests.fs` passes no such flag.

**So the flags a spec is MEASURED under and the flags CI CHECKS it under were silently
different.** A hand-run green and a gated green were not the same result, and nothing anywhere
said so.

That widens this work-item. Adding `-config` support is necessary and not sufficient: the next
mismatch will be a different flag (`-workers` already changes reported state counts for runs that
halt on violation; `-depth`, `-simulate` and `-coverage` would all do worse). **The fix should
pin the whole invocation**, so that the command recorded next to a result is the command CI runs.

Suggested shape:

1. A single source of truth for the TLC invocation — one function that builds the argument list,
   used by both the F# runner and any hand-run script. If a spec needs `-deadlock`, that belongs
   in its `.cfg` as `CHECK_DEADLOCK FALSE`, not in whoever happened to type the command.
2. `-config` support plus `assertSpecValidWithConfig` / `assertSpecViolates`, as originally filed.
3. For any result quoted in a doc, record the exact invocation alongside it.

Immediate mitigation already landed on #10452: `CHECK_DEADLOCK FALSE` declared in the four
`QuorumPhase*` configs with the reasoning written in, so the intent is in the artefact rather
than in a shell history.
