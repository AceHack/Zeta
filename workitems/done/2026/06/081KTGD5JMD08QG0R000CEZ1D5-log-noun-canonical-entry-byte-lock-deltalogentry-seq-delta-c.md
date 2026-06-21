---
id: 081KTGD5JMD08QG0R000CEZ1D5
type: task
state: done
priority: P1
slug: log-noun-canonical-entry-byte-lock-deltalogentry-seq-delta-c
title: "Log noun canonical entry byte-lock (DeltaLogEntry: Seq+Delta+Captured) — all-lang/all-ser, replace ad-hoc System.Text.Json; completes the 3-noun data-plane proven base"
created: 2026-06-07T06:43:49.517Z
completed: 2026-06-07T09:05:53.946Z
depends_on: []
composes_with: []
---

# Log noun canonical entry byte-lock (DeltaLogEntry: Seq+Delta+Captured) — all-lang/all-ser, replace ad-hoc System.Text.Json; completes the 3-noun data-plane proven base

<!-- Work-item body. ZetaId-keyed (conflict-free, time-sortable). "Backlog" is a
     STATE = this folder; completion moves the file to workitems/done/YYYY/MM/.
     Identity is the zetaid prefix — resolve cross-refs by `081KTGD5JMD08QG0R000CEZ1D5-*.md` glob. -->

## Why (the gap)

Per the two-plane DB architecture (`docs/research/2026-06-07-two-plane-git-native-database-minimal-nouns-*`),
the data plane's irreducible noun set is **three**: `ZSet` ✅ 4/4, `DynamicValue` ✅ 4/4, and **`Log` 🚧**.
`Log` is the one noun NOT yet at the proven bar, so this completes the data-plane proven math base.

The entry shape (`src/Core/DeltaLog.fs`):

```fsharp
type DeltaLogEntry<'K when 'K : comparison> =
    { Seq: int64; Delta: ZSet<'K>; Captured: Map<string, string> }
```

**Hazard found (2026-06-07):** the current entry serialization is ad-hoc and .NET-specific —
`GitDeltaLog.fs` and `DiskDeltaLog.fs` both encode `Captured` via `System.Text.Json`
(`JsonSerializer.SerializeToUtf8Bytes` of a `Dictionary<string,string>`) and `Delta` via the ZSet
codec, framed differently per backend. That is NOT 4-lang byte-lockable: STJ key ordering/escaping is
platform-specific, and the `Captured` map keys must be **ordinal-sorted** (culture-invariant rule —
081KT07NV0008QG0R001YDB73K precedent) for cross-language/DST determinism. This is exactly why `Log` isn't proven.

## What (the canonical encoding)

The whole entry maps to a `DynamicValue.Object` and rides DynamicValue's already-byte-locked canonical
serializers — so the entry INHERITS the 4-language lock with no new canonical encoding (an entry is just
a DynamicValue; no new noun). As-shipped (F# reference, #6730/#6735):

- `Object` with keys `captured` / `delta` / `seq` (ordinal key order — DynamicValue.Object is
  order-preserving, so the mapping fixes the order).
- `seq` → `DynamicValue.Int` (int64).
- `delta` → `ZSetDynamic.toDynamicValue` (the existing ZSet↔DynamicValue mapping, already 4/4 locked).
- `captured` → `DynamicValue.Object` with **ordinal-sorted keys** (culture-invariant, 081KT07NV0008QG0R001YDB73K — the one
  real decision; deterministic across languages + DST). Empty object when the producer was pure.

Format is per-stream/table (CBOR default for filesystem; YAML for git once a DynamicValue YAML
serializer lands; JSON/XML also available) — all ride the same `DeltaLogEntryDynamic` mapping.

## Slices (seed-first, one PR each)

1. **Canonical seed + F# reference oracle** — author `log-entry/golden-vectors.json` (the seed: hand-
   written canonical entries incl. empty/non-empty Captured, multi-key ordinal-ordering cases, ℤ
   retraction deltas) + an F# entry encoder/decoder conforming to it + round-trip & byte-lock tests;
   migrate `GitDeltaLog`/`DiskDeltaLog` off `System.Text.Json` onto the canonical encoder.
2. **C# oracle** — native encoder/decoder replaying the seed (byte-identical).
3. **Rust oracle** — same.
4. **TS oracle** — same. → `Log` reaches 4/4; data-plane proven base complete.

## Anchors

- Architecture: `docs/research/2026-06-07-two-plane-git-native-database-minimal-nouns-cells-control-plane-three-host-substrates-aaron-otto.md`
- Master checklist: **081KSXN940008QG0R003FCQ7WT** (sovereign distributed DB, one git-native Z-set substrate)
- Exemplars to mirror: DynamicValue CBOR (`src/Core.TypeScript/dynamic-value/golden-vectors-cbor.json`),
  ZSet (`src/Core.TypeScript/z-set/golden-vectors.json`)
- Code to migrate: `src/Core/DeltaLog.fs`, `src/Core.Git/GitDeltaLog.fs`, `src/Core/DiskDeltaLog.fs`
- Discipline: `.claude/rules/culture-invariant-by-default.md` (ordinal `Captured` keys),
  `.claude/rules/no-binary-in-proof-lineage.md` (hex-in-JSON golden vectors)

## DONE (2026-06-07)

All slices complete — the `Log` noun is at the proven bar AND consumed by the real backends:

- **4/4 byte-lock** — F# reference codec + golden seed (#6730/#6735), C# oracle (#6743), TS oracle
  (#6744), Rust oracle (#6745). All four reproduce the shared seed byte-identical + round-trip.
- **`IEntryCodec` seam + `CborEntryCodec`** (#6757) — the whole-entry canonical codec the backends adopt.
- **Backend migration COMPLETE** — `GitDeltaLog` (#6759) + `DiskDeltaLog`/`GroupCommitDiskDeltaLog`
  (#6763) now serialize the WHOLE entry through the canonical codec, off `System.Text.Json`. The
  git-native and disk delta logs persist exactly the 4-language byte-locked format. 22 git + 166 storage
  tests green.

The 3-noun data-plane proven math base (ZSet ✅ + DynamicValue ✅ + Log ✅) is whole, and the delta-log
backends store the proven format end-to-end. Remaining adjacent (separate workitems, NOT this noun):
DiskSnapshotStore/GitSnapshotStore still use STJ for snapshot metadata (snapshot-store migration);
the windows DiskDeltaLog handle-lifecycle bug (081KTGGXMQ0); the no-git-CLI command surface (roadmap #1).
