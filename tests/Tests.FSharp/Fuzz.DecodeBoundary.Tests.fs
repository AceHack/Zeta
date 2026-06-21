module Zeta.Tests.FuzzDecodeBoundaryTests

open System
open System.Threading.Tasks
open global.Xunit
open FsCheck
open FsCheck.FSharp
open FsCheck.Xunit
open Zeta.Core

// ═══════════════════════════════════════════════════════════════════
// 081KT7YW00008QG0R0019J8FSX — serializer hostile-input safety: the `from*` decode boundary fuzz harness.
// Existing proofs cover CORRECTNESS ON VALID input (round-trip / injectivity / canonicality).
// This is SAFETY ON HOSTILE input — where memory-safe-language CVEs live (DoS, signature
// bypass). The leg proven here is DECODE TOTALITY (081KT7YW00008QG0R0019J8FSX leg 1, empirical): every `from*`
// decoder terminates and returns `Result` on EVERY input — never throws, never hangs, never
// OOMs — for random bytes/strings AND for hand-crafted pre-allocation bombs.
//
// SCOPE: this is the in-process FsCheck harness (the space proof + valid-input FsCheck don't
// reach). Coverage-guided out-of-process fuzzing (SharpFuzz/AFL, crash-isolated for the
// stack-overflow-on-deep-nesting class) + cross-oracle DIFFERENTIAL fuzzing are the heavier
// follow-up legs noted in 081KT7YW00008QG0R0019J8FSX. Depths here are kept conservative so a real decoder bug
// surfaces as a clean test failure, not a process-killing crash that takes down the suite.
// ═══════════════════════════════════════════════════════════════════

/// A decode is TOTAL iff it returns a Result (Ok or Error) without throwing. Returns false
/// only if the decoder threw — i.e. a totality violation (the bug class we hunt).
let private isTotal (decode: unit -> Result<'a, DecodeError>) : bool =
    try
        decode () |> ignore
        true
    with _ ->
        false

/// Run `f` with a wall-clock budget; false = timed out (a hang = DoS = bug).
let private completesWithin (ms: int) (f: unit -> bool) : bool =
    try
        let t = Task.Run f
        if t.Wait ms then t.Result else false
    with _ ->
        false

// ── DECODE TOTALITY over random inputs (the core leg) ──

[<Property(MaxTest = 2000)>]
let ``Fuzz: fromCanonicalJson is total on arbitrary strings (never throws)`` (NonNull (s: string)) =
    isTotal (fun () -> DynamicValue.fromCanonicalJson s)

[<Property(MaxTest = 2000)>]
let ``Fuzz: fromCanonicalXml is total on arbitrary strings (never throws)`` (NonNull (s: string)) =
    isTotal (fun () -> DynamicValue.fromCanonicalXml s)

[<Property(MaxTest = 2000)>]
let ``Fuzz: fromCanonicalCbor is total on arbitrary bytes (never throws)`` (bytes: byte[]) =
    let b = if isNull (box bytes) then [||] else bytes
    isTotal (fun () -> DynamicValue.fromCanonicalCbor b)

[<Property(MaxTest = 2000)>]
let ``Fuzz: fromArrow is total on arbitrary bytes (never throws)`` (bytes: byte[]) =
    let b = if isNull (box bytes) then [||] else bytes
    isTotal (fun () -> DynamicValueArrow.fromArrow b)

// ── null / empty inputs (the trivial hostile edges) ──

[<Fact>]
let ``Fuzz: decoders handle null / empty inputs without throwing`` () =
    Assert.True(isTotal (fun () -> DynamicValue.fromCanonicalJson null))
    Assert.True(isTotal (fun () -> DynamicValue.fromCanonicalXml null))
    Assert.True(isTotal (fun () -> DynamicValue.fromCanonicalJson ""))
    Assert.True(isTotal (fun () -> DynamicValue.fromCanonicalXml ""))
    Assert.True(isTotal (fun () -> DynamicValue.fromCanonicalCbor [||]))
    Assert.True(isTotal (fun () -> DynamicValueArrow.fromArrow [||]))

// ── PRE-ALLOCATION BOMBS: a header claiming a huge size with no body must be rejected
//    cheaply (no OOM / no hang). A correct decoder bounds-checks the claimed length against
//    the remaining bytes BEFORE allocating. If it pre-allocates, this hangs/OOMs → caught. ──

[<Fact>]
let ``Fuzz: CBOR array-length bomb (claims 2^64-1 elements, empty body) is rejected fast`` () =
    // 0x9B = major type 4 (array), 8-byte length follows; then 0xFF×8 = 2^64-1, no elements.
    let bomb = [| 0x9Buy; 0xFFuy; 0xFFuy; 0xFFuy; 0xFFuy; 0xFFuy; 0xFFuy; 0xFFuy; 0xFFuy |]
    let ok = completesWithin 2000 (fun () -> isTotal (fun () -> DynamicValue.fromCanonicalCbor bomb))
    Assert.True(ok, "CBOR array-length bomb hung or threw (pre-allocation DoS)")

[<Fact>]
let ``Fuzz: CBOR byte-string-length bomb (claims 2^64-1 bytes, empty body) is rejected fast`` () =
    // 0x5B = major type 2 (byte string), 8-byte length; 0xFF×8 = 2^64-1, no payload.
    let bomb = [| 0x5Buy; 0xFFuy; 0xFFuy; 0xFFuy; 0xFFuy; 0xFFuy; 0xFFuy; 0xFFuy; 0xFFuy |]
    let ok = completesWithin 2000 (fun () -> isTotal (fun () -> DynamicValue.fromCanonicalCbor bomb))
    Assert.True(ok, "CBOR byte-string-length bomb hung or threw (pre-allocation DoS)")

[<Fact>]
let ``Fuzz: Arrow garbage + truncated-header inputs are rejected fast`` () =
    let cases =
        [ Array.replicate 64 0xFFuy
          [| 0xFFuy; 0xFFuy; 0xFFuy; 0x7Fuy |] // a huge little-endian length prefix
          "ARROW1"B
          Array.zeroCreate 32 ]
    for bytes in cases do
        let ok = completesWithin 2000 (fun () -> isTotal (fun () -> DynamicValueArrow.fromArrow bytes))
        Assert.True(ok, "Arrow hostile input hung or threw")

// ── DEEP NESTING (moderate depth; the recursion-depth class). Conservative so a robust
//    decoder either handles it (Result) or rejects it — without a process-killing SO. ──

[<Fact>]
let ``Fuzz: deeply-nested JSON arrays decode to a Result without throwing (depth 2000)`` () =
    let depth = 2000
    let json = String.replicate depth "[" + String.replicate depth "]"
    let ok = completesWithin 3000 (fun () -> isTotal (fun () -> DynamicValue.fromCanonicalJson json))
    Assert.True(ok, "deeply-nested JSON hung or threw")

[<Fact>]
let ``Fuzz: deeply-nested XML elements decode to a Result without throwing (depth 2000)`` () =
    let depth = 2000
    let xml = String.replicate depth "<a>" + String.replicate depth "</a>"
    let ok = completesWithin 3000 (fun () -> isTotal (fun () -> DynamicValue.fromCanonicalXml xml))
    Assert.True(ok, "deeply-nested XML hung or threw")

// ── DEPTH-BOUND CONTRACT (the `NestingTooDeep` guard, mirrored F#/C#/Rust/TS). The deep-nesting
//    Facts above prove "no process-killing SO"; these pin the exact boundary: a value AT the bound
//    encodes/decodes fine, one level DEEPER is rejected as data (Error NestingTooDeep), never thrown.
//    `maxNestingDepth` is internal, so the bound is exercised behaviourally via known-deep values. ──

// `nest k` wraps Null in k single-element arrays → the leaf Null sits at recursion depth k.
let private nest (k: int) : DynamicValue =
    List.fold (fun acc _ -> DynamicValue.Array [ acc ]) DynamicValue.Null [ 1..k ]

[<Fact>]
let ``Depth bound: a value at the maximum nesting encodes Ok, one deeper is NestingTooDeep`` () =
    // The bound (maxNestingDepth) is 256: leaf at depth 256 is accepted, depth 257 is rejected.
    match DynamicValue.toCanonicalJson (nest 256) with
    | Ok _ -> ()
    | Error e -> Assert.Fail($"value at the bound should encode Ok, got {e}")

    Assert.Equal(Error EncodeError.NestingTooDeep, DynamicValue.toCanonicalJson (nest 257))
    Assert.Equal(Error EncodeError.NestingTooDeep, DynamicValue.toCanonicalXml (nest 257))

[<Fact>]
let ``Depth bound: decoding past the maximum nesting is NestingTooDeep, not a stack overflow`` () =
    let jsonAt k = String.replicate k "[" + "null" + String.replicate k "]"
    // at the bound: well-formed canonical → Ok; one deeper → NestingTooDeep (a Result, no SO).
    match DynamicValue.fromCanonicalJson (jsonAt 256) with
    | Ok _ -> ()
    | Error e -> Assert.Fail($"input at the bound should decode Ok, got {e}")

    Assert.Equal(Error DecodeError.NestingTooDeep, DynamicValue.fromCanonicalJson (jsonAt 257))

// ── IDEMPOTENT DECODE: any input that decodes Ok must re-encode → re-decode to the SAME
//    value (a fuzzer-found hostile-but-decodable input is still a stable round-trip). ──

[<Property(MaxTest = 2000)>]
let ``Fuzz: JSON inputs that decode Ok are stable under decode∘encode∘decode`` (NonNull (s: string)) =
    match DynamicValue.fromCanonicalJson s with
    | Ok dv ->
        match DynamicValue.toCanonicalJson dv with
        | Ok re ->
            match DynamicValue.fromCanonicalJson re with
            | Ok dv2 -> dv2 = dv
            | Error _ -> false
        | Error _ -> false
    | Error _ -> true // didn't decode → nothing to check (totality is the other property)
