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
                
            // To detect if stream B is just a rotated/scaled version of stream A,
            // we look at the geometric product between their normalized deltas.
            // If B is a rotated clone of A, the geometric product (B * ~A) will yield 
            // a CONSTANT rotor across all timesteps.
            
            let rotors = 
                List.zip deltasA deltasB
                |> List.choose (fun (dA, dB) ->
                    let normA = Cl3.norm dA
                    let normB = Cl3.norm dB
                    if normA < 1e-12 || normB < 1e-12 then
                        None
                    else
                        let normDA = Cl3.smul (1.0 / normA) dA
                        let normDB = Cl3.smul (1.0 / normB) dB
                        // Geometric product of two vectors yields a rotor (scalar + bivector)
                        // R = B * ~A (since A is a vector, ~A = A)
                        Some (Cl3.gp normDB normDA)
                )
                
            if rotors.Length < 1 then
                0.0
            else
                // If they are related by a constant rotor, the variance of these rotors will be zero.
                // We compute the "average" rotor, then measure how much each timestep deviates from it.
                // To detect if stream B is just a rotated/scaled version of stream A,
                // we look at the geometric product between their normalized deltas.
                // If B is a rotated clone of A, the geometric product (B * ~A) will yield 
                // a CONSTANT rotor across all timesteps.
                // We compute the average rotor, then measure how much each timestep deviates from it.
                let avgRotor = 
                    rotors 
                    |> List.fold Cl3.add Cl3.zero
                    |> Cl3.smul (1.0 / float rotors.Length)
                    
                // Measure variance (sum of squared distances from the average rotor)
                // distSq in Cl3 is Euclidean norm^2, so it is always positive.
                let variance =
                    rotors
                    |> List.sumBy (fun r -> Cl3.distSq r avgRotor)
                    |> fun v -> v / float rotors.Length
                    
                // For completely unrelated streams, the variance of the geometric product will be high.
                // We map variance to correlation using a smooth decay function.
                // If variance is 0, they are perfectly correlated (a rotated clone) -> corr = 1.0.
                // If variance is large -> corr -> 0.0.
                let corr = exp (-variance * 0.5)
                
                // The geometric product of two unit vectors yields a rotor R = B * ~A.
                // The scalar part of R is the dot product (cosine of angle).
                // The bivector part is the plane of rotation.
                // For unrelated streams, the average rotor will have a small scalar part (or small overall norm if they cancel).
                // If they are related by a consistent rotation, the average rotor will have norm close to 1.
                let avgRotorNorm = Cl3.norm avgRotor
                
                // Scale the correlation by how consistent the rotor is.
                // If the rotors cancel each other out (norm < 1), they are not consistently rotated.
                // Square it to penalize inconsistency more aggressively
                let consistentCorr = corr * (avgRotorNorm * avgRotorNorm)
                
                max 0.0 (min 1.0 consistentCorr)
                
    /// Computes the uniqueness discount based on geometric correlation.
    let uniquenessDiscount (streamA: AntiSybil.StreamHistory) (streamB: AntiSybil.StreamHistory) : float =
        let corr = computeGeometricCorrelation streamA streamB
        1.0 - corr
