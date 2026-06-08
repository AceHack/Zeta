module Zeta.Tests.OrbitTests

open System
open global.Xunit
open Zeta.Core

let private dist a b = Cl3.norm (Cl3.sub a b)
let private e1 = Cl3.vector 1.0 0.0 0.0

[<Fact>]
let ``identity step is a Fixed orbit (period 1, the stationary mode)`` () =
    Assert.Equal(Orbit.Fixed, Orbit.classify dist id 1e-9 32 e1)

[<Fact>]
let ``90-degree rotation is a period-4 time-crystal candidate`` () =
    let step v = Cl3.rotate (Cl3.rotor (Math.PI / 2.0) Cl3.e12) v
    Assert.Equal(Orbit.Crystal 4, Orbit.classify dist step 1e-6 32 e1)
    Assert.True(Orbit.isCrystal dist step 1e-6 32 e1)

[<Fact>]
let ``120-degree rotation is a period-3 standing wave`` () =
    let step v = Cl3.rotate (Cl3.rotor (2.0 * Math.PI / 3.0) Cl3.e12) v
    Assert.Equal(Orbit.Crystal 3, Orbit.classify dist step 1e-6 32 e1)

[<Fact>]
let ``irrational rotation is Quasiperiodic (a time quasicrystal, not random)`` () =
    let step v = Cl3.rotate (Cl3.rotor (2.0 * Math.PI * (sqrt 2.0 - 1.0)) Cl3.e12) v
    Assert.Equal(Orbit.Quasiperiodic, Orbit.classify dist step 1e-6 200 e1)
    Assert.False(Orbit.isCrystal dist step 1e-6 200 e1)

[<Fact>]
let ``period finds the smallest closing period`` () =
    let step v = Cl3.rotate (Cl3.rotor (Math.PI / 2.0) Cl3.e12) v
    Assert.Equal(Some 4, Orbit.period dist step 1e-6 32 e1)
