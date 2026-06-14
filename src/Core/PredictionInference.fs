namespace Zeta.Core

open System

/// Tiny source-owned prediction inference kernel.
///
/// This is deliberately not an adapter to Infer.NET, Q#, or any other oracle:
/// candidates are scored with the exact rational probability cell already in
/// Core, ranked deterministically, then handed to Vision for honest
/// byte/time/uncertainty budgeting.
[<RequireQualifiedAccess>]
module PredictionInference =

    module PS = ProbabilitySemiring

    type Candidate<'S> =
        { Label: string
          State: 'S
          Prior: PS.Rational
          Likelihood: PS.Rational
          Cost: Vision.BranchCost }

    type Scored<'S> =
        { Candidate: Candidate<'S>
          PosteriorWeight: PS.Rational
          Branch: Vision.FutureBranch<'S> }

    type Inference<'S> =
        { Ranked: Scored<'S> list
          TotalWeight: PS.Rational
          Best: Scored<'S> }

    type Prediction<'S> =
        { Inference: Inference<'S>
          Budget: Vision.PredictionReport<'S> }

    type BranchPriority =
        { Attention: PS.Rational
          Gravity: PS.Rational }

    type Feedback =
        | EmptyCandidates
        | NegativePrior of label: string * value: PS.Rational
        | NegativeLikelihood of label: string * value: PS.Rational
        | NegativeAttention of label: string * value: PS.Rational
        | NegativeGravity of label: string * value: PS.Rational
        | AllCandidatesRefuted
        | VisionFeedback of Vision.GrowthFeedback
        | SoftValueRefuted

    type private Prioritized<'S> =
        { Scored: Scored<'S>
          BoardingWeight: PS.Rational }

    let neutralPriority: BranchPriority =
        { Attention = PS.one
          Gravity = PS.one }

    let private nonNegative (r: PS.Rational) =
        PS.compare r PS.zero >= 0

    let private rationalToFloat (r: PS.Rational) : float =
        float r.Num / float r.Den

    let private compareScored (left: Scored<'S>) (right: Scored<'S>) =
        let byWeight = PS.compare right.PosteriorWeight left.PosteriorWeight
        if byWeight <> 0 then
            byWeight
        else
            String.CompareOrdinal(left.Candidate.Label, right.Candidate.Label)

    let private comparePrioritized (left: Prioritized<'S>) (right: Prioritized<'S>) =
        let byPriority = PS.compare right.BoardingWeight left.BoardingWeight
        if byPriority <> 0 then
            byPriority
        else
            compareScored left.Scored right.Scored

    let infer (candidates: Candidate<'S> list) : Result<Inference<'S>, Feedback> =
        let rec validate acc total rest =
            result {
                match rest with
                | [] ->
                    if List.isEmpty acc then
                        return! Error EmptyCandidates
                    elif PS.compare total PS.zero = 0 then
                        return! Error AllCandidatesRefuted
                    else
                        let ranked = acc |> List.sortWith compareScored
                        return
                            { Ranked = ranked
                              TotalWeight = total
                              Best = ranked.Head }
                | candidate :: tail ->
                    if not (nonNegative candidate.Prior) then
                        return! Error(NegativePrior(candidate.Label, candidate.Prior))
                    elif not (nonNegative candidate.Likelihood) then
                        return! Error(NegativeLikelihood(candidate.Label, candidate.Likelihood))
                    else
                        let posterior = PS.mul candidate.Prior candidate.Likelihood
                        let branch: Vision.FutureBranch<'S> =
                            { Label = candidate.Label
                              State = candidate.State
                              Cost = candidate.Cost }

                        return! validate ({ Candidate = candidate; PosteriorWeight = posterior; Branch = branch } :: acc) (PS.add total posterior) tail
            }

        validate [] PS.zero candidates

    let predict (tank: SoftThrottle.Tank) (inference: Inference<'S>) : Result<Prediction<'S>, Feedback> =
        inference.Ranked
        |> List.map _.Branch
        |> fun branches -> Vision.predictBranches branches tank
        |> Result.mapError VisionFeedback
        |> Result.map (fun report ->
            { Inference = inference
              Budget = report })

    let predictWithPriority
        (priorityOf: Scored<'S> -> BranchPriority)
        (tank: SoftThrottle.Tank)
        (inference: Inference<'S>)
        : Result<Prediction<'S>, Feedback> =
        let rec collect acc rest =
            result {
                match rest with
                | [] ->
                    let ordered =
                        acc
                        |> List.sortWith comparePrioritized
                        |> List.map (fun prioritized -> prioritized.Scored.Branch)

                    return!
                        Vision.predictBranches ordered tank
                        |> Result.mapError VisionFeedback
                        |> Result.map (fun report ->
                            { Inference = inference
                              Budget = report })
                | scored :: tail ->
                    let priority = priorityOf scored

                    if not (nonNegative priority.Attention) then
                        return! Error(NegativeAttention(scored.Candidate.Label, priority.Attention))
                    elif not (nonNegative priority.Gravity) then
                        return! Error(NegativeGravity(scored.Candidate.Label, priority.Gravity))
                    else
                        let boardingWeight =
                            scored.PosteriorWeight
                            |> PS.mul priority.Attention
                            |> PS.mul priority.Gravity

                        return! collect ({ Scored = scored; BoardingWeight = boardingWeight } :: acc) tail
            }

        collect [] inference.Ranked

    let inferAndPredict
        (tank: SoftThrottle.Tank)
        (candidates: Candidate<'S> list)
        : Result<Prediction<'S>, Feedback> =
        result {
            let! inference = infer candidates
            return! predict tank inference
        }

    let inferAndPredictWithPriority
        (priorityOf: Scored<'S> -> BranchPriority)
        (tank: SoftThrottle.Tank)
        (candidates: Candidate<'S> list)
        : Result<Prediction<'S>, Feedback> =
        result {
            let! inference = infer candidates
            return! predictWithPriority priorityOf tank inference
        }

    let posteriorShare (scored: Scored<'S>) (inference: Inference<'S>) : PS.Rational =
        PS.div scored.PosteriorWeight inference.TotalWeight

    let toSoftValue
        (valueOf: 'S -> DynamicValue)
        (inference: Inference<'S>)
        : Result<SoftValue.SoftValue, Feedback> =
        inference.Ranked
        |> List.map (fun scored ->
            valueOf scored.Candidate.State,
            posteriorShare scored inference |> rationalToFloat)
        |> SoftValue.ofWeighted
        |> function
            | Some value -> Ok value
            | None -> Error SoftValueRefuted

    let bestState (inference: Inference<'S>) : 'S =
        inference.Best.Candidate.State
