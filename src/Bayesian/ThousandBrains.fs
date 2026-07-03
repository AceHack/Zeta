namespace Zeta.Bayesian

open System
open Zeta.Core

/// **`ThousandBrains` — Writer-Actor-Routing Model.**
///
/// Implements the Thousand Brains theory of intelligence (Hawkins) using Zeta's 
/// Bayesian primitives. 
///
/// The core idea: intelligence is not a single hierarchical model, but thousands of 
/// independent "columns" (agents/models) that observe the world, maintain their own 
/// beliefs, and vote on the identity of objects.
///
/// In Zeta, this maps perfectly to the `LocalConsensus` and `InformationValue` primitives:
/// 1. **Columns** are independent Gaussian priors (discrete-ticking observers).
/// 2. **Voting** is lateral EP message passing between columns.
/// 3. **Consensus** is the joint posterior exceeding a precision threshold.
/// 4. **Currency** is Information Value (IV) — columns weight their votes by how much IV they gained.
///
/// This architecture recovers the continuous information lost by individual discrete
/// ticks (the -1/12 Zeta regularization penalty) through decorrelated lateral consensus.
[<RequireQualifiedAccess>]
module ThousandBrains =

    /// A single cortical column in the Thousand Brains lattice.
    type Column =
        { Id: string
          /// The column's current belief about the state of the world.
          Belief: Gaussian
          /// The total Information Value (IV) this column has accumulated.
          /// Higher IV means the column has learned more from its specific sensor stream,
          /// giving it more weight in lateral voting.
          AccumulatedIV: float<InformationValue.iv> }

    /// A vote cast by a column to the lateral consensus pool.
    type Vote =
        { ColumnId: string
          /// The belief being broadcast.
          Belief: Gaussian
          /// The weight of the vote, derived from the column's accumulated IV.
          Weight: float }

    /// Creates a new, naive column.
    let createColumn (id: string) : Column =
        { Id = id
          Belief = { Gaussian.PrecisionMean = 0.0; Precision = 0.0 } // Uninformative prior
          AccumulatedIV = 0.0<InformationValue.iv> }

    /// A column observes a sensory input (a message from the continuous world)
    /// and updates its belief and accumulated IV.
    let observe (column: Column) (sensoryInput: Gaussian) : Column =
        let posterior = column.Belief * sensoryInput
        let iv = InformationValue.compute column.Belief posterior
        
        { column with 
            Belief = posterior
            AccumulatedIV = column.AccumulatedIV + iv }

    /// A column casts a vote to the lateral pool.
    /// The weight of the vote is proportional to the log of its accumulated IV.
    /// (Logarithmic scaling prevents hyper-experienced columns from becoming dictators,
    /// respecting the Gibbard-Satterthwaite / Arrow-escape principles).
    let castVote (column: Column) : Vote =
        // Weight is log(1 + IV) to ensure it's positive and sub-linear
        let weight = Math.Log(1.0 + float column.AccumulatedIV)
        { ColumnId = column.Id
          Belief = column.Belief
          Weight = weight }

    /// Computes the lateral consensus among a set of voting columns.
    /// This is an IV-weighted product of Gaussians (log-linear pool).
    let computeConsensus (votes: Vote list) : Gaussian =
        match votes with
        | [] -> { Gaussian.PrecisionMean = 0.0; Precision = 0.0 }
        | _ ->
            // In a weighted log-linear pool, we multiply the natural parameters by the weight.
            // P_consensus ∝ Π (P_i)^w_i
            // This means PrecisionMean = Σ (w_i * PM_i) and Precision = Σ (w_i * P_i)
            let totalWeightedPM = 
                votes |> List.sumBy (fun v -> v.Belief.PrecisionMean * v.Weight)
            let totalWeightedP = 
                votes |> List.sumBy (fun v -> v.Belief.Precision * v.Weight)
            
            { Gaussian.PrecisionMean = totalWeightedPM
              Precision = totalWeightedP }

    /// Evaluates if the lattice has reached a definitive consensus.
    /// Reuses the LocalConsensus logic but applies it to the IV-weighted joint posterior.
    let evaluateLattice (votes: Vote list) (threshold: float) : LocalConsensus.ConsensusState =
        let jointPosterior = computeConsensus votes
        
        if jointPosterior.Precision >= threshold then
            let mean = jointPosterior.PrecisionMean / jointPosterior.Precision
            if mean > 0.0 then LocalConsensus.ResolvedYes jointPosterior
            else LocalConsensus.ResolvedNo jointPosterior
        else
            LocalConsensus.Undecided jointPosterior
