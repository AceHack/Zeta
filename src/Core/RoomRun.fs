namespace Zeta.Core

open System.Threading.Tasks

/// Small room-run harnesses that compose production-shaped pieces without
/// becoming a second runtime. The first slice makes the shared heat boundary
/// explicit: one injected `IHeatSink` observes both the Dark Hall room boundary
/// and the soft CHIP-8 lookahead boundary.
[<RequireQualifiedAccess>]
module RoomRun =

    module RoomLoop = DarkHallRoomLoop
    module Runtime = DarkHallCabinetRuntime
    module Scheduler = DarkHallScheduler

    type BoundaryTickPlan<'K when 'K : comparison> =
        { HandlerName: string
          Matches: InterruptKind -> bool
          SourceName: string
          RequestFor: RoomLoop.RequestResolver
          BoundaryFor: RoomLoop.BoundaryRequestResolver<'K>
          Choose: Runtime.ControllerReadout -> RoomLoop.ControllerChoice
          Interrupts: SoftScheduler.Source
          Context: IntrCtx
          Seed: int64 }

    type SoftDrivePlan =
        { SourceName: string
          Value: Chip8Cow.Frame -> float
          CyclesPerFrame: int
          Depth: int
          Width: int
          Frames: int
          Start: Chip8Cow.Frame }

    type UnifiedHeatRun<'K when 'K : comparison> =
        { Room: Scheduler.BoundaryScheduledRoomState<'K>
          SoftFrame: Chip8Cow.Frame
          BoundaryHeatRows: Scheduler.HeatBoundaryRow list }

    [<RequireQualifiedAccess>]
    type UnifiedHeatFeedback<'K when 'K : comparison> =
        | SchedulerFeedback of InterruptFeedback
        | SoftDriveFeedback of room: Scheduler.BoundaryScheduledRoomState<'K> * feedback: HeatSinkFeedback

    /// Run one boundary-aware scheduler tick and then one soft-drive window
    /// through the same heat sink. If the soft lookahead cannot export heat,
    /// the room state already produced by the boundary tick is returned with
    /// typed feedback so callers can keep the host-visible transcript.
    let boundaryTickThenSoftDrive
        (sink: IHeatSink)
        (boundaryPlan: BoundaryTickPlan<'K>)
        (softPlan: SoftDrivePlan)
        (state: Scheduler.BoundaryScheduledRoomState<'K>)
        : Task<Result<UnifiedHeatRun<'K>, UnifiedHeatFeedback<'K>>> =
        task {
            let handler =
                Scheduler.boundaryRoomTickHandler
                    boundaryPlan.HandlerName
                    boundaryPlan.Matches
                    boundaryPlan.SourceName
                    sink
                    boundaryPlan.RequestFor
                    boundaryPlan.BoundaryFor
                    boundaryPlan.Choose

            let! roomResult =
                (SoftScheduler.driveK [ handler ] boundaryPlan.Interrupts)
                    .Run
                    boundaryPlan.Context
                    boundaryPlan.Seed
                    state
                    1

            match roomResult with
            | Error feedback -> return Error(UnifiedHeatFeedback.SchedulerFeedback feedback)
            | Ok room ->
                match
                    SoftDrive.driveFramesWithHeatSink
                        softPlan.SourceName
                        sink
                        softPlan.Value
                        softPlan.CyclesPerFrame
                        softPlan.Depth
                        softPlan.Width
                        softPlan.Frames
                        softPlan.Start
                with
                | Ok frame ->
                    return
                        Ok
                            { Room = room
                              SoftFrame = frame
                              BoundaryHeatRows = Scheduler.boundaryHeatRows room }

                | Error feedback -> return Error(UnifiedHeatFeedback.SoftDriveFeedback(room, feedback))
        }
