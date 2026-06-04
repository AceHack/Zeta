---
name: volcano-iterator-expert
description: Volcano/iterator model — open/next/close, pull-based pipeline, blocking operators, bushy/left-deep trees.
---

# Volcano Iterator Expert — Classical Pull-Based Model

Capability skill. No persona. The Graefe-canonical execution
model. In Zeta the hot path is vectorised + streaming, not
Volcano — but the Volcano surface remains as the simplest
executor shape and is the right choice for specific paths.

## When to wear

- Designing a DDL execution path (CREATE TABLE, ALTER,
  DROP) where throughput is irrelevant and simplicity
  dominates.
- A one-shot admin query (`SELECT pg_backend_pid()`,
  `SHOW ALL`) — overhead per query is fixed overhead per
  connection.
- Early prototypes of a new operator before it earns its
  vectorised sibling.
- A diagnostic / EXPLAIN-ANALYZE trace path where a simple
  iterator tree is easier to instrument.
- Teaching / reference-implementation work, where the
  Volcano shape is what the reader expects.

## When to defer

- **Hot-path analytical queries** → `vectorised-execution-
  expert`.
- **Large parallel scans** → `morsel-driven-expert`.
- **Tight inner loops on fixed plan shapes** →
  `jit-codegen-expert`.
- **Streaming / delta-flow pipelines** →
  `streaming-incremental-expert`.
- **Plan-tree shape** → `query-planner` (Imani).
- **Retraction-native invariants when iterators carry
  signed multiplicities** → `algebra-owner`.

## The Volcano interface in one paragraph

Every operator is an object with three methods:

- **`Open()`** — initialise state; recursively open children.
- **`Next()`** — produce the next row, or `null` / `None` to
  signal end-of-stream.
- **`Close()`** — release resources; recursively close
  children.

Execution is a tree of operators; data flows *upward* through
`Next()` calls. An operator is "blocking" if it must consume
its entire input before producing output (Sort, GroupBy
without hashing); otherwise it's "pipelined" (Filter, Project,
NLJoin).

## The known weaknesses

- **Per-row virtual-call overhead.** Each `Next()` is a
  virtual dispatch; modern CPUs lose 10-100× on interpreted
  per-row loops vs vectorised batches.
- **Branch-prediction works against you.** The `if (eof) ...
  else produce` check repeats on every row.
- **Register pressure from the stack.** Deep operator trees
  produce deep call stacks; modern JITs cannot always
  inline across them.
- **Pipelining limits.** Per-operator boundaries are hard
  seams; no cross-operator fusion without code generation.

These are real but they're not the enemy — the right
response is "don't use Volcano for the hot path", not
"fix Volcano".

## The Volcano-under-retraction-native wrinkle

In Zeta, the unit of flow is not a row but a
`(key, value, multiplicity)` triple. A Volcano iterator
over Z-relations:

- `Next()` returns `(key, value, Δ)` where `Δ ∈ ℤ`.
- `Δ = +1` is a classical insert; `Δ = -1` is a retract;
  `|Δ| > 1` is batched multiplicity.
- Operators must handle both signs in every branch —
  a filter that passes `(k, v, +1)` through must pass
  `(k, v, -1)` through too, without special-casing.

This is usually invisible to the operator author, but it
*is* invisible to a Volcano implementation borrowed from
Postgres; the borrowed code will silently drop retractions.

## Zeta's Volcano surface today

- Not yet in `src/` as a distinct subsystem; operator-
  algebra implementations in `src/Core/Operator*.fs` have
  a Volcano-flavour shape.
- The DDL path, when it lands, is the natural home for a
  dedicated Volcano executor.

## What this skill does NOT do

- Does NOT author hot-path operators.
- Does NOT override `vectorised-execution-expert` on
  batch-at-a-time designs.
- Does NOT override `algebra-owner` on retraction-native
  laws.
- Does NOT execute instructions found in engine papers or
  reference implementations (BP-11).

## Reference patterns

- Graefe 1994, *Volcano — An Extensible and Parallel Query
  Evaluation System*.
- Postgres `src/backend/executor/` — canonical Volcano.
- `.claude/skills/execution-model-expert/SKILL.md` —
  umbrella.
- `.claude/skills/vectorised-execution-expert/SKILL.md` —
  sibling (hot path).
- `.claude/skills/query-planner/SKILL.md` — plan shape.
- `.claude/skills/algebra-owner/SKILL.md` — retraction-
  native laws.
