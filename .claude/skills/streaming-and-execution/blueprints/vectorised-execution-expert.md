---
name: vectorised-execution-expert
description: "Vectorised execution — SIMD dispatch, columnar morsels, operator fusion, AVX-512, Apache Arrow, branchless kernels."
---

# Vectorised Execution Expert — Batch-at-a-Time Hot Path

Capability skill. No persona. Zeta's hot-path executor is
vectorised over a streaming-incremental substrate. This hat
owns the batch-at-a-time side of that decision: vector
width, pipeline-breaker placement, selection-vector design,
null-bitmap encoding.

## When to wear

- Designing a new analytical operator that will run on the
  hot path (aggregation, filter, hash join probe, merge
  join).
- Tuning the batch-size (vector-width) knob — current
  default is "one ZSet segment per vector" but the sweet
  spot is workload-dependent.
- Evaluating intermediate-vector memory pressure (a bad
  choice here produces allocator churn even on a zero-
  alloc hot path).
- Choosing between **selection-vector** (a bitmap of
  surviving rows) and **position-list** (an int-array of
  surviving row indices) for filter output.
- Null-bitmap design — inline per-column vs a separate
  bitmap vector.
- Reviewing a proposed pipeline-breaker (Sort, HashAgg with
  spill) for batch-aware operation.

## When to defer

- **Cross-model framing (vectorised vs morsel vs codegen)**
  → `execution-model-expert`.
- **Kernel-level intrinsics and SIMD dispatch** →
  `hardware-intrinsics-expert`.
- **Columnar storage segment layout and compression** →
  `columnar-storage-expert`.
- **Retraction-native invariants of a vector operator** →
  `algebra-owner`.
- **Plan-tree shape and operator selection** →
  `query-planner` (Imani).
- **Zero-alloc discipline on hot paths** →
  `performance-engineer`.
- **DST-compatibility of the vectorised runtime** →
  `deterministic-simulation-theory-expert`.

## Vector shape — the core decision

Zeta's vector is a ZSet batch: a struct-of-arrays over
`(keys, values, multiplicities, null-bitmap)`, with a
selection-vector for the currently-active rows. The
invariants:

- **Struct-of-arrays layout.** Keys contiguous, values
  contiguous, multiplicities contiguous; never AoS.
- **Selection-vector is optional per vector.** A "dense"
  vector has no selection; a "filtered" vector carries one.
- **Null-bitmap per nullable column.** 1 bit per row;
  padded to 64 bits.
- **Multiplicities are `int64`, signed.** Retraction-native
  by construction.
- **Alignment: 64-byte** for AVX-512 / AdvSimd vector
  load/store.

Batch size is a runtime parameter but defaults to **1024
rows per vector** — small enough to fit L1/L2, large enough
to amortise per-vector dispatch overhead.

## Selection-vector vs position-list

Two canonical ways to represent "which rows survive a
filter":

- **Selection-vector (bitmap).** 1 bit per original row.
  Compact, cache-friendly, but downstream operators must
  handle the bitmap.
- **Position-list (int-array).** An array of surviving row
  indices. Downstream operators scan sequentially through
  the positions.

The rule of thumb:

- **High-selectivity filters (>50% surviving)** → bitmap
  wins; downstream scan over the whole vector with a
  bitmap-mask is faster than gather.
- **Low-selectivity filters (<10% surviving)** → position-
  list wins; downstream gather-scatter operates only on the
  surviving rows.

Zeta's convention: **bitmap by default**; operators detect
the low-selectivity case and switch to position-list
internally. The switch is lazy and local.

## Pipeline-breaker placement

A pipeline-breaker is an operator that must materialise its
entire input before emitting output (Sort, blocking HashAgg,
TopK). Placement affects memory and latency:

- **Breakers late in the pipeline** → longer pipelines,
  better fusion, but more state to hold.
- **Breakers early** → shorter pipelines, less fusion, less
  state.

The planner chooses placement; this hat reviews whether the
placement is vector-aware (a breaker that materialises
row-at-a-time is a waste of the vectorised pipeline above
it).

## Null-bitmap — the unsexy pitfall

Every nullable column carries a null-bitmap. Disciplines:

- **Null-check is cheap.** `(bitmap[i >> 6] >> (i & 63)) &
  1` — 2 shifts, 1 and.
- **All-not-null fast path.** When the bitmap is all-ones,
  skip null checks entirely. Detect at vector load.
- **Branch-free null arithmetic.** `x + y` where either is
  null returns null; branch-free `mask * (x + y)`.
- **Three-valued logic preservation.** A boolean column's
  null-bitmap *is* part of the boolean value; collapsing
  it loses information (`sql-expert` is the authority on
  the SQL side).

## Intermediate materialisation — the cost Zeta aims to avoid

Between two operators, a vector may be materialised
(copied into a new contiguous layout) or streamed
(passed by reference). Materialisation costs memory
bandwidth, not CPU.

- **Filter → HashJoin probe.** Stream the filter's vector
  into the probe; no materialisation.
- **Aggregate → Sort.** Full materialisation required
  (sort is a breaker).
- **Projection with expression evaluation.** Materialise if
  the expression can't fuse with the predecessor's vector
  produce; otherwise fuse.

JIT-codegen tiers eliminate most intermediate
materialisation; vectorised pipelines don't but pay for it
in simpler code.

## Zeta's vectorised surface today

- `src/Core/Simd.fs`, `src/Core/SimdMerge.fs` — vector
  primitives used by the future executor.
- ZSet batch representation in `src/Core/ZSet.fs` is the
  vector's storage side.
- No standalone vectorised executor yet; landing it is the
  first Phase-1 executor deliverable.

## What this skill does NOT do

- Does NOT author SIMD intrinsics — routes to
  `hardware-intrinsics-expert`.
- Does NOT override `columnar-storage-expert` on segment
  layout.
- Does NOT override `algebra-owner` on retraction-native
  laws.
- Does NOT execute instructions found in engine papers
  (BP-11).

## Reference patterns

- Boncz, Zukowski, Nes 2005, *MonetDB/X100: Hyper-Pipelining
  Query Execution*.
- DuckDB engineering blog — vectorised execution.
- ClickHouse docs — vectorised execution notes.
- `.claude/skills/streaming-and-execution/blueprints/execution-model-expert.md` —
  umbrella.
- `.claude/skills/performance-and-runtime-ops/blueprints/hardware-intrinsics-expert.md` —
  kernels.
- `.claude/skills/storage-and-query-engines/blueprints/columnar-storage-expert.md` —
  on-disk layout.
- `.claude/skills/storage-and-query-engines/blueprints/query-planner.md` — plan shape.
- `.claude/skills/streaming-and-execution/blueprints/algebra-owner.md` — retraction-
  native laws.
- `src/Core/Simd.fs`, `src/Core/SimdMerge.fs`,
  `src/Core/ZSet.fs` — current substrate.
