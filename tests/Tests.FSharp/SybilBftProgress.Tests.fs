module Zeta.Tests.SybilBftProgressTests

open global.Xunit
open Zeta.Core
open Zeta.Core.SybilBftLiveness
open Zeta.Core.SybilBftProgress

let private bits (seed: int) (n: int) : int list =
    let mutable s = uint64 seed * 2862933555777941757UL + 3037000493UL
    [ for _ in 1 .. n ->
          s <- s * 6364136223846793005UL + 1442695040888963407UL
          int ((s >>> 33) &&& 1UL) ]

let private ballot v id = Safety(SybilBftProtocol.ballot id (bits id 200) v)

[<Fact>]
let ``empty view: progress fraction is 0, not decided`` () =
    let p = observe (init 4 0.5 10 : LiveView<string>)
    Assert.Equal(0.0, fraction p)
    Assert.False(isDecided p)
    Assert.Equal(3, p.Quorum) // 2f+1 for 4 members, f=1

[<Fact>]
let ``fraction climbs for the seeded singleton-component fixture and reaches one at commit`` () =
    let lv = init 4 0.5 10
    let lv = fst (receive lv (ballot "go" 0))
    let p1 = observe lv
    let lv = fst (receive lv (ballot "go" 1))
    let p2 = observe lv
    let lv = fst (receive lv (ballot "go" 2)) // 3rd distinct = quorum
    let p3 = observe lv
    Assert.True(fraction p1 < fraction p2)
    Assert.True(fraction p2 < fraction p3)
    Assert.Equal(1.0, fraction p3)
    Assert.True(isDecided p3)
    Assert.Equal(Some "go", p3.Committed)

[<Fact>]
let ``trace yields one progress observation per sim tick, converging to commit`` () =
    let schedule =
        [ (1, [ ballot "v" 0 ])
          (2, [ ballot "v" 1 ])
          (3, [ ballot "v" 2 ]) ] // quorum reached
    let tr = trace (init 4 0.5 100) 9 (bits 9 200) schedule
    Assert.Equal(3, List.length tr)
    Assert.Equal<int list>([ 1; 2; 3 ], tr |> List.map (fun p -> p.Tick))
    // Monotone non-decreasing progress, ending decided.
    Assert.True(fraction tr.[0] <= fraction tr.[1])
    Assert.True(fraction tr.[1] <= fraction tr.[2])
    Assert.True(isDecided (List.last tr))

[<Fact>]
let ``isStalled flags a flat, undecided, single-view window`` () =
    // Two distinct votes then nothing more: leading stays at 2, never reaches quorum 3, no view-change.
    let lv = init 4 0.5 1000
    let lv = fst (receive lv (ballot "x" 0))
    let lv = fst (receive lv (ballot "x" 1))
    // Observe the same stuck state across several ticks (no new votes).
    let window = [ { observe lv with Tick = 10 }; { observe lv with Tick = 11 }; { observe lv with Tick = 12 } ]
    Assert.True(isStalled window)

[<Fact>]
let ``isStalled is false when progress improves or a decision lands`` () =
    let lv0 = init 4 0.5 1000
    let lv1 = fst (receive lv0 (ballot "x" 0))
    let lv2 = fst (receive lv1 (ballot "x" 1))
    // Improving window: 1 then 2 leading votes.
    Assert.False(isStalled [ observe lv1; observe lv2 ])
    // Committed window is never a stall.
    let lv3 = fst (receive lv2 (ballot "x" 2))
    Assert.False(isStalled [ observe lv2; observe lv3 ])

[<Fact>]
let ``deterministic / replayable (DST): same schedule, same trace`` () =
    let schedule = [ (1, [ ballot "a" 0 ]); (2, [ ballot "a" 1 ]) ]
    let run () = trace (init 4 0.5 100) 9 (bits 9 200) schedule |> List.map fraction
    Assert.Equal<float list>(run (), run ())

[<Fact>]
let ``a later correlation bridge decreases the fraction within the same undecided view`` () =
    let a, b, bridge = [ 0; 0; 0; 0 ], [ 0; 0; 1; 1 ], [ 0; 0; 0; 1 ]
    let cast i stream state = fst (receive state (Safety(SybilBftProtocol.ballot i stream "value")))
    let before = init 4 0.5 10 |> cast 0 a |> cast 1 b
    let after = before |> cast 2 bridge
    let p, q = observe before, observe after
    Assert.Equal(p.ViewNum, q.ViewNum)
    Assert.Equal(None, p.Committed)
    Assert.Equal(None, q.Committed)
    Assert.Equal(2, p.DistinctSources)
    Assert.Equal(1, q.DistinctSources)
    Assert.Equal(2.0 / 3.0, fraction p)
    Assert.Equal(1.0 / 3.0, fraction q)
