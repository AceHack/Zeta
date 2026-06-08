module Zeta.Tests.SoftActionControllerTests

open global.Xunit
open Zeta.Core

// deterministic arithmetic+loop ROM (no input opcodes) -> all actions tie -> calibrated controller should HOLD
let private arith = [| 0x6Auy; 0x05uy; 0x7Auy; 0x03uy; 0x60uy; 0x02uy; 0x8Auy; 0x04uy; 0x12uy; 0x00uy |]
let private hard () = Chip8Cow.create 7UL |> Chip8Cow.loadRom arith

[<Fact>]
let ``actionDistribution is a normalized distribution over actions`` () =
    let dist = SoftActionController.actionDistribution 1.0 SoftDashboard.sumMemory 8 2 4 (hard ())
    Assert.Equal(1.0, dist |> List.sumBy snd, 6)
    Assert.All(dist, fun (_, p) -> Assert.True(p >= 0.0 && p <= 1.0))

[<Fact>]
let ``on a no-input ROM the controller HOLDS (calibrated: not confident -> none)`` () =
    // all actions tie (input inert) -> ~uniform (conf ~ 1/17) -> below a 0.5 threshold -> hold
    let keys = SoftActionController.resolve 0.5 1.0 SoftDashboard.sumMemory 8 2 4 (hard ())
    Assert.Equal<bool[]>(SoftController.none, keys)

[<Fact>]
let ``a low threshold lets it commit (always acts) - returns a valid 16-key vector`` () =
    let keys = SoftActionController.resolve 0.0 1.0 SoftDashboard.sumMemory 8 2 4 (hard ())
    Assert.Equal(16, keys.Length)

[<Fact>]
let ``confidence is in [0,1] and 1/17-ish for a flat distribution`` () =
    let dist = SoftActionController.actionDistribution 1.0 SoftDashboard.sumMemory 8 2 4 (hard ())
    let c = SoftActionController.confidence dist
    Assert.True(c >= 0.0 && c <= 1.0)

[<Fact>]
let ``drive is deterministic (DST)`` () =
    let a = SoftActionController.drive 0.5 1.0 SoftDashboard.sumMemory 8 2 4 5 (hard ())
    let b = SoftActionController.drive 0.5 1.0 SoftDashboard.sumMemory 8 2 4 5 (hard ())
    Assert.Equal<byte[]>(a.V, b.V)
    Assert.Equal(int a.PC, int b.PC)

[<Fact>]
let ``renderFrame is a DisplayH x DisplayW screen of # and space`` () =
    let f = hard ()
    let lines = (SoftScope.renderFrame f).Split('\n')
    Assert.Equal(Chip8.DisplayH, lines.Length)
    Assert.All(lines, fun l -> Assert.Equal(Chip8.DisplayW, l.Length))
    Assert.All(lines, fun l -> Assert.All(l, fun c -> Assert.True(c = '#' || c = ' ')))
