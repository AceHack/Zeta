namespace Zeta.Research

open System
open System.Globalization
open System.IO
open System.Security.Cryptography
open System.Text
open System.Text.Json
open Zeta.Core

/// Standalone six-member semantic prerequisites, with no invented outer artifact.
[<RequireQualifiedAccess>]
module HiddenSwitchCompiledSemantic =
    type Coverage = { OldIndex: int; NewIndices: int[] }
    type Semantic =
        { Schema: string; ScalarCoverage: int[]; HandCoverage: Coverage[]
          InvocationCases: HiddenSwitchCompiledWitness.InvocationCase[]
          InterventionCases: HiddenSwitchCompiledInterventions.Case[]
          RefusalCases: HiddenSwitchCompiledRefusals.Group[] }
    type Payload =
        { Scalars: HiddenSwitchCompiledReceipt.ScalarAudit[]; Episodes: HiddenSwitchCompiledHand.EpisodeRow[]
          OldControls: HiddenSwitchCompiledHand.OldRow[]; Semantic: Semantic }

    let internal runWithJournalObserver (observer: obj -> unit) path =
        let mutable primary: HiddenSwitchCompiledReceipt.Failure = null
        try
            use output = new FileStream(path, FileMode.CreateNew, FileAccess.Write, FileShare.Read)
            use journal = new FileStream(path + ".checkpoint.jsonl", FileMode.CreateNew, FileAccess.Write, FileShare.Read)
            use writer = new StreamWriter(journal, UTF8Encoding(false))
            let checkpoint (value: obj) =
                observer value
                writer.WriteLine(JsonSerializer.Serialize value); writer.Flush(); journal.Flush(true)
            let started = DateTimeOffset.UtcNow.ToString("O", CultureInfo.InvariantCulture)
            let binding = HiddenSwitchCompiledHand.bindings()
            let mutable assembly, assemblyHash, numericHash = null, null, null
            let mutable scalars, episodes, old = [||], [||], [||]
            let mutable invocations, interventions, refusals = [||], [||], [||]
            let mutable stage = "hand-semantic-provenance"
            let mutable activeDiagnostic: obj = null
            let keep value =
                match value with Error reason -> primary <- reason | Ok _ -> ()
                value
            let mark next = stage <- next; checkpoint (box {| Kind = "semantic-stage"; Stage = stage |})
            let execution =
                try result {
                    checkpoint (box {| Kind = "semantic-start"; StartedAtUtc = started; Complete = false; SourceDraws = 0 |})
                    assembly <- typeof<Semantic>.Assembly.Location
                    assemblyHash <- File.ReadAllBytes assembly |> SHA256.HashData |> Convert.ToHexString
                    checkpoint (box {| Kind = "semantic-provenance"; AssemblyFile = assembly; AssemblySha256 = assemblyHash
                                       Arguments = [|"hand-semantic"; path|]; Runtime = Environment.Version.ToString(); CertificateBindings = binding |})
                    mark "hand-semantic-core"
                    let core = HiddenSwitchCompiledHand.collect checkpoint [|"hand-semantic"; path|]
                    scalars <- core.Payload.Scalars; episodes <- core.Payload.Episodes; old <- core.Payload.OldControls
                    numericHash <- core.NumericCertificateSha256
                    if not core.SlicesComplete then return! Error core.Failure |> keep
                    mark "hand-semantic-certificate"
                    let! raw = HiddenSwitchCompiledCertificate.build binding |> keep
                    let! verified = HiddenSwitchCompiledCertificate.verify raw binding |> keep
                    if HiddenSwitchCompiledCertificate.numericSha256 verified <> numericHash then
                        return! Error(HiddenSwitchCompiledReceipt.failure stage "certificate-identity" "core and semantic numeric certificates differ") |> keep
                    let guards = HiddenSwitchCompiledCertificate.guards verified
                    checkpoint (box {| Kind = "semantic-certificate"; NumericCertificateSha256 = numericHash |})
                    mark "hand-semantic-invocations"
                    let invocationRows, invocationOutcome = HiddenSwitchCompiledWitness.collectInvocations checkpoint guards
                    invocations <- invocationRows
                    do! invocationOutcome |> keep
                    mark "hand-semantic-interventions"
                    let interventionRows, interventionOutcome, activeIntervention = HiddenSwitchCompiledInterventions.collect checkpoint guards
                    interventions <- interventionRows
                    activeDiagnostic <- activeIntervention
                    do! interventionOutcome |> keep
                    mark "hand-semantic-refusals"
                    let refusalRows, refusalOutcome, activeRefusal = HiddenSwitchCompiledRefusals.collect checkpoint guards
                    refusals <- refusalRows
                    activeDiagnostic <- activeRefusal
                    do! refusalOutcome |> keep
                }
                with error ->
                    if isNull primary then Error(HiddenSwitchCompiledConformance.exceptionFailure stage error)
                    else Error primary
            match execution with Error reason -> primary <- reason | Ok () -> ()
            let payload: Payload =
                { Scalars = scalars; Episodes = episodes; OldControls = old
                  Semantic = { Schema = "zeta.hidden-switch.compiled.falsifiers.v1"; ScalarCoverage = [|0 .. 221|]
                               HandCoverage = [|for index in 0 .. 23 -> { OldIndex = index; NewIndices = [|2 * index; 2 * index + 1|] }|]
                               InvocationCases = invocations; InterventionCases = interventions; RefusalCases = refusals } }
            let mutable slicesComplete = Result.isOk execution
            try
                checkpoint (box {| Kind = "semantic-finished"; SlicesComplete = slicesComplete; Complete = false; Failure = primary
                                   Scalars = scalars.Length; Episodes = episodes.Length; OldControls = old.Length
                                   InvocationCases = invocations.Length; InterventionCases = interventions.Length
                                   RefusalGroups = refusals.Length; RefusalOperations = refusals |> Array.sumBy (fun group -> group.Operations.Length) |})
            with error ->
                slicesComplete <- false
                if isNull primary then primary <- HiddenSwitchCompiledConformance.exceptionFailure "hand-semantic-journal" error
            let pending = HiddenSwitchCompiledReceipt.failure "hand-admission" "pending-categories" "outer-negative evidence and full source/runtime/closure admission remain pending"
            let report =
                {| Kind = "hand-semantic-slices"; Complete = false; SlicesComplete = slicesComplete
                   Failure = (if isNull primary then pending else primary)
                   RuntimeAdmitted = false; BodyResolved = false; ClosureAdmitted = false; SourceDraws = 0
                   MissingCategories = [|"outer-negative-evidence"; "runtime-body-closure"; "full-source-archive-admission"|]
                   StartedAtUtc = started; FinishedAtUtc = DateTimeOffset.UtcNow.ToString("O", CultureInfo.InvariantCulture)
                   Arguments = [|"hand-semantic"; path|]; Runtime = Environment.Version.ToString()
                   AssemblyFile = assembly; AssemblySha256 = assemblyHash; CertificateBindings = binding
                   NumericCertificateSha256 = numericHash; Payload = payload; ActiveDiagnostic = activeDiagnostic
                   Scope = "explicit hand tapes and placeholder bindings; six semantic members only; no full hand/runtime/archive admission" |}
            try
                let bytes = JsonSerializer.SerializeToUtf8Bytes report
                output.Write bytes; output.WriteByte 10uy; output.Flush(true)
            with error ->
                if isNull primary then primary <- HiddenSwitchCompiledConformance.exceptionFailure "hand-semantic-output" error
            if isNull primary then Ok() else Error primary
        with error ->
            if isNull primary then Error(HiddenSwitchCompiledConformance.exceptionFailure "hand-semantic-output" error)
            else Error primary

    /// Normal untimed collection has no injected journal fault.
    let run path = runWithJournalObserver ignore path
