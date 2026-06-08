module Zeta.Tests.RayTensorTests

open global.Xunit
open Zeta.Core
open Zeta.Core.Abstractions

// Reference-oracle tests for the F# ray-traceable capability vector (RayTensor implements the full
// IRayTraceable = ITensor + ISampleable + IIntrospectable + IGeospatial + Trace). Vera/Lior port to C#/Rust/TS.

let private sr = IntegerRing.Instance

// A tiny 2-D integer field: coordinates are string keys placed on a line of points.
//   "a"@(0,0)=1   "b"@(1,0)=2   "c"@(2,0)=3   "d"@(5,0)=10
let private pos (k: string) : double[] =
    match k with
    | "a" -> [| 0.0; 0.0 |]
    | "b" -> [| 1.0; 0.0 |]
    | "c" -> [| 2.0; 0.0 |]
    | "d" -> [| 5.0; 0.0 |]
    | _   -> [| 0.0; 0.0 |]

let private rt : RayTensor<string, int64> =
    RayTensor.ofSeq sr 2 pos [ "a", 1L; "b", 2L; "c", 3L; "d", 10L ]

let private tensor = rt :> ITensor<string, int64>
let private light  = rt :> ISampleable<string, int64>
let private walk   = rt :> IIntrospectable<string>
let private geo    = rt :> IGeospatial<string>
let private ray    = rt :> IRayTraceable<string, int64>

// Any frame works — ray-traceability is "from ANY arbitrary frame" (a plain vantage point here).
let private frame : IFrame = { new IFrame }

[<Fact>]
let ``ITensor: sparse, stored support = 4`` () =
    Assert.True(tensor.IsSparse)
    Assert.Equal(4L, tensor.StoredCount)

[<Fact>]
let ``ISampleable: sample present = value, absent = semiring Zero`` () =
    Assert.Equal(3L, light.Sample "c")
    Assert.Equal(0L, light.Sample "z")   // absent ⇒ Zero (sparse default)

[<Fact>]
let ``IIntrospectable: Exists present/absent; Neighbors are locality-ordered (nearest first)`` () =
    Assert.True(walk.Exists "a")
    Assert.False(walk.Exists "z")
    // from "a"@(0,0): nearest stored neighbor is "b"@(1,0), farthest is "d"@(5,0)
    let nbrs = walk.Neighbors "a" |> List.ofSeq
    Assert.Equal<string list>([ "b"; "c"; "d" ], nbrs)

[<Fact>]
let ``IGeospatial: Dimensions, Position, Within (box query)`` () =
    Assert.Equal(2, geo.Dimensions)
    Assert.Equal<double list>([ 2.0; 0.0 ], geo.Position "c" |> List.ofSeq)
    // box [0,0]..[2,0] contains a,b,c but not d@(5,0)
    let inBox = geo.Within([| 0.0; 0.0 |], [| 2.0; 0.0 |]) |> Set.ofSeq
    Assert.Equal<Set<string>>(set [ "a"; "b"; "c" ], inBox)

[<Fact>]
let ``Trace: accumulates sampled values along a ray, skipping empty coordinates`` () =
    // ray a→b→c→(z absent, skipped)→d  = 1 + 2 + 3 + 10 = 16
    let total = ray.Trace(frame, [| "a"; "b"; "c"; "z"; "d" |], sr)
    Assert.Equal(16L, total)

[<Fact>]
let ``Trace from a deterministic traveler frame is replayable (same ray ⇒ same result)`` () =
    let r1 = ray.Trace(frame, [| "a"; "c"; "d" |], sr)
    let r2 = ray.Trace(frame, [| "a"; "c"; "d" |], sr)
    Assert.Equal(14L, r1)   // 1 + 3 + 10
    Assert.Equal(r1, r2)    // deterministic ⇒ replayable
