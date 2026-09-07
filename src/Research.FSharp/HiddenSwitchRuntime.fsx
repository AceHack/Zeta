module HiddenSwitchRuntime

open System
open System.Collections.Generic
open System.Diagnostics
open System.IO
open System.Runtime.InteropServices
open System.Text
open System.Text.Json
open Zeta.Core
open Zeta.Research

let protocolFile = "docs/research/2026-09-07-hidden-switch-protocol.md"
let expectedProtocolHash = "E6E2943D5991E70DBC95D3ED1E620AA7505D3E692315E80588729C9FCD03946A"
let registrationTag = "refs/tags/archive/experiments/081M1XK02XM087G0R00043EW05-registration"
let expectedRegistration = "6a3150037a1e6be6ae89996dc8562f2061f7c75d"
let implementationTag = "refs/tags/archive/experiments/081M1XK02XM087G0R00043EW05-implementation"
let handFile = "docs/research/hidden-switch-validation/2026-09-07/hand-fixture.json"
let sourceFiles =
    [| "src/Core/ControlScheme.fs"; "src/Core/GameEnvironment.fs"; "src/Core/Result.fs"; "src/Core/SplitMix64.fs"
       "src/Research.FSharp/ResearchRandom.fs"; "src/Research.FSharp/HiddenSwitchReceipt.fs"
       "src/Research.FSharp/HiddenSwitchObservation.fs"; "src/Research.FSharp/HiddenSwitchCarrier.fs"
       "src/Research.FSharp/HiddenSwitchPolicy.fs"; "src/Research.FSharp/HiddenSwitchExperiment.fs"
       "src/Research.FSharp/HiddenSwitchRuntime.fsx"; "src/Research.FSharp/run-hidden-switch-experiment.fsx"
       "src/Research.FSharp/measure-hidden-switch-inference.fsx"; "src/Research.FSharp/check-hidden-switch-kernel.fsx"
       "src/Interp.Python/zeta_interp/hidden_switch_reference.py"; "src/Interp.Python/zeta_interp/hidden_switch_replay.py"
       "src/Interp.Python/zeta_interp/hidden_switch_verdict.py"; protocolFile; handFile |]
let private fail code detail = Error(HiddenSwitchReceipt.failure "admission" code detail)
let private git root arguments =
    try
        let info = ProcessStartInfo("git")
        info.WorkingDirectory <- root
        info.UseShellExecute <- false
        info.RedirectStandardOutput <- true
        info.RedirectStandardError <- true
        for argument in arguments do info.ArgumentList.Add argument
        use proc = Process.Start info
        use data = new MemoryStream()
        proc.StandardOutput.BaseStream.CopyTo data
        let error = proc.StandardError.ReadToEnd()
        proc.WaitForExit()
        if proc.ExitCode = 0 then Ok(data.ToArray()) else fail "git" (error.Trim())
    with
    | :? IOException as error -> fail "git" error.Message
    | :? ComponentModel.Win32Exception as error -> fail "git-launch" error.Message
let private gitText root arguments = git root arguments |> Result.map (Encoding.UTF8.GetString >> _.Trim())
let readBytes stage path =
    try Ok(File.ReadAllBytes path)
    with
    | :? IOException as error -> Error(HiddenSwitchReceipt.failure stage "read" error.Message)
    | :? UnauthorizedAccessException as error -> Error(HiddenSwitchReceipt.failure stage "read" error.Message)
let private canonicalRunner root actual name =
    let expected = Path.GetFullPath(Path.Combine(root, "src/Research.FSharp", name))
    if String.Equals(Path.GetFullPath actual, expected, StringComparison.Ordinal) then Ok()
    else fail "executing-path" "executing script must be the admitted canonical runner, not a renamed copy"
let admitRegistration root actual name =
    result {
        do! canonicalRunner root actual name
        let! kind = gitText root ["cat-file"; "-t"; registrationTag]
        if kind <> "tag" then return! fail "registration-type" "registration must be the immutable annotated tag"
        let! commit = gitText root ["rev-parse"; "--verify"; registrationTag + "^{commit}"]
        if commit <> expectedRegistration then return! fail "registration-commit" "registration tag resolved to different commit"
        let! current = readBytes "admission" (Path.Combine(root, protocolFile))
        let! registered = git root ["show"; commit + ":" + protocolFile]
        if current <> registered || HiddenSwitchObservation.sha256 current <> expectedProtocolHash then
            return! fail "protocol-bytes" "protocol must match exact remote registration bytes"
        return commit
    }
/// Retain whatever provenance was available when admission failed, without marking it admitted.
let admit root actual name arguments =
    let hashes = ResizeArray<HiddenSwitchReceipt.SourceHash>()
    let mutable sourceCommit, registration, implementation = "", "", ""
    let mutable assemblies: HiddenSwitchReceipt.LoadedAssembly[] = [||]
    let outcome =
        result {
            let! head = gitText root ["rev-parse"; "HEAD"]
            sourceCommit <- head
            let! registered = admitRegistration root actual name
            registration <- registered
            let! kind = gitText root ["cat-file"; "-t"; implementationTag]
            if kind <> "tag" then return! fail "implementation-type" "implementation must be a preserved annotated tag"
            let! archived = gitText root ["rev-parse"; "--verify"; implementationTag + "^{commit}"]
            implementation <- archived
            let! _ = git root ["merge-base"; "--is-ancestor"; registration; implementation]
            let checkFile file = result {
                let! current = readBytes "admission" (Path.Combine(root, file))
                let! archivedBytes = git root ["show"; implementation + ":" + file]
                let! committedBytes = git root ["show"; sourceCommit + ":" + file]
                if current <> archivedBytes then return! fail "archive-bytes" ("current bytes differ from implementation archive: " + file)
                if current <> committedBytes then return! fail "head-bytes" ("current bytes differ from declared SourceCommit: " + file)
                hashes.Add { File = file; Sha256 = HiddenSwitchObservation.sha256 current } }
            do! sourceFiles |> Array.fold (fun state file -> state |> Result.bind (fun () -> checkFile file)) (Ok())
            let loaded = [|typeof<GameEnvironment.Frame>.Assembly; typeof<IBilinearMarker>.Assembly|]
            let evidence = ResizeArray<HiddenSwitchReceipt.LoadedAssembly>()
            do! loaded |> Array.fold (fun state assembly -> state |> Result.bind (fun () ->
                readBytes "admission" assembly.Location |> Result.map (fun bytes ->
                    evidence.Add { Name = assembly.GetName().Name; Mvid = assembly.ManifestModule.ModuleVersionId.ToString("D")
                                   Sha256 = HiddenSwitchObservation.sha256 bytes }))) (Ok())
            assemblies <- evidence.ToArray() |> Array.sortBy _.Name
            if Array.map (fun (item: HiddenSwitchReceipt.LoadedAssembly) -> item.Name) assemblies <> [|"Zeta.Core"; "Zeta.Core.Abstractions"|] then return! fail "assemblies" "unexpected loaded native assemblies"
        }
    let provenance: HiddenSwitchReceipt.Provenance =
        { SourceCommit = sourceCommit; RegistrationTag = registrationTag; RegistrationCommit = registration
          ImplementationTag = implementationTag; ImplementationCommit = implementation; SourceHashes = hashes.ToArray()
          LoadedAssemblies = assemblies; Runtime = RuntimeInformation.FrameworkDescription; OperatingSystem = RuntimeInformation.OSDescription
          Arguments = arguments }
    provenance, (match outcome with Ok() -> null | Error reason -> reason)
let utcNow () = DateTimeOffset.UtcNow.ToString("O", Globalization.CultureInfo.InvariantCulture)
let chronology earlier later =
    let parse (value: string) =
        let mutable parsed = DateTimeOffset.MinValue
        if DateTimeOffset.TryParseExact(value, "O", Globalization.CultureInfo.InvariantCulture, Globalization.DateTimeStyles.None, &parsed)
           && parsed.Offset = TimeSpan.Zero then Some parsed else None
    match parse earlier, parse later with
    | Some first, Some second when first <= second -> Ok()
    | _ -> fail "chronology" "requires canonical UTC timestamps in nondecreasing execution order"
let writeNew output receipt =
    try
        if File.Exists output || File.Exists(output + ".partial") then fail "output-exists" "refusing existing receipt or partial attempt"
        else
            // Compact JSON retains the complete registered roster below repository per-file limits.
            let raw = Encoding.UTF8.GetBytes(JsonSerializer.Serialize(receipt, JsonSerializerOptions(WriteIndented = false)) + "\n")
            use stream = new FileStream(output + ".partial", FileMode.CreateNew, FileAccess.Write, FileShare.None)
            stream.Write raw
            stream.Flush true
            stream.Dispose()
            File.Move(output + ".partial", output, false)
            Ok(HiddenSwitchObservation.sha256 raw)
    with
    | :? IOException as error -> fail "output-write" error.Message
    | :? UnauthorizedAccessException as error -> fail "output-write" error.Message
    | :? ArgumentException as error -> fail "output-json" error.Message
let private sameSource (a: HiddenSwitchReceipt.Provenance) (b: HiddenSwitchReceipt.Provenance) =
    not (obj.ReferenceEquals(a, null)) && a.SourceCommit = b.SourceCommit
    && a.RegistrationTag = b.RegistrationTag && a.RegistrationCommit = b.RegistrationCommit
    && a.ImplementationTag = b.ImplementationTag && a.ImplementationCommit = b.ImplementationCommit
    && a.SourceHashes = b.SourceHashes && a.LoadedAssemblies = b.LoadedAssemblies
    && a.Runtime = b.Runtime && a.OperatingSystem = b.OperatingSystem
/// JSON object keys and finite numeric values are admitted before typed decoding.
let strictJson raw =
    try
        use document = JsonDocument.Parse(raw: byte[])
        let rec valid (value: JsonElement) =
            match value.ValueKind with
            | JsonValueKind.Object ->
                let keys = HashSet<string>(StringComparer.Ordinal)
                value.EnumerateObject() |> Seq.forall (fun property -> keys.Add property.Name && valid property.Value)
            | JsonValueKind.Array -> value.EnumerateArray() |> Seq.forall valid
            | JsonValueKind.Number ->
                let mutable number = 0.0
                value.TryGetDouble(&number) && Double.IsFinite number
            | _ -> true
        if valid document.RootElement then Ok() else fail "input-json" "duplicate object keys or nonfinite numeric value"
    with :? JsonException as error -> fail "input-json" error.Message
/// Require the exact recursive DTO shape, including explicit Complete/Failure keys.
/// A missing F# record field must not acquire its CLR default during deserialization.
let nativeShape raw =
    try
        use document = JsonDocument.Parse(raw: byte[])
        let properties = Dictionary<Type, Reflection.PropertyInfo[]>()
        let rec shape (expected: Type) (value: JsonElement) =
            if value.ValueKind = JsonValueKind.Null then expected = typeof<HiddenSwitchReceipt.Failure>
            elif expected.IsArray then
                value.ValueKind = JsonValueKind.Array && (value.EnumerateArray() |> Seq.forall (shape (expected.GetElementType())))
            elif expected = typeof<string> then value.ValueKind = JsonValueKind.String
            elif expected = typeof<bool> then value.ValueKind = JsonValueKind.True || value.ValueKind = JsonValueKind.False
            elif expected = typeof<int> then
                let mutable number = 0
                value.ValueKind = JsonValueKind.Number && value.TryGetInt32(&number)
            elif expected = typeof<float> then
                let mutable number = 0.0
                value.ValueKind = JsonValueKind.Number && value.TryGetDouble(&number) && Double.IsFinite number
            elif value.ValueKind <> JsonValueKind.Object then false
            else
                let fields =
                    match properties.TryGetValue expected with
                    | true, fields -> fields
                    | _ ->
                        let fields = expected.GetProperties(Reflection.BindingFlags.Public ||| Reflection.BindingFlags.Instance)
                        properties.Add(expected, fields)
                        fields
                value.EnumerateObject() |> Seq.length = fields.Length
                && Array.forall (fun (field: Reflection.PropertyInfo) ->
                    let mutable child = Unchecked.defaultof<JsonElement>
                    value.TryGetProperty(field.Name, &child) && shape field.PropertyType child) fields
        if shape typeof<HiddenSwitchReceipt.Native> document.RootElement then Ok()
        else fail "behavior-shape" "native behavior requires every declared DTO field and exact scalar/container types"
    with :? JsonException as error -> fail "behavior-json" error.Message
let behaviorArguments (arguments: string[]) =
    if isNull arguments || arguments.Length <> 1 || String.IsNullOrWhiteSpace arguments.[0] then
        fail "behavior-arguments" "behavior provenance must contain its one nonblank output argument"
    else Ok()
let admitBehavior raw current =
    result {
        do! strictJson raw
        do! nativeShape raw
        let decoded =
            try Ok(JsonSerializer.Deserialize<HiddenSwitchReceipt.Native>(raw: byte[]))
            with :? JsonException as error -> fail "behavior-json" error.Message
        let! receipt = decoded
        let config = HiddenSwitchReceipt.config()
        if obj.ReferenceEquals(receipt, null) || not receipt.Complete || not (isNull receipt.Failure)
           || receipt.Protocol <> HiddenSwitchReceipt.protocol || receipt.Kind <> "behavior"
           || receipt.ProtocolSha256 <> expectedProtocolHash || receipt.Config <> config
           || not (sameSource receipt.Provenance current) || isNull receipt.Panels || receipt.Panels.Length <> 4 then
            return! fail "behavior-input" "requires complete behavior with identical admitted configuration/source/runtime"
        do! behaviorArguments receipt.Provenance.Arguments
        do! chronology receipt.StartedAtUtc receipt.FinishedAtUtc
        let bits length (value: string) = not (isNull value) && value.Length = length && (value |> Seq.forall (fun c -> c = '0' || c = '1'))
        let hash (value: string) = not (isNull value) && value.Length = 64 && (value |> Seq.forall (fun c -> (c >= '0' && c <= '9') || (c >= 'A' && c <= 'F')))
        let qRows (value: float[][]) =
            not (isNull value) && value.Length = 16
            && Array.forall (fun (row: float[]) -> not (isNull row) && row.Length = 2 && Array.forall Double.IsFinite row) value
        let validEpisode arm index (episode: HiddenSwitchReceipt.Episode) =
            not (obj.ReferenceEquals(episode, null)) && episode.Index = index && episode.Complete && isNull episode.Failure
            && bits 16 episode.Actions && bits 17 episode.Cues && bits 17 episode.States
            && not (isNull episode.Reward4) && episode.Reward4.Length = 16 && Array.forall (fun reward -> reward = -1 || reward = 0 || reward = 4) episode.Reward4
            && episode.TotalReward4 = Array.sum episode.Reward4
            && not (isNull episode.Beliefs) && episode.Beliefs.Length = 17 && Array.forall (fun b -> Double.IsFinite b && b >= 0.0 && b <= 1.0) episode.Beliefs
            && qRows episode.DecisionQ && qRows episode.TreeRootQ
            && not (isNull episode.PlanningCounters) && episode.PlanningCounters.Length = 16
            && (episode.PlanningCounters |> Array.mapi (fun step actual ->
                let depth = if arm = "belief-myopic" then 1 else min 3 (16-step)
                let expected: HiddenSwitchReceipt.PlanningCounters =
                    match depth with
                    | 1 -> { Nodes = 1; ActionValues = 2; Predictions = 0; Updates = 0 }
                    | 2 -> { Nodes = 5; ActionValues = 10; Predictions = 2; Updates = 4 }
                    | _ -> { Nodes = 21; ActionValues = 42; Predictions = 10; Updates = 20 }
                actual = expected) |> Array.forall id)
            && episode.FilterCounters = { Predictions = (if arm = "latest-cue-depth3" then 0 else 16); Updates = 17 }
            && not (isNull episode.FrameSha256) && episode.FrameSha256.Length = 17 && Array.forall hash episode.FrameSha256
            && not (isNull episode.ProjectionSha256) && episode.ProjectionSha256.Length = 17 && Array.forall hash episode.ProjectionSha256
        let valid = Array.forall2 (fun (panel: HiddenSwitchReceipt.Panel) expected ->
            not (obj.ReferenceEquals(panel, null)) && panel.Config = expected && not (isNull panel.Arms)
            && panel.Arms.Length = 4
            && Array.forall2 (fun (arm: HiddenSwitchReceipt.Arm) name ->
                not (obj.ReferenceEquals(arm, null)) && arm.Name = name && arm.Complete && isNull arm.Failure
                && not (isNull arm.Episodes) && arm.Episodes.Length = 1024
                && (Array.mapi (validEpisode name) arm.Episodes |> Array.forall id)) panel.Arms config.Arms) receipt.Panels config.Panels
        if not valid then return! fail "behavior-roster" "behavior input has malformed or incomplete episodes/arms/panels"
        return receipt
    }
