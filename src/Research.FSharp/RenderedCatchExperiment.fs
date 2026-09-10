namespace Zeta.Research

open System
open System.Security.Cryptography
open Zeta.Core

/// Evaluation owns truth, rewards, and emulator state. Policy calls receive projected frames only.
[<RequireQualifiedAccess>]
module RenderedCatchExperiment =
    type Corpus = { Rows: (int[] * RenderedCatchCarrier.AdmittedRom)[]; Receipt: RenderedCatchReceipt.Source }
    type Streams() =
        let frames = IncrementalHash.CreateHash HashAlgorithmName.SHA256
        let projections = IncrementalHash.CreateHash HashAlgorithmName.SHA256
        let traces = IncrementalHash.CreateHash HashAlgorithmName.SHA256
        member _.Frame bytes = frames.AppendData(bytes: byte[])
        member _.Projection bytes = projections.AppendData(bytes: byte[])
        member _.Trace bytes = traces.AppendData(bytes: byte[])
        member _.Finish() = frames.GetHashAndReset() |> Convert.ToHexString, projections.GetHashAndReset() |> Convert.ToHexString, traces.GetHashAndReset() |> Convert.ToHexString
        interface IDisposable with member _.Dispose() = frames.Dispose(); projections.Dispose(); traces.Dispose()

    let corpus geometry episodes seed domain probability =
        if episodes < 1 || episodes > 1024 then Error(RenderedCatchReceipt.failure "corpus" "episodes" "corpus needs 1..1024 rows")
        else
            let stream = ResearchRandom.Stream(ResearchRandom.domain (uint64 seed) domain)
            use romHash = IncrementalHash.CreateHash HashAlgorithmName.SHA256
            use symbolHash = IncrementalHash.CreateHash HashAlgorithmName.SHA256
            let rows = ResizeArray<int[] * RenderedCatchCarrier.AdmittedRom>()
            let mutable failure = None
            for _ in 1 .. episodes do
                if failure.IsNone then
                    match RenderedCatchCarrier.sample stream probability |> Result.bind (fun symbols ->
                        RenderedCatchCarrier.compile geometry symbols |> Result.bind (fun rom ->
                            RenderedCatchCarrier.admit geometry rom |> Result.map (fun admitted -> symbols, rom, admitted))) with
                    | Error reason -> failure <- Some reason
                    | Ok(symbols, rom, admitted) ->
                        symbolHash.AppendData(Array.map byte symbols)
                        romHash.AppendData rom
                        rows.Add(symbols, admitted)
            match failure with
            | Some reason -> Error reason
            | None ->
                let data = rows.ToArray()
                Ok { Rows = data
                     Receipt = { SourceSeed = seed; SourceDomain = domain; SourceDraws = int64 episodes * 66L
                                 SourceSymbols = data |> Array.map (fst >> RenderedCatchCarrier.binaryString)
                                 SourceSymbolsSha256 = symbolHash.GetHashAndReset() |> Convert.ToHexString
                                 SourceRomSha256 = romHash.GetHashAndReset() |> Convert.ToHexString
                                 Episodes = episodes; SymbolsPerEpisode = 66; RomBytes = 2247 } }

    /// One fresh adapter, including its constructor copy and Reset, belongs to each episode.
    let runEpisode panel name counts fair index (truth: int[], rom) palette (aggregate: Streams) : RenderedCatchReceipt.Episode =
        use streams = new Streams()
        let actions, hits, observations = ResizeArray<int>(), ResizeArray<int>(), ResizeArray<int>()
        let mutable counters = { RenderedCatchReceipt.zeroCounters with Episodes = 1 }
        let mutable warmupHit = -1
        let mutable failure: RenderedCatchReceipt.Failure = null
        let refuse reason = if isNull failure then failure <- RenderedCatchReceipt.locate panel name index reason
        let appendTrace bytes = streams.Trace bytes; aggregate.Trace bytes
        let account delta = counters <- RenderedCatchReceipt.addCounters counters delta
        let setup =
            RenderedCatchPolicy.create name counts fair |> Result.bind (fun policy ->
                RenderedCatchCarrier.create rom |> Result.map (fun (environment, state) -> policy, environment, state))
        match setup with
        | Error reason -> refuse reason
        | Ok(policy, environment, initial) ->
            let mutable state = initial
            for observationIndex in 0 .. 65 do
                if isNull failure then
                    let selected =
                        if observationIndex = 0 then Ok(ControlScheme.Go "stay", -1)
                        elif observationIndex = 1 then Ok(ControlScheme.Pad 0, 0)
                        else RenderedCatchPolicy.choose policy |> Result.map (fun key -> actions.Add key; ControlScheme.Pad key, key)
                    match selected with
                    | Error reason -> refuse reason
                    | Ok(action, key) ->
                        let invert = palette = "odd-complement" && observationIndex % 2 = 1
                        match RenderedCatchCarrier.advance rom environment state observationIndex action invert appendTrace account with
                        | Error reason -> refuse reason
                        | Ok advanced ->
                            state <- advanced.State
                            streams.Frame advanced.Frame.Cells
                            aggregate.Frame advanced.Frame.Cells
                            match RenderedCatchCarrier.project advanced.Frame with
                            | Error reason -> refuse reason
                            | Ok projected ->
                                streams.Projection projected.Cells
                                aggregate.Projection projected.Cells
                                match RenderedCatchPolicy.observe projected policy with
                                | Error reason -> refuse reason
                                | Ok decoded ->
                                    observations.Add decoded
                                    if decoded <> truth.[observationIndex] then
                                        refuse (RenderedCatchReceipt.failure "conformance" "source-observation" "rendered policy observation disagrees with private source truth")
                                    elif observationIndex > 0 then
                                        match RenderedCatchCarrier.reward advanced.Frame with
                                        | Error reason -> refuse reason
                                        | Ok hit ->
                                            if observationIndex = 1 then warmupHit <- hit else hits.Add hit
                                            let expected = if key = truth.[observationIndex] then 1 else 0
                                            if hit <> expected || int state.V.[6] <> hit || int state.V.[0] <> 16 + 32 * key then
                                                refuse (RenderedCatchReceipt.failure "conformance" "key-reward" "latched key, rendered hit, collision register, and source truth disagree")
            match RenderedCatchPolicy.validateRetained counts policy with Error reason -> refuse reason | Ok() -> ()
        let frames, projections, traces = streams.Finish()
        { Index = index; Complete = isNull failure; Failure = failure
          Actions = actions.ToArray() |> RenderedCatchCarrier.binaryString; Hits = hits.ToArray() |> RenderedCatchCarrier.binaryString
          Observations = observations.ToArray() |> RenderedCatchCarrier.binaryString; WarmupHit = warmupHit; Return = Seq.sum hits
          Counters = counters; FrameSha256 = frames; ProjectionSha256 = projections; ShadowTraceSha256 = traces }

    let runBatch panel name counts (fair: RenderedCatchPolicy.FairStream option) start rows palette : RenderedCatchReceipt.Batch =
        use streams = new Streams()
        let before = fair |> Option.map _.Draws |> Option.defaultValue 0L
        let episodes = ResizeArray<RenderedCatchReceipt.Episode>()
        let mutable failure: RenderedCatchReceipt.Failure = null
        rows |> Array.iteri (fun offset row ->
            if isNull failure then
                let episode = runEpisode panel name counts fair (start + offset) row palette streams
                episodes.Add episode
                if not episode.Complete then failure <- episode.Failure)
        let data = episodes.ToArray()
        let counters = data |> Array.fold (fun sum episode -> RenderedCatchReceipt.addCounters sum episode.Counters) RenderedCatchReceipt.zeroCounters
        let totalHits = data |> Array.sumBy _.Return
        let frames, projections, traces = streams.Finish()
        { Complete = isNull failure; Failure = failure
          ActionDraws = (fair |> Option.map _.Draws |> Option.defaultValue 0L) - before
          TotalHits = totalHits; MeanHitFraction = if counters.ScoredChoices = 0 then 0.0 else float totalHits / float counters.ScoredChoices
          Counters = counters; FrameSha256 = frames; ProjectionSha256 = projections; ShadowTraceSha256 = traces; Episodes = data }

    let pairedReturns (arms: RenderedCatchReceipt.Arm[]) : RenderedCatchReceipt.PairedReturn[] =
        match arms |> Array.tryFind (fun arm -> arm.Name = "order-two") with
        | None -> [||]
        | Some order ->
            [| for control in arms do
                   if Array.contains control.Name [|"bigram";"last-beacon";"fair-independent"|] && control.Batch.Episodes.Length = order.Batch.Episodes.Length then
                       let differences = Array.map2 (fun (left: RenderedCatchReceipt.Episode) (right: RenderedCatchReceipt.Episode) -> left.Return - right.Return) order.Batch.Episodes control.Batch.Episodes
                       yield { Control = control.Name; Differences = differences; TotalDifference = Array.sum differences } |]

    let runPanel counts (config: RenderedCatchReceipt.PanelConfig) progress : Result<RenderedCatchReceipt.Panel, RenderedCatchReceipt.Failure> =
        RenderedCatchCarrier.geometry config.Geometry |> Result.bind (fun geometry ->
            corpus geometry config.Episodes config.SourceSeed config.SourceDomain config.CopyProbability |> Result.map (fun source ->
                let arms = ResizeArray<RenderedCatchReceipt.Arm>()
                let mutable complete = true
                for name in RenderedCatchReceipt.config.Arms do
                    if complete then
                        progress config.Name name
                        let fair = if name = "fair-independent" then Some(RenderedCatchPolicy.FairStream(ResearchRandom.domain (uint64 config.ActionSeed) config.ActionDomain)) else None
                        let batch = runBatch config.Name name counts fair 0 source.Rows config.Palette
                        arms.Add { Name = name; Payload = RenderedCatchPolicy.payload name; Batch = batch }
                        complete <- batch.Complete
                let data = arms.ToArray()
                { Config = config; Source = source.Receipt; Arms = data; PairedReturns = pairedReturns data }))
