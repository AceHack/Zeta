namespace Zeta.Core

/// **`Orbit` — classify the standing solutions of a `t0=t∞` loop: fixed / time-crystal / time-quasicrystal
/// (Aaron 2026-06-08, shadow*).**
///
/// Aaron: *"if t0=t∞ there are standing waves like in the Casimir effect — those can be used"* … *"they are
/// standing in time, crystal space, quasicrystals frozen in time."* A closed timeline (periodic boundary in
/// time) supports a **spectrum of self-consistent solutions**, exactly as periodic *spatial* boundary
/// conditions do (Casimir: plates ⇒ discrete modes). This module classifies which one a dynamics sits on:
///
///   - **`Fixed`** (period 1, `s = step s`) — the stationary / DC (n=0) mode. This is what `Fixpoint` finds.
///   - **`Crystal n`** (period n > 1, `s = stepⁿ s`, but `s ≠ step s`) — a **standing wave in time** = a
///     **discrete time crystal**: a pattern that repeats every n loop-steps, the subharmonic of the drive.
///     (Wilczek 2012, *Quantum Time Crystals*; observed: Choi/Monroe 2017, Mi/Google 2021. The n≠0 Matsubara
///     mode of the `t0=t∞` circle.)
///   - **`Quasiperiodic`** (no period ≤ `maxPeriod`) — **ordered but aperiodic**: a **time quasicrystal**
///     (Penrose/Shechtman tilings in space; Fibonacci-driven topological time quasicrystals, Dumitrescu et al.
///     2022). This is the irrational-rotation / **2√2-aperiodic / no-tractable-lens** regime from earlier in the
///     arc — quasiperiodic is *not* random: it is aperiodic *order* (the distinction the `Fixpoint`
///     non-convergence test already showed).
///
/// **Casimir / Matsubara anchor:** periodic time quantizes the modes (`ω_n = 2πn/T`, the Matsubara frequencies);
/// these discrete temporal standing waves are the basis "that can be used" — a countable mode structure on the
/// loop, the resonant periods (cf. `resonantPeriod`, `PolarityFilter.dominantOrientation`).
///
/// **Honest scope (peel):** this detects period-`n` orbits **through `s0`** (energy/measure-preserving dynamics
/// — rotations, drives): for a *dissipative* system the orbit spirals to an attractor and never returns to `s0`,
/// so use `Fixpoint` (attractor) there, not this (orbit-through-start) — the two are complementary. And **a
/// periodic orbit is not *ipso facto* a time crystal**: the physics label requires *rigidity* (robustness to
/// perturbation, spontaneous time-translation-symmetry breaking), which this does not check — `Crystal n` here
/// means "period-n standing wave," the *candidate* for a time crystal, not a certified one. Quasiperiodic ≠
/// chaotic: this reports "no period found ≤ maxPeriod," which is aperiodicity, not a Lyapunov/chaos claim.
[<RequireQualifiedAccess>]
module Orbit =

    /// The kind of standing solution on the loop.
    type Kind =
        | Fixed // period 1 — the stationary (n=0) mode (Fixpoint)
        | Crystal of int // period n>1 — a standing wave in time (discrete-time-crystal candidate)
        | Quasiperiodic // no period ≤ maxPeriod — ordered-aperiodic (time-quasicrystal regime)
        | Chaotic of float // largest-Lyapunov estimate λ > 0 — sensitive dependence: the chaotic /
                           // positive-topological-entropy regime PAST the quasiperiodic edge (the
                           // homoclinic-tangle family). `classify` (period-only) cannot see this — a
                           // chaotic orbit has "no period ≤ maxPeriod" and would be mislabelled
                           // `Quasiperiodic`. `classifyDynamics` reaches it via `largestLyapunov`.

    /// The smallest period `n ∈ 1..maxPeriod` with `stepⁿ(s0) ≈ s0` (within `tol`), or `None` if none — the
    /// orbit through `s0` does not close in `maxPeriod` loop-steps (quasiperiodic / aperiodic).
    let period (dist: 'S -> 'S -> float) (step: 'S -> 'S) (tol: float) (maxPeriod: int) (s0: 'S) : int option =
        let mutable s = s0
        let mutable found = None
        let mutable k = 1
        while k <= max 1 maxPeriod && Option.isNone found do
            s <- step s
            if dist s s0 < tol then found <- Some k
            k <- k + 1
        found

    /// Classify the orbit through `s0`: `Fixed` (period 1) · `Crystal n` (period n>1, a time-crystal candidate)
    /// · `Quasiperiodic` (no period ≤ maxPeriod, the time-quasicrystal regime).
    let classify (dist: 'S -> 'S -> float) (step: 'S -> 'S) (tol: float) (maxPeriod: int) (s0: 'S) : Kind =
        match period dist step tol maxPeriod s0 with
        | Some 1 -> Fixed
        | Some n -> Crystal n
        | None -> Quasiperiodic

    /// Estimate the largest Lyapunov exponent λ by tracking how fast two nearby orbits diverge
    /// (Benettin et al. 1980). Over each short window: evolve the pair, take the log-stretch of their
    /// separation, then re-seed the perturbation with `nudge` at the current base point to stay in the
    /// linear regime. Average the per-step stretch over the windows.
    ///   λ > 0 ⇒ sensitive dependence — chaos / positive topological entropy (the homoclinic regime);
    ///   λ ≈ 0 ⇒ ordered (rotation / quasiperiodic);   λ < 0 ⇒ contracting onto an attractor.
    /// Honest scope: `nudge` supplies SOME small perturbation (need not lie along the unstable direction —
    /// the top exponent dominates within a few steps, which is why the windows are short and averaged).
    /// Needs only a metric `dist`, the map `step`, and `nudge` — NO tangent-space/vector structure on 'S —
    /// so it is an ESTIMATE, not a certified exponent. `windowLen` too long saturates it (the separation
    /// hits the attractor diameter and the log-stretch flattens): keep windows short.
    let largestLyapunov
        (dist: 'S -> 'S -> float) (step: 'S -> 'S) (nudge: 'S -> 'S)
        (windows: int) (windowLen: int) (s0: 'S) : float =
        let wlen = max 1 windowLen
        let mutable ax = s0
        let mutable sum = 0.0
        let mutable n = 0
        for _ in 1 .. max 1 windows do
            let mutable bx = nudge ax
            let d0 = dist ax bx
            if d0 > 0.0 then
                for _ in 1 .. wlen do
                    ax <- step ax
                    bx <- step bx
                let dN = dist ax bx
                if dN > 0.0 then
                    sum <- sum + log (dN / d0) / float wlen
                    n <- n + 1
            else
                ax <- step ax // degenerate nudge (d0 = 0): still advance the base orbit
        if n = 0 then 0.0 else sum / float n

    /// Classify including the chaotic class. Estimate λ first: if it exceeds `lyapTol` (> 0) the orbit is
    /// `Chaotic λ` — sensitive dependence, past the quasiperiodic edge; otherwise fall through to the
    /// period-based `classify` (Fixed / Crystal n / Quasiperiodic). This adds the fourth class `classify`
    /// alone cannot see (it would mislabel a chaotic, aperiodic orbit `Quasiperiodic`) — the exact
    /// Lyapunov measurement the module docstring flags as missing.
    let classifyDynamics
        (dist: 'S -> 'S -> float) (step: 'S -> 'S) (nudge: 'S -> 'S)
        (tol: float) (maxPeriod: int) (lyapTol: float) (windows: int) (windowLen: int) (s0: 'S) : Kind =
        let lam = largestLyapunov dist step nudge windows windowLen s0
        if lam > lyapTol then Chaotic lam
        else classify dist step tol maxPeriod s0

    /// Is this a (discrete) time-crystal candidate — a standing wave of period > 1? (Period found and > 1.)
    let isCrystal (dist: 'S -> 'S -> float) (step: 'S -> 'S) (tol: float) (maxPeriod: int) (s0: 'S) : bool =
        match classify dist step tol maxPeriod s0 with
        | Crystal _ -> true
        | _ -> false
