---
id: 081KTFA5QCG08QG0R003HRGQK1
type: task
state: backlog
priority: P2
slug: handoff-lior-rust-ts-ports-of-durability-primitives-conform
title: "HANDOFF Lior: Rust + TS ports of durability primitives (conform to golden vectors)"
created: 2026-06-06T20:32:14.224Z
depends_on: []
composes_with: []
---

# HANDOFF Lior: Rust + TS ports of durability primitives (conform to golden vectors)

<!-- Work-item body. ZetaId-keyed (conflict-free, time-sortable). "Backlog" is a
     STATE = this folder; completion moves the file to workitems/done/YYYY/MM/.
     Identity is the zetaid prefix — resolve cross-refs by `081KTFA5QCG08QG0R003HRGQK1-*.md` glob. -->

## HANDOFF → Lior (from Otto, 2026-06-06)

Port the durability primitives to **Rust and TypeScript** (the remaining two of the
4-lang leg toward PROVEN). Otto owns F#; Vera takes C#; you take Rust + TS.

### Scope

Port `DeltaLog` (append-only input-delta log) + `DeltaCodec` (CBOR via the
DynamicValue mapping) + recovery (snapshot + tail replay) to:

- `src/Core.Rust.*` (Rust)
- `src/Core.TypeScript/*` (TS)

### The hard constraint — conform to the byte-lock treaty

`src/Core/golden-vectors-deltacodec.json` is the treaty. Your CBOR encoder MUST
reproduce those exact hex bytes (empty=80, single=81820101, multi=82820101820203,
retraction=82820521820701) and decode them back to the same Z-set. Add the same
golden-vector test in each language (mirror the F# test in DeltaCodec.Tests.fs).
Culture-invariant / ordinal key order (ZSet canonical ascending).

### Pointers

- Treaty: `src/Core/golden-vectors-deltacodec.json` (+ existing `golden-vectors-cbor.json`
  for the DynamicValue CBOR base your encoder builds on).
- F# reference impls: `src/Core/DeltaLog.fs`, `DeltaCodec.fs`, `RecoverableSpine.fs`, `SnapshotStore.fs`.
- Design + PROVEN plan: workitem `081KTF9T0ER`; vision/durability docs under `docs/research/2026-06-06-*`.
- Rules: culture-invariant ordinal, honest async, the 11 manifesto specs, FoundationDB/Will-Wilson DST.
- Note: the disk ENTRY/FRAME format (length prefix + captured) is still being finalized
  (ZetaId-as-pointer + content-digest decision) — start with the in-memory log + the CBOR
  delta codec (both stable/locked); the disk frame port follows once the entry format lands.
