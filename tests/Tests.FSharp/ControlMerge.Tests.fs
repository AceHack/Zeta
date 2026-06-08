module Zeta.Tests.ControlMergeTests

open global.Xunit
open Zeta.Core

let private none = SoftController.none
let private key0 = SoftController.singleKey 0
let private actions = [ none; key0 ]

// 6000 (V0=0); E09E skip-if-key0-down; 6005 (V0=5); 1206 loop
//   key0 held -> skip the V0=5 -> V0 stays 0 (SAFE under V0<3)
//   none       -> V0=5 (UNSAFE under V0<3)
let private inputRom = [| 0x60uy; 0x00uy; 0xE0uy; 0x9Euy; 0x60uy; 0x05uy; 0x12uy; 0x06uy |]
let private f0 () = Chip8Cow.create 1UL |> Chip8Cow.loadRom inputRom
let private alive (f: Chip8Cow.Frame) = int f.V.[0] < 3

[<Fact>]
let ``safeActions applies the survival veto (only the alive-preserving action)`` () =
    let safe = ControlMerge.safeActions alive 8 actions (f0 ())
    Assert.Equal<bool[] list>([ key0 ], safe) // none -> V0=5 dies; key0 -> V0=0 safe

[<Fact>]
let ``survival has FINAL SAY: a loop preferring a lethal action is overridden`` () =
    // the optimization loop strongly prefers `none` (score 10) over key0 (score 1) — but `none` is lethal
    let greedy: ControlMerge.Loop = fun _ -> [ none, 10.0; key0, 1.0 ]
    let chosen = ControlMerge.decide alive 8 actions [ greedy ] (f0 ())
    Assert.Equal(Some key0, chosen) // survival vetoes `none` despite its higher score

[<Fact>]
let ``with no survival pressure, the joined score wins (CRDT sum of loops)`` () =
    let permissive (_: Chip8Cow.Frame) = true // nothing is lethal
    let a: ControlMerge.Loop = fun _ -> [ none, 3.0; key0, 1.0 ]
    let b: ControlMerge.Loop = fun _ -> [ none, 0.0; key0, 5.0 ] // none=3, key0=6 after join
    let chosen = ControlMerge.decide permissive 8 actions [ a; b ] (f0 ())
    Assert.Equal(Some key0, chosen) // 1+5 > 3+0

[<Fact>]
let ``no safe action -> None (the heartbeat fails)`` () =
    let doomed (_: Chip8Cow.Frame) = false // nothing is ever safe
    let chosen = ControlMerge.decide doomed 8 actions [ (fun _ -> [ none, 1.0 ]) ] (f0 ())
    Assert.Equal(None, chosen)

[<Fact>]
let ``lexicographic decide respects strict loop priority within the safe set`` () =
    let permissive (_: Chip8Cow.Frame) = true
    let primary: ControlMerge.Loop = fun _ -> [ none, 1.0; key0, 1.0 ] // tie
    let tiebreak: ControlMerge.Loop = fun _ -> [ none, 0.0; key0, 9.0 ] // key0 wins the tiebreak
    let chosen = ControlMerge.decideLexicographic permissive 8 actions [ primary; tiebreak ] (f0 ())
    Assert.Equal(Some key0, chosen)
