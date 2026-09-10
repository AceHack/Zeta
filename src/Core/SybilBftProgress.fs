namespace Zeta.Core

/// Deterministic per-tick observations of the reference consensus reducer.
/// `fraction` is the leading component-vote count divided by the configured quorum,
/// or one after commitment. It is not a monotone rank or a liveness proof: a new
/// stream can bridge earlier components, conflicting votes can remove a component's
/// support, and view changes can reset observations. `isStalled` is a bounded
/// no-improvement heuristic, not a proof that eventual commitment is impossible.
module SybilBftProgress =

    open SybilBft
    open SybilBftLiveness

    /// A per-tick progress observation. Deterministic given the view (DST-replayable).
    type Progress<'v when 'v: comparison> =
        { Tick: Tick
          ViewNum: int
          /// Correlation components among currently heard votes.
          DistinctSources: int
          /// Largest unanimous component-vote count for any value.
          LeadingVotes: int
          /// The fixed `2f+1` quorum for the membership.
          Quorum: int
          Committed: 'v option }

    /// Observe the live view's progress at its current tick.
    let observe (lv: LiveView<'v>) : Progress<'v> =
        let votes = lv.Safety.Heard |> Map.toList |> List.map snd
        let t = tally lv.Safety.Threshold votes
        let leading =
            if Map.isEmpty t.VotesByValue then 0
            else t.VotesByValue |> Map.toList |> List.map snd |> List.max
        { Tick = lv.Now
          ViewNum = lv.ViewNum
          DistinctSources = t.DistinctSources
          LeadingVotes = leading
          Quorum = SybilBftProtocol.quorum lv.Safety
          Committed = committed lv }

    /// Progress fraction: one after commitment, otherwise `leadingVotes / quorum` capped at one
    /// (zero if quorum is nonpositive). Observed states have nonnegative counts; it may decrease
    /// within one view when the correlation graph or component vote agreement changes.
    let fraction (p: Progress<'v>) : float =
        match p.Committed with
        | Some _ -> 1.0
        | None -> if p.Quorum <= 0 then 0.0 else min 1.0 (float p.LeadingVotes / float p.Quorum)

    /// True once a decision is reached (terminal — idempotent, #6).
    let isDecided (p: Progress<'v>) : bool = Option.isSome p.Committed

    /// Bounded no-improvement indicator over a tick-ordered window. True iff the window is non-trivial, ends
    /// undecided, stays in ONE view (no view-change happened — a view-change is legitimate progress), and the
    /// leading-vote count never improved across it. (A flat fraction *with* a view-change is not a stall — the
    /// system is trying to recover.)
    let isStalled (window: Progress<'v> list) : bool =
        match window with
        | []
        | [ _ ] -> false
        | first :: _ ->
            let last = List.last window
            let sameView = window |> List.forall (fun p -> p.ViewNum = first.ViewNum)
            let noImprovement =
                (window |> List.map (fun p -> p.LeadingVotes) |> List.max) <= first.LeadingVotes
            Option.isNone last.Committed && sameView && noImprovement

    /// Convenience: observe progress, then advance the live view one sim tick (deliver `msgs`, then `onTick`).
    /// Returns the post-step view, the post-step progress observation, and any outbound messages. The per-tick
    /// driver you fold over a schedule to get a full progress trace.
    let stepObserve
        (lv: LiveView<'v>)
        (tick: Tick)
        (msgs: LiveMessage<'v> list)
        (selfClaim: int)
        (selfStream: int list)
        : LiveView<'v> * Progress<'v> * LiveMessage<'v> list =
        let mutable v = lv
        let out = ResizeArray<LiveMessage<'v>>()
        for m in msgs do
            let v', o = receive v m
            v <- v'
            out.AddRange o
        let v', tickOut = onTick v tick selfClaim selfStream
        out.AddRange tickOut
        v', observe v', List.ofSeq out

    /// Fold a tick schedule `(tick, messages)` into a **progress trace** — one `Progress` per sim tick, in
    /// order. This is "observe progress per sim tick" (Aaron): deterministic, replayable, watchable.
    let trace
        (lv0: LiveView<'v>)
        (selfClaim: int)
        (selfStream: int list)
        (schedule: (Tick * LiveMessage<'v> list) list)
        : Progress<'v> list =
        let mutable v = lv0
        [ for (tick, msgs) in schedule do
              let v', p, _ = stepObserve v tick msgs selfClaim selfStream
              v <- v'
              yield p ]
