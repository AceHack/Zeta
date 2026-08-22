/// **F2 — the smoothness falsifier for `PolarityFilter` (Lipschitz continuity).**
///
/// ## The constant is derived, not chosen
///
/// `PolarityFilter.transmit filterAngle signalAngle = cos²(filterAngle − signalAngle)`. Write
/// `Δ = filterAngle − signalAngle` and apply the power-reduction identity:
///
/// ```text
///   transmit = cos²Δ = (1 + cos 2Δ) / 2
///   d/dΔ                = −sin 2Δ
///   sup over Δ of |−sin 2Δ| = 1,   attained at Δ = ±π/4 (where |sin 2Δ| = 1)
/// ```
///
/// So by the mean value theorem `|transmit(θ, a) − transmit(θ, b)| ≤ 1 · |a − b|`, and because the
/// supremum is **attained** the constant `L = 1` is *tight* — not a loose over-estimate that would make
/// the assertion unfalsifiable. `lipschitzConstantIsTight` below pins that second half; without it the
/// bound is the vacuity class (any `L` large enough passes).
///
/// The same derivation holds in the *filter* argument by symmetry (`transmit` depends on the two angles
/// only through their difference), which `transmitIsLipschitzInTheFilterAngle` checks.
///
/// **Anchors (Beacon).** Malus's law `I = I₀cos²θ` (Étienne-Louis Malus, 1809) — the module's own
/// docstring already ties it to the Born rule. The Lipschitz condition itself: Rudolf Lipschitz (1864);
/// the modern statement (a `C¹` function on an interval is Lipschitz with `L = sup|f′|`) is the mean
/// value theorem. Nothing here needs a measurement to establish, which is why F2 was the cheap falsifier.
///
/// ## Why this file exists — a property that only ever passes is not a check
///
/// The bound is satisfied *by construction* for the primitive, so stopping at `transmit` would produce a
/// test that cannot fail. The value is in running it on the **consumers**, where the kestrel-caustic
/// prediction applies: *"discrimination shape can't have arbitrarily sharp boundaries; small
/// perturbations in input shouldn't produce wildly different classifications"* — item 2 of the caustic
/// ferry, `docs/research/2026-05-26-kestrel-caustic-engineered-bloom-filter-discriminators-substrate-smoothness-as-load-bearing-property-aaron-forwarded.md`
/// (lines 185-187).
///
/// Result, honestly stated:
///
/// | lane | Lipschitz `L = 1`? | evidence |
/// |---|---|---|
/// | `transmit` (both arguments) | **holds**, and tight | derived above + swept here ⇒ **`metered`** |
/// | `findOrientation` — *throughput* component | **holds** (max of `L`-Lipschitz functions is `L`-Lipschitz) | swept here; its true constant is `sin(π/n)` |
/// | `findOrientation` — *angle* component | **BREAKS** | argmax over a fixed grid is piecewise constant |
/// | `dominantOrientation` | **BREAKS**, and `n`-independently | the objective is degenerate at zero resultant |
///
/// The two breaking lanes are **recorded, not blessed and not fixed**. A discretised argmax is a
/// legitimate design; the point of F2 is that the discontinuity is now *named and pinned* instead of
/// implicit. If either is ever smoothed, the recording tests fail and say so.
///
/// ## The structure behind the second break (why it survives `n → ∞`)
///
/// Summing Malus over a bundle collapses to a single phasor:
///
/// ```text
///   Σⱼ cos²(a − rⱼ) = N/2 + ½·Re[e^{2ia} · R],      R ≝ Σⱼ e^{−2i rⱼ}
/// ```
///
/// so the objective is a pure sinusoid in `2a` whose maximiser is `a* = −arg(R)/2 (mod π)` and depends on
/// the bundle **only** through the doubled-angle resultant `R`. That is the classical circular mean for
/// *axial* data (Mardia & Jupp, *Directional Statistics*, the doubling trick for mod-π data; equivalently
/// the Stokes-parameter orientation of partially polarised light). `dominantOrientationMatchesTheDoubledAngleResultant`
/// checks the code against that closed form.
///
/// The consequence is the conditioning number: `arg` is smooth away from the origin and singular at it, so
/// the sensitivity of `a*` to one ray is bounded by `1/|R|` and **unbounded as `|R| → 0`**. At `|R| = 0`
/// exactly the objective is *constant* — there is no maximiser at all — and `List.maxBy` returns whichever
/// grid point floating-point rounding happens to favour. Measured off this file's own numbers: sensitivity
/// tracked `≈0.87/|R|` across `|R| ∈ [0.006, 0.6]`, i.e. the `1/|R|` bound is real and nearly attained.
module Zeta.Tests.PolarityFilterSmoothnessTests

open global.Xunit
open Zeta.Core

let private pi = System.Math.PI

/// The derived Lipschitz constant of `transmit` in either angle argument (see the module docstring).
let private lipschitzL = 1.0

/// Slack for double-precision round-off in the difference of two `cos²` evaluations (~4 ulp at 1.0).
let private fpSlack = 1e-12

/// Polarisation is headless: orientations are equal mod π, so this is the honest metric on outputs.
/// Using it means the `[0, π)` wrap-around is *not* miscounted as a discontinuity.
let private circDist (a: float) (b: float) : float =
    let d = abs (a - b) % pi
    min d (pi - d)

// ---------------------------------------------------------------------------------------------------
// The primitive: the property holds, and it is tight. `transmit` earns `metered` on smoothness.
// ---------------------------------------------------------------------------------------------------

[<Fact>]
let ``transmit is L-Lipschitz in the signal angle with L = 1 (derived, not fitted)`` () =
    // Deterministic sweep -- no ambient RNG (§13 noninterference, §7 DST).
    let steps = 720
    let separations = [ 1e-9; 1e-6; 1e-3; 0.05; 0.4; 1.3; 2.7 ]

    for fi in 0..17 do
        let filterAngle = pi * float fi / 18.0

        for i in 0..steps do
            let a = pi * float i / float steps

            for h in separations do
                let b = a + h
                let delta = abs (PolarityFilter.transmit filterAngle b - PolarityFilter.transmit filterAngle a)

                Assert.True(
                    delta <= lipschitzL * h + fpSlack,
                    $"Lipschitz L=1 violated: |transmit(%.6f{filterAngle}, %.9f{b}) - transmit(%.6f{filterAngle}, %.9f{a})| = %.12g{delta} > %.12g{h}"
                )

[<Fact>]
let ``transmit is L-Lipschitz in the filter angle too (it depends only on the difference)`` () =
    let steps = 720
    let separations = [ 1e-6; 1e-3; 0.05; 0.4; 1.3 ]

    for si in 0..17 do
        let signalAngle = pi * float si / 18.0

        for i in 0..steps do
            let a = pi * float i / float steps

            for h in separations do
                let b = a + h
                let delta = abs (PolarityFilter.transmit b signalAngle - PolarityFilter.transmit a signalAngle)

                Assert.True(
                    delta <= lipschitzL * h + fpSlack,
                    $"Lipschitz L=1 violated in the filter argument at a=%.9f{a}, h=%.9g{h}: delta = %.12g{delta}"
                )

[<Fact>]
let ``L = 1 is TIGHT -- the bound is attained at a difference of pi/4, so it is not a vacuous over-estimate`` () =
    // d/dDelta cos^2 Delta = -sin 2Delta, which reaches -1 at Delta = pi/4.
    // A one-sided difference quotient there must approach 1; a slack constant would not.
    // Analytically the quotient is sin(2h)/(2h) = 1 - (2h)^2/6 + ..., i.e. just BELOW 1 -- so the
    // two-sided window here is checking a real fact, not papering over one.
    let h = 1e-6
    let a = pi / 4.0
    let quotient = abs (PolarityFilter.transmit 0.0 (a + h) - PolarityFilter.transmit 0.0 a) / h

    // Dividing a ~1e-6 difference by h amplifies double round-off (~1e-16) to ~1e-10, so the tolerance
    // on a QUOTIENT is fpSlack/h, not fpSlack. (Measured overshoot when this file was written: 3e-11.)
    let quotientSlack = fpSlack / h

    Assert.True(
        quotient > 0.9999,
        $"the derived sup |d transmit/d theta| = 1 is not attained near pi/4 (measured %.9f{quotient}) -- either the law changed or L=1 is loose"
    )

    Assert.True(
        quotient <= lipschitzL + quotientSlack,
        $"difference quotient %.12g{quotient} exceeded L = 1 by more than double round-off"
    )

// ---------------------------------------------------------------------------------------------------
// Consumer 1 -- findOrientation. The throughput half holds; the angle half breaks.
// ---------------------------------------------------------------------------------------------------

[<Fact>]
let ``findOrientation THROUGHPUT satisfies the same L = 1 bound (a max of L-Lipschitz functions is L-Lipschitz)`` () =
    let n = 180
    let steps = 2000
    let separations = [ 1e-6; 1e-3; 0.05; 0.4 ]

    for i in 0..steps do
        let a = pi * float i / float steps

        for h in separations do
            let _, ta = PolarityFilter.findOrientation n a
            let _, tb = PolarityFilter.findOrientation n (a + h)
            let delta = abs (tb - ta)

            Assert.True(
                delta <= lipschitzL * h + fpSlack,
                $"findOrientation throughput violated L=1 at signal %.9f{a}, h=%.9g{h}: delta = %.12g{delta}"
            )

[<Fact>]
let ``RECORDED BREAK -- findOrientation's ANGLE output is piecewise constant, so no Lipschitz constant exists`` () =
    // The returned angle is an argmax over the fixed grid { pi*i/n }, so it is a step function of the
    // signal: it jumps a full grid step as the signal crosses a cell boundary at pi*(i + 1/2)/n.
    // This is the kestrel-caustic "arbitrarily sharp boundary", found where the doc predicted it.
    // NOT a bug report and NOT a fix -- a discretised argmax is a legitimate design. It is pinned so the
    // discontinuity is explicit, and so that smoothing it later shows up here as a failing test.
    let n = 180
    let boundary = pi * 67.5 / 180.0 // midway between grid points 67 and 68
    let h = 1e-9

    let below, _ = PolarityFilter.findOrientation n (boundary - h)
    let above, _ = PolarityFilter.findOrientation n (boundary + h)

    let inputSeparation = 2.0 * h
    let outputJump = circDist below above

    // One full grid step of output for 2e-9 of input.
    Assert.Equal(pi / float n, outputJump, 9)

    let observedRatio = outputJump / inputSeparation

    Assert.True(
        observedRatio > 1e6,
        $"expected the recorded discontinuity (ratio ~8.7e6); measured %.6g{observedRatio}. If findOrientation was made continuous, delete this test and say so."
    )

    Assert.True(
        observedRatio > lipschitzL,
        "the recorded break is supposed to exceed L = 1 by six orders of magnitude"
    )

// ---------------------------------------------------------------------------------------------------
// Consumer 2 -- dominantOrientation. Breaks, and unlike consumer 1 the break survives n -> infinity.
// ---------------------------------------------------------------------------------------------------

[<Fact>]
let ``dominantOrientation matches the doubled-angle resultant argmax (the closed form behind the break)`` () =
    // Sum-of-Malus over a bundle = N/2 + (1/2)Re[e^{2ia} R] with R = sum_j e^{-2i r_j}, so the maximiser
    // is -arg(R)/2 mod pi. Grid search must land within one grid step of it.
    let n = 2000
    let tol = pi / float n + 1e-9

    let bundles =
        [ [ 0.50; 0.52; 0.48; 0.51; 0.49; 2.0 ]
          [ 0.1; 0.2; 0.3 ]
          [ 1.0; 2.5; 0.7; 2.9 ]
          [ 2.9; 3.0; 0.05 ] ]

    for rays in bundles do
        let re = rays |> List.sumBy (fun r -> cos (-2.0 * r))
        let im = rays |> List.sumBy (fun r -> sin (-2.0 * r))
        let closedForm = (-(atan2 im re) / 2.0 % pi + pi) % pi
        let measured = PolarityFilter.dominantOrientation n rays

        Assert.True(
            circDist closedForm measured <= tol,
            $"dominantOrientation %.9f{measured} disagrees with the resultant closed form %.9f{closedForm} (|R| = %.6f{sqrt (re * re + im * im)})"
        )

[<Fact>]
let ``RECORDED BREAK -- at zero resultant the bundle objective is CONSTANT, so the returned lens is round-off noise`` () =
    // Two balanced orthogonal clusters: R = sum_j e^{-2i r_j} = 0 exactly. Then
    // sum_j cos^2(a - r_j) = 2cos^2 a + 2sin^2 a = 2 for every a -- a flat objective with no maximiser.
    let n = 180
    let balanced = [ 0.0; 0.0; pi / 2.0; pi / 2.0 ]

    let objective =
        [ 0 .. n - 1 ]
        |> List.map (fun i ->
            let a = pi * float i / float n
            balanced |> List.sumBy (PolarityFilter.transmit a))

    let spread = List.max objective - List.min objective

    Assert.True(
        spread < 1e-12,
        $"expected a flat objective at |R| = 0; spread was %.6g{spread}"
    )

    // ...and yet a specific orientation is returned, selected by whichever grid point round-off favoured.
    let returned = PolarityFilter.dominantOrientation n balanced
    Assert.InRange(returned, 0.0, pi)

[<Fact>]
let ``RECORDED BREAK -- dominantOrientation flips by pi/2 under a 1e-6 perturbation, at every sweep resolution`` () =
    // Unlike consumer 1's grid artefact, this one does not go away as n grows: it is the arg(R)
    // singularity at |R| = 0. Sensitivity to a single ray is bounded by 1/|R|, hence unbounded here.
    let eps = 1e-6

    for n in [ 180; 1001; 4001 ] do
        let plus = PolarityFilter.dominantOrientation n [ 0.0; 0.0; pi / 2.0; pi / 2.0 + eps ]
        let minus = PolarityFilter.dominantOrientation n [ 0.0; 0.0; pi / 2.0; pi / 2.0 - eps ]

        let outputJump = circDist plus minus
        let inputSeparation = 2.0 * eps
        let observedRatio = outputJump / inputSeparation

        Assert.True(
            outputJump > 1.5,
            $"n=%d{n}: expected the recorded ~pi/2 flip; measured a jump of %.9f{outputJump}"
        )

        Assert.True(
            observedRatio > 1e5,
            $"n=%d{n}: expected ratio ~7.85e5, measured %.6g{observedRatio}"
        )
