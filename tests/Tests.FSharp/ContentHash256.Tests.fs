module Zeta.Tests.ContentHash256Tests

open global.Xunit
open Zeta.Core
open Zeta.Core.FSharp.Blake3

module C256 = Zeta.Core.FSharp.Blake3.ContentHash256

let ofBytes bytes =
    System.Runtime.CompilerServices.RuntimeHelpers.RunClassConstructor(typeof<OwnBlake3Hasher>.TypeHandle)
    C256.ofBytes bytes

[<Fact>]
let ``ContentHash256 known-answer: empty input is the full raw BLAKE3-256 digest (no reversal)`` () =
    // BLAKE3("") full 256-bit digest, raw byte order:
    let h = ofBytes [||]
    Assert.Equal(32, h.Raw.Length)
    Assert.Equal("af1349b9f5f9a1a6a0404dea36dcc9499bcb25c9adc112b7cc9a93cae41f3262", h.ToHex())

[<Fact>]
let ``the 128-bit ContentAddress128 is DERIVABLE from the full ContentHash256 (lower 16 bytes LE)`` () =
    // empty input: lower 16 bytes of the raw digest, read LE => the 128-bit treaty value
    let addr = C256.toContentAddress128 (ofBytes [||])
    Assert.Equal("49c9dc36ea4d40a0a6a1f9f5b94913af", addr.ToHex())

[<Fact>]
let ``derived 128 matches the standalone Blake3Hasher 128 for arbitrary input (tiers agree)`` () =
    let bytes = [| 5uy; 6uy; 7uy; 8uy; 9uy |]
    let derived = C256.toContentAddress128 (ofBytes bytes)
    let standalone = Blake3Hasher.hasher.Hash bytes
    Assert.Equal(derived, standalone) // the compact handle is verifiable against the full digest

[<Fact>]
let ``ContentHash256 equality is by content; deterministic`` () =
    let bytes = [| 1uy; 2uy; 3uy |]
    Assert.Equal<ContentHash256>(ofBytes bytes, ofBytes bytes)
    Assert.NotEqual<ContentHash256>(ofBytes bytes, ofBytes [| 1uy; 2uy; 4uy |])
