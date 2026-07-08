namespace Zeta.Bayesian

open Zeta.Core

/// **WeaviateMemory — vector memory for warm-starting sequential ensembles.**
///
/// ## Purpose
///
/// The `SequentialEnsemble` currently starts each chain from the uninformative prior
/// (zero precision). This module provides a memory layer that stores past posteriors
/// as vectors and retrieves similar past beliefs to warm-start new chains.
///
/// ## Design
///
/// A `Gaussian` posterior is represented as a 2-vector `[PrecisionMean; Precision]`.
/// Similarity is measured by cosine similarity in this 2-dimensional space.
///
/// The memory is a simple in-memory store keyed by a `string` label (e.g., the
/// Adinkra codeword as a hex string). On the real infrastructure, this would be
/// backed by Weaviate (vector DB) via ArgoCD.
///
/// ## Interface
///
/// The `IVectorMemory` interface abstracts the storage backend so the sequential
/// ensemble can be tested against the in-memory mock and deployed against Weaviate
/// without changing the ensemble code.
///
/// ## Warm-start protocol
///
/// 1. Before starting a new sequential chain, call `retrieve` with the first cell's
///    codeword label to get the most similar past posterior.
/// 2. If a match is found (similarity ≥ threshold), use it as the chain's initial prior.
/// 3. After the chain completes, call `store` with the final posterior.
///
/// This implements the "prior injection" step described in the sequential ensemble design.
[<RequireQualifiedAccess>]
module WeaviateMemory =

    // ── Vector representation ─────────────────────────────────────────────────────────────────────

    /// A stored belief vector: `[PrecisionMean; Precision]`.
    type BeliefVector = { PrecisionMean: float; Precision: float; Label: string }

    /// Convert a `Gaussian` to a `BeliefVector`.
    let toVector (label: string) (g: Gaussian) : BeliefVector =
        { PrecisionMean = g.PrecisionMean; Precision = g.Precision; Label = label }

    /// Convert a `BeliefVector` back to a `Gaussian`.
    let toGaussian (v: BeliefVector) : Gaussian =
        { PrecisionMean = v.PrecisionMean; Precision = v.Precision }

    /// **Cosine similarity** between two belief vectors in the `[PrecisionMean; Precision]` space.
    ///
    /// Returns a value in `[-1, 1]`. Returns 0.0 for zero vectors.
    let cosineSimilarity (a: BeliefVector) (b: BeliefVector) : float =
        let dot = a.PrecisionMean * b.PrecisionMean + a.Precision * b.Precision
        let normA = sqrt (a.PrecisionMean ** 2.0 + a.Precision ** 2.0)
        let normB = sqrt (b.PrecisionMean ** 2.0 + b.Precision ** 2.0)
        if normA < 1e-12 || normB < 1e-12 then 0.0
        else dot / (normA * normB)

    // ── The IVectorMemory interface ───────────────────────────────────────────────────────────────

    /// **Abstract vector memory interface.**
    ///
    /// Implementations:
    ///   - `InMemoryVectorMemory`: in-process mock for testing
    ///   - (future) `WeaviateVectorMemory`: backed by Weaviate via ArgoCD
    type IVectorMemory =
        /// Store a belief vector under the given label.
        abstract member Store : BeliefVector -> unit
        /// Retrieve the most similar stored vector to the query, if similarity ≥ threshold.
        abstract member Retrieve : query: BeliefVector * threshold: float -> BeliefVector option
        /// Return all stored vectors (for inspection/testing).
        abstract member All : unit -> BeliefVector list
        /// Clear all stored vectors.
        abstract member Clear : unit -> unit

    // ── In-memory mock implementation ────────────────────────────────────────────────────────────

    /// **In-memory mock vector memory.**
    ///
    /// Stores belief vectors in a mutable list. Thread-safe via a lock.
    type InMemoryVectorMemory() =
        let mutable store : BeliefVector list = []
        let lockObj = obj ()

        interface IVectorMemory with
            member _.Store(v) =
                lock lockObj (fun () -> store <- v :: store)

            member _.Retrieve(query, threshold) =
                lock lockObj (fun () ->
                    store
                    |> List.map (fun v -> v, cosineSimilarity query v)
                    |> List.filter (fun (_, sim) -> sim >= threshold)
                    |> List.sortByDescending snd
                    |> List.tryHead
                    |> Option.map fst)

            member _.All() =
                lock lockObj (fun () -> store)

            member _.Clear() =
                lock lockObj (fun () -> store <- [])

    // ── Warm-start protocol ───────────────────────────────────────────────────────────────────────

    /// **Default similarity threshold for warm-starting.**
    ///
    /// A cosine similarity ≥ 0.95 means the query vector is within ~18° of the stored vector
    /// in the `[PrecisionMean; Precision]` space — a close enough match to use as a prior.
    let defaultThreshold = 0.95

    /// **Retrieve a warm-start prior for a new sequential chain.**
    ///
    /// Returns the most similar past posterior if similarity ≥ threshold,
    /// otherwise returns the uninformative prior `{PrecisionMean=0; Precision=0}`.
    let warmStartPrior
            (memory: IVectorMemory)
            (label: string)
            (currentBelief: Gaussian)
            (threshold: float)
            : Gaussian =
        let query = toVector label currentBelief
        match memory.Retrieve(query, threshold) with
        | Some v -> toGaussian v
        | None -> { PrecisionMean = 0.0; Precision = 0.0 }  // uninformative prior

    /// **Store the final posterior of a completed sequential chain.**
    let storePosterior (memory: IVectorMemory) (label: string) (posterior: Gaussian) : unit =
        memory.Store(toVector label posterior)

    // ── Sequential ensemble integration ──────────────────────────────────────────────────────────

    /// **Run a sequential ensemble with warm-start from memory.**
    ///
    /// 1. Retrieve a warm-start prior for the first cell's label.
    /// 2. Run the sequential chain starting from that prior.
    /// 3. Store the final posterior back into memory.
    ///
    /// Returns `(finalPosterior, wasWarmStarted)`.
    let runWithMemory
            (memory: IVectorMemory)
            (label: string)
            (signals: Gaussian list)
            (threshold: float)
            : Gaussian * bool =
        if signals.IsEmpty then
            ({ PrecisionMean = 0.0; Precision = 0.0 }, false)
        else
            // Step 1: retrieve warm-start prior
            let firstSignal = signals.Head
            let prior = warmStartPrior memory label firstSignal threshold
            let wasWarmStarted = prior.Precision > 0.0

            // Step 2: run the sequential chain
            // The sequential chain: posterior_i = prior_i * likelihood_i (Gaussian product)
            // Starting from `prior`, accumulate each signal.
            let finalPosterior =
                signals |> List.fold (fun acc signal ->
                    { PrecisionMean = acc.PrecisionMean + signal.PrecisionMean
                      Precision = acc.Precision + signal.Precision }
                ) prior

            // Step 3: store the final posterior
            storePosterior memory label finalPosterior

            (finalPosterior, wasWarmStarted)

    // ── Memory statistics ─────────────────────────────────────────────────────────────────────────

    /// **Memory statistics for monitoring.**
    type MemoryStats =
        { Count: int
          MeanPrecision: float
          MaxPrecision: float
          MinPrecision: float }

    /// Compute statistics over all stored vectors.
    let stats (memory: IVectorMemory) : MemoryStats =
        let all = memory.All()
        if all.IsEmpty then
            { Count = 0; MeanPrecision = 0.0; MaxPrecision = 0.0; MinPrecision = 0.0 }
        else
            let precisions = all |> List.map (fun v -> v.Precision)
            { Count = all.Length
              MeanPrecision = List.average precisions
              MaxPrecision = List.max precisions
              MinPrecision = List.min precisions }
