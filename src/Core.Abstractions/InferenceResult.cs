// Part of IInferenceEngine — THE HEXAGONAL INFERENCE PORT (B-1033). See IInferenceEngine.cs
// for the port doctrine (we own the interface; Zeta.Bayesian + dotnet/infer are adapters;
// conformance runs through BOTH — theirs tests ours).

namespace Zeta.Core.Abstractions;

using System.Collections.Generic;

/// <summary>The run outcome — total: Converged=false is a VALUE, never a throw.</summary>
public sealed record InferenceResult(
    bool Converged,
    int Rounds,
    IReadOnlyList<GaussianMarginal> Marginals);
