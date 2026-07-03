# Durability tiers + per-stream-group persistence policy (research → design)

**Date:** 2026-06-06 · **Author:** Otto · **Status:** proposal (decisions open — see §7)
**Drivers:** maintainer ("really fast and safe"; "VoltDB persistence mode … per table
types or table groups (stream types/groups)") + Vera ("real async durable backing store,
explicit durability modes") .

## 1. The decisive insight (Beacon)

Every deterministic single-threaded engine keeps durability **uniform** to keep recovery
provable: FoundationDB (one TLog tier; SIGMOD 2021), TigerBeetle (one VSR log), VoltDB
(one command log; VLDB 2008 / ICDE 2014). They pay that price *on purpose*.

A **DBSP / Z-set incremental-dataflow** core has an escape they lack. Operators are
**deterministic pure functions of their input deltas** (Budiu et al., DBSP, VLDB 2023).
Therefore **derived relations are regenerable**: you do not persist them — you *recompute*
them on recovery by replaying the input deltas through the dataflow. This is VoltDB's
command-logging trick (log the *command*, not the *data*; log volume ∝ transaction count,
not write volume — Malviya/Stonebraker, *Rethinking Main Memory OLTP Recovery*, ICDE 2014)
made strictly stronger, because incremental view maintenance re-derives every downstream
view automatically.

**Persist the irreducible inputs + cadenced snapshots. Recompute the rest.**

## 2. Three durability tiers (attached at registration)

Prior-art models for per-object policy: (a) policy-at-registration (Postgres `UNLOGGED`,
Kafka topic config), (b) policy *groups/tiers* relations join (Kafka config templates;
DV2.0 hub/satellite by change-rate), (c) per-write override flags (RocksDB
`WriteOptions.disableWAL`). Recommendation: **(b) a small fixed tier set, attached at
registration (a); forbid (c) on the deterministic core** — per-write nondeterministic
durability is exactly what breaks DST replay (the FDB/TigerBeetle/VoltDB lesson).

| Tier | Who | Persistence | Recovery |
|------|-----|-------------|----------|
| **`durable`** | input relations + any relation NOT a pure function of durable inputs | command/delta log + snapshot (SlateDB-style CAS-manifest + writer-epoch fencing) | restore snapshot → replay tail deltas |
| **`derived`** | relations that ARE deterministic functions of durable inputs (most operator state + materialized views) | **none** — regenerated | replay dataflow from last consistent checkpoint (FASTER-style epoch checkpoint as the time boundary) |
| **`ephemeral`** | scratch / session state | none | discard-on-recovery, clean empty semantics (Postgres `UNLOGGED` truncate-on-recovery) |

**Load-bearing invariant — durability is upward-closed over the dataflow DAG.** A relation's
tier must be ≥ the max tier of every non-derivable input it depends on. Enforce at
registration. This single rule eliminates the "recovered durable state references lost
derived state" hazard.

## 3. The durable-tier mechanism = command/delta log + snapshot ("VoltDB mode")

1. **Delta log:** append committed input Z-set batches + logical clock + captured
   non-determinism to a sequential log (one record per delta-batch).
2. **Snapshot cadence:** flush an LSM-consistent spine checkpoint every N deltas / T seconds
   (piggyback on memtable flushes); GC log segments older than the latest durable snapshot.
3. **Recovery:** restore snapshot → replay tail deltas through the deterministic dataflow.

Recovery cost = snapshot-load + (deltas-since-snapshot × execute). Snapshot cadence is the
dial trading steady-state cost vs recovery time (the canonical command-log tradeoff).

## 4. fsync policy is an ORTHOGONAL axis (already partly built)

The fsync knob is independent of the tier. Three settings (Otto landed the disk path for
these in `DiskAsyncBackingStore` / `createAsyncBackingStore`, 2026-06-06):

- **async / OS-buffered** — fastest, bounded loss window.
- **group-commit** — batch many delta-batches per fsync (VoltDB sync-with-batching); the
  recommended default for `durable`.  *(not yet built)*
- **fsync-per-save (synchronous)** — zero-loss, highest latency; reserve for HARD-LIMIT
  durability. *(built: `StableStorage` async path, WriteThrough + Flush(true))*

Honesty caveat carried forward: current fsync covers file data+metadata, **not** the parent
directory — crash-consistent *creates* need a parent-dir fsync follow-up before claiming full
buffered-durable-linearizability (Izraelevitz et al., DISC'16).

## 5. Determinism capture (DST — manifesto §7, non-negotiable)

Command/delta-log replay is only correct if replay is deterministic. Anything impure —
wall-clock reads, RNG seeds, external I/O / non-deterministic operator inputs — **must be
recorded into the log at execution time and re-fed on replay**. This is exactly the
deterministic-simulation discipline already in `ChaosEnv.fs` / `VirtualTimeScheduler`. The
order of concurrent delta sources must be fixed and logged.

## 6. HA is TWO-LEVEL (corrected 2026-06-06, maintainer)

Earlier draft wrongly proposed cross-agent k+1 active-active HA. The real model has two levels
(see the vision doc `2026-06-06-zeta-relativistic-agent-database-vision.md` §4):

- **Intra-agent (own state) — traditional HA lives here.** An agent MAY replicate *its own shard*
  k+1 for redundancy/durability. Within one shard there is a single writer and a local order, so
  determinism makes this active-active state-machine replication of the deterministic delta stream
  (VoltDB k-safety / TigerBeetle VSR style). This is where the delta-log + snapshot design must be
  mirrorable. Defer the build; design the log for it.
- **Inter-agent — relativistic, NOT blanket HA.** Agents own their shards and **selectively**
  replicate from each other over shared buses (partial replication; G-Set CRDT bus). No global
  truth; cross-agent consistency is causal/mergeable (MRDT three-way merge over the git DAG), not
  k+1 replication. Do NOT mirror every agent's log to every other agent.

## 7. Decisions (LOCKED 2026-06-06, maintainer)

1. **Persist model: inputs + snapshots, recompute derived. ✓** Log committed input Z-set
   deltas + cadenced spine snapshots; regenerate derived state by replaying the deterministic
   dataflow on recovery. NOT a per-write WAL of spine mutations. (The big bet — taken.)
2. **Policy shape: a small fixed tier set joined at registration. ✓**
   `durable` / `derived` / `ephemeral`; no free-form per-table knobs; no per-write overrides
   (breaks DST). A stream-group joins a tier.
3. **Tier assignment: auto-classify internal relations; declare only leaves. ✓**
   The dataflow graph marks any relation that is a deterministic function of durable inputs as
   `derived` (don't persist). The author declares only the **leaves**: inputs → `durable`,
   scratch → `ephemeral` (the graph cannot infer *intent* at a source). Override-upward
   allowed.
   - **Audit-via-manifest, not hand-declaration** (maintainer's question — "does auditability
     buy us anything? we can audit via convention"): correct — explicit per-relation
     declaration buys nothing the **upward-closed invariant check** (§2) doesn't already
     enforce, and it drifts. Instead **emit the computed classification as a generated tier
     manifest** ("relation X = `derived` because f(durable Y, Z)") — a queryable/checked-in
     audit artifact with zero boilerplate. Convention + generated manifest + invariant check.
4. **HA: design the log for replication, build later. ✓** Shape the delta-log + snapshot
   format so it can be mirrored to k+1 replicas (active-active state-machine replication), but
   don't build replication/k-safety yet.

Note (informational): per-stream-group command-logging is **beyond VoltDB** (one global
command log). Soundness across groups rests entirely on the upward-closed invariant (§2).

## 8. Storage backends: filesystem + git-native (maintainer, 2026-06-06)

The delta-log / snapshot / manifest abstraction (`IDeltaLog`, `IAsyncBackingStore`) MUST stay
backend-agnostic. Two backends are planned, **both all-text, both via our byte-verified
serializers (§9) — NOT binary** (maintainer, 2026-06-06):

- **Filesystem** — built today (`DiskAsyncBackingStore`, OS-buffered + fsync-per-save). Hot
  perf tier. Format = our byte-verified text canonical codec, NOT Arrow/Parquet binary. Make
  the *serializer* fast (§9), don't trade byte-verification for a binary format.
- **Git-native — ALL TEXT, INCLUDING INDEXES (maintainer).** Every artifact is text and
  diffable: the delta log, snapshots, AND the indexes/manifests. No binary index files; any
  irreducibly-binary payload is byte-locked as hex/decimal-in-JSON (the
  `no-binary-in-proof-lineage` discipline applied to storage). Human-auditable and *mergeable*
  in a `git diff`.

Why git-native fits the architecture cleanly (it maps the §3 mechanism onto git primitives):

| Architecture piece | Git primitive |
|---|---|
| delta log (append-only commands) | **commit history** — each commit = a delta-batch |
| content-addressed Z-set batches | **blobs/trees** — dedup by content hash (idempotency #6: content-address is idempotent) |
| snapshot | a **tree / tag** (text Checkpoint JSON — already text today) |
| manifest / snapshot pointer | a **ref** |
| writer-epoch fencing / CAS-manifest (SlateDB) | **atomic ref update** (CAS via `update-ref` old-value check) |
| recovery | checkout snapshot → replay commits |
| HA / replication (§6) | `git push`/fetch of the deterministic commit stream |

This is the existing "git-as-event-store fold" theme made concrete; the deterministic
delta-stream replays the same way whether the log is a git commit chain or a flat file.

## 9. Serialization: reuse our byte-verified canonical codecs / DynamicValue (maintainer, 2026-06-06)

**Direction (not to be rushed — "get it right and performant"):** the on-storage format for
delta-log entries, snapshots, and manifests should be **our own byte-verified, golden-vector-
locked canonical serializers and/or `DynamicValue`** — not ad-hoc JSON, not binary. Today the
backing store spills via `Checkpoint.toBytes` (ad-hoc JSON); the target is to route storage
serialization through the canonical codec family that already has 4-language parity + golden
vectors + cross-oracle differential fuzzing.

Why this is the right substrate (it makes storage inherit the proof lineage):

- **Cross-language readable** — a Rust/TS/C# reader can read the same git-native store
  (4-oracle byte-lock), important for a distributable git-native tier.
- **DST-replayable + golden-vector-covered** — the format is already proven deterministic and
  byte-stable; storage gets that for free instead of re-proving an ad-hoc format.
- **Text + diffable/mergeable** — `DynamicValue` canonical JSON is text, satisfying §8's
  all-text git-native constraint and `no-binary-in-proof-lineage`.
- **One format to verify** — not "storage JSON" + "wire format" + "proof vectors" as three
  separate things to keep in sync.

**Performance is the open question, not the direction.** Canonical text encoding costs more
than a raw memcpy. The resolution is to **make the serializer fast** (perf-engineer / Naledi
lane: zero-alloc canonical encode, streaming writer, reuse buffers — like FerryThrottler's
byte-aware boats feeding the encoder) rather than abandon byte-verification for a binary
format. MEASURE the canonical-encode cost on the delta-log hot path before committing the seam;
if it's the bottleneck, optimize the codec, don't swap in binary.

**Sequencing:** keep `IDeltaLog`/`IAsyncBackingStore` serialization behind a pluggable
`encode/decode` seam so we can land the subsystem on `Checkpoint.toBytes` first (works today)
and swap in the byte-verified canonical codec without touching the log/recovery logic. This is
the "don't rush, get it right" path: ship the mechanism, then upgrade the format under a stable
contract.

### Naledi (perf-engineer) findings, 2026-06-06 (code-read; no benchmark on file yet)

- **No codec benchmark exists** — `bench/Benchmarks/` has zero coverage of CBOR / canonical-JSON
  / `Checkpoint.toBytes`. **Add `SerializationBench.fs` (`[MemoryDiagnoser]`, ZSet fixture at
  16/256/4096 entries) BEFORE locking the seam.** Measurement-led.
- **Codec locations:** Checkpoint JSON = `Transaction.fs:151` (triple-copy + reflection
  `System.Text.Json`); canonical JSON = `DynamicValue.fs:438`; canonical CBOR = `DynamicValue.fs:496`
  (decode `:611`).
- **Code-read ranking:** CBOR fastest + least-alloc on encode (single-pass `List<byte>`);
  canonical-JSON slowest/most-alloc (per-level string-list fold + `String.concat` + UTF-16→UTF-8);
  Checkpoint-JSON in between, reflection-taxed.
- **⚠ Text codec is INCOMPLETE:** canonical JSON defers `Float` and `Bytes` (6/8 shapes,
  `DynamicValue.fs:450/452`). If delta batches carry floats or byte payloads, the text/git-native
  tier needs the tagged-JSON extension first. **CBOR is complete (8/8).** → confirm batch shape.
- **⚠ CBOR decode has a hidden ~2× cost:** `fromCanonicalCbor` re-runs the encoder for a
  canonicality fixed-point check (`DynamicValue.fs:752`). Add a `trustCanonical` fast-path that
  skips the re-encode for our *own* log (we produced it canonically) → ~2× restore throughput.
- **Highest-leverage pre-seam perf:** (1) emit **directly from `ZSet.AsSpan()` to an
  `IBufferWriter<byte>`**, never materializing an intermediate `DynamicValue` tree; (2) pooled
  output buffer (`ArrayPool`); (3) `writeText` direct UTF-8 into the writer. Don't lock the seam
  on the current `ToArray()`/string-list shape.
- **Recommendation:** text/audit tier → **canonical YAML** (`Core.FSharp.Yaml`, 081KT5CF90008QG0R001P4CQ09 — already
  byte-locked, block-style, fewer bytes than JSON, the git-standard per maintainer 2026-06-04;
  this MOOTS the canonical-JSON Float/Bytes gap for the text tier — YAML encoder renders floats
  via invariant "R"; bytes still need a base64/hex scalar convention, confirm). Hot tier →
  canonical CBOR (with `trustCanonical`). Benchmark first, then optimize, then lock. (YAML
  encoder is StringBuilder-based — same non-zero-alloc profile as canonical JSON, but the text
  tier is not the hot path, so that's acceptable; CBOR carries the hot path.)

## Anchors (Beacon)

- DBSP: Budiu et al., *DBSP: Automatic Incremental View Maintenance*, VLDB 2023.
- VoltDB/H-Store: Kallman et al., *H-Store*, VLDB 2008; Malviya et al., *Rethinking Main
  Memory OLTP Recovery*, ICDE 2014; Harizopoulos et al., *OLTP Through the Looking Glass*,
  SIGMOD 2008.
- FoundationDB: Zhou et al., SIGMOD 2021 (unbundled, uniform durability, DST).
- FASTER: Chandramouli et al., SIGMOD 2018 (hybrid log, epoch checkpoint).
- Snapshots: Chandy & Lamport, *Distributed Snapshots*, TOCS 1985; Carbone et al.,
  *Lightweight Asynchronous Snapshots* (Flink ABS), 2015.
- SlateDB (writer epochs + CAS manifest); RocksDB column families + `disableWAL`; Kafka
  per-topic durability tuple (`acks` × `min.insync.replicas`); Postgres `UNLOGGED` /
  `synchronous_commit`; TigerBeetle VSR; Izraelevitz et al., DISC'16.

## Related

- `src/Core/Durability.fs` (tiers + factory), `src/Core/DiskSpineAsync.fs` (async + fsync),
  `src/Core/Checkpoint.fs`, `src/Core/Sink.fs` (delivery), `openspec/specs/durability-modes/`,
  `openspec/specs/lsm-spine-family/`.
- WDC research preview (`081KS923C0008QG0R001N2RSGJ`) is a separate, narrower durable-commit protocol; this note
  is the broader tiering/recovery architecture it would slot into.
