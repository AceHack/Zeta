module Zeta.Tests.Chip8QuoteTests

// Playable quotes for CHIP-8 (the soft Tenmile): savestate + membrane-log recording + COMPUTED touched
// mask. The MASK THEOREM is the heart: replaying the quote over the MASKED rom reproduces the full-rom
// trajectory exactly — untouched bytes provably don't matter (Tenmile's ~6% as a theorem here).

open global.Xunit
open Zeta.Core

// A ROM with a DEAD TAIL: the live part loops drawing; 64 bytes of never-executed data follow.
// live: A3 00 (I=0x310... use 0x20A region) — keep simple:
//   0x200: A2 08  I := 0x208 (the sprite INSIDE the rom)
//   0x202: D0 01  draw 1 row
//   0x204: 12 00  jump 0x200
//   0x206: 00 00  (pad)
//   0x208: FF     (the sprite — touched via I)
//   0x209..: dead bytes (never read)
let private rom =
    [| 0xA2uy; 0x08uy; 0xD0uy; 0x01uy; 0x12uy; 0x00uy; 0x00uy; 0x00uy; 0xFFuy
       yield! Array.init 64 (fun i -> byte (i + 1)) |]

let private start () = Chip8Cow.create 7UL |> Chip8Cow.loadRom rom

let private keys: RecordedSource.Recording =
    { Crossings = Map.ofList [ 1, [ OperatorMessageArrived(SoftChip8Flux.encodeKey 0xA true) ] ] }

[<Fact>]
let ``MASK THEOREM: the masked rom replays the quote to the IDENTICAL final frame`` () =
    let q = Chip8Quote.quote 4 (start ()) keys 6
    let full = Chip8Quote.playback 4 (start ()) keys 6
    let masked = Chip8Quote.playback 4 (Chip8Quote.mask q) keys 6
    Assert.Equal<Chip8Cow.Frame>({ full with Mem = Map.empty }, { masked with Mem = Map.empty }) // same machine state
    Assert.Equal<Map<int,bool>>(full.Display, masked.Display) // same picture
    Assert.Equal(full.V.[0xF], masked.V.[0xF])

[<Fact>]
let ``the dead tail is dropped: kept fraction is small and exact (the Tenmile number, measured)`` () =
    let q = Chip8Quote.quote 4 (start ()) keys 6
    // live bytes: 6 program bytes (0x200-0x205) + 2 pad?? only PC-window reads + sprite @0x208
    Assert.True(Chip8Quote.keptFraction q < 0.2) // the 64-byte dead tail is gone
    let m = Chip8Quote.mask q
    Assert.False(Map.containsKey 0x230 m.Mem) // deep in the dead tail: zeroed (absent)
    Assert.True(Map.containsKey 0x208 m.Mem) // the sprite read via I: kept

[<Fact>]
let ``reserved machine memory (font, choice cell) always survives the mask`` () =
    let f0 = start () |> Chip8Arcade.commitChoice 1
    let q = Chip8Quote.quote 4 f0 keys 3
    let m = Chip8Quote.mask q
    Assert.True(Map.containsKey Chip8.FontBase m.Mem) // font kept
    Assert.True(Map.containsKey Chip8Arcade.choiceCell m.Mem) // the machine's own cells kept

[<Fact>]
let ``DST: a quote replays byte-identically (same savestate + recording => same frame)`` () =
    let a = Chip8Quote.playback 4 (start ()) keys 5
    let b = Chip8Quote.playback 4 (start ()) keys 5
    Assert.Equal<Chip8Cow.Frame>(a, b)

[<Fact>]
let ``TAKE THE CONTROLS: the recording plays to the seam, then the live source owns the timeline`` () =
    let q = Chip8Quote.quote 4 (start ()) keys 3
    let live: SoftScheduler.Source =
        fun t -> if t = 0 then [ OperatorMessageArrived(SoftChip8Flux.encodeKey 0x5 true) ] else []
    let src = Chip8Quote.takeControls q live
    // inside the quote: the recorded key at tick 1
    Assert.Equal<InterruptKind list>([ OperatorMessageArrived "key:10:1" ], src 1)
    Assert.Equal<InterruptKind list>([], src 2)
    // past the seam: the live player's first tick arrives at quote length
    Assert.Equal<InterruptKind list>([ OperatorMessageArrived "key:5:1" ], src 3)
