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
    // 081KTZ4EF0008QG0R002WVTMMJ edge-clip treaty ROM (sprite at 0x300 = a solid 8x8 block, FF x8). Exercises every
    // clip case Kira's review required: RIGHT edge, BOTTOM edge, CORNER, a COLOR-PLANE edge draw,
    // the VF COLLISION branch (so clip-vs-wrap is locked on the FLAG, not just the display), and
    // a DXY0 (n=0) draw-nothing. Wrap-origin / clip-pixels = COSMAC VIP reference.
    [| 0xA3uy; 0x00uy // I = 0x300 (solid 8x8 sprite)
       // RIGHT edge: solid block at (60,2) n=8 — cols 60-63 drawn, 64-67 CLIPPED (wrap -> 0-3)
       0x60uy; 0x3Cuy; 0x6Auy; 0x02uy; 0xD0uy; 0xA8uy
       // BOTTOM edge: block at (2,28) n=8 — rows 28-31 drawn, 32-35 CLIPPED
       0x60uy; 0x02uy; 0x6Auy; 0x1Cuy; 0xD0uy; 0xA8uy
       // CORNER: block at (60,28) n=8 — only the 60-63 x 28-31 quadrant survives
       0x60uy; 0x3Cuy; 0x6Auy; 0x1Cuy; 0xD0uy; 0xA8uy
       // VF COLLISION branch: draw at (0,12); then at (60,12) — clip => VF=0, wrap => collides at 0-3 => VF=1
       0x60uy; 0x00uy; 0x6Auy; 0x0Cuy; 0xD0uy; 0xA1uy
       0x60uy; 0x3Cuy; 0xD0uy; 0xA1uy
       0x6Cuy; 0x00uy; 0x6Duy; 0x18uy // marker coords (0,24)
       0x3Fuy; 0x01uy // SE VF,1 — skip the marker iff VF==1 (so marker present <=> clip, VF=0)
       0xDCuy; 0xD1uy // DRW marker (0,24) n=1
       // COLOR-PLANE edge: plane 6, block edge at (60,18) n=1 — hi-plane clip path
       0xF6uy; 0x01uy; 0x60uy; 0x3Cuy; 0x6Auy; 0x12uy; 0xD0uy; 0xA1uy
       // n=0: DXY0 draws nothing, VF=0 (pinned so a conformer can't drift toward SCHIP 16-row)
       0xF1uy; 0x01uy; 0xD0uy; 0xA0uy |]

let private finalFrame () =
    let f0 =
        Chip8Cow.create 7UL
        |> Chip8Cow.loadRom treatyRom
        |> fun f -> { f with Mem = [ for k in 0..7 -> 0x300 + k, 0xFFuy ] |> List.fold (fun m (k, v) -> Map.add k v m) f.Mem }
    [ 1..30 ] |> List.fold (fun f _ -> Chip8Cow.step f) f0

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
    // the fault-treaty keys follow the grid: the grid lock is the first 2 + 32 lines
    Assert.Equal<string list>(goldenLines () |> List.truncate (2 + Chip8.DisplayH), actual)

let private keyed (key: string) =
    goldenLines ()
    |> List.pick (fun l -> if l.StartsWith(key + "\t") then Some(l.Split('\t').[1]) else None)

[<Theory>]
[<InlineData("underflow")>]
[<InlineData("overflow")>]
let ``FAULT TREATY: the ORACLE locks text + pc + depth — recorded never fatal, refused CALL falls through`` (which: string) =
    let romHex = keyed (sprintf "fault-rom-%s" which)
    let rom = [| for i in 0 .. romHex.Length / 2 - 1 -> System.Convert.ToByte(romHex.Substring(i * 2, 2), 16) |]
    let steps = int (keyed (sprintf "fault-steps-%s" which))
    let final =
        [ 1..steps ]
        |> List.fold (fun f _ -> Chip8Cow.step f) (Chip8Cow.create 7UL |> Chip8Cow.loadRom rom)
    Assert.Equal(Some(keyed (sprintf "fault-text-%s" which)), final.Fault)
    Assert.Equal(keyed (sprintf "fault-pc-%s" which), sprintf "%04x" final.PC)
    Assert.Equal(int (keyed (sprintf "fault-depth-%s" which)), List.length final.Stack)

[<Fact>]
let ``the treaty ROM's semantics sanity-check (independent of the golden bytes)`` () =
    let f = finalFrame ()
    Assert.Equal(1uy, f.Plane) // last selected mask (the n=0 tail runs on plane 1)
    // RIGHT-edge clip: col 63 drawn, col 0 NOT wrapped onto (the whole point)
    Assert.Equal(1uy, Chip8Cow.colorAt 63 2 f)
    Assert.Equal(0uy, Chip8Cow.colorAt 0 2 f)
    // the VF-collision marker at (0,24): present <=> the edge draw did NOT collide (clip, VF=0)
    Assert.Equal(1uy, Chip8Cow.colorAt 0 24 f)
    // BOTTOM-edge clip: row 31 drawn (rows 32-35 clipped, off-grid)
    Assert.Equal(1uy, Chip8Cow.colorAt 2 31 f)
    // COLOR-PLANE edge clip: hi-plane bit at col 63, nothing wrapped to col 0
    Assert.Equal(6uy, Chip8Cow.colorAt 63 18 f &&& 6uy)
    Assert.Equal(0uy, Chip8Cow.colorAt 0 18 f)
    // the machine took no fault running the ROM
    Assert.Equal<string option>(None, f.Fault)
