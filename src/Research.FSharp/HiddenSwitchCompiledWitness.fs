namespace Zeta.Research

open System
open System.Globalization
open System.IO
open System.Security.Cryptography
open System.Text
open System.Text.Json
open Zeta.Core

/// Untimed, explicit conformance calls. This module is not a measurement arm.
[<RequireQualifiedAccess>]
module HiddenSwitchCompiledWitness =
    type Input = { BeliefBits: string; Effect: bool; Depth: int }
    type Invocation =
        { Sequence: int; Kind: string; Input: Input; DelegateEntries: int; EvaluatorEntries: int
          Returned: HiddenSwitchCompiledReceipt.ChoiceWork option; Failure: HiddenSwitchCompiledReceipt.Failure }
    type Mutation = { BaselineCaseId: string; Kind: string }
    type InvocationCase =
        { CaseId: string; Input: Input; Mode: string; Choice: HiddenSwitchCompiledReceipt.ChoiceWork
          Invocations: Invocation[]; Mutation: Mutation option }
    type SelectorInput = { QBits: string[] }
    type SelectorMutation = { Kind: string; Action: int }
    type SelectorWitness = { Input: SelectorInput; ActualAction: int; Mutation: SelectorMutation }

    let private fail code detail = Error(HiddenSwitchCompiledReceipt.failure "hand-invocations" code detail)
    let private exceptionFailure (error: exn) = HiddenSwitchCompiledReceipt.failure "hand-invocations" "exception" (error.GetType().FullName + ": " + error.Message)
    let private previous value = value |> Result.mapError HiddenSwitchCompiledReceipt.fromPrevious
    let private iterate operation values = values |> Seq.fold (fun state value -> state |> Result.bind (fun () -> operation value)) (Ok())

    /// Each callback entry and each evaluator-root entry is observed at its real
    /// call site. Returned traversal counts remain the old evaluator's counters.
    let collectInvocations (checkpoint: obj -> unit) guards =
        let rows = ResizeArray<InvocationCase>()
        let mutable primary: HiddenSwitchCompiledReceipt.Failure = null
        let run caseId mode effect belief depth mutation = result {
            let input = { BeliefBits = HiddenSwitchCompiledReceipt.bits belief; Effect = effect; Depth = depth }
            checkpoint (box {| Kind = "invocation-stage"; CaseId = caseId; Input = input |})
            let events = ResizeArray<Invocation>()
            let service effect belief depth =
                let mutable delegateEntries, evaluatorEntries = 0, 0
                delegateEntries <- delegateEntries + 1
                let returned =
                    try
                        match mutation with
                        | Some (baseline: InvocationCase) ->
                            // The deliberately wrong callback is actually called;
                            // it never enters nativeCore or the real evaluator.
                            Ok { baseline.Choice with Action = 1uy - baseline.Choice.Action; Path = 0uy
                                                      GuardComparisons = 0u; RecursiveCalls = 0u; Nodes = 0u
                                                      ActionValues = 0u; Predictions = 0u; Updates = 0u }
                        | None ->
                            let evaluator effect belief depth =
                                evaluatorEntries <- evaluatorEntries + 1
                                HiddenSwitchPolicy.evaluate effect belief depth
                            HiddenSwitchCompiledPolicy.nativeCore evaluator effect belief depth
                    with error -> Error(exceptionFailure error)
                let observed =
                    { Sequence = events.Count; Kind = (if mutation.IsSome then "deliberate-stub" else "real-recursive")
                      Input = { BeliefBits = HiddenSwitchCompiledReceipt.bits belief; Effect = effect; Depth = depth }
                      DelegateEntries = delegateEntries; EvaluatorEntries = evaluatorEntries
                      Returned = (match returned with Ok value -> Some value | Error _ -> None)
                      Failure = (match returned with Ok _ -> null | Error reason -> reason) }
                match returned with Error reason -> primary <- reason | Ok _ -> ()
                events.Add observed
                checkpoint (box {| Kind = "invocation-entry"; CaseId = caseId; Data = observed |})
                returned
            let! choice =
                if mode = "unsupported-runtime" then HiddenSwitchCompiledSelector.unsupportedWith service effect belief depth
                else HiddenSwitchCompiledSelector.chooseWithFallback service guards effect belief depth
            let row =
                { CaseId = caseId; Input = input; Mode = mode; Choice = choice; Invocations = events.ToArray()
                  Mutation = mutation |> Option.map (fun baseline -> { BaselineCaseId = baseline.CaseId; Kind = "opposite-action-no-evaluator" }) }
            rows.Add row
            checkpoint (box {| Kind = "invocation-case"; CaseId = caseId; Data = row |})
            return row
        }
        let execution =
            try result {
                do! [true; false] |> iterate (fun effect -> result {
                    do! [1 .. 3] |> iterate (fun depth -> result {
                        let label = if effect then "true" else "false"
                        let! _ = run (sprintf "unsupported-runtime-effect-%s-depth-%d" label depth) "unsupported-runtime" effect 0.5 depth None
                        ()
                    })
                })
                let baselines = ResizeArray<InvocationCase>()
                do! [2; 3] |> iterate (fun depth -> result {
                    let struct(low, high) = if depth = 2 then HiddenSwitchCompiledCertificate.depthTwo guards else HiddenSwitchCompiledCertificate.depthThree guards
                    let belief = Math.BitIncrement low
                    if not (belief < high) then return! fail "guard-interior" "the fixed successor must lie strictly inside the fallback interval"
                    let! baseline = run (sprintf "real-fallback-depth-%d" depth) "guarded" true belief depth None
                    baselines.Add baseline
                })
                do! baselines |> iterate (fun baseline -> result {
                    let! belief = HiddenSwitchCompiledReceipt.parseFiniteBits baseline.Input.BeliefBits
                    let! _ = run (sprintf "stubbed-fallback-depth-%d" baseline.Input.Depth) "guarded" true belief baseline.Input.Depth (Some baseline)
                    ()
                })
            }
            with error -> if isNull primary then Error(exceptionFailure error) else Error primary
        rows.ToArray(), execution

    /// Epsilon is read from the exact admitted certificate bytes. Actual old
    /// strict selection and the explicit >= mutant are both executed, without
    /// changing the archived selector or either action service.
    let private selectorWitness (raw: byte[]) =
        use document = JsonDocument.Parse raw
        result {
            let epsilonBits = document.RootElement.GetProperty("Model").GetProperty("EpsilonBits").GetString()
            let! epsilon = HiddenSwitchCompiledReceipt.parseFiniteBits epsilonBits
            let q = [|0.0; epsilon|]
            let! actual = HiddenSwitchPolicy.select q |> previous
            let mutant = if q.[1] - q.[0] >= epsilon then 1 else 0
            return { Input = { QBits = Array.map HiddenSwitchCompiledReceipt.bits q }; ActualAction = actual
                     Mutation = { Kind = "inclusive-epsilon-comparison"; Action = mutant } }
        }

    /// Incomplete witness envelope; full payload, outer negatives and runtime
    /// admission are coordinator obligations. Successful checkpoint writes
    /// preserve completed prefixes; abrupt/storage failures can limit retention.
    let run path =
        let mutable primary: HiddenSwitchCompiledReceipt.Failure = null
        try
            use output = new FileStream(path, FileMode.CreateNew, FileAccess.Write, FileShare.Read)
            use journal = new FileStream(path + ".checkpoint.jsonl", FileMode.CreateNew, FileAccess.Write, FileShare.Read)
            use writer = new StreamWriter(journal, UTF8Encoding(false))
            let checkpoint (value: obj) = writer.WriteLine(JsonSerializer.Serialize value); writer.Flush(); journal.Flush(true)
            let started = DateTimeOffset.UtcNow.ToString("O", CultureInfo.InvariantCulture)
            let binding = HiddenSwitchCompiledHand.bindings()
            let mutable assembly, assemblyHash, numericHash = null, null, null
            let mutable cases = [||]
            let mutable selector = None
            let execution =
                try result {
                    checkpoint (box {| Kind = "invocations-start"; StartedAtUtc = started; Complete = false; SourceDraws = 0 |})
                    assembly <- typeof<Invocation>.Assembly.Location
                    assemblyHash <- File.ReadAllBytes assembly |> SHA256.HashData |> Convert.ToHexString
                    checkpoint (box {| Kind = "invocations-provenance"; AssemblyFile = assembly; AssemblySha256 = assemblyHash
                                       Runtime = Environment.Version.ToString(); Arguments = [|"hand-invocations"; path|]; CertificateBindings = binding |})
                    let! raw = HiddenSwitchCompiledCertificate.build binding
                    let! verified = HiddenSwitchCompiledCertificate.verify raw binding
                    numericHash <- HiddenSwitchCompiledCertificate.numericSha256 verified
                    checkpoint (box {| Kind = "invocations-certificate"; NumericCertificateSha256 = numericHash |})
                    let completed, outcome = collectInvocations checkpoint (HiddenSwitchCompiledCertificate.guards verified)
                    cases <- completed
                    do! outcome
                    let! observed = selectorWitness raw
                    selector <- Some observed
                    checkpoint (box {| Kind = "selector-witness"; Data = observed |})
                }
                with error -> Error(exceptionFailure error)
            match execution with Error reason -> primary <- reason | Ok _ -> ()
            let pending = HiddenSwitchCompiledReceipt.failure "hand-admission" "pending-categories" "interventions, refusal cases and full runtime/source admission remain pending"
            let report = {| Kind = "hand-invocation-slices"; Complete = false; SlicesComplete = Result.isOk execution
                            Failure = (if isNull primary then pending else primary)
                            RuntimeAdmitted = false; BodyResolved = false; ClosureAdmitted = false; SourceDraws = 0
                            StartedAtUtc = started; FinishedAtUtc = DateTimeOffset.UtcNow.ToString("O", CultureInfo.InvariantCulture)
                            AssemblyFile = assembly; AssemblySha256 = assemblyHash; Runtime = Environment.Version.ToString()
                            Arguments = [|"hand-invocations"; path|]; CertificateBindings = binding; NumericCertificateSha256 = numericHash
                            InvocationCases = cases; SelectorWitness = selector |}
            // Either publication may fail independently. Still try the other;
            // neither can replace an already established computation failure.
            try checkpoint (box {| Kind = "invocations-collected"; Data = report |})
            with error -> if isNull primary then primary <- exceptionFailure error
            let retained = if isNull primary then report else {| report with SlicesComplete = false; Failure = primary |}
            try
                output.Write(JsonSerializer.SerializeToUtf8Bytes retained)
                output.WriteByte 10uy
                output.Flush(true)
            with error -> if isNull primary then primary <- exceptionFailure error
            if not (isNull primary) then Error primary else execution
        with error -> if isNull primary then Error(exceptionFailure error) else Error primary
