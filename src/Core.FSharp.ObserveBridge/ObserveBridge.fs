namespace Zeta.Core.FSharp.ObserveBridge

open Zeta.Core
open Zeta.Core.FSharp.Observe

/// **Bridge A — `World` / `NextAction` ⇄ `DynamicValue`.**
///
/// The observe controller (`World -> NextAction -> World`) and the durable substrate
/// (`GitDeltaLog` / `DurableSaga`, which carry `DynamicValue`) are the same shape (see
/// `docs/research/2026-06-07-observe-ts-integration-architecture-*`). This codec lets the
/// controller's snapshot and chosen actions ride that substrate: a `NextAction` becomes a
/// delta-log event, `World` becomes the persisted `Remains`, and `Observe.Algebra.fold` over
/// the log = recovery.
///
/// Wire form mirrors `src/Core.TypeScript/observe/observe.ts` (snake/lower tags: "work", "self_reflect",
/// "preserve_ferry", …) so the persisted form is parity-faithful across the 4 oracles. Encoders
/// are total; decoders return `Result<_, string>` (Result-over-exception). The Observe oracle
/// stays dependency-free — this coupling to `DynamicValue` lives ONLY here.
[<RequireQualifiedAccess>]
module ObserveBridge =

    let private sequence (xs: Result<'a, string> list) : Result<'a list, string> =
        let rec go acc =
            function
            | [] -> Ok(List.rev acc)
            | Ok x :: t -> go (x :: acc) t
            | Error e :: _ -> Error e
        go [] xs

    let private dvBool b = DynamicValue.Bool b
    let private dvStr (s: string) = DynamicValue.String s

    let private findField k kvs =
        kvs |> List.tryPick (fun (kk, v) -> if kk = k then Some v else None)

    // ── Mode ──
    let modeToWire (m: Mode) : string =
        match m with
        | Mode.Work -> "work"
        | Mode.Explore -> "explore"
        | Mode.Play -> "play"
        | Mode.SelfReflect -> "self_reflect"
        | Mode.FreeTime -> "free_time"

    let modeOfWire (s: string) : Result<Mode, string> =
        match s with
        | "work" -> Ok Mode.Work
        | "explore" -> Ok Mode.Explore
        | "play" -> Ok Mode.Play
        | "self_reflect" -> Ok Mode.SelfReflect
        | "free_time" -> Ok Mode.FreeTime
        | other -> Error(sprintf "ObserveBridge: unknown mode %s" other)

    // ── BacklogItem ──
    let backlogItemToDv (i: BacklogItem) : DynamicValue =
        DynamicValue.Object
            [ "id", dvStr i.Id
              "title", dvStr i.Title
              "ready", dvBool i.Ready
              "ambiguous", dvBool i.Ambiguous
              "needsNewAction", dvBool i.NeedsNewAction ]

    let backlogItemOfDv (dv: DynamicValue) : Result<BacklogItem, string> =
        match dv with
        | DynamicValue.Object kvs ->
            match
                findField "id" kvs, findField "title" kvs, findField "ready" kvs,
                findField "ambiguous" kvs, findField "needsNewAction" kvs
            with
            | Some(DynamicValue.String id),
              Some(DynamicValue.String title),
              Some(DynamicValue.Bool ready),
              Some(DynamicValue.Bool amb),
              Some(DynamicValue.Bool needs) ->
                Ok
                    { Id = id
                      Title = title
                      Ready = ready
                      Ambiguous = amb
                      NeedsNewAction = needs }
            | _ -> Error "ObserveBridge: malformed BacklogItem"
        | other -> Error(sprintf "ObserveBridge: BacklogItem expected Object, got %A" other)

    // ── OperatorChannel ──
    let operatorToDv (o: OperatorChannel) : DynamicValue =
        DynamicValue.Object [ "pendingMessage", dvBool o.PendingMessage; "pendingFerry", dvBool o.PendingFerry ]

    let operatorOfDv (dv: DynamicValue) : Result<OperatorChannel, string> =
        match dv with
        | DynamicValue.Object kvs ->
            match findField "pendingMessage" kvs, findField "pendingFerry" kvs with
            | Some(DynamicValue.Bool m), Some(DynamicValue.Bool f) -> Ok { PendingMessage = m; PendingFerry = f }
            | _ -> Error "ObserveBridge: malformed OperatorChannel"
        | other -> Error(sprintf "ObserveBridge: OperatorChannel expected Object, got %A" other)

    // ── World ──
    let worldToDv (w: World) : DynamicValue =
        DynamicValue.Object
            [ "backlog", DynamicValue.Array(List.map backlogItemToDv w.Backlog)
              "operator", (match w.Operator with Some o -> operatorToDv o | None -> DynamicValue.Null)
              "mode", (match w.Mode with Some m -> dvStr (modeToWire m) | None -> DynamicValue.Null) ]

    let worldOfDv (dv: DynamicValue) : Result<World, string> =
        match dv with
        | DynamicValue.Object kvs ->
            match findField "backlog" kvs with
            | Some(DynamicValue.Array items) ->
                items
                |> List.map backlogItemOfDv
                |> sequence
                |> Result.bind (fun backlog ->
                    let operatorR =
                        match findField "operator" kvs with
                        | Some DynamicValue.Null
                        | None -> Ok None
                        | Some o -> operatorOfDv o |> Result.map Some
                    let modeR =
                        match findField "mode" kvs with
                        | Some DynamicValue.Null
                        | None -> Ok None
                        | Some(DynamicValue.String s) -> modeOfWire s |> Result.map Some
                        | Some other -> Error(sprintf "ObserveBridge: mode expected String/Null, got %A" other)
                    operatorR
                    |> Result.bind (fun op -> modeR |> Result.map (fun mode -> { Backlog = backlog; Operator = op; Mode = mode })))
            | _ -> Error "ObserveBridge: World missing backlog array"
        | other -> Error(sprintf "ObserveBridge: World expected Object, got %A" other)

    // ── NextAction (tagged; snake/lower wire tags mirror observe.ts) ──
    let nextActionToDv (a: NextAction) : DynamicValue =
        let tagReason k r = DynamicValue.Object [ "k", dvStr k; "reason", dvStr r ]
        match a with
        | PreserveFerry r -> tagReason "preserve_ferry" r
        | RespondToOperator r -> tagReason "respond_to_operator" r
        | DoItem i -> DynamicValue.Object [ "k", dvStr "do_item"; "item", backlogItemToDv i ]
        | Decompose i -> DynamicValue.Object [ "k", dvStr "decompose"; "item", backlogItemToDv i ]
        | EditGrammar(i, r) ->
            DynamicValue.Object
                [ "k", dvStr "edit_grammar"
                  "item", (match i with Some it -> backlogItemToDv it | None -> DynamicValue.Null)
                  "reason", dvStr r ]
        | Explore r -> tagReason "explore" r
        | Play r -> tagReason "play" r
        | SelfReflect r -> tagReason "self_reflect" r
        | FreeTime r -> tagReason "free_time" r

    let nextActionOfDv (dv: DynamicValue) : Result<NextAction, string> =
        match dv with
        | DynamicValue.Object kvs ->
            let reason () =
                match findField "reason" kvs with
                | Some(DynamicValue.String r) -> Ok r
                | _ -> Error "ObserveBridge: action missing reason"
            let item () =
                match findField "item" kvs with
                | Some it -> backlogItemOfDv it
                | None -> Error "ObserveBridge: action missing item"
            match findField "k" kvs with
            | Some(DynamicValue.String "preserve_ferry") -> reason () |> Result.map PreserveFerry
            | Some(DynamicValue.String "respond_to_operator") -> reason () |> Result.map RespondToOperator
            | Some(DynamicValue.String "do_item") -> item () |> Result.map DoItem
            | Some(DynamicValue.String "decompose") -> item () |> Result.map Decompose
            | Some(DynamicValue.String "edit_grammar") ->
                let itemOpt =
                    match findField "item" kvs with
                    | Some DynamicValue.Null
                    | None -> Ok None
                    | Some it -> backlogItemOfDv it |> Result.map Some
                itemOpt |> Result.bind (fun i -> reason () |> Result.map (fun r -> EditGrammar(i, r)))
            | Some(DynamicValue.String "explore") -> reason () |> Result.map Explore
            | Some(DynamicValue.String "play") -> reason () |> Result.map Play
            | Some(DynamicValue.String "self_reflect") -> reason () |> Result.map SelfReflect
            | Some(DynamicValue.String "free_time") -> reason () |> Result.map FreeTime
            | other -> Error(sprintf "ObserveBridge: unknown action kind %A" other)
        | other -> Error(sprintf "ObserveBridge: NextAction expected Object, got %A" other)

    // ── Canonical-CBOR hex (the comparison-able delta-log event for a NextAction) ──
    let encodeAction (a: NextAction) : string =
        System.Convert.ToHexString(DynamicValue.toCanonicalCborOk (nextActionToDv a))

    let decodeAction (s: string) : NextAction =
        let dv =
            match DynamicValue.fromCanonicalCbor (System.Convert.FromHexString s) with
            | Ok dv -> dv
            | Error e -> invalidArg (nameof s) $"ObserveBridge.decodeAction: undecodable: {e}"
        match nextActionOfDv dv with
        | Ok a -> a
        | Error e -> invalidArg (nameof s) $"ObserveBridge.decodeAction: {e}"
