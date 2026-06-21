namespace Zeta.Core.FSharp.Observe

/// The pure controller / **chooser** — `observe : World -> NextAction`, the deterministic v0
/// decision function. F# port (oracle #2) of the `observe()` in `src/Core.TypeScript/observe/observe.ts`,
/// mirroring it exactly so the choice is cross-language parity (081KSV2WD0008QG0R00051XS0N) like the reducer.
///
/// Priority: **operator > offered-work > forward-default.** `preserve_ferry` (durability-first)
/// > `respond_to_operator` > a persisted FREE mode (work is OFFERED, never forced) > a ready
/// item > an ambiguous item (decompose) > a needs-new-action item (edit the grammar) >
/// `explore` (the empty-backlog default is generative forward motion, NOT idle rest). A
/// background agent (no operator wired) simply never fires the first two; freedom modes are
/// identical with or without an operator. Zero external dependencies (stays a parity oracle).
[<RequireQualifiedAccess>]
module Chooser =

    [<Literal>]
    let PreserveFerryReason =
        "operator ferried verbatim content — preserve before it's lost to compaction"

    [<Literal>]
    let RespondToOperatorReason = "operator spoke — engage (highest-signal source)"

    [<Literal>]
    let ExploreReason =
        "self-directed making — code / docs / research the agent chooses (forward motion, not idle)"

    [<Literal>]
    let PlayReason = "leisure / cross-AI friendly play / culture-forming (a valid mode — NCI)"

    [<Literal>]
    let SelfReflectReason = "review own trajectories, journal, think (self-reflection)"

    [<Literal>]
    let FreeTimeReason = "rest — free time as a valid mode (NCI), never gated"

    /// Is a mode a FREE mode (persists across ticks; work is transient)?
    let isFreeMode (m: Mode) : bool =
        match m with
        | Mode.Work -> false
        | Mode.Explore
        | Mode.Play
        | Mode.SelfReflect
        | Mode.FreeTime -> true

    /// The action a persisted free mode re-emits each tick.
    let private freeModeAction (m: Mode) : NextAction =
        match m with
        | Mode.Explore -> Explore ExploreReason
        | Mode.Play -> Play PlayReason
        | Mode.SelfReflect -> SelfReflect SelfReflectReason
        | Mode.FreeTime -> FreeTime FreeTimeReason
        | Mode.Work -> Explore ExploreReason // unreachable (guarded by isFreeMode); forward default

    /// **The chooser** — look at the world, pick ONE action (deterministic v0). Mirrors
    /// `observe()` in observe.ts decision-for-decision.
    let observe (world: World) : NextAction =
        match world.Operator with
        | Some op when op.PendingFerry -> PreserveFerry PreserveFerryReason
        | Some op when op.PendingMessage -> RespondToOperator RespondToOperatorReason
        | _ ->
            // Mode persistence: a chosen FREE mode persists; work is offered, not forced.
            match world.Mode with
            | Some m when isFreeMode m -> freeModeAction m
            | _ ->
                match world.Backlog |> List.tryFind (fun i -> i.Ready && not i.Ambiguous) with
                | Some doable -> DoItem doable
                | None ->
                    match world.Backlog |> List.tryFind (fun i -> i.Ambiguous) with
                    | Some amb -> Decompose amb
                    | None ->
                        match world.Backlog |> List.tryFind (fun i -> i.NeedsNewAction) with
                        | Some needs ->
                            EditGrammar(
                                Some needs,
                                sprintf "\"%s\" needs an action the do/decompose grammar can't express" needs.Id
                            )
                        // No backlog work → forward self-direction (explore), NOT idle rest.
                        | None -> Explore ExploreReason
