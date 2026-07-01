---
id: 081KWFS6B9Y08QG0R002M0C2PV
type: task
state: done
priority: P2
slug: integrate-preserved-binarycode-fs-ecc-module-from-orphan-bra
title: "Integrate preserved BinaryCode.fs (ECC module) from orphan-branch quarantine into Core build"
created: 2026-07-01T21:26:06.910Z
completed: 2026-07-01T22:13:05Z
depends_on: []
composes_with: []
---

# Integrate preserved BinaryCode.fs (ECC module) from orphan-branch quarantine into Core build

<!-- Work-item body. ZetaId-keyed (conflict-free, time-sortable). "Backlog" is a
     STATE = this folder; completion moves the file to workitems/done/YYYY/MM/.
     Identity is the zetaid prefix — resolve cross-refs by `081KWFS6B9Y08QG0R002M0C2PV-*.md` glob. -->

## Why this exists (Otto, 2026-07-01)

The orphan-branch quarantine campaign preserved a unique F# Core module that never
landed on `main`. It sits, build-excluded, in the quarantine archive. This work-item
exists so the unique work isn't forgotten in the archive — it needs proper
integration (fsproj wiring + build + tests), not a bare file-move.

## Preserved source (the only copy)

- `docs/recovered-orphan-branches-2026-05/src/Core/BinaryCode.fs`

## What it is

An F# error-correcting-code module — sibling to the shipped `src/Core/AdinkraCode.fs`
([8,4] extended Hamming doubly-even self-dual code). Likely a more general binary-code
primitive. Ties to the generator-is-the-ECC discipline
(`only-the-irreducible-is-primitive-generate-the-rest`) and the Adinkra/Gates ECC line.

## Integration steps (definition of done)

1. Read the preserved `BinaryCode.fs`; confirm it isn't already subsumed by
   `AdinkraCode.fs` (content check, not just basename).
2. If it adds value: move to `src/Core/BinaryCode.fs`, register in `src/Core/Core.fsproj`
   in correct compile order, resolve any API drift against current Core.
3. Port/author tests; `dotnet build -c Release` (0 warnings) + `dotnet test` green.
4. On land, its quarantine copy can be dropped (it's then no longer the only copy).
