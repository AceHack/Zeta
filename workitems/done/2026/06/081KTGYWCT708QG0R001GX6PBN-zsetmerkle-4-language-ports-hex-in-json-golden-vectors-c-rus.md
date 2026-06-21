---
id: 081KTGYWCT708QG0R001GX6PBN
type: task
state: backlog
priority: P1
slug: zsetmerkle-4-language-ports-hex-in-json-golden-vectors-c-rus
title: "ZSetMerkle 4-language ports + hex-in-JSON golden vectors (C#/Rust/TS byte-lock of the canonical Merkle-over-Zset)"
created: 2026-06-07T11:53:23.015Z
depends_on: []
composes_with: ["081KTGTJC1Q08QG0R002VCB55A"]
---

# ZSetMerkle 4-language ports + hex-in-JSON golden vectors (C#/Rust/TS byte-lock of the canonical Merkle-over-Zset)

<!-- Work-item body. ZetaId-keyed (conflict-free, time-sortable). "Backlog" is a
     STATE = this folder; completion moves the file to workitems/done/YYYY/MM/.
     Identity is the zetaid prefix — resolve cross-refs by `081KTGYWCT708QG0R001GX6PBN-*.md` glob. -->

## Purpose (suggested owner: VERA)

Byte-lock the canonical Merkle-over-Z-set across all four oracles so the fs-Merkle backend (081KTGTJC1Q)
has the PROVEN-bar foundation. F# reference is LANDED: `src/Core/ZSetMerkle.fs` (`rootWith`/`root`, ordinal
key-byte canonicalization, length-prefixed `[4-LE keyLen][keyBytes][8-LE weight]` leaf, LE node combine,
odd-promote fold). Port to C#/Rust/TS and prove identical roots.

## Scope

- Port `ZSetMerkle.rootWith` to C# (`src/Core.CSharp.*`), Rust (`src/Core.Rust*`/oracle), TS
  (`src/Core.TypeScript/*`): same canonical leaf encoding + same fold; hash-parameterized (XxHash128 to
  match F# default today; structure must accept BLAKE3 later per the 081KT07NV0008QG0R001YDB73K-adjacent decision).
- **Golden vectors = hex-in-JSON** (NOT binary — `.claude/rules/no-binary-in-proof-lineage.md`): a shared
  `golden-vectors-zset-merkle.json` of (input Z-set entries) → (root hex), replayed identically by all four.
- Canonical order = ORDINAL key bytes (codepoint/UTF-8 byte order) — the same collation treaty as 081KT07NV0008QG0R001YDB73K;
  include NON-ASCII keys so the byte-consensus actually exercises ordinal.

## Acceptance

All four oracles produce identical roots for the shared hex-in-JSON vectors incl. non-ASCII keys; F# stays
the reference; vectors checked in + cross-verify test green in each language.

## Anchors

- `src/Core/ZSetMerkle.fs` (F# reference) · `src/Core/Merkle.fs` (MerkleHash/XxHash128) · 081KTGTJC1Q ·
  081KT07NV0008QG0R001YDB73K (ordinal collation = the key order) · no-binary-in-proof-lineage rule (hex-in-JSON) · 081KSXN940008QG0R003FCQ7WT
  (4-oracle master checklist).
