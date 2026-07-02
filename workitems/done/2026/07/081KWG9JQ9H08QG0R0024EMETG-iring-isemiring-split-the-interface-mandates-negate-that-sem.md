---
id: 081KWG9JQ9H08QG0R0024EMETG
type: bug
state: done
priority: P1
slug: iring-isemiring-split-the-interface-mandates-negate-that-sem
title: "IRing/ISemiring split — the interface mandates Negate that semirings provably cannot have (type-level lie, runtime throws)"
created: 2026-07-02T02:12:29.617Z
completed: 2026-07-02T03:25:48Z
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

- [x] **Soraya: TOWER-NEEDS-CHANGES** (2026-07-02). Proof endorsed (2-line,
      Gondran & Minoux 2008 already in `NovelMath.fs:27`); naming right per Golan
      (no `IRig` rung needed); **`IStarRing : IRing` rebase is FORCED** (this
      star is involution-star; Cayley–Dickson consumes `Negate` inside `Mul`,
      `CayleyDickson.fs:68`); Kleene algebras NOT blocked (future
      `IKleeneAlgebra : ISemiring` with `Star`, different branch — add a
      disambiguating docstring line to `IStarRing.cs`). **Formal anchor routing:**
      FsCheck law-pack in `tests/Tests.FSharp/Formal/` (semiring laws + IRing
      inverse law + star anti-homomorphism; `CliffordStarRing.Laws.Tests.fs` is
      the template) + ONE Z3 lemma (idempotent ∧ invertible ⇒ zero) via the
      existing `Z3.Laws.Tests.fs` harness; Lean is overkill (BP-16).
      **Bonus finding → 081KWGA0C7:** `IntervalRing` violates ring AND semiring
      laws (Negate not an inverse; Moore-1966 sub-distributivity) — demote with
      an on-file exception; law-pack first so the failure is witnessed.
- [x] **Kira: adversarial findings banked** (2026-07-02). Her P0-1 ("ZSetW/
      MergeKernel don't exist") was a STALE-VIEW artifact — she read the shared
      checkout before its refresh; the code is on main. The durable catches:
      * **P0-2 (scope-changing): the split is NOT C#-only.** `ISemiring` is
        mirrored in TS (`Core.TypeScript/algebra/interfaces.ts:17`), Python
        (`Core.Python/algebra/interfaces.py:23`), Q#
        (`AlgebraInterfaces.qs:27`, `SemiringNegate`), Go
        (`Core.Go/algebra/star_ring.go:16`), and BYTE-LOCKED IN THE IR:
        `tests/cross-verification/zeta-ir-v2/interfaces/semiring.ir.json`
        carries `Negate` AND the inverse law. The change must be ATOMIC across
        all oracles + a new `ring.ir.json`, or the codegen/law-drift tests fail.
      * Real retype surfaces beyond ZSetW: `WeightedSet.fs:85-89`
        (`negate`/`subtract`), `Core.CSharp/WeightedSet.cs:113,136`,
        `Semiring.Tests.fs:24` (`checkRingNegate` takes ISemiring).
      * Motivation honesty: the Tropical throw is LATENT (nothing routes Tropical
        through subtract today) — price as API hygiene + lie-removal, not a
        live-crash fix. Alternatives ranked: proposal wins (DIM-throw, IsRing
        flag, INegatable bolt-on, analyzer-only all rejected — "Ring" is the
        anchored term); clean break > [Obsolete] staging at ~0 consumers.
      * F# object-expression friction: none (verified across
        `CayleyDickson.fs:52,91`, `Cl3.fs:161`, `Semiring.fs:33,102`).
      * Doc-sweep list on land: `ISemiring.cs:4`, `Semiring.fs:7,15`,
        `ProbabilitySemiring.fs:13`, `Conjugate.fs:19`, `Chip8Cow.fs:269`,
        `BitGan.fs:15`, `DynamicValueNumeric.fs:11`, `IStarRing.cs:4`, Q#
        `SemiringNegate` name.
      * Unclaimed payoffs, now claimed: `ProbabilitySemiring` (ℚ) joins as
        `IRing`; `IRayTraceable.Trace(ISemiring)` legally accepts Tropical.
      * Sequencing: check backlog 081KS3X9Y (ZSetW phase-2 plan) — likely stale
        now that ZSetW landed; reconcile before implementation.
- [x] **Ilyana: APPROVE-WITH-CONDITIONS** (2026-07-02). "The ten-year test runs
      backwards here: the contract we could NOT keep for ten years is the current
      one" — removing Negate SHRINKS the surface; clean break correct pre-v1
      ([Obsolete] staging would ship the lie through the deprecation window).
      Naming canonical (keep ISemiring; IRing per Golan); in-assembly precedent:
      IGroup : IMonoid already earns Inverse via subinterface — the split makes
      the ring tower consistent with the existing group tower. Variance: nil
      (TWeight is invariant in this family; Semiring.fs:16's "generic variance"
      comment is inaccurate — fix in the doc sweep). New-contract watch:
      Trace(ISemiring) accepting Tropical = a forever promise that Trace never
      negates — witness it in the law-pack; future negation inside Trace becomes
      an IRing constraint, never a downcast.
      **CONDITIONS (merge gates):**
      1. Law-pack + Z3 lemma land BEFORE the interface change; IntervalRing's
         failures WITNESSED, then demoted with the on-file exception
         (081KWGA0C7); IntervalRing is never retyped IRing.
      2. Atomic across all six oracles + ring.ir.json; semiring.ir.json drops
         the Negate law in the same change.
      3. SemVer MAJOR bump on Zeta.Core.Abstractions + BREAKING release note.
      4. Kira's doc-sweep as merge gate, + Semiring.fs:16.
      5. Post-retype audit: zero `is IRing` runtime downcasts — capability flows
         by constraint only.
- [x] **Implementation LANDED (2026-07-02, atomic).** Surfaces: ISemiring.cs
      (Negate removed) + NEW IRing.cs + IStarRing.cs rebased (+ Kleene note);
      F# Semiring.fs (IntegerRing → IRing, Instance retyped; IntervalRing
      DEMOTED with the on-file exception, Negate deleted), NovelMath.fs
      (Tropical's throwing Negate DELETED), MergeKernel.fs (BoxedRing →
      semiring-tier), ZSetW negate/difference/negateBy/differenceBy → IRing,
      WeightedSet.fs negate/subtract → IRing; C# IntegerRing.cs → IRing,
      WeightedSet.cs Negate/Subtract → IRing; mirrors split in TS
      (interfaces.ts + IRing), Python (Ring class; RealSemiring retiered),
      Q# (SemiringNegate → RingNegate), Go (Semiring/Ring/StarRing embeds);
      IR treaty: semiring.ir.json drops Negate + inverse law, NEW ring.ir.json
      carries them, star-ring.ir.json extends IRing; generated law files
      regenerated (+ generated-ring-laws), codegen tests updated. Doc sweep
      (Kira's list + Semiring.fs:16) done. Version 2.0.0 + PackageReleaseNotes
      (Ilyana #3). Zero `is IRing` downcasts (Ilyana #5). ΔU measured to
      db/uncertainty/081KWG9JQ9H-iring-isemiring-split.md. Gates: full .NET
      build 0 warnings; 3777/3782 F# (1 TLC JVM flake, passes solo); 385 C#;
      284 TS; Go builds; Python parses.

Anchors: Golan, *Semirings and their Applications* (the rig/ring boundary);
Green–Karvounarakis–Tannen (provenance semirings — semiring-only by design);
DBSP/Budiu (retraction requires ℤ — the ring is why Z-sets work);
[[only-the-irreducible-is-primitive-generate-the-rest]];
`.claude/rules/dv2-data-split-discipline-activated.md` §13 noninterference.
