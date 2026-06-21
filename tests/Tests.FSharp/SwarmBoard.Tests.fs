module Zeta.Tests.SwarmBoardTests

// 081KTSZN10008QG0R0003SDRWD slice 1 acceptance: a text board renders the friction map; two citizens (one human-driven,
// one CHIP-8 room) join and exchange presence over the deterministic membrane — REPLAYABLE (DST:
// live-run == replay-run, the RecordedSource discipline).

open System.Threading.Tasks
open global.Xunit
open Zeta.Core

let private map =
    [ "dev-room", [ "n", "forge"; "e", "salon"; "self", "dev-room" ]
      "forge", [ "s", "dev-room" ]
      "salon", [ "w", "dev-room" ] ]

[<Fact>]
let ``join + heat + go:hottest — the citizen walks to where help is needed`` () =
    let b =
        SwarmBoard.create map
        |> SwarmBoard.apply "join:aaron:dev-room"
        |> SwarmBoard.apply "heat:forge:900"
        |> SwarmBoard.apply "heat:salon:120"
        |> SwarmBoard.apply "go:aaron:hottest"
    Assert.Equal(Some "forge", Map.tryFind "aaron" b.Presence)

[<Fact>]
let ``compass navigation uses the current room's exits; bad exits are refused honestly`` () =
    let b = SwarmBoard.create map |> SwarmBoard.apply "join:max:dev-room"
    let b1 = SwarmBoard.apply "go:max:n" b
    Assert.Equal(Some "forge", Map.tryFind "max" b1.Presence)
    let b2 = SwarmBoard.apply "go:max:w" b1 // no such exit from forge
    Assert.Equal(Some "forge", Map.tryFind "max" b2.Presence)

[<Fact>]
let ``the self door works at the board too (shape A)`` () =
    let b = SwarmBoard.create map |> SwarmBoard.apply "join:otto:dev-room" |> SwarmBoard.apply "go:otto:self"
    Assert.Equal(Some "dev-room", Map.tryFind "otto" b.Presence)

[<Fact>]
let ``the narrator speaks the charter voice — location, heat, exits, company`` () =
    let b =
        SwarmBoard.create map
        |> SwarmBoard.apply "join:aaron:dev-room"
        |> SwarmBoard.apply "join:max:dev-room"
        |> SwarmBoard.apply "heat:forge:900"
    let line = SwarmBoard.narrate "aaron" b
    Assert.Equal("You are in dev-room. Running hot: forge (0.900). Exits: e, n, self. Also here: max.", line)
    Assert.Equal("otto is not at the table. (join:<who>:<room> to sit down.)", SwarmBoard.narrate "otto" b)

[<Fact>]
let ``part removes presence; unknown rooms and malformed traffic pass by unchanged`` () =
    let b0 = SwarmBoard.create map |> SwarmBoard.apply "join:max:dev-room"
    Assert.True(SwarmBoard.apply "part:max" b0 |> fun b -> Map.isEmpty b.Presence)
    Assert.Equal(b0, SwarmBoard.apply "join:max:atlantis" b0 |> SwarmBoard.apply "noise" |> SwarmBoard.apply "heat:forge:-5")

[<Fact>]
let ``ACCEPTANCE: two citizens exchange presence over the membrane; live == replay (DST)`` () =
    task {
        // citizen 1 = aaron (human-driven); citizen 2 = a CHIP-8 room joining via its identity handle
        let s = Scheduler.fromSeed 700L
        let chip8 = Chip8Citizen.mint "chip8-pong" s.Now 0xC8L Zeta.Core.FSharp.ZetaId.Location.EastUsVa
        let chipWho = "chip8-" + (Chip8Citizen.addressHex chip8).Substring(0, 8)

        let live: SoftScheduler.Source =
            fun tick ->
                [ if tick = 0 then
                      yield OperatorMessageArrived "join:aaron:dev-room"
                      yield OperatorMessageArrived (sprintf "join:%s:dev-room" chipWho)
                  if tick = 1 then yield OperatorMessageArrived "heat:forge:750"
                  if tick = 2 then
                      yield OperatorMessageArrived "go:aaron:hottest"
                      yield OperatorMessageArrived (sprintf "go:%s:hottest" chipWho) ]

        let ctx: IntrCtx =
            { Memetic = "board"; Prompt = ""; Trust = ""; Log = ""; Otel = System.Diagnostics.ActivityContext() }

        let drive src = (SoftScheduler.driveK [ SwarmBoard.handler ] src).Run ctx 1L (SwarmBoard.create map) 4

        let! liveRun = drive live
        let recording = RecordedSource.record live 4
        let! replayRun = drive (RecordedSource.replay recording)

        match liveRun, replayRun with
        | Ok a, Ok b ->
            Assert.Equal(a, b) // DST: the session replays byte-identically
            // both citizens ended up where help was needed, together
            Assert.Equal(Some "forge", Map.tryFind "aaron" a.Presence)
            Assert.Equal(Some "forge", Map.tryFind chipWho a.Presence)
            // and the narrator tells aaron the chip8 is at the table with him
            Assert.Contains("Also here: " + chipWho, SwarmBoard.narrate "aaron" a)
        | e1, e2 -> failwithf "drive failed: %A / %A" e1 e2
    }
    :> Task
