using System.Threading;
using System.Threading.Tasks;

namespace Zeta.Core;

/// <summary>
/// Optional capability: strict operator (feedback-cut).
/// </summary>
public interface IStrictOperator<out TOut> : IOperator<TOut>
{
    public ValueTask AfterStepAsync(CancellationToken ct);
}
