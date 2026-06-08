module Zeta.Tests.ForgerRaceTests

open global.Xunit
open Zeta.Core
open Zeta.Core.ForgerRace

[<Fact>]
let ``strong non-fungibility (rate 0, fewer clocks than quorum) — forger NEVER solves it`` () =
    // The whole point: zero forge-rate + 1 real clock vs quorum 3 ⇒ stuck forever ⇒ defender outlasts him.
    let m = { PhysicalClocks = 1; ForgeRatePerTick = 0.0 }
    Assert.Equal(None, solveTick m 3 1000)
    Assert.Equal(WontSolveInTime 10, certify m 3 10 1000)
    Assert.True(isSafe (certify m 3 10 1000))

[<Fact>]
let ``weak detector (high forge-rate) — forger beats the honest commit`` () =
    let m = { PhysicalClocks = 0; ForgeRatePerTick = 1.0 } // one distinct-passing fake per tick
    // Forger reaches quorum 3 at tick 3; honest commits at tick 10 ⇒ broken.
    Assert.Equal(WillSolveInTime(3, 10), certify m 3 10 1000)
    Assert.False(isSafe (certify m 3 10 1000))

[<Fact>]
let ``slow forge-rate that reaches quorum AFTER honest commit — still safe (outlasted)`` () =
    let m = { PhysicalClocks = 0; ForgeRatePerTick = 0.1 } // reaches 3 only at tick 30
    Assert.Equal(Some 30, solveTick m 3 1000)
    Assert.Equal(WontSolveInTime 10, certify m 3 10 1000) // honest commits at 10, before 30
    Assert.True(isSafe (certify m 3 10 1000))

[<Fact>]
let ``dead heat (forger and honest reach quorum on the same tick) is unsafe — no margin`` () =
    let m = { PhysicalClocks = 0; ForgeRatePerTick = 1.0 } // solves at tick 3
    Assert.Equal(DeadHeat 3, certify m 3 3 1000)
    Assert.False(isSafe (certify m 3 3 1000))

[<Fact>]
let ``forger-progress observable rises monotonically per tick`` () =
    let m = { PhysicalClocks = 0; ForgeRatePerTick = 0.5 }
    let tr = trace m 3 8
    Assert.Equal(9, List.length tr) // ticks 0..8
    Assert.Equal<int list>([ 0; 1; 2; 3; 4; 5; 6; 7; 8 ], tr |> List.map (fun p -> p.Tick))
    // distinct-passing count is non-decreasing
    let counts = tr |> List.map (fun p -> p.DistinctPassing)
    Assert.Equal<int list>(counts, List.sort counts)
    // solved flips true once it hits quorum (floor(0.5*6)=3)
    Assert.True((observe m 3 6).Solved)
    Assert.False((observe m 3 5).Solved)

[<Fact>]
let ``owning a quorum of REAL clocks solves at tick 0 (that's a real majority, not Sybil)`` () =
    let m = { PhysicalClocks = 3; ForgeRatePerTick = 0.0 }
    Assert.Equal(Some 0, solveTick m 3 100)
    // honest commit at tick 5 ⇒ the "forger" (really a 3-clock majority) was already there ⇒ unsafe.
    Assert.Equal(WillSolveInTime(0, 5), certify m 3 5 100)

[<Fact>]
let ``deterministic / replayable (DST)`` () =
    let m = { PhysicalClocks = 1; ForgeRatePerTick = 0.25 }
    Assert.Equal(certify m 4 12 500, certify m 4 12 500)
    Assert.Equal<ForgerProgress list>(trace m 4 20, trace m 4 20)
