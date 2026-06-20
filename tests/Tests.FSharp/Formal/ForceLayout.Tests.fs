module Zeta.Tests.Formal.ForceLayoutTests

open FsCheck.Xunit
open global.Xunit
open Zeta.Core

// The metaspace physics engine: force-directed (spring-electrical) layout. The load-bearing
// property is convergence — relaxation monotonically reduces the field energy toward the rest
// state (the SocietalDora energy minimum the metaspace lays out to).

let private v (x: float) (y: float) : Viewport.Vec3 = Viewport.vec3 x y 0.0

let private dist (a: Viewport.Vec3) (b: Viewport.Vec3) : float =
    sqrt ((a.X - b.X) ** 2.0 + (a.Y - b.Y) ** 2.0)

[<Fact>]
let ``relaxation reduces total energy (converges to the field minimum)`` () =
    // a 4-node path 0-1-2-3 started in a poor (collinear, cramped) layout
    let positions = [| v 0.0 0.0; v 1.0 0.0; v 2.0 0.0; v 3.0 0.0 |]
    let edges = [| (0, 1, 1.0); (1, 2, 1.0); (2, 3, 1.0) |]
    let before = ForceLayout.energy ForceLayout.defaults edges positions
    let after = ForceLayout.energy ForceLayout.defaults edges (ForceLayout.relax ForceLayout.defaults 50 edges positions)
    Assert.True(after < before, $"energy should drop: before={before} after={after}")

[<Fact>]
let ``two unconnected nodes repel — they end farther apart`` () =
    let positions = [| v 0.0 0.0; v 1.0 0.0 |]
    let relaxed = ForceLayout.relax ForceLayout.defaults 20 [||] positions
    Assert.True(dist relaxed.[0] relaxed.[1] > dist positions.[0] positions.[1])

[<Fact>]
let ``a connected pair flung far apart is pulled back toward the ideal length`` () =
    let p = ForceLayout.defaults // IdealLength = 50
    let positions = [| v 0.0 0.0; v 500.0 0.0 |] // way past ideal
    let edges = [| (0, 1, 1.0) |]
    let relaxed = ForceLayout.relax p 100 edges positions
    Assert.True(dist relaxed.[0] relaxed.[1] < dist positions.[0] positions.[1], "spring should contract an over-stretched edge")

[<Property>]
let ``a step preserves node count and the z-plane (2D-now)`` (seed: int) =
    // small deterministic layout derived from the seed (no RNG)
    let n = 3 + (abs seed % 5)
    let positions = Array.init n (fun i -> v (float (i * 7 % 40)) (float (i * 13 % 40)))
    let edges = [| for i in 0 .. n - 2 -> (i, i + 1, 1.0) |]
    let stepped = ForceLayout.step ForceLayout.defaults edges positions
    stepped.Length = n && Array.forall (fun (q: Viewport.Vec3) -> q.Z = 0.0) stepped

[<Property>]
let ``relaxation is deterministic (same input => same output)`` (iters: int) =
    let k = 1 + (abs iters % 30)
    let positions = [| v 0.0 0.0; v 10.0 5.0; v 3.0 20.0; v 25.0 25.0 |]
    let edges = [| (0, 1, 1.0); (1, 2, 2.0); (2, 3, 1.0); (3, 0, 1.0) |]
    let a = ForceLayout.relax ForceLayout.defaults k edges positions
    let b = ForceLayout.relax ForceLayout.defaults k edges positions
    Array.forall2 (fun (x: Viewport.Vec3) (y: Viewport.Vec3) -> x.X = y.X && x.Y = y.Y && x.Z = y.Z) a b

[<Fact>]
let ``higher edge weight (more coupled-empowerment) pulls a pair closer than a weak edge`` () =
    let p = ForceLayout.defaults
    let start () = [| v 0.0 0.0; v 200.0 0.0 |]
    let strong = ForceLayout.relax p 80 [| (0, 1, 4.0) |] (start ())
    let weak = ForceLayout.relax p 80 [| (0, 1, 0.5) |] (start ())
    Assert.True(dist strong.[0] strong.[1] < dist weak.[0] weak.[1], "stronger coupling => tighter rest distance")
