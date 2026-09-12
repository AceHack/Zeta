module Zeta.Tests.DualScoreTests

open global.Xunit
open Zeta.Core

module DS = Zeta.Core.DualScore
module SV = Zeta.Core.SoftValue
module SVB = Zeta.Core.SoftValueBelief

// ═══════════════════════════════════════════════════════════════════════════════
// The belief pair, and the four corners it makes reachable.
//
// Every section below is a falsifier for one claim in `DualScore.fs` / `SoftValueBelief.fs`.
// Where a section asserts a REFUSAL it is paired with an explicit CONTROL, because a
// constructor that refused everything would pass every "it refuses X" assertion and would be
// the vacuity class wearing a validator.
// ═══════════════════════════════════════════════════════════════════════════════

let private ok (r: Result<'a, DS.Refusal>) : 'a =
    match r with
    | Ok v -> v
    | Error e -> failwithf "expected Ok, got refusal %A" e

let private err (r: Result<'a, DS.Refusal>) : DS.Refusal =
    match r with
    | Ok v -> failwithf "expected a refusal, got Ok %A — a value was accepted that must not be" v
    | Error e -> e

let private approx (a: float) (b: float) = abs (a - b) < 1e-12
let private cand i = DynamicValue.Int(int64 i)

/// The tolerance these tests own when reading a FLOAT-SUMMED residual. Stated once, here, because
/// §FLOAT below measures why a tolerance is needed at all: normalisation lands within one ULP of
/// the coherent slice, never on it. `1e-12` is four orders above the measured `2.22e-16` and
/// twelve below the smallest deliberate residual in this file (`0.5`), so it separates noise from
/// signal with room on both sides. It is this test file's number, not the library's — the library
/// ships no default (`DualScore.massShapeWithin`).
let private TEST_TOL = 1e-12

// ───────────────────────────────────────────────────────────────────────────────
// §THE FINDING — `SoftValue`'s invariant pins r = 0; its CARRIER does not.
//
// This is the measurement the whole change rests on, so it is a test rather than a claim in a
// header. Two halves, and they must BOTH hold: if the first failed the finding would be wrong;
// if the second failed the fix would have to be a new carrier rather than a new invariant.
// ───────────────────────────────────────────────────────────────────────────────

[<Fact>]
let ``every normalising SoftValue constructor confines the residual to zero`` () =
    let a, b, c = cand 0, cand 1, cand 2
    let uniform = (SV.ofWeighted [ a, 1.0; b, 1.0; c, 1.0 ]).Value
    let skewed = (SV.ofWeighted [ a, 7.0; b, 2.0; c, 1.0 ]).Value

    let reachable: SV.SoftValue list =
        [ SV.certain a
          uniform
          skewed
          SV.map (fun _ -> a) skewed
          SV.bind (fun _ -> uniform) skewed
          (SV.observe (fun d -> if d = a then 0.9 else 0.05) skewed).Value
          (SV.combine uniform skewed).Value
          SV.widen 0.5 skewed
          (match SV.foldRetainedBounded (SV.window 4L) [ { SV.Phase = 1L; SV.Likelihood = fun d -> if d = b then 0.8 else 0.2 } ] skewed with
           | SV.Folded sv -> sv
           | other -> failwithf "expected Folded, got %A" other) ]

    // Not one of them can leave the r = 0 slice. That is the confinement, and it is what makes
    // `Neither` and `Both` unreachable through the normalising API.
    for sv in reachable do
        let r = SVB.residual sv
        Assert.True(abs r < TEST_TOL, sprintf "residual was %.3e for %A" r (SV.candidates sv))
        Assert.Equal(DS.Coherent, SVB.massShapeWithin TEST_TOL sv)

    // CONTROL — the check above would also pass if `residual` always returned 0. It does not:
    // an unnormalised value moves it by a wide margin, so the assertion is about these inputs.
    Assert.True(abs (SVB.residual (SV.unnormalized [ a, 0.25; b, 0.25 ])) > 0.4)

[<Fact>]
let ``the SoftValue CARRIER holds both missing corners — the limit is the invariant`` () =
    let a, b = cand 0, cand 1

    // r > 0 — nobody has looked at 0.6 of the question.
    let ignorant = SV.unnormalized [ a, 0.2; b, 0.2 ]
    Assert.True(approx 0.6 (SVB.residual ignorant))
    Assert.Equal(DS.Ignorant, SVB.massShapeWithin TEST_TOL ignorant)

    // r < 0 — two sources both landed and the mass overfills.
    let contradictory = SV.unnormalized [ a, 0.8; b, 0.7 ]
    Assert.True(approx -0.5 (SVB.residual contradictory))
    Assert.Equal(DS.Contradictory, SVB.massShapeWithin TEST_TOL contradictory)

// ───────────────────────────────────────────────────────────────────────────────
// §FLOAT — the measurement that changed the API shape.
//
// The exact-arithmetic claim is "normalisation puts r at 0". In `float` it does not, and the
// SIGN inside that band is rounding noise rather than evidence. Pinned here because it is the
// entire reason `massShapeWithin` takes its tolerance as a value and `SoftValueBelief` ships no
// exact reader at all. Delete `massShapeWithin` and this section cannot compile; make it exact
// and it goes red.
// ───────────────────────────────────────────────────────────────────────────────

[<Fact>]
let ``a float-normalised SoftValue does NOT land on the coherent slice`` () =
    let a, b, c = cand 0, cand 1, cand 2

    // 7/2/1 normalised sums to 1.000000000000000222 — one ULP ABOVE 1.
    let skewed = (SV.ofWeighted [ a, 7.0; b, 2.0; c, 1.0 ]).Value
    let rSkewed = SVB.residual skewed
    Assert.NotEqual(0.0, rSkewed)
    Assert.True(rSkewed < 0.0, sprintf "expected a negative one-ULP residual, got %.3e" rSkewed)
    Assert.True(abs rSkewed < 1e-15, sprintf "expected |r| below 1e-15, got %.3e" rSkewed)

    // …and a `combine` posterior lands one ULP BELOW 1, i.e. on the other side.
    let uniform = (SV.ofWeighted [ a, 1.0; b, 1.0; c, 1.0 ]).Value
    let fused = (SV.combine uniform skewed).Value
    let rFused = SVB.residual fused
    Assert.NotEqual(0.0, rFused)
    Assert.True(rFused > 0.0, sprintf "expected a positive one-ULP residual, got %.3e" rFused)
    Assert.True(abs rFused < 1e-15, sprintf "expected |r| below 1e-15, got %.3e" rFused)

[<Fact>]
let ``an EXACT shape read misreports that noise as evidence — the trap the tolerance avoids`` () =
    let a, b, c = cand 0, cand 1, cand 2
    let skewed = (SV.ofWeighted [ a, 7.0; b, 2.0; c, 1.0 ]).Value
    let uniform = (SV.ofWeighted [ a, 1.0; b, 1.0; c, 1.0 ]).Value
    let fused = (SV.combine uniform skewed).Value

    // Exact reading (tolerance 0): two normalised distributions, two OPPOSITE verdicts, and both
    // verdicts are rounding. This is what an exact reader on `SoftValueBelief` would have shipped.
    Assert.Equal(DS.Contradictory, SVB.massShapeWithin 0.0 skewed)
    Assert.Equal(DS.Ignorant, SVB.massShapeWithin 0.0 fused)

    // With a tolerance the caller owns, both read Coherent, which is the honest answer.
    Assert.Equal(DS.Coherent, SVB.massShapeWithin TEST_TOL skewed)
    Assert.Equal(DS.Coherent, SVB.massShapeWithin TEST_TOL fused)

[<Fact>]
let ``partitioning into two legs can round back onto the slice — which is luck, not a guarantee`` () =
    // Measured and recorded rather than assumed: `beliefOf` sums each leg separately, and for
    // these inputs the two sums land on exactly 1 even though the N-way total does not. So the
    // projected pair is NOT reliably worse or better than the whole — it is a different sum with
    // its own rounding, which is precisely why the tolerance is the caller's to state and not a
    // constant anybody can derive from the type.
    let a, b, c = cand 0, cand 1, cand 2
    let skewed = (SV.ofWeighted [ a, 7.0; b, 2.0; c, 1.0 ]).Value

    Assert.NotEqual(0.0, SVB.residual skewed)
    Assert.Equal(0.0, DS.residual (ok (SVB.beliefOf (SVB.isValue a) skewed)))

[<Fact>]
let ``CONTROL — the tolerance does NOT swallow a real residual`` () =
    // Without this, `massShapeWithin = fun _ _ -> Coherent` would pass every assertion above.
    Assert.Equal(DS.Ignorant, DS.massShapeWithin TEST_TOL DS.vacuous)
    Assert.Equal(DS.Contradictory, DS.massShapeWithin TEST_TOL DS.both)
    // A tolerance wide enough to cover the corner DOES swallow it — so the parameter is live,
    // not ignored.
    Assert.Equal(DS.Coherent, DS.massShapeWithin 1.0 DS.vacuous)
    Assert.Equal(DS.Coherent, DS.massShapeWithin 1.0 DS.both)
    // A negative tolerance folds to zero rather than inverting the comparison.
    Assert.Equal(DS.massShape DS.vacuous, DS.massShapeWithin -1.0 DS.vacuous)

// ───────────────────────────────────────────────────────────────────────────────
// §FOUR CORNERS — all three residual regimes representable AND nameable.
// ───────────────────────────────────────────────────────────────────────────────

[<Fact>]
let ``all four Belnap corners construct through the refusing constructor`` () =
    Assert.Equal(DS.vacuous, ok (DS.create 0.0 0.0))
    Assert.Equal(DS.onlyTrue, ok (DS.create 1.0 0.0))
    Assert.Equal(DS.onlyFalse, ok (DS.create 0.0 1.0))
    Assert.Equal(DS.both, ok (DS.create 1.0 1.0))
    Assert.Equal(4, List.length DS.corners)
    Assert.Equal(4, DS.corners |> List.distinct |> List.length)

[<Fact>]
let ``the residual is signed and names all three regimes`` () =
    Assert.True(approx 1.0 (DS.residual DS.vacuous))
    Assert.True(approx 0.0 (DS.residual DS.onlyTrue))
    Assert.True(approx 0.0 (DS.residual DS.onlyFalse))
    Assert.True(approx -1.0 (DS.residual DS.both))

    Assert.Equal(DS.Ignorant, DS.massShape DS.vacuous)
    Assert.Equal(DS.Coherent, DS.massShape DS.onlyTrue)
    Assert.Equal(DS.Coherent, DS.massShape DS.onlyFalse)
    Assert.Equal(DS.Contradictory, DS.massShape DS.both)

    // The clamped halves agree with the signed quantity, in both directions.
    for s in DS.corners do
        Assert.True(approx (DS.ignorance s) (max 0.0 (DS.residual s)))
        Assert.True(approx (DS.contradiction s) (max 0.0 -(DS.residual s)))

[<Fact>]
let ``ignorance is NOT balanced evidence — the state a single probability cannot express`` () =
    let balanced = ok (DS.create 0.5 0.5)

    // Under one `p` both of these are 0.5. Here they are different values with different shapes.
    Assert.NotEqual(DS.vacuous, balanced)
    Assert.Equal(DS.Ignorant, DS.massShape DS.vacuous)
    Assert.Equal(DS.Coherent, DS.massShape balanced)
    Assert.True(approx 1.0 (DS.residual DS.vacuous))
    Assert.True(approx 0.0 (DS.residual balanced))

// ───────────────────────────────────────────────────────────────────────────────
// §REFUSAL — constructors refuse, they never clamp. Paired with its CONTROL.
// ───────────────────────────────────────────────────────────────────────────────

[<Fact>]
let ``CONTROL — the constructor ACCEPTS in-range legs and returns them unchanged`` () =
    // Without this, `create = fun _ _ -> Error ...` would pass every refusal test below.
    let s = ok (DS.create 0.3 0.4)
    Assert.True(approx 0.3 s.TrueChance)
    Assert.True(approx 0.4 s.FalseChance)

    // …and it accepts across the whole square, including the diagonal that a sum-to-1 invariant
    // would reject. `create` must have no opinion about the sum.
    for t in [ 0.0; 0.25; 0.5; 0.75; 1.0 ] do
        for f in [ 0.0; 0.25; 0.5; 0.75; 1.0 ] do
            let s = ok (DS.create t f)
            Assert.True(approx t s.TrueChance)
            Assert.True(approx f s.FalseChance)

[<Fact>]
let ``out-of-range legs are refused, never clamped`` () =
    Assert.Equal(DS.OutsideUnitInterval(DS.TrueChance, 1.4), err (DS.create 1.4 0.0))
    Assert.Equal(DS.OutsideUnitInterval(DS.FalseChance, -0.1), err (DS.create 0.0 -0.1))
    // Both bad: the TRUE leg is reported first, and that ordering is a contract, not an accident.
    Assert.Equal(DS.OutsideUnitInterval(DS.TrueChance, 2.0), err (DS.create 2.0 2.0))

[<Fact>]
let ``non-finite legs are refused, never coerced`` () =
    Assert.Equal(DS.NotFinite(DS.TrueChance, nan), err (DS.create nan 0.5))
    Assert.Equal(DS.NotFinite(DS.FalseChance, infinity), err (DS.create 0.5 infinity))
    Assert.Equal(DS.NotFinite(DS.TrueChance, -infinity), err (DS.create -infinity 0.5))

[<Fact>]
let ``the SUM is unconstrained — {1,1} and {0,0} both construct`` () =
    // The sum-to-1 invariant is precisely what this type refuses to impose.
    Assert.Equal(DS.both, ok (DS.create 1.0 1.0))
    Assert.Equal(DS.vacuous, ok (DS.create 0.0 0.0))
    Assert.True(approx -1.0 (DS.residual (ok (DS.create 1.0 1.0))))
    Assert.True(approx 1.0 (DS.residual (ok (DS.create 0.0 0.0))))

[<Fact>]
let ``neither leg is derived from the other — no 1-minus-p anywhere`` () =
    // If either leg were computed from the other, some grid point would disagree with its input.
    for i in 0..10 do
        for j in 0..10 do
            let t, f = float i / 10.0, float j / 10.0
            let s = ok (DS.create t f)
            Assert.True(approx t s.TrueChance)
            Assert.True(approx f s.FalseChance)
            // …and the pair that a complementary encoding would have produced is a DIFFERENT
            // value whenever the legs do not happen to be complementary.
            if abs (t + f - 1.0) > 1e-12 then
                Assert.NotEqual(ok (DS.create t (1.0 - t)), s)

// ───────────────────────────────────────────────────────────────────────────────
// §NUMEROLOGY GUARD — FOUR is not C₄, and the witness is structural.
//
// `.claude/rules/numerology-vs-number-theory.md`: a count of four identifies nothing.
// `src/Core/FourCornerC4.fs` carries a live C₄ compass {1, i, −1, −i} on four elements. The
// invariant that separates them is the ORDER of the structure map.
// ───────────────────────────────────────────────────────────────────────────────

[<Fact>]
let ``negation is an involution — order exactly 2, so it is not a C4 generator`` () =
    for s in DS.corners do
        Assert.Equal(s, DS.swapLegs (DS.swapLegs s))

    // "Exactly 2", not "at most 2": some element must actually move, or the map is the identity
    // and the claim is vacuous.
    Assert.NotEqual(DS.onlyTrue, DS.swapLegs DS.onlyTrue)
    Assert.Equal(DS.onlyFalse, DS.swapLegs DS.onlyTrue)

[<Fact>]
let ``the fixed-point count excludes C4 — a generator of order 4 has none`` () =
    // Negation fixes `vacuous` and `both` and transposes the two classical corners: 2 fixed
    // points out of 4. An order-4 generator acting on the 4 elements of C₄ is a 4-cycle and
    // fixes NOTHING. Same cardinality, different structure — that is the whole exclusion.
    let fixedPoints = DS.corners |> List.filter (fun s -> DS.swapLegs s = s)
    Assert.Equal(2, List.length fixedPoints)
    Assert.Contains(DS.vacuous, fixedPoints)
    Assert.Contains(DS.both, fixedPoints)

[<Fact>]
let ``negation leaves every residual quantity invariant`` () =
    // This is the check that the two legs really are symmetric in the type: relabelling which
    // side is "support" cannot change how much is unknown or how much is contradicted.
    for s in DS.corners @ [ ok (DS.create 0.3 0.4); ok (DS.create 0.9 0.8) ] do
        let n = DS.swapLegs s
        Assert.True(approx (DS.mass s) (DS.mass n))
        Assert.True(approx (DS.residual s) (DS.residual n))
        Assert.True(approx (DS.ignorance s) (DS.ignorance n))
        Assert.True(approx (DS.contradiction s) (DS.contradiction n))
        Assert.Equal(DS.massShape s, DS.massShape n)

// ───────────────────────────────────────────────────────────────────────────────
// §toyJoin — the knowledge-order join. Non-coercive by construction.
// ───────────────────────────────────────────────────────────────────────────────

[<Fact>]
let ``toyJoin SURFACES conflict rather than resolving it`` () =
    // The Eve-protocol property: two witnesses pointing opposite ways are handed onward intact,
    // never averaged into something that reads like "nobody looked".
    let fused = DS.toyJoin DS.onlyTrue DS.onlyFalse
    Assert.Equal(DS.both, fused)
    Assert.True(approx 1.0 (DS.contradiction fused))
    Assert.Equal(DS.Contradictory, DS.massShape fused)

    // And it is NOT the truth-order join (max t, min f), which would have decided for `true` and
    // thrown the refutation away. That operator is deliberately not shipped.
    Assert.NotEqual(DS.onlyTrue, fused)

[<Fact>]
let ``toyJoin is idempotent, commutative and associative — the G-set join`` () =
    let xs = DS.corners @ [ ok (DS.create 0.3 0.7); ok (DS.create 0.9 0.2) ]

    for a in xs do
        Assert.Equal(a, DS.toyJoin a a)
        for b in xs do
            Assert.Equal(DS.toyJoin a b, DS.toyJoin b a)
            for c in xs do
                Assert.Equal(DS.toyJoin (DS.toyJoin a b) c, DS.toyJoin a (DS.toyJoin b c))

[<Fact>]
let ``toyJoin never renormalises — mass is free to exceed 1`` () =
    let fused = DS.toyJoin (ok (DS.create 0.9 0.1)) (ok (DS.create 0.1 0.9))
    Assert.True(approx 1.8 (DS.mass fused))
    Assert.True(approx -0.8 (DS.residual fused))

// ───────────────────────────────────────────────────────────────────────────────
// §toyClassify — the only judging function, with a caller-supplied margin.
// ───────────────────────────────────────────────────────────────────────────────

[<Fact>]
let ``CONTROL — toyClassify produces DIFFERENT readings for different inputs`` () =
    // Without this, `toyClassify = fun _ _ -> Ok Unknown` would pass the vacuous case below.
    let readings =
        [ ok (DS.create 0.9 0.1); ok (DS.create 0.1 0.9); DS.vacuous; DS.both ]
        |> List.map (fun s ->
            match DS.toyClassify s 0.8 with
            | Ok r -> r
            | Error e -> failwithf "unexpected refusal %A" e)

    Assert.Equal<DS.ToyReading list>([ DS.LeansTrue; DS.LeansFalse; DS.Unknown; DS.Contradicted ], readings)
    Assert.Equal(4, readings |> List.distinct |> List.length)

[<Fact>]
let ``a glut is read as Contradicted, never as a weak lean`` () =
    // Contradiction is checked first. A `{1, 0.9}` belief has overwhelming support AND heavy
    // refutation; reporting it as `LeansTrue` would be the collapse this type exists to prevent.
    let heavy = ok (DS.create 1.0 0.9)
    Assert.Equal(Ok DS.Contradicted, DS.toyClassify heavy 0.5)

[<Fact>]
let ``an out-of-range margin is refused by the same rule as a leg`` () =
    Assert.Equal(DS.OutsideUnitInterval(DS.Margin, 1.5), err (DS.toyClassify DS.vacuous 1.5))
    Assert.Equal(DS.NotFinite(DS.Margin, nan), err (DS.toyClassify DS.vacuous nan))
    // CONTROL for the refusal: an in-range margin is accepted.
    Assert.Equal(Ok DS.Unknown, DS.toyClassify DS.vacuous 0.5)

// ───────────────────────────────────────────────────────────────────────────────
// §WIRE — parsing untrusted input refuses rather than defaults.
// ───────────────────────────────────────────────────────────────────────────────

[<Fact>]
let ``DynamicValue round-trips through both legs`` () =
    for s in DS.corners @ [ ok (DS.create 0.3 0.4) ] do
        Assert.Equal(s, ok (DS.ofDynamicValue (DS.toDynamicValue s)))

[<Fact>]
let ``a missing leg is refused, never defaulted to zero`` () =
    // 0 is a real measurement here ("evidence landed and found nothing"), so defaulting an
    // absent field to 0 would make absence indistinguishable from a finding.
    let onlyOneLeg = DynamicValue.Object [ DS.TRUE_CHANCE_KEY, DynamicValue.Float 0.7 ]

    match err (DS.ofDynamicValue onlyOneLeg) with
    | DS.NotADualScore d -> Assert.Contains(DS.FALSE_CHANCE_KEY, d)
    | other -> failwithf "expected NotADualScore, got %A" other

[<Fact>]
let ``wire parsing accepts Int, refuses non-numbers, and refuses out-of-range`` () =
    let obj t f = DynamicValue.Object [ DS.TRUE_CHANCE_KEY, t; DS.FALSE_CHANCE_KEY, f ]

    // CONTROL: an integer-encoded leg is READ, not rejected.
    Assert.Equal(DS.onlyTrue, ok (DS.ofDynamicValue (obj (DynamicValue.Int 1L) (DynamicValue.Int 0L))))

    match err (DS.ofDynamicValue (obj (DynamicValue.String "0.5") (DynamicValue.Float 0.5))) with
    | DS.NotADualScore _ -> ()
    | other -> failwithf "expected NotADualScore, got %A" other

    // Range refusal survives the wire: a parser that clamped would launder a corrupt row.
    Assert.Equal(DS.OutsideUnitInterval(DS.TrueChance, 1.5), err (DS.ofDynamicValue (obj (DynamicValue.Float 1.5) (DynamicValue.Float 0.0))))
    Assert.Equal(DS.NotADualScore "expected an Object carrying both legs", err (DS.ofDynamicValue (DynamicValue.Int 3L)))

// ───────────────────────────────────────────────────────────────────────────────
// §THE BRIDGE — a SoftValue becomes a belief only through a DECLARED proposition.
// ───────────────────────────────────────────────────────────────────────────────

[<Fact>]
let ``a normalised SoftValue projects to a COHERENT pair under ANY proposition`` () =
    let a, b, c = cand 0, cand 1, cand 2
    let sv = (SV.ofWeighted [ a, 5.0; b, 3.0; c, 2.0 ]).Value

    let propositions: SVB.Proposition list =
        [ SVB.isValue a
          SVB.isValue b
          (fun d -> d = a || d = c)
          (fun _ -> true)
          (fun _ -> false) ]

    for p in propositions do
        let s = ok (SVB.beliefOf p sv)
        Assert.True(approx 1.0 (DS.mass s))
        Assert.True(abs (DS.residual s) < TEST_TOL)
        Assert.Equal(DS.Coherent, DS.massShapeWithin TEST_TOL s)

[<Fact>]
let ``the PROPOSITION is a modelling choice the numbers cannot recover`` () =
    // §9's scope note, mechanised: one distribution, two declared predicates, two different
    // belief pairs — and no function converts between them.
    let a, b, c = cand 0, cand 1, cand 2
    let sv = (SV.ofWeighted [ a, 5.0; b, 3.0; c, 2.0 ]).Value

    let tight = ok (SVB.beliefOf (SVB.isValue a) sv)
    let loose = ok (SVB.beliefOf (fun d -> d = a || d = b) sv)

    Assert.True(approx 0.5 tight.TrueChance)
    Assert.True(approx 0.8 loose.TrueChance)
    Assert.NotEqual(tight, loose)

[<Fact>]
let ``beliefOf agrees with weightOf on the support leg`` () =
    let a, b = cand 0, cand 1
    let sv = (SV.ofWeighted [ a, 3.0; b, 1.0 ]).Value
    let s = ok (SVB.beliefOf (SVB.isValue a) sv)
    Assert.True(approx (SV.weightOf a sv) s.TrueChance)
    Assert.True(approx (SV.weightOf b sv) s.FalseChance)

[<Fact>]
let ``an unnormalised SoftValue projects onto BOTH missing corners`` () =
    let a, b = cand 0, cand 1

    let ignorant = ok (SVB.beliefOf (SVB.isValue a) (SV.unnormalized [ a, 0.2; b, 0.1 ]))
    Assert.True(approx 0.2 ignorant.TrueChance)
    Assert.True(approx 0.1 ignorant.FalseChance)
    Assert.True(approx 0.7 (DS.residual ignorant))
    Assert.Equal(DS.Ignorant, DS.massShapeWithin TEST_TOL ignorant)

    let contradictory = ok (SVB.beliefOf (SVB.isValue a) (SV.unnormalized [ a, 0.8; b, 0.7 ]))
    Assert.True(approx -0.5 (DS.residual contradictory))
    Assert.Equal(DS.Contradictory, DS.massShapeWithin TEST_TOL contradictory)

[<Fact>]
let ``the bridge refuses an over-full leg rather than clamping it`` () =
    let a, b = cand 0, cand 1
    let over = SV.unnormalized [ a, 1.4; b, 0.1 ]
    Assert.Equal(DS.OutsideUnitInterval(DS.TrueChance, 1.4), err (SVB.beliefOf (SVB.isValue a) over))

    // CONTROL: the same bridge on the same shape of input SUCCEEDS when the leg is in range —
    // so the refusal above is about the value, not about the code path.
    let inRange = SV.unnormalized [ a, 0.9; b, 0.1 ]
    Assert.True(approx 0.9 (ok (SVB.beliefOf (SVB.isValue a) inRange)).TrueChance)
