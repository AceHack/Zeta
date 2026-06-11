namespace Zeta.Core;

/// <summary>
/// Optional capability: issues genuinely asynchronous work.
/// </summary>
public interface IAsyncOperator
{
    public bool IsAsync { get; }
}
