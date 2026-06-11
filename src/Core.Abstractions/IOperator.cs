using System.Threading;
using System.Threading.Tasks;

namespace Zeta.Core;

/// <summary>
/// Plugin-author contract for a custom operator with a typed output.
/// </summary>
public interface IOperator<out TOut>
{
    public string Name { get; }
    public IStreamHandle[] ReadDependencies { get; }
    public ValueTask StepAsync(IOutputBuffer<TOut> output, CancellationToken ct);
}
