module Zeta.Tests.OttoAvatarTests

// otto's avatar (rooms/otto/avatar.lines): parsed from its meta-tag file, drawn on CHIP-9 planes
// (cyan body, red-over-cyan heart => WHITE via XOR), rendered through ZetaMax, animated (idle/blink).

open System.IO
open global.Xunit
open Zeta.Core

let private repoRoot () =
    let mutable dir = DirectoryInfo(System.AppContext.BaseDirectory)
    while not (isNull dir) && not (File.Exists(Path.Combine(dir.FullName, "Zeta.sln"))) do
        dir <- dir.Parent
    dir.FullName

let private avatarLines () =
    File.ReadAllLines(Path.Combine(repoRoot (), "rooms", "otto", "avatar.lines"))
    |> Array.filter (fun l -> not (l.StartsWith "#") && l.Trim().Length > 0)

let private field (kind: string) (name: string) =
    avatarLines ()
    |> Array.pick (fun l ->
        match l.Split('\t') with
        | [| k; n; v |] when k = kind && n = name -> Some v
        | _ -> None)

let private hexBytes (s: string) =
    [| for i in 0 .. 2 .. s.Length - 2 -> System.Convert.ToByte(s.Substring(i, 2), 16) |]

/// Draw an 8x8 sprite at (0,0) on the given plane mask via real CHIP-9 opcodes (Fn01 + DRW).
let private draw (planeMask: int) (sprite: byte[]) (f: Chip8Cow.Frame) =
    let rom =
        [| byte (0xF0 ||| planeMask); 0x01uy // Fn01: select planes
           0xA3uy; 0x00uy // I := 0x300
           0xD0uy; byte sprite.Length |] // DRW 0,0,N
    let f2 =
        { f with
            Mem =
                sprite
                |> Array.indexed
                |> Array.fold (fun m (i, b) -> Map.add (0x300 + i) b m) f.Mem
            PC = uint16 Chip8.ProgramStart }
    let f3 =
        rom
        |> Array.indexed
        |> Array.fold (fun (m: Chip8Cow.Frame) (i, b) -> { m with Mem = Map.add (Chip8.ProgramStart + i) b m.Mem }) f2
    [ 1..3 ] |> List.fold (fun acc _ -> Chip8Cow.step acc) f3

let private composite frameName =
    let body = hexBytes (field "frame" frameName)
    let heart = hexBytes (field "sprite" "heart")
    Chip8Cow.create 7UL |> draw 6 body |> draw 1 heart

[<Fact>]
let ``the avatar file parses: name, planes, two frames, the heart, the breathe animation`` () =
    Assert.Equal("otto-shadow-otter", field "meta" "name")
    Assert.Equal("6", field "meta" "body-plane")
    Assert.Equal(8, (hexBytes (field "frame" "idle")).Length)
    Assert.Equal(8, (hexBytes (field "frame" "blink")).Length)
    Assert.Equal("idle,idle,idle,blink", field "anim" "breathe")

[<Fact>]
let ``the body is CYAN and the heart is WHITE — the red plane meeting the shadow (XOR symbolism)`` () =
    let f = composite "idle"
    Assert.Equal(6uy, Chip8Cow.colorAt 0 2 f) // body edge: cyan (G+B)
    Assert.Equal(7uy, Chip8Cow.colorAt 3 1 f) // heart pixel (row 1, bits 3-4): white = red XOR cyan
    Assert.Equal(7uy, Chip8Cow.colorAt 4 2 f)
    Assert.Equal(ZetaMax.Indexed8, ZetaMax.capabilityOf f) // a color citizen

[<Fact>]
let ``the animation breathes: idle and blink differ exactly at the eyes and feet`` () =
    let idle = composite "idle"
    let blink = composite "blink"
    Assert.NotEqual<Map<int, byte>>(idle.Extra, blink.Extra)
    Assert.Equal(0uy, Chip8Cow.colorAt 2 2 idle) // open eye: a hole in the body row
    Assert.Equal(6uy, Chip8Cow.colorAt 2 2 blink) // blink: the eye row fills cyan

[<Fact>]
let ``the avatar renders deterministically through ZetaMax (same frame, same bytes)`` () =
    let f = composite "idle"
    Assert.Equal<string list>(ZetaMax.render f, ZetaMax.render f)
    Assert.True(ZetaMax.render f |> List.head |> fun l -> l.Contains "[36m" || l.Contains "[37m")
