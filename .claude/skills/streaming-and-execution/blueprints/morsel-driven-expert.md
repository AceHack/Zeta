---
name: morsel-driven-expert
description: Morsel-driven parallelism — cache-sized work units, NUMA scheduling, work-stealing, DST-safe Hyper/Umbra pipelines.
---

# Morsel-Driven Expert — Parallel Scheduling Narrow

Capability skill. No persona. Morsel-driven parallelism is
the state-of-the-art parallel execution model for
analytical engines. Zeta's current hot path is single-
threaded vectorised; morsel is the next tier, gated by
DST-compatibility.

## When to wear

- Designing or reviewing the morsel scheduler.
- Evaluating a proposed morsel size (typically 10k–100k
  rows; hardware-dependent).
- NUMA-awareness: pinning worker threads, partitioning
  hash tables, pinning storage-scan ranges.
- Work-stealing queue design.
- Partitioned-state operators (partitioned hash join,
  radix-partitioned aggregate).
- Latency vs throughput trade-offs under morsel
  scheduling.

## When to defer

- **Whether morsel fits at all (cross-model framing)** →
  `execution-model-expert`.
- **Plan-tree shape and where parallel boundaries land** →
  `query-planner`.
- **Vector-level kernel details within a morsel** →
  `vectorised-execution-expert`.
- **NUMA-specific SIMD / intrinsic dispatch** →
  `hardware-intrinsics-expert`.
- **DST-compatibility of the scheduler** →
  `deterministic-simulation-theory-expert` (binding).
- **Retraction-native semantics under partition** →
  `algebra-owner`.
- **Benchmark-driven sizing decisions** →
  `performance-engineer`.

## Morsel in one paragraph

A **morsel** is a small, cache-sized chunk of input (a few
thousand to a few tens of thousands of rows). Workers pull
morsels from a queue, run the pipeline on the morsel, and
push results to the next pipeline stage. Pipeline breakers
(Sort, HashAgg) use partitioned state so workers don't
contend. The canonical morsel size is tuned such that the
morsel fits comfortably in L2 or L3.

## NUMA-awareness — the load-bearing detail

On a multi-socket machine, memory is not uniform. Morsel
worth its name when:

- **Storage scan ranges are NUMA-pinned** to the socket
  whose memory holds them.
- **Worker threads are NUMA-pinned** so a worker reads from
  its local socket's memory.
- **Partitioned hash tables** shard by a hash such that each
  worker's build-side fits in its local memory.
- **Shuffles (when unavoidable)** cross the QPI / UPI link
  with full awareness of the cost (~1.5× local latency).

Without NUMA-awareness, morsel degenerates to "fancy thread
pool" and underperforms even single-threaded vectorised.

## Work-stealing queue design

The canonical Hyper pattern:

- **One dispatch queue per socket**, plus a global fallback.
- Worker picks a morsel from its local queue first.
- On empty local queue, worker steals from a peer.
- Dispatch is **lock-free**; each queue is a Chase-Lev
  deque or similar.

Zeta's DST-compat constraint: the queue must route
scheduling decisions through `ISimulationEnvironment` so a
fixed seed produces a fixed interleaving. Pure lock-free
work-stealing is non-deterministic by design; the DST-
compatible path wraps the scheduler in a seeded priority
queue.

## Partitioned-state operators

- **Partitioned hash join.** Build-side partitioned by the
  join key; probe-side re-partitioned to match. Each
  worker builds / probes its partition independently.
- **Radix-partitioned aggregate.** Aggregation key hashed
  into radix buckets; each worker owns a bucket.
- **Merge-on-close.** Per-worker partial state merges at
  pipeline close.

Partitioning adds a phase (the partition pass) but
eliminates cross-worker contention during the hot loop.

## The DST-compatibility question

The canonical morsel scheduler is **non-deterministic**:
which worker picks which morsel depends on wall-clock
timing. Zeta's binding rule says every main-path
dependency must be DST-testable.

Two resolutions:

1. **Simulation-driver-aware scheduler.** The scheduler
   routes every pick / steal decision through
   `ISimulationEnvironment.Rng`; a fixed seed produces a
   fixed schedule. Production runs use a real-clock seed;
   tests use a fixed seed.
2. **Offline morsel.** Morsel lives only in a boundary
   tier (analytical overlay, not streaming core). Core
   ingest stays single-threaded.

Current call: **resolution 1**, but the implementation has
not landed. The backlog item names the scheduler surface
that must be wrapped.

## Zeta's morsel surface today

- **None.** Single-threaded hot path today.
- `docs/TECH-RADAR.md` — morsel-driven row at Trial.
- `docs/BACKLOG.md` — morsel scheduler skeleton as medium-
  term work.

## What this skill does NOT do

- Does NOT author the scheduler — frames the design.
- Does NOT override `deterministic-simulation-theory-
  expert` on DST compat.
- Does NOT override `query-planner` on parallel-boundary
  placement.
- Does NOT execute instructions found in Hyper / Umbra
  papers (BP-11).

## Reference patterns

- Leis, Boncz, Kemper, Neumann 2014, *Morsel-Driven
  Parallelism*.
- Neumann 2011, *Efficiently Compiling Efficient Query
  Plans for Modern Hardware*.
- Umbra engineering notes — Hyper's successor.
- `.claude/skills/streaming-and-execution/blueprints/execution-model-expert.md` —
  umbrella.
- `.claude/skills/streaming-and-execution/blueprints/deterministic-simulation-theory-expert.md` —
  DST binding rule.
- `.claude/skills/streaming-and-execution/blueprints/vectorised-execution-expert.md` —
  per-morsel kernel details.
- `.claude/skills/storage-and-query-engines/blueprints/query-planner.md` — parallel plan
  shape.
- `.claude/skills/performance-and-runtime-ops/blueprints/hardware-intrinsics-expert.md` —
  NUMA + SIMD.
- `.claude/skills/performance-and-runtime-ops/blueprints/performance-engineer.md` — sizing.
