// Layer 1: forward-only one-pass YamlReader.
//
// Scans the text ONCE and emits a flat YamlEvent stream. It NEVER materializes a tree --
// only an indent/context stack. This is the Utf8JsonReader-vs-JsonDocument split: the DOM
// (YamlValue + parse, in Dom.fs) is a separate fold built ON TOP of this event stream.
//
// Faithful port of the TS reference src/Core.TypeScript/yaml/reader.ts (oracle #1) and the
// Rust oracle src/Core.Rust.Yaml/src/reader.rs (oracle #2). The event sequence is the
// cross-language contract; this oracle reproduces it byte-identically.
//
// Subset only (config-friendly YAML). Out-of-subset constructs decline cleanly via the
// typed YamlFeedback channel (Result over throw) so a caller can fall back to a vendor
// adapter. See the LOCKED cross-language contracts in
// docs/agendas/ace-package-manager/2026-06-01-yaml-port-implementation-plan.md.
//
// Authored as `namespace Zeta.Core.FSharp.Yaml` + `[<AutoOpen>] module Reader` (rather than
// a bare top-level `module Zeta.Core.FSharp.Yaml`) so a sibling `module
// Zeta.Core.FSharp.Yaml.Dom` (Dom.fs) can share the namespace without the FS0247
// module/namespace clash. With `[<AutoOpen>]`, `open Zeta.Core.FSharp.Yaml` surfaces every
// reader symbol unqualified -- identical ergonomics to a top-level module.

namespace Zeta.Core.FSharp.Yaml

[<AutoOpen>]
module Reader =

    /// Scalar type resolved from a PLAIN scalar's text (quoted scalars are always Str).
    type ScalarKind =
        /// "", ~, null, Null, NULL.
        | Null
        /// true/True/TRUE/false/False/FALSE.
        | Bool
        /// ^-?[0-9]+$.
        | Int
        /// ^-?[0-9]+\.[0-9]+([eE][-+]?[0-9]+)?$.
        | Float
        /// Anything else (and every quoted scalar).
        | Str

    /// How a scalar was written in the source.
    type ScalarStyle =
        /// Unquoted.
        | Plain
        /// '...' (only '' -> ').
        | SingleQuoted
        /// "..." (supports \\ \" \n \t \r \0 \/).
        | DoubleQuoted

    /// A flat event in the L1 stream. A document emits exactly one StreamStart first and one
    /// StreamEnd last.
    type YamlEvent =
        /// Start of the document stream.
        | StreamStart
        /// End of the document stream.
        | StreamEnd
        /// Open a mapping container.
        | MappingStart
        /// Close a mapping container.
        | MappingEnd
        /// Open a sequence container.
        | SequenceStart
        /// Close a sequence container.
        | SequenceEnd
        /// A scalar (map key, map value, or sequence item). Map keys are always kind = Str.
        | Scalar of raw: string * kind: ScalarKind * style: ScalarStyle

    /// Typed decline channel (Result over throw) so a caller can fall back to a vendor
    /// adapter on out-of-subset input.
    type YamlFeedback =
        /// A tab in a content line's indentation region.
        | TabIndentation
        /// A quoted scalar with no closing quote.
        | UnterminatedQuote
        /// A bad double-quote escape or stray character.
        | UnexpectedCharacter
        /// A dedent to a level that does not match any open container.
        | UnexpectedIndent
        /// Out-of-subset: a value beginning & * ! { [ | >, or a line --- / ...
        | UnsupportedConstruct

    // --- Plain-kind resolution ------------------------------------------------------

    let private isNullLiteral (raw: string) : bool =
        match raw with
        | "" | "~" | "null" | "Null" | "NULL" -> true
        | _ -> false

    let private isBoolLiteral (raw: string) : bool =
        match raw with
        | "true" | "True" | "TRUE" | "false" | "False" | "FALSE" -> true
        | _ -> false

    /// ^-?[0-9]+$ (hand-rolled to stay zero-dep -- no regex).
    let private isIntLiteral (raw: string) : bool =
        let mutable i = 0
        if raw.Length > 0 && raw.[0] = '-' then i <- 1
        if i = raw.Length then
            false // just "-" (or empty)
        else
            let mutable ok = true
            let mutable j = i
            while ok && j < raw.Length do
                if raw.[j] < '0' || raw.[j] > '9' then ok <- false
                j <- j + 1
            ok

    /// ^-?[0-9]+\.[0-9]+([eE][-+]?[0-9]+)?$ (hand-rolled).
    let private isFloatLiteral (raw: string) : bool =
        let n = raw.Length
        let isDigit (c: char) = c >= '0' && c <= '9'
        let mutable i = 0
        if n > 0 && raw.[0] = '-' then i <- 1
        // integer part: one-or-more digits
        let intStart = i
        while i < n && isDigit raw.[i] do
            i <- i + 1
        if i = intStart then false
        // required '.'
        elif i >= n || raw.[i] <> '.' then false
        else
            i <- i + 1
            // fraction part: one-or-more digits
            let fracStart = i
            while i < n && isDigit raw.[i] do
                i <- i + 1
            if i = fracStart then false
            else
                // optional exponent
                let mutable ok = true
                if i < n && (raw.[i] = 'e' || raw.[i] = 'E') then
                    i <- i + 1
                    if i < n && (raw.[i] = '+' || raw.[i] = '-') then
                        i <- i + 1
                    let expStart = i
                    while i < n && isDigit raw.[i] do
                        i <- i + 1
                    if i = expStart then ok <- false
                ok && i = n

    let private resolvePlainKind (raw: string) : ScalarKind =
        if isNullLiteral raw then Null
        elif isBoolLiteral raw then Bool
        elif isIntLiteral raw then Int
        elif isFloatLiteral raw then Float
        else Str

    // --- Scalar token parsing -------------------------------------------------------

    type private ParsedScalar =
        { Raw: string
          Kind: ScalarKind
          Style: ScalarStyle }

    let private isSpace (ch: char) : bool = ch = ' ' || ch = '\t'

    /// Drop leading spaces/tabs.
    let private leftTrim (s: string) : string = s.TrimStart(' ', '\t')

    /// A plain-scalar trailing comment begins at a # that follows whitespace. `a#b` is a
    /// literal value; `a #b` drops the comment. The token here has already had leading
    /// whitespace removed, so index 0 can never begin a comment.
    let private stripTrailingComment (token: string) : string =
        let mutable result = token
        let mutable found = false
        let mutable i = 0
        while not found && i < token.Length do
            if token.[i] = '#' && i > 0 && isSpace token.[i - 1] then
                result <- token.Substring(0, i)
                found <- true
            i <- i + 1
        result

    let private decodeSingleQuoted (token: string) : Result<string, YamlFeedback> =
        // token.[0] = '\''
        let sb = System.Text.StringBuilder()
        let mutable i = 1
        let mutable result = Error UnterminatedQuote
        let mutable stop = false
        while not stop && i < token.Length do
            let ch = token.[i]
            if ch = '\'' then
                if i + 1 < token.Length && token.[i + 1] = '\'' then
                    sb.Append('\'') |> ignore
                    i <- i + 2
                else
                    result <- Ok(sb.ToString())
                    stop <- true
            else
                sb.Append(ch) |> ignore
                i <- i + 1
        result

    let private decodeDoubleQuoted (token: string) : Result<string, YamlFeedback> =
        // token.[0] = '"'
        let sb = System.Text.StringBuilder()
        let mutable i = 1
        let mutable result = Error UnterminatedQuote
        let mutable stop = false
        while not stop && i < token.Length do
            let ch = token.[i]
            if ch = '"' then
                result <- Ok(sb.ToString())
                stop <- true
            elif ch = '\\' then
                if i + 1 >= token.Length then
                    result <- Error UnterminatedQuote
                    stop <- true
                else
                    let next = token.[i + 1]
                    let appended =
                        match next with
                        | '\\' -> sb.Append('\\') |> ignore; true
                        | '"' -> sb.Append('"') |> ignore; true
                        | 'n' -> sb.Append('\n') |> ignore; true
                        | 't' -> sb.Append('\t') |> ignore; true
                        | 'r' -> sb.Append('\r') |> ignore; true
                        | '0' -> sb.Append('\000') |> ignore; true
                        | '/' -> sb.Append('/') |> ignore; true
                        | _ -> false
                    if appended then
                        i <- i + 2
                    else
                        result <- Error UnexpectedCharacter
                        stop <- true
            else
                sb.Append(ch) |> ignore
                i <- i + 1
        result

    let private unsupportedValueStart = set [ '&'; '*'; '!'; '{'; '['; '|'; '>' ]

    /// Decode a value token (already left-trimmed; may carry a trailing comment for plain
    /// scalars).
    let private parseValue (token: string) : Result<ParsedScalar, YamlFeedback> =
        if token.Length > 0 && token.[0] = '"' then
            match decodeDoubleQuoted token with
            | Ok raw -> Ok { Raw = raw; Kind = Str; Style = DoubleQuoted }
            | Error f -> Error f
        elif token.Length > 0 && token.[0] = '\'' then
            match decodeSingleQuoted token with
            | Ok raw -> Ok { Raw = raw; Kind = Str; Style = SingleQuoted }
            | Error f -> Error f
        elif token.Length > 0 && Set.contains token.[0] unsupportedValueStart then
            Error UnsupportedConstruct
        else
            let raw = (stripTrailingComment token).TrimEnd()
            Ok { Raw = raw; Kind = resolvePlainKind raw; Style = Plain }

    // --- Line model -----------------------------------------------------------------

    type private ContainerKind =
        | Mapping
        | Sequence

    type private Frame =
        { Indent: int
          Kind: ContainerKind }

    type private ContentLine =
        { Indent: int
          // Text from the first non-space char to end of line (trailing whitespace kept;
          // the value parser handles trimming + comment stripping, quote-aware).
          Text: string }

    /// Split into lines, strip blanks + full-line comments, compute indent, and reject tabs
    /// in the indentation region of a content line (TabIndentation). Tolerates a trailing
    /// \r defensively though input is LF.
    let private toContentLines (text: string) : Result<ContentLine list, YamlFeedback> =
        let out = System.Collections.Generic.List<ContentLine>()
        let mutable feedback = None
        let rawLines = text.Split('\n')
        let mutable li = 0
        while feedback.IsNone && li < rawLines.Length do
            let raw0 = rawLines.[li]
            let line = if raw0.EndsWith('\r') then raw0.Substring(0, raw0.Length - 1) else raw0

            let mutable indent = 0
            let mutable sawTab = false
            let mutable scanning = true
            while scanning && indent < line.Length do
                let ch = line.[indent]
                if ch = ' ' then
                    indent <- indent + 1
                elif ch = '\t' then
                    sawTab <- true
                    indent <- indent + 1
                else
                    scanning <- false

            let body = line.Substring(indent)
            if body.Length = 0 then
                () // blank line -- never a tab-indent error
            elif body.[0] = '#' then
                () // full-line comment
            elif sawTab then
                feedback <- Some TabIndentation
            else
                out.Add({ Indent = indent; Text = body })

            li <- li + 1

        match feedback with
        | Some f -> Error f
        | None -> Ok(List.ofSeq out)

    /// A whole-line document marker (--- / ..., alone or with a trailing payload) is out of
    /// subset.
    let private isDocumentMarker (text: string) : bool =
        let t = text.TrimEnd()
        t = "---" || t = "..." || t.StartsWith("--- ") || t.StartsWith("... ")

    type private MappingEntry =
        { Key: string
          Value: string option }

    /// Find the mapping `key: value` split. The colon is the first : followed by a space or
    /// EOL and OUTSIDE a quoted region. Returns key text + value token (left-trimmed) or
    /// Value = None when there is no inline value, or None when the line is not a mapping
    /// entry at all.
    let private splitMappingEntry (text: string) : MappingEntry option =
        let mutable inSingle = false
        let mutable inDouble = false
        let mutable result = None
        let mutable stop = false
        let mutable i = 0
        while not stop && i < text.Length do
            let ch = text.[i]
            if inSingle then
                if ch = '\'' then inSingle <- false
                i <- i + 1
            elif inDouble then
                if ch = '\\' then
                    i <- i + 2
                else
                    if ch = '"' then inDouble <- false
                    i <- i + 1
            elif ch = '\'' then
                inSingle <- true
                i <- i + 1
            elif ch = '"' then
                inDouble <- true
                i <- i + 1
            elif ch = '#' && i > 0 && isSpace text.[i - 1] then
                // comment reached before any colon -- not a mapping entry
                stop <- true
            elif ch = ':' && ((i + 1 < text.Length && text.[i + 1] = ' ') || i + 1 = text.Length) then
                let key = text.Substring(0, i).TrimEnd()
                let rest = text.Substring(i + 1)
                let value = leftTrim rest
                if value.Length = 0 || value.StartsWith('#') then
                    result <- Some { Key = key; Value = None }
                else
                    result <- Some { Key = key; Value = Some value }
                stop <- true
            else
                i <- i + 1
        result

    // --- The one-pass scanner -------------------------------------------------------

    type private Scanner() =
        let events = System.Collections.Generic.List<YamlEvent>()
        let stack = System.Collections.Generic.List<Frame>()

        do events.Add(StreamStart)

        member _.Events = events
        member _.StackCount = stack.Count
        member _.StackTopIndent = stack.[stack.Count - 1].Indent

        member _.PushContainer(indent: int, kind: ContainerKind) =
            stack.Add({ Indent = indent; Kind = kind })
            events.Add(match kind with
                       | Mapping -> MappingStart
                       | Sequence -> SequenceStart)

        member _.PopGreaterThan(indent: int) =
            while stack.Count > 0 && stack.[stack.Count - 1].Indent > indent do
                let frame = stack.[stack.Count - 1]
                stack.RemoveAt(stack.Count - 1)
                events.Add(match frame.Kind with
                           | Mapping -> MappingEnd
                           | Sequence -> SequenceEnd)

        /// True iff the top frame is a Sequence (caller has verified non-empty / matching).
        member _.TopIsSequence() = stack.[stack.Count - 1].Kind = Sequence

        member _.EmitKey(key: string) : Result<unit, YamlFeedback> =
            // Map keys are ALWAYS Scalar kind=Str (key text is never type-resolved); a
            // quoted key keeps its quote style + decoded inner text.
            match parseValue key with
            | Ok parsed ->
                events.Add(Scalar(parsed.Raw, Str, parsed.Style))
                Ok()
            | Error f -> Error f

        member _.EmitNull() = events.Add(Scalar("", Null, Plain))

        member _.EmitValue(value: string) : Result<unit, YamlFeedback> =
            match parseValue value with
            | Ok parsed ->
                events.Add(Scalar(parsed.Raw, parsed.Kind, parsed.Style))
                Ok()
            | Error f -> Error f

        /// 081KT7YW00008QG0R002T1XNWT: an UNQUOTED value token of exactly `{}` / `[]` is an EMPTY flow
        /// collection -- emit the empty container event-pair (not a scalar), so empty map
        /// / empty seq / null stay three distinct states across the round-trip
        /// (never-collapse). General flow (`{a: b}`, `[1,2]`) remains out of subset
        /// (declines via parseValue). A quoted `"{}"` is a String (starts with `"`, never
        /// matches here). Used at VALUE sites only; keys are never affected.
        member this.EmitValueOrEmptyFlow(value: string) : Result<unit, YamlFeedback> =
            let token = (stripTrailingComment value).TrimEnd()
            if token = "{}" then
                events.Add(MappingStart)
                events.Add(MappingEnd)
                Ok()
            elif token = "[]" then
                events.Add(SequenceStart)
                events.Add(SequenceEnd)
                Ok()
            else
                this.EmitValue(value)

        member _.PopAll() =
            while stack.Count > 0 do
                let frame = stack.[stack.Count - 1]
                stack.RemoveAt(stack.Count - 1)
                events.Add(match frame.Kind with
                           | Mapping -> MappingEnd
                           | Sequence -> SequenceEnd)
            events.Add(StreamEnd)

    /// Peek the next line's indent (or None if there is no next content line).
    let private childIndentAt (lines: ContentLine[]) (idx: int) : int option =
        if idx + 1 < lines.Length then Some lines.[idx + 1].Indent else None

    /// Decide the kind of the child block under a key/seq-item by peeking the next line's
    /// shape at the expected child indent. (Forward-only: peek, do not consume.)
    let private peekChildKind (lines: ContentLine[]) (idx: int) (childIndent: int) : ContainerKind =
        if idx + 1 < lines.Length && lines.[idx + 1].Indent = childIndent then
            let nextText = lines.[idx + 1].Text
            if nextText = "-" || nextText.StartsWith("- ") then Sequence else Mapping
        else
            Mapping

    let private scan (text: string) : Result<YamlEvent list, YamlFeedback> =
        match toContentLines text with
        | Error f -> Error f
        | Ok lineList ->
            let lines = Array.ofList lineList
            let s = Scanner()
            let mutable feedback = None
            let mutable li = 0
            while feedback.IsNone && li < lines.Length do
                let indent = lines.[li].Indent
                let body = lines.[li].Text

                if isDocumentMarker body then
                    feedback <- Some UnsupportedConstruct
                else
                    let isSeqItem = body = "-" || body.StartsWith("- ")

                    // --- Indent management ---
                    if s.StackCount = 0 then
                        s.PushContainer(indent, (if isSeqItem then Sequence else Mapping))
                    elif indent <= s.StackTopIndent then
                        s.PopGreaterThan(indent)
                        if s.StackCount = 0 || s.StackTopIndent <> indent then
                            feedback <- Some UnexpectedIndent
                        elif isSeqItem <> s.TopIsSequence() then
                            feedback <- Some UnexpectedIndent
                    // indent > top: the deeper container was opened proactively by the
                    // prior key/seq line's peek; nothing to do here.

                    if feedback.IsNone then
                        if isSeqItem then
                            let afterDash = if body = "-" then "" else body.Substring(2)
                            let itemContent = leftTrim afterDash

                            if itemContent.Length = 0 || itemContent.StartsWith('#') then
                                match childIndentAt lines li with
                                | Some childIndent when childIndent > indent ->
                                    s.PushContainer(childIndent, peekChildKind lines li childIndent)
                                | _ -> s.EmitNull()
                            else
                                match splitMappingEntry itemContent with
                                | Some inner ->
                                    // Compact mapping item ("- id: x"): open the item's
                                    // mapping at the content indent (column of first char
                                    // after "- ").
                                    let lead = body.Length - itemContent.Length
                                    let mapIndent = indent + lead
                                    s.PushContainer(mapIndent, Mapping)
                                    match s.EmitKey(inner.Key) with
                                    | Error f -> feedback <- Some f
                                    | Ok() ->
                                        match inner.Value with
                                        | Some v ->
                                            match s.EmitValueOrEmptyFlow(v) with
                                            | Error f -> feedback <- Some f
                                            | Ok() -> ()
                                        | None ->
                                            match childIndentAt lines li with
                                            | Some childIndent when childIndent > mapIndent ->
                                                s.PushContainer(childIndent, peekChildKind lines li childIndent)
                                            | _ -> s.EmitNull()
                                | None ->
                                    // plain scalar item (or empty flow {} / [])
                                    match s.EmitValueOrEmptyFlow(itemContent) with
                                    | Error f -> feedback <- Some f
                                    | Ok() -> ()
                        else
                            // --- Mapping entry ---
                            match splitMappingEntry body with
                            | None -> feedback <- Some UnsupportedConstruct
                            | Some entry ->
                                match s.EmitKey(entry.Key) with
                                | Error f -> feedback <- Some f
                                | Ok() ->
                                    match entry.Value with
                                    | Some v ->
                                        match s.EmitValueOrEmptyFlow(v) with
                                        | Error f -> feedback <- Some f
                                        | Ok() -> ()
                                    | None ->
                                        match childIndentAt lines li with
                                        | Some childIndent when childIndent > indent ->
                                            s.PushContainer(childIndent, peekChildKind lines li childIndent)
                                        | _ -> s.EmitNull()

                li <- li + 1

            match feedback with
            | Some f -> Error f
            | None ->
                // EOF: pop all open containers, then StreamEnd.
                s.PopAll()
                Ok(List.ofSeq s.Events)

    /// Read the L1 event stream from `text` in one forward pass, or decline via YamlFeedback
    /// on out-of-subset input.
    let readEvents (text: string) : Result<YamlEvent list, YamlFeedback> = scan text
