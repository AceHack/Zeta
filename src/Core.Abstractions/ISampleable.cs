namespace Zeta.Core;

/// <summary>
/// Capability facet — <b>light</b>: values can be sampled (the field "carries light" a ray can read).
/// </summary>
public interface ISampleable<TCoord, TValue>
{
    /// <summary>The value at a coordinate (the semiring Zero/default where absent).</summary>
    TValue Sample(TCoord at);
}
