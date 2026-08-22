module Zeta.Tests.BoundJustificationTests

open System.IO
open Xunit
open Zeta.Bayesian
open Zeta.Bayesian.BoundJustification

// ── What these tests are for ───────────────────────────────────────────────────────────────────────
// `BoundJustification` is a typing change, so the tests that matter are not numeric-accuracy tests.
// They are:
//   BJ-1..BJ-3   the type expresses all three registers of the real case — the PROVED envelope, the
//                PROPOSED δ_model decomposition, and the retired `1.2`. A type that cannot express
//                all three is the wrong type.
//   BJ-4..BJ-6   the shipped number did not move, and the shipped bound declares its own register.
//   BJ-7         the `Derivation` certificate paths resolve on disk — a cited proof that nobody can
//                open is the `AssertedOnly` class wearing a citation.

/// Walk up from the test binary to the repository root (the directory holding `Zeta.sln`).
let private repoRoot () =
    let rec up (d: DirectoryInfo) =
        if isNull (box d) then None
        elif File.Exists(Path.Combine(d.FullName, "Zeta.sln")) then Some d.FullName
        else up d.Parent
    up (DirectoryInfo(Directory.GetCurrentDirectory()))

// J2000.0 = JD 2451545.0
let private j2000 = 2_451_545.0

// ── BJ-1: the PROVED endpoint-speed envelope is expressible, and its witness re-checks exactly ─────
// Theorem (PR #10418, z3 + Lean): with both endpoints rectilinear at speeds bounded by V_A, V_B < c
// and R the range at the common transmit epoch,
//     |τ_AB − τ_BA| ≤ max( R/(c−V_B) − R/(c+V_A),  R/(c−V_A) − R/(c+V_B) )
// and the bound is SHARP. The published witness is c=10, R=1, V_A=2, V_B=3 → τ_AB=1/7, τ_BA=1/12.
//
// Re-checked here in INTEGERS, so there is no floating point anywhere in the certificate: each
// branch of the envelope has numerator R·(V_A+V_B) over its own denominator, and the attained
// asymmetry equals branch 1 exactly.
[<Fact>]
let ``BJ-1 the sharpness witness re-checks in exact integer arithmetic`` () =
    let c, r, vA, vB = 10, 1, 2, 3

    // Branch 1: R/(c−V_B) − R/(c+V_A) = R·(V_A+V_B) / ((c−V_B)(c+V_A))
    let num1, den1 = r * (vA + vB), (c - vB) * (c + vA)
    // Branch 2: R/(c−V_A) − R/(c+V_B) = R·(V_A+V_B) / ((c−V_A)(c+V_B))
    let num2, den2 = r * (vA + vB), (c - vA) * (c + vB)

    // Both branches carry the SUM of the speeds, not the difference. That is the structural fact
    // behind "τ_AB is bounded by the RECEIVER's speed", and it is what makes a projection-based
    // estimator the wrong shape.
    Assert.Equal(5, num1)
    Assert.Equal(5, num2)
    Assert.Equal(84, den1)   // (10−3)(10+2)
    Assert.Equal(104, den2)  // (10−2)(10+3)

    // τ_AB = R/(c−V_B) = 1/7 and τ_BA = R/(c+V_A) = 1/12 attain branch 1: 1/7 − 1/12 = 5/84.
    // Cross-multiplied so the assertion is over integers: (12 − 7)·84 = 5·84.
    Assert.Equal((12 - 7) * den1, num1 * 84)

    // Branch 1 binds (5/84 > 5/104), so the envelope's max is attained and there is no slack for a
    // multiplicative margin to occupy.
    Assert.True(num1 * den2 > num2 * den1)

[<Fact>]
let ``BJ-2 the PROVED envelope is expressible as a Derivation-justified bound`` () =
    let envelope =
        Bound.ofTerms
            [ { Name = "delta_speed (endpoint-speed envelope)"
                // 5/84 for the published witness. The magnitude is the theorem's own value; a caller
                // cannot substitute a different one without changing the term's name and reason.
                Value = 5.0 / 84.0
                Why =
                  Derivation(
                      "|tau_AB - tau_BA| <= max(R/(c-V_B) - R/(c+V_A), R/(c-V_A) - R/(c+V_B)), and sharp",
                      "tools/Z3Verify/light-time-endpoint-speed-envelope.smt2; \
                       src/Core.Lean4/Lean4/LightTimeAsymmetry.lean") } ]

    Assert.True(Bound.isFullyChecked envelope, "a proved envelope has no assumed terms")
    Assert.Empty(Bound.assumed envelope)
    Assert.True(abs (Bound.value envelope - 5.0 / 84.0) < 1e-15)

// ── BJ-3: the PROPOSED δ_model decomposition is expressible, and its unchecked terms enumerate ─────
// δ_max = δ_speed + δ_model, δ_model = δ_curv + δ_Vsup + δ_ephem + δ_rel.
// The magnitudes below are QUOTED from the routing document (PR #10418) as shape data. They are not
// re-derived here and this test asserts nothing about the physics — only that the type carries the
// decomposition and that its unchecked terms come back out.
[<Fact>]
let ``BJ-3 the proposed delta_model decomposition is expressible and its assumed terms enumerate`` () =
    let proposed =
        Bound.ofTerms
            [ { Name = "delta_speed"
                Value = 253.5731
                Why =
                  Derivation(
                      "endpoint-speed envelope at perihelion-speed bounds and aphelion-opposed range",
                      "tools/Z3Verify/light-time-endpoint-speed-envelope.smt2") }
              { Name = "delta_curv"
                Value = 0.0276
                Why = Measurement("orbital curvature over the light-time arc", "21,000 epochs, 1-hour step, 2026-01-01 to 2028-06-01") }
              { Name = "delta_Vsup"
                Value = 0.0
                Why = Derivation("perihelion speed bounds the speed at every epoch by construction", "vis-viva; Kepler 1609 / Newton 1687") }
              { Name = "delta_ephem"
                Value = 61.0
                Why = Assumption "mean-element ephemeris error, quoted from PR #10387's 18,382 km miss; not re-derived here" }
              { Name = "delta_rel"
                Value = 0.0004
                Why = Assumption "Shapiro asymmetry, quoted from the defect record and NOT independently verified" } ]

    // The total is derived from the parts; nobody authors it.
    Assert.True(abs (Bound.value proposed - (253.5731 + 0.0276 + 0.0 + 61.0 + 0.0004)) < 1e-9)

    // The two terms the substrate is taking on faith are enumerable rather than buried in a literal.
    let assumedNames = Bound.assumed proposed |> List.map (fun t -> t.Name)
    Assert.Equal<string list>([ "delta_ephem"; "delta_rel" ], assumedNames)
    Assert.False(Bound.isFullyChecked proposed)

// ── BJ-4: the retired 1.2 is expressible — with a magnitude and a reason, and only that way ───────
[<Fact>]
let ``BJ-4 a margin can only enter as a named term with a stated reason`` () =
    let deltaSpeed = 100.0

    // The 1.2 as it was: an unnamed multiplier. In this type there is no `scale` and no operator, so
    // the only way to express it is to state what it adds and why — which is the whole point.
    let withMargin =
        Bound.ofTerms
            [ { Name = "delta_speed"
                Value = deltaSpeed
                Why = Derivation("endpoint-speed envelope", "tools/Z3Verify/light-time-endpoint-speed-envelope.smt2") }
              { Name = "legacy 20% margin"
                Value = 0.2 * deltaSpeed
                Why = Assumption "fudge factor — no derivation in the original code, the review, or the proposal" } ]

    Assert.False(Bound.isFullyChecked withMargin)
    Assert.Equal(1, List.length (Bound.assumed withMargin))
    Assert.Equal("legacy 20% margin", (List.head (Bound.assumed withMargin)).Name)

// ── BJ-5: the shipped number did not move ─────────────────────────────────────────────────────────
[<Fact>]
let ``BJ-5 deltaMaxMs is bit-identical to the value of its bound`` () =
    for (a, b) in [ "earth", "mars"; "earth", "moon"; "mars", "phobos"; "mars", "deimos"; "earth", "earth" ] do
        for offset in [ 0.0; 180.0; 365.0; 1000.0 ] do
            let jd = j2000 + offset
            let viaFloat = OrbitalAsymmetryBudget.deltaMaxMs a b jd
            let viaBound = OrbitalAsymmetryBudget.deltaMaxBound a b jd |> Bound.value
            Assert.True(
                (viaFloat = viaBound),
                sprintf "%s-%s at JD %f: float path %.17g, bound path %.17g" a b jd viaFloat viaBound)

// ── BJ-6: the shipped bound declares its own register, and that register is `Assumption` ──────────
[<Fact>]
let ``BJ-6 the shipped orbital budget is a single Assumption-justified term`` () =
    let bound = OrbitalAsymmetryBudget.deltaMaxBound "earth" "mars" j2000
    let terms = Bound.terms bound
    Assert.Equal(1, List.length terms)

    match (List.head terms).Why with
    | Assumption reason -> Assert.Contains("1.2", reason)
    | Derivation _ -> Assert.Fail "the shipped budget has no derivation — it must not claim one"
    | Measurement _ -> Assert.Fail "the shipped budget is not a measurement"

    Assert.False(Bound.isFullyChecked bound, "the shipped budget is not checked, and says so")

// ── BJ-7: a cited certificate must resolve — a proof nobody can open is not evidence ─────────────
[<Fact>]
let ``BJ-7 the Derivation certificate paths exist in the repository`` () =
    match repoRoot () with
    | None -> Assert.Fail "could not locate the repository root (Zeta.sln) from the test working directory"
    | Some root ->
        for rel in [ "tools/Z3Verify/light-time-endpoint-speed-envelope.smt2"
                     "src/Core.Lean4/Lean4/LightTimeAsymmetry.lean" ] do
            let full = Path.Combine(root, rel.Replace('/', Path.DirectorySeparatorChar))
            Assert.True(File.Exists full, sprintf "cited certificate is missing: %s" rel)
