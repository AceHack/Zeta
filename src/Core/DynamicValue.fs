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
/// primitive, 081KRW63S0008QG0R0030F8ZXA). Distinct from the static `ISerializer<'T>` seam in
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
    /// A `DynamicValue.String` (or `Object` key) holds a char that is NOT XML-1.0
    /// representable — NUL or a C0 control other than `\t \n \r`, which XML 1.0 forbids
    /// even as a character reference (the XML analogue of `BytesDeferred`).
    | NonRepresentable
    /// The value's nesting depth exceeds `maxNestingDepth` — a fixed bound well above any
    /// realistic value, guarding the recursive encoders against unbounded stack growth
    /// (a deeply-nested value would otherwise overflow the stack on tight-stack runtimes).
    /// Resource-safety guard, NOT a value-domain limit. Mirrored across F#/C#/Rust/TS.
    | NestingTooDeep

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
    /// Input is not well-formed for the canonical XML grammar this codec parses —
    /// an unterminated tag/entity, a missing `k="…"` attribute, a bad numeric
    /// char-ref, or a structurally invalid element (the XML analogue of malformation).
    /// XML-only.
    | MalformedXml
    /// Input is not a well-formed Arrow node-table for the schema this codec emits —
    /// not a single readable RecordBatch, a missing/mistyped column, a parent index out
    /// of range, an unknown `kind` tag, a missing scalar payload for the kind, or any
    /// Apache.Arrow read failure (caught, never thrown). Arrow-only.
    | MalformedArrow
    /// The input's nesting depth exceeds `maxNestingDepth` — a fixed bound well above any
    /// realistic value, guarding the recursive decoders against unbounded stack growth
    /// (deeply-nested input would otherwise overflow the stack on tight-stack runtimes).
    /// Resource-safety guard, NOT a grammar limit. Mirrored across F#/C#/Rust/TS.
    | NestingTooDeep

/// Companion module (the `Option`/`List` type-plus-module pattern): the tag
/// accessor, the lazy-bind `try*` accessors, and `PropertyPath` navigation.
module DynamicValue =

    /// Maximum value/input nesting depth the recursive canonical codecs (JSON, XML)
    /// will walk before returning `Error EncodeError.NestingTooDeep` /
    /// `Error DecodeError.NestingTooDeep`. A fixed resource-safety bound, NOT part of the
    /// contract's value domain: it sits FAR above any realistic `DynamicValue` (events,
    /// records — nesting beyond a few dozen is already pathological), so golden vectors and
    /// real data are unaffected, while a depth-bomb is rejected as data before it can
    /// overflow the stack on a tight-stack runtime (e.g. a ~1 MB threadpool thread). The
    /// literal is deliberately NOT exposed in the public contract so it can be raised later
    /// (only ever moving the error later, never earlier). Mirrored across F#/C#/Rust/TS.
    let internal maxNestingDepth = 256

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
    let toCanonicalJson (value: DynamicValue) : Result<string, EncodeError> =
        // `depth` guards the per-nesting-level recursion against unbounded stack growth
        // (a depth-bomb would otherwise overflow the stack). Past the fixed bound the value
        // is rejected as data — `Error NestingTooDeep` — never thrown.
        let rec go (depth: int) (value: DynamicValue) : Result<string, EncodeError> =
            if depth > maxNestingDepth then
                Error EncodeError.NestingTooDeep
            else
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
                        (fun acc item -> acc |> Result.bind (fun parts -> go (depth + 1) item |> Result.map (fun s -> s :: parts)))
                        (Ok [])
                    |> Result.map (fun parts -> "[" + String.concat "," (List.rev parts) + "]")
                | DynamicValue.Object pairs ->
                    pairs
                    |> List.fold
                        (fun acc (k, v) ->
                            acc
                            |> Result.bind (fun parts -> go (depth + 1) v |> Result.map (fun s -> (escapeJsonString k + ":" + s) :: parts)))
                        (Ok [])
                    |> Result.map (fun parts -> "{" + String.concat "," (List.rev parts) + "}")

        go 0 value

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
    let toCanonicalCbor (value: DynamicValue) : Result<byte[], EncodeError> =
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

        let rec write (depth: int) (v: DynamicValue) : Result<unit, EncodeError> =
            if depth > maxNestingDepth then
                Error EncodeError.NestingTooDeep
            else
                match v with
                | DynamicValue.Null -> 
                    buf.Add 0xf6uy
                    Ok()
                | DynamicValue.Bool b -> 
                    buf.Add(if b then 0xf5uy else 0xf4uy)
                    Ok()
                | DynamicValue.Int i -> 
                    writeInt i
                    Ok()
                | DynamicValue.Float f -> 
                    writeFloat f
                    Ok()
                | DynamicValue.String s -> 
                    writeText s
                    Ok()
                | DynamicValue.Bytes bytes ->
                    let b = if bytes.IsDefault then ImmutableArray<byte>.Empty else bytes
                    writeHead 2 (uint64 b.Length)
                    buf.AddRange(b)
                    Ok()
                | DynamicValue.Array items ->
                    writeHead 4 (uint64 (List.length items))
                    items
                    |> List.fold
                        (fun acc item -> acc |> Result.bind (fun () -> write (depth + 1) item))
                        (Ok())
                | DynamicValue.Object pairs ->
                    writeHead 5 (uint64 (List.length pairs))
                    pairs
                    |> List.fold
                        (fun acc (k, valVal) ->
                            acc
                            |> Result.bind (fun () ->
                                writeText k
                                write (depth + 1) valVal))
                        (Ok())

        write 0 value
        |> Result.map (fun () -> buf.ToArray())

    /// Exposes a way to cleanly unwrap the CBOR encode result for low-depth invariants in calling code.
    let toCanonicalCborOk (value: DynamicValue) : byte[] =
        match toCanonicalCbor value with
        | Ok bytes -> bytes
        | Error e -> failwithf "toCanonicalCbor failed on low-depth invariant: %A" e

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

        let rec readValue (depth: int) : Result<DynamicValue, DecodeError> =
            if depth > maxNestingDepth then
                Error DecodeError.NestingTooDeep
            elif pos >= bytes.Length then
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
                        | 4 -> readArray arg depth
                        | 5 -> readMap arg depth
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
        and readArray (arg: uint64) (depth: int) : Result<DynamicValue, DecodeError> =
            if arg > uint64 (bytes.Length - pos) then
                Error DecodeError.UnexpectedEnd
            else
                let rec loop i acc =
                    if i >= int arg then
                        Ok(DynamicValue.Array(List.rev acc))
                    else
                        match readValue (depth + 1) with
                        | Error e -> Error e
                        | Ok item -> loop (i + 1) (item :: acc)

                loop 0 []

        and readMap (arg: uint64) (depth: int) : Result<DynamicValue, DecodeError> =
            if arg > uint64 (bytes.Length - pos) then
                Error DecodeError.UnexpectedEnd
            else
                let rec loop i acc =
                    if i >= int arg then
                        Ok(DynamicValue.Object(List.rev acc))
                    else
                        match readValue (depth + 1) with
                        | Error e -> Error e
                        | Ok(DynamicValue.String k) ->
                            match readValue (depth + 1) with
                            | Error e -> Error e
                            | Ok v -> loop (i + 1) ((k, v) :: acc)
                        | Ok _ -> Error DecodeError.NonTextKey

                loop 0 []

        match readValue 0 with
        | Error e -> Error e
        | Ok value ->
            if pos <> bytes.Length then
                Error DecodeError.TrailingData
            else
                match toCanonicalCbor value with
                | Ok enc when enc = bytes -> Ok value
                | _ -> Error DecodeError.NonCanonical

    /// Decodes canonical JSON text into a `DynamicValue` — the inverse of `toCanonicalJson`,
    /// completing the text↔value round-trip for the six locked shapes (Float + Bytes are DEFERRED
    /// in JSON and lock under CBOR; a number with a decimal point or exponent is a Float ->
    /// `DecodeError.Unsupported`). Strictly canonical: a lenient recursive-descent parse, then one
    /// fixed-point check (`toCanonicalJson decoded = input`) rejects every non-canonical form
    /// (insignificant whitespace, non-minimal escapes, leading zeros) as
    /// `DecodeError.NonCanonical` (a leading '+' is invalid JSON → `UnexpectedEnd`, not non-canonical).
    /// int64 precision is preserved by parsing the number token as text,
    /// never via a float. Surfaced as data via `Result`, never thrown. Mirrors the TS/C#/Rust decoder.
    let fromCanonicalJson (json: string) : Result<DynamicValue, DecodeError> =
        // Totality (081KT7YW00008QG0R0019J8FSX): a null input is not an exception — treat it as empty (no value),
        // which takes the clean-Error path. The decoder returns Result on EVERY input.
        // (`System.Object.ReferenceEquals` — the module-local `isNull` is DynamicValue→bool.)
        let json = if System.Object.ReferenceEquals(json, null) then "" else json
        let mutable pos = 0
        let len = json.Length

        let skipWs () =
            while pos < len
                  && (json.[pos] = ' ' || json.[pos] = '\t' || json.[pos] = '\n' || json.[pos] = '\r') do
                pos <- pos + 1

        let isDigit c = c >= '0' && c <= '9'

        // consumes one or more digits at pos; UnexpectedEnd if none (the JSON grammar's
        // "at least one digit" for the integer part, fraction, and exponent)
        let consumeDigits () : Result<unit, DecodeError> =
            let d0 = pos

            while pos < len && isDigit json.[pos] do
                pos <- pos + 1

            if pos = d0 then Error DecodeError.UnexpectedEnd else Ok()

        // reads one escape (pos at the backslash), returns the decoded char, advances pos
        let readEscape () : Result<char, DecodeError> =
            pos <- pos + 1 // past backslash

            if pos >= len then
                Error DecodeError.UnexpectedEnd
            elif json.[pos] = 'u' then
                if pos + 5 > len then
                    Error DecodeError.UnexpectedEnd // 'u' + 4 hex digits
                else
                    // require exactly 4 hex digits — AllowHexSpecifier (NOT HexNumber, which also
                    // permits leading/trailing whitespace) so a "\u 001"-style escape is rejected
                    match
                        System.UInt16.TryParse(
                            System.MemoryExtensions.AsSpan(json, pos + 1, 4),
                            System.Globalization.NumberStyles.AllowHexSpecifier,
                            System.Globalization.CultureInfo.InvariantCulture
                        )
                    with
                    | true, code ->
                        pos <- pos + 5 // 'u' + 4 hex
                        Ok(char code)
                    | false, _ -> Error DecodeError.UnexpectedEnd
            else
                let rep =
                    match json.[pos] with
                    | '"' -> Some '"'
                    | '\\' -> Some '\\'
                    | '/' -> Some '/'
                    | 'b' -> Some '\b'
                    | 'f' -> Some '\f'
                    | 'n' -> Some '\n'
                    | 'r' -> Some '\r'
                    | 't' -> Some '\t'
                    | _ -> None

                match rep with
                | Some c ->
                    pos <- pos + 1
                    Ok c
                | None -> Error DecodeError.UnexpectedEnd // invalid escape

        let readString () : Result<string, DecodeError> =
            pos <- pos + 1 // opening quote
            let sb = System.Text.StringBuilder()

            let rec loop () : Result<string, DecodeError> =
                if pos >= len then
                    Error DecodeError.UnexpectedEnd // unterminated
                else
                    let c = json.[pos]

                    if c = '"' then
                        pos <- pos + 1
                        Ok(sb.ToString())
                    elif c = '\\' then
                        match readEscape () with
                        | Error e -> Error e
                        | Ok ch ->
                            sb.Append(ch) |> ignore
                            loop ()
                    else
                        sb.Append(c) |> ignore
                        pos <- pos + 1
                        loop ()

            loop ()

        let readNumber () : Result<DynamicValue, DecodeError> =
            let start = pos

            if pos < len && json.[pos] = '-' then
                pos <- pos + 1

            let readFrac () =
                if pos < len && json.[pos] = '.' then
                    pos <- pos + 1
                    consumeDigits () |> Result.map (fun () -> true) // fraction required after '.'
                else
                    Ok false

            let readExp () =
                if pos < len && (json.[pos] = 'e' || json.[pos] = 'E') then
                    pos <- pos + 1

                    if pos < len && (json.[pos] = '+' || json.[pos] = '-') then
                        pos <- pos + 1

                    consumeDigits () |> Result.map (fun () -> true) // exponent digits required
                else
                    Ok false

            consumeDigits () // integer part — required (rejects "-", "-.5")
            |> Result.bind readFrac
            |> Result.bind (fun hasFrac -> readExp () |> Result.map (fun hasExp -> hasFrac || hasExp))
            |> Result.bind (fun isFloat ->
                if isFloat then
                    Error DecodeError.Unsupported // Float deferred in v1 JSON
                else
                    match
                        System.Int64.TryParse(
                            System.MemoryExtensions.AsSpan(json, start, pos - start),
                            System.Globalization.NumberStyles.AllowLeadingSign,
                            System.Globalization.CultureInfo.InvariantCulture
                        )
                    with
                    | true, n -> Ok(DynamicValue.Int n)
                    | false, _ -> Error DecodeError.IntegerOverflow) // token is -?[0-9]+, so only overflow fails

        // `depth` guards the per-nesting-level recursion: past the fixed bound the input is
        // rejected as data (`Error NestingTooDeep`) rather than overflowing the stack.
        let rec readValue (depth: int) : Result<DynamicValue, DecodeError> =
            if depth > maxNestingDepth then
                Error DecodeError.NestingTooDeep
            else

            skipWs ()

            if pos >= len then
                Error DecodeError.UnexpectedEnd
            else
                match json.[pos] with
                | 'n' -> readLiteral "null" DynamicValue.Null
                | 't' -> readLiteral "true" (DynamicValue.Bool true)
                | 'f' -> readLiteral "false" (DynamicValue.Bool false)
                | '"' -> readString () |> Result.map DynamicValue.String
                | '[' -> readArray depth
                | '{' -> readObject depth
                | c when c = '-' || isDigit c -> readNumber ()
                | _ -> Error DecodeError.UnexpectedEnd

        and readLiteral (lit: string) (lifted: DynamicValue) : Result<DynamicValue, DecodeError> =
            if pos + lit.Length > len || System.String.CompareOrdinal(json, pos, lit, 0, lit.Length) <> 0 then
                Error DecodeError.UnexpectedEnd
            else
                pos <- pos + lit.Length
                Ok lifted

        and readArray (depth: int) : Result<DynamicValue, DecodeError> =
            pos <- pos + 1 // past the opening bracket
            skipWs ()

            if pos < len && json.[pos] = ']' then
                pos <- pos + 1
                Ok(DynamicValue.Array [])
            else
                let rec loop acc =
                    match readValue (depth + 1) with
                    | Error e -> Error e
                    | Ok item ->
                        skipWs ()

                        if pos >= len then
                            Error DecodeError.UnexpectedEnd
                        elif json.[pos] = ',' then
                            pos <- pos + 1
                            loop (item :: acc)
                        elif json.[pos] = ']' then
                            pos <- pos + 1
                            Ok(DynamicValue.Array(List.rev (item :: acc)))
                        else
                            Error DecodeError.UnexpectedEnd

                loop []

        and readObject (depth: int) : Result<DynamicValue, DecodeError> =
            pos <- pos + 1 // past the opening brace
            skipWs ()

            if pos < len && json.[pos] = '}' then
                pos <- pos + 1
                Ok(DynamicValue.Object [])
            else
                let rec loop acc =
                    skipWs ()

                    if pos >= len || json.[pos] <> '"' then
                        Error DecodeError.UnexpectedEnd // key must be a string
                    else
                        match readString () with
                        | Error e -> Error e
                        | Ok key ->
                            skipWs ()

                            if pos >= len || json.[pos] <> ':' then
                                Error DecodeError.UnexpectedEnd
                            else
                                pos <- pos + 1

                                match readValue (depth + 1) with
                                | Error e -> Error e
                                | Ok v ->
                                    skipWs ()

                                    if pos >= len then
                                        Error DecodeError.UnexpectedEnd
                                    elif json.[pos] = ',' then
                                        pos <- pos + 1
                                        loop ((key, v) :: acc)
                                    elif json.[pos] = '}' then
                                        pos <- pos + 1
                                        Ok(DynamicValue.Object(List.rev ((key, v) :: acc)))
                                    else
                                        Error DecodeError.UnexpectedEnd

                loop []

        match readValue 0 with
        | Error e -> Error e
        | Ok value ->
            skipWs ()

            if pos <> len then
                Error DecodeError.TrailingData
            else
                // canonical fixed-point: a canonical string re-encodes to itself; the decoder only
                // produces the six locked shapes, so toCanonicalJson is always Ok here
                match toCanonicalJson value with
                | Ok s when System.String.Equals(s, json, System.StringComparison.Ordinal) -> Ok value
                | _ -> Error DecodeError.NonCanonical

    // ----------------------------------------------------------------------------
    // Canonical XML codec — mirrors src/Core.TypeScript/dynamic-value/xml.ts.
    // ----------------------------------------------------------------------------

    /// A char is XML-1.0 legal as content iff it is `\t \n \r` or >= 0x20. NUL and any
    /// other C0 control are forbidden — even as a character reference (XML 1.0 §2.2).
    let private isForbiddenC0 (code: int) : bool =
        code < 0x20 && code <> 0x09 && code <> 0x0a && code <> 0x0d

    /// Escape element TEXT: `&` `<` `>` as entities; `\t \n \r` as char-refs (so
    /// whitespace survives XML content line-ending + normalization). Returns Error
    /// `NonRepresentable` on a forbidden C0 char. Iterates by UTF-16 code unit, which
    /// is correct here: the chars we test (`& < > \t \n \r`, C0) are all BMP, and
    /// surrogate halves are emitted raw (the astral char round-trips as its pair).
    let private escapeXmlText (rawValue: string) : Result<string, EncodeError> =
        let s = if System.Object.ReferenceEquals(rawValue, null) then "" else rawValue
        let sb = System.Text.StringBuilder(s.Length)
        let mutable err = false
        let mutable i = 0

        while i < s.Length && not err do
            let ch = s.[i]

            match ch with
            | '&' -> sb.Append("&amp;") |> ignore
            | '<' -> sb.Append("&lt;") |> ignore
            | '>' -> sb.Append("&gt;") |> ignore
            | '\t' -> sb.Append("&#9;") |> ignore
            | '\n' -> sb.Append("&#10;") |> ignore
            | '\r' -> sb.Append("&#13;") |> ignore
            | c when isForbiddenC0 (int c) -> err <- true
            | c -> sb.Append(c) |> ignore

            i <- i + 1

        if err then Error EncodeError.NonRepresentable else Ok(sb.ToString())

    /// Escape an attribute value (object key): like text plus `"` as `&quot;`.
    let private escapeXmlAttr (rawValue: string) : Result<string, EncodeError> =
        let s = if System.Object.ReferenceEquals(rawValue, null) then "" else rawValue
        let sb = System.Text.StringBuilder(s.Length)
        let mutable err = false
        let mutable i = 0

        while i < s.Length && not err do
            let ch = s.[i]

            match ch with
            | '&' -> sb.Append("&amp;") |> ignore
            | '<' -> sb.Append("&lt;") |> ignore
            | '>' -> sb.Append("&gt;") |> ignore
            | '"' -> sb.Append("&quot;") |> ignore
            | '\t' -> sb.Append("&#9;") |> ignore
            | '\n' -> sb.Append("&#10;") |> ignore
            | '\r' -> sb.Append("&#13;") |> ignore
            | c when isForbiddenC0 (int c) -> err <- true
            | c -> sb.Append(c) |> ignore

            i <- i + 1

        if err then Error EncodeError.NonRepresentable else Ok(sb.ToString())

    /// Canonical XML encoding — the byte-lock target (shared seed
    /// `src/Core.TypeScript/dynamic-value/golden-vectors-xml.json`). Typed-element,
    /// minified, one rendering per value: `<null/>`, `<bool>true</bool>`,
    /// `<int>DECIMAL</int>`, `<str>TEXT</str>`, `<arr>CHILD…</arr>`,
    /// `<obj><e k="KEY">VALUE</e>…</obj>` (keys in INSERTION order). Element text
    /// escapes `& < >` and `\t \n \r` as char-refs; attribute (key) escapes also `"`.
    /// XML is the TOTAL form (8/8 shapes): `Float` → `<float>HHHHHHHHHHHHHHHH</float>`
    /// (16 lowercase hex IEEE-754 f64 big-endian bits, reusing the CBOR f64-bits form)
    /// and `Bytes` → `<bytes>HH…</bytes>` (lowercase hex). A string/key with a forbidden C0 char is
    /// NOT XML-1.0 representable → `Error EncodeError.NonRepresentable`. Surfaced as
    /// data per the Result-over-exception hard rule (AGENTS.md), never thrown.
    let toCanonicalXml (value: DynamicValue) : Result<string, EncodeError> =
        // `depth` guards the per-nesting-level recursion against unbounded stack growth.
        let rec go (depth: int) (value: DynamicValue) : Result<string, EncodeError> =
            if depth > maxNestingDepth then
                Error EncodeError.NestingTooDeep
            else
                match value with
                | DynamicValue.Null -> Ok "<null/>"
                | DynamicValue.Bool b -> Ok(if b then "<bool>true</bool>" else "<bool>false</bool>")
                | DynamicValue.Int i -> Ok("<int>" + i.ToString(System.Globalization.CultureInfo.InvariantCulture) + "</int>")
                | DynamicValue.Float f ->
                    // 16 lowercase hex = the IEEE-754 f64 big-endian bit pattern — the SAME
                    // language-neutral form the CBOR float64 path uses (System.BitConverter bits).
                    // Total here: float never hits the NonRepresentable boundary.
                    let bits = System.BitConverter.DoubleToUInt64Bits f
                    Ok("<float>" + bits.ToString("x16", System.Globalization.CultureInfo.InvariantCulture) + "</float>")
                | DynamicValue.String s -> escapeXmlText s |> Result.map (fun t -> "<str>" + t + "</str>")
                | DynamicValue.Bytes bytes ->
                    // canonical lowercase hex (empty bytes -> <bytes></bytes>); reuses the byte
                    // payload normalization the CBOR codec applies. Total: never NonRepresentable.
                    let b = if bytes.IsDefault then ImmutableArray<byte>.Empty else bytes
                    let hex = System.Convert.ToHexString(b.AsSpan()).ToLowerInvariant()
                    Ok("<bytes>" + hex + "</bytes>")
                | DynamicValue.Array items ->
                    items
                    |> List.fold
                        (fun acc item -> acc |> Result.bind (fun parts -> go (depth + 1) item |> Result.map (fun s -> s :: parts)))
                        (Ok [])
                    |> Result.map (fun parts -> "<arr>" + String.concat "" (List.rev parts) + "</arr>")
                | DynamicValue.Object pairs ->
                    pairs
                    |> List.fold
                        (fun acc (k, v) ->
                            acc
                            |> Result.bind (fun parts ->
                                escapeXmlAttr k
                                |> Result.bind (fun ke -> go (depth + 1) v |> Result.map (fun s -> ("<e k=\"" + ke + "\">" + s + "</e>") :: parts))))
                        (Ok [])
                    |> Result.map (fun parts -> "<obj>" + String.concat "" (List.rev parts) + "</obj>")

        go 0 value

    /// Decodes canonical XML text into a `DynamicValue` — the inverse of `toCanonicalXml`,
    /// completing the text↔value round-trip for all eight shapes (`<float>` = 16 lowercase
    /// hex IEEE-754 f64 bits, `<bytes>` = even-length lowercase hex; unknown tags →
    /// `DecodeError.Unsupported`). Strictly
    /// canonical: a lenient parse, then one fixed-point check (`toCanonicalXml decoded =
    /// input`) rejects every non-canonical form (self-closing empties, `&#x9;` vs `&#9;`,
    /// insignificant whitespace, leading zeros) as `DecodeError.NonCanonical`. Surfaced as
    /// data via `Result`, never thrown. Mirrors the TS decoder.
    let fromCanonicalXml (xml: string) : Result<DynamicValue, DecodeError> =
        // Totality (081KT7YW00008QG0R0019J8FSX): a null input is not an exception — treat it as empty (no value),
        // which takes the clean-Error path. The decoder returns Result on EVERY input.
        // (`System.Object.ReferenceEquals` — the module-local `isNull` is DynamicValue→bool.)
        let xml = if System.Object.ReferenceEquals(xml, null) then "" else xml
        let mutable pos = 0
        let len = xml.Length

        let at () : char = if pos < len then xml.[pos] else '\u0000'

        // Unescape XML content/attribute: the inverse of escapeXmlText/escapeXmlAttr.
        // Accepts the entities + numeric char-refs this codec emits (and common named
        // ones), decimal and hex. Lenient: the fixed-point check re-canonicalizes, so any
        // non-canonical spelling (&#x9; vs &#9;, or a raw literal newline) is rejected.
        let unescape (s: string) : Result<string, DecodeError> =
            let sb = System.Text.StringBuilder(s.Length)
            let mutable i = 0
            let mutable err = false

            while i < s.Length && not err do
                let ch = s.[i]

                if ch <> '&' then
                    sb.Append(ch) |> ignore
                    i <- i + 1
                else
                    let semi = s.IndexOf(';', i)

                    if semi < 0 then
                        err <- true
                    else
                        let ent = s.Substring(i + 1, semi - i - 1)

                        let appendCode (digits: string) (radix: int) =
                            let style =
                                if radix = 16 then
                                    System.Globalization.NumberStyles.AllowHexSpecifier
                                else
                                    System.Globalization.NumberStyles.None

                            match System.Int32.TryParse(digits, style, System.Globalization.CultureInfo.InvariantCulture) with
                            | true, code when code >= 0 && code <= 0x10ffff ->
                                sb.Append(System.Char.ConvertFromUtf32(code)) |> ignore
                            | _ -> err <- true

                        if ent = "amp" then sb.Append('&') |> ignore
                        elif ent = "lt" then sb.Append('<') |> ignore
                        elif ent = "gt" then sb.Append('>') |> ignore
                        elif ent = "quot" then sb.Append('"') |> ignore
                        elif ent = "apos" then sb.Append('\'') |> ignore
                        elif ent.Length > 0 && ent.[0] = '#' then
                            let isHex = ent.Length > 1 && (ent.[1] = 'x' || ent.[1] = 'X')
                            let digits = if isHex then ent.Substring(2) else ent.Substring(1)

                            let allValid =
                                digits.Length > 0
                                && (if isHex then
                                        digits |> Seq.forall System.Uri.IsHexDigit
                                    else
                                        digits |> Seq.forall (fun c -> c >= '0' && c <= '9'))

                            if not allValid then err <- true else appendCode digits (if isHex then 16 else 10)
                        else
                            err <- true

                        i <- semi + 1

            if err then Error DecodeError.MalformedXml else Ok(sb.ToString())

        // Read raw text up to the next '<' (no nested tags); the still-escaped run.
        let readTextRun () : string =
            let start = pos

            while pos < len && xml.[pos] <> '<' do
                pos <- pos + 1

            xml.Substring(start, pos - start)

        // A parsed tag: name, whether it is a close tag, self-closing, and the optional
        // unescaped k="..." attribute value (only ever present on <e>).
        let readTag () : Result<string * bool * bool * string option, DecodeError> =
            if at () <> '<' then
                Error DecodeError.MalformedXml
            else
                pos <- pos + 1
                let mutable close = false

                if at () = '/' then
                    close <- true
                    pos <- pos + 1

                let nameStart = pos

                while pos < len && xml.[pos] >= 'a' && xml.[pos] <= 'z' do
                    pos <- pos + 1

                let name = xml.Substring(nameStart, pos - nameStart)

                if name.Length = 0 then
                    Error DecodeError.MalformedXml
                else
                    // optional single attribute: ` k="..."` (only on <e>)
                    let attrResult : Result<string option, DecodeError> =
                        if at () = ' ' then
                            pos <- pos + 1

                            if pos + 3 > len || xml.Substring(pos, 3) <> "k=\"" then
                                Error DecodeError.MalformedXml
                            else
                                pos <- pos + 3
                                let vStart = pos

                                while pos < len && xml.[pos] <> '"' do
                                    pos <- pos + 1

                                if pos >= len then
                                    Error DecodeError.UnexpectedEnd
                                else
                                    let raw = xml.Substring(vStart, pos - vStart)
                                    pos <- pos + 1 // closing quote
                                    unescape raw |> Result.map Some
                        else
                            Ok None

                    match attrResult with
                    | Error e -> Error e
                    | Ok attrK ->
                        let mutable selfClose = false

                        if at () = '/' then
                            selfClose <- true
                            pos <- pos + 1

                        if at () <> '>' then
                            Error DecodeError.MalformedXml
                        else
                            pos <- pos + 1
                            Ok(name, close, selfClose, attrK)

        let expectClose (name: string) : Result<unit, DecodeError> =
            match readTag () with
            | Error e -> Error e
            | Ok(n, close, selfClose, _) ->
                if (not close) || n <> name || selfClose then
                    Error DecodeError.MalformedXml
                else
                    Ok()

        // `depth` guards the per-nesting-level recursion: past the fixed bound the input is
        // rejected as data (`Error NestingTooDeep`) rather than overflowing the stack.
        let rec parseValue (depth: int) : Result<DynamicValue, DecodeError> =
            if depth > maxNestingDepth then
                Error DecodeError.NestingTooDeep
            elif at () <> '<' then
                Error DecodeError.MalformedXml
            else
                match readTag () with
                | Error e -> Error e
                | Ok(name, close, selfClose, attrK) ->
                    if close then
                        Error DecodeError.MalformedXml
                    else
                        match name with
                        | "null" -> if not selfClose then Error DecodeError.MalformedXml else Ok DynamicValue.Null
                        | "bool" ->
                            if selfClose then
                                Error DecodeError.MalformedXml
                            else
                                let text = readTextRun ()

                                expectClose "bool"
                                |> Result.bind (fun () ->
                                    if text = "true" then Ok(DynamicValue.Bool true)
                                    elif text = "false" then Ok(DynamicValue.Bool false)
                                    else Error DecodeError.MalformedXml)
                        | "int" ->
                            if selfClose then
                                Error DecodeError.MalformedXml
                            else
                                let text = readTextRun ()

                                expectClose "int"
                                |> Result.bind (fun () ->
                                    let valid =
                                        text.Length > 0
                                        && (let body = if text.[0] = '-' then text.Substring(1) else text
                                            body.Length > 0 && body |> Seq.forall (fun c -> c >= '0' && c <= '9'))

                                    if not valid then
                                        Error DecodeError.MalformedXml
                                    else
                                        match
                                            System.Int64.TryParse(
                                                text,
                                                System.Globalization.NumberStyles.AllowLeadingSign,
                                                System.Globalization.CultureInfo.InvariantCulture
                                            )
                                        with
                                        | true, n -> Ok(DynamicValue.Int n)
                                        | false, _ -> Error DecodeError.IntegerOverflow)
                        | "float" ->
                            if selfClose then
                                Error DecodeError.MalformedXml
                            else
                                let text = readTextRun ()

                                expectClose "float"
                                |> Result.bind (fun () ->
                                    // canonical = exactly 16 LOWERCASE hex (IEEE-754 f64 bits)
                                    let valid =
                                        text.Length = 16
                                        && text
                                           |> Seq.forall (fun c ->
                                               (c >= '0' && c <= '9') || (c >= 'a' && c <= 'f'))

                                    if not valid then
                                        Error DecodeError.MalformedXml
                                    else
                                        let bits =
                                            System.UInt64.Parse(
                                                text,
                                                System.Globalization.NumberStyles.HexNumber,
                                                System.Globalization.CultureInfo.InvariantCulture)

                                        Ok(DynamicValue.Float(System.BitConverter.UInt64BitsToDouble bits)))
                        | "bytes" ->
                            if selfClose then
                                Ok(DynamicValue.Bytes(ImmutableArray<byte>.Empty)) // tolerated; fixed-point rejects (canonical is <bytes></bytes>)
                            else
                                let text = readTextRun ()

                                expectClose "bytes"
                                |> Result.bind (fun () ->
                                    // canonical = even-length LOWERCASE hex
                                    let valid =
                                        text.Length % 2 = 0
                                        && text
                                           |> Seq.forall (fun c ->
                                               (c >= '0' && c <= '9') || (c >= 'a' && c <= 'f'))

                                    if not valid then
                                        Error DecodeError.MalformedXml
                                    else
                                        Ok(DynamicValue.Bytes(ImmutableArray.Create<byte>(System.Convert.FromHexString text))))
                        | "str" ->
                            if selfClose then
                                Ok(DynamicValue.String "") // tolerated; fixed-point rejects (canonical is <str></str>)
                            else
                                let raw = readTextRun ()

                                unescape raw
                                |> Result.bind (fun text -> expectClose "str" |> Result.map (fun () -> DynamicValue.String text))
                        | "arr" ->
                            if selfClose then
                                Ok(DynamicValue.Array []) // tolerated; fixed-point rejects
                            else
                                let rec loop acc =
                                    if at () = '<' && pos + 1 < len && xml.[pos + 1] = '/' then
                                        expectClose "arr" |> Result.map (fun () -> DynamicValue.Array(List.rev acc))
                                    else
                                        match parseValue (depth + 1) with
                                        | Error e -> Error e
                                        | Ok item -> loop (item :: acc)

                                loop []
                        | "obj" ->
                            if selfClose then
                                Ok(DynamicValue.Object []) // tolerated; fixed-point rejects
                            else
                                let rec loop acc =
                                    if at () = '<' && pos + 1 < len && xml.[pos + 1] = '/' then
                                        expectClose "obj" |> Result.map (fun () -> DynamicValue.Object(List.rev acc))
                                    else
                                        match readTag () with
                                        | Error e -> Error e
                                        | Ok(en, eclose, eselfClose, eattrK) ->
                                            if eclose || en <> "e" || eattrK.IsNone || eselfClose then
                                                Error DecodeError.MalformedXml
                                            else
                                                match parseValue (depth + 1) with
                                                | Error e -> Error e
                                                | Ok v ->
                                                    expectClose "e"
                                                    |> Result.bind (fun () -> loop ((eattrK.Value, v) :: acc))

                                loop []
                        | _ -> Error DecodeError.Unsupported // unknown tags

        match parseValue 0 with
        | Error e -> Error e
        | Ok value ->
            if pos <> len then
                Error DecodeError.TrailingData
            else
                // canonical fixed-point: a canonical string re-encodes to itself; anything
                // else (self-closing empties, &#x9; vs &#9;, raw whitespace) is rejected.
                match toCanonicalXml value with
                | Ok s when System.String.Equals(s, xml, System.StringComparison.Ordinal) -> Ok value
                | _ -> Error DecodeError.NonCanonical

    /// Canonical YAML encoding — the text-lock target for six shapes (Float + Bytes are DEFERRED
    /// in YAML). Object keys in INSERTION order.
    let toYaml (value: DynamicValue) : Result<string, EncodeError> =
        let rec go (depth: int) (v: DynamicValue) : Result<Zeta.Core.FSharp.Yaml.Dom.YamlValue, EncodeError> =
            if depth > maxNestingDepth then
                Error EncodeError.NestingTooDeep
            else
                match v with
                | DynamicValue.Null -> Ok Zeta.Core.FSharp.Yaml.Dom.YamlValue.VNull
                | DynamicValue.Bool b -> Ok (Zeta.Core.FSharp.Yaml.Dom.YamlValue.VBool b)
                | DynamicValue.Int i -> Ok (Zeta.Core.FSharp.Yaml.Dom.YamlValue.VInt i)
                | DynamicValue.Float f -> Ok (Zeta.Core.FSharp.Yaml.Dom.YamlValue.VFloat f)
                | DynamicValue.String s -> Ok (Zeta.Core.FSharp.Yaml.Dom.YamlValue.VStr s)
                | DynamicValue.Bytes _ -> Error EncodeError.BytesDeferred
                | DynamicValue.Array items ->
                    items
                    |> List.fold
                        (fun acc item -> acc |> Result.bind (fun parsed -> go (depth + 1) item |> Result.map (fun y -> y :: parsed)))
                        (Ok [])
                    |> Result.map (fun parsed -> Zeta.Core.FSharp.Yaml.Dom.YamlValue.VSeq (List.rev parsed))
                | DynamicValue.Object pairs ->
                    pairs
                    |> List.fold
                        (fun acc (k, v) ->
                            acc |> Result.bind (fun parsed -> go (depth + 1) v |> Result.map (fun y -> (k, y) :: parsed)))
                        (Ok [])
                    |> Result.map (fun parsed -> Zeta.Core.FSharp.Yaml.Dom.YamlValue.VMap (List.rev parsed))

        go 0 value |> Result.map Zeta.Core.FSharp.Yaml.Encoder.encode

    /// Decode canonical YAML back into a DynamicValue. Strict canonical check requires
    /// toYaml(decoded) = yaml.
    let fromYaml (yaml: string) : Result<DynamicValue, DecodeError> =
        let yaml = if System.Object.ReferenceEquals(yaml, null) then "" else yaml
        let rec go (depth: int) (y: Zeta.Core.FSharp.Yaml.Dom.YamlValue) : Result<DynamicValue, DecodeError> =
            if depth > maxNestingDepth then
                Error DecodeError.NestingTooDeep
            else
                match y with
                | Zeta.Core.FSharp.Yaml.Dom.YamlValue.VNull -> Ok DynamicValue.Null
                | Zeta.Core.FSharp.Yaml.Dom.YamlValue.VBool b -> Ok (DynamicValue.Bool b)
                | Zeta.Core.FSharp.Yaml.Dom.YamlValue.VInt i -> Ok (DynamicValue.Int i)
                | Zeta.Core.FSharp.Yaml.Dom.YamlValue.VFloat f -> Ok (DynamicValue.Float f)
                | Zeta.Core.FSharp.Yaml.Dom.YamlValue.VStr s -> Ok (DynamicValue.String s)
                | Zeta.Core.FSharp.Yaml.Dom.YamlValue.VSeq items ->
                    items
                    |> List.fold
                        (fun acc item -> acc |> Result.bind (fun parsed -> go (depth + 1) item |> Result.map (fun d -> d :: parsed)))
                        (Ok [])
                    |> Result.map (fun parsed -> DynamicValue.Array (List.rev parsed))
                | Zeta.Core.FSharp.Yaml.Dom.YamlValue.VMap pairs ->
                    pairs
                    |> List.fold
                        (fun acc (k, v) ->
                            acc |> Result.bind (fun parsed -> go (depth + 1) v |> Result.map (fun d -> (k, d) :: parsed)))
                        (Ok [])
                    |> Result.map (fun parsed -> DynamicValue.Object (List.rev parsed))

        let parsedResult =
            match Zeta.Core.FSharp.Yaml.Dom.parse yaml with
            | Ok y -> Ok y
            | Error _ -> Error DecodeError.NonCanonical

        parsedResult
        |> Result.bind (go 0)
        |> Result.bind (fun decoded ->
            match toYaml decoded with
            | Ok canonicalYaml when canonicalYaml = yaml -> Ok decoded
            | _ -> Error DecodeError.NonCanonical)


    /// Encode a DynamicValue to its canonical MessagePack representation.
    let toCanonicalMsgpack (value: DynamicValue) : byte[] =
        let buf = System.Collections.Generic.List<byte>()

        let writeHead (major: byte) (arg: uint64) =
            if arg <= 15UL && (major = 0x90uy || major = 0x80uy) then
                buf.Add(major ||| byte arg)
            elif arg <= 31UL && major = 0xa0uy then
                buf.Add(major ||| byte arg)
            elif arg <= 255UL && (major = 0xc4uy || major = 0xd9uy) then
                buf.Add(major)
                buf.Add(byte arg)
            elif arg <= 65535UL && (major = 0xc4uy || major = 0xc5uy || major = 0xd9uy || major = 0xdauy || major = 0xdcuy || major = 0xdeuy) then
                let tag = 
                    match major with
                    | 0xc4uy -> 0xc5uy
                    | 0xd9uy -> 0xdauy
                    | _ -> major
                buf.Add(tag)
                buf.Add(byte (arg >>> 8))
                buf.Add(byte arg)
            else
                let tag =
                    match major with
                    | 0xc4uy -> 0xc6uy
                    | 0xd9uy -> 0xdbuy
                    | 0xdcuy -> 0xdduy
                    | 0xdeuy -> 0xdfuy
                    | _ -> major
                buf.Add(tag)
                buf.Add(byte (arg >>> 24))
                buf.Add(byte (arg >>> 16))
                buf.Add(byte (arg >>> 8))
                buf.Add(byte arg)

        let writeInt (v: int64) =
            if v >= 0L then
                if v <= 127L then
                    buf.Add(byte v)
                elif v <= 255L then
                    buf.Add(0xccuy)
                    buf.Add(byte v)
                elif v <= 65535L then
                    buf.Add(0xcduy)
                    buf.Add(byte (v >>> 8))
                    buf.Add(byte v)
                elif v <= 4294967295L then
                    buf.Add(0xceuy)
                    buf.Add(byte (v >>> 24))
                    buf.Add(byte (v >>> 16))
                    buf.Add(byte (v >>> 8))
                    buf.Add(byte v)
                else
                    buf.Add(0xcfuy)
                    for shift in [ 56; 48; 40; 32; 24; 16; 8; 0 ] do
                        buf.Add(byte (v >>> shift))
            else
                if v >= -32L then
                    buf.Add(byte (0xe0L ||| (v &&& 0x1fL)))
                elif v >= -128L then
                    buf.Add(0xd0uy)
                    buf.Add(byte v)
                elif v >= -32768L then
                    buf.Add(0xd1uy)
                    buf.Add(byte (v >>> 8))
                    buf.Add(byte v)
                elif v >= -2147483648L then
                    buf.Add(0xd2uy)
                    buf.Add(byte (v >>> 24))
                    buf.Add(byte (v >>> 16))
                    buf.Add(byte (v >>> 8))
                    buf.Add(byte v)
                else
                    buf.Add(0xd3uy)
                    for shift in [ 56; 48; 40; 32; 24; 16; 8; 0 ] do
                        buf.Add(byte (v >>> shift))

        let writeText (s: string) =
            let utf8 = System.Text.Encoding.UTF8.GetBytes(if System.Object.ReferenceEquals(s, null) then "" else s)
            writeHead 0xa0uy (uint64 utf8.Length)
            buf.AddRange(utf8)

        let writeFloat (v: float) =
            buf.Add(0xcbuy)
            let bits = System.BitConverter.DoubleToUInt64Bits(v)
            for shift in [ 56; 48; 40; 32; 24; 16; 8; 0 ] do
                buf.Add(byte (bits >>> shift))

        let rec write (valObj: DynamicValue) =
            match valObj with
            | DynamicValue.Null -> buf.Add(0xc0uy)
            | DynamicValue.Bool b -> buf.Add(if b then 0xc3uy else 0xc2uy)
            | DynamicValue.Int i -> writeInt i
            | DynamicValue.Float f -> writeFloat f
            | DynamicValue.String s -> writeText s
            | DynamicValue.Bytes bytes ->
                let b = if bytes.IsDefault then ImmutableArray.Empty else bytes
                writeHead 0xc4uy (uint64 b.Length)
                buf.AddRange(b)
            | DynamicValue.Array items ->
                writeHead 0x90uy (uint64 (List.length items))
                for item in items do
                    write item
            | DynamicValue.Object pairs ->
                writeHead 0x80uy (uint64 (List.length pairs))
                for (k, value) in pairs do
                    writeText k
                    write value

        write value
        buf.ToArray()

    /// Decode canonical MessagePack bytes back into a DynamicValue.
    let fromCanonicalMsgpack (bytes: byte[]) : Result<DynamicValue, DecodeError> =
        let mutable pos = 0

        let readBE (n: int) : uint64 =
            let mutable v = 0UL
            for i in 0 .. n - 1 do
                v <- (v <<< 8) ||| uint64 bytes.[pos + i]
            pos <- pos + n
            v

        let readArg (ai: int) (n8: int) (n16: int) (n32: int) : Result<uint64, DecodeError> =
            let n =
                if ai = n8 then 1
                elif ai = n16 then 2
                elif ai = n32 then 4
                else -1
            if n < 0 then Error DecodeError.Unsupported
            elif pos + n > bytes.Length then Error DecodeError.UnexpectedEnd
            else Ok (readBE n)

        let rec readValue () : Result<DynamicValue, DecodeError> =
            if pos >= bytes.Length then
                Error DecodeError.UnexpectedEnd
            else
                let initial = int bytes.[pos]
                pos <- pos + 1
                if initial <= 0x7f then
                    Ok (DynamicValue.Int (int64 initial))
                elif initial >= 0x80 && initial <= 0x8f then
                    readMap (initial &&& 0x0f)
                elif initial >= 0x90 && initial <= 0x9f then
                    readArray (initial &&& 0x0f)
                elif initial >= 0xa0 && initial <= 0xbf then
                    readTextString (uint64 (initial &&& 0x1f))
                elif initial >= 0xe0 then
                    Ok (DynamicValue.Int (int64 (initial - 256)))
                else
                    match initial with
                    | 0xc0 -> Ok DynamicValue.Null
                    | 0xc2 -> Ok (DynamicValue.Bool false)
                    | 0xc3 -> Ok (DynamicValue.Bool true)
                    | 0xc4 ->
                        match readArg 0xc4 0xc4 -1 -1 with
                        | Ok len -> readByteString len
                        | Error e -> Error e
                    | 0xc5 ->
                        if pos + 2 > bytes.Length then Error DecodeError.UnexpectedEnd
                        else readByteString (readBE 2)
                    | 0xc6 ->
                        if pos + 4 > bytes.Length then Error DecodeError.UnexpectedEnd
                        else readByteString (readBE 4)
                    | 0xca ->
                        if pos + 4 > bytes.Length then Error DecodeError.UnexpectedEnd
                        else
                            let bits = uint32 (readBE 4)
                            let f = System.BitConverter.UInt32BitsToSingle(bits)
                            Ok (DynamicValue.Float (float f))
                    | 0xcb ->
                        if pos + 8 > bytes.Length then Error DecodeError.UnexpectedEnd
                        else
                            let bits = readBE 8
                            let f = System.BitConverter.UInt64BitsToDouble(bits)
                            Ok (DynamicValue.Float f)
                    | 0xcc ->
                        if pos + 1 > bytes.Length then Error DecodeError.UnexpectedEnd
                        else Ok (DynamicValue.Int (int64 (readBE 1)))
                    | 0xcd ->
                        if pos + 2 > bytes.Length then Error DecodeError.UnexpectedEnd
                        else Ok (DynamicValue.Int (int64 (readBE 2)))
                    | 0xce ->
                        if pos + 4 > bytes.Length then Error DecodeError.UnexpectedEnd
                        else Ok (DynamicValue.Int (int64 (readBE 4)))
                    | 0xcf ->
                        if pos + 8 > bytes.Length then Error DecodeError.UnexpectedEnd
                        else
                            let bits = readBE 8
                            if bits > uint64 System.Int64.MaxValue then Error DecodeError.IntegerOverflow
                            else Ok (DynamicValue.Int (int64 bits))
                    | 0xd0 ->
                        if pos + 1 > bytes.Length then Error DecodeError.UnexpectedEnd
                        else
                            let mutable val8 = int64 (readBE 1)
                            if val8 >= 128L then val8 <- val8 - 256L
                            Ok (DynamicValue.Int val8)
                    | 0xd1 ->
                        if pos + 2 > bytes.Length then Error DecodeError.UnexpectedEnd
                        else
                            let mutable val16 = int64 (readBE 2)
                            if val16 >= 32768L then val16 <- val16 - 65536L
                            Ok (DynamicValue.Int val16)
                    | 0xd2 ->
                        if pos + 4 > bytes.Length then Error DecodeError.UnexpectedEnd
                        else
                            let mutable val32 = int64 (readBE 4)
                            if val32 >= 2147483648L then val32 <- val32 - 4294967296L
                            Ok (DynamicValue.Int val32)
                    | 0xd3 ->
                        if pos + 8 > bytes.Length then Error DecodeError.UnexpectedEnd
                        else
                            let bits = readBE 8
                            Ok (DynamicValue.Int (int64 bits))
                    | 0xd9 ->
                        if pos + 1 > bytes.Length then Error DecodeError.UnexpectedEnd
                        else readTextString (readBE 1)
                    | 0xda ->
                        if pos + 2 > bytes.Length then Error DecodeError.UnexpectedEnd
                        else readTextString (readBE 2)
                    | 0xdb ->
                        if pos + 4 > bytes.Length then Error DecodeError.UnexpectedEnd
                        else readTextString (readBE 4)
                    | 0xdc ->
                        if pos + 2 > bytes.Length then Error DecodeError.UnexpectedEnd
                        else readArray (int (readBE 2))
                    | 0xdd ->
                        if pos + 4 > bytes.Length then Error DecodeError.UnexpectedEnd
                        else readArray (int (readBE 4))
                    | 0xde ->
                        if pos + 2 > bytes.Length then Error DecodeError.UnexpectedEnd
                        else readMap (int (readBE 2))
                    | 0xdf ->
                        if pos + 4 > bytes.Length then Error DecodeError.UnexpectedEnd
                        else readMap (int (readBE 4))
                    | _ -> Error DecodeError.Unsupported

        and readByteString (len: uint64) : Result<DynamicValue, DecodeError> =
            if len > uint64 (bytes.Length - pos) then
                Error DecodeError.UnexpectedEnd
            else
                let n = int len
                let slice = Array.sub bytes pos n
                pos <- pos + n
                Ok (DynamicValue.Bytes (ImmutableArray.Create<byte>(slice)))

        and readTextString (len: uint64) : Result<DynamicValue, DecodeError> =
            if len > uint64 (bytes.Length - pos) then
                Error DecodeError.UnexpectedEnd
            else
                let n = int len
                let s = System.Text.Encoding.UTF8.GetString(bytes, pos, n)
                pos <- pos + n
                Ok (DynamicValue.String s)

        and readArray (len: int) : Result<DynamicValue, DecodeError> =
            if len > bytes.Length - pos then
                Error DecodeError.UnexpectedEnd
            else
                let rec loop i acc =
                    if i >= len then
                        Ok (DynamicValue.Array (List.rev acc))
                    else
                        match readValue () with
                        | Error e -> Error e
                        | Ok item -> loop (i + 1) (item :: acc)
                loop 0 []

        and readMap (len: int) : Result<DynamicValue, DecodeError> =
            if len > (bytes.Length - pos) / 2 then
                Error DecodeError.UnexpectedEnd
            else
                let rec loop i acc =
                    if i >= len then
                        Ok (DynamicValue.Object (List.rev acc))
                    else
                        match readValue () with
                        | Error e -> Error e
                        | Ok (DynamicValue.String k) ->
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
            elif toCanonicalMsgpack value <> bytes then
                Error DecodeError.NonCanonical
            else
                Ok value

