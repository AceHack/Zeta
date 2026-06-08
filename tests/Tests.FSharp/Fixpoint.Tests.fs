module Zeta.Tests.FixpointTests

open System
open global.Xunit
open Zeta.Core

[<Fact>]
let ``contraction converges to its fixed point (t0=t-infinity loop closes)`` () =
    // f(x) = x/2 + 1  -> fixed point x* = 2
    let r = Fixpoint.solveFloat (fun x -> x / 2.0 + 1.0) 1e-9 200 100.0
    Assert.True(r.Converged)
    Assert.True(abs (r.State - 2.0) < 1e-6)

[<Fact>]
let ``idempotent step converges immediately (CRDT-style self-consistency)`` () =
    // f(x) = max(x,5): once at >=5 it is fixed; idempotent f(f(x))=f(x)
    let r = Fixpoint.solveFloat (fun x -> max x 5.0) 1e-9 50 3.0
    Assert.True(r.Converged)
    Assert.Equal(5.0, r.State, 9)
    Assert.True(r.Iterations <= 2) // reaches fixed point then confirms

[<Fact>]
let ``rotation by an irrational fraction of 2pi does NOT converge (aperiodic, honestly reported)`` () =
    // step rotates a Cl3 vector by an irrational angle in the e12 plane: never returns to itself
    let irrational = 2.0 * Math.PI * (sqrt 2.0 - 1.0)
    let rotor = Cl3.rotor irrational Cl3.e12
    let step v = Cl3.rotate rotor v
    let dist a b = Cl3.norm (Cl3.sub a b)
    let r = Fixpoint.solve dist step 1e-6 64 (Cl3.vector 1.0 0.0 0.0)
    Assert.False(r.Converged) // no settled fixed point in this metric — non-convergence reported, not hidden

[<Fact>]
let ``isFixed detects an already self-consistent state`` () =
    // 2 is the fixed point of x/2+1
    Assert.True(Fixpoint.isFixed (fun a b -> abs (a - b)) (fun x -> x / 2.0 + 1.0) 1e-9 2.0)
    Assert.False(Fixpoint.isFixed (fun a b -> abs (a - b)) (fun x -> x / 2.0 + 1.0) 1e-9 100.0)
