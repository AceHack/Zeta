namespace Zeta.Core;

/// <summary>
/// Read-only port (covariant — can widen output type).
/// </summary>
public interface IReadPort<out T>
{
    /// <summary>Read the current value.</summary>
    public T Read();
}
