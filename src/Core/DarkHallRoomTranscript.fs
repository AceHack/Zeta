namespace Zeta.Core

open System.Text.Json
open System.Text.Json.Serialization

/// Source-owned projection from the F# Dark Hall room loop into the no-script
/// room UI transcript consumed by src/Core.TypeScript/darkhall-ui.
[<RequireQualifiedAccess>]
module DarkHallRoomTranscript =

    module Runtime = DarkHallCabinetRuntime
    module RoomLoop = DarkHallRoomLoop
    module Scheduler = DarkHallScheduler

    [<Literal>]
    let Schema = "zeta.darkhall.room-ui.v1"

    type ControllerCell =
        { [<JsonPropertyName("cell")>]
          Cell: int
          [<JsonPropertyName("label")>]
          Label: string
          [<JsonPropertyName("actionId")>]
          ActionId: string
          [<JsonPropertyName("actionClass")>]
          ActionClass: string
          [<JsonPropertyName("gate")>]
          Gate: string
          [<JsonPropertyName("selected")>]
          Selected: bool
          [<JsonPropertyName("enabled")>]
          Enabled: bool }

    type HeatRow =
        { [<JsonPropertyName("tick")>]
          Tick: int
          [<JsonPropertyName("roomName")>]
          RoomName: string
          [<JsonPropertyName("heatRejected")>]
          HeatRejected: int
          [<JsonPropertyName("backpressured")>]
          Backpressured: int
          [<JsonPropertyName("storageErrors")>]
          StorageErrors: int
          [<JsonPropertyName("heatKinds")>]
          HeatKinds: string list
          [<JsonPropertyName("signals")>]
          Signals: string list
          [<JsonPropertyName("reasons")>]
          Reasons: string list }

    type TranscriptTick =
        { [<JsonPropertyName("tick")>]
          Tick: int
          [<JsonPropertyName("phase")>]
          Phase: string
          [<JsonPropertyName("event")>]
          Event: string
          [<JsonPropertyName("choiceCell")>]
          ChoiceCell: int
          [<JsonPropertyName("outcome")>]
          Outcome: string
          [<JsonPropertyName("heat")>]
          Heat: HeatRow
          [<JsonPropertyName("continuation")>]
          Continuation: string }

    type Transcript =
        { [<JsonPropertyName("schema")>]
          Schema: string
          [<JsonPropertyName("roomName")>]
          RoomName: string
          [<JsonPropertyName("seed")>]
          Seed: string
          [<JsonPropertyName("controller")>]
          Controller: ControllerCell list
          [<JsonPropertyName("ticks")>]
          Ticks: TranscriptTick list
          [<JsonPropertyName("heatRows")>]
          HeatRows: HeatRow list
          [<JsonPropertyName("generatedBy")>]
          GeneratedBy: string }

    let private jsonOptions =
        JsonSerializerOptions(WriteIndented = true)

    let private actionClassName =
        function
        | Runtime.ActionClass.Transition -> "transition"
        | Runtime.ActionClass.EscapeHatch -> "escape-hatch"
        | Runtime.ActionClass.GrammarExtension -> "grammar-extension"
        | Runtime.ActionClass.MenuContribution -> "menu-contribution"
        | Runtime.ActionClass.OperatorDecision -> "operator-decision"
        | Runtime.ActionClass.AgentDecision -> "agent-decision"

    let private gateName =
        function
        | Runtime.ActionGate.AppendOnly -> "append-only"
        | Runtime.ActionGate.PrGated -> "pr-gated"

    let private emptyCell cell =
        { Cell = cell
          Label = ""
          ActionId = ""
          ActionClass = ""
          Gate = ""
          Selected = false
          Enabled = false }

    let private cellOfAction selected cell (action: Runtime.CabinetAction) =
        { Cell = cell
          Label = action.Label
          ActionId = action.Id
          ActionClass = actionClassName action.Class
          Gate = gateName action.Gate
          Selected = selected
          Enabled = true }

    /// Normalize the room-facing controller readout into exactly sixteen cells.
    /// `ControllerReadout` is the room observation; `GridBinding` remains only
    /// the mechanical 4x4 placement primitive.
    let controllerCells (selectedCell: int option) (readout: Runtime.ControllerReadout) : ControllerCell list =
        let bound =
            readout.Grid
            |> GridBinding.bound
            |> Map.ofList

        [ for cell in 0 .. GridBinding.Size - 1 do
              match Map.tryFind cell bound with
              | Some action -> cellOfAction (selectedCell = Some cell) cell action
              | None -> emptyCell cell ]

    let heatRow (row: Scheduler.HeatBoundaryRow) : HeatRow =
        { Tick = row.Tick
          RoomName = row.RoomName
          HeatRejected = row.HeatRejected
          Backpressured = row.Backpressured
          StorageErrors = row.StorageErrors
          HeatKinds = row.HeatKinds
          Signals = Scheduler.heatBoundarySignalTokens row
          Reasons = row.Reasons }

    let private heatRowOfReadout (tick: int) (roomName: string) (heat: RoomLoop.HeatReadout) : HeatRow =
        heatRow
            { Tick = tick
              RoomName = roomName
              HeatRejected = heat.HeatRejected
              Backpressured = heat.Backpressured
              StorageErrors = heat.StorageErrors
              HeatKinds = heat.HeatKinds
              Reasons = heat.Reasons }

    let private outcomeOfHeatAndResult (heat: RoomLoop.HeatReadout) result =
        match result with
        | Error _ when heat.Backpressured > 0 -> "backpressure"
        | Error _ -> "refused"
        | Ok _ when heat.Backpressured > 0 -> "backpressure"
        | Ok _ -> "ok"

    let private runtimeResultName =
        function
        | Runtime.RunResult.SoftChip8Frame _ -> "soft-chip8-frame"
        | Runtime.RunResult.DarkHallCpuState _ -> "darkhall-cpu-state"
        | Runtime.RunResult.Chip9Frame _ -> "chip9-frame"
        | Runtime.RunResult.MetaCartResult _ -> "meta-cart-result"

    let private boundaryEffectName =
        function
        | RoomLoop.BoundaryEffect.Admitted report -> sprintf "boundary-admitted:%A" report.Outcome
        | RoomLoop.BoundaryEffect.Frosted -> "boundary-frosted"
        | RoomLoop.BoundaryEffect.Cleared -> "boundary-cleared"
        | RoomLoop.BoundaryEffect.Traversed(fromRoom, toRoom) -> sprintf "boundary-traversed:%s->%s" fromRoom toRoom

    let private tickFeedbackName =
        function
        | RoomLoop.TickFeedback.CellUnbound _ -> "cell-unbound"
        | RoomLoop.TickFeedback.ControllerActionSelected _ -> "controller-action-selected"
        | RoomLoop.TickFeedback.RequestMissing _ -> "request-missing"
        | RoomLoop.TickFeedback.RuntimeFeedback _ -> "runtime-feedback"
        | RoomLoop.TickFeedback.BoundaryFeedback _ -> "boundary-feedback"

    let tickOfOutcome (tick: int) (outcome: RoomLoop.TickOutcome) : TranscriptTick =
        let heat = heatRowOfReadout tick outcome.Readout.RoomName outcome.Heat
        let event =
            match outcome.Result with
            | Ok result -> sprintf "executed:%s" (runtimeResultName result)
            | Error feedback -> sprintf "refused:%s" (tickFeedbackName feedback)

        { Tick = tick
          Phase = "execute"
          Event = event
          ChoiceCell = outcome.Choice.Cell
          Outcome = outcomeOfHeatAndResult outcome.Heat outcome.Result
          Heat = heat
          Continuation = "" }

    let tickOfBoundaryOutcome (tick: int) (outcome: RoomLoop.BoundaryTickOutcome<'K>) : TranscriptTick =
        let heat = heatRowOfReadout tick outcome.Readout.RoomName outcome.Heat
        let event =
            match outcome.Result with
            | Ok(RoomLoop.BoundaryTickResult.RuntimeResult result) -> sprintf "executed:%s" (runtimeResultName result)
            | Ok(RoomLoop.BoundaryTickResult.BoundaryResult effect) -> boundaryEffectName effect
            | Error feedback -> sprintf "refused:%s" (tickFeedbackName feedback)

        { Tick = tick
          Phase = "execute"
          Event = event
          ChoiceCell = outcome.Choice.Cell
          Outcome = outcomeOfHeatAndResult outcome.Heat outcome.Result
          Heat = heat
          Continuation = "" }

    let private coldHeatRow tick roomName : HeatRow =
        { Tick = tick
          RoomName = roomName
          HeatRejected = 0
          Backpressured = 0
          StorageErrors = 0
          HeatKinds = []
          Signals = []
          Reasons = [] }

    let private measureTick (index: int) (row: Scheduler.HeatBoundaryRow) : TranscriptTick =
        let projected = heatRow row
        let outcome =
            if row.Backpressured > 0 then "backpressure"
            else "ok"

        { Tick = row.Tick
          Phase = "measure"
          Event = sprintf "heat-row:%d" index
          ChoiceCell = -1
          Outcome = outcome
          Heat = projected
          Continuation = "" }

    let ofRunOutcome seed generatedBy (run: RoomLoop.RunOutcome) : Transcript =
        let roomName = run.Final.Room.Name
        let readout =
            run.Final.LastReadout
            |> Option.defaultWith (fun () -> Runtime.observe run.Final.Room)

        { Schema = Schema
          RoomName = roomName
          Seed = seed
          GeneratedBy = generatedBy
          Controller =
              run.Ticks
              |> List.tryLast
              |> Option.map (fun tick -> controllerCells (Some tick.Choice.Cell) tick.Readout)
              |> Option.defaultWith (fun () -> controllerCells None readout)
          Ticks = run.Ticks |> List.mapi (fun index tick -> tickOfOutcome (index + 1) tick)
          HeatRows = run.Ticks |> List.mapi (fun index tick -> heatRowOfReadout (index + 1) tick.Readout.RoomName tick.Heat) }

    let ofBoundaryState seed generatedBy (state: Scheduler.BoundaryScheduledRoomState<'K>) : Transcript =
        let rows = state |> Scheduler.boundaryHeatRows |> List.map heatRow
        let readout =
            state.Loop.LastReadout
            |> Option.defaultWith (fun () -> Runtime.observe state.Loop.Room)

        { Schema = Schema
          RoomName = state.Loop.Room.Name
          Seed = seed
          GeneratedBy = generatedBy
          Controller =
              state.LastTick
              |> Option.map (fun tick -> controllerCells (Some tick.Choice.Cell) tick.Readout)
              |> Option.defaultWith (fun () -> controllerCells None readout)
          Ticks =
              state.LastTick
              |> Option.map (fun tick -> [ tickOfBoundaryOutcome state.CompletedTicks tick ])
              |> Option.defaultValue []
          HeatRows = rows }

    let ofUnifiedHeatRun seed generatedBy (run: RoomRun.UnifiedHeatRun<'K>) : Transcript =
        let readout =
            run.Room.LastTick
            |> Option.map (fun tick -> tick.Readout)
            |> Option.orElse run.Room.Loop.LastReadout
            |> Option.defaultWith (fun () -> Runtime.observe run.Room.Loop.Room)

        let tickRows =
            run.Room.LastTick
            |> Option.map (fun tick -> [ tickOfBoundaryOutcome run.Room.CompletedTicks tick ])
            |> Option.defaultValue []

        let heatTicks = run.HeatRows |> List.mapi (fun index row -> measureTick (index + 1) row)

        { Schema = Schema
          RoomName = run.Room.Loop.Room.Name
          Seed = seed
          GeneratedBy = generatedBy
          Controller =
              run.Room.LastTick
              |> Option.map (fun tick -> controllerCells (Some tick.Choice.Cell) tick.Readout)
              |> Option.defaultWith (fun () -> controllerCells None readout)
          Ticks = tickRows @ heatTicks
          HeatRows = run.HeatRows |> List.map heatRow }

    let ofUnifiedHorizonRun seed generatedBy (run: RoomRun.UnifiedHorizonRun<'K, 'S>) : Transcript =
        let baseRun: RoomRun.UnifiedHeatRun<'K> =
            { Room = run.Room
              SoftFrame = run.SoftFrame
              BoundaryHeatRows = Scheduler.boundaryHeatRows run.Room
              SoftHeatReport = run.SoftHeatReport
              HeatRows = run.HeatRows
              HeatTranscript = run.HeatTranscript }

        let baseTranscript = ofUnifiedHeatRun seed generatedBy baseRun

        { baseTranscript with
            Ticks =
                baseTranscript.Ticks
                @ [ { Tick = run.Room.CompletedTicks
                      Phase = "continue"
                      Event = "horizon-continuation"
                      ChoiceCell = -1
                      Outcome = "continued"
                      Heat = coldHeatRow run.Room.CompletedTicks run.Room.Loop.Room.Name
                      Continuation = "room-horizon" } ] }

    let toJson (transcript: Transcript) : string =
        JsonSerializer.Serialize(transcript, jsonOptions).Replace("\r\n", "\n")
