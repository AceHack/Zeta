module Zeta.Tests.MediaLinesTests

// MediaLines: our own media container — typed text sections, quote-based, generators-on-top for
// compression, and the EXPANSION LAW (unknown kinds carried, never errors). Plus Amara's card loaded
// CHIP-9-native: the roster's second portrait, her light XORing to white over the cyan.

open System.IO
open global.Xunit
open Zeta.Core

let private repoRoot () =
    let mutable dir = DirectoryInfo(System.AppContext.BaseDirectory)
    while not (isNull dir) && not (File.Exists(Path.Combine(dir.FullName, "Zeta.sln"))) do
        dir <- dir.Parent
    dir.FullName

[<Fact>]
let ``round-trip: parse then serialize is identity on the entries (text is the storage)`` () =
    let text = "meta\tname\tx\nframe\tidle\tdeadbeef\nanim\tgo\tidle,idle"
    match MediaLines.parse text with
    | Ok d -> Assert.Equal(text, MediaLines.serialize d)
    | Error e -> failwith e

[<Fact>]
let ``THE EXPANSION LAW: unknown kinds are carried byte-faithfully, never errors`` () =
    let future = "meta\tname\tx\nholo3d\tbust\tv2:zstd:base85:....\naudio-env\thum\tA440:adsr:1,2,3,4"
    match MediaLines.parse future with
    | Ok d ->
        Assert.Equal(2, List.length (MediaLines.carried d)) // the future rides along
        Assert.Equal(future, MediaLines.serialize d) // and survives transit byte-faithfully
    | Error e -> failwith e

[<Fact>]
let ``malformed lines are refused honestly with their line number`` () =
    match MediaLines.parse "meta\tname\tx\njustonefield" with
    | Error e -> Assert.Contains("line 2", e)
    | Ok _ -> failwith "should refuse"

[<Fact>]
let ``generators-on-top: a gen section is a KNOWN kind (regenerate, don't store the expansion)`` () =
    Assert.True(Set.contains "gen" MediaLines.knownKinds)

[<Fact>]
let ``AMARA'S CARD loads CHIP-9-native: portrait + light + five glyphs + the motto verbatim`` () =
    let text = File.ReadAllText(Path.Combine(repoRoot (), "rooms", "amara", "avatar.lines"))
    match MediaLines.parse text with
    | Error e -> failwith e
    | Ok d ->
        Assert.Equal(Some "WE ARE THE LIGHTED BOUNDARY THAT LETS GOOD WORK FLOW.", MediaLines.field "meta" "motto" d)
        Assert.Equal(5, List.length (MediaLines.ofKind "glyph" d)) // the halo's five values
        Assert.Equal(12, (MediaLines.field "frame" "portrait" d |> Option.get |> MediaLines.hexBytes).Length)
        Assert.Equal<MediaLines.Entry list>([], MediaLines.carried d) // today's card: all known kinds

[<Fact>]
let ``her light crosses to WHITE over the cyan — drawn by real CHIP-9 opcodes, like otto's heart`` () =
    let text = File.ReadAllText(Path.Combine(repoRoot (), "rooms", "amara", "avatar.lines"))
    let d = match MediaLines.parse text with | Ok d -> d | Error e -> failwith e
    let body = MediaLines.field "frame" "portrait" d |> Option.get |> MediaLines.hexBytes
    let light = MediaLines.field "sprite" "light" d |> Option.get |> MediaLines.hexBytes

    // draw via opcodes: plane 6 portrait at (0,0), then plane 1 light at (0,0)
    let put (addr: int) (bytes: byte[]) (f: Chip8Cow.Frame) =
        bytes |> Array.indexed |> Array.fold (fun (m: Chip8Cow.Frame) (i, b) -> { m with Mem = Map.add (addr + i) b m.Mem }) f
    let rom =
        [| 0xF6uy; 0x01uy; 0xA3uy; 0x00uy; 0xD0uy; 0x0Cuy // plane 6; I=0x300; draw 12 rows
           0xF1uy; 0x01uy; 0xA3uy; 0x20uy; 0xD0uy; 0x0Cuy |] // plane 1; I=0x320; draw 12 rows
    let f =
        Chip8Cow.create 7UL
        |> put 0x300 body |> put 0x320 light
        |> fun f0 -> rom |> Array.indexed |> Array.fold (fun (m: Chip8Cow.Frame) (i, b) -> { m with Mem = Map.add (0x200 + i) b m.Mem }) f0
        |> fun f0 -> List.fold (fun acc _ -> Chip8Cow.step acc) f0 [ 1..6 ]

    Assert.Equal(7uy, Chip8Cow.colorAt 3 2 f) // the brow light: white (red XOR cyan)
    Assert.Equal(7uy, Chip8Cow.colorAt 3 9 f) // the heart cross: white
    Assert.Equal(6uy, Chip8Cow.colorAt 2 0 f) // the hair: cyan
    Assert.Equal(ZetaMax.Indexed8, ZetaMax.capabilityOf f) // a color citizen, like the rest of us
