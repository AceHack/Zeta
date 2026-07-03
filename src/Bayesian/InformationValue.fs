namespace Zeta.Bayesian

open System
open Zeta.Core

/// **`InformationValue` — the economic unit of the attention economy.**
///
/// "The delta of what's known vs unknown."
///
/// In Zeta, information value (IV) is a first-class economic primitive. It is
/// quantified as the Kullback-Leibler (KL) divergence between a receiver's prior
/// belief and their posterior belief after integrating a message.
///
/// IV is the denomination for the entire system:
/// - **Attention router**: Ranks connections by expected IV.
/// - **Thousand Brains**: Columns "vote" using IV as the currency.
/// - **Web3 / Governance**: Asks and bids clear in IV-denominated prices.
/// - **Delay-Decorrelation**: High-delay independent paths yield higher IV.
[<RequireQualifiedAccess>]
module InformationValue =

    /// A strongly-typed unit of Information Value (measured in nats/bits).
    [<Measure>] type iv

    /// The fundamental economic primitive: Information Value is the KL divergence
    /// from the prior to the posterior.
    ///
    /// Following Lindley (1956) and active inference, information gain is the divergence
    /// from the prior to the posterior: KL(posterior || prior).
    ///
    /// For two Gaussians (posterior P, prior Q), KL(P || Q) is:
    /// KL = 0.5 * ( log(τ_Q / τ_P) + (τ_Q / τ_P) + τ_Q * (μ_P - μ_Q)^2 - 1 )
    ///
    /// This captures both:
    /// 1. Precision gain (learning something new, τ_P > τ_Q)
    /// 2. Mean shift (correcting a misconception, μ_P ≠ μ_Q)
    let compute (prior: Gaussian) (posterior: Gaussian) : float<iv> =
        // Handle the uninformative prior case (precision = 0)
        if prior.Precision <= 0.0 then
            // If prior was completely flat, all posterior precision is new information.
            // We use a small epsilon to avoid infinity, or just treat the posterior precision as the IV.
            // For economic bounding, we cap the infinite surprise.
            if posterior.Precision <= 0.0 then 0.0<iv>
            else posterior.Precision * 1.0<iv>
        elif posterior.Precision <= 0.0 then
            // Posterior cannot be less precise than prior in EP unless there's forgetting.
            0.0<iv>
        else
            let tQ = prior.Precision
            let tP = posterior.Precision
            let mQ = prior.PrecisionMean / prior.Precision
            let mP = posterior.PrecisionMean / posterior.Precision

            // Formula for KL(P || Q) where P is posterior, Q is prior:
            // KL(P || Q) = 0.5 * [ log(|Σ_Q|/|Σ_P|) - d + tr(Σ_Q^-1 Σ_P) + (μ_P - μ_Q)^T Σ_Q^-1 (μ_P - μ_Q) ]
            // For 1D Gaussians with precisions τ_P, τ_Q:
            // KL(P || Q) = 0.5 * [ log(τ_P / τ_Q) - 1 + (τ_Q / τ_P) + τ_Q * (μ_P - μ_Q)^2 ]
            
            let varianceRatio = tQ / tP
            let logVarianceRatio = Math.Log(tP / tQ)
            let meanShift = tQ * Math.Pow(mP - mQ, 2.0)

            let kl = 0.5 * (logVarianceRatio + varianceRatio + meanShift - 1.0)
            
            // KL is non-negative by definition, but floating point math can dip slightly below 0
            Math.Max(0.0, kl) * 1.0<iv>

    /// Calculate the IV of a specific message applied to a prior.
    /// This is the "billing function" — how much IV did this message provide?
    let valueOfMessage (prior: Gaussian) (message: Gaussian) : float<iv> =
        let posterior = prior * message
        compute prior posterior

    /// The expected IV of a Reticulum link, adjusted by the Condorcet bonus.
    /// This integrates the Delay-Decorrelation theorem (latency -> independence)
    /// directly into the economic valuation.
    let valueOfLink (baseIv: float<iv>) (latency: float) : float<iv> =
        // Delay-decorrelation: ρ = 1 / (1 + L)
        // Condorcet bonus = L / (1 + L)
        let bonus = if latency <= 0.0 then 0.0 else latency / (1.0 + latency)
        baseIv * (1.0 + bonus)

    /// A priced bid in the attention economy.
    type Bid =
        { BuyerId: string
          /// The maximum IV the buyer is willing to pay for this resource.
          MaxPrice: float<iv> }

    /// A priced ask in the attention economy.
    type Ask =
        { SellerId: string
          /// The minimum IV the seller will accept.
          MinPrice: float<iv> }

    /// Market clearing function denominated strictly in IV.
    /// Connects to AskBidClearing.fs but enforces the IV type.
    let clearMarket (ask: Ask) (bids: Bid list) : Bid option =
        let validBids = bids |> List.filter (fun b -> b.MaxPrice >= ask.MinPrice)
        match validBids |> List.sortByDescending (fun b -> b.MaxPrice) with
        | highest :: _ -> Some highest
        | [] -> None
