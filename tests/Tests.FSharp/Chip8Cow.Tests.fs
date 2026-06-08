module Zeta.Tests.Chip8CowTests

open global.Xunit
open Zeta.Core

let private arith = [| 0x6Auy; 0x05uy; 0x7Auy; 0x03uy; 0x60uy; 0x02uy; 0x8Auy; 0x04uy |]
let private drawRom = [| 0x62uy; 0x00uy; 0xF2uy; 0x29uy; 0x60uy; 0x00uy; 0x61uy; 0x00uy; 0xD0uy; 0x15uy |]

[<Fact>]
let ``cross-check vs the hard Chip8 oracle: same registers (StoredProc differential)`` () =
    let hard = Chip8.create 1UL in Chip8.loadRom arith hard
    Chip8.run 4 hard
    let cow = Chip8Cow.create 1UL |> Chip8Cow.loadRom arith |> Chip8Cow.run 4
    Assert.Equal<byte[]>(hard.V, cow.V)
    Assert.Equal(int hard.PC, int cow.PC)

[<Fact>]
let ``cross-check vs hard oracle: same display (sprite draw)`` () =
    let hard = Chip8.create 1UL in Chip8.loadRom drawRom hard
    Chip8.run 5 hard
    let cow = Chip8Cow.create 1UL |> Chip8Cow.loadRom drawRom |> Chip8Cow.run 5
    let mutable same = true
    for yy in 0 .. Chip8.DisplayH - 1 do
        for xx in 0 .. Chip8.DisplayW - 1 do
            if Chip8.pixel xx yy hard <> Chip8Cow.pixel xx yy cow then same <- false
    Assert.True(same)

[<Fact>]
let ``COW purity: stepping a frame does NOT mutate the parent (the DAG holds)`` () =
    let f0 = Chip8Cow.create 1UL |> Chip8Cow.loadRom arith
    let pc0 = f0.PC
    let f1 = Chip8Cow.step f0
    Assert.Equal(int pc0, int f0.PC) // parent untouched (immutable)
    Assert.NotEqual(int f0.PC, int f1.PC) // child advanced
    Assert.Equal(0uy, f0.V.[0xA]) // parent register untouched
    Assert.Equal(5uy, f1.V.[0xA]) // child set V[A]=5 (6A05)

[<Fact>]
let ``fork: two children under different inputs are independent, parent shared/untouched`` () =
    // ROM: EX9E skip-if-key — branch on key 0. 6000 V[0]=0 ; E09E skip if key0
    let rom = [| 0x60uy; 0x00uy; 0xE0uy; 0x9Euy |]
    let f = Chip8Cow.create 1UL |> Chip8Cow.loadRom rom |> Chip8Cow.step // V[0]=0, now at E09E
    let keyOn = Array.zeroCreate 16 in keyOn.[0] <- true
    let keyOff = Array.zeroCreate 16
    let a, b = Chip8Cow.fork keyOn keyOff f
    Assert.NotEqual(int a.PC, int b.PC) // key pressed -> skipped (PC+2 extra); not pressed -> didn't
    Assert.Equal(int f.PC + 2, int b.PC) // no key: normal advance
    Assert.Equal(int f.PC + 4, int a.PC) // key: advance + skip

[<Fact>]
let ``rewind: a retained earlier frame is intact (DAG of COWs)`` () =
    let f0 = Chip8Cow.create 1UL |> Chip8Cow.loadRom arith
    let f2 = f0 |> Chip8Cow.run 2 // V[A]=8
    let f4 = f2 |> Chip8Cow.run 2 // V[A]=10
    Assert.Equal(8uy, f2.V.[0xA]) // f2 still 8 after f4 computed (rewind target intact)
    Assert.Equal(10uy, f4.V.[0xA])

[<Fact>]
let ``DST: same seed -> identical run; deterministic`` () =
    let rom = [| 0xC0uy; 0xFFuy; 0xC1uy; 0x0Fuy |]
    let a = Chip8Cow.create 42UL |> Chip8Cow.loadRom rom |> Chip8Cow.run 2
    let b = Chip8Cow.create 42UL |> Chip8Cow.loadRom rom |> Chip8Cow.run 2
    Assert.Equal<byte[]>(a.V, b.V)
