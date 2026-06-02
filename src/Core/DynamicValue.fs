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
/// equal — the value tree preserves insertion order, and the canonical wire
/// encoder (`toCanonicalJson`) PRESERVES that insertion order when byte-locking
/// (a key-sorting canonical form — JCS / RFC 8785 / CBOR §4.2 — would be lossy /
/// non-bijective for an order-significant value, so it is rejected; see the seed
/// `src/Core.TypeScript/dynamic-value/golden-vectors.json`). (Caveat: `Float` equality is .NET double
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

/// Why a `DynamicValue` could not be canonically encoded (v1). `Float` and
/// `Bytes` have no canonical JSON form yet (they lock under CBOR or a tagged-JSON
/// convention); surfaced as data per the Result-over-exception hard rule
/// (AGENTS.md), never thrown.
[<RequireQualifiedAccess>]
type EncodeError =
    /// `DynamicValue.Float` has no canonical shortest-float form in plain JSON.
    | FloatDeferred
    /// `DynamicValue.Bytes` has no native JSON byte type.
    | BytesDeferred

/// Why canonical CBOR bytes could not be decoded into a `DynamicValue`. Surfaced as
/// data per the Result-over-exception hard rule (AGENTS.md), never thrown. Mirrors the
/// C#/Rust `DecodeError`.
[<RequireQualifiedAccess>]
type DecodeError =
    /// Input ended mid-item (a head or payload was truncated).
    | UnexpectedEnd
    /// Extra bytes remained after a complete top-level value.
    | TrailingData
    /// An additional-info or major-7 simple value this decoder does not accept (reserved
    /// 28-30, indefinite-length 31, CBOR tags (major 6), or an unsupported simple value).
    | Unsupported
    /// A CBOR integer does not fit int64 (`DynamicValue.Int`).
    | IntegerOverflow
    /// An object (map) key was not a text string (`DynamicValue.Object` keys are strings).
    | NonTextKey
    /// Well-formed CBOR that is NOT the canonical form this codec emits — non-shortest
    /// int/length width, non-shortest float / non-canonical NaN, or invalid UTF-8 repaired
    /// to U+FFFD. Detected by the fixed-point check `toCanonicalCbor decoded = input`.
    | NonCanonical

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

    /// Escape a string as a JSON string literal (including the surrounding
    /// quotes), RFC 8259 minimal escaping: '"' and '\' and control chars
    /// U+0000..U+001F (short forms where they exist, else \u00XX lowercase-hex);
    /// '/' is NOT escaped; valid surrogate PAIRS are emitted raw (the astral
    /// char), but LONE surrogates are \u-escaped (a raw lone surrogate is not
    /// valid Unicode and would be replaced by UTF-8 byte-locking, breaking
    /// bijectivity); all other characters are emitted raw.
    let private escapeJsonString (rawValue: string) : string =
        // Null-safe: a `DynamicValue.String null` / null object key is malformed (the
        // Null shape is for null) but reachable via nullable-disabled C# / interop;
        // normalize null -> empty (mirroring the records' default-array normalization)
        // so the Result-advertising encoder never throws an NRE here.
        // (the module shadows F#'s `isNull` with the DynamicValue tag accessor, so
        // use ReferenceEquals for the BCL-string null check)
        let s = if System.Object.ReferenceEquals(rawValue, null) then "" else rawValue
        let sb = System.Text.StringBuilder(s.Length + 2)
        sb.Append('"') |> ignore
        let mutable i = 0

        while i < s.Length do
            let ch = s.[i]

            match ch with
            | '"' ->
                sb.Append("\\\"") |> ignore
                i <- i + 1
            | '\\' ->
                sb.Append("\\\\") |> ignore
                i <- i + 1
            | '\b' ->
                sb.Append("\\b") |> ignore
                i <- i + 1
            | '\f' ->
                sb.Append("\\f") |> ignore
                i <- i + 1
            | '\n' ->
                sb.Append("\\n") |> ignore
                i <- i + 1
            | '\r' ->
                sb.Append("\\r") |> ignore
                i <- i + 1
            | '\t' ->
                sb.Append("\\t") |> ignore
                i <- i + 1
            | c when int c < 0x20 ->
                sb.AppendFormat("\\u{0:x4}", int c) |> ignore
                i <- i + 1
            | c when System.Char.IsHighSurrogate c && i + 1 < s.Length && System.Char.IsLowSurrogate s.[i + 1] ->
                // valid surrogate pair -> emit the astral char raw
                sb.Append(c) |> ignore
                sb.Append(s.[i + 1]) |> ignore
                i <- i + 2
            | c when System.Char.IsSurrogate c ->
                // lone surrogate -> escape (raw would be invalid Unicode / non-bijective)
                sb.AppendFormat("\\u{0:x4}", int c) |> ignore
                i <- i + 1
            | c ->
                sb.Append(c) |> ignore
                i <- i + 1

        sb.Append('"') |> ignore
        sb.ToString()

    /// Canonical JSON encoding — the byte-lock target (the shared seed is
    /// `src/Core.TypeScript/dynamic-value/golden-vectors.json`). Minified (no
    /// insignificant whitespace); `Object` keys in INSERTION order — NOT sorted,
    /// because `Object` is order-significant, so a key-sorting canonical form
    /// (JCS / RFC 8785 / CBOR §4.2) would be lossy / non-bijective; `Int` = bare
    /// exact decimal (invariant culture); `String` per `escapeJsonString`. v1
    /// locks null/bool/int/string/array/object; `Float` and `Bytes` are DEFERRED
    /// (no canonical JSON form yet — they lock under CBOR or a tagged-JSON
    /// convention) and are surfaced as `Error EncodeError.*` data per the
    /// Result-over-exception hard rule (AGENTS.md), never thrown.
    let rec toCanonicalJson (value: DynamicValue) : Result<string, EncodeError> =
        match value with
        | DynamicValue.Null -> Ok "null"
        | DynamicValue.Bool b -> Ok(if b then "true" else "false")
        | DynamicValue.Int i -> Ok(i.ToString(System.Globalization.CultureInfo.InvariantCulture))
        | DynamicValue.Float _ -> Error EncodeError.FloatDeferred
        | DynamicValue.String s -> Ok(escapeJsonString s)
        | DynamicValue.Bytes _ -> Error EncodeError.BytesDeferred
        | DynamicValue.Array items ->
            items
            |> List.fold
                (fun acc item -> acc |> Result.bind (fun parts -> toCanonicalJson item |> Result.map (fun s -> s :: parts)))
                (Ok [])
            |> Result.map (fun parts -> "[" + String.concat "," (List.rev parts) + "]")
        | DynamicValue.Object pairs ->
            pairs
            |> List.fold
                (fun acc (k, v) ->
                    acc
                    |> Result.bind (fun parts -> toCanonicalJson v |> Result.map (fun s -> (escapeJsonString k + ":" + s) :: parts)))
                (Ok [])
            |> Result.map (fun parts -> "{" + String.concat "," (List.rev parts) + "}")

    /// Canonical CBOR encoding (RFC 8949) — the TOTAL byte-lock target for all
    /// eight shapes (the shared seed is
    /// `src/Core.TypeScript/dynamic-value/golden-vectors-cbor.json`). Where
    /// `toCanonicalJson` is a partial projection (6/8 shapes; Float/Bytes
    /// deferred), CBOR is total: `Float` uses the RFC 8949 §4.2.2 shortest-float
    /// rule (float16 if it round-trips exactly, else float32, else float64; NaN
    /// canonicalizes to `0xf97e00`) and `Bytes` uses a native major-type-2 byte
    /// string — so the result is `byte[]`, not `Result` (CBOR has a canonical form
    /// for every shape).
    ///
    /// One deliberate deviation from RFC 8949 §4.2.1 deterministic encoding:
    /// `Object` map keys stay in INSERTION order, NOT bytewise-sorted, because
    /// `Object` is order-significant — the §4.2.1 key-sort would be lossy /
    /// non-bijective (the same call v1 made for canonical JSON). Integers and
    /// string/array/map lengths use preferred (shortest) serialization per §4.2.1.
    ///
    /// Domain: "total" is over the eight SHAPES (each has a canonical CBOR form,
    /// unlike JSON which defers Float/Bytes), for valid-Unicode values. A `String`
    /// (or object key) holding a LONE UTF-16 surrogate is malformed content,
    /// reachable only via C#/F# interop: it is not a valid Unicode scalar sequence,
    /// so it is unrepresentable in a CBOR text string (RFC 8949 §3.1 = UTF-8) AND
    /// unrepresentable in the Rust oracle (Rust `String` is guaranteed valid UTF-8)
    /// AND in the seed — i.e. outside the cross-language byte-lock domain. .NET's
    /// `Encoding.UTF8.GetBytes` emits U+FFFD for it (encoder-defined). Unlike the
    /// JSON encoder, CBOR text cannot `\u`-escape it back to bijectivity; that
    /// asymmetry is inherent to CBOR's UTF-8 text requirement, not an encoder choice.
    let toCanonicalCbor (value: DynamicValue) : byte[] =
        let buf = System.Collections.Generic.List<byte>()

        // CBOR initial byte (major type in the top 3 bits) + preferred/shortest argument.
        let writeHead (major: int) (arg: uint64) =
            let mt = byte (major <<< 5)

            if arg <= 23UL then
                buf.Add(mt ||| byte arg)
            elif arg <= 0xffUL then
                buf.Add(mt ||| 24uy)
                buf.Add(byte arg)
            elif arg <= 0xffffUL then
                buf.Add(mt ||| 25uy)
                buf.Add(byte (arg >>> 8))
                buf.Add(byte arg)
            elif arg <= 0xffffffffUL then
                buf.Add(mt ||| 26uy)
                buf.Add(byte (arg >>> 24))
                buf.Add(byte (arg >>> 16))
                buf.Add(byte (arg >>> 8))
                buf.Add(byte arg)
            else
                buf.Add(mt ||| 27uy)

                for shift in [ 56; 48; 40; 32; 24; 16; 8; 0 ] do
                    buf.Add(byte (arg >>> shift))

        // Major 0 for v >= 0; major 1 for v < 0 (which encodes -1 - v). `~~~v` yields
        // -1 - v without the Int64.MinValue overflow that `-1L - v` / `-v` would hit.
        let writeInt (v: int64) =
            if v >= 0L then writeHead 0 (uint64 v) else writeHead 1 (uint64 (~~~v))

        // Major 3 text string: raw UTF-8, no escaping. A lone surrogate is not a valid Unicode
        // scalar; .NET UTF-8 encodes it as U+FFFD (encoder-defined) — the seed's strings are valid.
        let writeText (s: string) =
            let utf8 =
                System.Text.Encoding.UTF8.GetBytes(if System.Object.ReferenceEquals(s, null) then "" else s)

            writeHead 3 (uint64 utf8.Length)
            buf.AddRange(utf8)

        // RFC 8949 §4.2.2 shortest float: NaN -> 0xf97e00; else the shortest of float16 / float32 /
        // float64 that decodes back to the exact same value (±0 and ±Inf round-trip through float16).
        // `float f32 = v` also rejects a width that overflowed to Inf (e.g. 1e300 as float32),
        // correctly falling through to the wider form.
        let writeFloat (v: float) =
            if System.Double.IsNaN v then
                buf.Add 0xf9uy
                buf.Add 0x7euy
                buf.Add 0x00uy
            else
                let f32 = float32 v

                if float f32 = v then
                    let h: System.Half = System.Half.op_Explicit f32

                    if (System.Half.op_Explicit h: float32) = f32 then
                        let bits16 = System.BitConverter.HalfToUInt16Bits h
                        buf.Add 0xf9uy
                        buf.Add(byte (bits16 >>> 8))
                        buf.Add(byte bits16)
                    else
                        let bits32 = System.BitConverter.SingleToUInt32Bits f32
                        buf.Add 0xfauy
                        buf.Add(byte (bits32 >>> 24))
                        buf.Add(byte (bits32 >>> 16))
                        buf.Add(byte (bits32 >>> 8))
                        buf.Add(byte bits32)
                else
                    let bits64 = System.BitConverter.DoubleToUInt64Bits v
                    buf.Add 0xfbuy

                    for shift in [ 56; 48; 40; 32; 24; 16; 8; 0 ] do
                        buf.Add(byte (bits64 >>> shift))

        let rec write (v: DynamicValue) =
            match v with
            | DynamicValue.Null -> buf.Add 0xf6uy
            | DynamicValue.Bool b -> buf.Add(if b then 0xf5uy else 0xf4uy)
            | DynamicValue.Int i -> writeInt i
            | DynamicValue.Float f -> writeFloat f
            | DynamicValue.String s -> writeText s
            | DynamicValue.Bytes bytes ->
                let b = if bytes.IsDefault then ImmutableArray<byte>.Empty else bytes
                writeHead 2 (uint64 b.Length)
                buf.AddRange(b)
            | DynamicValue.Array items ->
                writeHead 4 (uint64 (List.length items))

                for item in items do
                    write item
            | DynamicValue.Object pairs ->
                writeHead 5 (uint64 (List.length pairs))

                for (k, value) in pairs do
                    writeText k
                    write value

        write value
        buf.ToArray()

    /// Decode canonical CBOR (RFC 8949) bytes back into a `DynamicValue` — the inverse
    /// of `toCanonicalCbor`, completing the byte↔value bijection for all eight shapes.
    /// Decode is partial (truncation, reserved/indefinite forms, CBOR tags, oversized
    /// integers, non-text map keys, non-canonical encodings), so it returns
    /// `Result<DynamicValue, DecodeError>` per the Result-over-exception hard rule
    /// (AGENTS.md) — never throws for malformed input. Mirrors the C#/Rust decoder.
    ///
    /// Strictly canonical: the canonical bytes are exactly the fixed points of
    /// encode∘decode, so after a structurally-valid decode it asserts
    /// `toCanonicalCbor decoded = input` and returns `DecodeError.NonCanonical` otherwise
    /// — rejecting non-shortest int/length widths, non-shortest floats / non-canonical
    /// NaN, and invalid UTF-8 repaired to U+FFFD, in one uniform check. float16 payloads
    /// decode via `System.Half`.
    let fromCanonicalCbor (bytes: byte[]) : Result<DynamicValue, DecodeError> =
        let mutable pos = 0

        // read n big-endian bytes as uint64 (caller has bounds-checked)
        let readBE (n: int) : uint64 =
            let mutable v = 0UL
            for i in 0 .. n - 1 do
                v <- (v <<< 8) ||| uint64 bytes.[pos + i]
            pos <- pos + n
            v

        // CBOR argument after the initial byte: inline for 0-23, else 1/2/4/8 BE bytes
        let readArg (ai: int) : Result<uint64, DecodeError> =
            if ai < 24 then
                Ok(uint64 ai)
            else
                let n =
                    match ai with
                    | 24 -> 1
                    | 25 -> 2
                    | 26 -> 4
                    | 27 -> 8
                    | _ -> -1

                if n < 0 then Error DecodeError.Unsupported
                elif pos + n > bytes.Length then Error DecodeError.UnexpectedEnd
                else Ok(readBE n)

        let rec readValue () : Result<DynamicValue, DecodeError> =
            if pos >= bytes.Length then
                Error DecodeError.UnexpectedEnd
            else
                let initial = int bytes.[pos]
                pos <- pos + 1
                let major = initial >>> 5
                let ai = initial &&& 0x1f

                if major = 7 then
                    readSimpleOrFloat ai
                else
                    match readArg ai with
                    | Error e -> Error e
                    | Ok arg ->
                        match major with
                        | 0 ->
                            if arg > uint64 System.Int64.MaxValue then
                                Error DecodeError.IntegerOverflow
                            else
                                Ok(DynamicValue.Int(int64 arg))
                        | 1 ->
                            if arg > uint64 System.Int64.MaxValue then
                                Error DecodeError.IntegerOverflow
                            else
                                Ok(DynamicValue.Int(-1L - int64 arg))
                        | 2 -> readByteString arg
                        | 3 -> readTextString arg
                        | 4 -> readArray arg
                        | 5 -> readMap arg
                        | _ -> Error DecodeError.Unsupported

        // major 7: simple values (false/true/null) + IEEE floats; float16 via System.Half
        and readSimpleOrFloat (ai: int) : Result<DynamicValue, DecodeError> =
            match ai with
            | 20 -> Ok(DynamicValue.Bool false)
            | 21 -> Ok(DynamicValue.Bool true)
            | 22 -> Ok DynamicValue.Null
            | 25 ->
                if pos + 2 > bytes.Length then
                    Error DecodeError.UnexpectedEnd
                else
                    let h = System.BitConverter.UInt16BitsToHalf(uint16 (readBE 2))
                    Ok(DynamicValue.Float(System.Half.op_Explicit h: float))
            | 26 ->
                if pos + 4 > bytes.Length then
                    Error DecodeError.UnexpectedEnd
                else
                    Ok(DynamicValue.Float(float (System.BitConverter.UInt32BitsToSingle(uint32 (readBE 4)))))
            | 27 ->
                if pos + 8 > bytes.Length then
                    Error DecodeError.UnexpectedEnd
                else
                    Ok(DynamicValue.Float(System.BitConverter.UInt64BitsToDouble(readBE 8)))
            | _ -> Error DecodeError.Unsupported

        and readByteString (arg: uint64) : Result<DynamicValue, DecodeError> =
            if arg > uint64 (bytes.Length - pos) then
                Error DecodeError.UnexpectedEnd
            else
                let n = int arg
                let slice = Array.sub bytes pos n
                pos <- pos + n
                Ok(DynamicValue.Bytes(ImmutableArray.Create<byte>(slice)))

        and readTextString (arg: uint64) : Result<DynamicValue, DecodeError> =
            if arg > uint64 (bytes.Length - pos) then
                Error DecodeError.UnexpectedEnd
            else
                let n = int arg
                let s = System.Text.Encoding.UTF8.GetString(bytes, pos, n)
                pos <- pos + n
                Ok(DynamicValue.String s)

        // each item is >= 1 byte, so a count beyond the remaining bytes is truncated
        and readArray (arg: uint64) : Result<DynamicValue, DecodeError> =
            if arg > uint64 (bytes.Length - pos) then
                Error DecodeError.UnexpectedEnd
            else
                let rec loop i acc =
                    if i >= int arg then
                        Ok(DynamicValue.Array(List.rev acc))
                    else
                        match readValue () with
                        | Error e -> Error e
                        | Ok item -> loop (i + 1) (item :: acc)

                loop 0 []

        and readMap (arg: uint64) : Result<DynamicValue, DecodeError> =
            if arg > uint64 (bytes.Length - pos) then
                Error DecodeError.UnexpectedEnd
            else
                let rec loop i acc =
                    if i >= int arg then
                        Ok(DynamicValue.Object(List.rev acc))
                    else
                        match readValue () with
                        | Error e -> Error e
                        | Ok(DynamicValue.String k) ->
                            match readValue () with
                            | Error e -> Error e
                            | Ok v -> loop (i + 1) ((k, v) :: acc)
                        | Ok _ -> Error DecodeError.NonTextKey

                loop 0 []

        match readValue () with
        | Error e -> Error e
        | Ok value ->
            if pos <> bytes.Length then
                Error DecodeError.TrailingData
            // canonical fixed-point: canonical bytes are exactly those `b` with toCanonicalCbor(decode b) = b
            elif toCanonicalCbor value <> bytes then
                Error DecodeError.NonCanonical
            else
                Ok value
