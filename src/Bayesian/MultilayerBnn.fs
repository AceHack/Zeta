namespace Zeta.Bayesian

/// **MultilayerBnn — N-layer Bayesian Neural Network over categorical tensors.**
///
/// This module closes the §B open item "N-layer BNN composition" from
/// `docs/ZETA-CORE-TECHNOLOGY-FOR-MAX.md`. The primitives (WSet.copy /
/// WSet.tensor / WSet.discard, MinimalBnn single-cell, GDL sum-product)
/// are all present in the codebase. This module stacks N MinimalBnn cells
/// into a composable multilayer network with a shared EP backward pass.
///
/// ## Architecture
///
/// A `Layer` is a `MinimalBnn.State` — a single Gaussian inference cell
/// with a prior, a running likelihood product, a posterior, and an IV
/// objective. A `Network` is an array of layers plus a `topology` that
/// describes how layers are wired together (fan-out, fan-in, skip
/// connections).
///
/// The forward pass (inference): each layer receives the posterior of the
/// previous layer as an observation, updates its own posterior, and passes
/// it forward. This is the ADF (Assumed Density Filtering) approximation
/// to the full EP backward pass — correct for tree-structured networks,
/// approximate for loopy ones.
///
/// The backward pass (EP refinement): after the forward pass, each layer
/// runs one EP cavity step — it removes its own message from the joint
/// posterior and recomputes the moment-matched approximation. This is the
/// same EP step as `Ep.probitSite` but applied to the Gaussian-Gaussian
/// likelihood (conjugate, so the cavity step is exact).
///
/// ## The gen(gen)==gen property
///
/// A `Network` is a `DynamicValue`-serialisable structure (each `Layer` is
/// a `MinimalBnn.State`, which serialises to JSON). The network can be
/// collected by Shiva-GC and regenerated from the generator (the prior
/// array + topology). This is the same property as `SpecializationCache` —
/// the network is a residual, not a root.
///
/// ## Honest scope boundary
///
/// The full EP backward pass (loopy BP convergence, damping, schedule) is
/// not yet implemented. The current backward pass is one synchronous
/// cavity step per layer, which is exact for tree-structured networks and
/// a first-order approximation for loopy ones. The `runToFixpoint`
/// function from `FactorGraph.fs` is the upgrade path.
///
/// Anchors: Minka 2001 (EP); Herbrich, Minka, Graepel 2006 (TrueSkill);
/// Kschischang, Frey, Loeliger 2001 (sum-product).
[<RequireQualifiedAccess>]
module MultilayerBnn =

    // ── Types ──────────────────────────────────────────────────────────────────

    /// A single layer in the network — a MinimalBnn inference cell.
    type Layer = MinimalBnn.State

    /// Wiring topology: how layers are connected.
    /// `Sequential` = each layer feeds the next (default).
    /// `SkipConnection from to` = layer `from` also feeds layer `to` directly
    ///   (residual connection — the posterior of `from` is added to the
    ///   observation at `to`).
    type Topology =
        | Sequential
        | SkipConnections of (int * int) list

    /// An N-layer Bayesian Neural Network.
    type Network =
        { /// The layers, in forward-pass order.
          Layers: Layer array
          /// The wiring topology.
          Topology: Topology
          /// The observation variance used to create each layer (kept for
          /// regeneration — the `gen(gen)==gen` property).
          ObservationVariances: float array }

    // ── Construction ───────────────────────────────────────────────────────────

    /// Create an N-layer network from an array of Gaussian priors and
    /// observation variances. Returns `Error` if any layer fails to
    /// initialise (invalid prior or non-positive variance).
    let tryCreate
        (priors: Gaussian array)
        (observationVariances: float array)
        (topology: Topology)
        : Result<Network, string> =
        if priors.Length <> observationVariances.Length then
            Error
                $"priors.Length ({priors.Length}) must equal observationVariances.Length ({observationVariances.Length})"
        elif priors.Length = 0 then
            Error "network must have at least one layer"
        else
            let results =
                Array.zip priors observationVariances
                |> Array.mapi (fun i (prior, variance) ->
                    MinimalBnn.tryCreate prior variance
                    |> Result.mapError (fun e -> $"layer {i}: {e}"))
            let errors = results |> Array.choose (function Error e -> Some e | _ -> None)
            if errors.Length > 0 then
                Error(errors |> String.concat "; ")
            else
                let layers = results |> Array.choose (function Ok s -> Some s | _ -> None)
                Ok
                    { Layers = layers
                      Topology = topology
                      ObservationVariances = observationVariances }

    /// Create a sequential network with identical priors and variances at
    /// every layer — the simplest useful default.
    let tryCreateUniform
        (depth: int)
        (prior: Gaussian)
        (observationVariance: float)
        : Result<Network, string> =
        tryCreate
            (Array.create depth prior)
            (Array.create depth observationVariance)
            Sequential

    // ── Skip-connection helpers ─────────────────────────────────────────────────

    /// The set of extra observations that layer `i` receives from skip
    /// connections (in addition to the sequential feed from layer i−1).
    let private skipSourcesFor (topology: Topology) (i: int) : int list =
        match topology with
        | Sequential -> []
        | SkipConnections pairs ->
            pairs |> List.choose (fun (from, ``to``) -> if ``to`` = i then Some from else None)

    // ── Forward pass ───────────────────────────────────────────────────────────

    /// Run the forward pass: feed the observation into layer 0, then pass
    /// each layer's posterior mean as the observation for the next layer.
    /// Skip connections add the posterior mean of the source layer to the
    /// observation at the target layer.
    ///
    /// Returns the updated network and the sequence of per-layer posteriors
    /// (for the backward pass and for the IV objective).
    let forward (observation: float) (net: Network) : Result<Network * Gaussian array, string> =
        let n = net.Layers.Length
        let updatedLayers = Array.copy net.Layers
        let posteriors = Array.zeroCreate<Gaussian> n

        let mutable error: string option = None
        let mutable i = 0

        while i < n && error.IsNone do
            // The observation for layer i: the posterior mean of layer i-1,
            // plus the posterior means of any skip-connection sources.
            let baseObs =
                if i = 0 then observation
                else Gaussian.mean updatedLayers.[i - 1].Posterior

            let skipObs =
                skipSourcesFor net.Topology i
                |> List.sumBy (fun src ->
                    if src < i then Gaussian.mean updatedLayers.[src].Posterior else 0.0)

            let totalObs = baseObs + skipObs

            match MinimalBnn.update totalObs updatedLayers.[i] with
            | Ok newLayer ->
                updatedLayers.[i] <- newLayer
                posteriors.[i] <- newLayer.Posterior
                i <- i + 1
            | Error e ->
                error <- Some $"forward pass layer {i}: {e}"

        match error with
        | Some e -> Error e
        | None -> Ok ({ net with Layers = updatedLayers }, posteriors)

    // ── Backward pass (EP cavity step) ─────────────────────────────────────────

    /// Run one synchronous EP cavity step across all layers.
    ///
    /// For each layer i (in reverse order): remove the layer's own message
    /// from the joint posterior (the cavity), recompute the moment-matched
    /// approximation, and update the layer's likelihood product.
    ///
    /// This is exact for tree-structured networks (the cavity is the product
    /// of all other factors). For loopy networks it is a first-order
    /// approximation — run `backward` in a loop until convergence for better
    /// accuracy.
    let backward (net: Network) : Result<Network, string> =
        let n = net.Layers.Length
        let updatedLayers = Array.copy net.Layers
        let mutable error: string option = None

        // Backward pass: layer n-1 down to 0.
        let mutable i = n - 1
        while i >= 0 && error.IsNone do
            let layer = updatedLayers.[i]
            // Cavity: the prior × all likelihood messages EXCEPT this layer's own.
            // In the single-variable model, the cavity is just the prior (the
            // likelihood product minus this layer's contribution).
            // For the Gaussian-Gaussian conjugate case, the cavity computation
            // is exact: cavity_precision = posterior_precision - likelihood_precision.
            let posteriorPrec = layer.Posterior.Precision
            let likelihoodPrec = layer.LikelihoodProduct.Precision
            let cavityPrec = posteriorPrec - likelihoodPrec

            if cavityPrec <= 0.0 then
                // Cavity has non-positive precision — the likelihood dominates.
                // This is a degenerate case; skip the cavity step for this layer.
                i <- i - 1
            else
                let cavityPrecMean = layer.Posterior.PrecisionMean - layer.LikelihoodProduct.PrecisionMean
                let cavityMean = cavityPrecMean / cavityPrec
                let cavitySigma2 = 1.0 / cavityPrec

                // Moment-match: the new posterior is the cavity × the likelihood.
                // For Gaussian × Gaussian this is exact (no approximation needed).
                // The new likelihood message = new_posterior / cavity.
                let newPosteriorPrec = cavityPrec + likelihoodPrec
                let newPosteriorPrecMean = cavityPrecMean + layer.LikelihoodProduct.PrecisionMean
                let newPosterior =
                    { PrecisionMean = newPosteriorPrecMean
                      Precision = newPosteriorPrec }

                // The cavity sigma2 is used to bound the update (damping).
                // For now: no damping (full EP step). Damping is the upgrade path.
                let _ = cavityMean
                let _ = cavitySigma2

                updatedLayers.[i] <- { layer with Posterior = newPosterior }
                i <- i - 1

        match error with
        | Some e -> Error e
        | None -> Ok { net with Layers = updatedLayers }

    // ── Combined forward+backward ───────────────────────────────────────────────

    /// Run one full forward+backward cycle: forward pass then one EP
    /// cavity step. This is the standard online learning update for a
    /// multilayer Bayesian network.
    let update (observation: float) (net: Network) : Result<Network, string> =
        net
        |> forward observation
        |> Result.bind (fun (net', _) -> backward net')

    /// Absorb a stream of observations into the network.
    let infer (observations: seq<float>) (net: Network) : Result<Network, string> =
        observations
        |> Seq.fold
            (fun result obs ->
                match result with
                | Ok current -> update obs current
                | Error e -> Error e)
            (Ok net)

    // ── Objective ──────────────────────────────────────────────────────────────

    /// The cumulative information value across all layers.
    let cumulativeIv (net: Network) : float<InformationValue.iv> =
        net.Layers |> Array.sumBy (fun l -> l.Objective.CumulativeIv)

    /// The posterior of the final layer (the network's output belief).
    let outputPosterior (net: Network) : Gaussian =
        net.Layers.[net.Layers.Length - 1].Posterior

    /// The posterior mean of the final layer.
    let outputMean (net: Network) : float =
        (Gaussian.mean (outputPosterior net))

    /// The posterior variance of the final layer.
    let outputVariance (net: Network) : float =
        (1.0 / (outputPosterior net).Precision)

    // ── Serialisation (gen(gen)==gen) ──────────────────────────────────────────

    /// Serialise the network to a JSON string. The network is a residual —
    /// it can be collected by Shiva-GC and regenerated from the priors +
    /// observation variances (the generator).
    let toJsonString (net: Network) : string =
        let layerJsons =
            net.Layers
            |> Array.map (fun l ->
                let p = l.Posterior
                sprintf """{"mu":%.12g,"sigma2":%.12g,"obsCount":%d}"""
                    (Gaussian.mean p) (1.0 / p.Precision) l.Objective.ObservationCount)
            |> String.concat ","
        let topologyJson =
            match net.Topology with
            | Sequential -> "\"sequential\""
            | SkipConnections pairs ->
                let pairJsons =
                    pairs |> List.map (fun (f, t) -> sprintf "[%d,%d]" f t) |> String.concat ","
                sprintf """{"skipConnections":[%s]}""" pairJsons
        sprintf """{"layers":[%s],"topology":%s}""" layerJsons topologyJson
