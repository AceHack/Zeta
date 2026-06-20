namespace Zeta.Core

open System.Threading.Tasks

/// Observe/choose/execute loop for Dark Hall cabinets.
///
/// This is the F# room-loop counterpart to `src/Core.TypeScript/observe/execute.ts`:
/// observe the current room into a controller readout, choose one bound cell, run
/// the selected effect through the owned cabinet runtime, and append a typed
/// event to the room ledger. The 4x4 `GridBinding` remains only the controller
/// placement view; this module owns the loop semantics.
[<RequireQualifiedAccess>]
module DarkHallRoomLoop =

    module Runtime = DarkHallCabinetRuntime

    [<RequireQualifiedAccess>]
    type ChoiceTier =
        | Oracle
        | Composer
        | Deliberator
        | Operator

    type ControllerChoice =
        { Cell: int
          Tier: ChoiceTier
          Confidence: float
          Reason: string }

    type RequestResolver = Runtime.CabinetAction -> Runtime.RunRequest option

    type HeatReadout =
        { HeatRejected: int
          Backpressured: int
          StorageErrors: int
          HeatKinds: string list
          Reasons: string list }

    [<RequireQualifiedAccess>]
    type TickFeedback =
        | CellUnbound of cell: int
        | ControllerActionSelected of cell: int * action: Runtime.CabinetAction
        | RequestMissing of cell: int * action: Runtime.CabinetAction
        | RuntimeFeedback of Runtime.Feedback

    [<RequireQualifiedAccess>]
    type LoopEvent =
        | Observed of roomName: string * actionCount: int
        | Chosen of choice: ControllerChoice * action: Runtime.CabinetAction
        | Executed of choice: ControllerChoice * action: Runtime.CabinetAction * result: Runtime.RunResult
        | Refused of choice: ControllerChoice option * action: Runtime.CabinetAction option * feedback: TickFeedback

    type LoopState =
        { Room: DarkHall.Room
          Manifest: Chip9Capabilities.Manifest
          EventsRev: LoopEvent list
          LastReadout: Runtime.ControllerReadout option
          LastResult: Runtime.RunResult option }

    type TickOutcome =
        { Readout: Runtime.ControllerReadout
          Choice: ControllerChoice
          Action: Runtime.CabinetAction option
          Result: Result<Runtime.RunResult, TickFeedback>
          Heat: HeatReadout
          State: LoopState }

    type RunOutcome =
        { Ticks: TickOutcome list
          Final: LoopState }

    let initial (room: DarkHall.Room) (manifest: Chip9Capabilities.Manifest) : LoopState =
        { Room = room
          Manifest = manifest
          EventsRev = []
          LastReadout = None
          LastResult = None }

    let events (state: LoopState) : LoopEvent list =
        List.rev state.EventsRev

    let private append (event: LoopEvent) (state: LoopState) : LoopState =
        { state with EventsRev = event :: state.EventsRev }

    let emptyHeatReadout : HeatReadout =
        { HeatRejected = 0
          Backpressured = 0
          StorageErrors = 0
          HeatKinds = []
          Reasons = [] }

    let private boundedGSetErrorReason =
        function
        | BoundedGSetError.NonPositiveCapacity capacity -> sprintf "heat storage non-positive capacity %d" capacity
        | BoundedGSetError.CapacityExceeded(capacity, count) ->
            sprintf "heat storage capacity exceeded capacity=%d count=%d" capacity count
        | BoundedGSetError.ConfigMismatch(left, right) ->
            sprintf
                "heat storage config mismatch left-capacity=%d right-capacity=%d"
                left.Capacity
                right.Capacity

    let private heatSinkFeedbackReadout =
        function
        | HeatSinkFeedback.Backpressure(heat, capacity, count) ->
            { emptyHeatReadout with
                HeatRejected = 1
                Backpressured = 1
                HeatKinds = [ heat.Kind ]
                Reasons = [ sprintf "heat sink backpressure kind=%s capacity=%d count=%d" heat.Kind capacity count ] }
        | HeatSinkFeedback.StorageError error ->
            { emptyHeatReadout with
                HeatRejected = 1
                StorageErrors = 1
                Reasons = [ boundedGSetErrorReason error ] }

    let private heatReadoutOfRuntimeFeedback =
        function
        | Runtime.Feedback.HeatRejected(_, feedback) -> heatSinkFeedbackReadout feedback
        | Runtime.Feedback.MetaCartFeedback(MetaCart.Feedback.HeatRejected(_, feedback)) -> heatSinkFeedbackReadout feedback
        | _ -> emptyHeatReadout

    let private heatReadoutOfResult =
        function
        | Error(TickFeedback.RuntimeFeedback feedback) -> heatReadoutOfRuntimeFeedback feedback
        | _ -> emptyHeatReadout

    let private complete
        (readout: Runtime.ControllerReadout)
        (choice: ControllerChoice)
        (action: Runtime.CabinetAction option)
        (result: Result<Runtime.RunResult, TickFeedback>)
        (state: LoopState)
        : TickOutcome =
        { Readout = readout
          Choice = choice
          Action = action
          Result = result
          Heat = heatReadoutOfResult result
          State = state }

    let private cellForAction (action: Runtime.CabinetAction) (readout: Runtime.ControllerReadout) : int option =
        GridBinding.bound readout.Grid
        |> List.tryFind (fun (_, bound) -> bound.Id = action.Id)
        |> Option.map fst

    /// Cheap deterministic chooser: pick the first executable cabinet action in
    /// the current controller readout. This is the room-loop oracle tier; richer
    /// soft/dynamic policies can replace it without changing the tick boundary.
    let chooseFirstExecutable (readout: Runtime.ControllerReadout) : ControllerChoice =
        let cell =
            readout.Actions
            |> List.tryFind (fun action -> Option.isSome action.Address)
            |> Option.bind (fun action -> cellForAction action readout)
            |> Option.orElseWith (fun () -> GridBinding.bound readout.Grid |> List.tryHead |> Option.map fst)
            |> Option.defaultValue 0

        { Cell = cell
          Tier = ChoiceTier.Oracle
          Confidence = 1.0
          Reason = "first executable cabinet action in the controller readout" }

    /// One observe.ts-shaped tick: observe -> choose -> execute -> append.
    let tick
        (source: string)
        (sink: IHeatSink)
        (requestFor: RequestResolver)
        (choose: Runtime.ControllerReadout -> ControllerChoice)
        (state: LoopState)
        : Task<TickOutcome> =
        let readout = Runtime.observe state.Room

        let observed =
            { state with LastReadout = Some readout }
            |> append (LoopEvent.Observed(readout.RoomName, readout.Actions.Length))

        let choice = choose readout

        match Runtime.actionAt choice.Cell readout with
        | None ->
            let feedback = TickFeedback.CellUnbound choice.Cell
            let next = observed |> append (LoopEvent.Refused(Some choice, None, feedback))
            Task.FromResult(complete readout choice None (Error feedback) next)

        | Some action ->
            let chosen = observed |> append (LoopEvent.Chosen(choice, action))

            match action.Address with
            | None ->
                let feedback = TickFeedback.ControllerActionSelected(choice.Cell, action)
                let next = chosen |> append (LoopEvent.Refused(Some choice, Some action, feedback))
                Task.FromResult(complete readout choice (Some action) (Error feedback) next)

            | Some _ ->
                match requestFor action with
                | None ->
                    let feedback = TickFeedback.RequestMissing(choice.Cell, action)
                    let next = chosen |> append (LoopEvent.Refused(Some choice, Some action, feedback))
                    Task.FromResult(complete readout choice (Some action) (Error feedback) next)

                | Some request ->
                    task {
                        let! result =
                            Runtime.executeCell source sink state.Manifest state.Room choice.Cell request

                        match result with
                        | Ok runResult ->
                            let next =
                                { chosen with LastResult = Some runResult }
                                |> append (LoopEvent.Executed(choice, action, runResult))

                            return complete readout choice (Some action) (Ok runResult) next

                        | Error runtimeFeedback ->
                            let feedback = TickFeedback.RuntimeFeedback runtimeFeedback
                            let next = chosen |> append (LoopEvent.Refused(Some choice, Some action, feedback))
                            return complete readout choice (Some action) (Error feedback) next
                    }

    /// Bounded foreground room loop. Infinity happens by explicit continuation
    /// scheduling outside this function; one call always runs a finite number of ticks.
    let run
        (source: string)
        (sink: IHeatSink)
        (requestFor: RequestResolver)
        (choose: Runtime.ControllerReadout -> ControllerChoice)
        (maxTicks: int)
        (state: LoopState)
        : Task<RunOutcome> =
        task {
            let tickCount = max 1 maxTicks
            let mutable current = state
            let mutable ticksRev = []

            for _ in 1..tickCount do
                let! outcome = tick source sink requestFor choose current
                current <- outcome.State
                ticksRev <- outcome :: ticksRev

            return
                { Ticks = List.rev ticksRev
                  Final = current }
        }
