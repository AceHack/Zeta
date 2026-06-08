module Zeta.Tests.TraversalTests

open global.Xunit
open Zeta.Core

let private lens name cells = { LensRouter.Name = name; LensRouter.Cells = cells }

let private mk name cost reduction lenses : Traversal.Traversal<int> =
    { Name = name
      Target = name
      Cost = cost
      Lenses = lenses
      ExpectedReduction = reduction
      Run = fun _ -> 0 }

[<Fact>]
let ``voi = expected reduction / cost; free traversals are infinity`` () =
    Assert.Equal(2.0, Traversal.voi (mk "a" 5.0 10.0 []), 9)
    Assert.Equal(infinity, Traversal.voi (mk "ambient" 0.0 1.0 []))

[<Fact>]
let ``worth gates on a VOI threshold`` () =
    Assert.True(Traversal.worth 1.5 (mk "a" 5.0 10.0 [])) // voi 2.0 >= 1.5
    Assert.False(Traversal.worth 3.0 (mk "a" 5.0 10.0 [])) // voi 2.0 < 3.0

[<Fact>]
let ``schedule takes highest-VOI traversals within the cost budget`` () =
    let hi = mk "hi" 2.0 10.0 [] // voi 5
    let mid = mk "mid" 3.0 6.0 [] // voi 2
    let lo = mk "lo" 5.0 2.0 [] // voi 0.4
    let chosen = Traversal.schedule 5.0 [ lo; mid; hi ] |> List.map (fun t -> t.Name)
    Assert.Equal<string list>([ "hi"; "mid" ], chosen) // hi(2)+mid(3)=5 fits; lo would overflow

[<Fact>]
let ``schedule with zero budget runs only the free (ambient) traversals`` () =
    let ambient = mk "ambient" 0.0 1.0 []
    let costly = mk "costly" 1.0 5.0 []
    let chosen = Traversal.schedule 0.0 [ costly; ambient ] |> List.map (fun t -> t.Name)
    Assert.Equal<string list>([ "ambient" ], chosen)

[<Fact>]
let ``a traversal carries its relevant lenses and resolves via Run`` () =
    let t = { (mk "resolve-x" 1.0 1.0 [ lens "L" [ "V0" ] ]) with Run = fun f -> int f.V.[0] }
    Assert.Equal<string list>([ "L" ], t.Lenses |> List.map (fun l -> l.Name))
    let f = Chip8Cow.create 1UL |> Chip8Cow.loadRom [| 0x60uy; 0x07uy |] |> Chip8Cow.run 1
    Assert.Equal(7, t.Run f) // the control loop resolved V0=7
