module Zeta.Tests.Formal.FourCornerC4LawsTests

open FsUnit.Xunit
open global.Xunit
open Zeta.Core

// ═══════════════════════════════════════════════════════════════════
// FourCornerC4 — three embeddings, none an identification with Cl(p,q).
//
// What is proved here (structure, not a matching count of four):
//   (G) C₄ as a group on Phase: i⁴ = 1, i² = −1, mul is associative
//       and commutative (small, exhaustive).
//   (R) IStarRing witness: on ℂ, two quarter-turns = pingReturn =
//       Negate. This is why FourCornerTrace needs IStarRing.
//       e^{iπ} = i² = Negate(One) — Euler is the same C₄ point
//       (analysis, float); the TRACE consumes the ring identity.
//   (E) even-subalgebra embedding: e₁₂² = −1, so C₄ sits in Cl(3,0)
//       the way ℂ sits in ℍ.
//   (D) discriminator: sending i to a Cl(3,0) *vector* gives e₁² = +1
//       ≠ Negate(One). Cl(3,0) ≅ M₂(ℂ), Cl(0,1) ≅ ℂ. Related, not the
//       same object.
//   (T) composition: FourCornerTrace instantiates over Cl3.Mv weights
//       because Cl3.algebra is an IStarRing — the trace consumes Negate,
//       not a Clifford signature.
//
//   (F) not a fermion: Adinkra Q-odd / coded 8B+8F / uncoded Cl(0,8)
//       halves. Three different fours. Dashing −1 = C₄ south.
//   (M) two NSEW compasses compose at Meijer's missing feedback.
//       Error is a sum (erasing); feedback is a product (reversible).
//   (E8) roots 240 + algebra 248 metered; compact group is a substitute.
//
// HONESTY: none of this claims FourCorner *is* a Clifford algebra
// or a fermion. Anchors: Clifford 1878; Lounesto 2001;
// Atiyah–Bott–Shapiro; Doran–Faux–Gates et al. 2008; Meijer 2010;
// Landauer 1961 / Bennett 1973; Chevalley 1955; Cayley–Dickson;
// Joyal–Street–Verity 1996; numerology-vs-number-theory.
// ═══════════════════════════════════════════════════════════════════

module FC = FourCornerC4

let private cRing = ImaginaryStack.complex
let private clRing = Cl3.algebra

let private closeC (a: Complex) (b: Complex) =
    abs (a.Real - b.Real) < 1e-12 && abs (a.Imag - b.Imag) < 1e-12

let private closeMv (a: Cl3.Mv) (b: Cl3.Mv) = Cl3.normSq (Cl3.sub a b) < 1e-12

let private phases = [ FC.One; FC.I; FC.MinusOne; FC.MinusI ]

// ── (G) C₄ group ────────────────────────────────────────────────────

[<Fact>]
let ``G: i² = −1 and i⁴ = 1 on the phase group`` () =
    FC.mul FC.I FC.I |> should equal FC.MinusOne
    FC.ofQuarterTurns 4 |> should equal FC.One
    FC.ofQuarterTurns 2 |> should equal FC.MinusOne
    FC.rotateI (FC.rotateI FC.north) |> should equal FC.south

[<Fact>]
let ``G: C₄ mul is associative, commutative, and unital — exhaustive`` () =
    for a in phases do
        FC.mul FC.One a |> should equal a
        FC.mul a FC.One |> should equal a
        for b in phases do
            FC.mul a b |> should equal (FC.mul b a)
            for c in phases do
                FC.mul (FC.mul a b) c |> should equal (FC.mul a (FC.mul b c))

// ── (R) IStarRing witness: why the VALUE ping-return needs a ring ──

[<Fact>]
let ``R: on ℂ, two quarter-turns equal pingReturn equal Negate`` () =
    let w = Doubled.make 0.3 0.4
    closeC (FC.twoQuarterTurns cRing w) (FC.pingReturn cRing w)
    |> should equal true
    closeC (FC.twoQuarterTurns cRing w) (cRing.Negate w) |> should equal true
    closeC (cRing.Mul(FC.toComplex FC.I, FC.toComplex FC.I)) (cRing.Negate cRing.One)
    |> should equal true

[<Fact>]
let ``R: C₄ phases embed as the unit circle of ImaginaryStack.complex`` () =
    for p in phases do
        let z = FC.toComplex p
        closeC (cRing.Mul(z, cRing.Conj z)) cRing.One |> should equal true

[<Fact>]
let ``R: e^{i π} = i² = Negate(One) — Euler is the same C₄ point, not a second fact`` () =
    // analysis (float): e^{iπ} lands on −1, e^{iπ/2} lands on i
    closeC FC.eulerPi (cRing.Negate cRing.One) |> should equal true
    closeC (FC.expI (System.Math.PI / 2.0)) (FC.toComplex FC.I) |> should equal true
    closeC (FC.expI (2.0 * System.Math.PI)) cRing.One |> should equal true
    // two quarter-turns of the exponential = the half-turn
    closeC (cRing.Mul(FC.expI (System.Math.PI / 2.0), FC.expI (System.Math.PI / 2.0))) FC.eulerPi
    |> should equal true
    // ring (exact): i² is the identity FourCornerTrace actually consumes
    closeC (cRing.Mul(FC.toComplex FC.I, FC.toComplex FC.I)) FC.eulerPi |> should equal true
    closeC FC.eulerPi (FC.pingReturn cRing cRing.One) |> should equal true

[<Fact>]
let ``R: spin-½ 2π rotor is −1; 4π is +1 — same C₄ point, half-angle cover`` () =
    closeMv (FC.spinHalfRotor (2.0 * System.Math.PI)) (clRing.Negate clRing.One)
    |> should equal true
    closeMv (FC.spinHalfRotor (4.0 * System.Math.PI)) clRing.One |> should equal true
    // Pauli Z on |1⟩ is multiply-by-e^{iπ} = Negate — QubitIso already ships this
    let one = QubitIso.ofQubit cRing.One (FC.toComplex FC.I)
    let zed = QubitIso.pauliZ one
    closeC zed.B (cRing.Mul(FC.eulerPi, FC.toComplex FC.I)) |> should equal true
    closeC zed.A cRing.One |> should equal true

// ── (E) even-subalgebra embedding — the honest Clifford relation ──

[<Fact>]
let ``E: e12² = −1, so C₄ lives in Cl(3,0)'s even subalgebra`` () =
    closeMv (clRing.Mul(Cl3.e12, Cl3.e12)) (clRing.Negate clRing.One)
    |> should equal true
    closeMv (clRing.Mul(FC.toCl3Even FC.I, FC.toCl3Even FC.I)) (FC.toCl3Even FC.MinusOne)
    |> should equal true

[<Fact>]
let ``E: phase mul agrees with the geometric product on the even embedding`` () =
    for a in phases do
        for b in phases do
            closeMv (clRing.Mul(FC.toCl3Even a, FC.toCl3Even b)) (FC.toCl3Even (FC.mul a b))
            |> should equal true

// ── (D) discriminator — not Cl(p,q) ────────────────────────────────

[<Fact>]
let ``D: sending i to a Cl(3,0) vector does NOT carry C₄ (e1² = +1)`` () =
    closeMv (clRing.Mul(FC.toCl3Vector FC.I, FC.toCl3Vector FC.I)) clRing.One
    |> should equal true
    closeMv (clRing.Mul(FC.toCl3Vector FC.I, FC.toCl3Vector FC.I)) (clRing.Negate clRing.One)
    |> should equal false
    // the even embedding still does
    closeMv (clRing.Mul(FC.toCl3Even FC.I, FC.toCl3Even FC.I)) (clRing.Negate clRing.One)
    |> should equal true

[<Fact>]
let ``D: Cl(0,1) ≅ ℂ is the related Clifford algebra; Cl(3,0) ≅ M₂(ℂ) is not`` () =
    FC.cl01IsTheComplexLine |> should equal true
    FC.cl30IsMatrixTwoComplex |> should equal true
    // they are different Morita types — matching "complex ground" is not identity
    let cl01 = CliffordPeriodicity.classify 0 1
    let cl30 = CliffordPeriodicity.classify 3 0
    match cl01, cl30 with
    | Ok a, Ok b -> (a.MatrixDim = b.MatrixDim) |> should equal false
    | _ -> failwith "classify refused a non-negative signature"

// ── (T) composition — the TRACE consumes IStarRing, not a signature ─

[<Fact>]
let ``T: FourCornerTrace instantiates over Cl3.Mv weights without FourCorner being Cl(p,q)`` () =
    let isZero (m: Cl3.Mv) = Cl3.normSq m < 1e-12
    let w = Cl3.one
    let gen: FourCornerTrace.Generator<int list, Map<int, int>, int, Cl3.Mv> =
        fun interp history ->
            history
            |> List.map (fun x ->
                (match Map.tryFind x interp with
                 | Some y -> y
                 | None -> x),
                w)
    let update (interp: Map<int, int>) ((raw, label): int * int) = Map.add raw label interp
    let history = [ 0 ]
    let st0, _ = FourCornerTrace.start clRing isZero gen history Map.empty
    let st1, d = FourCornerTrace.step clRing isZero gen update history (0, 7) st0
    closeMv (snd (List.head d)) (clRing.Negate w) |> should equal true
    st1.Emitted |> List.map fst |> should equal [ 7 ]
    // ping-return on a Clifford weight is Negate, not a generator square
    closeMv (FC.pingReturn clRing w) (clRing.Negate w) |> should equal true
    closeMv (clRing.Mul(Cl3.vector 1.0 0.0 0.0, Cl3.vector 1.0 0.0 0.0)) clRing.One
    |> should equal true

// ── (A) existing IStarRing instances — TRACE vs C₄ are different asks ─
// TRACE (Negate) applies on every IStarRing already in src. C₄ `u² = −1`
// is stricter: ℂ and above + Cl(3,0) bivectors. ℝ and ℤ have unit group
// C₂, not C₄. IntervalRing / tropical / Boolean stay at ISemiring and
// cannot even take pingReturn (compile-time). Ports (TS star-ring,
// Rust f64/Complex) are the same dictionaries, not extra algebras.

let private closeQ (a: Quaternion) (b: Quaternion) =
    closeC a.Real b.Real && closeC a.Imag b.Imag

let private closeO (a: Octonion) (b: Octonion) =
    closeQ a.Real b.Real && closeQ a.Imag b.Imag

let private pingAnnihilates (ring: IStarRing<'W>) (eq: 'W -> 'W -> bool) (w: 'W) =
    eq (ring.Add(w, FC.pingReturn ring w)) ring.Zero
    && eq (FC.pingReturn ring (FC.pingReturn ring w)) w

[<Fact>]
let ``A: IntegerRing.Star is the ℤ IStarRing — TRACE applies, C₄ does not`` () =
    let r = IntegerRing.Star
    pingAnnihilates r (=) 7L |> should equal true
    r.Mul(r.One, r.One) |> should equal r.One
    r.Mul(r.Negate r.One, r.Negate r.One) |> should equal r.One
    r.Mul(r.One, r.One) = r.Negate r.One |> should equal false
    // FourCornerTrace on the named ℤ instance (no test-local re-box)
    let gen: FourCornerTrace.Generator<int list, Map<int, int>, int, int64> =
        fun interp history ->
            history
            |> List.map (fun x ->
                (match Map.tryFind x interp with
                 | Some y -> y
                 | None -> x),
                1L)
    let update (interp: Map<int, int>) ((raw, label): int * int) = Map.add raw label interp
    let st0, _ = FourCornerTrace.start r ((=) 0L) gen [ 0 ] Map.empty
    let st1, d = FourCornerTrace.step r ((=) 0L) gen update [ 0 ] (0, 7) st0
    d |> should equal [ 0, -1L; 7, 1L ]
    st1.Emitted |> should equal [ 7, 1L ]

[<Fact>]
let ``A: Real.algebra TRACE applies; unit group is C₂ not C₄`` () =
    let r = Real.algebra
    pingAnnihilates r (fun a b -> abs (a - b) < 1e-12) 2.5 |> should equal true
    r.Mul(1.0, 1.0) |> should equal 1.0
    r.Mul(-1.0, -1.0) |> should equal 1.0
    r.Mul(1.0, 1.0) = r.Negate r.One |> should equal false

[<Fact>]
let ``A: quaternion i and j each square to −1 — C₄ is a subgroup of ℍ*, not ℍ`` () =
    let r = ImaginaryStack.quaternion
    pingAnnihilates r closeQ FC.quaternionI |> should equal true
    closeQ (r.Mul(FC.quaternionI, FC.quaternionI)) (r.Negate r.One) |> should equal true
    closeQ (r.Mul(FC.quaternionJ, FC.quaternionJ)) (r.Negate r.One) |> should equal true
    // i and j anticommute — ℍ is bigger than C₄ (the identification refusal)
    closeQ (r.Mul(FC.quaternionI, FC.quaternionJ)) (r.Mul(FC.quaternionJ, FC.quaternionI))
    |> should equal false

[<Fact>]
let ``A: octonion lift of i still squares to −1 — tower TRACE + C₄ both apply`` () =
    let r = ImaginaryStack.octonion
    pingAnnihilates r closeO FC.octonionI |> should equal true
    closeO (r.Mul(FC.octonionI, FC.octonionI)) (r.Negate r.One) |> should equal true

// ── (F) FourCorner is not a fermion; the Adinkra connection is the
//     missing feedback axis. Three different fours. Coded vs uncoded
//     both split 8B+8F — same count, different objects.

[<Fact>]
let ``F: three different fours — I/O slots, code k, N supercharges`` () =
    FC.fourCornerSlotCount |> should equal 4
    FC.adinkraCodeDimensionK |> should equal 4
    FC.adinkraSuperchargesN |> should equal 8
    AdinkraCode.dimension |> should equal FC.adinkraCodeDimensionK
    AdinkraCode.supercharges |> should equal AdinkraCode.length
    // node count 16 is shared by the N=4 cube and the [8,4] quotient —
    // valence discriminates (4 vs 8), matching a 16 does not
    AdinkraCode.adinkraNodes |> should equal 16
    AdinkraCode.adinkraValence |> should equal 8
    AdinkraIharaZeta.nodes |> should equal 16

[<Fact>]
let ``F: coded [8,4] is K_8,8 — 8 bosons + 8 fermions; FourCorner is not a vertex`` () =
    AdinkraIharaZeta.isCompleteBipartiteOnCosetParity |> should equal true
    FC.codedBosonFermionCounts |> should equal (8, 8)
    // the I/O record has 4 slots, not 8+8 nodes
    FC.fourCornerSlotCount = fst FC.codedBosonFermionCounts
    |> should equal false
    // dashing −1 is C₄ south / e^{iπ}, on an EDGE, not a fermion node
    FC.dashingSignIsSouth |> should equal true
    FC.south |> should equal FC.MinusOne
    closeC FC.eulerPi (cRing.Negate cRing.One) |> should equal true

[<Fact>]
let ``F: N=1 Q-odd carries boson to fermion — FourCorner.north is TIn rest, not a boson`` () =
    AdinkraClock.initial.Field |> should equal AdinkraClock.Boson
    let s1, tick = AdinkraClock.step AdinkraClock.initial
    s1.Field |> should equal AdinkraClock.Fermion
    tick |> should equal false
    let s2, tick2 = AdinkraClock.step s1
    s2.Field |> should equal AdinkraClock.Boson
    tick2 |> should equal true
    // FourCorner rest is the I/O product with only TIn set
    let rest = FourCorner.ofIn 1
    FourCorner.hasFeedback rest |> should equal false
    FourCorner.hasOutput rest |> should equal false

[<Fact>]
let ``F: coded tower costs homoiconicity; uncoded Cl(0,8) defect is 1`` () =
    FC.codedHomoiconicityDefect |> should equal 16
    FC.uncodedHomoiconicityDefect |> should equal 1
    FC.uncodedVertexCount 8 |> should equal 256
    // coded: dim A / dim M = 2^N / 2^(N-k) = 2^k
    AdinkraCode.homoiconicityDefect
    |> should equal (1 <<< AdinkraCode.dimension)
    // uncoded regular representation: vertices = dim Cl(0,N)
    FC.uncodedVertexCount 8
    |> should equal (1 <<< 8)
    FC.uncodedN8HalvesSeparate |> should equal true
    // both towers split 8+8; the coded split is the quotient bipartition,
    // the uncoded split is the even-subalgebra blocks. Same count.
    FC.codedBosonFermionCounts |> should equal (8, 8)

// ── (M) two compasses compose at Meijer's missing feedback; error is
//     a one-way sum (erasing); feedback is a product (reversible).

[<Fact>]
let ``M: Meijer duals are 2-corner; FourCorner and Rx are two 2×2 compasses`` () =
    FC.meijerDualCornerCount |> should equal 2
    FC.fourCornerSlotCount |> should equal 4
    FC.allRxModes.Length |> should equal 4
    // same count of four, different objects (I/O vs state-mode)
    FC.allRxModes
    |> List.distinct
    |> List.length
    |> should equal 4
    FC.north |> should equal FC.One
    FC.east |> should equal FC.I
    FC.south |> should equal FC.MinusOne
    FC.west |> should equal FC.MinusI

[<Fact>]
let ``M: feedback is a product (keeps TIn); error is a sum (discards Ok)`` () =
    let filled =
        FourCorner.ofIn 7
        |> FourCorner.withOut 8
        |> FourCorner.withOutFeedback "authored"
        |> FourCorner.withInFeedback "ack"
    FC.feedbackKeepsInput 7 filled |> should equal true
    filled.TOut |> should equal (Some 8)
    // ISR / OnError analogue: the value channel is gone
    let err: Result<int, InterruptFeedback> = Error(Failed "onError analogue")
    FC.errorDiscardsValue err |> should equal true
    match err with
    | Ok _ -> failwith "sum discarded the value — Ok is unreachable"
    | Error(Failed msg) -> msg |> should equal "onError analogue"
    | Error _ -> failwith "expected Failed"
    // Landauer/Bennett: fibre 1 is reversible (ping-return); fibre 2 erases
    FC.pingReturnClass
    |> should equal ErasureClass.ThermodynamicClass.Reversible
    FC.errorShortCircuitClass
    |> should equal ErasureClass.ThermodynamicClass.Erasing
    // ping-return itself is Negate, fibre-1 on the weight
    closeC (FC.pingReturn cRing cRing.One) (cRing.Negate cRing.One)
    |> should equal true

// ── (E8) roots + algebra metered; compact group is a substitute.
//     Weyl is a fourth object, not the missing group.

[<Fact>]
let ``E8: roots 240 and algebra 248 are metered; compact group is still a substitute`` () =
    let inv = FC.e8ThreeObjects
    inv.RootsMetered |> should equal 240
    inv.AlgebraMetered |> should equal 248
    inv.RootsMetered + 8 |> should equal inv.AlgebraMetered
    inv.CompactGroupIsSubstitute |> should equal true
    inv.ChevalleyRootGroupsMetered |> should equal true
    inv.CompactFormNegativeDefinite |> should equal true
    inv.CentreOrder |> should equal 1
    // the Killing diagonal is an algebra-basis form, not a group multiply
    E8LieAlgebra.compactFormKillingDiagonal.Length
    |> should equal inv.AlgebraMetered
    // two E8 routes (Cartan+roots vs so(16)+spinor) already agree at 248
    let cartan, roots = CliffordPeriodicity.e8RootDecomposition
    let _, spinorTotal = CliffordPeriodicity.e8FromSpinors
    cartan + roots |> should equal spinorTotal
    spinorTotal |> should equal inv.AlgebraMetered
    // coded Construction A lattice roots = algebra roots (set size)
    E8Lattice.roots.Length |> should equal inv.RootsMetered
    // split Chevalley group has a multiply; compact manifold still does not
    E8ChevalleyGroup.oneParameterHolds E8LieAlgebra.chevalleyE.[0] 1 1
    |> should equal true

// ── (K) one clock tick = FourCorner 2×2; Meijer 2-corner is one Q.
//     Mutual-option factor √2; bound is 2√2 (front 2 = classical).
//     {Q,Q}: two deniable moves, both true-ish, future snap.
//     +1/−1 compass: related C₄ points, divergent as maps.

[<Fact>]
let ``K: one tick fills four corners; Meijer 2-corner is one Q of {Q,Q}`` () =
    let tick = FC.oneTick 1 2 "authored" "ack"
    FC.occupancyCount tick |> should equal 4
    FC.occupancyCount (FourCorner.ofIn 1) |> should equal 1
    FC.adinkraQMovesPerTick |> should equal 2
    FC.meijerDualCornerCount |> should equal FC.adinkraQMovesPerTick
    FC.fourCornerSlotCount
    |> should equal (FC.adinkraQMovesPerTick * FC.meijerDualCornerCount)
    // AdinkraClock: two Q-moves emit one ∂_τ
    let s1, t1 = AdinkraClock.step AdinkraClock.initial
    t1 |> should equal false
    let s2, t2 = AdinkraClock.step s1
    t2 |> should equal true
    s2.DTauOrder |> should equal 1

[<Fact>]
let ``K: 2 × occupancy-√2 lines up with 2√2 — coincidence, not a measurement`` () =
    FC.classicalChshFloor |> should equal 2
    FC.classicalSSquared |> should equal 4
    FC.tsirelsonSSquared |> should equal 8
    abs (FC.mutualOptionOccupancyNorm true true - sqrt 2.0) < 1e-12
    |> should equal true
    // numbers line up — that is the coincidence Otto named
    abs (FC.toyOccupancyTimesClassicalFloor - BellTest.TsirelsonBound) < 1e-12
    |> should equal true
    BellTest.ClassicalBound |> should equal (float FC.classicalChshFloor)
    FC.tsirelsonSSquared
    |> should equal (FC.classicalChshFloor * FC.classicalChshFloor * 2)
    let eqM (a: Tsirelson.M) (b: Tsirelson.M) =
        Seq.forall2 (fun (r1: int[]) (r2: int[]) -> r1 = r2) a b
    let c2 = Tsirelson.mul Tsirelson.C Tsirelson.C
    let c4 = Tsirelson.mul c2 c2
    eqM c4 (Tsirelson.scale FC.tsirelsonSSquared c2) |> should equal true
    let classicalC =
        Tsirelson.chshOf Tsirelson.A Tsirelson.A Tsirelson.B Tsirelson.B'
    eqM
        (Tsirelson.mul classicalC classicalC)
        (Tsirelson.scale FC.classicalSSquared Tsirelson.identity)
    |> should equal true
    // WHAT IS MEASURED at L=0 / seed-shared is S=4, not 2√2
    match FeedbackThrottle.measuredSeedSharedS4 with
    | FeedbackThrottle.Measured(s, _) ->
        s |> should equal BellTest.AlgebraicMax
        s = BellTest.TsirelsonBound |> should equal false
    | other -> failwithf "expected Measured S=4, got %A" other
    FeedbackThrottle.maxChsh 0.0 |> should equal BellTest.AlgebraicMax
    BellTest.chshOf 1.0 -1.0 1.0 1.0 |> should equal BellTest.AlgebraicMax
    // 2√2 is the predicted floor — unmeasured as a network result
    match FeedbackThrottle.tsirelsonFloorToBeMeasured with
    | FeedbackThrottle.UnmeasuredPredictedFloor(s, reason) ->
        abs (s - BellTest.TsirelsonBound) < 1e-12 |> should equal true
        reason.IndexOf("not occupancy", System.StringComparison.Ordinal)
        >= 0
        |> should equal true
    | other -> failwithf "expected UnmeasuredPredictedFloor, got %A" other
    let both = FC.oneTick 7 8 "fb" "ack"
    FC.feedbackKeepsInput 7 both |> should equal true

[<Fact>]
let ``K: {Q,Q} is two deniable moves; both true-ish until the future snap`` () =
    // first Q emits no ∂_τ — deniable as a clock event
    let s1, t1 = AdinkraClock.step AdinkraClock.initial
    t1 |> should equal false
    s1.DTauOrder |> should equal 0
    s1.Field |> should equal AdinkraClock.Fermion
    // second Q completes {Q,Q}: the tick / collapse of the pair
    let s2, t2 = AdinkraClock.step s1
    t2 |> should equal true
    s2.DTauOrder |> should equal 1
    // both options occupied (product) until that close — neither erased
    let live = FC.oneTick 1 2 "up-ish" "down-ish"
    FC.occupancyCount live |> should equal 4
    FC.feedbackKeepsInput 1 live |> should equal true
    // SoftValue: two candidates, both true-ish; snap is the only collapse
    match SoftValue.ofWeighted
        [ DynamicValue.String "up", 0.5
          DynamicValue.String "down", 0.5 ] with
    | None -> failwith "two-candidate support should build"
    | Some sv ->
        SoftValue.confidence sv < 1.0 |> should equal true
        SoftValue.resolve 0.9 sv |> should equal None
        match SoftValue.snap SoftValue.best sv with
        | Some(DynamicValue.String _) -> ()
        | other -> failwithf "snap is the sanctioned collapse, got %A" other

[<Fact>]
let ``K: +1/−1 compass related at C₄, divergent as maps — Negate involutes, Error does not`` () =
    FC.plusOnePhase |> should equal FC.One
    FC.minusOnePhase |> should equal FC.MinusOne
    FC.mul FC.plusOnePhase FC.minusOnePhase |> should equal FC.MinusOne
    // related: both are C₄ points; −1 = e^{iπ} = pingReturn(One)
    closeC PhasorEndurance.genuineDelta cRing.One |> should equal true
    closeC PhasorEndurance.retractionDelta (cRing.Negate cRing.One)
    |> should equal true
    FC.negateIsInvolution cRing closeC cRing.One |> should equal true
    FC.negateIsInvolution cRing closeC (Doubled.make 0.3 0.4)
    |> should equal true
    // divergent: Meijer OnError / ISR Error is a terminal sum, not Negate
    let err: Result<int, InterruptFeedback> = Error(Failed "onError analogue")
    FC.errorHasNoInverse err |> should equal true
    FC.errorDiscardsValue err |> should equal true
    FC.pingReturnClass
    |> should equal ErasureClass.ThermodynamicClass.Reversible
    FC.errorShortCircuitClass
    |> should equal ErasureClass.ThermodynamicClass.Erasing


// ── Occupancy coordinate vs SchedulerZeta.predict ─────────────────
// Occupancy is a count (how many corners filled). Predict's key must
// be injective on the reachable set or runToHorizon is stale. Two
// fillings that share occupancy 2 are distinct I/O records.

[<Fact>]
let ``occupancy-keyed predict collapses distinct fillings that share a count`` () =
    let dataFilled: FourCorner.FourCornerOwnership<int, int, string, string> =
        FourCorner.ofIn 1 |> FourCorner.withOut 2
    let fbFilled: FourCorner.FourCornerOwnership<int, int, string, string> =
        FourCorner.ofIn 1 |> FourCorner.withOutFeedback "authored"
    FC.occupancyCount dataFilled |> should equal 2
    FC.occupancyCount fbFilled |> should equal 2
    dataFilled = fbFilled |> should equal false

    let step (o: FourCorner.FourCornerOwnership<int, int, string, string>) =
        if FourCorner.hasOutput o then fbFilled else dataFilled

    let rOcc = SchedulerZeta.predict FC.occupancyKey step dataFilled
    rOcc.Period |> should equal 1
    rOcc.Reachable |> should equal 1

    let rCorners = SchedulerZeta.predict FC.cornersKey step dataFilled
    rCorners.Period |> should equal 2
    rCorners.Reachable |> should equal 2


[<Fact>]
let ``occupancy-keyed runToHorizon is stale; cornersKey matches step n`` () =
    let dataFilled: FourCorner.FourCornerOwnership<int, int, string, string> =
        FourCorner.ofIn 1 |> FourCorner.withOut 2
    let fbFilled: FourCorner.FourCornerOwnership<int, int, string, string> =
        FourCorner.ofIn 1 |> FourCorner.withOutFeedback "authored"
    let step (o: FourCorner.FourCornerOwnership<int, int, string, string>) =
        if FourCorner.hasOutput o then fbFilled else dataFilled
    let naive n =
        let mutable s = dataFilled
        for _ in 1 .. n do
            s <- step s
        s

    let stale = SchedulerZeta.runToHorizon FC.occupancyKey step dataFilled 1
    stale = naive 1 |> should equal false
    stale = dataFilled |> should equal true

    let honest = SchedulerZeta.runToHorizon FC.cornersKey step dataFilled 1
    honest = naive 1 |> should equal true
    honest = fbFilled |> should equal true


// ═══════════════════════════════════════════════════════════════════
// (B) THE SECOND FOUR-ELEMENT TRAP — Belnap's FOUR is NOT C₄.
//
// A `(trueChance, falseChance)` pair with independently floating legs is
// the interlaced bilattice `[0,1] ⊙ [0,1]` (Ginsberg 1988; Fitting 1991;
// Avron 1996); its four extreme points are Belnap's FOUR (Belnap 1977).
// C₄ also has four elements. The COUNT is shared and therefore decides
// nothing — `.claude/rules/numerology-vs-number-theory.md`.
//
// What is proved here, by invariant rather than by count:
//   (B1) orders differ: the compass generator has order 4, the bilattice
//        negation has order 2.
//   (B2) THE GUARD — exhaustively, no bijection Phase → Belnap carries
//        `rotateI` to `¬`. With a POSITIVE CONTROL so the empty search is
//        known to be a real search.
//   (B3) the half-turn reading fails too, on fixed points (0 vs 2).
//   (B4) CONTROL — the count test, which passes for both and proves
//        nothing. Present on purpose.
//   (B5) FOUR really is an interlaced bilattice: two partial orders, both
//        lattices, interlaced, with a `≤_t`-antitone / `≤_k`-monotone
//        involutive negation. Exhaustive over 4 and 4×4 and 4×4×4.
//   (B6) the corner embedding into `[0,1] ⊙ [0,1]` is a homomorphism for
//        all five operations — which is what "FOUR is the extreme points
//        of the belief pair" means as a checkable statement.
//   (B7) SECOND STRUCTURE CHECKED — `SoftValue`. It is NOT a bilattice:
//        normalisation pins Boole's residual at 0, so the knowledge order
//        collapses and `Neither`/`Both` are unrepresentable.
//   (B8) THIRD STRUCTURE CHECKED — `IntervalWeight`. Its CARRIER carries
//        the bilattice structure under lattice operations; the operations
//        `IntervalRing` actually SHIPS are Moore arithmetic and are not
//        those. The identification does not transfer to the algebra.
//
// Satellite: docs/research/2026-09-11-the-belief-pair-as-a-weight-for-the-
// universal-tensor-bilattice-boole-slack-and-the-typed-regulariser-lumen.md §4
// ═══════════════════════════════════════════════════════════════════

let private belnaps = FC.allBelnap
let private beliefClose (a: FC.BeliefPair) (b: FC.BeliefPair) =
    abs (a.TrueChance - b.TrueChance) < 1e-12
    && abs (a.FalseChance - b.FalseChance) < 1e-12


[<Fact>]
let ``B1 compass generator has order 4; the bilattice negation has order 2`` () =
    FC.compassRotationOrder |> should equal 4
    FC.belnapNegationOrder |> should equal 2
    // Stated as the non-isomorphism it is: the order of a distinguished
    // unary map is preserved by any isomorphism of unary algebras.
    FC.compassRotationOrder = FC.belnapNegationOrder |> should equal false


[<Fact>]
let ``B2 THE GUARD - no bijection carries the C4 quarter-turn to the bilattice negation`` () =
    // The search is live: it FINDS an intertwiner when one exists.
    FC.intertwinerExists FC.phaseCarrier FC.phaseCarrier FC.rotateI FC.rotateI
    |> should equal true

    FC.intertwinerExists belnaps belnaps FC.belnapNegate FC.belnapNegate
    |> should equal true

    // And it finds none here, over all 4! = 24 candidates.
    FC.compassNegationIntertwinerExists |> should equal false


[<Fact>]
let ``B3 the half-turn reading fails too - fixed-point counts 0 vs 2`` () =
    FC.compassHalfTurnFixedPoints |> should equal 0
    FC.belnapNegationFixedPoints |> should equal 2
    FC.compassHalfTurnNegationIntertwinerExists |> should equal false

    // Both maps ARE involutions, so order alone does not separate them
    // here — the fixed points do. That is why B1 is not sufficient.
    FC.unaryOrder 8 FC.phaseCarrier (FC.mul FC.MinusOne) |> should equal 2
    FC.belnapNegationOrder |> should equal 2


[<Fact>]
let ``B4 CONTROL - the count test passes for both and therefore proves nothing`` () =
    FC.carrierSizes |> should equal (4, 4)
    List.length FC.phaseCarrier |> should equal (List.length belnaps)
    // Both distinguished maps are bijections on their carrier. Also shared.
    // Nothing in this test distinguishes the two objects, by design.
    FC.phaseCarrier |> List.map FC.rotateI |> List.sort |> should equal (List.sort FC.phaseCarrier)
    belnaps |> List.map FC.belnapNegate |> List.sort |> should equal (List.sort belnaps)


[<Fact>]
let ``B5 FOUR is an interlaced bilattice - two orders, lattices, interlaced`` () =
    let pairs = [ for a in belnaps do for b in belnaps -> a, b ]
    let triples = [ for a in belnaps do for b in belnaps do for c in belnaps -> a, b, c ]

    // Both relations are partial orders.
    for leq in [ FC.belnapLeqT; FC.belnapLeqK ] do
        belnaps |> List.forall (fun a -> leq a a) |> should equal true
        pairs |> List.forall (fun (a, b) -> not (leq a b && leq b a) || a = b) |> should equal true
        triples
        |> List.forall (fun (a, b, c) -> not (leq a b && leq b c) || leq a c)
        |> should equal true

    // The two orders are genuinely different relations.
    pairs |> List.exists (fun (a, b) -> FC.belnapLeqT a b <> FC.belnapLeqK a b) |> should equal true

    // Join/meet are least upper / greatest lower bounds in their OWN order.
    let lub leq join =
        pairs |> List.forall (fun (a, b) ->
            let j = join a b
            leq a j && leq b j
            && belnaps |> List.forall (fun u -> not (leq a u && leq b u) || leq j u))
    let glb leq meet =
        pairs |> List.forall (fun (a, b) ->
            let m = meet a b
            leq m a && leq m b
            && belnaps |> List.forall (fun u -> not (leq u a && leq u b) || leq u m))

    lub FC.belnapLeqT FC.belnapJoinT |> should equal true
    glb FC.belnapLeqT FC.belnapMeetT |> should equal true
    lub FC.belnapLeqK FC.belnapJoinK |> should equal true
    glb FC.belnapLeqK FC.belnapMeetK |> should equal true

    // INTERLACING (Ginsberg 1988): each order's operations are monotone
    // with respect to the OTHER order.
    let monotoneUnder leq op =
        triples |> List.forall (fun (a, b, c) -> not (leq a b) || leq (op a c) (op b c))

    for op in [ FC.belnapJoinT; FC.belnapMeetT ] do
        monotoneUnder FC.belnapLeqK op |> should equal true
    for op in [ FC.belnapJoinK; FC.belnapMeetK ] do
        monotoneUnder FC.belnapLeqT op |> should equal true

    // NEGATION: ≤_t-antitone, ≤_k-MONOTONE, involution (Fitting 1991).
    pairs
    |> List.forall (fun (a, b) -> not (FC.belnapLeqT a b) || FC.belnapLeqT (FC.belnapNegate b) (FC.belnapNegate a))
    |> should equal true

    pairs
    |> List.forall (fun (a, b) -> not (FC.belnapLeqK a b) || FC.belnapLeqK (FC.belnapNegate a) (FC.belnapNegate b))
    |> should equal true

    belnaps |> List.forall (fun a -> FC.belnapNegate (FC.belnapNegate a) = a) |> should equal true

    // The knowledge order's top is the GLUT — the corner every
    // consistency-constrained structure is missing (see B7).
    FC.belnapJoinK FC.Belnap.True FC.Belnap.False |> should equal FC.Belnap.Both
    FC.belnapMeetK FC.Belnap.True FC.Belnap.False |> should equal FC.Belnap.Neither


[<Fact>]
let ``B6 the corner embedding into [0,1] (x) [0,1] is a bilattice homomorphism`` () =
    let pairs = [ for a in belnaps do for b in belnaps -> a, b ]

    belnaps
    |> List.forall (fun a -> beliefClose (FC.belnapToPair (FC.belnapNegate a)) (FC.beliefNegate (FC.belnapToPair a)))
    |> should equal true

    for (corner, continuous) in
        [ FC.belnapJoinT, FC.beliefJoinT
          FC.belnapMeetT, FC.beliefMeetT
          FC.belnapJoinK, FC.beliefJoinK
          FC.belnapMeetK, FC.beliefMeetK ] do
        pairs
        |> List.forall (fun (a, b) ->
            beliefClose (FC.belnapToPair (corner a b)) (continuous (FC.belnapToPair a) (FC.belnapToPair b)))
        |> should equal true

    // Boole's slack r = 1 − t − f separates the four corners into the
    // three regimes: ignorance (+1), classical (0), incoherence (−1).
    FC.beliefResidual (FC.belnapToPair FC.Belnap.Neither) |> should (equalWithin 1e-12) 1.0
    FC.beliefResidual (FC.belnapToPair FC.Belnap.True) |> should (equalWithin 1e-12) 0.0
    FC.beliefResidual (FC.belnapToPair FC.Belnap.False) |> should (equalWithin 1e-12) 0.0
    FC.beliefResidual (FC.belnapToPair FC.Belnap.Both) |> should (equalWithin 1e-12) (-1.0)


[<Fact>]
let ``B7 SECOND STRUCTURE - SoftValue is NOT a bilattice, normalisation kills the knowledge order`` () =
    // A two-candidate SoftValue is the obvious in-repo candidate for a
    // (trueChance, falseChance) pair. It does not qualify, and the reason
    // is its own stated invariant: "weights sum to 1".
    let tv = DynamicValue.Bool true
    let fv = DynamicValue.Bool false

    let chances (sv: SoftValue.SoftValue) =
        let get v = sv.Candidates |> List.tryFind (fun (d, _) -> d = v) |> Option.map snd |> Option.defaultValue 0.0
        FC.beliefPair (get tv) (get fv)

    let samples =
        [ 1.0, 0.0; 0.0, 1.0; 0.5, 0.5; 0.9, 0.1; 0.2, 0.7; 3.0, 1.0 ]
        |> List.choose (fun (t, f) -> SoftValue.ofWeighted [ tv, t; fv, f ])

    samples |> List.isEmpty |> should equal false

    // Boole's residual is pinned at 0 for EVERY reachable value, so the
    // knowledge axis — the one carrying the signal — has no extent at all.
    samples
    |> List.forall (fun sv -> abs (FC.beliefResidual (chances sv)) < 1e-9)
    |> should equal true

    // Consequence: the two gluts/gaps of FOUR are unreachable. `Neither`
    // needs r = 1 and `Both` needs r = −1; a normalised distribution can
    // produce neither, at any input weights.
    samples
    |> List.exists (fun sv ->
        let p = chances sv
        beliefClose p (FC.belnapToPair FC.Belnap.Neither) || beliefClose p (FC.belnapToPair FC.Belnap.Both))
    |> should equal false

    // The unnormalised back door reaches them — which is exactly why
    // `SoftValue.unnormalized` is named "the invariant-violating route".
    // So the missing corners are a property of the INVARIANT, not of the
    // representation. (Control for the claim above: the carrier can hold
    // the glut; the normalised constructor cannot produce it.)
    let glut = SoftValue.unnormalized [ tv, 1.0; fv, 1.0 ]
    beliefClose (chances glut) (FC.belnapToPair FC.Belnap.Both) |> should equal true


[<Fact>]
let ``B8 THIRD STRUCTURE - IntervalWeight carries the bilattice, IntervalRing does not ship it`` () =
    // `IntervalWeight` is `[Lo, Hi]`, which is the `(u,v) = (t, 1−f)`
    // reparameterisation of a belief pair. Under LATTICE operations the
    // carrier does carry the bilattice structure — including the
    // negation its own docstring names, `−[a,b] = [−b,−a]`.
    let iv (lo: float) (hi: float) = IntervalWeight(lo, hi)
    let grid = [ for lo in [ -1.0; 0.0; 1.0 ] do for hi in [ -1.0; 0.0; 1.0 ] -> iv lo hi ]
    let pairs = [ for a in grid do for b in grid -> a, b ]

    let leqT (a: IntervalWeight) (b: IntervalWeight) = a.Lo <= b.Lo && a.Hi <= b.Hi
    let leqK (a: IntervalWeight) (b: IntervalWeight) = a.Lo <= b.Lo && a.Hi >= b.Hi
    let negI (a: IntervalWeight) = iv (-a.Hi) (-a.Lo)

    // Involution, ≤_t-antitone, ≤_k-monotone — the three bilattice-negation
    // conditions, on the in-repo type.
    grid |> List.forall (fun a -> negI (negI a) = a) |> should equal true
    pairs |> List.forall (fun (a, b) -> not (leqT a b) || leqT (negI b) (negI a)) |> should equal true
    pairs |> List.forall (fun (a, b) -> not (leqK a b) || leqK (negI a) (negI b)) |> should equal true

    // THE FINDING, and it is the numerology trap one level down: the
    // operations `IntervalRing` actually ships are Moore arithmetic, and
    // they are NOT the lattice operations above. Witness: the truth-join
    // of [0,1] with itself is [0,1]; Moore Add gives [0,2].
    let ring = IntervalRing.Instance
    let truthJoin (a: IntervalWeight) (b: IntervalWeight) = iv (max a.Lo b.Lo) (max a.Hi b.Hi)
    let unit = iv 0.0 1.0
    truthJoin unit unit |> should equal unit
    ring.Add(unit, unit) |> should equal (iv 0.0 2.0)
    ring.Add(unit, unit) = truthJoin unit unit |> should equal false

    // And the carrier is UNBOUNDED: for every interval there is a strictly
    // ≤_k-greater one, so ℝ⊙ℝ has no ⊤_k, hence no extreme points, hence no
    // Belnap corners and no FOUR. Avron's representation theorem is about
    // BOUNDED interlaced bilattices; that clause does work, not decoration.
    grid
    |> List.forall (fun a ->
        let up = iv (a.Lo + 1.0) (a.Hi - 1.0)
        leqK a up && up <> a)
    |> should equal true
