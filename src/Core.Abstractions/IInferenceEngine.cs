// IInferenceEngine — THE HEXAGONAL INFERENCE PORT (B-1033; Aaron 2026-06-13: "hexagonal the
// Infer.NET types — make them follow OUR standards, own the interface, plug them in, and use
// them to test ours; we have two impls"). WE own this interface; engines are adapters:
//   Adapter A — Zeta.Bayesian (ours: FactorGraph/Message/Ep — DST-deterministic schedules).
//   Adapter B — dotnet/infer (Minka & Winn's engine; MIT; TEST-SIDE only, never in Core).
// Conformance cases run through BOTH adapters and must agree within stated tolerance — BP-16
// made structural (theirs tests ours; Minka's engine is the senior oracle, ours is the one we
// can fix). v1 scope is the GAUSSIAN LANE deliberately: priors + equality factors -> marginals —
// expressible in both engines and hand-checkable analytically (precision-weighted products).
// Our standards hold at the port: deterministic (fixed schedule, no ambient entropy), total
// (failures are values, not exceptions), culture-invariant.

namespace Zeta.Core.Abstractions;

/// <summary>The port. Implementations MUST be deterministic for a fixed model (DST: same model,
/// same marginals, byte-stable ordering by variable index).</summary>
public interface IInferenceEngine
{
    /// <summary>Adapter name (for conformance reporting: which oracle said what).</summary>
    public string Name { get; }

    /// <summary>Run Gaussian belief propagation to convergence (bounded) and read all marginals.</summary>
    public InferenceResult RunGaussian(GaussianModel model, int maxRounds, double tolerance);
}
