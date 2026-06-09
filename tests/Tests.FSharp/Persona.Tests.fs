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
let ``only personas carry private state (the entropy budget); it is erasable`` () =
    let p = Persona.create "otto" |> Persona.withPrivate [| 1uy; 2uy; 3uy |]
    Assert.Equal<byte[]>([| 1uy; 2uy; 3uy |], p.Private)
    let erased = Persona.withPrivate [||] p // erasable per §6
    Assert.Empty(erased.Private)

[<Fact>]
let ``route is MoE over HATS: wears the top-k most relevant hats (experts = hats)`` () =
    // relevance favors explorer
    let relevance (h: Hat.Hat<int>) = if h.Name = "explorer" then 10.0 else 1.0
    let p = Persona.create "otto" |> Persona.route relevance 1 available
    Assert.Equal<string list>([ "explorer" ], p.Worn |> List.map (fun h -> h.Name))

[<Fact>]
let ``unrestricted if any worn hat is unrestricted`` () =
    let openHat = hat "free" [] [] // empty allow-list = unrestricted
    let p = Persona.create "otto" |> Persona.wear survival |> Persona.wear openHat
    Assert.Empty(Persona.allowedActions p) // unrestricted (empty) because a worn hat is unrestricted

[<Fact>]
let ``hatFlags is the combinatorial (flags-enum) identity over the hat universe`` () =
    // wearing only explorer (index 1 in [survival; explorer]) -> bit 1 set -> flags = 2
    let p = Persona.create "otto" |> Persona.wear explorer
    Assert.Equal(2, Persona.hatFlags available p)
    let both = Persona.create "otto" |> Persona.wearAll available
    Assert.Equal(3, Persona.hatFlags available both) // bits 0 and 1

[<Fact>]
let ``same hatFlags + different private = same combinatorial identity but distinct via private (anti-collapse)`` () =
    let a = Persona.create "a" |> Persona.wearAll available |> Persona.withPrivate [| 1uy |]
    let b = Persona.create "b" |> Persona.wearAll available |> Persona.withPrivate [| 2uy |]
    Assert.Equal(Persona.hatFlags available a, Persona.hatFlags available b) // identical flags-enum identity
    Assert.NotEqual<byte[]>(a.Private, b.Private) // ...yet distinct — private state breaks the combinatorial limit

[<Fact>]
let ``regularization (overfitting lever) = size of the private budget; 0 = pure flags-enum (max overfit)`` () =
    let plain = Persona.create "otto"
    let reg = plain |> Persona.withPrivate [| 1uy; 2uy; 3uy |]
    Assert.Equal(0, Persona.regularization plain) // no private state -> max overfit to the game
    Assert.Equal(3, Persona.regularization reg) // more private state -> more regularization / entropy
