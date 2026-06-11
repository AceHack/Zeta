// Part of IInferenceEngine — THE HEXAGONAL INFERENCE PORT (B-1033). See IInferenceEngine.cs
// for the port doctrine (we own the interface; Zeta.Bayesian + dotnet/infer are adapters;
// conformance runs through BOTH — theirs tests ours).

namespace Zeta.Core.Abstractions;

using System.Collections.Generic;

/// <summary>The v1 model: a Gaussian factor graph in neutral terms (no engine vocabulary).</summary>
public sealed record GaussianModel(
    int VariableCount,
    IReadOnlyList<GaussianPrior> Priors,
    IReadOnlyList<EqualityFactor> Equalities);
