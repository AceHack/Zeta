module Zeta.Tests.BoundaryLightTests

// The lighted-boundary primitive: store the curve (irreducible), generate the light (RBF of the
// distance field), mirror the symmetric half, scatter the stars from the seed, tessellate
// progressively — the same stored text at every resolution.

open global.Xunit
open Zeta.Core

module B = Zeta.Core.BoundaryLight

let private spine: B.Curve = [ B.p 8 0; B.p 8 16 ] // a vertical boundary segment

[<Fact>]
let ``the glow IS the RBF of the distance field: 1 on the boundary, falling with distance, symmetric`` () =
    Assert.Equal(1.0, B.glow 2.0 spine (B.p 8 8), 12) // on the curve: full light
    let near = B.glow 2.0 spine (B.p 10 8)
    let far = B.glow 2.0 spine (B.p 14 8)
    Assert.True(near > far && far > 0.0) // monotone falloff
    Assert.Equal(B.glow 2.0 spine (B.p 10 8), B.glow 2.0 spine (B.p 6 8), 12) // symmetric about the boundary

[<Fact>]
let ``MIRROR: store half the face, generate the rest — reflection is exact and involutive`` () =
    let half: B.Curve = [ B.p 2 0; B.p 3 4; B.p 5 7 ]
    let whole = B.mirror 8 half
    Assert.Equal<B.Curve>([ B.p 14 0; B.p 13 4; B.p 11 7 ], whole)
    Assert.Equal<B.Curve>(half, B.mirror 8 whole) // mirror twice = home

[<Fact>]
let ``SCATTER: the starfield is deterministic from the common-cause seed and costs zero stored bytes`` () =
    let s1 = B.scatter 0xC0FFEEUL 24 64 32
    Assert.Equal<B.P list>(s1, B.scatter 0xC0FFEEUL 24 64 32) // same seed, same sky
    Assert.NotEqual<B.P list>(s1, B.scatter 0xBEEFUL 24 64 32) // different cause, different sky
    Assert.Equal(24, List.length s1)
    Assert.True(s1 |> List.forall (fun pt -> pt.X < 64 && pt.Y < 32))

[<Fact>]
let ``TESSELLATION is progressive: the SAME stored curve renders at 8x8 and 16x16 — text unchanged`` () =
    let coarse = B.sampleGrid 2.0 0.5 8 8 2 spine // 8x8 grid, 2 units/cell
    let fine = B.sampleGrid 2.0 0.5 16 16 1 spine // 16x16 grid, 1 unit/cell — same curve
    Assert.True(coarse.Count > 0 && fine.Count > 0)
    Assert.True(fine.Count > coarse.Count) // finer grid resolves more lit boundary cells
    // determinism at both levels (the render is a pure function of stored text + grid)
    Assert.Equal<Set<int * int>>(coarse, B.sampleGrid 2.0 0.5 8 8 2 spine)
    Assert.Equal<Set<int * int>>(fine, B.sampleGrid 2.0 0.5 16 16 1 spine)
