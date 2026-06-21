module Zeta.Tests.SwarmBoardMeshTests

// 081KTSZN10008QG0R0003SDRWD stage 3: presence over the Reticulum mesh sim — the SAME join/go/heat payloads that fold the
// board ride as packets between announced ZetaId destinations. "Remote = there is no non-remote":
// sitting at the bench and across the planet are the same protocol. Deterministic end-to-end (DST).

open global.Xunit
open Zeta.Core
open Zeta.Core.FSharp.ZetaId

let private map =
    [ "dev-room", [ "n", "forge"; "e", "salon" ]
      "forge", [ "s", "dev-room" ]
      "salon", [ "w", "dev-room" ] ]

/// The whole stage-3 path: two citizens (aaron remote; a CHIP-8 citizen) send their crossings as
/// Reticulum packets to the BOARD's destination; the board drains its inbox and folds, in
/// deterministic send order.
let private runSession (seed: int64) =
    let s0 = Scheduler.fromSeed seed
    let board = ReticulumLink.mint s0.Now 0xB0A4DL Location.EastUsVa
    let aaron = ReticulumLink.mint s0.Now 0xAA50L Location.WestEurope
    let chip8 = Chip8Citizen.mint "chip8-pong" s0.Now 0xC8L Location.EastUsVa
    let chipWho = "chip8-" + (Chip8Citizen.addressHex chip8).Substring(0, 8)

    let medium =
        ReticulumLink.empty
        |> ReticulumLink.announce board
        |> ReticulumLink.announce aaron
        |> ReticulumLink.announce chip8.Address

    // both ends must be announced before a link forms (discovery)
    match ReticulumLink.connect aaron board medium, ReticulumLink.connect chip8.Address board medium with
    | Ok _, Ok _ ->
        // the citizens SEND their presence + navigation as packets
        let m1, s1 = ReticulumLink.send aaron board "join:aaron:dev-room" s0 medium
        let m2, s2 = ReticulumLink.send chip8.Address board (sprintf "join:%s:dev-room" chipWho) s1 m1
        let m3, s3 = ReticulumLink.send aaron board "heat:forge:750" s2 m2
        let m4, s4 = ReticulumLink.send aaron board "go:aaron:hottest" s3 m3
        let m5, _ = ReticulumLink.send chip8.Address board (sprintf "go:%s:hottest" chipWho) s4 m4

        // the board drains its inbox (deterministic send order) and folds
        let inbox, _ = ReticulumLink.deliver board m5
        let folded = inbox |> List.fold (fun b p -> SwarmBoard.apply p.Payload b) (SwarmBoard.create map)
        folded, chipWho
    | e1, e2 -> failwithf "link setup failed: %A / %A" e1 e2

[<Fact>]
let ``stage 3: presence travels as mesh packets; both citizens meet at the hot cell`` () =
    let board, chipWho = runSession 700L
    Assert.Equal(Some "forge", Map.tryFind "aaron" board.Presence)
    Assert.Equal(Some "forge", Map.tryFind chipWho board.Presence)
    Assert.Contains("Also here: " + chipWho, SwarmBoard.narrate "aaron" board)

[<Fact>]
let ``DST: the same seed yields the identical board (the mesh session replays)`` () =
    let b1, _ = runSession 700L
    let b2, _ = runSession 700L
    Assert.Equal<SwarmBoard.Board>(b1, b2)

[<Fact>]
let ``discovery is honest: an unannounced citizen cannot link to the board`` () =
    let s0 = Scheduler.fromSeed 700L
    let board = ReticulumLink.mint s0.Now 0xB0A4DL Location.EastUsVa
    let ghost = ReticulumLink.mint s0.Now 0x6005EL Location.WestEurope
    let medium = ReticulumLink.empty |> ReticulumLink.announce board
    match ReticulumLink.connect ghost board medium with
    | Error (ReticulumLink.LinkError.Unreachable d) -> Assert.Equal(ghost, d)
    | Ok _ -> failwith "ghost should not link"
