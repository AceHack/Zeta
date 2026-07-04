module Zeta.Tests.Runtime.BuggifyTests

open System
open Xunit
open Zeta.Core

[<Fact>]
let ``Buggify returns false when disabled`` () =
    Buggify.Disable()
    Assert.False(Buggify.IsActive())
    Assert.False(Buggify.IsActive(1.0))

[<Fact>]
let ``Buggify is active under simulation based on probability thresholds`` () =
    Buggify.Enable(42L)
    try
        // 0% probability check always returns false
        let f0 = Buggify.IsActive(0.0)
        Assert.False(f0)

        // 100% probability check always returns true
        let f100 = Buggify.IsActive(1.0)
        Assert.True(f100)
    finally
        Buggify.Disable()

[<Fact>]
let ``Buggify rolls independent decisions on consecutive calls`` () =
    Buggify.Enable(99L)
    try
        let rolls = [ for _ in 1 .. 20 -> Buggify.IsActive(0.5) ]
        Assert.Contains(true, rolls)
        Assert.Contains(false, rolls)
    finally
        Buggify.Disable()

[<Fact>]
let ``Buggify is deterministic and repeatable per seed`` () =
    let runTrace seed =
        Buggify.Enable(seed)
        try
            // Helper checking unique call sites (distinct lines)
            let check1 () = Buggify.IsActive(0.5)
            let check2 () = Buggify.IsActive(0.5)
            let check3 () = Buggify.IsActive(0.5)
            let check4 () = Buggify.IsActive(0.5)
            let check5 () = Buggify.IsActive(0.5)

            [| check1(); check2(); check3(); check4(); check5() |]
        finally
            Buggify.Disable()

    let t1 = runTrace 100L
    let t2 = runTrace 100L
    let t3 = runTrace 200L

    // Repeated run with same seed must yield exact same outputs
    Assert.Equal<bool>(t1, t2)
    // Distinct seed should yield different outputs (probabilistically)
    Assert.NotEqual<bool>(t1, t3)
