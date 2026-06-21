---
id: 081KTH323AK08QG0R000ZZ0N93
type: task
state: completed
priority: P1
slug: 4-language-catch-up-umbrella-port-this-session-s-f-substrate
title: "4-language catch-up UMBRELLA: port this session's F# substrate (store/interop/Evolution/collation) to C#/Rust/TS with golden vectors"
created: 2026-06-07T13:06:24.211Z
depends_on: []
composes_with: ["081KTGYWCT708QG0R001GX6PBN", "081KTGYWCTT08QG0R001G96DXY", "081KTH0HFZ808QG0R003XH35YX"]
---

# 4-language catch-up UMBRELLA: port this session's F# substrate (store/interop/Evolution/collation) to C#/Rust/TS with golden vectors

<!-- Work-item body. ZetaId-keyed (conflict-free, time-sortable). "Backlog" is a
     STATE = this folder; completion moves the file to workitems/done/YYYY/MM/.
     Identity is the zetaid prefix — resolve cross-refs by `081KTH323AK08QG0R000ZZ0N93-*.md` glob. -->

## Dispatch board (full split — 4-lang / 4-serial / math-leg / others)

The splittable work-list (every F# component from this session, by leg) is in
`docs/research/2026-06-07-team-dispatch-board-vera-lior-4lang-4serial-mathleg-otto.md`. Adds since this
item: ContentHash256, EvolutionWindow, LwwMap, Rga, CasStore (all F#-done, need 4-lang + serial + math-leg).

## Purpose (for VERA + LIOR — the 4-lang catch-up)

The last several hours landed a large F# substrate (COW store + interop + Evolution + collation) with NO
C#/Rust/TS parity. This umbrella tracks porting it so the 4-oracle byte-consensus holds. F# is the
reference; all ports get **hex-in-JSON golden vectors** (`.claude/rules/no-binary-in-proof-lineage.md`).

## What landed in F# this session (the port surface)

| F# module (src/Core unless noted) | What | Port priority |
|---|---|---|
| `ZSetMerkle` | canonical Merkle-over-Z-set root | P1 (`081KTGYWCT7`) |
| `Collation` + GSet/ZSet/IndexedZSet ordinal fix (081KT07NV0008QG0R001YDB73K) | binary/ordinal collation default | P1 (`081KTGYWCTT`) |
| `SchemaEvolution` (+ registry) | migration algebra, down-direction, dump | P2 (`081KTH0HFZ8`) |
| `ContentStore` | content-addressed single-instance COW store | NEW |
| `DagFs` | multi-parent file tree + 2 edit modes | NEW |
| `DvKey` | content-addressed comparable DynamicValue row key | NEW |
| `DebeziumCdc` | read/write Debezium CDC ↔ Z-set delta | NEW |
| `CloudEvents` | CNCF v1.0 envelope over DynamicValue | NEW |
| `IContentHasher` port + `ContentHasher` (xxhash128) | hexagonal hashing port | NEW |
| `Core.Blake3.Blake3Hasher` | BLAKE3 adapter | NEW + 4-lang byte-lock anchor |

## 4-language BLAKE3 byte-lock (route for team input)

The F# BLAKE3 adapter truncates BLAKE3-256 to a 128-bit `MerkleHash` = **first 16 bytes, little-endian**
(lo = bytes[0..8), hi = bytes[8..16)). Known-answer locked: `BLAKE3("")` → **`49c9dc36ea4d40a0a6a1f9f5b94913af`**.
**Every oracle must reproduce this** (Rust BLAKE3 native, TS `blake3`/wasm, C# Blake3) with the SAME
truncation convention. Get the team's input on: (a) is 128-bit truncation acceptable vs full 256-bit
`MerkleHash`? (b) confirm the LE truncation convention across langs. This is the cross-language treaty for
the content address.

## Acceptance

Each NEW module above has a C#/Rust/TS port + a shared hex-in-JSON golden-vector cross-verify (incl. the
BLAKE3 known-answer + ZSetMerkle roots + Debezium round-trip + collation ordinal). F# stays reference.

## Anchors

- the per-module workitems (081KTGYWCT7 / 081KTGYWCTT / 081KTH0HFZ8) · 081KSXN940008QG0R003FCQ7WT (4-oracle master checklist) ·
  081KT07NV0008QG0R001YDB73K (collation) · 081KTGTJC1Q (the store) · no-binary-in-proof-lineage (hex-in-JSON).
