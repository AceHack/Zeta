namespace Zeta.Core

/// **`Salience` — observe.ts: where objectives come together, the agent chooses priority, and the window reduces to top-k (Aaron 2026-06-08, shadow*).**
///
/// Aaron: *"observe.ts is never the base buttons — it's the meta-level navigation, so it's simple for the agent.
/// observe.ts has access to the entire context window so it can decide what to display and reduce it down to top-k
/// most important to liveness, empowerment, uncertainty-reduction, etc… observe.ts is the place where different
/// objectives come together and the agent chooses priority, among other things."*
///
/// So observe.ts is the **objective-integration + display-reduction** point. Each context item (a solid-ground
/// fact, a lens, a `Traversal`, a map move, an anomaly) carries a **vector of per-objective relevances**
/// (`Objectives : objective → relevance`); the **agent chooses the priority** as a weight vector
/// (`priority : objective → weight`); the salience score is their dot product; the window reduces to the **top-k**
/// the agent then steers (a salience-filtered `MetaController` menu). **Liveness keeps display priority** —
/// liveness-critical items surface first regardless of score (subsumption, `ControlMerge`). The objective set is
/// **open** ("etc.", "among other things"): liveness, empowerment, uncertainty-reduction/solid-ground-gain, score,
/// and whatever future intrinsic ladders are added — they all come together here under the agent's chosen priority.
///
/// **Honest scope (peel):** the priority weights are *agent-chosen* (the point), not learned; score is a linear
/// (dot-product) integration, not a learned combiner. Liveness is a hard priority tier (boolean `LivenessCritical`)
/// — the strict "final say"; a graded survival-risk weight is a refinement. Deterministic (DST). Generalizes
/// `LensRouter` (top-k lenses) to rank *all* heterogeneous context items under an open objective set.
[<RequireQualifiedAccess>]
module Salience =

    /// A candidate context item with its per-objective relevances. `Payload` is what gets displayed/steered.
    type Item<'a> =
        { Payload: 'a
          /// Liveness-critical items always surface first (subsumption — liveness has final say).
          LivenessCritical: bool
          /// objective name → this item's relevance to that objective (the open objective set).
          Objectives: Map<string, float> }

    /// The salience score = ⟨priority, objectives⟩ (dot product). The agent's chosen `priority` weights integrate
    /// the open objective set; missing objectives score 0.
    let score (priority: Map<string, float>) (item: Item<'a>) : float =
        priority
        |> Map.toSeq
        |> Seq.sumBy (fun (obj, w) -> w * (Map.tryFind obj item.Objectives |> Option.defaultValue 0.0))

    /// **Display reduction:** the whole context → the top-`k` payloads to show the agent, under the agent's chosen
    /// `priority`. Liveness-critical items surface first (sorted among themselves by score), then the rest by
    /// score; truncated to `k`. This is what observe.ts decides to display — the simple curated menu.
    let display (k: int) (priority: Map<string, float>) (items: Item<'a> list) : 'a list =
        let scored = items |> List.map (fun it -> it, score priority it)
        let critical = scored |> List.filter (fst >> fun it -> it.LivenessCritical) |> List.sortByDescending snd
        let rest = scored |> List.filter (fst >> fun it -> not it.LivenessCritical) |> List.sortByDescending snd
        (critical @ rest) |> List.truncate (max 0 k) |> List.map (fun (it, _) -> it.Payload)

    /// The full ranked order (liveness-critical first, then by score), no truncation — diagnostics.
    let ranked (priority: Map<string, float>) (items: Item<'a> list) : 'a list =
        display System.Int32.MaxValue priority items
