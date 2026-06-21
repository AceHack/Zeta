module Zeta.Tests.BenTests

// 081KTSZN10008QG0R001F0B5A6 slice 1: the exact meters + THE PREDICTION GRADER — dogfooded through ITestLoop (the
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
let ``THE GRADER confirms treemap tile growth at a 16x span — a grader-PIPELINE check on exact counts (cardinality, NOT the time column: the math team's tautology note stands in 081KTSZN10008QG0R001F0B5A6)`` () =
    let cost n =
        LayoutEngine.treemap 0 0 60000 10 true [ for i in 1 .. n -> string i, 1 ]
        |> List.length |> int64
    let samples = [ 8, cost 8; 16, cost 16; 32, cost 32; 64, cost 64; 128, cost 128 ]
    Assert.Equal(Some Ben.Linear, Ben.infer samples)
    Assert.Equal(Ben.Confirmed, Ben.grade Ben.Linear (Ben.infer samples).Value)

[<Fact>]
let ``THE GRADER confirms IBLT build work at a 16x span (the table's own count sum IS the n·k work done)`` () =
    let work n =
        let t = IbltReconcile.build 16384 3 (Seq.map uint64 (seq { 1 .. n }))
        t.Cells |> Array.sumBy (fun c -> int64 (abs c.Count))
    Assert.Equal(300L, work 100)
    let samples = [ 100, work 100; 200, work 200; 400, work 400; 800, work 800; 1600, work 1600 ]
    Assert.Equal(Some Ben.Linear, Ben.infer samples)

[<Fact>]
let ``THE MATH TEAM'S P0s STAY DEAD: n^1.5 refuses (no fabricated bug); zero interior cost refuses; tiny spans refuse; loglinear is nameable`` () =
    // n^1.5 — the dead-band victim: slope 1.5 sits in the gap between Loglinear and Quadratic → None
    let n15 = [ for n in [ 8; 16; 32; 64; 128 ] -> n, int64 (float n ** 1.5) ]
    Assert.Equal(None, Ben.infer n15)
    // zero interior cost — the old guard only checked the head
    Assert.Equal(None, Ben.infer [ 10, 5L; 20, 0L; 40, 5L; 80, 5L; 160, 5L ])
    // preasymptotic span (4x) — refused, so additive lower-order terms can't fake Tighter
    Assert.Equal(None, Ben.infer [ 8, 108L; 16, 116L; 32, 132L ])
    // O(n log n) — now a first-class verdict, not a coin flip
    let nlogn = [ for n in [ 8; 32; 128; 512; 2048 ] -> n, int64 (float n * log (float n)) ]
    Assert.Equal(Some Ben.Loglinear, Ben.infer nlogn)
    // quadratic at proper span still convicts — Violated stays reachable for real offenders
    let quad = [ for n in [ 8; 16; 32; 64; 128 ] -> n, int64 (n * n) ]
    Assert.Equal(Some Ben.Quadratic, Ben.infer quad)
    Assert.Equal(Ben.Violated, Ben.grade Ben.Linear Ben.Quadratic)

[<Fact>]
let ``THE ALLOCATION METER: exact thread-local bytes, replay-equal after warmup — the one deterministic APM hook .NET gives us`` () =
    let work () = ZSet.ofSeq [ for i in 1 .. 200 -> i, 1L ]
    let a = Ben.allocBytes 2 work
    let b = Ben.allocBytes 2 work
    Assert.True(a > 0L, "the workload allocates; the meter must see it")
    Assert.Equal(a, b) // deterministic code ⇒ deterministic allocation — the double-run, on memory

// ── SEARCH BY BIG-O (Aaron: constrain function selection by time, not just memory) ──

[<Fact>]
let ``parseO names the shapes honestly: degrees count variable factors, logs stay separate, garbage refuses`` () =
    Assert.Equal(Some { ComplexityRegistry.Degree = 0; ComplexityRegistry.Logs = 0 }, ComplexityRegistry.parseO "O(1)")
    Assert.Equal(Some { ComplexityRegistry.Degree = 1; ComplexityRegistry.Logs = 0 }, ComplexityRegistry.parseO "O(steps)")
    Assert.Equal(Some { ComplexityRegistry.Degree = 2; ComplexityRegistry.Logs = 0 }, ComplexityRegistry.parseO "O(n·k)")
    Assert.Equal(Some { ComplexityRegistry.Degree = 2; ComplexityRegistry.Logs = 0 }, ComplexityRegistry.parseO "O(n²)")
    Assert.Equal(Some { ComplexityRegistry.Degree = 3; ComplexityRegistry.Logs = 0 }, ComplexityRegistry.parseO "O(w·h·sources)")
    Assert.Equal(Some { ComplexityRegistry.Degree = 1; ComplexityRegistry.Logs = 0 }, ComplexityRegistry.parseO "O(2·sim + mea + cut)")
    Assert.Equal(None, ComplexityRegistry.parseO "fast-ish")

[<Fact>]
let ``the TIME search returns constant rows at degree 0; blind spots stay visible`` () =
    let constant = ComplexityRegistry.searchTimeAtMost 0
    Assert.True(constant |> List.exists (fun ((a, _), _) -> a = "shape.fourcorner"))
    Assert.True(constant |> List.forall (fun (_, c) -> (ComplexityRegistry.parseO c.Time).Value.Degree = 0))
    Assert.True(List.length (ComplexityRegistry.searchTimeAtMost 9) > List.length constant)
    for (_, raw) in ComplexityRegistry.unsearchable () do
        Assert.True(raw.StartsWith "O(", sprintf "not even O-shaped: %s" raw)

[<Fact>]
let ``BOTH AXES: time and space are independent budgets (hard-dft is space-cheap, time-expensive)`` () =
    let timeCheap = ComplexityRegistry.searchTimeAtMost 1 |> List.map fst |> Set.ofList
    let spaceCheap = ComplexityRegistry.searchSpaceAtMost 1 |> List.map fst |> Set.ofList
    Assert.Contains(("spectral.hard-dft", "dft"), spaceCheap)
    Assert.False(Set.contains ("spectral.hard-dft", "dft") timeCheap)

// ── 081KTSZN10008QG0R002J0GE0Z BUDGET METERING: the room refuses over-budget strategies, and the refusal re-plans ──
[<Fact>]
let ``BUDGET REFUSAL: hard-dft is refused at linear time budget AND the refusal names the in-budget probe on the same artifact`` () =
    match ComplexityRegistry.budgetCheck "spectral.hard-dft" "dft" 1 1 with
    | Ok _ -> failwith "O(n²) must be refused at time degree ≤ 1"
    | Error e ->
        Assert.Contains("BUDGET REFUSED", e)
        Assert.Contains("no stated in-budget strategy exists", e) // idft is O(n²) too — the artifact honestly has no cheap lane
    // the same artifact's probe IS in budget and the registry hands it over
    match ComplexityRegistry.budgetCheck "spectral.soft-probe" "probe" 1 1 with
    | Ok c -> Assert.Equal("O(n)", c.Time)
    | Error e -> failwith e

[<Fact>]
let ``BUDGET HONESTY: an unstated row refuses (cannot budget an unpriced call); generous budgets admit`` () =
    match ComplexityRegistry.budgetCheck "never.registered" "op" 9 9 with
    | Ok _ -> failwith "unstated cost must refuse"
    | Error e -> Assert.Contains("no stated cost", e)
    match ComplexityRegistry.budgetCheck "spectral.hard-dft" "dft" 2 1 with
    | Ok c -> Assert.Equal("O(n²)", c.Time) // within an O(n²) budget, the dft is admitted with its price
    | Error e -> failwith e
