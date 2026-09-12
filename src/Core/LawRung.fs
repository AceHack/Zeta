namespace Zeta.Core

/// # The LATTICE — laws and capabilities as SEPARATE parents, joined per structure
/// (081M29N1AX9087G0R001GSJD6G; prototype two of two, and the RECOMMENDED one)
///
/// ## Two corrections, both recorded rather than quietly applied
///
/// **Correction 1 — the premise.** The work item said that because
///
///     ISemiring ⊂ IRing ⊂ IStarRing     capability ADDED going up
///     ℝ → ℂ → ℍ → 𝕆 → 𝕊                 laws LOST going up
///
/// run in opposite directions, *no inheritance arrangement repairs it*. That is false, and the
/// counterexample is 35 years old. FriCAS/Axiom, `src/algebra/catdef.spad`, read from source:
///
///     Algebra(R : CommutativeRing) : Category == Join(Ring, NonAssociativeAlgebra(R))
///
/// The ASSOCIATIVE algebra is the DESCENDANT of the non-associative one, so losing a law is
/// moving TOWARD the root — a supertype relation subtyping expresses natively. (PR #17319.)
///
/// **Correction 2 — and it changes the shape of the fix.** Inverting the chain is not enough:
/// it rotates one mandatory chain into another mandatory chain, and the next law that does not
/// fit the new order breaks it the same way. Two instances, both real:
///
///   * **Commutativity does not imply associativity.** A first draft of this module put
///     `ICommutative ⊂ IAssociative` in one chain. That is mathematically WRONG — a Jordan
///     algebra under `½(ab + ba)` is commutative and not associative — and it is exactly the
///     failure a chain has and a lattice does not.
///   * **`IStarRing : IRing` makes an involution imply an additive inverse**, which is Lumen's
///     §3.5 defect: the belief pair `(support, refutation)` has a natural involution — negation
///     is coordinate swap, `¬(t,f) = (f,t)` — and NO additive inverse, because its `⊕` is
///     idempotent. Today that weight is inexpressible: to give it a `Conj` you must first give
///     it a `Negate` it does not have.
///
/// And FriCAS already shows the lattice rather than the chain: `OctonionCategory` joins
/// **`FramedNonAssociativeAlgebra(R), NonAssociativeRing`** — two parents. `Join` is multiple
/// inheritance. "Many towers, joined" arrives as an implementation detail of a 1990 CAS.
///
/// ## The shape
///
/// Three INDEPENDENT axes, each rooted at the law-free `ISemiring&lt;'W&gt;`; a structure names the
/// several it satisfies. No axis is a parent of another except where the implication is a
/// theorem:
///
///     capability axis   ISemiring ⊂ IRing                  (Negate — unchanged, untouched)
///     involution axis   ISemiring ⊂ IInvolutiveSemiring    (Conj, WITHOUT Negate)
///     law axis          ISemiring ⊂ IAlternativeMul ⊂ IAssociativeMul
///                       ISemiring ⊂ ICommutativeMul        (NOT under associativity)
///                       ISemiring ⊂ INoZeroDivisors        (independent of all of it)
///     a JOIN of two     ISelfConjugate ⊂ {IInvolutiveSemiring, ICommutativeMul}
///
/// `IAssociativeMul ⊂ IAlternativeMul` is kept because associativity genuinely entails
/// alternativity. `ISelfConjugate ⊂ ICommutativeMul` is kept because `Conj` is an
/// antihomomorphism — `Conj(x·y) = Conj y · Conj x` — so `Conj = id` entails `x·y = y·x`.
/// Everything else is orthogonal and is left orthogonal.
///
/// ## The rungs, named the way FriCAS names them
///
/// One named join per STRUCTURE (linear in rungs — `QuaternionCategory`, `OctonionCategory`),
/// never one per combination of laws. Each doubling lift demotes by exactly the clause Schafer
/// proves, so a rung cannot be typed more strongly than the mathematics allows.
///
/// ## Consumers do NOT need named joins — constraint lists express any intersection
///
/// This is the finding that decides the comparison. .NET cannot write an intersection type in a
/// parameter position, which is what makes a marker lattice look like it must cost 2ⁿ names. It
/// does not: an F# generic constraint list expresses the join directly —
///
///     when 'R :> IAlternativeMul&lt;'W&gt; and 'R :> INoZeroDivisors&lt;'W&gt; and 'R :> IInvolutiveSemiring&lt;'W&gt;
///
/// — so `unitInverse` below asks for exactly the three parents it needs, from three different
/// axes, with no named join and no witness value. The cost, stated: the ring becomes a TYPE
/// PARAMETER, so the instance must be statically known at the call site. That is the repo's
/// existing hot-path dispatch register (`IntegerRing`'s struct form), not a new idea, and it is
/// a genuine restriction for code that picks a ring at runtime — such code keeps a named join
/// or stays on `IStarRing`.
///
/// ## RECOMMENDATION — this over `LawWitness.fs`, on measured grounds
///
/// | | `LawWitness` (witness VALUES) | `LawRung` (this) |
/// |---|---|---|
/// | keyed on | the element type `'W` only | the (type, operations) pair — what a law is actually about |
/// | witness/instance mismatch | **ADMITS ONE** — a valid `Associative&lt;Quaternion&gt;` pairs with ANY `IStarRing&lt;Quaternion&gt;`, including a non-associative one, and licenses a false rewrite. Demonstrated by a passing test | **impossible** — there is nothing to pair |
/// | forgeable | yes: C# inside the IVT boundary, and reflection from anywhere (measured) | only by implementing the interface — explicit and greppable |
/// | cost | a class per law, and a class must be earned under `rules/` | interfaces: free and weight-free |
/// | independent laws | compose freely | compose freely too, via constraint lists |
/// | law + NO additive inverse | expressible | expressible — and the shipped tower is not |
///
/// The mismatch row is decisive; the last row is what the inversion buys that nothing else does.
///
/// ## NOT A HUB — the lattice is an oracle you choose
///
/// Nothing here is mandatory and nothing existing is modified. `ISemiring`, `IRing`, `IStarRing`
/// and every weight already on them keep working untouched; a weight may join none of these
/// parents and still use every law-free operation in this module — `productLeftFold` takes the
/// bare `ISemiring`, deliberately. That is `itron-hub-patent-boundary-p2p-is-the-upgrade.md`:
/// exit, not degree. A pinned test drives a lattice-free weight through it, so "opt-in" is a
/// measured property rather than a promise.
///
/// The migration sentence this implies, for the separate and larger decision it belongs to:
/// `IRing` should NOT acquire associativity — it should stay the law-free `Negate` dictionary it
/// already is, and consumers needing associativity should ask for `IAssociativeMul` as a SECOND
/// parent. Re-rooting `IRing` would make `IRing&lt;Octonion&gt;` stop typechecking at the cost of
/// turning the capability chain into the new mandatory one; splitting the law off costs nothing
/// and preserves exit.
///
/// ## The falsifier survives any tower shape — and that is the durable lesson
///
/// A marker interface is a NAME, not a proof. FriCAS states `SemiGroup() : Category == Magma`
/// **identically**, with associativity in a `++` comment; Sage's own docs say an axiom's
/// semantics are "specified in the documentation". Both purpose-built algebraic type systems
/// land on the same disclosure `IStarRing.cs` already makes — evidence of a hard boundary rather
/// than a Zeta oversight. What both pay for it with is a SHIPPED FALSIFIER: FriCAS
/// `associative?()` and GAP `IsAssociative` enumerate basis triples and check the associator.
///
/// `tests/Tests.FSharp/Algebra/LawWitness.Tests.fs` §B is that falsifier here, independently
/// reproducing the measurement 35 years later: 42 of 49 basis pairs refute commutativity at 𝕆,
/// 168 of 343 triples refute associativity at 𝕆, 84 basis-sum pairs multiply to zero at 𝕊.
/// Sage has a `NoZeroDivisors` axiom and **no `Alternative` axiom**, so 𝕆's positive law is the
/// one rung here with no external precedent; no surveyed system models sedenions at all.
///
/// ## Register and scope
///
/// `toy` per `.claude/rules/toy-is-free-metered-must-be-earned.md`, and `internal`:
/// `Core.fsproj` carries `&lt;PackageId&gt;Zeta.Core&lt;/PackageId&gt;`, so a public interface here would
/// be a distribution contract for a prototype. It deviates from the contract-library convention
/// (interface libs are C#, in `Zeta.Core.Abstractions`) for exactly that reason — every type in
/// that assembly is public.
///
/// Anchors: R. D. Schafer, *On the algebras formed by the Cayley–Dickson process*, Amer. J.
/// Math. 76 (1954) 435–446 (every lift clause below); A. Hurwitz (1898) (the composition-algebra
/// step); J. Baez, *The Octonions*, Bull. AMS 39 (2002) 145–205.
module internal LawRung =

    // ═══════════════════════════════════════════════════════════════════
    // AXIS 1 — INVOLUTION, independent of the additive inverse
    // ═══════════════════════════════════════════════════════════════════

    /// `Conj` WITHOUT requiring `Negate`. This is the parent `IStarRing` should have had: star
    /// and additive inverse are logically independent, and the shipped tower makes the first
    /// imply the second. A weight with an involution and an idempotent `⊕` — Lumen's belief
    /// pair — can implement this and cannot implement `IStarRing`.
    type IInvolutiveSemiring<'W> =
        inherit ISemiring<'W>

        /// The involution: `Conj(Conj x) = x` and `Conj(x·y) = Conj y · Conj x`.
        abstract Conj: 'W -> 'W

    // ═══════════════════════════════════════════════════════════════════
    // AXIS 2 — MULTIPLICATIVE LAWS, markers with no members
    // ═══════════════════════════════════════════════════════════════════

    /// `Mul` is ALTERNATIVE: associativity holds in every 2-generated subalgebra. 𝕆 is the top
    /// rung that holds it. Sage's axiom set has no name for this one.
    type IAlternativeMul<'W> =
        inherit ISemiring<'W>

    /// `Mul` is ASSOCIATIVE. Inherits alternativity because the implication is a theorem — the
    /// ONLY inheritance on this axis, and the arrow the original diagnosis said could not
    /// exist. ℍ is the top rung that holds it.
    type IAssociativeMul<'W> =
        inherit IAlternativeMul<'W>

    /// `Mul` is COMMUTATIVE. Deliberately NOT under `IAssociativeMul`: commutativity does not
    /// entail associativity (Jordan algebras are the standing counterexample), and a first
    /// draft of this module got that wrong by forcing one chain. ℂ is the top rung that holds it.
    type ICommutativeMul<'W> =
        inherit ISemiring<'W>

    /// `x·y = Zero` entails `x = Zero` or `y = Zero`. Independent of every law above: 𝕆 has it
    /// without associativity, and ℤ/6ℤ is associative without it. 𝕆 is the top rung that holds
    /// it; at 𝕊, 84 basis-sum pairs falsify it.
    type INoZeroDivisors<'W> =
        inherit ISemiring<'W>

    // ═══════════════════════════════════════════════════════════════════
    // WHERE TWO AXES MEET — the Join form, with two parents
    // ═══════════════════════════════════════════════════════════════════

    /// `Conj` is the IDENTITY. It needs the involution axis to have a `Conj` at all, and it
    /// ENTAILS commutativity because `Conj` is an antihomomorphism — so it genuinely sits under
    /// both parents. ℝ is the only rung that holds it, which is what stops the commutativity
    /// lift after exactly one step.
    type ISelfConjugate<'W> =
        inherit IInvolutiveSemiring<'W>
        inherit ICommutativeMul<'W>

    // ═══════════════════════════════════════════════════════════════════
    // THE RUNG CATEGORIES — one named join per STRUCTURE, as FriCAS names them
    // ═══════════════════════════════════════════════════════════════════

    /// ℝ: every law, plus the involution and the additive inverse.
    type IRealCategory<'W> =
        inherit IRing<'W>
        inherit ISelfConjugate<'W>
        inherit IAssociativeMul<'W>
        inherit INoZeroDivisors<'W>

    /// ℂ: commutative, associative, a division algebra — but NOT self-conjugate.
    type IComplexCategory<'W> =
        inherit IRing<'W>
        inherit IInvolutiveSemiring<'W>
        inherit ICommutativeMul<'W>
        inherit IAssociativeMul<'W>
        inherit INoZeroDivisors<'W>

    /// ℍ: associative, a division algebra — COMMUTATIVITY IS GONE.
    type IQuaternionCategory<'W> =
        inherit IRing<'W>
        inherit IInvolutiveSemiring<'W>
        inherit IAssociativeMul<'W>
        inherit INoZeroDivisors<'W>

    /// 𝕆: alternative, still a division algebra — ASSOCIATIVITY IS GONE.
    type IOctonionCategory<'W> =
        inherit IRing<'W>
        inherit IInvolutiveSemiring<'W>
        inherit IAlternativeMul<'W>
        inherit INoZeroDivisors<'W>

    /// 𝕊: an involutive ring and NOTHING MORE — no law parent at all. This is the honest type
    /// for the algebra that today satisfies `IStarRing&lt;Sedenion&gt;` and is not a ring.
    type ISedenionCategory<'W> =
        inherit IRing<'W>
        inherit IInvolutiveSemiring<'W>

    /// The rung shape Lumen's §3.5 needs and the shipped tower cannot express: an involution,
    /// commutativity and associativity, and **no `IRing`** — because `⊕` is idempotent and has
    /// no additive inverse. Its existence is the proof that separating the axes buys something.
    type IInvolutiveCommutativeSemiring<'W> =
        inherit IInvolutiveSemiring<'W>
        inherit ICommutativeMul<'W>
        inherit IAssociativeMul<'W>

    // ═══════════════════════════════════════════════════════════════════
    // RUNG CONSTRUCTION — forwarding views; the encoding cost, paid at init
    // ═══════════════════════════════════════════════════════════════════
    //
    // .NET has no way to say "this value additionally satisfies marker M", so each rung is a
    // forwarding object expression over the existing `IStarRing` instance. Real overhead, paid
    // once per rung at module init and never on a hot path. The arithmetic is asserted
    // identical to `ImaginaryStack`'s by test, so the markers describe the measured algebra.

    let private realCategory (r: IStarRing<float>) : IRealCategory<float> =
        { new IRealCategory<float> with
            member _.Zero = r.Zero
            member _.One = r.One
            member _.Add(a, b) = r.Add(a, b)
            member _.Negate a = r.Negate a
            member _.Mul(a, b) = r.Mul(a, b)
            member _.Conj a = r.Conj a }

    let private complexCategory (r: IStarRing<'W>) : IComplexCategory<'W> =
        { new IComplexCategory<'W> with
            member _.Zero = r.Zero
            member _.One = r.One
            member _.Add(a, b) = r.Add(a, b)
            member _.Negate a = r.Negate a
            member _.Mul(a, b) = r.Mul(a, b)
            member _.Conj a = r.Conj a }

    let private quaternionCategory (r: IStarRing<'W>) : IQuaternionCategory<'W> =
        { new IQuaternionCategory<'W> with
            member _.Zero = r.Zero
            member _.One = r.One
            member _.Add(a, b) = r.Add(a, b)
            member _.Negate a = r.Negate a
            member _.Mul(a, b) = r.Mul(a, b)
            member _.Conj a = r.Conj a }

    let private octonionCategory (r: IStarRing<'W>) : IOctonionCategory<'W> =
        { new IOctonionCategory<'W> with
            member _.Zero = r.Zero
            member _.One = r.One
            member _.Add(a, b) = r.Add(a, b)
            member _.Negate a = r.Negate a
            member _.Mul(a, b) = r.Mul(a, b)
            member _.Conj a = r.Conj a }

    let private sedenionCategory (r: IStarRing<'W>) : ISedenionCategory<'W> =
        { new ISedenionCategory<'W> with
            member _.Zero = r.Zero
            member _.One = r.One
            member _.Add(a, b) = r.Add(a, b)
            member _.Negate a = r.Negate a
            member _.Mul(a, b) = r.Mul(a, b)
            member _.Conj a = r.Conj a }

    // ═══════════════════════════════════════════════════════════════════
    // THE BRIDGE BACK — the lattice PRODUCES the legacy interface
    // ═══════════════════════════════════════════════════════════════════

    /// A rung category deliberately does NOT inherit `IStarRing`: that inheritance is the
    /// `IStarRing : IRing` coupling this module exists to undo, and re-adding it would put the
    /// mandatory chain straight back. `Doubled.algebra` still wants one, so the join is made
    /// where it is needed — by a CONSTRAINT LIST, the same mechanism `unitInverse` uses:
    ///
    ///     when 'R :> IRing<'W> and 'R :> IInvolutiveSemiring<'W>
    ///
    /// Anything carrying both parents becomes an `IStarRing` on demand. Exit runs both ways:
    /// a weight can enter the lattice without leaving the shipped tower behind.
    let asStarRing<'R, 'W when 'R :> IRing<'W> and 'R :> IInvolutiveSemiring<'W>> (r: 'R) : IStarRing<'W> =
        let ring = r :> IRing<'W>
        let inv = r :> IInvolutiveSemiring<'W>

        { new IStarRing<'W> with
            member _.Zero = ring.Zero
            member _.One = ring.One
            member _.Add(a, b) = ring.Add(a, b)
            member _.Negate a = ring.Negate a
            member _.Mul(a, b) = ring.Mul(a, b)
            member _.Conj a = inv.Conj a }

    // ═══════════════════════════════════════════════════════════════════
    // THE LIFTS — each demotes by exactly the clause Schafer 1954 proves
    // ═══════════════════════════════════════════════════════════════════

    /// ℝ → ℂ. `Doubled&lt;'A&gt;` is commutative iff `'A` is commutative AND self-conjugate. Demands
    /// `ISelfConjugate` via `IRealCategory`, and no doubled rung is self-conjugate, so this
    /// arrow fires exactly once.
    let doubleToComplex (inner: IRealCategory<'A>) : IComplexCategory<Doubled<'A>> =
        complexCategory (Doubled.algebra (asStarRing inner))

    /// ℂ → ℍ. `Doubled&lt;'A&gt;` is associative iff `'A` is commutative and associative. Demands
    /// `ICommutativeMul` via `IComplexCategory`, which ℍ does not have — so ℍ → 𝕆 cannot use it.
    let doubleToQuaternion (inner: IComplexCategory<'A>) : IQuaternionCategory<Doubled<'A>> =
        quaternionCategory (Doubled.algebra (asStarRing inner))

    /// ℍ → 𝕆. `Doubled&lt;'A&gt;` is alternative iff `'A` is associative, and is a composition
    /// algebra iff `'A` is an associative one (Hurwitz). Demands `IAssociativeMul`, which 𝕆 lacks.
    let doubleToOctonion (inner: IQuaternionCategory<'A>) : IOctonionCategory<Doubled<'A>> =
        octonionCategory (Doubled.algebra (asStarRing inner))

    /// The TOTAL lift: doubling always yields an involutive ring and claims nothing more. Its
    /// input is the bare `IStarRing`, so it applies at every rung — including at 𝕆 → 𝕊 and
    /// beyond, where nothing else does.
    let doubleToInvolutiveRing (inner: IStarRing<'A>) : ISedenionCategory<Doubled<'A>> =
        sedenionCategory (Doubled.algebra inner)

    // ═══════════════════════════════════════════════════════════════════
    // THE RUNGS — each typed at exactly what it EARNS
    // ═══════════════════════════════════════════════════════════════════

    /// ℝ — self-conjugate, and therefore commutative too.
    let real: IRealCategory<float> = realCategory Real.algebra

    /// ℂ — commutative. NOT self-conjugate, which stops the chain here.
    let complex: IComplexCategory<Complex> = doubleToComplex real

    /// ℍ — associative. NOT commutative: `doubleToComplex` needs an `IRealCategory<Complex>`.
    let quaternion: IQuaternionCategory<Quaternion> = doubleToQuaternion complex

    /// 𝕆 — alternative and a division algebra. NOT associative: `doubleToQuaternion` needs an
    /// `IComplexCategory<Quaternion>`, and `quaternion` is not one.
    let octonion: IOctonionCategory<Octonion> = doubleToOctonion quaternion

    /// 𝕊 — an involutive ring with NO law parent. `doubleToOctonion` needs an
    /// `IQuaternionCategory<Octonion>`, and `octonion` is not one, so only the total lift
    /// applies. The type now says exactly what is true.
    let sedenion: ISedenionCategory<Sedenion> =
        doubleToInvolutiveRing (asStarRing octonion)

    // ═══════════════════════════════════════════════════════════════════
    // THE WEIGHT THE SHIPPED TOWER CANNOT EXPRESS (Lumen §3.5)
    // ═══════════════════════════════════════════════════════════════════

    /// A belief pair `(support, refutation)` over `[0, 1]`. `⊕` is componentwise max — so it is
    /// IDEMPOTENT and only `Zero` has an additive inverse — and `⊗` is componentwise min. The
    /// natural involution is coordinate swap.
    [<Struct>]
    type BeliefPair =
        { Support: float
          Refutation: float }

    /// The belief pair as an involutive, commutative, associative SEMIRING — with no `Negate`,
    /// because it has none. Under the shipped tower this weight is inexpressible: `Conj` lives
    /// on `IStarRing`, `IStarRing : IRing`, and `IRing` demands an additive inverse it does not
    /// have. Separating the involution axis from the capability axis is what makes it typeable,
    /// and that is the concrete payoff of the inversion.
    let beliefPair: IInvolutiveCommutativeSemiring<BeliefPair> =
        { new IInvolutiveCommutativeSemiring<BeliefPair> with
            member _.Zero = { Support = 0.0; Refutation = 0.0 }
            member _.One = { Support = 1.0; Refutation = 1.0 }

            member _.Add(a, b) =
                { Support = max a.Support b.Support
                  Refutation = max a.Refutation b.Refutation }

            member _.Mul(a, b) =
                { Support = min a.Support b.Support
                  Refutation = min a.Refutation b.Refutation }

            // Negation is coordinate swap — an involution, and an antihomomorphism because
            // `min` is commutative. No `Negate` anywhere, and none is required.
            member _.Conj a =
                { Support = a.Refutation
                  Refutation = a.Support } }

    // ═══════════════════════════════════════════════════════════════════
    // CONSUMERS — the refusal is an ordinary argument-type mismatch
    // ═══════════════════════════════════════════════════════════════════

    /// Product of `xs` under BALANCED (divide-and-conquer) bracketing: O(log n) depth,
    /// parallelisable, and equal to the left-to-right fold ONLY where `Mul` is associative.
    /// Asks for the one parent it needs; `productBalanced octonion xs` does not compile.
    let productBalanced (ring: #IAssociativeMul<'W>) (xs: 'W[]) : 'W =
        if isNull (box ring) then
            nullArg (nameof ring)

        if isNull (box xs) then
            nullArg (nameof xs)

        let s = ring :> ISemiring<'W>

        let rec go (lo: int) (hi: int) : 'W =
            if lo >= hi then s.One
            elif hi - lo = 1 then xs.[lo]
            else
                let mid = lo + (hi - lo) / 2
                s.Mul(go lo mid, go mid hi)

        go 0 xs.Length

    /// Left-to-right fold product. One fixed bracketing is a legitimate product in ANY algebra,
    /// so this asks for the law-free root — and therefore accepts weights that join NOTHING in
    /// this lattice. That is the exit clause, in a signature.
    let productLeftFold (ring: ISemiring<'W>) (xs: 'W[]) : 'W =
        if isNull (box ring) then
            nullArg (nameof ring)

        if isNull (box xs) then
            nullArg (nameof xs)

        let mutable acc = ring.One

        for x in xs do
            acc <- ring.Mul(acc, x)

        acc

    /// `(x + y)²` expanded as `x² + 2xy + y²`. The collapse of `xy + yx` into `2xy` IS
    /// commutativity — and NOT associativity, which is why this asks for `ICommutativeMul`
    /// alone and would be wrong to place under an associativity chain.
    let squareOfSum (ring: #ICommutativeMul<'W>) (x: 'W) (y: 'W) : 'W =
        if isNull (box ring) then
            nullArg (nameof ring)

        let s = ring :> ISemiring<'W>
        let xy = s.Mul(x, y)
        s.Add(s.Add(s.Mul(x, x), s.Add(xy, xy)), s.Mul(y, y))

    /// `x·(x·y)` rewritten as `(x·x)·y`, hoisting `x·x` out of a loop over many `y`. Exactly the
    /// LEFT ALTERNATIVE law. Available through 𝕆; refused at 𝕊.
    let mulSquareLeft (ring: #IAlternativeMul<'W>) (x: 'W) (y: 'W) : 'W =
        if isNull (box ring) then
            nullArg (nameof ring)

        let s = ring :> ISemiring<'W>
        s.Mul(s.Mul(x, x), y)

    /// Two-sided inverse of a UNIT-NORM element: `x⁻¹ = Conj x`. Needs THREE parents from THREE
    /// different axes — alternativity for two-sidedness, no-zero-divisors for the inverse to
    /// exist, and the involution to compute it — and asks for exactly those, with no named join
    /// and no witness value. This is the intersection .NET cannot write in a parameter position
    /// and an F# constraint list can.
    let unitInverse<'R, 'W
        when 'R :> IAlternativeMul<'W> and 'R :> INoZeroDivisors<'W> and 'R :> IInvolutiveSemiring<'W>>
        (ring: 'R)
        (x: 'W)
        : 'W =
        if isNull (box ring) then
            nullArg (nameof ring)

        (ring :> IInvolutiveSemiring<'W>).Conj x
