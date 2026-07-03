namespace Zeta.Core

open System.Collections.Generic

/// Scheduler-facing boundary for Dark Hall rooms.
///
/// `DarkHallRoomLoop` owns observe -> choose -> execute -> append. This module
/// only adapts that loop to the soft scheduler and banks the heat readout as a
/// first-class row, so CHIP-9/room hosts can see backpressure without unpacking
/// nested runtime feedback.
[<RequireQualifiedAccess>]
module DarkHallScheduler =

    module RoomLoop = DarkHallRoomLoop
    module Runtime = DarkHallCabinetRuntime

    type HeatBoundaryRow =
        { Tick: int
          RoomName: string
          HeatRejected: int
          Backpressured: int
          StorageErrors: int
          HeatKinds: string list
          Reasons: string list }

    type HeatTranscriptSummary =
        { Rows: int
          HeatRejected: int
          Backpressured: int
          StorageErrors: int
          HeatKinds: string list
          Signals: string list
          Reasons: string list }

    [<RequireQualifiedAccess>]
    type HeatBoundarySignal =
        | Forgotten
        | Backpressure
        | Denied
        | StorageError
        | Invalid
        | Expired
        | Stale
        | Other of string

    type ScheduledRoomState =
        { Loop: RoomLoop.LoopState
          CompletedTicks: int
          CompletedLaps: int
          LastTick: RoomLoop.TickOutcome option
          HeatRowsRev: HeatBoundaryRow list }

    type BoundaryScheduledRoomState<'K when 'K : comparison> =
        { Loop: RoomLoop.LoopState
          Boundary: RoomBoundary.Boundary<'K>
          CompletedTicks: int
          CompletedLaps: int
          LastTick: RoomLoop.BoundaryTickOutcome<'K> option
          HeatRowsRev: HeatBoundaryRow list }

    [<RequireQualifiedAccess>]
    type HeatBoardContinuationFeedback =
        | MalformedContinuation of token: string
        | LoopIdMismatch of expected: string * actual: string
        | StatePointerMismatch of expectedPrefix: string * actual: string
        | ResumeTickOverflow of nextLap: int * ticksPerLap: int
        | SnapshotLapMismatch of expected: int * actual: int
        | SnapshotTickMismatch of expected: int * actual: int
        | SnapshotMissing of pointer: string
        | SnapshotStoreRejected of pointer: string * reason: string

    type HeatBoardContinuationAdmission =
        { Token: SimLoop.Continuation
          StatePointer: string
          ResumeBaseTick: int }

    type IHeatBoardStateStore =
        abstract WriteAsync:
            pointer: string *
            state: ScheduledRoomState *
            ct: System.Threading.CancellationToken ->
                System.Threading.Tasks.Task<Result<unit, HeatBoardContinuationFeedback>>

        abstract ReadAsync:
            pointer: string *
            ct: System.Threading.CancellationToken ->
                System.Threading.Tasks.Task<Result<ScheduledRoomState, HeatBoardContinuationFeedback>>

    [<Sealed>]
    type InMemoryHeatBoardStateStore() =
        let snapshots = System.Collections.Generic.Dictionary<string, ScheduledRoomState>(System.StringComparer.Ordinal)
        let gate = obj ()

        interface IHeatBoardStateStore with
            member _.WriteAsync(pointer, state, _ct) =
                lock gate (fun () -> snapshots.[pointer] <- state)
                System.Threading.Tasks.Task.FromResult(Ok())

            member _.ReadAsync(pointer, _ct) =
                match lock gate (fun () -> snapshots.TryGetValue pointer) with
                | true, state -> System.Threading.Tasks.Task.FromResult(Ok state)
                | false, _ ->
                    System.Threading.Tasks.Task.FromResult(Error(HeatBoardContinuationFeedback.SnapshotMissing pointer))

    let initial (room: DarkHall.Room) (manifest: Chip9Capabilities.Manifest) : ScheduledRoomState =
        { Loop = RoomLoop.initial room manifest
          CompletedTicks = 0
          CompletedLaps = 0
          LastTick = None
          HeatRowsRev = [] }

    let initialWithBoundary
        (room: DarkHall.Room)
        (manifest: Chip9Capabilities.Manifest)
        (boundary: RoomBoundary.Boundary<'K>)
        : BoundaryScheduledRoomState<'K> =
        { Loop = RoomLoop.initial room manifest
          Boundary = boundary
          CompletedTicks = 0
          CompletedLaps = 0
          LastTick = None
          HeatRowsRev = [] }

    let heatRows (state: ScheduledRoomState) : HeatBoundaryRow list =
        List.rev state.HeatRowsRev

    let boundaryHeatRows (state: BoundaryScheduledRoomState<'K>) : HeatBoundaryRow list =
        List.rev state.HeatRowsRev

    let lastHeatRow (state: ScheduledRoomState) : HeatBoundaryRow option =
        state.HeatRowsRev |> List.tryHead

    let lastBoundaryHeatRow (state: BoundaryScheduledRoomState<'K>) : HeatBoundaryRow option =
        state.HeatRowsRev |> List.tryHead

    let backpressured (state: ScheduledRoomState) : bool =
        state.HeatRowsRev |> List.exists (fun row -> row.Backpressured > 0)

    let boundaryBackpressured (state: BoundaryScheduledRoomState<'K>) : bool =
        state.HeatRowsRev |> List.exists (fun row -> row.Backpressured > 0)

    let private distinctOrdinal (values: string list) : string list =
        let seen = HashSet<string>(System.StringComparer.Ordinal)

        values
        |> List.filter (fun value -> seen.Add value)

    let heatBoundarySignalOfKind (kind: string) : HeatBoundarySignal =
        if HeatSignature.isForgettingKind kind then
            HeatBoundarySignal.Forgotten
        elif HeatSignature.isBackpressureKind kind then
            HeatBoundarySignal.Backpressure
        elif HeatSignature.isDeniedKind kind then
            HeatBoundarySignal.Denied
        elif HeatSignature.isStorageErrorKind kind then
            HeatBoundarySignal.StorageError
        elif HeatSignature.isInvalidKind kind then
            HeatBoundarySignal.Invalid
        elif HeatSignature.isExpiredKind kind then
            HeatBoundarySignal.Expired
        elif HeatSignature.isStaleKind kind then
            HeatBoundarySignal.Stale
        else
            HeatBoundarySignal.Other kind

    let heatBoundarySignalToken =
        function
        | HeatBoundarySignal.Forgotten -> "forgotten"
        | HeatBoundarySignal.Backpressure -> "backpressure"
        | HeatBoundarySignal.Denied -> "denied"
        | HeatBoundarySignal.StorageError -> "storage-error"
        | HeatBoundarySignal.Invalid -> "invalid"
        | HeatBoundarySignal.Expired -> "expired"
        | HeatBoundarySignal.Stale -> "stale"
        | HeatBoundarySignal.Other _ -> "other"

    let private isPressureSignal =
        function
        | HeatBoundarySignal.Backpressure
        | HeatBoundarySignal.Denied -> true
        | HeatBoundarySignal.Forgotten
        | HeatBoundarySignal.StorageError
        | HeatBoundarySignal.Invalid
        | HeatBoundarySignal.Expired
        | HeatBoundarySignal.Stale
        | HeatBoundarySignal.Other _ -> false

    /// Typed view over the existing host-visible heat row. This is the public
    /// classifier scheduler/room policies should use instead of re-parsing
    /// string heat kinds at every callsite.
    let heatBoundarySignals (row: HeatBoundaryRow) : HeatBoundarySignal list =
        let fromKinds = row.HeatKinds |> List.map heatBoundarySignalOfKind
        let hasPressureKind = fromKinds |> List.exists isPressureSignal

        [ yield! fromKinds

          if row.Backpressured > 0 && not hasPressureKind then
              HeatBoundarySignal.Backpressure

          if row.StorageErrors > 0 then
              HeatBoundarySignal.StorageError ]
        |> List.distinct

    let heatTranscriptSignals (rows: HeatBoundaryRow list) : HeatBoundarySignal list =
        rows |> List.collect heatBoundarySignals |> List.distinct

    let heatBoundarySignalTokens (row: HeatBoundaryRow) : string list =
        row |> heatBoundarySignals |> List.map heatBoundarySignalToken |> distinctOrdinal

    let heatTranscriptSignalTokens (rows: HeatBoundaryRow list) : string list =
        rows |> List.collect heatBoundarySignalTokens |> distinctOrdinal

    let rowHasBackpressureSignal (row: HeatBoundaryRow) : bool =
        row.Backpressured > 0 || (row |> heatBoundarySignals |> List.exists isPressureSignal)

    let rowHasForgettingSignal (row: HeatBoundaryRow) : bool =
        row |> heatBoundarySignals |> List.contains HeatBoundarySignal.Forgotten

    let rowHasStorageErrorSignal (row: HeatBoundaryRow) : bool =
        row.StorageErrors > 0 || (row |> heatBoundarySignals |> List.contains HeatBoundarySignal.StorageError)

    let summarizeHeatRows (rows: HeatBoundaryRow list) : HeatTranscriptSummary =
        { Rows = rows.Length
          HeatRejected = rows |> List.sumBy _.HeatRejected
          Backpressured = rows |> List.sumBy _.Backpressured
          StorageErrors = rows |> List.sumBy _.StorageErrors
          HeatKinds = rows |> List.collect _.HeatKinds |> distinctOrdinal
          Signals = rows |> heatTranscriptSignalTokens
          Reasons = rows |> List.collect _.Reasons }

    let heatTranscript (state: ScheduledRoomState) : HeatTranscriptSummary =
        state |> heatRows |> summarizeHeatRows

    let boundaryHeatTranscript (state: BoundaryScheduledRoomState<'K>) : HeatTranscriptSummary =
        state |> boundaryHeatRows |> summarizeHeatRows

    let transcriptHasHeat (summary: HeatTranscriptSummary) : bool =
        summary.HeatRejected > 0 || summary.Backpressured > 0 || summary.StorageErrors > 0

    let private setColor (x: int) (y: int) (mask: byte) (frame: Chip8Cow.Frame) : Chip8Cow.Frame =
        let idx = y * Chip8.DisplayW + x
        let display =
            if mask &&& 1uy <> 0uy then Map.add idx true frame.Display else Map.remove idx frame.Display

        let hi = mask &&& 0b110uy
        let extra = if hi = 0uy then Map.remove idx frame.Extra else Map.add idx hi frame.Extra

        { frame with Display = display; Extra = extra }

    let private drawLane (y: int) (start: int) (width: int) (mask: byte) (count: int) (frame: Chip8Cow.Frame) : Chip8Cow.Frame =
        let lit = max 0 count |> min width

        if lit = 0 then
            frame
        else
            [ 0 .. lit - 1 ] |> List.fold (fun acc dx -> setColor (start + dx) y mask acc) frame

    let private drawKindLane (y: int) (row: HeatBoundaryRow) (frame: Chip8Cow.Frame) : Chip8Cow.Frame =
        row.HeatKinds
        |> List.distinct
        |> List.truncate 16
        |> List.indexed
        |> List.fold (fun acc (i, _) -> setColor (48 + i) y 4uy acc) frame

    /// Host-visible CHIP-9 heat board. Each heat row becomes one display row:
    /// red 0..15 = heat rejected, yellow 16..31 = backpressure, magenta
    /// 32..47 = storage errors, blue 48..63 = distinct heat kinds.
    let heatBoardFrame (seed: uint64) (rows: HeatBoundaryRow list) : Chip8Cow.Frame =
        let visibleRows = rows |> List.rev |> List.truncate Chip8.DisplayH |> List.rev
        let baseFrame = { Chip8Cow.create seed with Plane = 7uy }

        visibleRows
        |> List.indexed
        |> List.fold
            (fun frame (y, row) ->
                frame
                |> drawLane y 0 16 1uy row.HeatRejected
                |> drawLane y 16 16 3uy row.Backpressured
                |> drawLane y 32 16 5uy row.StorageErrors
                |> drawKindLane y row)
            baseFrame

    let heatBoardFrameForState (seed: uint64) (state: ScheduledRoomState) : Chip8Cow.Frame =
        state |> heatRows |> heatBoardFrame seed

    let renderHeatBoard (seed: uint64) (rows: HeatBoundaryRow list) : string list =
        rows |> heatBoardFrame seed |> Chip9Board.render

    let renderHeatBoardForState (seed: uint64) (state: ScheduledRoomState) : string list =
        state |> heatRows |> renderHeatBoard seed

    let private heatReadoutOfSignatures (signatures: HeatSignature list) : RoomLoop.HeatReadout =
        { HeatRejected = signatures.Length
          Backpressured =
            signatures
            |> List.filter (fun signature -> HeatSignature.isPressureKind signature.Kind)
            |> List.length
          StorageErrors = 0
          HeatKinds = signatures |> List.map _.Kind
          Reasons = signatures |> List.map _.Detail }

    let heatRowOfSignatures (tick: int) (roomName: string) (signatures: HeatSignature list) : HeatBoundaryRow =
        let heat = heatReadoutOfSignatures signatures

        { Tick = tick
          RoomName = roomName
          HeatRejected = heat.HeatRejected
          Backpressured = heat.Backpressured
          StorageErrors = heat.StorageErrors
          HeatKinds = heat.HeatKinds
          Reasons = heat.Reasons }

    let private heatRowDetail (row: HeatBoundaryRow) : string =
        let reasons =
            match row.Reasons with
            | [] -> "no detail"
            | values -> System.String.Join("; ", values)

        sprintf "room=%s tick=%d %s" row.RoomName row.Tick reasons

    /// Reconstruct host-facing heat signatures from a banked scheduler row.
    ///
    /// The original lossy event may already have crossed an `IHeatSink`; this
    /// projection is for host/CHIP room boundaries that need to export the
    /// complete row transcript to another injected port. Empty rows stay cold.
    let heatSignaturesOfRow (source: string) (row: HeatBoundaryRow) : HeatSignature list =
        let detail = heatRowDetail row
        let distinctKinds = row.HeatKinds |> distinctOrdinal

        [ yield!
              distinctKinds
              |> List.map (fun kind ->
                  let units =
                      row.HeatKinds
                      |> List.filter ((=) kind)
                      |> List.length
                      |> max 1

                  HeatSignature.ofMass source kind units (float units) detail)

          if row.Backpressured > 0 && not (row.HeatKinds |> List.exists HeatSignature.isPressureKind) then
              HeatSignature.ofMass
                  source
                  "darkhall.backpressure"
                  row.Backpressured
                  (float row.Backpressured)
                  detail

          if row.StorageErrors > 0 && not (row.HeatKinds |> List.exists HeatSignature.isStorageErrorKind) then
              HeatSignature.ofMass
                  source
                  "darkhall.storage-error"
                  row.StorageErrors
                  (float row.StorageErrors)
                  detail

          if row.HeatRejected > 0 && List.isEmpty distinctKinds && row.Backpressured = 0 && row.StorageErrors = 0 then
              HeatSignature.ofMass source "darkhall.heat" row.HeatRejected (float row.HeatRejected) detail ]

    /// Export scheduler heat rows through an injected host IO boundary. This is
    /// intentionally opt-in so test/prod hosts decide whether replaying a
    /// transcript should also spend external heat-channel capacity.
    let emitHeatRows (sink: IHeatSink) (source: string) (rows: HeatBoundaryRow list) : Result<unit, HeatSinkFeedback> =
        let rec loop signatures =
            result {
                match signatures with
                | [] -> return ()
                | signature :: tail ->
                    do! sink.Emit signature
                    return! loop tail
            }

        rows |> List.collect (heatSignaturesOfRow source) |> loop

    /// Project a finite prediction horizon into the same host-visible heat row
    /// used by Dark Hall/CHIP room execution. The horizon is not a runtime:
    /// attention may order futures, but this row only reports materialized
    /// forgetting and paid finite-view backpressure.
    let heatRowOfHorizonReport
        (tick: int)
        (roomName: string)
        (source: string)
        (report: RoomHorizon.Report<'K, 'S>)
        : HeatBoundaryRow =
        report |> RoomHorizon.heatSignatures source |> heatRowOfSignatures tick roomName

    let private rowOfOutcome (tick: int) (outcome: RoomLoop.TickOutcome) : HeatBoundaryRow =
        { Tick = tick
          RoomName = outcome.Readout.RoomName
          HeatRejected = outcome.Heat.HeatRejected
          Backpressured = outcome.Heat.Backpressured
          StorageErrors = outcome.Heat.StorageErrors
          HeatKinds = outcome.Heat.HeatKinds
          Reasons = outcome.Heat.Reasons }

    let private rowOfBoundaryOutcome (tick: int) (outcome: RoomLoop.BoundaryTickOutcome<'K>) : HeatBoundaryRow =
        { Tick = tick
          RoomName = outcome.Readout.RoomName
          HeatRejected = outcome.Heat.HeatRejected
          Backpressured = outcome.Heat.Backpressured
          StorageErrors = outcome.Heat.StorageErrors
          HeatKinds = outcome.Heat.HeatKinds
          Reasons = outcome.Heat.Reasons }

    let record (outcome: RoomLoop.TickOutcome) (state: ScheduledRoomState) : ScheduledRoomState =
        let tick = state.CompletedTicks + 1
        { Loop = outcome.State
          CompletedTicks = tick
          CompletedLaps = state.CompletedLaps
          LastTick = Some outcome
          HeatRowsRev = rowOfOutcome tick outcome :: state.HeatRowsRev }

    let recordBoundary
        (outcome: RoomLoop.BoundaryTickOutcome<'K>)
        (state: BoundaryScheduledRoomState<'K>)
        : BoundaryScheduledRoomState<'K> =
        let tick = state.CompletedTicks + 1

        { Loop = outcome.State
          Boundary = outcome.Boundary
          CompletedTicks = tick
          CompletedLaps = state.CompletedLaps
          LastTick = Some outcome
          HeatRowsRev = rowOfBoundaryOutcome tick outcome :: state.HeatRowsRev }

    let private stampCumulativeLaps
        (startLaps: int)
        (outcome: SimLoop.Outcome<ScheduledRoomState, string list>)
        : SimLoop.Outcome<ScheduledRoomState, string list> =
        let laps =
            outcome.Laps
            |> List.mapi (fun i lap ->
                { lap with State = { lap.State with CompletedLaps = startLaps + i + 1 } })

        let final = { outcome.Final with CompletedLaps = startLaps + List.length outcome.Laps }

        { outcome with Laps = laps; Final = final }

    let tick
        (source: string)
        (sink: IHeatSink)
        (requestFor: RoomLoop.RequestResolver)
        (choose: Runtime.ControllerReadout -> RoomLoop.ControllerChoice)
        (state: ScheduledRoomState)
        =
        task {
            let! outcome = RoomLoop.tick source sink requestFor choose state.Loop
            return record outcome state
        }

    let tickWithBoundary
        (source: string)
        (sink: IHeatSink)
        (requestFor: RoomLoop.RequestResolver)
        (boundaryFor: RoomLoop.BoundaryRequestResolver<'K>)
        (choose: Runtime.ControllerReadout -> RoomLoop.ControllerChoice)
        (state: BoundaryScheduledRoomState<'K>)
        =
        task {
            let! outcome =
                RoomLoop.tickWithBoundary source sink requestFor boundaryFor choose state.Boundary state.Loop

            return recordBoundary outcome state
        }

    let roomTickHandler
        (name: string)
        (matches: InterruptKind -> bool)
        (source: string)
        (sink: IHeatSink)
        (requestFor: RoomLoop.RequestResolver)
        (choose: Runtime.ControllerReadout -> RoomLoop.ControllerChoice)
        : SoftScheduler.HandlerK<ScheduledRoomState> =
        SoftScheduler.handlerK name matches (fun _intr _ctx state ->
            task {
                let! next = tick source sink requestFor choose state
                return Ok next
            })

    let boundaryRoomTickHandler
        (name: string)
        (matches: InterruptKind -> bool)
        (source: string)
        (sink: IHeatSink)
        (requestFor: RoomLoop.RequestResolver)
        (boundaryFor: RoomLoop.BoundaryRequestResolver<'K>)
        (choose: Runtime.ControllerReadout -> RoomLoop.ControllerChoice)
        : SoftScheduler.HandlerK<BoundaryScheduledRoomState<'K>> =
        SoftScheduler.handlerK name matches (fun _intr _ctx state ->
            task {
                let! next = tickWithBoundary source sink requestFor boundaryFor choose state
                return Ok next
            })


    let heatBoardSimLoopFromState
        (name: string)
        (matches: InterruptKind -> bool)
        (sourceName: string)
        (sink: IHeatSink)
        (requestFor: RoomLoop.RequestResolver)
        (choose: Runtime.ControllerReadout -> RoomLoop.ControllerChoice)
        (interruptSource: SoftScheduler.Source)
        (clock: int -> int64)
        (budget: SimLoop.Budget)
        (ctx: IntrCtx)
        (seed: int64)
        (ticksPerLap: int)
        (cut: string list -> ScheduledRoomState -> bool)
        (start: ScheduledRoomState)
        =
        task {
            let handler = roomTickHandler name matches sourceName sink requestFor choose
            let mutable lapBoundary = start.CompletedLaps
            let mutable cutState = start
            let measure state =
                lapBoundary <- lapBoundary + 1
                cutState <- { state with CompletedLaps = lapBoundary }
                renderHeatBoardForState (uint64 seed) cutState

            let cutAtLap measured _state = cut measured cutState

            let! outcome = SimLoop.run [ handler ] interruptSource measure cutAtLap clock budget ctx seed ticksPerLap start
            return stampCumulativeLaps start.CompletedLaps outcome
        }

    /// Run a bounded sim -> measure -> cut loop where the measurement is the
    /// host-visible CHIP-9 heat board. This is the Dark Hall room loop shape for
    /// production and tests alike: execution stays async in `SoftScheduler`,
    /// while `SimLoop` banks the board readout before deciding whether to keep
    /// going.
    let heatBoardSimLoop
        (name: string)
        (room: DarkHall.Room)
        (manifest: Chip9Capabilities.Manifest)
        (matches: InterruptKind -> bool)
        (sourceName: string)
        (sink: IHeatSink)
        (requestFor: RoomLoop.RequestResolver)
        (choose: Runtime.ControllerReadout -> RoomLoop.ControllerChoice)
        (interruptSource: SoftScheduler.Source)
        (clock: int -> int64)
        (budget: SimLoop.Budget)
        (ctx: IntrCtx)
        (seed: int64)
        (ticksPerLap: int)
        (cut: string list -> ScheduledRoomState -> bool)
        =
        let start = initial room manifest

        heatBoardSimLoopFromState
            name
            matches
            sourceName
            sink
            requestFor
            choose
            interruptSource
            clock
            budget
            ctx
            seed
            ticksPerLap
            cut
            start

    let private pointerSafe (value: string) : string =
        value
        |> Seq.map (fun c ->
            if System.Char.IsLetterOrDigit c || c = '-' || c = '_' then
                c
            else
                '-')
        |> Seq.toArray
        |> fun chars -> System.String(chars)

    let private continuationLoopId (loopId: string) : string =
        match pointerSafe loopId with
        | "" -> "darkhall"
        | id -> id

    /// Deterministic save pointer for the latest heat-board state. The pointer
    /// names the room/lap/tick boundary; the host decides where the actual save
    /// payload is written.
    let heatBoardStatePointer (loopId: string) (outcome: SimLoop.Outcome<ScheduledRoomState, string list>) : string =
        sprintf
            "saves/darkhall/%s/lap-%d-tick-%d.heat-board"
            (continuationLoopId loopId)
            outcome.Final.CompletedLaps
            outcome.Final.CompletedTicks

    let private heatBoardStatePointerPrefix (loopId: string) : string =
        sprintf "saves/darkhall/%s/" (continuationLoopId loopId)

    /// Mint the existing SimLoop continuation token for a heat-board run when
    /// the loop stopped on a budget rail. Cut-closed rooms and errored rooms do
    /// not respawn.
    let continueHeatBoardAfter
        (loopId: string)
        (outcome: SimLoop.Outcome<ScheduledRoomState, string list>)
        : SimLoop.Continuation option =
        match outcome.Stopped with
        | SimLoop.Stopped.LapBudget
        | SimLoop.Stopped.TickBudget
        | SimLoop.Stopped.ClockBudget ->
            Some
                { LoopId = continuationLoopId loopId
                  NextLap = outcome.Final.CompletedLaps
                  TicksSpent = List.length outcome.Laps
                  StatePointer = heatBoardStatePointer loopId outcome }
        | SimLoop.Stopped.CutChoseClose
        | SimLoop.Stopped.RoomError _ -> None

    let encodeHeatBoardContinuation
        (loopId: string)
        (outcome: SimLoop.Outcome<ScheduledRoomState, string list>)
        : string option =
        outcome |> continueHeatBoardAfter loopId |> Option.map SimLoop.encodeContinuation

    let private resumeBaseTick (nextLap: int) (ticksPerLap: int) : Result<int, HeatBoardContinuationFeedback> =
        let perLap = max 1 ticksPerLap
        let baseTick = int64 nextLap * int64 perLap
        let lastTickInLap = baseTick + int64 perLap - 1L

        if lastTickInLap > int64 System.Int32.MaxValue then
            Error(HeatBoardContinuationFeedback.ResumeTickOverflow(nextLap, perLap))
        else
            Ok(int baseTick)

    let private resumeLinkBaseTick
        (nextLap: int)
        (ticksPerLap: int)
        (budget: SimLoop.Budget)
        : Result<int, HeatBoardContinuationFeedback> =
        let perLap = int64 (max 1 ticksPerLap)
        let maxLaps = int64 (max 1 budget.MaxLaps)
        let maxTicks = int64 (max 1 budget.MaxTicks)
        let tickBoundedLaps = (maxTicks + perLap - 1L) / perLap
        let linkLaps = min maxLaps tickBoundedLaps
        let baseTick = int64 nextLap * perLap
        let lastTickInLink = baseTick + linkLaps * perLap - 1L
        let completedLapBoundary = int64 nextLap + linkLaps

        if
            lastTickInLink > int64 System.Int32.MaxValue
            || completedLapBoundary > int64 System.Int32.MaxValue
        then
            Error(HeatBoardContinuationFeedback.ResumeTickOverflow(nextLap, int perLap))
        else
            Ok(int baseTick)

    /// Admit a heat-board continuation token back through the Dark Hall boundary.
    /// Arbitrary `spawn:*` text is not authority: the token must parse, match the
    /// expected loop id, and point inside the heat-board save namespace before a
    /// host runner can use it to offset the next bounded lap.
    let admitHeatBoardContinuation
        (loopId: string)
        (ticksPerLap: int)
        (tokenLine: string)
        : Result<HeatBoardContinuationAdmission, HeatBoardContinuationFeedback> =
        match SimLoop.parseContinuation tokenLine with
        | None -> Error(HeatBoardContinuationFeedback.MalformedContinuation tokenLine)
        | Some token ->
            let expectedLoop = continuationLoopId loopId

            if token.LoopId <> expectedLoop then
                Error(HeatBoardContinuationFeedback.LoopIdMismatch(expectedLoop, token.LoopId))
            else
                let expectedPrefix = heatBoardStatePointerPrefix loopId

                if not (token.StatePointer.StartsWith(expectedPrefix, System.StringComparison.Ordinal)) then
                    Error(HeatBoardContinuationFeedback.StatePointerMismatch(expectedPrefix, token.StatePointer))
                else
                    resumeBaseTick token.NextLap ticksPerLap
                    |> Result.map (fun baseTick ->
                        { Token = token
                          StatePointer = token.StatePointer
                          ResumeBaseTick = baseTick })

    /// Offset the injected interrupt source for a resumed heat-board run. The
    /// source remains owned by the host; admission only tells it where the next
    /// finite link starts.
    let resumeHeatBoardSource
        (admission: HeatBoardContinuationAdmission)
        (source: SoftScheduler.Source)
        : SoftScheduler.Source =
        fun tick ->
            let absoluteTick = int64 admission.ResumeBaseTick + int64 tick

            if absoluteTick > int64 System.Int32.MaxValue then
                []
            else
                source (int absoluteTick)

    let saveHeatBoardStateAsync
        (store: IHeatBoardStateStore)
        (loopId: string)
        (outcome: SimLoop.Outcome<ScheduledRoomState, string list>)
        (ct: System.Threading.CancellationToken)
        : System.Threading.Tasks.Task<Result<string, HeatBoardContinuationFeedback>> =
        task {
            let pointer = heatBoardStatePointer loopId outcome
            let! saved = store.WriteAsync(pointer, outcome.Final, ct)

            return saved |> Result.map (fun () -> pointer)
        }

    /// Resume a heat-board loop from a previously saved state pointer. The token
    /// admission and the snapshot load both stay on the typed feedback channel;
    /// the returned `Outcome` is still one finite `SimLoop` link.
    let resumeHeatBoardSimLoop
        (loopId: string)
        (store: IHeatBoardStateStore)
        (name: string)
        (matches: InterruptKind -> bool)
        (sourceName: string)
        (sink: IHeatSink)
        (requestFor: RoomLoop.RequestResolver)
        (choose: Runtime.ControllerReadout -> RoomLoop.ControllerChoice)
        (interruptSource: SoftScheduler.Source)
        (clock: int -> int64)
        (budget: SimLoop.Budget)
        (ctx: IntrCtx)
        (seed: int64)
        (ticksPerLap: int)
        (cut: string list -> ScheduledRoomState -> bool)
        (tokenLine: string)
        (ct: System.Threading.CancellationToken)
        : System.Threading.Tasks.Task<Result<SimLoop.Outcome<ScheduledRoomState, string list>, HeatBoardContinuationFeedback>> =
        task {
            match admitHeatBoardContinuation loopId ticksPerLap tokenLine with
            | Error feedback -> return Error feedback
            | Ok admission ->
                match resumeLinkBaseTick admission.Token.NextLap ticksPerLap budget with
                | Error feedback -> return Error feedback
                | Ok baseTick ->
                    let admission = { admission with ResumeBaseTick = baseTick }
                    let! loaded = store.ReadAsync(admission.StatePointer, ct)

                    match loaded with
                    | Error feedback -> return Error feedback
                    | Ok start ->
                        if start.CompletedLaps <> admission.Token.NextLap then
                            return Error(HeatBoardContinuationFeedback.SnapshotLapMismatch(admission.Token.NextLap, start.CompletedLaps))
                        elif start.CompletedTicks <> admission.ResumeBaseTick then
                            return Error(HeatBoardContinuationFeedback.SnapshotTickMismatch(admission.ResumeBaseTick, start.CompletedTicks))
                        else
                            let resumedSource = resumeHeatBoardSource admission interruptSource

                            let! outcome =
                                heatBoardSimLoopFromState
                                    name
                                    matches
                                    sourceName
                                    sink
                                    requestFor
                                    choose
                                    resumedSource
                                    clock
                                    budget
                                    ctx
                                    seed
                                    ticksPerLap
                                    cut
                                    start

                            return Ok outcome
        }
