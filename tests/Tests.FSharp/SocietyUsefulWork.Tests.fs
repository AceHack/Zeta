module Zeta.Tests.SocietyUsefulWorkTests

open System
open global.Xunit
open FsCheck
open FsCheck.Xunit
open Zeta.Core

module SUW = Zeta.Core.SocietyUsefulWork

// Helper to create a fixed test fact array
let private testFacts : SUW.Fact[] = [|
    { Id = 1; Value = 10.0 }
    { Id = 2; Value = 25.0 }
    { Id = 3; Value = 5.0 }
|]

[<Fact>]
let ``expectedIndividual matches simple c * totalValue calculation`` () =
    let ind = SUW.expectedIndividual 0.5 testFacts
    Assert.Equal(20.0, ind) // 0.5 * (10 + 25 + 5) = 20.0

[<Fact>]
let ``expectedSocietyIdentical matches union probability calculation`` () =
    // c = 0.5, rho = 0.2, n = 3
    // E = [rho * c + (1 - rho) * (1 - (1 - c)^n)] * total
    // E = [0.2 * 0.5 + 0.8 * (1 - 0.125)] * 40.0
    // E = [0.1 + 0.8 * 0.875] * 40.0
    // E = [0.1 + 0.7] * 40.0 = 0.8 * 40.0 = 32.0
    let soc = SUW.expectedSocietyIdentical 3 0.5 0.2 testFacts
    Assert.Equal(32.0, soc)

[<Property>]
let ``expectedGain is strictly positive when c is in (0, 1) and rho < 1`` (n: int) (c: float) (rho: float) =
    if Double.IsFinite c && Double.IsFinite rho then
        let n = abs n % 10 + 2 // 2 .. 11
        let c = abs c
        let c = if c > 1.0 then c % 1.0 else c
        let rho = abs rho
        let rho = if rho > 1.0 then rho % 1.0 else rho
        
        // Ensure that c and rho are computationally distinct from the boundary values 0.0 and 1.0
        // in double precision arithmetic to avoid floating-point underflow to 0.0.
        if c > 0.0 && (1.0 - c) > 0.0 && (1.0 - c) < 1.0 && (1.0 - rho) > 0.0 then
            let gain = SUW.expectedGain n c rho testFacts
            gain > 0.0
        else
            true
    else
        true

[<Property>]
let ``expectedGain collapses to zero when rho = 1 or c = 0 or c = 1`` (n: int) (c: float) (rho: float) =
    if Double.IsFinite c && Double.IsFinite rho then
        let n = abs n % 10 + 2
        let c = abs c
        let c = if c > 1.0 then c % 1.0 else c
        let rho = abs rho
        let rho = if rho > 1.0 then rho % 1.0 else rho
        
        let gainAtRho1 = SUW.expectedGain n c 1.0 testFacts
        let gainAtC0 = SUW.expectedGain n 0.0 rho testFacts
        let gainAtC1 = SUW.expectedGain n 1.0 rho testFacts
        
        gainAtRho1 = 0.0 && gainAtC0 = 0.0 && gainAtC1 = 0.0
    else
        true

[<Fact>]
let ``heterogeneous simulation matches analytic identical values at boundary`` () =
    let n = 4
    let c = 0.3
    let rho = 0.0 // independent
    let competences = Array.create n c
    
    // Run simulation
    let simVal = SUW.simulateHeterogeneous n competences rho testFacts 10000 42UL
    let analyticVal = SUW.expectedSocietyIdentical n c rho testFacts
    
    // Check they are close (allowing a statistical margin of error for 10000 runs)
    let diff = abs (simVal - analyticVal)
    Assert.True(diff < 1.0, sprintf "simVal: %f, analyticVal: %f, diff: %f" simVal analyticVal diff)

[<Fact>]
let ``heterogeneous simulation shows society exceeds best individual agent under low rho`` () =
    let n = 3
    let competences = [| 0.4; 0.5; 0.3 |] // heterogeneous competences (best is 0.5)
    let rho = 0.1
    
    let bestInd = SUW.expectedIndividual 0.5 testFacts // best agent's expected work
    let simVal = SUW.simulateHeterogeneous n competences rho testFacts 10000 99UL
    
    Assert.True(simVal > bestInd, sprintf "Society work %f should exceed best individual expected work %f" simVal bestInd)

// ── Effective sample size: the two counts, and why both exist ───────────────────────────────────
//
// These pin `effectiveTrialCount` (Kish) and `unionEquivalentAgentCount` (the exact inverse of the
// shipped union formula) AGAINST `expectedSocietyIdentical` rather than against restated algebra,
// so a change to the shipped formula breaks them. The final test asserts the two counts DISAGREE
// in the interior — without it, the whole pair could collapse to one function and every other test
// here would still pass.

[<Fact>]
let ``effectiveTrialCount is n when runs are independent`` () =
    Assert.Equal(10.0, SUW.effectiveTrialCount 10 0.0, 12)

[<Fact>]
let ``effectiveTrialCount collapses to one when runs are perfectly correlated`` () =
    // The whole point: ten runs of a perfectly-correlated config is ONE observation.
    Assert.Equal(1.0, SUW.effectiveTrialCount 10 1.0, 12)

[<Fact>]
let ``effectiveTrialCount is monotonically decreasing in rho`` () =
    let counts = [ 0.0; 0.25; 0.5; 0.75; 1.0 ] |> List.map (SUW.effectiveTrialCount 10)
    counts
    |> List.pairwise
    |> List.iter (fun (a, b) -> Assert.True(b < a, sprintf "expected strictly decreasing, got %f then %f" a b))

[<Fact>]
let ``unionEquivalentAgentCount agrees with the shipped union formula at both endpoints`` () =
    let n = 10
    let c = 0.3
    // rho = 0: the society formula IS the independent union, so the equivalent count is n.
    Assert.Equal(double n, SUW.unionEquivalentAgentCount n c 0.0, 8)
    // rho = 1: the society formula reduces to a single agent, so the equivalent count is 1.
    Assert.Equal(1.0, SUW.unionEquivalentAgentCount n c 1.0, 8)

[<Fact>]
let ``unionEquivalentAgentCount inverts expectedSocietyIdentical exactly`` () =
    // Round-trip against the SHIPPED function: feeding the equivalent count back in as an
    // independent (rho = 0) society must reproduce the correlated society's expected work.
    let n = 8
    let c = 0.25
    let rho = 0.4
    let correlated = SUW.expectedSocietyIdentical n c rho testFacts
    let m = SUW.unionEquivalentAgentCount n c rho
    let total = testFacts |> Array.sumBy (fun f -> f.Value)
    let reconstructed = (1.0 - Math.Pow(1.0 - c, m)) * total
    Assert.Equal(correlated, reconstructed, 8)

[<Fact>]
let ``the two effective counts disagree in the interior -- they answer different questions`` () =
    // Endpoints agree (tested above), so agreement alone would not discriminate. If these two
    // ever coincided across the interior, one of them would be redundant and the distinction this
    // module documents would be fictional.
    let n = 10
    let c = 0.3
    let rho = 0.5
    let kish = SUW.effectiveTrialCount n rho
    let union = SUW.unionEquivalentAgentCount n c rho
    Assert.True(abs (kish - union) > 0.5,
                sprintf "expected the two counts to differ materially; kish=%f union=%f" kish union)

[<Fact>]
let ``degenerate competence has no finite union-equivalent count`` () =
    Assert.Equal(0.0, SUW.unionEquivalentAgentCount 10 0.0 0.5, 12)
    Assert.Equal(0.0, SUW.unionEquivalentAgentCount 10 1.0 0.5, 12)
