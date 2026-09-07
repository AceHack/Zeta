namespace Zeta.Research

open System
open Zeta.Core

/// Known-model Bayesian controller. It cannot hold or observe evaluator state, noise, rewards or Info.
[<RequireQualifiedAccess>]
module HiddenSwitchPolicy =
    type Policy = private { Arm: string; Effect: bool; Geometry: string; Belief: float; Observed: int; PendingAction: int
                            FilterCounters: HiddenSwitchReceipt.FilterCounters }
    type Decision =
        { Action: int; Belief: float; Depth: int; DecisionQ: float[]; TreeRootQ: float[]
          Counters: HiddenSwitchReceipt.PlanningCounters }
    let private fail code detail = Error(HiddenSwitchReceipt.failure "policy" code detail)
    let private validBelief b = Double.IsFinite b && b >= 0.0 && b <= 1.0
    let predict effect belief action =
        if not (validBelief belief) || (action <> 0 && action <> 1) then fail "prediction-input" "requires finite belief in [0,1] and binary action"
        else Ok(0.125 + 0.75 * (if effect && action = 1 then 1.0 - belief else belief))
    /// Returns (observation probability, posterior); no clipping or denominator repairs.
    let condition prior cue =
        if not (validBelief prior) || (cue <> 0 && cue <> 1) then fail "conditioning-input" "requires finite belief in [0,1] and binary cue"
        else
            let likelihood1, likelihood0 = if cue = 1 then 0.75, 0.25 else 0.25, 0.75
            let mass = likelihood1 * prior + likelihood0 * (1.0 - prior)
            if not (Double.IsFinite mass) || mass <= 0.0 then fail "zero-mass" "cue conditioning requires positive finite evidence mass"
            else
                let posterior = likelihood1 * prior / mass
                if validBelief posterior then Ok(mass, posterior) else fail "posterior" "conditioning produced invalid posterior"
    let select (q: float[]) =
        if isNull q || q.Length <> 2 || Array.exists (Double.IsFinite >> not) q then fail "action-values" "requires two finite action values"
        else Ok(if q.[1] - q.[0] > 1e-12 then 1 else 0)
    /// Counts only operations actually traversed. Depth-one leaves never predict or condition.
    let evaluate effect belief depth =
        if not (validBelief belief) || depth < 1 || depth > 3 then fail "tree-input" "requires admitted belief and depth 1..3"
        else
            let mutable nodes = 0
            let mutable values = 0
            let mutable predictions = 0
            let mutable updates = 0
            let rec tree b d : Result<float[], HiddenSwitchReceipt.Failure> =
                result {
                    nodes <- nodes + 1
                    let actionValue action = result {
                        values <- values + 1
                        let immediate = if action = 0 then b else -0.25
                        if d = 1 then return immediate
                        else
                            predictions <- predictions + 1
                            let! prior = predict effect b action
                            let continuation observation = result {
                                updates <- updates + 1
                                let! probability, posterior = condition prior observation
                                let! child = tree posterior (d - 1)
                                return probability * max child.[0] child.[1] }
                            let! zero = continuation 0
                            let! one = continuation 1
                            return immediate + zero + one }
                    let! harvest = actionValue 0
                    let! switch = actionValue 1
                    return [|harvest; switch|]
                }
            tree belief depth |> Result.map (fun q -> q, ({ Nodes = nodes; ActionValues = values; Predictions = predictions; Updates = updates } : HiddenSwitchReceipt.PlanningCounters))
    let create arm effect geometry =
        result {
            if not (Array.contains arm (HiddenSwitchReceipt.config()).Arms) then return! fail "arm" "unknown hidden-switch policy arm"
            let! _ = HiddenSwitchObservation.geometry geometry
            return { Arm = arm; Effect = effect; Geometry = geometry; Belief = 0.5; Observed = 0
                     PendingAction = -1; FilterCounters = HiddenSwitchReceipt.zeroFilter }
        }
    let observe frame policy =
        result {
            if policy.Observed >= 17 || (policy.Observed = 0 && policy.PendingAction <> -1)
               || (policy.Observed > 0 && policy.PendingAction = -1) then
                return! fail "observation-order" "observe once initially and once after each committed own action"
            let! cue = HiddenSwitchObservation.decode policy.Geometry frame
            let latest = policy.Arm = "latest-cue-depth3"
            let prediction = policy.Observed > 0 && not latest
            let! prior = if prediction then predict policy.Effect policy.Belief policy.PendingAction else Ok 0.5
            let! _, posterior = condition prior cue
            return cue, { policy with Belief = posterior; Observed = policy.Observed + 1; PendingAction = -1
                                      FilterCounters = { Predictions = policy.FilterCounters.Predictions + (if prediction then 1 else 0)
                                                         Updates = policy.FilterCounters.Updates + 1 } }
        }
    let choose policy =
        result {
            if policy.Observed < 1 || policy.Observed > 16 || policy.PendingAction <> -1 then
                return! fail "choice-order" "choose exactly once after each nonterminal observation"
            let remaining = 17 - policy.Observed
            let depth = if policy.Arm = "belief-myopic" then 1 else min 3 remaining
            let! treeQ, counters = evaluate policy.Effect policy.Belief depth
            let decisionQ = if policy.Arm = "belief-myopic-padded" then [|policy.Belief; -0.25|] else Array.copy treeQ
            let! key = select decisionQ
            return { Action = key; Belief = policy.Belief; Depth = depth; DecisionQ = decisionQ; TreeRootQ = treeQ; Counters = counters },
                   { policy with PendingAction = key }
        }
    let belief (policy: Policy) = policy.Belief
    let filterCounters policy = policy.FilterCounters
    /// Only allowed bounded policy state is exposed for conformance equality, never private evaluator state.
    let snapshot policy = policy.Arm, policy.Effect, policy.Geometry, policy.Belief, policy.Observed, policy.PendingAction, policy.FilterCounters
    let payload name : HiddenSwitchReceipt.Payload =
        { Name = name; BeliefFloat64Slots = 1; ModelFloat64Slots = 0; ModelBoolSlots = 1
          ChronologyInt32Slots = 4; FullFrameCellBytes = 2048; ProjectionCellBytes = 2048
          Scope = "partial logical numeric/frame ledger; model probabilities are code constants; excludes object headers, strings, options, recursion, Q arrays, trace arrays, digests, allocator overhead and peak heap" }
