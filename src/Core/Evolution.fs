namespace Zeta.Core

/// **Evolution — the 081KT7YW00008QG0R001DGZQKM DST harness for the privacy-as-anti-collapse claim.**
/// (`docs/FROZEN-CORE-AND-CONJECTURE-REGISTER.md` §B; the last open privacy item — an EXPERIMENT, not a
/// theorem.)
///
/// The claim under test (Aaron): a population with PRIVATE differentiation keeps evolving with no
/// external input, while a register-collapsed population (no private difference) halts. This module is
/// the deterministic (DST: same seed ⇒ identical orbit) harness; the experiment lives in Evolution.Tests.
///
/// One part IS a theorem — the **pigeonhole bound**: a deterministic `step` with no input, confined to a
/// FINITE state space, must eventually revisit a state (halt-or-cycle) within `|states|+1` steps. So
/// open-ended evolution REQUIRES effectively-unbounded (growing) state — which is exactly what private
/// differentiation supplies. The rest is demonstration: differentiation ⇒ unbounded novel growth (no
/// fixpoint, no revisit); collapse ⇒ fixpoint.
///
/// Honest scope: this provides EVIDENCE for the mechanism in a concrete model + the pigeonhole necessity
/// bound — it is NOT a universal proof that every system halts without privacy (that stays conjecture).
[<RequireQualifiedAccess>]
module Evolution =

    /// The deterministic orbit: `[seed; step seed; step² seed; …; stepⁿ seed]` (n+1 states). Pure in
    /// `(step, seed, n)` — replays identically from the seed (DST).
    let orbit (step: 'S -> 'S) (seed: 'S) (n: int) : 'S list =
        let rec go (s: 'S) (k: int) (acc: 'S list) =
            if k <= 0 then List.rev (s :: acc) else go (step s) (k - 1) (s :: acc)
        go seed n []

    /// Did the system reach a **fixpoint** (halt) within `n` steps — some state mapping to itself?
    let reachedFixpoint (step: 'S -> 'S) (seed: 'S) (n: int) : bool when 'S: equality =
        orbit step seed n |> List.pairwise |> List.exists (fun (a, b) -> a = b)

    /// Did the orbit **revisit** a state (halt-or-cycle: a fixpoint is the length-1 case of a revisit)?
    let revisits (states: 'S list) : bool when 'S: equality =
        (states |> List.distinct |> List.length) < List.length states

    /// The system **evolves** over `n` steps iff its orbit neither halts nor cycles — every state is new.
    /// (Requires effectively-unbounded state; see the pigeonhole bound.)
    let evolves (step: 'S -> 'S) (seed: 'S) (n: int) : bool when 'S: equality =
        not (revisits (orbit step seed n))
