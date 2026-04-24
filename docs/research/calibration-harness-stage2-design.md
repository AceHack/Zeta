# Calibration Harness Stage-2 Design — CoordinationRisk null-models, seed replay, artifact layout

**Status:** research-grade proposal (pre-v1). Origin: Amara
18th courier ferry, Part 1 §B ("Statistical Calibration Plan"),
§F PR #2 ("CoordinationRisk calibration harness"), and Part 2
corrections #2 (Wilson intervals), #7 (MAD=0 fallback), and #9
(explicit artifact output). This doc specifies the Stage-2
rung of the corrected promotion ladder. Author: architect
review. Scope: design-only; no code, no tests, no workflow
changes.

## 1. Why this doc

The 18th-ferry corrected promotion ladder places the
**calibration harness at Stage 2**, between the toy detector
(Stage 1, PR #323) and the advisory engine (Stage 4, future
`src/Core/NetworkIntegrity/`). Stage 2's deliverable is a
runnable harness that:

1. generates synthetic null-model workloads (no cartel),
2. generates synthetic attack workloads (cartel present),
3. computes metrics across many seeds,
4. emits artifacts that downstream calibration + ROC/PR
   tooling reads,
5. produces Wilson-interval confidence bounds on detection +
   FPR rates rather than handwave ±5%.

Without a pre-committed design, the first Stage-2 graduation
invents its own conventions; every subsequent graduation
either follows them or diverges. Writing the design first is
cheaper than untangling divergence later.

This doc is **research-grade** in `docs/research/` until an
ADR promotes it. Code landings consuming this design cite
it by path; any divergence from the design requires a design
amendment (PR editing this doc) rather than silent drift.

## 2. Placement

```text
src/Experimental/CartelLab/
  CalibrationHarness.fs         ← core runner
  NullModels.fs                 ← 6 null-model generators
  AttackInjectors.fs            ← 8 scenario injectors (Stage 3)
  MetricVector.fs               ← Z-score vector type
  WilsonInterval.fs             ← Wilson score CL helper
tests/Tests.FSharp/CartelLab/
  CalibrationHarness.Tests.fs   ← seeded smoke tests
artifacts/coordination-risk/    ← .gitignored; output of runs
  calibration-summary.json
  seed-results.csv
  roc-pr.json
  failing-seeds.txt
  metric-distributions.csv
  run-manifest.json
```

The `src/Experimental/` namespace is introduced here for the
first time. It is the appropriate home for Stage-2 / Stage-3
work per Amara's corrected promotion ladder — not `src/Core/`,
which is reserved for Stage-4 advisory engine. A
`src/Experimental/README.md` documenting the
"Experimental-vs-Core" distinction should accompany the first
landing.

## 3. Core types

### 3.1 Metric vector

```fsharp
type MetricVector = {
    DeltaLambda1  : double option  // Δλ₁ (symmetrized adj)
    DeltaQ        : double option  // ΔQ (modularity, Louvain)
    StakeAccel    : double option  // A_S (2nd diff covariance)
    PLVMagnitude  : double option  // PLV |r|
    PLVOffset     : double option  // arg(r), radians
    Exclusivity   : double option  // w(S,S) / w(S,V)
    Influence     : double option  // ∂²Out/∂i∂j for i,j∈S
}
```

Notes:

- Every metric is `option` because each has defined
  "undefined" cases (empty inputs, zero-magnitude PLV,
  degenerate Graph).
- PLV is two fields, not one — per 18th-ferry correction
  #6, magnitude and offset are distinct dimensions.
  Downstream scoring uses both.
- `Exclusivity` replaces raw `Conductance` from the
  draft deep-research per correction #4. The positive-
  valence primitive is what the score consumes directly;
  `Conductance` stays a diagnostic only.

### 3.2 Scenario

```fsharp
type Scenario =
    | NullModel of name: string
    | Attack of name: string
```

Stage-2 populates these with the six null-model names:
`ErdosRenyi`, `Configuration`, `StakeShuffle`,
`TemporalShuffle`, `ClusteredHonest`, `Camouflage`.
Stage-3 adds eight attack names:
`ObviousClique`, `StealthSlow`, `SynchronizedVoting`,
`DenseHonestCluster`, `LowWeightCartel`, `CamouflageNoise`,
`RotatingCartel`, `CrossCoalition`.

### 3.3 Run record

```fsharp
type RunRecord = {
    Scenario     : Scenario
    Seed         : int
    Parameters   : Map<string, string>  // scenario params
    Metrics      : MetricVector
    ZScores      : MetricVector          // robust-z normalized
    Detected     : bool                  // per-threshold verdict
    Elapsed      : System.TimeSpan
}
```

The `ZScores` field is a second `MetricVector` holding the
per-metric robust z-scores computed against the null-model
baseline. Using the same type twice is deliberate — the
values are in different units but the structural shape is
identical, which keeps code symmetric.

## 4. Null-model generator interface

```fsharp
type INullModelGenerator =
    abstract Name : string
    abstract Preserves : string seq
    abstract Avoids : string seq
    abstract Generate : seed: int -> parameters: Map<string, string> -> Graph<int>
```

The `Preserves` / `Avoids` fields are Amara 18th-ferry
Part 1 §B null-model table columns — they make the
invariant target of each generator machine-readable for the
harness report. Example:

```fsharp
type ErdosRenyiGenerator() =
    interface INullModelGenerator with
        member _.Name = "ErdosRenyi"
        member _.Preserves = seq { "node-count"; "average-degree" }
        member _.Avoids = seq { "any-structure" }
        member _.Generate seed parameters =
            let n = parameters |> Map.find "n" |> int
            let m = parameters |> Map.find "m" |> int
            let rng = System.Random(seed)
            // ... build Graph with n nodes, m random edges
            Graph.empty
```

Six generators ship in Stage-2 `NullModels.fs`. Attack
injectors (Stage 3) implement a parallel interface
`IAttackInjector` with the same shape plus a "baseline graph"
parameter onto which the attack is overlaid.

## 5. Wilson intervals

Per Amara 18th-ferry correction #2, every
detection-rate / false-positive-rate claim ships with its
Wilson 95% interval. The claim "90 of 100 seeds detected" is
not "basically 90%"; its Wilson 95% lower bound is ~0.826.

### 5.1 API

```fsharp
/// Wilson score confidence interval for a binomial
/// proportion. Parameters:
///   successes : k, count of successes
///   trials    : n, total trials
///   z         : normal quantile (1.96 for 95%, 2.576 for 99%)
///
/// Returns (lower, upper) in [0, 1]. Handles k=0 and k=n
/// without NaN. Returns (nan, nan) when trials < 1.
val wilson : successes: int -> trials: int -> z: double -> struct (double * double)

/// Convenience wrapper at 95% (z = 1.959964).
val wilson95 : successes: int -> trials: int -> struct (double * double)
```

### 5.2 Reporting contract

Every statistical claim in an artifact carries the four
fields: `{ successes, trials, lowerBound, upperBound }`.
Examples:

```json
{
  "detection":   { "successes": 90, "trials": 100,
                   "lowerBound": 0.826, "upperBound": 0.945 },
  "falsePositive": { "successes": 20, "trials": 100,
                     "lowerBound": 0.135, "upperBound": 0.289 }
}
```

Promotion discipline (Amara corrected ladder): Stage 4
advisory-engine claims require `lowerBound ≥ 0.90` (for
detection) and `upperBound ≤ 0.10` (for FPR). Stage 2 can
report whatever the measurement is; Stage 4 sets the bar.

## 6. Robust z-score with MAD=0 fallback

Per 18th-ferry correction #7, `RobustStats.robustZScore`
needs a fallback when `MAD = 0` (null-model baseline is
constant). Current implementation (PR #333) uses an
epsilon-floor `MadFloor`. The correction asks for an
additional mode:

```fsharp
type RobustZScoreMode =
    | EpsilonFloor of epsilon: double
    | PercentileRank
    | Hybrid of epsilon: double  // percentile-rank when MAD < epsilon

val robustZScore :
    mode: RobustZScoreMode
    -> baseline: double seq
    -> measurement: double
    -> double option
```

The `Hybrid` mode is the recommended default for the
calibration harness: use the fast 1.4826·MAD path when
MAD is non-trivial, fall back to percentile-rank when the
baseline is effectively constant. Pure `EpsilonFloor` is
retained for callers that want strict O(1)-per-call
semantics.

## 7. Artifact layout

Per 18th-ferry correction #9, the output directory layout
is pre-specified so downstream tooling (notebooks, PR
comments, nightly-sweep dashboards) knows exactly what to
read.

### 7.1 `run-manifest.json`

One file per harness run, containing the invocation
metadata:

```json
{
  "run_id":             "2026-04-24-1430-otto-162",
  "commit_sha":         "<40-hex>",
  "zeta_version":       "<semver or pre-v1-tag>",
  "started_at":         "2026-04-24T14:30:00Z",
  "completed_at":       "2026-04-24T14:42:13Z",
  "null_models":        ["ErdosRenyi", "Configuration", ...],
  "attack_injectors":   [],
  "seeds_per_scenario": 100,
  "scenario_parameters": { "n": 50, "m": 200 },
  "wilson_z":           1.959964,
  "robust_mode":        "Hybrid",
  "robust_epsilon":     1.0e-12
}
```

### 7.2 `seed-results.csv`

One row per `(scenario, seed)` pair. Schema:

```text
scenario,seed,detected,delta_lambda1,delta_q,stake_accel,
plv_mag,plv_offset,exclusivity,influence,
z_delta_lambda1,z_delta_q,z_stake_accel,z_plv_mag,
z_plv_offset,z_exclusivity,z_influence,elapsed_ms
```

Row is a flat CSV; no nested values. Undefined metrics
encode as empty string (not "nan", not "NULL") to stay
friendly to pandas / DuckDB / Excel.

### 7.3 `calibration-summary.json`

Aggregate per-scenario stats:

```json
{
  "by_scenario": {
    "ErdosRenyi": {
      "trials":   100,
      "detected": 18,
      "detection_rate": {
        "point":      0.18,
        "lowerBound": 0.119,
        "upperBound": 0.263
      },
      "metric_medians": { ... },
      "metric_mads":    { ... }
    },
    "ObviousClique": {
      "trials":   100,
      "detected": 90,
      "detection_rate": {
        "point":      0.90,
        "lowerBound": 0.826,
        "upperBound": 0.945
      }
    }
  },
  "overall_fpr": {
    "trials":   600,
    "false_positives": 80,
    "rate": {
      "point":      0.133,
      "lowerBound": 0.108,
      "upperBound": 0.163
    }
  }
}
```

Null-model rows aggregate into `overall_fpr`; attack rows
stay per-scenario so different attacks can be assessed
independently.

### 7.4 `roc-pr.json`

ROC and PR curve samples for threshold sweeps. Per Amara
correction #8, PR curves are more informative than ROC for
low-prevalence detection:

```json
{
  "roc": [ { "threshold": 0.5, "tpr": 0.95, "fpr": 0.30 }, ... ],
  "pr":  [ { "threshold": 0.5, "precision": 0.72, "recall": 0.95 }, ... ],
  "operating_point": {
    "recommended_threshold": 3.0,
    "rationale": "lowest threshold satisfying Wilson FPR UB <= 0.10"
  }
}
```

### 7.5 `metric-distributions.csv`

Per-metric, per-scenario histograms for visualization. Schema:

```text
scenario,metric,bin_lower,bin_upper,count
```

### 7.6 `failing-seeds.txt`

Seeds on which a regression test would have failed (e.g.
the advertised detection bar was missed). One seed per
line. Intended downstream consumer: a regression suite
that re-runs these specific seeds on every PR to catch
re-introductions of the failure.

## 8. Invocation contract

```fsharp
type HarnessConfig = {
    NullModels      : INullModelGenerator list
    AttackInjectors : IAttackInjector list
    SeedsPerScenario : int                    // default 100
    ScenarioParameters : Map<string, string>
    WilsonZ         : double                  // default 1.959964
    RobustMode      : RobustZScoreMode        // default Hybrid(1e-12)
    OutputDirectory : string                  // default "artifacts/coordination-risk"
    DetectionThreshold : double               // per-scenario flag threshold
}

val run : config: HarnessConfig -> Async<unit>
```

The runner emits all five artifact files on completion.
Failure to write any file aborts the run (fail-closed); a
partial artifact set is worse than a clear failure.

## 9. CI hook (optional)

Nightly workflow at `.github/workflows/cartel-calibration-
sweep.yml` (not landing with this design; mentioned for
orientation). Runs the harness on `schedule: cron: '0 4 * * *'`.
The workflow:

- 100 seeds per scenario (small budget)
- uploads `artifacts/coordination-risk/` as workflow
  artifacts
- opens an issue when `detection_rate.lowerBound` for any
  attack scenario falls below 0.80 for two consecutive
  runs

The issue-opening rule is a regression alarm, not a merge
gate — statistical smoke tests do not block PRs per
`docs/research/test-classification.md`.

## 10. Stage-3 scenario suite interface (forward-looking)

Same shape as `INullModelGenerator` but parameterized over
a baseline graph:

```fsharp
type IAttackInjector =
    abstract Name : string
    abstract ExpectedSignals : MetricName seq
    abstract Inject : baseline: Graph<int> -> seed: int -> parameters: Map<string, string> -> Graph<int>
```

`ExpectedSignals` documents which MetricVector fields the
attack should produce a signal on (e.g. `ObviousClique` →
`[DeltaLambda1; DeltaQ; Exclusivity]`; `SynchronizedVoting`
→ `[PLVMagnitude]` only). The harness's scenario-behavior
check asserts the expected-signal fields are above-baseline
z-score without asserting exact values.

## 11. What this doc does NOT do

- Does **not** ship any code. Pure design; Stage-2
  implementation lands as a separate graduation.
- Does **not** implement the 8-row attack-scenario suite.
  That is Stage 3, building on this interface.
- Does **not** wire the nightly workflow. Workflow design
  is a follow-up once Stage-2 implementation exists.
- Does **not** place the harness in `src/Core/`. Amara's
  corrected promotion ladder reserves `src/Core/
  NetworkIntegrity/` for Stage 4; Stage 2 lives in
  `src/Experimental/`.
- Does **not** constrain thresholds. The `DetectionThreshold`
  field is input, not output; operating points come from
  the ROC/PR sweep.
- Does **not** widen any existing test threshold. Per
  correction #10, changes to existing stochastic tests
  require measured-variance evidence, not new-doc
  authority.

## 12. Composition with other in-flight work

- **Amara 18th ferry absorb** (PR #337) — this doc
  operationalizes §B / §E / §F + corrections #2 / #7 / #9.
- **`docs/research/test-classification.md`** (PR #339) —
  the harness produces category-3 statistical smoke tests;
  this doc's §9 nightly-workflow design aligns with the
  classification's nightly-sweep cadence.
- **`docs/definitions/KSK.md`** (PR #336) — KSK's Oracle
  layer consumes the harness's per-run Wilson-bounded
  detection rate. Oracle trust posture depends on the
  interval width, not just the point estimate.
- **`src/Core/TemporalCoordinationDetection.fs`** — PLV +
  new `meanPhaseOffset` (PR #340) populate the
  `PLVMagnitude` + `PLVOffset` fields of `MetricVector`.
- **`src/Core/RobustStats.fs`** — existing `robustZScore`
  + proposed `Hybrid` mode (PR #333 + this doc §6)
  populate every `ZScores.*` field.
- **`src/Core/Graph.fs`** — `largestEigenvalue`,
  `modularityScore`, `labelPropagation`, `exclusivity`,
  `internalDensity`, `conductance` (PRs #321, #324, #326,
  #331) are the primitive surface the harness consumes.
- **Otto-160 parser-tech** (#338 merged) — not directly
  relevant to this doc, but the FParsec-first discipline
  informs how scenario parameters might be parsed from
  scenario-description DSL files later.

## 13. Promotion path

- Stage 0 (now): this research doc.
- Stage 1: ADR defining Stage-2 as the next
  CartelLab graduation + sign-off on the artifact layout.
- Stage 2.a: `src/Experimental/CartelLab/` directory
  created; `CalibrationHarness.fs` skeleton + 1 null-model
  generator (`ErdosRenyi`) + `WilsonInterval.fs` + smoke
  test; empty attack-injector list; artifact output files
  written with an empty scenario set to validate the
  layout end-to-end.
- Stage 2.b: remaining 5 null-model generators + `Hybrid`
  mode in `RobustStats.robustZScore` + first attack
  injector (`ObviousClique`) as a cross-check.
- Stage 3: remaining 7 attack injectors.
- Stage 4: promotion of the composite scoring + Wilson-
  interval reporting into `src/Core/NetworkIntegrity/`
  once FP bar cleared at Wilson-upper-bound ≤ 0.10 and
  detection Wilson-lower-bound ≥ 0.90.
- Stage 5: Aurora / KSK policy-layer integration per
  `docs/definitions/KSK.md` advisory-only flow.
- Stage 6: explicit enforcement only with due-process
  policy + red-team review (not this doc's concern).

Each stage is a small graduation on the Otto-105 cadence.

## 14. Cross-references

- Amara 18th ferry — `docs/aurora/2026-04-24-amara-
  calibration-ci-hardening-deep-research-plus-5-5-
  corrections-18th-ferry.md`.
- Test classification — `docs/research/test-
  classification.md`.
- KSK definition — `docs/definitions/KSK.md`.
- PR #323 toy cartel detector — Stage 1, input to
  this Stage-2 design.
- PR #327 sharder flake BACKLOG — parallel CI-discipline
  work.
- Otto-105 graduation cadence memory.
- GOVERNANCE §4 skills-through-skill-creator (not
  relevant here but referenced for context).
