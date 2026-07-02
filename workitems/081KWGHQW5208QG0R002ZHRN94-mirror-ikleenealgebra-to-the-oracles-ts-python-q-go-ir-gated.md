---
id: 081KWGHQW5208QG0R002ZHRN94
type: task
state: backlog
priority: P3
slug: mirror-ikleenealgebra-to-the-oracles-ts-python-q-go-ir-gated
title: "Mirror IKleeneAlgebra to the oracles (TS/Python/Q#/Go + IR) — GATED on the first cross-language consumer"
created: 2026-07-02T04:35:07.042Z
depends_on: []
composes_with: []
---

# Mirror IKleeneAlgebra to the oracles (TS/Python/Q#/Go + IR) — GATED on the first cross-language consumer

<!-- Work-item body. ZetaId-keyed (conflict-free, time-sortable). "Backlog" is a
     STATE = this folder; completion moves the file to workitems/done/YYYY/MM/.
     Identity is the zetaid prefix — resolve cross-refs by `081KWGHQW5208QG0R002ZHRN94-*.md` glob. -->

## Trigger (Aaron 2026-07-02: "mirror … when a consumer lands, yes please")

FIRE THIS WORK-ITEM when — and only when — the FIRST cross-language consumer of
`IKleeneAlgebra` appears (a TS/Python/Q#/Go call site, or a NuGet/package publish
that exposes it). Until then it stays C#/F#-only by design (no-speculative-surface;
the same gate as the Roslyn generator, 081KWFXTHJY step 4). `IKleeneAlgebra` shipped
C#/F# in #9111 with the tropical Kleene star + all-pairs shortest paths.

## Why gated, not done now

Mirroring an interface to five more surfaces + the byte-locked IR is real, atomic
cost (Kira's P0-2 on the ISemiring split: any change to a mirrored interface must
be atomic across ALL oracles + the IR or the codegen/law-drift gates fail). Paying
that for zero consumers is speculative surface. The ISemiring split HAD to be atomic
because it was ALREADY mirrored; IKleeneAlgebra is new and mirrored nowhere, so it
carries no such obligation yet.

## Recipe (when it fires — mirror ATOMICALLY, one change)

1. **IR treaty:** new `tests/cross-verification/zeta-ir-v2/interfaces/kleene-algebra.ir.json`
   — `extends: ["ISemiring"]`, member `Star` (TWeight→TWeight), law
   `Star(a) = One ⊕ (a ⊗ Star(a))` with a proof pointer; regenerate
   `generated-kleene-algebra-laws.test.ts`; add the case to
   `codegen-law-drift.test.ts` + `codegen-interface.test.ts`.
2. **Oracle mirrors** (match the ISemiring/IStarRing shapes already there):
   - TS `src/Core.TypeScript/algebra/interfaces.ts` (or star-ring.ts) — `IKleeneAlgebra<T> extends ISemiring<T>` + `star(a)`.
   - Python `src/Core.Python/algebra/interfaces.py` — `class KleeneAlgebra(Semiring[T])` with `star`.
   - Q# `src/Core.QSharp.ReferenceOracle/AlgebraInterfaces.qs` — `KleeneStar` fn.
   - Go `src/Core.Go/algebra/star_ring.go` — `KleeneAlgebra[T] interface { Semiring[T]; Star(a T) T }`.
   Each with a comment disambiguating KLEENE star (iteration) from IStarRing's
   involution star (Conj) — the distinction Soraya flagged.
3. Gate: full build 0 warnings; codegen-interface + law-drift + generated-*-laws
   all green (the 6-surface treaty holds); the consumer that triggered this uses it.

Anchors: #9111 (the C#/F# landing), 081KWG9JQ9H (the split + Kira's atomicity rule),
081KWFXTHJY step 4 (the sibling gated-on-consumer decision). Lehmann 1977 / Kozen 1994.
