module Zeta.Tests.SkadiumTests

open global.Xunit
open Zeta.Core

[<Fact>]
let ``the bob-and-weave cycles R -> C -> L -> C deterministically (period 1)`` () =
    Assert.Equal(Skadium.Right, Skadium.weave 1 0)
    Assert.Equal(Skadium.Center, Skadium.weave 1 1)
    Assert.Equal(Skadium.Left, Skadium.weave 1 2)
    Assert.Equal(Skadium.Center, Skadium.weave 1 3)
    Assert.Equal(Skadium.Right, Skadium.weave 1 4) // wraps (4*period cycle)

[<Fact>]
let ``the opening is at Center; weave finds it deterministically (DST replay)`` () =
    Assert.True(Skadium.openAt 1 1) // Center
    Assert.False(Skadium.openAt 1 0) // Right
    Assert.Equal(Skadium.openAt 3 7, Skadium.openAt 3 7) // replay-equal

[<Fact>]
let ``negative steps wrap cleanly (DST-replayable from any seed offset)`` () =
    Assert.Equal(Skadium.weave 1 0, Skadium.weave 1 -4)
    Assert.Equal(Skadium.weave 2 1, Skadium.weave 2 -7)

[<Fact>]
let ``the skatium door gathers its rinks + signage names the bob-and-weave`` () =
    Assert.Equal("skatium", Skadium.name)
    Assert.Contains("bob-and-weave", Skadium.does)
    let names = Skadium.rinks |> List.map (fun r -> r.Name)
    Assert.Contains("weave", names)
    Assert.Contains("opening", names)
    Assert.Contains("weave", Skadium.liveRinks |> List.map (fun r -> r.Name))

[<Fact>]
let ``the door entrances alias the cell functions (weave=lean, openAt=isOpen)`` () =
    Assert.Equal(Skadium.lean 2 3, Skadium.weave 2 3)
    Assert.Equal(Skadium.isOpen 2 3, Skadium.openAt 2 3)
