module Zeta.Tests.Asn1DerTests

// THE ASN.1 DER CODEC — the first 2-ary value-tree codec, our-own from the start
// (shadow*, Aaron 2026-07-02: "ASN.1 is very important in like ANSI standards DLMS COSEM
// standards for meters and other low level hardware specific formats for constrained
// devices … no supply chain that is not us"; "yes on next slice").
//
// DER (X.690) is a tag-length-value grammar, so we own it with NO external library
// (Provenance = Ours immediately). The TAG is the second channel (type/attribute axis)
// beside the VALUE — the 2-ary shape. Proofs:
//   1. ROUND-TRIP over the native 7 shapes incl. edge cases: big/negative INTEGER minimal
//      form, empty collections, a >127-byte string exercising LONG-FORM length.
//   2. THE 2-ARY COLUMN JOINS the agreement — crossVerify [parity json; cbor; parity yaml;
//      parity asn1] is empty on the FULL eight-shape tree (ASN.1 agrees with the 1-ary lenses).
//   3. Float is ASN.1's parity debt (native Error), closed by `parity` — consistent with JSON.
//   4. DER BYTE-LOCK spot checks as TEXT hex (no-binary-in-proof-lineage): canonical bytes
//      for Null / Bool / small+negative INTEGER match X.690.
//
// Anchors: ITU-T X.690 (BER/CER/DER); IEC 62056 (DLMS/COSEM); RFC 4648 (base64, via parity).

open global.Xunit
open Zeta.Core

module VTC = ValueTreeCodec

let private bytesOf (arr: byte list) =
    DynamicValue.Bytes(System.Collections.Immutable.ImmutableArray.CreateRange<byte>(arr))

let private hex (b: byte[]) : string =
    System.Convert.ToHexString(b).ToLowerInvariant()

/// Native tree: the 7 shapes ASN.1 carries directly (no Float), with edge cases.
let private nativeTree: DynamicValue =
    DynamicValue.Object
        [ "null", DynamicValue.Null
          "true", DynamicValue.Bool true
          "false", DynamicValue.Bool false
          "zero", DynamicValue.Int 0L
          "neg", DynamicValue.Int -1L
          "negbig", DynamicValue.Int -123456789012345L
          "big", DynamicValue.Int 0x0123456789ABCDEFL
          "min", DynamicValue.Int System.Int64.MinValue
          "max", DynamicValue.Int System.Int64.MaxValue
          "str", DynamicValue.String "ζ meter — DLMS/COSEM"
          "long", DynamicValue.String(System.String('x', 200)) // > 127 ⇒ long-form length
          "bytes", bytesOf [ 0uy; 1uy; 0x7Fuy; 0x80uy; 0xFFuy ]
          "emptyArr", DynamicValue.Array []
          "emptyObj", DynamicValue.Object []
          "arr", DynamicValue.Array [ DynamicValue.Int 1L; DynamicValue.String "two"; DynamicValue.Bool false ]
          "nested", DynamicValue.Object [ "k", DynamicValue.Array [ DynamicValue.Null; bytesOf [ 0xDEuy; 0xADuy ] ] ] ]

[<Fact>]
let ``ASN.1 DER round-trips the native seven shapes, incl. minimal/negative INTEGER, empty collections, long-form length`` () =
    Assert.True(VTC.isFaithful VTC.asn1 nativeTree, "asn1 must round-trip the native tree")
    // spot-check the hard integers individually
    for n in [ 0L; -1L; 127L; 128L; 255L; 256L; -128L; -129L; System.Int64.MinValue; System.Int64.MaxValue ] do
        Assert.True(VTC.isFaithful VTC.asn1 (DynamicValue.Int n), sprintf "asn1 INTEGER %d must round-trip" n)

[<Fact>]
let ``the 2-ary column JOINS the agreement: parity-asn1 cross-verifies with the 1-ary lenses on the full tree`` () =
    // The full eight-shape tree (Float included) crosses json/cbor/yaml/asn1 identically —
    // ASN.1 (2-ary, tag⊕value) agrees with the 1-ary value trees. `parity` closes ASN.1's
    // Float debt the same uniform way it closes JSON's.
    let fullTree =
        DynamicValue.Object
            [ "meter", DynamicValue.String "COSEM"
              "reading", DynamicValue.Float 240.7
              "raw", bytesOf [ 0x01uy; 0x02uy ]
              "count", DynamicValue.Int -5L
              "ok", DynamicValue.Bool true
              "extra", DynamicValue.Null
              "series", DynamicValue.Array [ DynamicValue.Float 1.5; DynamicValue.Int 2L ] ]
    let codecs = [ VTC.parity VTC.json; VTC.cbor; VTC.parity VTC.yaml; VTC.parity VTC.asn1 ]
    Assert.Empty(VTC.crossVerify codecs fullTree)
    Assert.True(VTC.isFaithful (VTC.parity VTC.asn1) fullTree)

[<Fact>]
let ``ASN.1 Float is parity debt (native Error), closed by parity — consistent with JSON`` () =
    Assert.False(VTC.isFaithful VTC.asn1 (DynamicValue.Float 3.14))
    match VTC.asn1.Encode(DynamicValue.Float 3.14) with
    | Error _ -> ()
    | Ok _ -> Assert.Fail "asn1 must refuse native Float (parity debt), not silently mis-encode"
    Assert.True(VTC.isFaithful (VTC.parity VTC.asn1) (DynamicValue.Float 3.14))

[<Fact>]
let ``ASN.1 is Provenance.Ours and 2-ary (tag ⊕ value) — zero external supply chain`` () =
    Assert.Equal(VTC.Provenance.Ours, VTC.asn1.Provenance)
    Assert.Equal(2, VTC.asn1.Arity)

[<Fact>]
let ``DER BYTE-LOCK (text hex, no-binary-in-proof-lineage): canonical bytes match X.690`` () =
    let enc dv =
        match VTC.asn1.Encode dv with
        | Ok b -> hex b
        | Error e -> failwithf "encode failed: %s" e
    Assert.Equal("0500", enc DynamicValue.Null) // NULL
    Assert.Equal("0101ff", enc (DynamicValue.Bool true)) // BOOLEAN true = 0xFF (DER)
    Assert.Equal("010100", enc (DynamicValue.Bool false)) // BOOLEAN false
    Assert.Equal("020100", enc (DynamicValue.Int 0L)) // INTEGER 0
    Assert.Equal("0201ff", enc (DynamicValue.Int -1L)) // INTEGER -1
    Assert.Equal("02017f", enc (DynamicValue.Int 127L)) // INTEGER 127 (one octet)
    Assert.Equal("02020080", enc (DynamicValue.Int 128L)) // INTEGER 128 needs a leading 0x00 (sign)
    Assert.Equal("020180", enc (DynamicValue.Int -128L)) // INTEGER -128 (one octet)
    Assert.Equal("0403414243", enc (bytesOf [ 0x41uy; 0x42uy; 0x43uy ])) // OCTET STRING "ABC"

[<Fact>]
let ``HOSTILE INPUT: decode is TOTAL — malformed DER yields Error, never an exception (nation-state hardening)`` () =
    // A parser on untrusted bytes must never crash. Each crafted stream exploits a
    // different decoder weakness; all must return Error, and — critically — NONE may throw.
    let hostile: (string * byte[]) list =
        [ "empty input", [||]
          "indefinite length (not DER)", [| 0x30uy; 0x80uy |]
          "long-form length overflow (84 FF FF FF FF → negative)", [| 0x04uy; 0x84uy; 0xFFuy; 0xFFuy; 0xFFuy; 0xFFuy |]
          "length octets > 4", [| 0x04uy; 0x85uy; 0x01uy; 0x00uy; 0x00uy; 0x00uy; 0x00uy |]
          "content length exceeds input", [| 0x0Cuy; 0x0Auy; 0x41uy |] // UTF8String claims 10, has 1
          "huge positive length claim, truncated", [| 0x0Cuy; 0x84uy; 0x7Fuy; 0xFFuy; 0xFFuy; 0xFFuy |]
          "INTEGER exceeds 8 octets", [| 0x02uy; 0x09uy; 1uy; 2uy; 3uy; 4uy; 5uy; 6uy; 7uy; 8uy; 9uy |]
          "NULL with nonzero length", [| 0x05uy; 0x01uy; 0x00uy |]
          "BOOLEAN wrong length", [| 0x01uy; 0x02uy; 0x00uy; 0xFFuy |]
          "unsupported tag", [| 0x99uy; 0x00uy |]
          "trailing bytes", [| 0x05uy; 0x00uy; 0x05uy; 0x00uy |]
          "truncated length octet", [| 0x04uy; 0x82uy; 0x01uy |]
          "malformed object entry (obj holding a bare NULL)", [| 0xA0uy; 0x02uy; 0x05uy; 0x00uy |] ]
    for (name, bytes) in hostile do
        let result =
            try
                Asn1Der.decode bytes
            with ex ->
                Assert.Fail(sprintf "decode THREW on '%s': %s" name ex.Message)
                Error "unreachable"
        Assert.True((match result with Error _ -> true | Ok _ -> false), sprintf "'%s' must be rejected (Error)" name)

[<Fact>]
let ``HOSTILE INPUT: deeply-nested DER is refused at the depth ceiling, not a stack overflow`` () =
    // A hostile stream of thousands of nested SEQUENCEs would blow the stack without a
    // depth guard. Encode a nest past the ceiling and confirm decode returns Error (no SO);
    // a nest well under the ceiling still round-trips.
    let rec nest n =
        if n = 0 then DynamicValue.Null else DynamicValue.Array [ nest (n - 1) ]
    // under the ceiling → faithful
    Assert.True(VTC.isFaithful VTC.asn1 (nest 100))
    // past the ceiling → clean Error, never a crash
    match VTC.asn1.Encode(nest 600) |> Result.bind (fun b -> Asn1Der.decode b) with
    | Error _ -> ()
    | Ok _ -> Assert.Fail "600-deep nesting should be refused at the depth ceiling"
