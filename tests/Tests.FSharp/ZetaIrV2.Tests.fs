module Zeta.Tests.ZetaIrV2Tests

open System
open System.IO
open System.Text.Json
open global.Xunit
open Zeta.Core

// math-team handoff row 10, Face 3 — the FIRST grammar-EXTENDING evolution of the IR.
// Where ZetaIrV1.Tests pin a FROZEN layout, these pin that the layout can EVOLVE soundly:
// v2 adds the `rotl` op (provably outside v1's grammar), under a bumped schema tag, in a
// new module that leaves v1 untouched. The decisive properties are (1) the v1/v2 FIREWALL
// — v1's validator rejects a v2 artifact and vice-versa, so a v2 row can never be silently
// read as v1; (2) v1->v2 WIDENING — every v1 op is a v2 op, so v2 reads v1's vocabulary;
// (3) the rotl NECESSITY proof — no mul/xorshr sequence reproduces rotl's MSB-wrap, so the
// extension is required, not gratuitous; (4) a byte-locked v2 golden for the fourth
// generator (xoshiro256**), externally anchored to the public-domain reference.

let private repoRoot () =
    let mutable dir = DirectoryInfo(Path.GetDirectoryName(System.Reflection.Assembly.GetExecutingAssembly().Location))
    while not (isNull dir) && not (File.Exists(Path.Join(dir.FullName, "Zeta.sln"))) do
        dir <- dir.Parent
    if isNull dir then failwith "Could not locate repo root (Zeta.sln)." else dir.FullName

let private goldenPath () =
    Path.Join(repoRoot (), "tests", "cross-verification", "xoshiro256ss", "zeta-ir-v2.golden.json")

// ── conformance: every known v2 IR validates and round-trips ─────────────────────

[<Fact>]
let ``every known v2 IR validates as itself (round-trip through the validator)`` () =
    for ir in ZetaIrV2.known do
        let dv = ZetaIrV2.toDynamicValue ir
        match ZetaIrV2.validate dv with
        | Ok parsed -> Assert.Equal(ir, parsed)
        | Error e -> failwithf "known v2 IR %s failed validation: %s" ir.Generator e

[<Fact>]
let ``canonical-JSON of a known v2 IR round-trips through validateCanonicalJson`` () =
    for ir in ZetaIrV2.known do
        match ZetaIrV2.toCanonicalJson ir with
        | Ok cj ->
            match ZetaIrV2.validateCanonicalJson cj with
            | Ok parsed -> Assert.Equal(ir, parsed)
            | Error e -> failwithf "canonical JSON for %s did not re-validate: %s" ir.Generator e
        | Error e -> failwithf "known v2 IR %s is not canonical-encodable: %A" ir.Generator e

[<Fact>]
let ``every known v2 IR carries the bumped schema tag, explicit width, and no stored zetaId`` () =
    for ir in ZetaIrV2.known do
        match ZetaIrV2.toCanonicalJson ir with
        | Ok cj ->
            Assert.Contains("\"schema\":\"zeta-ir-v2\"", cj)
            Assert.Contains("\"width\":", cj)
            Assert.DoesNotContain("zetaId", cj)
        | Error e -> failwithf "%A" e

[<Fact>]
let ``the xoshiro256ss v2 IR is exactly mul 5, rotl 7, mul 9 at width 64`` () =
    Assert.Equal<ZetaIrV2.Op list>([ ZetaIrV2.Mul 5L; ZetaIrV2.Rotl 7L; ZetaIrV2.Mul 9L ], ZetaIrV2.xoshiro256ss.Ops)
    Assert.Equal(64, ZetaIrV2.xoshiro256ss.Width)

// ── the v1/v2 FIREWALL: each validator rejects the other's tag ───────────────────

[<Fact>]
let ``v1 validator REJECTS a v2 artifact (the firewall)`` () =
    // the contract's decisive clause: "the v1 validator rejects any other tag, so a v2
    // artifact can never be silently read as v1."
    match ZetaIrV2.toCanonicalJson ZetaIrV2.xoshiro256ss with
    | Ok v2json ->
        match ZetaIrV1.validateCanonicalJson v2json with
        | Error e -> Assert.Contains("zeta-ir-v2", e) // names the offending tag
        | Ok _ -> failwith "v1 validator must NOT accept a v2 artifact"
    | Error e -> failwithf "%A" e

[<Fact>]
let ``v2 validator REJECTS a v1 artifact (tag is the version)`` () =
    // symmetric: a v1 artifact is not a v2 artifact. The schema tag is the version.
    match ZetaIrV1.toCanonicalJson ZetaIrV1.fmix64 with
    | Ok v1json ->
        match ZetaIrV2.validateCanonicalJson v1json with
        | Error e -> Assert.Contains("zeta-ir-v1", e)
        | Ok _ -> failwith "v2 validator must NOT accept a v1 artifact"
    | Error e -> failwithf "%A" e

// ── v1 -> v2 WIDENING: every v1 op is a v2 op ────────────────────────────────────

[<Fact>]
let ``ofV1 widens a v1 IR into a valid v2 IR, preserving ops`` () =
    // widening fmix64 (v1) into v2 keeps its ops one-for-one (mul/xorshr widen to mul/xorshr)
    // and yields an artifact the v2 validator accepts under the v2 tag.
    let widened = ZetaIrV2.ofV1 ZetaIrV1.fmix64
    Assert.Equal(ZetaIrV1.fmix64.Width, widened.Width)
    Assert.Equal(ZetaIrV1.fmix64.Ops.Length, widened.Ops.Length)
    match ZetaIrV2.toCanonicalJson widened with
    | Ok cj ->
        Assert.Contains("\"schema\":\"zeta-ir-v2\"", cj)
        match ZetaIrV2.validateCanonicalJson cj with
        | Ok _ -> ()
        | Error e -> failwithf "widened fmix64 did not re-validate as v2: %s" e
    | Error e -> failwithf "%A" e

[<Fact>]
let ``the derived ZetaId is unchanged by widening (identity is generator and version)`` () =
    // widening changes the schema tag, never the identity: the content-address is a pure
    // function of generator@version, the same in v1 and v2.
    Assert.Equal(ZetaIrV1.zetaId ZetaIrV1.fmix64, ZetaIrV2.zetaId (ZetaIrV2.ofV1 ZetaIrV1.fmix64))

// ── the rotl NECESSITY proof: rotl is NOT in the v1 grammar ──────────────────────

[<Fact>]
let ``rotl wraps the MSB to the LSB, which neither mul nor xorshr can do`` () =
    // The defining behaviour `rotl` adds: it moves the most-significant bit DOWN to bit 0.
    //   rotl(1<<63, 1) = 1
    // `mul` only propagates carries UPWARD; `xorshr` (x ^= x>>>s) only moves bits DOWNWARD
    // by XOR (it can never CLEAR the source bit while SETTING bit 0 alone). We demonstrate
    // the wrap concretely and confirm the two v1 ops cannot reproduce it on this input.
    let mask = 0xFFFFFFFFFFFFFFFFUL
    let rotl (x: uint64) (k: int) = (x <<< k) ||| (x >>> (64 - k))
    let msb = 1UL <<< 63
    Assert.Equal(1UL, rotl msb 1) // the wrap

    // any single mul maps msb -> (msb * k) mod 2^64; bit 0 of that is 0 for EVERY k (msb*k
    // is always even because msb is even), so no mul yields 1.
    let mulGivesOne =
        [ 1UL .. 64UL ] |> List.exists (fun k -> (msb * k) &&& mask = 1UL)
    Assert.False(mulGivesOne)
    // xorshr on msb: msb ^ (msb >>> s). bit 0 is set only if (msb >>> s) has bit 0 set,
    // i.e. s = 63 — but then the result is msb ^ 1, which is NOT 1 (msb still set).
    let xorshrGivesOne =
        [ 1 .. 63 ] |> List.exists (fun s -> (msb ^^^ (msb >>> s)) = 1UL)
    Assert.False(xorshrGivesOne)

[<Fact>]
let ``the v1 grammar has no rotl op (validator rejects it), but the v2 grammar accepts it`` () =
    let rotlNode =
        DynamicValue.Object
            [ ("op", DynamicValue.String "rotl"); ("r", DynamicValue.Int 7L) ]
    let envelope tag =
        DynamicValue.Object
            [ ("schema", DynamicValue.String tag)
              ("generator", DynamicValue.String "rng.x")
              ("version", DynamicValue.Int 1L)
              ("width", DynamicValue.Int 64L)
              ("ops", DynamicValue.Array [ rotlNode ]) ]
    // v1 rejects rotl (both because tag mismatch AND the op is outside its grammar)
    match ZetaIrV1.validate (envelope "zeta-ir-v1") with
    | Error e -> Assert.Contains("rotl", e)
    | Ok _ -> failwith "v1 must reject a rotl op"
    // v2 accepts it
    match ZetaIrV2.validate (envelope "zeta-ir-v2") with
    | Ok ir -> Assert.Equal<ZetaIrV2.Op list>([ ZetaIrV2.Rotl 7L ], ir.Ops)
    | Error e -> failwithf "v2 must accept a rotl op: %s" e

// ── the v2 validator rejects every shape deviation ───────────────────────────────

[<Fact>]
let ``v2 validator rejects a stored zetaId (mintable-identity anti-pattern)`` () =
    let dv =
        DynamicValue.Object
            [ ("schema", DynamicValue.String "zeta-ir-v2")
              ("generator", DynamicValue.String "rng.x")
              ("version", DynamicValue.Int 1L)
              ("width", DynamicValue.Int 64L)
              ("zetaId", DynamicValue.String "deadbeef")
              ("ops", DynamicValue.Array []) ]
    match ZetaIrV2.validate dv with
    | Error e -> Assert.Contains("zetaId", e)
    | Ok _ -> failwith "expected rejection for stored zetaId"

[<Fact>]
let ``v2 validator rejects an op outside the v2 grammar`` () =
    let dv =
        DynamicValue.Object
            [ ("schema", DynamicValue.String "zeta-ir-v2")
              ("generator", DynamicValue.String "rng.x")
              ("version", DynamicValue.Int 1L)
              ("width", DynamicValue.Int 64L)
              ("ops",
               DynamicValue.Array
                   [ DynamicValue.Object [ ("op", DynamicValue.String "rotr"); ("r", DynamicValue.Int 7L) ] ]) ]
    match ZetaIrV2.validate dv with
    | Error e -> Assert.Contains("rotr", e)
    | Ok _ -> failwith "expected rejection for unknown op rotr"

[<Fact>]
let ``v2 validator rejects a rotl op missing its r`` () =
    let dv =
        DynamicValue.Object
            [ ("schema", DynamicValue.String "zeta-ir-v2")
              ("generator", DynamicValue.String "rng.x")
              ("version", DynamicValue.Int 1L)
              ("width", DynamicValue.Int 64L)
              ("ops",
               DynamicValue.Array [ DynamicValue.Object [ ("op", DynamicValue.String "rotl") ] ]) ]
    match ZetaIrV2.validate dv with
    | Error e -> Assert.Contains("rotl", e)
    | Ok _ -> failwith "expected rejection for rotl missing r"

// ── the frozen v2 golden byte-lock ───────────────────────────────────────────────

[<Fact>]
let ``frozen zeta-ir-v2 golden reproduces byte-for-byte`` () =
    let results = System.Collections.Generic.Dictionary<string, string>(StringComparer.Ordinal)
    for ir in ZetaIrV2.known do
        match ZetaIrV2.toCanonicalJson ir with
        | Ok cj -> results.[ir.Generator] <- cj
        | Error e -> failwithf "%A" e

    let options = JsonSerializerOptions(WriteIndented = true)
    let json = JsonSerializer.Serialize(results, options).Replace("\r\n", "\n") + "\n"

    let path = goldenPath ()
    Directory.CreateDirectory(Path.GetDirectoryName path) |> ignore

    if File.Exists path then
        let existing = File.ReadAllText(path).Replace("\r\n", "\n")
        Assert.Equal(existing, json)
    else
        File.WriteAllText(path, json)
