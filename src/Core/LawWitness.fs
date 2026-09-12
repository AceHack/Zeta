namespace Zeta.Core

open System

/// # Laws as an INDEPENDENT AXIS — prototype ONE of two (081M29N1AX9087G0R001GSJD6G)
///
/// > **NOT THE RECOMMENDED FORM. See `LawRung.fs`, which is.** This module is kept because
/// > the comparison is the deliverable: it was built first, it works, and the two defects
/// > measured in it — a witness that cannot say WHICH operation it is about, and a
/// > constructor that is private only to the F# compiler — are the evidence for preferring
/// > the inverted tower. Both defects are demonstrated by passing tests in
/// > `tests/Tests.FSharp/Algebra/LawWitness.Tests.fs` (§D and §F).
///
/// > **A CORRECTION IS RECORDED BELOW.** The paragraph beginning "Subtyping can only express
/// > *more capability*" originally ended "…so no inheritance arrangement and no encoding
/// > repairs it." That was **wrong**, and FriCAS has shipped the counterexample since 1990.
/// > The refutation and what replaces it are in `LawRung.fs`; the claim is corrected in place
/// > below rather than quietly deleted.
///
/// ## The defect this prototype answers
///
/// `IStarRing&lt;Sedenion&gt;` compiles with zero compiler objection and is not a ring.
/// `IStarRing.cs` discloses the reason honestly — *"law profile carried as documentation,
/// not types … the per-instance `Mul` guarantees are the caller's responsibility"* — which
/// is a guarantee with no falsifier: the vacuity class relocated out of the code and into
/// the prose. By Hurwitz (1898) the law loss is FORCED, so the algebra is not wrong; the
/// INTERFACE claims more than it delivers.
///
/// The structural diagnosis is that two orderings run in opposite directions along one chain:
///
///     ISemiring ⊂ IRing ⊂ IStarRing     capability ADDED going up
///     ℝ → ℂ → ℍ → 𝕆 → 𝕊                 laws LOST going up
///
/// **Corrected 2026-09-11 (PR #17319 survey).** This was written as "subtyping can only
/// express *more capability*, so no inheritance arrangement and no encoding repairs it."
/// The premise is sound — capability and law are genuinely different axes — but the
/// conclusion does not follow, and is false: the algebra chain was drawn upside down. In
/// FriCAS the ASSOCIATIVE algebra is the DESCENDANT of the non-associative one, so losing a
/// law is moving TOWARD the root, which is a supertype relation that subtyping expresses
/// natively. `LawRung.fs` is that repair. What survives the correction is the narrower and
/// still-true claim: **an interface that names an operation does not thereby constrain it**,
/// which is why `IStarRing<Sedenion>` compiles.
///
/// ## The move
///
/// Take the laws OFF the interface chain and make them values on their own axis. A law is a
/// WITNESS: an opaque token whose constructor is private, so it can only be obtained from a
/// base case that is true or from a LIFT that is deliberately PARTIAL.
///
///   * `Commutative&lt;'W&gt;` lifts across doubling only from a SELF-CONJUGATE rung (ℝ alone),
///     so ℂ has one and ℍ does not.
///   * `Associative&lt;'W&gt;` lifts only from a rung that is BOTH commutative and associative,
///     so ℍ has one and 𝕆 does not.
///   * `Alternative&lt;'W&gt;` lifts only from an ASSOCIATIVE rung, so 𝕆 has one and 𝕊 does not.
///   * `NoZeroDivisors&lt;'W&gt;` lifts only from an ASSOCIATIVE rung (the composition-algebra
///     step of Hurwitz's theorem), so 𝕆 has one and 𝕊 does not.
///
/// The octonion rung therefore simply HAS NO `Associative&lt;Octonion&gt;` to hand out, and an
/// operation that reassociates a product is refused at that rung by the compiler rather
/// than by a sentence in a docstring. The sedenion rung has no witness of any kind.
///
/// Every lift above is the classical Cayley–Dickson theorem, not a design choice:
/// R. D. Schafer, *On the algebras formed by the Cayley–Dickson process*, Amer. J. Math.
/// 76 (1954) 435–446; A. Hurwitz, *Über die Composition der quadratischen Formen von
/// beliebig vielen Variablen* (1898) for the composition-algebra step; J. Baez, *The
/// Octonions*, Bull. AMS 39 (2002) 145–205 for the modern exposition.
///
/// ## THE HOLE THAT WAS FOUND — the guarantee is F#-COMPILE-TIME, not IL-level
///
/// The falsifier was run before the tests were written and it found a real escape. Both
/// obvious F# spellings were compiled and probed, by reflection and by cross-assembly
/// compilation:
///
///     spelling                                         F# other assembly   C# with IVT           IL visibility
///     type Associative&lt;'W&gt; = private AssocW of string   REFUSED  FS1093     MINTS .NewAssocW(..)  case factory = assembly
///     [&lt;Sealed&gt;] type Associative&lt;'W&gt; private (rung)    REFUSED  FS0801     MINTS new Assoc(..)   .ctor = public
///
/// Both C# forgeries compiled clean in a project named `Tests.CSharp`, which is on the
/// `InternalsVisibleTo` list in `AssemblyInfo.fs`. So F#'s `private` — on a union
/// representation OR on a primary constructor — is enforced by the F# COMPILER and is not
/// reduced to IL `private`: the union case is clamped UP to the enclosing module's
/// `assembly` accessibility, and the primary constructor is simply emitted `public` on a
/// non-public type. The usual way to bottom this out, a private nested seal type, is not
/// available either — F# rejects nested type definitions outright (`FS0058`).
///
/// **What the scheme therefore does and does not claim.** `Associative&lt;Octonion&gt;` is
/// unconstructible from F# — which is all of `Zeta.Core` and every F# consumer — and
/// constructible from C# inside the IVT boundary, or by reflection from anywhere. That is a
/// genuine limit, not a footnote, and it is pinned by tests rather than left in prose: the
/// measured IL visibility of every witness constructor is asserted so a change is noticed,
/// and each escape is demonstrated in a named, passing test.
///
/// The sealed-class spelling is kept over the union spelling because it is the tighter of
/// the two for F# callers (`FS0801` on the type itself rather than `FS1093` on one case) and
/// because it exposes no named `NewAssocW` factory to C# IntelliSense. Neither of those is a
/// proof, and this comment does not claim one.
///
/// ## Register — this is a `toy` and is labelled so on purpose
///
/// Per `.claude/rules/toy-is-free-metered-must-be-earned.md` this module is a PROTOTYPE.
/// It does not change `IStarRing`, it is `internal`, and it ships with its own falsifier:
/// if `Associative&lt;Octonion&gt;` turns out constructible by any path, the witness is
/// decoration and the scheme is refuted.
/// `tests/Tests.FSharp/Algebra/LawWitness.Tests.fs` hunts for exactly that path by
/// reflection over the producer graph, and records — as passing, documenting tests — which
/// escapes remain and which of them this module can catch.
///
/// ## Accessibility is load-bearing
///
/// `internal`: `src/Core/Core.fsproj` carries `&lt;PackageId&gt;Zeta.Core&lt;/PackageId&gt;`, so a
/// public type parameter here would be a distribution contract for a prototype.
/// `InternalsVisibleTo("Tests.FSharp")` (AssemblyInfo.fs) is what lets the falsifiers see it.
module internal LawWitness =

    // ═══════════════════════════════════════════════════════════════════
    // THE WITNESSES — opaque tokens; the constructor is the whole guarantee
    // ═══════════════════════════════════════════════════════════════════

    /// Witness: `Conj` is the identity on `'W`. True at ℝ and at no doubled rung.
    /// This is the law that gates COMMUTATIVITY across the doubling, which is why it is
    /// carried explicitly instead of being folded into `Commutative`. There is deliberately
    /// NO lift: `Conj` on `Doubled&lt;'A&gt;` negates the imaginary part, so no doubled rung is
    /// self-conjugate and the chain stops at ℝ by construction.
    [<Sealed>]
    type SelfConjugate<'W> private (rung: string) =
        /// The rung this witness was minted at — for diagnostics only, never for control flow.
        member _.Rung = rung

        /// ℝ: `Conj x = x`. Witnessed by `Real.algebra` in `CayleyDickson.fs`, whose `Conj`
        /// is literally `id`, and pinned by a test.
        static member Axiom: SelfConjugate<float> = SelfConjugate<float>("R")

    /// Witness: `Mul` on `'W` is commutative — `x·y = y·x`.
    [<Sealed>]
    type Commutative<'W> private (rung: string) =
        /// The rung this witness was minted at — for diagnostics only, never for control flow.
        member _.Rung = rung

        /// ℝ is commutative.
        static member Axiom: Commutative<float> = Commutative<float>("R")

        /// `Doubled&lt;'W&gt;` is COMMUTATIVE iff `'W` is commutative AND `Conj` is the identity
        /// on `'W` (Schafer 1954). The `SelfConjugate&lt;'W&gt;` argument is what makes this
        /// partial: ℝ is self-conjugate, so ℂ is commutative; ℂ is NOT self-conjugate, so
        /// there is no route to a `Commutative&lt;Quaternion&gt;` anywhere, and therefore none to
        /// an `Associative&lt;Octonion&gt;` either.
        member this.Double(selfConj: SelfConjugate<'W>) : Commutative<Doubled<'W>> =
            if isNull (box selfConj) then
                nullArg (nameof selfConj)

            Commutative<Doubled<'W>>("Doubled<" + this.Rung + ">")

    /// Witness: `Mul` on `'W` is associative — `(x·y)·z = x·(y·z)`.
    [<Sealed>]
    type Associative<'W> private (rung: string) =
        /// The rung this witness was minted at — for diagnostics only, never for control flow.
        member _.Rung = rung

        /// ℝ is associative.
        static member Axiom: Associative<float> = Associative<float>("R")

        /// `Doubled&lt;'W&gt;` is ASSOCIATIVE iff `'W` is BOTH commutative and associative
        /// (Schafer 1954). The `Commutative&lt;'W&gt;` argument is what makes this partial: ℂ is
        /// commutative + associative, so ℍ is associative; ℍ is not commutative, so 𝕆 is not.
        ///
        /// Dropping the `Commutative&lt;'W&gt;` parameter is the canonical way to break this
        /// whole scheme — an unconstrained `Associative&lt;'W&gt; → Associative&lt;Doubled&lt;'W&gt;&gt;`
        /// would hand out `Associative&lt;Octonion&gt;` and `Associative&lt;Sedenion&gt;` for free.
        /// That mutation is pinned by the reachability falsifier in the test file.
        member this.Double(comm: Commutative<'W>) : Associative<Doubled<'W>> =
            if isNull (box comm) then
                nullArg (nameof comm)

            Associative<Doubled<'W>>("Doubled<" + this.Rung + ">")

    /// Witness: `Mul` on `'W` is alternative — associativity holds in every 2-generated
    /// subalgebra (`x·(x·y) = (x·x)·y` and `(y·x)·x = y·(x·x)`).
    [<Sealed>]
    type Alternative<'W> private (rung: string) =
        /// The rung this witness was minted at — for diagnostics only, never for control flow.
        member _.Rung = rung

        /// Associativity is strictly stronger than alternativity, so this weakening is
        /// TOTAL — the only total arrow in the module, and the reason ℝ, ℂ and ℍ are
        /// alternative as well as 𝕆.
        static member OfAssociative(assoc: Associative<'A>) : Alternative<'A> =
            if isNull (box assoc) then
                nullArg (nameof assoc)

            Alternative<'A>(assoc.Rung)

        /// `Doubled&lt;'A&gt;` is ALTERNATIVE iff `'A` is associative (Schafer 1954). ℍ is
        /// associative, so 𝕆 is alternative; 𝕆 is not, so 𝕊 is not.
        static member OfDoubledAssociative(assoc: Associative<'A>) : Alternative<Doubled<'A>> =
            if isNull (box assoc) then
                nullArg (nameof assoc)

            Alternative<Doubled<'A>>("Doubled<" + assoc.Rung + ">")

    /// Witness: `'W` has no zero divisors — `x·y = 0` entails `x = 0` or `y = 0`.
    [<Sealed>]
    type NoZeroDivisors<'W> private (rung: string) =
        /// The rung this witness was minted at — for diagnostics only, never for control flow.
        member _.Rung = rung

        /// ℝ has no zero divisors.
        static member Axiom: NoZeroDivisors<float> = NoZeroDivisors<float>("R")

        /// `Doubled&lt;'W&gt;` is a composition algebra — hence has NO ZERO DIVISORS — iff `'W`
        /// is an ASSOCIATIVE composition algebra (Hurwitz 1898 / Schafer 1954). ℍ qualifies,
        /// so 𝕆 is a division algebra; 𝕆 is not associative, so 𝕊 is not, and 𝕊's zero
        /// divisors are pinned by exhaustive count in the test file.
        member this.Double(assoc: Associative<'W>) : NoZeroDivisors<Doubled<'W>> =
            if isNull (box assoc) then
                nullArg (nameof assoc)

            NoZeroDivisors<Doubled<'W>>("Doubled<" + this.Rung + ">")

    // ═══════════════════════════════════════════════════════════════════
    // FORGERY GUARD
    // ═══════════════════════════════════════════════════════════════════

    /// A witness is a reference type, so `Unchecked.defaultof&lt;Associative&lt;Sedenion&gt;&gt;`
    /// type-checks and yields `null` — the one forgery path the type system cannot close
    /// (by design: the `Unchecked` module is documented as outside F#'s safety guarantee).
    /// Every consumer below runs this check, which converts that silent forgery into a loud
    /// refusal at the call site. It does NOT catch non-public reflection, and the falsifier
    /// test says so out loud rather than leaving the gap undocumented.
    let private demand (law: string) (proof: obj) : unit =
        if isNull proof then
            invalidOp (
                "Forged law witness: a null "
                + law
                + " reached a consumer. A witness is obtainable only from LawWitness's axioms "
                + "or lifts; `Unchecked.defaultof` is not a proof."
            )

    // ═══════════════════════════════════════════════════════════════════
    // THE LIFTS — curried wrappers over the members above, for ergonomics
    // ═══════════════════════════════════════════════════════════════════

    /// `SelfConjugate&lt;'A&gt; → Commutative&lt;'A&gt; → Commutative&lt;Doubled&lt;'A&gt;&gt;` — PARTIAL in the
    /// first argument, which exists only at ℝ.
    let liftCommutative (selfConj: SelfConjugate<'A>) (comm: Commutative<'A>) : Commutative<Doubled<'A>> =
        demand "SelfConjugate" (box selfConj)
        demand "Commutative" (box comm)
        comm.Double selfConj

    /// `Commutative&lt;'A&gt; → Associative&lt;'A&gt; → Associative&lt;Doubled&lt;'A&gt;&gt;` — PARTIAL in the
    /// first argument, which does not exist at ℍ. This is the refusal the whole prototype
    /// is built to produce.
    let liftAssociative (comm: Commutative<'A>) (assoc: Associative<'A>) : Associative<Doubled<'A>> =
        demand "Commutative" (box comm)
        demand "Associative" (box assoc)
        assoc.Double comm

    /// `Associative&lt;'A&gt; → Alternative&lt;Doubled&lt;'A&gt;&gt;` — PARTIAL: no `Associative&lt;Octonion&gt;`
    /// means no `Alternative&lt;Sedenion&gt;`.
    let liftAlternative (assoc: Associative<'A>) : Alternative<Doubled<'A>> =
        demand "Associative" (box assoc)
        Alternative<'A>.OfDoubledAssociative assoc

    /// `Associative&lt;'A&gt; → NoZeroDivisors&lt;'A&gt; → NoZeroDivisors&lt;Doubled&lt;'A&gt;&gt;` — PARTIAL for
    /// the same reason, which is why 𝕊 is not a division algebra.
    let liftNoZeroDivisors (assoc: Associative<'A>) (nzd: NoZeroDivisors<'A>) : NoZeroDivisors<Doubled<'A>> =
        demand "Associative" (box assoc)
        demand "NoZeroDivisors" (box nzd)
        nzd.Double assoc

    /// `Associative&lt;'W&gt; → Alternative&lt;'W&gt;` — the one TOTAL arrow.
    let alternativeOfAssociative (assoc: Associative<'W>) : Alternative<'W> =
        demand "Associative" (box assoc)
        Alternative<'W>.OfAssociative assoc

    // ═══════════════════════════════════════════════════════════════════
    // THE RUNGS — what each level of the tower can actually prove
    // ═══════════════════════════════════════════════════════════════════

    /// ℝ — the base case. Every law holds, and it is the ONLY self-conjugate rung.
    [<RequireQualifiedAccess>]
    module RealRung =
        let selfConjugate: SelfConjugate<float> = SelfConjugate<float>.Axiom
        let commutative: Commutative<float> = Commutative<float>.Axiom
        let associative: Associative<float> = Associative<float>.Axiom
        let alternative: Alternative<float> = alternativeOfAssociative associative
        let noZeroDivisors: NoZeroDivisors<float> = NoZeroDivisors<float>.Axiom

    /// ℂ — commutative, associative, a division algebra. Loses only total ordering, which
    /// is not a `Mul` law and so is not modelled here.
    ///
    /// NO `selfConjugate`: `Conj` on ℂ is not the identity. That absence is what stops
    /// commutativity one rung higher.
    [<RequireQualifiedAccess>]
    module ComplexRung =
        let commutative: Commutative<Complex> =
            liftCommutative RealRung.selfConjugate RealRung.commutative

        let associative: Associative<Complex> =
            liftAssociative RealRung.commutative RealRung.associative

        let alternative: Alternative<Complex> = alternativeOfAssociative associative

        let noZeroDivisors: NoZeroDivisors<Complex> =
            liftNoZeroDivisors RealRung.associative RealRung.noZeroDivisors

    /// ℍ — associative and a division algebra; COMMUTATIVITY IS GONE.
    /// There is deliberately no `commutative` binding here, and no way to write one:
    /// `liftCommutative` demands a `SelfConjugate&lt;Complex&gt;` that does not exist.
    [<RequireQualifiedAccess>]
    module QuaternionRung =
        let associative: Associative<Quaternion> =
            liftAssociative ComplexRung.commutative ComplexRung.associative

        let alternative: Alternative<Quaternion> = alternativeOfAssociative associative

        let noZeroDivisors: NoZeroDivisors<Quaternion> =
            liftNoZeroDivisors ComplexRung.associative ComplexRung.noZeroDivisors

    /// 𝕆 — alternative and still a division algebra; ASSOCIATIVITY IS GONE.
    /// No `associative` binding, and none is writable: `liftAssociative` demands a
    /// `Commutative&lt;Quaternion&gt;` that does not exist. THIS IS THE WHOLE POINT of the
    /// module — the refusal is structural, not documentary.
    [<RequireQualifiedAccess>]
    module OctonionRung =
        let alternative: Alternative<Octonion> = liftAlternative QuaternionRung.associative

        let noZeroDivisors: NoZeroDivisors<Octonion> =
            liftNoZeroDivisors QuaternionRung.associative QuaternionRung.noZeroDivisors

    /// 𝕊 — NOTHING. Not commutative, not associative, not alternative, not a division
    /// algebra. Both remaining lifts (`liftAlternative`, `liftNoZeroDivisors`) demand an
    /// `Associative&lt;Octonion&gt;`, so this rung is UNINHABITED BY CONSTRUCTION.
    /// `IStarRing&lt;Sedenion&gt;` still exists and is still not a ring; what changes is that
    /// nothing law-bearing can be asked of it.
    [<RequireQualifiedAccess>]
    module SedenionRung =
        /// The count of witnesses obtainable at 𝕊: zero. Kept as a named, greppable
        /// statement of that fact rather than an empty module that could drift into
        /// meaning nothing. The reachability falsifier checks the claim mechanically.
        let witnessCount = 0

    // ═══════════════════════════════════════════════════════════════════
    // CONSUMERS — operations that are REFUSED at the wrong rung
    // ═══════════════════════════════════════════════════════════════════

    /// Product of `xs` under BALANCED (divide-and-conquer) bracketing: O(log n) depth,
    /// parallelisable, and equal to the left-to-right fold ONLY where `Mul` is associative.
    /// The rebracketing is the entire algorithm, so it demands `Associative&lt;'W&gt;` — which
    /// means it is available at ℝ, ℂ and ℍ and REFUSED at 𝕆 and 𝕊.
    let productBalanced (proof: Associative<'W>) (ring: IStarRing<'W>) (xs: 'W[]) : 'W =
        demand "Associative" (box proof)

        if isNull (box ring) then
            nullArg (nameof ring)

        if isNull (box xs) then
            nullArg (nameof xs)

        let rec go (lo: int) (hi: int) : 'W =
            if lo >= hi then ring.One
            elif hi - lo = 1 then xs.[lo]
            else
                let mid = lo + (hi - lo) / 2
                ring.Mul(go lo mid, go mid hi)

        go 0 xs.Length

    /// Left-to-right fold product — the reference `productBalanced` must agree with
    /// wherever a witness exists. Needs no witness: one fixed bracketing is always a
    /// legitimate product, in any algebra.
    let productLeftFold (ring: IStarRing<'W>) (xs: 'W[]) : 'W =
        if isNull (box ring) then
            nullArg (nameof ring)

        if isNull (box xs) then
            nullArg (nameof xs)

        let mutable acc = ring.One

        for x in xs do
            acc <- ring.Mul(acc, x)

        acc

    /// `(x + y)²` expanded as `x² + 2xy + y²`. The collapse of `xy + yx` into `2xy` IS
    /// commutativity, so this demands `Commutative&lt;'W&gt;` — available at ℝ and ℂ, REFUSED
    /// from ℍ upward.
    let squareOfSum (proof: Commutative<'W>) (ring: IStarRing<'W>) (x: 'W) (y: 'W) : 'W =
        demand "Commutative" (box proof)

        if isNull (box ring) then
            nullArg (nameof ring)

        let xy = ring.Mul(x, y)
        ring.Add(ring.Add(ring.Mul(x, x), ring.Add(xy, xy)), ring.Mul(y, y))

    /// `x·(x·y)` rewritten as `(x·x)·y`, which lets a caller hoist `x·x` out of a loop over
    /// many `y`. That rewrite is exactly the LEFT ALTERNATIVE law, so it demands
    /// `Alternative&lt;'W&gt;` — available through 𝕆 and REFUSED at 𝕊.
    let mulSquareLeft (proof: Alternative<'W>) (ring: IStarRing<'W>) (x: 'W) (y: 'W) : 'W =
        demand "Alternative" (box proof)

        if isNull (box ring) then
            nullArg (nameof ring)

        ring.Mul(ring.Mul(x, x), y)

    /// Two-sided inverse of a UNIT-NORM element: `x⁻¹ = Conj x`. Two-sidedness needs
    /// alternativity, and the inverse existing at all needs a composition algebra, so this
    /// demands BOTH witnesses — available through 𝕆 and REFUSED at 𝕊, where 84 basis-sum
    /// pairs multiply to zero.
    let unitInverse
        (nzd: NoZeroDivisors<'W>)
        (alt: Alternative<'W>)
        (ring: IStarRing<'W>)
        (x: 'W)
        : 'W =
        demand "NoZeroDivisors" (box nzd)
        demand "Alternative" (box alt)

        if isNull (box ring) then
            nullArg (nameof ring)

        ring.Conj x
