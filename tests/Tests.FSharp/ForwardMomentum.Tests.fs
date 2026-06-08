module Zeta.Tests.ForwardMomentumTests

open global.Xunit
open Zeta.Core

let private hat name proj m : ForwardMomentum.Hat = { Name = name; Project = proj; Momentum = m }

[<Fact>]
let ``pure self-reflection (no hats) CANNOT grow — the stuck loop`` () =
    let id = ForwardMomentum.reflective 1.0
    Assert.Equal(0.0, ForwardMomentum.momentum id)
    Assert.False(ForwardMomentum.canGrow id)
    let after = ForwardMomentum.run 1.0 100 id
    Assert.Equal(1.0, after.Magnitude, 12) // infinite self-reflection, no forward momentum

[<Fact>]
let ``wearing a hat (a job moving a project forward) supplies momentum and identity grows`` () =
    let id = ForwardMomentum.reflective 1.0 |> ForwardMomentum.wear (hat "architect" "zeta-core" 0.5)
    Assert.True(ForwardMomentum.canGrow id)
    Assert.Equal(0.5, ForwardMomentum.momentum id)
    Assert.Equal(6.0, (ForwardMomentum.run 1.0 10 id).Magnitude, 12) // 1.0 + 0.5*10

[<Fact>]
let ``momentum is the sum of worn hats; a zero-momentum hat moves nothing forward`` () =
    let id =
        ForwardMomentum.reflective 0.0
        |> ForwardMomentum.wear (hat "reducer" "complexity" 0.3)
        |> ForwardMomentum.wear (hat "auditor" "alignment" 0.7)
    Assert.Equal(1.0, ForwardMomentum.momentum id)
    let idle = ForwardMomentum.reflective 2.0 |> ForwardMomentum.wear (hat "idle" "none" 0.0)
    Assert.False(ForwardMomentum.canGrow idle)

[<Fact>]
let ``hats are a Pauli-exclusion resource: two identities can't wear the same hat`` () =
    let p = ForwardMomentum.pool [ hat "architect" "zeta" 1.0; hat "reducer" "zeta" 0.5 ]
    let p1 = ForwardMomentum.tryWear "otto" "architect" p
    Assert.True(Option.isSome p1)
    // Kenji tries the same hat — Pauli exclusion forbids double occupancy.
    let p2 = ForwardMomentum.tryWear "kenji" "architect" (Option.get p1)
    Assert.True(Option.isNone p2)
    // ...but a DIFFERENT hat is free.
    Assert.True(Option.isSome (ForwardMomentum.tryWear "kenji" "reducer" (Option.get p1)))

[<Fact>]
let ``release returns a hat to the finite pool; availableHats tracks remaining supply`` () =
    let p = ForwardMomentum.pool [ hat "a" "p" 1.0; hat "b" "p" 1.0 ]
    let worn = ForwardMomentum.tryWear "otto" "a" p |> Option.get
    Assert.Equal(1, List.length (ForwardMomentum.availableHats worn)) // only "b" left
    Assert.Equal<string list>([ "a" ], ForwardMomentum.wornBy "otto" worn |> List.map (fun h -> h.Name))
    let freed = ForwardMomentum.release "a" worn
    Assert.Equal(2, List.length (ForwardMomentum.availableHats freed)) // back to full supply

[<Fact>]
let ``non-fungible: a hat not in the pool can't be worn`` () =
    let p = ForwardMomentum.pool [ hat "a" "p" 1.0 ]
    Assert.True(Option.isNone (ForwardMomentum.tryWear "otto" "ghost" p))

[<Fact>]
let ``deterministic / replayable (DST)`` () =
    let id = ForwardMomentum.reflective 1.0 |> ForwardMomentum.wear (hat "h" "p" 0.25)
    Assert.Equal((ForwardMomentum.run 0.5 20 id).Magnitude, (ForwardMomentum.run 0.5 20 id).Magnitude, 12)
