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
