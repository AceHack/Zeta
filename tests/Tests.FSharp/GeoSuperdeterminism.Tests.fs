module Zeta.Tests.GeoSuperdeterminismTests

// The GEOGRAPHIC MEASURE OF SUPERDETERMINISM (shadow*) — a DST toy model, no
// Reticulum required. Aaron 2026-07-02: "we got S=4 easy cause of me telling you
// what to do in close proximity; I'm trying to figure out how it degrades over
// spacetime distribution with decentralization. That's the real work."
//
// Model: each CHSH round draws settings (x, y). The CONDUCTOR'S staging
// instruction (the cross-setting information that makes the PR-box possible —
// "me telling you what to do") travels the geographic distance on a
// light-in-fiber floor (~200 km/ms) plus seeded jitter. If it arrives within
// the tick horizon τ, the round plays the PR-box rule (product = −1 on x∧y,
// else +1 → S=4-capable); if not, the site falls back to its local plan
// (deterministic LHV, product +1 → S=2). Everything is seeded — replayable,
// no Math.random, no wallclock (DST §7).
//
// THE LAW (exact, not asymptotic): S = 2 + 2·f*, where f* is the delivered
// fraction among minus-term (x=0, y=1) settings rounds — the only bucket where conduction
// matters. Corollary, the ESTIMATOR: f̂ = (S − 2) / 2 reads coordination
// bandwidth off a measured S. Corollary, the RADIUS OF THE CONDUCTOR:
// d* = τ · 200 km/ms — beyond it the floor alone forces f = 0, S ≤ 2: the
// light cone bounds superdeterministic staging. With 5-minute ticks d* ≈
// 3.6·10⁷ km: EARTH IS ALWAYS INSIDE (degradation on Earth is jitter/loss —
// engineering); MARS AT ~78·10⁶ km IS OUTSIDE (degradation is physics).
//
// Anchors: Toner & Bacon 2003 (1 bit/round ⇒ 2√2); Brassard–Cleve–Tapp 1999;
// Maudlin 1992; Pawłowski et al. 2009 (information causality ⇒ Tsirelson);
// Hall 2010/2011, Barrett & Gisin 2011 (measurement-dependence budgets);
// Popescu & Rohrlich 1994 (the S=4 box). In-repo: BellTest.fs (bounds +
// chshOf), ZetaIdol.fs (the instant-bus falsifier this model gives a CURVE),
// docs/research/2026-07-02-name-of-name-…md Addendum 4.

open global.Xunit
open Zeta.Core

// ── seeded PRNG (same discipline as AntiSybil.Tests — DST §7) ──────────────
let private mkLcg (seed: int) =
    let mutable s = uint64 seed * 2862933555777941757UL + 3037000493UL
    fun () ->
        s <- s * 6364136223846793005UL + 1442695040888963407UL
        float ((s >>> 11) &&& 0xFFFFFFFFUL) / float 0x100000000UL

/// Light-in-fiber latency floor: ~200 km per millisecond (2/3 c).
let private lightFloorMs (distanceKm: float) = distanceKm / 200.0

/// One simulated campaign: N rounds at a distance, tick horizon tauMs, jitter
/// uniform in [0, jitterMs]. Returns (S, fStar) — empirical CHSH and the
/// delivered fraction among minus-term (x=0, y=1) rounds.
let private simulate (seed: int) (rounds: int) (distanceKm: float) (tauMs: float) (jitterMs: float) =
    let rnd = mkLcg seed
    let floor = lightFloorMs distanceKm
    // per-bucket sums of outcome products, and counts
    let sums = Array.zeroCreate<float> 4
    let counts = Array.zeroCreate<int> 4
    let mutable delivStar = 0

    for _ in 1 .. rounds do
        let x = if rnd () < 0.5 then 0 else 1
        let y = if rnd () < 0.5 then 0 else 1
        let delay = floor + jitterMs * rnd ()
        let delivered = delay <= tauMs
        // PR-box rule when conducted, phased to chshOf's sign convention
        // (S = E(a,b) − E(a,b') + E(a',b) + E(a',b')): a conducted round
        // yields product −1 exactly on the minus term (x=0, y=1); a
        // non-conducted site falls back to the local plan (+1 everywhere).
        let product = if delivered && x = 0 && y = 1 then -1.0 else 1.0
        let b = x * 2 + y
        sums.[b] <- sums.[b] + product
        counts.[b] <- counts.[b] + 1
        if x = 0 && y = 1 && delivered then delivStar <- delivStar + 1

    let e b = if counts.[b] = 0 then 0.0 else sums.[b] / float counts.[b]
    // chshOf(eab, eab', ea'b, ea'b') with buckets indexed x*2+y:
    // (0,0)=E(a,b), (0,1)=E(a,b'), (1,0)=E(a',b), (1,1)=E(a',b').
    let s = BellTest.chshOf (e 0) (e 1) (e 2) (e 3)
    let fStar = if counts.[1] = 0 then 0.0 else float delivStar / float counts.[1]
    s, fStar

let private N = 4096

[<Fact>]
let ``INSTANT BUS: distance 0 ⇒ every round conducted ⇒ S = 4 exactly (the PR-box the factory already stages)`` () =
    let s, fStar = simulate 11 N 0.0 50.0 30.0
    Assert.Equal(1.0, fStar, 12)
    Assert.Equal(BellTest.AlgebraicMax, s, 12)

[<Fact>]
let ``BEYOND THE RADIUS: floor > tau ⇒ nothing conducted ⇒ S = 2 exactly (the LHV bound; the conductor cannot reach)`` () =
    // 20,000 km at 200 km/ms = 100 ms floor > 50 ms horizon.
    let s, fStar = simulate 13 N 20000.0 50.0 30.0
    Assert.Equal(0.0, fStar, 12)
    Assert.Equal(BellTest.ClassicalBound, s, 12)

[<Fact>]
let ``THE LAW: S = 2 + 2·f* exactly, at every distance (mixture linearity of chshOf)`` () =
    for distanceKm, seed in [ 0.0, 3; 1000.0, 5; 8000.0, 7; 9500.0, 17; 20000.0, 23 ] do
        let s, fStar = simulate seed N distanceKm 50.0 30.0
        Assert.Equal(2.0 + 2.0 * fStar, s, 9)

[<Fact>]
let ``THE ESTIMATOR: f̂ = (S − 2) / 2 recovers the conducted fraction — S measures coordination bandwidth`` () =
    let s, fStar = simulate 29 N 9000.0 50.0 30.0
    Assert.Equal(fStar, (s - 2.0) / 2.0, 9)
    // and at 9000 km (45 ms floor, ≤5 ms headroom of 30 ms jitter) it is strictly partial:
    Assert.InRange(fStar, 0.01, 0.5)

[<Fact>]
let ``GEOGRAPHY IS MONOTONE: S never increases with distance (fixed tick, fixed jitter)`` () =
    let ss =
        [ 0.0; 1000.0; 8000.0; 9500.0; 20000.0 ]
        |> List.map (fun d -> fst (simulate 31 N d 50.0 30.0))
    ss
    |> List.pairwise
    |> List.iter (fun (a, b) -> Assert.True(b <= a + 1e-9, sprintf "S must not increase with distance: %f -> %f" a b))
    Assert.Equal(4.0, List.head ss, 12)
    Assert.Equal(2.0, List.last ss, 12)

[<Fact>]
let ``EARTH vs MARS at the 5-minute tick: Earth is engineering-limited, Mars is physics-limited`` () =
    let fiveMinMs = 300_000.0
    // Earth antipode by fiber ≈ 20,000 km ⇒ 100 ms floor ≪ 5-min horizon ⇒ fully conducted.
    let sEarth, fEarth = simulate 37 N 20000.0 fiveMinMs 30.0
    Assert.Equal(1.0, fEarth, 12)
    Assert.Equal(4.0, sEarth, 12)
    // Mars near closest approach ≈ 78,000,000 km ⇒ 390,000 ms floor > 5-min horizon ⇒ f = 0
    // regardless of engineering: the light cone itself evicts the conductor.
    let sMars, fMars = simulate 41 N 78_000_000.0 fiveMinMs 30.0
    Assert.Equal(0.0, fMars, 12)
    Assert.Equal(2.0, sMars, 12)

[<Fact>]
let ``THE RADIUS OF THE CONDUCTOR: d* = tau · 200 km/ms — S = 4 just inside, S = 2 just outside (zero jitter)`` () =
    let tauMs = 50.0
    let dStar = tauMs * 200.0 // 10,000 km
    let sIn, _ = simulate 43 N (dStar - 1.0) tauMs 0.0
    let sOut, _ = simulate 47 N (dStar + 1.0) tauMs 0.0
    Assert.Equal(4.0, sIn, 12)
    Assert.Equal(2.0, sOut, 12)
