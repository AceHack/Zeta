using Zeta.Core.Abstractions; // ITensor lives in this namespace; ISemiring lives in Zeta.Core

namespace Zeta.Core;

/// <summary>
/// **The unified ray-traceable interface** — the tensor capability vector composed into one contract
/// (Aaron 2026-06-07). A structure is ray-traceable when it is:
/// <list type="bullet">
///   <item><b>sparse</b> + enumerable — <see cref="ITensor{TCoord,TValue}"/> (skip empty space)</item>
///   <item><b>light</b> — <see cref="ISampleable{TCoord,TValue}"/> (sample values along the ray)</item>
///   <item><b>introspectable</b> — <see cref="IIntrospectable{TCoord}"/> (walk the structure)</item>
///   <item><b>geospatial</b> — <see cref="IGeospatial{TCoord}"/> (locality topology: memory/network/generator/time-attention)</item>
///   <item><b>weighted</b> — accumulation via an <see cref="ISemiring{TValue}"/> passed to <see cref="Trace"/></item>
/// </list>
/// Missing any facet ⇒ "dark" in that dimension (the gap-finder: the missing capability is the next build).
///
/// <para>
/// <b>Cross-partition + irreducible uncertainty:</b> the ray may cross partition boundaries and sample other
/// partitions' <c>DynamicValue</c>/<c>SoftValue</c> fields. With <c>TValue = SoftValue</c> and a probability
/// <see cref="ISemiring{TValue}"/>, the trace <b>propagates each partition's irreducible uncertainty</b> —
/// you cannot sample away another partition's residual; it carries forward. So the result is itself soft.
/// </para>
/// </summary>
public interface IRayTraceable<TCoord, TValue> : ITensor<TCoord, TValue>, ISampleable<TCoord, TValue>, IIntrospectable<TCoord>, IGeospatial<TCoord>
{
    /// <summary>
    /// Cast a ray (a path of coordinates) from <paramref name="from"/> — **any** frame — accumulating the
    /// sampled values along it via <paramref name="accumulate"/> (skip empty via sparsity, walk via
    /// introspection + geospatial locality, sample via light, combine via the semiring). When
    /// <paramref name="from"/> is an <see cref="ITravelerFrame"/> with <c>IsDeterministic = true</c>, the
    /// trace is replayable and the result is a **proof** (holds across self-propagating patterns, Zeta
    /// included), even when the field carries irreducible (soft) uncertainty.
    /// </summary>
    public TValue Trace(IFrame from, IReadOnlyList<TCoord> ray, ISemiring<TValue> accumulate);
}
