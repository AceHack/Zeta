namespace Zeta.Bayesian

open System
open Zeta.Core

/// Scalar density-derived sites for a future composable learned gate.
/// This module evaluates local VMP rules and a reverse-KL objective only.
/// It supplies no mixed schedule, optimizer, training or global exactness claim.
/// Contract: docs/DECISIONS/2026-09-08-density-consistent-precision-gate-kernels.md.
[<RequireQualifiedAccess>]
module PrecisionGateKernels =

    type KernelError =
        | InvalidInput of field: string * requirement: string
        | NumericalFailure of operation: string * reason: string
        | ImproperBelief of family: string

    /// Zero variance denotes a clamped input, not a proper continuous density.
    type RealMoments =
        { Mean: float
          Variance: float }

    /// Unnormalized x^LogPower exp(-Rate*x), relative to dx on x > 0.
    /// Both coefficients may be any finite real; proper admission is separate.
    type GammaKernel =
        { LogPower: float
          Rate: float }

    /// Shape conversion can round even when it does not collapse to zero.
    type GammaEncoding =
        { RequestedShape: float
          RepresentedShape: float
          Kernel: GammaKernel }

    type GammaMoments =
        { RepresentedShape: float
          Rate: float
          Mean: float
          Variance: float }

    type SoftDotMessages =
        { ResidualSecondMoment: float
          ToZ: Gaussian
          ToWeight: Gaussian
          ToInput: Gaussian
          ToTau: GammaKernel }

    type NormalPrecisionMessages =
        { ResidualSecondMoment: float
          ToY: Gaussian
          ToMean: Gaussian
          ToPrecision: GammaKernel }

    type GammaRateMessages =
        { ToValue: GammaKernel
          ToRate: GammaKernel
          ValueEncoding: GammaEncoding }

    type ConstraintOrientation =
        | ExpConstraint
        | LogConstraint

    /// Target proportional to exp(-t*(z-u)^2/2 + k*z - c*exp(z)).
    type ProjectionTarget =
        { Precision: float
          Location: float
          Linear: float
          ExponentialRate: float }

    /// Value omits a constant independent of candidate mean and variance.
    type ProjectionEvaluation =
        { Value: float
          DerivativeMean: float
          DerivativeVariance: float }

    let private finite field value =
        if Double.IsFinite value then Ok()
        else Error(InvalidInput(field, "finite"))

    let private positive field value =
        result {
            do! finite field value
            if value > 0.0 then return ()
            else return! Error(InvalidInput(field, "strictly positive"))
        }

    let private checkedValue operation value =
        if Double.IsFinite value then Ok value
        else Error(NumericalFailure(operation, "nonfinite result"))

    let private add operation left right = checkedValue operation (left + right)
    let private subtract operation left right = checkedValue operation (left - right)

    let private multiply operation left right =
        result {
            let! value = checkedValue operation (left * right)
            if left <> 0.0 && right <> 0.0 && value = 0.0 then
                return! Error(NumericalFailure(operation, "nonzero product underflow"))
            else return value
        }

    let private divide operation numerator denominator =
        if denominator = 0.0 then
            Error(NumericalFailure(operation, "zero denominator"))
        else
            result {
                let! value = checkedValue operation (numerator / denominator)
                if numerator <> 0.0 && value = 0.0 then
                    return! Error(NumericalFailure(operation, "nonzero quotient underflow"))
                else return value
            }

    let private exponential operation exponent =
        result {
            let! value = checkedValue operation (exp exponent)
            if value = 0.0 then
                return! Error(NumericalFailure(operation, "positive exponential underflow"))
            else return value
        }

    let private realMoments field (value: RealMoments) =
        result {
            do! finite (field + ".Mean") value.Mean
            do! finite (field + ".Variance") value.Variance
            if value.Variance >= 0.0 then return ()
            else return! Error(InvalidInput(field + ".Variance", "nonnegative"))
        }

    let private gamma field (value: GammaKernel) =
        result {
            do! finite (field + ".LogPower") value.LogPower
            do! finite (field + ".Rate") value.Rate
        }

    let private gaussian field (value: Gaussian) =
        result {
            do! finite (field + ".PrecisionMean") value.PrecisionMean
            do! finite (field + ".Precision") value.Precision
        }

    /// Return both the requested shape and the shape represented by its kernel.
    let tryEncodeGamma shape rate : Result<GammaEncoding, KernelError> =
        result {
            do! positive "Shape" shape
            do! positive "Rate" rate
            let! power = subtract "shape minus one" shape 1.0
            let! represented = add "represented shape" power 1.0
            if represented <= 0.0 then
                return! Error(NumericalFailure("shape encoding", "nonpositive represented shape"))
            else
                return
                    { RequestedShape = shape
                      RepresentedShape = represented
                      Kernel = { LogPower = power; Rate = rate } }
        }

    /// Finite improper sites are legal operands; this does not admit a belief.
    let tryGammaProduct (left: GammaKernel) (right: GammaKernel) : Result<GammaKernel, KernelError> =
        result {
            do! gamma "Left" left
            do! gamma "Right" right
            let! power = add "Gamma product power" left.LogPower right.LogPower
            let! rate = add "Gamma product rate" left.Rate right.Rate
            return { LogPower = power; Rate = rate }
        }

    /// Quotients may have negative coefficients and need not be normalizable.
    let tryGammaQuotient (left: GammaKernel) (right: GammaKernel) : Result<GammaKernel, KernelError> =
        result {
            do! gamma "Left" left
            do! gamma "Right" right
            let! power = subtract "Gamma quotient power" left.LogPower right.LogPower
            let! rate = subtract "Gamma quotient rate" left.Rate right.Rate
            return { LogPower = power; Rate = rate }
        }

    /// Admit a proper Gamma and compute moments of its represented shape.
    let tryGammaMoments (kernel: GammaKernel) : Result<GammaMoments, KernelError> =
        result {
            do! gamma "Kernel" kernel
            let! shape = add "Gamma shape" kernel.LogPower 1.0
            if shape <= 0.0 || kernel.Rate <= 0.0 then
                return! Error(ImproperBelief "Gamma")
            else
                let! mean = divide "Gamma mean" shape kernel.Rate
                let! variance = divide "Gamma variance" mean kernel.Rate
                return
                    { RepresentedShape = shape
                      Rate = kernel.Rate
                      Mean = mean
                      Variance = variance }
        }

    /// Checked natural-parameter addition; negative-precision sites remain legal.
    let tryGaussianProduct (left: Gaussian) (right: Gaussian) : Result<Gaussian, KernelError> =
        result {
            do! gaussian "Left" left
            do! gaussian "Right" right
            let! precision = add "Gaussian product precision" left.Precision right.Precision
            let! eta = add "Gaussian product precision mean" left.PrecisionMean right.PrecisionMean
            return { Precision = precision; PrecisionMean = eta }
        }

    /// Checked cavity algebra, without treating an improper cavity as a belief.
    let tryGaussianQuotient (left: Gaussian) (right: Gaussian) : Result<Gaussian, KernelError> =
        result {
            do! gaussian "Left" left
            do! gaussian "Right" right
            let! precision = subtract "Gaussian quotient precision" left.Precision right.Precision
            let! eta = subtract "Gaussian quotient precision mean" left.PrecisionMean right.PrecisionMean
            return { Precision = precision; PrecisionMean = eta }
        }

    /// Admit finite Gaussian moments; a linear-exponential zero-precision site fails.
    let tryGaussianMoments (kernel: Gaussian) : Result<RealMoments, KernelError> =
        result {
            do! gaussian "Kernel" kernel
            if kernel.Precision <= 0.0 then return! Error(ImproperBelief "Gaussian")
            else
                let! mean = divide "Gaussian mean" kernel.PrecisionMean kernel.Precision
                let! variance = divide "Gaussian variance" 1.0 kernel.Precision
                return { Mean = mean; Variance = variance }
        }

    /// Mean-field N(z;w*x,tau^-1), including both multiplicands' second moments.
    /// Inputs are independent current marginals, not BP cavity messages.
    let trySoftDotVmp (weight: RealMoments) (input: RealMoments) (z: RealMoments) meanTau
        : Result<SoftDotMessages, KernelError> =
        result {
            do! realMoments "Weight" weight
            do! realMoments "Input" input
            do! realMoments "Z" z
            do! positive "MeanTau" meanTau
            let! productMean = multiply "weight times input mean" weight.Mean input.Mean
            let! delta = subtract "soft-dot residual mean" z.Mean productMean
            let! deltaSquared = multiply "soft-dot squared residual" delta delta
            let! varianceProduct = multiply "soft-dot variance product" weight.Variance input.Variance
            let! inputSquared = multiply "squared input mean" input.Mean input.Mean
            let! weightSquared = multiply "squared weight mean" weight.Mean weight.Mean
            let! uncertainWeight = multiply "uncertain weight term" inputSquared weight.Variance
            let! uncertainInput = multiply "uncertain input term" weightSquared input.Variance
            let! residual0 = add "residual plus output variance" deltaSquared z.Variance
            let! residual1 = add "residual plus variance product" residual0 varianceProduct
            let! residual2 = add "residual plus weight uncertainty" residual1 uncertainWeight
            let! residual = add "residual plus input uncertainty" residual2 uncertainInput
            let! rate = divide "soft-dot precision site rate" residual 2.0
            let! inputSecond = add "input second moment" input.Variance inputSquared
            let! weightSecond = add "weight second moment" weight.Variance weightSquared
            let! weightPrecision = multiply "weight site precision" meanTau inputSecond
            let! inputPrecision = multiply "input site precision" meanTau weightSecond
            let! scaledZ = multiply "scaled output mean" meanTau z.Mean
            let! weightEta = multiply "weight site precision mean" scaledZ input.Mean
            let! inputEta = multiply "input site precision mean" scaledZ weight.Mean
            let! zEta = multiply "output site precision mean" meanTau productMean
            return
                { ResidualSecondMoment = residual
                  ToZ = { Precision = meanTau; PrecisionMean = zEta }
                  ToWeight = { Precision = weightPrecision; PrecisionMean = weightEta }
                  ToInput = { Precision = inputPrecision; PrecisionMean = inputEta }
                  ToTau = { LogPower = 0.5; Rate = rate } }
        }

    /// N(y;mu,gamma^-1) under independent y and mu marginals.
    /// A structured covariance requires a different, explicitly specified rule.
    let tryNormalPrecisionVmp (y: RealMoments) (mean: RealMoments) meanGamma
        : Result<NormalPrecisionMessages, KernelError> =
        result {
            do! realMoments "Y" y
            do! realMoments "Mean" mean
            do! positive "MeanGamma" meanGamma
            let! delta = subtract "normal residual mean" y.Mean mean.Mean
            let! squared = multiply "normal squared residual" delta delta
            let! residual0 = add "normal residual plus y variance" squared y.Variance
            let! residual = add "normal residual plus mean variance" residual0 mean.Variance
            let! rate = divide "normal precision site rate" residual 2.0
            let! yEta = multiply "normal y precision mean" meanGamma mean.Mean
            let! meanEta = multiply "normal mean precision mean" meanGamma y.Mean
            return
                { ResidualSecondMoment = residual
                  ToY = { Precision = meanGamma; PrecisionMean = yEta }
                  ToMean = { Precision = meanGamma; PrecisionMean = meanEta }
                  ToPrecision = { LogPower = 0.5; Rate = rate } }
        }

    /// Gamma(gamma;alpha,beta) VMP: the reverse beta site has shape alpha+1.
    let tryGammaRateVmp alpha meanBeta meanGamma : Result<GammaRateMessages, KernelError> =
        result {
            do! positive "Alpha" alpha
            do! positive "MeanBeta" meanBeta
            do! positive "MeanGamma" meanGamma
            let! encoding = tryEncodeGamma alpha meanBeta
            return
                { ToValue = encoding.Kernel
                  ToRate = { LogPower = alpha; Rate = meanGamma }
                  ValueEncoding = encoding }
        }

    /// Reverse deterministic log-kernel, with no invented normalization.
    /// Exp uses delta(gamma-exp(z)); Log uses delta(z-log(gamma)).
    let tryReverseLogKernel orientation (kernel: GammaKernel) z : Result<float, KernelError> =
        result {
            do! gamma "Kernel" kernel
            do! finite "Z" z
            let! power =
                match orientation with
                | ExpConstraint -> Ok kernel.LogPower
                | LogConstraint -> add "Log orientation Jacobian power" kernel.LogPower 1.0
            let! value = exponential "reverse-kernel exponential" z
            let! linear = multiply "reverse-kernel linear term" power z
            let! exponentialTerm = multiply "reverse-kernel exponential term" kernel.Rate value
            return! subtract "reverse log-kernel" linear exponentialTerm
        }

    /// Evaluate Gaussian reverse KL and analytic derivatives, up to a constant.
    /// This returns no projected belief and performs no numerical optimization.
    let tryProjectionObjective (target: ProjectionTarget) (candidate: RealMoments)
        : Result<ProjectionEvaluation, KernelError> =
        result {
            do! positive "Target.Precision" target.Precision
            do! finite "Target.Location" target.Location
            do! finite "Target.Linear" target.Linear
            do! positive "Target.ExponentialRate" target.ExponentialRate
            do! realMoments "Candidate" candidate
            do! positive "Candidate.Variance" candidate.Variance
            let! halfVariance = divide "half candidate variance" candidate.Variance 2.0
            let! logRate = checkedValue "log exponential rate" (log target.ExponentialRate)
            let! logR0 = add "exponential rate plus mean in log space" logRate candidate.Mean
            let! logR = add "exponential rate plus half variance in log space" logR0 halfVariance
            let! r = exponential "expected exponential energy" logR
            let! delta = subtract "projection displacement" candidate.Mean target.Location
            let! squared = multiply "projection squared displacement" delta delta
            let! second = add "projection second moment" squared candidate.Variance
            let! scaledSecond = multiply "projection scaled second moment" target.Precision second
            let! gaussianEnergy = divide "projection Gaussian energy" scaledSecond 2.0
            let! linear = multiply "projection linear energy" target.Linear candidate.Mean
            let! withoutExponential = subtract "projection quadratic minus linear" gaussianEnergy linear
            let! energy = add "projection total energy" withoutExponential r
            let! logVariance = checkedValue "log candidate variance" (log candidate.Variance)
            let! halfLogVariance = divide "half log candidate variance" logVariance 2.0
            let! objective = subtract "projection objective" energy halfLogVariance
            let! scaledDelta = multiply "projection scaled displacement" target.Precision delta
            let! gradient0 = subtract "projection mean derivative minus linear" scaledDelta target.Linear
            let! gradientMean = add "projection mean derivative" gradient0 r
            let! inverseVariance = divide "inverse candidate variance" 1.0 candidate.Variance
            let! curvature = add "projection local curvature" target.Precision r
            let! gradientVariance0 = subtract "projection variance derivative numerator" curvature inverseVariance
            let! gradientVariance = divide "projection variance derivative" gradientVariance0 2.0
            return
                { Value = objective
                  DerivativeMean = gradientMean
                  DerivativeVariance = gradientVariance }
        }
