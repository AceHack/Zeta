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
