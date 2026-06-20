namespace Zeta.Core

open System

/// A finite room-facing horizon over Vision predictions.
///
/// The soft tank answers "which futures can we honestly pay for in bytes?"
/// The bounded G-set answers "which paid future keys fit in this room-sized
/// exterior view?" Keeping the two reports separate prevents attention from
/// rewriting arithmetic truth: attention/gravity may reorder boarding, but
/// byte cost and finite capacity still backpressure.
[<RequireQualifiedAccess>]
module RoomHorizon =

    module PS = ProbabilitySemiring

    type Candidate<'K, 'S when 'K : comparison> =
        { Key: 'K
          Branch: Vision.FutureBranch<'S>
          Priority: PredictionInference.BranchPriority }

    type Feedback =
        | NegativeAttention of label: string * value: PS.Rational
        | NegativeGravity of label: string * value: PS.Rational
        | InferenceFeedback of PredictionInference.Feedback
        | VisionFeedback of Vision.GrowthFeedback
        | HorizonFeedback of BoundedGSetError

    type Report<'K, 'S when 'K : comparison> =
        { HorizonBefore: BoundedGSet<'K>
          HorizonAfter: BoundedGSet<'K>
          Ordered: Candidate<'K, 'S> list
          Boarded: Candidate<'K, 'S> list
          Deferred: Candidate<'K, 'S> list
          RetainedKeys: GSet<'K>
          RejectedByHorizon: GSet<'K>
          HorizonHeat: BoundedGSetHeat<'K>
          Prediction: Vision.PredictionReport<'S> }

    type InferenceReport<'K, 'S when 'K : comparison> =
        { Inference: PredictionInference.Inference<'S>
          Ranked: PredictionInference.RankedBranch<'S> list
          Horizon: Report<'K, 'S> }

    let private positiveSignature (source: string) (kind: string) (units: int) (detail: string) : HeatSignature option =
        if units <= 0 then
            None
        else
            Some(HeatSignature.ofMass source kind units (float units) detail)

    /// Host-facing heat signatures for finite horizon pressure.
    ///
    /// Deferred futures are intentionally cold: the byte tank could not afford
    /// them yet, so no information entered the room and nothing was erased.
    /// Forgotten materialized keys are heat. Paid futures that still cannot fit
    /// the finite exterior view are backpressure heat.
    let heatSignatures (source: string) (report: Report<'K, 'S>) : HeatSignature list =
        [ positiveSignature
              source
              "room-horizon.forgotten"
              report.HorizonHeat.Units
              "bounded horizon forgot materialized keys"
          positiveSignature
              source
              "room-horizon.backpressure"
              (GSet.count report.RejectedByHorizon)
              "paid futures could not enter the finite horizon" ]
        |> List.choose id

    /// Emit finite horizon heat through an injected host/room boundary.
    let emitHeat (sink: IHeatSink) (source: string) (report: Report<'K, 'S>) : Result<unit, HeatSinkFeedback> =
        let rec loop signatures =
            result {
                match signatures with
                | [] -> return ()
                | signature :: tail ->
                    do! sink.Emit signature
                    return! loop tail
            }

        report |> heatSignatures source |> loop

    let private nonNegative (r: PS.Rational) : bool =
        PS.compare r PS.zero >= 0

    let private priorityWeight (candidate: Candidate<'K, 'S>) : PS.Rational =
        candidate.Priority.Attention
        |> PS.mul candidate.Priority.Gravity

    let private compareCandidates (left: Candidate<'K, 'S>) (right: Candidate<'K, 'S>) : int =
        let byPriority = PS.compare (priorityWeight right) (priorityWeight left)

        if byPriority <> 0 then
            byPriority
        else
            let byKey = (Collation.forKey<'K>()).Compare(left.Key, right.Key)

            if byKey <> 0 then
                byKey
            else
                StringComparer.Ordinal.Compare(left.Branch.Label, right.Branch.Label)

    let ordered (candidates: Candidate<'K, 'S> list) : Result<Candidate<'K, 'S> list, Feedback> =
        let rec loop acc rest =
            result {
                match rest with
                | [] -> return List.sortWith compareCandidates acc
                | candidate :: tail ->
                    if not (nonNegative candidate.Priority.Attention) then
                        return! Error(NegativeAttention(candidate.Branch.Label, candidate.Priority.Attention))
                    elif not (nonNegative candidate.Priority.Gravity) then
                        return! Error(NegativeGravity(candidate.Branch.Label, candidate.Priority.Gravity))
                    else
                        return! loop (candidate :: acc) tail
            }

        loop [] candidates

    let private applyVisible
        (current: BoundedGSet<'K>)
        (boarded: Candidate<'K, 'S> list)
        : Result<BoundedGSet<'K> * GSet<'K> * GSet<'K> * BoundedGSetHeat<'K>, Feedback> =
        let rec loop state retained rejected forgotten rest =
            result {
                match rest with
                | [] ->
                    return
                        state,
                        retained,
                        rejected,
                        { Forgotten = forgotten
                          Units = GSet.count forgotten }
                | candidate :: tail ->
                    let! addResult =
                        BoundedGSet.add candidate.Key state
                        |> Result.mapError HorizonFeedback

                    let retained' =
                        match addResult.Admission with
                        | BoundedGSetAdmission.RejectedByBound -> retained
                        | BoundedGSetAdmission.Admitted
                        | BoundedGSetAdmission.AlreadyPresent -> GSet.add candidate.Key retained

                    let rejected' =
                        match addResult.Admission with
                        | BoundedGSetAdmission.RejectedByBound -> GSet.add candidate.Key rejected
                        | BoundedGSetAdmission.Admitted
                        | BoundedGSetAdmission.AlreadyPresent -> rejected

                    let forgotten' = GSet.union forgotten addResult.Heat.Forgotten
                    return! loop addResult.State retained' rejected' forgotten' tail
            }

        loop current GSet.empty GSet.empty GSet.empty boarded

    let private reportFromOrdered
        (current: BoundedGSet<'K>)
        (tank: SoftThrottle.Tank)
        (orderedCandidates: Candidate<'K, 'S> list)
        : Result<Report<'K, 'S>, Feedback> =
        result {
            let! prediction =
                orderedCandidates
                |> List.map _.Branch
                |> fun branches -> Vision.predictBranches branches tank
                |> Result.mapError VisionFeedback

            let boarded = orderedCandidates |> List.truncate prediction.Boarded.Length
            let deferred = orderedCandidates |> List.skip prediction.Boarded.Length
            let! horizonAfter, retained, rejected, heat = applyVisible current boarded

            return
                { HorizonBefore = current
                  HorizonAfter = horizonAfter
                  Ordered = orderedCandidates
                  Boarded = boarded
                  Deferred = deferred
                  RetainedKeys = retained
                  RejectedByHorizon = rejected
                  HorizonHeat = heat
                  Prediction = prediction }
        }

    /// Update an existing finite horizon with a newly ordered, byte-budgeted
    /// set of candidate futures.
    let update
        (current: BoundedGSet<'K>)
        (tank: SoftThrottle.Tank)
        (candidates: Candidate<'K, 'S> list)
        : Result<Report<'K, 'S>, Feedback> =
        result {
            let! orderedCandidates = ordered candidates
            return! reportFromOrdered current tank orderedCandidates
        }

    /// Start from an empty bounded horizon and admit the affordable visible
    /// prefix of candidates.
    let admit
        (config: BoundedGSetConfig)
        (tank: SoftThrottle.Tank)
        (candidates: Candidate<'K, 'S> list)
        : Result<Report<'K, 'S>, Feedback> =
        result {
            let! empty =
                BoundedGSet.empty<'K> config
                |> Result.mapError HorizonFeedback

            return! update empty tank candidates
        }

    /// Project exact inference into a finite room view. Posterior truth stays
    /// on the inference record; attention/gravity only decide the budgeted
    /// boarding order, and the bounded G-set reports the finite exterior view.
    let updateInference
        (current: BoundedGSet<'K>)
        (tank: SoftThrottle.Tank)
        (keyOf: PredictionInference.Scored<'S> -> 'K)
        (priorityOf: PredictionInference.Scored<'S> -> PredictionInference.BranchPriority)
        (inference: PredictionInference.Inference<'S>)
        : Result<InferenceReport<'K, 'S>, Feedback> =
        result {
            let! ranked =
                PredictionInference.rankWithPriority priorityOf inference
                |> Result.mapError InferenceFeedback

            let orderedCandidates =
                ranked
                |> List.map (fun rankedBranch ->
                    { Key = keyOf rankedBranch.Scored
                      Branch = rankedBranch.Scored.Branch
                      Priority = rankedBranch.Priority })

            let! horizon = reportFromOrdered current tank orderedCandidates

            return
                { Inference = inference
                  Ranked = ranked
                  Horizon = horizon }
        }

    /// Start from an empty bounded room view and project exact inference into
    /// the affordable visible prefix.
    let admitInference
        (config: BoundedGSetConfig)
        (tank: SoftThrottle.Tank)
        (keyOf: PredictionInference.Scored<'S> -> 'K)
        (priorityOf: PredictionInference.Scored<'S> -> PredictionInference.BranchPriority)
        (inference: PredictionInference.Inference<'S>)
        : Result<InferenceReport<'K, 'S>, Feedback> =
        result {
            let! empty =
                BoundedGSet.empty<'K> config
                |> Result.mapError HorizonFeedback

            return! updateInference empty tank keyOf priorityOf inference
        }
