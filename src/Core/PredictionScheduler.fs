namespace Zeta.Core

open System
open System.Numerics
open System.Threading.Tasks

/// Scheduler adapter for the source-owned prediction kernel.
///
/// This is the small bridge from exact posterior inference to the soft
/// `IScheduler`: candidate generation and attention/gravity priority stay
/// pluggable, while the scheduler sees one budgeted state record and one
/// ordinary feedback channel.
[<RequireQualifiedAccess>]
module PredictionScheduler =

    type CandidateEstimator<'Inner, 'BranchState> =
        InterruptKind -> 'Inner -> Result<PredictionInference.Candidate<'BranchState> list, PredictionInference.Feedback>

    type PriorityEstimator<'BranchState> =
        PredictionInference.Scored<'BranchState> -> PredictionInference.BranchPriority

    type Planned<'Inner, 'BranchState> =
        { Inner: 'Inner
          Tank: SoftThrottle.Tank
          Tick: int
          LastPrediction: PredictionInference.Prediction<'BranchState> option
          PredictedBytes: int64
          DeferredBytes: int64 }

    let planned (inner: 'Inner) (tank: SoftThrottle.Tank) : Planned<'Inner, 'BranchState> =
        { Inner = inner
          Tank = tank
          Tick = 0
          LastPrediction = None
          PredictedBytes = 0L
          DeferredBytes = 0L }

    let private addBytesCapped (a: int64) (b: int64) : int64 =
        let sum = BigInteger a + BigInteger b
        if sum > BigInteger Int64.MaxValue then Int64.MaxValue else int64 sum

    let private growthFeedbackText =
        function
        | Vision.NegativeTargetBits bits -> sprintf "negative target bits: %d" bits
        | Vision.NegativeMeasuredBits bits -> sprintf "negative measured bits: %d" bits
        | Vision.NegativeSpaceBytes bytes -> sprintf "negative projected space bytes: %d" bytes
        | Vision.NegativeTimeTicks ticks -> sprintf "negative projected time ticks: %d" ticks
        | Vision.NegativeBytesPerTick bytes -> sprintf "negative bytes per tick: %d" bytes
        | Vision.NegativeUncertaintyResolutionBits bits -> sprintf "negative uncertainty resolution bits: %d" bits
        | Vision.ByteCostOverflow bytes -> sprintf "projected branch byte cost overflows int64: %O" bytes

    let private feedbackText =
        function
        | PredictionInference.EmptyCandidates -> "empty candidate set"
        | PredictionInference.NegativePrior(label, value) -> sprintf "negative prior for %s: %A" label value
        | PredictionInference.NegativeLikelihood(label, value) -> sprintf "negative likelihood for %s: %A" label value
        | PredictionInference.NegativeAttention(label, value) -> sprintf "negative attention for %s: %A" label value
        | PredictionInference.NegativeGravity(label, value) -> sprintf "negative gravity for %s: %A" label value
        | PredictionInference.AllCandidatesRefuted -> "all candidates refuted"
        | PredictionInference.VisionFeedback feedback -> growthFeedbackText feedback
        | PredictionInference.SoftValueRefuted -> "soft value refuted"

    let private asInterruptFeedback feedback =
        Failed("prediction scheduler: " + feedbackText feedback)

    let planWithPriority
        (estimate: CandidateEstimator<'Inner, 'BranchState>)
        (priorityOf: PriorityEstimator<'BranchState>)
        (intr: InterruptKind)
        (state: Planned<'Inner, 'BranchState>)
        : Result<Planned<'Inner, 'BranchState>, InterruptFeedback> =
        result {
            let! candidates =
                estimate intr state.Inner
                |> Result.mapError asInterruptFeedback

            let! prediction =
                candidates
                |> PredictionInference.inferAndPredictWithPriority priorityOf state.Tank
                |> Result.mapError asInterruptFeedback

            let report = prediction.Budget

            return
                { state with
                    Tank = report.TankAfter
                    Tick = state.Tick + 1
                    LastPrediction = Some prediction
                    PredictedBytes = addBytesCapped state.PredictedBytes report.BoardedBytes
                    DeferredBytes = addBytesCapped state.DeferredBytes report.DeferredBytes }
        }

    let plan
        (estimate: CandidateEstimator<'Inner, 'BranchState>)
        (intr: InterruptKind)
        (state: Planned<'Inner, 'BranchState>)
        : Result<Planned<'Inner, 'BranchState>, InterruptFeedback> =
        planWithPriority estimate (fun _ -> PredictionInference.neutralPriority) intr state

    let policyHandlerWithPriority
        (name: string)
        (estimate: CandidateEstimator<'Inner, 'BranchState>)
        (priorityOf: PriorityEstimator<'BranchState>)
        : SoftScheduler.HandlerK<Planned<'Inner, 'BranchState>> =
        SoftScheduler.handlerK name (fun _ -> true) (fun intr _ctx state ->
            Task.FromResult(planWithPriority estimate priorityOf intr state))

    let policyHandler
        (name: string)
        (estimate: CandidateEstimator<'Inner, 'BranchState>)
        : SoftScheduler.HandlerK<Planned<'Inner, 'BranchState>> =
        policyHandlerWithPriority name estimate (fun _ -> PredictionInference.neutralPriority)

    let wrapHandlerKWithPriority
        (estimate: CandidateEstimator<'Inner, 'BranchState>)
        (priorityOf: PriorityEstimator<'BranchState>)
        (handler: SoftScheduler.HandlerK<'Inner>)
        : SoftScheduler.HandlerK<Planned<'Inner, 'BranchState>> =
        SoftScheduler.handlerK
            ("prediction-" + handler.Name)
            handler.Matches
            (fun intr ctx state ->
                task {
                    match planWithPriority estimate priorityOf intr state with
                    | Error feedback ->
                        return Error feedback
                    | Ok plannedState ->
                        let! inner = handler.RunK intr ctx plannedState.Inner
                        return inner |> Result.map (fun next -> { plannedState with Inner = next })
                })

    let wrapHandlerK
        (estimate: CandidateEstimator<'Inner, 'BranchState>)
        (handler: SoftScheduler.HandlerK<'Inner>)
        : SoftScheduler.HandlerK<Planned<'Inner, 'BranchState>> =
        wrapHandlerKWithPriority estimate (fun _ -> PredictionInference.neutralPriority) handler
