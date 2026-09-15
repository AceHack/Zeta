---
id: 081M2K8XT63087G0R000GSXC0P
type: bug
state: backlog
priority: P2
slug: diskdeltalog-live-replay-hits-io-sharingviolation-on-macos-d
title: "DiskDeltaLog live replay hits IO SharingViolation on macOS during concurrent append"
created: 2026-09-15T19:32:58.691Z
depends_on: []
composes_with: []
---

# DiskDeltaLog live replay hits IO SharingViolation on macOS during concurrent append

<!-- Work-item body. ZetaId-keyed (conflict-free, time-sortable). "Backlog" is a
     STATE = this folder; completion moves the file to workitems/done/YYYY/MM/.
     Identity is the zetaid prefix — resolve cross-refs by `081M2K8XT63087G0R000GSXC0P-*.md` glob. -->

## Evidence

`build-and-test (macos-26)`, PR #17418, 2026-09-15T18:04. **1 failure in 6898 tests.**

```
Zeta.Tests.Storage.DiskDeltaLogTests.group-commit segment log live replay
uses read-only scan during append [FAIL]

System.IO.IOException : IO_SharingViolation_File,
  .../zeta-test-paths/gcdl-live-replay-0188/delta-00000000000000000001.segment

  FileSystem.fs(126)   PhysicalFileSystem.OpenFile(path, mode, access, share)
  FileSystem.fs(687)   FileSystemBlockIo.Read(lba, dst)
  FileSystem.fs(1137)  BlockSuper.readSlot
  DiskDeltaLog.fs(373) GroupCommitDiskDeltaLog.scanSegment
  DiskDeltaLog.fs(505) GroupCommitDiskDeltaLog.ReplayAsync
  DiskDeltaLog.Tests.fs(283)
```

## Why this is signal and not noise

**The test's name is the claim it failed to uphold** — "live replay uses READ-ONLY SCAN
during append". It exists to prove replay can open a segment while a writer holds it. A
sharing violation is that property not holding, which is the defect the test was written to
catch, not an unrelated flake.

## What narrows it

| observation | what it rules out |
|---|---|
| unrelated to the PR — #17418 changes only `verdict-drought.ts` (TypeScript) | the change under test |
| `build-and-test (macos-26)` PASSED on #17414 minutes earlier | a deterministic break |
| 1 failure in 6898 | a broad regression |
| the throw is at `OpenFile(..., share)` in `PhysicalFileSystem` | the caller's logic; it is the FileShare mode reaching the OS |

## Leading hypothesis — NOT tested

macOS and Linux disagree about what .NET's `FileShare` maps to. If the reader opens with a
share mode that excludes the writer's open mode, the race is only lost when the append is
genuinely in flight — which is rare, platform-dependent, and exactly the observed shape.
Same family as `081M2E7ZHYC087G0R000NDNQ2F` (exclusive-lock stale-takeover): a concurrency
property that holds on one platform and is intermittently false on another.

## Do not

Do not retry the test or mark it flaky. The assertion is the property; a retry converts a
true intermittent alarm into silence. The next step is to print the `FileMode/FileAccess/
FileShare` triple the reader and writer each used at the moment of the violation, so the
fourth occurrence arrives with the mismatch named instead of needing this reconstruction.
