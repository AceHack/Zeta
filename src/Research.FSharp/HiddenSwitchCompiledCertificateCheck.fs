namespace Zeta.Research

open System
open System.Collections.Generic
open System.Globalization
open System.IO
open System.Security.Cryptography
open System.Text
open System.Text.Json
open Zeta.Core

/// File-backed, untimed calls of the real certificate verifier. No choice
/// service, source generator or measurement entry is reachable here.
[<RequireQualifiedAccess>]
module HiddenSwitchCompiledCertificateCheck =
    let private fail stage code detail = Error(HiddenSwitchCompiledReceipt.failure stage code detail)
    let private unexpected stage (error: exn) = HiddenSwitchCompiledReceipt.failure stage "exception" (error.GetType().FullName + ": " + error.Message)
    let private hash (bytes: byte[]) = bytes |> SHA256.HashData |> Convert.ToHexString

    /// Strict caller-map syntax precedes construction. Values must be canonical
    /// SHA256 strings; semantic source/archive admission remains outside this
    /// supplied-binding conformance entry.
    let internal admitBindings (raw: byte[]) =
        try
            use document = JsonDocument.Parse raw
            let value = document.RootElement
            if value.ValueKind <> JsonValueKind.Object then fail "certificate-bindings" "shape" "requires an object of source names and SHA256 strings"
            else
                let names = HashSet<string>(StringComparer.Ordinal)
                let mutable failure: HiddenSwitchCompiledReceipt.Failure = null
                let mutable bindings = Map.empty
                for property in value.EnumerateObject() do
                    if isNull failure then
                        if String.IsNullOrWhiteSpace property.Name || not (names.Add property.Name) then
                            failure <- HiddenSwitchCompiledReceipt.failure "certificate-bindings" "duplicate-or-empty-key" "binding names must be nonempty and unique"
                        elif property.Value.ValueKind <> JsonValueKind.String then
                            failure <- HiddenSwitchCompiledReceipt.failure "certificate-bindings" "type" "each binding value must be a SHA256 string"
                        else
                            let text = property.Value.GetString()
                            if isNull text || text.Length <> 64 || text |> Seq.exists (fun c -> not ((c >= '0' && c <= '9') || (c >= 'A' && c <= 'F'))) then
                                failure <- HiddenSwitchCompiledReceipt.failure "certificate-bindings" "sha256" "requires sixty-four uppercase hexadecimal digits"
                            else bindings <- Map.add property.Name text bindings
                if not (isNull failure) then Error failure
                elif Map.isEmpty bindings then fail "certificate-bindings" "empty" "requires a nonempty caller binding map"
                else Ok bindings
        with error -> Error(unexpected "certificate-bindings" error)

    let run bindingsPath inputPath outputPath =
        let mutable primary: HiddenSwitchCompiledReceipt.Failure = null
        try
            use output = new FileStream(outputPath, FileMode.CreateNew, FileAccess.Write, FileShare.Read)
            use journal = new FileStream(outputPath + ".checkpoint.jsonl", FileMode.CreateNew, FileAccess.Write, FileShare.Read)
            use writer = new StreamWriter(journal, UTF8Encoding(false))
            let checkpoint (value: obj) = writer.WriteLine(JsonSerializer.Serialize value); writer.Flush(); journal.Flush(true)
            let started = DateTimeOffset.UtcNow.ToString("O", CultureInfo.InvariantCulture)
            let arguments = [|"certificate-check"; bindingsPath; inputPath; outputPath|]
            let mutable stage = "certificate-check-start"
            let mutable inputHash, bindingsHash, assembly, assemblyHash = null, null, null, null
            let mutable outcome: obj option = None
            let mutable calls = 0
            let execution =
                try result {
                    checkpoint (box {| Kind = "certificate-check-start"; StartedAtUtc = started; Arguments = arguments; SourceDraws = 0 |})
                    stage <- "certificate-input-read"
                    let raw = File.ReadAllBytes inputPath
                    inputHash <- hash raw
                    checkpoint (box {| Kind = "certificate-input"; InputSha256 = inputHash; Bytes = raw.Length |})
                    stage <- "certificate-bindings-read"
                    let bindingBytes = File.ReadAllBytes bindingsPath
                    bindingsHash <- hash bindingBytes
                    checkpoint (box {| Kind = "certificate-bindings"; BindingsSha256 = bindingsHash; Bytes = bindingBytes.Length |})
                    let! bindings = admitBindings bindingBytes
                    stage <- "certificate-check-provenance"
                    assembly <- typeof<HiddenSwitchCompiledReceipt.Failure>.Assembly.Location
                    assemblyHash <- File.ReadAllBytes assembly |> hash
                    checkpoint (box {| Kind = "certificate-check-provenance"; AssemblyFile = assembly; AssemblySha256 = assemblyHash; Runtime = Environment.Version.ToString() |})
                    stage <- "certificate-verify"
                    checkpoint (box {| Kind = "certificate-verify-enter"; InputSha256 = inputHash; BindingsSha256 = bindingsHash |})
                    calls <- calls + 1
                    let actual = HiddenSwitchCompiledCertificate.verify raw bindings
                    outcome <- Some(match actual with
                                    | Ok verified -> box {| Kind = "accepted"; NumericCertificateSha256 = HiddenSwitchCompiledCertificate.numericSha256 verified |}
                                    | Error reason -> box {| Kind = "refused"; Failure = reason |})
                }
                with error -> Error(unexpected stage error)
            match execution with Error reason -> primary <- reason | Ok _ -> ()
            let report = {| Kind = "certificate-verification"; Complete = Result.isOk execution; Failure = primary
                            VerifyCalls = calls; InputSha256 = inputHash; BindingsSha256 = bindingsHash; Outcome = outcome
                            AssemblyFile = assembly; AssemblySha256 = assemblyHash; Runtime = Environment.Version.ToString(); Arguments = arguments
                            StartedAtUtc = started; FinishedAtUtc = DateTimeOffset.UtcNow.ToString("O", CultureInfo.InvariantCulture)
                            SourceDraws = 0; RuntimeAdmitted = false |}
            try checkpoint (box {| Kind = "certificate-check-finished"; Data = report |})
            with error -> if isNull primary then primary <- unexpected "certificate-check-journal" error
            let retained = if isNull primary then report else {| report with Complete = false; Failure = primary |}
            try
                output.Write(JsonSerializer.SerializeToUtf8Bytes retained)
                output.WriteByte 10uy
                output.Flush(true)
            with error -> if isNull primary then primary <- unexpected "certificate-check-output" error
            if isNull primary then Ok() else Error primary
        with error -> if isNull primary then Error(unexpected "certificate-check-output" error) else Error primary
