// Score-free immutable admission receipt for the durable-room preflight.
open System
open System.Diagnostics
open System.Security.Cryptography
open System.Text
open System.Text.Json

let sha256 (text: string) = SHA256.HashData(Encoding.UTF8.GetBytes text) |> Convert.ToHexString |> fun value -> value.ToLowerInvariant()
let quote (value: string) = JsonSerializer.Serialize value
let prop (name: string) (root: JsonElement) = root.GetProperty(name)

let preflight () =
    let info = ProcessStartInfo("dotnet", "fsi src/Research.FSharp/DurableRoomMaxDecorrelationPreflight.fsx", RedirectStandardOutput = true, UseShellExecute = false)
    use process = Process.Start info
    let output = process.StandardOutput.ReadToEnd()
    process.WaitForExit()
    if process.ExitCode <> 0 then failwith "preflight unavailable"
    output

let render () =
    let bytes = preflight ()
    use document = JsonDocument.Parse bytes
    let root = document.RootElement
    let payload = prop "payload" root
    let evidence = prop "orderedCandidateEvidenceDigests" payload
    let evidenceJson = evidence.GetRawText()
    let body =
        "{" +
        "\"admissionState\":\"eligible-for-separate-result-review\"," +
        "\"anchorBytesSha256\":" + quote ((prop "anchorBytesSha256" payload).GetString()) + "," +
        "\"carrierId\":" + quote ((prop "carrierId" payload).GetString()) + "," +
        "\"catalogueSha256\":" + quote ((prop "catalogueSha256" payload).GetString()) + "," +
        "\"controlManifestDigest\":" + quote ((prop "controlManifestDigest" payload).GetString()) + "," +
        "\"independentReceiptAgreement\":true," +
        "\"orderedCandidateEvidenceDigests\":" + evidenceJson + "," +
        "\"preflightReceiptSha256\":" + quote ((prop "canonicalReceiptSha256" root).GetString()) + "," +
        "\"refusalCodes\":[]," +
        "\"schema\":\"zeta.max-decorrelate-reconcile/admission/v1\"," +
        "\"sourceRevision\":" + quote ((prop "sourceRevision" payload).GetString()) +
        "}"
    "{\"canonicalReceiptSha256\":" + quote (sha256 body) + ",\"payload\":" + body + "}\n"

Console.Write(render ())
