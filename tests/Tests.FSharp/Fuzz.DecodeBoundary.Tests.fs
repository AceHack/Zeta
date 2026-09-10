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

/// WHICH of the three outcomes occurred. This replaces a `completesWithin ms (isTotal ...)`
/// composition that collapsed two distinct bugs into one `false`.
///
/// That pair returned `false` both for a decoder that THREW (a totality violation) and
/// for one that HUNG (a pre-allocation DoS), so every assertion built on it could only
/// say "hung or threw" -- accurate, and unactionable. `completesWithin` had no other
/// caller and is gone; `isTotal` remains for the budget-free property tests. That mattered on 2026-09-08: `Fuzz: Arrow garbage + truncated-header
/// inputs are rejected fast` failed on windows-11-arm on main and the message could
/// not say whether the decoder had blown a 2 s budget or thrown. The two call for
/// opposite responses -- a slow decode wants more budget, a throw wants a decoder
/// fix -- so raising the budget without knowing which would risk hiding the bug the
/// test exists to catch.
type private DecodeOutcome =
    | Total
    | Threw of string
    | HungPast of int

let private decodeOutcome (ms: int) (decode: unit -> Result<'a, DecodeError>) : DecodeOutcome =
    let work =
        Task.Run(fun () ->
            try
                decode () |> ignore
                None
            with e ->
                Some(e.GetType().Name + ": " + e.Message))
    if work.Wait ms then
        match work.Result with
        | None -> Total
        | Some detail -> Threw detail
    else
        HungPast ms

/// Assert totality under a budget, naming the failure mode rather than the union.
let private assertDecodeTotal (ms: int) (label: string) (decode: unit -> Result<'a, DecodeError>) =
    match decodeOutcome ms decode with
    | Total -> ()
    | Threw detail ->
        Assert.Fail(label + " THREW rather than returning a Result (totality violation): " + detail)
    | HungPast budget ->
        Assert.Fail(sprintf "%s HUNG past %d ms without returning (pre-allocation DoS)" label budget)

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
    assertDecodeTotal 2000 "CBOR array-length bomb" (fun () -> DynamicValue.fromCanonicalCbor bomb)

[<Fact>]
let ``Fuzz: CBOR byte-string-length bomb (claims 2^64-1 bytes, empty body) is rejected fast`` () =
    // 0x5B = major type 2 (byte string), 8-byte length; 0xFF×8 = 2^64-1, no payload.
    let bomb = [| 0x5Buy; 0xFFuy; 0xFFuy; 0xFFuy; 0xFFuy; 0xFFuy; 0xFFuy; 0xFFuy; 0xFFuy |]
    assertDecodeTotal 2000 "CBOR byte-string-length bomb" (fun () -> DynamicValue.fromCanonicalCbor bomb)

[<Fact>]
let ``Fuzz: Arrow garbage + truncated-header inputs are rejected fast`` () =
    let cases =
        [ Array.replicate 64 0xFFuy
          [| 0xFFuy; 0xFFuy; 0xFFuy; 0x7Fuy |] // a huge little-endian length prefix
          "ARROW1"B
          Array.zeroCreate 32 ]
    for bytes in cases do
        // Budget DELIBERATELY unchanged at 2000. This is the case that failed on
        // Windows, and until the message says HUNG or THREW, more time could be
        // hiding a real totality violation rather than absorbing JIT warm-up.
        assertDecodeTotal 2000 "Arrow hostile input" (fun () -> DynamicValueArrow.fromArrow bytes)

// ── DEEP NESTING (moderate depth; the recursion-depth class). Conservative so a robust
//    decoder either handles it (Result) or rejects it — without a process-killing SO. ──

[<Fact>]
let ``Fuzz: deeply-nested JSON arrays decode to a Result without throwing (depth 2000)`` () =
    let depth = 2000
    let json = String.replicate depth "[" + String.replicate depth "]"
    assertDecodeTotal 3000 "deeply-nested JSON" (fun () -> DynamicValue.fromCanonicalJson json)

[<Fact>]
let ``Fuzz: deeply-nested XML elements decode to a Result without throwing (depth 2000)`` () =
    let depth = 2000
    let xml = String.replicate depth "<a>" + String.replicate depth "</a>"
    assertDecodeTotal 3000 "deeply-nested XML" (fun () -> DynamicValue.fromCanonicalXml xml)

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
