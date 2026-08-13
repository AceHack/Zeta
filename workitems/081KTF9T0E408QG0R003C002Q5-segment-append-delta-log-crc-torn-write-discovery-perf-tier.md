---
id: 081KTF9T0E408QG0R003C002Q5
type: task
state: backlog
priority: P2
slug: segment-append-delta-log-crc-torn-write-discovery-perf-tier
title: "Segment-append delta log + CRC torn-write discovery (perf-tier disk log)"
created: 2026-06-06T20:25:50.276Z
depends_on: []
composes_with: []
---

# Segment-append delta log + CRC torn-write discovery (perf-tier disk log)

<!-- Work-item body. ZetaId-keyed (conflict-free, time-sortable). "Backlog" is a
     STATE = this folder; completion moves the file to workitems/done/YYYY/MM/.
     Identity is the zetaid prefix — resolve cross-refs by `081KTF9T0E408QG0R003C002Q5-*.md` glob. -->

## Owner: Otto + Naledi (perf). Maintainer 2026-06-06

The current DiskDeltaLog is file-per-entry + temp+rename + parent-dir-fsync —
crash-consistent and git-native-friendly, but slow on the hot append path
(per-entry create/rename/dir-fsync). Add a PERF-tier disk log behind the same
IDeltaLog seam:

- **Single append-only segment file**; one open fd; append in place.
- **Per-record framing:** `[len][crc32c][capturedJson][deltaBytes]` (reuse the
  existing Crc32c primitive). On recovery, scan the segment; a torn TRAILING
  record (crash mid-append) is detected by a short read or bad CRC → truncate it
  (single-writer ⇒ only the last record can be partial). A bad CRC mid-stream =
  genuine corruption → fail loudly.
- fsync the file (not a dir per entry); group-commit batches many records per fsync.
- Roll segments at a size threshold; truncate = drop whole sealed segments ≤ snapshot seq.

Two disk logs then coexist behind IDeltaLog: file-per-entry (git-native/audit) and
segment+CRC (hot perf) — a backend choice, like the format tiers. MEASURE both
(Naledi's SerializationBench extended to append throughput) before defaulting.
Anchor: classic WAL (ARIES); SQLite WAL; segment+CRC is standard.

## Progress (Vera, 2026-06-06)

`GroupCommitDiskDeltaLog<'K>` now lands the first segment-backed perf tier behind
`IDeltaLog`: FerryThrottler byte-aware boats, one segment `Flush(true)` per boat,
CRC32C-framed records, fresh-instance recovery, and torn trailing record
truncation. Remaining: segment rollover/compaction so physical `TruncateAsync`
can reclaim bytes instead of relying only on `ReplayAsync(fromSeqExclusive)`.

## Progress (Otto, 2026-08-13) — segment rollover + physical truncation landed

`GroupCommitDiskDeltaLog` now rolls segments and physically reclaims bytes
(the v1 no-op `TruncateAsync` is gone):

- Segments named `delta-{firstSeq:020}.segment` — coverage `[firstSeq,
  next.firstSeq)` is derivable from NAMES alone, no index file to drift. The
  active segment rolls when it reaches `maxSegmentBytes` (ctor knob, default
  64 MiB); the next boat seals it and opens a segment named by that boat's
  first sequence.
- `TruncateAsync(seq)` deletes whole SEALED segments fully absorbed by the
  snapshot (ARIES/SQLite-WAL/Kafka segment GC); the active segment is never
  deleted (logical `ReplayAsync(fromSeqExclusive)` filtering still masks any
  absorbed prefix it holds).
- Torn-write handling is now POSITIONAL: only the ACTIVE segment can carry a
  torn trailing record (every sealed segment was flushed through by its final
  boat before the roll) — a torn tail there truncates on recovery as before,
  but ANY anomaly inside a SEALED segment fails loudly as corruption.
- A pre-rollover `delta.segment` is honoured as the FIRST segment (in-place
  upgrade, no migration step); truncation past its coverage deletes it too.
- End-to-end: RecoverableSpine with `AutoSnapshotEvery` now gets real byte
  reclamation (snapshot → truncate → sealed segments deleted → fresh-instance
  recovery still exact). 5 new tests; full suite 4,896 green.

Remaining on this row: the Naledi append-throughput benchmark comparing the
two disk logs before either becomes the default.
