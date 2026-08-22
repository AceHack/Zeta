namespace Zeta.Core

/// **`TangleNavigator` — the steering half: is this orbit *stuck*, and can a small kick get it out?
/// (Aaron 2026-08-15, shadow*.)**
///
/// Aaron: *"the chaotic regime might be noise to most but it can be navigated and have cartography done
/// to it, so it's not 0 noise, it's noise that requires active avoidance system for getting stuck in
/// homoclinic tangles."*
///
/// `Orbit` answers **what class is this orbit in** (`Fixed`/`Crystal n`/`Quasiperiodic`/`Chaotic λ`).
/// It does not answer **is it getting anywhere**, and nothing in the tree consumed it for steering — the
/// classifiers were read only by their own tests. This module is that consuming layer.
///
/// **The correction this module encodes.** The earlier synthesis
/// (`docs/research/2026-08-02-lensography-soft-regime-chaos-control-homoclinic-tangle-avoidance-*`) framed
/// the goal as *avoid the tangle, stay in the regular controllable regime*. Aaron's 08-15 observation
/// sharpens that: the thing to avoid is **getting stuck**, not the chaotic regime itself — chaos is
/// navigable, and (see `steerOut` below) it is the *only* regime in which steering is cheap at all.
///
/// **"Stuck" is a 2×2, not a class.** Two independent binary measurements, nothing invented between them:
///
/// | | **confined** (never left the region) | **escaped** (left it) |
/// |---|---|---|
/// | **λ ≤ tol** (no churn) | `Frozen` — static/periodic. Not stuck: there is nothing to be stuck *in*. | `Drifting` — ordered transit. |
/// | **λ > tol** (churning) | **`Trapped`** — paying the full price of chaos and going nowhere. | `Navigable` — chaotic *and* getting somewhere. |
///
/// Both signals are load-bearing and neither suffices. λ > 0 alone is just `Orbit.Chaotic` — free chaos is
/// navigable, not stuck. Confinement alone is a fixed point — frozen, not stuck. **`Trapped` is the
/// conjunction**, and it is exactly the chaotic-saddle / lingering-transient condition that a homoclinic
/// tangle produces.
///
/// **Anchors (checked, not merely cited).**
///   - **Poincaré** (*Sur le problème des trois corps…*, Acta Math. 13, 1890) — the stable and unstable
///     manifolds of a saddle, once transverse, must intersect infinitely often. He declined to draw the
///     figure ("je ne cherche même pas à tracer"). That figure is the tangle this module navigates.
///   - **Smale** (*Differentiable dynamical systems*, Bull. AMS 73, 1967) — the horseshoe makes the tangle
///     a theorem: a transverse homoclinic point forces a shift on bi-infinite symbol sequences
///     (Smale–Birkhoff). This is *why* Aaron's correction is right and "chaos = noise" is wrong: a chaotic
///     orbit carries a genuine **code**, so it can be charted.
///   - **Transient chaos / chaotic saddle** — Kantz & Grassberger (Physica D 17, 1985); Tél & Lai
///     (*Chaotic Transients in Spatially Extended Systems*, Phys. Rep. 460, 2008). A non-attracting
///     invariant set is left with an exponential escape-time law, rate κ. `escapeRate` measures κ; `dwell`
///     measures one sample of it.
///   - **Targeting** — Shinbrot, Ott, Grebogi & Yorke (*Using chaos to direct trajectories to targets*,
///     PRL 65, 3215, 1990); and OGY (*Controlling chaos*, PRL 64, 1196, 1990). Sensitive dependence is a
///     **control resource**: an exponentially small perturbation redirects a chaotic orbit, which is
///     precisely what `steerOut` exploits — and precisely what is unavailable when λ ≈ 0.
///
/// **Honest scope (peel).**
///   - `dwell` and `escapeRate` are **metered** — they are measurements with no free parameter beyond the
///     region and the budget, and the tests pin them against known systems (logistic r=4 is invariant on
///     [0,1]; r>4 escapes with κ rising in r).
///   - `classify` is **metered but threshold-bearing, and the threshold can be wrong in both directions**.
///     A budget shorter than the true dwell reports `Trapped` for an orbit that was merely slow
///     (**false positive**); a region larger than the orbit's excursions reports `Trapped` for an orbit
///     exploring freely inside it; a `lyapTol` below the estimator's noise floor reports `Trapped` for a
///     periodic orbit that is only `Frozen`. `NavigationTests` demonstrates the false positive on purpose —
///     an avoidance system that cannot report one is not a control system, it is an assertion.
///   - `steerOut` is a **bounded exhaustive search over caller-supplied candidates**, not a control law. It
///     is `unmetered` as a general steering method: it has a falsifier and passes it on the maps tested
///     (it shortens dwell on a chaotic saddle, and finds nothing in an ordered regime — the asymmetry
///     targeting predicts), but "search the kicks you were handed" is not OGY and does not compute the
///     unstable manifold. A real OGY controller needs the local linearization at the saddle; that is not
///     here and is not claimed.
///   - **Dual-use** (`dual-use-detection-is-neutral-oracle-decides`): `Trapped` names the **fact**
///     (churning, confined), never a verdict. Lingering on a chaotic saddle is where the symbolic code is
///     richest — "get out" and "stay in" are both legitimate readings, and the caller's oracle picks.
///     `steerOut` is therefore offered, never applied.
[<RequireQualifiedAccess>]
module TangleNavigator =

    /// What the orbit did inside the budget — the neutral fact, no verdict attached.
    type Dwell =
        /// Left the region at step n (1-based; `Escaped 0` = started outside it).
        | Escaped of int
        /// Still inside the region after n steps. NOT "trapped" on its own — a fixed point is confined too.
        | Confined of int

    /// The step count, whichever way it went — for ordering/scoring dwells.
    let dwellSteps (d: Dwell) : int =
        match d with
        | Escaped n -> n
        | Confined n -> n

    /// Region test for the common case: "has the orbit left the ball of radius `r` around `s0`?"
    let ballExit (dist: 'S -> 'S -> float) (radius: float) (s0: 'S) : 'S -> bool =
        fun s -> dist s0 s > radius

    /// Iterate `step` until `hasLeft` first holds, at most `budget` times. The single-sample dwell time on
    /// the region — one draw from the escape-time distribution (Kantz–Grassberger).
    let dwell (hasLeft: 'S -> bool) (step: 'S -> 'S) (budget: int) (s0: 'S) : Dwell =
        if hasLeft s0 then Escaped 0
        else
            let b = max 0 budget
            let mutable s = s0
            let mutable n = 0
            let mutable out = None
            while Option.isNone out && n < b do
                s <- step s
                n <- n + 1
                if hasLeft s then out <- Some n
            match out with
            | Some n -> Escaped n
            | None -> Confined b

    /// The navigation verdict — the 2×2 of (churning?) × (got anywhere?). Orthogonal to `Orbit.Kind`:
    /// that axis says *what shape the orbit is*, this one says *whether it is going anywhere*.
    type Nav =
        /// λ ≤ tol, confined — static or periodic. Not stuck: no churn to be stuck in.
        | Frozen of int
        /// λ ≤ tol, escaped — ordered transit out of the region (drift / quasiperiodic).
        | Drifting of int
        /// λ > tol, escaped — chaotic *and* making progress. Aaron's navigable regime.
        | Navigable of float * int
        /// λ > tol, confined — churning without progress. **The stuck condition**: the chaotic-saddle /
        /// lingering-transient signature of a homoclinic tangle.
        | Trapped of float * int

    /// Classify the orbit on the navigation axis. Estimates λ via `Orbit.largestLyapunov` (Benettin et al.
    /// 1980) and measures the dwell on the region, then crosses them.
    ///
    /// Every parameter here is a place this can be wrong, which is the point: `lyapTol` below the
    /// estimator noise floor promotes `Frozen` to `Trapped`; `budget` below the true dwell promotes
    /// `Navigable` to `Trapped`.
    let classify
        (dist: 'S -> 'S -> float) (step: 'S -> 'S) (nudge: 'S -> 'S) (hasLeft: 'S -> bool)
        (lyapTol: float) (windows: int) (windowLen: int) (budget: int) (s0: 'S) : Nav =
        let lam = Orbit.largestLyapunov dist step nudge windows windowLen s0
        let d = dwell hasLeft step budget s0
        match lam > lyapTol, d with
        | true, Confined n -> Trapped(lam, n)
        | true, Escaped n -> Navigable(lam, n)
        | false, Confined n -> Frozen n
        | false, Escaped n -> Drifting n

    /// Is this the stuck condition? (`Trapped` only — `Frozen` is static, not stuck.)
    let isTrapped (nav: Nav) : bool =
        match nav with
        | Trapped _ -> true
        | _ -> false

    /// The escape rate κ of a non-attracting set, from an ensemble of dwell samples: for an exponential
    /// escape-time law `P(t) ~ e^(−κt)` the MLE of κ is `1 / mean(escape time)` (Kantz–Grassberger 1985).
    ///
    /// **`None` when no sample escaped** — and that is the honest answer, not zero: a genuinely invariant
    /// set (κ = 0) and a set whose κ is merely far below `1/budget` produce the identical observation, so
    /// this sample cannot separate them. Confined samples are excluded from the mean rather than censored
    /// into it, which biases κ **upward** when some samples were confined; treat κ as a lower-confidence
    /// estimate unless every sample escaped.
    let escapeRate (dwells: Dwell seq) : float option =
        let escapes = dwells |> Seq.choose (function Escaped n -> Some (float n) | Confined _ -> None) |> Array.ofSeq
        if escapes.Length = 0 then None
        else
            let mean = Array.average escapes
            if mean <= 0.0 then None else Some(1.0 / mean)

    /// Offer a way out: try each caller-supplied perturbation and return the first-best one that leaves the
    /// region **strictly sooner** than the unperturbed orbit — as `(index, kicked state, new dwell)`.
    ///
    /// `None` is a real and frequent outcome: no candidate improved on doing nothing. An avoidance system
    /// that always finds an escape is not measuring anything.
    ///
    /// This is a **search**, not a control law (see the module peel). What makes the search worth running
    /// is the targeting asymmetry (Shinbrot–Ott–Grebogi–Yorke 1990): where λ > 0, a perturbation far too
    /// small to matter dynamically redirects the orbit, because the tangle amplifies it; where λ ≈ 0 the
    /// same search finds nothing at any candidate size, since there is no amplification to exploit.
    /// Steering is *cheap in chaos and impossible in order* — which is why "chaos = noise to be avoided"
    /// gets the sign backwards.
    ///
    /// Offered, never applied: the caller's oracle decides whether leaving is the desirable reading.
    let steerOut
        (hasLeft: 'S -> bool) (step: 'S -> 'S) (budget: int)
        (candidates: ('S -> 'S) list) (s0: 'S) : (int * 'S * int) option =
        // Only an ESCAPE can improve on the baseline: a confined candidate reaches the same `budget` the
        // baseline did, so it is never strictly sooner. (Found by mutation testing — an earlier version
        // carried a `Confined` arm here that no input could reach.) Doing nothing while confined scores
        // `budget + 1`, i.e. worse than any escape within the budget.
        let baseline =
            match dwell hasLeft step budget s0 with
            | Escaped n -> n
            | Confined n -> n + 1
        let mutable best = None
        let mutable bestScore = baseline
        candidates
        |> List.iteri (fun i k ->
            let sk = k s0
            match dwell hasLeft step budget sk with
            | Escaped n when n < bestScore ->
                bestScore <- n
                best <- Some(i, sk, n)
            | Escaped _
            | Confined _ -> ())
        best
