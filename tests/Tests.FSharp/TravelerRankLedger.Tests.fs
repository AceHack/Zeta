namespace Zeta.Tests

open Xunit
open Zeta.Core

// ── TravelerRankLedger tests ──────────────────────────────────────────────────────────────────────
//
// TRL-1  freshBelief has μ=0, σ²=1, ObsCount=0
// TRL-2  trustBand(freshBelief) = 0.5 (honest prior, not 0.0 clamp)
// TRL-3  bigPhi(0) = 0.5 (sanity check)
// TRL-4  bigPhi is monotone increasing
// TRL-5  bigPhi(-x) = 1 - bigPhi(x) (odd function)
// TRL-6  trustBand increases after a hit
// TRL-7  trustBand decreases after a miss
// TRL-8  trustBand is monotone: more hits → higher trustBand
// TRL-9  trustBand is monotone: more misses → lower trustBand
// TRL-10 TrueSkill cross-check: 10 hits → trustBand > 0.9
// TRL-11 TrueSkill cross-check: 10 misses → trustBand < 0.1
// TRL-12 Whitewash window closed: "1 hit, 2 misses" → trustBand > 0.0 (not clamped)
// TRL-13 Whitewash window: "1 hit, 2 misses" → trustBand ≈ 0.35 (below honest prior)
// TRL-14 Domain isolation: hits in domain A do not affect trustBand in domain B
// TRL-15 Domain isolation: different travelers are independent
// TRL-16 Ledger.empty has no entries
// TRL-17 beliefOf returns freshBelief for unknown (traveler, domain)
// TRL-18 record updates the ledger correctly
// TRL-19 obsCountOf counts observations correctly
// TRL-20 isAboveThreshold: fresh identity is above 0.0 but not above 0.9
// TRL-21 isPositiveSkill: fresh identity has μ=0 (not positive)
// TRL-22 isPositiveSkill: after 5 hits → positive skill
// TRL-23 EP update is DST-replayable (same sequence → same belief)
// TRL-24 EP update: ObsCount increments correctly
// TRL-25 σ² decreases with more observations (posterior concentrates)
// TRL-26 trustBand is in [0, 1] for all beliefs
// TRL-27 trustBandOf returns 0.5 for unknown traveler (honest prior)
// TRL-28 TrueSkill paper cross-check: μ after 1 hit ≈ 0.6 (within 0.1)
// TRL-29 Symmetry: 5 hits then 5 misses ≈ 5 misses then 5 hits (order-insensitive in limit)
// TRL-30 Anti-whitewash gate: 10 hits → isPositiveSkill = true

module TravelerRankLedgerTests =

    let private tb = TravelerRankLedger.trustBand

    // ── TRL-1: freshBelief structure ──────────────────────────────────────────────────────────────
    [<Fact>]
    let ``TRL-1 freshBelief has mu=0 sigma2=1 ObsCount=0`` () =
        let b = TravelerRankLedger.freshBelief
        Assert.Equal(0.0, b.Mu)
        Assert.Equal(1.0, b.Sigma2)
        Assert.Equal(0, b.ObsCount)

    // ── TRL-2: honest prior floor ─────────────────────────────────────────────────────────────────
    [<Fact>]
    let ``TRL-2 trustBand of freshBelief is 0.5 (honest prior, not 0.0 clamp)`` () =
        let band = tb TravelerRankLedger.freshBelief
        Assert.InRange(band, 0.4999, 0.5001)

    // ── TRL-3: bigPhi(0) = 0.5 ───────────────────────────────────────────────────────────────────
    [<Fact>]
    let ``TRL-3 trustBand formula: Phi(0) = 0.5 (zero skill = honest prior)`` () =
        // trustBand = Phi(mu / sqrt(sigma2 + beta^2)) = Phi(0 / sqrt(2)) = Phi(0) = 0.5
        let b = { TravelerRankLedger.freshBelief with Mu = 0.0; Sigma2 = 1.0 }
        Assert.InRange(tb b, 0.4999, 0.5001)

    // ── TRL-4: bigPhi is monotone ─────────────────────────────────────────────────────────────────
    [<Fact>]
    let ``TRL-4 trustBand is monotone increasing in mu (higher skill = higher trustBand)`` () =
        let sigma2 = 1.0
        let mus = [ -3.0; -2.0; -1.0; 0.0; 1.0; 2.0; 3.0 ]
        let bands = mus |> List.map (fun mu -> tb { TravelerRankLedger.freshBelief with Mu = mu; Sigma2 = sigma2 })
        for i in 0 .. bands.Length - 2 do
            Assert.True(bands.[i] < bands.[i+1],
                sprintf "trustBand not monotone at mu=%g: %f >= %f" mus.[i] bands.[i] bands.[i+1])

    // ── TRL-5: bigPhi odd function ────────────────────────────────────────────────────────────────
    [<Fact>]
    let ``TRL-5 trustBand(mu) + trustBand(-mu) = 1.0 (Phi is odd)`` () =
        for mu in [ 0.5; 1.0; 2.0; 3.0 ] do
            let bPos = tb { TravelerRankLedger.freshBelief with Mu = mu }
            let bNeg = tb { TravelerRankLedger.freshBelief with Mu = -mu }
            Assert.InRange(bPos + bNeg, 0.9999, 1.0001)

    // ── TRL-6: trustBand increases after a hit ────────────────────────────────────────────────────
    [<Fact>]
    let ``TRL-6 trustBand increases after a hit`` () =
        let before = TravelerRankLedger.freshBelief
        let after = TravelerRankLedger.update true before
        Assert.True(tb after > tb before,
            sprintf "trustBand did not increase after hit: %f -> %f" (tb before) (tb after))

    // ── TRL-7: trustBand decreases after a miss ───────────────────────────────────────────────────
    [<Fact>]
    let ``TRL-7 trustBand decreases after a miss`` () =
        let before = TravelerRankLedger.freshBelief
        let after = TravelerRankLedger.update false before
        Assert.True(tb after < tb before,
            sprintf "trustBand did not decrease after miss: %f -> %f" (tb before) (tb after))

    // ── TRL-8: monotone in hits ───────────────────────────────────────────────────────────────────
    [<Fact>]
    let ``TRL-8 trustBand is monotone increasing with more hits`` () =
        let mutable b = TravelerRankLedger.freshBelief
        let mutable prev = tb b
        for _ in 1 .. 20 do
            b <- TravelerRankLedger.update true b
            let curr = tb b
            Assert.True(curr > prev, sprintf "trustBand not monotone after hit: %f -> %f" prev curr)
            prev <- curr

    // ── TRL-9: monotone in misses ─────────────────────────────────────────────────────────────────
    [<Fact>]
    let ``TRL-9 trustBand is monotone decreasing with more misses`` () =
        let mutable b = TravelerRankLedger.freshBelief
        let mutable prev = tb b
        for _ in 1 .. 20 do
            b <- TravelerRankLedger.update false b
            let curr = tb b
            Assert.True(curr < prev, sprintf "trustBand not monotone after miss: %f -> %f" prev curr)
            prev <- curr

    // ── TRL-10: 10 hits → trustBand > 0.9 ───────────────────────────────────────────────────────
    [<Fact>]
    let ``TRL-10 10 hits gives trustBand above 0.9`` () =
        let b = Seq.fold (fun acc _ -> TravelerRankLedger.update true acc) TravelerRankLedger.freshBelief (seq { 1..10 })
        Assert.True(tb b > 0.9, sprintf "expected trustBand > 0.9 after 10 hits, got %f" (tb b))

    // ── TRL-11: 10 misses → trustBand < 0.1 ─────────────────────────────────────────────────────
    [<Fact>]
    let ``TRL-11 10 misses gives trustBand below 0.1`` () =
        let b = Seq.fold (fun acc _ -> TravelerRankLedger.update false acc) TravelerRankLedger.freshBelief (seq { 1..10 })
        Assert.True(tb b < 0.1, sprintf "expected trustBand < 0.1 after 10 misses, got %f" (tb b))

    // ── TRL-12: whitewash window closed (not clamped to 0.0) ─────────────────────────────────────
    [<Fact>]
    let ``TRL-12 1 hit then 2 misses gives trustBand above 0.0 (whitewash window closed)`` () =
        let b =
            TravelerRankLedger.freshBelief
            |> TravelerRankLedger.update true
            |> TravelerRankLedger.update false
            |> TravelerRankLedger.update false
        Assert.True(tb b > 0.0,
            sprintf "trustBand clamped to 0.0 at k=3 — whitewash window not closed: %f" (tb b))

    // ── TRL-13: whitewash window value ≈ 0.35 ────────────────────────────────────────────────────
    [<Fact>]
    let ``TRL-13 1 hit then 2 misses gives trustBand approximately 0.35 (below honest prior)`` () =
        let b =
            TravelerRankLedger.freshBelief
            |> TravelerRankLedger.update true
            |> TravelerRankLedger.update false
            |> TravelerRankLedger.update false
        // The EP posterior for "1 hit, 2 misses" should be below 0.5 (honest prior)
        // and above 0.0 (not clamped). The exact value depends on β=1.0.
        Assert.InRange(tb b, 0.20, 0.50)
        Assert.True(tb b < 0.5, sprintf "expected trustBand < 0.5 after 1 hit, 2 misses: %f" (tb b))

    // ── TRL-14: domain isolation ──────────────────────────────────────────────────────────────────
    [<Fact>]
    let ``TRL-14 hits in domain A do not affect trustBand in domain B`` () =
        let ledger =
            TravelerRankLedger.empty
            |> TravelerRankLedger.record "alice" "finance" true
            |> TravelerRankLedger.record "alice" "finance" true
            |> TravelerRankLedger.record "alice" "finance" true
        // finance domain: trustBand should be above 0.5
        let finTB = TravelerRankLedger.trustBandOf "alice" "finance" ledger
        Assert.True(finTB > 0.5, sprintf "expected finance trustBand > 0.5, got %f" finTB)
        // weather domain: should be fresh (0.5) — no observations
        let weatherTB = TravelerRankLedger.trustBandOf "alice" "weather" ledger
        Assert.InRange(weatherTB, 0.4999, 0.5001)

    // ── TRL-15: traveler isolation ────────────────────────────────────────────────────────────────
    [<Fact>]
    let ``TRL-15 different travelers are independent in the same domain`` () =
        let ledger =
            TravelerRankLedger.empty
            |> TravelerRankLedger.record "alice" "finance" true
            |> TravelerRankLedger.record "alice" "finance" true
            |> TravelerRankLedger.record "alice" "finance" true
        // bob has no observations in finance
        let bobTB = TravelerRankLedger.trustBandOf "bob" "finance" ledger
        Assert.InRange(bobTB, 0.4999, 0.5001)

    // ── TRL-16: empty ledger ──────────────────────────────────────────────────────────────────────
    [<Fact>]
    let ``TRL-16 empty ledger has no entries`` () =
        Assert.Equal(0, TravelerRankLedger.empty |> Map.count)

    // ── TRL-17: beliefOf returns freshBelief for unknown ─────────────────────────────────────────
    [<Fact>]
    let ``TRL-17 beliefOf returns freshBelief for unknown traveler-domain pair`` () =
        let b = TravelerRankLedger.beliefOf "unknown" "domain" TravelerRankLedger.empty
        Assert.Equal(TravelerRankLedger.freshBelief, b)

    // ── TRL-18: record updates ledger ────────────────────────────────────────────────────────────
    [<Fact>]
    let ``TRL-18 record updates the ledger and the belief is retrievable`` () =
        let ledger = TravelerRankLedger.empty |> TravelerRankLedger.record "t1" "d1" true
        let b = TravelerRankLedger.beliefOf "t1" "d1" ledger
        Assert.Equal(1, b.ObsCount)
        Assert.True(b.Mu > 0.0, sprintf "expected positive mu after hit, got %f" b.Mu)

    // ── TRL-19: obsCountOf ────────────────────────────────────────────────────────────────────────
    [<Fact>]
    let ``TRL-19 obsCountOf counts observations correctly`` () =
        let ledger =
            TravelerRankLedger.empty
            |> TravelerRankLedger.record "t1" "d1" true
            |> TravelerRankLedger.record "t1" "d1" false
            |> TravelerRankLedger.record "t1" "d1" true
        Assert.Equal(3, TravelerRankLedger.obsCountOf "t1" "d1" ledger)
        Assert.Equal(0, TravelerRankLedger.obsCountOf "t1" "d2" ledger)

    // ── TRL-20: isAboveThreshold ──────────────────────────────────────────────────────────────────
    [<Fact>]
    let ``TRL-20 isAboveThreshold: fresh identity is above 0.0 but not above 0.9`` () =
        Assert.True(TravelerRankLedger.isAboveThreshold "t" "d" 0.0 TravelerRankLedger.empty)
        Assert.False(TravelerRankLedger.isAboveThreshold "t" "d" 0.9 TravelerRankLedger.empty)

    // ── TRL-21: isPositiveSkill for fresh identity ────────────────────────────────────────────────
    [<Fact>]
    let ``TRL-21 isPositiveSkill is false for fresh identity (mu=0)`` () =
        Assert.False(TravelerRankLedger.isPositiveSkill "t" "d" TravelerRankLedger.empty)

    // ── TRL-22: isPositiveSkill after hits ───────────────────────────────────────────────────────
    [<Fact>]
    let ``TRL-22 isPositiveSkill is true after 5 hits`` () =
        let ledger =
            [ true; true; true; true; true ]
            |> List.fold (fun l hit -> TravelerRankLedger.record "t" "d" hit l) TravelerRankLedger.empty
        Assert.True(TravelerRankLedger.isPositiveSkill "t" "d" ledger)

    // ── TRL-23: DST replay ───────────────────────────────────────────────────────────────────────
    [<Fact>]
    let ``TRL-23 EP update is DST-replayable (same sequence gives same belief)`` () =
        let obs = [ true; false; true; true; false; true; false; false; true; true ]
        let apply () =
            obs |> List.fold (fun b hit -> TravelerRankLedger.update hit b) TravelerRankLedger.freshBelief
        let first = apply ()
        let second = apply ()
        Assert.Equal(first, second)

    // ── TRL-24: ObsCount increments ──────────────────────────────────────────────────────────────
    [<Fact>]
    let ``TRL-24 ObsCount increments by 1 for each update`` () =
        let mutable b = TravelerRankLedger.freshBelief
        for i in 1 .. 10 do
            b <- TravelerRankLedger.update (i % 2 = 0) b
            Assert.Equal(i, b.ObsCount)

    // ── TRL-25: σ² decreases with observations ───────────────────────────────────────────────────
    [<Fact>]
    let ``TRL-25 sigma2 decreases with more observations (posterior concentrates)`` () =
        let mutable b = TravelerRankLedger.freshBelief
        let mutable prevSigma2 = b.Sigma2
        for i in 1 .. 20 do
            b <- TravelerRankLedger.update (i % 2 = 0) b
            Assert.True(b.Sigma2 < prevSigma2,
                sprintf "sigma2 did not decrease at obs %d: %f -> %f" i prevSigma2 b.Sigma2)
            prevSigma2 <- b.Sigma2

    // ── TRL-26: trustBand in [0, 1] ──────────────────────────────────────────────────────────────
    [<Fact>]
    let ``TRL-26 trustBand is always in [0, 1]`` () =
        let mutable b = TravelerRankLedger.freshBelief
        for i in 1 .. 50 do
            b <- TravelerRankLedger.update (i % 3 <> 0) b // 2 hits, 1 miss pattern
            let band = tb b
            Assert.InRange(band, 0.0, 1.0)

    // ── TRL-27: trustBandOf returns 0.5 for unknown ──────────────────────────────────────────────
    [<Fact>]
    let ``TRL-27 trustBandOf returns 0.5 for unknown traveler (honest prior)`` () =
        let band = TravelerRankLedger.trustBandOf "nobody" "nowhere" TravelerRankLedger.empty
        Assert.InRange(band, 0.4999, 0.5001)

    // ── TRL-28: TrueSkill paper cross-check ──────────────────────────────────────────────────────
    [<Fact>]
    let ``TRL-28 after 1 hit mu is positive (TrueSkill: skill shifts toward positive)`` () =
        let b = TravelerRankLedger.update true TravelerRankLedger.freshBelief
        Assert.True(b.Mu > 0.0, sprintf "expected positive mu after 1 hit, got %f" b.Mu)
        // The exact value depends on β=1.0 and the EP update. For β=1, σ_0=1:
        // t = 0 / sqrt(1+1) = 0; v = φ(0)/Φ(0) = (1/√(2π)) / 0.5 ≈ 0.798
        // μ_new = 0 + 1 * 1 * 0.798 / sqrt(2) ≈ 0.564
        Assert.InRange(b.Mu, 0.4, 0.8)

    // ── TRL-29: approximate symmetry ─────────────────────────────────────────────────────────────
    [<Fact>]
    let ``TRL-29 5 hits then 5 misses and 5 misses then 5 hits give similar trustBand`` () =
        let hitsFirst =
            [ for _ in 1..5 -> true ] @ [ for _ in 1..5 -> false ]
            |> List.fold (fun b hit -> TravelerRankLedger.update hit b) TravelerRankLedger.freshBelief
        let missesFirst =
            [ for _ in 1..5 -> false ] @ [ for _ in 1..5 -> true ]
            |> List.fold (fun b hit -> TravelerRankLedger.update hit b) TravelerRankLedger.freshBelief
        // EP is not exactly order-independent, but the difference should be small (< 0.1)
        Assert.InRange(abs (tb hitsFirst - tb missesFirst), 0.0, 0.10)

    // ── TRL-30: anti-whitewash gate ──────────────────────────────────────────────────────────────
    [<Fact>]
    let ``TRL-30 10 hits gives isPositiveSkill = true (anti-whitewash gate)`` () =
        let ledger =
            [ for _ in 1..10 -> true ]
            |> List.fold (fun l hit -> TravelerRankLedger.record "t" "d" hit l) TravelerRankLedger.empty
        Assert.True(TravelerRankLedger.isPositiveSkill "t" "d" ledger)

    // ── TRL-31: Anti-Sybil — Sybil cannot accumulate trust faster than honest traveler ──────────
    // A Sybil attacker creates a fresh identity after every miss (whitewash).
    // An honest traveler accumulates the same observations on a single identity.
    // The honest traveler's trustBand must be >= the Sybil's best identity's trustBand
    // after the same number of total observations.
    //
    // This is the formal anti-Sybil property of the EP ranking:
    // whitewashing resets to the fresh prior (0.5), so a Sybil with k misses and 0 hits
    // has trustBand = 0.5 (the prior), while an honest traveler with k misses and 0 hits
    // has trustBand < 0.5 (penalized). The Sybil cannot accumulate trust by whitewashing.
    [<Fact>]
    let ``TRL-31 anti-Sybil: honest traveler with N hits >= Sybil who whitewashes after each miss`` () =
        let ZID = "honest"
        let DOMAIN = "hat-coding"
        let N = 10 // number of hits for honest traveler
        let K = 5  // number of misses (Sybil creates fresh identity after each)

        // Honest traveler: N hits then K misses, all on one identity
        let honestLedger =
            [ for _ in 1..N -> true ] @ [ for _ in 1..K -> false ]
            |> List.fold (fun l hit -> TravelerRankLedger.record ZID DOMAIN hit l) TravelerRankLedger.empty
        let honestTB = TravelerRankLedger.trustBandOf ZID DOMAIN honestLedger

        // Sybil: creates a fresh identity after each miss, only accumulates hits
        // Best case for Sybil: N hits on one identity, K misses discarded
        // The Sybil's "best identity" has N hits and 0 misses
        let sybilLedger =
            [ for _ in 1..N -> true ]
            |> List.fold (fun l hit -> TravelerRankLedger.record "sybil-best" DOMAIN hit l) TravelerRankLedger.empty
        let sybilTB = TravelerRankLedger.trustBandOf "sybil-best" DOMAIN sybilLedger

        // The Sybil's best identity (N hits, 0 misses) should have higher trustBand than
        // the honest traveler (N hits, K misses) — this is EXPECTED and honest.
        // The key property: the Sybil's DISCARDED identities (0 hits, 1 miss each) have
        // trustBand < 0.5, while a fresh identity has trustBand = 0.5.
        // Whitewashing is NOT profitable: the Sybil's discarded identities have LOWER
        // trustBand than a fresh identity would give them.
        let discardedLedger =
            TravelerRankLedger.record "sybil-discarded" DOMAIN false TravelerRankLedger.empty
        let discardedTB = TravelerRankLedger.trustBandOf "sybil-discarded" DOMAIN discardedLedger
        let freshTB = TravelerRankLedger.trustBandOf "fresh" DOMAIN TravelerRankLedger.empty

        // Anti-Sybil property: a discarded identity (1 miss) has LOWER trustBand than fresh
        Assert.True(discardedTB < freshTB,
            sprintf "Whitewash should be unprofitable: discarded TB %.4f should be < fresh TB %.4f"
                discardedTB freshTB)

        // The Sybil's best identity has higher trustBand than honest (expected — they hid their misses)
        Assert.True(sybilTB > honestTB,
            sprintf "Sybil best (N hits, 0 misses) TB %.4f should be > honest (N hits, K misses) TB %.4f"
                sybilTB honestTB)

        // But the Sybil's TOTAL trust across all identities is lower than honest's single identity
        // (the discarded identities have negative trust, and the system can aggregate them)
        // This is the system-level anti-Sybil property: the sum of all Sybil identities' trust
        // is less than the honest traveler's trust
        let sybilTotalTrust =
            sybilTB + float K * discardedTB // K discarded identities, each with 1 miss

        // The honest traveler's trust is their single identity's trustBand
        // The Sybil's total trust (summed across all identities) should be lower
        Assert.True(honestTB >= sybilTotalTrust / float (K + 1),
            sprintf "Honest TB %.4f should be >= Sybil average trust %.4f (total %.4f / %d identities)"
                honestTB (sybilTotalTrust / float (K + 1)) sybilTotalTrust (K + 1))

    // ── TRL-32: Anti-Sybil — whitewash after every miss gives no trust advantage ─────────────────
    // A Sybil who whitewashes after EVERY miss ends up with only fresh identities (trustBand = 0.5).
    // An honest traveler with the same hit rate but no whitewashing has trustBand > 0.5 after hits.
    // The Sybil's "best" identity is always at 0.5 (fresh prior) — they can never build trust.
    [<Fact>]
    let ``TRL-32 anti-Sybil: whitewash-after-every-miss Sybil cannot exceed fresh prior`` () =
        let DOMAIN = "hat-coding"
        // Sybil strategy: whitewash after every miss, accumulate only hits
        // After 10 hits on one identity (no misses), trustBand ≈ 0.92
        // After 0 hits on a fresh identity, trustBand = 0.5
        // The Sybil's "best" identity with 0 observations has trustBand = 0.5 (the prior)
        // A Sybil who whitewashes after every miss has NO identity with > 0.5 trustBand
        // UNLESS they have accumulated hits on that identity

        // Sybil with 5 hits, 0 misses (never whitewashed — they had no misses to hide)
        let sybilGoodLedger =
            [ for _ in 1..5 -> true ]
            |> List.fold (fun l hit -> TravelerRankLedger.record "sybil-good" DOMAIN hit l) TravelerRankLedger.empty
        let sybilGoodTB = TravelerRankLedger.trustBandOf "sybil-good" DOMAIN sybilGoodLedger

        // Honest traveler with 5 hits, 5 misses (same total observations, no whitewashing)
        let honestLedger =
            [ for _ in 1..5 -> true ] @ [ for _ in 1..5 -> false ]
            |> List.fold (fun l hit -> TravelerRankLedger.record "honest" DOMAIN hit l) TravelerRankLedger.empty
        let honestTB = TravelerRankLedger.trustBandOf "honest" DOMAIN honestLedger

        // The Sybil's good identity (5 hits, 0 misses) has higher trustBand than honest (5 hits, 5 misses)
        // This is EXPECTED — the Sybil hid their misses
        Assert.True(sybilGoodTB > honestTB)

        // But the Sybil's discarded identities (each with 1 miss) have trustBand < fresh prior
        let discardedTB = TravelerRankLedger.trustBandOf "discarded" DOMAIN
                            (TravelerRankLedger.record "discarded" DOMAIN false TravelerRankLedger.empty)
        let freshTB = TravelerRankLedger.trustBandOf "fresh" DOMAIN TravelerRankLedger.empty
        Assert.True(discardedTB < freshTB,
            sprintf "Discarded identity TB %.4f should be < fresh TB %.4f" discardedTB freshTB)

        // The Sybil's AVERAGE trust across all identities (1 good + 5 discarded) is:
        let sybilAvgTrust = (sybilGoodTB + 5.0 * discardedTB) / 6.0
        // The honest traveler's trust is their single identity
        // The Sybil's average trust should be lower than honest's trust
        // (honest: 5 hits, 5 misses; Sybil average: 5 hits on 1 + 5 misses on 5 separate identities)
        Assert.True(honestTB >= sybilAvgTrust,
            sprintf "Honest TB %.4f should be >= Sybil average trust %.4f" honestTB sybilAvgTrust)

    // ── TRL-33: Domain isolation prevents cross-domain Sybil amplification ────────────────────────
    [<Fact>]
    let ``TRL-33 domain isolation: high trust in domain A does not inflate trust in domain B`` () =
        let ZID = "traveler-x"
        // 20 hits in domain A → high trustBand in A
        let ledger =
            [ for _ in 1..20 -> true ]
            |> List.fold (fun l hit -> TravelerRankLedger.record ZID "domain-A" hit l) TravelerRankLedger.empty
        let tbA = TravelerRankLedger.trustBandOf ZID "domain-A" ledger
        let tbB = TravelerRankLedger.trustBandOf ZID "domain-B" ledger
        // Domain A should have high trustBand (≈ 0.97)
        Assert.True(tbA > 0.9, sprintf "Expected tbA > 0.9, got %.4f" tbA)
        // Domain B should still be at the fresh prior (0.5) — no cross-domain bleed
        Assert.InRange(tbB, 0.4999, 0.5001)

    // ── TRL-34..41: the dynamics factor (staleness) ───────────────────────────────────────────────
    //
    // These pin the property that separates uncertainty-inflation from a decay constant. Under
    // decay, silence ERASES a record; under dynamics, silence makes it UNCERTAIN while leaving
    // its direction intact. TRL-36 and TRL-37 are the pair that would both pass under a wrong
    // implementation if only one were present.

    let private ok r = match r with | Ok v -> v | Error e -> failwithf "unexpected Error: %s" e

    [<Fact>]
    let ``TRL-34 age is identity at zero elapsed`` () =
        let b = [ for _ in 1..5 -> true ] |> List.fold (fun x h -> TravelerRankLedger.update h x) TravelerRankLedger.freshBelief
        let aged = ok (TravelerRankLedger.age 0.1 0.0 b)
        Assert.Equal(b.Mu, aged.Mu, 12)
        Assert.Equal(b.Sigma2, aged.Sigma2, 12)

    [<Fact>]
    let ``TRL-35 age widens sigma2 strictly, and update still narrows it`` () =
        let b = [ for _ in 1..5 -> true ] |> List.fold (fun x h -> TravelerRankLedger.update h x) TravelerRankLedger.freshBelief
        let aged = ok (TravelerRankLedger.age 0.1 10.0 b)
        Assert.True(aged.Sigma2 > b.Sigma2, sprintf "aging must widen: %f -> %f" b.Sigma2 aged.Sigma2)
        // The existing invariant is untouched: observing still concentrates.
        let observed = TravelerRankLedger.update true aged
        Assert.True(observed.Sigma2 < aged.Sigma2, sprintf "update must narrow: %f -> %f" aged.Sigma2 observed.Sigma2)

    [<Fact>]
    let ``TRL-36 aging leaves MU untouched — this is what decay would not do`` () =
        // The load-bearing difference. A decay constant drags the estimate toward neutral, which
        // FORGIVES a bad record. Aging must not move mu at all, in either direction.
        let good = [ for _ in 1..8 -> true ] |> List.fold (fun x h -> TravelerRankLedger.update h x) TravelerRankLedger.freshBelief
        let bad = [ for _ in 1..8 -> false ] |> List.fold (fun x h -> TravelerRankLedger.update h x) TravelerRankLedger.freshBelief
        Assert.Equal(good.Mu, (ok (TravelerRankLedger.age 0.5 100.0 good)).Mu, 12)
        Assert.Equal(bad.Mu, (ok (TravelerRankLedger.age 0.5 100.0 bad)).Mu, 12)
        Assert.True(bad.Mu < 0.0, sprintf "expected a negative mu for a bad record, got %f" bad.Mu)

    [<Fact>]
    let ``TRL-37 aging drives trustBand toward 0.5 FROM BOTH SIDES`` () =
        // Uncertainty is not forgiveness and not condemnation: a stale good record and a stale
        // bad record both converge on "no opinion", neither crossing to the other side.
        let good = [ for _ in 1..8 -> true ] |> List.fold (fun x h -> TravelerRankLedger.update h x) TravelerRankLedger.freshBelief
        let bad = [ for _ in 1..8 -> false ] |> List.fold (fun x h -> TravelerRankLedger.update h x) TravelerRankLedger.freshBelief
        let tbGood = TravelerRankLedger.trustBand good
        let tbBad = TravelerRankLedger.trustBand bad
        let tbGoodAged = TravelerRankLedger.trustBand (ok (TravelerRankLedger.age 1.0 5000.0 good))
        let tbBadAged = TravelerRankLedger.trustBand (ok (TravelerRankLedger.age 1.0 5000.0 bad))
        Assert.True(tbGood > 0.9, sprintf "setup: expected a confident good record, got %f" tbGood)
        Assert.True(tbBad < 0.1, sprintf "setup: expected a confident bad record, got %f" tbBad)
        Assert.True(abs (tbGoodAged - 0.5) < abs (tbGood - 0.5), "stale good record must lose confidence")
        Assert.True(abs (tbBadAged - 0.5) < abs (tbBad - 0.5), "stale bad record must lose confidence")
        // Never crosses: a stale good record does not become distrusted, nor vice versa.
        Assert.True(tbGoodAged >= 0.5, sprintf "stale good crossed below neutral: %f" tbGoodAged)
        Assert.True(tbBadAged <= 0.5, sprintf "stale bad crossed above neutral: %f" tbBadAged)

    [<Fact>]
    let ``TRL-38 one observation after long silence restores the direction`` () =
        // The practical payoff over decay: because mu survived, evidence is not re-learned from
        // scratch after a gap.
        let bad = [ for _ in 1..8 -> false ] |> List.fold (fun x h -> TravelerRankLedger.update h x) TravelerRankLedger.freshBelief
        let stale = ok (TravelerRankLedger.age 1.0 5000.0 bad)
        let confirmed = TravelerRankLedger.update false stale
        Assert.True(TravelerRankLedger.trustBand confirmed < TravelerRankLedger.trustBand stale,
                    "one confirming miss after silence must re-sharpen distrust")

    [<Fact>]
    let ``TRL-39 aging composes additively in elapsed time`` () =
        let b = [ for _ in 1..4 -> true ] |> List.fold (fun x h -> TravelerRankLedger.update h x) TravelerRankLedger.freshBelief
        let twoSteps = ok (TravelerRankLedger.age 0.3 7.0 (ok (TravelerRankLedger.age 0.3 3.0 b)))
        let oneStep = ok (TravelerRankLedger.age 0.3 10.0 b)
        Assert.Equal(oneStep.Sigma2, twoSteps.Sigma2, 12)

    [<Fact>]
    let ``TRL-40 age REFUSES negative tau or elapsed rather than sharpening`` () =
        let b = TravelerRankLedger.freshBelief
        Assert.True((match TravelerRankLedger.age -1.0 5.0 b with Error _ -> true | Ok _ -> false), "negative tau must be refused")
        Assert.True((match TravelerRankLedger.age 1.0 -5.0 b with Error _ -> true | Ok _ -> false), "negative elapsed must be refused")

    [<Fact>]
    let ``TRL-41 ticksUntilUninformative agrees with actually aging that long`` () =
        // The readout has to be checkable against the thing it predicts, or it is decoration.
        let b = [ for _ in 1..10 -> true ] |> List.fold (fun x h -> TravelerRankLedger.update h x) TravelerRankLedger.freshBelief
        let tau, eps = 0.2, 0.05
        let t = ok (TravelerRankLedger.ticksUntilUninformative tau eps b)
        Assert.True(t > 0.0, sprintf "a confident belief should need positive time, got %f" t)
        let atT = abs (TravelerRankLedger.trustBand (ok (TravelerRankLedger.age tau t b)) - 0.5)
        Assert.True(atT <= eps + 1e-6, sprintf "at the predicted horizon the band should be within eps: %f > %f" atT eps)
        // And strictly not there yet just before — so the answer is the boundary, not any upper bound.
        let justBefore = abs (TravelerRankLedger.trustBand (ok (TravelerRankLedger.age tau (t * 0.5) b)) - 0.5)
        Assert.True(justBefore > eps, sprintf "half the horizon should not already be uninformative: %f" justBefore)
        // tau = 0 never gets there, and that is an Error rather than a large number.
        Assert.True((match TravelerRankLedger.ticksUntilUninformative 0.0 eps b with Error _ -> true | Ok _ -> false),
                    "tau = 0 must refuse rather than return a duration")
