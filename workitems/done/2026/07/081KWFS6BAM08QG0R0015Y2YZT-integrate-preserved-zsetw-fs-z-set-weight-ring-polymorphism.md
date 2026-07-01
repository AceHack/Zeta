---
id: 081KWFS6BAM08QG0R0015Y2YZT
type: task
state: superseded
priority: P2
slug: integrate-preserved-zsetw-fs-z-set-weight-ring-polymorphism
title: "Integrate preserved ZSetW.fs z-set weight-ring polymorphism (ex-b0697) from quarantine into Core build"
created: 2026-07-01T21:26:06.932Z
completed: 2026-07-01T22:47:46Z
resolution: superseded-by-WeightedSet.fs; unification split to 081KWFXTHJY08QG0R001TKNG0S
depends_on: []
composes_with: []
---

# Integrate preserved ZSetW.fs z-set weight-ring polymorphism (ex-b0697) from quarantine into Core build

<!-- Work-item body. ZetaId-keyed (conflict-free, time-sortable). "Backlog" is a
     STATE = this folder; completion moves the file to workitems/done/YYYY/MM/.
     Identity is the zetaid prefix — resolve cross-refs by `081KWFS6BAM08QG0R0015Y2YZT-*.md` glob. -->

## Why this exists (Otto, 2026-07-01)

The orphan-branch quarantine campaign preserved a unique F# z-set algebra extension
(the old `b0697` z-set-polymorphism-over-weight-ring line) that never landed on
`main`. Preserved, build-excluded, in the quarantine archive. Filed so the unique
work isn't lost in the archive — needs proper integration, not a bare file-move.

## Preserved source (the only copies)

- `docs/recovered-orphan-branches-2026-05/misc/backlog/b0697-zset-polymorphism-weight-ring/src/Core/ZSetW.fs`
- `docs/recovered-orphan-branches-2026-05/misc/backlog/b0697-zset-polymorphism-weight-ring/tests/Tests.FSharp/Algebra/ZSetW.Tests.fs`
- `docs/recovered-orphan-branches-2026-05/misc/backlog/b0367-zset-semiring-parameterization/tests/Tests.FSharp/Algebra/ZSet.Polymorphic.Tests.fs` (related b0367 semiring-parameterization tests)

## What it is

A weight-ring-parameterized Z-set (`ZSetW`) — generalizing `src/Core/ZSet.fs` from
integer weights to an arbitrary semiring/ring weight (first-class uncertainty
semiring, per ex-B-0367). The DBSP/Z-set core parameterized over its weight algebra.

## Integration steps (definition of done)

1. Read `ZSetW.fs` + tests; check API drift against current `src/Core/ZSet.fs`
   (the shipped Z-set has evolved since May — this may need reconciliation).
2. If it still adds value: move to a new `ZSetW.fs` under `src/Core/` + tests to
   `tests/Tests.FSharp/Algebra/`, register in `Core.fsproj` / `Tests.FSharp.fsproj`.
3. Honor the ordinal-collation parity requirement (see `culture-invariant-by-default`
   — the `GCounter.Merge` vs `ZSet.ofSeq` associativity bug lives in this area).
4. `dotnet build -c Release` (0 warnings) + `dotnet test` green. Drop quarantine copies on land.

---

## RESOLUTION (Otto, 2026-07-01): SUPERSEDED — not landed

The "if it still adds value" gate (step 2) is **not met**. `src/Core/WeightedSet.fs`
(Aaron, 2026-06-07 — after the May b0697 branch) already delivers the polymorphic
weighted-set-over-`ISemiring` capability ZSetW was written for: identical op set
(`ofSeq / singleton / add / negate / subtract / scale / weight` + `inner / mapKeys /
sum`), live with 6 consumers. Landing ZSetW as-is would be a **duplicate type** —
accidental complexity (Rodney's Razor / only-the-irreducible-is-primitive).

The ONE non-redundant idea in ZSetW — its sorted-`ImmutableArray` storage
(byte-identical to `ZSet<'K>`, the representation from which `type ZSet<'K> =
ZSetW<'K,int64>` unification is reachable, which WeightedSet's `Map` storage is
not) — is split out as its own scoped design pass: **081KWFXTHJY08QG0R001TKNG0S**.

The preserved `ZSetW.fs` stays in the quarantine as the revive-from reference for
that unification work-item; not deleted, not landed here.
