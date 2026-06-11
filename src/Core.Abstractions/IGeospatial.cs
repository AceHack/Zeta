namespace Zeta.Core;

/// <summary>
/// Capability facet — <b>geospatial</b> (Aaron 2026-06-07): coordinates are embedded in a <b>metric locality
/// space</b>, which is what makes a "ray" a <i>geometric</i> object (a line through real space) rather than
/// only an abstract path through a graph. <see cref="Position"/> gives a coordinate's point in that space;
/// <see cref="Within"/> is the spatial range query (the geometric acceleration structure — R-tree / geohash /
/// BVH style) that lets a ray skip empty/far regions.
///
/// <para>
/// The "space" is general — it is the substrate's unified <b>where / when / what-to-attend</b> topology:
/// </para>
/// <list type="bullet">
///   <item><b>Hierarchical memory</b> — a Sequoia-like recursive memory-level tree (Fatahalian et al.,
///     Stanford 2006): position = locality in the memory hierarchy; proximity = cache/region locality.</item>
///   <item><b>Network memory map</b> — distributed placement across nodes/partitions (which machine/cell
///     holds the data); proximity = network locality. Enables cross-partition ray-tracing.</item>
///   <item><b>Generator-function map</b> — where the generators/compressors live (compression-as-generators);
///     position locates the producer of a region's content.</item>
///   <item><b>Spatio-temporal + attention</b> — "remember when / pay attention": a time axis (when) and an
///     attention weighting (what to attend to). Attention is learned proximity/relevance in this space —
///     the substrate's analogue of transformer attention.</item>
/// </list>
/// So "geospatial" = a coordinate's location in (memory hierarchy × network × generator-space × time ×
/// attention). A ray traversing it respects locality across all of these at once.
/// </summary>
public interface IGeospatial<TCoord>
{
    /// <summary>Number of dimensions of the locality space (2 = lat/lon, 3 = x/y/z, N = the general topology).</summary>
    public int Dimensions { get; }

    /// <summary>The coordinate's position in the metric locality space the ray travels through.</summary>
    public IReadOnlyList<double> Position(TCoord at);

    /// <summary>Coordinates whose position lies within the axis-aligned box [min, max] (locality/region query).</summary>
    public IEnumerable<TCoord> Within(IReadOnlyList<double> min, IReadOnlyList<double> max);
}
