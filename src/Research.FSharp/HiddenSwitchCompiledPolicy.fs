namespace Zeta.Research

open System
open Zeta.Core

/// Shared scalar filter and native action-only boundary. The compiled service is
/// added only after independent numeric-certificate and runtime-graph admission.
[<RequireQualifiedAccess>]
module HiddenSwitchCompiledPolicy =
    type Policy = private { Effect: bool; Geometry: string; Belief: float; Observed: int; PendingAction: int
                            FilterCounters: HiddenSwitchReceipt.FilterCounters }
    type Snapshot =
        { Effect: bool; Geometry: string; BeliefBits: string; Observed: int; PendingAction: int
          FilterCounters: HiddenSwitchReceipt.FilterCounters }

    let private fail code detail = Error(HiddenSwitchCompiledReceipt.failure "policy" code detail)
    let private previous result = result |> Result.mapError HiddenSwitchCompiledReceipt.fromPrevious

    let admit belief depth =
        if not (Double.IsFinite belief) || belief < 0.0 || belief > 1.0 then
            fail "belief" "requires a finite binary64 belief in [0,1], including both signed zeros"
        elif depth < 1 || depth > 3 then fail "depth" "requires depth 1..3"
        else Ok()

    /// This is one actual invocation of the unchanged native evaluator/selector.
    /// Internal Q arrays remain real work but are not part of the returned service.
    let native effect belief depth : Result<HiddenSwitchCompiledReceipt.ChoiceWork, HiddenSwitchCompiledReceipt.Failure> =
        result {
            do! admit belief depth
            let mutable calls = 0u
            calls <- calls + 1u
            let! q, counts = HiddenSwitchPolicy.evaluate effect belief depth |> previous
            let! action = HiddenSwitchPolicy.select q |> previous
            if counts.Nodes < 0 || counts.ActionValues < 0 || counts.Predictions < 0 || counts.Updates < 0 then
                return! fail "counter" "native traversal returned a negative counter"
            return { Action = byte action; Path = 0uy; GuardComparisons = 0u; RecursiveCalls = calls
                     Nodes = uint32 counts.Nodes; ActionValues = uint32 counts.ActionValues
                     Predictions = uint32 counts.Predictions; Updates = uint32 counts.Updates }
        }

    let create effect geometry =
        result {
            let! _ = HiddenSwitchObservation.geometry geometry |> previous
            return { Effect = effect; Geometry = geometry; Belief = 0.5; Observed = 0; PendingAction = -1
                     FilterCounters = HiddenSwitchReceipt.zeroFilter }
        }

    /// Input is the admitted projection, copied here before decoding. No frame
    /// reference survives; retained state contains only this controller's belief/history.
    let observe (projection: GameEnvironment.Frame) (policy: Policy) =
        result {
            if policy.Observed >= 17 || (policy.Observed = 0 && policy.PendingAction <> -1)
               || (policy.Observed > 0 && policy.PendingAction = -1) then
                return! fail "observation-order" "observe once initially and after each committed own action"
            if isNull projection.Cells then return! fail "frame-shape" "projection cells must be present"
            let owned = { projection with Cells = Array.copy projection.Cells }
            let! cue = HiddenSwitchObservation.decode policy.Geometry owned |> previous
            let prediction = policy.Observed > 0
            let! prior = if prediction then HiddenSwitchPolicy.predict policy.Effect policy.Belief policy.PendingAction |> previous else Ok 0.5
            let! _, posterior = HiddenSwitchPolicy.condition prior cue |> previous
            return cue, { policy with Belief = posterior; Observed = policy.Observed + 1; PendingAction = -1
                                      FilterCounters = { Predictions = policy.FilterCounters.Predictions + (if prediction then 1 else 0)
                                                         Updates = policy.FilterCounters.Updates + 1 } }
        }

    let depth (policy: Policy) =
        if policy.Observed < 1 || policy.Observed > 16 || policy.PendingAction <> -1 then
            fail "choice-order" "choose exactly once after each nonterminal observation"
        else Ok(min 3 (17 - policy.Observed))

    /// Commit accepts only the already selected own action. Environment feedback
    /// cannot enter until this immutable successor has been installed by the caller.
    let commit action (policy: Policy) =
        result {
            let! _ = depth policy
            if action <> 0 && action <> 1 then return! fail "action" "requires binary own action"
            return { policy with PendingAction = action }
        }

    /// Shared choice/commit chronology. The caller supplies a numeric service;
    /// callback construction belongs inside the same accounted arm boundary.
    let chooseWith service (policy: Policy) =
        result {
            let! d = depth policy
            let! (choice: HiddenSwitchCompiledReceipt.ChoiceWork) = service policy.Effect policy.Belief d
            let! committed = commit (int choice.Action) policy
            return choice, committed
        }

    let chooseNative (policy: Policy) = chooseWith native policy

    let snapshot (policy: Policy) : Snapshot =
        { Effect = policy.Effect; Geometry = policy.Geometry; BeliefBits = HiddenSwitchCompiledReceipt.bits policy.Belief
          Observed = policy.Observed; PendingAction = policy.PendingAction; FilterCounters = policy.FilterCounters }
