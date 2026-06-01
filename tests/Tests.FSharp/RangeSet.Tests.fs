module Zeta.Tests.RangeSetTests

open System.IO
open System.Reflection
open System.Text.Json
open global.Xunit
open Zeta.Core

// RangeSet — the F# oracle (#2 of TS/F#/C#/Rust). The TS reference
// (src/Core.TypeScript/range-set/) authors the shared golden vectors; this proves the F# impl
// replays them: render(parse input) == canonical (the cross-language byte lock) + contains agrees,
// and the rejection vectors decline the SPECIFIC feedback variant. "The compilers don't lie."

let private repoRoot () : string =
    let mutable dir = DirectoryInfo(Path.GetDirectoryName(Assembly.GetExecutingAssembly().Location))

    while not (isNull dir) && not (File.Exists(Path.Join(dir.FullName, "Zeta.sln"))) do
        dir <- dir.Parent

    if isNull dir then
        failwith "Could not locate repo root (Zeta.sln) from test assembly location."

    dir.FullName

let private golden () : JsonDocument =
    let path = Path.Join(repoRoot (), "src", "Core.TypeScript", "range-set", "golden-vectors.json")
    JsonDocument.Parse(File.ReadAllText path)

let private feedbackName (f: RangeSet.RangeSetFeedback) : string =
    match f with
    | RangeSet.NotInteger _ -> "NotInteger"
    | RangeSet.InvertedRange _ -> "InvertedRange"
    | RangeSet.Malformed _ -> "Malformed"

let private parseOk (input: string) : RangeSet.RangeSet =
    match RangeSet.parse input with
    | Ok rs -> rs
    | Error f -> failwithf "expected Ok for %A, got Error %A" input f

[<Fact>]
let ``F# RangeSet replays the shared golden cases (render(parse) == canonical + contains agrees)`` () =
    use doc = golden ()
    let cases = doc.RootElement.GetProperty("cases").EnumerateArray() |> Seq.toList
    Assert.True(cases.Length > 0, "no golden cases")

    for c in cases do
        let name = c.GetProperty("name").GetString()
        let input = c.GetProperty("input").GetString()
        let canonical = c.GetProperty("canonical").GetString()
        let rs = parseOk input
        Assert.Equal(canonical, RangeSet.render rs) // ($"{name}")
        // canonical is a fixed point of parse->render
        Assert.Equal(canonical, RangeSet.render (parseOk canonical))

        for probe in c.GetProperty("contains").EnumerateArray() do
            let arr = probe.EnumerateArray() |> Seq.toArray
            let n = arr.[0].GetInt64()
            let expected = arr.[1].GetBoolean()
            Assert.True((RangeSet.contains rs n) = expected, sprintf "%s: contains %d expected %b" name n expected)

[<Fact>]
let ``F# RangeSet rejection vectors decline the specific feedback variant`` () =
    use doc = golden ()

    for r in doc.RootElement.GetProperty("rejections").EnumerateArray() do
        let name = r.GetProperty("name").GetString()
        let input = r.GetProperty("input").GetString()
        let expected = r.GetProperty("feedback").GetString()

        match RangeSet.parse input with
        | Error f -> Assert.Equal(expected, feedbackName f)
        | Ok rs -> failwithf "%s: expected Error %s, got Ok %A" name expected rs

[<Fact>]
let ``F# RangeSet structural laws — union/add/size coalesce + count`` () =
    Assert.Equal("1-6", RangeSet.render (RangeSet.union (parseOk "1-3") (parseOk "4-6")))
    Assert.Equal("1-6,10-14", RangeSet.render (RangeSet.union (parseOk "1-5,10-12") (parseOk "6,13-14")))
    Assert.Equal("1-7", RangeSet.render (RangeSet.add (parseOk "1-3,5-7") 4L))
    Assert.Equal("1-3,10", RangeSet.render (RangeSet.add (parseOk "1-3") 10L))
    Assert.Equal(0L, RangeSet.size (parseOk ""))
    Assert.Equal(14L, RangeSet.size (parseOk "1-5,8,10-17"))
