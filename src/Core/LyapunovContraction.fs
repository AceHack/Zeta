namespace Zeta.Core

/// **LyapunovContraction — the reseed projection is a contraction on the orbit-symmetric cone.**
///
/// ## The theorem
///
/// Let `D = {(p0, p4, p8) : p0 + 14*p4 + p8 = 1, p0 ≥ 0, p4 ≥ 0, p8 ≥ 0}` be the
/// simplex of orbit-symmetric distributions over the [8,4] Adinkra codewords.
///
/// The **Lyapunov function** is the KL divergence from the MacWilliams fixed point W_C:
///   `V(p) = KL(p || W_C) = Σ_k n_k * p_k * log(p_k / w_k)`
/// where `(n_0, n_4, n_8) = (1, 14, 1)` are the orbit sizes and
/// `w_k = 1/16` for all k (W_C is uniform over codewords).
///
/// The **reseed step** replaces the least-experienced cell (the one with the lowest
/// AccumulatedIV) with a fresh cell seeded from the next unused Adinkra codeword.
/// In the orbit-symmetric model, this is equivalent to replacing the cell's weight-class
/// mass with the MacWilliams fixed-point mass for that weight class.
///
/// **Theorem:** The reseed step is a contraction in V:
///   `V(reseed(p)) ≤ V(p)`
/// with equality iff `p = W_C` (the fixed point).
///
/// **Proof sketch:**
/// The reseed step moves one cell's belief toward the uniform prior (W_C).
/// In the orbit-symmetric model, this is a convex combination:
///   `p_after = (1 - α) * p_before + α * W_C`
/// where `α = 1/N` (one cell out of N is reseeded).
///
/// By the convexity of KL divergence (log-sum inequality):
///   `KL((1-α)*p + α*W_C || W_C) ≤ (1-α) * KL(p || W_C) + α * KL(W_C || W_C)`
///   `= (1-α) * V(p) + α * 0 = (1-α) * V(p) < V(p)` for p ≠ W_C.
///
/// Therefore V decreases strictly at each reseed step until p = W_C. ∎
///
/// ## The soft-regime constraint
///
/// The positive-cone constraint (`p0 ≥ p8`) is preserved by the reseed step:
///   - W_C has `p0 = p8 = 1/16` (balanced).
///   - The convex combination `(1-α)*p + α*W_C` has:
///     `p0_after = (1-α)*p0 + α*(1/16)`
///     `p8_after = (1-α)*p8 + α*(1/16)`
///   - If `p0 ≥ p8`, then `p0_after ≥ p8_after`. ∎
///
/// ## Connection to the Maxwell's demon
///
/// The `YinYangEnsemble.reseedLeastExperienced` function is the Maxwell's demon's
/// corrective step. This theorem proves it is thermodynamically sound: each reseed
/// strictly decreases the KL divergence from the MacWilliams fixed point, driving
/// the ensemble toward the entropic attractor (the self-dual code's weight distribution).
[<RequireQualifiedAccess>]
module LyapunovContraction =

    // ── The Lyapunov function ─────────────────────────────────────────────────────────────────────

    /// The orbit sizes for the [8,4] Adinkra code: 1 weight-0, 14 weight-4, 1 weight-8.
    let private orbitSizes = [| 1.0; 14.0; 1.0 |]

    /// The MacWilliams fixed point: uniform over codewords → p_k = 1/16 for all k.
    let macWilliamsFixedPoint = [| 1.0/16.0; 1.0/16.0; 1.0/16.0 |]

    /// **KL divergence from the MacWilliams fixed point:**
    ///   `V(p) = Σ_k n_k * p_k * log(p_k / w_k)`
    /// where `n_k` = orbit size, `w_k = 1/16` (W_C per-codeword mass).
    ///
    /// Returns 0.0 when p = W_C, and +∞ when any p_k = 0 (collapsed weight class).
    let lyapunov (p0: float) (p4: float) (p8: float) : float =
        let wc = 1.0 / 16.0
        let klTerm nk pk =
            if pk <= 1e-300 then infinity
            else nk * pk * log (pk / wc)
        klTerm 1.0 p0 + klTerm 14.0 p4 + klTerm 1.0 p8

    // ── The reseed step ───────────────────────────────────────────────────────────────────────────

    /// **One reseed step in the orbit-symmetric model:**
    ///
    /// Replace one cell's belief (weight class α) with the MacWilliams fixed point.
    /// In the orbit-symmetric model with N cells, this is:
    ///   `p_after = (1 - 1/N) * p_before + (1/N) * W_C`
    ///
    /// Returns `(p0_after, p4_after, p8_after)`.
    let reseedStep (n: int) (p0: float) (p4: float) (p8: float) : float * float * float =
        let alpha = 1.0 / float n
        let wc = 1.0 / 16.0
        let p0' = (1.0 - alpha) * p0 + alpha * wc
        let p4' = (1.0 - alpha) * p4 + alpha * wc
        let p8' = (1.0 - alpha) * p8 + alpha * wc
        (p0', p4', p8')

    // ── The contraction theorem ───────────────────────────────────────────────────────────────────

    /// **Verify the contraction property:**
    ///   `V(reseed(p)) ≤ (1 - 1/N) * V(p)`
    ///
    /// Returns `(vBefore, vAfter, contractionRatio)`.
    /// The contraction ratio should be ≤ `(1 - 1/N)` for all p ≠ W_C.
    let verifyContraction (n: int) (p0: float) (p4: float) (p8: float)
            : float * float * float =
        let vBefore = lyapunov p0 p4 p8
        let (p0', p4', p8') = reseedStep n p0 p4 p8
        let vAfter = lyapunov p0' p4' p8'
        let ratio = if vBefore < 1e-12 then 0.0 else vAfter / vBefore
        (vBefore, vAfter, ratio)

    /// **Verify the positive-cone preservation:**
    ///   If `p0 ≥ p8`, then `p0_after ≥ p8_after`.
    let verifyPositiveConePreservation (n: int) (p0: float) (p8: float) : bool =
        let (p0', _, p8') = reseedStep n p0 0.0 p8  // p4 doesn't matter for this check
        p0' >= p8' - 1e-9

    // ── The convergence rate ──────────────────────────────────────────────────────────────────────

    /// **Simulate N reseed steps and return the Lyapunov value at each step.**
    ///
    /// Demonstrates convergence to W_C (V → 0).
    let simulateConvergence
            (nCells: int)
            (steps: int)
            (p0Init: float) (p4Init: float) (p8Init: float)
            : float list =
        let rec loop step p0 p4 p8 acc =
            if step = 0 then List.rev acc
            else
                let v = lyapunov p0 p4 p8
                let (p0', p4', p8') = reseedStep nCells p0 p4 p8
                loop (step - 1) p0' p4' p8' (v :: acc)
        loop steps p0Init p4Init p8Init []

    /// **The theoretical convergence rate:**
    ///   After k reseed steps: `V_k ≤ (1 - 1/N)^k * V_0`
    ///
    /// Returns the theoretical upper bound on V after `k` steps.
    let theoreticalBound (nCells: int) (k: int) (v0: float) : float =
        v0 * ((1.0 - 1.0 / float nCells) ** float k)

    // ── The fixed-point characterization ─────────────────────────────────────────────────────────

    /// **The MacWilliams fixed point is the unique fixed point of the reseed dynamics:**
    ///   `reseed(W_C) = W_C`  (fixed point)
    ///   `V(W_C) = 0`         (global minimum of V)
    ///   `V(p) > 0` for `p ≠ W_C` (strict positivity)
    let verifyFixedPoint () : bool =
        let wc = 1.0 / 16.0
        let (p0', p4', p8') = reseedStep 16 wc wc wc
        let isFixed =
            abs (p0' - wc) < 1e-12 &&
            abs (p4' - wc) < 1e-12 &&
            abs (p8' - wc) < 1e-12
        let vAtFixed = lyapunov wc wc wc
        isFixed && abs vAtFixed < 1e-12

    /// **The Lyapunov function is strictly positive away from W_C:**
    ///   `V(p) > 0` for `p ≠ W_C`
    let verifyStrictPositivity (p0: float) (p4: float) (p8: float) : bool =
        let wc = 1.0 / 16.0
        let isAtFixed =
            abs (p0 - wc) < 1e-9 &&
            abs (p4 - wc) < 1e-9 &&
            abs (p8 - wc) < 1e-9
        let v = lyapunov p0 p4 p8
        if isAtFixed then abs v < 1e-9
        else v > 0.0
