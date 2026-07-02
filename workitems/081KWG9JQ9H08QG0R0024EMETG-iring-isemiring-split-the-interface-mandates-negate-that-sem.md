---
id: 081KWG9JQ9H08QG0R0024EMETG
type: bug
state: backlog
priority: P1
slug: iring-isemiring-split-the-interface-mandates-negate-that-sem
title: "IRing/ISemiring split — the interface mandates Negate that semirings provably cannot have (type-level lie, runtime throws)"
created: 2026-07-02T02:12:29.617Z
depends_on: []
composes_with: []
---

# IRing/ISemiring split — the interface mandates Negate that semirings provably cannot have (type-level lie, runtime throws)

<!-- Work-item body. ZetaId-keyed (conflict-free, time-sortable). "Backlog" is a
     STATE = this folder; completion moves the file to workitems/done/YYYY/MM/.
     Identity is the zetaid prefix — resolve cross-refs by `081KWG9JQ9H08QG0R0024EMETG-*.md` glob. -->

## WHY — the Maxwell's-demon ledger (Aaron 2026-07-02: "track why")

The demon's discipline (noninterference §13 + Landauer): influence/failure must
enter only through **declared, metered channels**, and sorting costs measurement —
you pay somewhere, so pay at the CHEAPEST gate. Today the semiring/ring distinction
is metered at the most expensive gate there is: a **runtime
`InvalidOperationException`** inside `difference` over a Tropical weight, deep in a
DBSP fold, possibly in production. The type system — the compile-time demon that
could have sorted ring-shaped from semiring-shaped callers for free at the door —
is told a lie (`ISemiring` mandates `Negate`), so the sorting cost is deferred to
the most entropic place. **ΔU banked by this fix:** the entire bug class
"retraction attempted on an inverse-less algebra" moves from
runtime-throw-if-you're-lucky to does-not-compile. Ledger: `db/uncertainty/`
(measure on land, per every-bug-has-economic-value).

## IS THIS IRREDUCIBILITY? — yes, in the strict algebraic sense

The additive-inverse axiom is **THE** irreducible boundary between a semiring
(rig) and a ring — it is not a design preference we could paper over:

> **Theorem (why Tropical can never comply) — HISTORICALLY PROVEN, anchored
> (Aaron 2026-07-02: "only a TODO if it's a theorem and not a proven one from
> history"):** in an idempotent semiring (`a ⊕ a = a`, which min-plus is), if
> any `a` had an additive inverse then
> `0 = a ⊕ (−a) = (a ⊕ a) ⊕ (−a) = a ⊕ (a ⊕ (−a)) = a ⊕ 0 = a` — every
> invertible element is zero. An idempotent semiring with inverses is trivial.
>
> **The anchors (not our result — a classical one):**
> - **Vandiver 1934**, *Note on a simple type of algebra in which the
>   cancellation law of addition does not hold* (Bull. AMS 40) — the founding
>   semiring paper; its entire point is that such systems cannot be embedded
>   in rings (addition doesn't even cancel, let alone invert).
> - **Golan 1999**, *Semirings and their Applications*, ch. 1 & 4 — the
>   standard reference: `V(S)` = the additively-invertible elements; a
>   semiring is *zerosumfree* when `a ⊕ b = 0 ⇒ a = b = 0`, and **every
>   idempotent semiring is zerosumfree** (the 3-line argument above is the
>   textbook proof), so `V(S) = {0}`.
> - **Baccelli–Cohen–Olsder–Quadrat 1992**, *Synchronization and Linearity*
>   (the max-plus book), §3.2 — for dioids specifically: idempotency of
>   addition is INCOMPATIBLE with additive invertibility; max/min-plus is
>   their canonical system.
>
> So Tropical's missing `Negate` is a **proven classical theorem**, not a TODO.

Per `only-the-irreducible-is-primitive`: the free/irreducible object here is the
**semiring** (Zero/One/Add/Mul — the rules of the game); the **ring is the earned
quotient** (declare the added relation: additive inverse). The interface tower must
mirror the algebraic tower — anything else is the type system misreporting the
mathematics.

## The lie's existing casualties (in-repo evidence)

- `src/Core.Abstractions/ISemiring.cs` — docstring literally says "Semiring (ring)
  interface"; the conflation is written down.
- `src/Core/NovelMath.fs:75` — `TropicalSemiring.Negate` throws
  ("no additive inverse — use IntegerRing for retraction").
- `src/Core/Conjugate.fs:19-20,54` — refuses the interface: "forcing an `ISemiring`
  instance would be unlawful… fits a rig."
- `src/Core/ZSetW.fs` — `negate`/`difference` docstrings warn callers about the
  runtime throw the signature can't.
- Iris event-storm F5 (2026-07-02): first-consumer C# review ranked this
  correctness-adjacent, "worth doing now regardless."

## Proposed shape (pending math-team + adversarial + Ilyana review)

```csharp
public interface ISemiring<TWeight>            // the free object: Zero, One, Add, Mul
public interface IRing<TWeight> : ISemiring<TWeight>   // earned: + Negate
public interface IStarRing<TWeight> : IRing<TWeight>   // rebase: Cayley–Dickson towers negate
```

- `IntegerRing`, `IntervalRing` → `IRing`. `TropicalSemiring` → `ISemiring` only;
  its throwing `Negate` is DELETED (the bug class dies at the root).
- `ZSetW.negate/difference/negateBy/differenceBy` require `IRing`;
  `sum/scale/ofSeq/lookup` stay `ISemiring` (they never negate — MergeKernel
  unchanged).
- `SchemaZ` uses `ZSet` (ℤ — a ring) — unaffected but its "'W must be a full
  ring" caveat becomes a compile-time fact when generalised.
- Public-API change to published `Zeta.Core.Abstractions` → **Ilyana review
  required**; C# owns the interfaces (generic variance note in Semiring.fs).

## Review gates (Aaron 2026-07-02: "adversarial review? math team?")

- [ ] Math-team validation (Soraya routing): the tower's correctness, the
      idempotency theorem, whether an `IRig` rung or `IStarRing` rebase details
      are needed; recommend the formal anchor (FsCheck law / Lean statement).
- [ ] Adversarial review (Kira): breakage sweep of every ISemiring consumer,
      migration risk, alternatives (DIM default-throw considered-and-rejected?),
      API-shape attacks.
- [ ] Ilyana (public-api-designer) sign-off on the published-surface change.
- [ ] Implementation + full-suite + measure ΔU to `db/uncertainty/` on land.

Anchors: Golan, *Semirings and their Applications* (the rig/ring boundary);
Green–Karvounarakis–Tannen (provenance semirings — semiring-only by design);
DBSP/Budiu (retraction requires ℤ — the ring is why Z-sets work);
[[only-the-irreducible-is-primitive-generate-the-rest]];
`.claude/rules/dv2-data-split-discipline-activated.md` §13 noninterference.
