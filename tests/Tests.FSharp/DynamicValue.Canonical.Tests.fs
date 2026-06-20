module Zeta.Tests.DynamicValueCanonicalTests
#nowarn "0893"

open System.IO
open System.Reflection
open System.Collections.Immutable
open System.Text.Json
open global.Xunit
open FsCheck
open FsCheck.FSharp
open FsCheck.Xunit
open Zeta.Core

// ═══════════════════════════════════════════════════════════════════
// CANONICAL primitive candidate — DynamicValue round-trip PROVEN FROM THE
// SEED. DynamicValue already has the 4-language byte-lock (TS/F#/C#/Rust
// agree on golden-vectors{,-cbor}.json — the consensus axis). The existing
// golden-vector tests prove the SEED EXAMPLES encode to the locked bytes;
// this file adds the missing PROOF axis: the GENERAL round-trip LAW
// (decode ∘ encode = id for EVERY value, not just the seed) + that the
// canonical encoding is INJECTIVE, then ANCHORS the law to the seed
// (the seed's canonical bytes are fixed points of encode∘decode = the
// seed-lineage edge, half-(b) of canonical per formal-proof-first).
//
//   * CBOR is TOTAL (8/8 shapes — Float via RFC 8949 §4.2.2 shortest-float,
//     Bytes via major-type-2): full round-trip law over all 8 shapes.
//   * canonical JSON is PARTIAL (6/8 — no Float/Bytes): round-trip law over
//     null/bool/int/string/array/object.
//
// FsCheck for the universal law ∧ the seed fixtures for the lineage edge.
// "The compilers don't lie."
// ═══════════════════════════════════════════════════════════════════

// ── seed helpers (copied from DynamicValue.CborGoldenVectors.Tests.fs) ──
let private repoRoot () : string =
    let mutable dir = DirectoryInfo(Path.GetDirectoryName(Assembly.GetExecutingAssembly().Location))
    while not (isNull dir) && not (File.Exists(Path.Join(dir.FullName, "Zeta.sln"))) do
        dir <- dir.Parent
    if isNull dir then failwith "Could not locate repo root (Zeta.sln) from test assembly location."
    dir.FullName

let private children (el: JsonElement) : JsonElement[] = [| for child in el.EnumerateArray() -> child |]
let private hex (bytes: byte[]) : string = System.Convert.ToHexString(bytes).ToLowerInvariant()
let private seedPath (file: string) = Path.Join(repoRoot (), "src", "Core.TypeScript", "dynamic-value", file)

// ── FsCheck generators for an arbitrary DynamicValue tree (bounded depth) ──
let private genChar = Gen.elements [ 'a'; 'Z'; '0'; '"'; '\\'; '\n'; '\t'; '/'; ' '; 'é'; '☃' ]
let private genStr =
    gen { let! n = Gen.choose (0, 6)
          let! cs = Gen.listOfLength n genChar
          return System.String(List.toArray cs) }
let private genInt64 =
    Gen.oneof
        [ Gen.choose (-100000, 100000) |> Gen.map int64
          Gen.elements [ 0L; 1L; -1L; System.Int64.MaxValue; System.Int64.MinValue ] ]
let private genFiniteFloat =
    // finite floats — CBOR §4.2.2 shortest-float round-trips these exactly;
    // non-finite (NaN/±inf/-0) are covered by a dedicated [<Fact>] below.
    Gen.oneof
        [ Gen.choose (-1000000, 1000000) |> Gen.map (fun n -> float n / 1000.0)
          Gen.elements [ 0.0; 1.0; 1.5; -4.0; 65504.0; 1.0e300 ] ]
let private genBytes =
    gen { let! n = Gen.choose (0, 6)
          let! bs = Gen.listOfLength n (Gen.choose (0, 255) |> Gen.map byte)
          return ImmutableArray.CreateRange bs }

// all 8 shapes (CBOR) vs the 6 JSON-canonical shapes (no Float/Bytes)
let private cborLeaf =
    Gen.oneof
        [ Gen.constant DynamicValue.Null
          Gen.map DynamicValue.Bool (Gen.elements [ true; false ])
          Gen.map DynamicValue.Int genInt64
          Gen.map DynamicValue.Float genFiniteFloat
          Gen.map DynamicValue.String genStr
          Gen.map DynamicValue.Bytes genBytes ]
let private jsonLeaf =
    Gen.oneof
        [ Gen.constant DynamicValue.Null
          Gen.map DynamicValue.Bool (Gen.elements [ true; false ])
          Gen.map DynamicValue.Int genInt64
          Gen.map DynamicValue.String genStr ]

let private build (leaf: Gen<DynamicValue>) : Gen<DynamicValue> =
    let rec aux (size: int) : Gen<DynamicValue> =
        if size <= 0 then
            leaf
        else
            Gen.oneof
                [ leaf
                  gen { let! n = Gen.choose (0, 3)
                        let! items = Gen.listOfLength n (aux (size / 2))
                        return DynamicValue.Array items }
                  gen { let! n = Gen.choose (0, 3)
                        let! rawKeys = Gen.listOfLength n genStr
                        // Object is order-significant with UNIQUE keys (duplicate
                        // keys aren't a faithful canonical map) → distinct.
                        let keys = List.distinct rawKeys
                        let! vals = Gen.listOfLength keys.Length (aux (size / 2))
                        return DynamicValue.Object(List.zip keys vals) } ]
    Gen.sized aux

type CborDvArb() =
    static member Dv() = Arb.fromGen (build cborLeaf)

type JsonDvArb() =
    static member Dv() = Arb.fromGen (build jsonLeaf)

// ── the general round-trip LAW (math proof, half-a) ──

[<Property(Arbitrary = [| typeof<CborDvArb> |])>]
let ``CANONICAL DynamicValue: CBOR round-trip — fromCanonicalCbor ∘ toCanonicalCbor = id (8/8 shapes)``
    (v: DynamicValue) =
    DynamicValue.fromCanonicalCbor (DynamicValue.toCanonicalCborOk v) = Ok v

[<Property(Arbitrary = [| typeof<JsonDvArb> |])>]
let ``CANONICAL DynamicValue: JSON round-trip — fromCanonicalJson ∘ toCanonicalJson = id (6/8 shapes)``
    (v: DynamicValue) =
    // the 6 JSON-canonical shapes must always encode AND decode back to self
    match DynamicValue.toCanonicalJson v with
    | Ok json -> DynamicValue.fromCanonicalJson json = Ok v
    | Error _ -> false

[<Property(Arbitrary = [| typeof<CborDvArb> |])>]
let ``CANONICAL DynamicValue: canonical CBOR encoding is INJECTIVE (distinct values never collide)``
    (a: DynamicValue) (b: DynamicValue) =
    // a corollary of round-trip, stated explicitly: the 4-language byte-lock is
    // a FAITHFUL identity only if encode is injective — no two distinct values
    // share canonical bytes (else the lock would equate things that differ).
    (DynamicValue.toCanonicalCborOk a = DynamicValue.toCanonicalCborOk b) = (a = b)

// ── XML is now TOTAL (8/8) like CBOR — same round-trip LAW + injectivity ──
// (XML float = 16-hex IEEE-754 f64 bits, bytes = lowercase hex; generated strings
// are XML-representable — genChar has no forbidden C0 — so encode is always Ok here.)

[<Property(Arbitrary = [| typeof<CborDvArb> |])>]
let ``CANONICAL DynamicValue: XML round-trip — fromCanonicalXml ∘ toCanonicalXml = id (8/8 shapes)``
    (v: DynamicValue) =
    match DynamicValue.toCanonicalXml v with
    | Ok xml -> DynamicValue.fromCanonicalXml xml = Ok v
    | Error _ -> false

[<Property(Arbitrary = [| typeof<CborDvArb> |])>]
let ``CANONICAL DynamicValue: canonical XML encoding is INJECTIVE (distinct values never collide)``
    (a: DynamicValue) (b: DynamicValue) =
    match DynamicValue.toCanonicalXml a, DynamicValue.toCanonicalXml b with
    | Ok xa, Ok xb -> (xa = xb) = (a = b)
    | _ -> false

// ── non-finite floats: NaN / ±inf / -0.0 CBOR + XML round-trip (generator is finite) ──

[<Fact>]
let ``CANONICAL DynamicValue: non-finite floats (NaN, ±inf, -0.0) CBOR + XML round-trip`` () =
    for f in [ nan; infinity; -infinity; -0.0; 0.0 ] do
        let v = DynamicValue.Float f
        Assert.Equal(Ok v, DynamicValue.fromCanonicalCbor (DynamicValue.toCanonicalCborOk v))
        match DynamicValue.toCanonicalXml v with
        | Ok xml -> Assert.Equal(Ok v, DynamicValue.fromCanonicalXml xml)
        | Error e -> failwithf "XML encode failed for non-finite float %f: %A" f e

// ── seed-lineage edge (half-b): the law holds ON THE SEED ──
// The seed's canonical bytes/strings are FIXED POINTS of encode∘decode — i.e.
// decoding the seed's locked form and re-encoding returns exactly the seed.
// This anchors the universal law above to the actual 4-language seed (the
// canonical DATA, "seed-first / root of DST"): the bytes the four oracles
// agree on ARE what our encoder produces from the value they decode to.

[<Fact>]
let ``CANONICAL DynamicValue: every CBOR seed vector is a fixed point of encode∘decode (anchored to golden-vectors-cbor.json)`` () =
    use doc = JsonDocument.Parse(File.ReadAllText(seedPath "golden-vectors-cbor.json"))
    let vectors = children (doc.RootElement.GetProperty "vectors")
    Assert.NotEmpty vectors
    let failures =
        vectors
        |> Array.choose (fun v ->
            let name = v.GetProperty("name").GetString()
            let seedHex = v.GetProperty("cbor").GetString()
            let bytes = System.Convert.FromHexString seedHex
            match DynamicValue.fromCanonicalCbor bytes with
            | Ok value ->
                let reHex = hex (DynamicValue.toCanonicalCborOk value)
                if reHex = seedHex then None
                else Some(sprintf "%s: re-encode %s ≠ seed %s" name reHex seedHex)
            | Error e -> Some(sprintf "%s: seed bytes failed to decode: %A" name e))
    Assert.True(Array.isEmpty failures, "CBOR seed fixed-point failures:\n" + System.String.Join("\n", failures))

[<Fact>]
let ``CANONICAL DynamicValue: every JSON seed vector is a fixed point of encode∘decode (anchored to golden-vectors.json)`` () =
    use doc = JsonDocument.Parse(File.ReadAllText(seedPath "golden-vectors.json"))
    let vectors = children (doc.RootElement.GetProperty "vectors")
    Assert.NotEmpty vectors
    let failures =
        vectors
        |> Array.choose (fun v ->
            let name = v.GetProperty("name").GetString()
            let seedJson = v.GetProperty("json").GetString()
            match DynamicValue.fromCanonicalJson seedJson with
            | Ok value ->
                match DynamicValue.toCanonicalJson value with
                | Ok reJson when reJson = seedJson -> None
                | Ok reJson -> Some(sprintf "%s: re-encode %s ≠ seed %s" name reJson seedJson)
                | Error e -> Some(sprintf "%s: re-encode failed: %A" name e)
            | Error e -> Some(sprintf "%s: seed json failed to decode: %A" name e))
    Assert.True(Array.isEmpty failures, "JSON seed fixed-point failures:\n" + System.String.Join("\n", failures))
// ═══════════════════════════════════════════════════════════════════
// CODEGEN-FORWARD: the SplitMix64 generator's IR is a DynamicValue ROW.
// The cross-verification oracle tests/cross-verification/splitmix64 is
// "generated-from-ir": its TS generator READS the finalizer IR from
// `_gen/splitmix64.ir.json` (a canonical-JSON DynamicValue) and folds it.
// This test pins the CROSS-LANGUAGE byte-lock of that row: the REAL shipping
// F# `DynamicValue.toCanonicalJson`, given the same IR, must reproduce the
// committed row byte-for-byte (so the row is a genuine schema value both
// languages agree on, not a TS-only artifact), and the row must round-trip.
// u64 multiplier constants are stored as their signed-int64 bit-pattern
// (the mix multiply is mod 2^64, so the reinterpretation is exact).
[<Fact>]
let ``CODEGEN-FORWARD: SplitMix64 IR row byte-locks F# toCanonicalJson and round-trips`` () =
    let i (n: int64) = DynamicValue.Int n
    let s (x: string) = DynamicValue.String x
    let op name key (v: int64) = DynamicValue.Object [ ("op", s name); (key, i v) ]

    let ir =
        DynamicValue.Object
            [ ("generator", s "rng.splitmix64")
              ("version", i 1L)
              ("zetaId", s "129c1fac3a48075b481c0f10f30deb06")
              ("ops",
               DynamicValue.Array
                   [ op "mul" "k" 0x9e3779b97f4a7c15L
                     op "xorshr" "s" 30L
                     op "mul" "k" 0xbf58476d1ce4e5b9L
                     op "xorshr" "s" 27L
                     op "mul" "k" 0x94d049bb133111ebL
                     op "xorshr" "s" 31L ]) ]

    let rowPath =
        Path.Join(repoRoot (), "tests", "cross-verification", "splitmix64", "_gen", "splitmix64.ir.json")

    let rowText = (File.ReadAllText rowPath).Trim()

    match DynamicValue.toCanonicalJson ir with
    | Ok cj ->
        Assert.Equal(rowText, cj) // byte-identical to the committed row the TS oracle reads
        // and the committed row decodes + re-encodes to itself (canonical fixed point)
        match DynamicValue.fromCanonicalJson rowText with
        | Ok decoded ->
            match DynamicValue.toCanonicalJson decoded with
            | Ok reJson -> Assert.Equal(rowText, reJson)
            | Error e -> failwithf "IR row re-encode failed: %A" e
        | Error e -> failwithf "IR row failed to decode: %A" e
    | Error e -> failwithf "IR encode failed: %A" e

// ═══════════════════════════════════════════════════════════════════
// CODEGEN-FORWARD (2nd primitive): the fmix32 generator's IR is a DynamicValue ROW.
// MurmurHash3 fmix32 (tests/cross-verification/fmix32) is the SECOND
// "generated-from-ir" oracle, proving the IR vocabulary generalises across a new
// primitive AND a new integer width (u32). Its finaliser IR carries a `width: 32`
// field; the ops are the same `mul`/`xorshr` vocabulary as splitmix64. This test
// pins the CROSS-LANGUAGE byte-lock of that row: the REAL shipping F#
// `DynamicValue.toCanonicalJson`, given the same IR, must reproduce the committed
// `fmix32.ir.json` byte-for-byte, and the row must round-trip. fmix32's u32
// constants are < 2^31, so they fit `DynamicValue.Int` (int64) directly with NO
// signed reinterpretation (unlike splitmix64's u64 constants).
[<Fact>]
let ``CODEGEN-FORWARD: fmix32 IR row byte-locks F# toCanonicalJson and round-trips`` () =
    let i (n: int64) = DynamicValue.Int n
    let s (x: string) = DynamicValue.String x
    let op name key (v: int64) = DynamicValue.Object [ ("op", s name); (key, i v) ]

    let ir =
        DynamicValue.Object
            [ ("generator", s "hash.fmix32")
              ("version", i 1L)
              ("width", i 32L)
              ("ops",
               DynamicValue.Array
                   [ op "xorshr" "s" 16L
                     op "mul" "k" 2246822507L
                     op "xorshr" "s" 13L
                     op "mul" "k" 3266489909L
                     op "xorshr" "s" 16L ]) ]

    let rowPath =
        Path.Join(repoRoot (), "tests", "cross-verification", "fmix32", "_gen", "fmix32.ir.json")

    let rowText = (File.ReadAllText rowPath).Trim()

    match DynamicValue.toCanonicalJson ir with
    | Ok cj ->
        Assert.Equal(rowText, cj) // byte-identical to the committed row the TS oracle reads
        match DynamicValue.fromCanonicalJson rowText with
        | Ok decoded ->
            match DynamicValue.toCanonicalJson decoded with
            | Ok reJson -> Assert.Equal(rowText, reJson)
            | Error e -> failwithf "fmix32 IR row re-encode failed: %A" e
        | Error e -> failwithf "fmix32 IR row failed to decode: %A" e
    | Error e -> failwithf "fmix32 IR encode failed: %A" e
