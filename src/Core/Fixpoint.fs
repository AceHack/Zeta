namespace Zeta.Core

/// **`Fixpoint` — the `t0 = t∞` self-consistency solver (Aaron 2026-06-08, shadow*).**
///
/// Aaron: *"the state is fixed by both a past and a future boundary condition — yes, because t0 = t∞ in my
/// system."* Closing the timeline into a loop makes the past BC and the future BC the **same** condition: not an
/// externally-imposed future state, but the demand that **once-around evolution returns the state to itself** —
/// `s = step(s)`. This module finds that self-consistent state.
///
/// **Anchors (this is standard, not exotic):**
///   - **Banach fixed-point theorem** — a contraction has a unique fixed point, reached by iteration.
///   - **Deutsch CTC (D-CTC)** — a closed timelike curve is resolved by a self-consistent density matrix
///     `ρ = 𝒩(ρ)`; this is the discrete analog. (Caveat carried in `SoftEmu`/`FeedbackThrottle` docs:
///     self-consistent loops can be *nonlinear* and overshoot quantum — closure does not by itself name 2√2.)
///   - **Matsubara / KMS** — finite-temperature QFT puts time on a *circle* (`t0 = t_β`); `Z = Tr(e^{−βH})` is
///     the closed-time-loop trace. "Time is a circle" is literal thermal physics.
///   - **CRDT convergence / idempotency** — `f(f(x)) = f(x)` reaches its fixed point in one step; a convergent
///     replicated state is exactly a `t0=t∞` self-consistent loop. So this is the convergence machinery we
///     already build on, read as closed time (see `dv2-data-split-discipline-activated.md` #6).
///
/// **Honest scope (peel):** generic over the state `'S`, the once-around `step`, and a `dist`ance — it does NOT
/// assume a contraction, so it **detects non-convergence** (a rotation by an irrational fraction of 2π never
/// settles — the aperiodic / no-tractable-lens case) and reports `Converged = false` rather than looping forever
/// or fabricating a fixed point. Finding the fixed point ≠ the fixed point being physical; that is the caller's
/// constraint (e.g. the IC throttle that picks 2√2). DST-deterministic (no clock / no RNG of its own).
[<RequireQualifiedAccess>]
module Fixpoint =

    /// The outcome of a self-consistency search: the (last) state, whether it converged within `tol`, the
    /// residual `dist(prev, state)` at stop, and the iteration count.
    type FixResult<'S> =
        { State: 'S
          Converged: bool
          Residual: float
          Iterations: int }

    /// **Solve `s = step(s)`** by iterating from `s0` until the once-around residual `dist(prev, cur) < tol`, or
    /// `maxIter` is hit. Convergence ⇒ the `t0=t∞` self-consistent loop state. Non-convergence (residual stays
    /// ≥ tol) is reported, not hidden (`Converged = false`) — the loop has no settled fixed point in this metric.
    let solve (dist: 'S -> 'S -> float) (step: 'S -> 'S) (tol: float) (maxIter: int) (s0: 'S) : FixResult<'S> =
        let mutable cur = s0
        let mutable residual = infinity
        let mutable i = 0
        let mutable converged = false
        while i < max 1 maxIter && not converged do
            let next = step cur
            residual <- dist cur next
            cur <- next
            i <- i + 1
            if residual < tol then converged <- true
        { State = cur; Converged = converged; Residual = residual; Iterations = i }

    /// Is `s` already self-consistent (a fixed point of `step` within `tol`)? — `t0=t∞` holds at `s`.
    let isFixed (dist: 'S -> 'S -> float) (step: 'S -> 'S) (tol: float) (s: 'S) : bool =
        dist s (step s) < tol

    /// Convenience for `float`-valued loops (e.g. a scalar self-consistency / mean-field gap equation).
    let solveFloat (step: float -> float) (tol: float) (maxIter: int) (s0: float) : FixResult<float> =
        solve (fun a b -> abs (a - b)) step tol maxIter s0
