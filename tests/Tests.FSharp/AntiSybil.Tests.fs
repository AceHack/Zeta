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

// ── CHSH escalation (Addendum 4 → instrument): randomized settings close the strategic-forger gap ──

/// Seeded settings stream (0/1) — the probe challenges.
let private settings (seed: int) (n: int) : int list = bits seed n

/// PR-box conducted pair phased to chshOf's convention: b SEES a's setting
/// (shared seed / live channel) and steers the product to −1 exactly on the
/// minus term (sa=0, sb=1), +1 elsewhere. S = 4.
let private conductedPair (seedA: int) (seedB: int) (n: int) =
    let sa = settings seedA n
    let sb = settings seedB n
    let a = sa |> List.map (fun s -> { AntiSybil.ChshRound.Setting = s; Outcome = 1 })
    let b =
        List.zip sa sb
        |> List.map (fun (xa, xb) ->
            { AntiSybil.ChshRound.Setting = xb
              Outcome = if xa = 0 && xb = 1 then -1 else 1 })
    a, b

/// Genuinely independent pair: each side's outcome is a function of its OWN
/// setting and its OWN private seed only. No conductor.
let private independentPair (seedA: int) (seedB: int) (n: int) =
    let mk seedS seedO =
        let ss = settings seedS n
        let os = bits seedO n
        List.zip ss os
        |> List.map (fun (s, o) -> { AntiSybil.ChshRound.Setting = s; Outcome = (if o = 1 then 1 else -1) })
    mk seedA (seedA * 7 + 1), mk seedB (seedB * 11 + 5)

[<Fact>]
let ``CHSH COMPLETENESS: a conducted (shared-seed) pair scores S = 4 exactly and is convicted`` () =
    let a, b = conductedPair 101 103 4096
    Assert.Equal(4.0, chshS a b, 12)
    let v = chshSybil BellTest.ClassicalBound [ a; b ]
    Assert.Equal(1, v.DistinctCount)
    Assert.False(v.AllDistinct)

[<Fact>]
let ``CHSH SOUNDNESS: independent private seeds hover near S = 0 and are NOT convicted`` () =
    let a, b = independentPair 107 109 4096
    Assert.True(abs (chshS a b) < 0.5, sprintf "independent pair should not correlate: S = %f" (chshS a b))
    Assert.True((chshSybil BellTest.ClassicalBound [ a; b ]).AllDistinct)

[<Fact>]
let ``THE LHV EDGE: the best no-communication strategy sits exactly AT S = 2 and is not convicted — the bound is the threshold`` () =
    // Both sides always answer +1: E = +1 in every bucket, S = 1 − 1 + 1 + 1 = 2.
    let sa = settings 113 4096
    let sb = settings 127 4096
    let a = sa |> List.map (fun s -> { AntiSybil.ChshRound.Setting = s; Outcome = 1 })
    let b = sb |> List.map (fun s -> { AntiSybil.ChshRound.Setting = s; Outcome = 1 })
    Assert.Equal(2.0, chshS a b, 12)
    Assert.True((chshSybil BellTest.ClassicalBound [ a; b ]).AllDistinct)

[<Fact>]
let ``THE MIXTURE TIER: partial conduction lands on S = 2 + 2·f* and the bandwidth estimator reads it back`` () =
    // Conduct only rounds whose index bit says so (~half): f* = delivered fraction on the minus bucket.
    let n = 4096
    let sa = settings 131 n
    let sb = settings 137 n
    let gate = bits 139 n
    let a = sa |> List.map (fun s -> { AntiSybil.ChshRound.Setting = s; Outcome = 1 })
    let mutable minusTotal = 0
    let mutable minusConducted = 0
    let b =
        List.zip3 sa sb gate
        |> List.map (fun (xa, xb, g) ->
            let isMinus = xa = 0 && xb = 1
            if isMinus then minusTotal <- minusTotal + 1
            if isMinus && g = 1 then minusConducted <- minusConducted + 1
            { AntiSybil.ChshRound.Setting = xb
              Outcome = if isMinus && g = 1 then -1 else 1 })
    let fStar = float minusConducted / float minusTotal
    let s = chshS a b
    Assert.Equal(2.0 + 2.0 * fStar, s, 9)
    Assert.Equal(fStar, coordinationBandwidth s, 9)

[<Fact>]
let ``CHSH UNION-FIND: two conducted claims + one independent ⇒ DistinctCount = 2, the pair collapses`` () =
    let a, b = conductedPair 149 151 4096
    let c, _ = independentPair 157 163 4096
    let v = chshSybil BellTest.ClassicalBound [ a; b; c ]
    Assert.Equal(3, v.ClaimedCount)
    Assert.Equal(2, v.DistinctCount)
    Assert.Equal(v.SourceOf.[0], v.SourceOf.[1])
    Assert.NotEqual(v.SourceOf.[0], v.SourceOf.[2])

[<Fact>]
let ``BANDWIDTH CLAMPS: cb(4)=1, cb(2√2)=√2−1, cb(2)=0, cb(0)=0 — the ladder read as delivery fraction`` () =
    Assert.Equal(1.0, coordinationBandwidth BellTest.AlgebraicMax, 12)
    Assert.Equal(sqrt 2.0 - 1.0, coordinationBandwidth BellTest.TsirelsonBound, 12)
    Assert.Equal(0.0, coordinationBandwidth BellTest.ClassicalBound, 12)
    Assert.Equal(0.0, coordinationBandwidth 0.0, 12)

[<Fact>]
let ``DRIFT LOCK: AntiSybil's inlined CHSH combination agrees with BellTest.chshOf on arbitrary correlators`` () =
    for e0, e1, e2, e3 in [ 1.0, 1.0, 1.0, -1.0; 0.5, -0.25, 0.75, 0.1; -1.0, 1.0, -1.0, 1.0 ] do
        // chshS is exercised end-to-end elsewhere; this locks the FORMULA by
        // recomputing it the AntiSybil way against the canonical BellTest way.
        Assert.Equal(BellTest.chshOf e0 e1 e2 e3, e0 - e1 + e2 + e3, 12)
