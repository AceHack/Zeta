module Zeta.Tests.FSharp.ZetaId.CrossVerifyTests

open System
open System.Globalization
open System.IO
open System.Text.Json
open Xunit
open Zeta.Core.FSharp.ZetaId
open Zeta.Core.FSharp.Yaml
open Zeta.Core.FSharp.Yaml.Dom

/// Flat vector schema matching tests/cross-verification/zeta-id/vectors.yaml.
/// Populated by navigating our YAML port's YamlValue tree (own-the-interface:
/// route through Zeta.Core.FSharp.Yaml.Dom.parse, not YamlDotNet directly).
[<CLIMutable>]
type FlatVector = {
    Id: string
    Version: int
    Timestamp: int64
    Chromosome: int
    Category: int
    Firefly: int
    AuthorityType: string
    AuthorityRaw: Nullable<int>
    Persona: int
    MomentumType: string
    MomentumRaw: Nullable<int>
    Location: int
    ExpectedHex: string
    ExpectedCrockford: string
    Type: string
    InputCrockford: string
}

// --- YamlValue → FlatVector list navigation. The fixture is a top-level VMap with a
// `vectors:` VSeq of flat VMaps. Extract each field by key from the ordered pairs. ---

let private mapEntries (v: YamlValue) (ctx: string) : (string * YamlValue) list =
    match v with
    | VMap entries -> entries
    | other -> raise (InvalidOperationException(sprintf "expected Map at %s, got %A" ctx other))

let private field (entries: (string * YamlValue) list) (key: string) (ctx: string) : YamlValue =
    match entries |> List.tryFind (fun (k, _) -> String.Equals(k, key, StringComparison.Ordinal)) with
    | Some(_, value) -> value
    | None -> raise (InvalidOperationException(sprintf "missing field '%s' at %s" key ctx))

let private fieldOrNull (entries: (string * YamlValue) list) (key: string) : string =
    match entries |> List.tryFind (fun (k, _) -> String.Equals(k, key, StringComparison.Ordinal)) with
    | Some(_, VStr s) -> s
    | _ -> null

let private asStr (v: YamlValue) (ctx: string) : string =
    match v with
    | VStr s -> s
    | other -> raise (InvalidOperationException(sprintf "expected Str at %s, got %A" ctx other))

let private asInt (v: YamlValue) (ctx: string) : int =
    match v with
    | VInt i -> int i
    | other -> raise (InvalidOperationException(sprintf "expected Int at %s, got %A" ctx other))

let private asInt64 (v: YamlValue) (ctx: string) : int64 =
    match v with
    | VInt i -> i
    | other -> raise (InvalidOperationException(sprintf "expected Int at %s, got %A" ctx other))

let private asIntOrNull (v: YamlValue) (ctx: string) : Nullable<int> =
    match v with
    | VNull -> Nullable()
    | VInt i -> Nullable(int i)
    | other -> raise (InvalidOperationException(sprintf "expected Int or Null at %s, got %A" ctx other))

let private toFlatVector (idx: int) (item: YamlValue) : FlatVector =
    let ctx = sprintf "vectors[%d]" idx
    let m = mapEntries item ctx
    {
        Id            = asStr     (field m "id" ctx)             (ctx + ".id")
        Version       = asInt     (field m "version" ctx)        (ctx + ".version")
        Timestamp     = asInt64   (field m "timestamp" ctx)      (ctx + ".timestamp")
        Chromosome    = asInt     (field m "chromosome" ctx)     (ctx + ".chromosome")
        Category      = asInt     (field m "category" ctx)       (ctx + ".category")
        Firefly       = asInt     (field m "firefly" ctx)        (ctx + ".firefly")
        AuthorityType = asStr     (field m "authority_type" ctx) (ctx + ".authority_type")
        AuthorityRaw  = asIntOrNull (field m "authority_raw" ctx) (ctx + ".authority_raw")
        Persona       = asInt     (field m "persona" ctx)        (ctx + ".persona")
        MomentumType  = asStr     (field m "momentum_type" ctx)  (ctx + ".momentum_type")
        MomentumRaw   = asIntOrNull (field m "momentum_raw" ctx)  (ctx + ".momentum_raw")
        Location      = asInt     (field m "location" ctx)       (ctx + ".location")
        ExpectedHex   = asStr     (field m "expected_hex" ctx)   (ctx + ".expected_hex")
        ExpectedCrockford = asStr (field m "expected_crockford" ctx) (ctx + ".expected_crockford")
        Type          = fieldOrNull m "type"
        InputCrockford = fieldOrNull m "input_crockford"
    }

let private yamlValueToFlatVectors (root: YamlValue) : FlatVector list =
    let top = mapEntries root "<root>"
    match field top "vectors" "<root>" with
    | VSeq items -> items |> List.mapi toFlatVector
    | other -> raise (InvalidOperationException(sprintf "expected Seq at vectors, got %A" other))

/// Bounds-check int→byte before constructing Raw or casting to enum.
/// Without this, AuthorityRaw=256 wraps to 0 BEFORE Raw's bounds check fires,
/// silently producing wrong packed ID. Matches the C# CheckByte helper.
let private checkByte (value: int) (fieldName: string) : byte =
    if value < 0 || value > 255 then
        raise (InvalidOperationException(
            sprintf "vectors.yaml field '%s' = %d is outside the 0..255 byte range; would wrap silently on int→byte cast." fieldName value))
    byte value

let private toAuthority (v: FlatVector) : Authority =
    if String.Equals(v.AuthorityType, "Raw", StringComparison.Ordinal) then
        Authority.raw (checkByte v.AuthorityRaw.Value "AuthorityRaw")
    else
        match v.AuthorityType with
        | "HumanVerified" -> Authority.HumanVerified
        | "TrustedAgent" -> Authority.TrustedAgent
        | "Standard" -> Authority.Standard
        | "BestEffort" -> Authority.BestEffort
        | "Simulated" -> Authority.Simulated
        | t -> raise (InvalidOperationException(sprintf "Unknown authority_type: %s" t))

let private toMomentum (v: FlatVector) : Momentum =
    if String.Equals(v.MomentumType, "Raw", StringComparison.Ordinal) then
        Momentum.raw (checkByte v.MomentumRaw.Value "MomentumRaw")
    else
        match v.MomentumType with
        | "Background" -> Momentum.Background
        | "Normal" -> Momentum.Normal
        | "Elevated" -> Momentum.Elevated
        | "High" -> Momentum.High
        | "Critical" -> Momentum.Critical
        | t -> raise (InvalidOperationException(sprintf "Unknown momentum_type: %s" t))

let private toObservation (v: FlatVector) : ZetaObservation =
    {
        Version    = LanguagePrimitives.EnumOfValue<byte, IdVersion>   (checkByte v.Version "Version")
        Timestamp  = LanguagePrimitives.Int64WithMeasure<ms> v.Timestamp
        Chromosome = LanguagePrimitives.EnumOfValue<byte, Chromosome>  (checkByte v.Chromosome "Chromosome")
        Category   = LanguagePrimitives.EnumOfValue<byte, Category>    (checkByte v.Category "Category")
        Firefly    = LanguagePrimitives.EnumOfValue<byte, Firefly>     (checkByte v.Firefly "Firefly")
        Authority  = toAuthority v
        Persona    = LanguagePrimitives.EnumOfValue<byte, Persona>     (checkByte v.Persona "Persona")
        Momentum   = toMomentum v
        Location   = LanguagePrimitives.EnumOfValue<byte, Location>    (checkByte v.Location "Location")
    }

/// Walk up from the test assembly looking for Zeta.sln (sentinel at repo root).
/// .git is unreliable (in a worktree it is a file, not a directory).
let private repoRoot () : string =
    let assembly = typeof<FlatVector>.Assembly
    let mutable dir = DirectoryInfo(Path.GetDirectoryName(assembly.Location))
    while not (isNull dir) && not (File.Exists(Path.Join(dir.FullName, "Zeta.sln"))) do
        dir <- dir.Parent
    if isNull dir then
        raise (InvalidOperationException("Could not locate repo root (Zeta.sln) from test assembly location."))
    dir.FullName

[<Fact>]
let ``cross-verify twelve vectors match TS+C# bootstrap hex`` () =
    let root = repoRoot ()
    let yamlPath = Path.Join(root, "tests", "cross-verification", "zeta-id", "vectors.yaml")
    let yamlText = File.ReadAllText(yamlPath)

    let vectors =
        match parse yamlText with
        | Ok value -> yamlValueToFlatVectors value
        | Error feedback ->
            raise (InvalidOperationException(sprintf "our YAML port declined vectors.yaml: %A" feedback))

    let results = System.Collections.Generic.Dictionary<string, obj>(StringComparer.Ordinal)
    let mutable hexMismatches = 0
    let mutable crockfordMismatches = 0
    let mutable roundtripMismatches = 0

    for v in vectors do
        let mutable hex = ""
        let mutable crockford = ""
        let mutable roundtripOk = false
        let mutable matchesExpected = false

        if String.Equals(v.Type, "parse-reject", StringComparison.Ordinal) then
            let parseFailed =
                try
                    ZetaIdCodec.parse v.ExpectedCrockford |> ignore
                    false
                with _ -> true
            let canonicalOk = ZetaIdCodec.isCanonical v.ExpectedCrockford

            hex <- "rejected"
            crockford <- "rejected"
            roundtripOk <- parseFailed && not canonicalOk
            matchesExpected <- String.Equals(v.ExpectedHex, "rejected", StringComparison.Ordinal)
        elif String.Equals(v.Type, "max-128", StringComparison.Ordinal) then
            let maxVal = System.UInt128.MaxValue
            hex <- maxVal.ToString("x32", CultureInfo.InvariantCulture)
            crockford <- ZetaIdCodec.format maxVal

            let parsedId = ZetaIdCodec.parse crockford
            let parseOk = parsedId = maxVal
            let canonicalOk = ZetaIdCodec.isCanonical crockford

            roundtripOk <- parseOk && canonicalOk
            matchesExpected <- String.Equals(hex, v.ExpectedHex, StringComparison.Ordinal) && String.Equals(crockford, v.ExpectedCrockford, StringComparison.Ordinal)
        elif String.Equals(v.Type, "lenient-alias", StringComparison.Ordinal) then
            let obs = toObservation v
            let id = ZetaIdCodec.pack obs DeterministicEnv.Instance
            hex <- id.ToString("x32", CultureInfo.InvariantCulture)
            crockford <- ZetaIdCodec.format id

            let parsedId = ZetaIdCodec.parse v.InputCrockford
            let parseOk = parsedId = id
            let inputCanonicalOk = ZetaIdCodec.isCanonical v.InputCrockford
            let expectedCanonicalOk = ZetaIdCodec.isCanonical v.ExpectedCrockford

            roundtripOk <- parseOk && not inputCanonicalOk && expectedCanonicalOk
            matchesExpected <- String.Equals(hex, v.ExpectedHex, StringComparison.Ordinal) && String.Equals(crockford, v.ExpectedCrockford, StringComparison.Ordinal)
        else
            let obs = toObservation v
            let id = ZetaIdCodec.pack obs DeterministicEnv.Instance
            hex <- id.ToString("x32", CultureInfo.InvariantCulture)
            crockford <- ZetaIdCodec.format id

            let unpacked = ZetaIdCodec.unpack id
            let roundtripVal = unpacked = obs
            let parsedId = ZetaIdCodec.parse crockford
            let parseOk = parsedId = id
            let canonicalOk = ZetaIdCodec.isCanonical crockford

            roundtripOk <- roundtripVal && parseOk && canonicalOk
            let expectedMatches = String.Equals(hex, v.ExpectedHex, StringComparison.Ordinal)
            let crockfordMatches = String.Equals(crockford, v.ExpectedCrockford, StringComparison.Ordinal)
            matchesExpected <- expectedMatches && crockfordMatches

        results.[v.Id] <- box {| hex = hex; crockford = crockford; roundtripOk = roundtripOk; matchesExpected = matchesExpected |}

        if not roundtripOk then roundtripMismatches <- roundtripMismatches + 1
        if not matchesExpected then hexMismatches <- hexMismatches + 1

    // compare.ts reads `fsharp-output.json` (not `fs-output.json`) — match per Copilot #4548 thread
    let outputPath = Path.Join(root, "tests", "cross-verification", "zeta-id", "fsharp-output.json")
    let options = JsonSerializerOptions(WriteIndented = true)
    let json = JsonSerializer.Serialize(results, options)
    File.WriteAllText(outputPath, json)

    Assert.Equal(0, roundtripMismatches)
    Assert.Equal(0, hexMismatches)
    Assert.Equal(0, crockfordMismatches)

