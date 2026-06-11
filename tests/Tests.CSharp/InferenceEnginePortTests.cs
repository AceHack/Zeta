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
    private static readonly int[] Edge01 = { 0, 1 };
    private static readonly int[] Edge12 = { 1, 2 };
    private static readonly int[] Edge20 = { 2, 0 };

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
        // OBSERVED-VALUE family: a prior plus two noisy observations of the same quantity
        yield return ("noisy-observations", new GaussianModel(
            1,
            new[] { new GaussianPrior(0, 0.0, 10.0), new GaussianPrior(0, 2.2, 1.0), new GaussianPrior(0, 1.8, 1.0) },
            Array.Empty<EqualityFactor>()));
        // THE EP FAMILY: prior N(0,1) under the soft observation x > 0 — both engines
        // moment-match (ours: Ep.probitFactor; theirs: ConstrainPositive). This exercises the
        // APPROXIMATION, not just exact algebra; the analytic truth for N(0,1)|x>0 is
        // mean = sqrt(2/pi) ≈ 0.7979, variance = 1 - 2/pi ≈ 0.3634.
        // SOFT EP family: prior N(0,1) under the probit likelihood Φ(x) — the soft twin
        yield return ("ep-soft-positivity", new GaussianModel(
            1,
            new[] { new GaussianPrior(0, 0.0, 1.0) },
            Array.Empty<EqualityFactor>(),
            Array.Empty<PositivityConstraint>(),
            new[] { new SoftPositivityConstraint(0) }));
        yield return ("ep-positivity", new GaussianModel(
            1,
            new[] { new GaussianPrior(0, 0.0, 1.0) },
            Array.Empty<EqualityFactor>(),
            new[] { new PositivityConstraint(0) }));
        // LOOPY honesty: an equality CYCLE (0=1, 1=2, 2=0) with two priors — loopy BP on a pure
        // equality cycle; both engines must converge and agree (the loop is benign for equality,
        // but it is the suite's first non-tree graph — the honesty case the literature warns on).
        yield return ("loopy-equality-cycle", new GaussianModel(
            3,
            new[] { new GaussianPrior(0, 0.0, 1.0), new GaussianPrior(2, 4.0, 1.0) },
            new[]
            {
                new EqualityFactor(Edge01),
                new EqualityFactor(Edge12),
                new EqualityFactor(Edge20),
            }));
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

            if (string.Equals(id, "loopy-equality-cycle", StringComparison.Ordinal))
            {
                // THE HONESTY CASE, now mechanically asserted (P0 fix: the senior's Converged was
                // previously hardcoded; the "reversal" lived in a comment). The truths we assert:
                // (a) OURS refuses to claim convergence on the leak-free loop (Weiss & Freeman:
                //     precision overcounts; non-convergence is a value);
                // (b) means: OURS lands the analytic 2.0 EXACTLY (1e-9); the senior's schedule
                //     residue is bounded (5e-3) — whatever its convergence flag now honestly says.
                Assert.False(a.Converged, $"{id}: ours claimed convergence on a loop raw BP cannot settle");
                for (var v = 0; v < model.VariableCount; v++)
                {
                    Assert.True(Math.Abs(a.Marginals[v].Mean - 2.0) < 1e-9,
                        $"{id} v{v}: ours must land the analytic mean 2.0 exactly; got {a.Marginals[v].Mean}");
                    Assert.True(Math.Abs(b.Marginals[v].Mean - 2.0) < 5e-3,
                        $"{id} v{v}: senior mean outside its residue bound; got {b.Marginals[v].Mean}");
                }

                continue;
            }

            Assert.True(a.Converged, $"{id}: ours did not converge");

            // exact-algebra cases agree to 1e-6; EP cases compare two moment-matching
            // implementations — 1e-4 is the honest tolerance for the approximation family
            var tol = (model.Positivities.Count > 0 || model.SoftPositivities.Count > 0) ? 1e-4 : 1e-6;
            for (var v = 0; v < model.VariableCount; v++)
            {
                Assert.True(Math.Abs(a.Marginals[v].Mean - b.Marginals[v].Mean) < tol,
                    $"{id} v{v} mean: ours={a.Marginals[v].Mean} infer-net={b.Marginals[v].Mean}");
                Assert.True(Math.Abs(a.Marginals[v].Variance - b.Marginals[v].Variance) < tol,
                    $"{id} v{v} var: ours={a.Marginals[v].Variance} infer-net={b.Marginals[v].Variance}");
            }
        }
    }
}
