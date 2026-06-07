---
id: 081KTGGXMQ008QG0R002BK46CF
type: bug
state: backlog
priority: P2
slug: windows-groupcommitdiskdeltalog-scanentries-io-sharingviolat
title: "Windows: GroupCommitDiskDeltaLog.scanEntries IO_SharingViolation on torn-write recovery (DiskDeltaLog.fs:231) — file opened without share mode"
created: 2026-06-07T07:49:23.808Z
depends_on: []
composes_with: []
---

# Windows: GroupCommitDiskDeltaLog.scanEntries IO_SharingViolation on torn-write recovery (DiskDeltaLog.fs:231) — file opened without share mode

<!-- Work-item body. ZetaId-keyed (conflict-free, time-sortable). "Backlog" is a
     STATE = this folder; completion moves the file to workitems/done/YYYY/MM/.
     Identity is the zetaid prefix — resolve cross-refs by `081KTGGXMQ008QG0R002BK46CF-*.md` glob. -->

## Symptom (observed 2026-06-07, gate run 27086367023)

`build-and-test (windows-11-arm)` + `(windows-2025)` fail on:

```
Zeta.Tests.Storage.DiskDeltaLogTests."group-commit segment log truncates torn trailing record on recovery" [FAIL]
  System.IO.IOException : IO_SharingViolation_File,
    C:\...\Temp\zeta-test-paths\gcdl-torn-0139\delta.segment
  at Zeta.Core.GroupCommitDiskDeltaLog`1.scanEntries(...)   DiskDeltaLog.fs:231
  at Zeta.Core.GroupCommitDiskDeltaLog`1..ctor(...)          DiskDeltaLog.fs:181
```

**Pre-existing + windows-specific** — NOT introduced by the Log-noun work; reproduces only on Windows
(Unix file semantics don't enforce share-mode, so macOS/Linux CI is green). It keeps Windows CI red.

## Diagnosis (CORRECTED 2026-06-07 after reading the source)

The `scanEntries` open at `DiskDeltaLog.fs:231` **already** uses `FileShare.ReadWrite`:

```fsharp
use fs = new FileStream(segmentPath, FileMode.Open, access, FileShare.ReadWrite)
```

So the failing open is NOT the culprit — the `IO_SharingViolation` means **another live handle on
`delta.segment` is open with a share mode that excludes this open** (i.e. the **writer/append
FileStream** held elsewhere — likely the ctor/append path — was opened *without* `FileShare.ReadWrite`,
or is not disposed before recovery scans). Windows enforces share-mode intersection across all open
handles; Unix ignores it, masking the bug off-Windows. Data-plane durability/recovery path (`Log` noun
backend), so it matters for the "reliable single-node DB" claim.

## Fix direction (CORRECTED)

- **The fix is on the WRITER side, not the scan.** Find the append/writer `FileStream` open (the group-
  commit writer; ctor `DiskDeltaLog.fs:~181` and the append path) and ensure it is opened with
  `FileShare.ReadWrite` so a concurrent recovery read is allowed — **and/or** ensure the writer handle
  is flushed + disposed before `scanEntries` runs (deterministic `use`/`using` lifetime; no writer
  handle outliving a recovery scan).
- Needs **Windows verification** — the failure only reproduces on Windows, so the fix can't be confirmed
  on macOS/Linux locally; a Windows CI run (or a Windows owner) must verify. (This is why it was filed,
  not blind-fixed: the scan's own open was already correct; the writer-handle lifecycle is the subtle part.)

## Anchors

- `src/Core/DiskDeltaLog.fs` lines ~181 (ctor) + ~231 (`scanEntries`) — `GroupCommitDiskDeltaLog`.
- `tests/**/DiskDeltaLogTests` ("group-commit segment log truncates torn trailing record on recovery").
- Relates to the `Log` noun (`081KTGD5JMD`) backend + the fsync durability gap (`Durability.fs` P0).
  Distinct from the CI infra flake `081KTGF7GE8` (that's a `kind` download 504; this is a real code bug).
