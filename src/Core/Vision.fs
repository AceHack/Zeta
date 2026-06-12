namespace Zeta.Core

open System
open System.Numerics
open System.Threading.Tasks

/// Vision is the source-owned name for the cache/standing-query reading of
/// Zeta's DBSP core: cache = I(stream), vision = I(D(snapshot)), and subscribe
/// exposes paired cache deltas. The float side is not a fixed vector width; it
/// is a pluggable uncertainty-growth limiter over the UniversalNumber
/// resolution port, using the same stateful fold shape as SoftThrottle boats.
[<RequireQualifiedAccess>]
module Vision =

    type Cache<'K when 'K : comparison> =
        { Stream: Stream<ZSet<'K>> }

    type Subscription<'A, 'B when 'A : comparison and 'B : comparison> =
        { LeftDelta: Stream<ZSet<'A>>
          RightDelta: Stream<ZSet<'B>> }

    /// The cache identity: cache = I(deltaStream).
    let cache (deltas: Stream<ZSet<'K>>) : CircuitM<Cache<'K>> =
        CircuitM(fun c -> { Stream = c.IntegrateZSet deltas })

    /// The vision identity over full snapshots: vision = I(D(snapshotStream)).
    let vision (snapshots: Stream<ZSet<'K>>) : CircuitM<Cache<'K>> =
        CircuitM(fun c -> { Stream = c.IntegrateZSet(c.DifferentiateZSet snapshots) })

    /// Extract the current cache stream for downstream circuit operators.
    let stream (cache: Cache<'K>) : Stream<ZSet<'K>> = cache.Stream

    /// D(cache): expose the per-tick delta stream of a materialized cache.
    let deltas (cache: Cache<'K>) : CircuitM<Stream<ZSet<'K>>> =
        CircuitM(fun c -> c.DifferentiateZSet cache.Stream)

    /// subscribe: Cache A -> Cache B -> paired delta streams at the same tick.
    let subscribe (left: Cache<'A>) (right: Cache<'B>) : CircuitM<Subscription<'A, 'B>> =
        Dsl.circuit {
            let! leftDelta = deltas left
            let! rightDelta = deltas right
            return { LeftDelta = leftDelta; RightDelta = rightDelta }
        }

    let output (cache: Cache<'K>) : CircuitM<OutputHandle<ZSet<'K>>> =
        Dsl.output cache.Stream

    type GrowthFeedback =
        | NegativeTargetBits of bits: int
        | NegativeMeasuredBits of bits: int
        | NegativeSpaceBytes of bytes: int64
        | NegativeTimeTicks of ticks: int
        | NegativeBytesPerTick of bytes: int64
        | NegativeUncertaintyResolutionBits of bits: int
        | ByteCostOverflow of bytes: BigInteger

    type GrowthRequest<'T> =
        { Label: string
          Value: 'T
          TargetBits: int }

    type GrowthDecision =
        | Boarded
        | Deferred

    type GrowthGrant<'T> =
        { Request: GrowthRequest<'T>
          CurrentBits: int
          GrowthBits: int
          Decision: GrowthDecision
          TankBefore: SoftThrottle.Tank
          TankAfter: SoftThrottle.Tank }

    type UncertaintyLimiter<'a, 'state> = SoftThrottle.Limiter<'a, 'state>

    let growthBits
        (number: UniversalNumber.IUniversalNumber<'T>)
        (request: GrowthRequest<'T>)
        : Result<int, GrowthFeedback> =
        if request.TargetBits < 0 then
            Error(NegativeTargetBits request.TargetBits)
        else
            let current = number.BitsUsed request.Value
            if current < 0 then Error(NegativeMeasuredBits current)
            else Ok(max 0 (request.TargetBits - current))

    /// Pluggable policy hook: anything that can measure a proposed growth cost
    /// can reuse the same stateful boat fold as FerryThrottler/SoftThrottle.
    let costLimiter (costOf: 'a -> Result<int, GrowthFeedback>) : UncertaintyLimiter<'a, SoftThrottle.Tank> =
        fun item tank ->
            match costOf item with
            | Error _ -> false, tank
            | Ok cost ->
                match SoftThrottle.discharge (float (max 0 cost)) tank with
                | Some tank' -> true, tank'
                | None -> false, tank

    /// UniversalNumber-backed limiter: requested resolution above BitsUsed is
    /// the uncertainty-growth cost. BigFloat/TriFloat/Ball adapters plug in
    /// through this port; the limiter itself does not know the carrier.
    let uncertaintyLimiter
        (number: UniversalNumber.IUniversalNumber<'T>)
        : UncertaintyLimiter<GrowthRequest<'T>, SoftThrottle.Tank> =
        costLimiter (growthBits number)

    let boatGrowth
        (limiter: UncertaintyLimiter<'a, 'state>)
        (items: 'a list)
        (state: 'state)
        : 'a list * 'a list * 'state =
        SoftThrottle.boat limiter items state

    let boatUncertainty
        (number: UniversalNumber.IUniversalNumber<'T>)
        (items: GrowthRequest<'T> list)
        (tank: SoftThrottle.Tank)
        : GrowthRequest<'T> list * GrowthRequest<'T> list * SoftThrottle.Tank =
        boatGrowth (uncertaintyLimiter number) items tank

    let tryBoard
        (number: UniversalNumber.IUniversalNumber<'T>)
        (tank: SoftThrottle.Tank)
        (request: GrowthRequest<'T>)
        : Result<GrowthGrant<'T>, GrowthFeedback> =
        result {
            let current = number.BitsUsed request.Value
            if current < 0 then
                return! Error(NegativeMeasuredBits current)
            else
                let! cost = growthBits number request
                match SoftThrottle.discharge (float cost) tank with
                | Some tank' ->
                    return
                        { Request = request
                          CurrentBits = current
                          GrowthBits = cost
                          Decision = Boarded
                          TankBefore = tank
                          TankAfter = tank' }
                | None ->
                    return
                        { Request = request
                          CurrentBits = current
                          GrowthBits = cost
                          Decision = Deferred
                          TankBefore = tank
                          TankAfter = tank }
        }

    /// A future branch has both a spatial footprint (state/branch bytes) and a
    /// temporal footprint (ticks priced in bytes), plus the precision growth
    /// required to make that branch observable. The soft Zeus/Ferry policy can
    /// therefore budget "how much space", "how far into time", and "how much
    /// uncertainty to resolve" with one byte-denominated tank.
    type BranchCost =
        { SpaceBytes: int64
          TimeTicks: int
          BytesPerTick: int64
          UncertaintyResolutionBits: int }

    type FutureBranch<'S> =
        { Label: string
          State: 'S
          Cost: BranchCost }

    type PredictionOutcome =
        | Admitted
        | PartiallyAdmitted
        | RejectedWithBackpressure
        | CappedAccounting

    type PredictionReport<'S> =
        { Requested: FutureBranch<'S> list
          Boarded: FutureBranch<'S> list
          Deferred: FutureBranch<'S> list
          RequestedBytes: int64
          BoardedBytes: int64
          DeferredBytes: int64
          TankBefore: SoftThrottle.Tank
          TankAfter: SoftThrottle.Tank
          Outcome: PredictionOutcome
          Starved: bool
          Confidence: float }

    type Budgeted<'S> =
        { Inner: 'S
          Tank: SoftThrottle.Tank
          Tick: int
          LastPrediction: PredictionReport<'S> option
          PredictedBytes: int64
          DeferredBytes: int64 }

    type BranchEstimator<'S> = InterruptKind -> 'S -> FutureBranch<'S> list

    let budgeted (inner: 'S) (tank: SoftThrottle.Tank) : Budgeted<'S> =
        { Inner = inner
          Tank = tank
          Tick = 0
          LastPrediction = None
          PredictedBytes = 0L
          DeferredBytes = 0L }

    let private branchBytesCapped (cost: BranchCost) : Result<int64 * bool, GrowthFeedback> =
        if cost.SpaceBytes < 0L then
            Error(NegativeSpaceBytes cost.SpaceBytes)
        elif cost.TimeTicks < 0 then
            Error(NegativeTimeTicks cost.TimeTicks)
        elif cost.BytesPerTick < 0L then
            Error(NegativeBytesPerTick cost.BytesPerTick)
        elif cost.UncertaintyResolutionBits < 0 then
            Error(NegativeUncertaintyResolutionBits cost.UncertaintyResolutionBits)
        else
            let uncertaintyBytes =
                (BigInteger cost.UncertaintyResolutionBits + BigInteger 7) / BigInteger 8
            let total =
                BigInteger cost.SpaceBytes
                + BigInteger cost.TimeTicks * BigInteger cost.BytesPerTick
                + uncertaintyBytes
            if total > BigInteger Int64.MaxValue then Ok(Int64.MaxValue, true)
            else Ok(int64 total, false)

    let branchBytes (cost: BranchCost) : Result<int64, GrowthFeedback> =
        branchBytesCapped cost |> Result.map fst

    let branchLimiter (branch: FutureBranch<'S>) (tank: SoftThrottle.Tank) : bool * SoftThrottle.Tank =
        match branchBytesCapped branch.Cost with
        | Error _ -> false, tank
        | Ok(bytes, _) ->
            match SoftThrottle.discharge (float bytes) tank with
            | Some tank' -> true, tank'
            | None -> false, tank

    let private sumBranchBytes (branches: FutureBranch<'S> list) : Result<int64 * bool, GrowthFeedback> =
        let rec loop (acc: BigInteger) capped rest =
            match rest with
            | [] ->
                if acc > BigInteger Int64.MaxValue then Ok(Int64.MaxValue, true)
                else Ok(int64 acc, capped)
            | branch :: tail ->
                result {
                    let! cost, wasCapped = branchBytesCapped branch.Cost
                    return! loop (acc + BigInteger cost) (capped || wasCapped) tail
                }
        loop BigInteger.Zero false branches

    let private addBytesCapped (a: int64) (b: int64) : int64 =
        let sum = BigInteger a + BigInteger b
        if sum > BigInteger Int64.MaxValue then Int64.MaxValue else int64 sum

    /// Board the affordable prefix of projected futures, zero-wait, using the
    /// same limiter fold as the soft FerryThrottler. Deferred futures are not
    /// lost; they are reported as self-known uncertainty.
    let predictBranches
        (branches: FutureBranch<'S> list)
        (tank: SoftThrottle.Tank)
        : Result<PredictionReport<'S>, GrowthFeedback> =
        result {
            let! requestedBytes, requestedCapped = sumBranchBytes branches
            let boarded, deferred, tank' = SoftThrottle.boat branchLimiter branches tank
            let! boardedBytes, boardedCapped = sumBranchBytes boarded
            let! deferredBytes, deferredCapped = sumBranchBytes deferred
            let wasCapped = requestedCapped || boardedCapped || deferredCapped
            let outcome =
                if wasCapped then CappedAccounting
                elif List.isEmpty deferred then Admitted
                elif List.isEmpty boarded then RejectedWithBackpressure
                else PartiallyAdmitted
            let confidence =
                if requestedBytes = 0L then 1.0
                else float boardedBytes / float requestedBytes
            return
                { Requested = branches
                  Boarded = boarded
                  Deferred = deferred
                  RequestedBytes = requestedBytes
                  BoardedBytes = boardedBytes
                  DeferredBytes = deferredBytes
                  TankBefore = tank
                  TankAfter = tank'
                  Outcome = outcome
                  Starved = not (List.isEmpty deferred)
                  Confidence = confidence }
        }

    let private growthErrorText =
        function
        | NegativeTargetBits bits -> sprintf "negative target bits: %d" bits
        | NegativeMeasuredBits bits -> sprintf "negative measured bits from UniversalNumber.BitsUsed: %d" bits
        | NegativeSpaceBytes bytes -> sprintf "negative projected space bytes: %d" bytes
        | NegativeTimeTicks ticks -> sprintf "negative projected time ticks: %d" ticks
        | NegativeBytesPerTick bytes -> sprintf "negative bytes per tick: %d" bytes
        | NegativeUncertaintyResolutionBits bits -> sprintf "negative uncertainty resolution bits: %d" bits
        | ByteCostOverflow bytes -> sprintf "projected branch byte cost overflows int64: %O" bytes

    /// Scheduler-facing policy handler. It observes each boundary crossing,
    /// asks the room for its projected future branches, funds the affordable
    /// prefix from the tank, and records the self-prediction report in state.
    let budgetPolicyHandler
        (name: string)
        (estimate: BranchEstimator<'S>)
        : SoftScheduler.HandlerK<Budgeted<'S>> =
        SoftScheduler.handlerK name (fun _ -> true) (fun intr _ctx state ->
            task {
                match predictBranches (estimate intr state.Inner) state.Tank with
                | Ok report ->
                    return
                        Ok
                            { state with
                                Tank = report.TankAfter
                                Tick = state.Tick + 1
                                LastPrediction = Some report
                                PredictedBytes = addBytesCapped state.PredictedBytes report.BoardedBytes
                                DeferredBytes = addBytesCapped state.DeferredBytes report.DeferredBytes }
                | Error feedback ->
                    return Error(Failed("vision budget policy: " + growthErrorText feedback))
            })

    /// Wrap an arrival-aware scheduler handler so prediction and action ride
    /// together. The policy does not hide uncertainty: if branches are
    /// deferred, the inner state still advances, but LastPrediction records the
    /// byte-denominated shortfall for the room to react to.
    let wrapHandlerK
        (estimate: BranchEstimator<'S>)
        (handler: SoftScheduler.HandlerK<'S>)
        : SoftScheduler.HandlerK<Budgeted<'S>> =
        SoftScheduler.handlerK
            ("vision-" + handler.Name)
            handler.Matches
            (fun intr ctx state ->
                task {
                    match predictBranches (estimate intr state.Inner) state.Tank with
                    | Error feedback ->
                        return Error(Failed("vision budget policy: " + growthErrorText feedback))
                    | Ok report ->
                        let policyState =
                            { state with
                                Tank = report.TankAfter
                                Tick = state.Tick + 1
                                LastPrediction = Some report
                                PredictedBytes = addBytesCapped state.PredictedBytes report.BoardedBytes
                                DeferredBytes = addBytesCapped state.DeferredBytes report.DeferredBytes }
                        let! inner = handler.RunK intr ctx policyState.Inner
                        return
                            inner
                            |> Result.map (fun next ->
                                { policyState with Inner = next })
                })

[<AutoOpen>]
module VisionComputation =
    /// Computation-expression alias for the vision/cache layer. The builder is
    /// the existing circuit CE; Vision supplies the named I/D vocabulary that
    /// runs inside it.
    let vision = Dsl.circuit
