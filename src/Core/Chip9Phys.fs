namespace Zeta.Core

/// Chip9Phys — **the first stone of the CHIP-9 graphics/physics library** (Aaron 2026-06-11: "we need
/// our own graphics and physics library for chip9 — super high quality rendering like never seen
/// before on tiny things, SCALE-FREE, so it can run independent of clock speed … it can run at max
/// speed, artificial throttle only when a human joins the conference").
///
/// Design laws (each from a standing discipline):
/// - **Fixed-point 16.16, no floats** — exact, byte-lockable, culture-invariant: the physics is a
///   TREATY surface (the same trajectory on every oracle, every architecture — the 081KTSZN10008QG0R000VZHRQ4 fan-out
///   carries it). 16.16 gives sub-pixel precision ×65536 on a 64×32 screen: positions live on a
///   4,194,304 × 2,097,152 sub-pixel grid — "super high quality on tiny things" is exactly this:
///   the SIMULATION is far finer than the DISPLAY, and the renderer downsamples.
/// - **Clock-free stepping** — `step` advances SIMULATION TIME by an exact dt (a 16.16 tick fraction),
///   never wall time. Determinism is per-step; speed is the runner's business: headless = max speed
///   (no human to pace for), and the HUMAN THROTTLE is presence-triggered at the room layer (a human
///   joins the conference ⇒ the runner inserts wall-clock pacing; nobody slows the math itself).
/// - **Integer collision** — AABB overlap + elastic axis reflection in pure integer arithmetic;
///   restitution as a 16.16 scalar. The MeshPong integer world generalized.
///
/// Honest scope: this is the KERNEL (vectors, AABB, integrate, reflect) — the library grows around it
/// (sprites-from-physics, sub-pixel rasterize-to-planes, springs/joints are named next slices).
[<RequireQualifiedAccess>]
module Chip9Phys =

    /// One unit = 1/65536 of a pixel. The whole library speaks fix16.
    type Fix = int

    let one: Fix = 65536
    let ofInt (i: int) : Fix = i * one
    let toIntFloor (f: Fix) : int = int (System.Math.Floor(float f / 65536.0))

    /// Saturating cast of a 64-bit fix result to Fix (greenfield right-thing: the int cast used to
    /// silently truncate quotients/products past ±32767px — clamp instead of wrap).
    let private satFix (x: int64) : Fix =
        if x > int64 System.Int32.MaxValue then System.Int32.MaxValue
        elif x < int64 System.Int32.MinValue then System.Int32.MinValue
        else int x

    /// fix16 multiply (64-bit intermediate; saturating cast — no wrap inside OR past screen range).
    let mul (a: Fix) (b: Fix) : Fix = satFix ((int64 a * int64 b) >>> 16)

    /// fix16 divide — TOTAL (Result-over-exception / no exceptions on hot paths, greenfield fix):
    /// divide-by-zero saturates to ±max by the dividend's sign (physically: a velocity/position
    /// "to infinity" clamped to the field) instead of throwing DivideByZeroException; the quotient
    /// cast saturates too. A divide-by-zero is a caller bug, but the hot path never throws.
    let div (a: Fix) (b: Fix) : Fix =
        if b = 0 then (if a >= 0 then System.Int32.MaxValue else System.Int32.MinValue)
        else satFix ((int64 a <<< 16) / int64 b)

    /// A 2D fixed-point vector.
    type V2 = { X: Fix; Y: Fix }

    let v2 x y = { X = x; Y = y }
    let add (a: V2) (b: V2) = { X = a.X + b.X; Y = a.Y + b.Y }
    let scale (k: Fix) (a: V2) = { X = mul k a.X; Y = mul k a.Y }

    /// An axis-aligned body: position (top-left), size, velocity — all fix16 sub-pixel.
    type Body =
        { Pos: V2
          Size: V2
          Vel: V2 }

    /// Advance one body by exact dt (fix16 ticks) — pure, clock-free, deterministic.
    let integrate (dt: Fix) (b: Body) : Body = { b with Pos = add b.Pos (scale dt b.Vel) }

    /// AABB overlap test — pure integer comparisons.
    let overlaps (a: Body) (b: Body) : bool =
        a.Pos.X < b.Pos.X + b.Size.X
        && b.Pos.X < a.Pos.X + a.Size.X
        && a.Pos.Y < b.Pos.Y + b.Size.Y
        && b.Pos.Y < a.Pos.Y + a.Size.Y

    /// Reflect a body off the world's walls (0..w, 0..h), with restitution `e` (fix16; one = elastic).
    /// Clamps position back inside and flips/scales the velocity axis — the pong move, sub-pixel.
    let reflectWalls (w: Fix) (h: Fix) (e: Fix) (b: Body) : Body =
        let bounce (pos: Fix) (size: Fix) (vel: Fix) (limit: Fix) =
            if pos < 0 then -pos, -(mul e vel)
            elif pos + size > limit then limit - size - (pos + size - limit), -(mul e vel)
            else pos, vel

        let px, vx = bounce b.Pos.X b.Size.X b.Vel.X w
        let py, vy = bounce b.Pos.Y b.Size.Y b.Vel.Y h
        { b with Pos = v2 px py; Vel = v2 vx vy }

    /// One world step: integrate every body, then wall-reflect — the kernel's whole loop.
    let step (w: Fix) (h: Fix) (e: Fix) (dt: Fix) (bodies: Body list) : Body list =
        bodies |> List.map (integrate dt >> reflectWalls w h e)

    /// Rasterize a body to whole pixels (floor) — where the sub-pixel simulation meets the 64×32
    /// display: the renderer's input. The high-quality move: positions carry 16 bits MORE precision
    /// than any pixel shows, so motion stays smooth at any dt (temporal supersampling lives upstairs).
    let pixelRect (b: Body) : int * int * int * int =
        toIntFloor b.Pos.X, toIntFloor b.Pos.Y, toIntFloor b.Size.X, toIntFloor b.Size.Y
