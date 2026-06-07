namespace Zeta.Core;

/// <summary>
/// Algebra capability: operator carries explicit stateful strict semantics.
/// </summary>
public interface IStatefulStrictOperator<in TIn, TState, out TOut> : IOperator<TOut>, IStatefulStrictMarker
{
}
