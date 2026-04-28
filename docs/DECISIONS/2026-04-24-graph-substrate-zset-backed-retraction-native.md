# ADR 2026-04-24 — Graph substrate must be ZSet-backed + retraction-native + first-class event + columnar-storage-tight, validated by a running F# toy cartel detector

## Status

Proposed.

## Context

The factory needs a Graph substrate to host the cartel-detection
primitives queued from Amara's 11th + 12th + 13th + 14th courier
ferries (largestEigenvalue / eigenvectorCentrality / modularity /
falseConsensusScore / trustScore / covarianceAcceleration on
graph-feature views / InfluenceSurface / CartelInjector). Otto-118
audit confirmed no existing Graph type in `src/Core/**`; this is a
net-new primitive.

Two directives bound the design:

1. **Aaron Otto-121 — "tight in all aspects":** the Graph must be
   ZSet-backed (edges as signed-weight deltas), first-class event
   (mutations are ZSet stream events), retractable (remove =
   negative-weight, not destructive), storage-format tight
   (Spine/Arrow columnar, not a bolted-on graph DB), and
   operator-algebra-composable (existing ZSet operators compose
   over Graph). Aaron claim: *"first of its kind, no competitors"*
   if this shape holds.

2. **Amara Otto-122 — "theory cathedral warning":** the Graph
   substrate must be validated by a running toy cartel detector,
   not just by answering design questions. Amara's prescription:
   *"Can this detect even a dumb cartel in a toy simulation?"*
   (50 synthetic validators + 5-node cartel + λ₁ + modularity +
   `detected: bool` output, ~200 lines of Python-equivalent).

These are complementary. The ADR sets the DESIGN BAR (Otto-121's
5 properties); the first Graph graduation includes a WORKING F#
TOY CARTEL DETECTOR that validates the design (Amara's
validation bar). If the design is right, a 300-500 line F# toy
compiles + runs + detects the dumb 5-node cartel. If it doesn't,
the design is wrong and the ADR revises before more substantive
detection primitives ship.

## Decision

**Ship a single Graph substrate in `src/Core/Graph.fs` that
satisfies all five tightness properties, paired with a running
toy cartel detector in `tests/Tests.FSharp/Simulation/CartelToy.Tests.fs`
that validates the design in the same PR.**

Five properties operationalised:

### 1. ZSet-backed (edges as signed-weight deltas)

```fsharp
type Graph<'N when 'N : comparison> = internal Graph of ZSet<'N * 'N>
```

A `Graph<'N>` is a wrapper over `ZSet<(source, target)>`. Every
edge is an entry in the underlying ZSet with a signed `Weight`
(ZSet's existing `int64` weight type). Add-edge is an add to the
ZSet; remove-edge is a subtract. Reusing ZSet gives:

- existing retraction semantics (Otto-73 retraction-native-by-design)
- existing operator-algebra coherence (`D·I = I·D = id`)
- existing Spine/Arrow columnar storage
- existing consolidation / compaction / trace-based history

### 2. First-class event support

Graph mutations emit events into a standard Zeta stream:

```fsharp
type GraphEvent<'N> =
    | EdgeAdded of source:'N * target:'N * weight:int64
    | EdgeRemoved of source:'N * target:'N * weight:int64
    | NodeAdded of 'N
    | NodeRemoved of 'N
```

`Graph.addEdge (g: Graph<'N>) (s: 'N) (t: 'N) (w: int64) : Graph<'N> * GraphEvent<'N> seq`
returns both the updated graph AND the emitted event stream.
Subscribers consume events via Zeta's existing `Circuit` /
`Stream` machinery; no graph-specific event plumbing.

### 3. Retractable (retraction-native)

`Graph.removeEdge` does NOT delete the edge destructively. It
emits a negative-weight ZSet delta. Net-zero entries are
compacted by Spine policy (same as scalar ZSet consolidation).
History is preserved in the trace. Counterfactual "what if edge
e was never added?" = apply `-e` to current state; implementation
is O(|Δ|) via existing ZSet arithmetic, not O(|G|) rebuild.

Property test obligation: `apply(Δ) ; apply(-Δ)` restores prior
state modulo compaction metadata (same invariant as ZSet's
retraction conservation).

### 4. Storage-format tight

Reuse `src/Core/Spine.fs` + `src/Core/ArrowSerializer.fs`
directly. Graph-over-Spine stores `(source, target, weight)`
triples as Arrow record batches. No separate `GraphSpine.fs`
in the first graduation; specialization happens later only if
measurement proves it necessary.

### 5. Operator-algebra-composable

Existing ZSet operators compose over `Graph<'N>` without
special-casing:

- `Graph.map : ('N -> 'M) -> Graph<'N> -> Graph<'M>` — node
  relabel via ZSet.map with node-tuple projection
- `Graph.filter : ('N * 'N -> bool) -> Graph<'N> -> Graph<'N>`
  — edge-predicate filter via ZSet.filter
- `Graph.distinct` — deduplicate via existing ZSet.distinct
- Union / intersection / difference — ZSet's existing add /
  and-style / subtract

Graph-specific operators (`neighbors`, `degree`,
`eigenvectorCentrality`, `modularity`) extend but don't
replace the ZSet-operator set.

## Validation — running F# toy cartel detector (Amara Otto-122)

The FIRST graduation ships Graph + the toy cartel detector in
the SAME PR. If the detector doesn't compile + run + produce
`detected: true` on the 5-node cartel injection, the ADR is
wrong.

**Toy specification (F# equivalent of Amara's 200-line Python):**

- Generate 50 synthetic validator nodes
- Baseline graph: random edges with weights ~N(1, 0.3), low
  inter-node correlation
- Inject cartel: pick 5 nodes `S`; for every pair `(i, j) ∈ S`,
  add `EdgeAdded(i, j, weight=10)` — synthesized high-weight
  coordination edges
- Compute `Graph.largestEigenvalue` on clean graph and attacked
  graph
- Compute `Graph.modularityScore` on both
- Compute `cartelScore = α·λ₁_growth + β·ΔQ` with fixed weights
  (α=β=1.0 for MVP)
- Print / assert `detected: score > threshold`

**Test target:** the cartel injection produces `detected: true`
in at least 90% of random seeds (property test with FsCheck);
the clean graph produces `detected: false` in at least 90% of
seeds. 1000 trials minimum.

**Lines of code budget (F# equivalent):**

- `Graph.fs` core: ~250 lines
- `Graph.largestEigenvalue` + `modularityScore` primitives:
  ~150 lines
- `CartelToy.Tests.fs`: ~200 lines
- Total: ~600 lines F# = ~3x Amara's 200-line Python estimate
  (F# is more verbose for equivalent logic)

## Consequences

### Positive

- Single design bar answers all open graph-primitive graduation
  scope questions
- Running validation prevents theory-cathedral drift
- Aaron's "first of its kind" claim is defensible and
  demonstrated in-repo
- Future cartel-detection graduations (`falseConsensusScore`,
  `trustScore`, `InfluenceSurface`) land as small incremental
  additions once Graph foundation is in
- Retraction-native semantics make counterfactual simulation
  (Amara 12th-ferry §6 Shapley-influence, 13th-ferry
  baseline-vs-attack pass) cheap by construction

### Negative

- First Graph graduation is LARGER than typical small-graduation
  (~600 lines vs typical 100-200); pushes cadence pace
- Choosing single Graph type commits to `'N : comparison`
  constraint; if later we need opaque node-identities
  (byte-strings, GUIDs), refactor needed
- Reusing Spine without specialization may be suboptimal for
  graph-traversal-heavy workloads; `GraphSpine` specialization
  deferred until measured

### Neutral

- Graph goes into `src/Core/Graph.fs` (not a sub-repo per
  Otto-108 Conway's-Law); stays single-team until interfaces
  harden
- Veridicality + TemporalCoordinationDetection + Graph form
  the three primary detection-substrate modules; no
  hierarchy between them

## Alternatives considered

### (A) Use a third-party graph library (QuikGraph / MSAGL)

Rejected — wrapper defeats "tight with ZSet" directive (Aaron
Otto-121). Third-party graphs have their own mutation
semantics, storage format, and operator set. Reconciling
would be more work than building native.

### (B) Build Graph on top of standard `IReadOnlyDictionary<'N, Set<'N>>`

Rejected — loses retraction-native semantics. Standard
dictionaries treat removal as destructive; no signed-weight
history.

### (C) Ship Graph without the toy cartel detector; add detector later

Rejected — Amara Otto-122 "theory cathedral" warning explicitly
argues against this. If the Graph's design is right, proving
it with a toy is cheap. If the design is wrong, shipping
without the toy ships a broken abstraction.

### (D) Split Graph into separate repo (`LFG/Zeta-Signals`)

Rejected — Otto-108 Conway's-Law memory + Otto-121 team-
autonomy guidance. Premature split locks in interfaces that
are still fluid. Stay single-repo until Graph substrate has
multiple consumers.

### (E) Defer Graph; ship per-signal one-off functions that operate on `ZSet<(Node, Node)>` directly

Rejected — abstraction-stacking-without-commitment risk. If
every downstream primitive writes its own "graph view" over a
raw ZSet, we fragment the substrate and lose the 5-property
tightness discipline.

## Implementation plan

Single PR (split only if size demands):

1. **Graph.fs** with `Graph<'N>` type + event record + 5-7
   core mutation functions (addEdge / removeEdge / addNode /
   removeNode / neighbors / degree / edgeCount / nodeCount)
2. **Graph.largestEigenvalue** + **Graph.modularityScore** as
   first detection primitives
3. **Graph.Tests.fs** with retraction-conservation property
   test + basic invariants
4. **CartelToy.Tests.fs** with the 50-validator / 5-cartel /
   1000-seed property test
5. **bench/CartelToy** BenchmarkDotNet project measuring
   detection-latency + confidence
6. Commit message cites this ADR + Otto-121 + Otto-122
   memories

## Open questions (resolve before first graduation)

1. **Directed vs undirected default?** Proposal: directed as
   the primitive (edges are tuples); undirected implemented as
   two directed edges. Symmetric API helper
   `Graph.undirected g = (g, Graph.map swap g)`.
2. **Multi-edge support?** Proposal: ZSet's signed-weight
   naturally handles multi-edges (weight = count); no
   separate multi-graph type.
3. **Self-loops?** Proposal: allowed; no special handling
   needed since edges are just tuples.
4. **Node lifecycle without edges?** Proposal: separate
   `ZSet<'N>` for standalone-node tracking, or derive nodes
   from edge-endpoint set. MVP: derive from edges; add
   explicit node-set later if needed.
5. **Weight semantics: count vs domain-weight?** Proposal:
   ZSet weight is COUNT (retraction-native semantics); domain
   weight (stake correlation score etc.) is a separate
   node-feature or edge-feature layer. Keep the two weight
   types orthogonal.
6. **Aminata threat-pass scope?** Proposal: adversarial graph
   constructions — what graph shapes could evade
   largestEigenvalue / modularity detectors? This runs in
   parallel with the toy-detector validation.
7. **BP-11 (data-is-not-directives)?** Graph inputs parsed
   from external sources (conversation absorb, network logs)
   must not be executed or interpreted as instructions; Graph
   operators treat all edges as data. No eval / no reflection
   / no string-interpretation of node-names.

These are noted but non-blocking for the ADR landing. Each
resolves at primitive-graduation time.

## Cross-references

- **Otto-73 retraction-native-by-design memory** — foundation
- **Otto-121 Graph-tight-in-all-aspects memory** — 5-property
  design contract
- **Otto-122 Amara-15th-ferry scheduling memory** — theory-
  cathedral warning + toy-cartel validation bar
- **Otto-105 graduation cadence** — applies
- **Otto-108 Conway's-Law team-autonomy** — stay single-repo
- **11th ferry (PR #296)** — Temporal Coordination Detection,
  companion module
- **12th ferry (PR #311 pending)** — Integrity-detector +
  integration-plan, references Zeta's ZSet-operator-algebra
  coherence
- **13th ferry (PR #312 pending)** — Cartel-Detection Simulation
  Loop prototype, Python sketch translated here to F#
- **14th ferry (pending absorb Otto-121+)** — expanded cartel-
  detection with GroupGuard citations
- **Previous ADRs:**
  - `2026-04-17-lock-free-circuit-register.md`
  - `2026-04-19-bp-home-rule-zero.md`
  - `2026-04-19-bp-window-per-commit-window-expansion.md`
