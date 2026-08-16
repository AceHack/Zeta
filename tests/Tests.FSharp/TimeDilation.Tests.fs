module Zeta.Tests.TimeDilationTests

// ════════════════════════════════════════════════════════════════════════════
//  DOES SUBJECTIVE TIME ACTUALLY TRACK THE ORBIT CLASS?
//
//  Aaron 2026-08-15: *"in CHIP-8 we have time dilation where if it detects periodic or
//  quasi time-crystal it gets 'bored' and time shrinks or flies by, because it's just
//  repeated zombie actions that require no intelligence. Actions requiring intelligence
//  are what make time go slower."*
//
//  The mechanism is ALREADY BUILT and is not called "dilation": it is
//  `SchedulerZeta.runToHorizon` — "fast-forward through detected recurrence." What was
//  absent is the MEASUREMENT, which is the falsifiable half. These tests supply it by
//  COUNTING the `step` invocations actually performed and dividing the simulated horizon
//  by them. Nothing here is hand-tuned: the dilation factor is an OUTCOME that is read
//  off the run, never a constant chosen by taste.
//
//  Two results, and the second is a refutation:
//
//    1. The achieved dilation is EXACTLY `horizon / Recurrence.Reachable` — derived from
//       a measured quantity (`SchedulerZeta.predict`), checked against counted work.
//    2. The largest Lyapunov exponent does NOT predict the skip. λ is uncorrelated with
//       the achieved dilation across all four `Orbit.Kind` classes: the two dilatable
//       classes share λ = 0 exactly yet differ 4× in skip, and the two non-dilatable
//       classes differ by λ ≈ ln 2 yet have IDENTICAL skip. Recurrence length predicts
//       dilation; divergence rate does not.
//
//  And the cost side, carried from the start rather than added afterwards: dilating one
//  part of a coupled system reports the SAME factor at every coupling — the price is
//  invisible from the dilator's own side — and the fast-forward is then silently WRONG.
//
//  Anchors: Artin–Mazur 1965 (the recurrence zeta `SchedulerZeta` implements) ·
//  Benettin et al. 1980 (`Orbit.largestLyapunov`) · Kaneko 1984 (coupled map lattice —
//  the diffusive-coupling shape of the correlated-set probe).
// ════════════════════════════════════════════════════════════════════════════

open global.Xunit
open Zeta.Core

/// The simulated horizon every case is asked for. Deliberately NOT a multiple of any
/// period appearing below — a horizon that happens to land on a joint period makes a
/// wrong fast-forward look right (it did, twice, while this was being written).
let private horizon = 20_003

// ── the four orbit classes, all as float maps so ONE λ meter covers all of them ──

/// `Fixed` — the stationary mode. Zero information per tick.
let private fixedStep (x: float) = x

/// `Crystal 4` — a period-4 standing wave. 0.25 is a power of two, so the cycle is
/// EXACT in binary floating point; no tolerance is smuggled in.
let private crystal4Step (x: float) = let y = x + 0.25 in y - floor y

/// `Quasiperiodic` — irrational (golden-ratio) rotation. Ordered but aperiodic.
let private goldenRotation = (sqrt 5.0 - 1.0) / 2.0
let private quasiStep (x: float) = let y = x + goldenRotation in y - floor y

/// `Chaotic` — the logistic map at r = 4, whose exact largest Lyapunov exponent is ln 2.
let private chaoticStep (x: float) = 4.0 * x * (1.0 - x)

let private absDist (a: float) (b: float) = abs (a - b)
let private nudge (x: float) = x + 1e-9

/// λ under one shared meter for every case (Benettin windows, as `Orbit` prescribes).
let private lyapunovOf (step: float -> float) (s0: float) : float =
    Orbit.largestLyapunov absDist step nudge 400 3 s0

/// The class under one shared classifier for every case.
let private classOf (step: float -> float) (s0: float) : Orbit.Kind =
    Orbit.classifyDynamics absDist step nudge 1e-12 64 0.3 400 3 s0

/// **The measurement.** Run `runToHorizon` with a counting wrapper around `step` and
/// report (work actually done, achieved dilation). The factor is the QUOTIENT of two
/// counted things — there is no constant to tune.
let private measureDilation (key: 'S -> 'K) (step: 'S -> 'S) (start: 'S) : int * float =
    let mutable calls = 0
    let counted s =
        calls <- calls + 1
        step s
    SchedulerZeta.runToHorizon key counted start horizon |> ignore
    calls, float horizon / float (max 1 calls)

// ── 1. the factor is DERIVED: horizon ÷ the measured recurrence length ──

[<Fact>]
let ``the dilation factor is horizon over the measured recurrence length — derived, not chosen`` () =
    // `predict` is only called on the two RECURRENT cases on purpose: it iterates until a
    // projected state repeats and is therefore UNBOUNDED on an aperiodic float map. Only
    // `runToHorizon` is horizon-bounded and hence safe to point at any dynamics.
    for (name, step, s0, expectedReachable) in
        [ "Fixed", fixedStep, 0.1234, 1
          "Crystal 4", crystal4Step, 0.0, 4 ] do
        let r = SchedulerZeta.predict id step s0
        Assert.Equal(expectedReachable, r.Reachable)
        let work, dilation = measureDilation id step s0
        // the work actually performed IS the recurrence length — not approximately
        Assert.Equal(r.Reachable, work)
        // …so the factor is fully determined by a measured quantity
        Assert.Equal(float horizon / float r.Reachable, dilation, 9)
        Assert.True(dilation > 5000.0, sprintf "%s: dilation %f" name dilation)

[<Fact>]
let ``the recurrence length includes the TRANSIENT, and the fast-forward keeps its phase`` () =
    // A ρ-shaped orbit: 0 → 1 → 2 → 3 → 4 → 5 → 2. Transient 2, period 4, Reachable 6.
    // Every case above enters its cycle immediately (transient 0), which cannot distinguish
    // `states.Count − cyc` from `states.Count`. The real CHIP-8 orbit has a transient, so a
    // suite without one leaves the transient arithmetic untested — it did, until this case.
    let rhoStep (x: int) = if x = 5 then 2 else x + 1
    let r = SchedulerZeta.predict id rhoStep 0
    Assert.Equal(2, r.Transient)
    Assert.Equal(4, r.Period)
    Assert.Equal(6, r.Reachable)

    let work, dilation = measureDilation id rhoStep 0
    Assert.Equal(r.Transient + r.Period, work)
    Assert.Equal(float horizon / float (r.Transient + r.Period), dilation, 9)

    // …and the skipped answer equals the answer the horizon would have produced the slow
    // way. Work is not the whole claim: a fast-forward that is cheap and wrong is worse
    // than no fast-forward at all.
    let naive =
        let mutable s = 0
        for _ in 1 .. horizon do
            s <- rhoStep s
        s
    Assert.Equal(naive, SchedulerZeta.runToHorizon id rhoStep 0 horizon)

// ── 2. dilation tracks the CLASS — and the split is binary, not graded ──

[<Fact>]
let ``dilation tracks the orbit class, and the split is periodic-vs-aperiodic`` () =
    // Each case pins its EXACT class, not "one of the two I would accept" — a grouped
    // match here survives a mutation that collapses Chaotic into Quasiperiodic, which is
    // precisely the discrimination under test. (It did survive, before this was tightened.)
    Assert.Equal(Orbit.Fixed, classOf fixedStep 0.1234)
    Assert.Equal(Orbit.Crystal 4, classOf crystal4Step 0.0)
    Assert.Equal(Orbit.Quasiperiodic, classOf quasiStep 0.1234)

    match classOf chaoticStep 0.1234 with
    | Orbit.Chaotic lam -> Assert.True(lam > 0.3, sprintf "λ = %f" lam)
    | k -> Assert.Fail(sprintf "Chaotic case classified %A" k)

    for (name, step, s0) in [ "Fixed", fixedStep, 0.1234; "Crystal 4", crystal4Step, 0.0 ] do
        let _, dilation = measureDilation id step s0
        Assert.True(dilation > 1000.0, sprintf "%s: dilation %f, expected a large skip" name dilation)

    for (name, step, s0) in [ "Quasiperiodic", quasiStep, 0.1234; "Chaotic", chaoticStep, 0.1234 ] do
        let _, dilation = measureDilation id step s0
        Assert.True(dilation < 1.0, sprintf "%s: dilation %f, expected no skip at all" name dilation)

[<Fact>]
let ``off the periodic classes recurrence-detection is a NET LOSS, not a break-even`` () =
    // The honest cost: `runToHorizon` records every state it visits, so on an aperiodic
    // orbit it pays one WASTED step plus O(horizon) memory to prove there is no cycle.
    // Dilation is strictly below 1 — "no speedup" would have been the flattering reading.
    for (name, step) in [ "Quasiperiodic", quasiStep; "Chaotic", chaoticStep ] do
        let work, dilation = measureDilation id step 0.1234
        Assert.Equal(horizon + 1, work)
        Assert.True(dilation < 1.0, sprintf "%s: dilation %f" name dilation)

// ── 3. THE FALSIFIER: λ does not predict the skip ──

[<Fact>]
let ``the Lyapunov exponent does NOT predict the skip — same lambda, different dilation`` () =
    // Fixed and Crystal-4 both meter at λ = 0 to within 1e-6 — the exponent cannot tell
    // them apart. NOT "exactly 0": the crystal's mod-1 wrap leaks ≈3e-8 of rounding into
    // the separation. That residue is seven orders below the chaotic case, and it is
    // stated here rather than rounded away.
    let lamFixed = lyapunovOf fixedStep 0.1234
    let lamCrystal = lyapunovOf crystal4Step 0.0
    Assert.True(abs lamFixed < 1e-6, sprintf "λ_fixed = %g" lamFixed)
    Assert.True(abs lamCrystal < 1e-6, sprintf "λ_crystal = %g" lamCrystal)
    Assert.True(abs (lamFixed - lamCrystal) < 1e-6, sprintf "λ gap = %g" (lamFixed - lamCrystal))
    // …yet their achieved dilation differs by exactly the ratio of their cycle lengths.
    let _, dilFixed = measureDilation id fixedStep 0.1234
    let _, dilCrystal = measureDilation id crystal4Step 0.0
    Assert.Equal(4.0, dilFixed / dilCrystal, 9)

[<Fact>]
let ``the Lyapunov exponent does NOT predict the skip — different lambda, same dilation`` () =
    // Quasiperiodic and Chaotic are separated by λ ≈ ln 2, the largest gap in the set…
    let lamQuasi = lyapunovOf quasiStep 0.1234
    let lamChaotic = lyapunovOf chaoticStep 0.1234
    Assert.Equal(0.0, lamQuasi, 6)
    Assert.True(abs (lamChaotic - log 2.0) < 0.01, sprintf "λ_chaotic = %f, expected ≈ ln 2" lamChaotic)
    // …and their achieved dilation is IDENTICAL, to the last bit.
    let workQuasi, dilQuasi = measureDilation id quasiStep 0.1234
    let workChaotic, dilChaotic = measureDilation id chaoticStep 0.1234
    Assert.Equal(workQuasi, workChaotic)
    Assert.Equal(dilQuasi, dilChaotic)
    // The claim under test was "the skip factor should relate to λ". It does not: λ
    // neither separates the two dilatable classes nor the two non-dilatable ones. The
    // quantity that DOES determine the skip is the recurrence length, and λ is blind to
    // it in both directions. λ is the right meter for a LOSSY skip (how long until two
    // states agree to within ε); it is the wrong meter for the lossless one.

// ── 4. the correlated set, carried from the start (not added afterwards) ──

/// A two-part system: part A is a period-4 rotation; part B accumulates A's value with
/// strength `c`. `c = 0` is the negative control — the parts are genuinely independent —
/// and the modulus is PRIME so that B's return to its start is not an accident of the
/// horizon. Diffusive one-way coupling, in the coupled-map-lattice spirit (Kaneko 1984).
let private stepCoupled (c: int) ((a, b): int * int) : int * int = ((a + 1) % 4, (b + c * a) % 997)

/// The unilateral view: dilate part A by projecting part B out of the key. This is the
/// same move `chip8Key` makes when it projects out Mem/Display.
let private keyPartA ((a, _): int * int) = a

let private naiveJoint (c: int) (start: int * int) =
    let mutable s = start
    for _ in 1 .. horizon do
        s <- stepCoupled c s
    s

[<Fact>]
let ``the dilator's own view is BLIND to what dilation costs the correlated set`` () =
    // Measured from part A alone, the factor is byte-identical at both couplings — the
    // unilateral meter reports no cost whatsoever for becoming coupled.
    let _, unilateralAtZero = measureDilation keyPartA (stepCoupled 0) (0, 0)
    let _, unilateralAtOne = measureDilation keyPartA (stepCoupled 1) (0, 0)
    Assert.Equal(unilateralAtZero, unilateralAtOne)

    // Measured on the JOINT system, the same coupling costs three orders of magnitude of
    // dilation. At zero coupling the two views agree EXACTLY (the negative control: the
    // probe is not manufacturing the effect).
    let _, jointAtZero = measureDilation id (stepCoupled 0) (0, 0)
    let _, jointAtOne = measureDilation id (stepCoupled 1) (0, 0)
    Assert.Equal(unilateralAtZero, jointAtZero)
    Assert.True(
        jointAtZero / jointAtOne > 900.0,
        sprintf "joint dilation fell %f → %f (ratio %f)" jointAtZero jointAtOne (jointAtZero / jointAtOne)
    )

[<Fact>]
let ``unilateral dilation is silently WRONG once the projected-out part is coupled`` () =
    // At zero coupling the projection is faithful and the fast-forward is exact.
    Assert.Equal(naiveJoint 0 (0, 0), SchedulerZeta.runToHorizon keyPartA (stepCoupled 0) (0, 0) horizon)

    // At non-zero coupling the SAME call returns a state that is wrong in the projected-out
    // component — with no exception, no diagnostic, and no signal of any kind. The joint
    // key is exact, so the defect is the projection and not the algorithm.
    let truth = naiveJoint 1 (0, 0)
    let unilateral = SchedulerZeta.runToHorizon keyPartA (stepCoupled 1) (0, 0) horizon
    Assert.Equal(truth, SchedulerZeta.runToHorizon id (stepCoupled 1) (0, 0) horizon)
    Assert.NotEqual(truth, unilateral)
    Assert.Equal(fst truth, fst unilateral) // …and it is right about the part it watched
