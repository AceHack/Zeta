module Zeta.Tests.DarkHallTests

open global.Xunit
open Zeta.Core
open Zeta.Core.DarkHall

// Programs are clean-room CHIP-8-subset byte arrays (no ROMs). Load at offset 0, PC starts at 0.

[<Fact>]
let ``set + add + halt: V0 = 5; V0 += 3 -> 8`` () =
    // 6005 (V0=5)  7003 (V0+=3)  0000 (halt)
    let prog = [| 0x60uy; 0x05uy; 0x70uy; 0x03uy; 0x00uy; 0x00uy |]
    let s = run prog 100
    Assert.True s.Halted
    Assert.Equal(8, s.V.[0])

[<Fact>]
let ``1NNN jump skips an instruction`` () =
    // 0: 1004 jump->4 | 2: 6063 V0=99 (skipped) | 4: 6007 V0=7 | 6: 0000 halt
    let prog = [| 0x10uy; 0x04uy; 0x60uy; 0x63uy; 0x60uy; 0x07uy; 0x00uy; 0x00uy |]
    let s = run prog 100
    Assert.Equal(7, s.V.[0]) // not 99 — the jump skipped index 2

[<Fact>]
let ``3XNN skips next instruction when Vx = NN`` () =
    // 0: 6005 V0=5 | 2: 3005 skip-if V0=5 (yes -> PC=6) | 4: 6063 V0=99 (skipped) | 6: 0000 halt
    let prog = [| 0x60uy; 0x05uy; 0x30uy; 0x05uy; 0x60uy; 0x63uy; 0x00uy; 0x00uy |]
    let s = run prog 100
    Assert.Equal(5, s.V.[0]) // stayed 5; the V0=99 was skipped

[<Fact>]
let ``8XY4 adds with carry into VF (byte wrap)`` () =
    // 0: 60C8 V0=200 | 2: 6164 V1=100 | 4: 8014 V0+=V1 | 6: 0000 halt
    let prog = [| 0x60uy; 0xC8uy; 0x61uy; 0x64uy; 0x80uy; 0x14uy; 0x00uy; 0x00uy |]
    let s = run prog 100
    Assert.Equal(44, s.V.[0]) // (200+100) & 0xFF
    Assert.Equal(1, s.V.[0xF]) // carry set

[<Fact>]
let ``DST: the Dark Hall is deterministic — same program ⇒ identical final state and trace`` () =
    let prog = [| 0x60uy; 0x05uy; 0x70uy; 0x03uy; 0x80uy; 0x04uy; 0x00uy; 0x00uy |]
    Assert.Equal<EmuState>(run prog 100, run prog 100)
    Assert.Equal<EmuState list>(trace prog 100, trace prog 100)

[<Fact>]
let ``budget bounds a non-halting program (jump-to-self)`` () =
    // 1000 = jump to 0 forever
    let prog = [| 0x10uy; 0x00uy |]
    let s = run prog 10
    Assert.False s.Halted
    Assert.Equal(10, s.Steps)

[<Fact>]
let ``cell wiring: zeta run dark-hall addresses the Dark Hall cell`` () =
    match ZetaCli.parse "zeta run dark-hall" with
    | Ok cmd ->
        Assert.True(isAddressed cmd)
        Assert.Equal(CellName, cmd.Noun)
    | Error e -> failwith e
    // a different noun does not address it
    match ZetaCli.parse "zeta run cell" with
    | Ok cmd -> Assert.False(isAddressed cmd)
    | Error e -> failwith e
