namespace Zeta.Bayesian.Tests

open System
open Xunit
open FsCheck
open FsCheck.Xunit
open Zeta.Bayesian
open Zeta.Core

module AntiSybilTests =

    let makeBelief mean = { Gaussian.PrecisionMean = mean * 1.0; Precision = 1.0 }

    [<Fact>]
    let ``AS-1: Identical streams have correlation 1.0`` () =
        let stream = [ makeBelief 1.0; makeBelief 2.0; makeBelief 3.0; makeBelief 4.0 ]
        let rho = AntiSybil.computeCorrelation stream stream
        Assert.Equal(1.0, rho, 5)

    [<Fact>]
    let ``AS-2: Perfectly correlated streams yield zero IV (Hard Money Cap)`` () =
        let streamA = [ makeBelief 1.0; makeBelief 2.0; makeBelief 3.0; makeBelief 4.0 ]
        let streamB = [ makeBelief 1.0; makeBelief 2.0; makeBelief 3.0; makeBelief 4.0 ]
        
        let prior = makeBelief 0.0
        let newBelief = makeBelief 5.0
        
        let rawIv = InformationValue.compute prior newBelief
        Assert.True(float rawIv > 0.0, "Raw IV should be positive")
        
        let pricedIv = AntiSybil.priceAgainstReference prior newBelief streamA streamB
        Assert.Equal(0.0, float pricedIv, 5)

    [<Fact>]
    let ``AS-3: Uncorrelated streams yield full IV`` () =
        // Stream A goes up
        let streamA = [ makeBelief 1.0; makeBelief 2.0; makeBelief 3.0; makeBelief 4.0 ]
        // Stream B oscillates (uncorrelated to A's linear trend)
        let streamB = [ makeBelief 1.0; makeBelief -1.0; makeBelief 1.0; makeBelief -1.0 ]
        
        let prior = makeBelief 0.0
        let newBelief = makeBelief 5.0
        
        let rawIv = InformationValue.compute prior newBelief
        let pricedIv = AntiSybil.priceAgainstReference prior newBelief streamA streamB
        
        // Because they are uncorrelated (or anti-correlated), discount is 1.0 (no discount)
        Assert.True(float pricedIv >= float rawIv * 0.99, "Uncorrelated streams should yield near full IV")

    [<Fact>]
    let ``AS-4: Society pricing penalizes maximum correlation (Clone detection)`` () =
        let myStream = [ makeBelief 1.0; makeBelief 2.0; makeBelief 3.0 ]
        
        let independentAgent = { AntiSybil.StreamHistory.AgentId = "A1"; AntiSybil.StreamHistory.Beliefs = [ makeBelief -1.0; makeBelief -2.0; makeBelief -3.0 ] }
        let myClone = { AntiSybil.StreamHistory.AgentId = "A2"; AntiSybil.StreamHistory.Beliefs = [ makeBelief 1.0; makeBelief 2.0; makeBelief 3.0 ] }
        
        let prior = makeBelief 0.0
        let newBelief = makeBelief 4.0
        
        // Price against just the independent agent -> full IV
        let ivIndependent = AntiSybil.priceAgainstSociety prior newBelief myStream [ independentAgent ]
        Assert.True(float ivIndependent > 0.0)
        
        // Price against society containing my clone -> zero IV
        let ivWithClone = AntiSybil.priceAgainstSociety prior newBelief myStream [ independentAgent; myClone ]
        Assert.Equal(0.0, float ivWithClone, 5)

    [<Property>]
    let ``AS-5: Uniqueness discount is strictly bounded between 0 and 1`` (rho: float) =
        // Handle NaNs and Infinity
        let safeRho = if Double.IsNaN(rho) || Double.IsInfinity(rho) then 0.0 else rho
        let discount = AntiSybil.uniquenessDiscount safeRho
        discount >= 0.0 && discount <= 1.0
