/// **F1 — the resolution falsifier for `PolarityFilter`.**
///
/// The defect this closes: `PolarityFilter` sweeps `n` filter orientations and takes an argmax, and `n`
/// is an arbitrarily refinable *sampling* step. With no noise channel in the module, refinement bought
/// resolution **without bound** — the model had literally infinite resolution, which is not a strong
/// claim but an unstatable one. The engineering ask was never the test; it was that `transmit`'s
/// signature had no door through which noise could enter. `PolarityFilter.Detector` /
/// `searchVia` / `noisyDetector` are that door, and it is a **declared, injected, metered** one
/// (§13 noninterference): entropy arrives only from an injected `TwoTimescaleFold.IEntropySource`,
/// never an ambient `Random()`, so every cell below is a pure function of its seed.
///
/// **The property, stated in the form the measurement supports:**
///
/// ```text
///     delta_rms  ~=  0.42 * sqrt(sigma / |R|)          while that is << pi/2
///                    (saturating at pi/(2*sqrt 3) = 0.907 — the no-information error)
/// ```
///
/// where `sigma` is the per-reading detector noise and `|R|` is the bundle's doubled-angle resultant
/// magnitude (`PolarityFilter.resultant`). The `sqrt` is because the sweep localises a **maximum**,
/// where the first derivative vanishes and the objective is curvature-limited; `|R|` is that curvature.
/// The prefactor is a **measured range, 0.38–0.46 over eight cells**, not a constant — the scaling is
/// what the assertions below check, and the band they allow is `[0.30, 0.60]`.
///
/// **The `|R|` conditioning is not decoration, and it is a correction to the shape F1 was specified in.**
/// F1 was priced as a floor on a clean peak. PR #10847 then measured that at `|R| = 0` the objective is
/// *exactly constant* — no maximiser exists at any `n` — so a floor conditioned on a peak has no domain
/// there. Conditioning on `|R|` states both facts at once: the floor is `sqrt(sigma/|R|)`, and `|R| = 0`
/// is where that diverges past the whole domain. Measured here, not assumed
/// (``the DOMAIN OF VALIDITY`` below pins it, including the sharp form: at `|R| = 0` the answer is a
/// function of the noise *ordering* alone, so scaling `sigma` changes **nothing**, exactly).
///
/// **Register** (`toy-is-free-metered-must-be-earned.md`): with these falsifiers the resolution property
/// earns **`metered`** — a floor that a mutation can remove, an exponent a mutation can change, and a
/// refinement lane a mutation can make win. `PolarityFilter` still has **zero downstream consumers**, so
/// this is a property of the primitive and of nothing else; no pipeline claim is made or implied.
///
/// Anchors: Malus 1809 / Born 1926 (the `cos²` projection) · Mardia & Jupp, *Directional Statistics*
/// (axial data: doubling, and `|R|` as the resultant length) · Box & Muller 1958 (the normal deviates) ·
/// Vigna, arXiv 1410.0530 (SplitMix64, via `SplitMix64.mix`) · Goguen & Meseguer 1982 (noninterference).
module Zeta.Tests.PolarityFilterResolutionTests

open global.Xunit
open Zeta.Core

let private pi = System.Math.PI

// ── the §13 door ────────────────────────────────────────────────────────────────────────────────

/// A seeded, **ambient-free**, **metered** entropy source — the declared §13 channel, reusing the
/// `TwoTimescaleFold.IEntropySource` interface the repo already declares for exactly this purpose
/// ("the only door that source may use — never an ambient clock, RNG, or thread-pool read. Injected
/// so DST can replay it exactly"). No new mechanism was invented for F1; this is that one, used.
///
/// An **object expression, not a class** — the interface is free, a class would have to be earned.
/// Draws are `SplitMix64.mix` over a Weyl counter, so the stream is a pure function of
/// `(seed, draw index)`: the seed is the entire state. The returned meter counts crossings, which is
/// what makes the channel *metered* rather than merely *declared*.
let private meteredSource (seed: uint64) : TwoTimescaleFold.IEntropySource * (unit -> int) =
    let counter = ref 0UL

    let src =
        { new TwoTimescaleFold.IEntropySource with
            member _.Next(bound: int) =
                counter.Value <- counter.Value + 1UL
                int (SplitMix64.mix (seed + counter.Value * SplitMix64.GoldenRatio) % uint64 bound) }

    src, (fun () -> int counter.Value)

// ── the measurement ─────────────────────────────────────────────────────────────────────────────

/// Polarization is headless (mod π): fold an angle difference into `[0, π/2]`.
let private foldHeadless (d: float) : float =
    let x = ((d % pi) + pi) % pi
    if x > pi / 2.0 then pi - x else x

/// The **no-information** RMS error. If the recovered orientation is independent of the truth, the
/// folded difference is uniform on `[0, π/2]` and its RMS is `(π/2)/√3` — the value a sweep saturates
/// at when there is nothing to find. It is also the ceiling that bounds the domain of the floor law.
let private noInformationRms = pi / (2.0 * sqrt 3.0)

/// The RMS orientation error a grid of `n` points contributes on its own: a uniform quantization of
/// width `π/n`, whose RMS is `(π/n)/√12`. This is what `sigma = 0` is limited by, and it shrinks
/// without bound — which is precisely the defect F1 exists to bound from below.
let private gridQuantizationRms (n: int) : float = (pi / float n) / sqrt 12.0

/// One measurement cell: RMS recovered-orientation error over `trials` bundles whose true dominant
/// orientation is drawn uniformly, read through a `sigma`-noisy detector on an `n`-point sweep.
/// Returns `(rmsError, crossings)`. **Every** draw — the true angles *and* the noise — crosses the one
/// injected door, so the cell is a pure function of `seed` and there is no ambient path at all.
let private measure
    (seed: uint64)
    (makeRays: float -> float list)
    (n: int)
    (sigma: float)
    (trials: int)
    : float * int =
    let src, meter = meteredSource seed
    let bound = 1 <<< 30
    let drawAngle () = pi * (float (src.Next bound) + 0.5) / float bound
    let mutable se = 0.0

    for _ in 1..trials do
        let truth = drawAngle ()
        let detector = PolarityFilter.noisyDetector src sigma (makeRays truth)
        let recovered = PolarityFilter.searchVia detector n |> fst
        let e = foldHeadless (recovered - truth)
        se <- se + e * e

    sqrt (se / float trials), meter ()

let private rms seed makeRays n sigma trials = measure seed makeRays n sigma trials |> fst

/// A single ray — the `findOrientation` case. Its resultant magnitude is exactly 1.
let private singleRay (t: float) : float list = [ t ]

/// A bundle of `rays` rays, `k` at the true orientation and the rest orthogonal to it. Doubling sends
/// the two groups to opposite points of the circle, so `R = k − (rays − k)` and `|R| = |2k − rays|`
/// **exactly** — the conditioning number is dialled by construction (and `PolarityFilter.resultant` is
/// asserted below to agree, so the dial is not taken on faith).
let private splitBundle (rays: int) (k: int) (t: float) : float list =
    List.init rays (fun i -> if i < k then t else t + pi / 2.0)

// ── the shared measurement tables (each cell measured once) ──────────────────────────────────────

[<Literal>]
let private Seed = 42UL

[<Literal>]
let private Trials = 400

[<Literal>]
let private Coarse = 1024

[<Literal>]
let private Fine = 8192

/// `sigma -> (error at n = 1024, error at n = 8192)` for a single ray (`|R| = 1`).
let private singleRayTable =
    lazy
        ([ 0.0; 1e-4; 1e-3; 1e-2; 1e-1 ]
         |> List.map (fun s -> s, (rms Seed singleRay Coarse s Trials, rms Seed singleRay Fine s Trials))
         |> Map.ofList)

let private atSigma (s: float) = (singleRayTable.Force()) |> Map.find s

/// The noisy sigma used for the `|R|` sweep, and the bundle size.
[<Literal>]
let private BundleSigma = 1e-2

[<Literal>]
let private BundleRays = 8

/// `k -> (|R| from PolarityFilter.resultant, error)` at `sigma = 1e-2`, `n = 2048`, over a bundle of 8.
let private bundleTable =
    lazy
        ([ 8; 7; 6; 5; 4 ]
         |> List.map (fun k ->
             let bundle = splitBundle BundleRays k
             let magnitude, _ = PolarityFilter.resultant (bundle 0.3)
             k, (magnitude, rms Seed bundle 2048 BundleSigma 300))
         |> Map.ofList)

/// Least-squares slope of `log err` against `log sigma` — the measured exponent.
let private logLogSlope (points: (float * float) list) : float =
    let xs = points |> List.map (fst >> log)
    let ys = points |> List.map (snd >> log)
    let n = float points.Length
    let mx = List.sum xs / n
    let my = List.sum ys / n

    let sxy = List.zip xs ys |> List.sumBy (fun (x, y) -> (x - mx) * (y - my))
    let sxx = xs |> List.sumBy (fun x -> (x - mx) * (x - mx))
    sxy / sxx

// ── (a) A FLOOR EXISTS ──────────────────────────────────────────────────────────────────────────

[<Fact>]
let ``F1(a): a resolution FLOOR exists under detector noise — and at sigma = 0 there is none`` () =
    let noiselessCoarse, noiselessFine = atSigma 0.0
    let _, floorFine = atSigma 1e-2

    // Non-vacuity, half one: at sigma = 0 the sweep is limited ONLY by the grid, and refining keeps
    // buying resolution. If this lane ever floors, the contrast below would be meaningless.
    Assert.True(
        noiselessFine < noiselessCoarse / 4.0,
        sprintf "sigma=0 stopped improving with n: %.4e -> %.4e" noiselessCoarse noiselessFine
    )

    // Non-vacuity, half two: and it improves to *exactly* the grid quantization RMS, so we know what
    // is limiting it. (pi/8192)/sqrt 12 = 1.107e-4.
    let grid = gridQuantizationRms Fine

    Assert.True(
        noiselessFine < 1.5 * grid,
        sprintf "sigma=0 error %.4e is not grid-limited (grid RMS %.4e)" noiselessFine grid
    )

    // THE CLAIM: with noise, the same sweep is orders of magnitude worse, and that gap is the floor.
    Assert.True(
        floorFine > 100.0 * noiselessFine,
        sprintf "no floor: sigma=1e-2 error %.4e is not >100x the noiseless %.4e" floorFine noiselessFine
    )

// ── (b) IT SCALES AS sqrt(sigma) ────────────────────────────────────────────────────────────────

[<Fact>]
let ``F1(b): the floor scales as sqrt(sigma) across three decades, not as sigma`` () =
    let sigmas = [ 1e-4; 1e-3; 1e-2; 1e-1 ]
    let points = sigmas |> List.map (fun s -> s, snd (atSigma s))
    let slope = logLogSlope points

    // sqrt(sigma) is slope 1/2. First-order (away from a peak) discrimination would floor at ~sigma/L
    // with L = 1, i.e. slope 1 — strictly better, and NOT what a maximum-localiser gets.
    Assert.True(
        abs (slope - 0.5) < 0.08,
        sprintf
            "log-log slope %.4f is not 1/2 (points: %s)"
            slope
            (points |> List.map (fun (s, e) -> sprintf "%g->%.4e" s e) |> String.concat ", ")
    )

    // And the prefactor is stable across the same decades — a slope alone could be fitted through
    // wildly scattered points.
    let prefactors = points |> List.map (fun (s, e) -> e / sqrt s)
    let lo = List.min prefactors
    let hi = List.max prefactors

    Assert.True(
        lo > 0.30 && hi < 0.60,
        sprintf "prefactor err/sqrt(sigma) not stable in [0.30, 0.60]: %A" prefactors
    )

// ── (c) REFINEMENT DOES NOT BEAT IT ─────────────────────────────────────────────────────────────

[<Fact>]
let ``F1(c): refining the sweep 8x does NOT beat the floor (it does at sigma = 0)`` () =
    // The contrast lane first: with no noise, 8x refinement buys very nearly 8x.
    let noiselessCoarse, noiselessFine = atSigma 0.0
    let noiselessRatio = noiselessFine / noiselessCoarse

    Assert.True(
        noiselessRatio < 0.2,
        sprintf "sigma=0 refinement bought only %.3f (expected ~1/8)" noiselessRatio
    )

    // THE CLAIM: with noise, the same 8x refinement buys less than a factor of two, at every decade.
    for sigma in [ 1e-4; 1e-3; 1e-2; 1e-1 ] do
        let coarse, fine = atSigma sigma
        let ratio = fine / coarse

        Assert.True(
            ratio > 0.5,
            sprintf "sigma=%g: refining 1024 -> 8192 beat the floor (%.4e -> %.4e, ratio %.3f)" sigma coarse fine ratio
        )

// ── (d) THE FLOOR IS |R|-CONDITIONAL ────────────────────────────────────────────────────────────

[<Fact>]
let ``F1(d): the floor is conditioned on the resultant — it scales as sqrt(sigma / |R|)`` () =
    let table = bundleTable.Force()

    // The dial is real: `resultant` agrees with the constructed |2k - rays|, so the conditioning
    // number is measured from the module, not asserted by the test's own arithmetic.
    for k in [ 8; 7; 6; 5; 4 ] do
        let magnitude, _ = table |> Map.find k
        Assert.Equal(float (abs (2 * k - BundleRays)), magnitude, 9)

    let dimensionless =
        [ 8; 7; 6; 5 ]
        |> List.map (fun k ->
            let magnitude, err = table |> Map.find k
            err * sqrt (magnitude / BundleSigma))

    let lo = List.min dimensionless
    let hi = List.max dimensionless

    Assert.True(
        lo > 0.30 && hi < 0.60,
        sprintf "err*sqrt(|R|/sigma) not stable across |R| in {8,6,4,2}: %A" dimensionless
    )

    // And it is genuinely a degradation: less resultant, worse resolution, monotonically.
    let errors = [ 8; 7; 6; 5 ] |> List.map (fun k -> snd (table |> Map.find k))

    Assert.True(
        (errors = List.sort errors),
        sprintf "error did not increase monotonically as |R| fell: %A" errors
    )

// ── the domain of validity — where the law has no content, and why ──────────────────────────────

[<Fact>]
let ``F1: DOMAIN OF VALIDITY — at |R| = 0 there is no floor because there is no peak`` () =
    let magnitude, err = bundleTable.Force() |> Map.find 4
    Assert.Equal(0.0, magnitude, 9)

    // The error has saturated at the no-information value: the sweep has learned nothing at all.
    Assert.True(
        err > 0.75 * noInformationRms,
        sprintf "|R|=0 did not saturate at the no-information RMS %.4f (got %.4f)" noInformationRms err
    )

    // The sharp form, and the reason a floor law cannot be stated here: with the objective exactly
    // constant, the argmax is decided by the ORDERING of the noise draws — and scaling every draw by
    // a positive constant cannot change an ordering. So `sigma` has no effect whatsoever, exactly.
    let bundle = splitBundle BundleRays 4
    let atTiny = rms Seed bundle 512 1e-3 150
    let atLarge = rms Seed bundle 512 1e-1 150

    Assert.Equal(atTiny, atLarge, 15)

    Assert.True(
        atTiny > 0.75 * noInformationRms,
        sprintf "|R|=0 lane is not at the no-information ceiling: %.4f" atTiny
    )

// ── DST, the meter, and the refactor the door required ──────────────────────────────────────────

[<Fact>]
let ``DST: the same seed replays the same numbers exactly; a different seed does not`` () =
    let a = rms 42UL singleRay 1024 1e-2 120
    let b = rms 42UL singleRay 1024 1e-2 120
    Assert.Equal(a, b, 15)

    // Non-vacuity: if the seed were being ignored, the equality above would be free.
    let other = rms 1337UL singleRay 1024 1e-2 120
    Assert.NotEqual(a, other)

[<Fact>]
let ``the entropy channel is METERED: every crossing is counted, and the count is exact`` () =
    let trials = 10
    let n = 256
    let _, crossings = measure Seed singleRay n 1e-2 trials

    // One draw per trial for the true orientation, plus two per reading for Box-Muller. Any unmetered
    // path — an ambient Random(), a cached deviate — would break this equality.
    Assert.Equal(trials * (1 + 2 * n), crossings)

[<Fact>]
let ``the injected detector did not change what the module computes`` () =
    // `findOrientation` and `dominantOrientation` are now expressed through `searchVia`; pin that the
    // refactor is bit-for-bit, so the door was added without moving the primitive underneath it.
    for signal in [ 0.0; 0.3; 0.9; 1.7; 3.0 ] do
        let viaOld = PolarityFilter.findOrientation 180 signal
        let viaDetector = PolarityFilter.searchVia (PolarityFilter.idealDetector [ signal ]) 180
        Assert.Equal(fst viaOld, fst viaDetector, 15)
        Assert.Equal(snd viaOld, snd viaDetector, 15)

[<Fact>]
let ``resultant's closed form locates the same peak the noiseless sweep finds`` () =
    // Σⱼ cos²(a − rⱼ) = N/2 + ½·Re[e^{2ia}·R]  ⇒  a* = −arg(R)/2 (mod π). If that were wrong, the
    // |R| the floor is conditioned on would be measuring something other than the peak's curvature.
    let bundles =
        [ [ 0.5; 0.52; 0.48; 0.51; 0.49 ]
          [ 0.0; 0.0; 0.0; 1.5 ]
          [ 2.0; 2.1; 0.3 ]
          [ 0.3; 0.3; 0.3; 0.3; 0.3 + pi / 2.0 ] ]

    for rays in bundles do
        let magnitude, peak = PolarityFilter.resultant rays
        Assert.True(magnitude > 1e-9, sprintf "degenerate bundle in this lane: %A" rays)
        let swept = PolarityFilter.dominantOrientation 4096 rays
        let gap = foldHeadless (swept - peak)
        Assert.True(gap < pi / 4096.0 + 1e-9, sprintf "closed form %.6f vs sweep %.6f" peak swept)
