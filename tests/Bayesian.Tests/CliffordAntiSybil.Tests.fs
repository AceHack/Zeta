namespace Zeta.Bayesian.Tests

open Xunit
open FsUnit.Xunit
open Zeta.Core
open Zeta.Bayesian

module CliffordAntiSybilTests =

    [<Fact>]
    let ``CAS-1: Identical streams have geometric correlation 1.0`` () =
        let streamA = 
            { AntiSybil.AgentId = "A"
              AntiSybil.Beliefs = [ 
                  { Gaussian.PrecisionMean = 1.0; Precision = 1.0 }
                  { Gaussian.PrecisionMean = 2.0; Precision = 2.0 }
                  { Gaussian.PrecisionMean = 3.0; Precision = 3.0 } 
              ] }
              
        let corr = CliffordAntiSybil.computeGeometricCorrelation streamA streamA
        Assert.True(abs(corr - 1.0) < 1e-6, $"Expected 1.0, got {corr}")

    [<Fact>]
    let ``CAS-2: Clones get zero uniqueness discount`` () =
        let streamA = 
            { AntiSybil.AgentId = "A"
              AntiSybil.Beliefs = [ 
                  { Gaussian.PrecisionMean = 1.0; Precision = 1.0 }
                  { Gaussian.PrecisionMean = 2.0; Precision = 2.0 }
              ] }
              
        let discount = CliffordAntiSybil.uniquenessDiscount streamA streamA
        Assert.True(abs(discount - 0.0) < 1e-6, $"Expected 0.0, got {discount}")

    [<Fact>]
    let ``CAS-3: Scaled trajectories are detected as highly correlated`` () =
        // A is the base trajectory
        let streamA = 
            { AntiSybil.AgentId = "A"
              AntiSybil.Beliefs = [ 
                  { Gaussian.PrecisionMean = 1.0; Precision = 1.0 }
                  { Gaussian.PrecisionMean = 2.0; Precision = 2.0 }
                  { Gaussian.PrecisionMean = 3.0; Precision = 3.0 } 
              ] }
              
        // B moves in the exact same direction but twice as fast (a scaled clone)
        let streamB = 
            { AntiSybil.AgentId = "B"
              AntiSybil.Beliefs = [ 
                  { Gaussian.PrecisionMean = 1.0; Precision = 1.0 }
                  { Gaussian.PrecisionMean = 3.0; Precision = 3.0 }
                  { Gaussian.PrecisionMean = 5.0; Precision = 5.0 } 
              ] }
              
        let corr = CliffordAntiSybil.computeGeometricCorrelation streamA streamB
        // The geometric correlation detects that the trajectory delta vectors point
        // in the exact same direction, so correlation should be 1.0
        Assert.True(abs(corr - 1.0) < 1e-6, $"Expected 1.0, got {corr}")
