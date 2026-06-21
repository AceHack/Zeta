module Zeta.Tests.Bonsai.BonsaiTests

open System.IO
open System.Reflection
open System.Text.Json
open global.Xunit
open Zeta.Core

// Bonsai-subset serializer — the F# oracle (#2 of TS/F#/C#/Rust) for 081KT07NV0008QG0R003BE6MJ2
// slice 1. The TS reference oracle (src/Core.TypeScript/bonsai/) authors the
// shared golden vectors; this proves the F# impl replays them byte-for-byte:
// serialize(parse canonical) = Ok canonical (the cross-language byte lock) AND an
// independently F#-constructed tree serializes to the same canonical bytes.
// "The compilers don't lie."
//
// Error channel: serialize/parse return Result<_, BonsaiFeedback> (result over
// throw). The rejection tests assert the SPECIFIC feedback variant, not merely
// "it failed" — that's the cross-language rejection-vector contract (every oracle
// declines the same bad input with the same variant).

// Walk up from the test assembly to the repo root (Zeta.sln sentinel).
let private repoRoot () : string =
    let mutable dir = DirectoryInfo(Path.GetDirectoryName(Assembly.GetExecutingAssembly().Location))

    while not (isNull dir) && not (File.Exists(Path.Join(dir.FullName, "Zeta.sln"))) do
        dir <- dir.Parent

    if isNull dir then
        failwith "Could not locate repo root (Zeta.sln) from test assembly location."

    dir.FullName

// Read each golden case's (name, canonical) eagerly so the JsonDocument is safe
// to dispose before the values are used.
let private goldenCanonicals () : (string * string) list =
    let path = Path.Join(repoRoot (), "src", "Core.TypeScript", "bonsai", "golden-vectors.json")
    use doc = JsonDocument.Parse(File.ReadAllText(path))

    [ for c in doc.RootElement.GetProperty("cases").EnumerateArray() ->
          c.GetProperty("name").GetString(), c.GetProperty("canonical").GetString() ]

// Unwrap an Ok, or fail the test with the feedback.
let private ok (r: Result<'a, Bonsai.BonsaiFeedback>) : 'a =
    match r with
    | Ok v -> v
    | Error f -> failwithf "expected Ok, got Error %A" f

// True when the Result is an Error whose feedback satisfies the predicate.
let private isErr (pred: Bonsai.BonsaiFeedback -> bool) (r: Result<'a, Bonsai.BonsaiFeedback>) : bool =
    match r with
    | Error f -> pred f
    | Ok _ -> false

[<Fact>]
let ``F# serialize is the byte-exact fixed point of every shared Bonsai golden canonical`` () =
    let cases = goldenCanonicals ()
    Assert.True(cases.Length > 0, "no golden cases loaded")

    for (name, canonical) in cases do
        let round = canonical |> Bonsai.parse |> ok |> Bonsai.serialize |> ok
        Assert.True((round = canonical), sprintf "case %s: serialize(parse canonical) != canonical\n exp: %s\n got: %s" name canonical round)

[<Fact>]
let ``F#-constructed factorial serializes to the shared canonical bytes`` () =
    // Independent construction path (not via parse) — proves F# serialize emits
    // the exact TS reference bytes for a non-trivial tree (cond + recursive call).
    let fact =
        Bonsai.Lambda(
            [ "n" ],
            Bonsai.Cond(
                Bonsai.Binary(Bonsai.Lt, Bonsai.Param "n", Bonsai.Const(Bonsai.CInt 2L)),
                Bonsai.Const(Bonsai.CInt 1L),
                Bonsai.Binary(
                    Bonsai.Mul,
                    Bonsai.Param "n",
                    Bonsai.Call("fact", [ Bonsai.Binary(Bonsai.Sub, Bonsai.Param "n", Bonsai.Const(Bonsai.CInt 1L)) ])
                )
            )
        )

    let expected = goldenCanonicals () |> List.find (fun (n, _) -> n = "factorial") |> snd
    Assert.Equal(expected, ok (Bonsai.serialize fact))

[<Fact>]
let ``parse round-trips structurally through serialize (DU equality, every case)`` () =
    for (_, canonical) in goldenCanonicals () do
        let e1 = ok (Bonsai.parse canonical)
        let e2 = ok (Bonsai.parse (ok (Bonsai.serialize e1)))
        Assert.Equal<Bonsai.Expr>(e1, e2)

// ---- rejection contract (each asserts the specific BonsaiFeedback variant) ----

[<Fact>]
let ``parse declines an unknown node kind with UnknownKind`` () =
    Assert.True(
        Bonsai.parse "{\"v\":1,\"expr\":{\"kind\":\"bogus\"}}"
        |> isErr (function
            | Bonsai.UnknownKind _ -> true
            | _ -> false)
    )

[<Fact>]
let ``parse declines an unsupported version with UnsupportedVersion`` () =
    Assert.True(
        Bonsai.parse "{\"v\":2,\"expr\":{\"kind\":\"param\",\"name\":\"x\"}}"
        |> isErr (function
            | Bonsai.UnsupportedVersion(2, 1) -> true
            | _ -> false)
    )

[<Fact>]
let ``parse declines an int beyond the safe-integer range with NonSafeInt`` () =
    // 2^53 + 1 — a valid int64 the TS oracle's number would round; reject.
    Assert.True(
        Bonsai.parse "{\"v\":1,\"expr\":{\"kind\":\"const\",\"value\":{\"t\":\"int\",\"v\":9007199254740993}}}"
        |> isErr (function
            | Bonsai.NonSafeInt _ -> true
            | _ -> false)
    )

[<Fact>]
let ``serialize declines an int beyond the safe-integer range with NonSafeInt`` () =
    Assert.True(
        Bonsai.serialize (Bonsai.Const(Bonsai.CInt 9007199254740993L))
        |> isErr (function
            | Bonsai.NonSafeInt 9007199254740993L -> true
            | _ -> false)
    )

[<Fact>]
let ``serialize accepts the safe-integer boundary (2^53 - 1)`` () =
    let s = ok (Bonsai.serialize (Bonsai.Const(Bonsai.CInt 9007199254740991L)))
    Assert.Equal("{\"v\":1,\"expr\":{\"kind\":\"const\",\"value\":{\"t\":\"int\",\"v\":9007199254740991}}}", s)

[<Fact>]
let ``serialize escapes a lone high surrogate as lowercase backslash-u (matches JSON.stringify)`` () =
    let s = ok (Bonsai.serialize (Bonsai.Param(System.String([| '\uD800' |]))))
    Assert.Contains("\\ud800", s)

[<Fact>]
let ``serialize keeps a valid surrogate pair literal (matches JSON.stringify)`` () =
    let pair = System.String([| '\uD83D'; '\uDE00' |])
    let s = ok (Bonsai.serialize (Bonsai.Param pair))
    Assert.Contains(pair, s)
    Assert.DoesNotContain("\\ud83d", s)

[<Fact>]
let ``parse declines a non-canonical vector (extra field) with NonCanonical`` () =
    Assert.True(
        Bonsai.parse "{\"v\":1,\"expr\":{\"kind\":\"param\",\"name\":\"x\",\"extra\":0}}"
        |> isErr (function
            | Bonsai.NonCanonical -> true
            | _ -> false)
    )

[<Fact>]
let ``parse declines non-canonical whitespace with NonCanonical`` () =
    Assert.True(
        Bonsai.parse "{\"v\":1, \"expr\":{\"kind\":\"param\",\"name\":\"x\"}}"
        |> isErr (function
            | Bonsai.NonCanonical -> true
            | _ -> false)
    )

[<Fact>]
let ``parse declines non-canonical key order with NonCanonical`` () =
    Assert.True(
        Bonsai.parse "{\"expr\":{\"kind\":\"param\",\"name\":\"x\"},\"v\":1}"
        |> isErr (function
            | Bonsai.NonCanonical -> true
            | _ -> false)
    )

[<Fact>]
let ``parse declines a null string value with ExpectedString (no NRE)`` () =
    // The P1: GetString() returns null for a JSON null; must decline cleanly,
    // not build Param null and crash inside serialize.
    Assert.True(
        Bonsai.parse "{\"v\":1,\"expr\":{\"kind\":\"param\",\"name\":null}}"
        |> isErr (function
            | Bonsai.ExpectedString _ -> true
            | _ -> false)
    )

[<Fact>]
let ``parse declines a null const str value with ExpectedString`` () =
    Assert.True(
        Bonsai.parse "{\"v\":1,\"expr\":{\"kind\":\"const\",\"value\":{\"t\":\"str\",\"v\":null}}}"
        |> isErr (function
            | Bonsai.ExpectedString _ -> true
            | _ -> false)
    )

[<Fact>]
let ``parse declines a non-boolean bool literal with ExpectedBool`` () =
    Assert.True(
        Bonsai.parse "{\"v\":1,\"expr\":{\"kind\":\"const\",\"value\":{\"t\":\"bool\",\"v\":1}}}"
        |> isErr (function
            | Bonsai.ExpectedBool _ -> true
            | _ -> false)
    )

[<Fact>]
let ``parse declines a fractional int literal with ExpectedInt`` () =
    Assert.True(
        Bonsai.parse "{\"v\":1,\"expr\":{\"kind\":\"const\",\"value\":{\"t\":\"int\",\"v\":1.5}}}"
        |> isErr (function
            | Bonsai.ExpectedInt _ -> true
            | _ -> false)
    )

[<Fact>]
let ``parse declines an unknown binary operator with UnknownOp`` () =
    Assert.True(
        Bonsai.parse
            "{\"v\":1,\"expr\":{\"kind\":\"binary\",\"op\":\"div\",\"left\":{\"kind\":\"param\",\"name\":\"a\"},\"right\":{\"kind\":\"param\",\"name\":\"b\"}}}"
        |> isErr (function
            | Bonsai.UnknownOp "div" -> true
            | _ -> false)
    )

[<Fact>]
let ``parse declines an unknown const tag with UnknownConstTag`` () =
    Assert.True(
        Bonsai.parse "{\"v\":1,\"expr\":{\"kind\":\"const\",\"value\":{\"t\":\"bogus\"}}}"
        |> isErr (function
            | Bonsai.UnknownConstTag "bogus" -> true
            | _ -> false)
    )

[<Fact>]
let ``parse declines malformed JSON with MalformedJson`` () =
    Assert.True(
        Bonsai.parse "not json at all"
        |> isErr (function
            | Bonsai.MalformedJson _ -> true
            | _ -> false)
    )

// ---- nesting-depth contract (past System.Text.Json's default 64; bounded) ----

let rec private buildDeepChain (n: int) : Bonsai.Expr =
    if n <= 0 then
        Bonsai.Const(Bonsai.CInt 1L)
    else
        Bonsai.Binary(Bonsai.Add, buildDeepChain (n - 1), Bonsai.Const(Bonsai.CInt 0L))

[<Fact>]
let ``deep-but-valid expression round-trips past System.Text.Json's default depth 64`` () =
    let deep = buildDeepChain 100
    Assert.Equal<Bonsai.Expr>(deep, ok (Bonsai.parse (ok (Bonsai.serialize deep))))

[<Fact>]
let ``serialize declines an expression past the v1 maximum nesting depth with TooDeep`` () =
    Assert.True(
        Bonsai.serialize (buildDeepChain (Bonsai.MaxDepth + 50))
        |> isErr (function
            | Bonsai.TooDeep _ -> true
            | _ -> false)
    )

// ---- total contract: no exception escapes serialize/parse, even on CLR null ----

[<Fact>]
let ``serialize declines a null string field with ExpectedString (no NRE)`` () =
    // A CLR caller can construct Param null directly (the DU permits it).
    let nullName: string = null
    Assert.True(
        Bonsai.serialize (Bonsai.Param nullName)
        |> isErr (function
            | Bonsai.ExpectedString _ -> true
            | _ -> false)
    )

[<Fact>]
let ``serialize declines a null const string value with ExpectedString`` () =
    let nullVal: string = null
    Assert.True(
        Bonsai.serialize (Bonsai.Const(Bonsai.CStr nullVal))
        |> isErr (function
            | Bonsai.ExpectedString _ -> true
            | _ -> false)
    )

[<Fact>]
let ``parse declines null input with MalformedJson (no ArgumentNullException)`` () =
    let nullInput: string = null
    Assert.True(
        Bonsai.parse nullInput
        |> isErr (function
            | Bonsai.MalformedJson _ -> true
            | _ -> false)
    )

// ---- accumulate-mode (parseAll + ProblemDetails), matching the TS oracle ----

[<Fact>]
let ``parseAll returns Ok for every valid canonical golden vector`` () =
    for (name, canonical) in goldenCanonicals () do
        match Bonsai.parseAll canonical with
        | Ok _ -> ()
        | Error es -> Assert.True(false, sprintf "case %s: expected Ok, got %A" name es)

[<Fact>]
let ``parseAll collects every independent decline with its JSON-path`` () =
    // op="div" (UnknownOp @ $.expr.op) + left name=null (ExpectedString @ left.name)
    // + right bool v=1 (ExpectedBool @ right.value) — three independent errors.
    let doc =
        "{\"v\":1,\"expr\":{\"kind\":\"binary\",\"op\":\"div\",\"left\":{\"kind\":\"param\",\"name\":null},\"right\":{\"kind\":\"const\",\"value\":{\"t\":\"bool\",\"v\":1}}}}"

    match Bonsai.parseAll doc with
    | Ok _ -> Assert.True(false, "expected Error")
    | Error es ->
        Assert.Equal(3, List.length es)
        let paths = es |> List.map (fun e -> e.Path) |> List.sort
        Assert.Equal<string list>([ "$.expr.left.name"; "$.expr.op"; "$.expr.right.value" ], paths)

        Assert.True(
            es
            |> List.exists (fun e ->
                match e.Feedback with
                | Bonsai.UnknownOp "div" -> true
                | _ -> false)
        )

        Assert.True(
            es
            |> List.exists (fun e ->
                match e.Feedback with
                | Bonsai.ExpectedBool _ -> true
                | _ -> false)
        )

[<Fact>]
let ``toProblemDetails groups declines into an RFC-9457 errors map keyed by path`` () =
    let doc =
        "{\"v\":1,\"expr\":{\"kind\":\"binary\",\"op\":\"div\",\"left\":{\"kind\":\"param\",\"name\":null},\"right\":{\"kind\":\"const\",\"value\":{\"t\":\"int\",\"v\":1.5}}}}"

    match Bonsai.parseAll doc with
    | Ok _ -> Assert.True(false, "expected Error")
    | Error es ->
        let pd = Bonsai.toProblemDetails es
        Assert.Equal("Bonsai validation failed", pd.Title)
        let keys = pd.Errors |> Map.toList |> List.map fst |> List.sort
        Assert.Equal<string list>([ "$.expr.left.name"; "$.expr.op"; "$.expr.right.value" ], keys)

[<Fact>]
let ``parseAll returns a single decline for malformed JSON`` () =
    match Bonsai.parseAll "not json" with
    | Ok _ -> Assert.True(false, "expected Error")
    | Error es ->
        Assert.Equal(1, List.length es)
        Assert.True(
            match es.Head.Feedback with
            | Bonsai.MalformedJson _ -> true
            | _ -> false
        )

[<Fact>]
let ``parseAll declines NonCanonical (single) for structurally-valid but non-canonical input`` () =
    match Bonsai.parseAll "{\"v\":1,\"expr\":{\"kind\":\"param\",\"name\":\"x\",\"extra\":0}}" with
    | Ok _ -> Assert.True(false, "expected Error")
    | Error es ->
        Assert.Equal(1, List.length es)
        Assert.True(
            match es.Head.Feedback with
            | Bonsai.NonCanonical -> true
            | _ -> false
        )

// ---- hexagonal value-codec port (Codec.ICodec adapter) ----

[<Fact>]
let ``Bonsai.codec is the value-codec port: round-trips every golden + agrees with serialize/parse`` () =
    let codec = Bonsai.codec
    Assert.Equal("bonsai/canonical-json-v1", codec.Name)
    let cases = goldenCanonicals ()
    Assert.True(cases.Length > 0, "no golden cases loaded")

    for (name, canonical) in cases do
        // the codec round-trips byte-exact through the port
        let node = codec.Deserialize canonical |> ok
        Assert.Equal(canonical, codec.Serialize node |> ok)
        // and the port agrees with the concrete serialize/parse it adapts
        Assert.Equal<Bonsai.Expr>((Bonsai.parse canonical |> ok), node)
        Assert.Equal((Bonsai.serialize node), (codec.Serialize node))
        ignore name

[<Fact>]
let ``Bonsai.codec surfaces the typed feedback channel (no exception crosses the port)`` () =
    let codec = Bonsai.codec
    Assert.True(codec.Deserialize "not json" |> isErr (fun _ -> true))
