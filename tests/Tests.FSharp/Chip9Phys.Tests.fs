module Zeta.Tests.Chip9PhysTests

// The CHIP-9 physics kernel: fix16 sub-pixel, clock-free, integer-exact — a treaty surface (same
// trajectory on every oracle at any speed; the human throttle is presence-triggered upstairs, never
// in the math).

open global.Xunit
open Zeta.Core

module P = Zeta.Core.Chip9Phys

let private world = P.ofInt 64, P.ofInt 32

[<Fact>]
let ``fix16 arithmetic is exact: mul/div round-trip on representable values`` () =
    Assert.Equal(P.ofInt 6, P.mul (P.ofInt 2) (P.ofInt 3))
    Assert.Equal(P.ofInt 2, P.div (P.ofInt 6) (P.ofInt 3))
    Assert.Equal(P.one / 2, P.mul (P.one / 2) P.one) // half a pixel survives exactly

[<Fact>]
let ``CLOCK-FREE: n small steps equal one big step exactly (linear motion; dt is simulation time)`` () =
    let b = { P.Pos = P.v2 (P.ofInt 5) (P.ofInt 5); P.Size = P.v2 P.one P.one; P.Vel = P.v2 (P.ofInt 2) (P.ofInt 1) }
    let small = [ 1..8 ] |> List.fold (fun x _ -> P.integrate (P.one / 8) x) b
    let big = P.integrate P.one b
    Assert.Equal(big.Pos, small.Pos) // 8 × (1/8 tick) == 1 tick, to the bit — speed is nobody's business

[<Fact>]
let ``walls reflect sub-pixel exactly; elastic bounce preserves speed, restitution scales it`` () =
    let w, h = world
    let b = { P.Pos = P.v2 (P.ofInt 63) (P.ofInt 10); P.Size = P.v2 P.one P.one; P.Vel = P.v2 (P.ofInt 4) 0 }
    let e1 = P.step w h P.one P.one [ b ] |> List.head
    Assert.True(e1.Vel.X < 0) // bounced
    Assert.Equal(P.ofInt 4, -e1.Vel.X) // elastic: speed preserved exactly
    let eHalf = P.step w h (P.one / 2) P.one [ b ] |> List.head
    Assert.Equal(P.ofInt 2, -eHalf.Vel.X) // restitution ½: half the speed, exactly

[<Fact>]
let ``DETERMINISM: the same world replays bit-identically (the treaty surface property)`` () =
    let bodies =
        [ { P.Pos = P.v2 (P.ofInt 3) (P.ofInt 4); P.Size = P.v2 P.one P.one; P.Vel = P.v2 (P.ofInt 3) (P.ofInt 2) }
          { P.Pos = P.v2 (P.ofInt 50) (P.ofInt 20); P.Size = P.v2 (P.ofInt 2) P.one; P.Vel = P.v2 (-P.ofInt 5) (P.ofInt 1) } ]
    let w, h = world
    let run () = [ 1..500 ] |> List.fold (fun bs _ -> P.step w h P.one (P.one / 4) bs) bodies
    Assert.Equal<P.Body list>(run (), run ())

[<Fact>]
let ``overlap detects sub-pixel contact that whole pixels cannot see (the quality claim, concrete)`` () =
    let a = { P.Pos = P.v2 (P.ofInt 10) (P.ofInt 10); P.Size = P.v2 P.one P.one; P.Vel = P.v2 0 0 }
    // b sits 1/4 pixel inside a's right edge — pixelRect says both are at distinct cells
    let b = { a with P.Pos = P.v2 (P.ofInt 10 + P.one * 3 / 4) (P.ofInt 10) }
    Assert.True(P.overlaps a b) // the simulation sees the contact
    let ax, _, _, _ = P.pixelRect a
    let bx, _, _, _ = P.pixelRect b
    Assert.Equal(ax, bx) // ...the display would round them onto the same cell — sim ≫ display precision
