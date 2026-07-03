namespace Zeta.Bayesian

open System
open Zeta.Core

/// **`AntiSybil` — The Hard-Money Entropy Budget.**
///
/// Implements the monetary stability mechanism of the attention economy.
/// Aaron's invariant: "IV pays only for the uncorrelated and unique... what IS scarce 
/// is the finite irreducible entropy you can hold unique."
///
/// This module detects correlated streams (Sybils, fast-ticking clones, or simply 
/// redundant sensors) and collapses their Information Value (IV) rewards. 
/// If two agents emit highly correlated beliefs, they are priced as "one process 
/// wearing two faces." The marginal IV of the second stream drops to zero.
///
/// This is the mechanism that prevents hyperinflation without relying on the 
/// conjectural -1/12 Zeta regularization bound.
///
/// **The Crypto IV / Salt Connection:**
/// A crypto IV (Initialization Vector) or salt is the irreducible entropy spent 
/// to make identical inputs distinguishable. Zeta's Information Value (IV) is the 
/// reward earned for *being* distinguishable. 
/// AntiSybil is the inverse of salting — it strips the salt to check if the 
/// underlying process is the same. The hard-money entropy budget is the conservation 
/// law connecting them: you can only earn IV up to the amount of genuine entropy 
/// (salt) you can hold.
[<RequireQualifiedAccess>]
module AntiSybil =

    /// A history of beliefs emitted by a specific agent/stream.
    type StreamHistory =
        { AgentId: string
          Beliefs: Gaussian list }

    /// Computes the empirical correlation between two belief streams.
    /// In a Gaussian setting, we measure how often their mean shifts align in direction and magnitude.
    let computeCorrelation (streamA: Gaussian list) (streamB: Gaussian list) : float =
        let getMeans (stream: Gaussian list) =
            stream |> List.map (fun g -> 
                if g.Precision = 0.0 then 0.0 else g.PrecisionMean / g.Precision)

        let meansA = getMeans streamA
        let meansB = getMeans streamB

        // Need at least 2 points to compute correlation
        let len = min meansA.Length meansB.Length
        if len < 2 then 0.0
        else
            let a = meansA |> List.take len
            let b = meansB |> List.take len
            
            let meanA = List.average a
            let meanB = List.average b
            
            let cov = 
                List.zip a b
                |> List.sumBy (fun (x, y) -> (x - meanA) * (y - meanB))
                
            let varA = a |> List.sumBy (fun x -> pown (x - meanA) 2)
            let varB = b |> List.sumBy (fun y -> pown (y - meanB) 2)
            
            if varA = 0.0 || varB = 0.0 then 0.0
            else cov / sqrt (varA * varB)

    /// Calculates the "Uniqueness Discount" for a new belief, given the historical 
    /// correlation with an already-processed stream.
    /// 
    /// If correlation ρ = 1 (perfectly correlated), discount = 0 (worthless).
    /// If correlation ρ ≤ 0 (uncorrelated or anti-correlated), discount = 1 (full value).
    let uniquenessDiscount (correlation: float) : float =
        // Bound correlation between 0 and 1 for the discount
        let rho = max 0.0 (min 1.0 correlation)
        1.0 - rho

    /// Prices a new belief against a known reference stream.
    /// The raw IV is discounted by the historical correlation between the sender 
    /// and the reference stream.
    let priceAgainstReference 
        (prior: Gaussian) 
        (newBelief: Gaussian) 
        (senderHistory: Gaussian list) 
        (referenceHistory: Gaussian list) : float<InformationValue.iv> =
        
        let rawIv = InformationValue.compute prior newBelief
        let rho = computeCorrelation senderHistory referenceHistory
        let discount = uniquenessDiscount rho
        
        rawIv * discount

    /// Prices a new belief against an entire society (multiple reference streams).
    /// The agent is penalized based on its MAXIMUM correlation with any existing stream.
    /// If you are a clone of *anyone*, you get zero IV.
    let priceAgainstSociety 
        (prior: Gaussian) 
        (newBelief: Gaussian) 
        (senderHistory: Gaussian list) 
        (societyHistories: StreamHistory list) : float<InformationValue.iv> =
        
        let rawIv = InformationValue.compute prior newBelief
        
        if List.isEmpty societyHistories then rawIv
        else
            let maxCorrelation = 
                societyHistories
                |> List.map (fun h -> computeCorrelation senderHistory h.Beliefs)
                |> List.max
                
            let discount = uniquenessDiscount maxCorrelation
            rawIv * discount
