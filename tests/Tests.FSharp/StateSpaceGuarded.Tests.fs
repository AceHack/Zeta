module Zeta.Tests.StateSpaceGuardedTests

open global.Xunit
open Zeta.Core

let private none = [ SoftController.none ]
let private counter = [| 0x70uy; 0x01uy; 0x12uy; 0x00uy |] // 7001;1200: V0 grows ~4/frame
let private mk rom = Chip8Cow.create 1UL |> Chip8Cow.loadRom rom

[<Fact>]
let ``exploreGuarded prunes states violating the invariant (the don't-die / no-downtime guard)`` () =
    // invariant: V0 stays below 20 -> states past that are forbidden, never entered
    let inv (f: Chip8Cow.Frame) = int f.V.[0] < 20
    let g = StateSpace.exploreGuarded inv 8 1000 none (mk counter)
    Assert.All(g.Frames, fun f -> Assert.True(int f.V.[0] < 20)) // every explored state is safe by construction
    Assert.True(g.StateCount > 0)

[<Fact>]
let ``a root that violates the invariant yields an empty safe subspace`` () =
    let inv (_: Chip8Cow.Frame) = false // nothing is safe
    let g = StateSpace.exploreGuarded inv 8 100 none (mk counter)
    Assert.Equal(0, g.StateCount)

[<Fact>]
let ``planTo finds a safe path to a goal predicate and replaying it satisfies the goal`` () =
    let inv (f: Chip8Cow.Frame) = int f.V.[0] < 100
    let goal (f: Chip8Cow.Frame) = int f.V.[0] >= 12
    let f0 = mk counter
    let g = StateSpace.exploreGuarded inv 8 200 none f0
    match StateSpace.planTo goal g with
    | Some plan ->
        let mutable f = f0
        for a in plan do
            f <- Chip8Cow.frameStep 8 { f with Keys = a }
        Assert.True(goal f) // replaying the recovered plan reaches a goal state
        Assert.True(inv f) // ...and it stayed safe (invariant held)
    | None -> Assert.True(false, "goal V0>=12 should be reachable safely")

[<Fact>]
let ``planTo returns None when no explored state meets the goal`` () =
    let inv (f: Chip8Cow.Frame) = int f.V.[0] < 5 // safe subspace caps V0 below 5
    let goal (f: Chip8Cow.Frame) = int f.V.[0] >= 50 // unreachable within the safe subspace
    let g = StateSpace.exploreGuarded inv 8 200 none (mk counter)
    Assert.Equal(None, StateSpace.planTo goal g)
