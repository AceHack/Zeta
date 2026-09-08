module Zeta.Bayesian.Tests.PrecisionGateKernelsTests

open System
open Xunit
open Zeta.Bayesian

let private accepted result =
    match result with
    | Ok value -> value
    | Error feedback -> failwithf "Expected accepted value, got %A" feedback

let private refused result =
    match result with
    | Error _ -> ()
    | Ok value -> failwithf "Expected refusal, got %A" value

let private near expected actual tolerance =
    Assert.True(Double.IsFinite actual && abs (actual - expected) <= tolerance,
                $"Expected {expected}, got {actual}, tolerance {tolerance}")

let private moments mean variance : PrecisionGateKernels.RealMoments = { Mean = mean; Variance = variance }
let private gamma power rate : PrecisionGateKernels.GammaKernel = { LogPower = power; Rate = rate }
let private gaussian eta precision : Gaussian = { PrecisionMean = eta; Precision = precision }
let private target t u k c : PrecisionGateKernels.ProjectionTarget =
    { Precision = t; Location = u; Linear = k; ExponentialRate = c }

[<Fact>]
let ``soft dot keeps both uncertain multiplicands and half precision rate`` () =
    let result =
        PrecisionGateKernels.trySoftDotVmp (moments 2.0 3.0) (moments 4.0 5.0) (moments 7.0 2.0) 2.0
        |> accepted
    Assert.Equal(86.0, result.ResidualSecondMoment)
    Assert.Equal(gamma 0.5 43.0, result.ToTau)
    Assert.Equal(gaussian 56.0 42.0, result.ToWeight)
    Assert.Equal(gaussian 28.0 14.0, result.ToInput)
    Assert.Equal(gaussian 16.0 2.0, result.ToZ)

[<Fact>]
let ``independent second soft dot witness discriminates omitted input variance`` () =
    let result =
        PrecisionGateKernels.trySoftDotVmp (moments 2.0 5.0) (moments 3.0 7.0) (moments 11.0 13.0) 1.0
        |> accepted
    Assert.Equal(146.0, result.ResidualSecondMoment)
    Assert.Equal(73.0, result.ToTau.Rate)
    Assert.Equal(gaussian 33.0 16.0, result.ToWeight)

[<Fact>]
let ``clamped zero input yields a neutral weight site and improper precision site`` () =
    let result =
        PrecisionGateKernels.trySoftDotVmp (moments 2.0 3.0) (moments 0.0 0.0) (moments 0.0 0.0) 2.0
        |> accepted
    Assert.Equal(Gaussian.One, result.ToWeight)
    Assert.Equal(gamma 0.5 0.0, result.ToTau)
    PrecisionGateKernels.tryGammaMoments result.ToTau |> refused
    let posterior =
        PrecisionGateKernels.tryGammaProduct (gamma 0.0 1.0) result.ToTau
        |> accepted
        |> PrecisionGateKernels.tryGammaMoments
        |> accepted
    Assert.Equal(1.5, posterior.RepresentedShape)
    Assert.Equal(1.5, posterior.Mean)

[<Fact>]
let ``normal precision rule retains both independent marginal variances`` () =
    let result =
        PrecisionGateKernels.tryNormalPrecisionVmp (moments 7.0 2.0) (moments 8.0 3.0) 2.0
        |> accepted
    Assert.Equal(6.0, result.ResidualSecondMoment)
    Assert.Equal(gaussian 16.0 2.0, result.ToY)
    Assert.Equal(gaussian 14.0 2.0, result.ToMean)
    Assert.Equal(gamma 0.5 3.0, result.ToPrecision)

[<Fact>]
let ``reverse Gamma rate site increments the prior by alpha not alpha minus one`` () =
    let result = PrecisionGateKernels.tryGammaRateVmp 2.0 4.0 3.0 |> accepted
    Assert.Equal(gamma 1.0 4.0, result.ToValue)
    Assert.Equal(gamma 2.0 3.0, result.ToRate)
    Assert.Equal(result.ToValue, result.ValueEncoding.Kernel)
    Assert.Equal(2.0, result.ValueEncoding.RequestedShape)
    let posterior =
        PrecisionGateKernels.tryGammaProduct (gamma 4.0 7.0) result.ToRate
        |> accepted
        |> PrecisionGateKernels.tryGammaMoments
        |> accepted
    Assert.Equal(7.0, posterior.RepresentedShape)
    Assert.Equal(10.0, posterior.Rate)
    near 0.7 posterior.Mean 1e-15
    near 0.07 posterior.Variance 1e-15

[<Fact>]
let ``improper Gamma site algebra admits signed coefficients and exact cancellation`` () =
    let left = gamma -2.0 -3.0
    let right = gamma 4.0 5.0
    let product = PrecisionGateKernels.tryGammaProduct left right |> accepted
    Assert.Equal(gamma 2.0 2.0, product)
    Assert.Equal(left, PrecisionGateKernels.tryGammaQuotient product right |> accepted)
    Assert.Equal(gamma 0.0 0.0, PrecisionGateKernels.tryGammaQuotient left left |> accepted)
    PrecisionGateKernels.tryGammaMoments left |> refused
    PrecisionGateKernels.tryGammaMoments (gamma 0.0 0.0) |> refused

[<Fact>]
let ``Gaussian signed sites compose before proper posterior admission`` () =
    let site = gaussian -1.0 -2.0
    let prior = gaussian 1.0 3.0
    PrecisionGateKernels.tryGaussianMoments site |> refused
    let combined = PrecisionGateKernels.tryGaussianProduct site prior |> accepted
    Assert.Equal(gaussian 0.0 1.0, combined)
    Assert.Equal(moments 0.0 1.0, PrecisionGateKernels.tryGaussianMoments combined |> accepted)
    Assert.Equal(site, PrecisionGateKernels.tryGaussianQuotient combined prior |> accepted)

[<Fact>]
let ``a linear exponential site with zero precision is not a proper Gaussian`` () =
    PrecisionGateKernels.tryGaussianMoments (gaussian 2.0 0.0) |> refused
    Assert.NotEqual(Gaussian.One, gaussian 2.0 0.0)
    PrecisionGateKernels.tryGaussianMoments Gaussian.One |> refused

[<Fact>]
let ``Gamma encoding reports nonzero shape roundtrip drift`` () =
    let encoding = PrecisionGateKernels.tryEncodeGamma 1e-16 1.0 |> accepted
    Assert.Equal(1e-16, encoding.RequestedShape)
    Assert.NotEqual(encoding.RequestedShape, encoding.RepresentedShape)
    Assert.Equal(encoding.Kernel.LogPower + 1.0, encoding.RepresentedShape)
    let observed = PrecisionGateKernels.tryGammaMoments encoding.Kernel |> accepted
    Assert.Equal(encoding.RepresentedShape, observed.RepresentedShape)
    Assert.Equal(encoding.RepresentedShape, observed.Mean)

[<Fact>]
let ``Gamma encoding refuses a positive shape lost entirely in natural coordinates`` () =
    PrecisionGateKernels.tryEncodeGamma 1e-300 1.0 |> refused
    PrecisionGateKernels.tryGammaRateVmp 1e-300 1.0 1.0 |> refused

[<Fact>]
let ``Gamma VMP positive expectations differ from unrestricted site coefficients`` () =
    for invalid in [ 0.0; -1.0; Double.NaN; Double.PositiveInfinity; Double.NegativeInfinity ] do
        PrecisionGateKernels.tryGammaRateVmp invalid 1.0 1.0 |> refused
        PrecisionGateKernels.tryGammaRateVmp 1.0 invalid 1.0 |> refused
        PrecisionGateKernels.tryGammaRateVmp 1.0 1.0 invalid |> refused
        PrecisionGateKernels.tryEncodeGamma 1.0 invalid |> refused
    PrecisionGateKernels.tryGammaProduct (gamma -1.0 -2.0) (gamma 0.0 0.0) |> accepted |> ignore

[<Fact>]
let ``ordinary records are revalidated at each operation boundary`` () =
    for invalid in [ Double.NaN; Double.PositiveInfinity; Double.NegativeInfinity ] do
        PrecisionGateKernels.tryGaussianProduct (gaussian invalid 1.0) Gaussian.One |> refused
        PrecisionGateKernels.tryGaussianQuotient Gaussian.One (gaussian 0.0 invalid) |> refused
        PrecisionGateKernels.tryGammaProduct (gamma invalid 1.0) (gamma 0.0 0.0) |> refused
        PrecisionGateKernels.tryGammaQuotient (gamma 0.0 0.0) (gamma 0.0 invalid) |> refused
        PrecisionGateKernels.trySoftDotVmp (moments invalid 0.0) (moments 1.0 0.0) (moments 1.0 0.0) 1.0 |> refused
        PrecisionGateKernels.tryNormalPrecisionVmp (moments 1.0 invalid) (moments 1.0 0.0) 1.0 |> refused
    PrecisionGateKernels.trySoftDotVmp (moments 0.0 -1.0) (moments 1.0 0.0) (moments 1.0 0.0) 1.0 |> refused
    PrecisionGateKernels.tryNormalPrecisionVmp (moments 1.0 0.0) (moments 1.0 0.0) 0.0 |> refused

[<Fact>]
let ``positive squared residual underflow must not masquerade as exact zero`` () =
    PrecisionGateKernels.tryNormalPrecisionVmp (moments Double.Epsilon 0.0) (moments 0.0 0.0) 1.0 |> refused
    let exactZero =
        PrecisionGateKernels.tryNormalPrecisionVmp (moments Double.Epsilon 0.0) (moments Double.Epsilon 0.0) 1.0
        |> accepted
    Assert.Equal(0.0, exactZero.ToPrecision.Rate)

[<Fact>]
let ``positive variance divided into a zero site rate refuses`` () =
    PrecisionGateKernels.tryNormalPrecisionVmp (moments 0.0 Double.Epsilon) (moments 0.0 0.0) 1.0 |> refused

[<Fact>]
let ``proper moments refuse underflow and overflow instead of admitting zero variance`` () =
    PrecisionGateKernels.tryGammaMoments (gamma 0.0 1e200) |> refused
    PrecisionGateKernels.tryGammaMoments (gamma 0.0 Double.Epsilon) |> refused
    PrecisionGateKernels.tryGaussianMoments (gaussian Double.Epsilon 2.0) |> refused
    PrecisionGateKernels.tryGaussianMoments (gaussian 0.0 Double.Epsilon) |> refused

[<Fact>]
let ``site coefficient overflow returns errors`` () =
    PrecisionGateKernels.tryGammaProduct (gamma Double.MaxValue 1.0) (gamma Double.MaxValue 1.0) |> refused
    PrecisionGateKernels.tryGaussianProduct (gaussian 0.0 Double.MaxValue) (gaussian 0.0 Double.MaxValue) |> refused
    PrecisionGateKernels.trySoftDotVmp (moments Double.MaxValue 0.0) (moments 2.0 0.0) (moments 1.0 0.0) 1.0 |> refused

[<Fact>]
let ``Exp and Log orientations have different reverse kernel measures`` () =
    let incoming = gamma 0.0 1.0
    let expValue = PrecisionGateKernels.tryReverseLogKernel PrecisionGateKernels.ExpConstraint incoming 1.0 |> accepted
    let logValue = PrecisionGateKernels.tryReverseLogKernel PrecisionGateKernels.LogConstraint incoming 1.0 |> accepted
    near (-exp 1.0) expValue 1e-15
    near (1.0 - exp 1.0) logValue 1e-15
    near 1.0 (logValue - expValue) 1e-15
    let leftTail = PrecisionGateKernels.tryReverseLogKernel PrecisionGateKernels.ExpConstraint incoming -20.0 |> accepted
    Assert.True(abs leftTail < 3e-9)

[<Fact>]
let ``reverse kernel is not restricted to proper incoming Gamma beliefs`` () =
    let incoming = gamma -2.0 -3.0
    PrecisionGateKernels.tryGammaMoments incoming |> refused
    Assert.Equal(3.0, PrecisionGateKernels.tryReverseLogKernel PrecisionGateKernels.ExpConstraint incoming 0.0 |> accepted)
    PrecisionGateKernels.tryReverseLogKernel PrecisionGateKernels.ExpConstraint incoming -1000.0 |> refused
    PrecisionGateKernels.tryReverseLogKernel PrecisionGateKernels.ExpConstraint incoming 1000.0 |> refused

[<Fact>]
let ``projection objective has the independently derived stationary point`` () =
    let evaluated =
        PrecisionGateKernels.tryProjectionObjective (target 1.0 0.0 1.0 (exp -0.25)) (moments 0.0 0.5)
        |> accepted
    near (1.25 + 0.5 * log 2.0) evaluated.Value 2e-15
    near 0.0 evaluated.DerivativeMean 2e-15
    near 0.0 evaluated.DerivativeVariance 2e-15

[<Fact>]
let ``objective derivatives agree with separate central differences`` () =
    let distribution = target 2.0 -0.7 1.2 0.8
    let evaluate mean variance =
        PrecisionGateKernels.tryProjectionObjective distribution (moments mean variance) |> accepted
    let step = 1e-5
    let center = evaluate 0.4 1.3
    let dMean = ((evaluate (0.4 + step) 1.3).Value - (evaluate (0.4 - step) 1.3).Value) / (2.0 * step)
    let dVariance = ((evaluate 0.4 (1.3 + step)).Value - (evaluate 0.4 (1.3 - step)).Value) / (2.0 * step)
    near dMean center.DerivativeMean 1e-8
    near dVariance center.DerivativeVariance 1e-8

[<Fact>]
let ``projection combines exponential scale in log space before evaluation`` () =
    Assert.True(Double.IsPositiveInfinity(exp 750.0))
    let evaluated =
        PrecisionGateKernels.tryProjectionObjective (target 1.0 0.0 0.0 Double.Epsilon) (moments 750.0 1.0)
        |> accepted
    Assert.True(Double.IsFinite evaluated.Value && evaluated.Value > 281250.0)
    Assert.True(Double.IsFinite evaluated.DerivativeMean && evaluated.DerivativeMean > 750.0)

[<Fact>]
let ``projection refuses invalid domains and unrepresentable exponential energy`` () =
    let candidate = moments 0.0 1.0
    for invalid in [ 0.0; -1.0; Double.NaN; Double.PositiveInfinity ] do
        PrecisionGateKernels.tryProjectionObjective (target invalid 0.0 0.0 1.0) candidate |> refused
        PrecisionGateKernels.tryProjectionObjective (target 1.0 0.0 0.0 invalid) candidate |> refused
        PrecisionGateKernels.tryProjectionObjective (target 1.0 0.0 0.0 1.0) (moments 0.0 invalid) |> refused
    PrecisionGateKernels.tryProjectionObjective (target 1.0 0.0 0.0 1.0) (moments -1000.0 1.0) |> refused
    PrecisionGateKernels.tryProjectionObjective (target 1.0 0.0 0.0 1.0) (moments 1000.0 1.0) |> refused
