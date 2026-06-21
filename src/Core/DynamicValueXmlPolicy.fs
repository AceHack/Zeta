namespace Zeta.Core

/// **DynamicValueXmlPolicy — instance-1 of the policy/fold kernel.**
///
/// Policy-parameterized STRUCTURED XML: the canonical XML codec
/// (`DynamicValue.toCanonicalXml`) renders every Object entry generically as
/// `<e k="KEY">VALUE</e>`. This codec adds ONE degree of freedom — a policy that
/// decides, PER Object key, whether to promote that entry to a NAMED element
/// `<KEY>VALUE</KEY>` instead. The policy is a
/// `Policy<ShapeContext, XmlPlacement, string>` from the policy kernel
/// (`Policy.fs`, 081KT7YW00008QG0R003N6PF8A #1): given a `ShapeContext` (the serialization junction:
/// path, key, kind) it SELECTS a typed `XmlPlacement` and attaches a `string`
/// feedback (the *why*). The policy only SELECTS; this codec ACTS on the
/// decision — the same decision-over-shape algebra reused at the serialization
/// junction, now carrying a typed decision + auditable reason, not a bare bool.
///
/// This is the "add ontology by a filter over the fold" capability: the structure
/// is produced by `DynamicValueFold.cata` (File 2), and the policy is the filter.
/// Only the fully-bijective NAMED-ELEMENT slice is built here; attribute-promotion
/// (rendering a scalar key as an XML attribute) is a backlogged later slice — it
/// carries element-order and value-type caveats that break clean bijection.
///
/// **Bijection / collision rule.** A named key could collide with a value-tag name
/// (`null bool int float str bytes arr obj e`); if it did, decode could not tell a
/// named entry `<int>…</int>` from a value node. So named-promotion EXCLUDES those
/// nine reserved names (and any key that is not a valid XML Name) — such keys fall
/// back to the generic `<e k="…">` form. With that exclusion, decode is
/// unambiguous and `fromStructuredXml p (toStructuredXml p dv) = Ok dv` holds for
/// every `dv` (a promoted key is always a valid, non-reserved XML Name).
[<RequireQualifiedAccess>]
module DynamicValueXmlPolicy =

    /// The typed structure DECISION a policy selects for an Object entry:
    /// promote it to a named element `<KEY>…</KEY>` or render it as the canonical
    /// generic `<e k="KEY">…</e>`. (`Attribute` is a backlogged later slice — not
    /// added here.)
    type XmlPlacement =
        | NamedElement
        | GenericElement

    /// Instance-1 of the policy kernel: a policy from a serialization-junction
    /// `ShapeContext` to an `XmlPlacement` decision, carrying a `string`
    /// feedback (the why). The policy SELECTS; `toStructuredXml` ACTS.
    type XmlStructurePolicy = Policy.Policy<DynamicValueFold.ShapeContext, XmlPlacement, string>

    /// The nine value-tag names the canonical XML grammar reserves. A key equal to
    /// one of these is NEVER promoted (it would be indistinguishable from a value
    /// node on decode); it renders generically.
    let private reservedTagNames: Set<string> =
        set [ "null"; "bool"; "int"; "float"; "str"; "bytes"; "arr"; "obj"; "e" ]

    let private isNameStart (c: char) : bool =
        (c >= 'a' && c <= 'z') || (c >= 'A' && c <= 'Z') || c = '_'

    let private isNameChar (c: char) : bool =
        isNameStart c || (c >= '0' && c <= '9') || c = '-' || c = '.'

    /// True iff `key` is a valid XML Name for our purposes: non-empty, starts with a
    /// letter/underscore, every char is a name char, and does not begin with "xml"
    /// (any case — XML 1.0 §2.3 reserves it).
    let private isValidXmlName (key: string) : bool =
        not (System.String.IsNullOrEmpty key)
        && isNameStart key.[0]
        && key |> Seq.forall isNameChar
        && not (key.Length >= 3 && key.Substring(0, 3).ToLowerInvariant() = "xml")

    /// Convenience constructor preserving today's behavior + adding feedback: a
    /// policy that promotes exactly the keys in `keys`, subject to the validity +
    /// reserved-name guards, and reports the specific reason as feedback. For an
    /// Object-entry `ShapeContext` (one carrying `Key = Some k`): if `k` is in the
    /// set AND a valid XML Name AND not a reserved value-tag name → `NamedElement`
    /// with "named: key in policy set"; otherwise `GenericElement` with the
    /// specific reason (reserved-tag / invalid-name / not-in-policy). A context
    /// with no key (a non-entry node) is never named.
    let namedKeys (keys: Set<string>) : XmlStructurePolicy =
        fun (ctx: DynamicValueFold.ShapeContext) ->
            match ctx.Key with
            | None -> Policy.result GenericElement "generic: no object key (non-entry node)"
            | Some k ->
                if not (Set.contains k keys) then
                    Policy.result GenericElement "generic: not-in-policy"
                elif Set.contains k reservedTagNames then
                    Policy.result GenericElement "generic: reserved-tag"
                elif not (isValidXmlName k) then
                    Policy.result GenericElement "generic: invalid-name"
                else
                    Policy.result NamedElement "named: key in policy set"

    /// Escape an Object key as an XML attribute value, mirroring the canonical codec's
    /// (private) `escapeXmlAttr`: `& < > "` as entities; `\t \n \r` as char-refs. A
    /// forbidden C0 char (NUL or a C0 control other than \t \n \r) is NOT XML-1.0
    /// representable → `NonRepresentable`, the same boundary the canonical codec hits.
    let private escapeKeyAttr (key: string) : Result<string, EncodeError> =
        let sb = System.Text.StringBuilder(key.Length)
        let mutable err = false
        for ch in key do
            if not err then
                match ch with
                | '&' -> sb.Append("&amp;") |> ignore
                | '<' -> sb.Append("&lt;") |> ignore
                | '>' -> sb.Append("&gt;") |> ignore
                | '"' -> sb.Append("&quot;") |> ignore
                | '\t' -> sb.Append("&#9;") |> ignore
                | '\n' -> sb.Append("&#10;") |> ignore
                | '\r' -> sb.Append("&#13;") |> ignore
                | c when int c < 0x20 -> err <- true
                | c -> sb.Append(c) |> ignore
        if err then Error EncodeError.NonRepresentable else Ok(sb.ToString())

    /// Render `dv` as policy-structured XML. Identical to `DynamicValue.toCanonicalXml`
    /// EXCEPT each Object entry for which the policy SELECTS `NamedElement` becomes
    /// `<KEY>INNER</KEY>` (INNER = the canonical XML of the value) instead of
    /// `<e k="ESC">INNER</e>`. Implemented as a direct, path-aware recursion so the
    /// `ShapePath` (root→node, document order) can be threaded into each entry's
    /// `ShapeContext`; the policy is consulted per Object entry and only its
    /// `Decision` is acted on (the policy SELECTS, this codec ACTS). Non-object
    /// nodes reuse the exact canonical rendering. Surfaced as data, never thrown.
    let toStructuredXml (policy: XmlStructurePolicy) (dv: DynamicValue) : Result<string, EncodeError> =
        let combine (parts: Result<string, EncodeError> list) (wrap: string list -> string) : Result<string, EncodeError> =
            parts
            |> List.fold (fun acc p -> acc |> Result.bind (fun xs -> p |> Result.map (fun x -> x :: xs))) (Ok [])
            |> Result.map (fun xs -> wrap (List.rev xs))

        // path = document-order steps from the root to THIS node (head outermost).
        let rec render (path: DynamicValueFold.ShapePath) (value: DynamicValue) : Result<string, EncodeError> =
            match value with
            | DynamicValue.Array items ->
                items
                |> List.mapi (fun i item -> render (path @ [ DynamicValueFold.Index i ]) item)
                |> fun parts -> combine parts (fun xs -> "<arr>" + System.String.Concat xs + "</arr>")
            | DynamicValue.Object pairs ->
                pairs
                |> List.map (fun (k, v) ->
                    let entryPath = path @ [ DynamicValueFold.Key k ]
                    let ctx: DynamicValueFold.ShapeContext =
                        { Path = entryPath
                          Key = Some k
                          Kind = DynamicValueFold.kindOf v }
                    render entryPath v
                    |> Result.bind (fun innerXml ->
                        match (policy ctx).Decision with
                        | NamedElement -> Ok("<" + k + ">" + innerXml + "</" + k + ">")
                        | GenericElement ->
                            escapeKeyAttr k
                            |> Result.map (fun ke -> "<e k=\"" + ke + "\">" + innerXml + "</e>")))
                |> fun entries -> combine entries (fun xs -> "<obj>" + System.String.Concat xs + "</obj>")
            // leaves: exact canonical rendering, no policy involvement.
            | leaf -> DynamicValue.toCanonicalXml leaf

        render [] dv

    // ───────────────────────── decode ─────────────────────────
    // A self-contained structured-XML parser. It differs from the canonical XML
    // grammar ONLY at Object entries: a child whose tag is `e` (with a k="…"
    // attribute) is a generic entry; any other tag whose name is NOT one of the nine
    // reserved value-tag names is a NAMED entry with that tag as its key. Everything
    // else (the value nodes null/bool/int/float/str/bytes/arr, and the recursion) is
    // parsed exactly as the canonical grammar does. After a structural parse we run a
    // fixed-point check (`toStructuredXml policy parsed = input`) so any non-canonical
    // spelling is rejected — the same discipline `DynamicValue.fromCanonicalXml` uses.

    /// Inverse of `toStructuredXml` under the SAME policy: parse policy-structured XML
    /// back to a `DynamicValue`. A child `<e k="…">` is a generic Object entry; any
    /// other (non-reserved) tag inside `<obj>` is a NAMED entry keyed by its tag name.
    /// Strictly canonical: a structural parse then a fixed-point check
    /// (`toStructuredXml policy parsed = input`) rejects non-canonical spellings as
    /// `NonCanonical`. Surfaced as data, never thrown.
    let fromStructuredXml (policy: XmlStructurePolicy) (xml: string) : Result<DynamicValue, DecodeError> =
        let mutable pos = 0
        let len = xml.Length
        let at () : char = if pos < len then xml.[pos] else ' '

        // unescape XML content/attribute (decimal + hex char-refs, named entities).
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
                                if radix = 16 then System.Globalization.NumberStyles.AllowHexSpecifier
                                else System.Globalization.NumberStyles.None
                            match System.Int32.TryParse(digits, style, System.Globalization.CultureInfo.InvariantCulture) with
                            | true, code when code >= 0 && code <= 0x10ffff -> sb.Append(System.Char.ConvertFromUtf32 code) |> ignore
                            | _ -> err <- true
                        if ent = "amp" then sb.Append('&') |> ignore
                        elif ent = "lt" then sb.Append('<') |> ignore
                        elif ent = "gt" then sb.Append('>') |> ignore
                        elif ent = "quot" then sb.Append('"') |> ignore
                        elif ent = "apos" then sb.Append('\'') |> ignore
                        elif ent.Length > 0 && ent.[0] = '#' then
                            let isHex = ent.Length > 1 && (ent.[1] = 'x' || ent.[1] = 'X')
                            let digits = if isHex then ent.Substring 2 else ent.Substring 1
                            let allValid =
                                digits.Length > 0
                                && (if isHex then digits |> Seq.forall System.Uri.IsHexDigit
                                    else digits |> Seq.forall (fun c -> c >= '0' && c <= '9'))
                            if not allValid then err <- true else appendCode digits (if isHex then 16 else 10)
                        else
                            err <- true
                        i <- semi + 1
            if err then Error DecodeError.MalformedXml else Ok(sb.ToString())

        let readTextRun () : string =
            let start = pos
            while pos < len && xml.[pos] <> '<' do
                pos <- pos + 1
            xml.Substring(start, pos - start)

        // Parse one tag. The tag NAME may now be any XML Name (named keys are
        // arbitrary names), not just the lowercase value tags — so scan name chars.
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
                while pos < len && isNameChar xml.[pos] do
                    pos <- pos + 1
                let name = xml.Substring(nameStart, pos - nameStart)
                if name.Length = 0 then
                    Error DecodeError.MalformedXml
                else
                    let attrResult: Result<string option, DecodeError> =
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
                                    pos <- pos + 1
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
                if (not close) || n <> name || selfClose then Error DecodeError.MalformedXml else Ok()

        let parseScalarBody (name: string) (selfClose: bool) : Result<DynamicValue, DecodeError> =
            match name with
            | "null" -> if not selfClose then Error DecodeError.MalformedXml else Ok DynamicValue.Null
            | "bool" ->
                if selfClose then Error DecodeError.MalformedXml
                else
                    let text = readTextRun ()
                    expectClose "bool"
                    |> Result.bind (fun () ->
                        if text = "true" then Ok(DynamicValue.Bool true)
                        elif text = "false" then Ok(DynamicValue.Bool false)
                        else Error DecodeError.MalformedXml)
            | "int" ->
                if selfClose then Error DecodeError.MalformedXml
                else
                    let text = readTextRun ()
                    expectClose "int"
                    |> Result.bind (fun () ->
                        let valid =
                            text.Length > 0
                            && (let body = if text.[0] = '-' then text.Substring 1 else text
                                body.Length > 0 && body |> Seq.forall (fun c -> c >= '0' && c <= '9'))
                        if not valid then Error DecodeError.MalformedXml
                        else
                            match System.Int64.TryParse(text, System.Globalization.NumberStyles.AllowLeadingSign, System.Globalization.CultureInfo.InvariantCulture) with
                            | true, n -> Ok(DynamicValue.Int n)
                            | false, _ -> Error DecodeError.IntegerOverflow)
            | "float" ->
                if selfClose then Error DecodeError.MalformedXml
                else
                    let text = readTextRun ()
                    expectClose "float"
                    |> Result.bind (fun () ->
                        let valid = text.Length = 16 && text |> Seq.forall (fun c -> (c >= '0' && c <= '9') || (c >= 'a' && c <= 'f'))
                        if not valid then Error DecodeError.MalformedXml
                        else
                            let bits = System.UInt64.Parse(text, System.Globalization.NumberStyles.HexNumber, System.Globalization.CultureInfo.InvariantCulture)
                            Ok(DynamicValue.Float(System.BitConverter.UInt64BitsToDouble bits)))
            | "bytes" ->
                if selfClose then Ok(DynamicValue.Bytes(System.Collections.Immutable.ImmutableArray<byte>.Empty))
                else
                    let text = readTextRun ()
                    expectClose "bytes"
                    |> Result.bind (fun () ->
                        let valid = text.Length % 2 = 0 && text |> Seq.forall (fun c -> (c >= '0' && c <= '9') || (c >= 'a' && c <= 'f'))
                        if not valid then Error DecodeError.MalformedXml
                        else Ok(DynamicValue.Bytes(System.Collections.Immutable.ImmutableArray.Create<byte>(System.Convert.FromHexString text))))
            | "str" ->
                if selfClose then Ok(DynamicValue.String "")
                else
                    let raw = readTextRun ()
                    unescape raw |> Result.bind (fun text -> expectClose "str" |> Result.map (fun () -> DynamicValue.String text))
            | _ -> Error DecodeError.Unsupported

        let rec parseValue () : Result<DynamicValue, DecodeError> =
            if at () <> '<' then
                Error DecodeError.MalformedXml
            else
                match readTag () with
                | Error e -> Error e
                | Ok(name, close, selfClose, attrK) ->
                    if close then Error DecodeError.MalformedXml
                    elif attrK.IsSome then
                        // only <e k="…"> carries an attribute at the value position;
                        // a value node never does.
                        Error DecodeError.MalformedXml
                    else
                        match name with
                        | "arr" ->
                            if selfClose then Ok(DynamicValue.Array [])
                            else
                                let rec loop acc =
                                    if at () = '<' && pos + 1 < len && xml.[pos + 1] = '/' then
                                        expectClose "arr" |> Result.map (fun () -> DynamicValue.Array(List.rev acc))
                                    else
                                        match parseValue () with
                                        | Error e -> Error e
                                        | Ok item -> loop (item :: acc)
                                loop []
                        | "obj" ->
                            if selfClose then Ok(DynamicValue.Object [])
                            else parseObjectEntries []
                        | _ -> parseScalarBody name selfClose

        and parseObjectEntries (acc: (string * DynamicValue) list) : Result<DynamicValue, DecodeError> =
            if at () = '<' && pos + 1 < len && xml.[pos + 1] = '/' then
                expectClose "obj" |> Result.map (fun () -> DynamicValue.Object(List.rev acc))
            else
                match readTag () with
                | Error e -> Error e
                | Ok(en, eclose, eselfClose, eattrK) ->
                    if eclose || eselfClose then
                        Error DecodeError.MalformedXml
                    elif en = "e" then
                        // generic entry: <e k="KEY">VALUE</e>
                        match eattrK with
                        | None -> Error DecodeError.MalformedXml
                        | Some key ->
                            match parseValue () with
                            | Error e -> Error e
                            | Ok v -> expectClose "e" |> Result.bind (fun () -> parseObjectEntries ((key, v) :: acc))
                    elif eattrK.IsSome || Set.contains en reservedTagNames then
                        // a value-tag name as an entry tag, or an attribute on a named
                        // entry — neither is a valid named entry.
                        Error DecodeError.MalformedXml
                    else
                        // named entry: <NAME>VALUE</NAME>, key = NAME
                        match parseValue () with
                        | Error e -> Error e
                        | Ok v -> expectClose en |> Result.bind (fun () -> parseObjectEntries ((en, v) :: acc))

        match parseValue () with
        | Error e -> Error e
        | Ok value ->
            if pos <> len then Error DecodeError.TrailingData
            else
                // fixed-point: re-encode under the SAME policy; canonical iff it round-trips.
                match toStructuredXml policy value with
                | Ok s when System.String.Equals(s, xml, System.StringComparison.Ordinal) -> Ok value
                | _ -> Error DecodeError.NonCanonical
