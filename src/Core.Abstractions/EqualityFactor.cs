// Part of IInferenceEngine — THE HEXAGONAL INFERENCE PORT (B-1033). See IInferenceEngine.cs
// for the port doctrine (we own the interface; Zeta.Bayesian + dotnet/infer are adapters;
// conformance runs through BOTH — theirs tests ours).

namespace Zeta.Core.Abstractions;

using System.Collections.Generic;
using System.Runtime.InteropServices;

/// <summary>An equality factor: the listed variables are constrained equal (messages multiply).</summary>
[StructLayout(LayoutKind.Auto)]
public readonly record struct EqualityFactor(IReadOnlyList<int> Variables);
