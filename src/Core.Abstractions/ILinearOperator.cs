namespace Zeta.Core;

/// <summary>
/// Algebra capability: operator is linear.
/// </summary>
public interface ILinearOperator<in TIn, out TOut> : IOperator<TOut>, ILinearMarker
{
}
