module Zeta.Tests.Chip8Tests

open global.Xunit
open Zeta.Core

let private withRom seed (rom: byte[]) =
    let c = Chip8.create seed
    Chip8.loadRom rom c
    c

[<Fact>]
let ``arithmetic opcodes: set, add-immediate, add-register with carry flag`` () =
    // 6A05 V[A]=5 ; 7A03 V[A]+=3->8 ; 6002 V[0]=2 ; 8A04 V[A]+=V[0]->10, VF=0
    let c = withRom 1UL [| 0x6Auy; 0x05uy; 0x7Auy; 0x03uy; 0x60uy; 0x02uy; 0x8Auy; 0x04uy |]
    Chip8.run 4 c
    Assert.Equal(10uy, c.V.[0xA])
    Assert.Equal(2uy, c.V.[0])
    Assert.Equal(0uy, c.V.[0xF]) // no carry

[<Fact>]
let ``8XY4 sets carry flag on overflow`` () =
    // 60FF V[0]=255 ; 6101 V[1]=1 ; 8014 V[0]+=V[1] -> wraps to 0, VF=1
    let c = withRom 1UL [| 0x60uy; 0xFFuy; 0x61uy; 0x01uy; 0x80uy; 0x14uy |]
    Chip8.run 3 c
    Assert.Equal(0uy, c.V.[0])
    Assert.Equal(1uy, c.V.[0xF]) // carry

[<Fact>]
let ``FX33 writes BCD of a register to memory at I`` () =
    // 609C V[0]=156 ; A300 I=0x300 ; F033 BCD -> mem[0x300..]=1,5,6
    let c = withRom 1UL [| 0x60uy; 0x9Cuy; 0xA3uy; 0x00uy; 0xF0uy; 0x33uy |]
    Chip8.run 3 c
    Assert.Equal(1uy, c.Mem.[0x300])
    Assert.Equal(5uy, c.Mem.[0x301])
    Assert.Equal(6uy, c.Mem.[0x302])

[<Fact>]
let ``call / return via the stack`` () =
    // 0x200 2206 call 0x206 ; 0x202 60FF V[0]=255 ; 0x204 1204 halt ; 0x206 6107 V[1]=7 ; 0x208 00EE return
    let c = withRom 1UL [| 0x22uy; 0x06uy; 0x60uy; 0xFFuy; 0x12uy; 0x04uy; 0x61uy; 0x07uy; 0x00uy; 0xEEuy |]
    Chip8.run 4 c
    Assert.Equal(7uy, c.V.[1]) // subroutine ran
    Assert.Equal(0xFFuy, c.V.[0]) // returned and continued

[<Fact>]
let ``DXYN draws a sprite (font glyph 0) and reports no collision`` () =
    // 6200 V[2]=0 ; F229 I=font(0) ; 6000 V[0]=0 ; 6100 V[1]=0 ; D015 draw 5-row sprite at (0,0)
    let c = withRom 1UL [| 0x62uy; 0x00uy; 0xF2uy; 0x29uy; 0x60uy; 0x00uy; 0x61uy; 0x00uy; 0xD0uy; 0x15uy |]
    Chip8.run 5 c
    // glyph '0' top row = 0xF0 = 1111_0000
    Assert.True(Chip8.pixel 0 0 c)
    Assert.True(Chip8.pixel 3 0 c)
    Assert.False(Chip8.pixel 4 0 c)
    Assert.Equal(0uy, c.V.[0xF]) // no collision on a clear screen

[<Fact>]
let ``DST RND: CXNN is deterministic in the seed (same seed -> same, replayable)`` () =
    let rom = [| 0xC0uy; 0xFFuy |] // V[0] = rand & 0xFF
    let a = withRom 42UL rom in Chip8.step a
    let b = withRom 42UL rom in Chip8.step b
    Assert.Equal(a.V.[0], b.V.[0]) // same seed -> identical (DST)
    let d = withRom 99UL rom in Chip8.step d
    Assert.NotEqual(a.V.[0], d.V.[0]) // different seed -> (almost surely) different

[<Fact>]
let ``clone is an independent snapshot (fork / rewind / save-state)`` () =
    let c = withRom 1UL [| 0x60uy; 0x05uy; 0x70uy; 0x01uy |] // V[0]=5 ; V[0]+=1
    Chip8.step c // V[0]=5
    let snap = Chip8.clone c // fork here
    Chip8.run 1 c // original: V[0]=6
    Assert.Equal(6uy, c.V.[0])
    Assert.Equal(5uy, snap.V.[0]) // snapshot unaffected — independent timeline

[<Fact>]
let ``tick decrements the delay/sound timers (the 60Hz interrupt)`` () =
    let c = withRom 1UL [| 0x60uy; 0x03uy; 0xF0uy; 0x15uy |] // V[0]=3 ; delay=V[0]
    Chip8.run 2 c
    Assert.Equal(3uy, c.Delay)
    Chip8.tick c
    Chip8.tick c
    Assert.Equal(1uy, c.Delay)

[<Fact>]
let ``full run is deterministic / replayable (DST)`` () =
    let rom = [| 0x60uy; 0x0Auy; 0xC1uy; 0x0Fuy; 0x70uy; 0x01uy; 0x81uy; 0x04uy |]
    let r1 = withRom 7UL rom in Chip8.run 4 r1
    let r2 = withRom 7UL rom in Chip8.run 4 r2
    Assert.Equal<byte[]>(r1.V, r2.V)
