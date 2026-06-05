namespace Zeta.Mediator.Handlers;

/// <summary>
/// A context-cost trend: the per-sample byte <see cref="Costs"/>, their <see cref="Rate"/> (∂, the
/// context-cost velocity) and <see cref="Curvature"/> (∂², the acceleration) — the B-1016 cost curve.
/// </summary>
/// <param name="Costs">The UTF-8 byte cost of each surface, in order.</param>
/// <param name="Rate">The per-step change in cost (discrete derivative).</param>
/// <param name="Curvature">The change in the rate (second derivative).</param>
public sealed record CostTrend(
    IReadOnlyList<long> Costs,
    IReadOnlyList<long> Rate,
    IReadOnlyList<long> Curvature);
