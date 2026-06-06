# F# profile — lsm-spine-family

This profile documents how the `lsm-spine-family` capability is realised in
F# today. Prose bullets, no RFC-2119 keywords; those live in the base
`spec.md`.

## Namespace and assemblies

- Every type in this capability lives in the `Zeta.Core` namespace, in the
  `Zeta.Core` assembly — same surface as `operator-algebra`. There is no
  nested `Spine` sub-namespace; callers see `Spine<'K>`,
  `BalancedSpine<'K>`, `BackedSpine<'K>`, `SpineAsync<'K>`, and
  `SpineSelector` directly.

## Source-file layout

- `src/Core/Spine.fs` — the baseline synchronous cascade variant (`Spine<'K>`)
  plus the DBSP `IntegrateToTrace` extension that wraps a stream as a
  persistent trace handle.
- `src/Core/BalancedSpine.fs` — bounded-latency variant
  (`BalancedSpine<'K>`) with a `budgetMergesPerTick` construction parameter.
- `src/Core/DiskSpine.fs` — `IBackingStore<'K>` interface, two shipped
  implementations (`InMemoryBackingStore<'K>`,
  `DiskBackingStore<'K>`), and the `BackedSpine<'K>` that runs the cascade
  algorithm over any store.
- `src/Core/SpineAsync.fs` — `SpineAsync<'K>`, a thin wrapper around
  `Spine<'K>` + `Channel<ZSet<'K>>` + one background worker.
- `src/Core/SpineSelector.fs` — `SpineMode` discriminated union +
  `SpineSelector.pick` / `SpineSelector.auto` stateless dispatch.

## Baseline `Spine<'K>`

- Generic over `'K : comparison` — the reference-Z-set key constraint;
  alternate key representations (e.g., `IComparer<'K>`-carrying) are out of
  scope for this capability and would be a separate profile.
- Level array is a `ZSet<'K> array` of length at most 32; each slot holds at
  most one live batch. An `Insert` at a filled slot cascades by `ZSet.add`-
  merging until it lands in an empty slot.
- `Depth` reports the count of live slots; `Count` reports total entry count
  across live slots. Both are O(depth ≤ 32).
- `Consolidate` folds every live slot through `ZSet.add` and returns the
  resulting `ZSet<'K>`. It does not clear the tiers — a subsequent
  `Insert` still sees the pre-consolidation layout.
- `Levels` exposes a snapshot `ZSet<'K> array`; the array is a fresh
  allocation each call so the caller cannot mutate spine state by writing
  to the returned slots.
- `SpineIntegrateOp<'K>` is a non-strict `Op<ZSet<'K>>` that owns a
  `Spine<'K>`; `StepAsync` inserts the incoming delta and consolidates.
  `TraceHandle<'K>` is the public handle that callers of
  `IntegrateToTrace` receive.

## `BalancedSpine<'K>` — bounded-latency variant

- Construction takes `budgetMergesPerTick: int`; this is the per-`Tick`
  cap on cascade merges executed synchronously.
- Internal representation groups batches by size class
  `⌊log₂ count⌋ + 1` using `BitOperations.Log2` — a branchless ~3-cycle
  dispatch. A size-class slot holding two or more batches triggers a
  pending-merge enqueue.
- Pending merges are held in a `System.Collections.Generic.PriorityQueue`
  ordered by merge cost (largest cost served first); `Tick()` drains up
  to `budgetMergesPerTick` of the queue and returns the drained count.
- `Consolidate` drains the full pending queue before collapsing all live
  batches — this honours the spec's spine-equivalence requirement against
  `Spine<'K>`.
- This variant is **single-threaded** — concurrent callers MUST serialise
  externally or use `SpineAsync<'K>` to gain concurrent-insert safety.
- K-way merge inside `ZSet.sum` replaces the older pairwise-fold to reduce
  `O(n·k)` to `O(n log k)` heap merge.
- **Scheduling-factor bound.** The base spec's "constant factor of the
  cost-optimal schedule" clause is satisfied here by a greedy
  largest-cost-first drain of the pending-merge priority queue; the
  known bound is **2×** the optimal makespan, by Graham's 1969 list-
  scheduling result (Graham, R. L., *Bounds on Multiprocessing Timing
  Anomalies*, SIAM J. Appl. Math., 17:2, 416-429). The spec's "target
  factor is stated in the profile" clause resolves to 2× on this
  variant; any successor variant that tightens the bound MUST restate
  the factor here.

## `BackedSpine<'K>` + `IBackingStore<'K>`

- `IBackingStore<'K>` has three abstract members — `Save(level, batch)`
  returns an opaque `obj` handle, `Load(handle)` returns the stored
  `ZSet<'K>`, `Release(handle)` relinquishes the handle's storage. Any
  caller must treat the `obj` handle as opaque.
- `InMemoryBackingStore<'K>` is a `Dictionary<int, ZSet<'K>>`-backed
  reference implementation useful for tests and for the backing-store
  spec-equivalence scenario.
- `DiskBackingStore<'K>` spills batches to disk as JSON via the existing
  `Checkpoint.toBytes`/`Checkpoint.ofBytes` path. Arrow/Parquet is named
  as the production-grade successor and is out of scope for this capability.
- The spill format is JSON today; the on-disk filename schema is
  `<instance-guid>-<level>-<sequence>.json` under the canonicalised
  `workDir`. Path resolution asserts the resolved absolute path is a
  child of the canonicalised `workDir`; NTFS alternate-data-stream markers
  (filenames containing `:`) are rejected.
- **Crash-consistency contract: non-crash-consistent.** `File.WriteAllBytes`
  is used; no `fsync`. A process crash between spill and the next durable
  checkpoint may lose the spilled batch. Per the spec, recovery treats the
  spilled tier as reconstructible from the upstream stream, not as
  persistent state.
- `heapBytes` tracks approximate hot-set usage at a 24-bytes-per-entry
  estimate; once the `inMemoryQuotaBytes` construction parameter is
  exceeded, smallest-id batches spill first (evict-oldest = lowest-merge-
  priority first). Release errors on delete are logged to stderr but not
  surfaced as exceptions.
- `hotLock` guards the in-memory bookkeeping only; `File.WriteAllBytes`
  and `File.ReadAllBytes` are deliberately outside the lock to keep I/O
  off the contended path.

## `SpineAsync<'K>` — async-producer variant

- Wraps an inner `Spine<'K>` plus a `System.Threading.Channels.Channel<
  ZSet<'K>>` configured `SingleReader = true`, `SingleWriter = false`.
  Multiple producers supported; exactly one background worker drains.
- `Insert(batch)` writes to the channel with `TryWrite`, then increments
  a `sent` counter. The hot path is allocation-free for the batch (the
  `ZSet<'K>` is passed by value as a readonly struct) and cost is bounded
  by the channel-write itself — depth-independent, as the spec requires.
- The worker loop awaits `WaitToReadAsync(...).AsTask()` in its background
  worker; inside the loop it takes `spineLock`, invokes
  `spine.Insert(batch)`, and increments a `processed` counter. It does not
  block synchronously on the channel wait.
- `Flush()` captures `target = sent` at entry and polls
  `processed >= target` with a `Task.Yield` in the wait loop. This gives
  the spec's linearisation-point semantics — a `Consolidate` immediately
  after `Flush` returns sees every `Insert` that preceded the `Flush` call.
- `Dispose` completes the channel writer, cancels the worker token, and
  waits up to 500 ms for the worker to exit. If the worker has not
  completed by the bound, disposal returns — the producer-drain loss
  signal referenced in the spec is the outstanding `sent - processed`
  delta visible to a caller that checks immediately post-dispose.
- Thread-safety: concurrent `Insert` is safe. `Consolidate`, `Levels`,
  `Depth`, and `Count` all take `spineLock` — they are safe against
  concurrent `Insert`, but they MAY block for the duration of the
  consumer's in-flight merge; the hot-path depth-independence guarantee
  applies only to `Insert`. A caller that needs a coherent view should
  issue `Flush` before reading — observed values read without a prior
  `Flush` MAY lag the latest accepted inserts.
- `Clear` is deliberately absent from `SpineAsync<'K>`: truncating the
  shared state while the background consumer has pending channel reads
  cannot be done without either (a) losing accepted-but-undrained inserts
  silently, or (b) racing the consumer on the underlying `Spine<'K>`.
  Callers that need a clearable spine pick a different variant — per the
  "omission of Clear is documented" scenario in the base spec.
- **Known gap: producer back-pressure is silent on dispose.** The
  channel is constructed unbounded, so `TryWrite` cannot fail for
  capacity; however, after `Dispose` has completed the writer, a late
  `Insert` call's `TryWrite` returns `false` and the batch is **dropped
  without raising**. The `sent - processed` delta visible post-dispose
  is the only signal. This is honest scope documented here rather than a
  variant-swallowed bug; a future `bool`-returning `Insert` (or a
  `Result<unit, SpineClosed>` surface) is tracked in `docs/BACKLOG.md`.

## `SpineSelector` / `SpineMode`

- `SpineMode` is a `[<RequireQualifiedAccess>]` discriminated union with
  three cases: `Sync`, `Async`, `AsyncOnDisk of workDir: string`.
- `SpineSelector.pick` is a pure function of its inputs and allocates
  nothing. It does NOT instantiate a spine; the caller takes the returned
  mode and constructs the concrete type.
- The decision matrix (from `SpineSelector.fs:14-17`, 41-50) is:

  | condition                                              | result                           |
  | ------------------------------------------------------ | -------------------------------- |
  | `workingSet × 4 ≤ budget`                              | `SpineMode.Sync`                 |
  | `workingSet ≤ budget`                                  | `SpineMode.Async`                |
  | `workingSet > budget` and `workDir = Some d`           | `SpineMode.AsyncOnDisk d`        |
  | `workingSet > budget` and `workDir = None`             | `SpineMode.Async` (degraded; documented OOM risk) |

  Here `workingSet = estimatedEntries × entrySizeBytes`.
- `SpineSelector.auto` defaults to a budget of `max(process.WorkingSet64 × 2, 1 GB)` and the given `estimatedEntries` + `workDir`. It is the common-case entry point; `pick` is the explicit-budget form for callers that want to pin their memory envelope.
- `DefaultEntrySizeBytes` is `24L` — matches the 24-bytes/entry working-set
  estimate used by `DiskBackingStore`'s hot-set accounting, so `pick` and
  `DiskBackingStore` agree on what "an entry" costs.

## Invariants the profile commits to

- Every spine variant uses `ZSet.add` (the abelian-group operation from
  `operator-algebra`) for batch merges. Negative weights survive every
  cascade without special handling — the retraction-native invariant in
  the base spec holds by construction.
- No variant introduces a tombstone marker, a deletion flag, or a
  separate delete-pass queue.
- No variant stores empty `ZSet<'K>` batches; the `Spine.Insert` early-
  return on empty input is part of the contract, not an optimisation.
- `Spine<'K>` and `BackedSpine<'K>` are **single-threaded**. `BalancedSpine<'K>` is **single-threaded**. `SpineAsync<'K>` is **safe for concurrent inserts** against its internal `spine` with the contracts described above.
- The 32-level bound on tier depth is a hard cap in `Spine<'K>` and
  `BalancedSpine<'K>` — the two reference in-memory variants that
  advertise the cap. An attempted 33rd cascade on those variants would
  fall off the fixed-size array; practical inputs do not approach this
  bound. `BackedSpine<'K>` is **not bounded** by the 32-level cap: its
  level dictionary grows to whatever depth the backing store permits, so
  callers that want a hard cap on a backed spine MUST wrap it in their
  own depth check. A future variant raising the cap is a spec amendment,
  not a silent behaviour change.
- `IBackingStore<'K>.Save/Load/Release` form a linear-handle discipline:
  a handle returned by `Save` is loaded by `Load` exactly (as an
  idempotent read) and released by `Release` exactly once. Double-release
  is a caller bug and the in-memory reference implementation raises on
  it; the disk implementation logs-and-tolerates because the underlying
  file may already be absent from an unrelated reason.

## Out of scope for this profile

- Arrow / Parquet columnar spill format — future work; tracked by the
  `docs/BACKLOG.md` Band 2 probabilistic-sketches/CRDT cluster.
- Spine recovery from a disk-spill crash — ruled explicitly *not durable*
  above; the durable-recovery story lives in `durability-modes` and the
  upstream-stream replay it mandates.
- Streaming consolidation (produce the consolidated Z-set incrementally
  without ever materialising the full result) — noted as a performance
  direction, not a shipped spine capability.
