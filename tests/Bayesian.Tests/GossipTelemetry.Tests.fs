namespace Zeta.Bayesian.Tests

open Xunit
open Zeta.Bayesian

/// GossipTelemetry — the salon's soundness rules: monotone-toward-in-cone, idempotent,
/// gossip can destroy evidence but never manufacture it, claims stay neutral facts.
module GossipTelemetryTests =

    let private crossing a b rtt observer =
        GossipTelemetry.Heard
            { GossipTelemetry.Crossing.NodeA = a
              GossipTelemetry.Crossing.NodeB = b
              GossipTelemetry.Crossing.RttMs = rtt
              GossipTelemetry.Crossing.Observer = observer }

    let private keptClaim node kept relayer =
        GossipTelemetry.SelfClaim
            { GossipTelemetry.KeptClaim.Node = node
              GossipTelemetry.KeptClaim.Kept = kept
              GossipTelemetry.KeptClaim.Relayer = relayer }

    let private hearAll rumors =
        rumors |> List.fold GossipTelemetry.hear GossipTelemetry.empty

    [<Fact>]
    let ``GT-1: unheard pairs stay Unmeasured — gossip cannot manufacture out-of-cone`` () =
        let salon = hearAll [ crossing "a" "b" 800 "w" ]
        Assert.Equal(BusRegime.Unmeasured, GossipTelemetry.regimeOfPair salon "a" "c" 100)

    [<Fact>]
    let ``GT-2: a gossiped fast crossing forces InCone on a pair local cannot see`` () =
        // local knows nothing about (sender, reference) — but the salon heard a 60ms crossing
        let salon = hearAll [ crossing "sender" "reference" 60 "witness" ]
        let regime = GossipTelemetry.regimeWithGossip BusRegime.empty salon "sender" "reference" 100
        Assert.Equal(BusRegime.InCone, regime) // 30ms one-way ≤ τ: evidence dies, soundly

    [<Fact>]
    let ``GT-3: slow gossip alone yields OutOfCone for the pair; pair order is irrelevant`` () =
        let salon = hearAll [ crossing "b" "a" 900 "w1"; crossing "a" "b" 1200 "w2" ]
        Assert.Equal(BusRegime.OutOfCone, GossipTelemetry.regimeOfPair salon "a" "b" 100)
        Assert.Equal(BusRegime.OutOfCone, GossipTelemetry.regimeOfPair salon "b" "a" 100)

    [<Fact>]
    let ``GT-4: hearing is idempotent and merge is a CRDT (union; same rumor twice counts once)`` () =
        let r = crossing "a" "b" 500 "w"
        let once = hearAll [ r ]
        let twice = hearAll [ r; r ]
        Assert.Equal<GossipTelemetry.Salon>(once, twice)
        // merge: commutative + idempotent
        let s1 = hearAll [ crossing "a" "b" 500 "w"; keptClaim "x" true "x" ]
        let s2 = hearAll [ crossing "a" "b" 60 "v"; keptClaim "x" false "y" ]
        let m12 = GossipTelemetry.merge s1 s2
        let m21 = GossipTelemetry.merge s2 s1
        Assert.Equal<GossipTelemetry.Salon>(m12, m21)
        Assert.Equal<GossipTelemetry.Salon>(m12, GossipTelemetry.merge m12 s1)
        // and the merged salon knows the fast crossing: in-cone
        Assert.Equal(BusRegime.InCone, GossipTelemetry.regimeOfPair m12 "a" "b" 100)

    [<Fact>]
    let ``GT-5: monotone toward in-cone — adding gossip never turns InCone back to OutOfCone`` () =
        let slow = hearAll [ crossing "a" "b" 900 "w" ]
        let fast = GossipTelemetry.hear slow (crossing "a" "b" 50 "v")
        Assert.Equal(BusRegime.OutOfCone, GossipTelemetry.regimeOfPair slow "a" "b" 100)
        Assert.Equal(BusRegime.InCone, GossipTelemetry.regimeOfPair fast "a" "b" 100)
        // and MORE slow gossip on top of fast cannot resurrect out-of-cone
        let fastPlusSlow = GossipTelemetry.hear fast (crossing "a" "b" 2000 "u")
        Assert.Equal(BusRegime.InCone, GossipTelemetry.regimeOfPair fastPlusSlow "a" "b" 100)

    [<Fact>]
    let ``GT-6: kept-claims are neutral facts — the salon reports who said what, contradictions kept`` () =
        let salon = hearAll [ keptClaim "ryn" true "ryn"; keptClaim "ryn" false "rumor-mill" ]
        let claims = GossipTelemetry.claimsAbout salon "ryn" |> List.sort
        // both claims present, attributed — no verdict, no last-writer-wins erasure
        Assert.Equal<(bool * string) list>([ (false, "rumor-mill"); (true, "ryn") ], claims)
        Assert.Empty(GossipTelemetry.claimsAbout salon "nobody")

    [<Fact>]
    let ``GT-7: prune preserves the regime exactly for every deadline; bound holds; idempotent`` () =
        // 60 crossings on one pair, varied RTTs — more than any window
        let big =
            [ for i in 0 .. 59 -> crossing "a" "b" (100 + (i * 137) % 900) (sprintf "w%d" i) ]
            |> hearAll
        let pruned = GossipTelemetry.pruneCrossings 4 big
        for deadline in 0 .. 600 do
            Assert.Equal(
                GossipTelemetry.regimeOfPair big "a" "b" deadline,
                GossipTelemetry.regimeOfPair pruned "a" "b" deadline)
        for KeyValue(_, set) in pruned.Crossings do
            Assert.True(Set.count set <= 4)
        Assert.Equal<GossipTelemetry.Salon>(pruned, GossipTelemetry.pruneCrossings 4 pruned)
        // floor clamps to 1 — the evidence-killer always survives
        let one = GossipTelemetry.pruneCrossings 0 big
        for deadline in 0 .. 600 do
            Assert.Equal(
                GossipTelemetry.regimeOfPair big "a" "b" deadline,
                GossipTelemetry.regimeOfPair one "a" "b" deadline)

    [<Fact>]
    let ``GT-8: soundness — with more crossings than the meter window, the fastest still rules`` () =
        // regression for the bug the prune theorem caught: 60 entries, the single fastest (60ms)
        // buried among slow ones — the salon must NOT lose it to window aging.
        let salon =
            [ for i in 0 .. 58 -> crossing "a" "b" (500 + i) (sprintf "slow%d" i) ]
            @ [ crossing "a" "b" 60 "fast-witness" ]
            |> hearAll
        Assert.Equal(BusRegime.InCone, GossipTelemetry.regimeOfPair salon "a" "b" 100)

    [<Fact>]
    let ``GT-9: proof of distance — self-witness, consistency, the triangle bound, unverifiable`` () =
        // salon knows: witness↔a at 500ms, witness↔b at 100ms → reverse-triangle bound = 400ms
        let salon =
            hearAll
                [ crossing "witness" "a" 500 "witness"
                  crossing "witness" "b" 100 "witness" ]
        let claim rtt =
            { GossipTelemetry.Crossing.NodeA = "a"
              GossipTelemetry.Crossing.NodeB = "b"
              GossipTelemetry.Crossing.RttMs = rtt
              GossipTelemetry.Crossing.Observer = "witness" }
        // an endpoint measuring its own bus is the credible base case
        Assert.Equal(
            GossipTelemetry.SelfWitnessed,
            GossipTelemetry.plausibilityOf salon { claim 10 with Observer = "a" } 50)
        // 10ms claim: 10 + 50 < 400 → physically suspect (kept, tagged — never rejected)
        Assert.Equal(GossipTelemetry.ImplausiblyFast, GossipTelemetry.plausibilityOf salon (claim 10) 50)
        // 380ms claim: within slack of the bound → consistent
        Assert.Equal(GossipTelemetry.Consistent, GossipTelemetry.plausibilityOf salon (claim 380) 50)
        // unknown witness geometry → unverifiable, honestly
        Assert.Equal(
            GossipTelemetry.Unverifiable,
            GossipTelemetry.plausibilityOf salon { claim 10 with Observer = "stranger" } 50)

    [<Fact>]
    let ``GT-10: the implausible claim still lands in the salon — detection is not rejection`` () =
        let salon =
            hearAll
                [ crossing "witness" "a" 500 "witness"
                  crossing "witness" "b" 100 "witness"
                  crossing "a" "b" 10 "witness" ] // the suspect claim, heard anyway
        // the salon keeps it (dual-use: the fact is preserved for the oracle)…
        Assert.Equal(BusRegime.InCone, GossipTelemetry.regimeOfPair salon "a" "b" 100)
        // …and the tag says what the geometry thinks of it
        let suspect =
            { GossipTelemetry.Crossing.NodeA = "a"
              GossipTelemetry.Crossing.NodeB = "b"
              GossipTelemetry.Crossing.RttMs = 10
              GossipTelemetry.Crossing.Observer = "witness" }
        Assert.Equal(GossipTelemetry.ImplausiblyFast, GossipTelemetry.plausibilityOf salon suspect 50)
