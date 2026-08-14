module Zeta.Tests.Formal.AmplitudeEmuSignallingTests

open System
open System.Numerics
open global.Xunit
open Zeta.Core

/// **Conjecture Z-EPS, run.** Does AmplitudeEmu's EPS threshold-drop let a LOCAL operation on one
/// half of a bipartite state change the OTHER half's marginal Born statistics?
///
/// Verdict: **YES.** Two settings of a Bob-local, trace-preserving operation drive Alice's marginal
/// P_A(1) to 0.2647 and to 0.0000 on the same input state. That is signalling.
///
/// **What is under test is the SHIPPED drop.** Every arm calls AmplitudeEmu.step - the real generic
/// amplitude step in src/Core/AmplitudeEmu.fs, whose tail contains "if magSq summed <= EPS then
/// None". Nothing here re-implements the drop. (Contrast the earlier chsh probe that missed a
/// planted tautology because it carried its own copy of the definitions.)
///
/// **Anchors (Beacon).** Gisin 1990, "Weinberg's non-linear quantum mechanics and superluminal
/// communications" (Phys. Lett. A 143) - nonlinear evolution generically permits superluminal
/// signalling. Polchinski 1991. Kraus 1983 / Choi 1975 - CPTP maps; partial-trace invariance under
/// a local trace-preserving map is the linearity-based no-signalling guarantee this module shows is
/// void. CITED-not-page-checked (all four).
///
/// **What the algebra alone gives, and what it does not.** Linearity plus trace preservation
/// implies no signalling. The contrapositive is "signalling implies nonlinear", NOT "nonlinear
/// implies signalling" - global renormalisation is nonlinear and signals nothing. So the algebraic
/// route voids the guarantee; it cannot establish the claim. The claim is existential and needs a
/// witness. Hence this file.
[<AutoOpen>]
module private Harness =

    /// The joint key (kA, kB). Alice owns the first component, Bob the second.
    type JointKey = int * int

    let amp (x: float) : Complex = { Real = x; Imag = 0.0 }

    let magSq (z: Complex) : float = z.Real * z.Real + z.Imag * z.Imag

    /// Bob's local operation, expressed as an AmplitudeEmu.step fork.
    ///
    /// Locality: the output key's FIRST component is always the input's first component (Alice's
    /// index is a spectator), and the branch structure depends only on the SECOND component.
    /// Trace preservation: the weights sum to 1 for every input key, so step's sqrt-p factors give
    /// sum over b' of |z sqrt p|^2 = |z|^2 per Alice-key - Alice's marginal is EXACTLY invariant in
    /// exact arithmetic. Both properties are asserted mechanically below, not merely claimed.
    let bobLocal (cos2: float) (sin2: float) ((kA, kB): JointKey) : (JointKey * float) list =
        if kB = 0 then [ (kA, 0), cos2; (kA, 1), sin2 ]
        else [ (kA, 0), sin2; (kA, 1), cos2 ]

    /// Bob's setting 0 - do nothing.
    let bobIdentity (k: JointKey) : (JointKey * float) list = [ k, 1.0 ]

    /// Bob's setting 1 - the (3,4,5) rotation. Weights 9/25 and 16/25; amplitude factors 3/5 and
    /// 4/5. Pythagorean on purpose: the same numbers are exact in the integer cross-check arm
    /// below, so the float arm and the exact arm run the identical construction.
    let bobRotate : JointKey -> (JointKey * float) list = bobLocal (9.0 / 25.0) (16.0 / 25.0)

    /// Alice's marginal Born distribution (P_A(0), P_A(1)) - Bob traced out.
    let aliceMarginal (state: (JointKey * Complex) list) : float * float =
        let total = state |> List.sumBy (fun (_, z) -> magSq z)
        if total <= 0.0 then
            0.0, 0.0
        else
            let w a =
                state
                |> List.filter (fun ((kA, _), _) -> kA = a)
                |> List.sumBy (fun (_, z) -> magSq z)
            w 0 / total, w 1 / total

    /// Alice's marginal SUPPORT - which of her outcomes exist at all.
    let aliceSupport (state: (JointKey * Complex) list) : int list =
        state |> List.map (fun ((kA, _), _) -> kA) |> List.distinct |> List.sort

    /// How many branches the SHIPPED drop deleted: distinct keys the fork produced, minus keys that
    /// survived AmplitudeEmu.step. Sound here because the construction produces no colliding keys
    /// (asserted separately), so nothing can vanish by exact cancellation.
    let dropsFired (fork: JointKey -> (JointKey * float) list) (state: (JointKey * Complex) list) : int =
        let produced =
            state
            |> List.collect (fun (k, _) -> fork k |> List.map fst)
            |> List.distinct
            |> List.length
        produced - (AmplitudeEmu.step fork state |> List.length)

    /// The witness ray, at an arbitrary scale. Two branches, both with Bob's index at 0:
    /// alpha = 2e-6 * s on Alice-0, beta = 1.2e-6 * s on Alice-1.
    /// At s = 1 the (3,4,5) rotation pushes BOTH of Alice-1's branches under sqrt EPS = 1e-6 while
    /// leaving Alice-0's above it. At s = 1e6 nothing is within six orders of the threshold.
    let witnessRay (s: float) : (JointKey * Complex) list =
        [ (0, 0), amp (2.0e-6 * s)
          (1, 0), amp (1.2e-6 * s) ]

// ================================================================================================
// 0. Preconditions - the falsifier is only worth anything if Bob's operation really is local.
// ================================================================================================

[<Fact>]
let ``PRECONDITION Bob's operation is Alice-local - her index is a spectator`` () =
    for kA in 0 .. 1 do
        for kB in 0 .. 1 do
            let branches = bobRotate (kA, kB)
            // every output key keeps Alice's index
            Assert.All(branches, fun ((outA, _), _) -> Assert.Equal(kA, outA))
            // and the (Bob-index, weight) profile does not depend on Alice's index
            let profile = branches |> List.map (fun ((_, outB), p) -> outB, p)
            let other = bobRotate (1 - kA, kB) |> List.map (fun ((_, outB), p) -> outB, p)
            Assert.Equal<(int * float) list>(profile, other)

[<Fact>]
let ``PRECONDITION Bob's operation is trace-preserving - weights sum to 1 on every key`` () =
    for kA in 0 .. 1 do
        for kB in 0 .. 1 do
            Assert.Equal(1.0, bobRotate (kA, kB) |> List.sumBy snd, 12)
            Assert.Equal(1.0, bobIdentity (kA, kB) |> List.sumBy snd, 12)

[<Fact>]
let ``PRECONDITION no key collides - every deleted branch is the drop, never a cancellation`` () =
    let produced = witnessRay 1.0 |> List.collect (fun (k, _) -> bobRotate k |> List.map fst)
    Assert.Equal(produced.Length, (List.distinct produced).Length)
    Assert.Equal(4, produced.Length)

// ================================================================================================
// 1. TREATMENT - near threshold. The signal.
// ================================================================================================

[<Fact>]
let ``Z-EPS TREATMENT - a Bob-LOCAL operation moves Alice's marginal by 26 points`` () =
    let state = witnessRay 1.0
    let _, quiet = aliceMarginal (AmplitudeEmu.step bobIdentity state)
    let _, rotated = aliceMarginal (AmplitudeEmu.step bobRotate state)
    // Bob idle: Alice sees P_A(1) = 1.44e-12 / 5.44e-12 = 9/34.
    Assert.Equal(9.0 / 34.0, quiet, 12)
    // Bob rotates - nothing of Alice's is touched - and Alice's outcome 1 is GONE.
    Assert.Equal(0.0, rotated, 15)
    // The channel. In exact arithmetic this difference is identically zero.
    Assert.True(abs (quiet - rotated) > 0.26, "marginal shift collapsed: " + string (abs (quiet - rotated)))

[<Fact>]
let ``Z-EPS TREATMENT - the drop actually fired (non-vacuity: the arm did the thing)`` () =
    Assert.Equal(2, dropsFired bobRotate (witnessRay 1.0))

[<Fact>]
let ``Z-EPS TREATMENT - Alice's marginal SUPPORT changes, not merely its weights`` () =
    let state = witnessRay 1.0
    Assert.Equal<int list>([ 0; 1 ], aliceSupport (AmplitudeEmu.step bobIdentity state))
    Assert.Equal<int list>([ 0 ], aliceSupport (AmplitudeEmu.step bobRotate state))

// ================================================================================================
// 2. CONTROL - the SAME RAY, scaled far above threshold. Must not signal, and can fail.
//    Amplitude states are rays, so witnessRay 1e6 and witnessRay 1.0 are the same physical state.
//    No theory is permitted to distinguish them. This one does.
// ================================================================================================

[<Fact>]
let ``Z-EPS CONTROL - far above threshold, Bob's setting leaves Alice's marginal invariant`` () =
    let state = witnessRay 1.0e6
    let _, quiet = aliceMarginal (AmplitudeEmu.step bobIdentity state)
    let _, rotated = aliceMarginal (AmplitudeEmu.step bobRotate state)
    Assert.Equal(9.0 / 34.0, quiet, 12)
    Assert.Equal(9.0 / 34.0, rotated, 12)
    Assert.True(abs (quiet - rotated) < 1.0e-12, "control leaked: " + string (abs (quiet - rotated)))

[<Fact>]
let ``Z-EPS CONTROL - the drop did NOT fire (a control, not a second treatment)`` () =
    Assert.Equal(0, dropsFired bobRotate (witnessRay 1.0e6))

[<Fact>]
let ``Z-EPS - treatment and control are the SAME RAY: only the scale differs`` () =
    // Componentwise ratio is the single constant 1e6, so the two states are identical as physical
    // states. The emulator distinguishes them anyway.
    let a = witnessRay 1.0
    let b = witnessRay 1.0e6
    List.zip a b
    |> List.iter (fun ((ka, za), (kb, zb)) ->
        Assert.Equal<JointKey>(ka, kb)
        Assert.Equal(1.0e6, zb.Real / za.Real, 6))

// ================================================================================================
// 3. NORMALISED witness - the objection "you used an unnormalised state" answered.
//    Total intensity is exactly 1. The shift is small; the support change is categorical.
// ================================================================================================

[<Fact>]
let ``Z-EPS NORMALISED - signalling survives on a unit-norm state (support flips)`` () =
    let beta = 1.2e-6
    let state: (JointKey * Complex) list =
        [ (0, 0), amp (sqrt (1.0 - beta * beta))
          (1, 0), amp beta ]
    Assert.Equal(1.0, state |> List.sumBy (fun (_, z) -> magSq z), 15)
    let _, quiet = aliceMarginal (AmplitudeEmu.step bobIdentity state)
    let _, rotated = aliceMarginal (AmplitudeEmu.step bobRotate state)
    Assert.True(abs (quiet - beta * beta) < 1.0e-18, "quiet marginal drifted: " + string quiet)
    Assert.True((rotated = 0.0), "rotated marginal was not exactly zero: " + string rotated)
    Assert.Equal(2, dropsFired bobRotate state) // the drop fired here too
    Assert.Equal<int list>([ 0; 1 ], aliceSupport (AmplitudeEmu.step bobIdentity state))
    Assert.Equal<int list>([ 0 ], aliceSupport (AmplitudeEmu.step bobRotate state))

// ================================================================================================
// 4. INDEPENDENT ARITHMETIC - the same construction over exact integers. Signals nothing.
//    This isolates the cause: the harness does not signal, the float drop does.
// ================================================================================================

[<Fact>]
let ``Z-EPS CAUSE ISOLATION - the identical construction over exact integers does not signal`` () =
    // Amplitudes as BigInteger numerators over a common denominator. The (3,4,5) factors are exact,
    // and the shared denominator cancels in the Born ratio, so only numerators are needed. An exact
    // carrier can only ever drop an EXACT ZERO, and dropping an additive identity cannot change a
    // later sum - which is precisely why the defect vanishes here.
    let stepExact (fork: JointKey -> (JointKey * BigInteger) list) (st: (JointKey * BigInteger) list) =
        st
        |> List.collect (fun (k, z) -> fork k |> List.map (fun (k2, f) -> k2, z * f))
        |> List.groupBy fst
        |> List.choose (fun (k, g) ->
            let s = g |> List.sumBy snd
            if s.IsZero then None else Some(k, s))
    let identityQ (k: JointKey) = [ k, BigInteger 5 ] // scale-matched to the rotation's fifths
    let rotateQ ((kA, kB): JointKey) =
        if kB = 0 then [ (kA, 0), BigInteger 3; (kA, 1), BigInteger 4 ]
        else [ (kA, 0), BigInteger 4; (kA, 1), BigInteger 3 ]
    let stateQ: (JointKey * BigInteger) list = [ (0, 0), BigInteger 20; (1, 0), BigInteger 12 ]
    let marginal1 (st: (JointKey * BigInteger) list) =
        let sq (z: BigInteger) = z * z
        let total = st |> List.sumBy (fun (_, z) -> sq z)
        let one = st |> List.filter (fun ((kA, _), _) -> kA = 1) |> List.sumBy (fun (_, z) -> sq z)
        one, total
    let qOne, qTot = marginal1 (stepExact identityQ stateQ)
    let rOne, rTot = marginal1 (stepExact rotateQ stateQ)
    // 9/34 both times - exactly, as integers, no tolerance.
    Assert.Equal(BigInteger 9 * qTot, BigInteger 34 * qOne)
    Assert.Equal(BigInteger 9 * rTot, BigInteger 34 * rOne)
    Assert.Equal(qOne * rTot, rOne * qTot)

// ================================================================================================
// 5. The necessary condition, on the shipped code - the drop is not homogeneous of degree 1,
//    therefore not linear, therefore the linearity-based no-signalling guarantee does not apply.
// ================================================================================================

[<Fact>]
let ``Z-EPS LEMMA - the shipped drop is not homogeneous of degree 1, hence not linear`` () =
    let state: (JointKey * Complex) list = [ (0, 0), amp 1.0 ]
    let scaled: (JointKey * Complex) list = [ (0, 0), amp 1.0e-7 ]
    // D of psi is nonempty; D of lambda-psi is empty. A linear map cannot do that.
    Assert.NotEmpty(AmplitudeEmu.step bobIdentity state)
    Assert.Empty(AmplitudeEmu.step bobIdentity scaled)
