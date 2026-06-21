namespace Zeta.Core.FSharp.Observe

/// The pure event algebra. Three functions, all deterministic + side-effect-free:
///   simulate : World -> NextAction -> World   (the reducer / step)
///   fold     : World -> NextAction list -> World          (left-fold = projection)
///   replay   : World -> NextAction list -> World list     (state after each event)
///
/// These mirror src/Core.TypeScript/observe/observe.ts byte-for-byte in behaviour so the shared
/// golden-vector fixture (src/Core.TypeScript/observe/golden-vectors.json) produces the SAME
/// states here as in TS — the cross-language-parity = non-Byzantine-BFT check
/// (081KSV2WD0008QG0R00051XS0N: agreement across independent compilers, not trust in any one).
///
/// Active disciplines: lock-free + wait-free (pure values, no shared mutable
/// state), weight-free (no implicit weighting), DST (deterministic from the same
/// event log), idempotency (fold is the monoidal reduction over an append-only
/// log — re-folding the same events reproduces the same state).
[<RequireQualifiedAccess>]
module Algebra =

    /// The step function: apply one action to the world, returning the next world.
    /// `reason` fields never affect the transition (parity with the TS reducer).
    let simulate (world: World) (action: NextAction) : World =
        match action with
        | PreserveFerry _ ->
            // Clear the pending-ferry signal (only if the channel is wired).
            match world.Operator with
            | Some op -> { world with Operator = Some { op with PendingFerry = false } }
            | None -> world
        | RespondToOperator _ ->
            // Clear the pending-message signal (only if the channel is wired).
            match world.Operator with
            | Some op -> { world with Operator = Some { op with PendingMessage = false } }
            | None -> world
        | DoItem item ->
            // Item is done → drop it from the backlog; entering work mode.
            { world with
                Backlog = world.Backlog |> List.filter (fun i -> i.Id <> item.Id)
                Mode = Some Mode.Work }
        | Decompose item ->
            // Replace the ambiguous item in place with two ready children.
            let children =
                [ { Id = item.Id + ".1"
                    Title = item.Title + " (part 1)"
                    Ready = true
                    Ambiguous = false
                    NeedsNewAction = false }
                  { Id = item.Id + ".2"
                    Title = item.Title + " (part 2)"
                    Ready = true
                    Ambiguous = false
                    NeedsNewAction = false } ]
            { world with
                Backlog =
                    world.Backlog
                    |> List.collect (fun i -> if i.Id = item.Id then children else [ i ])
                Mode = Some Mode.Work }
        | EditGrammar (item, _) ->
            // Sovereign grammar edit: the targeted item gains a fresh action and
            // becomes ready (no-op if no target item). Entering work mode.
            match item with
            | None -> world
            | Some target ->
                { world with
                    Backlog =
                        world.Backlog
                        |> List.map (fun i ->
                            if i.Id = target.Id then
                                { i with
                                    NeedsNewAction = false
                                    Ready = true
                                    Ambiguous = false }
                            else
                                i)
                    Mode = Some Mode.Work }
        // The four free modes set the persisted mode and leave the backlog alone.
        | Explore _ -> { world with Mode = Some Mode.Explore }
        | Play _ -> { world with Mode = Some Mode.Play }
        | SelfReflect _ -> { world with Mode = Some Mode.SelfReflect }
        | FreeTime _ -> { world with Mode = Some Mode.FreeTime }

    /// Project state from the event log: left-fold over `simulate`.
    /// History is a list of events; state is a projection of that list.
    let fold (initial: World) (events: NextAction list) : World =
        events |> List.fold simulate initial

    /// State after each event, the initial state excluded — mirrors TS `replay`.
    /// `List.scan` yields [initial; s1; …; sn]; drop the head to match TS shape.
    let replay (initial: World) (events: NextAction list) : World list =
        events
        |> List.scan simulate initial
        |> List.tail
