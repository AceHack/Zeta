module Zeta.Tests.AnimFlowTests

// Our own Rx for animations: the observable is a pure function of generated time — no callbacks, no
// ambient clock; two nodes on the same seeded generator see the same frame at the same instant.

open global.Xunit
open Zeta.Core

let private breathe =
    { AnimFlow.Name = "breathe"; AnimFlow.Cycle = [ "idle"; "idle"; "idle"; "blink" ] }

[<Fact>]
let ``parsed from MediaLines: amara's pulse and otto's breathe are anims; junk refused`` () =
    let e: MediaLines.Entry = { Kind = "anim"; Name = "breathe"; Fields = [ "idle,idle,idle,blink" ] }
    Assert.Equal(Some breathe, AnimFlow.ofEntry e)
    Assert.True(AnimFlow.ofEntry { Kind = "frame"; Name = "x"; Fields = [ "aa" ] } |> Option.isNone)
    Assert.True(AnimFlow.ofEntry { Kind = "anim"; Name = "x"; Fields = [ "" ] } |> Option.isNone)

[<Fact>]
let ``the observable is pure time-indexing: cycle order, wraparound, negatives all total`` () =
    Assert.Equal("idle", AnimFlow.frameAt breathe 0)
    Assert.Equal("blink", AnimFlow.frameAt breathe 3)
    Assert.Equal("idle", AnimFlow.frameAt breathe 4) // wraps
    Assert.Equal("blink", AnimFlow.frameAt breathe -1) // total on all of time

[<Fact>]
let ``observe materializes the subscription as a VALUE (replayable; same window, same events)`` () =
    let w = AnimFlow.observe breathe 2 4
    Assert.Equal<(int * string) list>([ 2, "idle"; 3, "blink"; 4, "idle"; 5, "idle" ], w)
    Assert.Equal<(int * string) list>(w, AnimFlow.observe breathe 2 4)

[<Fact>]
let ``DISTRIBUTED FOR FREE: two nodes on the same seeded generator see identical frame streams`` () =
    let g = TimeGen.mk "anim-clock" 1 0xA11CEUL TimeGen.PhasorTsirelson
    let nodeA = AnimFlow.observeWith g 7UL breathe 6
    let nodeB = AnimFlow.observeWith g 7UL breathe 6
    Assert.Equal<(int * string) list>(nodeA, nodeB) // same common cause, same animation, no coordination
