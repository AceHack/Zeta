namespace Zeta.Core

open System
open System.Numerics

/// CHIP-8 room wiring over the source-owned prediction scheduler.
///
/// The same value can run under `SimFramework.runK`, a recorded membrane, or a
/// later production room runner. Tests are adapters to this room shape; the
/// prediction and emulator execution path is the same.
[<RequireQualifiedAccess>]
module Chip8PredictionRoom =

    type Runtime =
        { Frame: Chip8Cow.Frame
          RunKey: Chip8CrossRunStore.RunKey option
          LastConsultation: RoomConsultation.Receipt option
          ReusedUnits: int64
          ComputedUnits: int64
          LookupAttempts: int64 }

    type State = PredictionScheduler.Planned<Runtime, Chip8Cow.Frame>

    type Consultation =
        { Reader: Chip8CrossRunStore.Reader
          Cost: RoomConsultation.CostPolicy }

    type BeliefEstimator =
        InterruptKind -> Chip8Cow.Frame -> ReflectionEngine.Belief

    type BranchCostEstimator =
        Chip8Cow.Frame -> Vision.BranchCost

    type PriorityEstimator =
        PredictionInference.Scored<Chip8Cow.Frame> -> PredictionInference.BranchPriority

    let private runtime (frame: Chip8Cow.Frame) (runKey: Chip8CrossRunStore.RunKey option) : Runtime =
        { Frame = frame
          RunKey = runKey
          LastConsultation = None
          ReusedUnits = 0L
          ComputedUnits = 0L
          LookupAttempts = 0L }

    let state (frame: Chip8Cow.Frame) (tank: SoftThrottle.Tank) : State =
        PredictionScheduler.planned (runtime frame None) tank

    let load (seed: uint64) (rom: byte[]) (tank: SoftThrottle.Tank) : State =
        let frame = Chip8Cow.create seed |> Chip8Cow.loadRom rom
        let key = Chip8CrossRunStore.runKey rom seed Chip8.ProgramStart "chip8"
        PredictionScheduler.planned (runtime frame (Some key)) tank

    let frame (state: State) : Chip8Cow.Frame = state.Inner.Frame

    let consultation (reader: Chip8CrossRunStore.Reader) (cost: RoomConsultation.CostPolicy) : Consultation =
        { Reader = reader; Cost = cost }

    let private liftFrameHandler (handler: SoftScheduler.HandlerK<Chip8Cow.Frame>) : SoftScheduler.HandlerK<Runtime> =
        SoftScheduler.handlerK handler.Name handler.Matches (fun intr ctx current ->
            task {
                let! result = handler.RunK intr ctx current.Frame
                return result |> Result.map (fun next -> { current with Frame = next })
            })

    let inputHandler: SoftScheduler.HandlerK<State> =
        SoftChip8Flux.inputHandler
        |> liftFrameHandler
        |> PredictionScheduler.liftHandlerK

    let private addCapped (total: int64) (increment: int) : int64 =
        let sum = BigInteger total + BigInteger increment
        if sum > BigInteger Int64.MaxValue then Int64.MaxValue else int64 sum

    let private feedbackText =
        function
        | RoomConsultation.NegativeRequestedUnits units -> sprintf "negative requested transition units: %d" units
        | RoomConsultation.NegativeLookupBytesPerAttempt bytes ->
            sprintf "negative lookup bytes per attempt: %d" bytes
        | RoomConsultation.NegativeComputeBytesPerUnit bytes ->
            sprintf "negative compute bytes per transition unit: %d" bytes
        | RoomConsultation.CostPolicyUnattributed -> "consultation cost policy is unattributed"

    let private includeComputedPrefix
        (policy: RoomConsultation.CostPolicy)
        (computedPrefix: int)
        (receipt: RoomConsultation.Receipt)
        : RoomConsultation.Receipt =
        let bytes = BigInteger computedPrefix * BigInteger policy.ComputeBytesPerUnit
        { receipt with
            RequestedUnits = receipt.RequestedUnits + computedPrefix
            ComputedUnits = receipt.ComputedUnits + computedPrefix
            ProjectedComputeBytes = receipt.ProjectedComputeBytes + bytes }

    let private directAdvance (cyclesPerTick: int) (ticked: Chip8Cow.Frame) : Chip8Cow.Frame =
        if cyclesPerTick > 0 && SoftChip8.branchesOnInput ticked then
            let committed = SoftChip8.resolve ticked.Keys ticked
            SoftChip8.lookAhead (cyclesPerTick - 1) committed |> fst
        else
            SoftChip8.lookAhead cyclesPerTick ticked |> fst

    let private consultAdvance
        (cyclesPerTick: int)
        (configured: Consultation)
        (current: Runtime)
        (ticked: Chip8Cow.Frame)
        : Result<Runtime, InterruptFeedback> =
        RoomConsultation.validateCostPolicy configured.Cost
        |> Result.bind (fun validCost ->
            let requested = max 0 cyclesPerTick
            let start, computedPrefix =
                if requested > 0 && SoftChip8.branchesOnInput ticked then
                    SoftChip8.resolve ticked.Keys ticked, 1
                else
                    ticked, 0

            let port: RoomConsultation.Port<Chip8Cow.Frame> =
                { TryAdvanceOne =
                    fun state ->
                        match current.RunKey with
                        | Some key -> Chip8CrossRunStore.fastForward configured.Reader key state 1
                        | None -> None }

            RoomConsultation.advance
                validCost
                SoftChip8.branchesOnInput
                Chip8Cow.step
                port
                (requested - computedPrefix)
                start
            |> Result.map (fun advanced -> validCost, computedPrefix, advanced))
        |> Result.mapError (fun feedback -> Failed("chip8 consultation: " + feedbackText feedback))
        |> Result.map (fun (validCost, computedPrefix, advanced) ->
            let receipt = includeComputedPrefix validCost computedPrefix advanced.Receipt
            { current with
                Frame = advanced.State
                LastConsultation = Some receipt
                ReusedUnits = addCapped current.ReusedUnits receipt.ReusedUnits
                ComputedUnits = addCapped current.ComputedUnits receipt.ComputedUnits
                LookupAttempts = addCapped current.LookupAttempts receipt.LookupAttempts })

    let private timerExecutionHandler
        (cyclesPerTick: int)
        (configured: Consultation option)
        : SoftScheduler.HandlerK<Runtime> =
        SoftScheduler.handlerK
            (if configured.IsSome then "chip8-consulting-predicted-60hz" else "chip8-predicted-60hz")
            (function
            | TimerElapsed _ -> true
            | _ -> false)
            (fun _ _ctx current ->
                let ticked = Chip8Cow.tick current.Frame
                match configured with
                | None ->
                    let advanced = directAdvance cyclesPerTick ticked
                    System.Threading.Tasks.Task.FromResult(Ok { current with Frame = advanced; LastConsultation = None })
                | Some consultation ->
                    consultAdvance cyclesPerTick consultation current ticked
                    |> System.Threading.Tasks.Task.FromResult)

    let private timerHandlerCore
        (cyclesPerTick: int)
        (configured: Consultation option)
        (beliefOf: BeliefEstimator)
        (costOf: BranchCostEstimator)
        (priorityOf: PriorityEstimator)
        : SoftScheduler.HandlerK<State> =
        let estimate intr current =
            Chip8Observer.inferenceCandidates (beliefOf intr current.Frame) costOf current.Frame

        timerExecutionHandler cyclesPerTick configured
        |> PredictionScheduler.wrapHandlerKWithPriority estimate priorityOf

    let timerHandlerWithPriority
        (cyclesPerTick: int)
        (beliefOf: BeliefEstimator)
        (costOf: BranchCostEstimator)
        (priorityOf: PriorityEstimator)
        : SoftScheduler.HandlerK<State> =
        timerHandlerCore cyclesPerTick None beliefOf costOf priorityOf

    let timerHandlerConsultingWithPriority
        (cyclesPerTick: int)
        (configured: Consultation)
        (beliefOf: BeliefEstimator)
        (costOf: BranchCostEstimator)
        (priorityOf: PriorityEstimator)
        : SoftScheduler.HandlerK<State> =
        timerHandlerCore cyclesPerTick (Some configured) beliefOf costOf priorityOf

    let timerHandler
        (cyclesPerTick: int)
        (beliefOf: BeliefEstimator)
        (costOf: BranchCostEstimator)
        : SoftScheduler.HandlerK<State> =
        timerHandlerWithPriority cyclesPerTick beliefOf costOf (fun _ -> PredictionInference.neutralPriority)

    let timerHandlerConsulting
        (cyclesPerTick: int)
        (configured: Consultation)
        (beliefOf: BeliefEstimator)
        (costOf: BranchCostEstimator)
        : SoftScheduler.HandlerK<State> =
        timerHandlerConsultingWithPriority
            cyclesPerTick
            configured
            beliefOf
            costOf
            (fun _ -> PredictionInference.neutralPriority)

    let handlersWithPriority
        (cyclesPerTick: int)
        (beliefOf: BeliefEstimator)
        (costOf: BranchCostEstimator)
        (priorityOf: PriorityEstimator)
        : SoftScheduler.HandlerK<State> list =
        [ inputHandler
          timerHandlerWithPriority cyclesPerTick beliefOf costOf priorityOf ]

    let handlersConsultingWithPriority
        (cyclesPerTick: int)
        (configured: Consultation)
        (beliefOf: BeliefEstimator)
        (costOf: BranchCostEstimator)
        (priorityOf: PriorityEstimator)
        : SoftScheduler.HandlerK<State> list =
        [ inputHandler
          timerHandlerConsultingWithPriority cyclesPerTick configured beliefOf costOf priorityOf ]

    let handlers
        (cyclesPerTick: int)
        (beliefOf: BeliefEstimator)
        (costOf: BranchCostEstimator)
        : SoftScheduler.HandlerK<State> list =
        handlersWithPriority cyclesPerTick beliefOf costOf (fun _ -> PredictionInference.neutralPriority)

    let handlersConsulting
        (cyclesPerTick: int)
        (configured: Consultation)
        (beliefOf: BeliefEstimator)
        (costOf: BranchCostEstimator)
        : SoftScheduler.HandlerK<State> list =
        handlersConsultingWithPriority
            cyclesPerTick
            configured
            beliefOf
            costOf
            (fun _ -> PredictionInference.neutralPriority)

    let private roomCore
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
        (configured: Consultation option)
        : SimFramework.RoomK<State> =
        { Name = name
          Initial = fun seed -> load (uint64 seed) rom tank
          HandlersK =
            match configured with
            | Some consultation ->
                handlersConsultingWithPriority cyclesPerTick consultation beliefOf costOf priorityOf
            | None -> handlersWithPriority cyclesPerTick beliefOf costOf priorityOf
          Source = source
          Budget = budget
          Resolved = resolved }

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
        roomCore name rom tank cyclesPerTick budget source resolved beliefOf costOf priorityOf None

    let roomConsultingWithPriority
        (name: string)
        (rom: byte[])
        (tank: SoftThrottle.Tank)
        (cyclesPerTick: int)
        (configured: Consultation)
        (budget: int)
        (source: int64 -> SoftScheduler.Source)
        (resolved: State -> bool)
        (beliefOf: BeliefEstimator)
        (costOf: BranchCostEstimator)
        (priorityOf: PriorityEstimator)
        : SimFramework.RoomK<State> =
        roomCore name rom tank cyclesPerTick budget source resolved beliefOf costOf priorityOf (Some configured)

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

    let roomConsulting
        (name: string)
        (rom: byte[])
        (tank: SoftThrottle.Tank)
        (cyclesPerTick: int)
        (configured: Consultation)
        (budget: int)
        (source: int64 -> SoftScheduler.Source)
        (resolved: State -> bool)
        (beliefOf: BeliefEstimator)
        (costOf: BranchCostEstimator)
        : SimFramework.RoomK<State> =
        roomConsultingWithPriority
            name
            rom
            tank
            cyclesPerTick
            configured
            budget
            source
            resolved
            beliefOf
            costOf
            (fun _ -> PredictionInference.neutralPriority)
