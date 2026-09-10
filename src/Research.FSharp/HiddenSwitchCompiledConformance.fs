namespace Zeta.Research

open System
open Zeta.Core

/// Untimed hand instrumentation. These callbacks are never measured services.
[<RequireQualifiedAccess>]
module HiddenSwitchCompiledConformance =
    type Event = { Sequence: int; Kind: string; Index: int; Input: obj; Output: obj }
    type Calls = { EntryCalls: int; ServiceEntries: int; EvaluatorEntries: int }
    type Counter() =
        let mutable entries, services, evaluators = 0, 0, 0
        member _.Enter() = entries <- entries + 1
        member _.Service() = services <- services + 1
        member _.Evaluator() = evaluators <- evaluators + 1
        member _.Snapshot() = { EntryCalls = entries; ServiceEntries = services; EvaluatorEntries = evaluators }

    type Timeline =
        { Episode: HiddenSwitchCompiledReceipt.Episode
          Initial: HiddenSwitchCompiledPolicy.Snapshot option
          Policy: HiddenSwitchCompiledPolicy.Policy option
          Events: Event[]; Frames: GameEnvironment.Frame[]; Calls: Calls }

    let previous value = value |> Result.mapError HiddenSwitchCompiledReceipt.fromPrevious
    let exceptionFailure stage (error: exn) =
        HiddenSwitchCompiledReceipt.failure stage "exception" (error.GetType().FullName + ": " + error.Message)
    let cells (value: byte[]) = value |> Array.map (fun bit -> if bit = 0uy then '0' else '1') |> String
    let binary (value: seq<int>) = value |> Seq.map (fun bit -> if bit = 0 then '0' else '1') |> Seq.toArray |> String
    let iterate operation values =
        values |> Seq.fold (fun state value -> state |> Result.bind (fun () -> operation value)) (Ok())
    let addEvent (events: ResizeArray<Event>) kind index input output =
        let row = { Sequence = events.Count; Kind = kind; Index = index; Input = input; Output = output }
        events.Add row
        row

    /// Counters are incremented at real service and evaluator-root call sites;
    /// traversal Nodes remains a different field of the returned ChoiceWork.
    let service (counter: Counter) guards strategy effect belief depth =
        counter.Service()
        let evaluator effect belief depth =
            counter.Evaluator()
            HiddenSwitchPolicy.evaluate effect belief depth
        let recursive effect belief depth = HiddenSwitchCompiledPolicy.nativeCore evaluator effect belief depth
        if strategy = "native-recursive" then recursive effect belief depth
        elif strategy = "compiled-guarded" then HiddenSwitchCompiledSelector.chooseWithFallback recursive guards effect belief depth
        else Error(HiddenSwitchCompiledReceipt.failure "hand-conformance" "strategy" "requires a declared hand strategy")

    let create (counter: Counter) =
        counter.Enter()
        HiddenSwitchCompiledPolicy.create true "dot"

    let observe (counter: Counter) events index frame policy = result {
        let before = HiddenSwitchCompiledPolicy.snapshot policy
        counter.Enter()
        let! cue, after = HiddenSwitchCompiledPolicy.observe frame policy
        let _ = addEvent events "observe" index (box {| Cells = cells frame.Cells; Before = before |})
                           (box {| Cue = cue; After = HiddenSwitchCompiledPolicy.snapshot after |})
        return cue, after
    }

    let choose (counter: Counter) guards strategy events index policy = result {
        let before = HiddenSwitchCompiledPolicy.snapshot policy
        counter.Enter()
        let! choice, after = HiddenSwitchCompiledPolicy.chooseWith (service counter guards strategy) policy
        let _ = addEvent events "choose" index (box {| Before = before |})
                           (box {| Choice = choice; After = HiddenSwitchCompiledPolicy.snapshot after |})
        return choice, after
    }

    let private adapterFailure reason =
        HiddenSwitchCompiledReceipt.failure "environment" "adapter" (sprintf "%A" reason)

    let cueFrame cue = result {
        let tape: HiddenSwitchCarrier.Tape = { Initial = cue; Drift = Array.zeroCreate 16; Errors = Array.zeroCreate 17 }
        let environment = HiddenSwitchCarrier.Adapter(tape, true, "dot", "fixed") :> GameEnvironment.IEnvironment<HiddenSwitchCarrier.State>
        let! state = environment.Reset() |> Result.mapError adapterFailure
        let! frame = environment.Frame state |> Result.mapError adapterFailure
        return! HiddenSwitchObservation.project frame |> previous
    }

    /// The frame and scorer substitutions are private evaluator interventions.
    /// The controller still receives only the projected frame. Every choice is
    /// committed before the real carrier transition; no feedback is fabricated.
    let timeline (checkpoint: obj -> unit) guards strategy tape replaceBand zeroReceipt =
        let counter = Counter()
        let events, interventions = ResizeArray<Event>(), ResizeArray<Event>()
        let frames = ResizeArray<GameEnvironment.Frame>()
        let cues, actions, states = ResizeArray<int>(), ResizeArray<int>(), ResizeArray<int>()
        let rewards, beliefs = ResizeArray<int>(), ResizeArray<string>()
        let choices = ResizeArray<HiddenSwitchCompiledReceipt.ChoiceWork>()
        let frameHashes, projectionHashes = ResizeArray<string>(), ResizeArray<string>()
        let mutable initial, retainedPolicy = None, None
        let mutable filter = HiddenSwitchReceipt.zeroFilter
        let mutable primary: HiddenSwitchCompiledReceipt.Failure = null
        let keep result =
            match result with Error reason -> primary <- reason | Ok _ -> ()
            result
        let record event = checkpoint (box {| Kind = "conformance-event"; Strategy = strategy; Data = event |})
        let execution =
            try result {
                let! created = create counter |> keep
                initial <- Some(HiddenSwitchCompiledPolicy.snapshot created)
                retainedPolicy <- Some created
                let environment = HiddenSwitchCarrier.Adapter(tape, true, "dot", "fixed") :> GameEnvironment.IEnvironment<HiddenSwitchCarrier.State>
                let! start = environment.Reset() |> Result.mapError adapterFailure |> keep
                states.Add((HiddenSwitchCarrier.audit start).Hidden)
                let mutable state, policy = start, created
                do! [0 .. 16] |> iterate (fun index -> result {
                    checkpoint (box {| Kind = "conformance-stage"; Strategy = strategy; Index = index; Stage = "observe" |})
                    let! original = environment.Frame state |> Result.mapError adapterFailure |> keep
                    let frame =
                        if replaceBand then
                            let changed = { original with Cells = Array.copy original.Cells }
                            for offset in 0 .. 511 do changed.Cells.[1536 + offset] <- byte (offset % 2)
                            let row = addEvent interventions "frame-replace" index (box {| Cells = cells original.Cells |}) (box {| Cells = cells changed.Cells |})
                            record row
                            changed
                        else original
                    frames.Add frame
                    let! projection = HiddenSwitchObservation.project frame |> previous |> keep
                    let! cue, observed = observe counter events index projection policy |> keep
                    policy <- observed
                    retainedPolicy <- Some observed
                    let snapshot = HiddenSwitchCompiledPolicy.snapshot observed
                    cues.Add cue; beliefs.Add snapshot.BeliefBits; filter <- snapshot.FilterCounters
                    frameHashes.Add(HiddenSwitchObservation.sha256 frame.Cells)
                    projectionHashes.Add(HiddenSwitchObservation.sha256 projection.Cells)
                    record events.[events.Count - 1]
                    if index < 16 then
                        checkpoint (box {| Kind = "conformance-stage"; Strategy = strategy; Index = index; Stage = "choose" |})
                        let! choice, committed = choose counter guards strategy events index policy |> keep
                        policy <- committed
                        retainedPolicy <- Some committed
                        choices.Add choice; actions.Add(int choice.Action)
                        record events.[events.Count - 1]
                        let before = HiddenSwitchCarrier.audit state
                        let! successor = environment.Step(state, ControlScheme.Pad(int choice.Action)) |> Result.mapError adapterFailure |> keep
                        state <- successor
                        let after = HiddenSwitchCarrier.audit successor
                        states.Add after.Hidden
                        match after.Reward4 with
                        | None -> return! Error(HiddenSwitchCompiledReceipt.failure "scorer" "missing-reward" "transition did not yield a reward") |> keep
                        | Some reward ->
                            let feedback = addEvent events "feedback" index
                                               (box {| State = before.Hidden; Action = int choice.Action; Drift = tape.Drift.[index] |})
                                               (box {| State = after.Hidden; Reward4 = reward |})
                            let recorded = if zeroReceipt then 0 else reward
                            rewards.Add recorded
                            let score =
                                if zeroReceipt then Some(addEvent interventions "score" index (box {| Reward4 = reward |}) (box {| Reward4 = recorded |}))
                                else None
                            record feedback
                            match score with Some row -> record row | None -> ()
                })
            }
            with error -> if isNull primary then Error(exceptionFailure "hand-conformance" error) else Error primary
        let failure = match execution with Ok () -> null | Error reason -> reason
        let episode: HiddenSwitchCompiledReceipt.Episode =
            { Index = 18; Complete = Result.isOk execution; Failure = failure
              Cues = binary cues; Actions = binary actions; States = binary states; Reward4 = rewards.ToArray()
              BeliefBits = beliefs.ToArray(); ChoiceWork = choices.ToArray(); FilterCounters = filter
              FrameSha256 = frameHashes.ToArray(); ProjectionSha256 = projectionHashes.ToArray(); TotalReward4 = rewards |> Seq.sum }
        { Episode = episode; Initial = initial; Policy = retainedPolicy; Events = events.ToArray()
          Frames = frames.ToArray(); Calls = counter.Snapshot() }, interventions.ToArray()
