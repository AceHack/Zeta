namespace Zeta.Core;

/// <summary>
/// Algebra capability: operator is bilinear.
/// </summary>
public interface IBilinearOperator<in TIn1, in TIn2, out TOut> : IOperator<TOut>, IBilinearMarker
{
}
