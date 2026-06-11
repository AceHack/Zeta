module Zeta.Tests.FourCornerTests

open global.Xunit
open Zeta.Core

[<Fact>]
let ``ofIn sets only the input corner (resting state)`` () =
    let o: FourCorner.FourCornerOwnership<string, string, string, string> = FourCorner.ofIn "msg"
    Assert.Equal("msg", o.TIn)
    Assert.True(o.TOut.IsNone)
    Assert.True(o.TOutFeedback.IsNone)
    Assert.True(o.TInFeedback.IsNone)
    Assert.False(FourCorner.hasOutput o)
    Assert.False(FourCorner.hasFeedback o)

[<Fact>]
let ``the four corners fill independently (data forward, feedback back)`` () =
    let o =
        FourCorner.ofIn "in"
        |> FourCorner.withOut "out"
        |> FourCorner.withOutFeedback "agent-says"
        |> FourCorner.withInFeedback "co-owned-ack"
    Assert.Equal("in", o.TIn)
    Assert.Equal(Some "out", o.TOut)
    Assert.Equal(Some "agent-says", o.TOutFeedback)
    Assert.Equal(Some "co-owned-ack", o.TInFeedback)
    Assert.True(FourCorner.hasOutput o)
    Assert.True(FourCorner.hasFeedback o)

[<Fact>]
let ``feedback is detected from EITHER direction (each is the other's backpressure)`` () =
    let outOnly = FourCorner.ofIn 1 |> FourCorner.withOutFeedback 99
    let inOnly = FourCorner.ofIn 1 |> FourCorner.withInFeedback 99
    Assert.True(FourCorner.hasFeedback outOnly)
    Assert.True(FourCorner.hasFeedback inOnly)

[<Fact>]
let ``generic over all four corner types (matches the TS FourCornerOwnership shape)`` () =
    // distinct types per corner, like OperatorMessage/Response/ConvFeedback/OperatorAck
    let o: FourCorner.FourCornerOwnership<int, string, bool, float> =
        FourCorner.ofIn 7 |> FourCorner.withOut "seven" |> FourCorner.withInFeedback 0.5
    Assert.Equal(7, o.TIn)
    Assert.Equal(Some "seven", o.TOut)
    Assert.Equal(Some 0.5, o.TInFeedback)
