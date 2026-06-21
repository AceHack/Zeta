namespace Zeta.Core

/// **ReflectionEngine — the yin-yang engine's two operating modes, distinguished only by the in/out
/// boundary (Aaron, 2026-06-05): self-reflection vs moving-forward.**
/// (`docs/FROZEN-CORE-AND-CONJECTURE-REGISTER.md` §B-converge; rides the proven 081KTAH8Q0008QG0R001YHSSA0
/// `ProbabilitySemiring` cell.)
///
/// One transition `step` is the **in → out boundary**: it `observe`s an input (in) and `emit`s the
/// current decision (out), updating the priors. It is **Markov by construction** — it depends only on
/// `(belief, observation)`, never on history (the "needs only itself + the current observation" property).
///
/// The two modes differ ONLY in where the observation comes from:
///   • **self-reflection** (`reflect`): the boundary is fed by a *deterministic seed* of observations
///     (no real I/O) — the agent thinks/learns internally; pure ⇒ replayable (DST), private.
///   • **moving forward** (`forward` = the same `step`): the observation arrives from *real I/O* at the
///     boundary — the agent acts, with real consequences.
///
/// Safety (the NCI at the engine level): self-reflection over **non-coercive** (fixed/conditionally-
/// independent) observations is **order-independent** — it converges to the same belief regardless of the
/// order evidence is reflected on (rides the proven `ProbabilitySemiring` NCI boundary). Coercion can
/// only enter at the moving-forward boundary, never in pure self-reflection.
[<RequireQualifiedAccess>]
module ReflectionEngine =

    /// An observation at the boundary: a per-candidate likelihood (exact rationals).
    type Observation = ProbabilitySemiring.Rational[]

    /// The engine state: the current belief (priors) over the candidate set (exact rationals).
    type Belief = ProbabilitySemiring.Rational[]

    /// The current decision = argmax of the belief (first index wins on a tie). The "emission" at the
    /// out-port.
    let decide (belief: Belief) : int =
        let mutable best = 0
        for i in 1 .. belief.Length - 1 do
            if ProbabilitySemiring.compare belief.[i] belief.[best] > 0 then best <- i
        best

    /// One transition (the in → out boundary step): observe an input, update the priors, emit the
    /// current decision. Markov — depends only on `(belief, obs)`.
    let step (belief: Belief) (obs: Observation) : Belief * int =
        let next = ProbabilitySemiring.observe obs belief
        next, decide next

    /// **Self-reflection.** Fold `step` over a deterministic seed of observations (boundary stubbed — no
    /// real I/O). Pure ⇒ replayable (DST). Returns the final belief + the emission trace.
    let reflect (belief: Belief) (seed: Observation list) : Belief * int list =
        let mutable cur = belief
        let emissions = ResizeArray<int>()
        for obs in seed do
            let next, emit = step cur obs
            cur <- next
            emissions.Add emit
        cur, List.ofSeq emissions

    /// **Moving forward.** The SAME transition as `step`, driven by a real observation arriving at the
    /// boundary (injected here; in deployment this is real I/O). Only the observation source differs from
    /// self-reflection.
    let forward (belief: Belief) (realObs: Observation) : Belief * int = step belief realObs
