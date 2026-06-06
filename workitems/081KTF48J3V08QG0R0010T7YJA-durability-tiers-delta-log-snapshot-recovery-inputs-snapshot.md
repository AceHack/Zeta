---
id: 081KTF48J3V08QG0R0010T7YJA
type: task
state: backlog
priority: P2
slug: durability-tiers-delta-log-snapshot-recovery-inputs-snapshot
title: "Durability tiers + delta-log/snapshot recovery (inputs+snapshots, recompute derived)"
created: 2026-06-06T18:48:55.675Z
depends_on: []
composes_with: []
---

# Durability tiers + delta-log/snapshot recovery (inputs+snapshots, recompute derived)

<!-- Work-item body. ZetaId-keyed (conflict-free, time-sortable). "Backlog" is a
     STATE = this folder; completion moves the file to workitems/done/YYYY/MM/.
     Identity is the zetaid prefix — resolve cross-refs by `081KTF48J3V08QG0R0010T7YJA-*.md` glob. -->

## Owner: Otto (storage lane). Design + locked decisions

See `docs/research/2026-06-06-durability-tiers-and-per-stream-group-persistence-policy.md`
(§7 decisions LOCKED by maintainer 2026-06-06): persist inputs+snapshots & recompute
derived; fixed tiers (durable/derived/ephemeral) joined at registration; auto-classify
derived + declare leaves + generated tier manifest; HA design-now-build-later.

Built already this session (foundation): `IAsyncBackingStore` / `DiskAsyncBackingStore`
(OS-buffered + fsync-per-save) / `BackedSpineAsync` / `DurabilityMode.createAsyncBackingStore`
(landed, gate-green). Snapshots ride on these.

## Increments (each independently shippable + DST-tested)

1. **DeltaLog core** — append-only log of committed input Z-set deltas + logical seq +
   captured non-determinism (clock/RNG/external reads). `IDeltaLog<'K>` with
   `AppendAsync(seq, delta, captured)` + `ReplayAsync()`. In-memory impl first, then a
   disk impl reusing the async backing store + fsync tiers (async / group-commit /
   fsync-per-save). DST test: append → replay → identical fold.
2. **RecoverableSpine** — ties (durable input deltas) + (cadenced snapshot via
   BackedSpineAsync) + recovery: restore snapshot → replay tail deltas through the
   deterministic dataflow. DST test: append N, drop in-mem state, recover, assert identical
   `Consolidate`.
3. **Snapshot cadence + log GC** — flush snapshot every N deltas / T seconds; GC log
   segments older than the latest durable snapshot. Tune knob = recovery-time vs steady cost.
4. **Group-commit fsync tier** — batch many delta-batches per fsync (VoltDB sync-with-batch);
   recommended default for `durable`. (async + fsync-per-save already exist.)
5. **Tier model + registration** — `durable`/`derived`/`ephemeral`; stream-group joins a
   tier; auto-classify internal relations from the dataflow DAG; declare leaves only;
   enforce the **upward-closed invariant** at registration; emit a generated tier manifest.
6. **Parent-dir fsync** — close the crash-consistent-create gap (carry-over caveat from the
   async store) before claiming full buffered-durable-linearizability (Izraelevitz DISC'16).
7. **HA-readiness (design only)** — ensure delta-log + snapshot format is mirrorable to k+1
   replicas (active-active state-machine replication). No replication build yet.

## Coordination

Storage lane = Otto. Vera owns runtime async + FerryThrottler. The group-commit tier (4)
may want a FerryThrottler (DoP-knobbed batched fsync) — coordinate if so.

## Discovered gap (2026-06-06, during DiskDeltaLog end-to-end test)

DiskAsyncBackingStore uses a per-instance GUID prefix in spill filenames, so a
FRESH instance cannot reload a prior instance's SNAPSHOT by handle. Cross-restart
recovery therefore works via full delta-log replay (proven) but NOT yet via
snapshot+tail across a restart. Fix: STABLE SNAPSHOT ADDRESSING — a durable
manifest/ref (git ref in the git-native backend) naming the latest snapshot file
with a stable path, so SnapshotPointer survives a restart. New increment, slots
before/with parent-dir fsync.

## Progress (2026-06-06)

Landed: DeltaLog (inc1), RecoverableSpine + snapshot/cadence/GC (inc2/3),
IDeltaCodec seam + ZSet<->DynamicValue + Checkpoint/CBOR codecs, DiskDeltaLog
(filesystem/CBOR, fsync, fresh-instance recovery). Plus DurableSaga. ~33 tests green.
Vera follow-on: group-commit via FerryThrottler now exists as
`GroupCommitDiskDeltaLog<'K>` (segment + CRC32C + one `Flush(true)` per byte-aware
boat). Remaining: segment rollover/compaction, parent-dir fsync where relevant,
stable snapshot addressing, then tier model.
