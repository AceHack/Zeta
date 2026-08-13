namespace Zeta.Core

open System
open System.Text

// ═══════════════════════════════════════════════════════════════════
//  SchemaLogCodec — CANONICAL PERSISTENCE for the schema event log
//  (081KYWE8Q4008QG0R000H558SH, increment 2: the "log persistence /
//  serialisation" + "golden vectors" the increment-1 STATUS left open).
//
//  The log IS the schema (its fold), so the log's serialised form is
//  the schema's durable form — what a zetadb stored-proc surface
//  writes, ships, and replays. The codec is therefore held to the same
//  discipline as the algebra it persists:
//   • CANONICAL — one log, one byte string. `encode` is deterministic
//     (no map iteration, no culture, no clock); `decode ∘ encode = Ok`
//     is a quantified round-trip law, and the exact bytes of a fixed
//     log are GOLDEN-VECTOR-LOCKED in SchemaLogCodec.Tests.fs so a
//     drifted encoder fails loudly, in every oracle that replays the
//     vectors (C#/TS/Rust parity rides these same strings).
//   • INJECTIVE — field names and event ids are arbitrary strings, so
//     the record/field separators are escaped (`\` `\t` `\n` `\r` →
//     `\\` `\t`-escape `\n`-escape `\r`-escape). Escaping, not
//     rejection: the algebra above accepts any ordinal string as a
//     name, so the codec must carry any ordinal string, not carve out
//     a "safe" subset the layers would then disagree on.
//   • VERSIONED — line 1 is the format sentinel `zschemalog/1`. A
//     future format bumps the sentinel; a decoder never guesses.
//   • LOUD — `decode` is all-or-nothing `Result`: every malformed line
//     is reported with its 1-based line number, and NOTHING is
//     skipped. A skipped line in a schema log is a silently different
//     schema — the exact failure class the Z-set fold exists to make
//     arithmetic-visible.
//
//  Format v1 (text, `\n` record separator, `\t` field separator):
//    line 1:  zschemalog/1
//    line n:  <eventId> TAB <opTag> TAB <args…>      (all strings escaped)
//      add    TAB name TAB type
//      drop   TAB name TAB type
//      rename TAB from TAB to TAB type
//      retype TAB name TAB fromType TAB toType
//  Type names are the stable schema↔dispatch bridge tags
//  (`ZAtomType.ofDynamicValueType`): null bool int float string bytes
//  array object. Text over binary is deliberate for v1: the log is a
//  git-native substrate citizen (diffable, mergeable, greppable);
//  size-critical transports can layer compression, not a second format.
//
//  Anchors (Beacon): event-sourcing canonical logs (Fowler 2005);
//  RFC 4180's lesson (unescaped separators are the classic corpus
//  corruption); Codd 1970 (schema as data ⇒ schema has a wire form).
// ═══════════════════════════════════════════════════════════════════

/// Why a persisted log did not decode. Every case carries the 1-based
/// line number — the log is append-only, so the line number is the
/// event's stable position, actionable in any tooling.
type SchemaLogCodecError =
    /// Line 1 is not the recognised format sentinel.
    | UnknownFormat of foundHeader: string
    /// The line does not parse as an event (wrong field count, unknown
    /// op tag, unknown type name, or a dangling escape). The payload
    /// names the offence exactly.
    | MalformedLine of lineNumber: int * offence: string

[<RequireQualifiedAccess>]
module SchemaLogCodec =

    [<Literal>]
    let private Header = "zschemalog/1"

    // ── escaping (injective on arbitrary ordinal strings) ─────────────

    let private escape (s: string) : string =
        let sb = StringBuilder(s.Length)
        for c in s do
            match c with
            | '\\' -> sb.Append "\\\\" |> ignore
            | '\t' -> sb.Append "\\t" |> ignore
            | '\n' -> sb.Append "\\n" |> ignore
            | '\r' -> sb.Append "\\r" |> ignore
            | c -> sb.Append c |> ignore
        sb.ToString()

    let private unescape (s: string) : Result<string, string> =
        let sb = StringBuilder(s.Length)
        let mutable i = 0
        let mutable err = None
        while err.IsNone && i < s.Length do
            if s.[i] = '\\' then
                if i + 1 >= s.Length then
                    err <- Some "dangling escape '\\' at end of field"
                else
                    (match s.[i + 1] with
                     | '\\' -> sb.Append '\\' |> ignore
                     | 't' -> sb.Append '\t' |> ignore
                     | 'n' -> sb.Append '\n' |> ignore
                     | 'r' -> sb.Append '\r' |> ignore
                     | c -> err <- Some(String.Concat("unknown escape '\\", string c, "'")))
                    i <- i + 2
            else
                sb.Append s.[i] |> ignore
                i <- i + 1
        match err with
        | Some e -> Error e
        | None -> Ok(sb.ToString())

    // ── the stable type-name bridge, both directions ──────────────────

    /// Inverse of `ZAtomType.ofDynamicValueType` — total over the eight
    /// stable tags, `Error` (never a guess) on anything else. Lives here
    /// because the codec is the first consumer that must READ the bridge;
    /// the writing direction stays in `ZAtomType`.
    [<CompiledName "TryParseTypeName">]
    let tryParseTypeName (name: string) : Result<DynamicValueType, string> =
        match name with
        | "null" -> Ok DynamicValueType.Null
        | "bool" -> Ok DynamicValueType.Bool
        | "int" -> Ok DynamicValueType.Int
        | "float" -> Ok DynamicValueType.Float
        | "string" -> Ok DynamicValueType.String
        | "bytes" -> Ok DynamicValueType.Bytes
        | "array" -> Ok DynamicValueType.Array
        | "object" -> Ok DynamicValueType.Object
        | other -> Error(String.Concat("unknown type name '", other, "'"))

    // ── encode ────────────────────────────────────────────────────────

    let private encodeOp (op: SchemaOp) : string =
        let ty (t: DynamicValueType) = ZAtomType.ofDynamicValueType t
        match op with
        | AddField f -> String.Join("\t", "add", escape f.Name, ty f.Type)
        | DropField f -> String.Join("\t", "drop", escape f.Name, ty f.Type)
        | RenameField (fromName, toName, t) -> String.Join("\t", "rename", escape fromName, escape toName, ty t)
        | RetypeField (name, fromTy, toTy) -> String.Join("\t", "retype", escape name, ty fromTy, ty toTy)

    /// Serialise a log to its canonical v1 text. Deterministic byte-for-
    /// byte: same log, same string — the golden-vector contract.
    [<CompiledName "Encode">]
    let encode (log: SchemaEvent seq) : string =
        let sb = StringBuilder()
        sb.Append Header |> ignore
        for e in log do
            sb.Append '\n' |> ignore
            sb.Append(escape e.EventId).Append('\t').Append(encodeOp e.Op) |> ignore
        sb.ToString()

    // ── decode ────────────────────────────────────────────────────────

    let private decodeLine (lineNo: int) (line: string) : Result<SchemaEvent, SchemaLogCodecError> =
        let mal (offence: string) = Error(MalformedLine(lineNo, offence))
        let fields = line.Split '\t'
        let unesc (raw: string) (k: string -> Result<SchemaEvent, SchemaLogCodecError>) =
            match unescape raw with
            | Error e -> mal e
            | Ok v -> k v
        let parseTy (raw: string) (k: DynamicValueType -> Result<SchemaEvent, SchemaLogCodecError>) =
            match tryParseTypeName raw with
            | Error e -> mal e
            | Ok t -> k t
        match fields with
        | [| id; "add"; name; t |] ->
            unesc id (fun id ->
                unesc name (fun name ->
                    parseTy t (fun t -> Ok { EventId = id; Op = AddField { Name = name; Type = t } })))
        | [| id; "drop"; name; t |] ->
            unesc id (fun id ->
                unesc name (fun name ->
                    parseTy t (fun t -> Ok { EventId = id; Op = DropField { Name = name; Type = t } })))
        | [| id; "rename"; fromName; toName; t |] ->
            unesc id (fun id ->
                unesc fromName (fun fromName ->
                    unesc toName (fun toName ->
                        parseTy t (fun t -> Ok { EventId = id; Op = RenameField(fromName, toName, t) }))))
        | [| id; "retype"; name; fromT; toT |] ->
            unesc id (fun id ->
                unesc name (fun name ->
                    parseTy fromT (fun fromT ->
                        parseTy toT (fun toT -> Ok { EventId = id; Op = RetypeField(name, fromT, toT) }))))
        | fs when fs.Length >= 2 ->
            match fs.[1] with
            | "add" | "drop" | "rename" | "retype" ->
                mal (String.Concat("wrong field count for op '", fs.[1], "'"))
            | tag -> mal (String.Concat("unknown op tag '", tag, "'"))
        | _ -> mal "expected <eventId> TAB <op> TAB <args…>"

    /// Decode a canonical v1 text back to the log. All-or-nothing: every
    /// malformed line is listed with its line number; a header mismatch
    /// fails before any line is read (a decoder never guesses formats).
    [<CompiledName "Decode">]
    let decode (text: string) : Result<SchemaLog, SchemaLogCodecError list> =
        if isNull text then
            Error [ UnknownFormat "<null>" ]
        else
            let lines = text.Split '\n'
            if lines.Length = 0 || not (String.Equals(lines.[0], Header, StringComparison.Ordinal)) then
                Error [ UnknownFormat(if lines.Length = 0 then "" else lines.[0]) ]
            else
                let results =
                    [ for i in 1 .. lines.Length - 1 do
                        // A single trailing newline (common POSIX tail) yields one
                        // empty final segment — tolerated; empty INTERIOR lines are
                        // malformed (a truncated/spliced log must not shift positions).
                        if not (i = lines.Length - 1 && lines.[i].Length = 0) then
                            yield decodeLine (i + 1) lines.[i] ]
                let errors = results |> List.choose (function Error e -> Some e | Ok _ -> None)
                if not (List.isEmpty errors) then Error errors
                else Ok(results |> List.choose (function Ok e -> Some e | Error _ -> None))
