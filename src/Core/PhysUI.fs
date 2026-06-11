namespace Zeta.Core

/// PhysUI — **2D buttons ARE physics bodies** (Aaron 2026-06-11: "make 2d buttons and such just part
/// of our physics engine for games too — so it can also be games like pong").
///
/// No second UI system: a button is a `Chip9Phys.Body` (sub-pixel AABB). PRESSING is OVERLAP — the
/// pointer (a body), a ball (a body), a CHIP-9 citizen's avatar (a body) can all press the same
/// button by the same physics. And because a button is a body, **a button IS a paddle**: the same
/// rectangle that fires `go:hottest` when clicked returns a serve when a ball arrives — the UI and
/// the game are one engine (pong is just buttons that move).
[<RequireQualifiedAccess>]
module PhysUI =

    /// A button: a physics body + the flow its press fires (the `button` MediaLines binding's target).
    type Button =
        { Body: Chip9Phys.Body
          Flow: string }

    /// Make a button at pixel coords (sub-pixel under the hood, like everything).
    let button (x: int) (y: int) (w: int) (h: int) (flow: string) : Button =
        { Body =
            { Pos = Chip9Phys.v2 (Chip9Phys.ofInt x) (Chip9Phys.ofInt y)
              Size = Chip9Phys.v2 (Chip9Phys.ofInt w) (Chip9Phys.ofInt h)
              Vel = Chip9Phys.v2 0 0 }
          Flow = flow }

    /// PRESS = OVERLAP: any body (pointer, ball, avatar) overlapping the button presses it.
    let pressed (presser: Chip9Phys.Body) (b: Button) : bool = Chip9Phys.overlaps presser b.Body

    /// The flows fired by a presser against a panel of buttons (deterministic order: panel order).
    let fire (presser: Chip9Phys.Body) (panel: Button list) : string list =
        panel |> List.filter (pressed presser) |> List.map (fun b -> b.Flow)

    /// THE PONG CLAUSE: a button returns a serve — if the ball overlaps the button-paddle, reflect
    /// the ball's X velocity away from the paddle's center (exact integer physics; restitution e).
    let paddleReflect (e: Chip9Phys.Fix) (paddle: Button) (ball: Chip9Phys.Body) : Chip9Phys.Body =
        if not (Chip9Phys.overlaps ball paddle.Body) then ball
        else
            let paddleCx = paddle.Body.Pos.X + paddle.Body.Size.X / 2
            let ballCx = ball.Pos.X + ball.Size.X / 2
            let speed = abs (Chip9Phys.mul e ball.Vel.X)
            // away from the paddle's center; EXACT TIE (thin paddles, thin balls) reverses the
            // incoming direction — a paddle returns the serve, it never ushers the ball through
            // itself (found live: 1px center-ties were tie-breaking OUTWARD through the right paddle)
            let vx =
                if ballCx > paddleCx then speed
                elif ballCx < paddleCx then -speed
                elif ball.Vel.X > 0 then -speed
                else speed
            { ball with Vel = { ball.Vel with X = vx } }
