module Zeta.Tests.ProtobufSwapTests

open System.IO
open System.Collections.Immutable
open Google.Protobuf
open global.Xunit
open Zeta.Core

module PB = Zeta.Core.Protobuf

// ═══════════════════════════════════════════════════════════════════
// Protobuf HEXAGONAL SWAP conformance — proof that the vendored protobuf lib (Google.Protobuf,
// the prost-equivalent on .NET) produces BYTE-IDENTICAL wire output to our hand-rolled wire
// codec. So `Google.Protobuf` could swap in behind toProto/fromProto without changing a single
// downstream byte — the "hexagonal it like other deps so we can replace it later" guarantee,
// verified, not asserted. Google.Protobuf is a TEST-ONLY dependency (never in production Core).
// ═══════════════════════════════════════════════════════════════════

/// Bytes produced by the vendored Google.Protobuf low-level wire writer (no codegen needed).
let private googleBytes (write: CodedOutputStream -> unit) : byte[] =
    use ms = new MemoryStream()
    use cos = new CodedOutputStream(ms)
    write cos
    cos.Flush()
    ms.ToArray()

/// Bytes produced by OUR codec for a single-field message.
let private ours (schema: PB.ProtoSchema) (field: string * DynamicValue) : byte[] =
    match PB.toProto schema (DynamicValue.Object [ field ]) with
    | Ok b -> b
    | Error e -> failwith e

[<Fact>]
let ``Swap: our wire == Google.Protobuf for int64 fields`` () =
    let schema = [ 1, "x", PB.PInt64 ]
    for v in [ 150L; 0L; 1L; -1L; 300L; System.Int64.MaxValue; System.Int64.MinValue ] do
        let g = googleBytes (fun cos -> cos.WriteTag(1, WireFormat.WireType.Varint); cos.WriteInt64 v)
        Assert.Equal<byte[]>(g, ours schema ("x", DynamicValue.Int v))

[<Fact>]
let ``Swap: our wire == Google.Protobuf for bool fields`` () =
    let schema = [ 2, "b", PB.PBool ]
    for v in [ true; false ] do
        let g = googleBytes (fun cos -> cos.WriteTag(2, WireFormat.WireType.Varint); cos.WriteBool v)
        Assert.Equal<byte[]>(g, ours schema ("b", DynamicValue.Bool v))

[<Fact>]
let ``Swap: our wire == Google.Protobuf for string fields`` () =
    let schema = [ 3, "s", PB.PString ]
    for v in [ "hello"; ""; "λ-calculus"; "a longer string with spaces" ] do
        let g = googleBytes (fun cos -> cos.WriteTag(3, WireFormat.WireType.LengthDelimited); cos.WriteString v)
        Assert.Equal<byte[]>(g, ours schema ("s", DynamicValue.String v))

[<Fact>]
let ``Swap: our wire == Google.Protobuf for bytes fields`` () =
    let schema = [ 4, "by", PB.PBytes ]
    for v in [ [| 1uy; 2uy; 3uy |]; [||]; Array.init 100 byte ] do
        let g = googleBytes (fun cos -> cos.WriteTag(4, WireFormat.WireType.LengthDelimited); cos.WriteBytes(ByteString.CopyFrom v))
        Assert.Equal<byte[]>(g, ours schema ("by", DynamicValue.Bytes(ImmutableArray.CreateRange v)))

[<Fact>]
let ``Swap: our wire == Google.Protobuf for double fields (fixed64)`` () =
    let schema = [ 5, "d", PB.PDouble ]
    for v in [ 0.0; 1.5; -2.25; 3.141592653589793; System.Double.MaxValue; System.Double.MinValue ] do
        let g = googleBytes (fun cos -> cos.WriteTag(5, WireFormat.WireType.Fixed64); cos.WriteDouble v)
        Assert.Equal<byte[]>(g, ours schema ("d", DynamicValue.Float v))

[<Fact>]
let ``Swap: Google.Protobuf can DECODE what our codec encodes (full round direction)`` () =
    // our encode -> Google decode -> same scalar values (the reverse swap direction)
    let schema = [ 1, "x", PB.PInt64; 3, "s", PB.PString ]
    let obj = DynamicValue.Object [ "x", DynamicValue.Int 42L; "s", DynamicValue.String "ok" ]
    let bytes = match PB.toProto schema obj with Ok b -> b | Error e -> failwith e
    use cis = new CodedInputStream(bytes)
    let mutable x = 0L
    let mutable s = ""
    let mutable go = true
    while go do
        let tag = cis.ReadTag()
        if tag = 0u then go <- false
        else
            match WireFormat.GetTagFieldNumber tag with
            | 1 -> x <- cis.ReadInt64()
            | 3 -> s <- cis.ReadString()
            | _ -> cis.SkipLastField()
    Assert.Equal(42L, x)
    Assert.Equal("ok", s)
