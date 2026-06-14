namespace Zeta.Core

/// CHIP-8 room wiring over the source-owned prediction scheduler.
///
/// The same value can run under `SimFramework.runK`, a recorded membrane, or a
/// later production room runner. Tests are adapters to this room shape; the
/// prediction and emulator execution path is the same.
[<RequireQualifiedAccess>]
module Chip8PredictionRoom =

    type State = PredictionScheduler.Planned<Chip8Cow.Frame, Chip8Cow.Frame>

    type BeliefEstimator =
        InterruptKind -> Chip8Cow.Frame -> ReflectionEngine.Belief

    type BranchCostEstimator =
        Chip8Cow.Frame -> Vision.BranchCost

    type PriorityEstimator =
        PredictionInference.Scored<Chip8Cow.Frame> -> PredictionInference.BranchPriority

    let state (frame: Chip8Cow.Frame) (tank: SoftThrottle.Tank) : State =
        PredictionScheduler.planned frame tank

    let load (seed: uint64) (rom: byte[]) (tank: SoftThrottle.Tank) : State =
        state (Chip8Cow.create seed |> Chip8Cow.loadRom rom) tank

    let inputHandler: SoftScheduler.HandlerK<State> =
        PredictionScheduler.liftHandlerK SoftChip8Flux.inputHandler

    let private timerExecutionHandler (cyclesPerTick: int) : SoftScheduler.HandlerK<Chip8Cow.Frame> =
        SoftScheduler.handlerK
            "chip8-predicted-60hz"
            (function
            | TimerElapsed _ -> true
            | _ -> false)
            (fun _ _ctx frame ->
                let ticked = Chip8Cow.tick frame
                let advanced =
                    if SoftChip8.branchesOnInput ticked then
                        let committed = SoftChip8.resolve ticked.Keys ticked
                        SoftChip8.lookAhead (cyclesPerTick - 1) committed |> fst
                    else
                        SoftChip8.lookAhead cyclesPerTick ticked |> fst

                System.Threading.Tasks.Task.FromResult(Ok advanced))

    let timerHandlerWithPriority
        (cyclesPerTick: int)
        (beliefOf: BeliefEstimator)
        (costOf: BranchCostEstimator)
        (priorityOf: PriorityEstimator)
        : SoftScheduler.HandlerK<State> =
        let estimate intr frame =
            Chip8Observer.inferenceCandidates (beliefOf intr frame) costOf frame

        timerExecutionHandler cyclesPerTick
        |> PredictionScheduler.wrapHandlerKWithPriority estimate priorityOf

    let timerHandler
        (cyclesPerTick: int)
        (beliefOf: BeliefEstimator)
        (costOf: BranchCostEstimator)
        : SoftScheduler.HandlerK<State> =
        timerHandlerWithPriority cyclesPerTick beliefOf costOf (fun _ -> PredictionInference.neutralPriority)

    let handlersWithPriority
        (cyclesPerTick: int)
        (beliefOf: BeliefEstimator)
        (costOf: BranchCostEstimator)
        (priorityOf: PriorityEstimator)
        : SoftScheduler.HandlerK<State> list =
        [ inputHandler
          timerHandlerWithPriority cyclesPerTick beliefOf costOf priorityOf ]

    let handlers
        (cyclesPerTick: int)
        (beliefOf: BeliefEstimator)
        (costOf: BranchCostEstimator)
        : SoftScheduler.HandlerK<State> list =
        handlersWithPriority cyclesPerTick beliefOf costOf (fun _ -> PredictionInference.neutralPriority)

    let roomWithPriority
        (name: string)
        (rom: byte[])
        (tank: SoftThrottle.Tank)
        (cyclesPerTick: int)
        (budget: int)
        (source: int64 -> SoftScheduler.Source)
        (resolved: State -> bool)
        (beliefOf: BeliefEstimator)
        (costOf: BranchCostEstimator)
        (priorityOf: PriorityEstimator)
        : SimFramework.RoomK<State> =
        { Name = name
          Initial = fun seed -> load (uint64 seed) rom tank
          HandlersK = handlersWithPriority cyclesPerTick beliefOf costOf priorityOf
          Source = source
          Budget = budget
          Resolved = resolved }

    let room
        (name: string)
        (rom: byte[])
        (tank: SoftThrottle.Tank)
        (cyclesPerTick: int)
        (budget: int)
        (source: int64 -> SoftScheduler.Source)
        (resolved: State -> bool)
        (beliefOf: BeliefEstimator)
        (costOf: BranchCostEstimator)
        : SimFramework.RoomK<State> =
        roomWithPriority
            name
            rom
            tank
            cyclesPerTick
            budget
            source
            resolved
            beliefOf
            costOf
            (fun _ -> PredictionInference.neutralPriority)
