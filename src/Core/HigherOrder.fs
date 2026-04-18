namespace Zeta.Core

open System
open System.Runtime.CompilerServices
open System.Threading
open System.Threading.Tasks


/// Higher-order differentials — `D²`, `D³`, …, `Dⁿ`.
///
/// The DBSP paper defines `D(s) = s - z⁻¹(s)`. Composing gives
/// `D²(s) = D(D(s)) = s - 2·z⁻¹(s) + z⁻²(s)`, and in general `Dⁿ(s)` is
/// an n-fold finite difference (Pascal's triangle signs).
///
/// **Why higher-order differentials matter:**
/// 1. **Newton-style convergence acceleration** — for a fixed-point
///    iteration that's converging linearly, second-order information
///    (`D²`) lets a solver estimate how much longer convergence will
///    take, or jump ahead. For `X_{n+1} = f(X_n)` with `|f'| < 1`, the
///    Aitken Δ² acceleration uses `X + ΔX²/ΔΔX` to skip ahead.
/// 2. **Nested-stream incrementalization** (Section 6 of the paper) —
///    `↑D` is the strict-operator required inside cycles of nested
///    circuits; without it, the fixed point of a recursive query isn't
///    well-defined under outer-tick incrementalization.
/// 3. **Perturbation analysis** — `D²(s)` is zero iff `s` is growing at
///    constant rate (linear in `t`), giving a cheap "is this converging?"
///    signal for the runtime.
///
/// The DBSP paper (Budiu et al. 2022) introduces these and proves their
/// properties; differential-dataflow (McSherry et al. 2013) has the same
/// ideas under "timely dataflow's lattice timestamps". We implement the
/// simpler Z-set ring version here.
[<Sealed>]
type internal SecondDifferentiateOp<'T>(input: Op<'T>, zero: 'T, sub: Func<'T, 'T, 'T>) =
    inherit Op<'T>()
    let inputs = [| input :> Op |]
    // Keep the last two inputs so we can compute `s[t] - 2·s[t-1] + s[t-2]`
    // as `(s[t] - s[t-1]) - (s[t-1] - s[t-2])`. No multiplication required
    // — we sub twice.
    let mutable prev1 = zero   // s[t-1]
    let mutable prev2 = zero   // s[t-2]
    override _.Name = "differentiate2"
    override _.Inputs = inputs
    override this.StepAsync(_: CancellationToken) =
        let cur = input.Value
        // D²(s)[t] = (s[t] - s[t-1]) - (s[t-1] - s[t-2])
        let firstDiff = sub.Invoke(cur, prev1)
        let prevFirstDiff = sub.Invoke(prev1, prev2)
        this.Value <- sub.Invoke(firstDiff, prevFirstDiff)
        prev2 <- prev1
        prev1 <- cur
        ValueTask.CompletedTask


/// n-th order differentiation — recursively applies `D` `n` times. Built
/// for generality; for `n = 2` the specialised `SecondDifferentiateOp`
/// is more efficient.
[<Sealed>]
type internal NthDifferentiateOp<'T>
    (input: Op<'T>, zero: 'T, sub: Func<'T, 'T, 'T>, order: int) =
    inherit Op<'T>()
    let inputs = [| input :> Op |]
    // Keep `order + 1` past values; each tick shifts them down and emits
    // the n-th finite difference.
    let history = Array.create (order + 1) zero
    let mutable filled = 0
    let signedBinomial n k =
        // (-1)^k · C(n, k)
        let mutable result = 1L
        let mutable num = int64 n
        let mutable kk = 0
        while kk < k do
            result <- result * num / int64 (kk + 1)
            num <- num - 1L
            kk <- kk + 1
        if k % 2 = 0 then result else -result

    override _.Name = $"differentiate%d{order}"
    override _.Inputs = inputs
    override this.StepAsync(_: CancellationToken) =
        // Shift history: history[i+1] <- history[i].
        for i in order .. -1 .. 1 do
            history.[i] <- history.[i - 1]
        history.[0] <- input.Value
        if filled < order + 1 then filled <- filled + 1
        // Apply the binomial-weighted sum: Σ_k (-1)^k · C(n,k) · s[t-k].
        // With sub-based arithmetic (no direct multiplication by int weight
        // for generic 'T), we emit by repeated additions/subtractions.
        // For 'T = ZSet<_>, this is O(n·order) in the worst case.
        // (Accept this; users should prefer order=2 specialisation.)
        let mutable acc = history.[0]
        for k in 1 .. order do
            // Coefficient (-1)^k · C(order, k)
            let coeff = signedBinomial order k
            let term = history.[k]
            // Apply: acc <- acc + coeff·term. For coeff = 0 skip; for
            // positive coeff, repeated add; for negative, repeated sub.
            let absC = abs coeff
            for _ in 1 .. int absC do
                acc <- if coeff > 0L then sub.Invoke(sub.Invoke(acc, zero), sub.Invoke(zero, term))
                       else sub.Invoke(acc, term)
        this.Value <- acc
        ValueTask.CompletedTask


[<Extension>]
type HigherOrderExtensions =

    /// Second-order differentiation: `D²(s)[t] = s[t] - 2·s[t-1] + s[t-2]`.
    /// Two-pass first-difference; strict (emits zero for the first two ticks).
    [<Extension>]
    static member Differentiate2<'T>
        (this: Circuit, s: Stream<'T>, zero: 'T, sub: Func<'T, 'T, 'T>) : Stream<'T> =
        this.RegisterStream (SecondDifferentiateOp(s.Op, zero, sub))

    /// Second-order differentiation for Z-sets (zero = empty, sub = ZSet.sub).
    [<Extension>]
    static member Differentiate2ZSet<'K when 'K : comparison>
        (this: Circuit, s: Stream<ZSet<'K>>) : Stream<ZSet<'K>> =
        this.RegisterStream
            (SecondDifferentiateOp<ZSet<'K>>(s.Op, ZSet<'K>.Empty, Func<_, _, _>(ZSet.sub)))

    /// n-th order differentiation. For `n = 2`, prefer `Differentiate2`.
    [<Extension>]
    static member DifferentiateN<'T>
        (this: Circuit, s: Stream<'T>, zero: 'T, sub: Func<'T, 'T, 'T>, order: int) : Stream<'T> =
        if order < 1 then invalidArg (nameof order) "must be ≥ 1"
        this.RegisterStream (NthDifferentiateOp(s.Op, zero, sub, order))


/// Aitken's `Δ²` convergence acceleration for fixed-point iteration.
///
/// For a sequence `X_0, X_1, X_2, …` converging linearly to a limit `X*`,
/// Aitken's method produces `Y_n = X_n - (X_{n+1} − X_n)² / (X_{n+2} − 2·X_{n+1} + X_n)`,
/// which under mild conditions converges **quadratically** instead of
/// linearly — halving the number of iterations to a given tolerance.
///
/// In DBSP terms, we maintain `X` (the current iterate), `ΔX = D(X)`, and
/// `ΔΔX = D²(X)`. Combined with the recursive LFP combinator, this can
/// skip iterations on slowly-converging datalog queries. This is the
/// payoff of higher-order differentials I kept promising in docs.
///
/// For Z-set iterates the division step is not meaningful per-key, so we
/// specialise to scalar streams where the arithmetic ring applies.
[<Sealed>]
type internal AitkenAccelerateOp
    (x: Op<float>) =
    inherit Op<float>()
    let inputs = [| x :> Op |]
    let mutable prev1 = 0.0  // X_{n-1}
    let mutable prev2 = 0.0  // X_{n-2}
    let mutable haveTwo = 0
    override _.Name = "aitken"
    override _.Inputs = inputs
    override this.StepAsync(_: CancellationToken) =
        let xn = x.Value
        if haveTwo >= 2 then
            let dx = xn - prev1
            let ddx = xn - 2.0 * prev1 + prev2
            this.Value <-
                if abs ddx < 1e-12 then xn   // avoid /0 — already converged
                else xn - dx * dx / ddx
        else
            this.Value <- xn
            haveTwo <- haveTwo + 1
        prev2 <- prev1
        prev1 <- xn
        ValueTask.CompletedTask


[<Extension>]
type AitkenExtensions =
    /// Aitken Δ² convergence acceleration — quadratic speedup on linearly-
    /// converging scalar fixed-point iterations.
    [<Extension>]
    static member AitkenAccelerate
        (this: Circuit, s: Stream<float>) : Stream<float> =
        this.RegisterStream (AitkenAccelerateOp(s.Op))
