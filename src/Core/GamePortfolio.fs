namespace Zeta.Core

/// **`GamePortfolio` — good emerges from entropy; entropy depends on the SET of games + time-in-each, NOT the order (Aaron 2026-06-08, shadow*).**
///
/// Aaron: *"good is subjectively defined by the **entropy in the system**, which itself is based on the **games you
/// decide to play**… the order does **not** matter because **uncertainty-reduction is commutative** (we proved
/// this) — it's the **set of games** that matter, and the **length of time in each game**."*
///
/// So the system's entropy (the source from which good emerges, #7146–#7150) is a function of an **order-free
/// weighted set**: which games, and how long played each. **Order-independence is exactly the commutativity of
/// `SoftValue.observe`** (independent-evidence Bayesian updates commute — posterior ∝ prior·L₁·L₂ and
/// multiplication commutes). A game played *longer* contributes *more* of its experiences (duration weights it);
/// a *diverse set* (played enough) → high entropy → rich emergent good; a narrow set → low entropy → overfit.
///
/// Game-selection objective (unsubjective, like solid-ground gain for lenses, one level up): **`marginalEntropy`**
/// — how much new entropy adding a game (for a duration) brings; **`selectNext`** picks the entropy-maximizing
/// one. The system chooses *what* to experience and *how long* to enrich its good — order doesn't matter.
///
/// **Honest scope (peel):** a game's contribution = the experiences it exposes; **duration** weights them
/// (modelled as repetition in the experience multiset → entropy over the duration-weighted distribution).
/// Order-independence holds because entropy is over a *multiset* (a commutative aggregate) — the `SoftValue.observe`
/// commutativity made concrete. Shannon over exact-match experiences (coarse). Generic over experience (equality).
/// Deterministic (DST). Builds on `Diversity` (#7147).
[<RequireQualifiedAccess>]
module GamePortfolio =

    /// A game = its name + the experiences it exposes + the **`SufficientLength`**: the duration needed to reduce
    /// its uncertainty *sufficiently* (play it to convergence / fully extract its entropy). Order-independence
    /// (commutativity) holds **only for games played to ≥ this length**; an under-played game leaves an
    /// order-sensitive residual (Aaron 2026-06-08).
    type Game<'exp> = { Name: string; Experiences: 'exp list; SufficientLength: int }

    /// Has this game been played to sufficient length (its uncertainty sufficiently reduced)?
    let isSufficient (duration: int) (g: Game<'exp>) : bool = duration >= g.SufficientLength

    /// **Are we in the commutative (order-independent) regime?** True iff *every* game in the schedule was played
    /// to sufficient length — then order doesn't matter (the `SoftValue.observe` commutativity applies, entropy is
    /// the order-free multiset). If any game is under-played, **order matters** for that residual (a path-dependent
    /// model deferred). Aaron: *"order only matters for games you have not played to sufficient length."*
    let commutativeRegime (schedule: (Game<'exp> * int) list) : bool =
        schedule |> List.forall (fun (g, d) -> isSufficient d g)

    /// A schedule = an **order-free** set of games each with a **duration** (time-in-game). Order does not matter
    /// (commutative) once each is played to sufficient length; only the set and the per-game durations do.
    type Schedule<'exp> = (Game<'exp> * int) list

    /// The duration-weighted experience multiset: each game's experiences repeated `duration` times (more time ⇒
    /// more weight). Order-independent (a multiset).
    let weightedExperiences (schedule: Schedule<'exp>) : 'exp list =
        [ for (g, d) in schedule do
              for _ in 1 .. max 0 d do
                  yield! g.Experiences ]

    /// The system's **entropy** from a schedule (Shannon, nats) — the source from which good emerges. A function
    /// of the *set* of games and the *time in each*, **independent of order** (commutativity of `SoftValue.observe`).
    let entropy (schedule: Schedule<'exp>) : float = weightedExperiences schedule |> Diversity.entropy

    /// Distinct experiences across the schedule (breadth of what's been played; duration-independent).
    let distinctExperiences (schedule: Schedule<'exp>) : int =
        schedule |> List.collect (fun (g, _) -> g.Experiences) |> Diversity.distinct

    /// **Marginal entropy** of adding a game for `duration` to the current schedule — the game-selection signal
    /// (value of playing it that long). Novel games add a lot; redundant ones add ~0.
    let marginalEntropy (candidate: Game<'exp>) (duration: int) (current: Schedule<'exp>) : float =
        entropy (current @ [ candidate, duration ]) - entropy current

    /// **Select the next game** to play (each for `duration`) — the candidate adding the most entropy. `None` if
    /// no candidates. The system choosing what to experience to enrich its emergent good.
    let selectNext (duration: int) (candidates: Game<'exp> list) (current: Schedule<'exp>) : Game<'exp> option =
        match candidates with
        | [] -> None
        | _ -> candidates |> List.maxBy (fun g -> marginalEntropy g duration current) |> Some
