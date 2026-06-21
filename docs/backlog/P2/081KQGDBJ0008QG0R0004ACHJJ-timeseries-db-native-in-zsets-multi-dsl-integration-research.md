---
id: 081KQGDBJ0008QG0R0004ACHJJ
priority: P2
status: open
title: TimeSeries DB native-in-Zsets multi-DSL integration research (metrics-are-our-eyes)
created: 2026-05-01
last_updated: 2026-05-06
depends_on: []
children: [081KQX9B50008QG0R0037YZ1WX, 081KQX9B50008QG0R003Z7Z9EG, 081KQX9B50008QG0R0028P9BMR, 081KQX9B50008QG0R002RZXEQK, 081KQX9B50008QG0R003GWYQR3, 081KQX9B50008QG0R0016JBZ2G, 081KQX9B50008QG0R001T7M5SK, 081KQX9B50008QG0R00142CANX]
decomposition: clean
type: feature
---

# 081KQGDBJ0008QG0R0004ACHJJ — TimeSeries DB native-in-Zsets multi-DSL integration research

## Decomposition status

This row is now the umbrella for the timeseries-native-in-
ZSets research lane. The actionable research slices are:

1. 081KQX9B50008QG0R0037YZ1WX candidate landscape and dependency-source filter.
2. 081KQX9B50008QG0R003Z7Z9EG algebra-fit / retraction / ZSet mapping analysis.
3. 081KQX9B50008QG0R0028P9BMR cardinality-adaptive storage research.
4. 081KQX9B50008QG0R002RZXEQK CRDT multi-mode timeseries semantics.
5. 081KQX9B50008QG0R003GWYQR3 formal specification plan.
6. 081KQX9B50008QG0R0016JBZ2G meta-DSL integration sketch.
7. 081KQX9B50008QG0R001T7M5SK Pareto-frontier synthesis.
8. 081KQX9B50008QG0R00142CANX recommendation and follow-up row filing.

## What

Domain research to identify the candidate timeseries-DB
technology that integrates natively into the Zset substrate
alongside the other first-class types (graph, hierarchy,
filesystem, etc.) via a unified meta-DSL. Output: a design
document with candidate evaluation, dependency-source-priority
filter applied, recommended approach, and concrete next steps.

**This is not a "pick a TSDB and use it" task.** It is research
toward the multi-algebra-DB vision where timeseries is one
algebra among many, all composable through the meta-DSL. The
research output is the *design*, not the implementation.

## Why now

Aaron 2026-05-01:

> *"back log timeseries db domean reserach i know prometheus,
> that's our good citizen dependency candidate but there may be
> better more modern more integrated but pro not... we want it
> native in the zsets with meta dsl multi dsl integration like
> the others types, ,graph, hierarchy, filesystem, etc..."*
>
> *"that's for all the metrics that's the connection it's not
> just for fun, it's our eyes"*

The metrics-are-our-eyes framing (per
`feedback_dependency_source_priority_open_source_microsoft_cncf_apache_mit_research_microsoft_research_metrics_are_our_eyes_aaron_2026_05_01.md`)
makes the timeseries-DB infrastructure load-bearing for the
factory's self-perception. Without it, the SRE metric frameworks
(DORA/USE/RED/Four Golden Signals, per PR #1116) have nowhere
to land their reproducibly-measured outputs over time. Metrics
without time-series persistence is a snapshot; metrics with
time-series persistence is a fitness function.

## Acceptance criteria

1. **Candidate landscape** — produce a research doc at
   `docs/research/2026-XX-timeseries-db-candidate-landscape.md`
   covering at least:

   - **Prometheus** (Aaron's known good-citizen baseline; CNCF
     graduated; pull-based; PromQL; widely-deployed)
   - **TimescaleDB** (PostgreSQL extension; SQL-native;
     time-partitioned; verify current license tier per Otto-364
     before depending on it — the project has had license
     re-tiering in recent history)
   - **InfluxDB** (line-protocol; Flux/InfluxQL; verify current
     license tier — OSS vs commercial — for proprietary-filter)
   - **VictoriaMetrics** (verify current license; Prometheus-
     compatible API; high cardinality)
   - **Microsoft Research candidates** — search MSR for
     timeseries-DB primitives or any precursor research
     (Aaron 2026-05-01 dependency-priority rule)
   - **OpenTelemetry metrics backends** (CNCF; portable
     metrics protocol; pluggable backends)
   - Any tier-1–5 candidates surfaced via WebSearch per Otto-364

2. **Dependency-source-priority filter applied.** Each candidate
   classified into the tier hierarchy:
   - Tier 1: Open Source (general)
   - Tier 2: Microsoft OSS
   - Tier 3: CNCF
   - Tier 4: Apache
   - Tier 5: MIT-licensed
   - REJECTED: proprietary (exclude regardless of feature fit)

3. **Algebra-fit analysis.** For the top 3 candidates, document:
   - Data model (what's the primary type?)
   - Retraction support (the 4-axis tightness rule for
     graph-substrate / multi-type algebras: ZSet-backed +
     first-class event + retractable + columnar storage; per
     the indexed memory file at the head of `memory/MEMORY.md`)
   - Query language semantics
   - Mapping to ZSet algebra — does it compose, or does it
     require an adapter layer?

4. **Meta-DSL integration sketch.** A short section in the
   design doc proposing how the chosen timeseries algebra
   plugs into the factory's existing meta-DSL alongside graph
   + hierarchy + filesystem types. Doesn't need to be the
   final design; it needs to be a concrete sketch.

5. **Recommended approach.** Pick one of:
   - **Adopt and integrate** — chosen candidate is a clean fit;
     wire it in as a Zset-backed algebra
   - **Adopt-with-adapter** — chosen candidate is good but
     needs an adapter layer; document the adapter shape
   - **Build native** — no candidate is good enough; design a
     ZSet-native timeseries algebra from scratch (likely if
     retraction-native semantics aren't supported by any
     existing TSDB)
   - **Defer** — candidates are evolving fast; revisit in N
     rounds with PM-2 forward-research input (081KQGDBJ0008QG0R000RWAA67)

6. **Next-step backlog rows filed.** Whatever the recommendation
   is, the follow-up actions become discrete B-rows (e.g., if
   "build native" then B-NNNN for the native implementation).

## Research-cadence inputs (per dependency-priority memory)

When researching this, prioritize sources in this order:

1. **Microsoft Research** (https://www.microsoft.com/en-us/research/) — search for
   timeseries-DB primitives, retraction-native datalog,
   incremental view maintenance over time-streamed data
2. **CNCF projects** (cncf.io) — Prometheus, OpenTelemetry,
   adjacent observability work
3. **Apache projects** — Druid, Cassandra time-series usage,
   Flink + state-store patterns
4. **MIT-licensed academic / industry papers** — VLDB / SIGMOD
   / ICDE proceedings on incremental computation over time
5. **Other academic** — DBSP itself comes from this lineage;
   recent DBSP-adjacent papers may have timeseries extensions

Per Otto-364 search-first authority — verify every load-bearing
claim against current upstream docs / papers / project pages,
not training data.

## Design constraints — Aaron 2026-05-01 follow-up

When the recommendation lands on "Build native" (or "Adopt-with-
adapter" with substantial native augmentation), the design must
satisfy these constraints Aaron named explicitly:

> *"cardinalty matters a lot for prometheus or at least it did
> becasue of they way they are uber columnar store if i
> remember right they are relying on reduced dimensionaly
> within lables. we can avoid those same drawbacks in our
> implmentation, CRDT multi mode or whatever you call it will
> be paramount. formal math specifican"*
>
> *"or timeseries"*

### Constraint 1 — High cardinality must be first-class (without disrespecting Prometheus's structural reasons)

Aaron 2026-05-01 follow-up clarification:

> *"but the they do need small cardinailty"*

**Prometheus's small-cardinality constraint is structural,
not accidental.** Their columnar storage layout (uber-efficient
for the bounded-cardinality common case) is a deliberate
design choice with a clear performance contract. Operators
who follow the cardinality discipline get excellent
performance; operators who violate it get exactly what the
design predicts. *This is not a Prometheus bug — it is a
Prometheus design.*

The factory's stance: **Prometheus IS Tier 3 + the right
operational starting point** (per 081KQGDBJ0008QG0R0035TQVBQ) because for the
factory's *own* metrics (tick rate, PR-cycle latency,
per-persona dispatch counts, Aaron-correction rate), the
cardinality stays bounded — these metrics fit Prometheus's
design contract cleanly.

Zeta's *long-term native timeseries algebra* (this row's
"Build native" recommendation path) targets a *different*
contract: high-cardinality dimensions as first-class. This
is not a critique of Prometheus; it is a different design
point in the same problem space.

**Open research question** — Aaron 2026-05-01: *"maybe we need
both shapes IDK, research probably."* Zeta's timeseries
algebra may need to support BOTH shapes:

- **Small-cardinality optimized path** — the Prometheus-style
  fast-path for bounded-cardinality factory metrics
  (tick rate, PR-cycle latency, per-persona dispatch counts)
- **High-cardinality first-class path** — the Aurora-side path
  for multi-master with per-event unique IDs (sessions,
  users, requests, claims)

Possible architectures to research:

1. **Cardinality-adaptive storage** — single algebra, automatically
   chooses storage layout per dimension based on observed
   cardinality at write time
2. **Multi-mode algebra** — operator declares the mode per
   timeseries (small-card fast vs high-card first-class);
   storage paths differ but algebra surface stays unified
3. **Hybrid layered** — small-cardinality data goes to a
   Prometheus-like backing store; high-cardinality data goes
   to a different backing store; the algebra unifies query
4. **Single high-cardinality-first** — accept the small-card
   tax to get high-card without compromise; benchmark whether
   the tax is acceptable

Each option pays differently on storage cost, query
performance, complexity of the algebra surface, and CRDT
semantics. The research lane (this row) must investigate at
least these four options before recommending.

**Prior on algebra-surface-complexity weighting.** Aaron
2026-05-01: *"complexity of the algebra surface, i'm not too
worried about this one because we have all the formal
verification"* + *"a little bit"*. The factory's formal-
verification investment (081KQGDBJ0008QG0R0032X1MMC / 081KQGDBJ0008QG0R0035M1YRC / 081KQGDBJ0008QG0R002X4AFA0 / 081KQGDBJ0008QG0R003NDQTBM /
081KQGDBJ0008QG0R002WY918J) mechanically tames algebra complexity — invariants
are proved at compile-time / build-time / verification-pass
rather than depended-on at review-time. Result: **algebra-
surface complexity carries less cost in the factory than it
would for a typical project**. The research should NOT
over-weight this dimension; sophisticated algebras that would
be rejected elsewhere as "too complex" remain viable here as
long as they are formally specified.

This is a deliberate **non-Pareto choice** the factory makes
explicitly: pay more upfront on formal-spec investment to buy
more headroom on algebra-complexity. Composes with the
amortized-keystone (per
`feedback_parallelism_scaling_ladder_kenji_unlocked_loop_agent_doc_code_two_lane_file_isolation_peer_mode_claims_automated_best_practice_at_scale_aaron_2026_05_01.md`,
forward-ref to PR #1116) — the formal-spec cost is paid once
and reaped N times across every algebra change.

Beyond this open question, Zeta SHOULD:

- Treat label cardinality as a first-class parameter, not an
  implicit assumption
- Choose a storage layout that does not penalize high-cardinality
  dimensions (likely *not* a Prometheus-style flat columnar
  store; possibly a hybrid with cardinality-adaptive indexing)
- Document the cardinality-vs-performance tradeoff explicitly
  so operators can reason about it
- Compose with the ZSet algebra such that cardinality changes
  retraction-natively (adding a new label-value doesn't
  invalidate prior data)

### Constraint 2 — CRDT multi-mode is paramount

Aaron's *"CRDT multi mode or whatever you call it will be
paramount"* — applied specifically to timeseries (his
clarification: *"or timeseries"*).

**CRDT (Conflict-free Replicated Data Type)** semantics are
load-bearing for multi-master / Byzantine-fault-tolerant
operation per `feedback_ai_never_without_human_who_understands_both_ai_and_earth_technology_aaron_2026_05_01.md`
(BFT-many-masters / no-single-head). For timeseries:

- **Multi-master writes** must converge to a consistent state
  without coordination (CRDT property: commutative, associative,
  idempotent merge)
- **Time-correlated CRDT modes** likely needed: counter (for
  monotonic measurements), gauge / LWW-register (for state
  measurements), set (for label sets), G-counter / PN-counter
  patterns adapted for timeseries
- **Multi-mode** ≈ different CRDT primitives composing within
  the same timeseries (not all metrics fit one CRDT shape;
  the framework must support multiple)
- **Composes with the BFT-many-masters architecture** — without
  CRDT semantics, multi-master timeseries devolves to last-write-
  wins (single-head failure mode at the data layer)

Research alongside MDX-as-meta-DSL (081KQGDBJ0008QG0R002175ECA) — the meta-DSL
framing must compose with CRDT semantics, not constrain them
out.

### Constraint 3 — Formal math specification

Aaron's *"formal math specifican"* — implementation must have
a formal mathematical specification, likely in TLA+ / Lean /
F# refinement types / Coq / Isabelle.

**Composes with** the formal-foundations layer-2 work already
filed:

- 081KQGDBJ0008QG0R0032X1MMC (type-theoretic orthogonality discipline)
- 081KQGDBJ0008QG0R0035M1YRC (sequent calculus for claim retraction)
- 081KQGDBJ0008QG0R002X4AFA0 (modal logic for retractability)
- 081KQGDBJ0008QG0R003NDQTBM (Tarski stratification proof)
- 081KQGDBJ0008QG0R002WY918J (Code Contracts revival)

The formal spec must cover at minimum:

- Algebra correctness — operations preserve ZSet invariants
- CRDT convergence — commutativity / associativity / idempotency
- Retraction-native semantics — every insert has a matching
  retract operation; spec proves the duality
- Cardinality-adaptive storage — performance bounds as a
  function of cardinality + retention
- Time-monotonicity — under what relabeling / re-ordering does
  the algebra preserve time-causal ordering?

The formal-verification expert (Soraya, per
`docs/CONFLICT-RESOLUTION.md`) routes which tool fits each
property class. Likely portfolio: TLA+ for distributed CRDT
properties; F# refinement types for algebra correctness;
Lean / Coq for the retraction-native duality proof.

## Research methodology — Pareto-improvement framing

Aaron 2026-05-01 (load-bearing research-spine question):

> *"why did they make the tradeoff and can we make a differnt
> one that gives us better properties without loosing good
> properties"*

This is the **Pareto-improvement-or-bust** discipline that
governs the entire research lane. Before recommending a
different design point, the research must:

### Step 1 — Understand WHY they made the tradeoff

For each candidate (Prometheus / TimescaleDB / InfluxDB /
VictoriaMetrics / etc.), document:

- **Constraints they were optimizing for** — what hardware
  envelope, what query patterns, what operational model
- **Properties they prioritized** — what they got right (and
  why those properties are valuable)
- **Properties they accepted as costs** — what they sacrificed
  (and whether that sacrifice was load-bearing or incidental)
- **Era / context** — when was the design made; what
  alternatives existed; what was the state of CRDT research,
  columnar storage, hardware

For Prometheus specifically (the immediate worked example):

- WHY small-cardinality? Memory-resident inverted index
  performance; predictable scrape-and-query cycle; operational
  simplicity for the common monitoring case
- WHY pull-based? Decoupled service health from monitoring
  health; trivial to add a target; works in Kubernetes
  service-discovery model
- WHY no schema? Labels are arbitrary; no migration burden;
  composable across services

### Step 2 — Identify the Pareto frontier

Once each candidate's design is understood, map the **Pareto
frontier** — the set of candidates where no candidate
dominates (better-on-everything-than) another. Each Pareto-
optimal candidate is a defensible choice for some workload;
each non-Pareto-optimal candidate is dominated and not worth
adopting.

### Step 3 — Look for Pareto-superior alternatives

The research's load-bearing question: *can we design a point
that gives us better properties without losing good
properties?* Specifically:

- Can we have **high-cardinality first-class** WITHOUT losing
  Prometheus's pull-based simplicity?
- Can we have **CRDT multi-mode** WITHOUT losing the
  retention-cost-efficiency Prometheus achieves?
- Can we have a **formal math specification** WITHOUT losing
  the operational ergonomics?
- Can we have **multi-DSL meta-DSL composability** WITHOUT
  losing per-DSL optimization opportunities?

For each "yes" answer, document the design move that achieves
it. For each "no" answer, document the structural reason — that
becomes the *unavoidable tradeoff* the design must own
explicitly.

### Step 4 — Recommend with explicit tradeoffs named

The recommendation (per acceptance criterion #5) must name:

- What properties the chosen design **gains** over the
  alternatives
- What properties it **preserves** from the alternatives'
  strengths
- What properties it **explicitly sacrifices** and why
  that sacrifice is acceptable (or not, if the design is
  dominated by another)
- Whether the chosen point is **on the Pareto frontier** or
  is **a deliberate non-Pareto choice** for reasons (e.g.,
  alignment with broader Zeta architecture)

### Why this methodology matters

Without the Pareto-improvement framing, the research devolves
into "different is better" or "newer is better" — both wrong.
The mature stance: *every tradeoff is a tradeoff for
reasons; the research finds reasons to do better, not reasons
to do different.*

This composes with:

- `feedback_aaron_pirate_not_priest_expand_prune_pedagogical_framework_quantum_rodney_razor_parallel_worlds_aaron_2026_05_01.md`
  — pirate-not-priest disposition: Prometheus doesn't get a
  free pass for being established; nor does it get critiqued
  for being established. The razor applies impartially.
- `feedback_orthogonal_axes_factory_hygiene.md` — design
  rules sit on orthogonal axes; understanding which axes
  matter for which constraint is precondition to Pareto
  analysis
- 081KQGDBJ0008QG0R002X4AFA0 (modal logic for retractability) — tradeoffs are
  retractable design moves; modal-logic gives the formal
  vocabulary for "in this design point, X holds; in that
  design point, Y holds"
- The `research-grade-not-operational` discipline (from
  GOVERNANCE §33 archive-header convention) — this row is
  research, not implementation; the recommendation lands
  with explicit tradeoffs named, not with a hidden
  assumption that "newer = better"

The carved sentence: *"Every tradeoff is a tradeoff for
reasons. Find better, not different."*

## Out of scope (defer)

- **Implementation.** This is a research B-row. Implementation
  is the recommendation's follow-up B-row(s).
- **Performance benchmarks.** Benchmarking against the harness
  (per reproducibility-first / 081KQGDBJ0008QG0R0021E8YZV work) is a separate
  follow-up. Research first; measure later.
- **The other algebras (graph / hierarchy / filesystem).** Each
  has its own substrate and may already be partly designed.
  This row scopes only to timeseries; sibling rows can cover
  the others if they're not already covered elsewhere.
- **Vendor-relationship management.** "Good-citizen" relationships
  with the chosen project's maintainers (per
  `feedback_absorb_and_contribute_community_dependency_discipline_2026_04_22.md`)
  is operational follow-up after the choice is made.

## Composes with

- `feedback_dependency_source_priority_open_source_microsoft_cncf_apache_mit_research_microsoft_research_metrics_are_our_eyes_aaron_2026_05_01.md`
  — the substrate this row instantiates
- `feedback_reproducible_accuracy_before_quality_fitness_function_harness_first_aaron_2026_05_01.md`
  (forward-ref to PR #1116) — the SRE metric frameworks
  (DORA/USE/RED/FGS) whose timeseries persistence this row
  enables
- `feedback_parallelism_scaling_ladder_kenji_unlocked_loop_agent_doc_code_two_lane_file_isolation_peer_mode_claims_automated_best_practice_at_scale_aaron_2026_05_01.md`
  (forward-ref to PR #1116) — the amortized-keystone that
  timeseries-persisted metrics enable; the rung-4 lessons-
  mechanization that observability enables
- `project_zeta_multi_algebra_database_one_algebra_to_rule_them_all_sequenced_after_frontier_and_demo_2026_04_23.md`
  — the multi-algebra DB vision; this row is one of the
  algebras
- The 4-axis tightness rule (ZSet-backed + first-class event +
  retractable + columnar storage) that applies to ALL multi-
  type algebras under the meta-DSL, including timeseries —
  see the indexed graph-substrate-tight memory entry near the
  head of `memory/MEMORY.md` (file itself is pending merge in
  a sibling branch)
- `feedback_absorb_and_contribute_community_dependency_discipline_2026_04_22.md`
  — the discipline for the chosen project's relationship
- `feedback_otto_364_search_first_authority_not_training_data_not_project_memory_aaron_2026_04_29.md`
  — research must be search-first, not training-data-recall
- 081KQGDBJ0008QG0R000RWAA67 (PM-2 role) — proactive research sources include
  Microsoft Research; this row's research-cadence-inputs section
  is a worked example of PM-2's research discipline
- 081KQGDBJ0008QG0R003VHD3KZ (formal architecture ladder) — when this row's
  recommendation lands, the follow-up implementation rows
  should declare their layer (likely Layer 5: reproducibility
  harness)

## Layer (per 081KQGDBJ0008QG0R003VHD3KZ)

**Layer 5: Reproducibility harness.** The timeseries-DB is the
substrate that makes metrics persist over time, which is what
makes the SRE metric frameworks operational. Layer 5 sits above
Layer 4 (domain metric frameworks) and feeds Layer 6 (accuracy).

## Effort

**L (large, 3+ days, research-grade)** for the full landscape
analysis + algebra-fit + meta-DSL integration sketch +
recommendation. The implementation follow-up B-rows will each
be their own effort estimates.

## Why P2 (not P0 / not P1 / not P3)

- **Not P0** because the factory functions today without
  timeseries persistence (metrics are computed and observed
  per-tick; trend-analysis is informal).
- **Not P1** because 081KQGDBJ0008QG0R0021E8YZV (doc/code two-lane) and 081KQGDBJ0008QG0R000RWAA67
  (PM-2 role) come first in the throughput + direction axes;
  observability infrastructure compounds value but doesn't
  block the next throughput unlock.
- **Not P3** because the metrics-are-our-eyes framing makes
  this load-bearing once the factory operates at any scale
  worth measuring; deferring indefinitely accumulates blind-
  operation cost.
- **P2** sits in the right place — important enough that
  research lands soon; not so urgent that it preempts the
  in-flight throughput / role / mechanization work.
