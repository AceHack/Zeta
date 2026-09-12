---
id: 081M29N1AX9087G0R001GSJD6G
type: bug
state: backlog
priority: P2
slug: iring-over-sedenion-asserts-a-contract-168-of-343-octonion-t
title: "IRing over Sedenion asserts a contract 168 of 343 octonion triples refute"
created: 2026-09-12T01:52:12.713Z
depends_on: []
composes_with: []
---

# IRing over Sedenion asserts a contract 168 of 343 octonion triples refute

<!-- Work-item body. ZetaId-keyed (conflict-free, time-sortable). "Backlog" is a
     STATE = this folder; completion moves the file to workitems/done/YYYY/MM/.
     Identity is the zetaid prefix — resolve cross-refs by `081M29N1AX9087G0R001GSJD6G-*.md` glob. -->

## Measured

Standalone rebuild of `CayleyDickson.fs` + `IStarRing.cs`, `dotnet 10.0.400`,
exhaustive over the basis (Ilyana, 2026-09-11):

| law | rung | result |
|---|---|---|
| `Mul` commutativity | 𝕆 | **42 of 49** basis pairs are counterexamples |
| `Mul` associativity | 𝕆 | **168 of 343** basis triples are counterexamples |
| zero divisors | 𝕊 | **84** pairs with both factors nonzero; first `(e₁+e₁₀)(e₅+e₁₄)` |
| `IRing<Sedenion>` upcast | 𝕊 | **compiles, zero compiler objection** |

A ring is associative by definition. `Doubled.algebra` applied three times returns a
value typed `IStarRing<Octonion> :> IRing<Octonion>` which **is not a ring**.

## Why it is not simply a bug to fix

`src/Core.Abstractions/IStarRing.cs` already discloses it, in its own words:

> *"Law profile (carried as documentation, not types): `Add` is always commutative +
> associative; `Mul` loses commutativity above ℂ, associativity above ℍ, and
> alternativity above 𝕆. … the per-instance `Mul` guarantees are the caller's
> responsibility."*

That is an honest disclosure and it is credited. It is also, exactly, **a guarantee with
no falsifier** — the vacuity class relocated from the code into the prose. And by
Hurwitz (1898) the law loss is *forced*: normed division algebras exist only at
dimension 1, 2, 4, 8. The algebra is not wrong; the **interface** claims more than the
algebra delivers.

## The structural diagnosis

The two towers run in **opposite directions**:

```
ISemiring  ⊂  IRing  ⊂  IStarRing     capability ADDED going up
ℝ → ℂ → ℍ → 𝕆 → 𝕊                    laws LOST going up
```

Subtyping expresses only *more capability*. Losing a law going up is not a subtype
relation in either direction, so interface inheritance is the wrong instrument and no
encoding repairs it. **Capability and law are being carried on one inheritance chain and
they are not the same axis.**

The same root cause produces the other open rung problem: a belief weight needs a **star
without an additive inverse**, and `IStarRing : IRing` makes `Conj` reachable only
through `Negate`. One consumer's constraint (CD doubling consumes `Negate` inside `Mul`)
was promoted into the shape of the interface for all consumers.

## Proposed direction — laws as an independent axis

Witness values, the same Curry–Howard move already measured working for type-level
addition:

```fsharp
type Associative<'W> = private AssocW of unit   // constructible ONLY where a proof exists
let liftAssoc : Associative<'A> -> ...          // NOT total: ℍ→𝕆 has no such lift
```

The octonion rung then has no `Associative<Octonion>` to hand out, and an operation
needing associativity is refused at the right rung.

**Falsifier:** if `Associative<Octonion>` turns out constructible by any path, the
witness is decoration and the scheme is refuted. Build internal first.

## Not urgent, and explicitly not a regression

This predates the review that found it and nothing is newly broken. What it must not do
is get **replicated** by the n-ary weight family now being designed — an n-fold product
of a non-commutative weight is non-commutative, and `ISemiring` says so no more than
`IRing<Sedenion>` says the sedenions have zero divisors. `IntervalRing` is the precedent
to follow: demoted to `ISemiring`, demotion documented, exception `081KWGA0C7` on file.

Source: `docs/research/2026-09-11-n-degree-tuples-as-n-type-parameters-f-sharp-encodings-measured.md` §A.
