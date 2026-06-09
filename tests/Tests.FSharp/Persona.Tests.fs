module Zeta.Tests.PersonaTests

open global.Xunit
open Zeta.Core

let private hat name actions controls : Hat.Hat<int> =
    { Name = name
      Scope = Hat.Meta
      Lenses = [ { LensRouter.Name = name + "-lens"; LensRouter.Cells = [ "V0" ] } ]
      Landmarks = []
      AllowedActions = actions
      Traversals = []
      Controls = controls }

let private survival = hat "survival" [ SoftController.none; SoftController.singleKey 4 ] [ "scout" ]
let private explorer = hat "explorer" [ SoftController.singleKey 6 ] [ "mapper" ]
let private available = [ survival; explorer ]

[<Fact>]
let ``persona wears and doffs hats temporally (not permanent)`` () =
    let p = Persona.create "otto" |> Persona.wear survival
    Assert.True(Persona.wearing "survival" p)
    let p2 = Persona.doff "survival" p // the bind is temporal — taken off again
    Assert.False(Persona.wearing "survival" p2)

[<Fact>]
let ``wear is idempotent (CRDT-set add) - a hat is the atomic base`` () =
    let p = Persona.create "otto" |> Persona.wear survival |> Persona.wear survival
    Assert.Equal(1, p.Worn |> List.length)

[<Fact>]
let ``wearAll = superposition (all hats); decide collapses to a chosen subset`` () =
    let sup = Persona.create "otto" |> Persona.wearAll available
    Assert.Equal(2, sup.Worn |> List.length) // wearing both in superposition
    let chosen = sup |> Persona.decide [ "explorer" ] available
    Assert.Equal<string list>([ "explorer" ], chosen.Worn |> List.map (fun h -> h.Name)) // collapsed to one

[<Fact>]
let ``persona is the COMPOSITION: capabilities are the union of worn hats' engines`` () =
    let p = Persona.create "otto" |> Persona.wearAll available
    Assert.Equal(2, Persona.lenses p |> List.length) // survival-lens + explorer-lens
    Assert.Equal<string list>([ "scout"; "mapper" ], Persona.controls p)
    // allowed actions = union of both hats' allow-lists
    Assert.Equal(3, Persona.allowedActions p |> List.length) // none, k4 (survival) + k6 (explorer)

[<Fact>]
let ``unrestricted if any worn hat is unrestricted`` () =
    let openHat = hat "free" [] [] // empty allow-list = unrestricted
    let p = Persona.create "otto" |> Persona.wear survival |> Persona.wear openHat
    Assert.Empty(Persona.allowedActions p) // unrestricted (empty) because a worn hat is unrestricted
