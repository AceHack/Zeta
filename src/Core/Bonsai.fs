namespace Zeta.Core

open System.Collections.Generic
open System.Text
open System.Text.Json

/// Bonsai-subset expression-tree serializer — the F# oracle (#2 of TS/F#/C#/Rust)
/// for B-0976 slice 1. Named after Nuqleon Bonsai (Reaqtor's compact serializer
/// for .NET expression trees); this is the weakly-typed / reflection-info-omitted
/// mode — kind-tagged nodes, no .NET type table — the cross-language-portable
/// form. The TS reference oracle (src/Core.TypeScript/bonsai/) authors the shared
/// golden vectors; this F# oracle replays them byte-for-byte. Mirrors the
/// algebra-ladder meet-in-the-middle discipline: the compilers do not lie;
/// agreement IS the verification.
///
/// Canonical form (the cross-oracle byte-diff contract): serialize emits compact
/// JSON (no whitespace) with a fixed key order per node-kind (kind first, then
/// fields in declared order), integer-only numeric literals in the shared
/// JS-safe-integer range, standard JSON string escaping, and the document wrapper
/// v=1,expr=node. parse round-trips: serialize(parse s) = Ok s, and the DU has
/// structural equality.
///
/// Error channel: serialize and parse return Result&lt;_, BonsaiFeedback&gt; — no
/// exceptions cross the public boundary (result-over-throw; "stay round, not
/// sharp"). F# leans on the BCL FSharp.Core Result; BonsaiFeedback is the shared
/// cross-oracle payload contract (the 'TError in F#'s Result, the E in Rust's
/// std::result::Result, the owned-port payload in C#/TS). Per the hexagonal
/// contract-vs-mechanism split, the internals adapt System.Text.Json's throwing
/// API (and a private typed signal) into Result at the two boundaries; the wire
/// contract is pure Result. This is fail-fast (monadic) — for accumulate-all-errors
/// (RFC-9457 ProblemDetails / model-validation), the where-keyed variants below map
/// straight to a {where: [msg…]} document; that accumulate mode is the complementary
/// primitive for batch/validation, not single-parse.
module Bonsai =

    /// A literal value — tagged so every oracle round-trips the type exactly.
    type ConstValue =
        /// An integer literal (int64 to match the Rust i64 oracle; the wire form
        /// is bounded to the shared JS-safe-integer range).
        | CInt of int64
        /// A string literal (serialized with standard JSON escaping).
        | CStr of string
        /// A boolean literal.
        | CBool of bool
        /// The null literal (no value field in the canonical form).
        | CNull

    /// The language-agnostic binary operators in the subset.
    type BinOp =
        | Add
        | Sub
        | Mul
        | Eq
        | Lt
        | And
        | Or

    /// A Bonsai-subset expression node (kind-tagged discriminated union).
    type Expr =
        /// A constant literal.
        | Const of ConstValue
        /// A parameter (variable) reference by name.
        | Param of string
        /// A lambda abstraction: parameter names and a body.
        | Lambda of string list * Expr
        /// A binary operation: operator, left, right.
        | Binary of BinOp * Expr * Expr
        /// A named function application: function name and arguments.
        | Call of string * Expr list
        /// A conditional: test, then-branch, else-branch.
        | Cond of Expr * Expr * Expr

    /// The bonsai-domain feedback channel — the typed reasons serialize/parse can
    /// decline, surfaced as Result values (no exceptions) so callers handle or
    /// propagate. The shared cross-oracle payload contract. Named *Feedback* not
    /// *Error* per the framework's substrate-honest convention: the decline path is
    /// load-bearing engineering input, not residue. The `where` fields are
    /// JSON-pointer-ish paths so a list of these maps directly to an RFC-9457
    /// ProblemDetails errors map when the accumulate mode is wanted.
    type BonsaiFeedback =
        /// The document `v` was not the supported version (found, expected).
        | UnsupportedVersion of found: int * expected: int
        /// The input was not well-formed JSON, or a required property was missing
        /// or of the wrong JSON kind (carries the underlying message).
        | MalformedJson of message: string
        /// A node `kind` tag was not one of the known node kinds.
        | UnknownKind of kind: string
        /// A const `t` tag was not one of int/str/bool/null.
        | UnknownConstTag of tag: string
        /// A binary `op` was not one of the known operators.
        | UnknownOp of op: string
        /// A string was required at `where` but the value was null / non-string.
        | ExpectedString of where: string
        /// A boolean was required at `where` but the value was non-boolean.
        | ExpectedBool of where: string
        /// A safe integer was required at `where` but the value was non-numeric,
        /// fractional, or beyond the representable range.
        | ExpectedInt of where: string
        /// An integer literal was a valid int64 but outside the shared v1
        /// JS-safe-integer range (a value a peer oracle could not preserve).
        | NonSafeInt of value: int64
        /// Expression nesting exceeded the shared v1 maximum (the limit).
        | TooDeep of limit: int
        /// The input was valid JSON but not the canonical byte form (extra fields,
        /// whitespace, or reordered keys); serialize(parse s) would not equal s.
        | NonCanonical

    /// The serialization format version (the v field of the document wrapper).
    [<Literal>]
    let Version = 1

    /// The maximum expression nesting depth in the v1 contract. Bounds the
    /// recursive serializer/parser against unbounded nesting (a stack-overflow /
    /// DoS vector on attacker-controlled saga bytes) and is the shared depth limit
    /// every oracle enforces, so a tree that round-trips in one oracle round-trips
    /// in every oracle. Generous for any realistic deferred computation, well below
    /// the recursion ceiling, and far above System.Text.Json's default of 64.
    [<Literal>]
    let MaxDepth = 1024

    /// The JS safe-integer bound, Number.MAX_SAFE_INTEGER = 2^53 - 1 — the shared
    /// v1 int domain (a value beyond this cannot round-trip through the TS oracle's
    /// number, so it is rejected, not silently rewritten).
    [<Literal>]
    let private MaxSafeInt = 9007199254740991L // 2^53 - 1

    /// JSON tokenizer depth ceiling — generous headroom above MaxDepth so
    /// JsonDocument.Parse never rejects a tree within the v1 nesting contract
    /// (System.Text.Json defaults to 64). The serialize-side cap (emitAt) + the
    /// canonical round-trip guard in parse are the actual contract enforcers.
    let private parseDepthCeiling = MaxDepth * 2

    /// Private typed signal — internals raise this on a decline; serialize/parse
    /// catch it at the boundary and return Error. The wire contract stays Result;
    /// this is the F# internal mechanism (hexagonal contract-vs-mechanism split).
    exception private BonsaiFail of BonsaiFeedback

    /// Reject an integer literal outside the shared v1 safe-integer range.
    let private checkSafeInt (v: int64) : int64 =
        if v > MaxSafeInt || v < -MaxSafeInt then
            raise (BonsaiFail(NonSafeInt v))

        v

    /// Map a binary operator to its canonical wire string.
    let private binOpToString (op: BinOp) : string =
        match op with
        | Add -> "add"
        | Sub -> "sub"
        | Mul -> "mul"
        | Eq -> "eq"
        | Lt -> "lt"
        | And -> "and"
        | Or -> "or"

    /// Parse a canonical wire string back to a binary operator.
    let private binOpOfString (s: string) : BinOp =
        match s with
        | "add" -> Add
        | "sub" -> Sub
        | "mul" -> Mul
        | "eq" -> Eq
        | "lt" -> Lt
        | "and" -> And
        | "or" -> Or
        | other -> raise (BonsaiFail(UnknownOp(if isNull other then "<null>" else other)))

    /// Escape a string to a JSON string literal (quotes included), matching
    /// JavaScript JSON.stringify: escape quote, backslash, the short control
    /// forms, any other control char below 0x20 as lowercase \uXXXX, and any
    /// unpaired UTF-16 surrogate as lowercase \uXXXX (a valid surrogate pair is
    /// emitted literally, as JSON.stringify does, so the bytes stay valid UTF-8).
    let private jsonString (s: string) : string =
        if isNull s then
            // A CLR caller can construct an Expr with a null string field
            // (Param null / CStr null / null call fn / null lambda param);
            // decline cleanly instead of NRE-ing here, keeping serialize total.
            raise (BonsaiFail(ExpectedString "null string field"))

        let sb = StringBuilder(s.Length + 2)
        sb.Append('"') |> ignore
        let mutable i = 0

        while i < s.Length do
            let ch = s.[i]

            match ch with
            | '"' -> sb.Append("\\\"") |> ignore
            | '\\' -> sb.Append("\\\\") |> ignore
            | '\b' -> sb.Append("\\b") |> ignore
            | '\f' -> sb.Append("\\f") |> ignore
            | '\n' -> sb.Append("\\n") |> ignore
            | '\r' -> sb.Append("\\r") |> ignore
            | '\t' -> sb.Append("\\t") |> ignore
            | c when c < ' ' -> sb.AppendFormat("\\u{0:x4}", int c) |> ignore
            | c when System.Char.IsHighSurrogate c && i + 1 < s.Length && System.Char.IsLowSurrogate(s.[i + 1]) ->
                // valid surrogate pair — emit both code units literally (matches
                // JSON.stringify, which emits the astral character, not an escape)
                sb.Append(c) |> ignore
                sb.Append(s.[i + 1]) |> ignore
                i <- i + 1 // also consume the low surrogate
            | c when System.Char.IsHighSurrogate c || System.Char.IsLowSurrogate c ->
                // unpaired surrogate — escape it (well-formed JSON.stringify does)
                sb.AppendFormat("\\u{0:x4}", int c) |> ignore
            | c -> sb.Append(c) |> ignore

            i <- i + 1

        sb.Append('"') |> ignore
        sb.ToString()

    /// Emit a constant value in canonical compact form (t first, then v).
    let private emitConst (c: ConstValue) : string =
        match c with
        | CInt v -> sprintf "{\"t\":\"int\",\"v\":%d}" (checkSafeInt v)
        | CStr v -> sprintf "{\"t\":\"str\",\"v\":%s}" (jsonString v)
        | CBool v -> sprintf "{\"t\":\"bool\",\"v\":%s}" (if v then "true" else "false")
        | CNull -> "{\"t\":\"null\"}"

    /// Emit a node in canonical compact form (fixed key order per kind). Tracks
    /// nesting depth and declines (TooDeep) past MaxDepth — so serialize never
    /// emits a tree the parser (any oracle) could not read back, and recursion is
    /// bounded.
    let rec private emitAt (depth: int) (e: Expr) : string =
        if depth > MaxDepth then
            raise (BonsaiFail(TooDeep MaxDepth))

        match e with
        | Const c -> sprintf "{\"kind\":\"const\",\"value\":%s}" (emitConst c)
        | Param n -> sprintf "{\"kind\":\"param\",\"name\":%s}" (jsonString n)
        | Lambda(ps, body) ->
            let psJson = ps |> List.map jsonString |> String.concat ","
            sprintf "{\"kind\":\"lambda\",\"params\":[%s],\"body\":%s}" psJson (emitAt (depth + 1) body)
        | Binary(op, l, r) ->
            sprintf
                "{\"kind\":\"binary\",\"op\":%s,\"left\":%s,\"right\":%s}"
                (jsonString (binOpToString op))
                (emitAt (depth + 1) l)
                (emitAt (depth + 1) r)
        | Call(fn, args) ->
            let argsJson = args |> List.map (emitAt (depth + 1)) |> String.concat ","
            sprintf "{\"kind\":\"call\",\"fn\":%s,\"args\":[%s]}" (jsonString fn) argsJson
        | Cond(t, th, el) ->
            sprintf
                "{\"kind\":\"cond\",\"test\":%s,\"then\":%s,\"else\":%s}"
                (emitAt (depth + 1) t)
                (emitAt (depth + 1) th)
                (emitAt (depth + 1) el)

    /// Serialize an expression to the canonical Bonsai-subset string. Declines
    /// (Error) on an unsafe integer literal or nesting past MaxDepth.
    let serialize (e: Expr) : Result<string, BonsaiFeedback> =
        try
            Ok(sprintf "{\"v\":%d,\"expr\":%s}" Version (emitAt 1 e))
        with BonsaiFail f ->
            Error f

    /// Rebuild a ConstValue from a parsed JSON element (validating tag + value
    /// kind; null / wrong-kind values decline rather than crash).
    let private parseConst (el: JsonElement) : ConstValue =
        match el.GetProperty("t").GetString() with
        | "int" ->
            match el.GetProperty("v").TryGetInt64() with
            | true, i -> CInt(checkSafeInt i)
            | false, _ -> raise (BonsaiFail(ExpectedInt "const int value"))
        | "str" ->
            let v = el.GetProperty("v")

            if v.ValueKind = JsonValueKind.String then
                CStr(v.GetString())
            else
                raise (BonsaiFail(ExpectedString "const str value"))
        | "bool" ->
            match el.GetProperty("v").ValueKind with
            | JsonValueKind.True -> CBool true
            | JsonValueKind.False -> CBool false
            | _ -> raise (BonsaiFail(ExpectedBool "const bool value"))
        | "null" -> CNull
        | other -> raise (BonsaiFail(UnknownConstTag(if isNull other then "<null>" else other)))

    /// Rebuild an Expr from a parsed JSON element (validating the kind). Uses eager
    /// list comprehensions over EnumerateArray (the JsonElement array enumerator is
    /// a mutable struct that corrupts through a lazy Seq pipeline). Null string
    /// values decline (ExpectedString) rather than crash in serialize.
    let rec private parseNode (el: JsonElement) : Expr =
        match el.GetProperty("kind").GetString() with
        | "const" -> Const(parseConst (el.GetProperty("value")))
        | "param" ->
            match el.GetProperty("name").GetString() with
            | null -> raise (BonsaiFail(ExpectedString "param.name"))
            | n -> Param n
        | "lambda" ->
            let ps =
                [ for p in el.GetProperty("params").EnumerateArray() ->
                      match p.GetString() with
                      | null -> raise (BonsaiFail(ExpectedString "lambda.params[]"))
                      | s -> s ]

            Lambda(ps, parseNode (el.GetProperty("body")))
        | "binary" ->
            Binary(
                binOpOfString (el.GetProperty("op").GetString()),
                parseNode (el.GetProperty("left")),
                parseNode (el.GetProperty("right"))
            )
        | "call" ->
            match el.GetProperty("fn").GetString() with
            | null -> raise (BonsaiFail(ExpectedString "call.fn"))
            | fn ->
                let args = [ for a in el.GetProperty("args").EnumerateArray() -> parseNode a ]
                Call(fn, args)
        | "cond" ->
            Cond(parseNode (el.GetProperty("test")), parseNode (el.GetProperty("then")), parseNode (el.GetProperty("else")))
        | other -> raise (BonsaiFail(UnknownKind(if isNull other then "<null>" else other)))

    /// Parse a canonical Bonsai-subset string back to an Expr. Canonical-only: a
    /// structurally-valid but non-canonical vector (extra fields, whitespace,
    /// reordered keys) declines (NonCanonical) rather than silently canonicalizing,
    /// so the serialize(parse s) = Ok s fixed point holds and the oracles agree on
    /// which input is valid. Wraps System.Text.Json's throwing access API into the
    /// Result contract at this boundary.
    let parse (s: string) : Result<Expr, BonsaiFeedback> =
        try
            use doc = JsonDocument.Parse(s, JsonDocumentOptions(MaxDepth = parseDepthCeiling))
            let root = doc.RootElement
            let v = root.GetProperty("v").GetInt32()

            if v <> Version then
                Error(UnsupportedVersion(v, Version))
            else
                let node = parseNode (root.GetProperty("expr"))
                // Canonical-only guard: the round-trip must reproduce the input
                // byte-for-byte (serialize also re-checks depth + safe-int).
                match serialize node with
                | Error f -> Error f
                | Ok round -> if round = s then Ok node else Error NonCanonical
        with
        | BonsaiFail f -> Error f
        | :? System.ArgumentNullException -> Error(MalformedJson "input was null")
        | :? JsonException as ex -> Error(MalformedJson ex.Message)
        | :? KeyNotFoundException -> Error(MalformedJson "missing required property")
        | :? System.InvalidOperationException as ex -> Error(MalformedJson ex.Message)
        | :? System.FormatException as ex -> Error(MalformedJson ex.Message)

    // ---- accumulate-mode (RFC-9457 ProblemDetails) ------------------------
    //
    // The applicative complement to the fail-fast parse: parseAll collects EVERY
    // per-node decline keyed by its JSON-path instead of declining at the first —
    // for debugging a malformed tree / batch / model-validation. Additive over the
    // same BonsaiFeedback payload; toProblemDetails adapts the collected list to the
    // RFC-9457 shape (.NET ValidationProblemDetails's Errors: field -> messages).
    // Independent sub-trees accumulate; a fatal-structural node (unknown kind,
    // not-an-object, missing kind) is single for that node but siblings accumulate.

    /// A decline tagged with the JSON-path where it occurred (the ProblemDetails key).
    type PathedFeedback = { Path: string; Feedback: BonsaiFeedback }

    /// RFC-9457 "Problem Details" — the field-keyed multi-error document (the shape
    /// .NET ships as ValidationProblemDetails; useful well outside HTTP).
    type ProblemDetails =
        { Type: string
          Title: string
          Errors: Map<string, string list> }

    /// A human-readable message for a feedback variant (the ProblemDetails value).
    let feedbackMessage (f: BonsaiFeedback) : string =
        match f with
        | UnsupportedVersion(found, expected) -> sprintf "unsupported version %d (expected %d)" found expected
        | MalformedJson message -> message
        | UnknownKind kind -> sprintf "unknown node kind \"%s\"" kind
        | UnknownConstTag tag -> sprintf "unknown const tag \"%s\"" tag
        | UnknownOp op -> sprintf "unknown binary operator \"%s\"" op
        | ExpectedString _ -> "expected a string"
        | ExpectedBool _ -> "expected a boolean"
        | ExpectedInt _ -> "expected a safe integer"
        | NonSafeInt value -> sprintf "integer %d is outside the safe-integer range" value
        | TooDeep limit -> sprintf "nesting exceeds the maximum depth of %d" limit
        | NonCanonical -> "input is not in canonical form"

    /// Adapt the collected declines to an RFC-9457 ProblemDetails document: group by
    /// JSON-path into the Errors map (each path -> its messages, in order).
    let toProblemDetails (feedbacks: PathedFeedback list) : ProblemDetails =
        let errors =
            (Map.empty, feedbacks)
            ||> List.fold (fun acc pf ->
                let prev = acc |> Map.tryFind pf.Path |> Option.defaultValue []
                acc |> Map.add pf.Path (prev @ [ feedbackMessage pf.Feedback ]))

        { Type = "about:blank"
          Title = "Bonsai validation failed"
          Errors = errors }

    /// The valid binary operator wire-strings, for the non-throwing accumulate check.
    let private binOpNames = Set.ofList [ "add"; "sub"; "mul"; "eq"; "lt"; "and"; "or" ]

    /// Collect declines for a const value into out (non-throwing; mirrors parseConst).
    let private pushConst (path: string) (el: JsonElement) (out: ResizeArray<PathedFeedback>) : unit =
        if el.ValueKind <> JsonValueKind.Object then
            out.Add { Path = path; Feedback = MalformedJson(sprintf "%s is not an object" path) }
        else
            match el.TryGetProperty("t") with
            | true, t when t.ValueKind = JsonValueKind.String ->
                match t.GetString() with
                | "int" ->
                    match el.TryGetProperty("v") with
                    | true, v ->
                        match v.TryGetInt64() with
                        | true, i ->
                            if i > MaxSafeInt || i < -MaxSafeInt then
                                out.Add { Path = path; Feedback = NonSafeInt i }
                        | false, _ -> out.Add { Path = path; Feedback = ExpectedInt path }
                    | false, _ -> out.Add { Path = path; Feedback = ExpectedInt path }
                | "str" ->
                    match el.TryGetProperty("v") with
                    | true, v when v.ValueKind = JsonValueKind.String -> ()
                    | _ -> out.Add { Path = path; Feedback = ExpectedString path }
                | "bool" ->
                    match el.TryGetProperty("v") with
                    | true, v when v.ValueKind = JsonValueKind.True || v.ValueKind = JsonValueKind.False -> ()
                    | _ -> out.Add { Path = path; Feedback = ExpectedBool path }
                | "null" -> ()
                | other -> out.Add { Path = path; Feedback = UnknownConstTag other }
            | _ -> out.Add { Path = path; Feedback = MalformedJson(sprintf "%s.t is missing or not a string" path) }

    /// Collect declines for a node into out, recursing all independent children
    /// (non-throwing; the accumulate counterpart of parseNode). A fatal-structural
    /// node (not-object / missing-or-unknown kind / too deep) is single for that
    /// node; its siblings still accumulate. Uses direct for-loops over EnumerateArray
    /// (eager — the JsonElement array enumerator is a mutable struct).
    let rec private pushNode (path: string) (depth: int) (el: JsonElement) (out: ResizeArray<PathedFeedback>) : unit =
        if depth > MaxDepth then
            out.Add { Path = path; Feedback = TooDeep MaxDepth }
        elif el.ValueKind <> JsonValueKind.Object then
            out.Add { Path = path; Feedback = MalformedJson(sprintf "%s is not an object" path) }
        else
            match el.TryGetProperty("kind") with
            | true, k when k.ValueKind = JsonValueKind.String ->
                match k.GetString() with
                | "const" ->
                    match el.TryGetProperty("value") with
                    | true, v -> pushConst (path + ".value") v out
                    | false, _ -> out.Add { Path = path + ".value"; Feedback = MalformedJson(sprintf "%s.value is missing" path) }
                | "param" ->
                    match el.TryGetProperty("name") with
                    | true, n when n.ValueKind = JsonValueKind.String -> ()
                    | _ -> out.Add { Path = path + ".name"; Feedback = ExpectedString(path + ".name") }
                | "lambda" ->
                    (match el.TryGetProperty("params") with
                     | true, ps when ps.ValueKind = JsonValueKind.Array ->
                         let mutable i = 0

                         for p in ps.EnumerateArray() do
                             if p.ValueKind <> JsonValueKind.String then
                                 out.Add
                                     { Path = sprintf "%s.params[%d]" path i
                                       Feedback = ExpectedString(sprintf "%s.params[%d]" path i) }

                             i <- i + 1
                     | _ -> out.Add { Path = path + ".params"; Feedback = MalformedJson(sprintf "%s.params is not an array" path) })

                    (match el.TryGetProperty("body") with
                     | true, b -> pushNode (path + ".body") (depth + 1) b out
                     | false, _ -> out.Add { Path = path + ".body"; Feedback = MalformedJson(sprintf "%s.body is missing" path) })
                | "binary" ->
                    (match el.TryGetProperty("op") with
                     | true, op when op.ValueKind = JsonValueKind.String && binOpNames.Contains(op.GetString()) -> ()
                     | true, op when op.ValueKind = JsonValueKind.String -> out.Add { Path = path + ".op"; Feedback = UnknownOp(op.GetString()) }
                     | _ -> out.Add { Path = path + ".op"; Feedback = UnknownOp "<missing>" })

                    (match el.TryGetProperty("left") with
                     | true, l -> pushNode (path + ".left") (depth + 1) l out
                     | false, _ -> out.Add { Path = path + ".left"; Feedback = MalformedJson(sprintf "%s.left is missing" path) })

                    (match el.TryGetProperty("right") with
                     | true, r -> pushNode (path + ".right") (depth + 1) r out
                     | false, _ -> out.Add { Path = path + ".right"; Feedback = MalformedJson(sprintf "%s.right is missing" path) })
                | "call" ->
                    (match el.TryGetProperty("fn") with
                     | true, fn when fn.ValueKind = JsonValueKind.String -> ()
                     | _ -> out.Add { Path = path + ".fn"; Feedback = ExpectedString(path + ".fn") })

                    (match el.TryGetProperty("args") with
                     | true, args when args.ValueKind = JsonValueKind.Array ->
                         let mutable i = 0

                         for a in args.EnumerateArray() do
                             pushNode (sprintf "%s.args[%d]" path i) (depth + 1) a out
                             i <- i + 1
                     | _ -> out.Add { Path = path + ".args"; Feedback = MalformedJson(sprintf "%s.args is not an array" path) })
                | "cond" ->
                    (match el.TryGetProperty("test") with
                     | true, t -> pushNode (path + ".test") (depth + 1) t out
                     | false, _ -> out.Add { Path = path + ".test"; Feedback = MalformedJson(sprintf "%s.test is missing" path) })

                    (match el.TryGetProperty("then") with
                     | true, t -> pushNode (path + ".then") (depth + 1) t out
                     | false, _ -> out.Add { Path = path + ".then"; Feedback = MalformedJson(sprintf "%s.then is missing" path) })

                    (match el.TryGetProperty("else") with
                     | true, e -> pushNode (path + ".else") (depth + 1) e out
                     | false, _ -> out.Add { Path = path + ".else"; Feedback = MalformedJson(sprintf "%s.else is missing" path) })
                | other -> out.Add { Path = path; Feedback = UnknownKind other }
            | _ -> out.Add { Path = path; Feedback = MalformedJson(sprintf "%s.kind is missing or not a string" path) }

    /// Accumulate-mode parse: like parse, but on failure returns EVERY per-node
    /// decline (each with its JSON-path) instead of just the first — the applicative
    /// complement for batch / model-validation / debugging a malformed tree. On
    /// success returns the same Expr as parse (the canonical-only contract applies;
    /// a structurally-valid-but-non-canonical input declines NonCanonical at $).
    let parseAll (s: string) : Result<Expr, PathedFeedback list> =
        if isNull s then
            Error [ { Path = "$"; Feedback = MalformedJson "input was null" } ]
        else
            let docResult =
                try
                    Ok(JsonDocument.Parse(s, JsonDocumentOptions(MaxDepth = parseDepthCeiling)))
                with :? JsonException as ex ->
                    Error [ { Path = "$"; Feedback = MalformedJson ex.Message } ]

            match docResult with
            | Error e -> Error e
            | Ok doc ->
                use doc = doc
                let root = doc.RootElement

                if root.ValueKind <> JsonValueKind.Object then
                    Error [ { Path = "$"; Feedback = MalformedJson "document is not an object" } ]
                else
                    match root.TryGetProperty("v") with
                    | true, vEl when vEl.ValueKind = JsonValueKind.Number ->
                        match vEl.TryGetInt32() with
                        | true, v when v = Version ->
                            match root.TryGetProperty("expr") with
                            | true, exprEl ->
                                let out = ResizeArray<PathedFeedback>()
                                pushNode "$.expr" 1 exprEl out

                                if out.Count > 0 then
                                    Error(List.ofSeq out)
                                else
                                    // Structurally valid -> reuse the fail-fast parse for the Expr +
                                    // canonical guard (only NonCanonical is reachable here).
                                    match parse s with
                                    | Ok node -> Ok node
                                    | Error f -> Error [ { Path = "$"; Feedback = f } ]
                            | false, _ -> Error [ { Path = "$.expr"; Feedback = MalformedJson "document expr is missing" } ]
                        | true, v -> Error [ { Path = "$.v"; Feedback = UnsupportedVersion(v, Version) } ]
                        | false, _ -> Error [ { Path = "$.v"; Feedback = MalformedJson "document v is not an int32" } ]
                    | _ -> Error [ { Path = "$.v"; Feedback = MalformedJson "document v is missing or not a number" } ]


    /// Converts a Bonsai.Expr to its reified DynamicValue representation.
    let rec reify (e: Expr) : DynamicValue =
        match e with
        | Const c ->
            let valueDv =
                match c with
                | CInt i -> DynamicValue.Object [("t", DynamicValue.String "int"); ("v", DynamicValue.Int i)]
                | CStr s -> DynamicValue.Object [("t", DynamicValue.String "str"); ("v", DynamicValue.String s)]
                | CBool b -> DynamicValue.Object [("t", DynamicValue.String "bool"); ("v", DynamicValue.Bool b)]
                | CNull -> DynamicValue.Object [("t", DynamicValue.String "null")]
            DynamicValue.Object [
                ("kind", DynamicValue.String "const")
                ("value", valueDv)
            ]
        | Param name ->
            DynamicValue.Object [
                ("kind", DynamicValue.String "param")
                ("name", DynamicValue.String name)
            ]
        | Lambda (ps, body) ->
            DynamicValue.Object [
                ("kind", DynamicValue.String "lambda")
                ("params", DynamicValue.Array (List.map DynamicValue.String ps))
                ("body", reify body)
            ]
        | Binary (op, l, r) ->
            DynamicValue.Object [
                ("kind", DynamicValue.String "binary")
                ("op", DynamicValue.String (binOpToString op))
                ("left", reify l)
                ("right", reify r)
            ]
        | Call (fn, args) ->
            DynamicValue.Object [
                ("kind", DynamicValue.String "call")
                ("fn", DynamicValue.String fn)
                ("args", DynamicValue.Array (List.map reify args))
            ]
        | Cond (t, th, el) ->
            DynamicValue.Object [
                ("kind", DynamicValue.String "cond")
                ("test", reify t)
                ("then", reify th)
                ("else", reify el)
            ]

    /// Parses a reified DynamicValue representation back into a Bonsai.Expr.
    let rec apply (dv: DynamicValue) : Result<Expr, BonsaiFeedback> =
        match dv with
        | DynamicValue.Object pairs ->
            let tryFindKey key =
                pairs |> List.tryFind (fun (k, _) -> k = key) |> Option.map snd

            match tryFindKey "kind" with
            | Some (DynamicValue.String kind) ->
                match kind with
                | "const" ->
                    match tryFindKey "value" with
                    | Some (DynamicValue.Object valPairs) ->
                        let tryFindValKey key =
                            valPairs |> List.tryFind (fun (k, _) -> k = key) |> Option.map snd

                        match tryFindValKey "t" with
                        | Some (DynamicValue.String t) ->
                            match t with
                            | "int" ->
                                match tryFindValKey "v" with
                                | Some (DynamicValue.Int i) -> Ok (Const (CInt i))
                                | _ -> Error (ExpectedInt "const int value")
                            | "str" ->
                                match tryFindValKey "v" with
                                | Some (DynamicValue.String s) -> Ok (Const (CStr s))
                                | _ -> Error (ExpectedString "const str value")
                            | "bool" ->
                                match tryFindValKey "v" with
                                | Some (DynamicValue.Bool b) -> Ok (Const (CBool b))
                                | _ -> Error (ExpectedBool "const bool value")
                            | "null" -> Ok (Const CNull)
                            | other -> Error (UnknownConstTag other)
                        | _ -> Error (MalformedJson "value.t is missing or not a string")
                    | _ -> Error (MalformedJson "value is not an object")
                | "param" ->
                    match tryFindKey "name" with
                    | Some (DynamicValue.String n) -> Ok (Param n)
                    | _ -> Error (ExpectedString "param.name")
                | "lambda" ->
                    match tryFindKey "params" with
                    | Some (DynamicValue.Array ps) ->
                        let mutable errOpt = None
                        let parsedParams = 
                            ps 
                            |> List.choose (fun p ->
                                match p with
                                | DynamicValue.String s -> Some s
                                | _ -> 
                                    errOpt <- Some (ExpectedString "lambda.params[]")
                                    None)
                        match errOpt with
                        | Some e -> Error e
                        | None ->
                            match tryFindKey "body" with
                            | Some bodyDv ->
                                match apply bodyDv with
                                | Ok body -> Ok (Lambda (parsedParams, body))
                                | Error e -> Error e
                            | None -> Error (MalformedJson "missing required property body")
                    | _ -> Error (MalformedJson "lambda.params is not an array")
                | "binary" ->
                    match tryFindKey "op" with
                    | Some (DynamicValue.String opStr) ->
                        try
                            let op = binOpOfString opStr
                            match tryFindKey "left" with
                            | Some leftDv ->
                                match apply leftDv with
                                | Ok left ->
                                    match tryFindKey "right" with
                                    | Some rightDv ->
                                        match apply rightDv with
                                        | Ok right -> Ok (Binary (op, left, right))
                                        | Error e -> Error e
                                    | None -> Error (MalformedJson "missing required property right")
                                | Error e -> Error e
                            | None -> Error (MalformedJson "missing required property left")
                        with BonsaiFail f -> Error f
                    | _ -> Error (UnknownOp "<missing>")
                | "call" ->
                    match tryFindKey "fn" with
                    | Some (DynamicValue.String fn) ->
                        match tryFindKey "args" with
                        | Some (DynamicValue.Array args) ->
                            let mutable errOpt = None
                            let parsedArgs = 
                                args 
                                |> List.choose (fun a ->
                                    match apply a with
                                    | Ok res -> Some res
                                    | Error e ->
                                        errOpt <- Some e
                                        None)
                            match errOpt with
                            | Some e -> Error e
                            | None -> Ok (Call (fn, parsedArgs))
                        | _ -> Error (MalformedJson "call.args is not an array")
                    | _ -> Error (ExpectedString "call.fn")
                | "cond" ->
                    match tryFindKey "test" with
                    | Some testDv ->
                        match apply testDv with
                        | Ok test ->
                            match tryFindKey "then" with
                            | Some thenDv ->
                                match apply thenDv with
                                | Ok thenB ->
                                    match tryFindKey "else" with
                                    | Some elseDv ->
                                        match apply elseDv with
                                        | Ok elseB -> Ok (Cond (test, thenB, elseB))
                                        | Error e -> Error e
                                    | None -> Error (MalformedJson "missing required property else")
                                | Error e -> Error e
                            | None -> Error (MalformedJson "missing required property then")
                        | Error e -> Error e
                    | None -> Error (MalformedJson "missing required property test")
                | other -> Error (UnknownKind other)
            | _ -> Error (MalformedJson "kind missing or not a string")
        | _ -> Error (MalformedJson "expected object for expression")

    /// The Bonsai canonical-JSON serializer exposed as a value codec (the hexagonal port) —
    /// callers can depend on `Codec.ICodec<Expr, string, BonsaiFeedback>` rather than the
    /// concrete serialize/parse, so the canonical-JSON mechanism is swappable behind the port.
    /// The byte-exact canonical contract + the accumulate-mode (parseAll/ProblemDetails) remain
    /// Bonsai-specific extensions on top of the port's serialize/deserialize.
    let codec: Codec.ICodec<Expr, string, BonsaiFeedback> =
        { new Codec.ICodec<Expr, string, BonsaiFeedback> with
            member _.Serialize(value) = serialize value
            member _.Deserialize(wire) = parse wire
            member _.Name = "bonsai/canonical-json-v1" }
