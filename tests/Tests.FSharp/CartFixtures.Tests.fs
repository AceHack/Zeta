module Zeta.Tests.CartFixturesTests

open global.Xunit
open Zeta.Core

[<Fact>]
let ``assembler helpers produce inspectable CHIP8 bytes`` () =
    Assert.Equal<byte[]>([| 0x6Auy; 0x0Cuy; 0x12uy; 0x02uy |], CartFixtures.loopRom)
    Assert.Equal<byte[]>([| 0xEAuy; 0x9Euy; 0x12uy; 0x00uy |], CartFixtures.inputForkRom)
    Assert.Equal<byte[]>([| 0xF0uy; 0x0Auy |], CartFixtures.keyWaitRom)

[<Fact>]
let ``classic child carts are source-owned deterministic fixtures`` () =
    let loop = CartFixtures.cart CartFixtures.loop
    let inputFork = CartFixtures.cart CartFixtures.inputFork

    Assert.True(CartFixtures.loopRom = loop.Rom)
    Assert.True(CartFixtures.inputForkRom = inputFork.Rom)
    Assert.Equal(1UL, loop.Seed)
    Assert.Equal(1, loop.CyclesPerTick)
    Assert.True(Map.isEmpty loop.Recording.Crossings)
    Assert.True((GameFingerprint.fingerprint loop.Rom).Sha256 <> (GameFingerprint.fingerprint inputFork.Rom).Sha256)

[<Fact>]
let ``CHIP9 color-dot cart uses the emulator extension directly`` () =
    let cart = CartFixtures.cart CartFixtures.chip9GreenDot
    let final = Cart.playback cart

    Assert.Equal(CartFixtures.Dialect.Chip9, CartFixtures.chip9GreenDot.Dialect)
    Assert.Equal(2uy, final.Plane)
    Assert.False(Chip8Cow.pixel 0 0 final)
    Assert.Equal(2uy, Chip8Cow.colorAt 0 0 final)
    Assert.True(Map.containsKey 0 final.Extra)

[<Fact>]
let ``CHIP9 white-dot cart can light all color planes`` () =
    let final = Cart.playback (CartFixtures.cart CartFixtures.chip9WhiteDot)

    Assert.Equal(7uy, final.Plane)
    Assert.True(Chip8Cow.pixel 0 0 final)
    Assert.Equal(7uy, Chip8Cow.colorAt 0 0 final)
