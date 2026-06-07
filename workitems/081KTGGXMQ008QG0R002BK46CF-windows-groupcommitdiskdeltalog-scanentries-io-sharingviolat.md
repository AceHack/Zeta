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

## Diagnosis

`scanEntries` (recovery path) opens `delta.segment` while another handle on the same file is still
open (the writer/append handle, or the torn-write truncation re-open). Windows enforces file
share-mode; a second open without a compatible `FileShare` flag → `IO_SharingViolation`. Unix ignores
this, masking the bug off-Windows. It's in the **data-plane durability/recovery path** (`Log` noun
backend), so it matters for the "reliable single-node DB" claim.

## Fix direction

- Open the segment with `FileShare.ReadWrite` (or `Read`) on the recovery scan, **and/or** ensure the
  prior writer handle is flushed + disposed before `scanEntries` re-opens (deterministic handle
  lifetime). Prefer `using`/`use` scoping so no handle outlives the read.
- Add a Windows-aware test assertion (the test already exercises the path; the fix is in the open call).

## Anchors

- `src/Core/DiskDeltaLog.fs` lines ~181 (ctor) + ~231 (`scanEntries`) — `GroupCommitDiskDeltaLog`.
- `tests/**/DiskDeltaLogTests` ("group-commit segment log truncates torn trailing record on recovery").
- Relates to the `Log` noun (`081KTGD5JMD`) backend + the fsync durability gap (`Durability.fs` P0).
  Distinct from the CI infra flake `081KTGF7GE8` (that's a `kind` download 504; this is a real code bug).
