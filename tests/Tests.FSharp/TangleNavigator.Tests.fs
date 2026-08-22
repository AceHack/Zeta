module Zeta.Tests.TangleNavigatorTests

open System
open global.Xunit
open Zeta.Core

// The logistic map at r=4 is the textbook chaotic map on [0,1]: λ = ln 2 exactly, and [0,1] is INVARIANT
// (nothing ever leaves). At r > 4 the invariant set becomes a non-attracting **chaotic saddle** — the
// horseshoe Smale built from Poincaré's tangle — and orbits linger on it, then escape. That pair is the
// whole experiment: same family, one parameter, "confined forever" vs "confined for a while."
let private logistic (r: float) (x: float) = r * x * (1.0 - x)
let private log4 = logistic 4.0
let private absDist (a: float) (b: float) = abs (a - b)
let private nudgeF (x: float) = x + 1e-9

/// Left the unit interval = left the saddle. (At r>4 an escaped orbit runs to −∞, so this is absorbing.)
let private leftUnit (x: float) = x < 0.0 || x > 1.0

// ── dwell: the neutral measurement ───────────────────────────────────────────────────────────────────

[<Fact>]
let ``logistic r=4 never leaves the unit interval — [0,1] is invariant`` () =
    Assert.Equal(TangleNavigator.Confined 5000, TangleNavigator.dwell leftUnit log4 5000 0.1234)

[<Fact>]
let ``dwell reports the exact step the orbit leaves the region`` () =
    // From x0 = 0.1234 the r=4 orbit is 0.4327, 0.9819, … — it first exceeds |x − x0| > 0.4 at step 2.
    let hasLeft = TangleNavigator.ballExit absDist 0.4 0.1234
    Assert.Equal(TangleNavigator.Escaped 2, TangleNavigator.dwell hasLeft log4 100 0.1234)

[<Fact>]
let ``a start already outside the region is Escaped 0, not Confined`` () =
    Assert.Equal(TangleNavigator.Escaped 0, TangleNavigator.dwell leftUnit log4 100 1.5)

// ── the 2x2: all four cells reachable, and the two discriminators both load-bearing ──────────────────

[<Fact>]
let ``TRAPPED — chaotic and never leaves: churning without progress`` () =
    // λ = ln 2 > 0 and the orbit is confined to its invariant interval forever. This is the stuck
    // condition: it is paying the full price of chaos and going nowhere.
    match TangleNavigator.classify absDist log4 nudgeF leftUnit 0.05 300 3 3000 0.1234 with
    | TangleNavigator.Trapped(lam, n) ->
        Assert.True(lam > 0.3, sprintf "λ = %f, expected > 0.3 (analytic ln 2 ≈ 0.693)" lam)
        Assert.Equal(3000, n)
    | other -> failwithf "expected Trapped, got %A" other

[<Fact>]
let ``FROZEN — confined but NOT churning: a fixed point is static, not stuck`` () =
    // The discriminator that keeps `Trapped` from meaning merely "did not move". Identity is confined
    // exactly as hard as the chaotic saddle is; only λ separates them.
    Assert.Equal(
        TangleNavigator.Frozen 500,
        TangleNavigator.classify absDist id nudgeF leftUnit 0.05 100 3 500 0.5)

[<Fact>]
let ``NAVIGABLE — same chaotic orbit, smaller region: chaotic AND getting somewhere`` () =
    // Identical dynamics and identical start as the TRAPPED test above. Only the region changed, and the
    // verdict flips — which is the honest content of the measurement: "stuck" is always stuck *relative to
    // a region*, never an intrinsic property of the orbit.
    let hasLeft = TangleNavigator.ballExit absDist 0.4 0.1234
    match TangleNavigator.classify absDist log4 nudgeF hasLeft 0.05 300 3 100 0.1234 with
    | TangleNavigator.Navigable(lam, n) ->
        Assert.True(lam > 0.3, sprintf "λ = %f" lam)
        Assert.Equal(2, n)
    | other -> failwithf "expected Navigable, got %A" other

[<Fact>]
let ``DRIFTING — escapes without churn: ordered transit out of the region`` () =
    // A pure translation: λ = 0 (separations neither grow nor shrink), leaves the ball at step 6.
    let step (x: float) = x + 0.01
    let hasLeft = TangleNavigator.ballExit absDist 0.05 0.0
    Assert.Equal(
        TangleNavigator.Drifting 6,
        TangleNavigator.classify absDist step nudgeF hasLeft 0.05 100 3 500 0.0)

[<Fact>]
let ``isTrapped fires on Trapped only — Frozen is not stuck`` () =
    Assert.True(TangleNavigator.isTrapped (TangleNavigator.Trapped(0.7, 10)))
    Assert.False(TangleNavigator.isTrapped (TangleNavigator.Frozen 10))
    Assert.False(TangleNavigator.isTrapped (TangleNavigator.Navigable(0.7, 10)))
    Assert.False(TangleNavigator.isTrapped (TangleNavigator.Drifting 10))

// ── the thresholds can be WRONG — demonstrated, not asserted away ────────────────────────────────────
// An avoidance system that cannot report a false positive is not a control system. Both of these are the
// detector being wrong on purpose, pinned so that the failure mode stays visible.

[<Fact>]
let ``FALSE POSITIVE — a budget shorter than the true dwell reports Trapped for a Navigable orbit`` () =
    // Same map, same start, same region as the NAVIGABLE test; the orbit genuinely escapes at step 2.
    // Give it a budget of 1 and the detector calls it stuck. Nothing about the orbit changed.
    let hasLeft = TangleNavigator.ballExit absDist 0.4 0.1234
    match TangleNavigator.classify absDist log4 nudgeF hasLeft 0.05 300 3 1 0.1234 with
    | TangleNavigator.Trapped(_, 1) -> () // the wrong answer, reproduced
    | other -> failwithf "expected the budget-induced false positive Trapped, got %A" other

[<Fact>]
let ``FALSE POSITIVE — a lyapTol below the noise floor reports Trapped for a periodic rotation`` () =
    // A 90° rotation is a period-4 orbit: confined, λ = 0 exactly (rotation is an isometry). With an
    // honest tolerance it reads Frozen. Drop lyapTol below zero — "any λ counts as churn" — and the same
    // orbit reads Trapped. The tolerance, not the dynamics, produced the verdict.
    let dist a b = Cl3.norm (Cl3.sub a b)
    let e1 = Cl3.vector 1.0 0.0 0.0
    let step v = Cl3.rotate (Cl3.rotor (Math.PI / 2.0) Cl3.e12) v
    let nudge v = Cl3.rotate (Cl3.rotor 1e-9 Cl3.e12) v
    let neverLeaves (v: Cl3.Mv) = Cl3.norm v > 2.0 // the orbit has norm 1 — this is never true
    Assert.Equal(
        TangleNavigator.Frozen 200,
        TangleNavigator.classify dist step nudge neverLeaves 0.05 100 3 200 e1)
    match TangleNavigator.classify dist step nudge neverLeaves -1.0 100 3 200 e1 with
    | TangleNavigator.Trapped _ -> () // the wrong answer, reproduced
    | other -> failwithf "expected the tolerance-induced false positive Trapped, got %A" other

// ── escapeRate: the cartography half (κ of the chaotic saddle) ───────────────────────────────────────

[<Fact>]
let ``escape rate rises with r — a stronger saddle holds the orbit for less time`` () =
    // κ = 1/mean dwell. Pushing r away from 4 opens the escape window wider, so κ must increase. This is
    // a prediction that could fail: nothing in the code forces the ordering, the dynamics does.
    let sample r =
        [ for i in 1 .. 400 ->
            let x0 = 0.002 + 0.996 * float i / 401.0
            TangleNavigator.dwell leftUnit (logistic r) 5000 x0 ]
        |> TangleNavigator.escapeRate
    match sample 4.05, sample 4.3 with
    | Some kLow, Some kHigh ->
        Assert.True(
            kHigh > kLow,
            sprintf "κ(4.3) = %f should exceed κ(4.05) = %f" kHigh kLow)
    | a, b -> failwithf "expected both rates measurable, got %A and %A" a b

[<Fact>]
let ``escape rate is None when nothing escaped — kappa=0 and kappa<<1/budget are indistinguishable`` () =
    // r=4 is invariant, so every sample is Confined. Reporting κ = 0 here would be a claim the sample
    // cannot support; None is the honest register.
    let dwells = [ for i in 1 .. 20 -> TangleNavigator.dwell leftUnit log4 500 (0.01 * float i) ]
    Assert.True(dwells |> List.forall (function TangleNavigator.Confined _ -> true | _ -> false))
    Assert.Equal(None, TangleNavigator.escapeRate dwells)

// ── steerOut: the targeting asymmetry (cheap in chaos, impossible in order) ──────────────────────────

/// Ten candidate kicks of ±0.001 … ±0.005 — indices 0..9 in this order.
let private kicks: (float -> float) list =
    [ for k in [ -5; -4; -3; -2; -1; 1; 2; 3; 4; 5 ] -> fun (x: float) -> x + 0.001 * float k ]

[<Fact>]
let ``steerOut shortens a lingering dwell on the chaotic saddle`` () =
    // r=4.02, x0=0.5678 lingers 53 steps on the saddle. A kick of +0.002 — 0.35% of the state — cuts it
    // to 7. That leverage is the tangle amplifying the perturbation (Shinbrot–Ott–Grebogi–Yorke 1990),
    // not the kick doing the work.
    let step = logistic 4.02
    Assert.Equal(TangleNavigator.Escaped 53, TangleNavigator.dwell leftUnit step 2000 0.5678)
    match TangleNavigator.steerOut leftUnit step 2000 kicks 0.5678 with
    | Some(idx, _, n) ->
        Assert.Equal(6, idx) // the +0.002 candidate
        Assert.Equal(7, n)
    | None -> failwith "expected a kick that escapes sooner"

[<Fact>]
let ``steerOut finds NOTHING in the ordered regime — there is no leverage to buy`` () =
    // The same search, the same kick sizes, on an irrational rotation (λ = 0). No candidate escapes at any
    // size, because without sensitive dependence a small perturbation stays small forever. This is the
    // asymmetry that makes Aaron's correction load-bearing: chaos is the regime where steering is cheap,
    // and order is the regime where it is unavailable — the opposite of "chaos is the noise to avoid".
    let golden = (sqrt 5.0 - 1.0) / 2.0
    let step (x: float) = (x + golden) % 1.0
    Assert.Equal(TangleNavigator.Confined 2000, TangleNavigator.dwell leftUnit step 2000 0.3)
    Assert.Equal(None, TangleNavigator.steerOut leftUnit step 2000 kicks 0.3)

// ── the quorum result: what bounds an escape is DECORRELATION, not headcount ─────────────────────────
// Testing the coordinator's synthesis ("a witness/quorum makes escape schedulable") rather than adopting
// it. The synthesis survives in a **corrected and sharper** form; two of its parts did not.
//
// Deterministic LCG — no ambient Random, so this replays byte-identically (DST §7).
let private lcg (seed: uint64) =
    let mutable s = seed
    fun () ->
        s <- s * 6364136223846793005UL + 1442695040888963407UL
        float ((s >>> 11) &&& 0xFFFFFFFFFFFFFUL) / float 0xFFFFFFFFFFFFFUL

/// Mean earliest-escape over `trials` stuck states, each probed by a quorum of `n` perturbations of
/// half-width `eps`. This is "ask n witnesses, act on whichever gets out first."
let private quorumMeanEscape (eps: float) (n: int) (trials: int) (seed: uint64) =
    let rnd = lcg seed
    let step = logistic 4.02
    let mutable total = 0
    for _ in 1 .. trials do
        let stuck = 0.001 + 0.998 * rnd ()
        let mutable best = System.Int32.MaxValue
        for _ in 1 .. n do
            let probe = stuck + eps * (2.0 * rnd () - 1.0)
            best <- min best (TangleNavigator.dwell leftUnit step 100000 probe |> TangleNavigator.dwellSteps)
        total <- total + best
    float total / float trials

[<Fact>]
let ``a CORRELATED quorum buys nothing — consulting one witness ten times is consulting one witness`` () =
    // The same probe re-read n times. Every member returns the identical dwell, so the minimum over the
    // quorum is that dwell — exactly, for any n. This is DebouncedOracle's ρ=1 at L=0 ("hearing its own
    // emission") given a dynamical consequence: a correlated quorum cannot bound an escape at all.
    let step = logistic 4.02
    let probe = 0.5678 + 0.0004
    let one = TangleNavigator.dwell leftUnit step 100000 probe
    for n in [ 1; 4; 16 ] do
        let quorumMin =
            List.replicate n probe
            |> List.map (TangleNavigator.dwell leftUnit step 100000 >> TangleNavigator.dwellSteps)
            |> List.min
        Assert.Equal(TangleNavigator.dwellSteps one, quorumMin)

[<Fact>]
let ``a DECORRELATED quorum does bound the escape — but saturates, and headcount is not the knob`` () =
    // Going 1 → 4 witnesses buys a large reduction; 16 → 64 buys almost nothing. The quorum hits a floor.
    let m1 = quorumMeanEscape 1e-3 1 400 12345UL
    let m4 = quorumMeanEscape 1e-3 4 400 12345UL
    let m16 = quorumMeanEscape 1e-3 16 400 12345UL
    let m64 = quorumMeanEscape 1e-3 64 400 12345UL
    Assert.True(m4 < 0.75 * m1, sprintf "n=4 (%f) should be well under n=1 (%f)" m4 m1)
    Assert.True(m16 < m4, sprintf "n=16 (%f) < n=4 (%f)" m16 m4)
    // Saturation: quadrupling 16 → 64 moves it less than a tenth of the first 1 → 4 step.
    Assert.True(
        (m16 - m64) < 0.1 * (m1 - m4),
        sprintf "expected saturation: 16→64 gained %f, 1→4 gained %f" (m16 - m64) (m1 - m4))

[<Fact>]
let ``the floor is set by DECORRELATION — coarser probes escape sooner than finer ones at equal headcount`` () =
    // The falsifiable core. Two trajectories ε apart stay together for ~ln(1/ε)/λ steps, so a quorum
    // cannot resolve any escape earlier than its own decorrelation time. Hold n fixed at 16 and vary only
    // ε: the floor must rise as the probes get more correlated. Nothing enforces this ordering in code —
    // if the floor were set by headcount these three would coincide.
    let coarse = quorumMeanEscape 1e-1 16 400 777UL
    let mid = quorumMeanEscape 1e-3 16 400 777UL
    let fine = quorumMeanEscape 1e-9 16 400 777UL
    Assert.True(
        coarse < mid && mid < fine,
        sprintf "expected floor to rise with correlation: ε=1e-1 %f < ε=1e-3 %f < ε=1e-9 %f" coarse mid fine)
