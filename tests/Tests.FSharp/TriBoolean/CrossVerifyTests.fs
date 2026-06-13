module Zeta.Tests.FSharp.TriBoolean.CrossVerifyTests

open System
open System.IO
open System.Text
open System.Text.Json
open Xunit
open Zeta.Core.FSharp.TriBoolean
open Zeta.Core.FSharp.TriBoolean.TriBoolean
open Zeta.Core.FSharp.Yaml.Dom

// ---------------------------------------------------------------------------
// Repo-root walk (Zeta.sln sentinel)
// ---------------------------------------------------------------------------

let private repoRoot () : string =
    let assembly = typeof<YamlValue>.Assembly
    let mutable dir = DirectoryInfo(Path.GetDirectoryName(assembly.Location))
    while not (isNull dir) && not (File.Exists(Path.Join(dir.FullName, "Zeta.sln"))) do
        dir <- dir.Parent
    if isNull dir then
        raise (InvalidOperationException("Could not locate repo root (Zeta.sln) from test assembly location."))
    dir.FullName

// ---------------------------------------------------------------------------
// YamlValue navigation helpers
// ---------------------------------------------------------------------------

let private mapEntries (v: YamlValue) (ctx: string) : (string * YamlValue) list =
    match v with
    | VMap entries -> entries
    | other -> raise (InvalidOperationException(sprintf "expected Map at %s, got %A" ctx other))

let private field (entries: (string * YamlValue) list) (key: string) (ctx: string) : YamlValue =
    match entries |> List.tryFind (fun (k, _) -> String.Equals(k, key, StringComparison.Ordinal)) with
    | Some(_, value) -> value
    | None -> raise (InvalidOperationException(sprintf "missing field '%s' at %s" key ctx))

let private asStr (v: YamlValue) (ctx: string) : string =
    match v with
    | VStr s -> s
    | other -> raise (InvalidOperationException(sprintf "expected Str at %s, got %A" ctx other))

// ---------------------------------------------------------------------------
// Mapping functions
// ---------------------------------------------------------------------------

let private toTri (s: string) : Tri =
    match s with
    | "T" -> Tri.T
    | "F" -> Tri.F
    | "N" -> Tri.N
    | other -> raise (InvalidOperationException(sprintf "unknown tri state: %s" other))

let private toStr (t: Tri) : string =
    match t with
    | Tri.T -> "T"
    | Tri.F -> "F"
    | Tri.N -> "N"

// ---------------------------------------------------------------------------
// Cross-verify fact
// ---------------------------------------------------------------------------

[<Fact>]
let ``cross-verify tri-boolean vectors match TS + F# + C# + Rust`` () =
    let root = repoRoot ()
    let yamlPath = Path.Join(root, "tests", "cross-verification", "tri-boolean", "vectors.yaml")
    let yamlText = File.ReadAllText(yamlPath)

    let doc =
        match parse yamlText with
        | Ok value -> value
        | Error feedback ->
            raise (InvalidOperationException(sprintf "our YAML port declined vectors.yaml: %A" feedback))

    let top = mapEntries doc "<root>"
    let records =
        match field top "vectors" "<root>" with
        | VSeq items -> items
        | other -> raise (InvalidOperationException(sprintf "expected Seq at vectors, got %A" other))

    let results = System.Collections.Generic.Dictionary<string, obj>(StringComparer.Ordinal)

    for i in 0 .. records.Length - 1 do
        let ctx = sprintf "vectors[%d]" i
        let m = mapEntries records.[i] ctx
        let id = asStr (field m "id" ctx) (ctx + ".id")
        let typeStr = asStr (field m "type" ctx) (ctx + ".type")

        if typeStr = "unary" then
            let stateStr = asStr (field m "state" ctx) (ctx + ".state")
            let t = toTri stateStr
            let (measureOk, measureValue, measureFeedback) =
                match measure t with
                | Ok b -> (true, b, "")
                | Error CollapseFeedback.CollapsedLivingUncertainty -> (false, false, "collapsed-living-uncertainty")

            let res = {|
                ``type`` = "unary"
                state = stateStr
                isLiving = isLiving t
                isCertain = isCertain t
                notState = toStr (notTri t)
                cooperateState = toStr (cooperate t)
                measureOk = measureOk
                measureValue = measureValue
                measureFeedback = measureFeedback
                mapNot = toStr (mapTri not t)
                bindNot = toStr (bindTri (fun b -> fromBool (not b)) t)
                bindToT = toStr (bindTri (fun _ -> Tri.T) t)
            |}
            results.[id] <- box res
        else if typeStr = "binary" then
            let leftStr = asStr (field m "left" ctx) (ctx + ".left")
            let rightStr = asStr (field m "right" ctx) (ctx + ".right")
            let left = toTri leftStr
            let right = toTri rightStr

            let res = {|
                ``type`` = "binary"
                left = leftStr
                right = rightStr
                expectedAnd = toStr (andTri left right)
                expectedOr = toStr (orTri left right)
            |}
            results.[id] <- box res

    // Write fsharp-output.json
    let options = JsonSerializerOptions(WriteIndented = true)
    let json = JsonSerializer.Serialize(results, options).Replace("\r\n", "\n")
    let outputPath = Path.Join(root, "tests", "cross-verification", "tri-boolean", "fsharp-output.json")
    File.WriteAllText(outputPath, json)
