module Zeta.Tests.MemorySenseTests

open global.Xunit
open Zeta.Core

[<Fact>]
let ``period: constant series is seasonal (period 1); a rising series is trending (None)`` () =
    Assert.Equal(Some 1, MemorySense.period [ 5; 5; 5; 5 ])
    Assert.Equal(None, MemorySense.period [ 0; 4; 8; 12 ]) // a counter never repeats
    Assert.Equal(Some 3, MemorySense.period [ 1; 2; 3; 1; 2 ]) // value 1 recurs after 3

[<Fact>]
let ``Itron coincidence: cells that change on the same frames are coincident (Jaccard 1.0)`` () =
    let s =
        Map.ofList
            [ "A", [ 0; 1; 1; 2 ] // changes at frames {1,3}
              "B", [ 9; 8; 8; 7 ] // changes at frames {1,3} — coincident with A
              "C", [ 5; 5; 5; 5 ] ] // never changes
    let coin = MemorySense.coincidences 0.5 s
    Assert.Equal(1, List.length coin)
    let pair, jac = List.head coin
    Assert.Equal(1.0, jac, 9)
    Assert.True(pair = ("A", "B") || pair = ("B", "A"))

[<Fact>]
let ``non-coincident cells (disjoint change frames) are not reported`` () =
    let s = Map.ofList [ "A", [ 0; 1; 1; 1 ]; "B", [ 0; 0; 0; 1 ] ] // A changes {1}, B changes {3} — disjoint
    Assert.Empty(MemorySense.coincidences 0.5 s)

[<Fact>]
let ``ranges baseline + anomaly detection: a value outside the learned range fires`` () =
    let baseline = Map.ofList [ "V0", (0, 10); "PC", (0x200, 0x210) ]
    let f = Chip8Cow.create 1UL // V0 = 0 (in range), PC = 0x200 (in range)
    Assert.Empty(MemorySense.anomalies baseline f)
    let hot = { f with V = (let a = Array.copy f.V in a.[0] <- 200uy; a) } // V0=200 -> out of [0,10]
    Assert.Contains("V0", MemorySense.anomalies baseline hot)

[<Fact>]
let ``series + ranges over a real counter ROM: V0 range grows from 0`` () =
    let counter = [| 0x70uy; 0x01uy; 0x12uy; 0x00uy |]
    let s = MemorySense.series 8 SoftController.none 10 (Chip8Cow.create 1UL |> Chip8Cow.loadRom counter)
    let r = MemorySense.ranges s
    let lo, hi = r.["V0"]
    Assert.Equal(0, lo)
    Assert.True(hi > 0) // V0 climbed
    Assert.Equal(None, MemorySense.period s.["V0"]) // trending, not seasonal
