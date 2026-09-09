// Score-free immutable finite result receipt; reports no winner or optimum.
open System
open System.Diagnostics
open System.Security.Cryptography
open System.Text
open System.Text.Json

let sha256 (text: string) = SHA256.HashData(Encoding.UTF8.GetBytes text) |> Convert.ToHexString |> fun value -> value.ToLowerInvariant()
let quote (value: string) = JsonSerializer.Serialize value

let run script =
    let info = ProcessStartInfo("dotnet", "fsi " + script, RedirectStandardOutput = true, UseShellExecute = false)
    use process = Process.Start info
    let output = process.StandardOutput.ReadToEnd()
    process.WaitForExit()
    if process.ExitCode <> 0 then failwith "required receipt unavailable"
    output

let render () =
    use preflight = JsonDocument.Parse(run "src/Research.FSharp/DurableRoomMaxDecorrelationPreflight.fsx")
    use admission = JsonDocument.Parse(run "src/Research.FSharp/DurableRoomAdmissionReceipt.fsx")
    let payload = preflight.RootElement.GetProperty "payload"
    let candidates = payload.GetProperty("candidates").GetRawText()
    let evidence = payload.GetProperty("orderedCandidateEvidenceDigests").GetRawText()
    let body =
        "{" +
        "\"admissionReceiptSha256\":" + quote ((admission.RootElement.GetProperty "canonicalReceiptSha256").GetString()) + "," +
        "\"anchorBytesSha256\":" + quote ((payload.GetProperty "anchorBytesSha256").GetString()) + "," +
        "\"carrierId\":" + quote ((payload.GetProperty "carrierId").GetString()) + "," +
        "\"catalogueSha256\":" + quote ((payload.GetProperty "catalogueSha256").GetString()) + "," +
        "\"controlManifestDigest\":" + quote ((payload.GetProperty "controlManifestDigest").GetString()) + "," +
        "\"noPassingCandidateReason\":\"\"," +
        "\"observedCatalogueEntries\":" + candidates + "," +
        "\"orderedCandidateEvidenceDigests\":" + evidence + "," +
        "\"resultState\":\"observed-finite-catalogue\"," +
        "\"schema\":\"zeta.max-decorrelate-reconcile/result/v1\"," +
        "\"sourceRevision\":" + quote ((payload.GetProperty "sourceRevision").GetString()) + "}"
    "{\"canonicalReceiptSha256\":" + quote (sha256 body) + ",\"payload\":" + body + "}\n"

Console.Write(render ())
