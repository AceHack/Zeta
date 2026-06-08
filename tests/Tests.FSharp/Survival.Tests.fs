module Zeta.Tests.SurvivalTests

open global.Xunit
open Zeta.Core

let private none = SoftController.none
let private actions = [ none ]
let private alive (_: Chip8Cow.Frame) = true
let private mk rom = Chip8Cow.create 1UL |> Chip8Cow.loadRom rom

let private selfLoop = [| 0x12uy; 0x00uy |] // exact fixed point -> a true limit cycle
let private counter = [| 0x70uy; 0x01uy; 0x12uy; 0x00uy |] // V0 drifts; PC loops

[<Fact>]
let ``self-loop is alive forever by the SOUND (exact) verdict (a true limit cycle)`` () =
    let v = Survival.analyze alive 8 100 actions (mk selfLoop)
    Assert.True(v.AliveForever)

[<Fact>]
let ``counter: sound verdict can't prove forever (V0 drifts -> no exact cycle), conservative`` () =
    let v = Survival.analyze alive 8 10 actions (mk counter)
    Assert.False(v.AliveForever) // no zero-drift cycle exists
    Assert.True(v.Truncated) // safe set is unbounded under the exact key

[<Fact>]
let ``counter IS alive forever under the lens (V0 dropped -> PC loop = a limit cycle)`` () =
    let classes = MemoryLens.classify 8 actions [ mk counter ]
    let v = Survival.analyzeKeyed (MemoryLens.lensKey classes) alive 8 50 actions (mk counter)
    Assert.True(v.AliveForever) // the lens-compressed loop is found

[<Fact>]
let ``a lethal invariant kills you: no safe cycle, small finite horizon`` () =
    let dies (f: Chip8Cow.Frame) = int f.V.[0] < 3 // counter blows past 3 in one frame
    let v = Survival.analyze dies 8 100 actions (mk counter)
    Assert.False(v.AliveForever)
    Assert.False(v.Truncated) // the safe set is finite (you die quickly)
    Assert.True(v.SafeStates <= 2) // only the start (and maybe one) state is alive
