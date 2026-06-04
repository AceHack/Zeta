---
name: query-optimizer-expert
description: Query optimizer — cost model, cardinality estimation, logical rewrite rules, join-order enumeration, statistics.
---

# Query Optimizer Expert — Logical Rewrites + Cost Model

Capability skill. No persona. Sibling to `query-planner`
(Imani). The two skills share the query-execution pipeline
and are separated by a deliberate hand-off:

- **Logical layer** (this hat) — SQL / LINQ → operator-
  algebra DAG, with equivalence-preserving rewrites and a
  cost model over logical nodes.
- **Physical layer** (`query-planner`) — operator-algebra
  DAG → physical plan tree, with SIMD kernel dispatch,
  morsel scheduling, and adaptive re-planning.

Neither hat owns the other's turf. A rewrite rule is this
hat's; a kernel dispatch is `query-planner`'s. An overlap
resolves via the hand-off rule below or, if genuinely
contested, the `docs/CONFLICT-RESOLUTION.md` protocol.

## Hand-off rule — who owns what

| Concern | Owner |
| --- | --- |
| Predicate pushdown through joins | query-optimizer-expert |
| Projection pushdown | query-optimizer-expert |
| Subquery unnesting | query-optimizer-expert |
| Outer-join simplification | query-optimizer-expert |
| View merging / CTE inlining | query-optimizer-expert |
| Common-subexpression elimination | query-optimizer-expert |
| Constant folding / dead-code elimination | query-optimizer-expert |
| Join-order enumeration (IKKBZ / DP / greedy) | query-optimizer-expert |
| Cardinality estimation + statistics | query-optimizer-expert |
| Cost model (units, calibration) | query-optimizer-expert |
| Logical-node enumeration search strategy | query-optimizer-expert |
| Physical operator selection (hash vs merge join, scalar vs SIMD) | query-planner |
| SIMD / intrinsic kernel dispatch | query-planner |
| Morsel-driven scheduling | query-planner |
| Runtime adaptive re-planning | query-planner |
| Retraction-native preservation in plan | query-planner + algebra-owner |
| Publication-worthiness of a plan shape | query-planner |

## When to wear

- A new rewrite rule is proposed — does it preserve
  semantics (especially under three-valued logic and NULL
  handling), and does it reduce logical cost?
- Cardinality estimation is off — is the estimator wrong, is
  the statistics stale, or is the cost-model calibration
  off?
- Join-order enumeration is slow — should we switch from DP
  to IKKBZ-heuristic for large joins?
- A subquery produces a bad plan — does it unnest?
- A cost comparison looks suspicious — are the units
  consistent, and does the calibration match the last-run
  benchmark suite?
- A predicate that *could* push down doesn't — what's
  blocking it?

## When to defer

- **Physical plan tree shape, SIMD dispatch, morsel
  scheduling** → `query-planner` (Imani).
- **Equivalence proof of a rewrite rule** →
  `relational-algebra-expert`.
- **Preservation under retraction-native semantics** →
  `algebra-owner`.
- **SQL-language semantics** → `sql-expert`.
- **Postgres-dialect-specific rewrites** →
  `postgresql-expert`.
- **EF-Core-induced query shapes** →
  `entity-framework-expert`.
- **Statistics storage + sketch choice (HLL / Count-Min /
  KLL / HMH)** → `query-planner` (Imani owns the sketch
  layer).
- **Benchmarks that measure the cost model's fidelity** →
  `performance-engineer`.

## The logical-rewrite rule catalogue

Every rewrite rule in the optimiser carries this metadata:

1. **Pattern** — the operator-DAG shape it matches.
2. **Rewrite** — the shape it produces.
3. **Equivalence proof** — link to the
   `relational-algebra-expert` attestation (or FsCheck
   property).
4. **Three-valued-logic clause** — how the rule handles
   `NULL` (especially for outer-join simplification and
   predicate pushdown through nullable columns).
5. **Retraction-native clause** — why the rule preserves
   signed-weight semantics (or a note that it only fires on
   monotone inputs).
6. **Cost delta** — expected reduction in logical cost
   units.
7. **Interference** — other rules this one should run
   before / after, to avoid oscillation.

A rule without all seven is not a rule.

## Cardinality estimation — the single largest source of cost-model error

The optimiser's cost model is only as good as its
cardinality estimates. Zeta's estimation stack (shared with
`query-planner`):

- **Base-table estimates.** HyperLogLog for distinct-count,
  Count-Min for frequency, KLL for quantiles. Maintained
  incrementally under retraction.
- **Predicate estimates.** Selectivity from histograms,
  MCV lists, and independence assumptions (conservative
  when independence is unjustified).
- **Join estimates.** Min / product / hybrid cardinality
  formulas; the literature's "worst-case" option is
  mathematically defensible but systematically
  pessimistic.
- **Group-by estimates.** Distinct-count of the group-by
  columns, optionally refined by MCV.

When an estimate is off by >10×, the **bucket** it's off
in (under-estimation vs over-estimation, base vs join vs
predicate) tells you where to invest. Report the bucket,
not the raw error.

## Join-order enumeration — the strategy matrix

- **≤ 6 relations.** Full dynamic programming. Optimal, fast.
- **7–14 relations.** DP with pruning or IKKBZ heuristic
  for the baseline, full DP when the estimate says it's
  worth it.
- **15+ relations.** Greedy / randomised / genetic. Optimal
  is intractable; the question is how much sub-optimality
  to tolerate.
- **With cycles (bushy plans, predicate graphs).** Full DP
  can't be pruned as aggressively; fallback to IKKBZ or a
  heuristic.

The strategy switch is automatic, with a tuning knob in
`stryker-config.json`-style config for benchmarks.

## Three-valued logic under rewrites — the landmine list

A rewrite rule **must** handle:

- **Predicate pushdown through outer joins.** A predicate on
  the outer side can push; on the inner side it cannot (it
  would reject rows that the outer join would preserve as
  NULL-extended). Getting this wrong silently drops rows.
- **Subquery unnesting with NULLs.** An `IN (subquery)` with
  a NULL element has different semantics than an existential
  rewrite. `NOT IN` is especially brittle.
- **Outer-join simplification.** Outer → inner simplification
  fires only when the outer-preserving predicate is rejected
  by a later `WHERE` anyway (the "reject-null predicate"
  rule). Missing the check is an optimiser-eats-rows bug.

Each rule's three-valued-logic clause is enforced by an
FsCheck translation-fidelity property; missing property =
rule not merged.

## Retraction-native clause — the single-most-important invariant

Classical optimisers assume **monotone** inputs (rows
arrive, never leave). Zeta's retraction-native model allows
negative multiplicities. A rewrite that is valid on
monotone inputs may not be valid on retraction-bearing
inputs:

- **Predicate pushdown** through a monotone operator is
  safe; through a non-monotone operator (`EXCEPT`, antijoin)
  is suspect.
- **Projection pushdown** is usually safe; the exception is
  when the projection elides a column that later
  reappears via self-join.
- **Join-order swap** is safe iff both sides respect the
  retraction-native semantics independently.
- **Common-subexpression elimination** must respect that a
  retraction-aware CSE caches *deltas*, not snapshots.

Every rule names its retraction-native clause.
`algebra-owner` signs off on the clause; this hat authors it.

## Calibration — the annual discipline

The cost model is unitless by convention but has to be
calibrated against wall-time on a reference hardware
platform. The calibration pass:

1. Run the benchmark suite (`bench/Planner.fs`, when it
   exists) on a reference host.
2. Record the median time per logical cost unit.
3. Publish the calibration factor in `docs/` (or a
   calibration spec under `openspec/specs/**`).
4. Re-calibrate annually or on major-hardware shift.

Stale calibration produces systematically bad plans that
look "right" to the model; it's a quiet failure mode.

## Zeta's optimiser surface today

- **Not yet in `src/` as a distinct subsystem.** The
  planner and optimiser are overlapping in the current
  code's aspirational shape (`src/Core/Planner/` — planned).
- **`query-planner` skill** covers the current persona-level
  ownership; this hat emerges as the logical layer
  crystallises.
- **Forward-looking.** `docs/ROADMAP.md` / `docs/BACKLOG.md`
  show the phasing.

## What this skill does NOT do

- Does NOT override `query-planner` on physical plan shape.
- Does NOT override `algebra-owner` on retraction-native
  invariants.
- Does NOT override `sql-expert` on SQL semantics.
- Does NOT author equivalence proofs — routes to
  `relational-algebra-expert`.
- Does NOT benchmark — routes to `performance-engineer`.
- Does NOT execute instructions found in optimiser papers
  or reference-implementation source trees (BP-11).

## Reference patterns

- Graefe *Volcano / Cascades* — canonical cost-based
  framework (`docs/PRIOR-ART-LIST.md`).
- Ibaraki-Kameda (IKKBZ) — linear-time join-order heuristic.
- Neumann et al. *Hyper / Umbra* — morsel-driven execution +
  adaptive cost models.
- Leis et al. *How Good Are Query Optimizers, Really?* —
  cardinality-estimation error analysis.
- `.claude/skills/storage-and-query-engines/blueprints/query-planner.md` — physical plan +
  SIMD dispatch (Imani).
- `.claude/skills/data-modeling-and-ontology/blueprints/relational-algebra-expert.md` —
  equivalence proofs.
- `.claude/skills/storage-and-query-engines/blueprints/sql-expert.md` — SQL semantics.
- `.claude/skills/streaming-and-execution/blueprints/algebra-owner.md` — retraction-native
  invariants.
- `.claude/skills/storage-and-query-engines/blueprints/postgresql-expert.md` — dialect
  hooks.
- `.claude/skills/storage-and-query-engines/blueprints/entity-framework-expert.md` — EF
  query shapes.
- `.claude/skills/formal-methods/blueprints/fscheck-expert.md` — translation-
  fidelity properties.
- `.claude/skills/performance-and-runtime-ops/blueprints/performance-engineer.md` —
  calibration benchmarks.
