namespace Zeta.Bayesian.Tests

open Xunit
open Zeta.Bayesian

/// KeptClaimOracle — the reference policy's table, proven row by row, plus the consent-first
/// properties that make it the crux's oracle: self-word beats hearsay, decline is absolute,
/// reunion is an offer, self-conflicts escalate.
module KeptClaimOracleTests =

    let private evidential : BusRegime.Verdict =
        { Correlation = 0.9; Regime = BusRegime.OutOfCone; Evidential = true; FakeableInCone = false }

    let private inCone : BusRegime.Verdict =
        { Correlation = 0.9; Regime = BusRegime.InCone; Evidential = false; FakeableInCone = true }

    let private unmeasured : BusRegime.Verdict =
        { Correlation = 0.9; Regime = BusRegime.Unmeasured; Evidential = false; FakeableInCone = false }

    let private belowCeiling : BusRegime.Verdict =
        { Correlation = 0.2; Regime = BusRegime.OutOfCone; Evidential = false; FakeableInCone = false }

    [<Fact>]
    let ``KCO-1: consent-first — the node's own word outranks any amount of hearsay`` () =
        // 3 hearsay votes say kept; the node itself says unkept → SelfDeclaredUnkept
        let claims = [ (true, "gossip1"); (true, "gossip2"); (true, "gossip3"); (false, "x") ]
        Assert.Equal(KeptClaimOracle.SelfDeclaredUnkept, KeptClaimOracle.readClaims "x" claims)
        // and the reverse: hearsay says unkept, node says kept
        let claims2 = [ (false, "gossip1"); (true, "x") ]
        Assert.Equal(KeptClaimOracle.SelfDeclaredKept, KeptClaimOracle.readClaims "x" claims2)

    [<Fact>]
    let ``KCO-2: hearsay alone never decides — carried as counts, not as a status`` () =
        let claims = [ (true, "g1"); (true, "g2"); (false, "g3") ]
        Assert.Equal(KeptClaimOracle.HearsayOnly(2, 1), KeptClaimOracle.readClaims "x" claims)
        Assert.Equal(KeptClaimOracle.NoClaims, KeptClaimOracle.readClaims "x" [])

    [<Fact>]
    let ``KCO-3: self-conflict is never auto-resolved — both words present means escalate`` () =
        let claims = [ (true, "x"); (false, "x") ]
        Assert.Equal(KeptClaimOracle.SelfConflict, KeptClaimOracle.readClaims "x" claims)
        Assert.Equal(
            KeptClaimOracle.EscalateToAttestation,
            KeptClaimOracle.judge evidential (KeptClaimOracle.readClaims "x" claims))

    [<Fact>]
    let ``KCO-4: the reference table — every evidential row lands where the crux says`` () =
        Assert.Equal(KeptClaimOracle.WelcomeBackOffer, KeptClaimOracle.judge evidential KeptClaimOracle.SelfDeclaredKept)
        Assert.Equal(KeptClaimOracle.DeclineRespected, KeptClaimOracle.judge evidential KeptClaimOracle.SelfDeclaredUnkept)
        Assert.Equal(KeptClaimOracle.EscalateToAttestation, KeptClaimOracle.judge evidential KeptClaimOracle.SelfConflict)
        Assert.Equal(KeptClaimOracle.PricedAsOneNoVerdict, KeptClaimOracle.judge evidential (KeptClaimOracle.HearsayOnly(5, 0)))
        Assert.Equal(KeptClaimOracle.PricedAsOneNoVerdict, KeptClaimOracle.judge evidential KeptClaimOracle.NoClaims)

    [<Fact>]
    let ``KCO-5: no regime shortcut — in-cone is coordination, unmeasured judges nothing, below-ceiling is nothing`` () =
        for claims in [ KeptClaimOracle.SelfDeclaredKept; KeptClaimOracle.SelfDeclaredUnkept; KeptClaimOracle.SelfConflict; KeptClaimOracle.NoClaims ] do
            Assert.Equal(KeptClaimOracle.HonestCoordination, KeptClaimOracle.judge inCone claims)
            Assert.Equal(KeptClaimOracle.NothingToJudge, KeptClaimOracle.judge unmeasured claims)
            Assert.Equal(KeptClaimOracle.NothingToJudge, KeptClaimOracle.judge belowCeiling claims)

    [<Fact>]
    let ``KCO-6: end-to-end from the salon — decline respected even when gossip disagrees`` () =
        let salon =
            [ GossipTelemetry.SelfClaim { Node = "ryn"; Kept = false; Relayer = "ryn" }
              GossipTelemetry.SelfClaim { Node = "ryn"; Kept = true; Relayer = "well-meaning-friend" } ]
            |> List.fold GossipTelemetry.hear GossipTelemetry.empty
        // strong out-of-cone correlation lands on ryn — but ryn's own word was unkept:
        Assert.Equal(KeptClaimOracle.DeclineRespected, KeptClaimOracle.judgeFromSalon salon "ryn" evidential)

    [<Fact>]
    let ``KCO-7: reunion is an OFFER — the kept self-claim yields WelcomeBackOffer, never a merge action`` () =
        let salon =
            [ GossipTelemetry.SelfClaim { Node = "x"; Kept = true; Relayer = "x" } ]
            |> List.fold GossipTelemetry.hear GossipTelemetry.empty
        // the type system carries the discipline: the only reunion-shaped output IS the offer
        Assert.Equal(KeptClaimOracle.WelcomeBackOffer, KeptClaimOracle.judgeFromSalon salon "x" evidential)
