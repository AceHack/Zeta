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

    [<RequireQualifiedAccess>]
    type BoundaryCommand<'K when 'K : comparison> =
        | AdmitWithSlot of rawSlot: int64 * key: 'K
        | Frost of cost: int
        /// Carries the principal asking to defrost. Nullary `Clear` was an unauthenticated
        /// defrost — anyone could strip anyone's frost and the call could not fail.
        | Clear of principal: string
        | Traverse of heldKeys: Set<string> * toRoom: string * vault: DoorGraph.Vault

    type BoundaryRequestResolver<'K when 'K : comparison> =
        Runtime.CabinetAction -> BoundaryCommand<'K> option

    [<RequireQualifiedAccess>]
    type BoundaryEffect<'K when 'K : comparison> =
        | Admitted of RoomAdmission.SlotReport<'K>
        | Frosted
        | Cleared
        | Traversed of fromRoom: string * toRoom: string

    [<RequireQualifiedAccess>]
    type BoundaryTickResult<'K when 'K : comparison> =
        | RuntimeResult of Runtime.RunResult
        | BoundaryResult of BoundaryEffect<'K>

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
        | BoundaryFeedback of RoomBoundary.Feedback

    [<RequireQualifiedAccess>]
    type LoopEvent =
        | Observed of roomName: string * actionCount: int
        | Chosen of choice: ControllerChoice * action: Runtime.CabinetAction
        | Executed of choice: ControllerChoice * action: Runtime.CabinetAction * result: Runtime.RunResult
        | BoundaryApplied of choice: ControllerChoice * action: Runtime.CabinetAction * effect: string
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

    type BoundaryTickOutcome<'K when 'K : comparison> =
        { Readout: Runtime.ControllerReadout
          Choice: ControllerChoice
          Action: Runtime.CabinetAction option
          BoundaryCommand: BoundaryCommand<'K> option
          Result: Result<BoundaryTickResult<'K>, TickFeedback>
          Heat: HeatReadout
          Boundary: RoomBoundary.Boundary<'K>
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

    let private heatReadoutOfSignatures (signatures: HeatSignature list) : HeatReadout =
        let heatKinds = signatures |> List.map _.Kind
        let reasons = signatures |> List.map _.Detail

        { emptyHeatReadout with
            HeatRejected = signatures.Length
            Backpressured =
                signatures
                |> List.filter (fun signature -> HeatSignature.isPressureKind signature.Kind)
                |> List.length
            HeatKinds = heatKinds
            Reasons = reasons }

    let private heatReadoutOfBoundaryEffect (source: string) =
        function
        | BoundaryEffect.Admitted report -> RoomAdmission.heatSignatures source report |> heatReadoutOfSignatures
        | BoundaryEffect.Frosted
        | BoundaryEffect.Cleared
        | BoundaryEffect.Traversed _ -> emptyHeatReadout

    let private heatReadoutOfBoundaryFeedback (source: string) =
        function
        | RoomBoundary.Feedback.HeatFeedback feedback -> heatSinkFeedbackReadout feedback
        | RoomBoundary.Feedback.AdmissionFeedback(RoomAdmission.Feedback.HeatFeedback feedback) ->
            heatSinkFeedbackReadout feedback
        | RoomBoundary.Feedback.AdmissionFeedback _ -> emptyHeatReadout
        | RoomBoundary.Feedback.PrivacyDenied reason ->
            HeatSignature.ofMass source "room-boundary.privacy-backpressure" 1 1.0 reason
            |> List.singleton
            |> heatReadoutOfSignatures
        | RoomBoundary.Feedback.DoorDenied(fromRoom, toRoom, reason) ->
            let detail = sprintf "%s -> %s refused: %s" fromRoom toRoom reason

            HeatSignature.ofMass source "room-boundary.door-denied" 1 1.0 detail
            |> List.singleton
            |> heatReadoutOfSignatures
        | RoomBoundary.Feedback.DefrostDenied(requester, owner) ->
            // A refused confiscation is host-visible heat like every other boundary refusal: an
            // attempt to strip someone else's frost should leave a trace, not vanish silently.
            let detail = sprintf "%s may not defrost a boundary owned by %s" requester owner

            HeatSignature.ofMass source "room-boundary.defrost-denied" 1 1.0 detail
            |> List.singleton
            |> heatReadoutOfSignatures

    let private heatReadoutOfResult =
        function
        | Error(TickFeedback.RuntimeFeedback feedback) -> heatReadoutOfRuntimeFeedback feedback
        | Error(TickFeedback.BoundaryFeedback feedback) -> heatReadoutOfBoundaryFeedback "" feedback
        | _ -> emptyHeatReadout

    let private heatReadoutOfBoundaryResult (source: string) =
        function
        | Ok(BoundaryTickResult.BoundaryResult effect) -> heatReadoutOfBoundaryEffect source effect
        | Error(TickFeedback.BoundaryFeedback feedback) -> heatReadoutOfBoundaryFeedback source feedback
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

    let private completeBoundary
        (source: string)
        (readout: Runtime.ControllerReadout)
        (choice: ControllerChoice)
        (action: Runtime.CabinetAction option)
        (command: BoundaryCommand<'K> option)
        (result: Result<BoundaryTickResult<'K>, TickFeedback>)
        (boundary: RoomBoundary.Boundary<'K>)
        (state: LoopState)
        : BoundaryTickOutcome<'K> =
        { Readout = readout
          Choice = choice
          Action = action
          BoundaryCommand = command
          Result = result
          Heat = heatReadoutOfBoundaryResult source result
          Boundary = boundary
          State = state }

    let private boundaryEffectName =
        function
        | BoundaryEffect.Admitted report -> sprintf "admit:%A:%d" report.Outcome report.Slot
        | BoundaryEffect.Frosted -> "frost"
        | BoundaryEffect.Cleared -> "clear"
        | BoundaryEffect.Traversed(fromRoom, toRoom) -> sprintf "traverse:%s->%s" fromRoom toRoom

    let private applyBoundaryCommand
        (sink: IHeatSink)
        (command: BoundaryCommand<'K>)
        (boundary: RoomBoundary.Boundary<'K>)
        : Result<RoomBoundary.Boundary<'K> * BoundaryEffect<'K>, RoomBoundary.Feedback> =
        result {
            match command with
            | BoundaryCommand.AdmitWithSlot(rawSlot, key) ->
                let! next, report = RoomBoundary.admitWithSlot sink rawSlot key boundary
                return next, BoundaryEffect.Admitted report

            | BoundaryCommand.Frost cost ->
                let! next = RoomBoundary.frost sink cost boundary
                return next, BoundaryEffect.Frosted

            | BoundaryCommand.Clear principal ->
                let! next = RoomBoundary.clear sink principal boundary
                return next, BoundaryEffect.Cleared

            | BoundaryCommand.Traverse(heldKeys, toRoom, vault) ->
                let fromRoom = boundary.CurrentRoom
                let! next = RoomBoundary.traverse sink heldKeys toRoom vault boundary
                return next, BoundaryEffect.Traversed(fromRoom, next.CurrentRoom)
        }

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

    /// Boundary-aware room tick. The same controller readout may choose a
    /// cabinet runtime action or a room-boundary operation. Boundary failures
    /// stay typed and export heat through the injected sink.
    let tickWithBoundary
        (source: string)
        (sink: IHeatSink)
        (requestFor: RequestResolver)
        (boundaryFor: BoundaryRequestResolver<'K>)
        (choose: Runtime.ControllerReadout -> ControllerChoice)
        (boundary: RoomBoundary.Boundary<'K>)
        (state: LoopState)
        : Task<BoundaryTickOutcome<'K>> =
        let readout = Runtime.observe state.Room

        let observed =
            { state with LastReadout = Some readout }
            |> append (LoopEvent.Observed(readout.RoomName, readout.Actions.Length))

        let choice = choose readout

        match Runtime.actionAt choice.Cell readout with
        | None ->
            let feedback = TickFeedback.CellUnbound choice.Cell
            let next = observed |> append (LoopEvent.Refused(Some choice, None, feedback))

            Task.FromResult(
                completeBoundary source readout choice None None (Error feedback) boundary next
            )

        | Some action ->
            let chosen = observed |> append (LoopEvent.Chosen(choice, action))

            match boundaryFor action with
            | Some command ->
                match applyBoundaryCommand sink command boundary with
                | Ok(nextBoundary, effect) ->
                    let next =
                        chosen
                        |> append (LoopEvent.BoundaryApplied(choice, action, boundaryEffectName effect))

                    Task.FromResult(
                        completeBoundary
                            source
                            readout
                            choice
                            (Some action)
                            (Some command)
                            (Ok(BoundaryTickResult.BoundaryResult effect))
                            nextBoundary
                            next
                    )

                | Error boundaryFeedback ->
                    let feedback = TickFeedback.BoundaryFeedback boundaryFeedback
                    let next = chosen |> append (LoopEvent.Refused(Some choice, Some action, feedback))

                    Task.FromResult(
                        completeBoundary
                            source
                            readout
                            choice
                            (Some action)
                            (Some command)
                            (Error feedback)
                            boundary
                            next
                    )

            | None ->
                match action.Address with
                | None ->
                    let feedback = TickFeedback.ControllerActionSelected(choice.Cell, action)
                    let next = chosen |> append (LoopEvent.Refused(Some choice, Some action, feedback))

                    Task.FromResult(
                        completeBoundary source readout choice (Some action) None (Error feedback) boundary next
                    )

                | Some _ ->
                    match requestFor action with
                    | None ->
                        let feedback = TickFeedback.RequestMissing(choice.Cell, action)
                        let next = chosen |> append (LoopEvent.Refused(Some choice, Some action, feedback))

                        Task.FromResult(
                            completeBoundary source readout choice (Some action) None (Error feedback) boundary next
                        )

                    | Some request ->
                        task {
                            let! result =
                                Runtime.executeCell source sink state.Manifest state.Room choice.Cell request

                            match result with
                            | Ok runResult ->
                                let next =
                                    { chosen with LastResult = Some runResult }
                                    |> append (LoopEvent.Executed(choice, action, runResult))

                                return
                                    completeBoundary
                                        source
                                        readout
                                        choice
                                        (Some action)
                                        None
                                        (Ok(BoundaryTickResult.RuntimeResult runResult))
                                        boundary
                                        next

                            | Error runtimeFeedback ->
                                let feedback = TickFeedback.RuntimeFeedback runtimeFeedback
                                let next = chosen |> append (LoopEvent.Refused(Some choice, Some action, feedback))

                                return
                                    completeBoundary
                                        source
                                        readout
                                        choice
                                        (Some action)
                                        None
                                        (Error feedback)
                                        boundary
                                        next
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
