module Zeta.Tests.PhysUITests

// Buttons are bodies: pressing is overlap, any body can press, and a button IS a paddle — the UI and
// the game are one physics engine.

open global.Xunit
open Zeta.Core
module P = Zeta.Core.Chip9Phys

let private pointerAt x y =
    { P.Pos = P.v2 (P.ofInt x) (P.ofInt y); P.Size = P.v2 P.one P.one; P.Vel = P.v2 0 0 }

[<Fact>]
let ``pressing is overlap: the pointer body on the button fires its flow; off it, nothing`` () =
    let panel = [ PhysUI.button 10 10 8 4 "go:hottest"; PhysUI.button 30 10 8 4 "join:dev-room" ]
    Assert.Equal<string list>([ "go:hottest" ], PhysUI.fire (pointerAt 12 11) panel)
    Assert.Equal<string list>([], PhysUI.fire (pointerAt 0 0) panel)
    Assert.Equal<string list>([ "join:dev-room" ], PhysUI.fire (pointerAt 33 12) panel)

[<Fact>]
let ``ANY body presses: a moving ball presses a button exactly like a pointer (one physics)`` () =
    let b = PhysUI.button 20 8 6 3 "serve"
    let ball = { P.Pos = P.v2 (P.ofInt 21) (P.ofInt 9); P.Size = P.v2 P.one P.one; P.Vel = P.v2 (P.ofInt 3) 0 }
    Assert.True(PhysUI.pressed ball b)

[<Fact>]
let ``THE PONG CLAUSE: a button returns the serve — reflection away from the paddle center, exact`` () =
    let paddle = PhysUI.button 5 10 2 8 "paddle-left"
    // ball arriving leftward into the paddle, right of its center -> reflected RIGHT at full speed
    let ball = { P.Pos = P.v2 (P.ofInt 6) (P.ofInt 12); P.Size = P.v2 P.one P.one; P.Vel = P.v2 (-(P.ofInt 4)) (P.ofInt 1) }
    let returned = PhysUI.paddleReflect P.one paddle ball
    Assert.Equal(P.ofInt 4, returned.Vel.X) // away from center, elastic, exact
    Assert.Equal(P.ofInt 1, returned.Vel.Y) // spin untouched
    // a miss leaves the ball alone
    let missed = { ball with P.Pos = P.v2 (P.ofInt 40) (P.ofInt 12) }
    Assert.Equal(missed, PhysUI.paddleReflect P.one paddle missed)

[<Fact>]
let ``a tiny RALLY: ball bounces between two button-paddles deterministically (the UI is the game)`` () =
    let left = PhysUI.button 2 10 2 8 "L"
    let right = PhysUI.button 60 10 2 8 "R"
    let w, h = P.ofInt 64, P.ofInt 32
    let mutable ball = { P.Pos = P.v2 (P.ofInt 30) (P.ofInt 13); P.Size = P.v2 P.one P.one; P.Vel = P.v2 (P.ofInt 2) 0 }
    let mutable bounces = 0
    for _ in 1..60 do
        ball <- P.step w h P.one P.one [ ball ] |> List.head
        let before = ball.Vel.X
        ball <- PhysUI.paddleReflect P.one left ball |> PhysUI.paddleReflect P.one right
        if ball.Vel.X <> before then bounces <- bounces + 1
    Assert.True(bounces >= 2) // a real rally happened, off BUTTONS
