module Zeta.Tests.BowlingAlleyTests

open global.Xunit
open Zeta.Core

let private rep n x = List.replicate n x

[<Fact>]
let ``perfect game (12 strikes) scores 300`` () =
    Assert.Equal(300, BowlingAlley.score (rep 12 10))

[<Fact>]
let ``all gutters scores 0`` () =
    Assert.Equal(0, BowlingAlley.score (rep 20 0))

[<Fact>]
let ``all open frames (twenty 4s) score 80`` () =
    Assert.Equal(80, BowlingAlley.score (rep 20 4))

[<Fact>]
let ``all spares (5,5) x10 + a 5 bonus = 150 (the spare look-ahead)`` () =
    let rolls = (rep 21 5) // 10 frames of 5,5 then one bonus 5
    Assert.Equal(150, BowlingAlley.score rolls)

[<Fact>]
let ``strike look-ahead: 10 then 3,4 then gutters = 24 (10+3+4 then 3+4)`` () =
    let rolls = [ 10; 3; 4 ] @ rep 16 0
    Assert.Equal(24, BowlingAlley.score rolls)

[<Fact>]
let ``deterministic / DST-replayable: same rolls => same score`` () =
    let rolls = [ 10; 7; 3; 9; 0; 10; 0; 8; 8; 2; 0; 6; 10; 10; 10; 8; 1 ]
    Assert.Equal(BowlingAlley.score rolls, BowlingAlley.score rolls)

[<Fact>]
let ``carriesLookahead flags strike/spare frames (deferred) but not open ones`` () =
    let rolls = [ 10; 5; 5; 4; 3 ] // strike at 0; spare at 1 (5+5); open at 3 (4+3)
    Assert.True(BowlingAlley.carriesLookahead rolls 0) // strike
    Assert.True(BowlingAlley.carriesLookahead rolls 1) // spare
    Assert.False(BowlingAlley.carriesLookahead rolls 3) // open

[<Fact>]
let ``the door gathers its lanes + signage names the deferred fold`` () =
    Assert.Equal("bowling alley", BowlingAlley.name)
    Assert.Contains("deferred", BowlingAlley.does)
    Assert.Contains("score", BowlingAlley.lanes |> List.map (fun l -> l.Name))
    Assert.Contains("score", BowlingAlley.liveLanes |> List.map (fun l -> l.Name))
