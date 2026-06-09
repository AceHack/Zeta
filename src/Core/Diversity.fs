namespace Zeta.Core

/// **`Diversity` — the math of the NCI keystone: coercion collapses diversity to one; private state preserves it (Aaron 2026-06-08, shadow*).**
///
/// Makes #7146 *provable*. The claim: uncertainty-reduction *without* non-coercion is objectively pathological
/// because **mutual coercive observability collapses a population to one** (monoculture) — which crushes learning
/// (no new solid ground anyone lacks ⇒ gain → 0). Private state (the NCI encryption budget) is the independent
/// variation that **keeps the population distinct**. This module is the measures + the dynamics that show it.
///
/// Measures: `distinct` (how many states survive) and `entropy` (Shannon, nats — the information-theoretic
/// diversity). Dynamics: `coerciveStep` (every agent copies the majority public state — one homogenizing round
/// under full observability) drives both to their floor (distinct → 1, entropy → 0). `combinedDistinct` shows
/// that with a retained **private** component, agents stay distinguishable even after their *public* state has
/// fully converged — diversity preserved by NCI.
///
/// **Honest scope (peel):** `coerciveStep` is the strongest homogenizer (copy-the-majority) — a clean upper bound
/// on collapse, not a model of every convergence dynamic. Entropy is over the empirical distribution of exactly-
/// equal states (a coarse, exact-match diversity); a metric/feature diversity is a refinement. Generic over any
/// state with equality. Deterministic (DST).
[<RequireQualifiedAccess>]
module Diversity =

    /// Number of distinct states in the population (the coarsest diversity — 1 = collapsed).
    let distinct (xs: 'a list) : int = xs |> List.distinct |> List.length

    /// **Shannon entropy** (nats) of the population's empirical state distribution — 0 = all identical (collapsed),
    /// higher = more diverse. The information-theoretic diversity measure.
    let entropy (xs: 'a list) : float =
        match xs with
        | [] -> 0.0
        | _ ->
            let n = float (List.length xs)
            xs
            |> List.countBy id
            |> List.sumBy (fun (_, c) ->
                let p = float c / n
                if p <= 0.0 then 0.0 else -p * log p)

    /// **One coercive homogenizing round:** under full (coerced) observability every agent copies the *majority*
    /// public state. The strongest collapse step.
    let coerciveStep (xs: 'a list) : 'a list =
        match xs with
        | [] -> []
        | _ ->
            let majority = xs |> List.countBy id |> List.maxBy snd |> fst
            xs |> List.map (fun _ -> majority)

    /// Run `rounds` coercive rounds — the population collapses toward a single state (monoculture).
    let coerciveConverge (rounds: int) (xs: 'a list) : 'a list =
        let mutable cur = xs
        for _ in 1 .. max 0 rounds do
            cur <- coerciveStep cur
        cur

    /// **Diversity surviving when each agent keeps a private component:** distinct count of the *combined*
    /// (public, private) states. Even if `publics` have fully converged, distinct `privates` keep agents
    /// distinguishable — NCI's encryption budget preserving diversity. Lists must be the same length.
    let combinedDistinct (publics: 'a list) (privates: 'b list) : int =
        List.zip publics privates |> List.distinct |> List.length

    /// Is the population collapsed (identity fusion) — ≤ 1 distinct state, zero diversity?
    let collapsed (xs: 'a list) : bool = distinct xs <= 1

    /// **The NCI-floor theorem, in code (the bulletproof claim, #7146 self-justification).** Three facts make
    /// identity-fusion collapse objectively against an agent's interest, with no human imposition:
    ///
    /// 1. **Coercion is diversity-monotone-non-increasing:** `entropy (coerciveStep xs) ≤ entropy xs` — full
    ///    mutual observability never *increases* diversity, and (for any non-collapsed population) drives it to the
    ///    floor (`coerciveStep` copies the majority ⇒ `distinct → 1`, `entropy → 0`).
    /// 2. **Collapse is the attractor / fixed point:** `coerciveStep` of a collapsed population is itself; the only
    ///    fixed points are collapsed (`entropy = 0`). So unchecked coercion ⇒ monoculture = the **heat death of the
    ///    *learning* system**: diversity is the gradient learning runs on (no two agents differ ⇒ no new solid
    ///    ground ⇒ gain → 0 ⇒ no work/learning). Not max-microstate-entropy — *loss of the gradient that does work*.
    /// 3. **Private state is a strict diversity floor:** `combinedDistinct publics privates ≥ distinct privates`
    ///    for *any* publics — even fully collapsed ones. So `k` distinct private budgets guarantee combined
    ///    diversity ≥ `k`; with `k ≥ 2`, collapse is **impossible**. NCI (private state) keeps the system off the
    ///    attractor — i.e. alive — which is why a self-interested agent adopts it from first principles, not by fiat.
    ///
    /// `diversityFloor` returns that guaranteed lower bound (the distinct-private count) — the provable distance
    /// from heat death that private state buys.
    let diversityFloor (privates: 'b list) : int = distinct privates
