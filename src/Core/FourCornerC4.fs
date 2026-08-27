namespace Zeta.Core

open Zeta.Core.Abstractions

/// **FourCornerC4 — three embeddings of the four-corner phase, none of which
/// identifies FourCorner with Cl(p,q).**
///
/// Aaron 2026-08-26: FourCornerTrace VALUE (WSet ping-return; −1 = i² is a
/// *ring* identity) needs `IStarRing`. Clifford ±1 and the C₄ compass on
/// FourCorner are related; they are **not** "FourCorner is Cl(p,q)".
/// Matching a count of four is numerology until the invariants separate the
/// objects (`.claude/rules/numerology-vs-number-theory.md`).
///
/// Three embeddings, three jobs:
///
///   1. **Compass labeling.** FourCorner's 2×2 is *named* N S E W =
///      `{1, i, −1, −i}` = C₄ = `i`-rotation. That is a labeling of a
///      directed I/O record, not a proof that `FourCornerOwnership` is a
///      group object.
///   2. **IStarRing witness.** On ℂ, `i² = Negate(One)` (ring, exact) and
///      `e^{iπ} = Negate(One)` (Euler, analysis, same C₄ point). The TRACE
///      ping-return needs the ring identity, hence `IStarRing : IRing`.
///      Euler is why the compass *looks* like a half-turn; it is extra
///      structure (`cos`/`sin`), not what `FourCornerTrace` consumes.
///      Inverse-free corners (Boolean, tropical, EP, IntervalRing) stay at
///      `ISemiring` and refuse the trace at compile time.
///      Existing `IStarRing` dictionaries that DO apply for TRACE:
///      `IntegerRing.Star` (ℤ, Conj=id), `Real.algebra`, the Cayley–Dickson
///      tower (`ImaginaryStack.*`), `Cl3.algebra`. C₄ `u² = −1` is a
///      *stricter* ask: ℂ and above, plus Cl(3,0) bivectors — not ℝ, not ℤ.
///   3. **Clifford discriminator.** Generator squares ±1 are the
///      **signature** of Cl(p,q) (the quadratic form on the generating
///      vectors), not the compass. Cl(3,0) has `eᵢ² = +1 = One`, the
///      *opposite* of `i²`. C₄ *does* sit in Cl(3,0)'s **even
///      subalgebra** as `e₁₂² = −1`, and the Clifford algebra whose
///      generator *is* `i` is Cl(0,1) ≅ ℂ (`CliffordPeriodicity`).
///      `Cl3.algebra` is an `IStarRing`, so the TRACE can instantiate
///      over Clifford *weights* without FourCorner *being* Cl(p,q).
///   4. **Not a fermion.** Spin-½ `R(2π)=−1` is the SU(2) cover, not
///      this record. The Adinkra *connection* (Aaron 2026-08-26) is
///      the missing Meijer axis: feedback dashing ±1 = C₄ south =
///      `e^{iπ}` lives on a Q-odd *edge* (boson ↔ fermion). FourCorner
///      supplies that axis; it is not a node of the adinkra. Three
///      different fours: I/O slots, code dimension k=4, N=4 valise
///      colours. Coded [8,4] and uncoded Cl(0,8) both split 8B+8F
///      — same count, different objects (quotient graph vs regular
///      representation). E8: roots and algebra metered; split
///      Chevalley root groups have multiply (`E8ChevalleyGroup`);
///      compact real Lie group is still a Killing-form substitute.
///
/// Anchors (Beacon): W. K. Clifford 1878; Lounesto 2001 §3 (signature vs
/// involutions); Cayley–Dickson doubling (`CayleyDickson.fs`);
/// Atiyah–Bott–Shapiro periodicity (`CliffordPeriodicity.fs`);
/// Joyal–Street–Verity 1996 (the trace that consumes Negate).
[<RequireQualifiedAccess>]
module FourCornerC4 =

    /// The cyclic group C₄ as four named phases. Order: `One → I → MinusOne → MinusI → One`.
    type Phase =
        | One
        | I
        | MinusOne
        | MinusI

    /// Compass labels for FourCorner's 2×2. Labeling, not a group action on the record.
    let north = One // TIn rest
    let east = I // TOut
    let south = MinusOne // retraction / TOutFeedback
    let west = MinusI // co-owned TInFeedback

    let rotateI =
        function
        | One -> I
        | I -> MinusOne
        | MinusOne -> MinusI
        | MinusI -> One

    let order =
        function
        | One -> 0
        | I -> 1
        | MinusOne -> 2
        | MinusI -> 3

    let ofQuarterTurns (n: int) : Phase =
        match ((n % 4) + 4) % 4 with
        | 0 -> One
        | 1 -> I
        | 2 -> MinusOne
        | _ -> MinusI

    /// C₄ multiplication: add quarter-turns. `mul I I = MinusOne`.
    let mul (a: Phase) (b: Phase) : Phase = ofQuarterTurns (order a + order b)

    /// VALUE-channel ping-return: the additive inverse. This is why
    /// `FourCornerTrace` takes `IStarRing` and not `ISemiring`.
    /// Applies on every existing `IStarRing` instance (ℤ, ℝ, ℂ, ℍ, 𝕆, 𝕊, Cl3).
    let pingReturn (ring: IStarRing<'W>) (w: 'W) : 'W = ring.Negate w

    /// Imaginary unit of ℍ — Cayley–Dickson `(i_ℂ, 0)`. Already the `i` of
    /// `CayleyWeightedSet.Tests`. `i² = −1`, so C₄ embeds as a *subgroup* of
    /// ℍ*, not as ℍ (which is not C₄).
    let quaternionI : Quaternion =
        Doubled.make (Doubled.make 0.0 1.0) (Doubled.make 0.0 0.0)

    /// The doubling unit of ℍ (`j`). Also `j² = −1`; `{1,j,−1,−j}` is another
    /// C₄ subgroup, independent of the `i` copy. Not an identification.
    let quaternionJ : Quaternion =
        Doubled.make (Doubled.make 0.0 0.0) (Doubled.make 1.0 0.0)

    /// Imaginary unit of 𝕆 lifted from ℍ's `i` (lower half). Same C₄ subgroup.
    let octonionI : Octonion =
        Doubled.make quaternionI (Doubled.make (Doubled.make 0.0 0.0) (Doubled.make 0.0 0.0))

    let toComplex =
        function
        | One -> Doubled.make 1.0 0.0
        | I -> Doubled.make 0.0 1.0
        | MinusOne -> Doubled.make -1.0 0.0
        | MinusI -> Doubled.make 0.0 -1.0

    /// Two quarter-turns of a ℂ weight: multiply by `i` twice. On ℂ this
    /// *is* `pingReturn` — the L5 identity `i² = −1`, lifted off WSet.
    let twoQuarterTurns (ring: IStarRing<Complex>) (w: Complex) : Complex =
        let i = toComplex I
        ring.Mul(ring.Mul(w, i), i)

    /// Euler's formula on ℂ: `exp(i θ) = cos θ + i sin θ`. Extra structure
    /// beyond `IStarRing` (needs ℝ-analysis / `cos`/`sin`). Not a ring identity
    /// and not "FourCorner is U(1)".
    let expI (theta: float) : Complex =
        Doubled.make (cos theta) (sin theta)

    /// `e^{i π}` — the analytic landing on `Negate(One)`. Same C₄ point as
    /// `i²`, different presentation: exponential of the Lie algebra `iℝ ⊂ ℂ`,
    /// not `Mul`. Float residual on `sin π` is expected (IEEE); the ring
    /// identity `i²` is exact. Aaron 2026-08-26: thinking `e^{iπ} = −1`
    /// instead of `i² = −1`. Book register: *You, Born at the Hinge* / `e^{iπ}`.
    let eulerPi : Complex = expI System.Math.PI

    /// Spin-½ double cover on Cl(3,0): rotor `R(θ) = cos(θ/2) − sin(θ/2)·e₁₂`.
    /// A **2π** spatial turn is `θ/2 = π` ⇒ `R = −1 = e^{iπ}`. A **4π** turn
    /// returns to `+1`. Same C₄ point as the amplitude compass, different
    /// object (SU(2) covering SO(3), not FourCorner). `Cl3.rotor` already
    /// uses the half-angle; `QubitIso.ry`/`rz` match Q#'s convention.
    let spinHalfRotor (spatialTheta: float) : Cl3.Mv =
        Cl3.rotor spatialTheta Cl3.e12

    let private e1 = Cl3.vector 1.0 0.0 0.0

    /// The *right* Clifford embedding of C₄: into the even subalgebra, generated
    /// by the bivector `e₁₂` with `e₁₂² = −1`. This is ℂ sitting inside Cl(3,0)
    /// the way it sits inside ℍ, not "FourCorner is Cl(3,0)".
    let toCl3Even =
        function
        | One -> Cl3.one
        | I -> Cl3.e12
        | MinusOne -> Cl3.algebra.Negate Cl3.one
        | MinusI -> Cl3.algebra.Negate Cl3.e12

    /// The *wrong* embedding: send the compass generator `i` to a Cl(3,0)
    /// vector. `e₁² = +1`, so this does **not** carry C₄. It is the falsifier
    /// of "the four corners are Cl(3,0)" read as an identification.
    let toCl3Vector =
        function
        | One -> Cl3.one
        | I -> e1
        | MinusOne -> Cl3.algebra.Negate Cl3.one
        | MinusI -> Cl3.algebra.Negate e1

    /// Cl(0,1) ≅ ℂ — the Clifford algebra whose single generator squares to −1.
    /// Already pinned in `CliffordPeriodicity.Tests`; restated here as the
    /// *related* object, not as FourCorner.
    let cl01IsTheComplexLine : bool =
        match CliffordPeriodicity.classify 0 1 with
        | Ok t ->
            t.Ground = CliffordPeriodicity.Complex
            && t.MatrixDim = 1
            && not t.IsSplit
        | Error _ -> false

    /// Cl(3,0) ≅ M₂(ℂ) — *not* ℂ. Four corners are not this algebra.
    let cl30IsMatrixTwoComplex : bool =
        match CliffordPeriodicity.classify 3 0 with
        | Ok t ->
            t.Ground = CliffordPeriodicity.Complex
            && t.MatrixDim = 2
            && not t.IsSplit
        | Error _ -> false

    // ── Adinkra connection (not identification) ───────────────────────
    // FourCorner is a 2×2 I/O record. An adinkra fermion is an odd-parity
    // node. Connecting them is the *feedback axis* Meijer does not have:
    // dashing ±1 on a Q-odd edge is C₄ south. Matching a count of four
    // is numerology (k=4, N=4 colours, 4 I/O slots).

    /// FourCornerOwnership field count. Labeling, not a group order.
    let fourCornerSlotCount = 4

    /// [8,4] Hamming: k is the code dimension, not N, not FourCorner.
    let adinkraCodeDimensionK = AdinkraCode.dimension

    /// N = supercharges = code length = 8. The coded adinkra's colour count.
    let adinkraSuperchargesN = AdinkraCode.supercharges

    /// Coded [8,4] quotient is K_{8,8}: even-parity cosets vs odd-parity
    /// cosets. Physics names those 8+8 bosons and fermions. FourCorner
    /// is not a vertex of this graph.
    let codedBosonFermionCounts : int * int =
        let mutable even = 0
        let mutable odd = 0

        for x in 0 .. AdinkraIharaZeta.nodes - 1 do
            if AdinkraIharaZeta.cosetParity x = 0 then
                even <- even + 1
            else
                odd <- odd + 1

        even, odd

    /// Uncoded Cl(0,N) is the regular representation: dim = 2^N = vertex
    /// count, homoiconicity defect 1. The coded tower's defect is 2^k.
    let uncodedVertexCount (n: int) : int =
        CliffordPeriodicity.realDimension 0 n

    let uncodedHomoiconicityDefect = 1

    let codedHomoiconicityDefect = AdinkraCode.homoiconicityDefect

    /// Uncoded N=8: the mod-8 clock separates even/odd halves into two
    /// 8×8 blocks (8 bosons + 8 fermions) without quotienting a code.
    let uncodedN8HalvesSeparate : bool =
        let p, q = CliffordPeriodicity.adinkraN8Signature

        match CliffordPeriodicity.halvesSeparateCleanly p q with
        | Ok b -> b
        | Error _ -> false

    /// Dashing sign −1 is C₄ south / `e^{iπ}` / `pingReturn(One)`. It
    /// lives on an EDGE (Q-odd). `south` is the I/O retraction corner.
    /// Same C₄ point, different objects. Not "FourCorner is a fermion".
    let dashingSignIsSouth = south = MinusOne

    // ── Two NSEW compasses at Meijer's missing axis ───────────────────
    // 1. Zeta: FourCorner I/O = (data|feedback)×(in|out) = N S E W.
    // 2. Rx: (incremental|bulk)×(refresh|stream).
    // Meijer duals (IEnumerable ⇄ IObservable, μF ⇄ νF) are 2-corner
    // in/out. The dual interfaces traded a feedback channel for a
    // non-monadic error terminal (`IObserver.OnError`; in-tree,
    // `InterruptFeedback` on `Result`). Error is a SUM (short-circuit,
    // erasing). Feedback is a PRODUCT (ping-return, Bennett-free
    // Negate). Composition is tensor of two 2×2s, not identification.

    /// Meijer in ⇄ out (pull ⇄ push, data ⇄ process). No feedback axis.
    let meijerDualCornerCount = 2

    /// Rx NSEW — state-mode grid, not FourCorner I/O.
    type RxCompass =
        | IncrementalRefresh
        | IncrementalStream
        | BulkRefresh
        | BulkStream

    let allRxModes =
        [ IncrementalRefresh
          IncrementalStream
          BulkRefresh
          BulkStream ]

    /// Filling a feedback corner does not discard `TIn` — product.
    let feedbackKeepsInput
        (expectedIn: int)
        (o: FourCorner.FourCornerOwnership<int, int, string, string>)
        : bool =
        o.TIn = expectedIn && FourCorner.hasFeedback o

    /// ISR / `IObserver.OnError` analogue: the Ok value is gone — sum.
    let errorDiscardsValue (r: Result<int, InterruptFeedback>) : bool =
        match r with
        | Error _ -> true
        | Ok _ -> false

    /// Fibre 1 = Bennett-free (ping-return / Negate). Fibre > 1 = erasing
    /// (error short-circuit throws away the other summand).
    let pingReturnClass = ErasureClass.ofLargestFibre 1
    let errorShortCircuitClass = ErasureClass.ofLargestFibre 2

    // ── One clock tick = the 2×2 occupancy ────────────────────────────
    // Meijer 2-corner is one Q (in/out, no ∂_τ). AdinkraClock: Q_up
    // (boson→fermion, no tick) then Q_down (fermion→boson, one tick).
    // `{Q,Q}` is the round-trip that *is* one clock tick. FourCorner
    // is that round-trip's I/O: two Q-moves × (in/out) = 4 slots.
    // Occupancy of options, not a group law on the record.

    /// One tick's I/O record: all four corners occupied.
    let oneTick
        (tin: int)
        (tout: int)
        (outFb: string)
        (inFb: string)
        : FourCorner.FourCornerOwnership<int, int, string, string> =
        FourCorner.ofIn tin
        |> FourCorner.withOut tout
        |> FourCorner.withOutFeedback outFb
        |> FourCorner.withInFeedback inFb

    let occupancyCount
        (o: FourCorner.FourCornerOwnership<int, int, string, string>)
        : int =
        let mutable n = 1 // TIn is required

        if o.TOut.IsSome then
            n <- n + 1

        if o.TOutFeedback.IsSome then
            n <- n + 1

        if o.TInFeedback.IsSome then
            n <- n + 1

        n

    /// Two Q-moves per `{Q,Q}` tick (`AdinkraClock.step` twice).
    let adinkraQMovesPerTick = 2

    // ── Mutual options ~ √2, noninterference ─────────────────────────
    // TOut and feedback are *mutual options*: both may be occupied
    // (product) without erasing TIn. Two declared unit axes, orthogonal
    // by noninterference (§13 — entropy only through declared channels),
    // Euclidean occupancy √(1²+1²) = √2. FeedbackThrottle.TsirelsonLatency
    // is also √2 (contingent on 1/(1+L)). Consistent-with, not identified.

    let mutualOptionOccupancyNorm (dataOut: bool) (feedback: bool) : float =
        let d = if dataOut then 1.0 else 0.0
        let f = if feedback then 1.0 else 0.0
        sqrt (d * d + f * f)

    // ── +1 and −1 compass: related, divergent ────────────────────────
    // +1 = north = genuineDelta = VALUE product = Reversible (involution).
    // −1 = south = retractionDelta = C₄ south = e^{iπ}.
    // Meijer filled the dual hole with OnError, which *looks* like −1
    // (the other terminal) but is a SUM: after Error the stream is gone,
    // and Error∘Error is not defined — not an involution. Related C₄
    // points; divergent as maps (Negate∘Negate = id vs terminal erasure).

    let plusOnePhase = north
    let minusOnePhase = south

    let negateIsInvolution (ring: IStarRing<'W>) (eq: 'W -> 'W -> bool) (w: 'W) : bool =
        eq (ring.Negate(ring.Negate w)) w

    /// Once `Error`, there is no second application that restores `Ok`.
    let errorHasNoInverse (r: Result<int, InterruptFeedback>) : bool =
        match r with
        | Error _ -> true
        | Ok _ -> false

    // ── E8 three objects: roots, algebra, group ───────────────────────
    // Aaron 2026-08-24/26: at least 2 of 3, try for all 3. Workitem
    // `081M0T8XF3N087G0R002YNFVD9` already closed the algebra gap.
    // Compact group remains a substitute (Killing negative-definite +
    // centre order 1 ⇒ unique compact simply-connected E8 exists).
    // That is existence, not the manifold. Weyl group is a *fourth*
    // object (`CliffordE8Roots` versors), not a stand-in for the group.

    type E8ObjectStatus =
        { RootsMetered: int
          AlgebraMetered: int
          CompactGroupIsSubstitute: bool
          ChevalleyRootGroupsMetered: bool
          CompactFormNegativeDefinite: bool
          CentreOrder: int }

    /// Roots + algebra + split Chevalley root groups (multiply). Compact
    /// real Lie group is still the Killing substitute — a different object
    /// from the algebraic group (`E8ChevalleyGroup`).
    let e8ThreeObjects : E8ObjectStatus =
        let a0 = E8LieAlgebra.chevalleyE.[0]

        { RootsMetered = E8LieAlgebra.rootCount
          AlgebraMetered = E8LieAlgebra.dimension
          CompactGroupIsSubstitute = true
          ChevalleyRootGroupsMetered =
            E8ChevalleyGroup.adCubeIsZero a0
            && E8ChevalleyGroup.adSquareIsEven a0
            && E8ChevalleyGroup.oneParameterHolds a0 1 1
          CompactFormNegativeDefinite = E8LieAlgebra.compactFormIsNegativeDefinite
          CentreOrder = E8LieAlgebra.centreOrder }
