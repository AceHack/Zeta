using Zeta.Core.CSharp;
using Zeta.Mediator;

namespace Zeta.Mediator.Handlers;

/// <summary>Handles <see cref="MeasureContextCostQuery"/> by delegating to the proven ByteCost meter —
/// a thin CQRS shell; Core does the work.</summary>
public sealed class MeasureContextCostHandler : IQueryHandler<MeasureContextCostQuery, long>
{
    /// <summary>Return the UTF-8 byte length of the surface.</summary>
    public ValueTask<long> Handle(MeasureContextCostQuery query, CancellationToken cancellationToken)
    {
        ArgumentNullException.ThrowIfNull(query);
        return new ValueTask<long>(ByteCost.MeasureText(query.Surface).Bytes);
    }
}
