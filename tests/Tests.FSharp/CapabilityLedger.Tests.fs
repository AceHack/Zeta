module Zeta.Tests.CapabilityLedgerTests

// The capability resolver over the REAL ledgers (db/capabilities + db/emus/chip8): know what to
// inject BEFORE asking; refusals re-plan; the lint keeps the data honest in CI.

open System.IO
open global.Xunit
open Zeta.Core

let private repoRoot () =
    let mutable dir = DirectoryInfo(System.AppContext.BaseDirectory)
    while not (isNull dir) && not (File.Exists(Path.Combine(dir.FullName, "Zeta.sln"))) do
        dir <- dir.Parent
    dir.FullName

let private docOf (relative: string) =
    match MediaLines.parse (File.ReadAllText(Path.Combine(repoRoot (), relative))) with
    | Ok d -> d
    | Error e -> failwith e

let private generic () = docOf "db/capabilities/capabilities.lines"
let private chip8 () = docOf "db/emus/chip8/capabilities.lines"

[<Fact>]
let ``BOTH REAL LEDGERS LINT CLEAN: every support row references a declared cap, statuses are the closed ladder set, no dark caps`` () =
    Assert.Empty(CapabilityLedger.lint (generic ()))
    Assert.Empty(CapabilityLedger.lint (chip8 ()))

[<Fact>]
let ``RESOLVE: the fault-parity treaty reads back — fault.register is LIVE on all four oracles`` () =
    let ledger = CapabilityLedger.ofDoc (chip8 ())
    for system in [ "fsharp"; "csharp"; "typescript"; "rust" ] do
        match CapabilityLedger.resolve "fault.register" system ledger with
        | Ok s -> Assert.Equal(CapabilityLedger.Live, s.Status)
        | Error e -> failwith e
    Assert.Equal<string list>(
        [ "fsharp"; "csharp"; "typescript"; "rust" ],
        CapabilityLedger.systemsAtLeast "fault.register" CapabilityLedger.Live ledger)

[<Fact>]
let ``REFUSALS RE-PLAN: an unknown cap names the declared set; an unplaced system names the placements`` () =
    let ledger = CapabilityLedger.ofDoc (generic ())
    match CapabilityLedger.resolve "engine.vibes" "dotnet" ledger with
    | Ok _ -> failwith "unknown cap must refuse"
    | Error e -> Assert.Contains("the ledger declares:", e)
    match CapabilityLedger.resolve "sketch.iblt" "cobol" ledger with
    | Ok _ -> failwith "unplaced system must refuse"
    | Error e ->
        Assert.Contains("placed:", e)
        Assert.Contains("fsharp=Live", e)

[<Fact>]
let ``THE LADDER READS AS DATA: injected and absent are honest answers, not errors`` () =
    let ledger = CapabilityLedger.ofDoc (generic ())
    match CapabilityLedger.resolve "engine.infer-net" "dotnet" ledger with
    | Ok s -> Assert.Equal(CapabilityLedger.Injected, s.Status) // tests-side only BY DESIGN
    | Error e -> failwith e
    match CapabilityLedger.resolve "sketch.iblt" "rust" ledger with
    | Ok s -> Assert.Equal(CapabilityLedger.Absent, s.Status) // the wish, visibly
    | Error e -> failwith e

[<Fact>]
let ``LINT FALSIFIERS: dangling support, alien status, and a dark cap are each named`` () =
    let bad =
        "cap\tx.real\tdesc\nsupport\tx.ghost\tdotnet\tlive\tnote\nsupport\tx.real\tdotnet\tshiny\tnote\ncap\tx.dark\tdesc\n"
    let d = MediaLines.parse bad |> Result.toOption |> Option.get
    let findings = CapabilityLedger.lint d
    Assert.Contains(findings, fun f -> f.Contains "undeclared cap 'x.ghost'")
    Assert.Contains(findings, fun f -> f.Contains "unknown status 'shiny'")
    Assert.Contains(findings, fun f -> f.Contains "cap 'x.dark' has zero support rows")

// ── RUNG 2: the ledger DRIVES the inference ladder (data decides, code obeys) ──
open Zeta.Core.Abstractions

let private fakeEngine (name: string) : unit -> IInferenceEngine =
    fun () ->
        { new IInferenceEngine with
            member _.Name = name
            member _.RunGaussian(model, _, _) =
                InferenceResult(true, 1, [| for v in 0 .. model.VariableCount - 1 -> GaussianMarginal(v, 0.0, 1.0) |]) }

let private candidates =
    Map.ofList
        [ "engine.zeta-bayesian", fakeEngine "zeta-bayesian"
          "engine.infer-net", fakeEngine "infer-net"
          "engine.never-registered", fakeEngine "ghost" ]

[<Fact>]
let ``RUNG 2 — partition by the REAL ledger: Live feeds hostLive, Injected feeds granted, unknown is dropped to the Mock rung`` () =
    let ledger = CapabilityLedger.ofDoc (generic ())
    let hostLive, granted = CapabilityLedger.partition ledger "dotnet" candidates
    Assert.True(Map.containsKey "engine.zeta-bayesian" hostLive) // ledger: live
    Assert.True(Map.containsKey "engine.infer-net" granted) // ledger: injected BY DESIGN
    Assert.False(Map.containsKey "engine.never-registered" hostLive)
    Assert.False(Map.containsKey "engine.never-registered" granted)
    // end-to-end through the ladder: the ledger's word becomes the binding's light
    match InferenceLadder.resolve hostLive granted "engine.zeta-bayesian" with
    | InferenceLadder.EngineBinding.Live _ -> ()
    | b -> failwith (InferenceLadder.light b)
    match InferenceLadder.resolve hostLive granted "engine.infer-net" with
    | InferenceLadder.EngineBinding.Injected _ -> ()
    | b -> failwith (InferenceLadder.light b)
    match InferenceLadder.resolve hostLive granted "engine.never-registered" with
    | InferenceLadder.EngineBinding.Mock _ -> () // honest rehearsal, never a masquerade
    | b -> failwith (InferenceLadder.light b)

[<Fact>]
let ``RUNG 2 — an unplaced SYSTEM binds nothing: every request falls to the honest Mock rung`` () =
    let ledger = CapabilityLedger.ofDoc (generic ())
    let hostLive, granted = CapabilityLedger.partition ledger "cobol" candidates
    Assert.True(Map.isEmpty hostLive && Map.isEmpty granted)
    match InferenceLadder.resolve hostLive granted "engine.zeta-bayesian" with
    | InferenceLadder.EngineBinding.Mock(_, e) -> Assert.Equal("mock-flat", e.Name)
    | b -> failwith (InferenceLadder.light b)
