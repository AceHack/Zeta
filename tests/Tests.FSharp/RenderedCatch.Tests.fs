module Zeta.Tests.RenderedCatchTests

open System
open System.IO
open Xunit
open Zeta.Core
open Zeta.Research

let private require = function Ok value -> value | Error (reason: RenderedCatchReceipt.Failure) -> failwith (reason.Code + ": " + reason.Detail)
let private counts () =
    // CI maps source locations to /_/. Resolve fixtures from the test assembly,
    // whose base directory is stable even while another test changes the CWD.
    let mutable directory = DirectoryInfo AppContext.BaseDirectory
    while not (isNull directory) && not (File.Exists(Path.Combine(directory.FullName, "Zeta.sln"))) do
        directory <- directory.Parent
    if isNull directory then invalidOp "Could not locate rendered-catch fixture repository (Zeta.sln)"
    Path.Combine(directory.FullName, "src", "Research.FSharp", "rendered-signal-results.json") |> File.ReadAllBytes |> RenderedCatchPolicy.readCounts |> require
let private fixture = Array.init 66 (fun index -> [|0;0;1;0;1;1|].[index % 6])
let private admitted geometry symbols = RenderedCatchCarrier.compile geometry symbols |> require |> RenderedCatchCarrier.admit geometry |> require
let private bootstrap geometry symbols =
    let rom = admitted geometry symbols
    let environment, initial = RenderedCatchCarrier.create rom |> require
    let first = RenderedCatchCarrier.advance rom environment initial 0 (ControlScheme.Go "stay") false ignore ignore |> require
    rom, environment, first
let private projected token : GameEnvironment.Frame =
    let cells = Array.zeroCreate<byte> 2048
    cells.[8 * 64 + 16 + 32 * token] <- 1uy
    { W = 64; H = 32; Palette = 2; Cells = cells }

[<Theory>]
[<InlineData("dot")>]
[<InlineData("bar")>]
let ``RenderedCatch ROM has fixed bounds and refuses opcode operand sprite changes`` geometry =
    let shape = RenderedCatchCarrier.geometry geometry |> require
    let raw = RenderedCatchCarrier.compile shape fixture |> require
    Assert.Equal(2247, raw.Length)
    Assert.Equal<byte>([|0x1Auy;0xC4uy; if shape = RenderedCatchCarrier.Bar then 0xE0uy else 0x80uy|], raw.[2244..])
    for index in [0;2;4;8;11;34;40;54;100;2244;2246] do
        let changed = Array.copy raw
        changed.[index] <- changed.[index] ^^^ 1uy
        Assert.True(RenderedCatchCarrier.admit shape changed |> Result.isError)
    Assert.True(RenderedCatchCarrier.compile shape [|0;1|] |> Result.isError)

[<Theory>]
[<InlineData(0,0)>]
[<InlineData(0,1)>]
[<InlineData(1,0)>]
[<InlineData(1,1)>]
let ``RenderedCatch real key changes catcher and rendered feedback for either target`` key target =
    let symbols = Array.copy fixture
    symbols.[1] <- target
    let rom, environment, first = bootstrap RenderedCatchCarrier.Dot symbols
    let next = RenderedCatchCarrier.advance rom environment first.State 1 (ControlScheme.Pad key) false ignore ignore |> require
    let expected = if key = target then 1 else 0
    Assert.Equal(expected, RenderedCatchCarrier.reward next.Frame |> require)
    Assert.Equal(16 + 32 * key, int next.State.V.[0])
    Assert.Equal(target, RenderedCatchCarrier.project next.Frame |> Result.bind RenderedCatchCarrier.decodeProjection |> require)
    Assert.Equal(17, next.Counters.PrimaryInstructions)
    Assert.Equal(17, next.Counters.ShadowInstructions)
    Assert.Equal(1, next.Counters.PrimaryTimerTicks)
    Assert.Equal(1, next.Counters.ShadowTimerTicks)

[<Fact>]
let ``RenderedCatch lower band cannot influence admitted projection or any forked policy action`` () =
    let model = counts()
    let source = projected 1
    let variants =
        [| for mode in 0 .. 3 do
               let cells = Array.copy source.Cells
               for index in 1536 .. 2047 do
                   cells.[index] <- byte (match mode with 0 -> 0 | 1 -> 1 | 2 -> index % 2 | _ -> (index * 73 + index / 7) % 2)
               yield { source with Cells = cells } |]
    for name in RenderedCatchReceipt.config.Arms do
        let fair = Some(RenderedCatchPolicy.FairStream(ResearchRandom.domain 19UL 29))
        let policy = RenderedCatchPolicy.create name model fair |> require
        RenderedCatchPolicy.observe (projected 0) policy |> require |> ignore
        RenderedCatchPolicy.observe (projected 1) policy |> require |> ignore
        RenderedCatchPolicy.choose policy |> require |> ignore
        let expectedFork = RenderedCatchPolicy.fork policy
        RenderedCatchPolicy.observe source expectedFork |> require |> ignore
        let expected = RenderedCatchPolicy.choose expectedFork |> require
        for variant in variants do
            let projection = RenderedCatchCarrier.project variant |> require
            Assert.Equal<byte>(source.Cells, projection.Cells)
            let fork = RenderedCatchPolicy.fork policy
            RenderedCatchPolicy.observe projection fork |> require |> ignore
            Assert.Equal(expected, RenderedCatchPolicy.choose fork |> require)
    let tied = { source with Cells = Array.init 2048 (fun index -> if index < 768 then 1uy else 0uy) }
    for variant in variants do
        let cells = Array.copy tied.Cells
        Array.Copy(variant.Cells, 1536, cells, 1536, 512)
        let result = RenderedCatchCarrier.project { tied with Cells = cells } |> Result.mapError _.Code
        Assert.Equal(Error "background-tie", result)
    Assert.NotEqual(RenderedCatchCarrier.project (projected 0) |> Result.bind RenderedCatchCarrier.decodeProjection |> require,
                    RenderedCatchCarrier.project (projected 1) |> Result.bind RenderedCatchCarrier.decodeProjection |> require)

[<Fact>]
let ``RenderedCatch refuses malformed pixel feedback key and PC boundaries`` () =
    let rom, environment, first = bootstrap RenderedCatchCarrier.Dot fixture
    for action in [ControlScheme.Go "stay";ControlScheme.Pad 2;ControlScheme.Pad -1] do
        Assert.True(RenderedCatchCarrier.advance rom environment first.State 1 action false ignore ignore |> Result.isError)
    Assert.True(RenderedCatchCarrier.advance rom environment {first.State with PC = 0x224us} 1 (ControlScheme.Pad 0) false ignore ignore |> Result.isError)
    Assert.True(RenderedCatchCarrier.advance rom environment first.State 66 (ControlScheme.Pad 0) false ignore ignore |> Result.isError)
    Assert.True(RenderedCatchCarrier.project {first.Frame with Cells = [|0uy|]} |> Result.isError)
    let invalid = {first.Frame with Cells = Array.copy first.Frame.Cells}
    invalid.Cells.[2000] <- 2uy
    Assert.True(RenderedCatchCarrier.project invalid |> Result.isError)
    Assert.True(RenderedCatchCarrier.reward first.Frame |> Result.isError)
    let feedback = RenderedCatchCarrier.advance rom environment first.State 1 (ControlScheme.Pad 0) false ignore ignore |> require
    Assert.True(RenderedCatchCarrier.decodeProjection feedback.Frame |> Result.isError)

[<Fact>]
let ``RenderedCatch complete rendered hand episode retains both execution counts and suffix noninterference`` () =
    let model = counts()
    let changed = Array.copy fixture
    changed.[2] <- 1 - changed.[2]
    for name in RenderedCatchReceipt.config.Arms do
        let run symbols =
            use streams = new RenderedCatchExperiment.Streams()
            RenderedCatchExperiment.runEpisode "fixture" name model (Some(RenderedCatchPolicy.FairStream 731UL)) 0
                (symbols, admitted RenderedCatchCarrier.Dot symbols) "odd-complement" streams
        let original, altered = run fixture, run changed
        Assert.True(original.Complete, if isNull original.Failure then "" else original.Failure.Detail)
        Assert.True(altered.Complete, if isNull altered.Failure then "" else altered.Failure.Detail)
        Assert.Equal(66, original.Observations.Length)
        Assert.Equal(64, original.Actions.Length)
        Assert.Equal(64, original.Hits.Length)
        Assert.Equal(original.Actions.[0], altered.Actions.[0])
        Assert.Equal(RenderedCatchCarrier.binaryString fixture, original.Observations)
        Assert.Equal(1122, original.Counters.PrimaryInstructions)
        Assert.Equal(1122, original.Counters.ShadowInstructions)
        Assert.Equal(2244, original.Counters.TotalTransitions)
        Assert.Equal(66, original.Counters.EnvironmentCalls)
        Assert.Equal(65, original.Counters.KeyActions)
        Assert.Equal(66, original.Counters.AdapterGroupsChecked)
        Assert.Equal(66, original.Counters.PrimaryTimerTicks)
        Assert.Equal(66, original.Counters.ShadowTimerTicks)

[<Fact>]
let ``RenderedCatch shadow refuses unrendered register drift and observed opcode mutation`` () =
    let rom, environment, first = bootstrap RenderedCatchCarrier.Dot fixture
    let altered =
        { new GameEnvironment.IEnvironment<Chip8Cow.Frame> with
            member _.Scheme = environment.Scheme
            member _.Reset() = environment.Reset()
            member _.Frame state = environment.Frame state
            member _.Info state = environment.Info state
            member _.Step(state, action) =
                environment.Step(state, action) |> Result.map (fun next ->
                    let registers = Array.copy next.V
                    registers.[7] <- registers.[7] ^^^ 1uy
                    { next with V = registers }) }
    let result = RenderedCatchCarrier.advance rom altered first.State 1 (ControlScheme.Pad 0) false ignore ignore
    Assert.Equal(Error "group-state", result |> Result.map ignore |> Result.mapError _.Code)
    let corrupted = {first.State with Mem = Map.add 0x223 0x0Buy first.State.Mem}
    let mutable counters = RenderedCatchReceipt.zeroCounters
    let account delta = counters <- RenderedCatchReceipt.addCounters counters delta
    let result = RenderedCatchCarrier.advance rom environment corrupted 1 (ControlScheme.Pad 0) false ignore account
    Assert.Equal(Error "pc-opcode", result |> Result.map ignore |> Result.mapError _.Code)
    Assert.Equal(17, counters.PrimaryInstructions)
    Assert.Equal(0, counters.ShadowInstructions)
    Assert.Equal(0, counters.AdapterGroupsChecked)
