// Score-free durable-room max-decorrelation/reconciliation preflight emitter.
// It is source-owned finite conformance only: no selection, ARC, CHSH, or policy behavior.
open System
open System.Text.Encodings.Web
open System.Security.Cryptography
open System.Text
open System.Text.Json

let private sha256 (text: string) =
    SHA256.HashData(Encoding.UTF8.GetBytes text)
    |> Convert.ToHexString
    |> fun digest -> digest.ToLowerInvariant()

let private canonicalJson = JsonSerializerOptions(Encoder = JavaScriptEncoder.UnsafeRelaxedJsonEscaping)
let private quote (value: string) = JsonSerializer.Serialize(value, canonicalJson)
let private integer (value: int) = string value
let private boolean (value: bool) = if value then "true" else "false"
let private sourceRevision =
    let info = Diagnostics.ProcessStartInfo("git", "rev-parse HEAD", RedirectStandardOutput = true, UseShellExecute = false)
    use commandProcess = Diagnostics.Process.Start info
    let revision = commandProcess.StandardOutput.ReadToEnd().Trim()
    commandProcess.WaitForExit()
    if commandProcess.ExitCode = 0 && revision.Length = 40 then revision else failwith "source revision unavailable"

let private anchorJson =
    "{" +
    "\"actionBudget\":32," +
    "\"actionCount\":11," +
    "\"channelFingerprint\":\"channel:udp-a\"," +
    "\"elapsedMs\":200," +
    "\"episodeId\":\"episode-1\"," +
    "\"factId\":\"fact-1\"," +
    "\"roomFingerprint\":\"room:arc-v1\"," +
    "\"roomId\":\"chip9-arc-room\"," +
    "\"runId\":\"run-1\"," +
    "\"schema\":\"zeta.durable-room-evidence/v1\"," +
    "\"signatureSplit\":\"split:agent-a\"," +
    "\"solved\":" + boolean true + "," +
    "\"sourceArtifact\":\"sha256:trajectory-1\"," +
    "\"spectrumSlice\":\"rainbow:blue\"," +
    "\"timeBudgetMs\":500," +
    "\"uncertainty\":{\"meanPpm\":650000,\"precisionPpm\":20}," +
    "\"weight\":1" +
    "}"

type Candidate =
    { Id: string
      AtomSequence: string list
      Intermediate: string
      FinalMeanPpm: int
      FinalPrecisionPpm: int
      FinalActionCount: int
      Witness: string
      Reconciliation: string }

let private candidates =
    [ { Id = "identity/v1"
        AtomSequence = [ "anchor-positive" ]
        Intermediate = "resolved"
        FinalMeanPpm = 650000
        FinalPrecisionPpm = 20
        FinalActionCount = 11
        Witness = "anchor-resolved-tuple/v1"
        Reconciliation = "pass" }
      { Id = "replace-uncertainty/v1"
        AtomSequence = [ "old-positive"; "old-retraction"; "replacement-positive" ]
        Intermediate = "resolved"
        FinalMeanPpm = 800000
        FinalPrecisionPpm = 40
        FinalActionCount = 8
        Witness = "replacement-resolved-tuple/v1"
        Reconciliation = "pass" }
      { Id = "retract-replace/v1"
        AtomSequence = [ "old-retraction"; "old-positive"; "replacement-positive" ]
        Intermediate = "unresolved"
        FinalMeanPpm = 800000
        FinalPrecisionPpm = 40
        FinalActionCount = 8
        Witness = "replacement-after-unresolved-replay/v1"
        Reconciliation = "pass" } ]

let private atomSequenceJson atoms =
    atoms |> List.map quote |> String.concat "," |> fun values -> "[" + values + "]"

let private candidateJson candidate =
    let distance =
        abs (650000 - candidate.FinalMeanPpm)
        + abs (20 - candidate.FinalPrecisionPpm)
        + abs (11 - candidate.FinalActionCount)
    "{" +
    "\"atomSequence\":" + atomSequenceJson candidate.AtomSequence + "," +
    "\"candidateId\":" + quote candidate.Id + "," +
    "\"causalOrderDigest\":" + quote (candidate.AtomSequence |> String.concat "\n" |> sha256) + "," +
    "\"decorrelationScore\":" + integer distance + "," +
    "\"finalView\":{\"actionCount\":" + integer candidate.FinalActionCount + ",\"meanPpm\":" + integer candidate.FinalMeanPpm + ",\"precisionPpm\":" + integer candidate.FinalPrecisionPpm + "}," +
    "\"intermediateStatus\":" + quote candidate.Intermediate + "," +
    "\"reconciliationOutcome\":" + quote candidate.Reconciliation +
    ",\"reconciliationWitness\":" + quote candidate.Witness +
    "}"

let private controlManifestJson =
    "{\"anchor\":\"observed\",\"catalogue\":\"observed\",\"chshSidecar\":\"observed\",\"currentCandidatePreload\":\"refused\",\"identity\":\"observed\",\"metric\":\"observed\",\"priorMemory\":\"accepted\",\"reconciliationWitness\":\"observed\",\"retractionOrder\":\"observed\"}"

let private observationBarrierJson =
    "[{\"candidateId\":\"identity/v1\",\"currentCandidatePreload\":\"refused\"},{\"candidateId\":\"replace-uncertainty/v1\",\"currentCandidatePreload\":\"refused\"},{\"candidateId\":\"retract-replace/v1\",\"currentCandidatePreload\":\"refused\"}]"

let payload () =
    let catalogue = candidates |> List.map (fun candidate -> candidate.Id) |> List.map quote |> String.concat "," |> fun values -> "[" + values + "]"
    let candidateRows = candidates |> List.map candidateJson |> String.concat "," |> fun values -> "[" + values + "]"
    let candidateEvidenceDigests = candidates |> List.map candidateJson |> List.map sha256 |> List.map quote |> String.concat "," |> fun values -> "[" + values + "]"
    "{" +
    "\"anchorBytes\":" + quote anchorJson + "," +
    "\"anchorBytesSha256\":" + quote (sha256 anchorJson) + "," +
    "\"candidates\":" + candidateRows + "," +
    "\"catalogue\":" + catalogue + "," +
    "\"catalogueSha256\":" + quote (sha256 catalogue) + "," +
    "\"carrierId\":\"zeta.durable-room-evidence/v1\"," +
    "\"chshSidecar\":\"absent\"," +
    "\"controlManifestDigest\":" + quote (sha256 controlManifestJson) + "," +
    "\"emitterIdentity\":\"fsharp-durable-room-preflight/v1\"," +
    "\"memoryInputs\":[{\"acquisitionPhase\":\"prior-game\",\"availableAt\":\"run-start\",\"kind\":\"prior-memory\",\"sourceId\":\"chip8-orbit/v1\"}]," +
    "\"observationBarrierReceipts\":" + observationBarrierJson + "," +
    "\"orderedCandidateEvidenceDigests\":" + candidateEvidenceDigests + "," +
    "\"reconciliationDefinition\":\"resolved-tuple-equality/v1\"," +
    "\"runtimeIdentities\":[\"dotnet-fsi/v1\",\"python-uv/v1\"]," +
    "\"schema\":\"zeta.max-decorrelate-reconcile/preflight/v1\"," +
    "\"sourceRevision\":" + quote sourceRevision + "," +
    "\"verifierIdentity\":\"python-durable-room-preflight/v1\"" +
    "}"

let render () =
    let body = payload ()
    "{" +
    "\"canonicalReceiptSha256\":" + quote (sha256 body) + "," +
    "\"payload\":" + body +
    "}\n"

Console.Write(render ())
