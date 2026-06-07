---
id: 081KTGD5JMD08QG0R000CEZ1D5
type: task
state: backlog
priority: P1
slug: log-noun-canonical-entry-byte-lock-deltalogentry-seq-delta-c
title: "Log noun canonical entry byte-lock (DeltaLogEntry: Seq+Delta+Captured) — all-lang/all-ser, replace ad-hoc System.Text.Json; completes the 3-noun data-plane proven base"
created: 2026-06-07T06:43:49.517Z
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
B-0969 precedent) for cross-language/DST determinism. This is exactly why `Log` isn't proven.

## What (the canonical encoding)

Define ONE canonical entry encoding, CBOR (RFC 8949, matching the DynamicValue/ZSet exemplars), shared
by every backend and all four oracles. The new byte-lock surface is just the **envelope** around the
already-locked `Delta`:
- `Seq : int64` — CBOR integer.
- `Delta : ZSet<'K>` — reuse the existing canonical ZSet CBOR (already 4/4 locked).
- `Captured : Map<string,string>` — CBOR map with **ordinal-sorted keys** (deterministic; the one real
  decision). Empty map when the producer was pure.
- Entry framing: a fixed 3-element CBOR array `[Seq, DeltaCbor, CapturedCbor]` (order-fixed, not a
  by-name map, to avoid key-ordering questions on the envelope itself).

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
- Master checklist: **B-0959** (sovereign distributed DB, one git-native Z-set substrate)
- Exemplars to mirror: DynamicValue CBOR (`src/Core.TypeScript/dynamic-value/golden-vectors-cbor.json`),
  ZSet (`src/Core.TypeScript/z-set/golden-vectors.json`)
- Code to migrate: `src/Core/DeltaLog.fs`, `src/Core.Git/GitDeltaLog.fs`, `src/Core/DiskDeltaLog.fs`
- Discipline: `.claude/rules/culture-invariant-by-default.md` (ordinal `Captured` keys),
  `.claude/rules/no-binary-in-proof-lineage.md` (hex-in-JSON golden vectors)
