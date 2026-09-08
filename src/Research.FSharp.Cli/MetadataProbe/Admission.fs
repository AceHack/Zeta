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

    let private commonPins (dump: FilePin) (dac: FilePin) (runtime: RuntimePin) (modulePin: ModulePin) =
        [dump; dac; runtime.Image; modulePin.Original; modulePin.Copy] |> List.forall filePin
        && dump.Bytes <= 8L * 1024L * 1024L * 1024L
        && modulePin.Original.File <> modulePin.Copy.File
        && modulePin.Original.Sha256 = modulePin.Copy.Sha256 && modulePin.Original.Bytes = modulePin.Copy.Bytes
        && runtime.ImageBase > 0UL && not (String.IsNullOrWhiteSpace runtime.Version)
        && runtime.BuildId.Length = 32 && (runtime.BuildId |> Seq.forall Uri.IsHexDigit)
        && fst(Guid.TryParseExact(modulePin.Mvid, "D"))

    let private shape recordType (root: JsonElement) =
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
        check recordType root

    let parse (raw: byte[]) =
        try
            if raw.Length > 65536 then error "input" "size" "manifest exceeds 64 KiB"
            else
                use document = JsonDocument.Parse raw
                if not (shape typeof<Input> document.RootElement) then error "input" "shape" "requires exact typed fields, without duplicates or omitted defaults"
                else
                    let input = JsonSerializer.Deserialize<Input> raw
                    let roles = [|"predict"; "condition"; "select"|]
                    let valid =
                        commonPins input.Dump input.Dac input.Runtime input.Module
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

    [<CLIMutable>]
    type MappedMethod =
        { Index: int; Role: string; Address: uint64; Bytes: uint32; Token: int; DeclaringType: string
          Name: string; ReflectionSignature: string; IlHex: string; BodySha256: string
          CompilerBlockIndex: int; CompilerName: string }
    [<CLIMutable>]
    type MappedInput =
        { Dump: FilePin; Dac: FilePin; Runtime: RuntimePin; Module: ModulePin; Mapping: FilePin; Methods: MappedMethod[] }

    let mappingBytes = 185092L
    let mappingSha256 = "0D22A5C3679B5F47F874E8C1C10CFD34B17E9E4B7E3B649E2590F22F0F25A39A"
    let private asMethod (row: MappedMethod) : MethodPin =
        { Role = row.Role; Address = row.Address; Bytes = row.Bytes; Token = row.Token
          Signature = row.ReflectionSignature; BodySha256 = row.BodySha256 }
    let mappedBase (input: MappedInput) : Input =
        { Dump = input.Dump; Dac = input.Dac; Runtime = input.Runtime; Module = input.Module
          Methods = input.Methods |> Array.map asMethod }

    /// The alternate command admits exactly the already reviewed finite mapping, not an arbitrary roster.
    let parseMapped (raw: byte[]) =
        try
            if raw.Length > 256 * 1024 then error "input" "size" "mapped manifest exceeds 256 KiB"
            else
                use document = JsonDocument.Parse raw
                if not (shape typeof<MappedInput> document.RootElement) then error "input" "shape" "requires exact mapped input fields"
                else
                    let input = JsonSerializer.Deserialize<MappedInput> raw
                    if not(commonPins input.Dump input.Dac input.Runtime input.Module) then
                        error "input" "identity" "requires canonical file/runtime identities"
                    else
                        let valid =
                            filePin input.Mapping && input.Mapping.Bytes = mappingBytes && input.Mapping.Sha256 = mappingSha256
                            && input.Methods.Length = 130
                            && (input.Methods |> Array.forall (fun row ->
                                row.Index >= 0 && row.Index < 139 && row.Role = "method-" + row.Index.ToString("D3", Globalization.CultureInfo.InvariantCulture)
                                && row.Address > 0UL && row.Address % 4UL = 0UL && row.Bytes > 0u && row.Bytes <= 1664u && row.Bytes % 4u = 0u
                                && row.Address <= UInt64.MaxValue - uint64 row.Bytes && row.Token >>> 24 = 6 && hash row.BodySha256
                                && not(String.IsNullOrWhiteSpace row.DeclaringType) && not(String.IsNullOrWhiteSpace row.Name)
                                && not(String.IsNullOrWhiteSpace row.ReflectionSignature) && row.IlHex.Length > 0 && row.IlHex.Length % 2 = 0
                                && (row.IlHex |> Seq.forall (fun c -> (c >= '0' && c <= '9') || (c >= 'A' && c <= 'F')))))
                            && (input.Methods |> Array.sumBy (fun row -> uint64 row.Bytes)) = 34660UL
                            && (input.Methods |> Array.pairwise |> Array.forall (fun (a,b) -> a.Index < b.Index))
                            && (input.Methods |> Array.distinctBy (fun row -> row.Token) |> Array.length) = 130
                            && (input.Methods |> Array.sortBy (fun row -> row.Address) |> Array.pairwise
                                |> Array.forall (fun (a,b) -> a.Address + uint64 a.Bytes <= b.Address))
                        if valid then Ok input else error "input" "mapped-identity" "requires the exact ordered 130-row disjoint candidate scope and reviewed mapping identity"
        with exceptionValue -> Error(exceptionFailure "input" exceptionValue)

    /// Corroborates every field obtainable from the reviewed bytes; addresses remain physical-driver observations.
    let bindMapped (raw: byte[]) (input: MappedInput) =
        try
            if int64 raw.Length <> mappingBytes || Convert.ToHexString(Security.Cryptography.SHA256.HashData raw) <> mappingSha256 then
                error "mapping" "identity" "requires the exact reviewed mapping bytes"
            else
                use document = JsonDocument.Parse raw
                let rows = document.RootElement.GetProperty("Rows").EnumerateArray()
                           |> Seq.filter (fun row -> row.GetProperty("Outcome").GetProperty("Kind").GetString() = "mapped-candidate") |> Seq.toArray
                let valid = rows.Length = input.Methods.Length && Array.forall2 (fun (row: JsonElement) (expected: MappedMethod) ->
                    let observed = row.GetProperty("Input")
                    let compiler = row.GetProperty("Outcome")
                    row.GetProperty("Index").GetInt32() = expected.Index
                    && observed.GetProperty("Mvid").GetString() = input.Module.Mvid
                    && observed.GetProperty("Token").GetInt32() = expected.Token
                    && observed.GetProperty("Type").GetString() = expected.DeclaringType
                    && observed.GetProperty("Name").GetString() = expected.Name
                    && observed.GetProperty("Signature").GetString() = expected.ReflectionSignature
                    && observed.GetProperty("IlHex").GetString() = expected.IlHex
                    && compiler.GetProperty("CompilerBlockIndex").GetInt32() = expected.CompilerBlockIndex
                    && compiler.GetProperty("CompilerName").GetString() = expected.CompilerName
                    && compiler.GetProperty("Bytes").GetUInt32() = expected.Bytes
                    && compiler.GetProperty("Sha256").GetString() = expected.BodySha256) rows input.Methods
                if valid then Ok() else error "mapping" "row" "mapped method input differs from the exact reviewed reflection/compiler row"
        with exceptionValue -> Error(exceptionFailure "mapping" exceptionValue)

    let mappedIdentity (expected: MappedMethod) token declaringType name moduleName expectedModule =
        if token = expected.Token && declaringType = expected.DeclaringType && name = expected.Name && moduleName = expectedModule then Ok()
        else error "method-query" "method-identity" "actual token/declaring type/name/module differs; no signature or nested-name normalization is performed"

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
