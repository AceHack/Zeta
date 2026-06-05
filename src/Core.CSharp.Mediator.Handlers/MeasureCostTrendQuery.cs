using Zeta.Mediator;

namespace Zeta.Mediator.Handlers;

/// <summary>
/// Measure the context-cost trend over a series of surfaces (sampled over rounds/time) — the cost curve,
/// as a CQRS query. Composes the proven ByteCost meter with the Curve (∂/∂²) primitive over the clock.
/// </summary>
/// <param name="Surfaces">The surfaces in sample order (e.g. a surface's text per round).</param>
public sealed record MeasureCostTrendQuery(IReadOnlyList<string> Surfaces) : IQuery<CostTrend>;
