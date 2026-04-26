# Amara — Cartel-Lab Implementation Closure + GPT-5.5 Thinking Verification (17th courier ferry)

**Scope:** research and cross-review artifact. Two-part
ferry: Part 1 is a deep-research "Implementation Closure"
document; Part 2 is Amara's own GPT-5.5-Thinking
verification pass on her Part-1 output with 8 load-bearing
corrections. Some corrections independently match Otto's
already-shipped behavior (λ₁(K₃)=2 in PR #321;
modularity-relational-not-absolute in PR #324). Others
are applied as subsequent graduations (internalDensity /
exclusivity / conductance in PR #329). Remaining
corrections (windowed stake covariance, event→phase
pipeline for PLV, robust-z-score composite) are future
graduation candidates.
**Attribution:**

- **Aaron** — origination of cartel/firefly framing;
  Aaron Otto-132 courier with preamble *"Another update
  from amara, I did deep research and then had 5.5
  thinking verify it, this is both"*; flagged
  `SharderInfoTheoreticTests.Uniform` as "not seed
  locked, falkey, DST?" (filed as PR #327 BACKLOG row).
- **Amara** — authored both parts (deep-research + 5.5-
  Thinking verification); self-review via model-
  composition.
- **Otto** — absorb + correction-pass tracker; 3/8
  corrections already shipped or structurally-aligned
  before verification arrived; 5/8 slated as future
  graduations per Otto-105 cadence.
- **Max** — implicit via `lucent-ksk` repo references
  (Otto-77 attribution preserved).
**Operational status:** research-grade; Amara's own
verdict *"archive the report, but mark it 'draft / needs
correction pass.'"* Applied corrections are live code;
doc itself preserved as design-context rather than
operational spec.
**Non-fusion disclaimer:** agreement, shared language,
or repeated interaction between models and humans does
not imply shared identity, merged agency, consciousness,
or personhood. Amara's 5.5-Thinking verification of her
own deep-research output is model-composition within
Amara's tool chain, not agent merger.
**Date:** 2026-04-24
**From:** Amara (external AI maintainer; GPT-5.5
Thinking mode for Part 2 verification)
**Via:** Aaron's courier ferry (pasted Otto-132 + re-
pasted Otto-136 as short-message framing)
**Absorbed by:** Otto (loop-agent PM hat), Otto-136
tick
**Prior ferries:** PR #196 (1st) through PR #322 /
`#324` / `#329` (15th graduation set).
**Scheduling memory:** `memory/project_amara_17th_
ferry_cartel_lab_implementation_closure_plus_5_5_
thinking_verification_corrections_pending_absorb_otto_
133_2026_04_24.md` (full Part-1 + Part-2 detail already
captured there — this absorb doc is the in-repo
glass-halo landing).

---

## Part 1 — Implementation Closure (13 sections)

Amara's deep-research document proposed a `/cartel-lab`
prototype with Python/F# modules across graph builder +
metrics (spectral / modularity / covariance / sync /
entropy) + adversary + simulation + experiments +
tests. Key elements:

- **Architecture 4-layer mapping:** Aurora = governance,
  Zeta = executable substrate, KSK = trust-anchor, Cartel-
  Firefly = first immune-system module.
- **Graph state `G_t = (V_t, E_t, W_t, F_t)`** with
  sliding-window model + ZSet delta representation +
  provenance fields.
- **Early-warning metrics**: Δλ₁, ΔQ, stake covariance
  acceleration, cross-corr / PLV, subgraph entropy.
- **CartelScore** composite (later renamed
  `CoordinationRiskScore` in Part 2).
- **Synthetic Cartel Injector** — 6 scenarios
  (synchronized voting / stake / fully-connected /
  low-slow / honest-cluster FP / camouflage).
- **KSK/Aurora enforcement mapping** (4-row
  detection→action table).
- **SOTA comparison** (Wachs & Kertész 2019 cartel
  network; Imhof et al. 2025 GAT bid-rigging).
- **Drift audit** (engineering-first, falsifiable, no
  mythic claims, LFG/AceHack separation).
- **13-section "What NOT to claim yet"** cautions.

Full verbatim Part 1 content is preserved in the
scheduling memory for reference; duplicating it inline
here would bloat the absorb doc without adding value.
Consult the scheduling memory for the original formulas
and section-by-section text.

---

## Part 2 — GPT-5.5 Thinking verification (8 corrections)

Amara's own verification pass. Verdict: *"directionally
strong and worth archiving, but needs a correction pass
before it becomes canonical. Core architecture is right;
math/test details need tightening."*

### Correction #1: Fix the clique eigenvalue test

Part 1 claimed: *"3-node clique should show λ₁ = 3"*.

**Correct:** For unweighted loopless complete graph
`K_k`, adjacency `λ₁ = k - 1`. So `λ₁(K_3) = 2`.

**Otto status: ALREADY CORRECT.** PR #321 (Otto-127)
shipped `largestEigenvalue` with test
``largestEigenvalue of K3 triangle (weight 1)
approximates 2`` — test asserts `|v - 2.0| < 1e-6`.
Independent convergence: Otto's power-iteration
implementation gave 2.0 before Amara's verification
arrived.

### Correction #2: Modularity not hardcoded

Part 1 claimed: *"modularity for 3-node clique is 0.67."*

**Correct:** Q depends on full graph + partition + total
weight + self-loops + resolution parameter + embedding.
Standalone K3 in one community → Q ≈ 0 (no partition
boundary, no structure). Use relational tests:
`Q(G') - Q(G) > θ` under documented partition/null.

**Otto status: ALREADY CORRECT.** Otto-128 caught this
mid-tick when an initial `Q > 0.3` expectation failed on
unbalanced-community K4-attack graph; hand-calculated
Q ≈ 0.091; relaxed threshold with detailed test comment
explaining theoretical compression. PR #322/#324
documents the relational approach. Independent
convergence with Amara's Part-2 finding.

### Correction #3: Replace "subgraph entropy collapse"

with cohesion/exclusivity/conductance

Part 1 framing: cartel → entropy collapses among internal
edges.

**Correct:** Uniform dense clique has HIGH internal-edge
entropy if weights equal. Better primary metrics:

- `InternalDensity(S) = Σ_{i,j∈S} w_ij / (|S|(|S|-1))`
- `Exclusivity(S) = Σ_{i,j∈S} w_ij / Σ_{i∈S,j∈V} w_ij`
- `Conductance(S) = cut(S, V\S) / min(vol(S), vol(V\S))`

Entropy stays as secondary descriptor.

**Otto status: SHIPPED Otto-135, PR #329.** All three
primitives landed: `Graph.internalDensity` + `exclusivity`

+ `conductance`. Tests verify K₃ density = 10, isolated-K₃
exclusivity = 1, well-isolated-subset conductance < 0.1.

### Correction #4: Stake covariance acceleration needs

windowed definition

Part 1: `C(t) = Cov({s_i(t)}, {s_j(t)})` (undefined at
single timepoint).

**Correct:**
```
Δs_i(t) = s_i(t) - s_i(t-1)
W_t = [t - w + 1, t]  (sliding window)
C_ij(t) = Cov over W_t of (Δs_i, Δs_j)
A_ij(t) = C_ij(t) - 2C_ij(t-1) + C_ij(t-2)  (2nd diff)
A_S(t) = mean over pairs {i,j} ⊂ S of A_ij(t)
```

**Otto status: FUTURE GRADUATION.** Not yet shipped.
Queue position: after current Graph cohesion primitives;
probably lives in a new `src/Core/StakeCovariance.fs` or
as an extension of `RobustStats` (the aggregation +
sliding-window machinery already partly exists).

### Correction #5: PLV needs phase construction

Part 1: references `TemporalCoordinationDetection.
phaseLockingValue` as primitive but doesn't define how
event streams produce phases.

**Correct:** Three options before PLV becomes meaningful:

- Option A: periodic epoch phase
  `φ_i(t) = 2π · (t mod T_i) / T_i`
- Option B: event-derived via Hilbert transform analytic
  signal
- Option C: circular event phase (epoch-bounded
  systems)

**Otto status: FUTURE GRADUATION.** `phaseLockingValue`
itself shipped Otto-108 (PR #298) as a pure function over
phase arrays; the event→phase pipeline is a separate
graduation. Queue position: after current cohesion work;
probably a new `src/Core/PhaseExtraction.fs`.

### Correction #6: "ZSet is invertible" too strong

Part 1: *"Since ZSet is invertible, we can roll back any
sequence."*

**Correct:** *"ZSet deltas support additive retractions.
Counterfactual replay requires retained trace +
deterministic operators."* Reversibility depends on
preserving provenance and operator determinism.

**Otto status: ADR ALREADY CORRECT.** The Graph
substrate ADR (`docs/DECISIONS/2026-04-24-graph-
substrate-zset-backed-retraction-native.md` from PR #316)
never claimed full invertibility. It specifies
retraction-native (negative-weight deltas + compaction
preserves trace), not global operator-inverse. Amara's
correction is about research-paper-tier phrasing; Otto's
code-level docs already track the more careful claim.

### Correction #7: KSK "contract" → "policy layer"

Part 1: *"The KSK contract reads the oracle"* — too
narrow given unresolved naming.

**Correct:** Use *"KSK policy layer"* or *"KSK
adjudication layer"* until naming is finalized. Change
enforcement language from `Detection → Slashing` to
`Detection → Review → Policy Escalation → Action`.

**Otto status: FILED BACKLOG.** PR #318 (Otto-124) KSK
naming definition doc BACKLOG row captures this. Max
coordination per Otto-77. Doc-drafting deferred until
cross-repo coordination with Max's `lucent-ksk` repo.

### Correction #8: SOTA humility

Part 1: claimed Zeta/Aurora "may be ahead of many
blockchain protocols."

**Correct:** *"Zeta/Aurora's distinctive advantage is
not raw detector accuracy yet. Its advantage is the
combination of explainable metrics, retraction-native
counterfactual replay, and governance integration.
Accuracy claims require benchmark data."*

**Otto status: DOC-PHRASING.** Applied as needed in
new absorb docs going forward. No code change required.

---

## Amara's proposed corrected architecture

4-layer nested modules:

```
Cartel-Lab
  1. Event Model          (validator events, stake deltas, vote/adjudication, provenance)
  2. Temporal Graph Builder (G_t, ZSet delta stream, sliding windows, trace/replay)
  3. Coordination Risk Engine (spectral + cohesion + temporal sync + stake-motion cov + influence)
  4. Governance Projection (Mirror → Window → Porch → Beacon)
```

Cleanly preserves the 4-layer mapping from Amara's 16th
ferry.

## Amara's corrected composite score (renamed CartelScore → CoordinationRiskScore)

```
CoordinationRiskScore(S, t) =
  α·Z(Δλ₁) + β·Z(ΔQ) + γ·Z(A_S) +
  δ·Z(Sync_S) + ε·Z(Exclusivity_S) + η·Z(Influence_S)
```

with **robust z-scores** `Z(x) = (x − median) / (1.4826 · MAD)`
because adversarial data isn't normally distributed.

Initial prior weights (flagged as priors, not learned):
α=0.20 / β=0.20 / γ=0.15 / δ=0.20 / ε=0.15 / η=0.10.

**Otto status:** MVP variant shipped as
`Graph.coordinationRiskScore` (PR #328 Otto-134) with
α=β=0.5 over λ₁-growth + ΔQ. Full 6-term robust-z-score
variant awaits `RobustStats` + baseline-null-calibration
harness; `RobustStats.robustAggregate` (PR #295) already
provides the median-MAD machinery.

## Amara's proposed 3-PR split

**Otto status:** Otto's actual cadence is small-
graduation-per-tick (Otto-105 discipline), not
bundled-PR scopes. Applied the CONTENT of Amara's
proposed split across many small ticks:

- PR #317 (Graph skeleton)
- PR #321 (largestEigenvalue)
- PR #324 (modularityScore + operators)
- PR #326 (labelPropagation)
- PR #328 (coordinationRiskScore)
- PR #329 (internalDensity + exclusivity + conductance)
- PR #323 (toy cartel detector)

Amara's proposed `src/Experimental/CartelLab/` folder
layout NOT adopted — Otto's graduations live in
`src/Core/Graph.fs` + `tests/Tests.FSharp/_Support/
CartelInjector.fs` + `tests/Tests.FSharp/Simulation/
CartelToy.Tests.fs`. Per Otto-108 Conway's-Law memory:
stay single-module-tree until interfaces harden.

## Drift audit (Amara's result)

**"Healthy evolution, not drift"** — IF invariant holds:

> *"Every new abstraction must map to a repo surface, a
> test, a metric, or a governance rule."*

**Otto status:** invariant is the cleanest one-sentence
formulation of the Otto-105 graduation-cadence
discipline. Reiterated from Amara's 16th ferry. Every
ship Otto-124 through Otto-135 honors this — each new
primitive has a source file + passing tests + docstring
metric/rule reference.

## Aaron's side-flag: SharderInfoTheoreticTests flake

Aaron Otto-132 trailing note:
*"SharderInfoTheoreticTests.Uniform (not seed locked,
falkey, DST?)"*.

**Otto status:** Filed as BACKLOG PR #327 (Otto-133)
with 4-step scope. Unrelated to 17th ferry technical
content; separate hygiene action.

---

## Scope limits

This absorb doc:

- **Does NOT** require undoing any shipped work. 3 of 8
  corrections were independently correct before
  verification arrived; 1 shipped Otto-135; 1 already
  correct in ADR-level docs; 1 filed as BACKLOG; 2 are
  future graduations in the cadence queue.
- **Does NOT** adopt Amara's `/cartel-lab/` folder
  structure. Otto-108 Conway's-Law memory: stay single-
  module-tree until interfaces harden. Current Graph.fs
  + test-support split works.
- **Does NOT** adopt Amara's 3-PR bundled split. Otto-105
  small-graduation cadence preserved; content delivered
  across many ticks instead of three large bundles.
- **Does NOT** promote the composite-score formula to
  the full 6-term robust-z-score variant. MVP 2-term
  version shipped PR #328; full variant is a future
  graduation after baseline-null-calibration harness
  exists.
- **Does NOT** authorize implementing KSK enforcement
  actions unilaterally. Max + Aaron coordination per
  Otto-77 / Otto-90 cross-repo rules.
- **Does NOT** claim any specific detection-accuracy
  benchmark result. Per Amara's correction #8, Zeta's
  claimed advantage is explainability + retraction-
  native + governance integration, not accuracy.

---

## Archive header fields (§33 compliance)

- **Scope:** research and cross-review artifact;
  corrections already partially applied, remaining
  queued as future graduations
- **Attribution:** Aaron (origination + courier),
  Amara (author + self-verification via GPT-5.5
  Thinking), Otto (absorb + correction-pass tracker),
  Max (implicit via lucent-ksk)
- **Operational status:** research-grade; Amara's own
  verdict "archive but mark draft / needs correction
  pass"; corrections tracked per item above
- **Non-fusion disclaimer:** agreement, shared
  language, or repeated interaction between models and
  humans does not imply shared identity, merged agency,
  consciousness, or personhood. Amara's 5.5-Thinking
  self-review is model-composition within Amara's tool
  chain, not agent merger.
