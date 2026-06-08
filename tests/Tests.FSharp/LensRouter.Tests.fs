module Zeta.Tests.LensRouterTests

open global.Xunit
open Zeta.Core

let private lensA = { LensRouter.Name = "A"; LensRouter.Cells = [ "V0"; "V1" ] }
let private lensB = { LensRouter.Name = "B"; LensRouter.Cells = [ "V2"; "V3" ] }
let private lensC = { LensRouter.Name = "C"; LensRouter.Cells = [ "Delay" ] }
let private lenses = [ lensA; lensB; lensC ]

[<Fact>]
let ``gate scores a lens by mean per-cell signal`` () =
    let signal = Map.ofList [ "V0", 1.0; "V1", 1.0; "V2", 0.0; "V3", 0.0 ]
    Assert.Equal(1.0, LensRouter.gate signal lensA, 9)
    Assert.Equal(0.0, LensRouter.gate signal lensB, 9)

[<Fact>]
let ``select top-k activates the most-relevant lenses (the bounded MoE working set)`` () =
    let signal = Map.ofList [ "V0", 1.0; "V1", 1.0; "Delay", 0.5; "V2", 0.0; "V3", 0.0 ]
    Assert.Equal<string list>([ "A" ], LensRouter.select 1 signal lenses |> List.map (fun l -> l.Name))
    Assert.Equal<string list>([ "A"; "C" ], LensRouter.select 2 signal lenses |> List.map (fun l -> l.Name))

[<Fact>]
let ``k >= count returns all lenses (sorted by relevance)`` () =
    let signal = Map.ofList [ "V0", 0.1; "V2", 0.9; "V3", 0.9; "Delay", 0.5 ]
    let names = LensRouter.select 10 signal lenses |> List.map (fun l -> l.Name)
    Assert.Equal(3, List.length names)
    Assert.Equal("B", List.head names) // B = mean(V2,V3) = 0.9, the most relevant

[<Fact>]
let ``composeKey is the union of active lenses' cell values (bounded working state)`` () =
    let f = Chip8Cow.create 1UL
    let key = LensRouter.composeKey [ lensA; lensC ] f
    let cells = key |> List.map fst
    Assert.Contains("V0", cells)
    Assert.Contains("Delay", cells)
    Assert.DoesNotContain("V2", cells) // lensB not active

[<Fact>]
let ``route selects then composes in one shot`` () =
    let signal = Map.ofList [ "V2", 1.0; "V3", 1.0 ] // favors lens B
    let key = LensRouter.route 1 signal lenses (Chip8Cow.create 1UL)
    Assert.Equal<string list>([ "V2"; "V3" ], key |> List.map fst)
