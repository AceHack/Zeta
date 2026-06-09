module Zeta.Tests.HatTests

open global.Xunit
open Zeta.Core

let private k n = SoftController.singleKey n

let private survivalHat: Hat.Hat<int> =
    { Name = "survival"
      Scope = Hat.Meta // survival is a persona — it plays all games
      Lenses = [ { LensRouter.Name = "pos"; LensRouter.Cells = [ "V0"; "V1" ] } ]
      Landmarks = [ "I", SolidGround.Constant 512; "frame", SolidGround.Monotonic 1 ]
      AllowedActions = [ SoftController.none; k 4; k 6 ] // may only idle / move L / move R
      Traversals = []
      Controls = [ "scout" ] }

[<Fact>]
let ``personas are meta-surviving hats (play all games); game-specific hats are scoped`` () =
    let scout = { survivalHat with Name = "brick-scout"; Scope = Hat.GameSpecific } // a one-game hat
    Assert.True(Hat.isPersona survivalHat) // survival survives into the meta
    Assert.False(Hat.isPersona scout) // game-specific
    Assert.Equal<string list>([ "survival" ], Hat.personas [ survivalHat; scout ] |> List.map (fun h -> h.Name))
    Assert.Equal<string list>([ "brick-scout" ], Hat.gameSpecific [ survivalHat; scout ] |> List.map (fun h -> h.Name))

[<Fact>]
let ``permits honors the action restriction (allow-list)`` () =
    Assert.True(Hat.permits (k 4) survivalHat)
    Assert.True(Hat.permits SoftController.none survivalHat)
    Assert.False(Hat.permits (k 9) survivalHat) // not in the allow-list

[<Fact>]
let ``an empty allow-list is unrestricted`` () =
    let open' = { survivalHat with AllowedActions = [] }
    Assert.True(Hat.permits (k 9) open')

[<Fact>]
let ``restrict filters candidate actions to the permitted subset`` () =
    let candidates = [ SoftController.none; k 4; k 6; k 9; k 2 ]
    let allowed = Hat.restrict candidates survivalHat
    Assert.Equal(3, List.length allowed) // none, k4, k6
    Assert.DoesNotContain(k 9, allowed)

[<Fact>]
let ``controls is the coordination edge to other hats/agents`` () =
    Assert.True(Hat.controls "scout" survivalHat)
    Assert.False(Hat.controls "auditor" survivalHat)

[<Fact>]
let ``a hat bundles lenses + landmarks (the role-scoped engine)`` () =
    Assert.Equal<string list>([ "pos" ], survivalHat.Lenses |> List.map (fun l -> l.Name))
    Assert.Equal<string list>([ "I"; "frame" ], Hat.landmarkCells survivalHat)
