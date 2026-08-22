# `src/Core.TypeScript/bayesian/` triage — one LIVE, three orphans, and a factor-graph edge that was never cut

**Status:** MEASUREMENT + RECOMMENDATION. **Nothing deleted. Nothing renamed. No behaviour changed.**
**Date:** 2026-08-15 · **From:** the shadow · **Advisory — Aaron calls the disposition.**
**Follows:** PR #10859 (**still OPEN at time of writing, not merged**), which found the directory
largely unreachable. This is the triage that PR's numbers licensed, not a re-run of it.

## Why this is not a deletion PR

PR #10859 established that these four modules total **1660 lines** somebody wrote for a reason.
"Unreachable" is a measurement; "dead" is a **verdict**, and the two are not the same claim —
`dual-use-detection-is-neutral-oracle-decides.md` applied to a reachability scan. Deleting another
lane's work on the strength of an import graph is a verdict the graph cannot support, so the output
here is a **classification with its evidence attached**, and the disposition stays with Aaron.

## The instrument, and its controls

Reachability was **measured, not grepped**. `.scratch/reach.ts` (not committed) walks every tracked
`.ts/.tsx/.js/.mjs/.cts/.mts` file (**2665 files, 4896 resolved intra-repo edges**) and extracts
**every** specifier form — multi-line `import ... from`, `export ... from`, bare `import "x"`,
**dynamic `import("x")`**, and `require("x")` — then resolves each relative specifier against the
real filesystem (`.ts`, `.tsx`, `.js`, `index.ts`, …) and inverts it into a reverse index.

**Controls ran before any result was believed — 4/4 positive plus a negative control:**

| control | why it is the right control | result |
|---|---|---|
| `observe/chooser.ts` ← `service/loop-tick.ts` | reached **only** via `await import(...)` (`loop-tick.ts:316`) | **PASS** |
| `observe/composer.ts` ← `service/loop-tick.ts` | same, `loop-tick.ts:344` | **PASS** |
| `observe/chooser.ts` ← `observe/composer.ts` | ordinary static `import type` | **PASS** |
| `bayesian/bnn-persistence.ts` ← `planning/society-bnn.ts` | the one edge #10859 found | **PASS** |
| a module path that does not exist | must report **zero** importers | **PASS** |

The dynamic-import controls are the load-bearing ones: **`loop-tick.ts` reaches both of its
decision modules through `await import(...)`, which a `from "…"` search cannot see at all.** An
instrument that only knew the `from` form would have reported the repo's most-executed decision
path as unreachable. That is the same vacuity class #10859 caught in itself, and it is why the
controls exist rather than being assumed.

### An owned error in my own controls

My third control initially **FAILED** and the instrument printed
`!! INSTRUMENT UNTRUSTWORTHY -- results below are void`. I had asserted `chooser.ts` imports
`composer.ts`. It does not — **`composer.ts:11` imports `ComposerBackend` from `chooser.ts`**; the
edge runs the other way. The instrument was right and **my assumption was inverted**. I fixed the
control by *reading composer.ts*, not by loosening the check. Recording it because a failing control
is exactly the moment where the tempting move is to weaken the instrument until it agrees with you.

## The measured state

`sensor-fusion-oracle.ts` **imports `bnn-persistence.ts`** (line 40 on `origin/main`,
`tangleBreakObservation`). *(Owned instrument defect: my reverse index prints that edge as line 39
— the specifier regex consumes one leading character, so a match preceded by a newline reports one
line early. It affects only printed line numbers, never which edges were found; every line number
cited in this doc was re-checked by hand against the file.)*
So the directory is not four unrelated files: there is one internal edge, and it runs from an
orphan **into** the live module. There is **no CLI entry point** anywhere in the directory
(no `import.meta.main`, no shebang, no `process.argv`), so nothing is reachable by invocation
either — a path a module graph alone would have missed.

| module | lines | external importers | verdict |
|---|---|---|---|
| `bnn-persistence.ts` | 309 | **2** — `planning/society-bnn.{ts,test.ts}` | **LIVE** |
| `sensor-fusion-oracle.ts` | 218 | **0** (but *imports* `bnn-persistence`) | **SUPERSEDED**, consumer declined |
| `categorical-bayesian-planner.ts` | 288 | **0** | **ABANDONED** (mechanism sound) |
| `shiva-weak-factor-graph.ts` | 299 | **0** | **ABANDONED** (partial port of a shipped F# module) |

**No module is STAGED.** That is a finding with evidence, not an absence of effort:

- **Every open Bayesian work item names F# files, never these.** `081KZ9XH11908QG0R001RMFX7M`
  (EP engine) → `src/Bayesian/{FactorGraph,Ep,Message}.fs`. `081KZR81XZ508QG0R000NZB8MQ`
  (BNN over DynamicValue/SoftValue) → `src/Bayesian/{MinimalBnn,MultilayerBnn}.fs`.
- **The live trajectory routes this capability through F#.**
  `docs/trajectories/silicon-alife-freedom-homoclinic-braid-bridge/RESUME.md` arc 3 —
  *"factor-graph → BNN — REFRAMED (the old premise was wrong) … the message-passing layer WAS
  already built (`src/Bayesian/`) … the missing piece was the categorical bridge, which is now the
  `WSet` hexagon port (work-item `081KYXE4W8808QG0R0011X8S70`)."* The scheduled next step for
  exactly this capability is **F#/WSet, and it does not mention the TypeScript modules.**
- **The mentions that do exist are retrospective, not forward-looking.** The three handoff docs
  (`docs/handoffs/2026-08-10-lumen-{8h,24h}-review-addison.md`, `…-vera-recent-work-review.md`)
  record *"I built this, 12 tests pass"*. A handoff saying a thing was **built** is not evidence
  it is **scheduled**; reading it as STAGED would be the silent-promotion failure.

### The prose-comment mirage, made precise

Four files **name** modules in this directory while importing nothing from them. Refining the
count in #10859, because the split matters: **two name the LIVE module** —
`discovery/zeta-agent.ts:49` and `ferry-throttler/four-corner-feedback.ts:177`, both
`bnn-persistence.ts` — and **two name orphans**: `discovery/zeta-transport-cell.ts:60`
(*"sensor-fusion-oracle.ts (BNN+Worm fusion)"*, under a `Composes with:` heading it does not
compose with) and `algebra/exact-weight.ts:22` (*"categorical-bayesian-planner.ts (the byte-lock
test target)"* — a target it never imports).

## `sensor-fusion-oracle.ts` — its consumer exists and reimplemented instead

This is the sharpest result, and it is not "nobody wanted it."

`demo/identity-dla-site/src/components/OracleRaceMode.tsx` is a tracked file that **twice prints
`Ref: sensor-fusion-oracle.ts`** on screen (lines 2080, 2191) — it is the natural consumer, it
knows the module exists, and it **cites it to the user**. It also **defines its own `computePlv`
at line 30** and its own `fmzCorrelator`, and imports nothing from `bayesian/`.

So the fusion capability now exists **three times**: in F# (`QuantumFusion.fs` `fuseOracle` /
`fuseDeltas`, plus `FigureEightEnsemble.fs` `rhoProxy` — and `QuantumFusion.fs:421` implements
`Vision.IBranchForecaster`, i.e. it is *wired*), in `sensor-fusion-oracle.ts` (zero importers), and
inline in the demo. **The module was passed over by the one caller that had a use for it**, which
is a stronger signal than never having been noticed.

## The specific gap: (a) a missing edge, decisively — not two rival attempts

The brief asked whether *"two factor-graph modules in one directory that have never composed"* is
**(a)** a missing edge somebody intended or **(b)** two independent attempts at one thing, one of
which should retire. **From the code and the history: (a), and it is not close.**

**First, a correction to the framing — these are not two factor-graph representations.** They are
two different *layers*, and their own headers say so:

- `categorical-bayesian-planner.ts` defines `CategoricalFactorTensor` — a **materialized
  representation**: `{ factorId, logProbabilities: ReadonlyMap<string, number> }`.
- `shiva-weak-factor-graph.ts` defines `FactorGenerator = (stateKey: string) => number` — not a
  representation at all, but a **lazy access path**, wrapped in a WeakRef ephemeron cache
  (`ShivaWeakFactorCache`), a deterministic mark-sweep GC, and a Futamura 1st-projection specializer.

They are the **materialized and the lazy form of literally the same function**, and the semiring
agrees: shiva's `getOrCompute` is documented *"Retrieves or computes factor **log probability**"*,
`futamura1stProjection` returns `logProb`, and shiva's own VMP comment states *"VMP factors are
**log-likelihood** functions — exactly what FactorGenerator returns."* Same domain (`stateKey:
string`), same codomain (a **log**-probability). Nothing needs retiring, because **neither one
does the other's job.**

**Second — the planner's inner loop is precisely what shiva was built to eliminate.**
`BayesianHierarchicalSearch` does a raw `transitionFactors.logProbabilities.get(nextKey)` **inside
its fine-level BFS** (and again at the coarse level). Shiva's header states its purpose as
*"eliminating factor graph lookup overhead during high-speed planning (10,000+ states/sec)."*
The producer of the optimisation names the consumer's exact hot operation.

**Third — the edge was never cut, so nothing regressed.** `git log -S` over all refs:

- no commit ever put `shiva-weak-factor-graph` into the planner,
- no commit ever put `CategoricalFactorTensor` into shiva,
- `CategoricalFactorTensor` has been touched by exactly **two** commits in its life (`e1494d16c`
  birth, `20fdc8979` fix) plus #10859's doc.

They were born **on the same day, 2026-08-01, in two different commits** — `e1494d16c`
(*"order-independent categorical Bayesian hierarchical planner"*) and `80d6a3f93` (*"Shiva WeakRef
ephemeron factor cache & Futamura 1st projection compiler"*) — and were edited together **once**
(`20fdc8979`) without anyone connecting them. Parallel construction, never a removal.

**The honest asymmetry, so "one line" is not overstated.** Materialized → lazy is total:

```ts
const gen: FactorGenerator = (k) => tensor.logProbabilities.get(k) ?? MISSING;
```

Lazy → materialized is **not** total: a `FactorGenerator` is a function with no enumerable domain,
so you cannot recover a tensor from it without being handed a key set. And `MISSING` cannot be a
constant: `combineFactorsCommutatively` defaults absent keys to `0.0`, while the planner's coarse
loop uses `-0.1` and its fine loop uses `-0.05`. **Three different defaults for "no factor here"
already live in one directory** — the adapter must take the default as a parameter, and the three
values want reconciling first. That is the real work the edge implies, and it is why the
recommendation below is *file it*, not *write it now*.

## Two findings the triage turned up on the way

1. **A near-vacuous assertion.** `categorical-bayesian-planner.test.ts:127` asserts
   `expect(result.jointLogLikelihood).toBeDefined()`. That passes for `NaN`, `0`, and `-Infinity`
   alike — it discriminates nothing about the quantity the module exists to compute. The
   surrounding assertions (plan non-null, states explored > 0, replay reaches the goal) are real;
   this one is the vacuity class in a suite that otherwise avoids it.
2. **`shiva-weak-factor-graph.ts` was still being invested in while unreachable** — extended
   2026-08-09 (`bf2f08d49`, VMP Student-t factor node), **8 days after birth and with zero
   importers the whole time.** Whichever way it is dispositioned, that is the cost of an
   unmeasured import graph: work went into a module nothing could call.

## Metering state (`toy-is-free-metered-must-be-earned.md`)

All four modules are **unlabelled today** — no `toy`, no `unmetered`, no `metered` anywhere in the
directory — which the rule reads as `unmetered` by default. Measured per claim rather than per
file, because they differ (**35 tests pass, 0 fail, 4 files**):

- **metered** — `combineFactorsCommutatively` (byte-lock commutativity, plus a 100-random-permutation
  property test); `computeFactorEntropy` (pinned to `log2(4) = 2.0`); `ShivaMarkSweepGc` (determinism
  **with an explicit negative control**: pinned roots must survive); `futamura1stProjection`
  (exact `logProb === -0.01`). These are falsifiers of **algebraic** claims and they do fail when
  the claim is broken.
- **unmetered** — `BayesianHierarchicalSearch` as a *planner* (its likelihood output carries only
  the `toBeDefined()` assertion above), and `sensor-fusion-oracle`'s IV-weighted fusion as a *model
  of anything real*.

Stated plainly so no one rounds it up: **the mechanisms are metered on their own algebra; none of
these modules is metered as a model of the world.**

## Recommendation — label, file, do not delete

1. **`bnn-persistence.ts` — LIVE. No action.** Reached, tested, and deliberately wired by a
   completed work item (`081M005CGB7087G0R0031328CY`, *"wire bnn-persistence so the society BNN
   survives the tick"*).
2. **Label the three orphans in their doc comments** (additive comment-only, fully reversible, no
   semantics touched). This is the landable half and it is what this PR does.
3. **File one work-item for the adapter** — `CategoricalFactorTensor → FactorGenerator`, whose
   first task is reconciling the **three different missing-key defaults** (`0.0` / `-0.1` /
   `-0.05`), not writing the lambda. Filed only if Aaron wants the TypeScript lane alive at all;
   if the answer is "F# owns this", the honest action is retirement, and **that is his call, not
   mine.**
4. **Do not delete anything in this PR**, and do not delete on the strength of this doc alone. The
   modules are reachable-by-nothing, not wrong; `every-bug-has-economic-value.md` prices the
   finding, and the finding is already banked by writing it down.

## A resemblance, recorded as a coincidence with its register attached

Per `numerology-vs-number-theory.md`: today produced several *"two working rungs, no edge between
them"* findings, and **#10835's agent explicitly weakened that pattern when it measured it** — its
instance 3 turned out to be a different shape.

**What is verified here** is only the local structure: two complementary layers, type-compatible in
the materialize→lazy direction, born the same day, never composed, and `git log -S` confirms the
edge never existed. That is measured.

**What is NOT verified** is that this is *the same phenomenon* as the other instances. I have one
mechanism (parallel same-day construction inside one directory) and no evidence it is the mechanism
in the others. Recorded as a **coincidence**, register attached, **not** promoted to a pattern —
and noting that a day dense with resonances is exactly the condition the rule flags as a **warning,
not a confirmation signal**. Nothing in the recommendation above depends on the resemblance being
real.

## Corrections to the brief I was given

1. **PR #10859 is OPEN, not merged.** Its research doc is not on `main`; every number above was
   re-measured at `71af4c447` rather than inherited.
2. **"`shiva`, `categorical-bayesian-planner`, `sensor-fusion-oracle` have ZERO importers" is
   right, but `sensor-fusion-oracle.ts` is not isolated** — it *imports* `bnn-persistence.ts:39`.
   The directory has an internal edge, running from an orphan into the live module.
3. **"Two factor-graph modules … have never composed" understates the asymmetry.** One is a
   representation, the other a cache + specializer over a generator. They are complementary layers,
   so **(b) "retire one" was never a live option** — the only coherent choices are *write the
   adapter* or *retire the whole TypeScript lane*.
4. **The brief's framing left `sensor-fusion-oracle` looking merely unused.** Its natural consumer
   exists, cites it on screen, and reimplemented `computePlv` locally instead — a materially
   different (and worse) status than "not yet wired".
5. **Environment:** cloning from the shared checkout at
   `/Users/acehack/Documents/src/repos/Zeta` failed — `remote: aborting due to possible repository
   corruption on the remote side / fatal: early EOF`. Cloned from GitHub instead. Flagging it
   because it will bite the next agent given the same instruction; the shared checkout was **never
   written to**.

## Pointers

- PR #10859 — the measurement this triage builds on (open).
- `docs/trajectories/silicon-alife-freedom-homoclinic-braid-bridge/RESUME.md` arc 3 — the F# route
  for this exact capability.
- `src/Bayesian/` (43 modules) · `src/Core/ShivaGc.fs` (23 KB) + `src/Core/Ephemeron.fs` — the
  shipped F# originals the TypeScript port names as its source.
- `toy-is-free-metered-must-be-earned.md` · `numerology-vs-number-theory.md` ·
  `dual-use-detection-is-neutral-oracle-decides.md` — the three rules this triage runs under.
