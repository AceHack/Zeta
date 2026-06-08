module Zeta.Tests.SoftControllerTests

open global.Xunit
open Zeta.Core

let private branchRom = [| 0x60uy; 0x00uy; 0xE0uy; 0x9Euy |] // V[0]=0 ; skip if key 0
let private waitRom = [| 0xF0uy; 0x0Auy |] // FX0A wait for any key into V[0]
let private atBranch () = Chip8Cow.create 1UL |> Chip8Cow.loadRom branchRom |> Chip8Cow.step // at E09E

[<Fact>]
let ``controller states: allButtons / none / singleKey`` () =
    Assert.True(SoftController.allButtons |> Array.forall id)
    Assert.True(SoftController.none |> Array.forall not)
    let k = SoftController.singleKey 5
    Assert.True(k.[5])
    Assert.Equal(1, k |> Array.filter id |> Array.length)

[<Fact>]
let ``superposition: EX9E -> 2 branches; FX0A -> 16 (every button); deterministic -> 1`` () =
    Assert.Equal(2, List.length (SoftController.inputSuperposition (atBranch ())))
    let w = Chip8Cow.create 1UL |> Chip8Cow.loadRom waitRom
    Assert.Equal(16, List.length (SoftController.inputSuperposition w)) // hit every button at once
    let a = Chip8Cow.create 1UL |> Chip8Cow.loadRom [| 0x60uy; 0x01uy |]
    Assert.Equal(1, List.length (SoftController.inputSuperposition a))

[<Fact>]
let ``superposition weights are a normalised prior (sum to 1)`` () =
    let sum = SoftController.inputSuperposition (atBranch ()) |> List.sumBy snd
    Assert.Equal(1.0, sum, 9)
    let wsum = Chip8Cow.create 1UL |> Chip8Cow.loadRom waitRom |> SoftController.inputSuperposition |> List.sumBy snd
    Assert.Equal(1.0, wsum, 9)

[<Fact>]
let ``softFork: the two EX9E successors differ in PC (skip vs no-skip)`` () =
    let succ = SoftController.softFork (atBranch ()) |> List.map (fun (f, _) -> int f.PC) |> List.sort
    Assert.Equal(2, List.length succ)
    Assert.NotEqual(List.head succ, List.last succ)

[<Fact>]
let ``collapseToBest: learns the buttons after the fact (value rewards the skip branch)`` () =
    let f = atBranch ()
    let keys, _, _ = SoftController.collapseToBest (fun fr -> float (int fr.PC)) f // prefer higher PC = skip
    Assert.True(keys.[0]) // key 0 down was the best (it skipped -> higher PC)
    // a value that prefers the LOWER PC collapses to no-press
    let keys2, _, _ = SoftController.collapseToBest (fun fr -> -(float (int fr.PC))) f
    Assert.False(keys2.[0])

[<Fact>]
let ``bestSequence: exhaustive optimal input path over depth (the tractable solve)`` () =
    let f = atBranch ()
    let seq, _ = SoftController.bestSequence (fun fr -> float (int fr.PC)) 1 f
    Assert.Equal(1, List.length seq)
    Assert.True(seq.Head.[0]) // first optimal input = press key 0 (the skip branch)
