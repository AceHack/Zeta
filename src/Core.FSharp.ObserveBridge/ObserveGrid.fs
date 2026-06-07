namespace Zeta.Core.FSharp.ObserveBridge

open Zeta.Core
open Zeta.Core.FSharp.Observe

/// **Bridge C — `NextAction` projected onto the 4×4 universal action grammar (`ActionGrid`).**
///
/// Design call C1 (maintainer, 2026-06-07): **fixed home cell per kind** — the Xbox-controller
/// layout. The grid *geometry* is fixed (navigation is a pure function of position —
/// label-independence is proven in `ActionGrid`); each tick the *World* projects which cells are
/// **live** and what they mean (the labels). An action always lives at the same cell (muscle
/// memory); `EditGrammar` relabels. Layout (row = chooser priority class; free modes fill row 2):
///
/// ```
///        col0            col1             col2          col3
/// row0  preserve_ferry  respond_operator  ·            ·        (channel)
/// row1  do_item         decompose         edit_grammar  ·        (work)
/// row2  explore         play              self_reflect  free_time(free)
/// row3  ·               ·                 ·             ·        (reserved: summon-BFT, KPI…)
/// ```
[<RequireQualifiedAccess>]
module ObserveGrid =

    let private pos r c : ActionGrid.Position = { Row = r; Col = c }

    /// The fixed home cell for an action kind (the C1 layout). `None` = not a grammar kind.
    let homeOfKind (kind: string) : ActionGrid.Position option =
        match kind with
        | "preserve_ferry" -> Some(pos 0 0)
        | "respond_to_operator" -> Some(pos 0 1)
        | "do_item" -> Some(pos 1 0)
        | "decompose" -> Some(pos 1 1)
        | "edit_grammar" -> Some(pos 1 2)
        | "explore" -> Some(pos 2 0)
        | "play" -> Some(pos 2 1)
        | "self_reflect" -> Some(pos 2 2)
        | "free_time" -> Some(pos 2 3)
        | _ -> None

    /// The snake/lower kind tag of an action (matches the observe.ts wire form).
    let kindOf (a: NextAction) : string =
        match a with
        | PreserveFerry _ -> "preserve_ferry"
        | RespondToOperator _ -> "respond_to_operator"
        | DoItem _ -> "do_item"
        | Decompose _ -> "decompose"
        | EditGrammar _ -> "edit_grammar"
        | Explore _ -> "explore"
        | Play _ -> "play"
        | SelfReflect _ -> "self_reflect"
        | FreeTime _ -> "free_time"

    /// The fixed home cell for an action value.
    let homeCell (a: NextAction) : ActionGrid.Position =
        match homeOfKind (kindOf a) with
        | Some p -> p
        | None -> pos 3 3 // unreachable for the nine kinds

    // ── availability per kind (mirrors observe.ts buildMenu predicates) ──
    let private hasReady (w: World) = w.Backlog |> List.exists (fun i -> i.Ready && not i.Ambiguous)
    let private hasAmbiguous (w: World) = w.Backlog |> List.exists (fun i -> i.Ambiguous)
    let private hasNeeds (w: World) = w.Backlog |> List.exists (fun i -> i.NeedsNewAction)
    let private opFerry (w: World) = match w.Operator with Some o -> o.PendingFerry | None -> false
    let private opMsg (w: World) = match w.Operator with Some o -> o.PendingMessage | None -> false

    /// Is the action at a home cell **live** this tick? (Free modes are always in the menu.)
    let available (w: World) (kind: string) : bool =
        match kind with
        | "preserve_ferry" -> opFerry w
        | "respond_to_operator" -> opMsg w
        | "do_item" -> hasReady w
        | "decompose" -> hasAmbiguous w
        | "edit_grammar" -> hasNeeds w
        | "explore"
        | "play"
        | "self_reflect"
        | "free_time" -> true
        | _ -> false

    let private allKinds =
        [ "preserve_ferry"; "respond_to_operator"; "do_item"; "decompose"; "edit_grammar"; "explore"; "play"; "self_reflect"; "free_time" ]

    /// **Project** the World onto the 4×4 content layer: each home cell labeled
    /// `{ kind; available }` (an `ActionGrid.World = Map<Position, DynamicValue>`). Reserved cells
    /// stay unlabeled. This is the only place World state enters the grid — navigation never does.
    let project (w: World) : ActionGrid.World =
        allKinds
        |> List.choose (fun k ->
            homeOfKind k
            |> Option.map (fun p ->
                p, DynamicValue.Object [ "kind", DynamicValue.String k; "available", DynamicValue.Bool(available w k) ]))
        |> Map.ofList

    /// **Select a cell → the action it emits this tick**, if live. `do_item`/`decompose`/
    /// `edit_grammar` resolve to the FIRST matching backlog item (mirrors the chooser); free
    /// modes carry their canonical reason. `None` = the cell is dead/reserved this tick.
    let actionAt (p: ActionGrid.Position) (w: World) : NextAction option =
        match p.Row, p.Col with
        | 0, 0 when opFerry w -> Some(PreserveFerry Chooser.PreserveFerryReason)
        | 0, 1 when opMsg w -> Some(RespondToOperator Chooser.RespondToOperatorReason)
        | 1, 0 -> w.Backlog |> List.tryFind (fun i -> i.Ready && not i.Ambiguous) |> Option.map DoItem
        | 1, 1 -> w.Backlog |> List.tryFind (fun i -> i.Ambiguous) |> Option.map Decompose
        | 1, 2 ->
            w.Backlog
            |> List.tryFind (fun i -> i.NeedsNewAction)
            |> Option.map (fun i -> EditGrammar(Some i, sprintf "\"%s\" needs an action the do/decompose grammar can't express" i.Id))
        | 2, 0 -> Some(Explore Chooser.ExploreReason)
        | 2, 1 -> Some(Play Chooser.PlayReason)
        | 2, 2 -> Some(SelfReflect Chooser.SelfReflectReason)
        | 2, 3 -> Some(FreeTime Chooser.FreeTimeReason)
        | _ -> None
