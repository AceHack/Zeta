---
id: 081KTFA5QBT08QG0R000906NPA
type: task
state: backlog
priority: P2
slug: handoff-vera-group-commit-fsync-tier-ferrythrottler-c-port-o
title: "HANDOFF Vera: group-commit fsync tier (FerryThrottler) + C# port of durability primitives"
created: 2026-06-06T20:32:14.202Z
depends_on: []
composes_with: []
---

# HANDOFF Vera: group-commit fsync tier (FerryThrottler) + C# port of durability primitives

<!-- Work-item body. ZetaId-keyed (conflict-free, time-sortable). "Backlog" is a
     STATE = this folder; completion moves the file to workitems/done/YYYY/MM/.
     Identity is the zetaid prefix — resolve cross-refs by `081KTFA5QBT08QG0R000906NPA-*.md` glob. -->

## HANDOFF → Vera (from Otto, 2026-06-06)

Two parallelizable pieces in the durability subsystem. Otto owns the F# spine
(landed); these are yours.

### A. Group-commit fsync tier (your FerryThrottler is the right primitive)

Problem: `DiskDeltaLog` fsync-per-append is one fsync per record (slow). Group
commit batches many appends per fsync for throughput at bounded latency.

- Route appends through a `FerryThrottler` boat: each boat = the records to fsync
  together; one `Flush`/fsync per boat. DoP=1 stays deterministic (the sim path).
- Byte-aware boats (you already built `MaxBatchBytes`) cap boat size to a target
  write size.
- Acceptance: append throughput ≫ fsync-per-append at the same durability; DST
  crash harness still green (no committed record lost when a boat's fsync returned).

### B. C# port of the durability primitives (4-lang leg toward PROVEN)

Port `DeltaLog` + `DeltaCodec` (CBOR) + recovery to C# (`src/Core.CSharp.*`),
conforming to the **byte-lock treaty** `src/Core/golden-vectors-deltacodec.json`
(your CBOR output MUST match the hex exactly). Cross-oracle differential fuzz vs F#.

### Pointers

- Design: `docs/research/2026-06-06-zeta-relativistic-agent-database-vision.md` (§5b/§5c/§6) +
  `docs/research/2026-06-06-durability-tiers-and-per-stream-group-persistence-policy.md`.
- PROVEN plan: workitem `081KTF9T0ER`. Group-commit also tracked in `081KTF48J3V` (inc 4).
- F# source to port: `src/Core/DeltaLog.fs`, `DeltaCodec.fs`, `RecoverableSpine.fs`, `SnapshotStore.fs`.
- Rules: honest async (`.claude/rules/async-all-the-way-truthful-signatures.md` — DoP-knob, no raw Task.Run),
  culture-invariant/ordinal, the 11 manifesto specs, FoundationDB + Will Wilson DST as guiding principles.

## Progress (Vera, 2026-06-06)

- **A partial/landable:** added `GroupCommitDiskDeltaLog<'K>` as a segment-backed
  `IDeltaLog` hot-path tier. It uses `FerryThrottler<'TItem,'TResult>` with
  byte-aware boats and `MaxDegreeOfParallelism = 1` by default; each boat appends
  N framed records and completes callers only after one segment `Flush(true)`.
- Recovery scans `[len][crc32c][payload]` records, truncates torn trailing writes,
  preserves `HighWater` across fresh instances, and continues to work through the
  canonical CBOR `IDeltaCodec` seam.
- Tests added in `tests/Tests.FSharp/Storage/DiskDeltaLog.Tests.fs`: group
  append/replay, fresh-instance high-water recovery, CBOR codec compatibility,
  torn trailing record truncation, and `RecoverableSpine` recovery over the
  segment log.
- **Still open:** B, the C# port of `DeltaLog` + `DeltaCodec` + recovery against
  `src/Core/golden-vectors-deltacodec.json`. Segment compaction/rollover remains
  the follow-up for the perf-tier log's physical `TruncateAsync`; v1 keeps
  correctness by honoring `ReplayAsync(fromSeqExclusive)` while retaining bytes.
