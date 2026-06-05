namespace Zeta.Core

/// **Curve — rate (∂) and curvature (∂²) over the clock.** The "how-fast / how-bending" measurement
/// axis, the sibling of [[SoftValue]] (the "how-sure" axis) in the 6+2 measurement-axes hypothesis
/// (`docs/FROZEN-CORE-AND-CONJECTURE-REGISTER.md` §B, 6-vs-8 row).
///
/// A signal is a value sampled at consecutive clock ticks `0,1,…,n-1` (the tick = one `Versionstamp`
/// increment = one `z⁻¹` delay, per `Clock.fs`). Two operators, straight from DBSP (Budiu et al.):
///   - **`differentiate`** = `D = (1 − z⁻¹)`: `D s [t] = s[t] − s[t−1]` (with `s[−1] = 0`), the **rate**.
///   - **`integrate`**     = `I`: running prefix sum, the inverse of `D`.
/// **`curvature` = `D ∘ D`** (the second difference, ∂²) — how the rate itself is bending.
///
/// `D` and `I` are mutual inverses (DBSP Theorem 2.22 `I ∘ D = id`, machine-checked for the chain rule
/// in `tools/lean4/Lean4/DbspChainRule.lean`); proven here over `int64`. The signal value lives in any
/// abelian group, so this is faithful for any additive measure — e.g. `rate` of a `ByteCost` stream is
/// the context-cost *velocity*, `curvature` its acceleration (the cost curve `Clock.fs` was built for).
/// `int64` is the exact representative used for the proofs.
[<RequireQualifiedAccess>]
module Curve =

    /// **Differentiate** (`D = 1 − z⁻¹`): the per-tick rate of change. `out[0] = s[0]` (change from the
    /// implicit zero before the stream); `out[t] = s[t] − s[t−1]` for `t ≥ 1`.
    let differentiate (s: int64[]) : int64[] =
        Array.init s.Length (fun i -> if i = 0 then s.[0] else s.[i] - s.[i - 1])

    /// **Integrate** (`I`): the running prefix sum — the inverse of `differentiate`.
    let integrate (s: int64[]) : int64[] =
        let out = Array.zeroCreate s.Length
        let mutable acc = 0L
        for i in 0 .. s.Length - 1 do
            acc <- acc + s.[i]
            out.[i] <- acc
        out

    /// **Rate** (∂/∂tick) — alias for `differentiate`.
    let rate : int64[] -> int64[] = differentiate

    /// **Curvature** (∂²/∂tick²) — the rate of the rate (`D ∘ D`).
    let curvature (s: int64[]) : int64[] = differentiate (differentiate s)

    /// The total change over the whole signal = the last cumulative value of the rate (the discrete
    /// fundamental theorem of calculus: `I(D s)` recovers `s`, so its last entry is `s`'s last value).
    let totalChange (s: int64[]) : int64 =
        if s.Length = 0 then 0L else (integrate s).[s.Length - 1]
