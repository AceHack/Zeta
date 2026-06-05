namespace Zeta.Core

open System
open System.Text

/// **Protobuf — the schema-REQUIRED binary serializer (slice 1, hexagonal).**
///
/// Unlike JSON/CBOR/XML (self-describing) and Arrow (schema-in-IPC), protobuf bytes are
/// meaningless without the `.proto` schema — so proto ↔ `DynamicValue` is **schema-mediated**:
/// a `ProtoSchema` maps field-number ↔ name ↔ type (the registry's "schemas-as-rows" content;
/// composes [[SchemaRegistry]] / [[SchemaEvolution]] — a proto's field add/reserve IS the op
/// vocabulary, its forward-compat IS the unknown-field tolerance below).
///
/// **Hexagonal:** the wire primitives (`Wire`) are the vendored-replaceable surface — a real
/// protobuf library (Google.Protobuf / prost) could swap in behind the same `toProto`/`fromProto`
/// without touching callers. This slice hand-rolls the wire (zero-dep) and covers scalar fields
/// (Int/Bool/String/Bytes); Float (fixed64), repeated (Array), and nested messages (Object) are
/// later slices.
[<RequireQualifiedAccess>]
module Protobuf =

    /// The proto scalar types this slice supports.
    type ProtoType =
        | PInt64
        | PBool
        | PString
        | PBytes

    /// A message schema: ordered (field-number, name, type). Field-numbers are the stable wire
    /// identity (names can be renamed via a migration; numbers must not be reused — proto's rule).
    type ProtoSchema = (int * string * ProtoType) list

    // ── wire primitives (the hexagonal, vendored-replaceable surface) ──
    module Wire =
        /// Encode a uint64 as a base-128 varint (LEB128, little-endian groups).
        let writeVarint (v: uint64) (out: ResizeArray<byte>) : unit =
            let mutable x = v
            let mutable go = true
            while go do
                let b = byte (x &&& 0x7FUL)
                x <- x >>> 7
                if x = 0UL then
                    out.Add b
                    go <- false
                else
                    out.Add(b ||| 0x80uy)

        /// Read a varint at `pos`; returns (value, newPos) or None if truncated.
        let readVarint (bytes: byte[]) (pos: int) : (uint64 * int) option =
            let mutable result = 0UL
            let mutable shift = 0
            let mutable p = pos
            let mutable out = None
            let mutable go = true
            while go do
                if p >= bytes.Length || shift >= 64 then
                    go <- false // truncated / overlong
                else
                    let b = bytes.[p]
                    result <- result ||| (uint64 (b &&& 0x7Fuy) <<< shift)
                    p <- p + 1
                    if b &&& 0x80uy = 0uy then
                        out <- Some(result, p)
                        go <- false
                    else
                        shift <- shift + 7
            out

        /// ZigZag encode/decode (maps signed → unsigned so small magnitudes stay small).
        let zigzag (v: int64) : uint64 = uint64 ((v <<< 1) ^^^ (v >>> 63))
        let unzigzag (u: uint64) : int64 = int64 (u >>> 1) ^^^ -(int64 (u &&& 1UL))

    let private wireTypeOf =
        function
        | PInt64
        | PBool -> 0 // varint
        | PString
        | PBytes -> 2 // length-delimited

    let private fieldByNumber (schema: ProtoSchema) (n: int) =
        schema |> List.tryPick (fun (num, name, ty) -> if num = n then Some(name, ty) else None)

    let private fieldByName (schema: ProtoSchema) (name: string) =
        schema |> List.tryPick (fun (num, n, ty) -> if n = name then Some(num, ty) else None)

    /// Encode a `DynamicValue.Object` to protobuf bytes under `schema`. Fields are emitted in
    /// schema (field-number) order — canonical. Object fields absent from the schema are skipped.
    let toProto (schema: ProtoSchema) (value: DynamicValue) : Result<byte[], string> =
        match value with
        | DynamicValue.Object kvs ->
            let out = ResizeArray<byte>()
            let byName = Map.ofList [ for (k, v) in kvs -> k, v ]
            let mutable err = None
            for (num, name, ty) in schema do
                match Map.tryFind name byName with
                | None -> () // absent field → not emitted (proto optional/default)
                | Some dv ->
                    let tag = uint64 ((num <<< 3) ||| wireTypeOf ty)
                    match ty, dv with
                    | PInt64, DynamicValue.Int i ->
                        Wire.writeVarint tag out
                        Wire.writeVarint (uint64 i) out
                    | PBool, DynamicValue.Bool b ->
                        Wire.writeVarint tag out
                        Wire.writeVarint (if b then 1UL else 0UL) out
                    | PString, DynamicValue.String s ->
                        Wire.writeVarint tag out
                        let bs = Encoding.UTF8.GetBytes s
                        Wire.writeVarint (uint64 bs.Length) out
                        out.AddRange bs
                    | PBytes, DynamicValue.Bytes bs ->
                        Wire.writeVarint tag out
                        let arr = Seq.toArray bs
                        Wire.writeVarint (uint64 arr.Length) out
                        out.AddRange arr
                    | _ -> err <- Some(sprintf "field '%s' value does not match schema type" name)
            match err with
            | Some e -> Error e
            | None -> Ok(out.ToArray())
        | _ -> Error "toProto requires a DynamicValue.Object"

    /// Decode protobuf bytes to a `DynamicValue.Object` under `schema`. Unknown field-numbers are
    /// SKIPPED (proto forward-compatibility — an old reader tolerates new fields). Total: a clean
    /// Error on a truncated/malformed stream, never an exception.
    let fromProto (schema: ProtoSchema) (bytes: byte[]) : Result<DynamicValue, string> =
        let fields = ResizeArray<string * DynamicValue>()
        let mutable pos = 0
        let mutable err = None
        while err.IsNone && pos < bytes.Length do
            match Wire.readVarint bytes pos with
            | None -> err <- Some "truncated tag"
            | Some (tag, p1) ->
                let num = int (tag >>> 3)
                let wt = int (tag &&& 0x7UL)
                match wt with
                | 0 -> // varint
                    match Wire.readVarint bytes p1 with
                    | None -> err <- Some "truncated varint value"
                    | Some (v, p2) ->
                        (match fieldByNumber schema num with
                         | Some (name, PInt64) -> fields.Add(name, DynamicValue.Int(int64 v))
                         | Some (name, PBool) -> fields.Add(name, DynamicValue.Bool(v <> 0UL))
                         | Some (name, _) -> err <- Some(sprintf "wire type 0 does not match schema for field %d" num)
                         | None -> ()) // unknown field → skip
                        pos <- p2
                | 2 -> // length-delimited
                    match Wire.readVarint bytes p1 with
                    | None -> err <- Some "truncated length"
                    | Some (len, p2) ->
                        let len = int len
                        if len < 0 || p2 + len > bytes.Length then err <- Some "length exceeds buffer"
                        else
                            let payload = bytes.[p2 .. p2 + len - 1]
                            (match fieldByNumber schema num with
                             | Some (name, PString) -> fields.Add(name, DynamicValue.String(Encoding.UTF8.GetString payload))
                             | Some (name, PBytes) -> fields.Add(name, DynamicValue.Bytes(System.Collections.Immutable.ImmutableArray.CreateRange payload))
                             | Some (name, _) -> err <- Some(sprintf "wire type 2 does not match schema for field %d" num)
                             | None -> ()) // unknown field → skip
                            pos <- p2 + len
                | _ -> err <- Some(sprintf "unsupported wire type %d (slice 1: varint + length-delimited only)" wt)
        match err with
        | Some e -> Error e
        | None -> Ok(DynamicValue.Object(List.ofSeq fields))
