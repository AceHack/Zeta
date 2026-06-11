module Zeta.Tests.Chip9TreatyTests

// The CHIP-9 TREATY — the F# oracle byte-locks the color-plane semantics as a state-trajectory golden:
// a fixed ROM exercises Fn01 / per-plane DRW / selective CLS, and the FINAL COLOR GRID (32 rows × 64
// hex digits, colorAt masks 0..7) + the plane register lock byte-for-byte. C#/TS/Rust conform next
// (the four-oracle discipline; same golden file).

open System.IO
open global.Xunit
open Zeta.Core

let private repoRoot () =
    let mutable dir = DirectoryInfo(System.AppContext.BaseDirectory)
    while not (isNull dir) && not (File.Exists(Path.Combine(dir.FullName, "Zeta.sln"))) do
        dir <- dir.Parent
    dir.FullName

let private goldenPath =
    Path.Combine(repoRoot (), "src", "Core.TypeScript", "chip9", "golden-vectors.lines")

/// The treaty ROM (also locked in the golden header): sprite FF at 0x300;
/// red row at (0,0); green row at (4,2) [V0=4,V1=2]; white row at (8,4); then clear R+G (mask 3) —
/// leaving only the BLUE bits of the white row. Exercises select/draw/overlap/selective-clear.
let private treatyRom =
    [| 0xA3uy; 0x00uy // I = 0x300 (sprite)
       0xD0uy; 0x01uy // DRW @ (0,0) on plane 1 (default) — RED row
       0xF2uy; 0x01uy // plane := 2 (G)
       0x60uy; 0x04uy // V0 := 4
       0x61uy; 0x02uy // V1 := 2
       0xD0uy; 0x11uy // DRW @ (4,2) — GREEN row
       0xF7uy; 0x01uy // plane := 7 (RGB)
       0x60uy; 0x08uy // V0 := 8
       0x61uy; 0x04uy // V1 := 4
       0xD0uy; 0x11uy // DRW @ (8,4) — WHITE row
       0xF3uy; 0x01uy // plane := 3 (R+G)
       0x00uy; 0xE0uy |] // CLS — red+green cleared everywhere; blue remains of the white row

let private finalFrame () =
    let f0 =
        Chip8Cow.create 7UL
        |> Chip8Cow.loadRom treatyRom
        |> fun f -> { f with Mem = Map.add 0x300 0xFFuy f.Mem }
    [ 1..12 ] |> List.fold (fun f _ -> Chip8Cow.step f) f0

/// The canonical text form: rom hex line, plane line, then 32 rows of 64 hex color digits.
let private render (f: Chip8Cow.Frame) : string list =
    [ yield "rom\t" + (treatyRom |> Array.map (sprintf "%02x") |> String.concat "")
      yield sprintf "plane\t%d" f.Plane
      for y in 0 .. Chip8.DisplayH - 1 do
          yield
              [| for x in 0 .. Chip8.DisplayW - 1 -> sprintf "%x" (Chip8Cow.colorAt x y f) |]
              |> String.concat "" ]

let private goldenLines () =
    File.ReadAllLines goldenPath
    |> Array.filter (fun l -> not (l.StartsWith "#") && l.Length > 0)
    |> Array.toList

[<Fact>]
let ``BYTE-LOCK: the CHIP-9 treaty ROM's final color grid matches the golden vectors exactly`` () =
    let actual = render (finalFrame ())
    if not (File.Exists goldenPath) then
        File.WriteAllLines("/tmp/chip9-golden-actual.lines", actual)
        failwith "golden file missing — actual dumped to /tmp/chip9-golden-actual.lines"
    Assert.Equal<string list>(goldenLines (), actual)

[<Fact>]
let ``the treaty ROM's semantics sanity-check (independent of the golden bytes)`` () =
    let f = finalFrame ()
    Assert.Equal(3uy, f.Plane) // last selected mask
    Assert.Equal(0uy, Chip8Cow.colorAt 0 0 f) // red row: cleared by the R+G CLS
    Assert.Equal(0uy, Chip8Cow.colorAt 4 2 f) // green row: cleared
    Assert.Equal(4uy, Chip8Cow.colorAt 8 4 f) // white row: only BLUE survives
    Assert.Equal(4uy, Chip8Cow.colorAt 15 4 f) // ...across all 8 sprite pixels
