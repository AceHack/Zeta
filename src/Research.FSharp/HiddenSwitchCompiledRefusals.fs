namespace Zeta.Research

open System
open System.Globalization
open Zeta.Core

/// Fifteen logical groups / fifty-three actual invalid hand operations.
[<RequireQualifiedAccess>]
module HiddenSwitchCompiledRefusals =
    type Setup =
        { Initial: HiddenSwitchCompiledPolicy.Snapshot option
          Events: HiddenSwitchCompiledConformance.Event[] }
    type Outcome = { Kind: string; Failure: HiddenSwitchCompiledReceipt.Failure }
    type Calls = { Setup: HiddenSwitchCompiledConformance.Calls; Operation: HiddenSwitchCompiledConformance.Calls }
    type Operation =
        { OperationId: string; Strategy: string; Operation: string; Input: obj
          Setup: Setup; Outcome: Outcome; Calls: Calls }
    type Group = { CaseId: string; Operations: Operation[] }

    let private names =
        [| "belief-nan"; "belief-positive-infinity"; "belief-negative-infinity"; "belief-negative-subnormal"; "belief-above-one"
           "depth-zero"; "depth-four"; "noncanonical-bits"; "nonbinary-frame"; "wrong-frame-dimensions"
           "choose-before-observe"; "observe-without-action"; "duplicate-choose"; "terminal-choose"; "invalid-prediction-action" |]
    let private invalidBits = [| 0x7FF8000000000000UL; 0x7FF0000000000000UL; 0xFFF0000000000000UL; 0x8000000000000001UL; 0x3FF0000000000001UL |]
    let private strategies = ["native-recursive"; "compiled-guarded"]
    let private roster group =
        if group < 5 then [for strategy in strategies do for effect, depth in [true, 1; false, 3; true, 3] do yield strategy, effect, depth]
        elif group < 7 then [for strategy in strategies do for effect in [true; false] do yield strategy, effect, (if group = 5 then 0 else 4)]
        elif group < 14 then [for strategy in strategies do yield strategy, true, 3]
        else ["common", true, 3]

    /// Untimed judgment seam: accepted invalid-call results remain diagnostic data.
    let internal judge operationId strategy operation given setup calls actual =
        match actual with
        | Ok returned ->
            Error(HiddenSwitchCompiledReceipt.failure "hand-refusals" "unexpected-acceptance" operationId),
            box {| Kind = "unexpected-acceptance"; OperationId = operationId; Strategy = strategy
                   Operation = operation; Input = given; Setup = setup; Calls = calls; Returned = returned |}
        | Error reason ->
            Ok { OperationId = operationId; Strategy = strategy; Operation = operation; Input = given; Setup = setup
                 Outcome = { Kind = "refused"; Failure = reason }; Calls = calls }, null

    let collect (checkpoint: obj -> unit) guards =
        let groups = ResizeArray<Group>()
        let mutable primary: HiddenSwitchCompiledReceipt.Failure = null
        let mutable active: obj = null
        let keep value =
            match value with Error reason -> primary <- reason | Ok _ -> ()
            value
        let run group strategy effect depth =
            let caseId = names.[group]
            let suffix = if group < 7 then sprintf "/effect-%s-depth-%d" (if effect then "true" else "false") depth else ""
            let operationId = caseId + "/" + strategy + suffix
            let setupCounter, operationCounter = HiddenSwitchCompiledConformance.Counter(), HiddenSwitchCompiledConformance.Counter()
            let mutable setup: Setup = { Initial = None; Events = [||] }
            let mutable setupCalls = setupCounter.Snapshot()
            let mutable given: obj = null
            let mutable operation = ""
            let mutable actual: Result<obj, HiddenSwitchCompiledReceipt.Failure> option = None
            let mutable timelinePrefix: obj = null
            let mutable retainedPolicy = None
            let events = ResizeArray<HiddenSwitchCompiledConformance.Event>()
            let mutable timelineCalls = false
            let retain () =
                setup <- { setup with Events = events.ToArray() }
                if not timelineCalls then setupCalls <- setupCounter.Snapshot()
                let returned, failure =
                    match actual with Some(Ok value) -> value, null | Some(Error reason) -> null, reason | None -> null, null
                active <- box {| Kind = "active-refusal"; CaseId = caseId; OperationId = operationId
                                 Strategy = strategy; Operation = operation; Input = given; Setup = setup
                                 Policy = retainedPolicy; Timeline = timelinePrefix
                                 Calls = { Setup = setupCalls; Operation = operationCounter.Snapshot() }
                                 Returned = returned; Failure = failure |}
            let publish value = retain(); checkpoint value
            let markStage () = publish (box {| Kind = "refusal-stage"; CaseId = caseId; OperationId = operationId |})
            try result {
                if group < 7 then
                    let bits = if group < 5 then invalidBits.[group] else 0x3FE0000000000000UL
                    let belief = BitConverter.UInt64BitsToDouble bits
                    given <- box {| BeliefBits = bits.ToString("X16", CultureInfo.InvariantCulture); Effect = effect; Depth = depth |}
                    operation <- "fixture-raw-bits-service"
                    markStage()
                    // Fixed raw patterns deliberately reach actual service admission,
                    // including nonfinite values and would-be null/depth-one fast paths.
                    operationCounter.Enter()
                    actual <- Some (HiddenSwitchCompiledConformance.service operationCounter guards strategy effect belief depth |> Result.map box)
                elif group = 7 then
                    given <- box {| BeliefBits = "3fe0000000000000"; Effect = true; Depth = 3 |}
                    operation <- "parse-dispatch"
                    markStage()
                    operationCounter.Enter()
                    actual <- Some (HiddenSwitchCompiledReceipt.parseFiniteBits "3fe0000000000000"
                              |> Result.bind (fun belief -> HiddenSwitchCompiledConformance.service operationCounter guards strategy true belief 3)
                              |> Result.map box)
                elif group = 14 then
                    given <- box {| BeliefBits = "3FE0000000000000"; Effect = true; Action = 2 |}
                    operation <- "predict"
                    markStage()
                    operationCounter.Enter()
                    actual <- Some (HiddenSwitchPolicy.predict true 0.5 2 |> HiddenSwitchCompiledConformance.previous |> Result.map (fun value -> box {| PredictedBits = HiddenSwitchCompiledReceipt.bits value |}))
                else
                    let! frame = HiddenSwitchCompiledConformance.cueFrame 0 |> keep
                    let invocationFrame =
                        if group = 8 then
                            let copied = { frame with Cells = Array.copy frame.Cells }
                            copied.Cells.[0] <- 2uy
                            copied
                        elif group = 9 then { frame with W = 63 }
                        else frame
                    if group = 8 || group = 9 || group = 11 then
                        given <- box {| Frame = {| Width = invocationFrame.W; Height = invocationFrame.H; Palette = invocationFrame.Palette; CellsHex = Convert.ToHexString invocationFrame.Cells |} |}
                        operation <- "observe"
                    else
                        given <- box (Map.empty<string, string>)
                        operation <- "choose"
                    markStage()
                    let persist () = publish (box {| Kind = "refusal-setup-event"; OperationId = operationId; Data = events.[events.Count - 1] |})
                    let! initial, policy, actualSetupCalls =
                        if group = 13 then result {
                            let! tape =
                                match HiddenSwitchCarrier.handTapes() |> Array.tryFind (fun (name, _) -> name = "sparse") with
                                | Some (_, value) -> Ok value
                                | None -> Error(HiddenSwitchCompiledReceipt.failure "hand-refusals" "tape" "fixed sparse tape is missing") |> keep
                            let timeline, _ = HiddenSwitchCompiledConformance.timeline checkpoint guards strategy tape false false
                            if not timeline.Episode.Complete then primary <- timeline.Episode.Failure
                            timelinePrefix <- box {| Episode = timeline.Episode; Events = timeline.Events; Calls = timeline.Calls |}
                            timelineCalls <- true
                            setupCalls <- timeline.Calls
                            setup <- { Initial = timeline.Initial; Events = timeline.Events }
                            events.AddRange timeline.Events
                            retainedPolicy <- timeline.Policy |> Option.map HiddenSwitchCompiledPolicy.snapshot
                            publish (box {| Kind = "refusal-terminal-prefix"; OperationId = operationId; Episode = timeline.Episode;
                                           Events = timeline.Events; Calls = timeline.Calls |})
                            if not timeline.Episode.Complete then return! Error timeline.Episode.Failure
                            match timeline.Initial, timeline.Policy with
                            | Some origin, Some terminal ->
                                return origin, terminal, timeline.Calls
                            | _ -> return! Error(HiddenSwitchCompiledReceipt.failure "hand-refusals" "terminal-prefix" "complete timeline must retain initial and terminal policy") |> keep
                        }
                        else result {
                            let! created = HiddenSwitchCompiledConformance.create setupCounter |> keep
                            let initial = HiddenSwitchCompiledPolicy.snapshot created
                            setup <- { setup with Initial = Some initial }
                            retainedPolicy <- Some initial
                            let mutable policy = created
                            if group = 11 || group = 12 then
                                let! _, observed = HiddenSwitchCompiledConformance.observe setupCounter events 0 frame policy |> keep
                                policy <- observed
                                retainedPolicy <- Some(HiddenSwitchCompiledPolicy.snapshot observed)
                                persist()
                                if group = 12 then
                                    let! _, committed = HiddenSwitchCompiledConformance.choose setupCounter guards strategy events 0 policy |> keep
                                    policy <- committed
                                    retainedPolicy <- Some(HiddenSwitchCompiledPolicy.snapshot committed)
                                    persist()
                            return initial, policy, setupCounter.Snapshot()
                        }
                    setupCalls <- actualSetupCalls
                    setup <- { Initial = Some initial; Events = events.ToArray() }
                    publish (box {| Kind = "refusal-setup"; OperationId = operationId; Data = setup; Calls = setupCalls |})
                    if group = 8 || group = 9 || group = 11 then
                        operationCounter.Enter()
                        actual <- Some (HiddenSwitchCompiledPolicy.observe invocationFrame policy |> Result.map (fun (cue, after) -> box {| Cue = cue; After = HiddenSwitchCompiledPolicy.snapshot after |}))
                    else
                        operationCounter.Enter()
                        actual <- Some (HiddenSwitchCompiledPolicy.chooseWith (HiddenSwitchCompiledConformance.service operationCounter guards strategy) policy |> Result.map (fun (choice, after) -> box {| Choice = choice; After = HiddenSwitchCompiledPolicy.snapshot after |}))
                retain()
                match actual with
                | None -> return! Error(HiddenSwitchCompiledReceipt.failure "hand-refusals" "missing-outcome" operationId) |> keep
                | Some value ->
                    let outcome, diagnostic = judge operationId strategy operation given setup
                                                  { Setup = setupCalls; Operation = operationCounter.Snapshot() } value
                    match outcome with
                    | Error reason ->
                        primary <- reason
                        active <- diagnostic
                        checkpoint diagnostic
                        return! Error reason
                    | Ok row -> return row
            }
            with error ->
                // Refresh available setup/counters even when its publication failed.
                // An established unexpected acceptance keeps its complete diagnostic.
                if isNull primary || primary.Code <> "unexpected-acceptance" then retain()
                if isNull primary then Error(HiddenSwitchCompiledConformance.exceptionFailure "hand-refusals" error)
                else Error primary
        let execution =
            try result {
                do! [0 .. 14] |> HiddenSwitchCompiledConformance.iterate (fun group -> result {
                    let rows = ResizeArray<Operation>()
                    groups.Add { CaseId = names.[group]; Operations = [||] }
                    do! roster group |> HiddenSwitchCompiledConformance.iterate (fun (strategy, effect, depth) -> result {
                        let! row = run group strategy effect depth |> keep
                        rows.Add row
                        groups.[groups.Count - 1] <- { CaseId = names.[group]; Operations = rows.ToArray() }
                        checkpoint (box {| Kind = "refusal-operation"; CaseId = names.[group]; Data = row |})
                    })
                    let completed = { CaseId = names.[group]; Operations = rows.ToArray() }
                    groups.[groups.Count - 1] <- completed
                    checkpoint (box {| Kind = "refusal-group"; Data = completed |})
                })
            }
            with error -> if isNull primary then Error(HiddenSwitchCompiledConformance.exceptionFailure "hand-refusals" error) else Error primary
        groups.ToArray(), execution, (if Result.isOk execution then null else active)
