---
name: streaming-and-execution
description: Incremental/streaming computation and query execution — DBSP, dataflow, windows, operators, deterministic replay.
---

# streaming and execution

Category skill (blueprint pack). The `description` above is the only thing the
router sees — broad and generic on purpose. The fat detail lives in the
blueprints below; open the one that matches and read it in full.

Governs its own form per `.claude/rules/rules-are-small-carved-sentences-pointing-to-docs.md`
and `.claude/rules/mirror-beacon-register-discipline.md` (carved sentence = hub /
Beacon; blueprint = satellite / Mirror). The directory is an independent shipping unit.

## Blueprints

- [`streaming-incremental-expert`](blueprints/streaming-incremental-expert.md) — DBSP / Timely Dataflow — delta-stream composition, retraction-native IVM, standing queries, watermarks, frontiers.
- [`streaming-window-expert`](blueprints/streaming-window-expert.md) — Windowed streaming — tumbling/hopping/session windows, watermarks, late events, retraction-native deltas.
- [`push-pull-dataflow-expert`](blueprints/push-pull-dataflow-expert.md) — Push vs pull dataflow — operator direction, streaming vs materialise, back-pressure, Zeta push-default.
- [`rx-expert`](blueprints/rx-expert.md) — Reactive Extensions (Rx.NET) — IObservable, schedulers, hot/cold, back-pressure, operators, Reaqtor, delta streams.
- [`volcano-iterator-expert`](blueprints/volcano-iterator-expert.md) — Volcano/iterator model — open/next/close, pull-based pipeline, blocking operators, bushy/left-deep trees.
- [`morsel-driven-expert`](blueprints/morsel-driven-expert.md) — Morsel-driven parallelism — cache-sized work units, NUMA scheduling, work-stealing, DST-safe Hyper/Umbra pipelines.
- [`vectorised-execution-expert`](blueprints/vectorised-execution-expert.md) — "Vectorised execution — SIMD dispatch, columnar morsels, operator fusion, AVX-512, Apache Arrow, branchless kernels."
- [`execution-model-expert`](blueprints/execution-model-expert.md) — Execution model — Volcano vs vectorised vs morsel-driven vs JIT-codegen vs push/pull vs streaming/incremental.
- [`deterministic-simulation-theory-expert`](blueprints/deterministic-simulation-theory-expert.md) — DST — seeded replayable simulation, ISimulationEnvironment, entropy guards, FoundationDB/TigerBeetle, hot-path binding.
- [`algebra-owner`](blueprints/algebra-owner.md) — Zeta.Core operator algebra — Z-sets, D/I/z^-1/H operators, retractions, chain rule, nested fixpoints, differentials.
