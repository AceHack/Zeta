namespace Zeta.Core

/// **BeliefConvergence — the general case of convergence-despite-reordering for Bayesian belief.**
/// (`docs/FROZEN-CORE-AND-CONJECTURE-REGISTER.md` §B; generalizes the [[SoftValue]] independent-evidence
/// proof.)
///
/// A belief is unnormalized non-negative weights over a fixed candidate set. A Bayesian **observe** with
/// a *fixed* likelihood (a per-candidate multiplier — the likelihood of the evidence under each
/// hypothesis) is **pointwise multiplication** into the belief; normalization is a deterministic final
/// step that does not change the *relative* distribution, so order-independence of the unnormalized
/// weights carries to the normalized posterior.
///
/// The general result (sharper than "independent evidence"): because pointwise multiplication is
/// **commutative and associative**, observe-with-fixed-likelihoods commutes and a fold over any
/// permutation of the evidence yields the same belief — convergence regardless of order — for ANY fixed
/// likelihoods, not merely independent ones. Independence was *sufficient*; the real condition is
/// fixed (state-independent) likelihoods.
///
/// The boundary (proven by counterexample): a **state-dependent / nonlinear** revision — where the update
/// depends on the current belief (e.g. `sharpen`, squaring the weights) — does NOT commute. So order
/// matters exactly when the update operator reads the belief it is updating; the multiplicative Bayesian
/// core does not. (SoftValue is the float instance of this multiplicative `observe`.)
[<RequireQualifiedAccess>]
module BeliefConvergence =

    /// **Bayesian observe** (fixed likelihood): pointwise-multiply the per-candidate likelihood into the
    /// belief. Unnormalized; the relative distribution is what the convergence claim is about.
    let observe (likelihood: int64[]) (belief: int64[]) : int64[] =
        Array.map2 (*) likelihood belief

    /// Fold a sequence of observations into a belief (left to right).
    let observeAll (evidence: int64[] list) (belief: int64[]) : int64[] =
        List.fold (fun b l -> observe l b) belief evidence

    /// Combine two likelihoods into one (pointwise) — the monoid product of evidence.
    let combine (l1: int64[]) (l2: int64[]) : int64[] =
        Array.map2 (*) l1 l2

    /// A **state-dependent / nonlinear** revision: square each weight (sharpen the belief toward its
    /// peak). Unlike `observe`, this reads the belief it transforms — and so does NOT commute with
    /// observe. Included to mark the boundary of order-independence.
    let sharpen (belief: int64[]) : int64[] =
        Array.map (fun w -> w * w) belief
