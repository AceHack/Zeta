namespace Zeta.Bayesian.Tests

open System
open Xunit
open FsCheck
open FsCheck.Xunit
open Zeta.Bayesian

module InformationValueTests =

    [<Fact>]
    let ``IV-1: Identical prior and posterior yields zero IV (no new information)`` () =
        let prior = { Gaussian.PrecisionMean = 1.0; Precision = 2.0 }
        let posterior = prior
        let iv = InformationValue.compute prior posterior
        Assert.True(float iv < 1e-10, "IV should be zero when posterior equals prior")

    [<Fact>]
    let ``IV-2: Message with zero precision yields zero IV`` () =
        let prior = { Gaussian.PrecisionMean = 1.0; Precision = 2.0 }
        let emptyMessage = { Gaussian.PrecisionMean = 0.0; Precision = 0.0 }
        let iv = InformationValue.valueOfMessage prior emptyMessage
        Assert.True(float iv < 1e-10, "Zero-precision message should yield zero IV")

    [<Property>]
    let ``IV-3: IV is strictly non-negative`` (m1: NormalFloat, p1: NormalFloat, m2: NormalFloat, p2: NormalFloat) =
        // Ensure precisions are strictly positive
        let prec1 = abs (float p1) + 0.1
        let prec2 = abs (float p2) + 0.1
        
        let prior = { Gaussian.PrecisionMean = float m1 * prec1; Precision = prec1 }
        let message = { Gaussian.PrecisionMean = float m2 * prec2; Precision = prec2 }
        
        let iv = InformationValue.valueOfMessage prior message
        float iv >= 0.0

    [<Fact>]
    let ``IV-4: Higher precision message yields higher IV (monotonicity of precision gain)`` () =
        let prior = { Gaussian.PrecisionMean = 0.0; Precision = 1.0 }
        
        // Two messages with same mean but different precisions
        let msgLow = { Gaussian.PrecisionMean = 0.0; Precision = 1.0 }
        let msgHigh = { Gaussian.PrecisionMean = 0.0; Precision = 10.0 }
        
        let ivLow = InformationValue.valueOfMessage prior msgLow
        let ivHigh = InformationValue.valueOfMessage prior msgHigh
        
        Assert.True(ivHigh > ivLow, "Higher precision message should yield higher IV")

    [<Fact>]
    let ``IV-5: Mean shift yields higher IV (surprise factor)`` () =
        let prior = { Gaussian.PrecisionMean = 0.0; Precision = 1.0 } // mu = 0
        
        // Two messages with same precision, one agrees with prior, one contradicts
        let msgAgree = { Gaussian.PrecisionMean = 0.0; Precision = 1.0 } // mu = 0
        let msgContradict = { Gaussian.PrecisionMean = 10.0; Precision = 1.0 } // mu = 10
        
        let ivAgree = InformationValue.valueOfMessage prior msgAgree
        let ivContradict = InformationValue.valueOfMessage prior msgContradict
        
        Assert.True(ivContradict > ivAgree, "Contradicting message (mean shift) should yield higher IV")

    [<Fact>]
    let ``IV-6: Reticulum Condorcet bonus amplifies IV based on latency`` () =
        let baseIv = 10.0<InformationValue.iv>
        
        let ivZeroLatency = InformationValue.valueOfLink baseIv 0.0
        let ivLowLatency = InformationValue.valueOfLink baseIv 1.0 // L=1 -> bonus 0.5
        let ivHighLatency = InformationValue.valueOfLink baseIv 9.0 // L=9 -> bonus 0.9
        
        Assert.Equal(10.0, float ivZeroLatency)
        Assert.Equal(15.0, float ivLowLatency)
        Assert.Equal(19.0, float ivHighLatency)
        
        Assert.True(ivHighLatency > ivLowLatency, "Higher latency should yield higher Condorcet bonus")

    [<Fact>]
    let ``IV-7: Market clearing respects IV denomination`` () =
        let ask = { InformationValue.SellerId = "A"; InformationValue.MinPrice = 10.0<InformationValue.iv> }
        
        let bids = [
            { InformationValue.BuyerId = "B1"; InformationValue.MaxPrice = 5.0<InformationValue.iv> }
            { InformationValue.BuyerId = "B2"; InformationValue.MaxPrice = 12.0<InformationValue.iv> }
            { InformationValue.BuyerId = "B3"; InformationValue.MaxPrice = 15.0<InformationValue.iv> }
        ]
        
        let winner = InformationValue.clearMarket ask bids
        
        Assert.True(winner.IsSome)
        Assert.Equal("B3", winner.Value.BuyerId)
        Assert.Equal(15.0, float winner.Value.MaxPrice)
