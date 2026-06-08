module Zeta.Tests.SoftDriveTests

open global.Xunit
open Zeta.Core

// deterministic, no-input ROM: 6A05 7A03 6002 8A04 (build up memory, no key opcodes)
let private arith = [| 0x6Auy; 0x05uy; 0x7Auy; 0x03uy; 0x60uy; 0x02uy; 0x8Auy; 0x04uy |]
let private hard () = Chip8Cow.create 7UL |> Chip8Cow.loadRom arith

[<Fact>]
let ``bestAction returns a valid 16-key control vector`` () =
    let keys = SoftDrive.bestAction SoftDashboard.sumMemory 3 8 (hard ())
    Assert.Equal(16, keys.Length)

[<Fact>]
let ``on a no-input ROM, driving degenerates to the plain hard run (control is inert)`` () =
    let driven = SoftDrive.driveSumMemory 3 8 4 (hard ())
    let plain = Chip8Cow.run 4 (hard ())
    // keys never read (no input opcodes) => identical trajectory
    Assert.Equal<byte[]>(plain.V, driven.V)
    Assert.Equal(int plain.PC, int driven.PC)

[<Fact>]
let ``drive is deterministic (DST): same seed, same driven trajectory`` () =
    let a = SoftDrive.driveSumMemory 2 6 5 (hard ())
    let b = SoftDrive.driveSumMemory 2 6 5 (hard ())
    Assert.Equal<byte[]>(a.V, b.V)
    Assert.Equal(int a.PC, int b.PC)

[<Fact>]
let ``a control step advances exactly one hard step (PC moves once)`` () =
    let h = hard ()
    let after = SoftDrive.controlStep SoftDashboard.sumMemory 2 4 h
    // one Chip8Cow.step from 0x200 over a 2-byte opcode => PC advanced by 2
    Assert.Equal(int h.PC + 2, int after.PC)
