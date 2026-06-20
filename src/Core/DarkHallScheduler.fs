namespace Zeta.Core

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

    type ScheduledRoomState =
        { Loop: RoomLoop.LoopState
          CompletedTicks: int
          LastTick: RoomLoop.TickOutcome option
          HeatRowsRev: HeatBoundaryRow list }

    let initial (room: DarkHall.Room) (manifest: Chip9Capabilities.Manifest) : ScheduledRoomState =
        { Loop = RoomLoop.initial room manifest
          CompletedTicks = 0
          LastTick = None
          HeatRowsRev = [] }

    let heatRows (state: ScheduledRoomState) : HeatBoundaryRow list =
        List.rev state.HeatRowsRev

    let lastHeatRow (state: ScheduledRoomState) : HeatBoundaryRow option =
        state.HeatRowsRev |> List.tryHead

    let backpressured (state: ScheduledRoomState) : bool =
        state.HeatRowsRev |> List.exists (fun row -> row.Backpressured > 0)

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

    let private rowOfOutcome (tick: int) (outcome: RoomLoop.TickOutcome) : HeatBoundaryRow =
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
          LastTick = Some outcome
          HeatRowsRev = rowOfOutcome tick outcome :: state.HeatRowsRev }

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
        let handler = roomTickHandler name matches sourceName sink requestFor choose
        let measure = renderHeatBoardForState (uint64 seed)
        let start = initial room manifest

        SimLoop.run [ handler ] interruptSource measure cut clock budget ctx seed ticksPerLap start

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
            (List.length outcome.Laps)
            outcome.Final.CompletedTicks

    /// Mint the existing SimLoop continuation token for a heat-board run when
    /// the loop stopped on a budget rail. Cut-closed rooms and errored rooms do
    /// not respawn.
    let continueHeatBoardAfter
        (loopId: string)
        (outcome: SimLoop.Outcome<ScheduledRoomState, string list>)
        : SimLoop.Continuation option =
        SimLoop.continueAfter (continuationLoopId loopId) (heatBoardStatePointer loopId outcome) outcome

    let encodeHeatBoardContinuation
        (loopId: string)
        (outcome: SimLoop.Outcome<ScheduledRoomState, string list>)
        : string option =
        outcome |> continueHeatBoardAfter loopId |> Option.map SimLoop.encodeContinuation
