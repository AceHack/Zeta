// Part of IInferenceEngine — THE HEXAGONAL INFERENCE PORT (B-1033). The SOFT positivity case:
// a probit likelihood Φ(x) (noisy "x is probably positive"), distinct from the HARD
// PositivityConstraint (step function x>0). Ours: Ep.probitFactor; Infer.NET: Φ via
// IsPositive on a noisy copy / Gaussian>0 with observation noise. Both EP — the soft twin of the
// hard case, so the suite now covers BOTH EP semantics the day's bug-hunt distinguished.

namespace Zeta.Core.Abstractions;

using System.Runtime.InteropServices;

/// <summary>A soft positivity (probit) observation: likelihood Φ(variable) — noisy "x &gt; 0".</summary>
[StructLayout(LayoutKind.Auto)]
public readonly record struct SoftPositivityConstraint(int Variable);
