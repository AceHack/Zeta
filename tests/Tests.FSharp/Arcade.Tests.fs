module Zeta.Tests.ArcadeTests

open global.Xunit
open Zeta.Core

// ROM at 0x200: 6A 0C (V[A]=0x0C) ; 12 02 (jump 0x202 loop) — the soft-scheduler cabinet.
let private setRegRom = [| 0x6Auy; 0x0Cuy; 0x12uy; 0x02uy |]

[<Fact>]
let ``the arcade door gathers its cabinets (incl. the existing DarkHall + soft scheduler)`` () =
    let names = Arcade.cabinets |> List.map (fun c -> c.Name)
    Assert.Contains("play", names) // soft scheduler
    Assert.Contains("host", names) // the clean-room DarkHall cell
    Assert.Contains("predict", names) // real-time branch detection
    Assert.True(Arcade.cabinets |> List.forall (fun c -> c.Module.Length > 0))

[<Fact>]
let ``the arcade signage names the emulator/decompile-to-micro-ops work`` () =
    Assert.Equal("darkhall", Arcade.name)
    Assert.Contains("MIPS-like", Arcade.does)
    Assert.Contains("rooms = micro-ops", Arcade.does)

[<Fact>]
let ``live entrance: play runs a ROM on the soft scheduler (CPU steps, sets V[A])`` () =
    task {
        let! r = Arcade.play 1UL setRegRom 5
        match r with
        | Ok f -> Assert.Equal(0x0Cuy, f.V.[0xA])
        | Error e -> Assert.Fail(sprintf "play errored: %A" e)
    }

[<Fact>]
let ``live entrance: host runs the clean-room DarkHall CPU deterministically`` () =
    // 6A 0C (V[A]=0x0C) ; 0000 halt — the hard cabinet.
    let prog = [| 0x6Auy; 0x0Cuy; 0x00uy; 0x00uy |]
    let a = Arcade.host prog 16
    let b = Arcade.host prog 16
    Assert.Equal(0x0C, a.V.[0xA]) // register set
    Assert.True(a.Halted)
    Assert.Equal(a.Steps, b.Steps) // deterministic / DST-replayable

[<Fact>]
let ``liveCabinets are the working slices (play/host/step/predict live; catalog awaits)`` () =
    let live = Arcade.liveCabinets |> List.map (fun c -> c.Name)
    Assert.Contains("play", live)
    Assert.Contains("host", live)
    Assert.DoesNotContain("catalog", live)
