module Zeta.Tests.SwarmBoardAnsiTests

// The ANSI/BBS binding (the feel charter's dress code) — capability-honest: ANSI-16 render + the
// Mono1 zero case (same layout, color stripped — the extension discipline structurally).

open global.Xunit
open Zeta.Core

let private board () =
    SwarmBoard.create
        [ "dev-room", [ "n", "forge" ]
          "forge", [ "s", "dev-room" ] ]
    |> SwarmBoard.apply "join:aaron:dev-room"
    |> SwarmBoard.apply "join:max:forge"
    |> SwarmBoard.apply "heat:forge:900"

[<Fact>]
let ``the screen is deterministic and framed (same board, same bytes)`` () =
    let a = SwarmBoardAnsi.render "aaron" (board ())
    let b = SwarmBoardAnsi.render "aaron" (board ())
    Assert.Equal<string list>(a, b)
    Assert.StartsWith("╔", List.head a)
    Assert.StartsWith("╚", List.last a)

[<Fact>]
let ``hot rooms wear bright red; cool rooms stay dim (the door-game ladder)`` () =
    let screen = SwarmBoardAnsi.render "aaron" (board ()) |> String.concat "\n"
    Assert.Contains("[1;31m█", screen) // forge at 0.9 → bright red, mostly-filled bar
    Assert.Contains("[2m░", screen)    // dev-room at 0 → dim, empty bar

[<Fact>]
let ``the narrator line is on the screen (a DM, not a dashboard)`` () =
    let screen = SwarmBoardAnsi.plain "aaron" (board ()) |> String.concat "\n"
    Assert.Contains("You are in dev-room.", screen)
    Assert.Contains("Running hot: forge (0.900).", screen)

[<Fact>]
let ``Mono1 zero case: plain is the SAME screen with color stripped — layout identical`` () =
    let colored = SwarmBoardAnsi.render "aaron" (board ())
    let mono = SwarmBoardAnsi.plain "aaron" (board ())
    Assert.Equal(List.length colored, List.length mono)
    Assert.DoesNotContain("[", String.concat "" mono |> fun s -> s) |> ignore
    Assert.False(mono |> String.concat "" |> fun s -> s.Contains "")
    // occupants visible at their rooms in the mono render too
    Assert.Contains(mono, fun (l: string) -> l.Contains "forge" && l.Contains "max")
