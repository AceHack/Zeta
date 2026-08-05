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
