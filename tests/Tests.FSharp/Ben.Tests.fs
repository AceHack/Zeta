module Zeta.Tests.BenTests

// B-1039 slice 1: the exact meters + THE PREDICTION GRADER — dogfooded through ITestLoop (the
// double-run check proves every meter deterministic for free; ben output never enters mea
// equality because here ben output IS the measurement, exactly and replayably).

open global.Xunit
open Zeta.Core

let private host (loop: ITestLoop<'w, 'm>) =
    let v = TestLoop.run loop
    Assert.True(v.Passed, sprintf "%s — %s [%s]" v.Name (defaultArg v.Failure "?") v.Replay)

[<Fact>]
let ``BEN METER (chip8 ticks): exact, replayable, fault-aware — through the TestLoop boundary`` () =
    host (
        TestLoop.make "ben: chip8 tick meter is exact" 7UL
            (fun seed ->
                Chip8Cow.create seed
                |> Chip8Cow.loadRom [| 0x60uy; 0x05uy; 0x61uy; 0x03uy; 0xA3uy; 0x00uy; 0xD0uy; 0x11uy; 0x12uy; 0x08uy |]
                |> fun f -> { f with Mem = Map.add 0x300 0xF0uy f.Mem })
            (fun f0 -> Ben.chip8Ticks 20 f0)
            (fun m ->
                if m.Steps <> 20 then Error "step count drifted"
                elif m.DisplayLit <> 4 then Error(sprintf "expected the 4-pixel sprite row lit; got %d" m.DisplayLit)
                elif m.Faulted then Error "healthy rom reported a fault"
                else Ok()))

[<Fact>]
let ``THE GRADER confirms a TRUE prediction: treemap tile count is O(children) — measured linear, declared linear`` () =
    // the registry's ("shape.dynamicvalue","draw") O(children) prediction, graded with EXACT costs
    let cost n =
        LayoutEngine.treemap 0 0 6000 10 true [ for i in 1 .. n -> string i, 1 ]
        |> List.length |> int64
    let samples = [ 8, cost 8; 16, cost 16; 32, cost 32 ]
    Assert.Equal(Some Ben.Linear, Ben.infer samples)
    Assert.Equal(Ben.Confirmed, Ben.grade Ben.Linear (Ben.infer samples).Value)

[<Fact>]
let ``THE GRADER confirms IBLT build work is O(n·k): the table's total count IS the exact work done`` () =
    // ("sketch.iblt","build") O(n·k): sum of |Count| after build = n·k bucket updates, exactly
    let work n =
        let t = IbltReconcile.build 4096 3 (Seq.map uint64 (seq { 1 .. n }))
        t.Cells |> Array.sumBy (fun c -> int64 (abs c.Count))
    let samples = [ 100, work 100; 200, work 200; 400, work 400 ]
    Assert.Equal(300L, work 100) // n·k exactly — the proxy is the work, not an estimate
    Assert.Equal(Some Ben.Linear, Ben.infer samples)
    Assert.Equal(Ben.Confirmed, Ben.grade Ben.Linear (Ben.infer samples).Value)

[<Fact>]
let ``THE GRADER'S FALSIFIERS: quadratic growth against a linear claim is VIOLATED; slower growth is TIGHTER; garbage refuses`` () =
    let quadratic = [ 10, 100L; 20, 400L; 40, 1600L ]
    Assert.Equal(Some Ben.Quadratic, Ben.infer quadratic)
    Assert.Equal(Ben.Violated, Ben.grade Ben.Linear Ben.Quadratic) // the WHY lied — a priced bug
    Assert.Equal(Ben.Tighter, Ben.grade Ben.Quadratic Ben.Linear) // undersold — update the WHY
    Assert.Equal(Some Ben.Constant, Ben.infer [ 10, 50L; 20, 50L; 40, 50L ])
    Assert.Equal(None, Ben.infer [ 10, 0L ]) // degenerate input: refusal, never a guess
