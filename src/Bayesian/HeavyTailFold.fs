namespace Zeta.Bayesian

open Zeta.Bayesian.BoundJustification

/// # The heavy-tail fold — B3(a), the half that could not ship until B3(b) landed
///
/// ## The defect
///
/// `SocietyBootstrap` folds member beliefs by the exponential-family product, so
/// the joint location is the precision-weighted mean `sum(tau_i mu_i)/sum(tau_i)`.
/// That map is **unbounded in each member's influence**: a member may move the
/// answer arbitrarily far by raising the precision it *claims*. Measured, exact
/// configuration from the 2026-08-13 factor-graph design note: a correct member at
/// `mu=10, tau=1` folded against an overconfident one at `mu=0, tau=1000` gives a
/// joint mean of **0.009990** with precision **1001**. The correct member is
/// annihilated and the society is more confident than either of them.
///
/// B3(b) (`Attested`, `universal/evidence`) fixed the sibling defect — one source
/// counted N times. It is a **precondition** for this one and not a fix for it:
/// deduplication makes members countable, and a robust fold needs to count.
///
/// ## Why the obvious fix is not a fix
///
/// The textbook answer is a Student-t (scale-mixture) likelihood, whose influence
/// function `psi(z) = z (nu+1)/(nu+z^2)` **redescends** to zero, so no single member
/// can drag the answer arbitrarily far. That is true and it is not sufficient, for
/// two reasons, both measured here rather than argued:
///
/// 1. **The t fold is multimodal, and at N=2 the wrong mode wins.** For the exact
///    B3(a) pair the fold has two stationary points, `0.000385` and `9.561575`, and
///    which one an iteration reaches depends only on where it started. Ranking them
///    by likelihood does not rescue it: the overconfident member's mode wins by a
///    log-likelihood gap of **17.07**, because a claimed precision of 1000 makes its
///    density peak `sqrt(1000)` times taller. **Maximum likelihood under a heavy
///    tail still sides with whoever claims the most precision when there is nobody
///    to outvote them.** Robustness needs a quorum in order to have a majority; with
///    two members there is no principled way to say which one is the outlier, and no
///    choice of `nu` creates one.
///
/// 2. **`nu` selects the verdict.** For a society of five members at `mu=10, tau=1`
///    plus one at `mu=0, tau=1000`, the winning mode is the quorum's answer (~9.9)
///    for `nu` below 23.389306 and the overconfident member's answer (~0.01) above
///    it. A shipped `nu = 4.0` documented as "robust but not too heavy-tailed" is
///    therefore not a conservative default — **it is a silent vote**, cast by an
///    unmeasured constant, on which member the society believes. That is
///    structurally `OrbitalAsymmetryBudget`'s retired `* 1.2` (see
///    `BoundJustification`) with a plausible rationale attached.
///
/// ## What this module does instead
///
/// It applies the `BoundJustification` lesson — *ask which operation the defect
/// required, and remove it* — to `nu`. The defect required **reading a single `nu`
/// and returning a verdict**. So there is no function here that takes a bare `nu`
/// and returns a verdict. A verdict can only be asked of a **declared interval**
/// `[nu_lo, nu_hi]`, and it is published only if it is **invariant across that whole
/// interval**. A point value is not constructible (`Tail.declare` refuses
/// `lo = hi`), because a point assumption cannot be falsified while an
/// invariance-over-an-interval claim can.
///
/// This is the register discipline Lumen already applies to zeta-regularisation: a
/// claim must survive the choice of **scheme**, and here the scheme is the tail
/// index. A verdict that flips inside the declared interval is not a weak result,
/// it is an unsupported one, and the honest return is the critical `nu` that
/// separates the two answers.
///
/// "Flips" is measured the way a physicist grades a scheme dependence: **the
/// systematic must be compared with the statistical**. The fold refuses when the
/// answer moves across the declared interval by more than the tightest standard
/// error it would publish anywhere on that interval. Both sides carry the units of
/// `theta`, so the comparison is dimensionally meaningful and introduces no second
/// free constant to replace the one it removed — which was the obvious way to get
/// this wrong.
///
/// ## Inferred or declared — one type, two registers
///
/// `tryInfer` estimates `nu` by profile likelihood and returns an interval **only
/// when the boundary likelihood-ratio test rejects the Gaussian**. Otherwise it
/// refuses, because at society scale `nu` is not identifiable and the estimate is
/// noise wearing a number. Measured (400 replicates per cell, data generated from a
/// t with the stated `nu`, MLE over a log-grid on 1 to 200):
///
/// | nu_true | N    | median nu-hat | p10  | p90    | LRT power |
/// |---------|------|---------------|------|--------|-----------|
/// | 3       | 2    | ceiling       | ceil | ceil   | 0.000     |
/// | 3       | 6    | ceiling       | 1.00 | 200    | 0.080     |
/// | 3       | 30   | 3.58          | 1.83 | 200    | 0.502     |
/// | 3       | 300  | 3.13          | 2.39 | 4.09   | 1.000     |
/// | 8       | 6    | ceiling       | 1.14 | 200    | 0.040     |
/// | 8       | 1000 | 8.00          | 6.54 | 11.96  | 1.000     |
///
/// At N = 6 the 10th-to-90th percentile of the estimate spans the entire admissible
/// range and the test has essentially no power over its own 5% size. Inference
/// needs O(100) atoms; a society has O(10). So route 1 is **available and refused on
/// the evidence at society scale**, and the gate opens by itself when the atom count
/// grows. Both routes produce the same `TailInterval`, differing only in the
/// `BoundJustification.Justification` register they carry — `Measurement` when
/// inferred, `Assumption` when declared — so `isChecked` reports which you have.
///
/// ## `1/nu` is the coordinate, not `nu`
///
/// The Gaussian sits at `1/nu = 0`, the likelihood is smooth in `1/nu`, and the
/// boundary test is a test of `1/nu = 0`. So the interval is swept uniformly in
/// `1/nu`. A `nu`-uniform sweep of the same size puts most of its points where
/// nothing happens: on the worked example above, `nu` uniform on 4 to 200 places
/// under 10% of its samples below the flip at 23.39.
///
/// ## What a fold over deduplicated atoms is entitled to claim
///
/// Bounded influence **per atom** — that is a property of the t score function and
/// it holds unconditionally. Majority-robustness only under the *additional and
/// unverified* assumption that the atoms are not commonly caused: `Deduplicated` is
/// a bookkeeping fact and never a certificate of independence (`Attested`,
/// `universal/evidence`). k correlated atoms are one piece of evidence wearing k
/// basins, so a basin majority is a majority of **members**, not of **evidence**.
/// Under a shared hidden cause this fold converges to the wrong answer *robustly*,
/// which is worse than converging to it noisily. The correlation half needs an
/// external observer over repeated rounds (`DecorrelationExcess`, the CHSH oracle in
/// `AntiSybil`), both of which convict without ever acquitting.
///
/// ## Honest limits
///
/// - The guarantee is *no unstated tail assumption and no verdict that depends on
///   one*. It is **not** *no wrong assumption*: `declare "..." 50.0 200.0` compiles,
///   publishes the precision-weighted answer, and is flagged unchecked. That is the
///   same boundary `BoundJustification` states for itself.
/// - Mode enumeration starts one iteration per atom. A mode with no atom in its
///   basin is not found. That is a completeness limit, not a soundness one: an
///   unfound mode can only make the reported ranking *more* confident than it should
///   be, so the module reports the basin partition it actually found.
/// - `NoQuorum` is a refusal to publish a location, not an accusation against any
///   member (`dual-use-detection-is-neutral-oracle-decides`).
///
/// Anchors: Dawid (1973) and O'Hagan (1979) — conflict resolution requires regularly
/// varying tails; the Gaussian resolves conflict by compromise, the heavy tail by
/// rejection. Lange, Little and Taylor (1989) — the t as a Gaussian scale mixture
/// and its EM/IRLS weights. Fernandez and Steel (1999) — the pitfalls of estimating
/// the t degrees of freedom. Chernoff (1954) and Self and Liang (1987) — the 50:50
/// chi-square mixture for a parameter on the boundary, giving the 2.706 critical
/// value used here. Hampel et al. (1986) — redescending influence functions and
/// breakdown. Minka (2001) for the cavity. Cited from standing knowledge, not
/// page-checked.
module internal HeavyTailFold =

    /// An atom as this fold sees it: a location and the precision its source CLAIMS.
    /// The claim is data, never a warrant — the whole point of the module is that a
    /// claimed precision must not be able to buy the answer.
    type Atom = { Location: float; ClaimedPrecision: float }

    /// A stationary point of the robust fold.
    type Mode =
        {
          /// Where the fold settled.
          Theta: float
          /// The joint Student-t log-likelihood at `Theta`. Ranks modes against each
          /// other; comparable only at a fixed `nu`.
          LogLikelihood: float
          /// Observed information at `Theta` — the curvature of the log-likelihood,
          /// `sum_i (nu+1) tau_i (nu - z_i^2) / (nu + z_i^2)^2`. Per-atom terms go
          /// NEGATIVE when `z_i^2` exceeds `nu`: an atom the fold has rejected
          /// removes information rather than adding it, which is the redescending
          /// property showing up in the confidence and not only in the location.
          Precision: float
          /// The tail index this mode was found at. Carried because a mode is only
          /// meaningful relative to one, and because the weights normalise by it.
          Nu: float
          /// The scale-mixture weight of each atom at this mode, NORMALISED so that
          /// an atom sitting exactly on the mode weighs 1. The raw conditional
          /// expectation is `(nu+1)/(nu+z_i^2)`, which peaks at `(nu+1)/nu` rather
          /// than at 1, so an unnormalised sum exceeds the atom count and stops
          /// being readable as a sample size. Dividing by the peak fixes both.
          Weights: float list
          /// Indices of the atoms whose own iteration converged here — this mode's
          /// basin of attraction. Threshold-free: membership is decided by the
          /// dynamics, not by an inlier cutoff that would be one more free constant.
          Basin: int list }

        /// How many atoms this mode is actually standing on. At most the atom count,
        /// and strictly less whenever the fold has rejected somebody.
        member this.EffectiveSampleSize = List.sum this.Weights

    /// Why a tail index could not be inferred. Names the FACT, never a judgement.
    type TailRefusal =
        /// The boundary LRT did not reject the Gaussian at the stated level, so the
        /// data does not distinguish a heavy tail from no tail. `atomCount` is what
        /// was available; `statistic` is twice the log-likelihood gain over Gaussian.
        | TailNotIdentifiable of atomCount: int * statistic: float
        /// Fewer than three atoms — a location, a scale and a tail index are not
        /// jointly estimable from two points.
        | TooFewAtomsToInfer of atomCount: int

    /// What the fold is entitled to say. Every case names a fact; none names a culprit.
    type FoldVerdict =
        /// One answer, invariant across the whole declared tail interval, standing on
        /// a strict majority of atoms at every point of it.
        | Located of theta: float * precision: float * effectiveSampleSize: float
        /// The winning mode's supporting basin is NOT a strict majority somewhere in
        /// the declared interval. `atNu` is where that was observed and `basinSizes`
        /// the partition found there. This is the N=2 case, and it is not repairable
        /// by any choice of `nu`: robustness needs a quorum to have a majority.
        | NoQuorum of atNu: float * atomCount: int * basinSizes: int list
        /// The verdict FLIPS inside the declared interval — the answer is a function
        /// of an assumption nobody measured. `criticalNu` separates the two answers.
        | TailDependent of criticalNu: float * thetaBelow: float * thetaAbove: float
        /// Fewer than two atoms. Nothing to fold and nothing to outvote.
        | NothingToFold of atomCount: int

    // -- log-gamma (Lanczos g=7, n=9) ------------------------------------------
    // Needed for the Student-t normaliser, which must be exact in `nu` because this
    // module compares likelihoods ACROSS values of `nu`. Dropping the normaliser as
    // a constant would be valid at fixed `nu` and wrong here.
    let private lanczos =
        [| 0.99999999999980993
           676.5203681218851
           -1259.1392167224028
           771.32342877765313
           -176.61502916214059
           12.507343278686905
           -0.13857109526572012
           9.9843695780195716e-6
           1.5056327351493116e-7 |]

    let private logGamma (x: float) : float =
        let z = x - 1.0
        let mutable a = lanczos.[0]
        let t = z + 7.5

        for i in 1..8 do
            a <- a + lanczos.[i] / (z + float i)

        0.5 * log (2.0 * System.Math.PI) + (z + 0.5) * log t - t + log a

    /// The declared tail assumption. An INTERVAL, never a point: the invariance of a
    /// verdict over an interval is falsifiable, a point value is not.
    ///
    /// `Hi` may be `infinity`, which declares "anywhere from `Lo` to Gaussian" — the
    /// honest statement of not knowing the tail, and the statement most likely to
    /// earn a `TailDependent` refusal. Narrowing it costs a measurement, which is
    /// the incentive the discipline exists to create.
    type TailInterval =
        private
            { NuLo: float
              NuHi: float
              Reason: Justification }

        /// Lower endpoint (the heaviest admissible tail).
        member this.Lo = this.NuLo
        /// Upper endpoint (the lightest admissible tail; `infinity` = Gaussian).
        member this.Hi = this.NuHi
        /// Why this interval is believed.
        member this.Why = this.Reason
        /// Whether the assumption is backed by something another party could check.
        member this.IsChecked = isChecked this.Reason

    [<RequireQualifiedAccess>]
    module Tail =

        /// The only constructor. Fail-fast, because a degenerate interval is an
        /// authoring error rather than a runtime condition.
        ///
        /// `lo = hi` is REFUSED. That refusal is the whole module in one line: a
        /// point tail index is exactly the shape of the defect, so it is not
        /// constructible and cannot be routed around by passing the same number twice.
        let declareWith (why: Justification) (lo: float) (hi: float) : TailInterval =
            if not (System.Double.IsFinite lo) || lo <= 0.0 then
                invalidArg (nameof lo) "nu_lo must be finite and positive"

            if System.Double.IsNaN hi || hi <= lo then
                invalidArg
                    (nameof hi)
                    "nu_hi must be strictly greater than nu_lo -- a POINT tail index is not constructible, because a verdict that depends on it cannot be falsified"

            { NuLo = lo; NuHi = hi; Reason = why }

        /// A tail interval that is explicitly a guess. Permitted, never silent —
        /// the `Assumption` case is what keeps the type from being routed around.
        let declare (reason: string) (lo: float) (hi: float) : TailInterval =
            declareWith (Assumption reason) lo hi

    // -- the fold at one fixed tail index (a FACT, not a verdict) --------------

    /// Scale-mixture weight of an atom at a location: `w = (nu+1)/(nu+z^2)`, which is
    /// the conditional expectation of the mixing precision under the Gaussian
    /// scale-mixture representation of the t (Lange-Little-Taylor 1989). Gaussian
    /// limit: `nu` to infinity gives `w` to 1.
    let private weightAt (nu: float) (theta: float) (a: Atom) : float =
        if System.Double.IsInfinity nu then
            1.0
        else
            let z = (a.Location - theta) * sqrt a.ClaimedPrecision
            // normalised by the peak `(nu+1)/nu`, so an atom on the mode weighs 1
            nu / (nu + z * z)

    /// Joint log-likelihood of a location under independent `t_nu(mu_i, 1/tau_i)`
    /// atom messages. The normaliser is kept in full — see the note on `logGamma`.
    let private logLikelihood (nu: float) (atoms: Atom list) (theta: float) : float =
        if System.Double.IsInfinity nu then
            atoms
            |> List.sumBy (fun a ->
                let z = (a.Location - theta) * sqrt a.ClaimedPrecision
                -0.5 * log (2.0 * System.Math.PI) + 0.5 * log a.ClaimedPrecision - 0.5 * z * z)
        else
            let c =
                logGamma ((nu + 1.0) / 2.0) - logGamma (nu / 2.0) - 0.5 * log (nu * System.Math.PI)

            atoms
            |> List.sumBy (fun a ->
                let z = (a.Location - theta) * sqrt a.ClaimedPrecision
                c + 0.5 * log a.ClaimedPrecision - ((nu + 1.0) / 2.0) * log (1.0 + z * z / nu))

    /// Observed information at a location: minus the second derivative of the
    /// log-likelihood in `theta`.
    let private observedInformation (nu: float) (atoms: Atom list) (theta: float) : float =
        if System.Double.IsInfinity nu then
            atoms |> List.sumBy (fun a -> a.ClaimedPrecision)
        else
            atoms
            |> List.sumBy (fun a ->
                let z = (a.Location - theta) * sqrt a.ClaimedPrecision
                let z2 = z * z
                let d = nu + z2
                (nu + 1.0) * a.ClaimedPrecision * (nu - z2) / (d * d))

    /// One IRLS / EM run to a stationary point from a given start. Fixed iteration
    /// count so the run is deterministic and DST-replayable (no data-dependent
    /// stopping rule to diverge across oracles).
    let private iterateFrom (nu: float) (atoms: Atom list) (start: float) : float =
        let mutable theta = start

        for _ in 1..400 do
            let ws = atoms |> List.map (fun a -> weightAt nu theta a)
            let num = List.map2 (fun w (a: Atom) -> w * a.ClaimedPrecision * a.Location) ws atoms |> List.sum
            let den = List.map2 (fun w (a: Atom) -> w * a.ClaimedPrecision) ws atoms |> List.sum

            if den > 0.0 && System.Double.IsFinite num then
                theta <- num / den

        theta

    /// **A fact, never a verdict.** The stationary points of the fold at ONE tail
    /// index, with their basins, ranked by log-likelihood. Exposed because the fact
    /// is legitimately useful (diagnostics, the mode partition) while the verdict is
    /// gated; that split is `dual-use-detection-is-neutral-oracle-decides`.
    let modesAt (nu: float) (atoms: Atom list) : Mode list =
        if List.isEmpty atoms then
            []
        else
            let landings = atoms |> List.map (fun a -> iterateFrom nu atoms a.Location)
            let same (x: float) (y: float) = abs (x - y) <= 1e-7 * (1.0 + abs y)

            let reps =
                landings
                |> List.fold (fun acc th -> if acc |> List.exists (same th) then acc else acc @ [ th ]) []

            reps
            |> List.map (fun th ->
                let basin =
                    landings |> List.indexed |> List.filter (fun (_, l) -> same l th) |> List.map fst

                { Theta = th
                  LogLikelihood = logLikelihood nu atoms th
                  Precision = observedInformation nu atoms th
                  Nu = nu
                  Weights = atoms |> List.map (weightAt nu th)
                  Basin = basin })
            |> List.sortByDescending (fun m -> m.LogLikelihood)

    // -- the verdict, which only an INTERVAL can be asked for ------------------

    /// Sweep points, uniform in `1/nu` — see the module header on why `1/nu` is the
    /// coordinate. The reciprocal 0 is the Gaussian and is evaluated exactly.
    let private sweep (interval: TailInterval) : float list =
        let invLo =
            if System.Double.IsInfinity interval.NuHi then 0.0 else 1.0 / interval.NuHi

        let invHi = 1.0 / interval.NuLo
        let n = 64

        [ for k in 0..n ->
            let inv = invLo + (invHi - invLo) * float k / float n
            if inv <= 0.0 then infinity else 1.0 / inv ]

    let private winnerAt (nu: float) (atoms: Atom list) : Mode option =
        match modesAt nu atoms with
        | [] -> None
        | m :: _ -> Some m

    /// **The verdict.** There is deliberately no overload taking a bare `nu`.
    ///
    /// Two gates, in this order:
    ///
    /// 1. **Scheme-independence.** Sweep the declared interval and compare how far
    ///    the answer MOVES across it against the tightest standard error the fold
    ///    would publish anywhere on it. Scheme dependence is a defect only when it
    ///    exceeds the statistical error — that is how a regularisation-scheme
    ///    dependence is judged in physics, and it is the only comparison here that
    ///    is dimensionally meaningful (both sides are in the units of `theta`, so
    ///    there is no free constant to tune). If the assumption moves the answer by
    ///    more than the answer's own precision, the answer belongs to the assumption
    ///    and the honest return is the critical `nu` that separates the two.
    ///
    /// 2. **Quorum.** The published mode must be carried by a strict majority of
    ///    atoms. This is the N=2 case, and it is not repairable by any choice of
    ///    `nu`: robustness needs a quorum in order to have a majority.
    ///
    /// Both gates read only order-invariant quantities (the location, the observed
    /// information, and basin SIZES — never basin index sets), because the fold sits
    /// on top of a join-semilattice (`Attested`) whose whole point is that order and
    /// grouping do not matter.
    let fold (interval: TailInterval) (atoms: Atom list) : FoldVerdict =
        let n = List.length atoms

        if n < 2 then
            NothingToFold n
        else

        // grid runs from the LIGHTEST admissible tail down to the heaviest
        let winners =
            sweep interval
            |> List.choose (fun nu -> winnerAt nu atoms |> Option.map (fun m -> nu, m))

        if List.isEmpty winners then
            NothingToFold n
        else

        let thetas = winners |> List.map (fun (_, m) -> m.Theta)
        let spread = List.max thetas - List.min thetas

        // the tightest standard error this fold would publish anywhere in the interval:
        // the most demanding yardstick available, so the gate cannot be passed by
        // choosing a conveniently under-confident endpoint
        let tightestSigma =
            winners
            |> List.choose (fun (_, m) -> if m.Precision > 0.0 then Some(1.0 / sqrt m.Precision) else None)
            |> function
                | [] -> infinity
                | xs -> List.min xs

        if spread > tightestSigma then
            // Scheme dependence exceeds statistical error. Locate the tail index at
            // which the answer has moved away from its heavy-tail value by half the
            // total spread, and bisect for it in `1/nu`. Defined this way the search
            // is TOTAL: it covers a discrete flip between two modes and a gradual
            // drift with no flip at all, which is the same defect at a different
            // speed. (A "find the biggest jump" rule is partial and throws on drift.)
            let ordered = List.rev winners // heaviest tail first
            let thetaLo = (snd (List.head ordered)).Theta
            let departure = 0.5 * spread
            let thetaOf (x: float) = match winnerAt x atoms with Some m -> m.Theta | None -> nan

            // guaranteed to exist: the distance from any point to the further extreme
            // of the swept range is at least half the range
            let index =
                ordered |> List.findIndex (fun (_, m) -> abs (m.Theta - thetaLo) >= departure)

            let nuBelow = fst (List.item (max 0 (index - 1)) ordered)
            let nuAbove = fst (List.item index ordered)
            let inv (x: float) = if System.Double.IsInfinity x then 0.0 else 1.0 / x
            let mutable loInv = inv nuBelow
            let mutable hiInv = inv nuAbove

            for _ in 1..80 do
                let midInv = 0.5 * (loInv + hiInv)
                let midNu = if midInv <= 0.0 then infinity else 1.0 / midInv

                if abs (thetaOf midNu - thetaLo) < departure then
                    loInv <- midInv
                else
                    hiInv <- midInv

            let critical = if hiInv <= 0.0 then infinity else 1.0 / hiInv
            TailDependent(critical, thetaLo, thetaOf nuAbove)
        else
            // Scheme-independent. Report at the HEAVIEST admissible tail: the most
            // conservative point of the interval on the confidence axis, because
            // observed information is smallest where outliers are rejected hardest.
            match winnerAt interval.NuLo atoms with
            | None -> NothingToFold n
            | Some m ->
                if 2 * List.length m.Basin > n then
                    Located(m.Theta, m.Precision, m.EffectiveSampleSize)
                else
                    NoQuorum(
                        interval.NuLo,
                        n,
                        modesAt interval.NuLo atoms
                        |> List.map (fun mm -> List.length mm.Basin)
                        |> List.sortDescending
                    )

    // -- route 1: infer the interval, or refuse --------------------------------

    /// Profile log-likelihood at a fixed `nu`, maximised over location and scale.
    /// The scale is a nuisance here: the atoms carry claimed precisions, but the
    /// tail-index question is about the SHAPE of the residual distribution, so the
    /// scale must be free or the answer measures miscalibration instead of tail.
    let private profile (nu: float) (ys: float[]) : float =
        let n = float ys.Length
        let mutable mu = Array.average ys
        let mutable s = sqrt (max 1e-12 ((ys |> Array.sumBy (fun y -> (y - mu) * (y - mu))) / n))

        for _ in 1..200 do
            let w =
                ys
                |> Array.map (fun y ->
                    if System.Double.IsInfinity nu then
                        1.0
                    else
                        let z = (y - mu) / s
                        (nu + 1.0) / (nu + z * z))

            let sw = Array.sum w

            if sw > 0.0 then
                mu <- (Array.map2 (fun wi y -> wi * y) w ys |> Array.sum) / sw

            let s2 = (Array.map2 (fun wi y -> wi * (y - mu) * (y - mu)) w ys |> Array.sum) / n
            s <- sqrt (max 1e-12 s2)

        let atoms =
            ys |> Array.toList |> List.map (fun y -> { Location = y; ClaimedPrecision = 1.0 / (s * s) })

        logLikelihood nu atoms mu

    /// 5% critical value for a parameter on the boundary of its space. The null here
    /// is the reciprocal degrees-of-freedom equal to zero (the Gaussian), which sits
    /// ON the boundary, so the LRT statistic is a 50:50 mixture of chi-square with 0
    /// and 1 degrees of freedom rather than chi-square with 1 — Chernoff (1954),
    /// Self and Liang (1987). The naive 3.841 would make the test conservative
    /// rather than correctly sized.
    let boundaryCritical5Pct = 2.706

    /// **Route 1.** Estimate the tail index by profile likelihood and return an
    /// interval — but only when the boundary LRT rejects the Gaussian at 5%.
    /// Otherwise refuse, because a `nu` estimated from an unidentified likelihood is
    /// the shipped 4.0 with extra steps.
    ///
    /// The returned interval is the 5% profile-likelihood set around the maximum,
    /// carried with a `Measurement` justification naming the sample it ranged over.
    let tryInfer (atoms: Atom list) : Result<TailInterval, TailRefusal> =
        let n = List.length atoms

        if n < 3 then
            Error(TooFewAtomsToInfer n)
        else

        let ys = atoms |> List.map (fun a -> a.Location) |> List.toArray
        let grid = [| for k in 0..79 -> exp (float k / 79.0 * log 200.0) |]
        let lls = grid |> Array.map (fun nu -> nu, profile nu ys)
        let nuHat, best = lls |> Array.maxBy snd
        let statistic = 2.0 * (best - profile infinity ys)

        if statistic <= boundaryCritical5Pct then
            Error(TailNotIdentifiable(n, statistic))
        else
            let inSet =
                lls |> Array.filter (fun (_, ll) -> 2.0 * (best - ll) <= 3.841) |> Array.map fst

            let rawLo = Array.min inSet
            let rawHi = Array.max inSet
            // the set can collapse to a single grid point; widen around the maximum
            // rather than emit a point interval, which is not constructible
            let lo = if rawHi > rawLo then rawLo else max 1e-3 (nuHat / 1.05)
            let hi = if rawHi > rawLo then rawHi else nuHat * 1.05

            Ok(
                Tail.declareWith
                    (Measurement(
                        "Student-t degrees of freedom nu, 5% profile-likelihood set",
                        sprintf
                            "%d attested atoms; boundary LRT statistic %.3f over critical %.3f"
                            n
                            statistic
                            boundaryCritical5Pct
                    ))
                    lo
                    hi
            )

    // -- the falsifier a declared interval must carry --------------------------

    /// **The coverage falsifier.** A declared tail assumption is permitted; a
    /// declared tail assumption nobody checked is not. This is the check: run the
    /// fold over cases whose truth is known and report the fraction of truths that
    /// landed inside the fold's own stated interval at the nominal level.
    ///
    /// Returns nominal, empirical, cases published, cases refused. A refusal is NOT
    /// counted as a miss — refusing to answer is not the same as answering wrongly,
    /// and scoring it as a miss would create a pressure to publish. Empirical far
    /// BELOW nominal falsifies the interval as too light-tailed (outliers are still
    /// buying the answer); far above means the fold is under-confident and the
    /// interval is wider than the evidence warrants.
    let coverage
        (interval: TailInterval)
        (zScore: float)
        (nominal: float)
        (cases: (Atom list * float) list)
        : float * float * int * int =
        let mutable hits = 0
        let mutable published = 0
        let mutable refused = 0

        for (atoms, truth) in cases do
            match fold interval atoms with
            | Located(theta, precision, _) when precision > 0.0 ->
                published <- published + 1

                if abs (truth - theta) <= zScore / sqrt precision then
                    hits <- hits + 1
            | _ -> refused <- refused + 1

        let empirical = if published = 0 then nan else float hits / float published
        nominal, empirical, published, refused
