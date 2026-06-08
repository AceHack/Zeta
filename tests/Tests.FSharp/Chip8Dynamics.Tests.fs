module Zeta.Tests.Chip8DynamicsTests

open global.Xunit
open Zeta.Core

let private arith = [| 0x6Auy; 0x05uy; 0x7Auy; 0x03uy; 0x60uy; 0x02uy; 0x8Auy; 0x04uy |]
let private f0 () = Chip8Cow.create 1UL |> Chip8Cow.loadRom arith

[<Fact>]
let ``dynamics monoid: identity is the no-op transition`` () =
    let m = Chip8Cow.dynamics
    let f = f0 ()
    Assert.Equal<byte[]>(f.V, (m.Identity f).V)
    Assert.Equal(int f.PC, int (m.Identity f).PC)

[<Fact>]
let ``dynamics monoid: combine step step = run 2 (composition is time-evolution)`` () =
    let m = Chip8Cow.dynamics
    let twoStep = m.Combine(Chip8Cow.step, Chip8Cow.step)
    let viaMonoid = twoStep (f0 ())
    let viaRun = Chip8Cow.run 2 (f0 ())
    Assert.Equal<byte[]>(viaRun.V, viaMonoid.V)
    Assert.Equal(int viaRun.PC, int viaMonoid.PC)

[<Fact>]
let ``dynamics monoid: associative (combine assoc) = run 3`` () =
    let m = Chip8Cow.dynamics
    let s = Chip8Cow.step
    let left = m.Combine(m.Combine(s, s), s)
    let right = m.Combine(s, m.Combine(s, s))
    Assert.Equal<byte[]>((left (f0 ())).V, (right (f0 ())).V)
    Assert.Equal<byte[]>((Chip8Cow.run 3 (f0 ())).V, (left (f0 ())).V)
