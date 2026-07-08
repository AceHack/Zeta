namespace Zeta.Bayesian

open System

/// minimal BNN v0 = factor-graph cell with measurable IV; not a transformer; not gradient-trained weights
///
/// This module is deliberately small: one latent Gaussian variable, one
/// Gaussian likelihood family, an explicit online state, and information
/// value as the objective. The posterior is materialized through the existing
/// factor graph primitives so this stays an inference cell, not a renamed
/// neural-network placeholder.
[<RequireQualifiedAccess>]
module MinimalBnn =

    let private variableId = 0
    let private priorFactorId = 0
    let private likelihoodFactorId = 1

    /// The measurable objective for the current cell state.
    type Objective =
        { /// Number of observations absorbed into the posterior.
          ObservationCount: int
          /// IV from the most recent observation, KL(posterior_t || posterior_t-1).
          LastIncrementalIv: float<InformationValue.iv>
          /// Running sum of per-observation IV.
          CumulativeIv: float<InformationValue.iv> }

    /// Explicit online state for a single Gaussian factor-graph inference cell.
    type State =
        { /// Fixed prior for the latent variable.
          Prior: Gaussian
          /// Product of all Gaussian likelihood messages seen so far.
          LikelihoodProduct: Gaussian
          /// Current posterior marginal for the latent variable.
          Posterior: Gaussian
          /// Materialized one-variable factor graph for the current posterior.
          Graph: FactorGraph<Gaussian>
          /// Known observation noise variance for every Gaussian likelihood.
          ObservationVariance: float
          /// Current IV objective.
          Objective: Objective }

    let private isFinite (value: float) : bool =
        Double.IsFinite value

    let private validGaussian (name: string) (gaussian: Gaussian) : Result<unit, string> =
        if not (isFinite gaussian.PrecisionMean) then
            Error(name + ".PrecisionMean must be finite")
        elif not (isFinite gaussian.Precision) || gaussian.Precision <= 0.0 then
            Error(name + ".Precision must be finite and > 0")
        else
            Ok()

    let private validObservationVariance (observationVariance: float) : Result<unit, string> =
        if not (isFinite observationVariance) || observationVariance <= 0.0 then
            Error("observationVariance must be finite and > 0")
        else
            Ok()

    let private likelihood (observationVariance: float) (observation: float) : Gaussian =
        let precision = 1.0 / observationVariance
        { PrecisionMean = observation * precision
          Precision = precision }

    let private posteriorGraph (prior: Gaussian) (likelihoodProduct: Gaussian) : FactorGraph<Gaussian> =
        FactorGraph.empty Gaussian.algebra
        |> FactorGraph.addFactor priorFactorId (Factor.prior variableId prior)
        |> FactorGraph.addFactor likelihoodFactorId (Factor.prior variableId likelihoodProduct)
        |> FactorGraph.passOnce

    /// Build the initial inference cell state from a proper Gaussian prior and
    /// a known Gaussian observation variance.
    let tryCreate (prior: Gaussian) (observationVariance: float) : Result<State, string> =
        match validGaussian "prior" prior, validObservationVariance observationVariance with
        | Ok(), Ok() ->
            let graph = posteriorGraph prior Gaussian.uniform
            let posterior = FactorGraph.marginal variableId graph
            Ok
                { Prior = prior
                  LikelihoodProduct = Gaussian.uniform
                  Posterior = posterior
                  Graph = graph
                  ObservationVariance = observationVariance
                  Objective =
                    { ObservationCount = 0
                      LastIncrementalIv = 0.0<InformationValue.iv>
                      CumulativeIv = 0.0<InformationValue.iv> } }
        | Error message, _ -> Error message
        | _, Error message -> Error message

    /// Absorb one scalar observation with the state's fixed Gaussian
    /// likelihood variance. The update is conjugate: multiply the cumulative
    /// likelihood message, re-materialize the one-variable factor graph, and
    /// score the step as IV.
    let update (observation: float) (state: State) : Result<State, string> =
        if not (isFinite observation) then
            Error("observation must be finite")
        else
            let likelihoodMessage = likelihood state.ObservationVariance observation
            let likelihoodProduct = state.LikelihoodProduct * likelihoodMessage
            let graph = posteriorGraph state.Prior likelihoodProduct
            let posterior = FactorGraph.marginal variableId graph
            let stepIv = InformationValue.compute state.Posterior posterior
            Ok
                { state with
                    LikelihoodProduct = likelihoodProduct
                    Posterior = posterior
                    Graph = graph
                    Objective =
                        { ObservationCount = state.Objective.ObservationCount + 1
                          LastIncrementalIv = stepIv
                          CumulativeIv = state.Objective.CumulativeIv + stepIv } }

    /// Absorb a finite stream of observations into the running posterior.
    let infer (observations: seq<float>) (state: State) : Result<State, string> =
        observations
        |> Seq.fold
            (fun result observation ->
                match result with
                | Ok current -> update observation current
                | Error message -> Error message)
            (Ok state)

    /// The current objective value: cumulative information value in nats.
    let objective (state: State) : Objective =
        state.Objective
