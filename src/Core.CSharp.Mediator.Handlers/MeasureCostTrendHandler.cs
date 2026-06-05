using Zeta.Core;
using Zeta.Mediator;

namespace Zeta.Mediator.Handlers;

/// <summary>Handles <see cref="MeasureCostTrendQuery"/> by measuring each surface (ByteCost) and taking
/// the rate (∂) and curvature (∂²) over the resulting series (Curve) — a thin CQRS shell composing two
/// proven Core primitives.</summary>
public sealed class MeasureCostTrendHandler : IQueryHandler<MeasureCostTrendQuery, CostTrend>
{
    /// <summary>Measure the cost series, then its velocity and acceleration.</summary>
    public ValueTask<CostTrend> Handle(MeasureCostTrendQuery query, CancellationToken cancellationToken)
    {
        ArgumentNullException.ThrowIfNull(query);
        var costs = new long[query.Surfaces.Count];
        for (var i = 0; i < costs.Length; i++)
        {
            costs[i] = Zeta.Core.CSharp.ByteCost.MeasureText(query.Surfaces[i]).Bytes;
        }

        var rate = Curve.differentiate(costs);
        var curvature = Curve.curvature(costs);
        return new ValueTask<CostTrend>(new CostTrend(costs, rate, curvature));
    }
}
