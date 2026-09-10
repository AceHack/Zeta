namespace Zeta.Research

open System
open System.Diagnostics
open Zeta.Core

/// Evaluator orchestration. Mutation is confined to private trace accumulation and actual counters.
[<RequireQualifiedAccess>]
module HiddenSwitchExperiment =
    type Hooks =
        { Frame: int -> GameEnvironment.Frame -> Result<GameEnvironment.Frame, HiddenSwitchReceipt.Failure>
          Scorer: int -> int -> Result<int, HiddenSwitchReceipt.Failure> }
    let normal = { Frame = (fun _ frame -> Ok frame); Scorer = (fun _ reward -> Ok reward) }
    let private feedback reason = HiddenSwitchReceipt.failure "environment" "adapter" (sprintf "%A" reason)
    let private binary (values: ResizeArray<int>) = values |> Seq.map (fun value -> if value = 0 then '0' else '1') |> Seq.toArray |> String

    /// Hooks belong solely to evaluator conformance; no hook/value is an argument of policy create/observe/choose.
    let episodeWith hooks index tape effect geometry palette arm : HiddenSwitchReceipt.Episode =
        let cues, actions, states = ResizeArray<int>(), ResizeArray<int>(), ResizeArray<int>()
        let rewards, beliefs = ResizeArray<int>(), ResizeArray<float>()
        let decisionValues, treeValues = ResizeArray<float[]>(), ResizeArray<float[]>()
        let planning = ResizeArray<HiddenSwitchReceipt.PlanningCounters>()
        let frames, projections = ResizeArray<string>(), ResizeArray<string>()
        let mutable filter = HiddenSwitchReceipt.zeroFilter
        let execution =
            result {
                if index < 0 || index > 1023 then return! Error(HiddenSwitchReceipt.failure "episode" "index" "episode index must be in 0..1023")
                let! initialPolicy = HiddenSwitchPolicy.create arm effect geometry
                let environment = HiddenSwitchCarrier.Adapter(tape, effect, geometry, palette) :> GameEnvironment.IEnvironment<HiddenSwitchCarrier.State>
                let! initial = environment.Reset() |> Result.mapError feedback
                let mutable state = initial
                let mutable policy = initialPolicy
                let observe observationIndex =
                    result {
                        let! original = environment.Frame state |> Result.mapError feedback
                        let! frame = hooks.Frame observationIndex original
                        let! projection = HiddenSwitchObservation.project frame
                        let! cue, nextPolicy = HiddenSwitchPolicy.observe projection policy
                        policy <- nextPolicy
                        cues.Add cue
                        beliefs.Add(HiddenSwitchPolicy.belief policy)
                        frames.Add(HiddenSwitchObservation.sha256 frame.Cells)
                        projections.Add(HiddenSwitchObservation.sha256 projection.Cells)
                        filter <- HiddenSwitchPolicy.filterCounters policy
                    }
                do! observe 0
                let rec advance step = result {
                    if step < 16 then
                        let! decision, committedPolicy = HiddenSwitchPolicy.choose policy
                        // Commit the selected key before reading hidden scorer truth or advancing the environment.
                        actions.Add decision.Action
                        policy <- committedPolicy
                        decisionValues.Add decision.DecisionQ
                        treeValues.Add decision.TreeRootQ
                        planning.Add decision.Counters
                        if states.Count = 0 then states.Add((HiddenSwitchCarrier.audit state).Hidden)
                        let! next = environment.Step(state, ControlScheme.Pad decision.Action) |> Result.mapError feedback
                        state <- next
                        let audit = HiddenSwitchCarrier.audit state
                        states.Add audit.Hidden
                        let! reward =
                            match audit.Reward4 with
                            | Some value -> hooks.Scorer step value
                            | None -> Error(HiddenSwitchReceipt.failure "scorer" "missing-reward" "completed transition must carry a reward")
                        rewards.Add reward
                        do! observe (step + 1)
                        return! advance (step + 1) }
                do! advance 0
            }
        let failure = match execution with Ok() -> null | Error reason -> HiddenSwitchReceipt.locate null arm index reason
        { Index = index; Complete = Result.isOk execution; Failure = failure; Cues = binary cues; Actions = binary actions; States = binary states
          Reward4 = rewards.ToArray(); Beliefs = beliefs.ToArray(); DecisionQ = decisionValues.ToArray(); TreeRootQ = treeValues.ToArray()
          PlanningCounters = planning.ToArray(); FilterCounters = filter; FrameSha256 = frames.ToArray(); ProjectionSha256 = projections.ToArray()
          TotalReward4 = rewards |> Seq.sum }
    let episode index tape effect geometry palette arm = episodeWith normal index tape effect geometry palette arm

    /// Returns all completed/failed attempts in execution order and the first failure, never a replacement.
    let behavior () =
        let config = HiddenSwitchReceipt.config()
        let panels = ResizeArray<HiddenSwitchReceipt.Panel>()
        let mutable failure: HiddenSwitchReceipt.Failure = null
        for panel in config.Panels do
            if isNull failure then
                match HiddenSwitchCarrier.corpus panel.Seed panel.Domain panel.Episodes with
                | Error reason -> failure <- HiddenSwitchReceipt.failure "source" "corpus" (sprintf "%A" reason)
                | Ok tapes ->
                    let arms = ResizeArray<HiddenSwitchReceipt.Arm>()
                    for name in config.Arms do
                        if isNull failure then
                            let episodes = ResizeArray<HiddenSwitchReceipt.Episode>()
                            for index in 0 .. tapes.Length - 1 do
                                if isNull failure then
                                    let value = episode index tapes.[index] panel.Effect panel.Geometry panel.Palette name
                                    episodes.Add value
                                    if not value.Complete then failure <- HiddenSwitchReceipt.locate panel.Name name index value.Failure
                            arms.Add { Name = name; Episodes = episodes.ToArray(); Complete = isNull failure; Failure = failure }
                    panels.Add { Config = panel; Arms = arms.ToArray() }
        panels.ToArray(), failure

    /// Source generation is outside timing. Each full episode and its append execute inside the timed block.
    let costs () =
        let config = HiddenSwitchReceipt.config()
        let rows = ResizeArray<HiddenSwitchReceipt.CostRow>()
        let mutable failure: HiddenSwitchReceipt.Failure = null
        match HiddenSwitchCarrier.corpus config.Cost.Seed config.Cost.Domain config.Cost.SourceEpisodes with
        | Error reason -> failure <- HiddenSwitchReceipt.failure "source" "cost-corpus" (sprintf "%A" reason)
        | Ok tapes ->
            use hostProcess = Process.GetCurrentProcess()
            for repetition in 0 .. 4 do
                for order in 0 .. 3 do
                    if isNull failure then
                        let name = config.Arms.[(repetition + order) % 4]
                        let warmup, timed = ResizeArray<HiddenSwitchReceipt.Episode>(), ResizeArray<HiddenSwitchReceipt.Episode>()
                        let runInto (destination: ResizeArray<HiddenSwitchReceipt.Episode>) index =
                            if isNull failure then
                                let value = episode index tapes.[index] true "dot" "fixed" name
                                destination.Add value
                                if not value.Complete then failure <- HiddenSwitchReceipt.locate "cost" name index value.Failure
                        for index in 0 .. 7 do runInto warmup index
                        let mutable wall = 0.0
                        let mutable cpu = 0.0
                        let mutable allocated = 0L
                        if isNull failure then
                            let cpuBefore = hostProcess.TotalProcessorTime
                            let allocationBefore = GC.GetAllocatedBytesForCurrentThread()
                            let start = Stopwatch.GetTimestamp()
                            for index in 8 .. 71 do runInto timed index
                            let finish = Stopwatch.GetTimestamp()
                            allocated <- GC.GetAllocatedBytesForCurrentThread() - allocationBefore
                            cpu <- (hostProcess.TotalProcessorTime - cpuBefore).TotalMilliseconds
                            wall <- float (finish - start) * 1000.0 / float Stopwatch.Frequency
                        rows.Add { Replicate = repetition; Order = order; Name = name; WallMsTotal = wall; CpuMsTotal = cpu
                                   AllocatedBytesTotal = allocated; WarmupEpisodes = warmup.ToArray(); TimedEpisodes = timed.ToArray() }
        rows.ToArray(), failure
