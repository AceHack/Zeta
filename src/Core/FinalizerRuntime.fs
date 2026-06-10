namespace Zeta.Core

/// **FinalizerRuntime — drives the `Finalizer` tick loop over git + Reticulum.**
///
/// The finalizer (`Finalizer.fs`) is the uncertainty mason; this is the runtime that puts it to work over
/// the two real substrates:
///   • **git** — the **branch → merge-to-main → re-kick** recursion edge: `FinalizerAction.ReKick` triggers
///     a merge-to-main (the wave lands) and starts the next wave. (The git-as-event-store advance.)
///   • **Reticulum** — each tick's ledger is **exchanged between nodes** over `ReticulumLink` (the
///     commutative uncertainty ledger crosses the wire; order-free).
///
/// **Effect-injected ⇒ beautiful on 1, scales to N** (async-all-the-way / DST disciplines): the git side is
/// an injected `IRuntimeEffects` (deterministic in DST/test — replayable from a seed; real `git` + RNS in
/// prod), so the loop is a pure function of (effects, seed, medium). No raw I/O on the path; interface, no
/// class (treaty-room governance). Bounded by `budget` ⇒ always terminates (shape A; no fork-bomb).
///
/// Anchors: `Finalizer` (decide/run — the mason) · `ReticulumLink` (connect/send — the wire) · `Clock`
/// `Scheduler` (the DST clock) · git-as-event-store (ReKick = merge-to-main) · manifesto §1/§2/§7.
module FinalizerRuntime =

    open ReticulumLink

    /// The injected substrate effects (git side). `DeterministicEnv` in DST/test; real `git` in prod.
    type IRuntimeEffects =
        /// Produce tick `n`'s result from git/metrics state (ΔU, temperature, bounded, merged).
        abstract member ReadTick: int -> TickResult
        /// The ReKick git action: merge the current wave to main. Returns true if it merged (advance).
        abstract member MergeToMain: int -> bool

    /// One runtime step: the tick, its result, the finalizer's action, whether a git merge happened, and
    /// the node it ran at.
    type RuntimeStep =
        { Tick: int
          Result: TickResult
          Action: FinalizerAction
          Merged: bool
          AtNode: Destination }

    /// Drive the finalizer over git + Reticulum. `self`/`peer` are the two Reticulum destinations; each tick
    /// is exchanged over the link; `ReKick` triggers `MergeToMain` and (if merged) the next wave; `Stop`
    /// ends it. Bounded by `budget` ⇒ terminates. Deterministic given (effects, finalize, seed, medium) —
    /// the DST-replayable runtime. Returns the ordered step trace.
    let run
        (budget: int)
        (self: Destination)
        (peer: Destination)
        (effects: IRuntimeEffects)
        (finalize: TickResult -> FinalizerAction)
        (s0: Scheduler)
        (m0: Medium)
        : RuntimeStep list =
        let link = connect self peer (m0 |> announce self |> announce peer)
        let rec loop n (s: Scheduler) (m: Medium) acc =
            if n >= budget then List.rev acc
            else
                let r = effects.ReadTick n
                let action = finalize r
                // exchange the tick's ledger over Reticulum (commutative; order-free)
                let m1, s1 =
                    match link with
                    | Ok l -> send l.A l.B (sprintf "tick:%d" n) s m
                    | Error _ -> m, s
                match action with
                | FinalizerAction.Stop ->
                    List.rev ({ Tick = n; Result = r; Action = action; Merged = false; AtNode = self } :: acc)
                | FinalizerAction.ReKick ->
                    let merged = effects.MergeToMain n // git merge-to-main = the recursion edge
                    let step = { Tick = n; Result = r; Action = action; Merged = merged; AtNode = self }
                    if merged then loop (n + 1) s1 m1 (step :: acc) // the next wave
                    else List.rev (step :: acc)
                | _ -> loop (n + 1) s1 m1 ({ Tick = n; Result = r; Action = action; Merged = false; AtNode = self } :: acc)
        loop 0 s0 m0 []
