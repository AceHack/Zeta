module Zeta.Tests.CyclotomicAmplitudeTests

open System
open global.Xunit
open Zeta.Core

/// **The exact cyclotomic carrier `Z[zeta_16][1/sqrt2]`, under test.**
///
/// The order of business matters and is stated once here:
///
///  A. the ring is what it claims to be (cross-checked against an INDEPENDENT instrument - float
///     complex arithmetic - so a cyclic-instead-of-negacyclic reduction cannot pass);
///  B. the laws the float carrier breaks come back, and the INSTRUMENT SURVIVES (`a + a = 2a`,
///     exact cancellation still annihilates);
///  C. the **Z-EPS differential** - both carriers, one test, same ray;
///  D. the `Z[zeta_4]` bridge to `QuorumPhaseCancellation.tla`;
///  E. byte-lock: unique canonical form, pinned encodings, order-independence;
///  F. cost, measured against the depth-1 prediction rather than asserted.
///
/// **The trap this file must not fall into, stated at the top because it is the whole risk.**
/// An exact carrier makes this defect invisible BY CONSTRUCTION - the drop has nothing left to
/// delete - so **nothing in this file is the Z-EPS regression test.** That test is
/// `tests/Tests.FSharp/Formal/AmplitudeEmuSignalling.Tests.fs`, it tests the FLOAT path (which still
/// exists, for the continuous-phase sweeps), and it is untouched by this PR. Section C exists so
/// that the evidence of necessity cannot be deleted along with the defect: it asserts the float
/// carrier signalling and the exact carrier not signalling **in the same test**, so deleting the
/// float path breaks compilation rather than quietly turning the file green for the wrong reason.
[<AutoOpen>]
module private Fixtures =

    /// A deterministic coefficient stream - DST-replayable, no ambient entropy (spec 13).
    let private lcg (seed: int) =
        let mutable s = uint64 seed * 6364136223846793005UL + 1442695040888963407UL

        fun (lo: int) (hi: int) ->
            s <- s * 6364136223846793005UL + 1442695040888963407UL
            lo + int ((s >>> 33) % uint64 (hi - lo + 1))

    /// `n` pseudo-random ring elements from a fixed seed.
    let samples (seed: int) (n: int) (maxK: int) : Cyc list =
        let next = lcg seed

        [ for _ in 1..n ->
            Cyc.create [| for _ in 1..8 -> bigint (next -6 6) |] (next 0 maxK) ]

    /// Agreement between the exact value and its float evaluation, to a stated tolerance. The float
    /// evaluation is the INDEPENDENT instrument: it knows nothing about negacyclic reduction.
    let agrees (tol: float) (expected: Complex) (actual: Cyc) =
        let c = Cyc.toComplex actual
        Assert.True(
            abs (c.Real - expected.Real) < tol && abs (c.Imag - expected.Imag) < tol,
            String.Format(
                Globalization.CultureInfo.InvariantCulture,
                "expected ({0}, {1}) got ({2}, {3})",
                expected.Real,
                expected.Imag,
                c.Real,
                c.Imag))

    let cmul (a: Complex) (b: Complex) : Complex =
        { Real = a.Real * b.Real - a.Imag * b.Imag
          Imag = a.Real * b.Imag + a.Imag * b.Real }

    let cadd (a: Complex) (b: Complex) : Complex =
        { Real = a.Real + b.Real; Imag = a.Imag + b.Imag }

// ================================================================================================
// A. THE RING IS WHAT IT CLAIMS. Cross-checked against float complex arithmetic - an instrument
//    that knows nothing about negacyclic reduction, so a wrong sign cannot pass here.
// ================================================================================================

[<Fact>]
let ``sqrt2 squared is exactly 2, and invSqrt2 times sqrt2 is exactly 1`` () =
    Assert.Equal<Cyc>(Cyc.ofInt 2, Cyc.mul Cyc.sqrt2 Cyc.sqrt2)
    Assert.Equal<Cyc>(Cyc.one, Cyc.mul Cyc.invSqrt2 Cyc.sqrt2)
    // and 1/sqrt2 is genuinely NOT an integer of the ring - it needs the denominator exponent
    Assert.Equal(1, Cyc.invSqrt2.K)

[<Fact>]
let ``the zeta_4 and zeta_8 sub-lattices are present: i squared is -1, and zeta^8 is -1`` () =
    Assert.Equal<Cyc>(Cyc.ofInt -1, Cyc.mul Cyc.imag Cyc.imag)
    Assert.Equal<Cyc>(Cyc.imag, Cyc.zetaPow 4)
    Assert.Equal<Cyc>(Cyc.ofInt -1, Cyc.zetaPow 8)
    Assert.Equal<Cyc>(Cyc.one, Cyc.zetaPow 16)
    Assert.Equal<Cyc>(Cyc.one, Cyc.zetaPow -16)
    // zeta_8 = zeta_16^2, and sqrt2 = zeta_8 + conj zeta_8
    let z8 = Cyc.zetaPow 2
    Assert.Equal<Cyc>(Cyc.sqrt2, Cyc.add z8 (Cyc.conj z8))

[<Fact>]
let ``multiplication is negacyclic, not cyclic - checked against float complex arithmetic`` () =
    // The failure this catches: zeta^{8+m} = +zeta^m (cyclic, WRONG) instead of -zeta^m. It is a
    // one-character mistake and every internal law would still pass, because the ring would still
    // be A ring - just not this one. Only an external instrument sees it.
    for a in samples 4 40 3 do
        for b in samples 7 3 2 do
            agrees 1e-6 (cmul (Cyc.toComplex a) (Cyc.toComplex b)) (Cyc.mul a b)

[<Fact>]
let ``addition and conjugation agree with the float evaluation`` () =
    for a in samples 11 40 4 do
        for b in samples 13 3 4 do
            agrees 1e-6 (cadd (Cyc.toComplex a) (Cyc.toComplex b)) (Cyc.add a b)

    for a in samples 17 40 4 do
        let c = Cyc.toComplex a
        agrees 1e-6 { Real = c.Real; Imag = -c.Imag } (Cyc.conj a)

[<Fact>]
let ``normSq is real and equals the modulus squared`` () =
    for a in samples 23 40 4 do
        let c = Cyc.toComplex a
        agrees 1e-6 { Real = c.Real * c.Real + c.Imag * c.Imag; Imag = 0.0 } (Cyc.normSq a)

[<Fact>]
let ``the canonical form is UNIQUE - scaling by sqrt2 and raising K round-trips to the same value`` () =
    // This is what makes equality decidable and the encoding byte-lockable. If canonicalisation
    // were incomplete, two representations of one value would encode differently and the lock
    // would be a lock on the writing-down, not on the state - exactly the defect being fixed.
    for a in samples 29 60 3 do
        for k in 0..4 do
            let scaled = Cyc.mul a (Cyc.ofInt 1)
            let inflated =
                List.fold (fun acc _ -> Cyc.mul acc Cyc.sqrt2) scaled [ 1..k ]
                |> fun u -> Cyc.mul u (List.fold (fun acc _ -> Cyc.mul acc Cyc.invSqrt2) Cyc.one [ 1..k ])

            Assert.Equal<Cyc>(a, inflated)
            Assert.Equal(Cyc.encode a, Cyc.encode inflated)

[<Fact>]
let ``create REFUSES a wrong-rank array and a negative exponent`` () =
    Assert.Throws<ArgumentException>(fun () -> Cyc.create [| 1I; 0I |] 0 |> ignore) |> ignore
    Assert.Throws<ArgumentException>(fun () -> Cyc.create (Array.create 8 1I) -1 |> ignore) |> ignore

// ================================================================================================
// B. THE LAWS COME BACK - and the INSTRUMENT SURVIVES. Only the epsilon dies.
// ================================================================================================

/// `1/(sqrt2)^40 = 2^-20 = 9.5367e-7` - exact in the ring, and deliberately just BELOW the float
/// carrier's `sqrt EPS = 1e-6` deletion threshold. One value, two carriers, opposite fates.
let private eps: Cyc =
    Cyc.create [| 1I; 0I; 0I; 0I; 0I; 0I; 0I; 0I |] 40

let private epsFloat: float = Math.Pow(2.0, -20.0)

[<Fact>]
let ``ASSOCIATIVITY: the witness that breaks the float carrier CATEGORICALLY is exact here`` () =
    // Same three values on both carriers. This is a DIFFERENTIAL test on purpose - it is the float
    // arm that carries the evidence the fix was needed, so it lives here beside the exact arm.
    let a, b, cc = Cyc.one, Cyc.add (Cyc.neg Cyc.one) eps, eps

    let left = CyclotomicAmplitude.interfere (CyclotomicAmplitude.interfere [ 0, a ] [ 0, b ]) [ 0, cc ]
    let right = CyclotomicAmplitude.interfere [ 0, a ] (CyclotomicAmplitude.interfere [ 0, b ] [ 0, cc ])

    Assert.Equal<(int * Cyc) list>(left, right)
    Assert.Equal<(int * Cyc) list>([ 0, Cyc.add eps eps ], left)

    // FLOAT ARM - the same three values, and the two groupings disagree about whether the state
    // EXISTS. If AmplitudeEmu's float path is ever deleted, this stops compiling, which is the
    // point: the evidence of necessity must not disappear with the defect.
    let fa, fb, fc = { Real = 1.0; Imag = 0.0 }, { Real = -1.0 + epsFloat; Imag = 0.0 }, { Real = epsFloat; Imag = 0.0 }
    let fLeft = AmplitudeEmu.mergeOf (AmplitudeEmu.mergeOf [ 0, fa; 0, fb ] @ [ 0, fc ])
    let fRight = AmplitudeEmu.mergeOf ([ 0, fa ] @ AmplitudeEmu.mergeOf [ 0, fb; 0, fc ])

    Assert.Empty(fLeft)
    Assert.Single(fRight) |> ignore

[<Fact>]
let ``ASSOCIATIVITY and COMMUTATIVITY hold on every sampled triple, exactly`` () =
    let xs = samples 31 12 3
    let ys = samples 37 12 3
    let zs = samples 41 12 3

    for a in xs do
        for b in ys do
            for cc in zs do
                let ca, cb, cq = [ 0, a ], [ 0, b ], [ 0, cc ]

                Assert.Equal<(int * Cyc) list>(
                    CyclotomicAmplitude.interfere (CyclotomicAmplitude.interfere ca cb) cq,
                    CyclotomicAmplitude.interfere ca (CyclotomicAmplitude.interfere cb cq))

                Assert.Equal<(int * Cyc) list>(
                    CyclotomicAmplitude.interfere ca cb,
                    CyclotomicAmplitude.interfere cb ca)

[<Fact>]
let ``SCALE COVARIANCE: a state is a RAY - rescaling never changes the support`` () =
    // The float carrier's scale-covariance failure, verbatim from the AmplitudeEmu header: an
    // absolute threshold in a theory that has no absolute scale.
    let floatState =
        [ 0, { Real = 1.0; Imag = 0.0 }
          0, { Real = -1.0 + 2e-6; Imag = 0.0 }
          1, { Real = 1.0; Imag = 0.0 } ]

    let halve = List.map (fun (k, z: Complex) -> k, { Real = 0.5 * z.Real; Imag = 0.5 * z.Imag })
    Assert.Equal(2, (AmplitudeEmu.mergeOf floatState).Length)
    Assert.Equal(1, (AmplitudeEmu.mergeOf (halve floatState)).Length) // HALVING DELETED AN OUTCOME

    // The same shape over the exact carrier, rescaled by 1/sqrt2 eighty times - eighty orders of
    // binary magnitude - and the support does not move once.
    let eps2 = Cyc.add eps eps

    let exactState =
        [ 0, Cyc.one; 0, Cyc.add (Cyc.neg Cyc.one) eps2; 1, Cyc.one ]

    let baseline = CyclotomicAmplitude.support exactState
    Assert.Equal<int list>([ 0; 1 ], baseline)

    let mutable cur = exactState

    for _ in 1..80 do
        cur <- CyclotomicAmplitude.scale Cyc.invSqrt2 cur
        Assert.Equal<int list>(baseline, CyclotomicAmplitude.support cur)

[<Fact>]
let ``the INSTRUMENT survives: a + a is still 2a, and exact cancellation still annihilates`` () =
    // Exactness must not cost the thing the layer is FOR. Interference is the instrument; only the
    // epsilon dies.
    let a: CyclotomicAmplitude.Contribution<int> = [ 0, Cyc.ofInt 3 ]
    Assert.Equal<(int * Cyc) list>([ 0, Cyc.ofInt 6 ], CyclotomicAmplitude.interfere a a)

    // opposite phase annihilates - and it drops, because it is an EXACT zero, not a small one
    let plus = [ 0, Cyc.mul (Cyc.ofInt 5) (Cyc.zetaPow 3) ]
    let minus = [ 0, Cyc.mul (Cyc.ofInt 5) (Cyc.zetaPow 11) ] // zeta^11 = -zeta^3
    Assert.Empty(CyclotomicAmplitude.interfere plus minus)

    let residual =
        CyclotomicAmplitude.interfereAll [ [ 0, Cyc.one ]; [ 0, Cyc.neg Cyc.one ]; [ 0, eps ] ]

    Assert.Equal<(int * Cyc) list>([ 0, eps ], residual)

[<Fact>]
let ``empty is the unit and merge is idempotent as a normalisation`` () =
    let a: CyclotomicAmplitude.Contribution<int> = [ 0, Cyc.one; 1, Cyc.imag ]
    Assert.Equal<(int * Cyc) list>(CyclotomicAmplitude.mergeOf a, CyclotomicAmplitude.interfere a [])
    Assert.Equal<(int * Cyc) list>(CyclotomicAmplitude.mergeOf a, CyclotomicAmplitude.interfere [] a)

    Assert.Equal<(int * Cyc) list>(
        CyclotomicAmplitude.mergeOf a,
        CyclotomicAmplitude.mergeOf (CyclotomicAmplitude.mergeOf a))

// ================================================================================================
// C. THE Z-EPS DIFFERENTIAL. Both carriers, one ray, one test.
//
//    Z-EPS HOLDS on the float carrier (Soraya, 2026-08-14): a Bob-LOCAL, TRACE-PRESERVING operation
//    moves Alice's marginal Born probability from 9/34 to 0. This section shows the exact carrier
//    closes it - and, because an exact carrier is BLIND to this defect by construction, it keeps
//    the float arm in the same test so the evidence of necessity cannot be deleted with the defect.
//
//    NOT THE REGRESSION TEST. That is tests/Tests.FSharp/Formal/AmplitudeEmuSignalling.Tests.fs,
//    it tests the FLOAT path, and this PR does not touch it.
//
//    ONE STRENGTHENING OF Z-EPS, recorded because it narrows the exposure claim rather than
//    widening it: Soraya's witness used a (3,4,5) rotation, whose 3/5 and 4/5 amplitude factors are
//    NOT in Z[zeta_16][1/sqrt2] (they need a denominator of 5). The operation used here is the
//    BALANCED 1/sqrt2 fork - which is exactly the shape SoftChip8.forkOnInput produces - and it
//    signals just as hard. So the signalling class is not reached only by exotic rotations; it is
//    reached by the emulator's own branch factor. (It still requires a near-threshold ray, so
//    Soraya's "not a correctness emergency for CHIP-8 today" stands unchanged.)
// ================================================================================================

/// The joint key `(kA, kB)`: Alice owns the first component, Bob the second.
type private JointKey = int * int

/// Bob's setting 0 - identity.
let private bobIdleFloat (k: JointKey) : (JointKey * float) list = [ k, 1.0 ]

/// Bob's setting 1 - the balanced fork, weights 1/2 and 1/2. Alice-local (her index is copied
/// through and the (Bob-index, weight) profile does not depend on it) and trace-preserving (the
/// weights sum to 1 on every key), so in EXACT arithmetic Alice's marginal is identically invariant.
let private bobForkFloat ((kA, _): JointKey) : (JointKey * float) list =
    [ (kA, 0), 0.5; (kA, 1), 0.5 ]

let private bobIdleExact (k: JointKey) : (JointKey * Cyc) list = [ k, Cyc.one ]

let private bobForkExact ((kA, _): JointKey) : (JointKey * Cyc) list =
    [ (kA, 0), Cyc.invSqrt2; (kA, 1), Cyc.invSqrt2 ]

/// The ray, exactly: 5 on Alice-0, 3 on Alice-1, both at Bob-index 0. `P_A(1) = 9/(25+9) = 9/34`.
let private exactRay: CyclotomicAmplitude.Contribution<JointKey> =
    [ (0, 0), Cyc.ofInt 5; (1, 0), Cyc.ofInt 3 ]

/// **The SAME ray** on the float carrier, scaled by `4e-7` so it sits on the threshold.
let private floatRay: (JointKey * Complex) list =
    [ (0, 0), { Real = 2.0e-6; Imag = 0.0 }
      (1, 0), { Real = 1.2e-6; Imag = 0.0 } ]

let private aliceMarginalFloat (state: (JointKey * Complex) list) : float =
    let magSq (z: Complex) = z.Real * z.Real + z.Imag * z.Imag
    let total = state |> List.sumBy (fun (_, z) -> magSq z)

    if total <= 0.0 then
        0.0
    else
        (state |> List.filter (fun ((kA, _), _) -> kA = 1) |> List.sumBy (fun (_, z) -> magSq z)) / total

/// Alice's marginal, exactly, as the pair `(numerator, denominator)` of ring elements. Never
/// divided: the exact statement about a ratio is a cross-multiplication.
let private aliceMarginalExact (state: CyclotomicAmplitude.Contribution<JointKey>) : Cyc * Cyc =
    CyclotomicAmplitude.marginalIntensity (fun (kA, _) -> kA = 1) state,
    CyclotomicAmplitude.intensityOf state

[<Fact>]
let ``PRECONDITION the two rays are the SAME ray - componentwise ratio is one constant`` () =
    // Treatment and control must be the same physical state, or the comparison proves nothing.
    let ratios =
        List.zip (CyclotomicAmplitude.toFloatState exactRay) floatRay
        |> List.map (fun ((_, e: Complex), (_, f: Complex)) -> f.Real / e.Real)

    match ratios with
    | [ a; b ] -> Assert.Equal(a, b, 15)
    | _ -> failwith "expected exactly two branches"

[<Fact>]
let ``PRECONDITION Bob's operation is Alice-local and trace-preserving on both carriers`` () =
    for kA in 0..1 do
        for kB in 0..1 do
            // Alice's index is a spectator
            Assert.All(bobForkFloat (kA, kB), fun ((outA, _), _) -> Assert.Equal(kA, outA))
            Assert.All(bobForkExact (kA, kB), fun ((outA, _), _) -> Assert.Equal(kA, outA))
            // and the profile does not depend on it
            Assert.Equal<(int * float) list>(
                bobForkFloat (kA, kB) |> List.map (fun ((_, b), p) -> b, p),
                bobForkFloat (1 - kA, kB) |> List.map (fun ((_, b), p) -> b, p))
            // trace-preserving: weights sum to 1; exact factors satisfy sum |w|^2 = 1
            Assert.Equal(1.0, bobForkFloat (kA, kB) |> List.sumBy snd, 15)

            Assert.Equal<Cyc>(
                Cyc.one,
                bobForkExact (kA, kB) |> List.map (snd >> Cyc.normSq) |> Cyc.sum)

[<Fact>]
let ``Z-EPS: the FLOAT carrier signals on this ray - Bob moves Alice's marginal by 26 points`` () =
    // This arm is the reason the carrier change is the only admissible fix. It is asserted HERE,
    // beside the exact arm, so that the fix cannot silently take its own justification with it.
    let quiet = aliceMarginalFloat (AmplitudeEmu.step bobIdleFloat floatRay)
    let rotated = aliceMarginalFloat (AmplitudeEmu.step bobForkFloat floatRay)

    Assert.Equal(9.0 / 34.0, quiet, 12)
    Assert.Equal(0.0, rotated, 15)
    Assert.True(abs (quiet - rotated) > 0.26, "the float marginal shift collapsed - re-run Z-EPS")

    // and Alice's SUPPORT changed: Bob deleted an outcome from Alice's world
    let sup (s: (JointKey * Complex) list) = s |> List.map (fst >> fst) |> List.distinct |> List.sort
    Assert.Equal<int list>([ 0; 1 ], sup (AmplitudeEmu.step bobIdleFloat floatRay))
    Assert.Equal<int list>([ 0 ], sup (AmplitudeEmu.step bobForkFloat floatRay))

[<Fact>]
let ``Z-EPS: the EXACT carrier does not - Alice's marginal is 9/34 under BOTH of Bob's settings`` () =
    let nQuiet, dQuiet = aliceMarginalExact (CyclotomicAmplitude.step bobIdleExact exactRay)
    let nRot, dRot = aliceMarginalExact (CyclotomicAmplitude.step bobForkExact exactRay)

    // 9/34 exactly, by cross-multiplication - no division, no tolerance, no float anywhere.
    Assert.Equal<Cyc>(Cyc.mul nQuiet (Cyc.ofInt 34), Cyc.mul dQuiet (Cyc.ofInt 9))
    Assert.Equal<Cyc>(Cyc.mul nRot (Cyc.ofInt 34), Cyc.mul dRot (Cyc.ofInt 9))
    // and the two marginals are equal to each other: n_q/d_q = n_r/d_r. No channel.
    Assert.Equal<Cyc>(Cyc.mul nQuiet dRot, Cyc.mul nRot dQuiet)

    // Alice's support is untouched, which is the categorical half of the float failure.
    let sup (s: CyclotomicAmplitude.Contribution<JointKey>) =
        s |> List.map (fst >> fst) |> List.distinct |> List.sort

    Assert.Equal<int list>([ 0; 1 ], sup (CyclotomicAmplitude.step bobIdleExact exactRay))
    Assert.Equal<int list>([ 0; 1 ], sup (CyclotomicAmplitude.step bobForkExact exactRay))

[<Fact>]
let ``Z-EPS: and it holds at EVERY scale - which is what kills "tune EPS" as a class`` () =
    // The float shift is scale-dependent and the theory is not, so for any EPS > 0 there is a ray
    // where the shift is order 1. Here the ray is walked down 120 binary orders of magnitude and
    // Alice's marginal does not move once.
    let mutable ray = exactRay

    for _ in 1..120 do
        ray <- CyclotomicAmplitude.scale Cyc.invSqrt2 ray
        let nQ, dQ = aliceMarginalExact (CyclotomicAmplitude.step bobIdleExact ray)
        let nR, dR = aliceMarginalExact (CyclotomicAmplitude.step bobForkExact ray)
        Assert.Equal<Cyc>(Cyc.mul nQ (Cyc.ofInt 34), Cyc.mul dQ (Cyc.ofInt 9))
        Assert.Equal<Cyc>(Cyc.mul nQ dR, Cyc.mul nR dQ)

// ================================================================================================
// D. THE Z[zeta_4] BRIDGE - QuorumPhaseCancellation.tla's carrier, executable.
//
//    The spec restricts the adversary to the 4th roots of unity so that every amplitude is a
//    Gaussian integer and every sum is EXACT. `Vec(p, k)` there is `zeta_4^p * k`. Here that is
//    `zeta_16^{4p} * k`, and `Cyc.ofGaussian` is the same value written the other way. So a TLC
//    counterexample - a list of <<re, im>> pairs, one per member - becomes an F# value with no
//    reinterpretation step in between, which is the reinterpretation step that usually breaks a
//    proof-to-code bridge.
// ================================================================================================

/// The spec's `Vec(p, k)`: phase 0 = +1, 1 = +i, 2 = -1, 3 = -i, times integer magnitude `k`.
let private tlaVec (p: int) (k: int) : bigint * bigint =
    match p with
    | 0 -> bigint k, 0I
    | 1 -> 0I, bigint k
    | 2 -> bigint -k, 0I
    | _ -> 0I, bigint -k

[<Fact>]
let ``the representations LINE UP: the spec's Vec(p,k) is exactly zeta_16^(4p) times k`` () =
    for p in 0..3 do
        for k in 1..6 do
            let re, im = tlaVec p k
            Assert.Equal<Cyc>(Cyc.mul (Cyc.ofInt k) (Cyc.zetaPow (4 * p)), Cyc.ofGaussian re im)

[<Fact>]
let ``the Gaussian sub-lattice is CLOSED under the exact fold - a Z[i] quorum stays in Z[i]`` () =
    // Only the 1 and zeta^4 coordinates may ever be non-zero. If the fold left the sub-lattice, a
    // TLC counterexample would stop being a statement about the same object.
    let members =
        [ for p in 0..3 do
            for k in 1..5 -> Cyc.ofGaussian (fst (tlaVec p k)) (snd (tlaVec p k)) ]

    let folded = CyclotomicAmplitude.interfereAll (members |> List.map (fun z -> [ 0, z ]))

    for (_, z) in folded do
        for j in 0..7 do
            if j <> 0 && j <> 4 then
                Assert.Equal(0I, z.Coeffs.[j])

        Assert.Equal(0, z.K)

[<Fact>]
let ``a TLC counterexample runs as an F# test - full cancellation, executed`` () =
    // The spec's Q1: is FullCancellation reachable? With per-member magnitude uncapped, f = 1
    // suffices - one member with a large enough opposite-phase contribution annihilates the quorum.
    // That counterexample, executed: three honest members at phase 0 magnitude 2, one Byzantine
    // member at phase 2 magnitude 6. Resultant is exactly Zero, so the outcome LEAVES THE SUPPORT.
    let contributions =
        [ "alice", tlaVec 0 2
          "bob", tlaVec 0 2
          "carol", tlaVec 0 2
          "mallory", tlaVec 2 6 ]
        |> List.map (fun (src, (re, im)) -> src, [ 0, Cyc.ofGaussian re im ])

    let folded = CyclotomicAmplitude.interfereAll (contributions |> List.map snd)
    Assert.Empty(folded)

    // and the neutral fact is still measurable: the incoherent total is NOT zero, so the fold can
    // tell "everyone cancelled" apart from "nobody spoke" - which is what the spec's SomeNonZero
    // conjunct exists to preserve.
    let incoherent = contributions |> List.collect snd |> CyclotomicAmplitude.intensityOf
    Assert.False(Cyc.isZero incoherent)
    Assert.Equal<Cyc>(Cyc.ofInt 48, incoherent) // 2^2 + 2^2 + 2^2 + 6^2

// ================================================================================================
// E. BYTE-LOCK. The amplitude layer becomes lockable for the first time.
// ================================================================================================

[<Fact>]
let ``the encoding is pinned - decimal integers, InvariantCulture, no binary`` () =
    Assert.Equal("1,0,0,0,0,0,0,0/sqrt2^0", Cyc.encode Cyc.one)
    Assert.Equal("0,0,0,0,1,0,0,0/sqrt2^0", Cyc.encode Cyc.imag)
    Assert.Equal("0,0,1,0,0,0,-1,0/sqrt2^0", Cyc.encode Cyc.sqrt2)
    Assert.Equal("1,0,0,0,0,0,0,0/sqrt2^1", Cyc.encode Cyc.invSqrt2)
    Assert.Equal("0,0,0,0,0,0,0,0/sqrt2^0", Cyc.encode Cyc.zero)

[<Fact>]
let ``VACUITY GUARD: the encoding is a function of the VALUE, not of the writing-down`` () =
    // Found by mutating my own fix, and it is worth stating plainly because the first version of
    // this test was the failure it now guards against. The original assertion was
    //     Assert.Equal((a = b), (Cyc.encode a = Cyc.encode b))
    // which is a TAUTOLOGY: `encode` renders exactly the two fields `Equals` compares, so the
    // biconditional holds no matter what the arithmetic does. It survived canonicalisation being
    // disabled entirely - the definition of a check that cannot fail.
    //
    // The real byte-lock property is about VALUES: two different writings-down of one value must
    // encode identically, and distinct values must not collide. Both are stated below against the
    // independent float instrument, so neither can be satisfied by rendering alone.
    for a in samples 53 40 3 do
        for k in 1..4 do
            // the same value, written down with an inflated denominator exponent
            let inflated =
                List.fold (fun acc _ -> Cyc.mul acc Cyc.sqrt2) a [ 1..k ]
                |> fun u -> List.fold (fun acc _ -> Cyc.mul acc Cyc.invSqrt2) u [ 1..k ]

            agrees 1e-6 (Cyc.toComplex a) inflated // same VALUE, by the independent instrument
            Assert.Equal(Cyc.encode a, Cyc.encode inflated) // therefore the same ENCODING

    // distinct values do not collide: encodings agree exactly when the values do.
    for a in samples 59 30 3 do
        for b in samples 61 6 3 do
            let ca, cb = Cyc.toComplex a, Cyc.toComplex b
            let sameValue = abs (ca.Real - cb.Real) < 1e-9 && abs (ca.Imag - cb.Imag) < 1e-9
            Assert.Equal(sameValue, (Cyc.encode a = Cyc.encode b))

[<Fact>]
let ``the STATE encoding is order-independent - three nodes, three arrival orders, one string`` () =
    let contribs =
        [ 2, Cyc.ofInt 3; 0, Cyc.imag; 1, Cyc.invSqrt2; 0, Cyc.ofInt 1 ]

    let key (k: int) = String.Format(Globalization.CultureInfo.InvariantCulture, "k{0}", k)
    let locked = CyclotomicAmplitude.encode key contribs

    Assert.Equal(locked, CyclotomicAmplitude.encode key (List.rev contribs))
    Assert.Equal(locked, CyclotomicAmplitude.encode key (contribs |> List.sortBy (fun (k, _) -> -k)))
    Assert.Equal("k0=1,0,0,0,1,0,0,0/sqrt2^0;k1=1,0,0,0,0,0,0,0/sqrt2^1;k2=3,0,0,0,0,0,0,0/sqrt2^0", locked)

// ================================================================================================
// F. COST - MEASURED against the depth-1 prediction, not asserted.
//
//    The prediction (Lumen, the cyclotomic-exit doc section 5b): the quorum fold is DEPTH-1, so a
//    sum of m bounded coefficients grows by log2 m bits, not linearly in circuit depth. These tests
//    measure that, and they also measure a cost the original argument did NOT name - see the last
//    one. Finding a hole in one's own argument is the point of running it.
// ================================================================================================

/// One member's contribution at a realistic magnitude: coefficients within +/- 8.
let private quorumMembers (seed: int) (m: int) (kOf: int -> int) : Cyc list =
    let next =
        let mutable s = uint64 seed * 2862933555777941757UL + 3037000493UL

        fun () ->
            s <- s * 2862933555777941757UL + 3037000493UL
            bigint (int ((s >>> 40) % 17UL) - 8)

    [ for idx in 1..m -> Cyc.create [| for _ in 1..8 -> next () |] (kOf idx) ]

[<Fact>]
let ``DEPTH-1 PREDICTION HOLDS: an m-member fold grows coefficients by about log2 m bits`` () =
    let bitsAfter (m: int) =
        let members = quorumMembers 97 m (fun _ -> 0)
        let baseBits = members |> List.map Cyc.coefficientBits |> List.max
        let folded = CyclotomicAmplitude.interfereAll (members |> List.map (fun z -> [ 0, z ]))
        let after = folded |> List.map (snd >> Cyc.coefficientBits) |> List.max
        baseBits, after

    let b16, a16 = bitsAfter 16
    let b1024, a1024 = bitsAfter 1024

    // log2 1024 = 10; allow one bit of slack for the carry, and NOTHING more.
    Assert.True(a1024 <= b1024 + 11, String.Format(Globalization.CultureInfo.InvariantCulture, "1024-member fold grew {0} -> {1} bits", b1024, a1024))
    Assert.True(a16 <= b16 + 5, String.Format(Globalization.CultureInfo.InvariantCulture, "16-member fold grew {0} -> {1} bits", b16, a16))

    // NO COMPOUNDING: 64x the members costs about 6 more bits, not 64x the bits.
    Assert.True(a1024 - a16 <= 8, String.Format(Globalization.CultureInfo.InvariantCulture, "16 -> 1024 members cost {0} bits", a1024 - a16))

[<Fact>]
let ``the 2-4x MEMORY prediction holds for the VALUES: every coefficient still fits in an Int32`` () =
    // The prediction was "phi(N) machine integers per amplitude against 2 floats today - 2-4x".
    // BigInteger is a deliberate safety margin over that, not a necessity: after a 1024-member
    // depth-1 fold, every coefficient is still an Int32. If this ever fails, the machine-integer
    // representation is genuinely out of reach and the memory claim must be restated.
    let members = quorumMembers 101 1024 (fun _ -> 0)
    let folded = CyclotomicAmplitude.interfereAll (members |> List.map (fun z -> [ 0, z ]))

    for (_, z) in folded do
        for c in z.Coeffs do
            Assert.True(
                c >= bigint Int32.MinValue && c <= bigint Int32.MaxValue,
                String.Format(Globalization.CultureInfo.InvariantCulture, "coefficient escaped Int32: {0}", c))

[<Fact>]
let ``COST THE DEPTH-1 ARGUMENT MISSED: a spread of denominator exponents costs its own bits`` () =
    // Aligning two terms to a common denominator multiplies the shallower one by sqrt2, and each
    // such multiply can DOUBLE a coefficient. So the growth is log2 m PLUS the denominator-exponent
    // spread (Kmax - Kmin) - a term the depth-1 argument did not name, because depth-1 is about the
    // number of ADDITIONS and this is about the DEPTH SPREAD of what is being added.
    //
    // Non-vacuity: the spread arm must cost STRICTLY more than the uniform arm, or this test is
    // measuring nothing.
    let foldBits (kOf: int -> int) =
        let members = quorumMembers 103 256 kOf
        CyclotomicAmplitude.interfereAll (members |> List.map (fun z -> [ 0, z ]))
        |> List.map (snd >> Cyc.coefficientBits)
        |> List.max

    let uniform = foldBits (fun _ -> 0)
    let spread = foldBits (fun idx -> idx % 33) // exponents 0..32

    Assert.True(spread > uniform, "the spread arm cost nothing - the measurement is vacuous")

    // and it is bounded by the spread, so it is a CONSTANT of the quorum's shape, not compounding
    Assert.True(
        spread <= uniform + 40,
        String.Format(Globalization.CultureInfo.InvariantCulture, "spread cost {0} bits over uniform {1}", spread, uniform))

    // The design consequence, stated where it will be found: a quorum whose members contribute at
    // a UNIFORM depth (all from the same number of forkOnInput steps) pays only log2 m. Mixed
    // depths pay the spread on top. Normalising per-member depth is therefore a real, cheap saving
    // - and it is the same open item as the unpriced per-member magnitude.
    ()

[<Fact>]
let ``the ONE-PASS sum agrees with the pairwise fold, exactly - including a spread of exponents`` () =
    // `Cyc.sum` aligns once to the maximum denominator exponent instead of re-aligning the
    // accumulator on every step. That is a COST fix and it must be a cost fix only: if the two
    // ever disagreed, the fold would depend on the grouping again, which is the defect being
    // repaired. The spread arm is the one that matters - with uniform exponents there is nothing
    // to align and the check would be near-vacuous.
    let check (xs: Cyc list) =
        Assert.Equal<Cyc>(List.fold Cyc.add Cyc.zero xs, Cyc.sum xs)

    check []
    check (samples 67 40 0) // uniform exponents
    check (samples 71 40 6) // spread exponents - the arm with something to get wrong
    check (samples 73 40 30) // wide spread

    // and the value is right, by the independent instrument
    let xs = samples 79 30 5
    let expected = xs |> List.fold (fun acc z -> cadd acc (Cyc.toComplex z)) { Real = 0.0; Imag = 0.0 }
    agrees 1e-6 expected (Cyc.sum xs)
