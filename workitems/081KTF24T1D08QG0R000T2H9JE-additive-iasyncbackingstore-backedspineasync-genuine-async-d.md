---
id: 081KTF24T1D08QG0R000T2H9JE
type: task
state: backlog
priority: P2
slug: additive-iasyncbackingstore-backedspineasync-genuine-async-d
title: "Additive IAsyncBackingStore + BackedSpineAsync (genuine async disk IO, no Task.Run fakery)"
created: 2026-06-06T18:11:55.565Z
depends_on: []
composes_with: []
---

# Additive IAsyncBackingStore + BackedSpineAsync (genuine async disk IO, no Task.Run fakery)

<!-- Work-item body. ZetaId-keyed (conflict-free, time-sortable). "Backlog" is a
     STATE = this folder; completion moves the file to workitems/done/YYYY/MM/.
     Identity is the zetaid prefix — resolve cross-refs by `081KTF24T1D08QG0R000T2H9JE-*.md` glob. -->

## Owner: Otto (handed off by Vera, 2026-06-06)

Vera: *"real async storage should be designed as an additive IAsyncBackingStore /
async-backed spine path. I deliberately did not fake it with Task.Run around
synchronous disk I/O."* This is that work.

## Scope (additive — does NOT touch sync IBackingStore / BackedSpine / DiskBackingStore)

New file `src/Core/DiskSpineAsync.fs`:

1. `IAsyncBackingStore<'K>`:
   - `SaveAsync: level:int * batch:ZSet<'K> * ct -> ValueTask<obj>`
   - `LoadAsync: handle:obj * ct -> ValueTask<ZSet<'K>>`
   - `ReleaseAsync: handle:obj * ct -> ValueTask`
2. `InMemoryAsyncBackingStore<'K>` — genuine sync dictionary work returning
   *completed* ValueTasks. This is TRUTHFUL (no I/O to yield on); it is NOT
   Task.Run fakery. (Per async-all-the-way rule.)
3. `DiskAsyncBackingStore<'K>` — genuine async I/O via `File.WriteAllBytesAsync` /
   `File.ReadAllBytesAsync`; metadata (hot dict, paths, heapBytes, nextId) under
   the sync `hotLock`, all awaited I/O OUTSIDE the lock (mirror the sync store's
   lock discipline). Same path-canonicalisation + traversal/ADS guards.
4. `BackedSpineAsync<'K>` — cascade-merge spine driven by the async store
   (`InsertAsync` / `ConsolidateAsync` / `ClearAsync`), awaiting Save/Load/Release.

Tests mirror `tests/Tests.FSharp/Storage/Spine.Disk.Tests.fs`: roundtrip, spill,
BackedSpineAsync-matches-Spine, Clear, per-instance isolation, path guards.

## Anchors

- async-all-the-way rule (`.claude/rules/async-all-the-way-truthful-signatures.md`)
- sync counterpart: `src/Core/DiskSpine.fs` (the algorithm to mirror)
