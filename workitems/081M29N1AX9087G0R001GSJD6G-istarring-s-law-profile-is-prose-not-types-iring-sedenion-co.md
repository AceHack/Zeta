---
id: 081M29N1AX9087G0R001GSJD6G
type: bug
state: backlog
priority: P2
slug: istarring-s-law-profile-is-prose-not-types-iring-sedenion-co
title: "IStarRing's law profile is prose, not types: IRing<Sedenion> compiles and is not a ring"
created: 2026-09-11T00:00:00.000Z
depends_on: []
composes_with: []
---

# IStarRing's law profile is prose, not types: IRing&lt;Sedenion&gt; compiles and is not a ring

<!-- Work-item body. ZetaId-keyed (conflict-free, time-sortable). "Backlog" is a
     STATE = this folder; completion moves the file to workitems/done/YYYY/MM/.
     Identity is the zetaid prefix — resolve cross-refs by `081M29N1AX9087G0R001GSJD6G-*.md` glob. -->

## This ID was cited in commits and PRs before it was filed

The id was in circulation — PR #17319 (CAS prior-art survey) and the law-axis prototype PR
both carry it in their `Task:` trailer — and **no work-item file existed for it**, so
`audit-task-zetaid-resolves.ts` had a well-formed key identifying nothing. Filed under the
cited ID rather than minting a fresh one, exactly as `081KSNY2Z0008QG0R002JKH50A` was, so the
references resolve instead of pointing at a hole.

## The defect

`src/Core.Abstractions/IStarRing.cs` discloses its own gap honestly:

> **Law profile (carried as documentation, not types):** `Add` is always commutative +
> associative; `Mul` loses commutativity above ℂ, associativity above ℍ, and alternativity
> above 𝕆. … The interface is a lawful dictionary of operations; the per-instance `Mul`
> guarantees are the caller's responsibility.

That is a guarantee with no falsifier — the vacuity class relocated out of the code and into
the prose. `IStarRing<Sedenion> : IRing<Sedenion>` compiles with zero compiler objection and
is not a ring.

## Measured, exhaustively, over the repo's own `ImaginaryStack`

| claim | measurement |
|---|---|
| `Mul` is not commutative at 𝕆 | **42 of 49** imaginary-basis pairs refute it |
| `Mul` is not associative at 𝕆 | **168 of 343** imaginary-basis triples refute it |
| 𝕊 has zero divisors | **84** ordered pairs of `eᵢ + eⱼ` (1 ≤ i &lt; j ≤ 15) multiply to zero, both factors non-zero |
| control: 𝕆 is a division algebra | the identical sweep over 𝕆 finds **0** |

Reproduced twice independently — once in Python from the doubling rule, once in F# from
`ImaginaryStack` — and pinned in `tests/Tests.FSharp/Algebra/LawWitness.Tests.fs` §B.

By Hurwitz (1898) the law loss is **forced**, so the algebra is not wrong. The interface
claims more than it delivers.

## Second defect, found while prototyping (Lumen §3.5)

`IStarRing : IRing` makes an involution imply an additive inverse. The belief pair
`(support, refutation)` has a natural involution — coordinate swap — and no additive inverse,
because its `⊕` is idempotent. Today that weight is inexpressible: to give it a `Conj` you
must first give it a `Negate` it does not have. Same root cause, different symptom.

## Prior art (PR #17319)

FriCAS/Axiom solved the structural half in 1990: `Algebra(R) == Join(Ring,
NonAssociativeAlgebra(R))` — the associative algebra is the DESCENDANT of the non-associative
one, and `OctonionCategory` joins **two** parents, so it is a lattice rather than a chain.
Sage withholds `.Associative()` deliberately and has no `Alternative` axiom at all. Both
systems land on the same prose disclosure for the laws their types do not carry, and both pay
for it with a **shipped falsifier** — FriCAS `associative?()`, GAP `IsAssociative` — each
enumerating basis triples and checking the associator, which is the measurement above.

No surveyed system models sedenions.

## Disposition

Two prototypes landed internally (`src/Core/LawWitness.fs`, `src/Core/LawRung.fs`) with the
falsifier, the comparison, and a recommendation: **the lattice**. Changing the shipped
`IStarRing` / `IRing` tower is a separate, larger decision and is deliberately NOT part of
that PR — the defect above is still present and still reachable, by design and by test.
