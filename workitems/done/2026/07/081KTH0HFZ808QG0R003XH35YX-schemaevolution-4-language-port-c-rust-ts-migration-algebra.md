---
id: 081KTH0HFZ808QG0R003XH35YX
type: task
state: closed
priority: P2
slug: schemaevolution-4-language-port-c-rust-ts-migration-algebra
title: "SchemaEvolution 4-language port (C#/Rust/TS): migration algebra + down-direction + dump, with golden vectors"
created: 2026-06-07T12:22:22.952Z
depends_on: []
composes_with: ["081KSRGFP0008QG0R001Y6RTY9", "081KTGYQ3A508QG0R002Y8Y5N2"]
---

# SchemaEvolution 4-language port (C#/Rust/TS): migration algebra + down-direction + dump, with golden vectors

<!-- Work-item body. ZetaId-keyed (conflict-free, time-sortable). "Backlog" is a
     STATE = this folder; completion moves the file to workitems/done/YYYY/MM/.
     Identity is the zetaid prefix — resolve cross-refs by `081KTH0HFZ808QG0R003XH35YX-*.md` glob. -->

## Purpose (suggested owner: LIOR or VERA)

Port the now-BUILT F# SchemaEvolution algebra to the other three oracles for 4-lang parity (the "Evolution"
zero-downtime migration proof is the F# reference; 081KSRGFP0008QG0R001Y6RTY9). F# surface (`src/Core/SchemaEvolution.fs`):
migration algebra (addField/removeField/renameField, total over DynamicValue, order-respecting),
forward/backward compat, `migrate`, the down-direction (`migrateDown` + invertibility taxonomy:
add/rename lossless, removeField lossy), and the garbage-dump variant
(`removeFieldWithDumpMigration`/`stashToDump`/`restoreFromDump`/`dropDump`, position-exact).

## Scope

- C# (`src/Core.CSharp.*`), Rust, TS (`src/Core.TypeScript/*`) ports with identical semantics.
- **hex-in-JSON golden vectors** (`.claude/rules/no-binary-in-proof-lineage.md`): shared
  `golden-vectors-schema-evolution.json` of (input value, migration ops, version range) -> (output value),
  replayed identically by all four incl. the down-direction round-trips + the dump position-exact restore.
- Match the F# round-trip LAWS (down∘up = id for lossless; lossy = named default; dump = position-exact).
  Ordinal/collation per 081KT07NV0008QG0R001YDB73K (object key order is the binary collation treaty).

## Acceptance

All four oracles agree on the shared schema-evolution golden vectors (up, down, dump round-trip); F# stays
reference; cross-verify test green per language.

## Anchors

- `src/Core/SchemaEvolution.fs` (F# reference, built + FsCheck-proven) · `tests/Tests.FSharp/SchemaEvolution.Tests.fs`
  · 081KSRGFP0008QG0R001Y6RTY9 · 081KTGYQ3A5 (Evolution extension) · 081KT07NV0008QG0R001YDB73K (key collation) · no-binary-in-proof-lineage (hex-in-JSON).
