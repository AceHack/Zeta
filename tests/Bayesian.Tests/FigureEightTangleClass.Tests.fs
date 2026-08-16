module Zeta.Bayesian.Tests.FigureEightTangleClassTests

open Xunit
open Zeta.Core
open Zeta.Bayesian

/// **Measuring a claim that has been on file, unmeasured, since 2026-07-04.**
///
/// `FigureEightEnsemble.fs` (lines 22–27) states: *"The groupthink spiral IS the homoclinic tangle …
/// the beliefs spiral toward consensus (the fixed point) and then… stay there (collapse) rather than
/// escaping."* `docs/letters/from-otto-tangle-reply.md` elevated that to *"the unifying result of the
/// whole day."* Neither ever ran a Lyapunov exponent on the figure-8 map.
///
/// It is checkable, so these tests check it. A homoclinic tangle is a **saddle** whose stable and
/// unstable manifolds cross transversally — it has a positive Lyapunov exponent, that is the entire
/// content of Poincaré's figure and Smale's horseshoe. A spiral into consensus is an **attracting fixed
/// point** — negative exponent, nearby trajectories merge. Those are not the same object; they are
/// opposite signs of the same measurement, and `TangleNavigator`'s 2×2 was built to separate exactly
/// this pair (`Trapped` = confined *and churning*; `Frozen` = confined, no churn).
///
/// The prose claim is not thereby worthless — the *conclusion* it was used to support ("you cannot map
/// the exits of your own collapse from inside it", hence the decorrelation discipline) stands on its own
/// and is unaffected. What fails is the identification of the mechanism, which is `numerology-vs-number-
/// theory` in dynamical clothing: collapse and chaos are both "confined forever", and confinement alone
/// never identified either one.
let private sensory = { Gaussian.PrecisionMean = 5.0; Precision = 2.0 }

let private meanOf (cell: YinYangCell.Cell) =
    let b = cell.Column.Belief
    if b.Precision > 0.0 then b.PrecisionMean / b.Precision else 0.0

/// Distance between two ensemble states = total belief-mean separation across the three cells.
let private dist (a: FigureEightEnsemble.FigureEight) (b: FigureEightEnsemble.FigureEight) =
    abs (meanOf a.CellA - meanOf b.CellA)
    + abs (meanOf a.CellB - meanOf b.CellB)
    + abs (meanOf a.CellC - meanOf b.CellC)

/// Perturb one cell's belief — the "nearby trajectory" whose fate `largestLyapunov` tracks.
let private nudge (f: FigureEightEnsemble.FigureEight) =
    { f with
        CellA =
          { f.CellA with
              Column =
                { f.CellA.Column with
                    Belief = { f.CellA.Column.Belief with PrecisionMean = f.CellA.Column.Belief.PrecisionMean + 1e-6 } } } }

let private step = FigureEightEnsemble.tick sensory

[<Fact>]
let ``the figure-8 groupthink spiral has a NON-positive Lyapunov exponent — it contracts, it does not churn`` () =
    let lam = Orbit.largestLyapunov dist step nudge 60 3 (FigureEightEnsemble.createCanonical ())
    Assert.True(
        lam <= 1e-6,
        sprintf
            "λ = %f. A homoclinic tangle requires λ > 0 (Poincaré/Smale). If this ever goes positive the docstring claim is vindicated and this test should be inverted."
            lam)

[<Fact>]
let ``the figure-8 classifies FROZEN, not TRAPPED — collapse is not a tangle`` () =
    // Confined (the beliefs never run away) but not churning ⇒ Frozen. `Trapped` — the actual
    // homoclinic-saddle signature — requires the confinement AND a positive exponent.
    let neverLeaves (_: FigureEightEnsemble.FigureEight) = false
    let nav =
        TangleNavigator.classify dist step nudge neverLeaves 1e-6 60 3 40 (FigureEightEnsemble.createCanonical ())
    match nav with
    | TangleNavigator.Frozen _ -> ()
    | TangleNavigator.Trapped(lam, _) ->
        failwithf "expected Frozen (contraction to consensus); got Trapped with λ = %f — the docstring claim would then hold" lam
    | other -> failwithf "expected Frozen, got %A" other
    Assert.False(TangleNavigator.isTrapped nav)

[<Fact>]
let ``the collapse the docstring describes is real — only its dynamical NAME was wrong`` () =
    // Guard against over-correcting: the observed behaviour (ρ → 1, monotone) is exactly as reported.
    // What this file disputes is the identification with a homoclinic tangle, not the phenomenon.
    let fig8 = FigureEightEnsemble.createCanonical () |> FigureEightEnsemble.runN 40 sensory
    Assert.True(FigureEightEnsemble.isCollapsed 0.9 fig8, sprintf "ρ = %f" (FigureEightEnsemble.finalRho fig8))
    Assert.True(FigureEightEnsemble.isMonotonicallyConverging fig8)
