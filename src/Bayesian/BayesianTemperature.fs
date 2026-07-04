namespace Zeta.Bayesian

open System
open Zeta.Core

/// Source-owned Bayesian projection into the universal temperature readout.
///
/// This is not an Infer.NET adapter. It is the small deterministic bridge from
/// belief uncertainty to the same fixed-point heat/temperature treaty used by
/// Dark Hall, TypeScript, and Q# reference vectors.
[<RequireQualifiedAccess>]
module BayesianTemperature =

    let private ppmFromUnitInterval (value: float) : int =
        if not (Double.IsFinite value) then
            TemperatureReadout.MaxPpm
        else
            let clamped = value |> max 0.0 |> min 1.0
            int (Math.Round(clamped * float TemperatureReadout.MaxPpm))

    /// Convert Gaussian variance to a bounded uncertainty temperature lane.
    /// Infinite/flat/improper beliefs are maximally hot; high precision cools
    /// as variance approaches zero.
    let uncertaintyPpm (belief: Gaussian) : int =
        if not (Double.IsFinite belief.Precision) || belief.Precision <= 0.0 then
            TemperatureReadout.MaxPpm
        else
            let variance = 1.0 / belief.Precision
            ppmFromUnitInterval (variance / (1.0 + variance))

    /// Project a belief plus external heat/pressure/attention lanes into the
    /// universal readout. Attention is recorded for boarding/order policies but
    /// does not increase `TemperaturePpm`; pressure and uncertainty do.
    let ofBelief
        (source: string)
        (belief: Gaussian)
        (heatPpm: int)
        (pressurePpm: int)
        (attention: float)
        : TemperatureReadout =
        TemperatureReadout.ofPpm
            source
            heatPpm
            (uncertaintyPpm belief)
            pressurePpm
            (ppmFromUnitInterval attention)

    /// Project a belief into the universal black-body information-radiance
    /// lane. This deliberately composes through `ofBelief` so Bayesian heat,
    /// pressure, and attention follow the same treaty as Dark Hall and Q#.
    let blackBodyOfBelief
        (source: string)
        (belief: Gaussian)
        (heatPpm: int)
        (pressurePpm: int)
        (attention: float)
        : BlackBodyReadout =
        ofBelief source belief heatPpm pressurePpm attention
        |> BlackBodyReadout.ofTemperatureReadout

    /// Export a Bayesian belief as the same source-owned treaty bundle used by
    /// room transcripts and Q# heat-signal vectors. The oracle is an interface
    /// boundary: Q# can implement it as a reference plugin, while this default
    /// path stays pure F#.
    let treatyOfBelief
        (source: string)
        (belief: Gaussian)
        (heatPpm: int)
        (pressurePpm: int)
        (attention: float)
        : Result<TemperatureTreatyBundle, TemperatureReferenceFeedback> =
        ofBelief source belief heatPpm pressurePpm attention
        |> TemperatureTreatyBundle.ofTemperatureReadout TemperatureReferenceOracle.localBlackBody
