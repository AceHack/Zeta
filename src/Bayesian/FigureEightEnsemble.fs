namespace Zeta.Bayesian

open Zeta.Core

/// **FigureEightEnsemble — 3-cell choreographic closed mutual-update loop.**
///
/// Inspired by the Chenciner-Montgomery figure-8 choreographic solution to the 3-body problem
/// (2000): three equal masses chasing each other on a single closed curve, equally spaced in time.
///
/// In the Zeta context: three YinYangCells chase each other's posteriors in a closed loop.
/// On each tick, cell A's posterior becomes cell B's prior, B's becomes C's, C's becomes A's.
/// This is the information-theoretic analog of the figure-8 orbit.
///
/// **The key question (Open Question #5 from three-body-lagrange-condorcet-maxwell.md):**
/// Is this stable (cells stay decorrelated) or does it collapse (cells converge to the same belief)?
///
/// **Expected result based on the orbit-counting theorem:**
/// The figure-8 loop should COLLAPSE. Each cell's posterior is the next cell's prior, so after
/// enough rounds all three cells will have processed the same information in the same order.
/// The rhoProxy should approach 1 (full correlation = groupthink spiral).
///
/// **The groupthink spiral IS the homoclinic tangle:**
/// In the 3-body problem, the homoclinic tangle is the mechanism by which a near-stable trajectory
/// escapes the fixed point. In the figure-8 ensemble, the closed mutual-update loop is the
/// information-theoretic homoclinic tangle: the beliefs spiral toward consensus (the fixed point)
/// and then... stay there (collapse) rather than escaping. The demon cannot resist the tangle
/// from inside the loop — it needs an external observer (the 4th body / the referee).
[<RequireQualifiedAccess>]
module FigureEightEnsemble =

    // ── State ────────────────────────────────────────────────────────────────────────────────────

    /// A 3-cell figure-8 ensemble state.
    type FigureEight =
        { /// The three cells (A, B, C) in the loop.
          CellA: YinYangCell.Cell
          CellB: YinYangCell.Cell
          CellC: YinYangCell.Cell
          /// The number of figure-8 ticks completed.
          Tick: int
          /// History of rhoProxy values (one per tick, for convergence analysis).
          RhoHistory: float list }

    // ── Construction ─────────────────────────────────────────────────────────────────────────────

    /// Create a figure-8 ensemble from three distinct Adinkra codewords.
    let create (cwA: int[]) (cwB: int[]) (cwC: int[]) : FigureEight =
        { CellA = YinYangCell.seed cwA
          CellB = YinYangCell.seed cwB
          CellC = YinYangCell.seed cwC
          Tick = 0
          RhoHistory = [] }

    /// Create the canonical figure-8 from the first three Adinkra codewords.
    let createCanonical () : FigureEight =
        let cws = AdinkraCode.allCodewords |> List.truncate 3 |> List.toArray
        create cws.[0] cws.[1] cws.[2]

    // ── Figure-8 tick ────────────────────────────────────────────────────────────────────────────

    /// **One figure-8 tick:**
    /// 1. Each cell observes an external sensory input (the shared environment).
    /// 2. A's posterior becomes B's new prior; B's becomes C's; C's becomes A's.
    ///    (The "chasing" step — each cell hands its belief to the next in the loop.)
    /// 3. rhoProxy is measured and appended to history.
    ///
    /// The sensory input is the same for all three cells (shared environment).
    let tick (sensoryInput: Gaussian) (fig8: FigureEight) : FigureEight =
        // Step 1: each cell observes the shared sensory input
        let aObs = YinYangCell.observe sensoryInput fig8.CellA
        let bObs = YinYangCell.observe sensoryInput fig8.CellB
        let cObs = YinYangCell.observe sensoryInput fig8.CellC

        // Step 2: chase — A's posterior becomes B's prior, B's → C's, C's → A's.
        // We implement this by replacing each cell's belief with the PREVIOUS cell's posterior.
        // The yin (codeword) stays fixed (identity anchor); only the yang (belief) rotates.
        let aChased = { aObs with Column = { aObs.Column with Belief = cObs.Column.Belief } }
        let bChased = { bObs with Column = { bObs.Column with Belief = aObs.Column.Belief } }
        let cChased = { cObs with Column = { cObs.Column with Belief = bObs.Column.Belief } }

        // Step 3: measure rhoProxy on the three cells
        let means =
            [| aChased; bChased; cChased |]
            |> Array.choose (fun cell ->
                if cell.Column.Belief.Precision > 0.0 then
                    Some (cell.Column.Belief.PrecisionMean / cell.Column.Belief.Precision)
                else None)
        let rho =
            if means.Length < 2 then 0.0
            else
                let avg = Array.average means
                let variance = means |> Array.averageBy (fun m -> (m - avg) ** 2.0)
                let maxMean = Array.max means
                let minMean = Array.min means
                let maxPossibleVariance = ((maxMean - minMean) / 2.0) ** 2.0
                if maxPossibleVariance <= 1e-12 then 1.0
                else 1.0 - (variance / maxPossibleVariance)

        { fig8 with
            CellA = aChased
            CellB = bChased
            CellC = cChased
            Tick = fig8.Tick + 1
            RhoHistory = rho :: fig8.RhoHistory }

    /// Run N figure-8 ticks with a fixed sensory input.
    let runN (n: int) (sensoryInput: Gaussian) (fig8: FigureEight) : FigureEight =
        (fig8, [ 1 .. n ]) ||> List.fold (fun state _ -> tick sensoryInput state)

    // ── Analysis ─────────────────────────────────────────────────────────────────────────────────

    /// The final rhoProxy (most recent tick).
    let finalRho (fig8: FigureEight) : float =
        match fig8.RhoHistory with
        | [] -> 0.0
        | r :: _ -> r

    /// Whether the figure-8 has collapsed (rhoProxy > threshold).
    let isCollapsed (threshold: float) (fig8: FigureEight) : bool =
        finalRho fig8 > threshold

    /// The rho history in chronological order (oldest first).
    let rhoHistoryChronological (fig8: FigureEight) : float list =
        List.rev fig8.RhoHistory

    /// Whether rho is monotonically increasing (convergence toward collapse).
    let isMonotonicallyConverging (fig8: FigureEight) : bool =
        let hist = rhoHistoryChronological fig8
        hist |> List.pairwise |> List.forall (fun (r1, r2) -> r2 >= r1 - 1e-9)

    // ── Comparison: figure-8 vs independent ensemble ─────────────────────────────────────────────

    /// Run both a figure-8 ensemble and an independent 3-cell ensemble for N ticks,
    /// and return (figure8FinalRho, independentFinalRho).
    /// The independent ensemble broadcasts the same sensory input but cells do NOT
    /// hand their posteriors to each other.
    let compareWithIndependent
            (n: int)
            (sensoryInput: Gaussian)
            (cwA: int[]) (cwB: int[]) (cwC: int[])
            : float * float =
        // Figure-8: closed loop
        let fig8 = create cwA cwB cwC |> runN n sensoryInput
        let fig8Rho = finalRho fig8

        // Independent: same cells, same input, no posterior sharing
        let indep = YinYangEnsemble.create [| cwA; cwB; cwC |]
        let indepFinal =
            (indep, [ 1 .. n ]) ||> List.fold (fun ens _ ->
                YinYangEnsemble.observe sensoryInput ens)
        let indepRho = YinYangEnsemble.rhoProxy indepFinal

        fig8Rho, indepRho
