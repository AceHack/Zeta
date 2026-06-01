namespace Zeta.Core

open System.Collections.Immutable

/// The runtime type tag of a `DynamicValue` — "what shape are you?" asked of a
/// value with no compile-time type. This is the `QueryInterface` surface of the
/// polymorphic-shape primitive: a caller can branch on the tag without binding
/// to a static type.
[<RequireQualifiedAccess>]
type DynamicValueType =
    | Null
    | Bool
    | Int
    | Float
    | String
    | Bytes
    | Array
    | Object

/// **DynamicValue — the universal self-describing-payload primitive.**
///
/// A self-describing runtime value tree for shapes that are NOT known at compile
/// time (the "Dynamic runtime objects / polymorphic shape" line in
/// `docs/PRIMITIVE-REGISTRY.md`; the Eve-Protocol polymorphic-diplomacy
/// primitive, B-0638). Distinct from the static `ISerializer<'T>` seam in
/// `Serializer.fs` (which is for types known at compile time) and a NEW shape —
/// deliberately not a generalization of the observe oracle's `Json` tree.
///
/// **Target: ANY language/format that is dynamic or self-describing in its
/// payload.** The case set — `Null | Bool | Int | Float | String | Bytes |
/// Array | Object` — is exactly the common self-describing core shared by
/// CBOR (RFC 8949), msgpack, JSON, and YAML, so any self-describing payload
/// parses faithfully into it. Format-specific extras (CBOR semantic tags, BSON
/// dates / ObjectId, decimal128, msgpack ext) are open for extension — added as
/// new variants per format adapter; `typeOf` matches exhaustively with no
/// wildcard, so adding one breaks every consumer loudly rather than silently.
///
/// **Schema-required formats join via a runtime schema registry.** A format that
/// is NOT self-describing (protobuf / Avro / Thrift — shape lives out-of-band)
/// supports this primitive iff a schema registry travels with it: a schema-id in
/// the payload (the Avro/Confluent wire shape: magic byte + schema-id + body, or
/// a protobuf descriptor-set) keys a registry lookup that yields the current
/// shape AT RUNTIME. Because schemas evolve at runtime, you cannot statically
/// bind anyway — so a schema-driven decode produces the SAME runtime
/// `DynamicValue` tree that a self-describing payload would. **Runtime-schema and
/// self-describing fit the same shape.** The registry/schema is a separate port
/// (a `Schema` + `SchemaRegistry` port, "schemas-as-rows") feeding this same
/// `DynamicValue` target — it does not change the value tree, only the decoder
/// that fills it.
///
/// Why a new shape, not `Json`:
///   - `Json` (`src/Core.Rust.Observe/src/json.rs`) is JSON-specialized: one
///     `Number(f64)` case and NO binary. `DynamicValue` distinguishes `Int`
///     (int64) from `Float` (so it carries protobuf int64 / large integers
///     without losing precision past 2^53) and carries native `Bytes` (the type
///     every binary self-describing format — CBOR, msgpack, BSON, Arrow — has and
///     JSON fakes with base64-in-a-string).
///   - `DynamicValue` is format-agnostic by design: it rides the
///     `ISerializer<'T>` seam, so the SAME value model serializes over JSON /
///     XML / YAML / CBOR / msgpack / protobuf / Arrow (each a swappable adapter)
///     — and, per the v8 hidden-shape line, eventually English. It is NOT coupled
///     to any one format (the explicit anti-`Platform.Dynamic` move: that design
///     coupled its dynamic model to JSON via `*JsonConverter`).
///
/// Lazy bind: a value can stay dynamic, or bind to a static type on demand via
/// the `try*` accessors (`DynamicValue.tryInt`, `tryString`, …) and navigate by
/// path (`DynamicValue.get "a.b[3].c"`).
///
/// Equality is structural but hand-written (`Bytes` compares contents, not the
/// `ImmutableArray` reference; arrays/objects recurse). `Object` is an ORDERED
/// key→value list: two objects with the same pairs in different orders are NOT
/// equal — the value tree preserves insertion order, and a canonical wire encoder
/// sorts keys when byte-locking. (Caveat: `Float` equality is .NET double
/// equality, so `nan = nan` is true and `-0.0 = 0.0`; canonical encoding handles
/// those on the wire.)
///
/// This F# DU is the canonical reference shape for the four-oracle primitive;
/// C#/Rust/TS conform to it.
[<RequireQualifiedAccess; CustomEquality; NoComparison>]
type DynamicValue =
    | Null
    | Bool of bool
    | Int of int64
    | Float of float
    | String of string
    | Bytes of ImmutableArray<byte>
    | Array of DynamicValue list
    | Object of (string * DynamicValue) list

    override this.Equals(other: obj) : bool =
        match other with
        | :? DynamicValue as o ->
            match this, o with
            | DynamicValue.Null, DynamicValue.Null -> true
            | DynamicValue.Bool a, DynamicValue.Bool b -> a = b
            | DynamicValue.Int a, DynamicValue.Int b -> a = b
            | DynamicValue.Float a, DynamicValue.Float b -> a.Equals(b)
            | DynamicValue.String a, DynamicValue.String b ->
                System.String.Equals(a, b, System.StringComparison.Ordinal)
            | DynamicValue.Bytes a, DynamicValue.Bytes b ->
                // normalize a default (uninitialized) ImmutableArray to empty so it doesn't throw
                // on enumeration and compares equal to an explicitly-empty payload
                let na = if a.IsDefault then ImmutableArray<byte>.Empty else a
                let nb = if b.IsDefault then ImmutableArray<byte>.Empty else b
                System.Linq.Enumerable.SequenceEqual(na, nb)
            | DynamicValue.Array a, DynamicValue.Array b -> System.Linq.Enumerable.SequenceEqual(a, b)
            | DynamicValue.Object a, DynamicValue.Object b -> System.Linq.Enumerable.SequenceEqual(a, b)
            | _ -> false
        | _ -> false

    override this.GetHashCode() : int =
        match this with
        | DynamicValue.Null -> 0
        | DynamicValue.Bool b -> if b then 1 else 2
        | DynamicValue.Int i -> hash i
        | DynamicValue.Float f -> hash f
        | DynamicValue.String s -> hash s
        | DynamicValue.Bytes bytes ->
            let mutable h = 17
            // skip a default (uninitialized) ImmutableArray; its hash matches an empty payload's
            if not bytes.IsDefault then
                for x in bytes do
                    h <- (h * 31) ^^^ int x
            h
        | DynamicValue.Array items ->
            let mutable h = 19
            for item in items do
                h <- (h * 31) ^^^ item.GetHashCode()
            h
        | DynamicValue.Object pairs ->
            let mutable h = 23
            for (k, v) in pairs do
                h <- (h * 31) ^^^ hash k ^^^ v.GetHashCode()
            h

/// Companion module (the `Option`/`List` type-plus-module pattern): the tag
/// accessor, the lazy-bind `try*` accessors, and `PropertyPath` navigation.
module DynamicValue =

    /// The runtime tag of a value — `QueryInterface`. Exhaustive by design.
    let typeOf (value: DynamicValue) : DynamicValueType =
        match value with
        | DynamicValue.Null -> DynamicValueType.Null
        | DynamicValue.Bool _ -> DynamicValueType.Bool
        | DynamicValue.Int _ -> DynamicValueType.Int
        | DynamicValue.Float _ -> DynamicValueType.Float
        | DynamicValue.String _ -> DynamicValueType.String
        | DynamicValue.Bytes _ -> DynamicValueType.Bytes
        | DynamicValue.Array _ -> DynamicValueType.Array
        | DynamicValue.Object _ -> DynamicValueType.Object

    /// True only for the explicit null shape.
    let isNull (value: DynamicValue) : bool =
        match value with
        | DynamicValue.Null -> true
        | _ -> false

    // -- Lazy bind: ask the value for a static shape, get None on mismatch. --
    // Strict by design (no widening): `tryFloat` does NOT accept an `Int`. A
    // widening `asNumber` can be added later without breaking these.

    let tryBool (value: DynamicValue) : bool option =
        match value with
        | DynamicValue.Bool b -> Some b
        | _ -> None

    let tryInt (value: DynamicValue) : int64 option =
        match value with
        | DynamicValue.Int i -> Some i
        | _ -> None

    let tryFloat (value: DynamicValue) : float option =
        match value with
        | DynamicValue.Float f -> Some f
        | _ -> None

    let tryString (value: DynamicValue) : string option =
        match value with
        | DynamicValue.String s -> Some s
        | _ -> None

    let tryBytes (value: DynamicValue) : ImmutableArray<byte> option =
        match value with
        | DynamicValue.Bytes b -> Some(if b.IsDefault then ImmutableArray<byte>.Empty else b)
        | _ -> None

    let tryArray (value: DynamicValue) : DynamicValue list option =
        match value with
        | DynamicValue.Array items -> Some items
        | _ -> None

    let tryObject (value: DynamicValue) : (string * DynamicValue) list option =
        match value with
        | DynamicValue.Object pairs -> Some pairs
        | _ -> None

    /// Look up a field by key in an `Object` (first match wins; insertion order).
    /// None if the value isn't an object or the key is absent.
    let tryField (key: string) (value: DynamicValue) : DynamicValue option =
        match value with
        | DynamicValue.Object pairs -> pairs |> List.tryFind (fun (k, _) -> k = key) |> Option.map snd
        | _ -> None

    /// Index into an `Array`. None if the value isn't an array or the index is
    /// out of range (negative indices are out of range).
    let tryItem (index: int) (value: DynamicValue) : DynamicValue option =
        match value with
        | DynamicValue.Array items -> List.tryItem index items
        | _ -> None

    // -- PropertyPath navigation: "a.b[3].c" --

    /// One step of a parsed property path: a field key or an array index.
    type private Step =
        | Key of string
        | Index of int

    /// Reads "[<digits>]" in `s` starting at `openPos` (the '['). Returns (index, nextPos)
    /// or None on a malformed bracket (no digits, unterminated, or an index overflowing Int32 —
    /// TryParse, never an OverflowException escaping `get`).
    let private tryReadIndex (s: string) (openPos: int) : (int * int) option =
        let start = openPos + 1
        let mutable j = start
        while j < s.Length && System.Char.IsDigit s.[j] do
            j <- j + 1
        if j = start || j >= s.Length || s.[j] <> ']' then
            None
        else
            match System.Int32.TryParse(s.Substring(start, j - start)) with
            | true, idx -> Some(idx, j + 1)
            | false, _ -> None

    /// Parse one path segment ("key", "key[i][j]…", or "[i][j]…"). None if empty (a leading,
    /// doubled, or trailing dot surfaces as an empty segment) or malformed.
    let private tryParseSegment (segment: string) : Step list option =
        if segment.Length = 0 then
            None
        else
            let firstBracket = segment.IndexOf '['

            let keyResult =
                if firstBracket = 0 then
                    Some([], 0)
                else
                    let keyPart =
                        if firstBracket < 0 then segment else segment.Substring(0, firstBracket)

                    if keyPart.Contains ']' then
                        None // stray ']' in the key part
                    else
                        Some([ Key keyPart ], (if firstBracket < 0 then segment.Length else firstBracket))

            match keyResult with
            | None -> None
            | Some(keySteps, i0) ->
                let rec readIndices i acc =
                    if i >= segment.Length then
                        Some(List.rev acc)
                    else
                        match tryReadIndex segment i with
                        | Some(idx, next) -> readIndices next (Index idx :: acc)
                        | None -> None

                readIndices i0 [] |> Option.map (fun idxSteps -> keySteps @ idxSteps)

    /// Parse a dotted/indexed path ("a.b[3].c", "items[0].name", "[2]"). None on any malformed
    /// segment (bad bracket, stray `]`, or an empty segment from a leading/doubled/trailing dot).
    /// An empty path parses to no steps (the identity navigation).
    let private tryParsePath (path: string) : Step list option =
        if path.Length = 0 then
            Some []
        else
            let rec loop segs acc =
                match segs with
                | [] -> Some(List.rev acc |> List.concat)
                | seg :: rest ->
                    match tryParseSegment seg with
                    | Some steps -> loop rest (steps :: acc)
                    | None -> None

            loop (List.ofArray (path.Split '.')) []

    let rec private navigate (steps: Step list) (value: DynamicValue) : DynamicValue option =
        match steps with
        | [] -> Some value
        | Key k :: rest -> tryField k value |> Option.bind (navigate rest)
        | Index ix :: rest -> tryItem ix value |> Option.bind (navigate rest)

    /// Navigate a property path into a value. Returns None on a malformed path,
    /// a missing key, an out-of-range index, or a type mismatch along the way.
    /// An empty path returns the value itself.
    let get (path: string) (value: DynamicValue) : DynamicValue option =
        tryParsePath path |> Option.bind (fun steps -> navigate steps value)
