module Zeta.Tests.ProtobufTests

open System.Collections.Immutable
open global.Xunit
open FsCheck
open FsCheck.FSharp
open FsCheck.Xunit
open Zeta.Core

module PB = Zeta.Core.Protobuf

// ═══════════════════════════════════════════════════════════════════
// Protobuf (slice 1) — the schema-REQUIRED binary serializer. Proves the wire primitives,
// the schema-mediated DynamicValue ↔ proto round-trip, the canonical proto known-answer, the
// forward-compat (unknown field-numbers skipped = the SchemaEvolution tolerance), and totality.
// ═══════════════════════════════════════════════════════════════════

let private schema : PB.ProtoSchema =
    [ 1, "id", PB.PInt64; 2, "active", PB.PBool; 3, "name", PB.PString; 4, "blob", PB.PBytes ]

let private asMap =
    function
    | DynamicValue.Object kvs -> Map.ofList kvs
    | _ -> Map.empty

// ── wire primitives ──

[<Property>]
let ``Protobuf: varint round-trips for any uint64`` (v: uint64) =
    let out = ResizeArray<byte>()
    PB.Wire.writeVarint v out
    match PB.Wire.readVarint (out.ToArray()) 0 with
    | Some (v2, p) -> v2 = v && p = out.Count
    | None -> false

[<Property>]
let ``Protobuf: zigzag round-trips for any int64`` (v: int64) =
    PB.Wire.unzigzag (PB.Wire.zigzag v) = v

[<Fact>]
let ``Protobuf: canonical known-answer — field 1 int64 = 150 encodes to 08 96 01`` () =
    let obj = DynamicValue.Object [ "a", DynamicValue.Int 150L ]
    match PB.toProto [ 1, "a", PB.PInt64 ] obj with
    | Ok bytes -> Assert.Equal<byte[]>([| 0x08uy; 0x96uy; 0x01uy |], bytes)
    | Error e -> failwith e

// ── schema-mediated round-trip ──

let private genObj : Gen<DynamicValue> =
    gen {
        let! id = Gen.choose (-100000, 100000) |> Gen.map int64
        let! active = Gen.elements [ true; false ]
        let! name = Gen.elements [ "ada"; ""; "λ"; "hello world" ]
        let! blob = Gen.arrayOf (Gen.choose (0, 255) |> Gen.map byte)
        // include a random subset of fields
        let! mask = Gen.choose (0, 15)
        return
            DynamicValue.Object
                [ if mask &&& 1 <> 0 then "id", DynamicValue.Int id
                  if mask &&& 2 <> 0 then "active", DynamicValue.Bool active
                  if mask &&& 4 <> 0 then "name", DynamicValue.String name
                  if mask &&& 8 <> 0 then "blob", DynamicValue.Bytes(ImmutableArray.CreateRange blob) ]
    }

type ObjArb() =
    static member O() = Arb.fromGen genObj

[<Property(Arbitrary = [| typeof<ObjArb> |])>]
let ``Protobuf: DynamicValue.Object round-trips through proto under its schema`` (obj: DynamicValue) =
    match PB.toProto schema obj |> Result.bind (PB.fromProto schema) with
    | Ok obj2 -> asMap obj2 = asMap obj
    | Error _ -> false

[<Fact>]
let ``Protobuf: double (fixed64) fields round-trip`` () =
    let s : PB.ProtoSchema = [ 5, "d", PB.PDouble ]
    for v in [ 0.0; 1.5; -2.25; 3.141592653589793; System.Double.MaxValue ] do
        let obj = DynamicValue.Object [ "d", DynamicValue.Float v ]
        match PB.toProto s obj |> Result.bind (PB.fromProto s) with
        | Ok (DynamicValue.Object [ "d", DynamicValue.Float v2 ]) -> Assert.Equal(v, v2)
        | other -> failwithf "double round-trip failed: %A" other

[<Fact>]
let ``Protobuf: nested messages round-trip (recursive, multi-level)`` () =
    let inner : PB.ProtoSchema = [ 10, "a", PB.PInt64; 11, "s", PB.PString ]
    let mid : PB.ProtoSchema = [ 1, "id", PB.PInt64; 2, "inner", PB.PMessage inner ]
    let outer : PB.ProtoSchema = [ 1, "tag", PB.PString; 2, "mid", PB.PMessage mid ]
    let obj =
        DynamicValue.Object
            [ "tag", DynamicValue.String "root"
              "mid", DynamicValue.Object
                  [ "id", DynamicValue.Int 99L
                    "inner", DynamicValue.Object [ "a", DynamicValue.Int 7L; "s", DynamicValue.String "deep" ] ] ]
    match PB.toProto outer obj |> Result.bind (PB.fromProto outer) with
    | Ok roundtripped -> Assert.Equal(obj, roundtripped)
    | Error e -> failwith e

// ── forward compatibility: an old reader skips fields it doesn't know ──

[<Fact>]
let ``Protobuf: an old reader (narrower schema) skips unknown fields (forward compat)`` () =
    let full : PB.ProtoSchema = [ 1, "a", PB.PInt64; 2, "b", PB.PString ]
    let old : PB.ProtoSchema = [ 1, "a", PB.PInt64 ] // doesn't know field 2
    let obj = DynamicValue.Object [ "a", DynamicValue.Int 7L; "b", DynamicValue.String "new" ]
    match PB.toProto full obj |> Result.bind (PB.fromProto old) with
    | Ok (DynamicValue.Object kvs) ->
        Assert.Equal<(string * DynamicValue) list>([ "a", DynamicValue.Int 7L ], kvs) // b skipped, a recovered
    | other -> failwithf "expected {a=7}, got %A" other

// ── totality: malformed / truncated bytes → clean Error, never an exception ──

[<Property>]
let ``Protobuf: fromProto is total on arbitrary bytes (never throws)`` (bytes: byte[]) =
    let b = if isNull (box bytes) then [||] else bytes
    try
        PB.fromProto schema b |> ignore
        true
    with _ ->
        false

[<Fact>]
let ``Protobuf: a truncated value is a clean Error`` () =
    Assert.True(match PB.fromProto schema [| 0x08uy |] with Error _ -> true | _ -> false)          // tag, no varint
    Assert.True(match PB.fromProto schema [| 0x1Auy; 0x05uy; 0x61uy |] with Error _ -> true | _ -> false) // len=5, 1 byte
