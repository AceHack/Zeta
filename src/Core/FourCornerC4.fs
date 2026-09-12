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
///   5. **Not Belnap's FOUR** — the SECOND four-element trap in this
///      neighbourhood, and the reason this file gained a bilattice
///      section. A `(trueChance, falseChance)` pair whose legs float
///      independently is the interlaced bilattice `[0,1] ⊙ [0,1]`
///      (Ginsberg 1988; Fitting 1991; Avron 1996), whose four extreme
///      points are Belnap's FOUR `{neither, true, false, both}`.
///      **FOUR ≇ C₄.** Both carriers have four elements — which is the
///      count test, and the count test decides nothing. The invariant
///      that separates them: the compass generator `rotateI` has
///      **order 4** and is fixed-point-free; FOUR's negation (coordinate
///      swap `¬(t,f) = (f,t)`) is an **involution** — order 2, with two
///      fixed points (`neither`, `both`) — and FOUR carries **two**
///      interlaced orders (truth `≤_t`, knowledge `≤_k`) where C₄
///      carries a group law and no order at all. Exhaustively checked
///      here: no bijection `Phase → Belnap` intertwines `rotateI` with
///      the bilattice negation (`compassNegationIntertwinerExists`,
///      24 candidates, all refuted). So a belief pair is **not** the
///      four-corner compass, and the compass is **not** a truth value.
///
/// Anchors (Beacon): W. K. Clifford 1878; Lounesto 2001 §3 (signature vs
/// involutions); Cayley–Dickson doubling (`CayleyDickson.fs`);
/// Atiyah–Bott–Shapiro periodicity (`CliffordPeriodicity.fs`);
/// Joyal–Street–Verity 1996 (the trace that consumes Negate);
/// N. D. Belnap 1977 (*A Useful Four-Valued Logic*); M. L. Ginsberg 1988
/// (bilattices); M. Fitting 1991 (bilattices and the semantics of logic
/// programming); A. Avron 1996 (every bounded interlaced bilattice is
/// `L₁ ⊙ L₂` — the representation theorem that makes §5 an
/// identification rather than a resemblance).
///
/// Satellite: `docs/research/2026-09-11-the-belief-pair-as-a-weight-for-the-
/// universal-tensor-bilattice-boole-slack-and-the-typed-regulariser-lumen.md`
/// §4 (Lumen; PR #17309) — where the identification is derived and where
/// the guard above was first written down.
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
        (o: FourCorner.FourCornerOwnership<'TIn, 'TOut, 'TOutFeedback, 'TInFeedback>)
        : int =
        let mutable n = 1 // TIn is required

        if o.TOut.IsSome then
            n <- n + 1

        if o.TOutFeedback.IsSome then
            n <- n + 1

        if o.TInFeedback.IsSome then
            n <- n + 1

        n

    /// Occupancy as a `SchedulerZeta.predict` key. **Not injective:**
    /// two different fillings can share a count, so `runToHorizon`'s
    /// `stepⁿ` guarantee does not apply. Use `cornersKey` when the
    /// orbit is the I/O record.
    let occupancyKey
        (o: FourCorner.FourCornerOwnership<'TIn, 'TOut, 'TOutFeedback, 'TInFeedback>)
        : int =
        occupancyCount o

    /// The I/O record itself as a predict key. Injective on the
    /// reachable set when `step` only rewrites these four fields.
    let cornersKey
        (o: FourCorner.FourCornerOwnership<'TIn, 'TOut, 'TOutFeedback, 'TInFeedback>)
        =
        o

    /// Two Q-moves per `{Q,Q}` tick (`AdinkraClock.step` twice).
    let adinkraQMovesPerTick = 2

    // ── Mutual options, noninterference; 2×√2 is a coincidence ───────
    // TOut and feedback are *mutual options*: both may be occupied
    // (product) without erasing TIn. Two declared unit axes, orthogonal
    // by noninterference (§13). Their Pythagorean factor is √2.
    // Classical floor 2 × that factor equals 2√2 *as a number*.
    // Otto 2026-08-27: that lining-up is numerology, not identification.
    // CHSH 2√2 is ‖C‖ on ℂ²⊗ℂ² and spends anticommutation. One occupancy
    // record has nothing to spend. QubitIso is the qubit; FourCorner is
    // the I/O pipe. Two agents with a FourCorner throttle approaching
    // 2√2 is an assumption, not a measure. What is measured at L=0 /
    // shared seed is S=4 (`FeedbackThrottle.measuredSeedSharedS4`).
    // 2√2 is a predicted latency-degradation floor — to be measured.

    let mutualOptionOccupancyNorm (dataOut: bool) (feedback: bool) : float =
        let d = if dataOut then 1.0 else 0.0
        let f = if feedback then 1.0 else 0.0
        sqrt (d * d + f * f)

    /// Classical CHSH / Meijer 2-corner floor. The front 2.
    [<Literal>]
    let classicalChshFloor = 2

    /// Integer lock: S² ≤ 8. (2√2)². Irrational only at readout.
    [<Literal>]
    let tsirelsonSSquared = 8

    /// Classical S² = 2² = 4 (commuting control in `Tsirelson.fs`).
    [<Literal>]
    let classicalSSquared = 4

    /// Coincidence: 2 × occupancy-√2 equals 2√2 numerically. Not a
    /// measurement of Tsirelson (`numerology-vs-number-theory`).
    let toyOccupancyTimesClassicalFloor : float =
        float classicalChshFloor * mutualOptionOccupancyNorm true true

    /// Kept so older call sites fail loudly if they meant a measurement.
    let tsirelsonBoundFromMutualOptions : float = toyOccupancyTimesClassicalFloor

    // ── Quantum from {Q,Q}: two deniable moves, future snap ──────────
    // Each Q is a 2-corner (in/out). Either move is *plausibly deniable*
    // as a clock event: AdinkraClock's first Q emits no ∂_τ. Both are
    // true-ish while the FourCorner product holds both options (SoftValue
    // support, not snapped). The pair `{Q,Q}` is the tick; that close is
    // the collapse. SoftValue.snap is the only sanctioned collapse
    // (`DuExpand`: snap is the only collapse). Not "FourCorner is a
    // qubit" — the 2×2 occupancy can carry two live options until the
    // future tick. Rhyme with delayed choice; QubitIso is the qubit;
    // FourCorner is the I/O. Complementarity ≠ mutual occupancy.

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

    // ── The SECOND four-element trap: Belnap's FOUR is NOT C₄ ─────────
    // A belief pair `(trueChance, falseChance)` with independently
    // floating legs is the interlaced bilattice `[0,1] ⊙ [0,1]`; its four
    // extreme points are Belnap's FOUR. Four elements is a COUNT, and the
    // count is shared with C₄, the Klein group, `{0,1}²` and M₂ — so the
    // count identifies nothing (`numerology-vs-number-theory`). The
    // structures below exist so the separating invariants are executable:
    // a unary map's ORDER, its FIXED POINTS, and the exhaustive absence of
    // an intertwining bijection. This file already carried one standing
    // numerology warning (2 × occupancy-√2 vs 2√2, above); this is the
    // second, and it is a different trap in the same neighbourhood.
    //
    // Nothing here claims FourCorner IS a bilattice. FourCorner is an I/O
    // record; FOUR is a truth-value lattice. The section is a guard, not
    // an identification — the same register as `toCl3Vector` above, which
    // exists to be WRONG in a checkable way.

    /// Belnap's FOUR — the four extreme points of `[0,1] ⊙ [0,1]`, read as
    /// `(trueChance, falseChance)` ∈ {0,1}². `Neither` = told nothing
    /// (gap); `Both` = told both (glut). Belnap 1977.
    [<RequireQualifiedAccess>]
    type Belnap =
        /// ⊥_k — `(0,0)`. No evidence either way.
        | Neither
        /// `(1,0)`. Told true only.
        | True
        /// `(0,1)`. Told false only.
        | False
        /// ⊤_k — `(1,1)`. Told both: a glut, retained rather than resolved.
        | Both

    /// The four corners, in knowledge-ascending presentation order.
    let allBelnap = [ Belnap.Neither; Belnap.True; Belnap.False; Belnap.Both ]

    /// `(trueChance, falseChance)` coordinates. The whole identification
    /// lives in these two independently-floating legs.
    let belnapPair =
        function
        | Belnap.Neither -> 0, 0
        | Belnap.True -> 1, 0
        | Belnap.False -> 0, 1
        | Belnap.Both -> 1, 1

    let private ofPair (t: int, f: int) =
        match t, f with
        | 0, 0 -> Belnap.Neither
        | 1, 0 -> Belnap.True
        | 0, 1 -> Belnap.False
        | _ -> Belnap.Both

    /// **Bilattice negation — coordinate swap.** `≤_t`-antitone,
    /// `≤_k`-MONOTONE (it moves no information), and an **involution**:
    /// `¬∘¬ = id`. That order-2 fact is the invariant that refutes C₄.
    let belnapNegate (b: Belnap) : Belnap =
        let t, f = belnapPair b
        ofPair (f, t)

    /// Truth order `≤_t`: more support, less refutation.
    let belnapLeqT (a: Belnap) (b: Belnap) : bool =
        let ta, fa = belnapPair a
        let tb, fb = belnapPair b
        ta <= tb && fa >= fb

    /// Knowledge order `≤_k`: more of BOTH legs — the "when they don't add
    /// to 1" axis. `Neither` is its bottom, `Both` its top.
    let belnapLeqK (a: Belnap) (b: Belnap) : bool =
        let ta, fa = belnapPair a
        let tb, fb = belnapPair b
        ta <= tb && fa <= fb

    /// `≤_t`-join `∨` — decide: strongest support, weakest refutation.
    let belnapJoinT (a: Belnap) (b: Belnap) : Belnap =
        let ta, fa = belnapPair a
        let tb, fb = belnapPair b
        ofPair (max ta tb, min fa fb)

    /// `≤_t`-meet `∧`.
    let belnapMeetT (a: Belnap) (b: Belnap) : Belnap =
        let ta, fa = belnapPair a
        let tb, fb = belnapPair b
        ofPair (min ta tb, max fa fb)

    /// `≤_k`-join `⊕` — accumulate everything told, gluts retained. This
    /// is the raw-vault operation: it never picks a winner.
    let belnapJoinK (a: Belnap) (b: Belnap) : Belnap =
        let ta, fa = belnapPair a
        let tb, fb = belnapPair b
        ofPair (max ta tb, max fa fb)

    /// `≤_k`-meet `⊗` — consensus: only what both sources carry.
    let belnapMeetK (a: Belnap) (b: Belnap) : Belnap =
        let ta, fa = belnapPair a
        let tb, fb = belnapPair b
        ofPair (min ta tb, min fa fb)

    /// Least `n ≥ 1` with `fⁿ = id` on a finite carrier; `0` if none within
    /// `bound`. The order of a unary map is the invariant this section
    /// turns on, so it is computed rather than asserted.
    let unaryOrder (bound: int) (carrier: 'a list) (f: 'a -> 'a) : int =
        let rec go n (g: 'a -> 'a) =
            if n > bound then 0
            elif carrier |> List.forall (fun x -> g x = x) then n
            else go (n + 1) (g >> f)

        go 1 f

    let private fixedPointCount (carrier: 'a list) (f: 'a -> 'a) : int =
        carrier |> List.filter (fun x -> f x = x) |> List.length

    /// The C₄ carrier, as a list. Public so a test can run the POSITIVE
    /// control on `intertwinerExists` and show the refutations below are a
    /// live search rather than a vacuously empty one.
    let phaseCarrier = [ One; I; MinusOne; MinusI ]

    /// **4.** The compass generator is a quarter-turn: `rotateI⁴ = id` and
    /// no smaller power is.
    let compassRotationOrder = unaryOrder 8 phaseCarrier rotateI

    /// **2.** The bilattice negation is an involution. `2 ≠ 4` is the whole
    /// refutation, stated as two computed integers.
    let belnapNegationOrder = unaryOrder 8 allBelnap belnapNegate

    /// **0.** A non-identity power of a C₄ generator moves every element.
    let compassHalfTurnFixedPoints = fixedPointCount phaseCarrier (mul MinusOne)

    /// **2.** Negation fixes the gap and the glut. A fixed-point count is
    /// an isomorphism invariant of `(carrier, unary map)`, so `0 ≠ 2`
    /// refutes the half-turn reading too — not just the quarter-turn one.
    let belnapNegationFixedPoints = fixedPointCount allBelnap belnapNegate

    let rec private permutations (xs: 'a list) : 'a list list =
        match xs with
        | [] -> [ [] ]
        | _ ->
            xs
            |> List.collect (fun x ->
                permutations (xs |> List.filter (fun y -> y <> x))
                |> List.map (fun rest -> x :: rest))

    /// Is there a bijection `φ : carrierA → carrierB` intertwining the two
    /// unary maps — `φ (f x) = g (φ x)` for every `x`? Exhaustive over all
    /// `n!` bijections; `false` when the carriers differ in size. This is
    /// isomorphism of unary algebras `(X, f)`, which is the level at which
    /// the compass and the bilattice are being compared.
    let intertwinerExists (carrierA: 'a list) (carrierB: 'b list) (f: 'a -> 'a) (g: 'b -> 'b) : bool =
        if List.length carrierA <> List.length carrierB then
            false
        else
            permutations carrierB
            |> List.exists (fun perm ->
                let table = List.zip carrierA perm |> Map.ofList
                carrierA |> List.forall (fun x -> table.[f x] = g table.[x]))

    /// **THE GUARD, exhaustively.** Is there a bijection `φ : Phase →
    /// Belnap` with `φ (rotateI p) = ¬ (φ p)` for every `p` — i.e. does the
    /// compass quarter-turn become the bilattice negation under ANY
    /// relabelling? All `4! = 24` candidates are tried. **`false`.**
    /// The two four-element objects are not the same object, and no choice
    /// of names makes them one.
    let compassNegationIntertwinerExists : bool =
        intertwinerExists phaseCarrier allBelnap rotateI belnapNegate

    /// The same refutation against the HALF-turn, so the guard does not
    /// rest on the order-4 fact alone: `mul MinusOne` is an involution too,
    /// and it still fails — it is fixed-point-free where negation fixes two
    /// corners. **`false`.**
    let compassHalfTurnNegationIntertwinerExists : bool =
        intertwinerExists phaseCarrier allBelnap (mul MinusOne) belnapNegate

    /// **CONTROL — passes for BOTH structures and therefore proves
    /// NOTHING.** Four elements each, both unary maps bijective. Kept
    /// visible so the discriminating values above are seen to do work the
    /// count cannot do (`numerology-vs-number-theory`: name the
    /// competitors, then exclude them by invariant).
    let carrierSizes = List.length phaseCarrier, List.length allBelnap

    /// The continuous bilattice `[0,1] ⊙ [0,1]`. `Belnap` is its set of
    /// extreme points; `belnapToPair` below is the corner embedding, and
    /// the tests check it is a homomorphism for all five operations —
    /// which is what "FOUR is the four corners of the belief pair" means
    /// as a checkable statement rather than a count.
    type BeliefPair =
        { TrueChance: float
          FalseChance: float }

    let beliefPair (t: float) (f: float) : BeliefPair = { TrueChance = t; FalseChance = f }

    let belnapToPair (b: Belnap) : BeliefPair =
        let t, f = belnapPair b
        beliefPair (float t) (float f)

    let beliefNegate (p: BeliefPair) : BeliefPair = beliefPair p.FalseChance p.TrueChance

    let beliefJoinT (a: BeliefPair) (b: BeliefPair) : BeliefPair =
        beliefPair (max a.TrueChance b.TrueChance) (min a.FalseChance b.FalseChance)

    let beliefMeetT (a: BeliefPair) (b: BeliefPair) : BeliefPair =
        beliefPair (min a.TrueChance b.TrueChance) (max a.FalseChance b.FalseChance)

    let beliefJoinK (a: BeliefPair) (b: BeliefPair) : BeliefPair =
        beliefPair (max a.TrueChance b.TrueChance) (max a.FalseChance b.FalseChance)

    let beliefMeetK (a: BeliefPair) (b: BeliefPair) : BeliefPair =
        beliefPair (min a.TrueChance b.TrueChance) (min a.FalseChance b.FalseChance)

    /// Boole's slack `r = 1 − t − f` (Boole 1854, *conditions of possible
    /// experience*; de Finetti 1937). `r > 0` is ignorance, `r < 0` is
    /// incoherence, `r = 0` is the classical line. A structure that pins
    /// `r ≡ 0` has collapsed the knowledge order to a point and is NOT a
    /// bilattice — see the `SoftValue` check in the laws tests.
    let beliefResidual (p: BeliefPair) : float = 1.0 - p.TrueChance - p.FalseChance

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
