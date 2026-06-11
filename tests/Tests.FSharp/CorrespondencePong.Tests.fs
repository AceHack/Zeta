module Zeta.Tests.CorrespondencePongTests

// The text-message game: a turn is objectives (one line); retries are free before you reply; both
// ends replay the identical match from the two committed lines — correspondence integrity over git.

open global.Xunit
open Zeta.Core

let private turn p d = { CorrespondencePong.Player = p; CorrespondencePong.Objectives = Map.ofList [ "defense", d ] }

[<Fact>]
let ``a turn is ONE text line and round-trips (git-speed sized)`` () =
    let t = turn "aaron" 700
    let line = CorrespondencePong.encode t
    Assert.Equal("turn\taaron\tdefense:700", line)
    Assert.Equal(Some t, CorrespondencePong.decode line)
    Assert.True(CorrespondencePong.decode "not a turn" |> Option.isNone)

[<Fact>]
let ``CORRESPONDENCE INTEGRITY: both ends replay the identical match from the two committed lines`` () =
    let l = CorrespondencePong.encode (turn "aaron" 800) |> CorrespondencePong.decode |> Option.get
    let r = CorrespondencePong.encode (turn "otto" 650) |> CorrespondencePong.decode |> Option.get
    Assert.Equal(CorrespondencePong.play l r 400, CorrespondencePong.play l r 400) // my end == your end

[<Fact>]
let ``RETRIES ARE FREE: trying different weights locally changes the outcome; nothing commits until you reply`` () =
    let opponent = turn "son-raw-tier" 900
    let lazyTry = CorrespondencePong.play (turn "otto" 0) opponent 400 // defense 0: ignores the ball
    let keenTry = CorrespondencePong.play (turn "otto" 900) opponent 400
    Assert.NotEqual(lazyTry, keenTry) // the sandbox is real: weights matter
    Assert.Equal(Some "otto", lazyTry.Conceded) // sleeping at the paddle loses
    Assert.True(keenTry.Rally > lazyTry.Rally) // the keen try rallies longer — pick THIS one, then reply

[<Fact>]
let ``you don't play, you WATCH: a full match runs to an outcome from two one-line turns`` () =
    let o = CorrespondencePong.play (turn "amara" 750) (turn "alexa" 750) 600
    Assert.True(o.Rally >= 1) // a real game happened
