namespace Zeta.Research.MetadataProbe

open System
open System.Collections.Generic
open System.Text.Json
open Microsoft.FSharp.Reflection

/// Pure admission of caller-owned, finite diagnostic inputs. No dump access.
module Admission =
    [<CLIMutable>]
    type FilePin = { File: string; Bytes: int64; Sha256: string }
    [<CLIMutable>]
    type RuntimePin = { Image: FilePin; ImageBase: uint64; Version: string; BuildId: string }
    [<CLIMutable>]
    type ModulePin = { Original: FilePin; Copy: FilePin; Mvid: string }
    [<CLIMutable>]
    type MethodPin = { Role: string; Address: uint64; Bytes: uint32; Token: int; Signature: string; BodySha256: string }
    [<CLIMutable>]
    type Input = { Dump: FilePin; Dac: FilePin; Runtime: RuntimePin; Module: ModulePin; Methods: MethodPin[] }
    type Failure = { Stage: string; Code: string; Detail: string }
    let failure stage code detail = { Stage = stage; Code = code; Detail = detail }
    let error stage code detail = Error(failure stage code detail)
    let exceptionFailure stage (exceptionValue: exn) =
        let detail = exceptionValue.GetType().FullName + ": " + exceptionValue.Message
        failure stage "exception" (if detail.Length <= 4096 then detail else detail.Substring(0, 4096))

    let private hash (text: string) =
        not (isNull text) && text.Length = 64 && (text |> Seq.forall (fun c -> (c >= '0' && c <= '9') || (c >= 'A' && c <= 'F')))
    let private filePin (value: FilePin) =
        not (String.IsNullOrWhiteSpace value.File) && IO.Path.IsPathFullyQualified value.File && value.Bytes > 0L && hash value.Sha256

    let private shape (root: JsonElement) =
        let rec check (kind: Type) (value: JsonElement) =
            if FSharpType.IsRecord kind then
                if value.ValueKind <> JsonValueKind.Object then false
                else
                    let fields = FSharpType.GetRecordFields kind
                    let remaining = Dictionary<string, Type>(StringComparer.Ordinal)
                    for field in fields do remaining.Add(field.Name, field.PropertyType)
                    let mutable valid = true
                    for property in value.EnumerateObject() do
                        match remaining.TryGetValue property.Name with
                        | true, field -> valid <- check field property.Value && valid; remaining.Remove property.Name |> ignore
                        | _ -> valid <- false
                    valid && remaining.Count = 0
            elif kind.IsArray then
                value.ValueKind = JsonValueKind.Array && (value.EnumerateArray() |> Seq.forall (check (kind.GetElementType())))
            elif kind = typeof<string> then value.ValueKind = JsonValueKind.String
            elif kind = typeof<int64> then value.ValueKind = JsonValueKind.Number && fst(value.TryGetInt64())
            elif kind = typeof<uint64> then value.ValueKind = JsonValueKind.Number && fst(value.TryGetUInt64())
            elif kind = typeof<uint32> then value.ValueKind = JsonValueKind.Number && fst(value.TryGetUInt32())
            elif kind = typeof<int> then value.ValueKind = JsonValueKind.Number && fst(value.TryGetInt32())
            else false
        check typeof<Input> root

    let parse (raw: byte[]) =
        try
            if raw.Length > 65536 then error "input" "size" "manifest exceeds 64 KiB"
            else
                use document = JsonDocument.Parse raw
                if not (shape document.RootElement) then error "input" "shape" "requires exact typed fields, without duplicates or omitted defaults"
                else
                    let input = JsonSerializer.Deserialize<Input> raw
                    let roles = [|"predict"; "condition"; "select"|]
                    let valid =
                        [input.Dump; input.Dac; input.Runtime.Image; input.Module.Original; input.Module.Copy] |> List.forall filePin
                        && input.Dump.Bytes <= 8L * 1024L * 1024L * 1024L
                        && input.Module.Original.File <> input.Module.Copy.File
                        && input.Module.Original.Sha256 = input.Module.Copy.Sha256 && input.Module.Original.Bytes = input.Module.Copy.Bytes
                        && input.Runtime.ImageBase > 0UL && not (String.IsNullOrWhiteSpace input.Runtime.Version)
                        && input.Runtime.BuildId.Length = 32 && (input.Runtime.BuildId |> Seq.forall Uri.IsHexDigit)
                        && fst(Guid.TryParseExact(input.Module.Mvid, "D"))
                        && input.Methods.Length = 3
                        && Array.forall2 (fun role row -> row.Role = role && row.Address > 0UL && row.Address % 4UL = 0UL
                                                         && row.Bytes > 0u && row.Bytes <= 65536u && row.Bytes % 4u = 0u
                                                         && row.Address <= UInt64.MaxValue - uint64 row.Bytes
                                                         && row.Token >>> 24 = 6 && hash row.BodySha256
                                                         && row.Signature.StartsWith("Zeta.Research.HiddenSwitchPolicy." + role + "(", StringComparison.Ordinal)) roles input.Methods
                    let disjoint = valid && (input.Methods |> Array.sortBy (fun row -> row.Address) |> Array.pairwise
                                             |> Array.forall (fun (left, right) -> left.Address + uint64 left.Bytes <= right.Address))
                    if disjoint then Ok input else error "input" "identity" "requires the finite three-method roster and canonical file/runtime identities"
        with exceptionValue -> Error(exceptionFailure "input" exceptionValue)

    /// No cold or expanded range is permission for additional memory reads.
    let extents (expected: MethodPin) nativeCode hotStart hotSize coldStart coldSize =
        if hotStart = 0UL || hotStart % 4UL <> 0UL || hotSize = 0u || hotSize % 4u <> 0u
           || hotStart > UInt64.MaxValue - uint64 hotSize then
            error "method-extent" "range" "hot extent is zero, unaligned or overflows"
        elif coldStart <> 0UL || coldSize <> 0u then
            error "method-extent" "unexpected-cold" "the declared candidate contains no cold region; no additional reads admitted"
        elif nativeCode <> expected.Address || hotStart <> expected.Address || hotSize <> expected.Bytes then
            error "method-extent" "candidate-mismatch" "current native body and complete hot extent must equal the declared physical candidate"
        else Ok()

    /// The newline is part of the output ceiling; subtraction avoids addition overflow.
    let journalSize emitted rawBytes =
        let limit = 1024 * 1024
        if emitted < 0 || emitted > limit || rawBytes < 0 || rawBytes >= limit - emitted then
            error "journal" "size" "record including newline exceeds the one-MiB ceiling"
        else Ok(emitted + rawBytes + 1)

    /// Exact reviewed bytes bind all thirteen names, lengths and digests before JSON use.
    let dependencyManifest (raw: byte[]) =
        if raw.Length <> 3329 || Convert.ToHexString(Security.Cryptography.SHA256.HashData raw) <> "0D655825CA695206198FB1A6980006BC8F2E468D03AC15FDFD81C59020FAFC8E" then
            error "dependencies" "manifest-identity" "requires the exact reviewed installed managed-dependency manifest"
        else Ok()

    /// Preserve primary failure and a compact count when full diagnostic bytes cannot fit.
    /// Serialization allocation precedes this finite write admission; no identity is truncated.
    let finalOutput (raw: byte[]) (primary: Failure option) methodCount =
        if raw.Length < 1024 * 1024 then raw, primary
        else
            let bounded = failure "final-output" "size" "complete diagnostic report including newline exceeds one MiB"
            let first = Some(defaultArg primary bounded)
            let compact = {| Complete = false; Failure = first; OutputFailure = bounded
                             AvailableMethodCount = methodCount; AvailableReportBytes = raw.Length
                             MethodMetadataOmitted = true; RuntimeAdmitted = false; BodyResolved = false
                             ClosureAdmitted = false; PhysicalCodeVerifiedByHelper = false |}
            JsonSerializer.SerializeToUtf8Bytes compact, first
