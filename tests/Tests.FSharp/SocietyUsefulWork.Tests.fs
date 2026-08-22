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
