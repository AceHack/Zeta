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
