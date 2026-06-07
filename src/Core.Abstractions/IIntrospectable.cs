namespace Zeta.Core;

/// <summary>
/// Capability facet — <b>introspection</b>: the structure can be walked/queried (MUMPS/Globals-style), so a
/// ray can step through it.
/// </summary>
public interface IIntrospectable<TCoord>
{
    /// <summary>Whether a coordinate is defined (a node exists there).</summary>
    bool Exists(TCoord at);

    /// <summary>The immediate next coordinates from <paramref name="at"/> (the ray's stepping options).</summary>
    IEnumerable<TCoord> Neighbors(TCoord at);
}
