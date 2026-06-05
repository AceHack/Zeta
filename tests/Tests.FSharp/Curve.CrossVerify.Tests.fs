module Zeta.Tests.CurveCrossVerifyTests

open System.IO
open System.Text.Json
open global.Xunit
open Zeta.Core

// ═══════════════════════════════════════════════════════════════════
// Curve cross-language agreement — the F# oracle replays the shared seed
// (src/Core.TypeScript/curve/golden-vectors.json) and asserts identical rate/integrate/curvature. The
// C# oracle (CurveCrossVerifyTests.cs) replays the SAME seed; both passing == F# and C# agree on the
// discrete DBSP D/I calculus (the 2-lang leg toward full 4-lang for Curve).
// ═══════════════════════════════════════════════════════════════════

let private repoRoot () =
    let mutable dir = DirectoryInfo(Path.GetDirectoryName(System.Reflection.Assembly.GetExecutingAssembly().Location))
    while not (isNull dir) && not (File.Exists(Path.Join(dir.FullName, "Zeta.sln"))) do
        dir <- dir.Parent
    if isNull dir then failwith "Could not locate repo root (Zeta.sln)." else dir.FullName

let private longs (e: JsonElement) : int64[] =
    [| for x in e.EnumerateArray() -> x.GetInt64() |]

[<Fact>]
let ``F# Curve agrees with the shared golden seed`` () =
    let path = Path.Join(repoRoot (), "src", "Core.TypeScript", "curve", "golden-vectors.json")
    Assert.True(File.Exists path, sprintf "seed not found: %s" path)
    use doc = JsonDocument.Parse(File.ReadAllText path)
    let vectors = doc.RootElement.GetProperty("vectors").EnumerateArray() |> Seq.toArray
    Assert.NotEmpty vectors
    for v in vectors do
        let input = longs (v.GetProperty "input")
        Assert.Equal<int64[]>(longs (v.GetProperty "rate"), Curve.differentiate input)
        Assert.Equal<int64[]>(longs (v.GetProperty "integrate"), Curve.integrate input)
        Assert.Equal<int64[]>(longs (v.GetProperty "curvature"), Curve.curvature input)
