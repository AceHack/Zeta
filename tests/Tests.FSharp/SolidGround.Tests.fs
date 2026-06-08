module Zeta.Tests.SolidGroundTests

open global.Xunit
open Zeta.Core

[<Fact>]
let ``classifySeries: constant / monotonic-up / monotonic-down / erratic`` () =
    Assert.Equal(SolidGround.Constant 5, SolidGround.classifySeries [ 5; 5; 5 ])
    Assert.Equal(SolidGround.Monotonic 1, SolidGround.classifySeries [ 0; 4; 8; 12 ])
    Assert.Equal(SolidGround.Monotonic -1, SolidGround.classifySeries [ 9; 6; 3; 0 ])
    Assert.Equal(SolidGround.Erratic, SolidGround.classifySeries [ 3; 1; 4; 1; 5 ])

[<Fact>]
let ``isSolid: constants and monotonics are solid ground, erratic is not`` () =
    Assert.True(SolidGround.isSolid (SolidGround.Constant 0))
    Assert.True(SolidGround.isSolid (SolidGround.Monotonic 1))
    Assert.False(SolidGround.isSolid SolidGround.Erratic)

[<Fact>]
let ``solidCells / constants / monotonic partition a series map`` () =
    let s =
        Map.ofList
            [ "base", [ 512; 512; 512 ] // constant
              "clock", [ 0; 1; 2; 3 ] // monotonic up
              "timer", [ 60; 59; 58 ] // monotonic down
              "rng", [ 7; 2; 9; 1 ] ] // erratic noise
    Assert.Equal(3, SolidGround.solidCount s) // base + clock + timer
    Assert.Equal<(string * int) list>([ "base", 512 ], SolidGround.constants s)
    let mono = SolidGround.monotonic s |> List.sortBy fst
    Assert.Equal<(string * int) list>([ "clock", 1; "timer", -1 ], mono)

[<Fact>]
let ``solid-ground GAIN: a lens that turns noise into a landmark scores positive (how you judge a lens)`` () =
    let before = Map.ofList [ "x", [ 7; 2; 9; 1 ] ] // erratic -> 0 solid
    // a lens deriving x mod 8's cumulative count, say, that comes out monotonic -> +1 solid
    let after = Map.ofList [ "x", [ 7; 2; 9; 1 ]; "lensed", [ 0; 1; 2; 3 ] ]
    Assert.Equal(1, SolidGround.gain before after) // the lens produced one unit of solid ground
    Assert.Equal(0, SolidGround.solidCount before)

[<Fact>]
let ``solidFraction is navigable cells over all cells`` () =
    let s = Map.ofList [ "a", [ 1; 1; 1 ]; "b", [ 3; 1; 4; 1 ] ] // a solid, b erratic
    Assert.Equal(0.5, SolidGround.solidFraction s, 9)
