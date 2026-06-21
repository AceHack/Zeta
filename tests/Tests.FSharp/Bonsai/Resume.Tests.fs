module Zeta.Tests.Bonsai.ResumeTests

open System.IO
open System.Reflection
open System.Text.Json
open global.Xunit
open Zeta.Core
open Zeta.Core.Bonsai
open Zeta.Core.Resume

// Resume engine — the F# oracle (#2 of TS/F#/C#/Rust) for the 081KT07NV0008QG0R003BE6MJ2 resume slice. The TS
// reference (src/Core.TypeScript/bonsai/resume.ts) authors the shared saga traces
// (resume-golden.json); this proves the F# impl replays them: same ordered suspension
// sequence + same final value (the cross-language behavioral lock), and restore-not-replay
// (persist + re-parse the state at every suspension; prior activities are never re-invoked).
// "The compilers don't lie."

// Walk up from the test assembly to the repo root (Zeta.sln sentinel).
let private repoRoot () : string =
    let mutable dir = DirectoryInfo(Path.GetDirectoryName(Assembly.GetExecutingAssembly().Location))

    while not (isNull dir) && not (File.Exists(Path.Join(dir.FullName, "Zeta.sln"))) do
        dir <- dir.Parent

    if isNull dir then
        failwith "Could not locate repo root (Zeta.sln) from test assembly location."

    dir.FullName

// ---- golden JSON -> F# DU converters (the golden stores programs as expr-node objects) ----

let private binOpOfJson (s: string) : BinOp =
    match s with
    | "add" -> Add
    | "sub" -> Sub
    | "mul" -> Mul
    | "eq" -> Eq
    | "lt" -> Lt
    | "and" -> And
    | "or" -> Or
    | other -> failwithf "unknown op %s" other

let rec private exprOfJson (el: JsonElement) : Expr =
    match el.GetProperty("kind").GetString() with
    | "const" -> Const(constValueOfJson (el.GetProperty "value"))
    | "param" -> Param(el.GetProperty("name").GetString())
    | "lambda" ->
        Lambda([ for p in el.GetProperty("params").EnumerateArray() -> p.GetString() ], exprOfJson (el.GetProperty "body"))
    | "binary" ->
        Binary(
            binOpOfJson (el.GetProperty("op").GetString()),
            exprOfJson (el.GetProperty "left"),
            exprOfJson (el.GetProperty "right")
        )
    | "call" -> Call(el.GetProperty("fn").GetString(), [ for a in el.GetProperty("args").EnumerateArray() -> exprOfJson a ])
    | "cond" ->
        Cond(exprOfJson (el.GetProperty "test"), exprOfJson (el.GetProperty "then"), exprOfJson (el.GetProperty "else"))
    | other -> failwithf "unknown kind %s" other

and private constValueOfJson (el: JsonElement) : ConstValue =
    match el.GetProperty("t").GetString() with
    | "int" -> CInt(el.GetProperty("v").GetInt64())
    | "str" -> CStr(el.GetProperty("v").GetString())
    | "bool" -> CBool(el.GetProperty("v").GetBoolean())
    | "null" -> CNull
    | other -> failwithf "unknown const tag %s" other

let private activityOfJson (el: JsonElement) : Activity =
    { Fn = el.GetProperty("fn").GetString()
      Args = [ for a in el.GetProperty("args").EnumerateArray() -> constValueOfJson a ] }

// ---- golden loader ----

type private Trace =
    { Name: string
      Program: Expr
      Bindings: Env
      ActivityResults: ConstValue list
      ExpectedSuspensions: Activity list
      // the canonical serializeState bytes the TS reference emits at each suspension, in order —
      // the cross-oracle STATE-BYTE lock this F# ferry must reproduce verbatim (kont top-last)
      ExpectedStateAtSuspension: string list
      ExpectedFinal: ConstValue }

let private goldenTraces () : Trace list =
    let path = Path.Join(repoRoot (), "src", "Core.TypeScript", "bonsai", "resume-golden.json")
    use doc = JsonDocument.Parse(File.ReadAllText(path))

    [ for c in doc.RootElement.GetProperty("traces").EnumerateArray() ->
          let bindings =
              c.GetProperty("bindings").EnumerateObject()
              |> Seq.map (fun p -> p.Name, constValueOfJson p.Value)
              |> Map.ofSeq

          { Name = c.GetProperty("name").GetString()
            Program = exprOfJson (c.GetProperty "program")
            Bindings = bindings
            ActivityResults = [ for a in c.GetProperty("activityResults").EnumerateArray() -> constValueOfJson a ]
            ExpectedSuspensions = [ for s in c.GetProperty("expectedSuspensions").EnumerateArray() -> activityOfJson s ]
            ExpectedStateAtSuspension =
              [ for s in c.GetProperty("expectedStateAtSuspension").EnumerateArray() -> s.GetString() ]
            ExpectedFinal = constValueOfJson (c.GetProperty "expectedFinal") } ]

let private stepOk (r: Result<SagaStep, ResumeFeedback>) : SagaStep =
    match r with
    | Ok s -> s
    | Error f -> failwithf "expected Ok SagaStep, got Error %A" f

let private stateOk (r: Result<SagaState, ResumeFeedback>) : SagaState =
    match r with
    | Ok s -> s
    | Error f -> failwithf "expected Ok SagaState, got Error %A" f

let private strOk (r: Result<string, ResumeFeedback>) : string =
    match r with
    | Ok s -> s
    | Error f -> failwithf "expected Ok string, got Error %A" f

[<Fact>]
let ``F# resume replays every shared golden saga-trace (restore-not-replay at each suspension)`` () =
    let traces = goldenTraces ()
    Assert.True(traces.Length > 0, "no golden traces loaded")

    for tr in traces do
        let mutable step = stepOk (start tr.Program tr.Bindings)

        for i in 0 .. tr.ExpectedSuspensions.Length - 1 do
            match step with
            | Done v -> failwithf "%s: expected suspension %d, got Done %A" tr.Name i v
            | Suspended(state, activity) ->
                Assert.Equal(tr.ExpectedSuspensions.[i], activity)
                // persist -> re-parse -> resume from the RESTORED state (not a replay)
                let ser = strOk (serializeState state)
                // STATE-BYTE LOCK: the persisted continuation must equal the TS reference bytes
                // (the kont serializes top-last — innermost frame last in the array)
                Assert.Equal(tr.ExpectedStateAtSuspension.[i], ser)
                let restored = stateOk (parseState ser)
                // canonical round-trip is byte-stable
                Assert.Equal(ser, strOk (serializeState restored))
                step <- stepOk (resume restored tr.ActivityResults.[i])

        match step with
        | Done v -> Assert.Equal(tr.ExpectedFinal, v)
        | Suspended(_, a) -> failwithf "%s: expected Done, still suspended on %A" tr.Name a

[<Fact>]
let ``F# resume: unbound param declines Unbound (incl. names that are not Map keys)`` () =
    for name in [ "missing"; "toString"; "constructor" ] do
        match start (Param name) Map.empty with
        | Error(Unbound _) -> ()
        | other -> failwithf "expected Error Unbound for %s, got %A" name other

[<Fact>]
let ``F# resume: type mismatch declines TypeMismatch`` () =
    match start (Binary(Add, Const(CInt 1L), Const(CBool true))) Map.empty with
    | Error(TypeMismatch _) -> ()
    | other -> failwithf "expected Error TypeMismatch, got %A" other

[<Fact>]
let ``F# resume: lambda in eval position declines UnsupportedNode (slice-1)`` () =
    match start (Lambda([ "x" ], Const(CInt 1L))) Map.empty with
    | Error(UnsupportedNode _) -> ()
    | other -> failwithf "expected Error UnsupportedNode, got %A" other

[<Fact>]
let ``F# resume: arithmetic past the safe-int range declines NonSafeInt`` () =
    // 2^53-1 (the shared max safe int) + 1 overflows the wire domain
    match start (Binary(Add, Const(CInt 9007199254740991L), Const(CInt 1L))) Map.empty with
    | Error(NonSafeInt _) -> ()
    | other -> failwithf "expected Error NonSafeInt, got %A" other

[<Fact>]
let ``F# resume: serializeState/parseState round-trip + restored resume equals original`` () =
    let program = Binary(Add, Call("x", []), Call("y", []))

    match stepOk (start program Map.empty) with
    | Done v -> failwithf "expected suspension, got Done %A" v
    | Suspended(state, _) ->
        let ser = strOk (serializeState state)
        let restored = stateOk (parseState ser)
        let fromOriginal = resume state (CInt 1L)
        let fromRestored = resume restored (CInt 1L)
        Assert.Equal(fromOriginal, fromRestored)

[<Fact>]
let ``F# resume: multiply that overflows int64 but wraps back into safe range declines NonSafeInt (not silent-wrong)`` () =
    // 4294967296 (= 2^32) is a valid safe int (≈4.3e9 ≪ 2^53-1); its square is 2^64, which wraps
    // to *exactly 0* in signed int64. A naive `int64 a * int64 b` then `0 in-range -> CInt 0`
    // returns a silently-wrong result. The bigint-first path must catch the true product as
    // out-of-safe-range. (TS is immune: JS floats lose precision but Number.isSafeInteger catches it.)
    match start (Binary(Mul, Const(CInt 4294967296L), Const(CInt 4294967296L))) Map.empty with
    | Error(NonSafeInt _) -> ()
    | Ok(Done v) -> failwithf "int64-wrap silent-wrong leak: expected NonSafeInt, got Done %A" v
    | other -> failwithf "expected Error NonSafeInt, got %A" other

[<Fact>]
let ``F# resume: a deep-but-valid embedded program restores (parseState depth ceiling > default 64)`` () =
    // The persisted state embeds the Bonsai-serialized right operand INLINE; a default
    // JsonDocument MaxDepth (64) would reject a valid program nested deeper than that.
    let rec deepNest n =
        if n <= 0 then Const(CInt 0L) else Binary(Add, Const(CInt 1L), deepNest (n - 1))

    // left is a no-arg Call -> suspends immediately, leaving the deep right operand in the
    // EvalRight frame (≈200 JSON levels once serialized — well past 64, well under MaxDepth=1024).
    let program = Binary(Add, Call("a", []), deepNest 100)

    match stepOk (start program Map.empty) with
    | Done v -> failwithf "expected suspension, got Done %A" v
    | Suspended(state, _) ->
        let ser = strOk (serializeState state)
        let restored = stateOk (parseState ser) // would be MalformedState under the default depth
        Assert.Equal(ser, strOk (serializeState restored)) // round-trip is byte-stable

[<Fact>]
let ``F# resume: state strings escape like JSON.stringify (literal '<', not JsonSerializer's <)`` () =
    // Cross-machine durability: F#/C#/Rust state bytes must match the TS reference. JsonSerializer
    // escapes '<' as < (and astral as surrogate \u escapes); JSON.stringify emits '<' literally.
    let program = Call("act", [ Const(CStr "x<y\"z\n") ])

    match stepOk (start program Map.empty) with
    | Suspended(state, _) ->
        let ser = strOk (serializeState state)
        Assert.Contains("<", ser) // literal '<' — JsonSerializer would have written <
        Assert.DoesNotContain("\\u003", ser) // no < / > style escaping of '<'
        Assert.Contains("\\n", ser) // newline as the canonical short escape
        let restored = stateOk (parseState ser)
        Assert.Equal(ser, strOk (serializeState restored)) // round-trips byte-stable
    | Done v -> failwithf "expected suspension, got Done %A" v

[<Fact>]
let ``F# resume: parseState declines MalformedState on junk + bad version + tampered op + unsafe int`` () =
    Assert.True(
        (match parseState "not json" with
         | Error(MalformedState _) -> true
         | _ -> false)
    )

    Assert.True(
        (match parseState "{\"v\":2,\"kont\":[],\"awaiting\":{\"fn\":\"a\",\"args\":[]}}" with
         | Error(MalformedState _) -> true
         | _ -> false)
    )

    // a real suspension's persisted state with a tampered op / unsafe int must be rejected
    let program = Binary(Add, Call("a", [ Const(CInt 7L) ]), Call("b", []))

    match stepOk (start program Map.empty) with
    | Suspended(state, _) ->
        let ser = strOk (serializeState state)
        let tamperedOp = ser.Replace("\"op\":\"add\"", "\"op\":\"xor\"")
        Assert.NotEqual<string>(ser, tamperedOp)

        Assert.True(
            (match parseState tamperedOp with
             | Error(MalformedState _) -> true
             | _ -> false)
        )

        let tamperedInt = ser.Replace("\"v\":7", "\"v\":9007199254740993")
        Assert.NotEqual<string>(ser, tamperedInt)

        Assert.True(
            (match parseState tamperedInt with
             | Error(MalformedState _) -> true
             | _ -> false)
        )
    | Done v -> failwithf "expected suspension, got Done %A" v
