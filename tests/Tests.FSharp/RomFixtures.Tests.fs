module Zeta.Tests.RomFixturesTests

open System
open System.IO
open System.Security.Cryptography
open global.Xunit
open Zeta.Core

// Walk up from the test assembly to the repo root (the dir containing roms/chip8).
let private repoRoot () =
    let rec up (d: DirectoryInfo) =
        if isNull (box d) then failwith "repo root (roms/chip8) not found"
        elif Directory.Exists(Path.Combine(d.FullName, "roms", "chip8")) then d.FullName
        else up d.Parent
    up (DirectoryInfo(AppContext.BaseDirectory))

let private romPath name = Path.Combine(repoRoot (), "roms", "chip8", name)
let private sha256Hex (bytes: byte[]) =
    use h = SHA256.Create()
    h.ComputeHash bytes |> Array.map (fun b -> b.ToString("x2")) |> String.concat ""

[<Fact>]
let ``committed ROM fixtures exist and their bytes match the manifest sha256 (tamper-evident)`` () =
    let expected =
        [ "zeta-arith.ch8", "0f372e55432c6101b6f326d9224f0491e44df6bb9330c783393ccc2288d677be"
          "zeta-selfloop.ch8", "08da7c45cb204377e7e42249cda5713fa865116ddbb4cb5a1949b2e5b438a6ab"
          "zeta-draw-h.ch8", "0d792e6a2513a5dee719732c83274597d33e3ddfb3ada3ec1a54443aaa107d4c"
          "mikolay-delay-timer-test.ch8", "0983138a1ac1f7ec16ccb935c9e9ebfe6fb0abbd89a4938a8c8c743df555f4f6"
          "mikolay-random-number-test.ch8", "58ad441bd9acd280e8be79d6528ddc5b5cfc41874a28a458ec2299ef853e395d" ]
    for name, sha in expected do
        let p = romPath name
        Assert.True(File.Exists p, $"missing fixture: {name}")
        Assert.Equal(sha, sha256Hex (File.ReadAllBytes p))

[<Fact>]
let ``zeta-arith fixture loads and runs to the same result as the inline bytes (real ROM round-trip)`` () =
    let rom = File.ReadAllBytes(romPath "zeta-arith.ch8")
    let f = Chip8Cow.create 7UL |> Chip8Cow.loadRom rom |> Chip8Cow.run 4
    // 6A05 7A03 6002 8A04: VA = 5+3 = 8, then VA += V0(2) = 10
    Assert.Equal(10uy, f.V.[0xA])

[<Fact>]
let ``zeta-draw-h fixture actually draws pixels (a visible game-like fixture)`` () =
    let rom = File.ReadAllBytes(romPath "zeta-draw-h.ch8")
    let f = Chip8Cow.create 1UL |> Chip8Cow.loadRom rom |> Chip8Cow.run 4
    let lit = [ for y in 0 .. Chip8.DisplayH - 1 do for x in 0 .. Chip8.DisplayW - 1 do if Chip8Cow.pixel x y f then 1 ]
    Assert.True(List.length lit > 0)

[<Fact>]
let ``Mikolay ROMs load and step without crashing`` () =
    for name in [ "mikolay-delay-timer-test.ch8"; "mikolay-random-number-test.ch8" ] do
        let rom = File.ReadAllBytes(romPath name)
        let f = Chip8Cow.create 1UL |> Chip8Cow.loadRom rom |> Chip8Cow.run 20
        Assert.True(int f.PC >= 0x200) // ran, PC in program space
