module Zeta.Tests.SoftChip8Tests

open global.Xunit
open Zeta.Core

let private arith = [| 0x6Auy; 0x05uy; 0x7Auy; 0x03uy; 0x60uy; 0x02uy; 0x8Auy; 0x04uy |]
let private branchRom = [| 0x60uy; 0x00uy; 0xE0uy; 0x9Euy |] // V[0]=0 ; skip if key 0

[<Fact>]
let ``lookAhead batches N deterministic steps ≡ Chip8Cow.run N (no input branch)`` () =
    let f = Chip8Cow.create 1UL |> Chip8Cow.loadRom arith
    let predicted, hit = SoftChip8.lookAhead 4 f
    let played = Chip8Cow.run 4 f
    Assert.False(hit) // no input branch on the arithmetic line
    Assert.Equal<byte[]>(played.V, predicted.V)
    Assert.Equal(int played.PC, int predicted.PC)

[<Fact>]
let ``branchesOnInput: true for EX9E, false for arithmetic`` () =
    let b = Chip8Cow.create 1UL |> Chip8Cow.loadRom branchRom |> Chip8Cow.step // past V[0]=0, at E09E
    Assert.True(SoftChip8.branchesOnInput b)
    let a = Chip8Cow.create 1UL |> Chip8Cow.loadRom arith
    Assert.False(SoftChip8.branchesOnInput a)

[<Fact>]
let ``lookAhead halts at an input branch (prediction must fork there)`` () =
    let f = Chip8Cow.create 1UL |> Chip8Cow.loadRom branchRom
    let _, hit = SoftChip8.lookAhead 10 f // V[0]=0 then hits E09E
    Assert.True(hit)

[<Fact>]
let ``forkOnInput: two weighted speculative branches at an input fork (key down skips, up doesn't)`` () =
    let b = Chip8Cow.create 1UL |> Chip8Cow.loadRom branchRom |> Chip8Cow.step // at E09E
    let branches = SoftChip8.forkOnInput b
    Assert.Equal(2, List.length branches)
    let pcs = branches |> List.map (fun (fr, _) -> int fr.PC) |> List.sort
    Assert.Equal(int b.PC + 2, List.head pcs) // key up: normal advance
    Assert.Equal(int b.PC + 4, List.last pcs) // key down: advance + skip
    Assert.True(branches |> List.forall (fun (_, w) -> w = 0.5))

[<Fact>]
let ``forkOnInput on a deterministic op is a point-mass (1 successor)`` () =
    let a = Chip8Cow.create 1UL |> Chip8Cow.loadRom arith
    Assert.Equal(1, List.length (SoftChip8.forkOnInput a))

[<Fact>]
let ``resolve commits the actual-input branch (Z-set retraction of the rest)`` () =
    let b = Chip8Cow.create 1UL |> Chip8Cow.loadRom branchRom |> Chip8Cow.step // at E09E
    let keyDown = Array.zeroCreate 16 in keyDown.[0] <- true
    let committed = SoftChip8.resolve keyDown b
    Assert.Equal(int b.PC + 4, int committed.PC) // key 0 was actually down -> skipped

[<Fact>]
let ``branchFactor: 2 at an input branch, 1 deterministic`` () =
    let b = Chip8Cow.create 1UL |> Chip8Cow.loadRom branchRom |> Chip8Cow.step
    Assert.Equal(2, SoftChip8.branchFactor b)
    let a = Chip8Cow.create 1UL |> Chip8Cow.loadRom arith
    Assert.Equal(1, SoftChip8.branchFactor a)
