namespace Zeta.Bayesian

open Zeta.Core.Abstractions

/// ADAPTER A of the hexagonal inference port (B-1033): OUR engine (FactorGraph + Gaussian
/// messages) behind the `IInferenceEngine` interface WE own. Deterministic by construction —
/// `FactorGraph.passOnce` walks factors in id order, no ambient entropy anywhere (the
/// determinism lint fences Core; this module inherits the discipline). Adapter B (dotnet/infer,
/// Minka & Winn) implements the SAME port test-side; conformance cases run through both —
/// theirs tests ours.
type ZetaBayesianEngine() =

    interface IInferenceEngine with
        member _.Name = "zeta-bayesian"

        member _.RunGaussian(model: GaussianModel, maxRounds: int, tolerance: float) : InferenceResult =
            let algebra = Gaussian.algebra

            // model -> our factor graph: priors first (factor ids 0..), then equality factors.
            let g0 = FactorGraph.empty algebra

            let withPriors =
                model.Priors
                |> Seq.indexed
                |> Seq.fold
                    (fun g (i, p) ->
                        FactorGraph.addFactor i (Factor.prior p.Variable (Gaussian.ofMeanVariance p.Mean p.Variance)) g)
                    g0

            let graph =
                model.Equalities
                |> Seq.indexed
                |> Seq.fold
                    (fun g (i, e) ->
                        FactorGraph.addFactor (Seq.length model.Priors + i) (Factor.equality algebra (List.ofSeq e.Variables)) g)
                    withPriors

            let final, rounds, converged =
                FactorGraph.runToFixpoint Gaussian.distance tolerance maxRounds graph

            let marginals =
                [| for v in 0 .. model.VariableCount - 1 ->
                       let m = FactorGraph.marginal v final
                       GaussianMarginal(v, Gaussian.mean m, Gaussian.variance m) |]

            InferenceResult(converged, rounds, marginals)
