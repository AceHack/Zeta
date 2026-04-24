# Test Classification — CI Gate Discipline

**Status:** research-grade proposal (pre-v1). Origin: Amara
18th courier ferry, Part 1 §C ("CI Testing & Governance
Policy") + Part 2 correction #1 (precision wording) +
correction #10 (sharder — measure before widen). Author:
architect review. Scope: formalizes a 5-category test
taxonomy and the "PR gate = deterministic-only" discipline.

## 1. Why this doc

The factory accumulated several test styles without
explicit classification:

- Deterministic unit tests (e.g. `Graph.Tests.fs` λ₁(K₃)=2).
- Property tests with seeded RNG (deterministic per seed).
- Statistical smoke tests on many seeds asserting rate
  bounds (e.g. `CartelToy.Tests.fs` ≥90% detection over
  100 seeds).
- Property tests without seed-locking that assert
  statistical properties (e.g.
  `SharderInfoTheoreticTests.Uniform` — the flake
  tracked in BACKLOG #327).
- Formal / model-checking tests (TLA+, proofs).

Without a classification, CI treats them uniformly — and a
single flaky-by-design test (like the sharder) blocks merges
that have nothing to do with sharding. Amara's 18th ferry
§C proposes the fix: categorize tests, and make the PR gate
require deterministic behavior. Randomized tests either
seed-lock or move to nightly.

This is advisory — a proposal to be adopted when an ADR
lands. It is research-grade in `docs/research/` until
promoted.

## 2. The five categories

### 2.1 Deterministic unit tests (PR gate)

- **Shape.** No randomness anywhere. Input → expected
  output is a function. Same inputs + same code = same
  result, bit-identical, on any machine, any day.
- **Examples.** Algebraic properties over fixed values
  (`Graph.largestEigenvalue(K3) ≈ 2`). Parser round-trips
  on a fixed literal. Unit conversions. Modularity on a
  hand-computed graph.
- **CI policy.** Run on every PR. Failure blocks merge.
- **Discovery hint.** xUnit `[<Fact>]` without any
  `Random` / `Rng` / `Seed` / `Guid.NewGuid()` / clock
  dependency.

### 2.2 Seeded property tests (PR gate)

- **Shape.** Randomness is present but the seed is
  fixed. FsCheck `Arb.fromGen(...)` with a committed
  seed. Different seeds across runs would produce
  different outputs; the fixed seed collapses the
  randomness to one deterministic trace.
- **Examples.** A property test where the generator
  uses `System.Random(seed=42)`. A single-seed run of
  the toy cartel detector (asserts "with seed=7 and
  50 validators + 5-node cartel, detection=true").
- **CI policy.** Run on every PR. Failure blocks
  merge. The seed must be committed in source; failing
  seeds are *not* retried — they are investigated and
  either fixed-with-a-seed-addition or the underlying
  property fixed.
- **Discovery hint.** FsCheck tests with an explicit
  `Seed` attribute or `Config.Quick.With(replay=...)`.
  Grep for `[<Seed>]` / `replay=`.

### 2.3 Statistical smoke tests (nightly / extended)

- **Shape.** Randomized across many seeds (e.g. 100
  or 1000). Asserts a *statistical* property, not a
  per-seed equality. Example: "≥90% of seeds produce
  detection" or "median execution time < X ms".
- **Examples.** `CartelToy.Tests.fs` 100-seed
  detection-rate assertion; performance regression
  tests on benchmark distributions.
- **CI policy.** **Do NOT run on every PR.** Instead
  run nightly or on-demand. Failures alert but do not
  auto-block merges. When a statistical smoke test
  fails, the engineer investigates: is this genuine
  regression (code broke the statistical property) or
  flake (the sample was unlucky)? If genuine, fix the
  code. If flake, widen the sample size or tighten the
  threshold — but only after measuring the observed
  distribution's tails, not by guess.
- **Reporting.** Every run emits a seed-log artifact:
  which seeds passed, which failed, which property
  was violated. This artifact is consumed by the
  nightly-sweep workflow's reporting step.
- **Discovery hint.** Tests that iterate over many
  seeds or use `Random()` without an explicit seed.

### 2.4 Formal / model tests (PR gate or separate track)

- **Shape.** TLA+ specs, Z3 proofs, Lean proofs,
  CodeQL queries. Not imperative test code — declarative
  correctness statements checked by an external tool.
- **Examples.** `docs/*.tla` specs; `proofs/**/*.lean`.
- **CI policy.** Run on every PR *if* the tool is fast
  enough. Large TLA+ model-checks may move to scheduled
  runs if they exceed CI budget. Failure blocks merge
  when run on PR gate.
- **Discovery hint.** Top-level tools
  (`tools/alloy/`, `tools/lean4/`, `tools/formal/`)
  separate from F# test directories.

### 2.5 Quarantined / known-flaky (not gated)

- **Shape.** Tests known to be non-deterministic or
  broken, kept in-tree with an `xfail`-equivalent
  marker so nobody re-invents them. Migration target
  is one of the four categories above — quarantine is
  temporary, not permanent.
- **Examples.** `SharderInfoTheoreticTests.Uniform`
  pending seed-lock (BACKLOG #327).
- **CI policy.** Skipped on PR gate. Optionally run in
  nightly with failure-logging only. Every
  quarantined test has an open BACKLOG row describing
  the migration path.
- **Discovery hint.** Custom `[<Quarantined>]`
  attribute, or `[<Fact(Skip="reason")>]`, or the
  `tests/Quarantine/` directory (new convention).

## 3. Migration rules

When introducing a new test:

1. **Default to category 1 (deterministic unit)** unless
   the subject intrinsically requires randomness.
2. **If randomness is needed, prefer category 2** (seeded
   property) over category 3. Fixed seeds are free
   determinism.
3. **Only use category 3 (statistical smoke)** when the
   property you want to assert cannot be expressed as a
   per-seed equality — e.g. "the detector catches the
   cartel at least 90% of the time." Call out the
   threshold's confidence interval (Wilson, per Amara
   18th-ferry correction #2).
4. **Category 4 (formal)** for properties machine-
   checkable by TLA+ / Z3 / Lean. Use when exhaustive or
   proof-carrying evidence is worth the tool overhead.
5. **Category 5 (quarantined)** is a bug-state, not a
   design choice. Every quarantined test has an exit
   plan.

## 4. Sharder flake worked example

`SharderInfoTheoreticTests.Uniform traffic: consistent-hash
is already near-optimal (Expected < 1.2, got 1.22288)` is
the running example. Its honest classification today is:

- **Category 3** statistical smoke test, masquerading
  as category 1 (it runs on PR gate but its assertion
  implicitly depends on randomness).

The 18th-ferry correction #10 remedy order:

1. **Measure observed variance.** Before changing the
   threshold or the seed, collect 100+ runs of the test
   and observe the empirical distribution of the
   uniformity metric. Is 1.22288 a 2σ outlier or an
   expected 40th-percentile result?
2. **Seed-lock if possible.** If the test's intent is
   "on *this* input, consistent-hash achieves uniformity
   < 1.2", fix the input seed. This promotes it from
   category 3 → category 2 (deterministic per seed).
3. **Widen threshold if justified by data.** If the
   measured distribution has mean 1.15 and 95th
   percentile 1.25, the "< 1.2" bar is wrong by
   observation — tighten it if the test is truly
   category 1 equivalent, or widen it to "< 1.3" with
   the measured variance cited in the comment.
4. **Move to nightly if neither works.** If the metric
   is genuinely stochastic, remove it from PR gate and
   run in nightly with the seed logged on every run.

Do not blind-widen. Do not blind-quarantine. Measure
first.

## 5. CI-surface implementation sketch

Two workflows, currently conflated, proposed split:

### 5.1 PR gate workflow (deterministic-only)

Runs on `pull_request:`. Executes:

- All `[<Fact>]` tests without seed dependencies.
- All seeded property tests with committed seeds.
- Formal / model tests (TLA+, Z3) within CI time
  budget.
- **Excludes** tests marked `[<Statistical>]` or in
  `tests/Quarantine/` or `tests/Nightly/`.

Failure blocks merge.

### 5.2 Nightly sweep workflow (statistical smoke)

Runs on `schedule: cron: '0 4 * * *'` + manual trigger.
Executes:

- All tests marked `[<Statistical>]` with many seeds
  (e.g. 100 or 1000 runs).
- Emits artifacts under `artifacts/statistical-sweep/`:
  - `seed-results.csv` (seed, pass/fail, metric values)
  - `failing-seeds.txt` (for regression-suite seeding)
  - `distributions.json` (empirical distribution
    summaries)
  - `sharder-uniformity.csv` (per-run metric for the
    sharder test when it graduates from quarantine)
- Failure emits an issue but does NOT block any PR.

### 5.3 Quarantined workflow (optional, low-cadence)

Runs on `schedule: cron: '0 6 * * 0'` (weekly) + manual.
Executes every `tests/Quarantine/` test with verbose
logging. Outputs:

- `artifacts/quarantine-log/` per test.
- Issue opened if a quarantined test starts passing
  (so it can graduate back to its real category).

## 6. Attribute conventions (proposed)

Until a formal attribute scheme lands, use filename
directories + XML docstrings:

- `tests/Tests.FSharp/**/*.Tests.fs` — default category
  1 / 2 / 4 (deterministic or formal).
- `tests/Tests.FSharp/Statistical/*.Tests.fs` — category
  3 (statistical smoke).
- `tests/Tests.FSharp/Quarantine/*.Tests.fs` — category
  5 (quarantined).

Custom attributes (future graduation):

```fsharp
[<AttributeUsage(AttributeTargets.Method, AllowMultiple = false)>]
type StatisticalAttribute(seedCount: int) =
    inherit Attribute()
    member _.SeedCount = seedCount

[<AttributeUsage(AttributeTargets.Method, AllowMultiple = false)>]
type QuarantinedAttribute(backlogRow: string, reason: string) =
    inherit Attribute()
    member _.BacklogRow = backlogRow
    member _.Reason = reason
```

Used like:

```fsharp
[<Fact; Statistical(seedCount = 100)>]
let ``100-seed cartel detection rate >= 90%`` () = ...

[<Fact; Quarantined(backlogRow = "#327",
                    reason = "flake pending variance measurement")>]
let ``Uniform traffic near-optimal`` () = ...
```

## 7. Interaction with other factory discipline

- **Otto-105 graduation cadence.** A new
  category-3 statistical test graduates to category 2
  when seed-locking works, or stays category 3 if the
  statistical property is its essential claim.
- **Otto-73 retraction-native.** Statistical tests that
  observe retraction behavior emit their results as
  ZSet signed-weight events; retractions of earlier
  failing-seed records are preserved in the seed-log
  artifact history.
- **GOVERNANCE §24 one-install-script.** The
  statistical-sweep workflow runs on the same
  install-script-provisioned runner as the PR gate.
  No separate toolchain.
- **`docs/definitions/KSK.md`.** KSK's advisory flow
  (Detection → Oracle → KSK → Action) benefits from
  category-3 statistical evidence for "Detection" —
  the Oracle and KSK layers trust statistical smoke
  output with confidence intervals, not single-seed
  point estimates.
- **BACKLOG #327 sharder flake.** Direct application
  of §4 (worked example).

## 8. What this doc does NOT do

- Does **not** specify an ADR. It is research-grade
  proposal; ADR lands when Aaron approves promotion.
- Does **not** implement the `[<Statistical>]` /
  `[<Quarantined>]` attributes. Those are a future
  graduation.
- Does **not** migrate existing tests. Migration is
  per-test (Otto-105 cadence) as BACKLOG rows describe
  each test's target category.
- Does **not** touch the existing
  `docs/research/test-organization.md` layout
  discipline. The two docs compose: layout (where
  tests live) + classification (what CI does with
  them).
- Does **not** widen or narrow any threshold. Per
  correction #10: measure first.

## 9. Cross-references

- Amara 18th ferry — Part 1 §C + Part 2 #1 + #10.
  `docs/aurora/2026-04-24-amara-calibration-ci-
  hardening-deep-research-plus-5-5-corrections-18th-
  ferry.md`.
- `docs/research/test-organization.md` — layout
  discipline (28-files-flat → folder grouping).
- `docs/BACKLOG.md` — PR #327 sharder flake row.
- `docs/MATH-SPEC-TESTS.md` — category 4 (formal)
  tooling pointer.
- `.github/workflows/gate.yml` — the workflow this
  proposal would eventually split into PR-gate +
  nightly-sweep.

## 10. Promotion path

Stage 0 (now): this research doc.
Stage 1: ADR defining the taxonomy as factory discipline.
Stage 2: `[<Statistical>]` / `[<Quarantined>]` attributes
land + `tests/Tests.FSharp/Statistical/` directory
convention.
Stage 3: `.github/workflows/nightly-sweep.yml` added,
PR-gate workflow updated to exclude statistical tests.
Stage 4: migration pass — classify every existing test
and move accordingly.
Stage 5: any BACKLOG rows tracking miscategorized tests
close out (e.g. #327 sharder graduates to its real
category).

Each stage is a small graduation on the Otto-105 cadence.
