module Zeta.Tests.MemoryLensTests

open global.Xunit
open Zeta.Core

let private none = SoftController.none
let private key0 = SoftController.singleKey 0
let private actions = [ none; key0 ]
let private mk rom = Chip8Cow.create 1UL |> Chip8Cow.loadRom rom

// counter: V0 += k regardless of button -> Autonomous (the nuisance)
let private counter = [| 0x70uy; 0x01uy; 0x12uy; 0x00uy |]

// input-sensitive: 6000 (V0=0); E09E skip-if-key0-down; 6005 (V0=5, skipped iff key0 down); 1206 loop
// -> V0 ends 0 if key0 held, 5 if not -> the button changes V0 -> Controllable
let private inputRom = [| 0x60uy; 0x00uy; 0xE0uy; 0x9Euy; 0x60uy; 0x05uy; 0x12uy; 0x06uy |]

[<Fact>]
let ``counter's V0 is Autonomous (button does not move it) -> dropped by the lens`` () =
    let classes = MemoryLens.classify 8 actions [ mk counter ]
    Assert.Equal(MemoryLens.Autonomous, classes.["V0"])
    Assert.DoesNotContain("V0", MemoryLens.controllable classes)

[<Fact>]
let ``input-sensitive V0 is Controllable (the button moves it) -> kept in the lens`` () =
    let classes = MemoryLens.classify 8 actions [ mk inputRom ]
    Assert.Equal(MemoryLens.Controllable, classes.["V0"])
    Assert.Contains("V0", MemoryLens.controllable classes)

[<Fact>]
let ``lensKey reduces the world state to controllable cells (finite where full state is infinite)`` () =
    // counter: nothing controllable -> lens falls back to PC, dropping the unbounded V0 -> finite key
    let classes = MemoryLens.classify 8 actions [ mk counter ]
    let f = mk counter |> Chip8Cow.run 30
    let key = MemoryLens.lensKey classes f
    Assert.DoesNotContain("V0", key |> List.map fst) // the infinite counter is lensed out

[<Fact>]
let ``a cell that never changes is Constant`` () =
    let classes = MemoryLens.classify 8 actions [ mk counter ]
    Assert.Equal(MemoryLens.Constant, classes.["Sound"]) // sound timer never touched here
