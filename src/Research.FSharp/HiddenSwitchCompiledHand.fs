namespace Zeta.Research

open System
open System.Globalization
open System.IO
open System.Security.Cryptography
open System.Text
open System.Text.Json
open Zeta.Core

/// Explicit hand tapes and retained partial evidence. No source generator or
/// measurement schedule is reachable from this module.
[<RequireQualifiedAccess>]
module HiddenSwitchCompiledHand =
    type EpisodeRow =
        { Tape: string; Effect: bool; Geometry: string; Palette: string; Strategy: string
          Episode: HiddenSwitchCompiledReceipt.Episode }
    type OldRow =
        { Tape: string; Effect: bool; Geometry: string; Palette: string; Episode: HiddenSwitchReceipt.Episode }
    type Payload =
        { Scalars: HiddenSwitchCompiledReceipt.ScalarAudit[]; Episodes: EpisodeRow[]; OldControls: OldRow[]; Falsifiers: obj option }
    type Report =
        { Kind: string; Complete: bool; SlicesComplete: bool; Failure: HiddenSwitchCompiledReceipt.Failure
          RuntimeAdmitted: bool; BodyResolved: bool; ClosureAdmitted: bool; MissingCategories: string[]
          SourceDraws: int; StartedAtUtc: string; FinishedAtUtc: string; Runtime: string
          Arguments: string[]; AssemblyFile: string; AssemblySha256: string
          CertificateBindings: Map<string, string>; NumericCertificateSha256: string; Payload: Payload; Scope: string }

    let bindings () =
        Map.ofList ["ProtocolSha256", "8BBDFE44A0844DD8CE4F6C5DD77B060A56E5B84EA94EA7A6FDBB482AEC9D738A"
                    "hand-validation", String.replicate 64 "0"]
    let private fail stage code detail = Error(HiddenSwitchCompiledReceipt.failure stage code detail)
    let private previous value = value |> Result.mapError HiddenSwitchCompiledReceipt.fromPrevious
    let private feedback reason = HiddenSwitchCompiledReceipt.failure "environment" "adapter" (sprintf "%A" reason)
    let private binary (values: ResizeArray<int>) = values |> Seq.map (fun value -> if value = 0 then '0' else '1') |> Seq.toArray |> String
    let private iterate operation values =
        values |> Seq.fold (fun state value -> state |> Result.bind (fun () -> operation value)) (Ok())

    let scalarInputs guards =
        let fixedBits = [|0x8000000000000000UL; 0UL; 1UL; 0x000FFFFFFFFFFFFFUL; 0x0010000000000000UL; 0x3FEFFFFFFFFFFFFFUL; 0x3FF0000000000000UL|]
        let values = ResizeArray<uint64>(fixedBits)
        let append value = values.Add(value - 1UL); values.Add value; values.Add(value + 1UL)
        HiddenSwitchCompiledCertificate.handCenterBits() |> Array.iter append
        let struct(a, b) = HiddenSwitchCompiledCertificate.depthTwo guards
        let struct(c, d) = HiddenSwitchCompiledCertificate.depthThree guards
        [|a; b; c; d|] |> Array.iter (BitConverter.DoubleToUInt64Bits >> append)
        [| for bits in values do
               for effect in [true; false] do
                   for depth in 1 .. 3 do
                       yield bits, effect, depth |]
        |> Array.mapi (fun index (bits, effect, depth) ->
            { Index = index; BeliefBits = bits.ToString("X16", CultureInfo.InvariantCulture)
              Effect = effect; Depth = depth }: HiddenSwitchCompiledReceipt.ScalarInput)

    /// Only projection/scalar state reaches policy calls. Private environment
    /// state and reward truth are read after committing the selected action.
    let episode guards strategy index tape effect geometry palette : HiddenSwitchCompiledReceipt.Episode =
        let cues, actions, states = ResizeArray<int>(), ResizeArray<int>(), ResizeArray<int>()
        let rewards, beliefs = ResizeArray<int>(), ResizeArray<string>()
        let choices = ResizeArray<HiddenSwitchCompiledReceipt.ChoiceWork>()
        let frames, projections = ResizeArray<string>(), ResizeArray<string>()
        let mutable filter = HiddenSwitchReceipt.zeroFilter
        let execution =
            try result {
                if index < 0 || index > 1023 then return! fail "episode" "index" "requires index 0..1023"
                if strategy <> "native-recursive" && strategy <> "compiled-guarded" then
                    return! fail "episode" "strategy" "requires a declared hand strategy"
                let! initialPolicy = HiddenSwitchCompiledPolicy.create effect geometry
                let environment = HiddenSwitchCarrier.Adapter(tape, effect, geometry, palette) :> GameEnvironment.IEnvironment<HiddenSwitchCarrier.State>
                let! initial = environment.Reset() |> Result.mapError feedback
                let mutable state = initial
                let mutable policy = initialPolicy
                let observe () = result {
                    let! frame = environment.Frame state |> Result.mapError feedback
                    let! projection = HiddenSwitchObservation.project frame |> previous
                    let! cue, next = HiddenSwitchCompiledPolicy.observe projection policy
                    policy <- next
                    let snapshot = HiddenSwitchCompiledPolicy.snapshot policy
                    cues.Add cue
                    beliefs.Add snapshot.BeliefBits
                    filter <- snapshot.FilterCounters
                    frames.Add(HiddenSwitchObservation.sha256 frame.Cells)
                    projections.Add(HiddenSwitchObservation.sha256 projection.Cells)
                }
                do! observe()
                do! [0 .. 15] |> iterate (fun _ -> result {
                    // Callback construction is at the same service boundary for
                    // both strategies. These hand receipts do not measure its cost.
                    let service = if strategy = "native-recursive" then HiddenSwitchCompiledPolicy.native else HiddenSwitchCompiledSelector.choose guards
                    let! choice, committed = HiddenSwitchCompiledPolicy.chooseWith service policy
                    policy <- committed
                    actions.Add(int choice.Action)
                    choices.Add choice
                    if states.Count = 0 then states.Add((HiddenSwitchCarrier.audit state).Hidden)
                    let! next = environment.Step(state, ControlScheme.Pad(int choice.Action)) |> Result.mapError feedback
                    state <- next
                    let audit = HiddenSwitchCarrier.audit state
                    states.Add audit.Hidden
                    match audit.Reward4 with
                    | None -> return! fail "scorer" "missing-reward" "transition has no reward"
                    | Some reward -> rewards.Add reward
                    do! observe()
                })
            }
            with error -> fail "episode" "exception" (error.GetType().FullName + ": " + error.Message)
        { Index = index; Complete = Result.isOk execution; Failure = (match execution with Ok () -> null | Error reason -> HiddenSwitchCompiledReceipt.Failure(reason.Stage, reason.Code, reason.Detail, null, "hand", strategy, Nullable(), Nullable index, Nullable()))
          Cues = binary cues; Actions = binary actions; States = binary states; Reward4 = rewards.ToArray()
          BeliefBits = beliefs.ToArray(); ChoiceWork = choices.ToArray(); FilterCounters = filter
          FrameSha256 = frames.ToArray(); ProjectionSha256 = projections.ToArray(); TotalReward4 = rewards |> Seq.sum }

    /// This intentionally incomplete envelope makes the completed slices
    /// available to independent replay without asserting full hand admission.
    let private collect (checkpoint: obj -> unit) arguments =
        let started = DateTimeOffset.UtcNow.ToString("O", CultureInfo.InvariantCulture)
        let scalars = ResizeArray<HiddenSwitchCompiledReceipt.ScalarAudit>()
        let episodes, old = ResizeArray<EpisodeRow>(), ResizeArray<OldRow>()
        let mutable numericHash = null
        let mutable assembly = null
        let mutable assemblyHash = null
        let mutable stage = "hand-provenance"
        let mutable activeIndex = Nullable<int>()
        let mutable activeStrategy = null
        let mutable primary: HiddenSwitchCompiledReceipt.Failure = null
        let mark nextStage index strategy =
            stage <- nextStage
            activeIndex <- index
            activeStrategy <- strategy
            checkpoint (box {| Kind = "hand-stage"; Stage = stage; Index = index; Strategy = strategy |})
        let execution =
            try result {
                mark "hand-provenance" (Nullable()) null
                assembly <- typeof<Report>.Assembly.Location
                assemblyHash <- File.ReadAllBytes assembly |> SHA256.HashData |> Convert.ToHexString
                checkpoint (box {| Kind = "hand-provenance"; AssemblyFile = assembly; AssemblySha256 = assemblyHash
                                   Arguments = arguments; Runtime = Environment.Version.ToString(); CertificateBindings = bindings() |})
                mark "hand-certificate" (Nullable()) null
                let! raw = HiddenSwitchCompiledCertificate.build (bindings())
                let! verified = HiddenSwitchCompiledCertificate.verify raw (bindings())
                numericHash <- HiddenSwitchCompiledCertificate.numericSha256 verified
                checkpoint (box {| Kind = "hand-certificate"; NumericCertificateSha256 = numericHash |})
                let guards = HiddenSwitchCompiledCertificate.guards verified
                do! scalarInputs guards |> iterate (fun input -> result {
                    mark "hand-scalars" (Nullable input.Index) null
                    let! belief = HiddenSwitchCompiledReceipt.parseFiniteBits input.BeliefBits
                    let! q, _ = HiddenSwitchPolicy.evaluate input.Effect belief input.Depth |> previous
                    let! native = HiddenSwitchCompiledPolicy.native input.Effect belief input.Depth
                    let! compiled = HiddenSwitchCompiledSelector.choose guards input.Effect belief input.Depth
                    let row: HiddenSwitchCompiledReceipt.ScalarAudit = { Input = input; QBits = Array.map HiddenSwitchCompiledReceipt.bits q; Native = native; Compiled = compiled }
                    scalars.Add row
                    checkpoint (box {| Kind = "hand-scalar"; Index = input.Index; Data = row |})
                })
                let mutable index = 0
                do! HiddenSwitchCarrier.handTapes() |> iterate (fun (name, tape) -> result {
                    do! [true; false] |> iterate (fun effect -> result {
                        do! ["dot", "fixed"; "bar", "fixed"; "dot", "odd-complement"] |> iterate (fun (geometry, palette) -> result {
                            do! ["native-recursive"; "compiled-guarded"] |> iterate (fun strategy -> result {
                                mark "hand-episodes" (Nullable index) strategy
                                let value = episode guards strategy index tape effect geometry palette
                                let row: EpisodeRow = { Tape = name; Effect = effect; Geometry = geometry; Palette = palette; Strategy = strategy; Episode = value }
                                episodes.Add row
                                if not value.Complete then primary <- value.Failure
                                checkpoint (box {| Kind = "hand-episode"; Index = index; Strategy = strategy; Data = row |})
                                if not value.Complete then return! Error value.Failure
                            })
                            mark "hand-old-controls" (Nullable index) "belief-depth3"
                            let value = HiddenSwitchExperiment.episode index tape effect geometry palette "belief-depth3"
                            let row: OldRow = { Tape = name; Effect = effect; Geometry = geometry; Palette = palette; Episode = value }
                            old.Add row
                            if not value.Complete then primary <- HiddenSwitchCompiledReceipt.fromPrevious value.Failure
                            checkpoint (box {| Kind = "hand-old-control"; Index = index; Data = row |})
                            if not value.Complete then return! Error(HiddenSwitchCompiledReceipt.fromPrevious value.Failure)
                            index <- index + 1
                        })
                    })
                })
            }
            with error ->
                if not (isNull primary) then Error primary
                else Error(HiddenSwitchCompiledReceipt.Failure(stage, "exception", error.GetType().FullName + ": " + error.Message,
                                                               null, "hand", activeStrategy, Nullable(), activeIndex, Nullable()))
        let pending = HiddenSwitchCompiledReceipt.failure "hand-admission" "pending-categories" "falsifier witnesses and full runtime/source admission are not yet supplied"
        { Kind = "hand-core-slices"; Complete = false; SlicesComplete = Result.isOk execution
          Failure = (match execution with Ok () -> pending | Error reason -> reason)
          RuntimeAdmitted = false; BodyResolved = false; ClosureAdmitted = false
          MissingCategories = [|"falsifiers"; "runtime-body-closure"; "full-source-archive-admission"|]
          SourceDraws = 0; StartedAtUtc = started; FinishedAtUtc = DateTimeOffset.UtcNow.ToString("O", CultureInfo.InvariantCulture)
          Runtime = Environment.Version.ToString(); Arguments = arguments; AssemblyFile = assembly
          AssemblySha256 = assemblyHash
          CertificateBindings = bindings(); NumericCertificateSha256 = numericHash
          Payload = { Scalars = scalars.ToArray(); Episodes = episodes.ToArray(); OldControls = old.ToArray(); Falsifiers = None }
          Scope = "explicit hand tapes and placeholder bindings only; complete slices may be replayed separately; this is not an admitted full hand, behavior, cost or implementation receipt" }

    let run path =
        let mutable primary: HiddenSwitchCompiledReceipt.Failure = null
        try
            // Exclusive ownership precedes any hand computation. An interrupted
            // or failed writer leaves its exact partial file; it is never reused.
            use output = new FileStream(path, FileMode.CreateNew, FileAccess.Write, FileShare.Read)
            use journal = new FileStream(path + ".checkpoint.jsonl", FileMode.CreateNew, FileAccess.Write, FileShare.Read)
            use writer = new StreamWriter(journal, UTF8Encoding(false))
            let checkpoint (value: obj) = writer.WriteLine(JsonSerializer.Serialize value); writer.Flush(); journal.Flush(true)
            checkpoint (box {| Kind = "hand-core-start"; StartedAtUtc = DateTimeOffset.UtcNow.ToString("O", CultureInfo.InvariantCulture)
                               SourceDraws = 0; Complete = false; RuntimeAdmitted = false |})
            let value = collect checkpoint [|"hand-core"; path|]
            if not value.SlicesComplete then primary <- value.Failure
            checkpoint (box {| Kind = "hand-core-collected"; SlicesComplete = value.SlicesComplete; Complete = false; Failure = value.Failure
                               Scalars = value.Payload.Scalars.Length; Episodes = value.Payload.Episodes.Length; OldControls = value.Payload.OldControls.Length |})
            let bytes = JsonSerializer.SerializeToUtf8Bytes value
            output.Write bytes
            output.WriteByte 10uy
            output.Flush(true)
            if value.SlicesComplete then Ok() else Error value.Failure
        with error ->
            if not (isNull primary) then Error primary
            else fail "hand-output" "write" (error.GetType().FullName + ": " + error.Message)
