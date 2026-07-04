/// **DynamicValue ↔ Apache Arrow IPC codec — the SHREDDED NODE-TABLE encoding.**
///
/// Encodes an arbitrary `DynamicValue` tree as ONE Arrow `RecordBatch` — a flat
/// node table in DFS pre-order, one row per tree node. This is columnar (Arrow's
/// strength) and round-trips arbitrary recursive/heterogeneous trees WITHOUT
/// Arrow's (unsupported) recursive/self-referential schemas: recursion is carried
/// in a `parent` column (the adjacency-list shredding used by Dremel/Parquet for
/// nested data, flattened to a node table rather than rep/def levels).
///
/// The encoding is **never-collapse-free**: an empty `Array`, an empty `Object`,
/// and `Null` are distinct `kind` tags, so no two distinct shapes share a row —
/// the same faithfulness the CBOR codec guarantees.
///
/// Columns (all the same length = node count):
///   - `kind`  : Int8,    NOT null — 0=Null 1=Bool 2=Int 3=Float 4=String 5=Bytes 6=Array 7=Object
///   - `parent`: Int32,   NOT null — row index of the parent node; -1 for the root (row 0)
///   - `key`   : Utf8,    NULLABLE — for an Object ENTRY's value node, its key; null otherwise
///   - `b`     : Boolean, NULLABLE — set iff kind=Bool
///   - `i`     : Int64,   NULLABLE — set iff kind=Int
///   - `f`     : Float64, NULLABLE — set iff kind=Float (Arrow Double preserves the bit pattern, incl NaN/-0.0/±Inf)
///   - `s`     : Utf8,    NULLABLE — set iff kind=String
///   - `by`    : Binary,  NULLABLE — set iff kind=Bytes
///
/// Mirrors `ArrowSerializer.fs`'s API style (RecordBatch + ArrowStreamWriter/Reader
/// over `Apache.Arrow` + `Apache.Arrow.Ipc`). Reuses `DynamicValue.DecodeError`
/// (the `MalformedArrow` case). Phase 1 of the Arrow serializer.
module Zeta.Core.DynamicValueArrow

open System
open System.Collections.Generic
open System.Collections.Immutable
open System.IO
open Apache.Arrow
open Apache.Arrow.Ipc
open Apache.Arrow.Types
open Zeta.Core

// kind tags — keep in sync with the schema doc above.
[<Literal>]
let private KindNull = 0y
[<Literal>]
let private KindBool = 1y
[<Literal>]
let private KindInt = 2y
[<Literal>]
let private KindFloat = 3y
[<Literal>]
let private KindString = 4y
[<Literal>]
let private KindBytes = 5y
[<Literal>]
let private KindArray = 6y
[<Literal>]
let private KindObject = 7y

/// The fixed node-table schema (8 columns; `kind`/`parent` non-null, the rest nullable).
let private schema =
    let fields =
        [| Field("kind", Int8Type.Default, nullable = false)
           Field("parent", Int32Type.Default, nullable = false)
           Field("key", StringType.Default, nullable = true)
           Field("b", BooleanType.Default, nullable = true)
           Field("i", Int64Type.Default, nullable = true)
           Field("f", DoubleType.Default, nullable = true)
           Field("s", StringType.Default, nullable = true)
           Field("by", BinaryType.Default, nullable = true) |]

    Schema(fields, null)

// ── ENCODE ──────────────────────────────────────────────────────────────

let private lockObj = obj()

/// Serialize a `DynamicValue` to Arrow IPC stream bytes (one RecordBatch over
/// the node table). DFS pre-order: the root is row 0 (parent -1, key null); an
/// Array recurses its children in order (key null); an Object recurses each
/// value child in order with its key set. Container nodes carry no scalar payload.
let toArrow (value: DynamicValue) : Result<byte[], EncodeError> =
    lock lockObj (fun () ->
        let kindB = Int8Array.Builder()
        let parentB = Int32Array.Builder()
        let keyB = StringArray.Builder()
        let bB = BooleanArray.Builder()
        let iB = Int64Array.Builder()
        let fB = DoubleArray.Builder()
        let sB = StringArray.Builder()
        let byB = BinaryArray.Builder()

        // emit one row; returns its row index (= the count BEFORE this append)
        let mutable count = 0

        let emit (kind: sbyte) (parent: int) (key: string option) =
            kindB.Append kind |> ignore
            parentB.Append parent |> ignore

            match key with
            | Some k -> keyB.Append k |> ignore
            | None -> keyB.AppendNull() |> ignore
            // scalar payload columns default to null; the caller fills the one that applies
            let row = count
            count <- count + 1
            row

        // fill the scalar columns for the current row: null everywhere except the live one
        let fillBool (v: bool) =
            bB.Append v |> ignore
            iB.AppendNull() |> ignore
            fB.AppendNull() |> ignore
            sB.AppendNull() |> ignore
            byB.AppendNull() |> ignore

        let fillInt (v: int64) =
            bB.AppendNull() |> ignore
            iB.Append v |> ignore
            fB.AppendNull() |> ignore
            sB.AppendNull() |> ignore
            byB.AppendNull() |> ignore

        let fillFloat (v: float) =
            bB.AppendNull() |> ignore
            iB.AppendNull() |> ignore
            fB.Append v |> ignore
            sB.AppendNull() |> ignore
            byB.AppendNull() |> ignore

        let fillString (v: string) =
            bB.AppendNull() |> ignore
            iB.AppendNull() |> ignore
            fB.AppendNull() |> ignore
            sB.Append(if isNull v then "" else v) |> ignore
            byB.AppendNull() |> ignore

        let fillBytes (v: ImmutableArray<byte>) =
            let payload = if v.IsDefault then ImmutableArray<byte>.Empty else v
            bB.AppendNull() |> ignore
            iB.AppendNull() |> ignore
            fB.AppendNull() |> ignore
            sB.AppendNull() |> ignore
            byB.Append(payload.AsSpan()) |> ignore

        let fillNone () =
            bB.AppendNull() |> ignore
            iB.AppendNull() |> ignore
            fB.AppendNull() |> ignore
            sB.AppendNull() |> ignore
            byB.AppendNull() |> ignore

        // recurse: append `v` as a node with the given parent + optional key
        let rec write (depth: int) (parent: int) (key: string option) (v: DynamicValue) : Result<unit, EncodeError> =
            if depth > DynamicValue.maxNestingDepth then
                Error EncodeError.NestingTooDeep
            else
                match v with
                | DynamicValue.Null ->
                    emit KindNull parent key |> ignore
                    fillNone ()
                    Ok()
                | DynamicValue.Bool b ->
                    emit KindBool parent key |> ignore
                    fillBool b
                    Ok()
                | DynamicValue.Int i ->
                    emit KindInt parent key |> ignore
                    fillInt i
                    Ok()
                | DynamicValue.Float f ->
                    emit KindFloat parent key |> ignore
                    fillFloat f
                    Ok()
                | DynamicValue.String s ->
                    emit KindString parent key |> ignore
                    fillString s
                    Ok()
                | DynamicValue.Bytes by ->
                    emit KindBytes parent key |> ignore
                    fillBytes by
                    Ok()
                | DynamicValue.Array items ->
                    let me = emit KindArray parent key
                    fillNone ()

                    items
                    |> List.fold (fun acc item ->
                        acc |> Result.bind (fun () -> write (depth + 1) me None item)
                    ) (Ok())
                | DynamicValue.Object pairs ->
                    let me = emit KindObject parent key
                    fillNone ()

                    pairs
                    |> List.fold (fun acc (k, value) ->
                        acc |> Result.bind (fun () -> write (depth + 1) me (Some k) value)
                    ) (Ok())

        match write 0 -1 None value with
        | Error e -> Error e
        | Ok() ->
            let columns: IArrowArray[] =
                [| kindB.Build()
                   parentB.Build()
                   keyB.Build()
                   bB.Build()
                   iB.Build()
                   fB.Build()
                   sB.Build()
                   byB.Build() |]

            use batch = new RecordBatch(schema, columns, count)
            use ms = new MemoryStream()
            use writer = new ArrowStreamWriter(ms, schema)
            writer.WriteRecordBatch batch
            writer.WriteEnd()
            Ok(ms.ToArray())
    )

/// Exposes a way to cleanly unwrap the Arrow encode result for low-depth invariants in calling/test code.
let toArrowOk (value: DynamicValue) : byte[] =
    match toArrow value with
    | Ok bytes -> bytes
    | Error e -> failwithf "toArrow failed on low-depth invariant: %A" e

// ── DECODE ──────────────────────────────────────────────────────────────

/// Deserialize Arrow IPC stream bytes back into a `DynamicValue` — the inverse
/// of `toArrow`. Reads the single RecordBatch, reconstructs each node from
/// kind+payload, and attaches children to their parent in row order (which
/// preserves sibling order; Object children carry their `key`). Validates
/// structure (parent in range / forms a tree rooted at row 0, kind valid,
/// payload present for the kind) → `DecodeError.MalformedArrow` otherwise.
/// Never throws: any Apache.Arrow read failure is caught and surfaced as data.
let fromArrow (bytes: byte[]) : Result<DynamicValue, DecodeError> =
    lock lockObj (fun () ->
        try
            use ms = new MemoryStream(bytes)
            use reader = new ArrowStreamReader(ms)
            let batch = reader.ReadNextRecordBatch()

            if isNull batch then
                Error DecodeError.MalformedArrow
            else
                use _ = batch

                match batch.Column 0, batch.Column 1, batch.Column 2,
                      batch.Column 3, batch.Column 4, batch.Column 5,
                      batch.Column 6, batch.Column 7 with
                | (:? Int8Array as kindArr),
                  (:? Int32Array as parentArr),
                  (:? StringArray as keyArr),
                  (:? BooleanArray as bArr),
                  (:? Int64Array as iArr),
                  (:? DoubleArray as fArr),
                  (:? StringArray as sArr),
                  (:? BinaryArray as byArr) ->
                    let n = batch.Length

                    if n = 0 then
                        // a node table always has >= 1 row (the root); zero rows is malformed
                        Error DecodeError.MalformedArrow
                    else
                        // children, by parent row index, in row (append) order
                        let children = Array.init n (fun _ -> ResizeArray<int>())
                        let mutable err = false

                        let mutable ri = 0

                        while ri < n && not err do
                            let p = parentArr.GetValue ri

                            if ri = 0 then
                                // root must be parent = -1
                                if not (p.HasValue && p.Value = -1) then err <- true
                            else
                                // non-root parent must be a valid EARLIER row (DFS pre-order ⇒ parent < child)
                                if not (p.HasValue && p.Value >= 0 && p.Value < ri) then
                                    err <- true
                                else
                                    children.[p.Value].Add ri

                            ri <- ri + 1

                        if err then
                            Error DecodeError.MalformedArrow
                        else
                            // build each node bottom-up via the children adjacency; recursion is
                            // bounded by n (a valid tree) and parent < child guarantees acyclicity.
                            let rec build (depth: int) (row: int) : Result<DynamicValue, DecodeError> =
                                if depth > DynamicValue.maxNestingDepth then
                                    Error DecodeError.NestingTooDeep
                                else
                                    let kindOpt = kindArr.GetValue row

                                    if not kindOpt.HasValue then
                                        Error DecodeError.MalformedArrow
                                    else
                                        match kindOpt.Value with
                                        | k when k = KindNull -> Ok DynamicValue.Null
                                        | k when k = KindBool ->
                                            let v = bArr.GetValue row
                                            if v.HasValue then Ok(DynamicValue.Bool v.Value) else Error DecodeError.MalformedArrow
                                        | k when k = KindInt ->
                                            let v = iArr.GetValue row
                                            if v.HasValue then Ok(DynamicValue.Int v.Value) else Error DecodeError.MalformedArrow
                                        | k when k = KindFloat ->
                                            let v = fArr.GetValue row
                                            if v.HasValue then Ok(DynamicValue.Float v.Value) else Error DecodeError.MalformedArrow
                                        | k when k = KindString ->
                                            let v = sArr.GetString row
                                            if isNull v then Error DecodeError.MalformedArrow else Ok(DynamicValue.String v)
                                        | k when k = KindBytes ->
                                            if byArr.IsNull row then
                                                Error DecodeError.MalformedArrow
                                            else
                                                let span = byArr.GetBytes row
                                                Ok(DynamicValue.Bytes(ImmutableArray.Create<byte>(span.ToArray())))
                                        | k when k = KindArray ->
                                            let kids = children.[row]
                                            let acc = ResizeArray<DynamicValue>(kids.Count)
                                            let mutable e: DecodeError option = None
                                            let mutable ci = 0

                                            while ci < kids.Count && e.IsNone do
                                                match build (depth + 1) kids.[ci] with
                                                | Ok child -> acc.Add child
                                                | Error de -> e <- Some de

                                                ci <- ci + 1

                                            match e with
                                            | Some de -> Error de
                                            | None -> Ok(DynamicValue.Array(List.ofSeq acc))
                                        | k when k = KindObject ->
                                            let kids = children.[row]
                                            let acc = ResizeArray<string * DynamicValue>(kids.Count)
                                            let mutable e: DecodeError option = None
                                            let mutable ci = 0

                                            while ci < kids.Count && e.IsNone do
                                                let childRow = kids.[ci]
                                                let key = keyArr.GetString childRow

                                                if isNull key then
                                                    // an Object entry value must carry its key
                                                    e <- Some DecodeError.MalformedArrow
                                                else
                                                    match build (depth + 1) childRow with
                                                    | Ok child -> acc.Add(key, child)
                                                    | Error de -> e <- Some de

                                                ci <- ci + 1

                                            match e with
                                            | Some de -> Error de
                                            | None -> Ok(DynamicValue.Object(List.ofSeq acc))
                                        | _ -> Error DecodeError.MalformedArrow

                            build 0 0
                | _ -> Error DecodeError.MalformedArrow
        with _ ->
            Error DecodeError.MalformedArrow
    )
