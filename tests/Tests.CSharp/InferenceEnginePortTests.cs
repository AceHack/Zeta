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

public sealed class InferenceEnginePortTests
{
    private static readonly int[] ChainVars = { 0, 1, 2 };

    private static IEnumerable<(string Id, GaussianModel Model)> ConformanceCases()
    {
        yield return ("single-prior", new GaussianModel(
            1, new[] { new GaussianPrior(0, 3.0, 2.0) }, Array.Empty<EqualityFactor>()));
        yield return ("two-priors-fuse", new GaussianModel(
            1, new[] { new GaussianPrior(0, 0.0, 1.0), new GaussianPrior(0, 4.0, 1.0) }, Array.Empty<EqualityFactor>()));
        yield return ("equality-chain", new GaussianModel(
            3,
            new[] { new GaussianPrior(0, 0.0, 1.0), new GaussianPrior(2, 4.0, 1.0) },
            new[] { new EqualityFactor(ChainVars) }));
    }

    [Fact]
    public void TheirsTestsOursBothAdaptersAgreeOnEveryConformanceCase()
    {
        IInferenceEngine ours = new Zeta.Bayesian.ZetaBayesianEngine();
        var theirs = new InferNetEngine();
        foreach (var (id, model) in ConformanceCases())
        {
            var a = ours.RunGaussian(model, 200, 1e-10);
            var b = theirs.RunGaussian(model, 200, 1e-10);
            Assert.True(a.Converged, $"{id}: ours did not converge");
            for (var v = 0; v < model.VariableCount; v++)
            {
                Assert.True(Math.Abs(a.Marginals[v].Mean - b.Marginals[v].Mean) < 1e-6,
                    $"{id} v{v} mean: ours={a.Marginals[v].Mean} infer-net={b.Marginals[v].Mean}");
                Assert.True(Math.Abs(a.Marginals[v].Variance - b.Marginals[v].Variance) < 1e-6,
                    $"{id} v{v} var: ours={a.Marginals[v].Variance} infer-net={b.Marginals[v].Variance}");
            }
        }
    }
}
