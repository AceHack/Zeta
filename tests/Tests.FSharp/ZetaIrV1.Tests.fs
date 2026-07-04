module Zeta.Tests.ZetaIrV1Tests

open System
open System.IO
open System.Text.Json
open global.Xunit
open Zeta.Core

// math-team handoff row 10, Face 3 — the zeta-ir-v1 FREEZE (Phase A, "freeze the IR,
// blocking; nothing byte-locks against a moving IR"). These tests pin the frozen v1
// layout: every known generator IR conforms; every shape deviation is rejected by the
// total validator; the canonical-JSON round-trips; the derived ZetaId equals the legacy
// stored id (no information lost by dropping the field); and the frozen golden file
// reproduces byte-for-byte (the artifact a self-hosting proof can point at).

let private repoRoot () =
    let mutable dir = DirectoryInfo(Path.GetDirectoryName(System.Reflection.Assembly.GetExecutingAssembly().Location))
    while not (isNull dir) && not (File.Exists(Path.Join(dir.FullName, "Zeta.sln"))) do
        dir <- dir.Parent
    if isNull dir then failwith "Could not locate repo root (Zeta.sln)." else dir.FullName

let private goldenPath () =
    Path.Join(repoRoot (), "tests", "cross-verification", "zeta-ir-v1", "zeta-ir-v1.golden.json")

// ── conformance: every known IR validates and round-trips ───────────────────────

[<Fact>]
let ``every known v1 IR validates as itself (round-trip through the validator)`` () =
    for ir in ZetaIrV1.known do
        let dv = ZetaIrV1.toDynamicValue ir
        match ZetaIrV1.validate dv with
        | Ok parsed -> Assert.Equal(ir, parsed)
        | Error e -> failwithf "known IR %s failed v1 validation: %s" ir.Generator e

[<Fact>]
let ``canonical-JSON of a known IR round-trips through validateCanonicalJson`` () =
    for ir in ZetaIrV1.known do
        match ZetaIrV1.toCanonicalJson ir with
        | Ok cj ->
            match ZetaIrV1.validateCanonicalJson cj with
            | Ok parsed -> Assert.Equal(ir, parsed)
            | Error e -> failwithf "canonical JSON for %s did not re-validate: %s" ir.Generator e
        | Error e -> failwithf "known IR %s is not canonical-encodable: %A" ir.Generator e

[<Fact>]
let ``every known v1 IR carries the frozen schema tag and an explicit width`` () =
    for ir in ZetaIrV1.known do
        match ZetaIrV1.toCanonicalJson ir with
        | Ok cj ->
            Assert.Contains("\"schema\":\"zeta-ir-v1\"", cj)
            Assert.Contains("\"width\":", cj)
            // the homoiconic invariant: NO stored zetaId in the frozen bytes.
            Assert.DoesNotContain("zetaId", cj)
        | Error e -> failwithf "%A" e

// ── the derived id equals the legacy stored id (no information lost) ─────────────

[<Fact>]
let ``derived ZetaId for splitmix64 equals the legacy stored id`` () =
    // the legacy splitmix64.ir.json carried zetaId "129c1fac3a48075bc89934da1e90fbe4";
    // v1 drops the field but the derived content-address must reproduce it exactly.
    Assert.Equal("129c1fac3a48075bc89934da1e90fbe4", ZetaIrV1.zetaId ZetaIrV1.splitmix64)

[<Fact>]
let ``derived ZetaId for fmix32 equals the legacy stored id`` () =
    Assert.Equal("3abfe5011af2683b39bf937a4cd545cc", ZetaIrV1.zetaId ZetaIrV1.fmix32)

[<Fact>]
let ``derived ZetaId for fmix64 equals the legacy stored id`` () =
    Assert.Equal("a24500e8d14f31a457ece2dfccd545cc", ZetaIrV1.zetaId ZetaIrV1.fmix64)

[<Fact>]
let ``v1 IR canonical-JSON equals the GeneratorIrRegistry row payload modulo the v1 envelope`` () =
    // sanity: the OPS are identical to the live-relation row's ops (same finaliser),
    // so v1 is a re-enveloping of the same pipeline, not a different generator.
    match GeneratorIrRegistry.decodeIr (GeneratorIrRegistry.known |> List.find (fun r -> r.Name = "hash.fmix32")) with
    | Ok legacyDv ->
        // both carry an `ops` array of the same length with the same op/k/s values.
        match legacyDv, ZetaIrV1.toDynamicValue ZetaIrV1.fmix32 with
        | DynamicValue.Object legacy, DynamicValue.Object v1 ->
            let opsOf entries =
                entries
                |> List.tryPick (fun (k, v) -> if k = "ops" then Some v else None)
            Assert.Equal(opsOf legacy, opsOf v1)
        | _ -> failwith "expected objects"
    | Error e -> failwithf "%A" e

// ── the total validator rejects every shape deviation ───────────────────────────

[<Fact>]
let ``validator rejects a missing schema tag`` () =
    let dv =
        DynamicValue.Object
            [ ("generator", DynamicValue.String "rng.x")
              ("version", DynamicValue.Int 1L)
              ("width", DynamicValue.Int 64L)
              ("ops", DynamicValue.Array []) ]
    match ZetaIrV1.validate dv with
    | Error e -> Assert.Contains("schema", e)
    | Ok _ -> failwith "expected rejection for missing schema"

[<Fact>]
let ``validator rejects a wrong schema tag`` () =
    let dv =
        DynamicValue.Object
            [ ("schema", DynamicValue.String "zeta-ir-v2")
              ("generator", DynamicValue.String "rng.x")
              ("version", DynamicValue.Int 1L)
              ("width", DynamicValue.Int 64L)
              ("ops", DynamicValue.Array []) ]
    match ZetaIrV1.validate dv with
    | Error e -> Assert.Contains("zeta-ir-v2", e)
    | Ok _ -> failwith "expected rejection for wrong schema"

[<Fact>]
let ``validator rejects a stored zetaId (mintable-identity anti-pattern)`` () =
    let dv =
        DynamicValue.Object
            [ ("schema", DynamicValue.String "zeta-ir-v1")
              ("generator", DynamicValue.String "rng.x")
              ("version", DynamicValue.Int 1L)
              ("width", DynamicValue.Int 64L)
              ("zetaId", DynamicValue.String "deadbeef")
              ("ops", DynamicValue.Array []) ]
    match ZetaIrV1.validate dv with
    | Error e -> Assert.Contains("zetaId", e)
    | Ok _ -> failwith "expected rejection for stored zetaId"

[<Fact>]
let ``validator rejects a missing width`` () =
    let dv =
        DynamicValue.Object
            [ ("schema", DynamicValue.String "zeta-ir-v1")
              ("generator", DynamicValue.String "rng.x")
              ("version", DynamicValue.Int 1L)
              ("ops", DynamicValue.Array []) ]
    match ZetaIrV1.validate dv with
    | Error _ -> ()
    | Ok _ -> failwith "expected rejection for missing width"

[<Fact>]
let ``validator rejects an op outside the frozen grammar`` () =
    let dv =
        DynamicValue.Object
            [ ("schema", DynamicValue.String "zeta-ir-v1")
              ("generator", DynamicValue.String "rng.x")
              ("version", DynamicValue.Int 1L)
              ("width", DynamicValue.Int 64L)
              ("ops",
               DynamicValue.Array
                   [ DynamicValue.Object [ ("op", DynamicValue.String "rotl"); ("r", DynamicValue.Int 7L) ] ]) ]
    match ZetaIrV1.validate dv with
    | Error e -> Assert.Contains("rotl", e)
    | Ok _ -> failwith "expected rejection for unknown op"

// ── the frozen golden byte-lock ─────────────────────────────────────────────────

[<Fact>]
let ``frozen zeta-ir-v1 golden reproduces byte-for-byte`` () =
    // emit the canonical JSON for every known v1 IR, keyed by generator name, and write
    // the golden file. Once committed, any shape drift changes these bytes and fails CI.
    let results = System.Collections.Generic.Dictionary<string, string>(StringComparer.Ordinal)
    for ir in ZetaIrV1.known do
        match ZetaIrV1.toCanonicalJson ir with
        | Ok cj -> results.[ir.Generator] <- cj
        | Error e -> failwithf "%A" e

    let options = JsonSerializerOptions(WriteIndented = true)
    let json = JsonSerializer.Serialize(results, options).Replace("\r\n", "\n") + "\n"

    let path = goldenPath ()
    Directory.CreateDirectory(Path.GetDirectoryName path) |> ignore

    if File.Exists path then
        let existing = File.ReadAllText(path).Replace("\r\n", "\n")
        Assert.Equal(existing, json) // byte-lock: committed golden must match freshly emitted
    else
        File.WriteAllText(path, json) // first run materialises the frozen artifact

// ── single source of truth: the legacy *.ir.json is DERIVED from the v1 envelope ──
//
// The committed legacy files are no longer hand-maintained parallels: `toLegacyIrJson`
// derives them from the frozen v1 `Ir`, and these byte-locks prove the derivation equals
// the committed file character-for-character. So the v1 value is the SINGLE SOURCE; the
// legacy file is a generated artifact whose continued existence is test-guaranteed.

let private legacyIrPath (primitive: string) (file: string) =
    Path.Join(repoRoot (), "tests", "cross-verification", primitive, "_gen", file)

[<Fact>]
let ``legacy splitmix64.ir.json is byte-identical to the v1-derived projection`` () =
    let committed =
        File.ReadAllText(legacyIrPath "splitmix64" "splitmix64.ir.json").Trim()
    match ZetaIrV1.toLegacyIrJson ZetaIrV1.splitmix64 with
    | Some(Ok derived) -> Assert.Equal(committed, derived)
    | Some(Error e) -> failwithf "splitmix64 legacy projection failed to encode: %A" e
    | None -> failwith "splitmix64 has no legacy shape mapping"

[<Fact>]
let ``legacy fmix32.ir.json is byte-identical to the v1-derived projection`` () =
    let committed =
        File.ReadAllText(legacyIrPath "fmix32" "fmix32.ir.json").Trim()
    match ZetaIrV1.toLegacyIrJson ZetaIrV1.fmix32 with
    | Some(Ok derived) -> Assert.Equal(committed, derived)
    | Some(Error e) -> failwithf "fmix32 legacy projection failed to encode: %A" e
    | None -> failwith "fmix32 has no legacy shape mapping"

[<Fact>]
let ``legacy fmix64.ir.json is byte-identical to the v1-derived projection`` () =
    // the THIRD generator: its committed legacy file is also DERIVED from the frozen v1
    // value (fmix32-style WidthNoZetaId shape at width 64), proving the single-source-of-
    // truth projection generalises to a freshly-added generator.
    let committed =
        File.ReadAllText(legacyIrPath "fmix64" "fmix64.ir.json").Trim()
    match ZetaIrV1.toLegacyIrJson ZetaIrV1.fmix64 with
    | Some(Ok derived) -> Assert.Equal(committed, derived)
    | Some(Error e) -> failwithf "fmix64 legacy projection failed to encode: %A" e
    | None -> failwith "fmix64 has no legacy shape mapping"

[<Fact>]
let ``the v1-derived legacy splitmix64 reconstructs the stored zetaId from identity alone`` () =
    // the strong claim: the legacy `zetaId` field is NOT carried as v1 data; the
    // projection re-derives it from generator@version. Confirm the derived bytes contain
    // exactly the historically-stored id, proving it was always a pure function of
    // identity (never independent, mintable data).
    match ZetaIrV1.toLegacyIrJson ZetaIrV1.splitmix64 with
    | Some(Ok derived) ->
        Assert.Contains("\"zetaId\":\"129c1fac3a48075bc89934da1e90fbe4\"", derived)
    | Some(Error e) -> failwithf "%A" e
    | None -> failwith "splitmix64 has no legacy shape mapping"

[<Fact>]
let ``a generator with no legacy file has no legacy projection`` () =
    // the projection is total only over generators that actually have a committed legacy
    // file; an unknown generator yields None (not a fabricated file).
    let unknown: ZetaIrV1.Ir =
        { Generator = "rng.nonexistent"
          Version = 1
          Width = 64
          Ops = [ ZetaIrV1.XorShr 7L ] }
    Assert.True((ZetaIrV1.toLegacyIrJson unknown).IsNone)
