module Zeta.Tests.ZetaToolStoreGoldenTests

open System
open System.IO
open System.Text.Json
open global.Xunit
open Zeta.Core

module TS = Zeta.Core.ZetaToolStore

/// The F# oracle's conformance to the golden-vector IR treaty (shadow*, Aaron 2026-07-04). Reads the
/// SAME `zeta-store-golden-vectors.json` the TS oracle replays and proves the F# `ZetaToolStore`
/// reproduces the identical hash-independent observables — the actual convergence proof (TS conforming
/// alone does not prove the langs agree; F# conforming to the same vectors does). v1 locks fs semantics
/// that are hash-independent, so both oracles agree despite the open divergences in the JSON's
/// `_convergence` ledger (hash function, event encoding, editEverywhere-on-absent, db event type).

let private repoRoot () =
    let mutable dir = DirectoryInfo(Path.GetDirectoryName(System.Reflection.Assembly.GetExecutingAssembly().Location))
    while not (isNull dir) && not (File.Exists(Path.Join(dir.FullName, "Zeta.sln"))) do
        dir <- dir.Parent
    if isNull dir then failwith "Could not locate repo root (Zeta.sln)." else dir.FullName

let private getArg (el: JsonElement) (k: string) : string option =
    match el.TryGetProperty k with
    | true, v when v.ValueKind = JsonValueKind.String -> Some(v.GetString())
    | _ -> None

let private toolOf (el: JsonElement) : TS.ZetaTool =
    let name = el.GetProperty("call").GetString()
    match TS.parse name (getArg el) with
    | Ok tool -> tool
    | Error e -> failwithf "golden vector: parse failed for '%s': %s" name e

let private runOp (s: TS.Store) (op: JsonElement) : TS.Store = snd (TS.execute (toolOf op) s)

let private checkProbe (s: TS.Store) (probe: JsonElement) : unit =
    let result, _ = TS.execute (toolOf probe) s
    let expect = probe.GetProperty("expect")
    match result with
    | TS.Resolved (Some c) ->
        Assert.Equal(JsonValueKind.String, expect.ValueKind)
        Assert.Equal(expect.GetString(), c)
    | TS.Resolved None -> Assert.Equal(JsonValueKind.Null, expect.ValueKind)
    | other -> failwithf "golden probe expected a Resolved result, got %A" other

[<Fact>]
let ``ZTS-GOLDEN the F# oracle conforms to the golden-vector IR treaty v1`` () =
    let path = Path.Join(repoRoot (), "src", "Core.TypeScript", "model-backend", "zeta-store-golden-vectors.json")
    use doc = JsonDocument.Parse(File.ReadAllText path)
    let vectors = doc.RootElement.GetProperty("vectors").EnumerateArray() |> Seq.toArray
    Assert.True(vectors.Length >= 5, "expected the v1 vector set")
    for v in vectors do
        let mutable s = TS.empty
        for op in v.GetProperty("ops").EnumerateArray() do
            s <- runOp s op
        for probe in v.GetProperty("probes").EnumerateArray() do
            checkProbe s probe
