module Zeta.Tests.StateSpaceTests

open global.Xunit
open Zeta.Core

let private none = [ SoftController.none ]
let private selfLoop = [| 0x12uy; 0x00uy |] // 1200 jump-to-self
let private counter = [| 0x70uy; 0x01uy; 0x12uy; 0x00uy |] // 7001;1200: V0 grows forever (no cycle)

let private mk rom = Chip8Cow.create 1UL |> Chip8Cow.loadRom rom

[<Fact>]
let ``self-loop ROM = one state, cycle detected (the content hash catches the loop)`` () =
    let g = StateSpace.explore 8 50 none (mk selfLoop)
    Assert.Equal(1, g.StateCount) // dedup: the loop collapses to one indexed state
    Assert.True(g.SelfLoops > 0)
    Assert.True(StateSpace.hasCycle g)

[<Fact>]
let ``counter ROM never cycles -> bounded search truncates at maxStates`` () =
    let g = StateSpace.explore 8 10 none (mk counter)
    Assert.Equal(10, g.StateCount)
    Assert.True(g.Truncated)
    Assert.False(StateSpace.hasCycle g) // every state distinct (V0 keeps growing)

[<Fact>]
let ``recoverPlan reproduces the path: replaying recovered inputs reaches the goal state`` () =
    let f0 = mk counter
    let g = StateSpace.explore 8 12 none f0
    match StateSpace.recoverPlan 5 g with
    | Some plan ->
        Assert.Equal(5, List.length plan) // 5 frame-steps from state 0 to state 5
        let mutable f = f0
        for a in plan do
            f <- Chip8Cow.frameStep 8 { f with Keys = a }
        Assert.Equal(StateSpace.contentKey g.Frames.[5], StateSpace.contentKey f)
    | None -> Assert.True(false, "state 5 should be reachable")

[<Fact>]
let ``recoverPlan to the root is the empty plan; unreachable id is None`` () =
    let g = StateSpace.explore 8 6 none (mk counter)
    Assert.Equal(Some [], StateSpace.recoverPlan 0 g)
    Assert.Equal(None, StateSpace.recoverPlan 999 g)

[<Fact>]
let ``contentKey is stable: same frame -> same key (the index relies on it)`` () =
    let f = mk counter |> Chip8Cow.run 3
    Assert.Equal(StateSpace.contentKey f, StateSpace.contentKey f)
