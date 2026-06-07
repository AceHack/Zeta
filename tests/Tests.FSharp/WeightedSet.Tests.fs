module Zeta.Tests.WeightedSetTests

open global.Xunit
open Zeta.Core

module WS = Zeta.Core.WeightedSet

let private sr = IntegerRing.Instance // the ring ZSet uses; WeightedSet<_,int64> is the Z-set instance

[<Fact>]
let ``ofSeq combines duplicate coordinates via Add and prunes Zero`` () =
    let ws = WS.ofSeq sr [ "a", 1L; "b", 2L; "a", 3L; "c", 0L ]
    Assert.Equal(4L, WS.weight sr "a" ws) // 1+3
    Assert.Equal(2L, WS.weight sr "b" ws)
    Assert.Equal(0L, WS.weight sr "c" ws) // 0 weight pruned -> absent -> Zero
    Assert.Equal(2, WS.count ws) // c not stored
    Assert.Equal<string list>([ "a"; "b" ], WS.support ws)

[<Fact>]
let ``add is retraction-native: a + (-a) = empty`` () =
    let a = WS.ofSeq sr [ "x", 5L; "y", -2L ]
    Assert.True(WS.isEmpty (WS.add sr a (WS.negate sr a)))
    // partial cancellation prunes the zeroed coordinate
    let b = WS.ofSeq sr [ "x", -5L ]
    let r = WS.add sr a b
    Assert.Equal<string list>([ "y" ], WS.support r)
    Assert.Equal(-2L, WS.weight sr "y" r)

[<Fact>]
let ``add is commutative and associative (semiring laws lift)`` () =
    let a = WS.ofSeq sr [ "p", 1L; "q", 2L ]
    let b = WS.ofSeq sr [ "q", 3L; "r", 4L ]
    let c = WS.ofSeq sr [ "p", -1L; "s", 5L ]
    Assert.Equal<WS.WeightedSet<string, int64>>(WS.add sr a b, WS.add sr b a)
    Assert.Equal<WS.WeightedSet<string, int64>>(WS.add sr (WS.add sr a b) c, WS.add sr a (WS.add sr b c))

[<Fact>]
let ``scale by Zero annihilates; scale by One is identity; scale distributes over add`` () =
    let a = WS.ofSeq sr [ "a", 2L; "b", 3L ]
    Assert.True(WS.isEmpty (WS.scale sr 0L a)) // ×Zero annihilator
    Assert.Equal<WS.WeightedSet<string, int64>>(a, WS.scale sr 1L a) // ×One identity

    let b = WS.ofSeq sr [ "b", 1L; "c", 4L ]
    // k*(a+b) = k*a + k*b
    let lhs = WS.scale sr 3L (WS.add sr a b)
    let rhs = WS.add sr (WS.scale sr 3L a) (WS.scale sr 3L b)
    Assert.Equal<WS.WeightedSet<string, int64>>(lhs, rhs)

[<Fact>]
let ``inner is the contraction over shared coordinates (SDR overlap for 0/1 weights)`` () =
    // dot product over the integer ring
    let a = WS.ofSeq sr [ "x", 2L; "y", 3L; "z", 1L ]
    let b = WS.ofSeq sr [ "y", 4L; "z", 5L; "w", 9L ]
    Assert.Equal(3L * 4L + 1L * 5L, WS.inner sr a b) // shared y,z only

    // SDR overlap: 0/1 weights, inner = count of shared active coordinates
    let sdr xs = WS.ofSeq sr [ for k in xs -> k, 1L ]
    let s1 = sdr [ "f1"; "f3"; "f7"; "f9" ]
    let s2 = sdr [ "f3"; "f7"; "f8" ]
    Assert.Equal(2L, WS.inner sr s1 s2) // f3, f7 overlap

[<Fact>]
let ``sum is order-independent; mapKeys merges collisions`` () =
    let parts = [ WS.ofSeq sr [ "a", 1L ]; WS.ofSeq sr [ "b", 2L ]; WS.ofSeq sr [ "a", 1L ] ]
    let forward = WS.sum sr parts
    let reversed = WS.sum sr (List.rev parts)
    Assert.Equal<WS.WeightedSet<string, int64>>(forward, reversed)
    Assert.Equal(2L, WS.weight sr "a" forward) // 1+1 across parts

    // mapKeys collapsing two coordinates onto one merges their weights via Add
    let ws = WS.ofSeq sr [ "a", 1L; "b", 2L ]
    let collapsed = WS.mapKeys sr (fun _ -> "k") ws
    Assert.Equal(3L, WS.weight sr "k" collapsed)
    Assert.Equal(1, WS.count collapsed)
