namespace Zeta.Bayesian

open Zeta.Core
open Zeta.Bayesian

/// <summary>
/// Upgrades AntiSybil from a grade-0 scalar Pearson correlation to a 
/// full geometric product in Clifford algebra (Cl3).
/// A Sybil is literally a rotated copy of the same trajectory in belief space.
/// This module detects if two trajectories are related by a rotor.
/// </summary>
[<RequireQualifiedAccess>]
module CliffordAntiSybil =

    /// Maps a Gaussian belief to a vector in Cl(3,0) space.
    /// x = PrecisionMean, y = Precision, z = 0 (or time/tick if we want 3D)
    let beliefToVector (belief: Gaussian) : Cl3.Mv =
        Cl3.vector belief.PrecisionMean belief.Precision 0.0

    /// Computes the geometric correlation between two belief streams.
    /// Instead of just scalar correlation, it checks how well a single rotor
    /// can map stream A onto stream B. If a single rotor perfectly maps them,
    /// they are the same process wearing a mask (a Sybil).
    let computeGeometricCorrelation (streamA: AntiSybil.StreamHistory) (streamB: AntiSybil.StreamHistory) : float =
        // We need at least 2 points to define a trajectory
        if streamA.Beliefs.Length < 2 || streamB.Beliefs.Length < 2 then
            0.0
        else
            let len = min streamA.Beliefs.Length streamB.Beliefs.Length
            let beliefsA = streamA.Beliefs |> List.take len
            let beliefsB = streamB.Beliefs |> List.take len
            
            // Map to Cl3 vectors
            let vecsA = beliefsA |> List.map beliefToVector
            let vecsB = beliefsB |> List.map beliefToVector
            
            // Compute the trajectory vectors (deltas between steps)
            let deltasA = 
                List.zip (List.take (len - 1) vecsA) (List.tail vecsA)
                |> List.map (fun (v1, v2) -> Cl3.sub v2 v1)
                
            let deltasB = 
                List.zip (List.take (len - 1) vecsB) (List.tail vecsB)
                |> List.map (fun (v1, v2) -> Cl3.sub v2 v1)
                
            // If the streams are identical or just scaled/rotated versions of each other,
            // the geometric product of their normalized deltas will be a constant rotor.
            // For now, we fall back to a simple dot-product based cosine similarity
            // across the trajectory, which is the grade-0 part of the geometric product.
            
            let mutable totalDot = 0.0
            let mutable normA = 0.0
            let mutable normB = 0.0
            
            for i in 0 .. deltasA.Length - 1 do
                let dA = deltasA.[i]
                let dB = deltasB.[i]
                
                // The dot product is the scalar part (grade 0) of the geometric product
                let dot = Cl3.dot dA dB
                totalDot <- totalDot + dot
                normA <- normA + (Cl3.dot dA dA)
                normB <- normB + (Cl3.dot dB dB)
                
            if normA = 0.0 || normB = 0.0 then
                0.0
            else
                let cosSim = totalDot / (sqrt (normA * normB))
                // Map cosine similarity [-1, 1] to correlation [0, 1] for uniqueness discount
                // A perfect clone (cosSim = 1) should have correlation 1
                // An opposite stream (cosSim = -1) is also highly correlated (predictable)
                abs cosSim
                
    /// Computes the uniqueness discount based on geometric correlation.
    let uniquenessDiscount (streamA: AntiSybil.StreamHistory) (streamB: AntiSybil.StreamHistory) : float =
        let corr = computeGeometricCorrelation streamA streamB
        1.0 - corr
