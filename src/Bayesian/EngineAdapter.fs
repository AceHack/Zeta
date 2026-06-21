namespace Zeta.Bayesian

open Zeta.Core.Abstractions

/// ADAPTER A of the hexagonal inference port (081KTZ4EF0008QG0R000WJGSWX): OUR engine (FactorGraph + Gaussian
/// messages) behind the `IInferenceEngine` interface WE own. Deterministic by construction —
/// `FactorGraph.passOnce` walks factors in id order, no ambient entropy anywhere (the
/// determinism lint fences Core; this module inherits the discipline). Adapter B (dotnet/infer,
/// Minka & Winn) implements the SAME port test-side; conformance cases run through both —
/// theirs tests ours.
type ZetaBayesianEngine(alpha: float) =
    // alpha < 1.0 = blended messages in natural params (Gaussian.blend; Heskes 2002). Honest
    // limit: damping MITIGATES oscillation, it does not cure a leak-free loop — the pure equality
    // cycle's precision diverges monotonically (means stay exact); damping only slows the drift.
    // alpha = 1.0 = raw BP. Both behaviors are real and tested. Two explicit ctors so C# consumers
    // get a clean parameterless `new ZetaBayesianEngine()` (F# optional args don't expose well).
    new() = ZetaBayesianEngine(1.0)

    interface IInferenceEngine with
        member _.Name = if alpha < 1.0 then sprintf "zeta-bayesian(damped %.2f)" alpha else "zeta-bayesian"

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

            let withEqualities =
                model.Equalities
                |> Seq.indexed
                |> Seq.fold
                    (fun g (i, e) ->
                        FactorGraph.addFactor (Seq.length model.Priors + i) (Factor.equality algebra (List.ofSeq e.Variables)) g)
                    withPriors

            // the EP family: each positivity = Minka's probit factor (cavity -> project -> divide)
            let graph =
                model.Positivities
                |> Seq.indexed
                |> Seq.fold
                    (fun g (i, pc) ->
                        FactorGraph.addFactor
                            (Seq.length model.Priors + Seq.length model.Equalities + i)
                            (Ep.positivityFactor pc.Variable) // HARD truncation — the port semantic (the soft probit is a different, future port case)
                            g)
                    withEqualities

            let withSoft =
                model.SoftPositivities
                |> Seq.indexed
                |> Seq.fold
                    (fun g (i, sp) ->
                        FactorGraph.addFactor
                            (Seq.length model.Priors + Seq.length model.Equalities + Seq.length model.Positivities + i)
                            (Ep.probitFactor sp.Variable)
                            g)
                    graph

            let graph = withSoft

            let final, rounds, converged =
                if alpha < 1.0 then
                    FactorGraph.runToFixpointDamped Gaussian.blend alpha Gaussian.distance tolerance maxRounds graph
                else
                    FactorGraph.runToFixpoint Gaussian.distance tolerance maxRounds graph

            let marginals =
                [| for v in 0 .. model.VariableCount - 1 ->
                       let m = FactorGraph.marginal v final
                       GaussianMarginal(v, Gaussian.mean m, Gaussian.variance m) |]

            InferenceResult(converged, rounds, marginals)
