module Zeta.Tests.AntiSybilTests

open global.Xunit
open Zeta.Core
open Zeta.Core.AntiSybil

// A cheap deterministic pseudo-random bit stream (DST §7 — no Math.random; seed varies the stream).
let private bits (seed: int) (n: int) : int list =
    let mutable s = uint64 seed * 2862933555777941757UL + 3037000493UL
    [ for _ in 1 .. n ->
          s <- s * 6364136223846793005UL + 1442695040888963407UL
          int ((s >>> 33) &&& 1UL) ]

[<Fact>]
let ``correlation: identical streams = 1.0, inverted = 1.0 (same source), independent ~ 0`` () =
    let a = bits 1 400
    Assert.Equal(1.0, correlation a a)
    let inverted = a |> List.map (fun b -> 1 - b)
    Assert.Equal(1.0, correlation a inverted) // an inverted replay is still one source
    let b = bits 99 400
    Assert.True(correlation a b < 0.25) // genuinely independent ⇒ near chance

[<Fact>]
let ``antiSybil: k genuinely-distinct identities ⇒ DistinctCount = k, AllDistinct`` () =
    let streams = [ bits 1 500; bits 2 500; bits 3 500; bits 4 500 ]
    let v = antiSybil 0.5 streams
    Assert.Equal(4, v.ClaimedCount)
    Assert.Equal(4, v.DistinctCount)
    Assert.True(v.AllDistinct)

[<Fact>]
let ``antiSybil: the guarantee — k claims from s<k sources ⇒ DistinctCount ≤ s (forger caught)`` () =
    // Adversary has 2 independent clocks but claims 5 identities by replaying.
    let src0, src1 = bits 7 500, bits 8 500
    let claimed = [ src0; src1; src0; src1; src0 ] // 5 claims, 2 sources
    let v = antiSybil 0.5 claimed
    Assert.Equal(5, v.ClaimedCount)
    Assert.Equal(2, v.DistinctCount) // forgery-cost floor exposed: only ever had 2 clocks
    Assert.False(v.AllDistinct)
    // claims 0,2,4 share a source; 1,3 share the other
    Assert.Equal(v.SourceOf.[0], v.SourceOf.[2])
    Assert.Equal(v.SourceOf.[0], v.SourceOf.[4])
    Assert.Equal(v.SourceOf.[1], v.SourceOf.[3])
    Assert.NotEqual(v.SourceOf.[0], v.SourceOf.[1])

[<Fact>]
let ``forgeryCostFloor: exact = ClaimedCount when no Sybil, collapses under reuse`` () =
    Assert.Equal(3, forgeryCostFloor 0.5 [ bits 1 500; bits 2 500; bits 3 500 ])
    let s = bits 5 500
    Assert.Equal(1, forgeryCostFloor 0.5 [ s; s; s ]) // all one source ⇒ floor 1

[<Fact>]
let ``antiSybil: deterministic / replayable (DST)`` () =
    let streams = [ bits 1 300; bits 1 300; bits 2 300 ]
    let a = antiSybil 0.5 streams
    let b = antiSybil 0.5 streams
    Assert.Equal(a.DistinctCount, b.DistinctCount)
    Assert.Equal<Map<int, int>>(a.SourceOf, b.SourceOf)

[<Fact>]
let ``antiSybil: empty input ⇒ zero distinct, AllDistinct vacuously true`` () =
    let v = antiSybil 0.5 []
    Assert.Equal(0, v.ClaimedCount)
    Assert.Equal(0, v.DistinctCount)
    Assert.True(v.AllDistinct)

// ── Addendum-4 bridge lock (2026-07-02): the Sybil correlator IS the Bell correlator ──
// For binary outcomes the CHSH correlator is E = P(agree) − P(disagree) = 2·frac − 1;
// AntiSybil.correlation computes |E| (the abs deliberately catches inverted replays —
// an anti-correlated clone is still one source). This fact is what makes the identity
// layer's Sybil detection the same instrument as the physics Bell harness. See
// docs/research/2026-07-02-name-of-name-…md Addendum 4.

[<Fact>]
let ``BRIDGE: AntiSybil.correlation = |E|, the CHSH correlator on binary outcomes (the Sybil detector IS a Bell correlator)`` () =
    for seedA in [ 3; 17; 42 ] do
        for seedB in [ 3; 29; 71 ] do
            let a = bits seedA 512
            let b = bits seedB 512
            let n = min (List.length a) (List.length b)
            let agree =
                List.zip (List.truncate n a) (List.truncate n b)
                |> List.sumBy (fun (x, y) -> if (x <> 0) = (y <> 0) then 1 else 0)
            // E = P(agree) − P(disagree), computed the Bell way:
            let e = (float agree - float (n - agree)) / float n
            Assert.Equal(abs e, correlation a b, 12)

[<Fact>]
let ``BRIDGE: |E| = 1 exactly for a shared source (replay or inverted replay) — the S=4 limit case of sameness`` () =
    let a = bits 7 256
    let inverted = a |> List.map (fun x -> 1 - x)
    Assert.Equal(1.0, correlation a a, 12)
    Assert.Equal(1.0, correlation a inverted, 12)
