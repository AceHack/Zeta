// Part of IInferenceEngine — THE HEXAGONAL INFERENCE PORT (B-1033). The EP case family: a soft
// "x > 0" observation (probit likelihood). Ours runs it through Ep.probitFactor (Minka's
// cavity→project→divide); Infer.NET via Variable.ConstrainPositive — BOTH are EP moment-matching,
// so cross-adapter agreement here exercises the approximation itself, not just exact algebra.

namespace Zeta.Core.Abstractions;

using System.Runtime.InteropServices;

/// <summary>A positivity (probit) constraint: the soft observation "variable &gt; 0".</summary>
[StructLayout(LayoutKind.Auto)]
public readonly record struct PositivityConstraint(int Variable);
