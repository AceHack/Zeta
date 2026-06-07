namespace Zeta.Core;

/// <summary>
/// Optional capability: issues genuinely asynchronous work.
/// </summary>
public interface IAsyncOperator
{
    bool IsAsync { get; }
}
