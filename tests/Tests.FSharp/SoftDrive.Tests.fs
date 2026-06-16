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

// delay-wait ROM: 6305 F315 F207 3200 1206 — step-based drive would freeze; frame-aware keeps it live
let private delayWait = [| 0x63uy; 0x05uy; 0xF3uy; 0x15uy; 0xF2uy; 0x07uy; 0x32uy; 0x00uy; 0x12uy; 0x06uy |]

// 6000 E09E 6001 — first frame reaches an input branch; the soft rollout then forks.
let private inputAfterOne = [| 0x60uy; 0x00uy; 0xE0uy; 0x9Euy; 0x60uy; 0x01uy |]

[<Fact>]
let ``frame-aware driveFrames stays LIVE on a delay-wait ROM (ticks the timer down)`` () =
    let setup = Chip8Cow.run 2 (Chip8Cow.create 1UL |> Chip8Cow.loadRom delayWait) // delay = 5, in wait loop
    let driven = SoftDrive.driveFrames SoftDashboard.sumMemory 4 1 4 6 setup
    Assert.True(int driven.Delay < 5) // the tick fired across frames — not frozen

[<Fact>]
let ``frame-aware drive is deterministic (DST)`` () =
    let a = SoftDrive.driveFrames SoftDashboard.sumMemory 8 2 4 5 (hard ())
    let b = SoftDrive.driveFrames SoftDashboard.sumMemory 8 2 4 5 (hard ())
    Assert.Equal<byte[]>(a.V, b.V)
    Assert.Equal(int a.PC, int b.PC)

[<Fact>]
let ``bestFrameAction returns a valid 16-key vector`` () =
    let keys = SoftDrive.bestFrameAction SoftDashboard.sumMemory 8 2 4 (hard ())
    Assert.Equal(16, keys.Length)

[<Fact>]
let ``frame-aware driveFramesWithHeatSink exports prune heat to host`` () =
    let setup = Chip8Cow.create 1UL |> Chip8Cow.loadRom inputAfterOne
    let recorder = RecordingHeatSink()

    match SoftDrive.driveFramesWithHeatSink "chip8-room" (recorder :> IHeatSink) SoftDashboard.sumMemory 1 1 1 1 setup with
    | Error e -> Assert.True(false, sprintf "unexpected heat sink feedback: %A" e)
    | Ok _ ->
        let signatures = recorder.Signatures |> Seq.toList
        Assert.NotEmpty signatures
        Assert.All(
            signatures,
            fun heat ->
                Assert.Equal("chip8-room", heat.Source)
                Assert.Equal("soft-emu.prune", heat.Kind)
                Assert.Equal(1, heat.Units))
