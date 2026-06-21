namespace Zeta.Core

/// **ProbabilitySemiring — the exact-rational probability `(+,×)` and Viterbi `(max,×)` semirings,
/// and HMM/Markov inference as a matrix-vector product over them (081KTAH8Q0008QG0R001YHSSA0, the NCI discharge piece 2).**
/// (`docs/FROZEN-CORE-AND-CONJECTURE-REGISTER.md` §B-converge — the Non-Coercion Invariant.)
///
/// Homeostat ≈ Markov: both iterate one operator to a fixed point (closed-semiring family, Lehmann 1977).
/// The homeostat is the *idempotent* corner; the Markov chain the *probability* corner. This module is the
/// probability + Viterbi corners, built over an **exact rational ℚ** so the results **byte-lock and 4-lang**
/// — floats (continuous θ, mixing rate) are out of the proof lineage (the SoftValue discipline). The
/// `(+,×)` forward step = a Markov/HMM-forward transition; the `(max,×)` Viterbi step = the best-path score.
///
/// Honest interface note: the existing `ISemiring` is really a *Ring* (it mandates `Negate`). ℚ is a field,
/// so the probability semiring is a genuine ring; the Viterbi `(max,×)` semiring is idempotent and has **no**
/// additive inverse, so it is honestly NOT a ring — these are kept as plain operations here rather than faking
/// a `Negate`. (Wiring ℚ-probability into `ISemiring` is a follow-up nicety; the load-bearing thing is the
/// exact arithmetic + the cross-language agreement.)
[<RequireQualifiedAccess>]
module ProbabilitySemiring =

    /// An exact rational `Num / Den` in lowest terms with `Den > 0` (so equality is structural and the
    /// values byte-lock across languages). Construct via `rat`/`ofInt`; never build the record directly.
    type Rational = { Num: int64; Den: int64 }

    let rec private gcd (a: int64) (b: int64) : int64 = if b = 0L then a else gcd b (a % b)

    /// Construct a normalized rational (lowest terms, positive denominator). `den = 0` is invalid.
    let rat (num: int64) (den: int64) : Rational =
        if den = 0L then invalidArg (nameof den) "rational denominator is zero"
        // `abs Int64.MinValue` throws OverflowException; the sign-normalisation `-MinValue` overflows too.
        // MinValue is not a real numerator/denominator in this exact-probability domain — reject it
        // (Lior audit 2026-06-06).
        if num = System.Int64.MinValue || den = System.Int64.MinValue then
            invalidArg (nameof num) "Int64.MinValue not representable in an exact rational"
        let s = if den < 0L then -1L else 1L
        let n = s * num
        let d = s * den
        let g = gcd (abs n) d
        let g = if g = 0L then 1L else g
        { Num = n / g; Den = d / g }

    /// The rational `n / 1`.
    let ofInt (n: int64) : Rational = { Num = n; Den = 1L }

    /// Additive identity `0/1`.
    let zero : Rational = { Num = 0L; Den = 1L }
    /// Multiplicative identity `1/1`.
    let one : Rational = { Num = 1L; Den = 1L }

    /// Exact addition (⊕ of the probability semiring).
    let add (a: Rational) (b: Rational) : Rational = rat (a.Num * b.Den + b.Num * a.Den) (a.Den * b.Den)

    /// Exact multiplication (⊗ of both the probability and Viterbi semirings).
    let mul (a: Rational) (b: Rational) : Rational = rat (a.Num * b.Num) (a.Den * b.Den)

    /// Sign of `a - b` as -1 / 0 / +1 (denominators are positive after normalization).
    let compare (a: Rational) (b: Rational) : int = sign (a.Num * b.Den - b.Num * a.Den)

    /// Exact maximum (⊕ of the Viterbi semiring — the idempotent corner).
    let max (a: Rational) (b: Rational) : Rational = if compare a b >= 0 then a else b

    /// Exact reciprocal `1/a` (ℚ is a field). `a = 0` is invalid.
    let recip (a: Rational) : Rational =
        if a.Num = 0L then invalidArg (nameof a) "reciprocal of zero" else rat a.Den a.Num

    /// Exact division `a / b` (`b = 0` is invalid). Used by the relative-observer reconciliation
    /// (a 3-way merge divides out the common ancestor).
    let div (a: Rational) (b: Rational) : Rational = mul a (recip b)

    // ── Inference as a matrix-vector product over the chosen semiring ──
    // A distribution is a row vector `π` (length n); a transition is a matrix `P` (n×n), `P.[i].[j]` =
    // weight from state i to state j. One step is `π'(j) = ⊕_i ( π(i) ⊗ P(i,j) )`.

    /// One **forward** step over the probability semiring `(+,×)`: `π'(j) = Σ_i π(i)·P(i,j)`.
    /// This is the Markov/HMM-forward transition (no emission factor — that layers on top).
    let forwardStep (pi: Rational[]) (p: Rational[][]) : Rational[] =
        let n = p.Length
        [| for j in 0 .. n - 1 ->
             let mutable acc = zero
             for i in 0 .. pi.Length - 1 do
                 acc <- add acc (mul pi.[i] p.[i].[j])
             acc |]

    /// One **Viterbi** step over `(max,×)`: `v'(j) = max_i v(i)·P(i,j)` — the best single-path score.
    let viterbiStep (v: Rational[]) (p: Rational[][]) : Rational[] =
        let n = p.Length
        [| for j in 0 .. n - 1 ->
             let mutable acc = zero
             for i in 0 .. v.Length - 1 do
                 acc <- max acc (mul v.[i] p.[i].[j])
             acc |]

    /// Run `steps` forward steps (probability semiring).
    let forward (pi: Rational[]) (p: Rational[][]) (steps: int) : Rational[] =
        let mutable cur = pi
        for _ in 1 .. steps do cur <- forwardStep cur p
        cur

    /// Run `steps` Viterbi steps (max-times semiring).
    let viterbi (v: Rational[]) (p: Rational[][]) (steps: int) : Rational[] =
        let mutable cur = v
        for _ in 1 .. steps do cur <- viterbiStep cur p
        cur

    // ── The NCI boundary on the exact-rational cell (the rational sibling of `BeliefConvergence`) ──
    // A belief is unnormalized non-negative rational weights over a fixed candidate set. A Bayesian
    // `observe` with a FIXED (state-independent) likelihood is pointwise multiplication — non-coercive:
    // it does not read the belief it updates. Multiplication commutes+associates, so observing a SET of
    // evidence is order-independent (the NCI / de Finetti exchangeability boundary). The boundary is
    // crossed by a STATE-DEPENDENT revision (`sharpen`, which reads the belief) — coercive, order-matters.

    /// **Bayesian observe (fixed likelihood)** — pointwise-multiply the per-candidate likelihood into the
    /// belief. Non-coercive: the update does not depend on the belief it transforms. Exact (rational).
    let observe (likelihood: Rational[]) (belief: Rational[]) : Rational[] =
        Array.map2 mul likelihood belief

    /// Fold a sequence of observations into a belief (left to right).
    let observeAll (evidence: Rational[] list) (belief: Rational[]) : Rational[] =
        List.fold (fun b l -> observe l b) belief evidence

    /// A **state-dependent / coercive** revision: square each weight (it READS the belief it transforms).
    /// Marks the boundary — unlike `observe`, this does NOT commute with `observe`. (The `sharpen`
    /// counterexample, over rationals.)
    let sharpen (belief: Rational[]) : Rational[] =
        Array.map (fun w -> mul w w) belief
