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

    // -- Spatial columns: belief about a LOCATION IN A FRAME ------------------------
    //
    // WHAT THE SCALAR COLUMNS ABOVE ARE MISSING. In the Thousand Brains theory a
    // cortical column's job is to believe about a location in a REFERENCE FRAME
    // ATTACHED TO AN OBJECT (Hawkins, Lewis, Klukas, Purdy & Ahmad 2019). The
    // frame is the load-bearing part; a column believing about a bare number has
    // the voting structure and none of the theory.
    //
    // ADDED ALONGSIDE rather than replacing `Column`: four modules and two test
    // files consume the scalar type, and the scalar case has to keep behaving
    // exactly as it did for the comparison below to mean anything.

    /// A belief about a location: one Gaussian per axis, tagged with the frame the
    /// coordinates are expressed in.
    ///
    /// THE FRAME IS NOT A LABEL. Two columns may pool their votes only if they are
    /// talking about the same reference frame — a location in the frame of a cup
    /// and a location in the frame of the table it stands on are different
    /// quantities, and averaging them is a category error that a bare
    /// `Gaussian array` would let through silently.
    type FrameBelief =
        { Frame: string
          Axes: Gaussian array }

    /// A column that believes about a location rather than a scalar.
    type SpatialColumn =
        { Id: string
          Belief: FrameBelief
          AccumulatedIV: float<InformationValue.iv> }

    /// A vote about a location.
    type SpatialVote =
        { ColumnId: string
          Belief: FrameBelief
          Weight: float }

    /// A naive column over `dimensions` axes in `frame`.
    let createSpatialColumn (id: string) (frame: string) (dimensions: int) : SpatialColumn =
        { Id = id
          Belief =
            { Frame = frame
              Axes = Array.create dimensions { Gaussian.PrecisionMean = 0.0; Precision = 0.0 } }
          AccumulatedIV = 0.0<InformationValue.iv> }

    /// Observe a location. Per-axis conjugate update; IV SUMS over the axes.
    ///
    /// Summing is not a convenience: information value here is a KL divergence,
    /// and the KL divergence of a product of independent distributions is the sum
    /// of the per-component divergences. So a location observation is worth
    /// exactly what its axes are worth, added — which is also why a 1-axis
    /// location must score identically to the scalar column it generalises.
    let observeSpatial (column: SpatialColumn) (sensory: FrameBelief) : Result<SpatialColumn, string> =
        if sensory.Frame <> column.Belief.Frame then
            Error $"frame mismatch: column is in '{column.Belief.Frame}', observation in '{sensory.Frame}'"
        elif sensory.Axes.Length <> column.Belief.Axes.Length then
            Error
                $"dimension mismatch: column has {column.Belief.Axes.Length} axes, observation has {sensory.Axes.Length}"
        else
            let posteriors = Array.map2 (*) column.Belief.Axes sensory.Axes
            let iv =
                Array.map2 InformationValue.compute column.Belief.Axes posteriors
                |> Array.sum
            Ok
                { column with
                    Belief = { column.Belief with Axes = posteriors }
                    AccumulatedIV = column.AccumulatedIV + iv }

    /// Cast a spatial vote. Same `log(1 + IV)` weight as `castVote`, for the same
    /// reason: sub-linear so no column becomes a dictator.
    let castSpatialVote (column: SpatialColumn) : SpatialVote =
        { ColumnId = column.Id
          Belief = column.Belief
          Weight = Math.Log(1.0 + float column.AccumulatedIV) }

    /// IV-weighted lateral consensus over locations.
    ///
    /// REFUSES a mixed pool rather than pooling it. Mismatched frames are the
    /// error this type exists to make impossible, and returning a plausible
    /// average of two different reference frames would be exactly the silent
    /// wrong answer the frame tag was introduced to prevent.
    ///
    /// REPORTS THE FACT, NOT A VERDICT, and the first version of this function got
    /// that wrong. It took `first.Belief.Frame` as "the pool's" frame and listed
    /// everyone else as disagreeing — so a pool of [table; cup; cup] blamed the
    /// MAJORITY for the outlier's frame, and LIST ORDER decided who was at fault.
    ///
    /// There is no basis for that judgement here. Which frame is correct is a
    /// question about the world, not about this list; the honest report is that
    /// the pool contains more than one frame, and which ones. That is the
    /// discipline in `.claude/rules/dual-use-detection-is-neutral-oracle-decides.md`
    /// — the mechanism names what it measured and leaves the reading to the
    /// caller — and TB-13 pins it by requiring both orderings to produce the same
    /// message.
    let spatialConsensus (votes: SpatialVote list) : Result<FrameBelief, string> =
        match votes with
        | [] -> Error "no votes"
        | first :: _ ->
            let frames = votes |> List.map (fun v -> v.Belief.Frame) |> List.distinct |> List.sort
            let dimensions = votes |> List.map (fun v -> v.Belief.Axes.Length) |> List.distinct |> List.sort
            if List.length frames > 1 then
                let named = frames |> List.map (sprintf "'%s'") |> String.concat ", "
                Error $"cannot pool across reference frames — the pool contains {List.length frames}: {named}"
            elif List.length dimensions > 1 then
                let named = dimensions |> List.map string |> String.concat ", "
                Error $"cannot pool across dimensions — the pool contains {List.length dimensions} axis counts: {named}"
            else
                let frame = first.Belief.Frame
                let dims = first.Belief.Axes.Length
                let axes =
                    Array.init dims (fun a ->
                        { Gaussian.PrecisionMean =
                            votes |> List.sumBy (fun v -> v.Belief.Axes.[a].PrecisionMean * v.Weight)
                          Precision = votes |> List.sumBy (fun v -> v.Belief.Axes.[a].Precision * v.Weight) })
                Ok { Frame = frame; Axes = axes }

