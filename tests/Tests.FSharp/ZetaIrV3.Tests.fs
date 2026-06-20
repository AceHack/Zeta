module Zeta.Tests.ZetaIrV3Tests

open System
open System.IO
open System.Text.Json
open global.Xunit
open Zeta.Core

// math-team handoff row 10, Face 3 — the SECOND grammar-EXTENDING evolution of the IR.
// v2 proved the envelope can evolve ONCE (adding `rotl`, a sequential op). v3 proves it
// survives a SECOND, DIFFERENT extension: two PARALLEL-reuse ops (`xrotxor`/`xshrxor`) that
// fold the original word through several rotations/shifts and XOR the lot back in — which no
// sequential mul/xorshr/rotl chain can express. The fifth generator, Pelle Evensen's
// public-domain `nasam` mixer, is the first to need them. Decisive properties:
//   (1) TWO-LAYER FIREWALL — both the v1 AND v2 validators reject a v3 artifact, and v3
//       rejects v1/v2 artifacts: the schema tag is the version, now two layers deep.
//   (2) v2 -> v3 WIDENING — every v2 op is a v3 op (rotl carries over; `xorshr s` widens to
//       the one-term `xshrxor [s]`), so v3 reads v1's and v2's vocabularies.
//   (3) NECESSITY proofs — `xrotxor [r]` (xor-in a rotation) is a different function from a
//       v2 `rotl r` (replace by rotation); and a two-term `xshrxor [a;b]` is not any single
//       `xorshr`. So both ops are required, not gratuitous.
//   (4) a byte-locked v3 golden for nasam, externally anchored to the public-domain reference.

let private repoRoot () =
    let mutable dir = DirectoryInfo(Path.GetDirectoryName(System.Reflection.Assembly.GetExecutingAssembly().Location))
    while not (isNull dir) && not (File.Exists(Path.Join(dir.FullName, "Zeta.sln"))) do
        dir <- dir.Parent
    if isNull dir then failwith "Could not locate repo root (Zeta.sln)." else dir.FullName

let private goldenPath () =
    Path.Join(repoRoot (), "tests", "cross-verification", "nasam", "zeta-ir-v3.golden.json")

// ── conformance: every known v3 IR validates and round-trips ─────────────────────

[<Fact>]
let ``every known v3 IR validates as itself (round-trip through the validator)`` () =
    for ir in ZetaIrV3.known do
        let dv = ZetaIrV3.toDynamicValue ir
        match ZetaIrV3.validate dv with
        | Ok parsed -> Assert.Equal(ir, parsed)
        | Error e -> failwithf "known v3 IR %s failed validation: %s" ir.Generator e

[<Fact>]
let ``canonical-JSON of a known v3 IR round-trips through validateCanonicalJson`` () =
    for ir in ZetaIrV3.known do
        match ZetaIrV3.toCanonicalJson ir with
        | Ok cj ->
            match ZetaIrV3.validateCanonicalJson cj with
            | Ok parsed -> Assert.Equal(ir, parsed)
            | Error e -> failwithf "canonical JSON for %s did not re-validate: %s" ir.Generator e
        | Error e -> failwithf "known v3 IR %s is not canonical-encodable: %A" ir.Generator e

[<Fact>]
let ``every known v3 IR carries the bumped schema tag, explicit width, and no stored zetaId`` () =
    for ir in ZetaIrV3.known do
        match ZetaIrV3.toCanonicalJson ir with
        | Ok cj ->
            Assert.Contains("\"schema\":\"zeta-ir-v3\"", cj)
            Assert.Contains("\"width\":", cj)
            Assert.DoesNotContain("zetaId", cj)
        | Error e -> failwithf "%A" e

[<Fact>]
let ``the nasam v3 IR is exactly xrotxor[39;17], mul, xshrxor[23;51], mul, xshrxor[23;51] at width 64`` () =
    let expected =
        [ ZetaIrV3.XRotXor [ 39L; 17L ]
          ZetaIrV3.Mul -7031135171492799847L
          ZetaIrV3.XShrXor [ 23L; 51L ]
          ZetaIrV3.Mul -7030854795893499237L
          ZetaIrV3.XShrXor [ 23L; 51L ] ]
    Assert.Equal<ZetaIrV3.Op list>(expected, ZetaIrV3.nasam.Ops)
    Assert.Equal(64, ZetaIrV3.nasam.Width)

// ── the TWO-LAYER FIREWALL: v1 AND v2 reject a v3 artifact; v3 rejects theirs ─────

[<Fact>]
let ``v1 validator REJECTS a v3 artifact (firewall, layer 1)`` () =
    match ZetaIrV3.toCanonicalJson ZetaIrV3.nasam with
    | Ok v3json ->
        match ZetaIrV1.validateCanonicalJson v3json with
        | Error e -> Assert.Contains("zeta-ir-v3", e)
        | Ok _ -> failwith "v1 validator must NOT accept a v3 artifact"
    | Error e -> failwithf "%A" e

[<Fact>]
let ``v2 validator REJECTS a v3 artifact (firewall, layer 2)`` () =
    match ZetaIrV3.toCanonicalJson ZetaIrV3.nasam with
    | Ok v3json ->
        match ZetaIrV2.validateCanonicalJson v3json with
        | Error e -> Assert.Contains("zeta-ir-v3", e)
        | Ok _ -> failwith "v2 validator must NOT accept a v3 artifact"
    | Error e -> failwithf "%A" e

[<Fact>]
let ``v3 validator REJECTS v1 and v2 artifacts (tag is the version)`` () =
    match ZetaIrV1.toCanonicalJson ZetaIrV1.fmix64 with
    | Ok v1json ->
        match ZetaIrV3.validateCanonicalJson v1json with
        | Error e -> Assert.Contains("zeta-ir-v1", e)
        | Ok _ -> failwith "v3 validator must NOT accept a v1 artifact"
    | Error e -> failwithf "%A" e
    match ZetaIrV2.toCanonicalJson ZetaIrV2.xoshiro256ss with
    | Ok v2json ->
        match ZetaIrV3.validateCanonicalJson v2json with
        | Error e -> Assert.Contains("zeta-ir-v2", e)
        | Ok _ -> failwith "v3 validator must NOT accept a v2 artifact"
    | Error e -> failwithf "%A" e

// ── v2 -> v3 WIDENING: every v2 op is a v3 op ────────────────────────────────────

[<Fact>]
let ``ofV2 widens a v2 IR into a valid v3 IR, preserving op count and semantics`` () =
    // xoshiro256** (v2: mul/rotl/mul) widens to v3 with the same op count; rotl carries over
    // verbatim and the artifact re-validates under the v3 tag.
    let widened = ZetaIrV3.ofV2 ZetaIrV2.xoshiro256ss
    Assert.Equal(ZetaIrV2.xoshiro256ss.Width, widened.Width)
    Assert.Equal(ZetaIrV2.xoshiro256ss.Ops.Length, widened.Ops.Length)
    match ZetaIrV3.toCanonicalJson widened with
    | Ok cj ->
        Assert.Contains("\"schema\":\"zeta-ir-v3\"", cj)
        match ZetaIrV3.validateCanonicalJson cj with
        | Ok _ -> ()
        | Error e -> failwithf "widened xoshiro256ss did not re-validate as v3: %s" e
    | Error e -> failwithf "%A" e

[<Fact>]
let ``a v2 single-term xorshr widens to a one-element xshrxor (the op generalises)`` () =
    // fmix64 (via v1->v2) is all mul/xorshr; widening to v3 turns each `xorshr s` into the
    // one-element `xshrxor [s]` — the v3 op of which v1/v2's xorshr is the special case.
    let widened = ZetaIrV3.ofV1 ZetaIrV1.fmix64
    let hasOneTermXshrxor =
        widened.Ops
        |> List.exists (fun op ->
            match op with
            | ZetaIrV3.XShrXor [ _ ] -> true
            | _ -> false)
    Assert.True(hasOneTermXshrxor, "widened fmix64 must contain a one-term xshrxor")
    // and no bare XorShr survives the widening
    let hasBareXorShr =
        widened.Ops
        |> List.exists (fun op ->
            match op with
            | ZetaIrV3.XorShr _ -> true
            | _ -> false)
    Assert.False(hasBareXorShr, "widening must lower XorShr into the one-term XShrXor form")

[<Fact>]
let ``the derived ZetaId is unchanged by widening to v3 (identity is generator and version)`` () =
    Assert.Equal(ZetaIrV2.zetaId ZetaIrV2.xoshiro256ss, ZetaIrV3.zetaId (ZetaIrV3.ofV2 ZetaIrV2.xoshiro256ss))

// ── NECESSITY: xrotxor and two-term xshrxor are outside the v2 grammar ───────────

[<Fact>]
let ``xrotxor (xor-in a rotation) is a DIFFERENT function from a v2 rotl (replace by rotation)`` () =
    // v2 `rotl r` REPLACES x with its rotation:           z := rotl(z, r)
    // v3 `xrotxor [r]` XORs the rotation back IN:          z := z ^ rotl(z, r)
    // On x = 1 with r = 1: rotl = 2, but xrotxor = 1 ^ 2 = 3. They are not the same op, so
    // no v2 rotl chain can stand in for xrotxor.
    let rotl (x: uint64) (k: int) = (x <<< k) ||| (x >>> (64 - k))
    let x = 1UL
    let r = 1
    Assert.Equal(2UL, rotl x r) // what v2 rotl does
    Assert.Equal(3UL, x ^^^ rotl x r) // what v3 xrotxor [r] does
    Assert.NotEqual(rotl x r, x ^^^ rotl x r)

[<Fact>]
let ``a two-term xshrxor is NOT reproducible by any single v1/v2 xorshr`` () =
    // nasam's step `x ^= x>>23 ^ x>>51` is `xshrxor [23;51]`. A single `xorshr s` is
    // `x ^= x>>s`. We show no single s on a witness input matches the two-term result.
    let x = 0x9E3779B97F4A7C15UL
    let twoTerm = x ^^^ (x >>> 23) ^^^ (x >>> 51)
    let anySingleMatches =
        [ 1 .. 63 ] |> List.exists (fun s -> (x ^^^ (x >>> s)) = twoTerm)
    Assert.False(anySingleMatches)

[<Fact>]
let ``the v1 and v2 grammars have no xrotxor op (validators reject it), but v3 accepts it`` () =
    let xrotxorNode =
        DynamicValue.Object
            [ ("op", DynamicValue.String "xrotxor")
              ("rs", DynamicValue.Array [ DynamicValue.Int 39L; DynamicValue.Int 17L ]) ]
    let envelope tag =
        DynamicValue.Object
            [ ("schema", DynamicValue.String tag)
              ("generator", DynamicValue.String "rng.x")
              ("version", DynamicValue.Int 1L)
              ("width", DynamicValue.Int 64L)
              ("ops", DynamicValue.Array [ xrotxorNode ]) ]
    match ZetaIrV1.validate (envelope "zeta-ir-v1") with
    | Error _ -> ()
    | Ok _ -> failwith "v1 must reject an xrotxor op"
    match ZetaIrV2.validate (envelope "zeta-ir-v2") with
    | Error e -> Assert.Contains("xrotxor", e)
    | Ok _ -> failwith "v2 must reject an xrotxor op"
    match ZetaIrV3.validate (envelope "zeta-ir-v3") with
    | Ok ir -> Assert.Equal<ZetaIrV3.Op list>([ ZetaIrV3.XRotXor [ 39L; 17L ] ], ir.Ops)
    | Error e -> failwithf "v3 must accept an xrotxor op: %s" e

// ── the v3 validator rejects every shape deviation ───────────────────────────────

[<Fact>]
let ``v3 validator rejects a stored zetaId (mintable-identity anti-pattern)`` () =
    let dv =
        DynamicValue.Object
            [ ("schema", DynamicValue.String "zeta-ir-v3")
              ("generator", DynamicValue.String "rng.x")
              ("version", DynamicValue.Int 1L)
              ("width", DynamicValue.Int 64L)
              ("zetaId", DynamicValue.String "deadbeef")
              ("ops", DynamicValue.Array []) ]
    match ZetaIrV3.validate dv with
    | Error e -> Assert.Contains("zetaId", e)
    | Ok _ -> failwith "expected rejection for stored zetaId"

[<Fact>]
let ``v3 validator rejects an op outside the v3 grammar`` () =
    let dv =
        DynamicValue.Object
            [ ("schema", DynamicValue.String "zeta-ir-v3")
              ("generator", DynamicValue.String "rng.x")
              ("version", DynamicValue.Int 1L)
              ("width", DynamicValue.Int 64L)
              ("ops",
               DynamicValue.Array
                   [ DynamicValue.Object [ ("op", DynamicValue.String "rotr"); ("r", DynamicValue.Int 7L) ] ]) ]
    match ZetaIrV3.validate dv with
    | Error e -> Assert.Contains("rotr", e)
    | Ok _ -> failwith "expected rejection for unknown op rotr"

[<Fact>]
let ``v3 validator rejects an xshrxor with an empty term list`` () =
    let dv =
        DynamicValue.Object
            [ ("schema", DynamicValue.String "zeta-ir-v3")
              ("generator", DynamicValue.String "rng.x")
              ("version", DynamicValue.Int 1L)
              ("width", DynamicValue.Int 64L)
              ("ops",
               DynamicValue.Array [ DynamicValue.Object [ ("op", DynamicValue.String "xshrxor"); ("ss", DynamicValue.Array []) ] ]) ]
    match ZetaIrV3.validate dv with
    | Error e -> Assert.Contains("xshrxor", e)
    | Ok _ -> failwith "expected rejection for empty xshrxor term list"

[<Fact>]
let ``v3 validator rejects an xrotxor missing its rs term list`` () =
    let dv =
        DynamicValue.Object
            [ ("schema", DynamicValue.String "zeta-ir-v3")
              ("generator", DynamicValue.String "rng.x")
              ("version", DynamicValue.Int 1L)
              ("width", DynamicValue.Int 64L)
              ("ops", DynamicValue.Array [ DynamicValue.Object [ ("op", DynamicValue.String "xrotxor") ] ]) ]
    match ZetaIrV3.validate dv with
    | Error e -> Assert.Contains("xrotxor", e)
    | Ok _ -> failwith "expected rejection for xrotxor missing rs"

// ── the frozen v3 golden byte-lock ───────────────────────────────────────────────

[<Fact>]
let ``frozen zeta-ir-v3 golden reproduces byte-for-byte`` () =
    let results = System.Collections.Generic.Dictionary<string, string>(StringComparer.Ordinal)
    for ir in ZetaIrV3.known do
        match ZetaIrV3.toCanonicalJson ir with
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
