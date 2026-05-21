module Zeta.Tests.FSharp.ZetaId.CrossVerifyTests

open System
open System.Globalization
open System.IO
open System.Text.Json
open YamlDotNet.Serialization
open Xunit
open Zeta.Core.FSharp.ZetaId

/// Flat vector schema matching tests/cross-verification/zeta-id/vectors.yaml.
/// snake_case YAML → PascalCase F# via YamlMember alias.
[<CLIMutable>]
type FlatVector = {
    [<YamlMember(Alias = "id")>] Id: string
    [<YamlMember(Alias = "version")>] Version: int
    [<YamlMember(Alias = "timestamp")>] Timestamp: int64
    [<YamlMember(Alias = "chromosome")>] Chromosome: int
    [<YamlMember(Alias = "category")>] Category: int
    [<YamlMember(Alias = "firefly")>] Firefly: int
    [<YamlMember(Alias = "authority_type")>] AuthorityType: string
    [<YamlMember(Alias = "authority_raw")>] AuthorityRaw: Nullable<int>
    [<YamlMember(Alias = "persona")>] Persona: int
    [<YamlMember(Alias = "momentum_type")>] MomentumType: string
    [<YamlMember(Alias = "momentum_raw")>] MomentumRaw: Nullable<int>
    [<YamlMember(Alias = "location")>] Location: int
    [<YamlMember(Alias = "expected_hex")>] ExpectedHex: string
}

[<CLIMutable>]
type VectorEnvelope = {
    [<YamlMember(Alias = "version")>] Version: int
    [<YamlMember(Alias = "description")>] Description: string
    [<YamlMember(Alias = "vectors")>] Vectors: ResizeArray<FlatVector>
}

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
        Timestamp  = v.Timestamp
        Chromosome = LanguagePrimitives.EnumOfValue<byte, Chromosome>  (checkByte v.Chromosome "Chromosome")
        Category   = LanguagePrimitives.EnumOfValue<byte, Category>    (checkByte v.Category "Category")
        Firefly    = LanguagePrimitives.EnumOfValue<byte, Firefly>     (checkByte v.Firefly "Firefly")
        Authority  = toAuthority v
        Persona    = LanguagePrimitives.EnumOfValue<byte, Persona>     (checkByte v.Persona "Persona")
        Momentum   = toMomentum v
        Location   = LanguagePrimitives.EnumOfValue<byte, Location>    (checkByte v.Location "Location")
    }

/// Walk up from the test assembly looking for Zeta.sln (sentinel at repo root).
/// .git is unreliable (in a worktree it's a file, not a directory).
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
    // Path.Join (not Path.Combine) — Path.Join always concatenates segments;
    // Path.Combine silently drops earlier args if a later arg looks rooted.
    let yamlPath = Path.Join(root, "tests", "cross-verification", "zeta-id", "vectors.yaml")
    let yamlText = File.ReadAllText(yamlPath)

    let deserializer = DeserializerBuilder().Build()
    let envelope = deserializer.Deserialize<VectorEnvelope>(yamlText)

    let results = System.Collections.Generic.Dictionary<string, obj>(StringComparer.Ordinal)
    let mutable hexMismatches = 0
    let mutable roundtripMismatches = 0

    for v in envelope.Vectors do
        let obs = toObservation v
        let id = ZetaIdCodec.pack obs DeterministicEnv.Instance
        let hex = id.ToString("x32", CultureInfo.InvariantCulture)

        let unpacked = ZetaIdCodec.unpack id
        let roundtripOk = unpacked = obs
        let matchesExpected = String.Equals(hex, v.ExpectedHex, StringComparison.Ordinal)

        results.[v.Id] <- box {| hex = hex; roundtripOk = roundtripOk; matchesExpected = matchesExpected |}

        if not roundtripOk then roundtripMismatches <- roundtripMismatches + 1
        if not matchesExpected then hexMismatches <- hexMismatches + 1

    let outputPath = Path.Join(root, "tests", "cross-verification", "zeta-id", "fs-output.json")
    let options = JsonSerializerOptions(WriteIndented = true)
    let json = JsonSerializer.Serialize(results, options)
    File.WriteAllText(outputPath, json)

    Assert.Equal(0, roundtripMismatches)
    Assert.Equal(0, hexMismatches)
