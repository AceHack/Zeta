module Zeta.Tests.ProbabilitySemiringCrossVerifyTests

open System.IO
open System.Text.Json
open global.Xunit
open Zeta.Core

module PS = Zeta.Core.ProbabilitySemiring

// ═══════════════════════════════════════════════════════════════════
// ProbabilitySemiring cross-language agreement — the F# oracle uses the REAL canonical
// ProbabilitySemiring and replays the shared seed (src/Core.TypeScript/probability-semiring/
// golden-vectors.json) that the C#/TS/Rust oracles also verify. Exact rational ℚ (no floats).
// ═══════════════════════════════════════════════════════════════════

let private repoRoot () =
    let mutable dir = DirectoryInfo(Path.GetDirectoryName(System.Reflection.Assembly.GetExecutingAssembly().Location))
    while not (isNull dir) && not (File.Exists(Path.Join(dir.FullName, "Zeta.sln"))) do
        dir <- dir.Parent
    if isNull dir then failwith "Could not locate repo root (Zeta.sln)." else dir.FullName

let private r (e: JsonElement) : PS.Rational =
    PS.rat ((e.GetProperty "n").GetInt64()) ((e.GetProperty "d").GetInt64())

let private vec (e: JsonElement) : PS.Rational[] = e.EnumerateArray() |> Seq.map r |> Seq.toArray
let private mat (e: JsonElement) : PS.Rational[][] = e.EnumerateArray() |> Seq.map vec |> Seq.toArray

[<Fact>]
let ``F# ProbabilitySemiring agrees with the shared golden seed`` () =
    let path = Path.Join(repoRoot (), "src", "Core.TypeScript", "probability-semiring", "golden-vectors.json")
    Assert.True(File.Exists path, sprintf "seed not found: %s" path)
    use doc = JsonDocument.Parse(File.ReadAllText path)
    let root = doc.RootElement
    let section (name: string) : JsonElement[] = root.GetProperty(name).EnumerateArray() |> Seq.toArray

    for v in section "normalize" do
        Assert.Equal<PS.Rational>(r (v.GetProperty "result"), PS.rat ((v.GetProperty "n").GetInt64()) ((v.GetProperty "d").GetInt64()))

    for v in section "add" do
        Assert.Equal<PS.Rational>(r (v.GetProperty "result"), PS.add (r (v.GetProperty "a")) (r (v.GetProperty "b")))

    for v in section "mul" do
        Assert.Equal<PS.Rational>(r (v.GetProperty "result"), PS.mul (r (v.GetProperty "a")) (r (v.GetProperty "b")))

    for v in section "max" do
        Assert.Equal<PS.Rational>(r (v.GetProperty "result"), PS.max (r (v.GetProperty "a")) (r (v.GetProperty "b")))

    for v in section "forwardStep" do
        Assert.Equal<PS.Rational[]>(vec (v.GetProperty "result"), PS.forwardStep (vec (v.GetProperty "pi")) (mat (v.GetProperty "p")))

    for v in section "viterbiStep" do
        Assert.Equal<PS.Rational[]>(vec (v.GetProperty "result"), PS.viterbiStep (vec (v.GetProperty "v")) (mat (v.GetProperty "p")))
