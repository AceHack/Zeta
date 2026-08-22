---
id: 081KZYRDMZW087G0R0012K4QA0
type: bug
state: done
priority: P1
slug: tlc-runner-has-no-config-support-so-bftliveness-cfg-and-12-o
title: "TLC runner has no -config support, so BftLiveness.cfg and 12 other configs are ungated"
created: 2026-08-13T23:48:19.580Z
completed: 2026-08-14T11:04:58.387Z
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

## Resolved 2026-08-14 — the whole invocation is pinned

Fix landed as filed, plus the widening the postscript asked for.

**`registry/tlc-models.json`** is the single source of truth: 53 pinned model runs, one per
(module x config). Each fixes the config, the worker count, the expected exit code, the expected
TLC error substring for negative runs, and -- for exhaustive runs only -- the distinct-state
count. `tests/Tests.FSharp/Formal/Tlc.Runner.Tests.fs` and
`src/Core.TypeScript/formal-verification/run-tlc.ts` both build argv from it through
`src/Core.TypeScript/formal-verification/tlc-invocation.ts`, and neither may add a flag. **The
command recorded next to a result is the command CI runs.**

| | before | after |
|---|---|---|
| configs that execute in the PR lane | 34 of 53 | **52 of 53** |
| configs no runner opened | 19 | **0** |
| negative configs that fail when the witness stops firing | 0 | **14** |
| exhaustive state counts asserted | 0 | **37** |
| ungated models, declared with a written reason | 0 | **1** (`BftLiveness`) |

**Verdicts re-measured under the pinned invocation.** All 14 negative verdicts and every
exhaustive green reproduce with the same property names. Four halt-on-violation counts moved
(234 to 149, 41004 to 41003, 54 to 42, 112 to 100) because exploration order depends on worker
count -- so the registry records those and asserts only the exhaustive ones. `BftLiveness` ran to
completion under the pin: `ConditionalTermination` HOLDS, exhaustive, 4,665,495 distinct states,
depth 24, **43min 02s** against the `11min 14s` its `.cfg` records from a 4-worker run.
`BftConsensus`
explores 4,665,495 distinct states at `-workers 1`, byte-identical to the 4-worker figure in its
`.cfg`, which is the evidence that the split is real.

**No spec was made to pass by weakening what it checks.** Nothing was relaxed; the one number
that looked wrong (`BftConsensus` reporting 122647 against a pinned 4665495) was a defect in my
own parser -- it matched a TLC *progress* line instead of the final summary. Fixed in both
implementations with a regression test, rather than by loosening the pin.

**The related gap in this file is closed too.** `the TLA+ gate leg actually carries the gate on
CI` fails when the one Linux-x64 leg that carries the whole TLA+ gate lacks java or the jar,
instead of skipping silently.

**Deadlock vacuity is now in the artefact.** Every model records `deadlock` as `off-cfg`,
`on-vacuous` or `on`. `QuorumCollateral` and `WagerSolvency` are `on-vacuous`: they stutter, so
their deadlock checks cannot fail and neither makes a deadlock-freedom claim. The linter
cross-checks `off-cfg` against what the `.cfg` actually declares.

**Drift is loud.** `src/Core.TypeScript/hygiene/lint-tlc-model-registry.ts` (gated by
`bun test src/Core.TypeScript/hygiene/`) refuses a `.cfg` that no model claims, a model whose
files are gone, a violation-expecting model with no pinned error string, an `extended` tier with
no reason, and a `tla2tools.jar` whose sha256 has moved.

**Found while pinning, filed separately:** `tools/setup/manifests/from-url` downloads
`tla2tools.jar` into `tools/tla/tla2tools.jar`, a path no runner reads, with no checksum. The jar
the gate loads is `src/Core.TLA/tla2tools.jar`, committed to git since #8053, reporting
`TLC2 Version 2026.05.18.174321` -- not the `v1.8.0` that `docs/dependency-status.md` and
`docs/INSTALLED.md` claim.

**Verified locally:** `dotnet build -c Release` 0 warnings 0 errors; `dotnet test --filter
TlcRunnerTests` **58 passed, 0 failed** in 4m11s; `bun test src/Core.TypeScript/hygiene/` 886
passed; `bun test src/Core.TypeScript/formal-verification/` 21 passed;
`bun src/Core.TypeScript/lint/lint-typescript.ts` clean.
