using System.Threading;
using System.Threading.Tasks;

namespace Zeta.Core;

/// <summary>
/// Plugin-author contract for a custom operator with a typed output.
/// </summary>
public interface IOperator<out TOut>
{
    string Name { get; }
    IStreamHandle[] ReadDependencies { get; }
    ValueTask StepAsync(IOutputBuffer<TOut> output, CancellationToken ct);
}
