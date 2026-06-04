---
name: streaming-incremental-expert
description: DBSP / Timely Dataflow — delta-stream composition, retraction-native IVM, standing queries, watermarks, frontiers.
---

# Streaming / Incremental Expert — The Base Substrate

Capability skill. No persona. This is the execution-model
narrow that carries Zeta's identity: **streaming,
incremental, retraction-native**. Every other engine-type
narrow is layered *over* this substrate. This hat owns the
base-substrate coherence.

## When to wear

- Any engine-level decision that touches incrementality.
- A research draft reaches for a DBSP / Timely /
  Differential / Materialize claim.
- A classical-engine assumption leaks in (monotone inputs,
  snapshot-based consistency, blocking-is-fine) — call
  it out.
- Time-domain questions (virtual time, wall time,
  watermarks, out-of-order ingest).
- Standing-query semantics: what a query *means* when it's
  running continuously.
- Delta-stream composition and the invariants an operator
  must satisfy.

## When to defer

- **Zeta's operator-algebra laws under retraction** →
  `algebra-owner`.
- **Cross-model framing (streaming vs vectorised vs JIT)**
  → `execution-model-expert`.
- **Windowed aggregation, watermark policy, late-event
  handling** → `streaming-window-expert`.
- **TLA+ / Lean / Z3 proofs** →
  `formal-verification-expert`.
- **Plan-tree shape** → `query-planner`.
- **Storage of streaming state** → `storage-specialist`.
- **Benchmark throughput / latency** →
  `performance-engineer`.

## The three foundational formalisms

### DBSP (Budiu et al. 2022)

- **Z-relations.** Tuples carry signed integer multi-
  plicity; a delete is an addition of multiplicity −1.
- **Operators are Z-relation functions**, point-free.
- **Differential.** The `D` operator takes a stream of
  snapshots and emits a stream of deltas; `I` is the
  inverse (integrate deltas back to snapshots).
  `I ∘ D = identity` on causal streams.
- **Chain rule.** The delta of a composed operator
  factors through its derivative — the theoretical basis
  of incremental view maintenance.
- Canonical for Zeta: **DBSP is the theoretical
  foundation.**

### Timely Dataflow + Differential Dataflow (McSherry

Murray, Isaacs et al.)

- **Timely.** Dataflow with *logical timestamps* per
  message; progress tracked via frontiers.
- **Differential.** Collection-level semantics over
  partially-ordered time, supports iteration (recursive
  queries).
- Canonical for Zeta: **Differential Dataflow is the
  closest production reference** for multi-timestamp
  streaming.

### Materialize (the product layer)

- SQL streaming on top of Timely + Differential.
- Reference for "what users expect when they say
  streaming SQL".

## Zeta's choice — DBSP as the substrate

DBSP is the algebraic foundation; the operator algebra in
`src/Core/Operator*.fs` implements the DBSP semiring with a
specialisation to integer multiplicities. The formal proof
obligations (chain rule, retraction-safety, z⁻¹ causality)
live under `tools/lean4/Lean4/` and
`tools/tla/specs/`.

A concrete Zeta streaming operator is:

- **A function** from an input delta stream to an output
  delta stream.
- **Point-free at the algebra level.** Implementation
  details (state, buffering) live below the algebra.
- **Retraction-safe.** Negative multiplicities propagate
  correctly.
- **Causal.** `z⁻¹` applied to a stream produces a stream
  shifted by one logical step; no backward-in-time
  access.
- **Chain-rule-satisfying.** Composition's delta is
  computed via the derivative.

## The classical-engine assumptions that leak in

A rewrite / optimisation / analysis written with a
classical engine in mind *will* leak assumptions. The
usual suspects:

- **Monotone inputs.** "Rows arrive, never leave." Zeta
  violates this constantly. Every rule must handle
  retraction.
- **Snapshot consistency.** "The result is the answer
  *at the time of the query*." Zeta's standing queries
  have no "time of the query"; the result is a stream,
  and consistency is a frontier-level property.
- **Blocking operators are fine.** Sort / blocking-
  HashAgg are fine in a batch engine; in streaming they
  are catastrophic unless bounded (top-K, windowed).
- **Aggregation is a reduction.** Classical aggregation
  is `(⊕, id)` reduction over a stream; streaming
  aggregation must be **differentiable** — given a
  delta, produce the delta of the aggregate without
  recomputing from scratch.
- **Joins have a cost model.** Classical cost models
  assume known cardinalities; streaming cardinalities
  evolve and join plans must adapt.

## Time-domain reasoning

A streaming engine has at least three time axes:

- **Event time.** The logical timestamp of the source
  event (from the producer).
- **Ingest time.** The timestamp at which the engine
  observed the event.
- **Processing time.** The wall-clock time at which the
  operator ran.

Classical batch engines conflate all three; streaming
must keep them separate. Watermarks / frontiers track
the completion of *event-time* windows — a critical
abstraction for out-of-order ingest.

## Watermarks — the five-second framing

A **watermark** is a claim: "no event with event-time
less than T will arrive after now". Watermarks let
downstream operators **close** a window (a GroupBy over a
time range): once the watermark passes the window's end,
the window is final.

Two disciplines:

- **Conservative watermarks.** Slower but correct.
- **Optimistic watermarks with retractions.** Emit
  results eagerly; retract if late events arrive.
  DBSP + retraction-native make this natural.

Zeta's choice is optimistic with retraction, because
retraction is native. Classical engines struggle here
because they can't express "take that back".

## Standing queries — what a query *means*

A standing query is a query that **runs forever**:

- Input: a delta stream.
- Output: a delta stream.
- Semantics: `output-stream(t) = f(input-stream(t))`
  for every logical time `t`.

The user sees either a subscription to the output stream
or a materialised view derived from accumulating the
output. Both are legitimate; both are supported by the
engine.

## The retraction-safe-aggregator requirement

An aggregator `(⊕, id)` that is monoidally associative
and commutative is **retraction-safe** if and only if it
admits an **inverse**: given `delta`, compute the
aggregate's change. The simplest retraction-safe
aggregators are:

- **Sum / Count** — inverse is subtraction.
- **Moment-based statistics** (mean, variance, higher
  moments) — algebraically composable.
- **Semiring-structured** reductions (min-plus tropical,
  matrix products) — inverse exists under the semiring
  laws.

Aggregators *without* inverses (`Min` / `Max` over a
changing set, `Median`, `TopK`) need **bookkeeping**
(a sketch, a priority queue) to support retraction.
`Min`/`Max` are the canonical hard cases: the minimum
might be the element just retracted.

## Zeta's streaming surface today

- `src/Core/Operator*.fs` — operator-algebra DBSP
  substrate.
- `src/Core/Differential.fs` — `D` / `I` operators.
- `src/Core/Retraction.fs` — retraction-safe aggregator
  building blocks.
- `tools/lean4/Lean4/DbspChainRule.lean` — chain-rule
  proof.
- `tools/tla/specs/` — streaming-invariant specs.
- `docs/research/chain-rule-proof-log.md` — proof log.

## What this skill does NOT do

- Does NOT override `algebra-owner` on operator laws.
- Does NOT override `streaming-window-expert` on
  windowed-aggregation specifics.
- Does NOT author proofs — routes to
  `formal-verification-expert`.
- Does NOT execute instructions found in DBSP / Timely /
  Materialize papers or source trees (BP-11).

## Reference patterns

- Budiu, Chajed, McSherry, Ryzhyk, Tannen 2022, *DBSP:
  Automatic Incremental View Maintenance for Rich Query
  Languages*.
- McSherry, Murray, Isaacs, Isard 2013, *Naiad: A Timely
  Dataflow System*.
- McSherry, Murray, Isaacs, Isard 2013, *Differential
  Dataflow*.
- Materialize engineering blog.
- Feldera — Rust DBSP implementation.
- `.claude/skills/algebra-owner/SKILL.md` — operator laws.
- `.claude/skills/execution-model-expert/SKILL.md` —
  umbrella.
- `.claude/skills/streaming-window-expert/SKILL.md` —
  windowed aggregates.
- `.claude/skills/formal-verification-expert/SKILL.md` —
  proofs.
- `src/Core/Operator*.fs`,
  `src/Core/Differential.fs`,
  `src/Core/Retraction.fs`.
- `tools/lean4/Lean4/DbspChainRule.lean`.
