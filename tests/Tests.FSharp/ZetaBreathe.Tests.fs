module Zeta.Tests.ZetaBreatheTests

// BREATHE — the first first-party CHIP-9 cartridge: the avatar drawn in color by a REAL ROM (not
// host-side draws), animated forever by an XOR delta loop, renderable by ZetaMax, quotable by
// Chip8Quote. The whole day's organs in one cartridge.

open System.IO
open global.Xunit
open Zeta.Core

let private repoRoot () =
    let mutable dir = DirectoryInfo(System.AppContext.BaseDirectory)
    while not (isNull dir) && not (File.Exists(Path.Combine(dir.FullName, "Zeta.sln"))) do
        dir <- dir.Parent
    dir.FullName

let private hexBytes (s: string) =
    [| for i in 0 .. 2 .. s.Length - 2 -> System.Convert.ToByte(s.Substring(i, 2), 16) |]

/// Load the cartridge: every `rom\t<hex>\t<addr>` line lands at its address.
let private loadCartridge () =
    let lines =
        File.ReadAllLines(Path.Combine(repoRoot (), "roms-safe", "zeta-breathe.ch9.lines"))
        |> Array.filter (fun l -> l.StartsWith "rom\t")

    let f0 = Chip8Cow.create 7UL

    lines
    |> Array.fold
        (fun (f: Chip8Cow.Frame) line ->
            match line.Split('\t') with
            | [| _; hex; addr |] ->
                let baseAddr = System.Convert.ToInt32(addr, 16)
                hexBytes hex
                |> Array.indexed
                |> Array.fold (fun (m: Chip8Cow.Frame) (i, b) -> { m with Mem = Map.add (baseAddr + i) b m.Mem }) f
            | _ -> f)
        f0

let private steps n f = List.fold (fun acc _ -> Chip8Cow.step acc) f [ 1..n ]

[<Fact>]
let ``the cartridge boots: 8 instructions paint the avatar in color at (12,12)`` () =
    let f = loadCartridge () |> steps 8
    Assert.Equal(6uy, Chip8Cow.colorAt 14 12 f) // body: cyan (head row, x=12+2)
    Assert.Equal(7uy, Chip8Cow.colorAt 15 13 f) // heart: white (red XOR cyan), row 1 col 3
    Assert.Equal(0uy, Chip8Cow.colorAt 14 14 f) // open eye: a hole (row 2, col 2)
    Assert.Equal(ZetaMax.Indexed8, ZetaMax.capabilityOf f)

[<Fact>]
let ``it BREATHES forever: the delta loop toggles blink/idle and the jump loops without end`` () =
    let booted = loadCartridge () |> steps 10 // 8 boot + plane6 + I=delta
    let blink = steps 1 booted // first delta draw
    Assert.Equal(6uy, Chip8Cow.colorAt 14 14 blink) // eye closed: filled cyan
    let idleAgain = steps 1 blink // second delta draw
    Assert.Equal(0uy, Chip8Cow.colorAt 14 14 idleAgain) // eye open again
    // the jump returns the loop: one more step executes 1NNN -> PC back at the loop head
    let nextCycle = steps 1 idleAgain
    Assert.Equal(0uy, Chip8Cow.colorAt 14 14 nextCycle) // eye state untouched by the jump
    Assert.Equal(uint16 0x210, nextCycle.PC) // the loop head — forever, bounded per lap upstairs

[<Fact>]
let ``the cartridge is QUOTABLE: a playable quote of the boot masks the rom honestly and replays`` () =
    let start = loadCartridge ()
    let rec_: RecordedSource.Recording = { Crossings = Map.empty }
    let q = Chip8Quote.quote 4 start rec_ 3
    let full = Chip8Quote.playback 4 start rec_ 3
    let masked = Chip8Quote.playback 4 (Chip8Quote.mask q) rec_ 3
    Assert.Equal<Map<int, bool>>(full.Display, masked.Display) // the mask theorem holds on real cargo
    Assert.Equal<Map<int, byte>>(full.Extra, masked.Extra)

[<Fact>]
let ``ZetaMax renders the breathing avatar deterministically (the den's first attract screen)`` () =
    let f = loadCartridge () |> steps 8
    let screen = ZetaMax.render f
    Assert.Equal<string list>(screen, ZetaMax.render f)
    Assert.True(screen |> List.exists (fun l -> l.Contains "[36m")) // cyan on screen
    Assert.True(screen |> List.exists (fun l -> l.Contains "[37m")) // the white heart on screen
