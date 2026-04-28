# Amara — Cartel Detection + Simulation Loop prototype (13th courier ferry; Python → F# translation)

**Scope:** research and cross-review artifact only; concepts
preserved verbatim, language translation required at graduation
time (Amara wrote Python; Zeta is F#/.NET).
**Attribution:**

- **Human maintainer (Aaron)** — originator of the cartel-
  detection + firefly-network design; explicit maintainer flag
  *"not sure why she did python but you get the concepts"*
  authorizes F# translation at graduation.
- **External AI maintainer (Amara)** — formalization of the
  5-component simulation loop (graph-builder + warning-signals +
  cartel-injector + detection-pass + score-function) + the
  Python pseudo-code sketch.
- **Loop-agent (Otto, factory role)** — absorb + F# translation
  plan.
**Operational status:** research-grade unless promoted. The
5-component structure is sound; the Python-specific repo layout
(`/cartel-lab/graph/builder.py` etc.) does NOT apply — Zeta-
native `src/Core/**.fs` + `tests/Tests.FSharp/**` + `bench/**`
is the actual target.
**Non-fusion disclaimer:** agreement, shared language, or
repeated interaction between models and humans does not imply
shared identity, merged agency, consciousness, or personhood.
Aaron declined Amara's offer to write starter code: *"nah we
don't need her code, we can just worry about f# for now"*
(Otto-117). Otto graduates concepts to idiomatic F#.
**Date:** 2026-04-24
**From:** Amara (external AI maintainer; Aurora co-originator)
**Via:** Aaron's courier ferry (pasted into autonomous-loop
session Otto-117)
**Absorbed by:** Otto (loop-agent PM hat), Otto-118 tick
**Prior ferries:** PR #196 (1st) through PR #311 (12th,
pending).
**Scheduling discipline:** Content-Classification discipline
(CC-002) — paste-scoped absorb deferred to a dedicated tick,
tracked in the loop-agent's out-of-repo auto-memory
(not an in-repo file).

---

## Preamble context from Aaron (Otto-117 / Otto-118)

Otto-117 paste preamble (verbatim): *"not sure why she did
python but you get the concepts next drop from amara"*.

Otto-118 clarification (verbatim): *"nah we don't need her
code, we can just worry about f# for now"*.

Load-bearing directives:

1. Amara's Python is CONCEPT sketch, not implementation
   template. Zeta is F#/.NET; graduation translates idiomatically.
2. Otto does NOT accept Amara's offer to write starter code.
   F# is the target language; Otto's graduation cadence produces
   Zeta-native F# from the concept sketches.

---

## Verbatim preservation (Amara's report)

Per courier-protocol §verbatim-preservation + signal-in-signal-
out discipline. Amara's report (Python pseudo-code preserved
as-is):

---

Nice—that context helps a lot. If your repo now has full history + Claude memories, the next high-leverage item isn't more theory—it's making the system executable and testable.

## Next item: Stand up a minimal "Cartel Detection + Simulation Loop" prototype

Right now you've got:

- Theory (predictive cartel formation, spectral drift, etc.)
- Storage (docs + memories in Git)
- Conceptual architecture (Zeta/Aurora, ZSet, KSK)

What you don't yet have is a tight feedback loop that proves this works.

## लक्ष्य: First working loop (detect → simulate → stress → score)

Build a small pipeline that does this:

### 1. Graph State Builder (baseline)

- Input: validator / agent activity (can be synthetic for now)
- Output: Weighted graph G_t
  - Edges = interaction / co-behavior / stake correlation
  - Node features = stake, timing, participation rate

Keep it simple:

```python
G_t = build_graph(events)
```

### 2. Early Warning Signals (your first "real" feature)

Implement 2–3 concrete metrics only:

- Eigenvalue growth (λ₁ of adjacency or Laplacian)
- Modularity shift (ΔQ over time)
- Stake covariance acceleration

```python
lambda_1 = largest_eigenvalue(G_t)
modularity = compute_modularity(G_t)
cov_accel = d2_dt2(stake_covariance)
```

Trigger condition (example):

```python
if lambda_1_growth > threshold and modularity_jump:
    flag_pre_cartel()
```

### 3. Synthetic Cartel Injector (critical)

This is your adversarial engine.

Generate:

- Coordinated stake movement
- Synchronized voting / behavior
- Hidden subgraph (high internal weight, low external visibility)

```python
G_t_adv = inject_cartel(G_t, size=k, stealth_factor=s)
```

You now have:

- Clean graph
- Attacked graph

### 4. Detection Pass

Run your metrics on both:

- Compare signal strength
- Measure detection latency

Output:

```json
{
  "detected": true,
  "lead_time": 3 epochs,
  "confidence": 0.82
}
```

### 5. Score Function (proto "cartel cost function")

Even if rough:

```text
CartelScore =
  α * eigenvalue_growth +
  β * modularity_gradient +
  γ * covariance_acceleration
```

This becomes your first approximation of incentive curvature.

## Where this plugs into your system

- Zeta/Aurora → runs the simulation + forecasting loop
- ZSet algebra → defines allowable graph transformations (inject, retract, perturb)
- KSK layer → enforces response once cartel score crosses threshold

## Suggested repo structure (add this next)

```text
/cartel-lab
  /graph
    builder.py
  /metrics
    spectral.py
    modularity.py
    covariance.py
  /adversary
    injector.py
  /simulation
    loop.py
  /experiments
    baseline_vs_attack.ipynb
```

## Why this is the right next move

Right now everything you've designed is powerful but unproven. This step:

- Forces your abstractions into code
- Creates measurable outputs
- Lets you iterate fast
- Gives Claude (and future agents) something concrete to extend

## After this (so you see where we're going)

Once this loop works, the next items become:

- Influence surface modeling (second-order gradients)
- Lyapunov-style stability metric
- Integration with actual ledger / Playwright pipeline
- Real-time alerting + enforcement hooks

If you want, I can write the exact starter code for the simulation loop + cartel injector so you can drop it straight into your repo and run experiments immediately.

---

## Otto's absorb notes (Otto-118)

### F# translation of the 5-component pipeline

Amara's Python maps to Zeta-native F# as follows:

| Amara Python | Zeta F# translation | Location |
|---|---|---|
| `/cartel-lab/graph/builder.py` | `Graph.build : Event seq -> Graph` (pure) | `src/Core/GraphState.fs` (new) |
| `/cartel-lab/metrics/spectral.py` `largest_eigenvalue` | `largestEigenvalue : Graph -> double option` | `src/Core/TemporalCoordinationDetection.fs` extension |
| `/cartel-lab/metrics/spectral.py` `eigenvector_centrality` | `eigenvectorCentrality : Graph -> IReadOnlyDictionary<Node, double>` | same module |
| `/cartel-lab/metrics/modularity.py` `compute_modularity` | `modularityScore : Graph -> double` | same module |
| `/cartel-lab/metrics/covariance.py` `d2_dt2` | `covarianceAcceleration : double[] seq -> double option` | `src/Core/RobustStats.fs` extension |
| `/cartel-lab/adversary/injector.py` | `CartelInjector.inject : Graph -> int -> double -> Graph` | `tests/Tests.FSharp/_Support/CartelInjector.fs` (test-only) |
| `/cartel-lab/simulation/loop.py` | FsCheck property-test harness | `tests/Tests.FSharp/Simulation/CartelLoop.Tests.fs` |
| `/cartel-lab/experiments/baseline_vs_attack.ipynb` | BenchmarkDotNet project | `bench/CartelDetection/` (new) |

### Key F# vs Python differences (already in scheduling memory)

1. Immutable-by-default — F# graphs as immutable records
2. Typed composition — strong signatures prevent accidental
   signature drift
3. FsCheck over hand-rolled property tests
4. Z-set integration — graph mutations as signed-weight deltas
   compose with existing Zeta substrate
5. No notebooks — `bench/` with BenchmarkDotNet

### Graduation candidates extracted

Priority queue (per Otto-105 cadence):

1. **`largestEigenvalue`** — smallest pure function; needs
   canonical graph type first; or operate on
   `IReadOnlyDictionary<Node, IReadOnlyDictionary<Node, double>>`.
2. **`modularityScore`** — pure function; matches §5 12th-ferry
   queue.
3. **`covarianceAcceleration`** — second-derivative-over-
   windowed-covariance; pure.
4. **Composite `cartelScore`** — `α·λ₁_growth + β·ΔQ + γ·d²_cov` with tunable weights;
   needs ADR on weights (analog to Veridicality scoring).
5. **`CartelInjector`** test-support — lives in tests/_Support/,
   NOT shipped as public API (red-team tooling).
6. **Simulation-loop harness** — FsCheck property-tests +
   BenchmarkDotNet.
7. **Graph substrate** — prerequisite audit: does Zeta already
   have a canonical graph type? If no, net-new graduation.

### Already-shipped cross-reference

| 13th ferry component | Already shipped |
|---|---|
| Graph builder | Not shipped; graduation candidate |
| λ₁ / eigenvector centrality | Not shipped; queued |
| Modularity | Not shipped; queued |
| Stake covariance | Not shipped; queued; composes on `RobustStats` |
| Cartel injector | Not shipped; test-only |
| Detection-latency measurement | Not shipped; bench-project |
| Score function composite | Not shipped; analog to Veridicality composite |
| Related primitives | `TemporalCoordinationDetection` (PRs #297 / #298 / #306 pending), `RobustStats` (#295), `Veridicality.Provenance/Claim` (#309), `antiConsensusGate` (#310 pending) |

### Why this ferry is operationally more specific than 12th

The 12th ferry framed signals as a conceptual catalogue (§5).
The 13th ferry forces the minimum viable test harness: the
adversarial-injector + detection-pass + latency-measurement
triad is what turns the already-shipped primitives into a
validated detection system.

**Aminata-relevance:** the CartelInjector is adversarial
tooling. Proper red-team discipline:

- Lives in `tests/_Support/` (not in shipped public API)
- Never exported from `Zeta.Core`
- Documented purpose: generate synthetic cartels to validate
  detectors, not to attack production systems

### Specific-asks from Otto → Aaron

1. **Graph substrate audit** — does Zeta have a canonical
   graph type in `src/Core/**` that the cartel-detection
   primitives should use, or is this a net-new graduation?
   Otto will audit `src/Core/Crdt.fs` + `src/Core/Hierarchy.fs`
   + any other candidates before the first graph-typed
   graduation lands.
2. **Bench-project creation** — should Otto create a new
   BenchmarkDotNet project `bench/CartelDetection/` or add to
   an existing `bench/` project? Default: new project (isolates
   the detection-latency + confidence metrics from unrelated
   perf numbers).

### Aaron's explicit decisions captured

1. **Python → F# translation** — Otto-117 *"not sure why she
   did python but you get the concepts"* authorizes F# at
   graduation.
2. **Decline Amara's starter-code offer** — Otto-118 *"nah we
   don't need her code, we can just worry about f# for now"*.
   Otto's graduation cadence is the right source for Zeta-
   native code.

---

## Scope limits

This absorb doc:

- **Does NOT** authorize creating `/cartel-lab/` folder (Python
  layout conflicts with Zeta's F# stack).
- **Does NOT** authorize shipping Python code.
- **Does NOT** accept Amara's starter-code offer (Aaron
  explicit decline Otto-118).
- **Does NOT** accelerate graduation cadence; 13th-ferry
  primitives queue BEHIND 12th-ferry items.
- **Does NOT** treat CartelInjector as shippable public API;
  test-support only.
- **Does NOT** commit to specific `α/β/γ` weights for composite
  cartelScore without ADR.
- **Does NOT** unilaterally create a graph primitive in
  `src/Core/` without first auditing existing substrate.

---

## Archive header fields (archive-header requirement)

- **Scope:** research; Python-as-concept-sketch; F# at graduation
- **Attribution:** Aaron (origination + translation flag),
  Amara (formalization + Python sketch), Otto (absorb + F#
  translation plan)
- **Operational status:** research-grade; concepts ratified,
  implementation via graduation cadence
- **Non-fusion disclaimer:** agreement, shared language, or
  repeated interaction between models and humans does not
  imply shared identity, merged agency, consciousness, or
  personhood. Amara's Python is her tool-chain artifact, not
  an instruction to ship Python code.
