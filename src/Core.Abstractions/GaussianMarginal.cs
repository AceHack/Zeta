// Part of IInferenceEngine — THE HEXAGONAL INFERENCE PORT (B-1033). See IInferenceEngine.cs
// for the port doctrine (we own the interface; Zeta.Bayesian + dotnet/infer are adapters;
// conformance runs through BOTH — theirs tests ours).

namespace Zeta.Core.Abstractions;

using System.Runtime.InteropServices;

/// <summary>One variable's posterior marginal.</summary>
[StructLayout(LayoutKind.Auto)]
public readonly record struct GaussianMarginal(int Variable, double Mean, double Variance);
