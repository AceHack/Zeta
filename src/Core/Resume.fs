namespace Zeta.Core

/// Resume engine — the F# oracle (#2 of TS/F#/C#/Rust) for the **resume-engine slice**
/// (081KT07NV0008QG0R003BE6MJ2), the self-evolving-saga kernel the serialized Bonsai expression-tree feeds. Where
/// `Bonsai` is the *serializer* (the deferred computation's shape), this is the *evaluator*
/// that runs it with **restore-not-replay** durable execution. Ferry of the TS reference
/// (`src/Core.TypeScript/bonsai/resume.ts`); replays the shared `resume-golden.json` saga
/// traces — same suspension sequence + final value across oracles. "The compilers don't lie."
///
/// Model: a small-step **CEK machine** over the Bonsai-subset `Expr`. `Call` nodes are
/// activities — the suspension points. Pure parts (Const/Param/Binary/Cond) evaluate inline;
/// at an activity the machine **suspends**, handing back a serializable `SagaState` = the
/// remaining continuation (the `Kont` list) + the pending activity. `resume state result`
/// **restores** that continuation and feeds the result back as the call's value — it does NOT
/// replay from the top, so prior activities are never re-invoked. Each `Kont` frame captures
/// exactly the environment + sub-expr it still needs (the slice's "serialize closure +
/// expr-tree"). `serialize`/`parse` of the state round-trip (persist a suspension, restore).
///
/// Slice-1 scope: Const/Param/Binary/Cond/Call. `Lambda` application is deferred (slice-2) —
/// a `Lambda` in evaluation position declines `UnsupportedNode`.
module Resume =

    open System.Text.Json
    open Zeta.Core.Bonsai

    /// The resume-state serialization version (the `v` field of the persisted wrapper).
    [<Literal>]
    let Version = 1

    // The shared JS-safe-integer bounds (2^53 - 1): the `int` wire domain (matches Bonsai).
    [<Literal>]
    let private MaxSafeInt = 9007199254740991L

    [<Literal>]
    let private MinSafeInt = -9007199254740991L

    /// The typed reasons the evaluator declines — the shared cross-oracle payload contract.
    type ResumeFeedback =
        /// A parameter reference had no binding in the environment.
        | Unbound of name: string
        /// A value had the wrong type for an operation (the field + expected type).
        | TypeMismatch of where: string * expected: string
        /// A node kind unsupported in slice-1 (a `Lambda` in evaluation position).
        | UnsupportedNode of nodeKind: string
        /// An int operation/value left the shared JS-safe-integer wire domain.
        | NonSafeInt of value: int64
        /// A persisted state string was malformed / could not be restored.
        | MalformedState of message: string

    /// An environment: parameter name → bound value (the saga's captured bindings).
    type Env = Map<string, ConstValue>

    /// A defunctionalized continuation frame — one pending operation with exactly the
    /// environment + expression it still needs (the serialized closure). The `Kont` list of
    /// these IS the suspended computation (head = top of stack).
    type Frame =
        /// Computed the left operand; next evaluate the right (in env), then apply the op.
        | EvalRight of BinOp * Expr * Env
        /// Computed both operands; apply the op to (left, the returning value).
        | ApplyOp of BinOp * ConstValue
        /// Computed the test; pick then/else (in env) by its truthiness.
        | Branch of Expr * Expr * Env
        /// Evaluating an activity's args left-to-right: fn, pending, done, env.
        | EvalArgs of string * Expr list * ConstValue list * Env

    /// The activity a suspended saga is awaiting — its result feeds back as the call's value.
    type Activity = { Fn: string; Args: ConstValue list }

    /// The persisted, resumable state of a suspended saga: the continuation + the pending activity.
    type SagaState = { Kont: Frame list; Awaiting: Activity }

    /// The outcome of a step: either the saga finished, or it suspended awaiting an activity.
    type SagaStep =
        /// The saga finished with a value.
        | Done of ConstValue
        /// The saga suspended; resume with the activity's result.
        | Suspended of SagaState * Activity

    /// Private typed signal — internals raise this on a decline; start/resume catch it at the
    /// boundary and return Error (the wire contract stays Result).
    exception private ResumeFail of ResumeFeedback

    // ---- pure operators (the saga's inline semantics) ---------------------

    let private asInt (v: ConstValue) (where: string) : int64 =
        match v with
        | CInt i -> i
        | _ -> raise (ResumeFail(TypeMismatch(where, "int")))

    let private asBool (v: ConstValue) (where: string) : bool =
        match v with
        | CBool b -> b
        | _ -> raise (ResumeFail(TypeMismatch(where, "bool")))

    /// Build an int ConstValue from a wide (overflow-free) result, declining if it left the
    /// shared JS-safe-integer domain — an overflowing add/sub/mul can't become a value the peer
    /// oracles' parse would reject (the Bonsai safe-int wire contract). The arithmetic is done
    /// in `bigint` FIRST: F# `int64` silently WRAPS on overflow (unlike JS floats, which lose
    /// precision and are still caught by `Number.isSafeInteger` — so the TS reference is immune),
    /// meaning a safe-int × safe-int multiply (≤ ~8.1e31) overflows int64 and could wrap to a
    /// wrong *in-range* value before any bounds check. The bigint never overflows; we range-check
    /// then narrow. (Add/Sub of two safe-ints can't overflow int64, but routing them through the
    /// same path keeps the semantics uniform and obviously correct.)
    let private toSafe (p: bigint) : ConstValue =
        if p >= bigint MinSafeInt && p <= bigint MaxSafeInt then
            // within the safe domain ⊂ int64 — narrowing is total
            CInt(int64 p)
        else
            // out of the safe domain; report the exact value when it still fits int64, else a
            // sign sentinel (the value was never a usable result — NonSafeInt is the signal)
            let v =
                if p > bigint System.Int64.MaxValue then System.Int64.MaxValue
                elif p < bigint System.Int64.MinValue then System.Int64.MinValue
                else int64 p

            raise (ResumeFail(NonSafeInt v))

    let private applyBinOp (op: BinOp) (left: ConstValue) (right: ConstValue) : ConstValue =
        match op with
        | Add -> toSafe (bigint (asInt left "add.left") + bigint (asInt right "add.right"))
        | Sub -> toSafe (bigint (asInt left "sub.left") - bigint (asInt right "sub.right"))
        | Mul -> toSafe (bigint (asInt left "mul.left") * bigint (asInt right "mul.right"))
        | Eq -> CBool(left = right)
        | Lt -> CBool(asInt left "lt.left" < asInt right "lt.right")
        | And -> CBool(asBool left "and.left" && asBool right "and.right")
        | Or -> CBool(asBool left "or.left" || asBool right "or.right")

    let private binOpToString (op: BinOp) : string =
        match op with
        | Add -> "add"
        | Sub -> "sub"
        | Mul -> "mul"
        | Eq -> "eq"
        | Lt -> "lt"
        | And -> "and"
        | Or -> "or"

    let private binOpOfString (s: string) : BinOp option =
        match s with
        | "add" -> Some Add
        | "sub" -> Some Sub
        | "mul" -> Some Mul
        | "eq" -> Some Eq
        | "lt" -> Some Lt
        | "and" -> Some And
        | "or" -> Some Or
        | _ -> None

    // ---- the CEK machine --------------------------------------------------

    type private Control =
        | Eval of Expr * Env
        | Ret of ConstValue

    /// Drive the machine from `control` with continuation `kont` until it finishes or suspends.
    let private run (control: Control) (kont: Frame list) : SagaStep =
        let mutable ctrl = control
        let mutable stack = kont
        let mutable outcome = Unchecked.defaultof<SagaStep>
        let mutable running = true

        while running do
            match ctrl with
            | Eval(e, env) ->
                match e with
                | Const v -> ctrl <- Ret v
                | Param name ->
                    // Map.tryFind is an own-key lookup — no inherited-member leakage
                    match Map.tryFind name env with
                    | Some v -> ctrl <- Ret v
                    | None -> raise (ResumeFail(Unbound name))
                | Binary(op, l, r) ->
                    stack <- EvalRight(op, r, env) :: stack
                    ctrl <- Eval(l, env)
                | Cond(test, thenE, elseE) ->
                    stack <- Branch(thenE, elseE, env) :: stack
                    ctrl <- Eval(test, env)
                | Call(fn, args) ->
                    match args with
                    | [] ->
                        let act = { Fn = fn; Args = [] }
                        outcome <- Suspended({ Kont = stack; Awaiting = act }, act)
                        running <- false
                    | a0 :: rest ->
                        stack <- EvalArgs(fn, rest, [], env) :: stack
                        ctrl <- Eval(a0, env)
                | Lambda _ -> raise (ResumeFail(UnsupportedNode "lambda"))
            | Ret value ->
                match stack with
                | [] ->
                    outcome <- Done value
                    running <- false
                | top :: rest ->
                    match top with
                    | EvalRight(op, r, env) ->
                        stack <- ApplyOp(op, value) :: rest
                        ctrl <- Eval(r, env)
                    | ApplyOp(op, left) ->
                        stack <- rest
                        ctrl <- Ret(applyBinOp op left value)
                    | Branch(thenE, elseE, env) ->
                        let t = asBool value "cond.test"
                        stack <- rest
                        ctrl <- Eval((if t then thenE else elseE), env)
                    | EvalArgs(fn, pending, doneArgs, env) ->
                        let doneArgs2 = doneArgs @ [ value ]

                        match pending with
                        | [] ->
                            let act = { Fn = fn; Args = doneArgs2 }
                            outcome <- Suspended({ Kont = rest; Awaiting = act }, act)
                            running <- false
                        | p0 :: pRest ->
                            stack <- EvalArgs(fn, pRest, doneArgs2, env) :: rest
                            ctrl <- Eval(p0, env)

        outcome

    let private trap (thunk: unit -> SagaStep) : Result<SagaStep, ResumeFeedback> =
        try
            Ok(thunk ())
        with ResumeFail f ->
            Error f

    /// Start a saga: evaluate `program` (with initial `bindings`) until it finishes or suspends.
    let start (program: Expr) (bindings: Env) : Result<SagaStep, ResumeFeedback> =
        trap (fun () -> run (Eval(program, bindings)) [])

    /// Resume a suspended saga: feed `activityResult` back as the awaited call's value and
    /// continue the restored continuation (no replay — prior activities are not re-invoked).
    let resume (state: SagaState) (activityResult: ConstValue) : Result<SagaStep, ResumeFeedback> =
        trap (fun () -> run (Ret activityResult) state.Kont)

    // ---- state serialization (persist a suspension; round-trips) ----------

    /// Escape a string to canonical JSON — byte-identical to JS `JSON.stringify` (and to
    /// `Bonsai`'s embedded-expr escaper), NOT `JsonSerializer.Serialize` (which escapes more
    /// chars, e.g. astral as `\uXXXX\uXXXX` and `<`/`>`/`&`). State strings (fn names, env keys,
    /// CStr values) must match the reference so a TS-persisted state restores byte-for-byte on
    /// F#/C#/Rust — the whole point of the cross-oracle resume ferry.
    let private jstr (s: string) : string =
        if isNull s then
            // a CLR caller can hand us a null fn / param key / CStr — decline cleanly so
            // serializeState stays total (it catches ResumeFail)
            raise (ResumeFail(MalformedState "null string field"))

        let sb = System.Text.StringBuilder(s.Length + 2)
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
                // valid surrogate pair — emit both code units literally (JSON.stringify emits
                // the astral character, not an escape)
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

    let private emitConstValue (c: ConstValue) : string =
        match c with
        | CInt v ->
            // symmetric with parse (and Bonsai): never emit an int parse would reject
            if v > MaxSafeInt || v < MinSafeInt then
                raise (ResumeFail(NonSafeInt v))

            sprintf "{\"t\":\"int\",\"v\":%d}" v
        | CStr s -> sprintf "{\"t\":\"str\",\"v\":%s}" (jstr s)
        | CBool b -> sprintf "{\"t\":\"bool\",\"v\":%s}" (if b then "true" else "false")
        | CNull -> "{\"t\":\"null\"}"

    let private emitEnv (env: Env) : string =
        let parts =
            env
            |> Map.toList
            |> List.sortBy fst
            |> List.map (fun (k, v) -> sprintf "%s:%s" (jstr k) (emitConstValue v))

        "{" + String.concat "," parts + "}"

    let private okExpr (e: Expr) (where: string) : string =
        match Bonsai.serialize e with
        | Ok s -> s
        | Error f -> raise (ResumeFail(MalformedState(sprintf "%s: %A" where f)))

    let private emitFrame (f: Frame) : string =
        match f with
        | EvalRight(op, r, env) ->
            sprintf
                "{\"k\":\"evalRight\",\"op\":%s,\"right\":%s,\"env\":%s}"
                (jstr (binOpToString op))
                (okExpr r "evalRight.right")
                (emitEnv env)
        | ApplyOp(op, left) ->
            sprintf "{\"k\":\"applyOp\",\"op\":%s,\"left\":%s}" (jstr (binOpToString op)) (emitConstValue left)
        | Branch(thenE, elseE, env) ->
            sprintf
                "{\"k\":\"branch\",\"then\":%s,\"els\":%s,\"env\":%s}"
                (okExpr thenE "branch.then")
                (okExpr elseE "branch.els")
                (emitEnv env)
        | EvalArgs(fn, pending, doneArgs, env) ->
            let pend = pending |> List.map (fun p -> okExpr p "evalArgs.pending") |> String.concat ","
            let dn = doneArgs |> List.map emitConstValue |> String.concat ","
            sprintf "{\"k\":\"evalArgs\",\"fn\":%s,\"pending\":[%s],\"done\":[%s],\"env\":%s}" (jstr fn) pend dn (emitEnv env)

    /// Serialize a suspended `SagaState` to a canonical string for persistence.
    let serializeState (state: SagaState) : Result<string, ResumeFeedback> =
        try
            // The in-memory Kont is a cons-stack (head = top = innermost / next-to-run); the
            // cross-oracle wire (TS reference) serializes the kont TOP-LAST (outermost frame
            // first, innermost last), so reverse before emitting to match the byte contract.
            let kont = state.Kont |> List.rev |> List.map emitFrame |> String.concat ","
            let args = state.Awaiting.Args |> List.map emitConstValue |> String.concat ","

            Ok(
                sprintf
                    "{\"v\":%d,\"kont\":[%s],\"awaiting\":{\"fn\":%s,\"args\":[%s]}}"
                    Version
                    kont
                    (jstr state.Awaiting.Fn)
                    args
            )
        with ResumeFail f ->
            Error f

    // ---- state parsing (restore a persisted suspension) -------------------

    let private bad (msg: string) : 'a = raise (ResumeFail(MalformedState msg))

    let private prop (el: JsonElement) (name: string) : JsonElement =
        match el.TryGetProperty name with
        | true, v -> v
        | _ -> bad (sprintf "missing %s" name)

    let private readConstValue (el: JsonElement) (where: string) : ConstValue =
        if el.ValueKind <> JsonValueKind.Object then
            bad (where + " is not an object")

        let tag =
            match el.TryGetProperty "t" with
            | true, te when te.ValueKind = JsonValueKind.String -> te.GetString()
            | _ -> null

        match tag with
        | "int" ->
            match el.TryGetProperty "v" with
            | true, v when v.ValueKind = JsonValueKind.Number ->
                match v.TryGetInt64() with
                // safe-int only (matches the Bonsai wire contract); a rounded/out-of-range
                // int from a tampered or cross-oracle state declines rather than restoring corrupt
                | true, n when n <= MaxSafeInt && n >= MinSafeInt -> CInt n
                | _ -> bad (where + " int value")
            | _ -> bad (where + " int value")
        | "str" ->
            match el.TryGetProperty "v" with
            | true, v when v.ValueKind = JsonValueKind.String -> CStr(v.GetString())
            | _ -> bad (where + " str value")
        | "bool" ->
            match el.TryGetProperty "v" with
            | true, v when v.ValueKind = JsonValueKind.True || v.ValueKind = JsonValueKind.False ->
                CBool(v.ValueKind = JsonValueKind.True)
            | _ -> bad (where + " bool value")
        | "null" -> CNull
        | _ -> bad (where + " unknown const tag")

    let private readEnv (el: JsonElement) (where: string) : Env =
        if el.ValueKind <> JsonValueKind.Object then
            bad (where + " is not an object")

        el.EnumerateObject()
        |> Seq.map (fun p -> p.Name, readConstValue p.Value (where + "." + p.Name))
        |> Map.ofSeq

    let private readExpr (el: JsonElement) (where: string) : Expr =
        match Bonsai.parse (el.GetRawText()) with
        | Ok e -> e
        | Error f -> bad (sprintf "%s expr: %A" where f)

    let private readBinOp (el: JsonElement) (where: string) : BinOp =
        let v =
            if el.ValueKind = JsonValueKind.String then
                binOpOfString (el.GetString())
            else
                None

        match v with
        | Some op -> op
        | None -> bad (where + " unknown operator")

    let private readArray (el: JsonElement) (where: string) : JsonElement list =
        if el.ValueKind <> JsonValueKind.Array then
            bad (where + " is not an array")

        [ for x in el.EnumerateArray() -> x ]

    let private readFrame (el: JsonElement) : Frame =
        if el.ValueKind <> JsonValueKind.Object then
            bad "frame is not an object"

        let k =
            match el.TryGetProperty "k" with
            | true, ke when ke.ValueKind = JsonValueKind.String -> ke.GetString()
            | _ -> bad "frame.k is missing or not a string"

        match k with
        | "evalRight" ->
            EvalRight(
                readBinOp (prop el "op") "evalRight.op",
                readExpr (prop el "right") "evalRight.right",
                readEnv (prop el "env") "evalRight.env"
            )
        | "applyOp" -> ApplyOp(readBinOp (prop el "op") "applyOp.op", readConstValue (prop el "left") "applyOp.left")
        | "branch" ->
            Branch(
                readExpr (prop el "then") "branch.then",
                readExpr (prop el "els") "branch.els",
                readEnv (prop el "env") "branch.env"
            )
        | "evalArgs" ->
            let fn =
                match prop el "fn" with
                | v when v.ValueKind = JsonValueKind.String -> v.GetString()
                | _ -> bad "evalArgs.fn"

            let pending =
                readArray (prop el "pending") "evalArgs.pending"
                |> List.map (fun p -> readExpr p "evalArgs.pending")

            let doneArgs =
                readArray (prop el "done") "evalArgs.done"
                |> List.map (fun d -> readConstValue d "evalArgs.done")

            EvalArgs(fn, pending, doneArgs, readEnv (prop el "env") "evalArgs.env")
        | _ -> bad "unknown frame kind"

    /// JSON tokenizer depth ceiling for restore. A persisted state embeds Bonsai-serialized
    /// Exprs INLINE (nested objects, up to `Bonsai.MaxDepth` = 1024 deep) wrapped in a few state
    /// levels (state → kont → frame → "right"/"then"/… → bonsai doc → "expr" → node…). The
    /// default `JsonDocument` MaxDepth is 64, which would reject a perfectly valid deep program;
    /// allow generous headroom above the worst case (embedded-expr depth + state wrapping).
    let private stateDepthCeiling = Bonsai.MaxDepth * 4

    /// Parse a persisted state string back to a `SagaState` (the inverse of `serializeState`).
    let parseState (s: string) : Result<SagaState, ResumeFeedback> =
        let parsed =
            try
                Ok(JsonDocument.Parse(s, JsonDocumentOptions(MaxDepth = stateDepthCeiling)))
            with ex ->
                Error(MalformedState ex.Message)

        match parsed with
        | Error f -> Error f
        | Ok doc ->
            use doc = doc

            try
                let root = doc.RootElement

                if root.ValueKind <> JsonValueKind.Object then
                    bad "state is not an object"

                match root.TryGetProperty "v" with
                | true, v when v.ValueKind = JsonValueKind.Number ->
                    match v.TryGetInt32() with
                    | true, n when n = Version -> ()
                    | _ -> bad "unsupported state version"
                | _ -> bad "state version is missing or not a number"

                // The wire stores the kont TOP-LAST (see serializeState); reverse after reading
                // to restore the in-memory cons-stack orientation (head = top = innermost).
                let kont = readArray (prop root "kont") "kont" |> List.map readFrame |> List.rev

                let aw =
                    match root.TryGetProperty "awaiting" with
                    | true, a when a.ValueKind = JsonValueKind.Object -> a
                    | _ -> bad "awaiting is missing or not an object"

                let fn =
                    match aw.TryGetProperty "fn" with
                    | true, v when v.ValueKind = JsonValueKind.String -> v.GetString()
                    | _ -> bad "awaiting.fn"

                let args =
                    readArray (prop aw "args") "awaiting.args"
                    |> List.map (fun a -> readConstValue a "awaiting.args")

                Ok { Kont = kont; Awaiting = { Fn = fn; Args = args } }
            with ResumeFail f ->
                Error f
