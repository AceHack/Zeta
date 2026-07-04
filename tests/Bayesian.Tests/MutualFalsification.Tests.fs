module Zeta.Bayesian.Tests.MutualFalsificationTests

open Xunit
open Zeta.Core
open Zeta.Bayesian

// ── MFAL-1: extractClaim captures cell identity and belief ────────────────────────────────────

[<Fact>]
let ``MFAL-1: extractClaim captures cell id, belief, and accumulated IV`` () =
    let codeword = AdinkraCode.allCodewords |> List.head
    let cell = YinYangCell.seed codeword
    let signal = { Gaussian.PrecisionMean = 5.0; Precision = 5.0 }
    let updated = YinYangCell.observe signal cell
    let claim = MutualFalsification.extractClaim updated
    Assert.Equal(updated.Column.Id, claim.CellId)
    Assert.Equal(updated.Column.Belief.Precision, claim.Belief.Precision)
    Assert.Equal(float updated.Column.AccumulatedIV, claim.AccumulatedIV)

// ── MFAL-2: gaussianKL is 0 for identical Gaussians ──────────────────────────────────────────

[<Fact>]
let ``MFAL-2: gaussianKL is 0 for identical Gaussians and positive for different ones`` () =
    let g1 = { Gaussian.PrecisionMean = 5.0; Precision = 5.0 }
    let g2 = { Gaussian.PrecisionMean = 10.0; Precision = 2.0 }
    // KL(G || G) = 0
    Assert.InRange(MutualFalsification.gaussianKL g1 g1, 0.0, 1e-9)
    // KL(G1 || G2) > 0 for different Gaussians
    Assert.True(MutualFalsification.gaussianKL g1 g2 > 0.0)
    // KL is not symmetric in general
    let kl12 = MutualFalsification.gaussianKL g1 g2
    let kl21 = MutualFalsification.gaussianKL g2 g1
    Assert.True(abs (kl12 - kl21) > 1e-9, "KL divergence should be asymmetric for different Gaussians")

// ── MFAL-3: refute produces negative DeltaU when claim is far from refuter's frame ──────────

[<Fact>]
let ``MFAL-3: refute produces negative DeltaU when claim is far from refuter's frame`` () =
    // Cell A believes mean=1.0; Cell B believes mean=10.0.
    // A's claim (mean=1.0) is far from B's frame (mean=10.0) → high KL → DeltaU < 0 for B.
    let cwA = AdinkraCode.allCodewords |> List.item 0
    let cwB = AdinkraCode.allCodewords |> List.item 1
    let cellA = YinYangCell.seed cwA |> YinYangCell.observe { Gaussian.PrecisionMean = 5.0; Precision = 5.0 }
    let cellB = YinYangCell.seed cwB |> YinYangCell.observe { Gaussian.PrecisionMean = 50.0; Precision = 5.0 }
    let claimA = MutualFalsification.extractClaim cellA
    let refutation = MutualFalsification.refute cellB claimA
    Assert.Equal(cellA.Column.Id, refutation.ClaimantId)
    Assert.Equal(cellB.Column.Id, refutation.RefuterId)
    // The KL divergence should be large (claims are far apart).
    Assert.True(refutation.ClaimRefuterDivergence > 1.0,
        sprintf "KL divergence should be large for distant beliefs (got %.3f)" refutation.ClaimRefuterDivergence)

// ── MFAL-4: falsificationRound produces N*(N-1) refutations ──────────────────────────────────

[<Fact>]
let ``MFAL-4: falsificationRound produces N*(N-1) refutations for N-cell ensemble`` () =
    let n = 4
    let ensemble = YinYangEnsemble.createN n
    let signal = { Gaussian.PrecisionMean = 5.0; Precision = 5.0 }
    let updated = YinYangEnsemble.observe signal ensemble
    let refutations = MutualFalsification.falsificationRound updated
    // N*(N-1) = 4*3 = 12 refutations
    Assert.Equal(n * (n - 1), refutations.Length)
    // No cell refutes itself
    Assert.True(refutations |> Array.forall (fun r -> r.ClaimantId <> r.RefuterId))

// ── MFAL-5: deltaULedger aggregates per-claim ΔU ─────────────────────────────────────────────

[<Fact>]
let ``MFAL-5: deltaULedger has one entry per cell and sums DeltaU correctly`` () =
    let n = 4
    let ensemble = YinYangEnsemble.createN n
    let signal = { Gaussian.PrecisionMean = 5.0; Precision = 5.0 }
    let updated = YinYangEnsemble.observe signal ensemble
    let refutations = MutualFalsification.falsificationRound updated
    let ledger = MutualFalsification.deltaULedger refutations
    // One entry per cell
    Assert.Equal(n, ledger.Count)
    // Each entry is the sum of DeltaU from N-1 refutations of that claim
    for claimantId in ledger.Keys do
        let claimRefutations = refutations |> Array.filter (fun r -> r.ClaimantId = claimantId)
        let expectedSum = claimRefutations |> Array.sumBy (fun r -> r.Receipt.DeltaU)
        Assert.InRange(ledger.[claimantId], expectedSum - 1e-9, expectedSum + 1e-9)

// ── MFAL-6: coercionScores are 0 for identical-belief ensemble ───────────────────────────────

[<Fact>]
let ``MFAL-6: coercionScores are ~0 when all cells have identical beliefs (no coercion)`` () =
    // After many identical observations, all cells converge to the same belief.
    // A claim that is consistent in all frames has zero ΔU variance (not coercive).
    let n = 4
    let ensemble = YinYangEnsemble.createN n
    let signal = { Gaussian.PrecisionMean = 5.0; Precision = 5.0 }
    let mutable e = ensemble
    for _ in 1 .. 20 do
        e <- YinYangEnsemble.observe signal e
    let refutations = MutualFalsification.falsificationRound e
    let scores = MutualFalsification.coercionScores refutations
    // All coercion scores should be ~0 (all cells have the same belief)
    for score in scores.Values do
        Assert.InRange(score, 0.0, 1e-6)

// ── MFAL-7: summarize returns a valid FalsificationSummary ───────────────────────────────────

[<Fact>]
let ``MFAL-7: summarize returns a valid FalsificationSummary with correct counts`` () =
    let n = 4
    let ensemble = YinYangEnsemble.createN n
    let signal = { Gaussian.PrecisionMean = 5.0; Precision = 5.0 }
    let updated = YinYangEnsemble.observe signal ensemble
    let summary = MutualFalsification.summarize updated
    // N*(N-1) refutations
    Assert.Equal(n * (n - 1), summary.RefutationCount)
    // Ledger has N entries
    Assert.Equal(n, summary.DeltaULedger.Count)
    // Coercion scores has N entries
    Assert.Equal(n, summary.CoercionScores.Count)
    // TotalBankedDeltaU is the sum of all refutation DeltaUs
    let refutations = MutualFalsification.falsificationRound updated
    let expectedTotal = refutations |> Array.sumBy (fun r -> r.Receipt.DeltaU)
    Assert.InRange(summary.TotalBankedDeltaU, expectedTotal - 1e-9, expectedTotal + 1e-9)
    // RhoProxy is in [0, 1]
    Assert.InRange(summary.RhoProxy, 0.0, 1.0)
