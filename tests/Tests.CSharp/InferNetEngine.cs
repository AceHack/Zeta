// THE HEXAGONAL PORT, ADAPTER B + CROSS-CONFORMANCE (B-1033, Aaron 2026-06-13): dotnet/infer
// (Minka & Winn's Infer.NET, MIT, TEST-SIDE only) behind the IInferenceEngine interface WE own —
// and the same Gaussian cases run through BOTH adapters: theirs tests ours. Divergence beyond
// tolerance is a finding on one of the two engines (Minka's is the senior oracle).

namespace Zeta.Tests.CSharp;

using System;
using System.Collections.Generic;
using System.Linq;
using Microsoft.ML.Probabilistic.Distributions;
using Microsoft.ML.Probabilistic.Models;
using Xunit;
using Zeta.Core.Abstractions;

/// <summary>Adapter B: Infer.NET behind our port. Lives in tests by design — the MIT engine
/// never enters Core; it exists here to TEST ours.</summary>
public sealed class InferNetEngine : IInferenceEngine
{
    public string Name => "infer-net";

    public InferenceResult RunGaussian(GaussianModel model, int maxRounds, double tolerance)
    {
        var vars = new Variable<double>[model.VariableCount];
        var priorsPerVar = new List<GaussianPrior>[model.VariableCount];
        for (var v = 0; v < model.VariableCount; v++)
        {
            priorsPerVar[v] = new List<GaussianPrior>();
        }

        foreach (var p in model.Priors)
        {
            priorsPerVar[p.Variable].Add(p);
        }

        for (var v = 0; v < model.VariableCount; v++)
        {
            // first prior (or flat) defines the variable; further priors attach as constraints
            var first = priorsPerVar[v].Count > 0
                ? priorsPerVar[v][0]
                : new GaussianPrior(v, 0.0, 1e8);
            vars[v] = Variable.GaussianFromMeanAndVariance(first.Mean, first.Variance).Named($"v{v}");
            foreach (var extra in priorsPerVar[v].Skip(1))
            {
                Variable.ConstrainEqualRandom(vars[v], Gaussian.FromMeanAndVariance(extra.Mean, extra.Variance));
            }
        }

        foreach (var eq in model.Equalities)
        {
            for (var i = 1; i < eq.Variables.Count; i++)
            {
                Variable.ConstrainEqual(vars[eq.Variables[0]], vars[eq.Variables[i]]);
            }
        }

        var engine = new InferenceEngine { ShowProgress = false, NumberOfIterations = maxRounds };
        var marginals = new GaussianMarginal[model.VariableCount];
        for (var v = 0; v < model.VariableCount; v++)
        {
            var g = engine.Infer<Gaussian>(vars[v]);
            marginals[v] = new GaussianMarginal(v, g.GetMean(), g.GetVariance());
        }

        return new InferenceResult(Converged: true, Rounds: maxRounds, Marginals: marginals);
    }
}

