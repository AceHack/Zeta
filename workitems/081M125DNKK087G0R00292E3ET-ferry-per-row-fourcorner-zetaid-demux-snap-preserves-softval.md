---
id: 081M125DNKK087G0R00292E3ET
type: task
state: backlog
priority: P1
slug: ferry-per-row-fourcorner-zetaid-demux-snap-preserves-softval
title: "Ferry per-row FourCorner + ZetaId demux; snap preserves SoftValue uncertainty"
created: 2026-08-27T17:48:56.819Z
depends_on: []
composes_with: ["081M10AAVAT087G0R0027M0GV5", "081M10AZ6KS087G0R0000SSFMH"]
---

# Ferry per-row FourCorner + ZetaId demux; snap preserves SoftValue uncertainty

Aaron 2026-08-27: the ferry is the **universal adapter** across a
**2×2** of caller × processor (`single|batch` × `single|batch`),
plus **split** when a caller batch exceeds `MaxBatchSize` (the
caller is clueless; the ferry cuts boats). Underneath is
one-at-a-time **unless** the handler is batchable. DoP=1 is the
FoundationDB loop; the same type scales to N. Anti-Nagle: a boat
sails with what is queued *now*, never waits to fill; the
environment decides, no artificial timer.

**Four corners even in batch.** Each *row* of a boat carries
`FourCornerOwnership` (in / out / outFeedback / inFeedback). Batch
results and failures are **per-row**, not whole-boat. Muxed feedback
over bidirectional channels demuxes by **ZetaId** on the other side —
the same demux key the transports already use. Original Itron
throttler was missing four-corner; we should have it in batch mode
now. If the tree is missing it, that is the gap, not a reason to
look at the original (clean-room: requirements, never expression).

## What is already in the tree (do not rebuild)

`src/Core/FerryThrottler.fs`:

- DoP knob (`MaxDegreeOfParallelism`, `FerryThrottlerConfig.deterministic`
  is 1). Same `fillBoat` / ferry-loop on DoP=1 and N.
- Anti-Nagle boats (`MaxBatchSize` capacity, never a delay).
- Single-arity: `EnqueueAsync` one item; `processBatch` takes a boat.
- Result-arity: `ProcessAsync` one item; `processBatch` returns an
  index-aligned `'TResult array`; `completeBoat` fans back to each TCS.
- Contextual arity threads `(item, ctx)` as data, not AsyncLocal.

## What is missing (the work)

1. **The other three cells + split.** In-tree today: **single-batch
   only.** Missing: `ProcessMany` (batch-batch), split of an oversize
   caller batch (batch-batch(s) — caller does not know `MaxBatchSize`),
   `processOne` (batch-single / single-single). Efficient path =
   handler-is-batchable, not caller-wrote-a-batch.
2. **FourCorner per row.** `processBatch` is `'TItem -> 'TResult`.
   Nothing requires `'TResult` to be `FourCornerOwnership`. Feedback
   corners are not a boat-row field.
3. **Per-row failure.** `faultBoat` sets the **same exception on every
   row** when `processBatch` throws or the result length mismatches.
   A row whose feedback corner is an error cannot stay a success
   sibling. Whole-boat fault is the current contract.
4. **ZetaId demux.** Result fan-in is **index alignment inside one
   boat**. Reorder / mux over a duplex wire (`duplex-transport.ts`
   demuxes by *channel* `normal|feedback|close`, not by identity)
   has no ZetaId key on the row. Index is boat-local; ZetaId is
   cross-channel.

Do **not** wire `FourCornerOwnership` into the ferry this slice if
the record is a heap object on the hot path (Naledi). Smallest
falsifier first: boat of 2 ZetaIds, corners permuted, row-1
feedback=error **without throw**; row-0 still completes. That test
does not exist.

Alloc / SIMD: Naledi, static, unmetered — **5 heap objects per
`ProcessAsync` item** on the unbounded no-cancel path (TCS + Task +
`FerryRequest` class + F# `task{}` + boxed CE). `fillBoat` is a
drain loop — not a SIMD candidate. Batching *is* the win that
already exists. Measure before adding SIMD. Per-row failure is the
P0 (today `faultBoat` clones one exception onto every row; tests
lock that in).

White-room spec from original Itron code: **not required** for this
row. The 4-way matrix + split + capture + backpressure are
specified from this session. Do not open the original.

Also this row:

- **Boat pooling + bounded queue.** `Array.zeroCreate` per ferry is
  already one buffer; request/TCS alloc per item is not. Default
  `MaxQueueSize = None` is the unbounded in-flight / container-OOM
  degenerate. Production must set the bound (cooperative
  backpressure, not drop).
- **Capture.** Kleisli door exists (`EnqueueCapturedAsync`). Snapshot
  at the door is shipped; **restore around `processBatch` is not**
  (Naledi: ambient OTEL on the ferry sees the ferry, not the item).
  Kleisli processors unpack the payload. `ProcessCapturedAsync`
  untested.
- **Self-predict space and time.** `SchedulerZeta.predict` is
  time/orbit only. Occupancy (bit-0 usage: slot used vs empty) is
  the space coordinate. Pair them so DoP / boat size / backpressure
  are self-decisions.
- **Per-row errors ≅ RFC 4918 §13 Multi-Status (HTTP 207).**
  Confirmed (Aaron). Itron slim was change-tracking 207.
  `completeBoat` is indexed items; `faultBoat` is whole-batch
  failure. A row that reports nothing is **vacuous** — Landauer
  heat (`ErasureClass`). Prefer FourCorner *feedback* that
  teaches and may ship a **new generator**. RFC 9457 cites 207
  for heterogeneous subproblems.
- **DynamicValue is a tiny CFG.** Context attaches via Vokes
  **difference-list holes** (unbound tail; also difference trees /
  dictionaries; Hughes lists). Hitchhiker = buffers. Two CAS
  styles in the same lecture: exact (SHA confirm / BLAKE3 /
  Jumprope identity) and metric/local (rolling hash → FastCDC /
  HyperMinHash). Dual BNN = epi–mono, not two networks.
- **SIMD** stays on producer/consumer. Later exception: competing
  future-predictions, vectorised by similarity per BNN layer.

## Also recorded here (same session, not a second item)

- **Data plane stays fast and dumb.** Stored procs **default here**
  (data-layer only). They pay intelligence only when evolved or
  when they explicitly ask. Futamura, `gen/`, zetadb/fs merge, and
  stored-proc *evolution* live in the **control plane**. Intelligence
  is tiered: each tier knows its incapability and routes up (cheap
  GitHub-runner swarm / `healer-harness.ts`). Not a third plane.
- **TypeSchema IR is functional** (sum/product). `SchemaField.CsType`
  is a C# leak; OOP wrappers are derived (F# already does this).
- **Product vs framework.** Bundle related lanes; keep the cut.
  Frameworks used by products; products (or services) sold. Both
  may own a repo. Blurry when customers are developers — name it.
  `Port` is hexagonal, not a product.
- **TypeSchema from DynamicValue** is also the CloudEvents
  `dataschema` and the Debezium envelope schema — **one IR**
  (`EventEnvelope.fs` already ships both categories). MUMPS
  statics via DI, not ambient. Caché analog: they load the same
  objects on every node; we diverge per node and reconcile
  (independence). Multi-node = DoP=1→N on one machine.
- **CTE NULL as hole.** Same shape as Vokes difference lists.
  SQL PDW meter-sim with Diana Duncan (OSS credit granted;
  book naming proofread-gated). Clean-room: requirement only.
- **ZetaId is a stable name; Jumprope content-addresses the
  blob.** Epoch chooses which blob. Not mutex compare-and-swap
  (do not fuse the two "CAS"). Futamura specializes the
  interpreter; Jumprope specializes location against content.
- **TypeSchema from DynamicValue.** Today
  `src/Core.CSharp/TypeSchema.cs` +
  `SchemaSourceGenerator` consume AdditionalFiles / JSON IR, not
  the store. Next honest slice: `TypeSchema` from a `DynamicValue`
  (store-native), then existing generators consume it. `gen/` is
  the plan (`gen/README.md`); not wired to `ZetaFs` / `DagFs`.
- **Guessed TypeSchema keeps the SoftValue.** Do **not** change
  `SoftValue.snap` (it stays the collapse). A schema guessed from
  a SoftValue is a **different constructor** that carries the
  still-soft distribution: reporting stays calibrated, later
  `combine` / `observe` still commute. Snap-then-forget as the
  schema path is the defect.
- **Tick-N loads tick-(N−1).** Self-editing compiler. Still needs
  the epoch layer (VISION: DESIGNED). Bounded ticks make the load
  well-defined; the wire does not exist.
- **ForgeHost extra-git is not Zeta and not Harny.** Surfaces
  already live in `src/Core.TypeScript/forge-host/`. Zeta
  (`clis/` `sim`/`mea`/`cut`) is git-native. Harny is the agent
  harness. Plug ForgeHost verbs into **Nucleus** / the existing
  command core (roadmap item #1) as plugins (k8s-controller
  shape). Do not mint **Quay** (Red Hat collision). Do not mint
  a fourth CLI product. If a binary name is later demanded:
  **Port** (hexagonal), glossary-gated. Design, not
  implementation.

Beacon: Van Jacobson ACK-clocking (anti-Nagle self-clock);
FoundationDB single-thread run loop (DoP=1); Itron
`IThrottler`/`MaxDegreeOfParallelism` as the *requirement*
anchor (not the expression); FourCorner as the I/O pipe (not a
fermion); Linstedt DV2 change-rate for where intelligence sits;
Syme/Battocchi 2012 type providers for TypeSchema-from-store.

Pointers: `docs/ROADMAP.md` (north star, 8b, P1, continuous);
`docs/VISION.md` §compiler ladder + epoch; `src/Core/FerryThrottler.fs`;
`src/Core/FourCorner.fs`; `src/Core/SoftValue.fs`;
`src/Core.CSharp/TypeSchema.cs`; `gen/README.md`; `clis/README.md`.
