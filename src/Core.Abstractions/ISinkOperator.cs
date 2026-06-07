namespace Zeta.Core;

/// <summary>
/// Algebra capability: operator is a sink.
/// </summary>
public interface ISinkOperator<in TIn, out TOut> : IOperator<TOut>, ISinkMarker
{
}
