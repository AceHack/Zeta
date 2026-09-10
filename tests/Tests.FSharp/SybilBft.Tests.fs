module Zeta.Tests.SybilBftTests

open global.Xunit
open Zeta.Core
open Zeta.Core.SybilBft

// Deterministic pseudo-random bit stream (DST §7) — same generator as AntiSybil tests.
let private bits (seed: int) (n: int) : int list =
    let mutable s = uint64 seed * 2862933555777941757UL + 3037000493UL
    [ for _ in 1 .. n ->
          s <- s * 6364136223846793005UL + 1442695040888963407UL
          int ((s >>> 33) &&& 1UL) ]

let private vote claimed seed value =
    { Claimed = claimed; Stream = bits seed 500; Value = value }

[<Fact>]
let ``quorum/maxFaults track the classical BFT bound`` () =
    Assert.Equal(1, quorumSize 0)
    Assert.Equal(3, quorumSize 1)
    Assert.Equal(7, quorumSize 3)
    Assert.Equal(0, maxFaults 1)
    Assert.Equal(1, maxFaults 4) // 3f+1 = 4 ⇒ f = 1
    Assert.Equal(2, maxFaults 7)

[<Fact>]
let ``honest 4-source agreement decides the value (d=4, f=1, quorum=3)`` () =
    let votes =
        [ vote 0 1 "commit"; vote 1 2 "commit"; vote 2 3 "commit"; vote 3 4 "commit" ]
    let t = tally 0.5 votes
    Assert.Equal(4, t.DistinctSources)
    Assert.Equal(Some "commit", decide t)

[<Fact>]
let ``five exact record copies contribute one component vote in the seeded fixture`` () =
    // Five claims repeat exactly one generated record, all voting "evil".
    // 3 honest distinct sources vote "good".
    let evil = bits 9 500
    let votes =
        [ { Claimed = 0; Stream = evil; Value = "evil" }
          { Claimed = 1; Stream = evil; Value = "evil" }
          { Claimed = 2; Stream = evil; Value = "evil" }
          { Claimed = 3; Stream = evil; Value = "evil" }
          { Claimed = 4; Stream = evil; Value = "evil" }
          vote 5 1 "good"; vote 6 2 "good"; vote 7 3 "good" ]
    let t = tally 0.5 votes
    // 5 forged claims collapse to 1 source; 3 honest = 4 distinct sources total.
    Assert.Equal(4, t.DistinctSources)
    Assert.Equal(1, t.VotesByValue.["evil"]) // exact record duplication does not increase this tally
    Assert.Equal(3, t.VotesByValue.["good"])
    // f = maxFaults 4 = 1, quorum = 3: "good" wins, "evil" never had the votes.
    Assert.Equal(Some "good", decide t)
    Assert.False(hasQuorum 1 "evil" t)

[<Fact>]
let ``conflicting votes on identical records exclude their component`` () =
    let clk = bits 11 500
    let votes =
        [ { Claimed = 0; Stream = clk; Value = "A" }
          { Claimed = 1; Stream = clk; Value = "B" } // same clock, different vote ⇒ equivocation
          vote 2 1 "A"; vote 3 2 "A" ]
    let t = tally 0.5 votes
    Assert.Equal(3, t.DistinctSources)
    Assert.Equal(1, t.Equivocators)
    Assert.Equal(2, t.VotesByValue.["A"]) // only the two honest sources; equivocator excluded
    Assert.False(t.VotesByValue.ContainsKey "B")

[<Fact>]
let ``deterministic / replayable (DST)`` () =
    let votes = [ vote 0 1 "x"; vote 1 2 "x"; vote 2 3 "y" ]
    Assert.Equal(decide (tally 0.5 votes), decide (tally 0.5 votes))

[<Fact>]
let ``one shared state recoded with three masks contributes a full three-component quorum`` () =
    let shared = [ 1; 0; 1; 1 ]
    let masks = [ [ 0; 0; 0; 0 ]; [ 0; 1; 0; 1 ]; [ 0; 0; 1; 1 ] ]
    let votes =
        masks |> List.mapi (fun i mask ->
            { Claimed = i; Stream = List.map2 (^^^) shared mask; Value = "one-controller" })
    let observed = tally 0.5 votes
    Assert.Equal(3, observed.DistinctSources)
    Assert.Equal(3, observed.VotesByValue.["one-controller"])
    Assert.True(hasQuorum 1 "one-controller" observed)
