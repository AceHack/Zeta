module Zeta.Tests.FSharp.Yaml.CrossVerifyTests

// F# oracle (oracle #3) cross-verify + YamlDotNet differential.
//
// The fixture tests/cross-verification/yaml/vectors.json is JSON (NOT YAML -- do not use
// YAML to test YAML). Read it via System.Text.Json. For each vector run `readEvents`,
// assert the event list equals the fixture's `expected`, and serialize `{ id: events }` to
// fsharp-output.json in the same shape as ts-output.json so compare.ts can Bun.deepEquals
// TS == F# == Rust.
//
// Plus a differential [<Fact>]: drive YamlDotNet's own forward-only event-level parser
// (YamlDotNet.Core.Parser over a StringReader) and compare its event stream to OUR
// readEvents output -- structure + raw + style only (YamlDotNet does not resolve our
// core-schema `kind`, so kind is ignored; kind is OUR contract, already validated by
// vectors.json above).

open System
open System.Collections.Generic
open System.IO
open System.Text.Json
open Xunit
open Zeta.Core.FSharp.Yaml

// --- Repo-root walk (Zeta.sln sentinel; mirrors ZetaId CrossVerifyTests) -------------

/// Walk up from the test assembly looking for Zeta.sln (sentinel at repo root). .git is
/// unreliable (in a worktree it is a file, not a directory).
let private repoRoot () : string =
    let assembly = typeof<YamlEvent>.Assembly
    let mutable dir = DirectoryInfo(Path.GetDirectoryName(assembly.Location))
    while not (isNull dir) && not (File.Exists(Path.Join(dir.FullName, "Zeta.sln"))) do
        dir <- dir.Parent
    if isNull dir then
        raise (InvalidOperationException("Could not locate repo root (Zeta.sln) from test assembly location."))
    dir.FullName

let private yamlDir () : string =
    Path.Join(repoRoot (), "tests", "cross-verification", "yaml")

// --- Enum <-> contract string mapping (the cross-language names) ---------------------

let private kindName (k: ScalarKind) : string =
    match k with
    | ScalarKind.Null -> "Null"
    | ScalarKind.Bool -> "Bool"
    | ScalarKind.Int -> "Int"
    | ScalarKind.Float -> "Float"
    | ScalarKind.Str -> "Str"

let private styleName (s: ScalarStyle) : string =
    match s with
    | ScalarStyle.Plain -> "Plain"
    | ScalarStyle.SingleQuoted -> "SingleQuoted"
    | ScalarStyle.DoubleQuoted -> "DoubleQuoted"

let private kindOfName (name: string) : ScalarKind =
    match name with
    | "Null" -> ScalarKind.Null
    | "Bool" -> ScalarKind.Bool
    | "Int" -> ScalarKind.Int
    | "Float" -> ScalarKind.Float
    | "Str" -> ScalarKind.Str
    | other -> raise (InvalidOperationException(sprintf "Unknown ScalarKind name: %s" other))

let private styleOfName (name: string) : ScalarStyle =
    match name with
    | "Plain" -> ScalarStyle.Plain
    | "SingleQuoted" -> ScalarStyle.SingleQuoted
    | "DoubleQuoted" -> ScalarStyle.DoubleQuoted
    | other -> raise (InvalidOperationException(sprintf "Unknown ScalarStyle name: %s" other))

let private eventTag (e: YamlEvent) : string =
    match e with
    | StreamStart -> "StreamStart"
    | StreamEnd -> "StreamEnd"
    | MappingStart -> "MappingStart"
    | MappingEnd -> "MappingEnd"
    | SequenceStart -> "SequenceStart"
    | SequenceEnd -> "SequenceEnd"
    | Scalar _ -> "Scalar"

// --- JSON event (de)serialization (shape matches ts-output.json) --------------------

/// One event as an ordered string->string dict: { e } for structural, or
/// { e, raw, kind, style } for a Scalar. Bun.deepEquals is key-order-insensitive so a
/// plain Dictionary serializes correctly.
let private eventToJsonObj (e: YamlEvent) : Dictionary<string, string> =
    let d = Dictionary<string, string>(StringComparer.Ordinal)
    d.["e"] <- eventTag e
    match e with
    | Scalar(raw, kind, style) ->
        d.["raw"] <- raw
        d.["kind"] <- kindName kind
        d.["style"] <- styleName style
    | _ -> ()
    d

/// Parse one fixture event object back into a YamlEvent (for the assert against `expected`).
let private eventFromJson (el: JsonElement) : YamlEvent =
    let tag = el.GetProperty("e").GetString()
    match tag with
    | "StreamStart" -> StreamStart
    | "StreamEnd" -> StreamEnd
    | "MappingStart" -> MappingStart
    | "MappingEnd" -> MappingEnd
    | "SequenceStart" -> SequenceStart
    | "SequenceEnd" -> SequenceEnd
    | "Scalar" ->
        let raw = el.GetProperty("raw").GetString()
        let kind = kindOfName (el.GetProperty("kind").GetString())
        let style = styleOfName (el.GetProperty("style").GetString())
        Scalar(raw, kind, style)
    | other -> raise (InvalidOperationException(sprintf "Unknown event tag: %s" other))

// --- Fixture model ------------------------------------------------------------------

type private Vector =
    { Id: string
      Yaml: string
      Expected: YamlEvent list }

let private loadVectors () : Vector list =
    let path = Path.Join(yamlDir (), "vectors.json")
    let text = File.ReadAllText(path)
    use doc = JsonDocument.Parse(text)
    let vectorsEl = doc.RootElement.GetProperty("vectors")
    [ for v in vectorsEl.EnumerateArray() ->
        { Id = v.GetProperty("id").GetString()
          Yaml = v.GetProperty("yaml").GetString()
          Expected = [ for ev in v.GetProperty("expected").EnumerateArray() -> eventFromJson ev ] } ]

// --- Cross-verify: events == expected, write fsharp-output.json ----------------------

[<Fact>]
let ``cross-verify ten yaml vectors match fixture expected`` () =
    let vectors = loadVectors ()
    // Preserve fixture order in the output map so the file is stable; compare.ts is
    // key-order-insensitive but stable output keeps diffs clean.
    let results = Dictionary<string, Dictionary<string, string> list>(StringComparer.Ordinal)
    let mutable mismatches = 0

    for v in vectors do
        let events =
            match readEvents v.Yaml with
            | Ok evs -> evs
            | Error f -> failwithf "vector %s declined unexpectedly: %A" v.Id f
        if events <> v.Expected then
            mismatches <- mismatches + 1
        results.[v.Id] <- events |> List.map eventToJsonObj

    // Serialize { id: events } to fsharp-output.json (System.Text.Json; same indent style as
    // the ZetaId precedent). UnsafeRelaxedJsonEscaping so a literal newline inside a Scalar
    // "raw" serializes as the JSON escape backslash-n (matching ts-output.json).
    let options =
        JsonSerializerOptions(
            WriteIndented = true,
            Encoder = System.Text.Encodings.Web.JavaScriptEncoder.UnsafeRelaxedJsonEscaping
        )
    // Normalize to pure LF: net10 System.Text.Json indents with the platform newline
    // (CRLF on Windows); the cross-verification fixtures are pure-LF, so strip CRs.
    let json = JsonSerializer.Serialize(results, options).Replace("\r\n", "\n")
    File.WriteAllText(Path.Join(yamlDir (), "fsharp-output.json"), json)

    Assert.Equal(0, mismatches)

// --- YamlDotNet differential --------------------------------------------------------

/// Map YamlDotNet's forward-only event stream to our structural shape for comparison. We
/// compare structural events (Mapping/Sequence Start/End) by tag, and Scalar by (raw, style)
/// -- IGNORING our `kind` (YamlDotNet does not resolve core-schema kinds the same way; kind
/// is OUR contract, already validated against vectors.json). YamlDotNet's StreamStart/End +
/// DocumentStart/End wrapper events are skipped; our StreamStart/End are skipped too, so both
/// sides reduce to the document body.
type private DiffEvent =
    | DMapStart
    | DMapEnd
    | DSeqStart
    | DSeqEnd
    | DScalar of raw: string * style: ScalarStyle

let private ourDiffStream (events: YamlEvent list) : DiffEvent list =
    events
    |> List.choose (fun e ->
        match e with
        | StreamStart | StreamEnd -> None
        | MappingStart -> Some DMapStart
        | MappingEnd -> Some DMapEnd
        | SequenceStart -> Some DSeqStart
        | SequenceEnd -> Some DSeqEnd
        | Scalar(raw, _, style) -> Some(DScalar(raw, style)))

/// Translate a YamlDotNet scalar's quote style to our ScalarStyle.
let private vendorStyle (s: YamlDotNet.Core.ScalarStyle) : ScalarStyle =
    match s with
    | YamlDotNet.Core.ScalarStyle.SingleQuoted -> ScalarStyle.SingleQuoted
    | YamlDotNet.Core.ScalarStyle.DoubleQuoted -> ScalarStyle.DoubleQuoted
    | _ -> ScalarStyle.Plain // Plain / Any / Literal / Folded -> Plain (subset is plain/quoted)

let private vendorDiffStream (yaml: string) : DiffEvent list =
    use reader = new StringReader(yaml)
    let parser = YamlDotNet.Core.Parser(reader)
    let acc = List<DiffEvent>()
    while parser.MoveNext() do
        match parser.Current with
        | :? YamlDotNet.Core.Events.MappingStart -> acc.Add(DMapStart)
        | :? YamlDotNet.Core.Events.MappingEnd -> acc.Add(DMapEnd)
        | :? YamlDotNet.Core.Events.SequenceStart -> acc.Add(DSeqStart)
        | :? YamlDotNet.Core.Events.SequenceEnd -> acc.Add(DSeqEnd)
        | :? YamlDotNet.Core.Events.Scalar as sc -> acc.Add(DScalar(sc.Value, vendorStyle sc.Style))
        // Skip wrapper events: StreamStart/End, DocumentStart/End, and anything else.
        | _ -> ()
    List.ofSeq acc

[<Fact>]
let ``yamldotnet differential agrees on all vectors (structure + raw + style)`` () =
    let vectors = loadVectors ()
    let mutable mismatches = 0
    for v in vectors do
        let ours =
            match readEvents v.Yaml with
            | Ok evs -> ourDiffStream evs
            | Error f -> failwithf "vector %s declined unexpectedly: %A" v.Id f
        let theirs = vendorDiffStream v.Yaml
        if ours <> theirs then
            mismatches <- mismatches + 1
    Assert.Equal(0, mismatches)
